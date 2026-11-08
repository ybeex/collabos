# CollabOS — Git Branch & Commit History

Complete git history organized by milestone. Run commands in order from the project root.

---

## Setup

```bash
git init
git remote add origin https://github.com/your-org/collabos.git
git checkout -b main
```

---

## Milestone 1 — Monorepo Foundation

### Branch: `feat/monorepo-setup`
```bash
git checkout -b feat/monorepo-setup

# Commit 1
mkdir -p apps/api apps/web packages/db packages/shared
cat > package.json << 'EOF'
{
  "name": "collabos",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=22.0.0" }
}
EOF
git add package.json
git commit -m "chore: initialize npm workspaces monorepo

- Root package.json with workspaces: apps/*, packages/*
- Node.js 22+ engine requirement
- Establishes monorepo structure for api, web, db, shared packages"

# Commit 2
# (create tsconfig.base.json, .gitignore, .env.example, .editorconfig)
git add tsconfig.base.json .gitignore .env.example .editorconfig
git commit -m "chore: add base TypeScript config and project tooling

- tsconfig.base.json with strict mode, ESM output, path aliases
- .gitignore covers node_modules, dist, .env, build artifacts
- .env.example documents all required and optional env vars
- .editorconfig enforces consistent whitespace across editors"

# Commit 3
# (create packages/shared with types, constants, validators, utils)
git add packages/shared/
git commit -m "feat(shared): create @collabos/shared package

- Type definitions: User, Workspace, Channel, Message, Task, Document,
  Canvas, WorkGraphEdge, PaginatedResponse, WSEvent, ApiError
- Zod validators for all entity schemas
- Constants: TASK_STATUS_ORDER, PRIORITY_ORDER, RATE_LIMITS per plan
- Utilities: slugify, truncate, formatBytes, formatRelativeTime,
  isValidUrl, retryWithBackoff, debounce"

# Commit 4
git add packages/db/
git commit -m "feat(db): initialize @collabos/db package with Prisma 6

- Prisma schema: User, Workspace, WorkspaceMember, WorkspaceInvite
- Channel, ChannelMember, Thread, Message, MessageReaction, Attachment
- Document, DocumentBlock, DocumentVersion
- Project, Task, TaskComment
- Canvas, CanvasNode
- WorkGraphNode, WorkGraphEdge
- AuditLog
- All indexes: foreign keys, composite queries, sort columns
- pgvector float[] column on WorkGraphNode for semantic search"

git checkout main
git merge feat/monorepo-setup --no-ff -m "feat: monorepo foundation (#1)"
```

---

## Milestone 2 — Database Layer

### Branch: `feat/db-schema-migrations`
```bash
git checkout -b feat/db-schema-migrations

# Commit 1
git add packages/db/prisma/migrations/0001_initial/
git commit -m "feat(db): add initial migration SQL

- All CREATE TABLE statements with correct column types
- Enum types: UserPlan, WorkspacePlan, MemberRole, MemberStatus,
  ChannelType, TaskStatus, TaskPriority, BlockType, EdgeType
- All UNIQUE, FOREIGN KEY, and ON DELETE CASCADE constraints
- All GIN, BTREE, and composite indexes
- pgvector extension CREATE EXTENSION IF NOT EXISTS"

# Commit 2
git add packages/db/prisma/migrations/0002_full_text_search/
git commit -m "feat(db): add full-text search migration

- Enable pg_trgm extension for trigram similarity
- Add tsvector GENERATED ALWAYS AS columns on messages, tasks,
  documents, document_blocks, canvas_nodes
- CREATE INDEX CONCURRENTLY GIN indexes on all search vectors
- Trigram indexes for partial-word autocomplete (title % query)
- collabos_search() SQL function: unified cross-entity full-text
  search using websearch_to_tsquery + ts_rank_cd scoring
- collabos_semantic_search() SQL function: pgvector cosine
  similarity via <=> operator with threshold filtering"

# Commit 3
git add packages/db/src/seeds/
git commit -m "feat(db): add comprehensive seed data

- 3 seed users: alice (owner/Pro), bob (admin/Pro), carol (member/Free)
- Workspace: acme-corp with all users as members
- 3 channels: general, product, engineering with members
- 7 seed messages across channels
- Q3 Launch project with 5 tasks across all statuses
- Pricing Strategy document with 6 blocks
- Sprint Planning canvas with 4 nodes (sticky notes + shape frame)
- Credentials documented: password123 for all seed users"

git checkout main
git merge feat/db-schema-migrations --no-ff -m "feat: database layer with full-text search (#2)"
```

---

## Milestone 3 — API Foundation

### Branch: `feat/api-fastify-setup`
```bash
git checkout -b feat/api-fastify-setup

# Commit 1
git add apps/api/src/index.ts apps/api/src/app.ts
git commit -m "feat(api): bootstrap Fastify 5 application

- buildApp() factory function for testability
- Helmet: CSP, HSTS maxAge 63072000 with preload, referrer policy
- CORS: allowlist-based, credentials: true, exposed rate-limit headers
- @fastify/rate-limit: 300/min global, IP-based, custom error format
- @fastify/jwt: RS256 asymmetric, 15-minute access tokens
- @fastify/websocket for WebSocket support
- @fastify/multipart: 50MB file limit, 10 files max
- Swagger docs on /docs in non-production environments
- Graceful shutdown: SIGINT/SIGTERM drain in-flight requests"

# Commit 2
git add apps/api/src/plugins/ apps/api/src/middleware/
git commit -m "feat(api): add plugins and middleware

- redisPlugin: ioredis connection with TLS support, ping health check
- dbPlugin: Prisma client singleton with connection pooling
- CacheService: get/set/del/getOrSet/delPattern using SCAN not KEYS,
  typed TTLs SHORT(60s) MEDIUM(300s) LONG(3600s) DAY(86400s)
- authMiddleware: jwtVerify with UnauthorizedError on failure
- requireRole: RBAC middleware enforcing guest→member→admin→owner
- errorHandler: AppError → typed response, Zod validation → 422,
  unexpected errors captured by GlitchTip monitoring
- requestLogger: Pino structured logging + Prometheus metric recording"

# Commit 3
git add apps/api/src/utils/
git commit -m "feat(api): add utility modules

- env.ts: Zod schema for all environment variables, exits on invalid
- logger.ts: Pino with pretty-print in dev, JSON in production
- errors.ts: AppError, NotFoundError, UnauthorizedError, ForbiddenError,
  ConflictError, ValidationError, RateLimitError, ServiceUnavailableError
- cursor.ts: encodeCursor/decodeCursor (base64url JSON), buildPaginatedResult
- idempotency.ts: Redis-backed 24h idempotency with userId:key composite
  (Bug fixed: uses req.user.sub not req.user.id)
- encryption.ts: AES-256-GCM, random 12-byte IV, 16-byte auth tag
- monitoring.ts: GlitchTip client with PII scrubbing (10 sensitive fields)"

git checkout main
git merge feat/api-fastify-setup --no-ff -m "feat: API foundation (#3)"
```

---

## Milestone 4 — Authentication System

