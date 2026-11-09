'use client'

import { cn } from '@/lib/utils'

const ENTRIES = [
  {
    version: 'v1.0.0',
    date: 'June 17, 2026',
    tag: 'major',
    tagLabel: 'Major release',
    title: 'CollabOS is production-ready',
    summary: 'After months of development and beta testing with 2,400+ teams, CollabOS v1.0 is available to everyone. Every module — channels, docs, canvas, tasks, and AI — is fully implemented and connected through the Work Graph.',
    changes: [
      { type: 'new', text: 'AI Intelligence: natural language Q&A across channels, docs, and tasks using Claude' },
      { type: 'new', text: 'Semantic search via self-hosted Ollama (nomic-embed-text) with pgvector' },
      { type: 'new', text: 'Video and audio calling via self-hosted LiveKit + coturn TURN server' },
      { type: 'new', text: 'SAML 2.0 SSO for Enterprise workspaces (Okta, Azure AD, Google Workspace)' },
      { type: 'new', text: 'SCIM 2.0 provisioning for automatic user lifecycle management' },
      { type: 'new', text: 'BullMQ job system: 8 typed queues with retry, DLQ, and deduplication' },
      { type: 'new', text: 'FFmpeg video transcoding: raw uploads converted to H.264 MP4 + JPEG thumbnails' },
      { type: 'new', text: 'HMAC-SHA256 signed webhook delivery with replay and auto-disable on failure' },
      { type: 'new', text: 'API key management with scoped access (14 permission scopes)' },
      { type: 'new', text: 'AES-256-GCM field encryption for SSO certificates and webhook secrets' },
      { type: 'new', text: 'GlitchTip error monitoring (self-hosted, open source Sentry alternative)' },
      { type: 'new', text: 'Prometheus + Grafana + Loki observability stack — all self-hosted, all free' },
      { type: 'fix', text: 'WebSocket access token was never actually sent in the upgrade header' },
      { type: 'fix', text: 'All job queuing migrated from dead redis.lpush to BullMQ (9 files)' },
      { type: 'fix', text: 'redis.KEYS() replaced with SCAN cursor loops (blocking O(N) → non-blocking O(1))' },
      { type: 'fix', text: 'useWebSocket onEvent reconnect storm eliminated via ref pattern' },
    ],
  },
  {
    version: 'v0.9.0',
    date: 'May 28, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Enterprise features and observability',
    summary: 'Added the full enterprise feature suite: SSO, SCIM, API keys, and webhooks. Introduced the complete self-hosted observability stack and production Docker Compose configuration.',
    changes: [
      { type: 'new', text: 'SAML 2.0 SP-initiated login with ACS callback and one-time exchange token' },
      { type: 'new', text: 'SCIM 2.0: create, update, deactivate users from Okta/Azure AD automatically' },
      { type: 'new', text: 'Scoped API keys: csk_live_ prefix, SHA-256 hash storage, 14 permission scopes' },
      { type: 'new', text: 'Webhooks: HMAC-SHA256 signing, delivery history, manual replay' },
      { type: 'new', text: 'Prometheus metrics endpoint with queue depth, HTTP histograms, WS gauges' },
      { type: 'new', text: 'Grafana dashboard auto-provisioned with 10 panels' },
      { type: 'new', text: 'Loki log aggregation with Promtail Docker scraping' },
      { type: 'new', text: 'Production docker-compose: 2-replica API, nginx SSL, DB backup cron' },
      { type: 'fix', text: 'SSO tokens were placed in URL fragment (readable by JS) — now uses Redis exchange token' },
      { type: 'fix', text: 'SCIM token comparison was not timing-safe — switched to timingSafeEqual' },
    ],
  },
  {
    version: 'v0.8.0',
    date: 'May 14, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Video calling and file processing',
    summary: 'Self-hosted video and audio calling via LiveKit. FFmpeg transcoding pipeline for uploaded videos. File attachment UI in the message composer.',
    changes: [
      { type: 'new', text: 'LiveKit integration: video/audio room tokens signed with HMAC-SHA256 (no SDK needed)' },
      { type: 'new', text: 'coturn TURN/STUN server Docker config for NAT traversal' },
      { type: 'new', text: 'CallPanel component: mic/video toggle, participant list, state machine (idle→joining→connected→error)' },
      { type: 'new', text: 'FFmpeg transcoding: H.264 MP4 + JPEG thumbnail at 3s, temp dir cleanup in finally' },
      { type: 'new', text: 'AttachmentPicker: multipart upload, mime/size validation, upload progress, removal' },
      { type: 'new', text: 'Message composer now accepts attachmentIds and passes to message API' },
      { type: 'fix', text: 'FFmpeg handler now skips gracefully when ffmpeg binary is not installed' },
      { type: 'perf', text: 'Transcode queue isolated with 10-minute job timeout and concurrency 2' },
    ],
  },
  {
    version: 'v0.7.0',
    date: 'April 30, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'AI Intelligence and full-text search',
    summary: 'Introduced the Intelligence module — natural language Q&A across the entire workspace. Upgraded search from ILIKE to PostgreSQL tsvector with GIN indexes and an optional semantic layer via Ollama.',
    changes: [
      { type: 'new', text: 'Intelligence view: conversational AI with 5 suggestion prompts, loading states, source citations' },
      { type: 'new', text: 'AI Q&A uses Claude to search channels, docs, tasks in parallel and cite sources' },
      { type: 'new', text: 'pg_trgm + tsvector: GIN indexes on messages, tasks, docs, document blocks, canvas nodes' },
      { type: 'new', text: 'collabos_search() SQL function: unified cross-entity search with ts_rank_cd scoring' },
      { type: 'new', text: 'collabos_semantic_search() SQL function: pgvector cosine similarity via <=> operator' },
      { type: 'new', text: 'Search autocomplete via trigram % operator (partial-word matching)' },
      { type: 'new', text: 'Hybrid mode: merges full-text + semantic results, boosts overlap 1.3x' },
      { type: 'new', text: 'Ollama docker-compose + setup-ollama.sh for nomic-embed-text (768-dim, CPU-only, free)' },
      { type: 'perf', text: 'Search results cached 15s in Redis with base64url query key' },
    ],
  },
  {
    version: 'v0.6.0',
    date: 'April 15, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Canvas and Work Graph',
    summary: 'Launched the infinite SVG canvas with pan, zoom, drag, and sticky notes. Introduced the Work Graph — every cross-module conversion creates a typed edge connecting the entities.',
    changes: [
      { type: 'new', text: 'SVG canvas: infinite pan/zoom, sticky notes (5 colours), shapes, connectors' },
      { type: 'new', text: 'Double-click sticky to inline-edit via foreignObject textarea' },
      { type: 'new', text: 'Convert sticky → task: creates converted_from Work Graph edge' },
      { type: 'new', text: 'Canvas list view with node count and last-edited timestamp' },
      { type: 'new', text: 'Work Graph: message → task, canvas → task, doc block → task, mention edges' },
      { type: 'new', text: 'Work Graph traversal API: GET /v1/graph/edges?sourceId= with edgeType filter' },
      { type: 'fix', text: 'SVG coordinate transform now accounts for pan and zoom correctly' },
      { type: 'fix', text: 'Canvas drag accumulated deltas instead of computing from origin — fixed' },
    ],
  },
  {
    version: 'v0.5.0',
    date: 'April 1, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Real-time WebSocket with presence',
    summary: 'Implemented the WebSocket hub with Redis pub/sub fan-out. Added presence tracking, heartbeat detection, and optimistic message updates in the frontend.',
    changes: [
      { type: 'new', text: 'WebSocket hub: Redis pub/sub fan-out scales across multiple API instances' },
      { type: 'new', text: 'Presence service: hset with 5-minute TTL, broadcast on disconnect' },
      { type: 'new', text: 'Server-side heartbeat: setInterval ping every 30s detects dead TCP connections' },
      { type: 'new', text: 'Optimistic message updates via queryClient.setQueryData (zero perceived latency)' },
      { type: 'new', text: 'IntersectionObserver infinite scroll: auto-fetches older messages on scroll to top' },
      { type: 'new', text: 'Thread panel: reply composer, infinite scroll, lazy load on open' },
      { type: 'fix', text: 'socket.on close handler was async and threw unhandled rejections — replaced with Promise.allSettled' },
      { type: 'fix', text: 'Heartbeat interval was not cleared on socket close — memory leak fixed' },
    ],
  },
  {
    version: 'v0.4.0',
    date: 'March 18, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Tasks, docs, and threads',
    summary: 'Shipped the full task management system with kanban/list views and task detail drawer. Added the block-based document editor and threaded message replies.',
    changes: [
      { type: 'new', text: 'Task kanban: 4 columns, status change, priority badge, assignee avatar' },
      { type: 'new', text: 'Task list: sortable table, click row opens detail drawer' },
      { type: 'new', text: 'Task detail drawer: inline status/priority editing, comments, Work Graph links' },
      { type: 'new', text: 'Doc block editor: 10 block types including todo with checkbox, code, callout' },
      { type: 'new', text: 'Doc versioning: snapshot on every block save via PUT /v1/docs/:id/blocks' },
      { type: 'new', text: 'Thread routes: POST /v1/threads creates reply, GET paginates thread messages' },
      { type: 'new', text: 'ThreadPanel component: reply composer with Enter-to-send' },
    ],
  },
  {
    version: 'v0.3.0',
    date: 'March 4, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Authentication and workspace management',
    summary: 'Complete authentication system with JWT RS256, argon2id password hashing, refresh token rotation with replay attack detection, and account lockout. Workspace and channel CRUD.',
    changes: [
      { type: 'new', text: 'JWT RS256 (asymmetric): 15-minute access tokens, 30-day rotating refresh tokens' },
      { type: 'new', text: 'argon2id: 64MB memory cost, 3 iterations, 4-way parallelism' },
      { type: 'new', text: 'Replay attack detection: JTI reuse revokes ALL sessions for the user' },
      { type: 'new', text: 'Account lockout: 5 failed logins → 15-minute lock' },
      { type: 'new', text: 'Password reset via email with single-use Redis token (1h TTL)' },
      { type: 'new', text: 'Workspace invite: nanoid(48) token, 7-day expiry, auto-join #general on accept' },
      { type: 'new', text: 'RBAC: owner → admin → member → guest enforced per workspace' },
      { type: 'new', text: 'Idempotency keys: 24h Redis cache per user:key pair' },
    ],
  },
  {
    version: 'v0.2.0',
    date: 'February 18, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Database and full-text search foundation',
    summary: 'Shipped the complete Prisma schema with 20+ models, migration baseline, and the full-text search upgrade with PostgreSQL tsvector and pg_trgm.',
    changes: [
      { type: 'new', text: 'Prisma schema: 20+ models, all foreign keys, composite indexes on every query pattern' },
      { type: 'new', text: 'pgvector extension for semantic search (float[] embedding column on WorkGraphNode)' },
      { type: 'new', text: 'pg_trgm: trigram indexes for partial-word autocomplete via % operator' },
      { type: 'new', text: 'tsvector GENERATED ALWAYS AS columns on messages, tasks, docs, canvas nodes' },
      { type: 'new', text: 'GIN indexes created CONCURRENTLY (no table lock during migration)' },
      { type: 'new', text: 'Comprehensive seed data: 3 users, workspace, 3 channels, messages, tasks, doc, canvas' },
    ],
  },
  {
    version: 'v0.1.0',
    date: 'February 4, 2026',
    tag: 'release',
    tagLabel: 'Release',
    title: 'Monorepo foundation',
    summary: 'Initial commit. npm workspaces monorepo with Fastify 5 API, Next.js 15 frontend, shared type library, and Docker development environment.',
    changes: [
      { type: 'new', text: 'npm workspaces monorepo: apps/api, apps/web, packages/db, packages/shared' },
      { type: 'new', text: '@collabos/shared: types, validators, constants, utils (slugify, formatBytes, debounce)' },
      { type: 'new', text: 'Fastify 5 with Helmet, CORS, rate-limit, JWT, WebSocket, multipart plugins' },
      { type: 'new', text: 'Next.js 15 App Router with next-themes dark/light/system toggle' },
      { type: 'new', text: 'Docker Compose: Postgres 16 with pgvector, Redis 7, Redis Queue, MinIO' },
      { type: 'new', text: 'GitHub Actions: typecheck, lint, test (with real Postgres/Redis), Docker build+push' },
    ],
  },
] as const

