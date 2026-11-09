-- Full-text search upgrade using PostgreSQL tsvector + pg_trgm
-- This migration adds:
--   1. pg_trgm extension for trigram similarity (partial-word matching)
--   2. search_vector generated columns on messages, tasks, documents
--   3. GIN indexes on search vectors (fast full-text lookup)
--   4. Trigram indexes for ILIKE-style partial matching
--   5. Update trigger to keep vectors current

-- Enable pg_trgm for trigram similarity and partial-word matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Messages ──────────────────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(content, ''))
    ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_search_vector_idx
  ON messages USING GIN (search_vector);

-- Trigram index for partial/fuzzy matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_content_trgm_idx
  ON messages USING GIN (content gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ─── Tasks ─────────────────────────────────────────────────────────────────

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(title, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(array_to_string(tags, ' '), '')
      )
    ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_search_vector_idx
  ON tasks USING GIN (search_vector);

CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_title_trgm_idx
  ON tasks USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ─── Documents ─────────────────────────────────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(title, ''))
    ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_search_vector_idx
  ON documents USING GIN (search_vector);

CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_title_trgm_idx
  ON documents USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ─── Document blocks — index block text content ────────────────────────────

ALTER TABLE document_blocks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce((content->>'text')::text, '') || ' ' ||
        coalesce((content->>'code')::text, '')
      )
    ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_blocks_search_vector_idx
  ON document_blocks USING GIN (search_vector);

-- ─── Canvas nodes — index sticky note text ────────────────────────────────

ALTER TABLE canvas_nodes
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce((content->>'text')::text, '') || ' ' ||
        coalesce((content->>'label')::text, '')
      )
    ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS canvas_nodes_search_vector_idx
  ON canvas_nodes USING GIN (search_vector);

-- ─── Unified search function ───────────────────────────────────────────────
-- This function searches across all entity types in a single query
-- and returns ranked results using ts_rank_cd (cover density ranking)

CREATE OR REPLACE FUNCTION collabos_search(
  p_workspace_id TEXT,
  p_query        TEXT,
  p_types        TEXT[],
  p_limit        INT DEFAULT 20
)
RETURNS TABLE (
  entity_type  TEXT,
  entity_id    TEXT,
  title        TEXT,
  excerpt      TEXT,
  score        FLOAT4,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tsquery tsquery;
  v_plain   TEXT;
BEGIN
  -- Build tsquery — fallback to plain text if parsing fails
  BEGIN
    v_tsquery := websearch_to_tsquery('english', p_query);
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := plainto_tsquery('english', p_query);
  END;

  v_plain := '%' || p_query || '%';

  RETURN QUERY

  -- Messages
  SELECT
    'message'::TEXT,
    m.id,
    'Message by ' || u.name,
    ts_headline('english', m.content, v_tsquery,
      'MaxFragments=1, MaxWords=20, MinWords=5, StartSel=**, StopSel=**'),
    ts_rank_cd(m.search_vector, v_tsquery),
    m.created_at
  FROM messages m
  JOIN users u ON u.id = m.author_id
  JOIN channels ch ON ch.id = m.channel_id
  WHERE ch.workspace_id = p_workspace_id
    AND m.deleted_at IS NULL
    AND ('message' = ANY(p_types) OR p_types = '{}')
    AND (
      m.search_vector @@ v_tsquery
      OR m.content ILIKE v_plain
    )

  UNION ALL

  -- Tasks
  SELECT
    'task'::TEXT,
    t.id,
    t.title,
    coalesce(
      ts_headline('english', coalesce(t.description,''), v_tsquery,
        'MaxFragments=1, MaxWords=15, MinWords=3'),
      t.title
    ),
    ts_rank_cd(t.search_vector, v_tsquery),
    t.created_at
  FROM tasks t
  WHERE t.workspace_id = p_workspace_id
    AND t.deleted_at IS NULL
    AND ('task' = ANY(p_types) OR p_types = '{}')
    AND (
      t.search_vector @@ v_tsquery
      OR t.title ILIKE v_plain
    )

  UNION ALL

  -- Documents
  SELECT
    'document'::TEXT,
    d.id,
    d.title,
    ts_headline('english', d.title, v_tsquery,
      'MaxFragments=1, MaxWords=10, MinWords=3, StartSel=**, StopSel=**'),
    ts_rank_cd(d.search_vector, v_tsquery),
    d.created_at
  FROM documents d
  WHERE d.workspace_id = p_workspace_id
    AND d.deleted_at IS NULL
    AND ('document' = ANY(p_types) OR p_types = '{}')
    AND (
      d.search_vector @@ v_tsquery
      OR d.title ILIKE v_plain
    )

  UNION ALL

  -- Canvas nodes
  SELECT
    'canvas'::TEXT,
    cn.canvas_id,
    coalesce((cn.content->>'text')::text, (cn.content->>'label')::text, 'Canvas node'),
    coalesce((cn.content->>'text')::text, ''),
    ts_rank_cd(cn.search_vector, v_tsquery),
    c.created_at
  FROM canvas_nodes cn
  JOIN canvases c ON c.id = cn.canvas_id
  WHERE c.workspace_id = p_workspace_id
    AND c.deleted_at IS NULL
    AND ('canvas' = ANY(p_types) OR p_types = '{}')
    AND cn.search_vector @@ v_tsquery

  ORDER BY score DESC
  LIMIT p_limit;
END;
$$;

-- ─── Semantic search function (pgvector cosine similarity) ─────────────────
-- Used when embeddings are enabled.
-- Requires: pgvector extension and populated work_graph_nodes.embedding column

CREATE OR REPLACE FUNCTION collabos_semantic_search(
  p_workspace_id TEXT,
  p_embedding    FLOAT4[],
  p_types        TEXT[],
  p_limit        INT DEFAULT 20,
  p_threshold    FLOAT4 DEFAULT 0.7
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id   TEXT,
  similarity  FLOAT4
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wgn.entity_type,
    wgn.entity_id,
    1.0 - (wgn.embedding::vector <=> p_embedding::vector) AS similarity
  FROM work_graph_nodes wgn
  WHERE wgn.workspace_id = p_workspace_id
    AND array_length(wgn.embedding, 1) = array_length(p_embedding, 1)
    AND (p_types = '{}' OR wgn.entity_type = ANY(p_types))
    AND 1.0 - (wgn.embedding::vector <=> p_embedding::vector) >= p_threshold
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute to application role
-- GRANT EXECUTE ON FUNCTION collabos_search TO collabos_app;
-- GRANT EXECUTE ON FUNCTION collabos_semantic_search TO collabos_app;