### Branch: `feat/auth-jwt-argon2`
```bash
git checkout -b feat/auth-jwt-argon2

# Commit 1
git add apps/api/src/routes/auth/
git commit -m "feat(auth): implement registration and login

- POST /v1/auth/register: argon2id (64MB/3i/4p), nanoid(21) user ID,
  rate limited 5/hour, idempotency key support, audit log
- POST /v1/auth/login: account lockout after 5 failures (15-min lock),
  signTokenPair helper: RS256 access token + refresh token with JTI
  stored in Redis with 30-day TTL, rate limited 10/15min
- GET /v1/auth/me: returns current user, cache invalidation on profile change
- POST /v1/auth/refresh: JTI rotation — old JTI deleted, new JTI stored,
  replay attack detection: reuse of old token revokes ALL user sessions
- POST /v1/auth/logout: deletes JTI from Redis, clears session
- PATCH /v1/auth/me: partial profile update (name, timezone, avatarUrl)"

# Commit 2
git add apps/api/src/routes/auth/index.ts
git commit -m "feat(auth): add password reset flow

- POST /v1/auth/forgot-password: nanoid(48) token stored in Redis 1h TTL,
  always responds 200 to prevent email enumeration, queues email via BullMQ
  (Bug fixed: was lpush to dead queue, now uses enqueueEmail())
- POST /v1/auth/reset-password: validates Redis token, rehashes password,
  DELETES the token immediately (single-use), revokes sessions via version
  counter incr refresh_version:userId (Bug fixed: was redis.KEYS() scan)"

# Commit 3
git add apps/api/src/routes/auth/index.ts
git commit -m "feat(auth): add SSO exchange endpoint

- POST /v1/auth/sso/exchange: consumes one-time 60s Redis exchange token,
  returns accessToken + refreshToken over JSON
- Exchange token prevents SSO tokens from appearing in URL fragments,
  browser history, or server access logs
  (Bug fixed: original code put JWTs in #fragment, readable by JS)"

git checkout main
git merge feat/auth-jwt-argon2 --no-ff -m "feat: authentication system with JWT RS256 + argon2id (#4)"
```

---

## Milestone 5 — Workspace & Channel Management

### Branch: `feat/workspaces-channels`
```bash
git checkout -b feat/workspaces-channels

# Commit 1
git add apps/api/src/routes/workspaces/
git commit -m "feat(workspaces): implement workspace CRUD and membership

- GET /v1/workspaces: list user's workspaces with role
- POST /v1/workspaces: create workspace, auto-create #general channel,
  auto-join creator as owner member, idempotency key support
- PATCH /v1/workspaces/:id: admin-only, cache invalidation
- POST /v1/workspaces/:id/invite: generate nanoid(48) invite token,
  7-day expiry, stores in DB + Redis, queues invite email via BullMQ
  (Bug fixed: was lpush to dead queue)
- GET /v1/workspaces/invite/:token: validates token, returns workspace info
- POST /v1/workspaces/invite/:token/accept: upsert membership, mark token
  accepted, auto-join #general channel, audit log"

# Commit 2
git add apps/api/src/routes/channels/
git commit -m "feat(channels): implement channel management

- GET /v1/channels?workspaceId=: list channels, Redis cache 5min
- POST /v1/channels: create public/private/direct channel, auto-add creator
- GET /v1/channels/:id: single channel with member count
- GET /v1/channels/:id/messages: cursor-based pagination (limit+1 trick),
  includes author, reactions, attachments, soft-deleted shown as [deleted]
- PATCH /v1/channels/:id: admin-only rename/describe/archive
- POST /v1/channels/:id/join: add caller to channel members
- PATCH /v1/channels/:id/read: update lastReadAt for unread count"

# Commit 3
git add apps/api/src/routes/messages/
git commit -m "feat(messages): implement message lifecycle

- POST /v1/messages: create with content + optional attachments, idempotency,
  fan-out via Redis pub/sub to all workspace WS clients,
  enqueues search-index and notifications jobs via BullMQ
  (Bug fixed: was lpush to dead queues)
- PATCH /v1/messages/:id: author-only edit, sets editedAt, broadcasts update
- DELETE /v1/messages/:id: soft delete (sets deletedAt), broadcasts deletion
- POST /v1/messages/:id/reactions: toggle reaction emoji, upsert/delete
- POST /v1/messages/:id/tasks: Work Graph edge: message→task conversion"

git checkout main
git merge feat/workspaces-channels --no-ff -m "feat: workspace and channel management (#5)"
```

---

## Milestone 6 — Real-Time WebSocket

### Branch: `feat/websocket-presence`
```bash
git checkout -b feat/websocket-presence

# Commit 1
git add apps/api/src/routes/ws/
git commit -m "feat(ws): implement WebSocket hub with Redis pub/sub

- GET /v1/ws/workspace/:workspaceId (WebSocket upgrade)
- JWT auth via sec-websocket-protocol header (browsers cannot send custom headers)
- Workspace membership verified before accepting connection
- Redis subscriber duplicated per connection for isolation
- In-memory clients Map for fast local lookups
- Redis pub/sub channels: ws:workspace:id and ws:user:id
- Broadcasts: message.created/updated/deleted, task.*, canvas.node.*,
  call.*, thread.*, presence.updated events"

# Commit 2
git add apps/api/src/routes/ws/index.ts
git commit -m "feat(ws): add heartbeat and safe cleanup

- Server-side setInterval ping every 30s to detect dead TCP connections
  (Bug fixed: only client ping existed, dead connections leaked in clients Map)
- socket.on('close') uses Promise.allSettled() for cleanup
  (Bug fixed: async close handler threw unhandled rejections on Redis errors)
- heartbeatTimer cleared on close to prevent memory leak
- subscriber.unsubscribe() + subscriber.quit() in allSettled to avoid
  orphaned Redis pub/sub connections
- Presence: hset status=offline + publish presence.updated on disconnect"

# Commit 3
git add apps/api/src/services/presence.ts
git commit -m "feat(ws): add presence service

- PresenceService.setPresence(): hset with merged data, expire 300s
- PresenceService.getPresence(): hgetall with null guard
- PresenceService.getWorkspacePresence(): pipeline batch hgetall
- PresenceService.markOffline(): sets status field only
- PresenceData interface: status, workspaceId, activeChannel, lastSeen
- TTL of 5 minutes — refreshed on any client activity (ping/message/action)"

git checkout main
git merge feat/websocket-presence --no-ff -m "feat: real-time WebSocket with presence (#6)"
```

---

## Milestone 7 — Tasks & Documents

### Branch: `feat/tasks-documents`
```bash
git checkout -b feat/tasks-documents

# Commit 1
git add apps/api/src/routes/tasks/
git commit -m "feat(tasks): implement full task lifecycle

- GET /v1/tasks: cursor pagination, filter by workspaceId/projectId/status/
  assigneeId/priority/dueDate, includes assignee + createdBy + comments
- POST /v1/tasks: create with Work Graph node creation, idempotency,
  enqueueSearchIndex via BullMQ (Bug fixed: was lpush)
- PATCH /v1/tasks/:id: partial update, status change broadcasts WS event,
  enqueues automation trigger via BullMQ (Bug fixed: was lpush)
- DELETE /v1/tasks/:id: soft delete, broadcast task.deleted
- POST /v1/tasks/:taskId/comments: create comment, broadcast event"

# Commit 2
git add apps/api/src/routes/docs/
git commit -m "feat(docs): implement document block editor backend

- GET /v1/docs?workspaceId=: list documents, order by updatedAt
- POST /v1/docs: create document with optional initial title
- GET /v1/docs/:id: document with all blocks ordered by order field
- PUT /v1/docs/:id/blocks: atomic block upsert in transaction, creates
  version snapshot, enqueueSearchIndex via BullMQ (Bug fixed: was lpush)
- PATCH /v1/docs/:id: update title/icon/isPublic
- DELETE /v1/docs/:id: soft delete"

# Commit 3
git add apps/api/src/routes/canvas/
git commit -m "feat(canvas): implement infinite canvas backend

- GET /v1/canvases?workspaceId=: list with node count, Redis cache
- POST /v1/canvases: create canvas, cache invalidation
- GET /v1/canvases/:id: canvas with all nodes
- POST /v1/canvases/:id/nodes: create node (sticky/shape/text/image/
  connector/doc_embed/task_embed/frame), broadcasts canvas.node.created
- PATCH /v1/canvases/:id/nodes/:nodeId: move/resize node,
  broadcasts canvas.node.moved for real-time collaboration
- POST /v1/canvases/:id/nodes/:nodeId/tasks: Work Graph conversion
  (sticky note → task creates converted_from edge)"

git checkout main
git merge feat/tasks-documents --no-ff -m "feat: tasks, documents, and canvas (#7)"
```

---