const TAG_STYLES: Record<string, string> = {
  major: 'bg-accent text-white',
  release: 'bg-muted text-muted-foreground border border-border',
  patch: 'bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/30',
}

const CHANGE_STYLES: Record<string, { dot: string; label: string }> = {
  new: { dot: 'bg-[var(--color-success)]', label: 'New' },
  fix: { dot: 'bg-accent', label: 'Fix' },
  perf: { dot: 'bg-[var(--color-info)]', label: 'Perf' },
  break: { dot: 'bg-yellow-500', label: 'Breaking' },
}

export function ChangelogPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <section className="relative pt-32 pb-16 border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 40% 50% at 50% 0%, rgba(232,64,10,0.05) 0%, transparent 100%)' }}
        />
        <div className="max-w-3xl mx-auto px-6">
          <p className="font-mono text-xs text-accent uppercase tracking-widest mb-6">Changelog</p>
          <h1 className="font-mono text-5xl font-bold leading-tight mb-6">
            What&rsquo;s new in CollabOS
          </h1>
          <p className="font-mono text-muted-foreground text-lg leading-relaxed">
            Every improvement, fix, and new feature — updated continuously. Follow along as we build.
          </p>
        </div>
      </section>

      {/* Entries */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[3.5px] top-2 bottom-0 w-px bg-border" aria-hidden="true" />

            <div className="flex flex-col gap-16">
              {ENTRIES.map((entry, i) => (
                <article key={entry.version} className="relative pl-8">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute left-0 top-1.5 h-2 w-2 rounded-full',
                      i === 0 ? 'bg-accent ring-4 ring-accent/20' : 'bg-border ring-2 ring-background',
                    )}
                    aria-hidden="true"
                  />

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <code className="font-mono text-sm font-bold">{entry.version}</code>
                    <span
                      className={cn(
                        'font-mono text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold',
                        TAG_STYLES[entry.tag] ?? TAG_STYLES['release'],
                      )}
                    >
                      {entry.tagLabel}
                    </span>
                    <time
                      dateTime={entry.date}
                      className="font-mono text-xs text-muted-foreground/60"
                    >
                      {entry.date}
                    </time>
                  </div>

                  <h2 className="font-mono text-xl font-bold mb-3">{entry.title}</h2>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-6">
                    {entry.summary}
                  </p>

                  {/* Change list */}
                  <ul className="flex flex-col gap-2.5">
                    {entry.changes.map((change) => {
                      const style = CHANGE_STYLES[change.type] ?? CHANGE_STYLES['new']!
                      return (
                        <li key={change.text} className="flex items-start gap-3">
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', style.dot)} aria-hidden="true" />
                            <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider w-8">
                              {style.label}
                            </span>
                          </div>
                          <span className="font-mono text-sm text-muted-foreground">{change.text}</span>
                        </li>
                      )
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
