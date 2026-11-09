/**
 * Unified search route using PostgreSQL full-text search (tsvector + pg_trgm).
 * Falls back to semantic vector search when embeddings are enabled.
 * Both search paths use the SQL functions created in migration 0002.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ForbiddenError } from '../../utils/errors.js'
import { env } from '../../utils/env.js'
import { generateEmbedding } from '../../jobs/handlers/embeddings.js'
import { CACHE_TTL } from '../../plugins/cache.js'

const searchSchema = z.object({
  q: z.string().min(1).max(200).trim(),
  workspaceId: z.string().min(1),
  types: z.string().optional(), // comma-separated: 'message,task,document,canvas'
  limit: z.coerce.number().int().min(1).max(50).default(20),
  mode: z.enum(['fulltext', 'semantic', 'hybrid']).default('fulltext'),
})

interface SearchResult {
  entityType: string
  entityId: string
  title: string
  excerpt: string
  score: number
  createdAt: Date
  url: string
}

export const searchRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/search ───────────────────────────────────────────────
  app.get('/', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (req) => {
      const query = searchSchema.parse(req.query)
      const userId = req.user.sub

      // Verify workspace membership
      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: query.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      const types = query.types ? query.types.split(',').map((t) => t.trim()).filter(Boolean) : []

      // Cache key includes query hash
      const cacheKey = `search:${query.workspaceId}:${query.mode}:${Buffer.from(`${query.q}:${types.join(',')}`).toString('base64url').slice(0, 24)}`
      const cached = await app.redis.get(cacheKey)
      if (cached) {
        return { ...JSON.parse(cached), cached: true }
      }

      let results: SearchResult[] = []

      // ── Full-text search (always available) ──────────────────────────
      if (query.mode === 'fulltext' || query.mode === 'hybrid') {
        const rows = await app.db.$queryRaw<Array<{
          entity_type: string
          entity_id: string
          title: string
          excerpt: string
          score: number
          created_at: Date
        }>>`
          SELECT * FROM collabos_search(
            ${query.workspaceId}::text,
            ${query.q}::text,
            ${types}::text[],
            ${query.limit}::int
          )
        `

        results = rows.map((r) => ({
          entityType: r.entity_type,
          entityId: r.entity_id,
          title: r.title,
          excerpt: r.excerpt ?? '',
          score: r.score,
          createdAt: r.created_at,
          url: buildUrl(query.workspaceId, r.entity_type, r.entity_id),
        }))
      }

      // ── Semantic search (requires embeddings enabled + Ollama running) ──
      if ((query.mode === 'semantic' || query.mode === 'hybrid') && env.ENABLE_EMBEDDINGS) {
        try {
          const embedding = await generateEmbedding(query.q)
          if (embedding && embedding.length > 0) {
            const semanticRows = await app.db.$queryRaw<Array<{
              entity_type: string
              entity_id: string
              similarity: number
            }>>`
              SELECT * FROM collabos_semantic_search(
                ${query.workspaceId}::text,
                ${embedding}::float4[],
                ${types}::text[],
                ${query.limit}::int,
                0.65::float4
              )
            `

            if (query.mode === 'semantic') {
              // Enrich semantic results with entity details
              results = await enrichSemanticResults(semanticRows, query.workspaceId, app)
            } else {
              // Hybrid: merge full-text and semantic, deduplicate, re-rank
              const semanticEnriched = await enrichSemanticResults(semanticRows, query.workspaceId, app)
              const seenIds = new Set(results.map((r) => r.entityId))

              for (const r of semanticEnriched) {
                if (!seenIds.has(r.entityId)) {
                  results.push(r)
                  seenIds.add(r.entityId)
                } else {
                  // Boost score for results found in both passes
                  const existing = results.find((x) => x.entityId === r.entityId)
                  if (existing) existing.score = Math.min(1.0, existing.score * 1.3)
                }
              }

              // Re-sort by combined score
              results.sort((a, b) => b.score - a.score)
              results = results.slice(0, query.limit)
            }
          }
        } catch (err) {
          // Semantic search failure is non-fatal — return full-text results
          app.log.warn({ err }, 'Semantic search failed — returning full-text results only')
        }
      }

      const response = {
        results,
        total: results.length,
        query: query.q,
        mode: query.mode,
        cached: false,
      }

      // Cache for 15 seconds — short TTL because content changes frequently
      await app.redis.setex(cacheKey, CACHE_TTL.SHORT / 4, JSON.stringify(response))

      return response
    },
  })

  // ─── GET /v1/search/suggest — autocomplete suggestions ───────────
  app.get('/suggest', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    handler: async (req) => {
      const { q, workspaceId } = z.object({
        q: z.string().min(2).max(100).trim(),
        workspaceId: z.string().min(1),
      }).parse(req.query)

      const userId = req.user.sub

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      // Trigram-based suggestions — fast, returns most similar strings
      const suggestions = await app.db.$queryRaw<Array<{ text: string; type: string }>>`
        SELECT title AS text, 'document' AS type FROM documents
          WHERE workspace_id = ${workspaceId}
            AND deleted_at IS NULL
            AND title % ${q}
          ORDER BY similarity(title, ${q}) DESC
          LIMIT 5

        UNION ALL

        SELECT title AS text, 'task' AS type FROM tasks
          WHERE workspace_id = ${workspaceId}
            AND deleted_at IS NULL
            AND title % ${q}
          ORDER BY similarity(title, ${q}) DESC
          LIMIT 5

        UNION ALL

        SELECT name AS text, 'channel' AS type FROM channels
          WHERE workspace_id = ${workspaceId}
            AND deleted_at IS NULL
            AND name % ${q}
          ORDER BY similarity(name, ${q}) DESC
          LIMIT 3

        LIMIT 10
      `

      return { suggestions }
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildUrl = (workspaceId: string, entityType: string, entityId: string): string => {
  const base = `/workspace/${workspaceId}`
  switch (entityType) {
    case 'message': return `${base}/channels?msg=${entityId}`
    case 'task': return `${base}/tasks/${entityId}`
    case 'document': return `${base}/docs/${entityId}`
    case 'canvas': return `${base}/canvas/${entityId}`
    default: return base
  }
}

const enrichSemanticResults = async (
  rows: Array<{ entity_type: string; entity_id: string; similarity: number }>,
  workspaceId: string,
  app: FastifyInstance,
): Promise<SearchResult[]> => {
  if (rows.length === 0) return []

  const results: SearchResult[] = []

  for (const row of rows) {
    let title = ''
    let excerpt = ''
    let createdAt = new Date()

    try {
      if (row.entity_type === 'message') {
        const msg = await app.db.message.findUnique({
          where: { id: row.entity_id },
          select: { content: true, createdAt: true, author: { select: { name: true } } },
        })
        if (msg) {
          title = `Message by ${msg.author.name}`
          excerpt = msg.content.slice(0, 200)
          createdAt = msg.createdAt
        }
      } else if (row.entity_type === 'task') {
        const task = await app.db.task.findUnique({
          where: { id: row.entity_id },
          select: { title: true, description: true, createdAt: true },
        })
        if (task) {
          title = task.title
          excerpt = task.description?.slice(0, 200) ?? ''
          createdAt = task.createdAt
        }
      } else if (row.entity_type === 'document') {
        const doc = await app.db.document.findUnique({
          where: { id: row.entity_id },
          select: { title: true, createdAt: true },
        })
        if (doc) {
          title = doc.title
          createdAt = doc.createdAt
        }
      }

      results.push({
        entityType: row.entity_type,
        entityId: row.entity_id,
        title,
        excerpt,
        score: row.similarity,
        createdAt,
        url: buildUrl(workspaceId, row.entity_type, row.entity_id),
      })
    } catch {
      // Skip entities that can't be enriched
    }
  }

  return results
}