## Milestone 8 — AI & Search

### Branch: `feat/ai-search`
```bash
git checkout -b feat/ai-search

# Commit 1
git add apps/api/src/routes/ai/
git commit -m "feat(ai): implement workspace intelligence endpoints

- POST /v1/ai/query: workspace Q&A using Anthropic Claude, gathers context
  from recent messages/tasks/docs, returns answer with source citations
  and contextUsed counts (messages, tasks, documents searched)
- POST /v1/ai/summarize: summarize channel/task/doc using entity-specific
  context gathering strategies
- POST /v1/ai/tasks/generate: extract actionable tasks from freeform text,
  returns structured task list with title/priority/assignee suggestions"

# Commit 2
git add apps/api/src/routes/search/
git commit -m "feat(search): implement PostgreSQL full-text + semantic search

- GET /v1/search: three modes — fulltext, semantic, hybrid
- fulltext: calls collabos_search() SQL function, uses
  websearch_to_tsquery + ts_rank_cd, returns excerpts via ts_headline
- semantic: generates embeddings via Ollama/Anthropic, calls
  collabos_semantic_search() pgvector <=> cosine similarity
- hybrid: runs both passes, deduplicates by entityId, boosts
  score 1.3x for results found in both (capped at 1.0)
- 15s Redis cache on search results (short TTL for live data)
- GET /v1/search/suggest: trigram autocomplete using % operator"

# Commit 3
git add apps/api/src/routes/graph/
git commit -m "feat(graph): implement Work Graph edge traversal

- GET /v1/graph/edges: list edges by sourceId or targetId with
  optional edgeType filter, workspace-scoped
- Work Graph edge types: converted_from, referenced_in, mentioned_in,
  related_to, produced_by, decided_in
- Edges created automatically on: message→task, sticky→task,
  doc block embeds, @mention detection in notifications
- Powers AI context gathering: AI follows edges to find related content"

git checkout main
git merge feat/ai-search --no-ff -m "feat: AI intelligence and full-text search (#8)"
```

---

## Milestone 9 — File Upload & Thread System

### Branch: `feat/upload-threads`
```bash
git checkout -b feat/upload-threads

# Commit 1
git add apps/api/src/routes/upload/
git commit -m "feat(upload): implement S3-compatible file upload

- POST /v1/upload: multipart form, validate mime type allowlist
  (image/*, application/pdf, text/*, video/mp4, audio/*),
  50MB size limit, generates unique S3 key with nanoid prefix
- S3 PUT upload with content-type and content-length headers
- Creates Attachment DB record, returns public URL
- DELETE /v1/upload/:id: soft delete attachment, S3 object deletion
  queued (best-effort, non-blocking)
- Triggers transcode job via BullMQ for video/* uploads"

# Commit 2
git add apps/api/src/routes/threads/
git commit -m "feat(threads): implement threaded message replies

- POST /v1/threads: create reply on a message, auto-creates Thread
  record if first reply, updates lastReplyAt, broadcasts
  thread.reply_added to channel WS channel
- GET /v1/threads/:threadId/messages: cursor-paginated thread messages
  with author, reactions, attachments
- Notification queued for all previous thread participants on new reply
- Thread reply count accessible via parentMessage._count"

# Commit 3
git add apps/api/src/routes/admin/
git commit -m "feat(admin): implement workspace admin dashboard endpoints

- GET /v1/admin/:workspaceId/overview: member count, channel count,
  task count, doc count, messages last 30 days, tasks by status
- GET /v1/admin/:workspaceId/members: paginated member list with
  user details, filterable by status
- PATCH /v1/admin/:workspaceId/members/:userId: change role/status,
  blocks modification of owner role, audit log, cache invalidation
- DELETE /v1/admin/:workspaceId/members/:userId: set status=left,
  audit log — owner cannot be removed"

git checkout main
git merge feat/upload-threads --no-ff -m "feat: file upload, threads, and admin (#9)"
```

---

## Milestone 10 — Background Job System

### Branch: `feat/bullmq-job-system`
```bash
git checkout -b feat/bullmq-job-system

# Commit 1
git add apps/api/src/jobs/queues/
git commit -m "feat(jobs): implement BullMQ typed queue system

- 8 queues: email(c5), notifications(c10), search-index(c3),
  embeddings(c2), automations(c5), transcode(c2), webhooks(c10), scheduled
- Type-safe job data interfaces for each queue
- Job options: attempts(2-5), exponential/fixed backoff, removeOnComplete TTL,
  removeOnFail 7d, priority levels, 10min timeout for transcode
- Deduplication: search-index and embeddings use jobId by entityId
- REDIS_QUEUE_URL: separate Redis instance prevents LRU eviction killing jobs
- getQueueMetrics(): parallel queue depth collection for Prometheus
- Convenience helpers: enqueueEmail, enqueueNotification, enqueueSearchIndex,
  enqueueEmbedding, enqueueTranscode, enqueueWebhook"

# Commit 2
git add apps/api/src/jobs/queues/worker-registry.ts apps/api/src/jobs/worker.ts
git commit -m "feat(jobs): implement BullMQ worker registry

- createWorker<T>(): generic factory with structured logging, duration tracking
- All 7 workers registered with typed job data
- Failed job logging at max-attempts: shows jobId, type, attempts
- Worker-level error handler for connection errors
- Graceful shutdown: Promise.all(workers.map(w => w.close())) on SIGINT/SIGTERM
- Unhandled rejection exits process with code 1 (caught by Docker restart policy)"

# Commit 3
git add apps/api/src/jobs/handlers/
git commit -m "feat(jobs): implement all job handlers

- email.ts: routes to correct template by type (invite, reset, mention, digest)
  using emailTemplates from services/email.ts, calls sendEmail()
- notifications.ts: parses @mentions from message content, creates Notification
  DB records, checks user prefs (mentions + emailNotifications), uses
  BullMQ enqueueEmail not lpush (Bug fixed: was lpush to dead queue)
- search-index.ts: upserts WorkGraphNode for entity indexing
- embeddings.ts: Ollama nomic-embed-text (free, CPU) with Anthropic fallback,
  upserts embedding vector in work_graph_nodes
- transcode.ts: FFmpeg H.264 (crf23/fast/faststart/1280px) + JPEG thumbnail
  at 3s, temp dir cleanup in finally block, skips gracefully if no FFmpeg
- webhook.ts: HMAC-SHA256 sign with timestamp, 10s timeout, delivery record,
  auto-disable endpoint after 10 consecutive failures, re-enable on replay
- automations.ts: rule engine from workspace.settings.automations JSON,
  notify_channel and send_email executors, uses BullMQ not lpush"

git checkout main
git merge feat/bullmq-job-system --no-ff -m "feat: BullMQ job queue system with 7 workers (#10)"
```

---

## Milestone 11 — Enterprise Features

### Branch: `feat/sso-saml`
```bash
git checkout -b feat/sso-saml

# Commit 1
git add apps/api/src/utils/encryption.ts
git commit -m "feat(security): implement AES-256-GCM field encryption

- encrypt(): random 12-byte IV (96-bit GCM recommended), 16-byte auth tag
  detects tampering, returns iv:ciphertext:authTag hex string
- decrypt(): parses triple, createDecipheriv with setAuthTag, throws on tamper
- encryptSafe/decryptSafe: graceful handling of unencrypted legacy values
- Used for: SSO certificates, webhook signing secrets, SCIM tokens
- Key from ENCRYPTION_KEY (64 hex chars = 32 bytes = 256 bits AES-256)"

# Commit 2
git add apps/api/src/routes/sso/
git commit -m "feat(sso): implement SAML 2.0 SP-initiated SSO

- GET /v1/sso/:workspaceSlug: build SAMLRequest AuthnRequest XML,
  base64 encode, redirect to IdP ssoUrl with RelayState
  Stores requestId in Redis 5min to prevent replay attacks
- POST /v1/sso/:workspaceSlug/callback (ACS): decodes SAMLResponse,
  parses assertion attributes with configurable attributeMapping,
  finds/creates user, ensures workspace membership, issues JWT pair
  (Bug fixed: was redirecting tokens in URL fragment, now uses one-time
  Redis exchange token readable only via POST /v1/auth/sso/exchange)
- GET/PUT /v1/sso/:workspaceSlug/config: admin-only, certificate
  encrypted with AES-256-GCM before DB storage, Business+ plan gate"

# Commit 3
git add apps/api/src/routes/scim/
git commit -m "feat(scim): implement SCIM 2.0 provisioning

- Bearer token auth: SHA-256 hash stored, timing-safe comparison per call
- POST /v1/scim/:workspaceId/token: admin-only, revokes previous tokens,
  raw token shown once (never stored in plaintext), audit log
- GET /v1/scim/:workspaceId/Users: list with simple filter userName eq
- GET /v1/scim/:workspaceId/Users/:id: single user
- POST /v1/scim/:workspaceId/Users: provision user (create or reactivate),
  set unusable SSO password hash, create workspace membership
- PATCH /v1/scim/:workspaceId/Users/:id: handle active=false (suspend user
  + set deletedAt), active=true (reactivate), name updates
- DELETE /v1/scim/:workspaceId/Users/:id: set status=left, audit log"

git checkout main
git merge feat/sso-saml --no-ff -m "feat: SAML SSO and SCIM 2.0 provisioning (#11)"
```

---

### Branch: `feat/api-keys-webhooks`
```bash
git checkout -b feat/api-keys-webhooks

# Commit 1
git add apps/api/src/routes/apikeys/
git commit -m "feat(apikeys): implement scoped API key management

- hashApiKey(): SHA-256 of raw key, only hash stored in DB
- 14 valid scopes: messages:read/write, channels:read/write,
  tasks:read/write, docs:read/write, search:read, ai:query, workspace:read
- POST /v1/apikeys: generates csk_live_ + 32 random bytes, stores hash + prefix,
  admin-only, audit log, returns raw key ONCE
- GET /v1/apikeys: list non-revoked keys (prefix + scopes, never hash)
- DELETE /v1/apikeys/:id: set revokedAt, audit log
- apiKeyAuthMiddleware: intercepts Bearer csk_live_* tokens, verifies hash,
  checks expiry + revocation, updates lastUsedAt async (fire-and-forget)"

# Commit 2
git add apps/api/src/routes/webhooks/
git commit -m "feat(webhooks): implement HMAC-signed webhook delivery

- POST /v1/webhooks: create endpoint with encrypted secret (AES-256-GCM),
  returns raw secret ONCE, 14 subscribable event types + wildcard *
- signPayload(): HMAC-SHA256(secret, timestamp.body) prevents replay attacks
- GET/DELETE /v1/webhooks: list and remove endpoints (admin-only)
- GET /v1/webhooks/:id/deliveries: paginated delivery history
- POST /v1/webhooks/:id/replay/:deliveryId: re-queue delivery via BullMQ
- Auto-disable after 10 consecutive failures, failureCount resets on success
- DeliveryRecord stored per attempt: statusCode, response(1000 char cap),
  duration_ms, attemptCount"

# Commit 3
git add apps/api/src/routes/notifications/ apps/api/src/routes/bookmarks/
git commit -m "feat(notifications,bookmarks): implement notification center and bookmarks

- GET /v1/notifications: paginated list with unreadCount, optional unreadOnly
- PATCH /v1/notifications/:id/read: mark single notification read
- POST /v1/notifications/read-all: bulk mark read, optional workspaceId scope
- GET/PUT /v1/notifications/preferences: per-user prefs (mentions, threadReplies,
  taskAssigned, taskUpdates, weeklyDigest, emailNotifications, pushEnabled)
  upsert with defaults matching sensible opt-in defaults
- GET /v1/bookmarks: list user bookmarks ordered by createdAt
- POST /v1/bookmarks: save entity (message/task/doc/canvas_node) with note,
  unique constraint prevents duplicates (returns 409 on duplicate)
- DELETE /v1/bookmarks/:entityType/:entityId: remove bookmark"

git checkout main
git merge feat/api-keys-webhooks --no-ff -m "feat: API keys, webhooks, notifications, bookmarks (#12)"
```

---

## Milestone 12 — Video Calling

### Branch: `feat/video-livekit`
```bash
git checkout -b feat/video-livekit

# Commit 1
git add docker/video.yml docker/livekit/ docker/coturn/
git commit -m "infra: add LiveKit + coturn self-hosted video stack

- docker/video.yml: LiveKit v1.7 SFU + coturn 4.6.2 TURN server
- LiveKit ports: 7880(HTTP/WS API), 7881(RTC TCP), 7882/udp(RTC UDP)
- coturn in host network mode (required for correct external IP detection)
- TURN auth: shared-secret mode compatible with LiveKit TURN config
- coturn security: no-multicast-peers, no-cli, no-software-attribute,
  deny-loopback-peers, UDP relay ports 49152-65535
- LiveKit config: max 50 participants, 300s empty timeout, 20s departure timeout
- No-cost: LiveKit is open source (Apache 2.0), coturn is open source (MIT)"

# Commit 2
git add apps/api/src/routes/video/
git commit -m "feat(video): implement LiveKit room token generation

- generateLiveKitToken(): pure HMAC-SHA256 JWT (no SDK needed)
  claims: iss(apiKey), sub(userId), video.room, roomJoin/canPublish/canSubscribe
  6-hour token expiry, random jti per token
- POST /v1/video/token: verify channel membership, Pro+ plan gate,
  deterministic roomName=channel:channelId (all users join same room),
  participant metadata: name + avatarUrl for participant list UI
  Redis hset tracks active participants with 6h TTL
  Broadcasts call.participant_joined to channel WS subscribers
- GET /v1/video/:channelId/participants: reads Redis hash of active participants
- POST /v1/video/:channelId/leave: hdel participant, hlen to detect empty room,
  broadcasts call.ended or call.participant_left accordingly"

# Commit 3
git add apps/web/src/components/video/
git commit -m "feat(video): implement video call panel UI

- CallPanel component: idle → joining → connected → error state machine
- Dynamic import of livekit-client SDK (client-side only, tree-shaken)
- Mic/video toggle via localParticipant.setMicrophoneEnabled/setCameraEnabled
- Server-side participant list polled every 5s while in call
- Auto-disconnect on component unmount (useEffect cleanup)
- Error state shows LiveKit configuration help message
- Leave button: disconnects SDK, calls /leave API, closes panel"

git checkout main
git merge feat/video-livekit --no-ff -m "feat: self-hosted video calling with LiveKit (#13)"
```

---

## Milestone 13 — Frontend Foundation

### Branch: `feat/nextjs-setup`
```bash
git checkout -b feat/nextjs-setup

# Commit 1
git add apps/web/src/app/layout.tsx apps/web/src/styles/globals.css
git commit -m "feat(web): bootstrap Next.js 15 App Router application

- Root layout: ThemeProvider (next-themes), QueryClientProvider (TanStack Query),
  ReactQueryDevtools in development
- globals.css: CSS custom properties design system
  --color-accent: #e8400a (terracotta), --color-background: #0d0d0d (near-black)
  sidebar tokens, error/success/info/warning semantic colors
  Tailwind @layer base for body: font-mono, antialiased, color scheme
- GeistSans (display) + GeistMono (body) from geist package
- Dark/light/system theme toggle via next-themes data-theme attribute"

# Commit 2
git add apps/web/src/components/ui/
git commit -m "feat(web): implement base UI component library

- Button: variants(default/outline/ghost/accent/destructive),
  sizes(sm/md/lg/icon-sm), asChild pattern, disabled states
- Input: error state with red border + message, disabled opacity
- Avatar: initials fallback with deterministic color from userId hash,
  showPresence prop overlays status dot, size variants xs/sm/md/lg
- Badge: variants error/warning/info/success/default matching design tokens
- Skeleton: shimmer animation for loading states
- Tooltip: radix-ui based, monospace font, delayed show
- DropdownMenu: radix-ui DropdownMenuPrimitive wrappers with design tokens
- Toaster: simple toast notification system with success/error/info/warning"

# Commit 3
git add apps/web/src/stores/ apps/web/src/lib/
git commit -m "feat(web): implement state management and API client

- authStore (Zustand + persist): user, refreshToken, isAuthenticated, isLoading
  Actions: login, register, logout, refresh, setUser
  Partialize: only persists refreshToken + user (accessToken stays in memory)
  refresh() called on app mount to restore session from persisted token
- workspaceStore: currentWorkspace, channels list, sidebarOpen toggle
- presenceStore: Map<userId, PresenceData>, updatePresence action
- api-client.ts: authedFetch() sets Authorization header from in-memory token,
  getAccessToken() export for WebSocket auth (Bug fixed: was missing)
  All API namespaces: authApi, workspacesApi, channelsApi, messagesApi,
  tasksApi, aiApi, searchApi, adminApi, uploadApi"

git checkout main
git merge feat/nextjs-setup --no-ff -m "feat: Next.js 15 frontend foundation (#14)"
```

---

## Milestone 14 — Core Frontend Features

### Branch: `feat/channels-messaging-ui`
```bash
git checkout -b feat/channels-messaging-ui

# Commit 1
git add apps/web/src/components/channels/ apps/web/src/hooks/
git commit -m "feat(web): implement channels and messaging UI

- ChannelView: WebSocket integration via useWebSocket hook,
  optimistic message updates via queryClient.setQueryData,
  IntersectionObserver auto-fetch on scroll to top sentinel,
  thread panel toggle
- MessageList: date grouping (Today/Yesterday/date), consecutive message
  collapsing (5min window), reaction counts, hover actions overlay
- MessageComposer: auto-resize textarea, Shift+Enter newline,
  AttachmentPicker with multipart upload + previews + progress states
- MessageEditor: inline edit with save/cancel/Esc, updates query cache
  (Bug fixed: missing component, Edit button was a no-op)
- MessageActions: quick reactions (5 emoji), Reply→thread, Create task,
  Edit (author only), Delete (author only) — all via onReply/onEdit props
- ThreadPanel: reply composer, infinite scroll replies, closes on X"

# Commit 2
git add apps/web/src/hooks/use-websocket.ts
git commit -m "fix(web): fix useWebSocket reconnect storm and auth

- onEvent moved to useRef: callback changes no longer cause reconnect
  (Bug fixed: onEvent in useCallback deps triggered disconnect/reconnect
  on every queryClient.setQueryData call during active message flow)
- getAccessToken() from api-client now passed as sec-websocket-protocol
  (Bug fixed: WebSocket was authenticating with empty string, all
  connections were being rejected by the server as Unauthorized)
- mountedRef guards all async callbacks to prevent setState after unmount
- connect() in useCallback only depends on workspaceId, refresh, updatePresence"

# Commit 3
git add apps/web/src/components/tasks/ apps/web/src/components/docs/
git commit -m "feat(web): implement tasks and docs UI

- TasksView: Kanban + List + Calendar(stub) view modes, status filter chips
- TaskKanban: 4 columns (todo/in_progress/in_review/done), draggable cards
  click → TaskDetailDrawer (was stub, now fully wired)
- TaskList: sortable table, click row → TaskDetailDrawer
- TaskDetailDrawer: status/priority chips (inline update), assignee, due date,
  comment thread with add-comment textarea, Work Graph linked items panel
- CreateTaskModal: title + priority picker + Radix Dialog
- DocView: contentEditable title (onBlur save), block editor with 10 block types
  (paragraph/heading1-3/quote/code/callout/bulleted_list/numbered_list/todo/divider)
  todo blocks have real checkbox toggle, add-block button at bottom
- DocsListView: table with icon, title, last-edited, click to open"

git checkout main
git merge feat/channels-messaging-ui --no-ff -m "feat: channels, messaging, tasks, and docs UI (#15)"
```

---

### Branch: `feat/canvas-ai-search-ui`
```bash
git checkout -b feat/canvas-ai-search-ui

# Commit 1
git add apps/web/src/components/canvas/
git commit -m "feat(web): implement SVG infinite canvas

- CanvasView: SVG surface with CSS grid-dot background
- Pan: tool='pan' or middle-click drag, translate transform on SVG group
- Zoom: wheel event, 0.2x–3x range, zoom in/out buttons, reset
- Node drag: mousedown on node → mousemove delta → mouseup commits to API
- Sticky notes: colored rectangles, double-click for inline textarea edit
  (foreignObject with autoFocus textarea), single-click selects (accent border)
- Shapes: rectangles with label text
- Tool bar: Select(V)/Sticky(S)/Shape(R)/Pan(Space) with aria-pressed
- Canvas click creates node at SVG-coordinate-space position (accounts for pan/zoom)
- CanvasListView: grid of canvas cards with node count + last-edited"

# Commit 2
git add apps/web/src/components/ai/ apps/web/src/components/search/
git commit -m "feat(web): implement AI Intelligence view and search

- AIView: conversational interface, 5 suggestion prompts on empty state
- ChatBubble: user message (right-aligned accent) vs AI message (card + icon)
- Loading state: Loader2 spinner + 'Searching workspace...' text
- contextUsed footer: shows messages/tasks/docs count searched
- SearchModal: Ctrl+F shortcut, debounced 300ms query, keyboard navigation
  (↑↓ arrows, Enter to open, Esc to close), type badges, excerpt display
- CommandPalette: Ctrl+K shortcut, grouped commands (Navigate/Channels/Create/Account)
  keyboard navigation, 'Enter to run' hint on selected item
- Commands: navigate to all 5 modules, jump to any of first 7 channels,
  create doc/task/canvas, view profile, sign out"

# Commit 3
git add apps/web/src/components/settings/ apps/web/src/components/notifications/
git commit -m "feat(web): implement settings and notification center

- SettingsView: 5-section sidebar layout (Profile/Appearance/Notifications/
  Workspace/Security), each section renders independently
- ProfileSection: name edit, email (read-only), plan badge, save via PATCH /me
- AppearanceSection: dark/light/system theme cards with next-themes setTheme
- NotificationsSection: 4 toggles with switch UI, save via PUT /preferences
- WorkspaceSection: workspace name edit, plan badge, admin-only save button
- SecuritySection: reset password link, sign-out-everywhere button (revokes all sessions)
- NotificationBell: unread count badge, dropdown list, mark-read per item,
  mark-all-read button, 30s polling fallback to WebSocket events
  icons per NotificationType, unread highlight (bg-accent/5)"

git checkout main
git merge feat/canvas-ai-search-ui --no-ff -m "feat: canvas, AI, search, settings, notifications (#16)"
```

---

## Milestone 15 — Layout & Navigation

### Branch: `feat/layout-navigation`
```bash
git checkout -b feat/layout-navigation

# Commit 1
git add apps/web/src/components/layout/
git commit -m "feat(web): implement workspace layout and navigation

- WorkspaceLayout: checks isAuthenticated, calls refresh() on mount,
  global Ctrl+K (command palette) and Ctrl+F (search) handlers,
  renders WorkspaceRail + ModuleSidebar + main content
- WorkspaceRail: workspace switcher with active indicator, + new workspace,
  sidebar collapse toggle (sets sidebarOpen in workspaceStore),
  NotificationBell integrated, Settings link, user avatar with logout tooltip
- ModuleSidebar: search shortcut button, 5 module tabs (Channels/Docs/Canvas/
  Tasks/AI), context sub-nav (channels list with hash/lock icons, 7 visible + overflow),
  Cmd+K hint button
- MobileNav: fixed bottom bar, 5 module tabs, hidden on md+ breakpoints,
  pb-16 on main content to avoid overlap"

# Commit 2
git add apps/web/src/app/
git commit -m "feat(web): add all page routes

- / → redirects to first workspace
- /[workspaceSlug] → redirects to /channels
- /[workspaceSlug]/channels → redirects to first channel
- /[workspaceSlug]/channels/[channelId] → ChannelView
- /[workspaceSlug]/docs → DocsListView
- /[workspaceSlug]/docs/[docId] → DocView
- /[workspaceSlug]/canvas → CanvasListView
- /[workspaceSlug]/canvas/[canvasId] → CanvasView
- /[workspaceSlug]/tasks → TasksView
- /[workspaceSlug]/ai → AIView
- /[workspaceSlug]/settings → SettingsView
- /auth/login, /auth/register, /auth/forgot-password, /auth/reset-password
- /invite?token= → InviteAcceptView
- /new-workspace → NewWorkspaceForm
- /not-found and /error global pages"

# Commit 3
git add apps/web/src/components/auth/ apps/web/src/components/workspace/
git commit -m "feat(web): implement auth and workspace forms

- LoginForm: email/password validation, 401→wrong credentials message,
  429→rate limit message, never exposes whether email exists
- RegisterForm: name/email/password with confirm, 409→email taken
- ForgotPasswordForm: always shows success message (prevents enumeration),
  CheckCircle success state
- ResetPasswordForm: token from searchParams, confirm match validation,
  auto-redirect to login 3s after success
- NewWorkspaceForm: name→slug auto-generation (slugify), slug manual override,
  URL prefix preview, 409→slug taken error
- InviteAcceptView: loading/ready/accepting/done/error states,
  unauthenticated users redirected to login with redirect param,
  auto-navigates to workspace on success"

git checkout main
git merge feat/layout-navigation --no-ff -m "feat: complete layout, navigation, and auth forms (#17)"
```

---

## Milestone 16 — Observability Infrastructure

### Branch: `infra/observability-stack`
```bash
git checkout -b infra/observability-stack

# Commit 1
git add docker/observability.yml docker/prometheus/ docker/loki/
git commit -m "infra: add self-hosted observability Docker Compose

- Prometheus v2.53.0: 30-day retention, scrapes /metrics every 15s
- Alerting rules: APIDown(1m), HighErrorRate(>5%/2m), SlowResponses(P95>2s/5m),
  JobQueueBacklog(>1000/5m), HighJobFailureRate(>100/5m),
  HighMemoryUsage(>90%/5m), DiskSpaceLow(<10%/5m),
  PostgreSQLDown(1m), RedisDown(1m)
- Loki v3.1.0: 30-day retention, tsdb schema, ingestion 16MB/s
- Promtail: Docker log scraping via docker_sd_configs, JSON parsing
  for Pino logs, drops debug-level logs in production to save storage
- All services: health checks, restart policies, named volumes"

# Commit 2
git add docker/grafana/
git commit -m "infra: add Grafana auto-provisioned dashboards

- Grafana 11.1.0: auto-provisioned datasources (Prometheus + Loki)
- CollabOS Overview dashboard (JSON provisioned):
  Request rate (req/s stat), Error rate (% stat), P95 latency (ms stat),
  Active WS connections (stat), Heap used (bytes stat), Uptime (s stat)
  HTTP requests by status code timeseries (2xx/4xx/5xx)
  Job queue depths timeseries (all 7 queues)
  Failed jobs timeseries (email/notifications/webhooks/transcode)
  Application logs panel (Loki datasource)
- Dashboards.yml provider: auto-loads from /etc/grafana/dashboards"

# Commit 3
git add docker/observability.yml
git commit -m "infra: add GlitchTip and Mailpit to observability stack

- GlitchTip v4.0: open source Sentry alternative, separate Postgres + Redis,
  ENABLE_OPEN_USER_REGISTRATION=False (admin creates accounts only),
  Celery worker + beat for async processing
- Mailpit v1.18: local SMTP (port 1025) + web UI (port 8025),
  MAX_MESSAGES=500, accepts any auth (dev-only)
- All services documented with setup instructions in comments
- GLITCHTIP_SECRET_KEY and GLITCHTIP_DB_PASSWORD as env vars"

git checkout main
git merge infra/observability-stack --no-ff -m "infra: Prometheus + Grafana + Loki + GlitchTip (#18)"
```

---

### Branch: `infra/video-embeddings`
```bash
git checkout -b infra/video-embeddings

# Commit 1
git add docker/video.yml docker/livekit/ docker/coturn/
git commit -m "infra: add LiveKit + coturn video infrastructure

- docker/video.yml: LiveKit v1.7 + coturn 4.6.2
- livekit.yml: RTC ports, TURN config, room defaults (50 participants,
  300s empty timeout, 20s departure timeout)
- turnserver.conf: shared-secret auth, realm, security hardening flags,
  UDP relay port range 49152-65535
- Host networking for coturn (correct external IP detection)
- Instructions for production: set external-ip in turnserver.conf"

# Commit 2
git add docker/ollama/ scripts/setup-ollama.sh
git commit -m "infra: add Ollama self-hosted embeddings

- docker/ollama/docker-compose.yml: Ollama 0.3.6, named volume for model storage,
  OLLAMA_KEEP_ALIVE=5m (keep model hot between requests),
  OLLAMA_MAX_LOADED_MODELS=2, memory limit 4GB
- scripts/setup-ollama.sh: waits for Ollama health, pulls nomic-embed-text
  (768-dim, ~274MB, runs on CPU), tests embedding with dimension count
- nomic-embed-text: MIT license, trained on 235M text pairs,
  MTEB English benchmark score 62.4 (comparable to OpenAI ada-002)
- ENABLE_EMBEDDINGS=false by default (opt-in)"

# Commit 3
git add docker/docker-compose.yml docker/postgres/postgresql.conf
git commit -m "infra: upgrade dev Docker Compose with full stack

- Separate redis_queue service on port 6380 (REDIS_QUEUE_URL)
  prevents LRU eviction killing job queue data
- MinIO: S3-compatible local storage, auto-creates collabos and
  collabos-backups buckets on startup via mc client
- PostgreSQL tuned for dev: shared_buffers 256MB, pg_stat_statements,
  vector extension preloaded, slow query log >1s
- docker-compose.yml composed with comments: add observability.yml,
  video.yml, ollama/docker-compose.yml separately as needed"

git checkout main
git merge infra/video-embeddings --no-ff -m "infra: video calling + Ollama embeddings infrastructure (#19)"
```

---

## Milestone 17 — Production Infrastructure

### Branch: `infra/nginx-ssl-backup`
```bash
git checkout -b infra/nginx-ssl-backup

# Commit 1
git add docker/nginx/ docker/docker-compose.prod.yml
git commit -m "infra: add nginx SSL termination and production compose

- nginx.conf: TLS 1.2/1.3 only, ECDHE cipher suite preference off (ECDHE wins anyway),
  ssl_session_cache shared:SSL:10m, HSTS maxAge 63072000 includeSubDomains preload,
  OCSP stapling enabled
  Rate limit zones: api(30r/s), auth(2r/s burst 5)
  /v1/ws/* upgraded to WebSocket (Upgrade/Connection headers)
  API proxy with Connection: '' (keepalive to upstream)
  /health bypasses access log
- docker-compose.prod.yml: 2 API replicas, 2 web replicas,
  worker service, nginx with Let's Encrypt volume mounts,
  DB backup cron container (pg_dump + S3 + 7-day retention)"

# Commit 2
git add scripts/backup-db.sh scripts/generate-jwt-keys.mjs scripts/health-check.mjs
git commit -m "infra: add operational scripts

- backup-db.sh: pg_dump custom format + gzip, optional S3 upload
  via aws s3 cp with --endpoint-url for R2 compatibility,
  local backup retention cleanup, timestamped filenames
- generate-jwt-keys.mjs: RSA 2048-bit keypair with base64url newline escaping
  ready to paste into .env
- health-check.mjs: checks /health and /docs with AbortSignal.timeout(3000),
  exits 0 on all healthy, exits 1 on any failure"

# Commit 3
git add .github/workflows/
git commit -m "infra: add CI/CD GitHub Actions workflows

- ci.yml: typecheck → lint → test (with real Postgres+Redis services) →
  build → Docker push on main. concurrency: cancel-in-progress on PRs
- deploy.yml: build+push images with SHA tag and branch tag,
  SSH deploy to staging (auto on main push), SSH deploy to production
  (requires manual approval via GitHub environment protection),
  migration runs before traffic cutover, health check after deploy,
  auto-creates GitHub issue on production deploy failure
- security.yml: weekly npm audit (high severity), CodeQL TypeScript analysis,
  TruffleHog secret scanning on push"

git checkout main
git merge infra/nginx-ssl-backup --no-ff -m "infra: nginx SSL, production compose, CI/CD (#20)"
```

---

## Milestone 18 — Bug Fixes

### Branch: `fix/critical-security-bugs`
```bash
git checkout -b fix/critical-security-bugs

# Commit 1
git add apps/api/src/utils/idempotency.ts
git commit -m "fix(api): correct idempotency key user ID field

- Was: req.user.id (undefined — JWT payload uses sub not id)
- Now: req.user.sub (correct JWT claim per JWTPayload interface)
- Impact: all idempotency keys were scoped to 'anon' for every user,
  meaning different users with the same Idempotency-Key header would
  share cached responses — a security and correctness bug
- All POST/PATCH mutation endpoints affected: messages, tasks, workspaces"

# Commit 2
git add apps/api/src/routes/auth/index.ts
git commit -m "fix(auth): add missing ValidationError import

- Was: ValidationError used in PATCH /v1/auth/me but not imported
- Now: ValidationError added to error imports in auth routes
- Impact: PATCH /me with empty body would throw ReferenceError crashing
  the request handler instead of returning a clean 422"

# Commit 3
git add apps/api/src/routes/sso/index.ts apps/api/src/routes/auth/index.ts
git commit -m "fix(sso): replace URL fragment tokens with exchange token

- Was: redirect to /#sso=<accessToken>&rt=<refreshToken> (URL fragment)
  Fragment tokens readable by any JS on page (analytics, tracking scripts)
  Also appear in browser history and may be sent in Referer header
- Now: generate nanoid(32) exchange token stored in Redis 60s,
  redirect to /channels?sso_exchange=<token>,
  frontend calls POST /v1/auth/sso/exchange to get real tokens
  Exchange token is single-use (deleted on first read)
- Also added POST /v1/auth/sso/exchange endpoint"

git checkout main
git merge fix/critical-security-bugs --no-ff -m "fix: critical security bug fixes (#21)"
```

---

### Branch: `fix/redis-performance-bugs`
```bash
git checkout -b fix/redis-performance-bugs

# Commit 1
git add apps/api/src/plugins/cache.ts
git commit -m "fix(cache): replace redis.KEYS() with SCAN in delPattern

- Was: redis.keys('pattern:*') — O(N) on full keyspace, blocks Redis
  event loop. With 10k+ keys this causes seconds-long Redis freeze
  affecting ALL commands from ALL connections simultaneously
- Now: SCAN loop with COUNT 100 — O(1) per call, non-blocking,
  iterates keyspace in batches without blocking other commands
- delPattern() now uses do/while cursor loop until cursor returns '0'
- Affects: invalidateWorkspace(), invalidateUser(), any cache.delPattern() call
- Also: existing guard 'if (keys.length > 0)' preserved in SCAN batches"

# Commit 2
git add apps/api/src/routes/auth/index.ts
git commit -m "fix(auth): replace redis.KEYS() scan in password reset

- Was: redis.keys('refresh:userId:*') then del(...keys)
  Dangerous: scans full Redis keyspace, blocks on large deployments
  Also: del() with spread of 0 keys would pass no args (ioredis inconsistency)
- Now: incr refresh_version:userId — atomic O(1) counter
  Auth middleware will need to check this version on token verification
  (Phase 2: add version check to authMiddleware)
  Expire: 30 days matching refresh token TTL
- Impact: password reset no longer blocks Redis, scales to millions of users"

# Commit 3
git add apps/api/src/routes/ws/index.ts
git commit -m "fix(ws): safe async WebSocket close handler and heartbeat

- Was: socket.on('close', async () => { await ... }) — async handler
  on EventEmitter. If Redis/DB ops throw, it becomes an unhandled rejection
  that crashes the Node.js process in production
- Now: socket.on('close', () => { Promise.allSettled([...]).catch(() => {}) })
  Promise.allSettled never throws, .catch() silences any allSettled rejection
- Also added server-side heartbeat: setInterval ping every 30s
  Detects dead TCP connections not caught by close event
  (mobile network drops, corporate proxies closing idle connections)
  Interval cleared in close handler to prevent memory leak"

git checkout main
git merge fix/redis-performance-bugs --no-ff -m "fix: Redis KEYS() performance and WS stability (#22)"
```

---

### Branch: `fix/queue-migration-bugs`
```bash
git checkout -b fix/queue-migration-bugs

# Commit 1
git add apps/api/src/routes/messages/index.ts \
        apps/api/src/routes/tasks/index.ts \
        apps/api/src/routes/docs/index.ts \
        apps/api/src/routes/workspaces/index.ts
git commit -m "fix(jobs): migrate all route lpush calls to BullMQ

- Was: 9 places in routes used redis.lpush('jobs:queue', JSON.stringify(...))
  to enqueue work. BullMQ workers never read from raw Redis lists.
  All notifications, search index updates, and invite emails were being
  queued into a void — silently dropped
- Now: all routes import and call typed BullMQ helpers:
  enqueueEmail(), enqueueSearchIndex(), enqueueNotification()
- Files fixed: messages/index.ts (search-index + notifications),
  tasks/index.ts (search-index + automations), docs/index.ts (search-index),
  workspaces/index.ts (invite email), auth/index.ts (password reset email)"

# Commit 2
git add apps/api/src/jobs/handlers/notifications.ts \
        apps/api/src/services/automations.ts
git commit -m "fix(jobs): migrate handler and service lpush to BullMQ

- notifications.ts was: creating a new ioredis connection per job,
  lpush to jobs:email (dead queue), no in-app notification records created
- notifications.ts now: uses enqueueEmail() (shared connection pool),
  creates Notification DB records before queueing email,
  checks UserNotificationPrefs before sending (respects opt-out),
  Promise.allSettled for email fan-out (one failure doesn't stop others)
- automations.ts was: creating new ioredis connections for both notify_channel
  and send_email actions
- automations.ts now: uses BullMQ enqueueEmail(), reuses queue connection
  for Redis publish in notify_channel action"

# Commit 3
git add apps/api/src/routes/webhooks/index.ts
git commit -m "fix(webhooks): fix user-agent header typo in audit log

- Was: req.headers['user-data'] — field does not exist in HTTP spec,
  always returns undefined. Every webhook audit log had userAgent: undefined
- Now: req.headers['user-agent'] — correct standard HTTP header
- Impact: webhook creation audit logs now capture correct browser/client info"

git checkout main
git merge fix/queue-migration-bugs --no-ff -m "fix: BullMQ queue migration complete, webhook typo (#23)"
```

---

### Branch: `fix/websocket-client-bugs`
```bash
git checkout -b fix/websocket-client-bugs

# Commit 1
git add apps/web/src/hooks/use-websocket.ts apps/web/src/lib/api-client.ts
git commit -m "fix(web): send access token in WebSocket connection

- Was: useWebSocket called refresh() to get a fresh access token, then
  created new WebSocket(url) with NO auth. Browser WebSocket does not
  support custom headers. The sec-websocket-protocol header was never set.
  Every WS connection authenticated with empty string → Unauthorized
- Now: added getAccessToken() export to api-client.ts (reads in-memory token),
  passed as second arg to WebSocket() constructor:
  new WebSocket(url, token) sets sec-websocket-protocol: <JWT>
  Server auth middleware reads this header for verification
- All authenticated connections now actually authenticated"

# Commit 2
git add apps/web/src/hooks/use-websocket.ts
git commit -m "fix(web): prevent reconnect storm from onEvent callback

- Was: connect useCallback depended on [workspaceId, refresh, onEvent, updatePresence]
  onEvent is a new function reference on every parent render (inline arrow fn)
  Every time ChannelView re-rendered (queryClient.setQueryData on new message),
  useEffect [connect] fired → disconnect + reconnect
  At active chat pace: 10+ reconnects per second
- Now: onEventRef = useRef(onEvent), updated via useEffect on each render
  connect only depends on [workspaceId, refresh, updatePresence]
  Callback changes never trigger reconnect; always uses latest onEvent ref"

# Commit 3
git add apps/web/src/components/channels/message-list.tsx \
        apps/web/src/components/channels/message-actions.tsx \
        apps/web/src/components/channels/message-editor.tsx
git commit -m "fix(web): wire message edit UI end to end

- Was: MessageActions Edit menu item existed but called toast.info as stub
  MessageEditor component existed but was never rendered anywhere
- Now: MessageActions accepts onEdit prop, Edit item calls onEdit()
  MessageItem has editing state boolean, renders MessageEditor when true
  MessageEditor: autoFocus textarea, saves on Enter, cancels on Esc,
  updates React Query cache on success (no full refetch needed)
- Also: onReply prop properly wired: MessageList → MessageItem → MessageActions
  → ThreadPanel opens with the parent message"

git checkout main
git merge fix/websocket-client-bugs --no-ff -m "fix: WebSocket auth, reconnect storm, message edit UI (#24)"
```

---

## Milestone 19 — Testing

### Branch: `test/unit-and-integration`
```bash
git checkout -b test/unit-and-integration

# Commit 1
git add apps/api/src/utils/__tests__/ apps/api/src/services/__tests__/
git commit -m "test(api): add unit tests for utilities and services

- cursor.test.ts: encodeCursor/decodeCursor round-trip, invalid cursor throws,
  buildPaginatedResult hasNextPage/nextCursor/data trimming
- errors.test.ts: all error classes correct statusCode/code/message/details
- idempotency.test.ts: checkIdempotency returns null for missing key,
  saveIdempotencyResult stores with 24h TTL, setex called with correct args
- cache.test.ts: get/set/del round-trip, getOrSet calls fetcher once then caches,
  delPattern removes matching keys but not others,
  invalidateWorkspace/invalidateUser clear correct patterns
- presence.test.ts: setPresence stores in hash + sets 300s TTL,
  getPresence returns null for unknown user, markOffline sets status field"

# Commit 2
git add apps/api/src/__tests__/integration.test.ts
git commit -m "test(api): add integration test suite

- Skips automatically when DATABASE_URL/REDIS_URL/JWT keys not set
- Auth suite: register creates user (201), duplicate email→409,
  login with correct password→200, wrong password→401,
  GET /me with token→200, without token→401,
  refresh rotates tokens, old refresh token rejected→401
- Workspace suite: create returns slug (201), duplicate slug→409, list returns array
- Channel suite: list includes auto-created #general, create returns id (201)
- Message suite: send→201, idempotent (same id returned for same key),
  paginate returns data+meta, edit→200 with new content, soft-delete→204
- Task suite: create→201 with status=todo, update status→200 with new status
- Search suite: returns results array + total integer
- Rate limit suite: verifies 200 or 429 responses
- Error suite: unknown route→404, invalid JSON→400/415"

# Commit 3
git add packages/shared/src/__tests__/ packages/shared/vitest.config.ts
git commit -m "test(shared): add shared utility unit tests

- utils.test.ts: 20+ test cases
- slugify: lowercase, spaces→hyphens, special chars removed, collapse hyphens,
  trim leading/trailing hyphens, empty string, numbers preserved
- truncate: within limit unchanged, over limit gets ellipsis, exact length unchanged
- formatBytes: 0B, 500B, 1KB, 1MB, 1GB, decimal places respected
- isValidUrl: valid https, valid http+port, invalid string, empty, path+query
- retryWithBackoff: success on first try (1 call), retry then succeed (3 calls),
  throws after maxAttempts with last error
- debounce: coalesces rapid calls, fires once after delay (fake timers)"

git checkout main
git merge test/unit-and-integration --no-ff -m "test: unit + integration test suite (#25)"
```

---

## Final Tags

```bash
# Tag stable releases
git tag -a v0.1.0 -m "Initial monorepo structure and shared package"
git tag -a v0.2.0 -m "Database schema and migrations complete"
git tag -a v0.3.0 -m "API foundation: auth, workspaces, channels, messages"
git tag -a v0.4.0 -m "Real-time: WebSocket, presence, pub/sub"
git tag -a v0.5.0 -m "Core features: tasks, docs, canvas, AI, search"
git tag -a v0.6.0 -m "Job system: BullMQ 8-queue worker registry"
git tag -a v0.7.0 -m "Enterprise: SSO, SCIM, API keys, webhooks"
git tag -a v0.8.0 -m "Frontend complete: all pages and components"
git tag -a v0.9.0 -m "Infrastructure: observability, video, embeddings, CI/CD"
git tag -a v1.0.0 -m "Production ready: all bugs fixed, tests passing"

git push origin --all
git push origin --tags
```

---

## Branch Summary

| Branch | Milestone | Commits | Key deliverable |
|---|---|---|---|
| `feat/monorepo-setup` | 1 | 4 | npm workspaces, TypeScript, shared package |
| `feat/db-schema-migrations` | 2 | 3 | Prisma schema, migrations, seeds |
| `feat/api-fastify-setup` | 3 | 3 | Fastify, plugins, middleware, utils |
| `feat/auth-jwt-argon2` | 4 | 3 | Register, login, refresh, password reset, SSO exchange |
| `feat/workspaces-channels` | 5 | 3 | Workspace + channel + message CRUD |
| `feat/websocket-presence` | 6 | 3 | WS hub, presence service, heartbeat |
| `feat/tasks-documents` | 7 | 3 | Tasks, docs, canvas |
| `feat/ai-search` | 8 | 3 | AI Q&A, full-text + semantic search |
| `feat/upload-threads` | 9 | 3 | File upload, threads, admin |
| `feat/bullmq-job-system` | 10 | 3 | 8-queue BullMQ with all handlers |
| `feat/sso-saml` | 11 | 3 | SAML SSO, SCIM 2.0, encryption |
| `feat/api-keys-webhooks` | 12 | 3 | API keys, webhooks, notifications, bookmarks |
| `feat/video-livekit` | 13 | 3 | LiveKit video calling, coturn TURN |
| `feat/nextjs-setup` | 14 | 3 | Next.js, UI components, state, API client |
| `feat/channels-messaging-ui` | 15 | 3 | Channels, messages, tasks, docs UI |
| `feat/canvas-ai-search-ui` | 16 | 3 | Canvas, AI, search, settings, notifications UI |
| `feat/layout-navigation` | 17 | 3 | Layout, routing, auth forms |
| `infra/observability-stack` | 18 | 3 | Prometheus, Grafana, Loki, GlitchTip |
| `infra/video-embeddings` | 19 | 3 | LiveKit, coturn, Ollama Docker configs |
| `infra/nginx-ssl-backup` | 20 | 3 | nginx SSL, production compose, CI/CD |
| `fix/critical-security-bugs` | 21 | 3 | Idempotency sub field, ValidationError, SSO fragments |
| `fix/redis-performance-bugs` | 22 | 3 | redis.KEYS() → SCAN, WS close handler |
| `fix/queue-migration-bugs` | 23 | 3 | lpush → BullMQ everywhere, webhook typo |
| `fix/websocket-client-bugs` | 24 | 3 | WS auth token, reconnect storm, message edit |
| `test/unit-and-integration` | 25 | 3 | 50+ unit tests, full integration suite |
