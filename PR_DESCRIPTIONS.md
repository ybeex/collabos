# Pull Request Descriptions

**Repository:** `ybeex/collabos`  
**Merge target for all PRs:** `dev`  
**Branch policy:** `feature → dev → staging → main`

---

## PR 01 — `feat/project-setup` → `dev`

**Title:** `feat: monorepo project setup — shared package, DB schema, Docker, scripts`

### Summary
Establishes the complete foundation of the monorepo. Everything that runs the platform — the database schema, shared type library, containerised services, and operational scripts — lives here and nothing else depends on this not being in place first.

### What's included

#### `packages/shared`
- Shared TypeScript types, Zod validators, and utility functions consumed by both `apps/api` and `apps/web`.
- Package config with `vitest` for unit testing.

#### `packages/db`
- `@prisma/client` wrapper with typed database client export.
- Prisma schema covering every model: `User`, `Workspace`, `WorkspaceMember`, `Channel`, `ChannelMember`, `Message`, `MessageReaction`, `Thread`, `Task`, `TaskComment`, `Document`, `DocumentBlock`, `DocumentVersion`, `Canvas`, `CanvasNode`, `WorkGraphEdge`, `Notification`, `UserNotificationPrefs`, `Bookmark`, `ApiKey`, `WebhookEndpoint`, `WebhookDelivery`, `ScimToken`, `WorkspaceSsoConfig`, `MeetingTranscript`, `AuditLog`, `SuperAdminAuditLog`.
- 7 sequential migrations: initial schema → full-text search indexes → super-admin audit log → Yjs CRDT document state → call transcripts → GDPR compliance fields → onboarding role field.
- Seed scripts for development data.

#### `docker/`
- `Dockerfile.api`, `Dockerfile.web`, `Dockerfile.worker` — multi-stage production images.
- `docker-compose.yml` — local development stack (Postgres, Redis, MinIO, LiveKit, Ollama, Coturn).
- `docker-compose.prod.yml` — production overrides (resource limits, restart policies, secrets).
- `observability.yml` — Prometheus + Grafana + Loki stack.
- `video.yml` — LiveKit SFU service config.
- Service-specific configs for nginx (reverse proxy + TLS termination), postgres (tuning), coturn (TURN/STUN), livekit, and ollama (local LLM).

#### `scripts/`
- `backup-db.sh` — pg_dump with S3 upload and retention policy.
- `health-check.mjs` — checks API, DB, and Redis connectivity.
- `generate-jwt-keys.mjs` — generates RS256 key pair for JWT signing.
- `setup-ollama.sh` — pulls required Ollama models on first run.

### Commits
```
chore(shared): add @collabos/shared package config
chore(db): add @collabos/db package config
feat(db): add Prisma schema with all models and enums
feat(db): add database client export and seed scripts
feat(shared): add shared types and utilities
chore(docker): add Dockerfiles and base compose config
chore(docker): add production compose config
chore(docker): add service configs (nginx, postgres, coturn, livekit, ollama)
chore(scripts): add DB backup, health check, and setup scripts
chore(docker): add observability and video service configs
```

### Checklist
- [ ] `npm run build -w packages/shared` passes
- [ ] `npm run build -w packages/db` passes
- [ ] `docker compose up` starts all services without errors
- [ ] `prisma migrate deploy` runs cleanly against a fresh database

---

## PR 02 — `feat/api-core` → `dev`

**Title:** `feat: API core — Fastify app factory, plugins, middleware, and utilities`

### Summary
Builds the entire `apps/api` skeleton — the Fastify application, every plugin, all shared middleware, and every utility that every route will depend on. No business logic lives here; this is purely infrastructure that makes routes possible.

### What's included

#### App entry
- `src/app.ts` — Fastify app factory: registers all plugins, middleware, and routes under `/v1`.
- `src/index.ts` — Server entrypoint: listens on `$PORT`, handles `SIGTERM`.

#### Plugins
- `plugins/db.ts` — Decorates `app.db` with the Prisma client. Verifies connectivity at startup.
- `plugins/redis.ts` — Decorates `app.redis` with an ioredis client. Configures `maxRetriesPerRequest: 0` for BullMQ compatibility.
- `plugins/cache.ts` — `CacheService` with `getOrSet(key, ttl, fn)`, `del`, `delPattern` (via SCAN — not glob `DEL`), and pre-defined `cacheKeys` / `CACHE_TTL` constants used across all routes.

#### Middleware
- `middleware/auth.ts` — `app.authenticate` JWT preHandler decorator; `requireRole(role, source)` factory that reads `workspaceId` from body, query, or params.
- `middleware/error-handler.ts` — Maps typed `HttpError` subclasses to correct status codes; logs 5xx with request context.
- `middleware/request-logger.ts` — Per-request Pino log with method, url, status, duration, and `requestId`.

#### Utilities
- `utils/env.ts` — Zod schema validates all `process.env` values at startup; throws with a clear message on missing/invalid variables.
- `utils/errors.ts` — `NotFoundError`, `ConflictError`, `ForbiddenError`, `ValidationError`, `ServiceUnavailableError` — all extend `HttpError` with typed status codes.
- `utils/logger.ts` — Pino instance with `transport` set to `pino-pretty` in dev, JSON in production.
- `utils/cursor.ts` — `encodeCursor(obj)` / `decodeCursor(str)` (base64 JSON) and `buildPaginatedResult(items, limit, keyFn)` used by every paginated route.
- `utils/encryption.ts` — AES-256-GCM encrypt/decrypt for secrets at rest (SSO certificates, webhook secrets, API keys).
- `utils/idempotency.ts` — `withIdempotency(req, reply, redis, fn)` — checks/stores idempotency keys with 24h TTL.
- `utils/monitoring.ts` — `prom-client` registry wrappers; counter/histogram helpers used by the metrics route.

#### Types
- `src/types/` — Fastify type augmentations: `app.db`, `app.redis`, `req.user` (JWT payload), `req.apiKeyScopes`.

#### OpenAPI
- `src/openapi.ts` — Full JSON Schema definitions for every request body and query string across all routes, used by Fastify's built-in schema validation.

### Commits
```
chore(api): add package config, tsconfig, eslint, and vitest config
feat(api): add environment variable validation with Zod
feat(api): add typed HTTP error classes
feat(api): add structured Pino logger
feat(api): add cursor-based pagination helpers
feat(api): add AES-GCM encryption utility
feat(api): add idempotency key middleware
feat(api): add Prometheus metrics helpers
feat(api): add Prisma database plugin
feat(api): add Redis plugin
feat(api): add cache service with get-or-set and invalidation
feat(api): add JWT authentication middleware and role guard
feat(api): add global error handler middleware
feat(api): add request logging middleware
feat(api): add global TypeScript type augmentations
feat(api): add OpenAPI/Swagger schema definitions
test(api): add API integration test setup
test(api): add unit tests for utils
```

### Checklist
- [ ] `npm run build -w apps/api` passes with zero TypeScript errors
- [ ] All utility unit tests pass (`npm run test -w apps/api`)
- [ ] App starts and `/v1/health` returns 200

---

## PR 03 — `feat/auth` → `dev`

**Title:** `feat: authentication — JWT register/login/refresh and SAML 2.0 SSO`

### Summary
Implements the full authentication surface: password-based auth with JWT access + refresh tokens, profile management, and a complete SAML 2.0 SSO flow using `samlify` for cryptographic assertion verification.

### What's included

#### `routes/auth/index.ts`
- `POST /v1/auth/register` — Creates user, hashes password with bcrypt (cost 12), issues access token (15 min) + refresh token (30 days) stored in Redis.
- `POST /v1/auth/login` — Verifies bcrypt hash, checks `lockedUntil`, issues tokens. Rate-limited to 10/min.
- `POST /v1/auth/refresh` — Validates refresh token JTI against Redis, rotates to new pair, revokes old JTI.
- `POST /v1/auth/logout` — Revokes refresh token JTI in Redis.
- `PATCH /v1/auth/profile` — Updates `name`, `timezone`, `avatarUrl`, `onboardingRole`. Uses conditional spreads for `exactOptionalPropertyTypes` compatibility.
- `POST /v1/auth/sso/exchange` — One-time exchange of SSO cookie token for real JWT pair (60-second window, HttpOnly).

#### `routes/sso/index.ts`
- `GET /v1/sso/:workspaceSlug` — Initiates SP-initiated SAML flow. Uses `samlify` to build a correctly DEFLATE-compressed + base64-encoded `AuthnRequest`. Stores `InResponseTo` ID in Redis for replay protection.
- `POST /v1/sso/:workspaceSlug/callback` — ACS endpoint. Calls `sp.parseLoginResponse()` which validates XML-DSig signature against the workspace's registered IdP certificate via `xml-crypto`. Enforces `wantAssertionsSigned` and `wantMessageSigned`. Checks `InResponseTo` against Redis, deletes on first use (replay prevention). Provisions user on first login.
- `GET /v1/sso/:workspaceSlug/config` — Returns SSO config metadata (no certificate).
- `PUT /v1/sso/:workspaceSlug/config` — Stores IdP config; encrypts certificate at rest with AES-256-GCM.

**Security notes fixed in this branch:**
- Replaced hand-rolled regex XML parsing (no signature verification) with `samlify`.
- `isSuperAdmin` cannot be set via SSO attribute mapping by design.
- Refresh token expiry override now uses per-call `{ expiresIn }` option, not `{ sign: {...} }` plugin shape.

### Commits
```
feat(auth): add registration, login, token refresh, and profile update routes
feat(auth): add SAML 2.0 SSO routes with samlify signature verification
```

### Checklist
- [ ] Register → login → refresh → logout flow works end-to-end
- [ ] SSO initiation redirects to IdP with valid deflated AuthnRequest
- [ ] Replay attack is blocked (second POST with same SAMLResponse returns 400)
- [ ] Expired refresh token returns 401

---

## PR 04 — `feat/workspaces` → `dev`

**Title:** `feat: workspaces — CRUD, member invites, CSV import, LLM config, admin routes`

### Summary
Delivers the full workspace lifecycle: creation, settings updates, member invitations, a CSV message-import tool for onboarding, and the workspace-admin member management surface.

### What's included

#### `routes/workspaces/index.ts`
- `GET /v1/workspaces` — Lists all workspaces the authenticated user belongs to. Cached per user (medium TTL, invalidated on membership change).
- `POST /v1/workspaces` — Creates workspace + owner membership + default `#general` channel in a single transaction. Rate-limited to 5/hour. Idempotent via `Idempotency-Key` header.
- `GET /v1/workspaces/:workspaceId` — Returns workspace details with active member count. Cached.
- `PATCH /v1/workspaces/:workspaceId` — Updates name, description, logoUrl, settings. Admin/owner only. Uses conditional spreads for `exactOptionalPropertyTypes`.
- `PUT /v1/workspaces/:workspaceId/llm-config` — Stores BYO-LLM endpoint + encrypted API key in `settings.llm`. Enterprise plan only. API key never returned after save.
- `GET /v1/workspaces/:workspaceId/llm-config` — Returns endpoint/model/enabled; never returns the API key.
- `POST /v1/workspaces/:workspaceId/invite` — Creates invite record + Redis TTL cache + queues invite email. Free plan capped at 3 members.
- `POST /v1/workspaces/:workspaceId/import/csv` — Bulk-inserts messages from `{ rows: [...] }`. Resolves author emails to existing users; unmatched rows attributed to the importer with original email preserved as content prefix. Rate-limited to 5/hour.
- `GET /v1/workspaces/invite/:token` — Returns invite metadata (workspace name, inviter, role) without consuming the token.
- `POST /v1/workspaces/invite/:token/accept` — Upserts membership, marks invite accepted, auto-joins `#general`. Transactional.
- `GET /v1/workspaces/:workspaceId/members` — Lists active members. Cached.

#### `routes/admin/index.ts`
- `GET /v1/admin/:workspaceId/members` — Full member list with user details (admin only).
- `PATCH /v1/admin/:workspaceId/members/:userId` — Updates member role or status; blocks modification of workspace owner.
- `DELETE /v1/admin/:workspaceId/members/:userId` — Removes member from workspace and all channels.

### Commits
```
feat(workspaces): add workspace CRUD, invite, CSV import, and LLM config routes
feat(workspaces): add workspace admin member management routes
```

### Checklist
- [ ] Creating a workspace creates `#general` channel and owner membership atomically
- [ ] Free plan rejects 4th member invite
- [ ] CSV import attributes unmatched authors to importer with prefix
- [ ] LLM config API key is not returned by GET

---

## PR 05 — `feat/channels-messages` → `dev`

**Title:** `feat: channels & messages — channels, message feed, reactions, threads`

### Summary
The real-time messaging core: channel management, the message feed with full CRUD and emoji reactions, task conversion from messages, and threaded replies.

### What's included

#### `routes/channels/index.ts`
- `GET /v1/channels?workspaceId=` — Lists channels the user can see (public + joined private). Cached per user/workspace.
- `POST /v1/channels` — Creates channel + auto-joins creator as admin. Validates slug-safe name. Publishes `channel.created` WS event.
- `GET /v1/channels/:channelId` — Returns channel metadata with member count. Private channel access-gated.
- `GET /v1/channels/:channelId/messages` — Paginated message list with cursor, `before`/`after` timestamps, author, reactions, attachments, and thread reply count.
- `POST /v1/channels/:channelId/join` — Joins a public channel.
- `PATCH /v1/channels/:channelId/read` — Updates `lastReadAt` and sets `activeChannel` in presence Redis hash.

#### `routes/messages/index.ts`
- `POST /v1/messages` — Creates message, publishes `message.created` WS event, enqueues search indexing (`action: 'upsert'`) and mention notification jobs. Rate-limited to 120/min.
- `PATCH /v1/messages/:messageId` — Edits content (author only), sets `editedAt`.
- `DELETE /v1/messages/:messageId` — Soft-deletes; replaces content with `[Message deleted]`. Author or channel admin.
- `POST /v1/messages/:messageId/reactions` — Toggles reaction (create/delete). Publishes `message.reaction` WS event.
- `POST /v1/messages/:messageId/tasks` — Converts message to task + creates `converted_from` work-graph edge in a transaction.

#### `routes/threads/index.ts`
- `POST /v1/threads` — Creates a thread reply on a message.
- `GET /v1/threads/:threadId` — Returns thread with all replies.

### Commits
```
feat(channels): add channel create, list, messages, join, and read-tracking routes
feat(messages): add message send, edit, delete, reactions, and task-conversion routes
feat(messages): add threaded reply routes
```

### Checklist
- [ ] Message create publishes WS event to `ws:channel:<id>`
- [ ] Private channel returns 403 to non-members
- [ ] Reaction toggle: create on first press, delete on second
- [ ] Message-to-task creates work-graph edge

---

## PR 06 — `feat/tasks` → `dev`

**Title:** `feat: tasks — task CRUD, filtering, comments, bookmarks`

### Summary
Full task management: creation, updates (including status transitions that trigger automation jobs), deletion, comment threads, paginated filtered listings, and per-user bookmarking of any entity.

### What's included

#### `routes/tasks/index.ts`
- `GET /v1/tasks?workspaceId=` — Paginated task list. Filterable by `projectId`, `assigneeId`, `status`, `priority`. Sortable by `createdAt`, `dueDate`, `priority`, `updatedAt`. Cached with MD5 query-hash key (30s TTL). Invalidated on mutation via `CacheService.delPattern`.
- `POST /v1/tasks` — Creates task with optional `description`, `projectId`, `assigneeId`, `dueDate`, `tags`. Enqueues search index job. Publishes `task.created` WS event. Idempotent.
- `GET /v1/tasks/:taskId` — Returns task with assignee, comments, work-graph edges, project. Membership-gated.
- `PATCH /v1/tasks/:taskId` — Partial update. On `status` change: publishes `task.status_changed` WS event and enqueues automation trigger job (fixed — previously routed to the wrong queue entirely).
- `DELETE /v1/tasks/:taskId` — Soft-delete. Creator or admin/owner only.
- `POST /v1/tasks/:taskId/comments` — Adds comment, publishes `task.comment_added` WS event.

#### `routes/bookmarks/index.ts`
- `GET /v1/bookmarks` — Lists all bookmarks for the authenticated user (up to 100).
- `POST /v1/bookmarks` — Bookmarks any entity (`message`, `task`, `doc`, `canvas_node`). Unique per user+entity.
- `DELETE /v1/bookmarks/:entityType/:entityId` — Removes bookmark.

### Commits
```
feat(tasks): add task CRUD, filtering, pagination, and comment routes
feat(tasks): add bookmark create, list, and delete routes
```

### Checklist
- [ ] Task list cache is invalidated after create/update/delete
- [ ] Status change enqueues automation job (not search index)
- [ ] Bookmark is idempotent on duplicate (returns 409)
- [ ] Delete requires creator or admin role

---

## PR 07 — `feat/docs` → `dev`

**Title:** `feat: docs — document editor with full block management and version history`

### Summary
Collaborative document management: tree-structured documents, a full block-based content model (21 block types) with upsert/soft-delete, a version snapshot system, and search indexing.

### What's included

#### `routes/docs/index.ts`
- `GET /v1/docs?workspaceId=` — Lists root-level documents (no `parentId`). Excludes deleted.
- `POST /v1/docs` — Creates document + initial empty paragraph block. Publishes `doc.created`. Idempotent.
- `GET /v1/docs/:docId` — Returns document with all blocks (ordered) and editor metadata. Public docs bypass membership check.
- `PATCH /v1/docs/:docId` — Updates title, icon, isPublic. Uses conditional spreads for `exactOptionalPropertyTypes`.
- `PUT /v1/docs/:docId/blocks` — Full block replacement: snapshots current blocks to `DocumentVersion`, soft-deletes removed blocks, upserts all incoming blocks in a single `$transaction`. This is the HTTP fallback path — the Yjs CRDT websocket is the primary real-time path. Enqueues search re-index.
- `GET /v1/docs/:docId/history` — Returns up to 50 version snapshots with creator info.

**Block types supported:** `paragraph`, `heading1–3`, `code`, `quote`, `callout`, `bulleted_list`, `numbered_list`, `todo`, `divider`, `image`, `file`, `embed`, `task_embed`, `table`, `canvas_embed`.

### Commits
```
feat(docs): add document CRUD, block management, and version history routes
```

### Checklist
- [ ] `PUT /blocks` creates a version snapshot before overwriting
- [ ] Public document is accessible without authentication
- [ ] Soft-deleted blocks don't appear in `GET /docs/:id`
- [ ] Block upsert and delete happen in the same transaction

---

## PR 08 — `feat/canvas` → `dev`

**Title:** `feat: canvas — infinite whiteboard with node CRUD and work-graph task conversion`

### Summary
Infinite canvas feature: create and manage canvases, add/move/update nodes (sticky notes, shapes, text, images, connectors, doc embeds, task embeds, frames), and convert canvas nodes directly to tasks with a work-graph edge linking them.

### What's included

#### `routes/canvas/index.ts`
- `GET /v1/canvases?workspaceId=` — Lists canvases for a workspace, cached (medium TTL).
- `POST /v1/canvases` — Creates canvas. Idempotent.
- `GET /v1/canvases/:canvasId` — Returns canvas with all nodes.
- `POST /v1/canvases/:canvasId/nodes` — Adds a node. Rate-limited to 200/min (high-frequency real-time ops). Publishes `canvas.node.created` WS event.
- `PATCH /v1/canvases/:canvasId/nodes/:nodeId` — Updates node position/size/content. Rate-limited to 600/min. Publishes `canvas.node.moved`. Uses conditional spreads + `any` cast for `InputJsonValue` compatibility on `content` field.
- `POST /v1/canvases/:canvasId/nodes/:nodeId/tasks` — Creates a `Task` and a `WorkGraphEdge` (`converted_from`) linking it back to the canvas node, in a transaction.

### Commits
```
feat(canvas): add canvas and node CRUD with work-graph task conversion
```

### Checklist
- [ ] Node create publishes WS event to workspace channel
- [ ] Node-to-task creates work-graph edge with `converted_from` type
- [ ] `PATCH /nodes/:nodeId` with partial body only updates provided fields

---

## PR 09 — `feat/realtime-ws` → `dev`

**Title:** `feat: real-time — WebSocket gateway, Yjs CRDT collaborative editing, presence`

### Summary
The real-time layer: a multi-namespace WebSocket gateway backed by Redis pub/sub, Yjs CRDT state synchronisation for collaborative document editing, and a user presence tracking service.

### What's included

#### `routes/ws/index.ts`
- Upgrades HTTP connections to WebSocket with JWT auth on handshake.
- Three pub/sub namespaces: `ws:channel:<id>` (messages/reactions), `ws:workspace:<id>` (tasks/docs/canvas), `ws:doc:<id>` (Yjs CRDT updates).
- `publishForceDisconnect(app, workspaceId, reason)` — used by the super-admin suspend endpoint to immediately evict all live clients from a suspended workspace across every API replica.
- Heartbeat + clean disconnect tracking.

#### `services/yjs-sync.ts`
- `YjsSyncService` — manages in-memory Yjs `Doc` instances per document ID.
- Handles `sync-step-1`, `sync-step-2`, and `update` protocol messages.
- Persists Yjs state vector to Redis; broadcasts diffs only (not full state) to other connected clients.
- Debounced DB persistence: writes block state back to `DocumentBlock` every 5 seconds of inactivity.

#### `services/presence.ts`
- `PresenceService` — tracks `{ userId, workspaceId, activeChannel, status, lastSeen }` in Redis hashes with a 30s TTL.
- `heartbeat(userId, data)` — refreshes TTL.
- `getWorkspacePresence(workspaceId)` — returns all currently online members for a workspace.
- `setTyping / clearTyping` — per-channel typing indicators with 3s auto-expiry.

### Commits
```
feat(realtime): add WebSocket gateway with channel, workspace, and doc namespaces
feat(realtime): add Yjs CRDT sync service for collaborative doc editing
feat(realtime): add user presence tracking service
```

### Checklist
- [ ] WS connection rejected with 401 if JWT is invalid
- [ ] Force-disconnect on workspace suspension evicts all connected clients
- [ ] Yjs sync: two clients see each other's changes within one round-trip
- [ ] Presence heartbeat keeps user online; absence of heartbeat expires entry within 30s

---

## PR 10 — `feat/notifications` → `dev`

**Title:** `feat: notifications — in-app notification feed, read tracking, and preferences`

### Summary
In-app notification system with per-user preference controls and a background job handler for generating mention and task notifications.

### What's included

#### `routes/notifications/index.ts`
- `GET /v1/notifications` — Paginated notification feed. Supports `unreadOnly` filter. Returns `unreadCount` alongside paginated results.
- `PATCH /v1/notifications/:id/read` — Marks a single notification as read.
- `POST /v1/notifications/read-all` — Marks all (or all in a workspace) as read.
- `GET /v1/notifications/preferences` — Returns user preferences, with safe defaults if not yet set.
- `PUT /v1/notifications/preferences` — Upserts notification preferences. Uses explicit conditional spreads for each boolean field to satisfy `exactOptionalPropertyTypes`.

#### `jobs/handlers/notifications.ts`
- Processes `message.mentions` jobs: parses `@mention` patterns from message content, looks up mentioned users, creates `Notification` records, and sends push/email if enabled per-preference.
- Processes `task.assigned` jobs: notifies the assignee when a task is assigned.

### Commits
```
feat(notifications): add notification list, read, read-all, and preferences routes
feat(notifications): add notification background job handler
```

### Checklist
- [ ] `unreadCount` is accurate before and after `read-all`
- [ ] Preference upsert creates record on first call, updates on subsequent
- [ ] Mention notification not sent if user has `mentions: false`

---

## PR 11 — `feat/search-ai` → `dev`

**Title:** `feat: search & AI — full-text search, AI assistant, embeddings, meeting summaries`

### Summary
Workspace intelligence: full-text search across messages/tasks/docs/canvas nodes, an AI assistant powered by Anthropic Claude, AI-generated task extraction, meeting transcript summarisation, and the background job infrastructure for search indexing and embeddings.

### What's included

#### `routes/search/index.ts`
- `GET /v1/search?workspaceId=&q=` — Postgres full-text search across all entity types. Respects channel membership for messages. Highlights matching terms. Paginated.

#### `routes/ai/index.ts`
- `POST /v1/ai/query` — Natural language workspace query. Retrieves relevant context via embeddings similarity, sends to Claude with context window. Supports `contextTypes` filter.
- `POST /v1/ai/summarize` — Summarises a channel, document, task list, or meeting transcript.
- `POST /v1/ai/tasks/generate` — Extracts actionable task items from free text (meeting notes, message thread).
- `POST /v1/ai/meeting/summary` — Triggers async meeting summary job for a transcript.

#### `services/anthropic.ts`
- `AnthropicService` — wraps `@anthropic-ai/sdk`. Supports workspace BYO-LLM config (falls back to platform key). Streams responses for query endpoint.

#### Job handlers
- `jobs/handlers/embeddings.ts` — Generates and stores vector embeddings for messages, tasks, and docs using the configured embedding model. Handles `upsert` and `delete` actions.
- `jobs/handlers/search-index.ts` — Updates Postgres full-text search tsvectors for changed entities.
- `jobs/handlers/meeting-summary.ts` — Processes meeting transcripts: chunks text, sends to Claude, stores structured summary (action items, decisions, participants) in `MeetingTranscript`.

### Commits
```
feat(search): add full-text search route with workspace-scoped results
feat(ai): add AI query, summarize, task generation, and meeting summary routes
feat(ai): add Anthropic Claude service client
feat(ai): add embeddings background job handler
feat(search): add search index background job handler
feat(ai): add meeting summary background job handler
```

### Checklist
- [ ] Search returns results scoped to the user's workspace and accessible channels
- [ ] BYO-LLM endpoint is used when configured; falls back to platform key
- [ ] Embeddings job handles both `upsert` and `delete` action types
- [ ] Meeting summary stores structured JSON (action items, decisions)

---

## PR 12 — `feat/background-jobs` → `dev`

**Title:** `feat: background jobs — BullMQ queues, worker process, all job handlers`

### Summary
The complete asynchronous job processing layer: BullMQ queue definitions for all job types, a worker process with graceful shutdown, and handlers for emails, automations, media transcoding, and webhook delivery.

### What's included

#### `jobs/queues/index.ts`
- Defines and exports all BullMQ queues: `emailQueue`, `notificationQueue`, `searchIndexQueue`, `embeddingsQueue`, `automationsQueue`, `transcodeQueue`, `webhookQueue`, `meetingSummaryQueue`.
- Typed `enqueue*` helper functions for each queue (e.g. `enqueueEmail`, `enqueueAutomation`) used by route handlers.

#### `jobs/queues/worker-registry.ts`
- `startAllWorkers()` — creates and returns all BullMQ `Worker` instances, each pointing to the correct handler and configured with concurrency and retry settings.

#### `jobs/worker.ts`
- `startWorker()` — exported entry point that calls `startAllWorkers` and registers `SIGINT`/`SIGTERM`/`unhandledRejection` handlers for clean shutdown.

#### Job handlers
- `handlers/email.ts` — Sends transactional emails via configured SMTP/SES. Handles `workspace.invite`, `password.reset`, `task.assigned`, `weekly.digest` types.
- `handlers/automations.ts` — Evaluates workspace automation rules against trigger events (task status changes, channel messages). Executes configured actions (send message, create task, send webhook).
- `handlers/transcode.ts` — Processes uploaded media: generates thumbnails, converts video to HLS, stores variants in S3.
- `handlers/webhook.ts` — Delivers webhook payloads to registered endpoints with HMAC-SHA256 signatures, exponential back-off retry, and delivery log recording.

#### Services
- `services/automations.ts` — `AutomationService.executeAutomations(trigger, payload)` — fetches matching workspace rules and dispatches actions.
- `services/email.ts` — `EmailService` wrapping Nodemailer; renders templates and sends via configured transport.

### Commits
```
feat(jobs): add BullMQ queue definitions and worker registry
feat(jobs): add job enqueue helpers for all queue types
feat(jobs): add worker process entrypoint with graceful shutdown
feat(jobs): add email background job handler
feat(jobs): add automation trigger background job handler
feat(jobs): add media transcode background job handler
feat(jobs): add webhook delivery background job handler
feat(jobs): add workspace automations execution service
feat(jobs): add transactional email service
```

### Checklist
- [ ] Worker process starts and all queues are processing
- [ ] SIGTERM causes clean drain (no jobs abandoned mid-flight)
- [ ] Webhook delivery retries with back-off on 5xx responses
- [ ] Automation trigger uses `automationsQueue`, not `searchIndexQueue`

---

## PR 13 — `feat/integrations` → `dev`

**Title:** `feat: integrations — API keys, webhooks, SCIM provisioning, file upload, video`

### Summary
External integration surface: programmatic API access via scoped API keys, outbound webhook delivery, SCIM 2.0 for enterprise IdP provisioning, S3-backed file uploads, and LiveKit video call tokens.

### What's included

#### `routes/apikeys/index.ts`
- `GET /v1/apikeys?workspaceId=` — Lists active (non-revoked) API keys; never returns the raw key.
- `POST /v1/apikeys` — Generates `csk_live_<32-byte-hex>` key, stores SHA-256 hash, returns raw key **once only**.
- `DELETE /v1/apikeys/:keyId` — Revokes key (sets `revokedAt`).
- `apiKeyAuthMiddleware` — Authenticates `Bearer csk_live_*` tokens; attaches real `plan` from workspace and real `email` from user to `req.user` (fixes SEC-3/SEC-4: hardcoded `'pro'` plan and empty email).
- `isSuperAdmin` is explicitly forced to `false` on API key auth — API keys are workspace-scoped, never platform-scoped.

#### `routes/webhooks/index.ts`
- Full webhook endpoint CRUD (create, list, update, delete).
- `POST /v1/webhooks/:endpointId/replay/:deliveryId` — Re-queues a failed delivery.
- Secrets stored encrypted at rest; HMAC-SHA256 signatures on delivery.

#### `routes/scim/index.ts`
- SCIM 2.0 protocol: `GET /Users`, `GET /Users/:id`, `POST /Users`, `PATCH /Users/:id`, `DELETE /Users/:id`.
- Token-authenticated via `ScimToken` (separate from JWT/API keys).
- Provisions workspace membership on user creation; deprovisions on delete.

#### `routes/upload/index.ts`
- `POST /v1/upload` — Returns S3 presigned PUT URL + public GET URL. Validates MIME type and file size. Associates uploaded file with workspace.

#### `routes/video/index.ts`
- `POST /v1/video/token` — Issues a LiveKit room token for a channel. Validates channel membership.
- `POST /v1/video/:channelId/transcript` — Appends speech-to-text segments to the channel's active `MeetingTranscript` record.

### Commits
```
feat(integrations): add API key management routes with SHA-256 hashing and scope enforcement
feat(integrations): add webhook endpoint management and event delivery routes
feat(integrations): add SCIM 2.0 user provisioning routes
feat(integrations): add file upload route with S3-compatible presigned URL storage
feat(integrations): add LiveKit video token generation and transcript routes
```

### Checklist
- [ ] Raw API key is returned only at creation time
- [ ] API key auth attaches real workspace plan (not hardcoded `'pro'`)
- [ ] SCIM user create provisions workspace membership
- [ ] Video token is rejected if user is not a channel member

---

## PR 14 — `feat/super-admin` → `dev`

**Title:** `feat: super-admin — platform dashboard, two-tier auth, GDPR erasure`

### Summary
Platform-level administration: a completely separate route surface for platform operators (not workspace admins), two-tier authorization with fast JWT-claim and slow DB-reverified paths, and a GDPR right-to-erasure implementation.

### What's included

#### `middleware/super-admin.ts`
- `requireSuperAdmin` — Fast path: reads `isSuperAdmin` from the JWT claim. Rejects immediately if false; does not query the database.
- `requireSuperAdminVerified` — Strict path: re-queries `user.isSuperAdmin` from the database. Used on all destructive actions (suspend workspace, grant/revoke super admin) to prevent a stale token from exercising destructive authority.

#### `routes/super-admin/index.ts`
All routes require `isSuperAdmin: true`. Mounted at `/v1/super-admin` — completely separate from `/v1/admin` (workspace-scoped).

- `GET /overview` — Platform-wide health snapshot: user/workspace counts, plan distribution, 24h message volume, 7-day new user count.
- `GET /workspaces` — Paginated workspace list with owner details (fetched via separate `User` query — `Workspace` model has no `owner` relation, only `ownerId` scalar). Filterable by plan and status.
- `GET /workspaces/:id` — Workspace detail with owner info and recent activity count.
- `POST /workspaces/:id/suspend` — Sets `suspendedAt` + `suspendedReason`. Calls `publishForceDisconnect` to evict live clients immediately. DB-reverified auth. Rate-limited.
- `POST /workspaces/:id/reactivate` — Clears suspension fields. DB-reverified.
- `PATCH /workspaces/:id/plan` — Changes workspace plan. DB-reverified. Invalidates workspace cache.
- `GET /users`, `GET /users/:id` — User listing and detail.
- `POST /users/:id/suspend` — 100-year `lockedUntil` lock. Cannot suspend another super admin (must revoke first).
- `POST /users/:id/reactivate` — Clears `lockedUntil`.
- `POST /users/:id/super-admin` — Grant/revoke `isSuperAdmin`. Rate-limited to 5/hour. Self-modification blocked in both directions.
- `GET /audit-log` — Platform audit log with filters. Never filtered by actor's own actions.

#### `services/gdpr-erasure.ts`
- `GdprErasureService.eraseUser(userId)` — Anonymises PII fields, soft-deletes the user, purges Redis keys, and records the erasure in the audit log. Preserves message/task IDs for referential integrity.

### Commits
```
feat(super-admin): add two-tier JWT-claim and DB-reverified authorization middleware
feat(super-admin): add platform dashboard routes for workspace/user management and audit log
feat(super-admin): add GDPR right-to-erasure service
```

### Checklist
- [ ] `requireSuperAdmin` rejects workspace admins without DB query
- [ ] Destructive actions (suspend/grant) use `requireSuperAdminVerified`
- [ ] Super admin cannot suspend themselves
- [ ] GDPR erasure removes PII and records the action in audit log

---

## PR 15 — `feat/work-graph` → `dev`

**Title:** `feat: work-graph — entity relationship edge query and traversal routes`

### Summary
The Work Graph is CollabOS's cross-entity relationship model that links messages, tasks, docs, and canvas nodes with typed directed edges. This PR adds the read surface for querying those relationships.

### What's included

#### `routes/graph/index.ts`
- `GET /v1/graph/:entityType/:entityId` — Returns all outbound edges from an entity (e.g. all tasks converted from a message, all canvas nodes linked to a task). Workspace-membership gated.
- `GET /v1/graph/:entityType/:entityId/incoming` — Returns all inbound edges (e.g. all messages that were converted into a given task).
- Edges carry `edgeType` (`converted_from`, `references`, `blocks`, `spawned`), `sourceType`, `targetType`, `sourceId`, `targetId`, and creator metadata.

Work-graph edges are **created** by the other feature routes (message→task in `feat/channels-messages`, canvas-node→task in `feat/canvas`). This PR exposes the read/traversal API.

### Commits
```
feat(work-graph): add work-graph edge query and traversal routes
```

### Checklist
- [ ] Graph query returns edges for all entity types
- [ ] Workspace membership is enforced
- [ ] Both outbound and inbound edge directions are queryable

---

## PR 16 — `feat/observability` → `dev`

**Title:** `feat: observability — Prometheus metrics, rate limiting, audit log service, LLM config`

### Summary
Platform health and compliance tooling: a Prometheus metrics endpoint, a Redis-backed sliding-window rate limit service, an append-only audit log service, a workspace LLM configuration service, and integration tests.

### What's included

#### `routes/metrics/index.ts`
- `GET /v1/metrics` — Exposes `prom-client` default metrics + custom counters/histograms (request count, response time, active WS connections, job queue depths). Bearer-token protected to prevent public exposure.

#### `services/rate-limit.ts`
- `RateLimitService` — Redis sorted-set sliding-window implementation. `check(key, limit, windowMs)` returns `{ allowed, remaining, resetAt }`. Used by routes that need finer control than Fastify's built-in rate limiter.

#### `services/audit.ts`
- `AuditService.log(entry)` — Append-only `AuditLog` create. Uses conditional spread for optional `workspaceId` field to satisfy `exactOptionalPropertyTypes`. Casts `metadata` to `any` for Prisma `InputJsonValue` compatibility.
- `AuditService.getForUser(userId, limit, cursor)` — Paginated audit history for a user.
- `AuditService.getForWorkspace(workspaceId, limit, cursor)` — Paginated workspace audit history with user details.

#### `services/workspace-llm-config.ts`
- `WorkspaceLlmConfigService.get(workspaceId)` — Reads and decrypts the BYO-LLM config from `workspace.settings.llm`. Returns `null` if not configured.
- `WorkspaceLlmConfigService.getEffectiveConfig(workspaceId)` — Returns workspace config if present, otherwise platform default.

#### Tests
- `routes/__tests__/auth.test.ts` — Integration tests for register/login/refresh using an in-process Fastify instance with a test database.
- `services/__tests__/presence.test.ts` — Unit tests for `PresenceService` with a mocked Redis client.

### Commits
```
feat(observability): add Prometheus metrics endpoint
feat(observability): add Redis-backed sliding-window rate limit service
feat(observability): add append-only audit log service
feat(observability): add workspace BYO-LLM config service
test(api): add route and service integration tests
chore(api): add environment diagnostic check script
```

### Checklist
- [ ] `/v1/metrics` requires bearer token and returns valid Prometheus text format
- [ ] Rate limit sliding window correctly resets after `windowMs`
- [ ] Audit log `getForWorkspace` returns entries in descending `createdAt` order
- [ ] Auth integration tests pass against test database

---

## PR 17 — `feat/web-app` → `dev`

**Title:** `feat: web app — complete Next.js 15 frontend`

### Summary
The full user-facing frontend: a Next.js 15 App Router application with every screen, component, state management layer, and API client needed to run CollabOS in a browser. 41 commits covering every feature surface end-to-end.

### What's included

#### App config & infrastructure
- Next.js 15 App Router config, Tailwind CSS, PostCSS, ESLint, TypeScript.
- `src/components/providers.tsx` — React context tree: `QueryClientProvider` (TanStack Query), `AuthProvider` (JWT management), `ThemeProvider`, `WebSocketProvider`.
- `src/styles/globals.css` — Tailwind base + CSS custom properties for theming.

#### Auth (`app/auth/`, `components/auth/`)
- Login, register, forgot-password, reset-password pages.
- Form components with React Hook Form + Zod validation, error states, loading skeletons.

#### Marketing (`app/marketing/`, `components/marketing/`)
- Home, features, pricing, security, changelog, about pages.
- Animated hero sections, pricing tiers, feature grids, security trust signals.

#### Workspace shell (`app/(workspace)/`, `components/layout/`)
- Authenticated workspace shell layout with `WorkspaceRail` (workspace switcher), `ModuleSidebar` (channels/tasks/docs/canvas nav), `MobileNav` (bottom nav for mobile).
- New workspace creation wizard with onboarding steps: role selection, CSV import, member invites.
- Workspace selector page for users with multiple workspaces.
- Invite acceptance page.

#### Channels & messages (`components/channels/`)
- `ChannelView` — full message feed with virtualized list, infinite scroll (IntersectionObserver).
- `MessageList` — renders messages with author avatars, edit/delete actions, emoji reactions.
- `MessageComposer` — rich text input with `@mention` support, attachment picker, emoji picker, slash commands.
- `MessageEditor` — inline edit mode.
- `ThreadPanel` — slide-in thread view.
- `ContextPanel` — right-side panel for pinned messages, members, files.
- `CreateChannelModal`.

#### Tasks (`components/tasks/`)
- `TasksView` — toggleable board/list view.
- `TaskKanban` — drag-and-drop kanban board (columns: todo, in_progress, in_review, done).
- `TaskList` — sortable table view with bulk actions.
- `TaskDetailDrawer` — full task detail with comments, assignee, due date, work-graph edges.
- `CreateTaskModal`.

#### Docs (`components/docs/`)
- `DocsListView` — tree-structured document sidebar.
- `DocView` — block-based editor with Yjs CRDT sync (via `useDocCrdtSync` hook).

#### Canvas (`components/canvas/`)
- `CanvasListView` — canvas gallery.
- `CanvasView` — infinite whiteboard with pan/zoom, node drag-and-drop, node type palette, sticky-to-task conversion.

#### AI (`components/ai/`)
- `AiView` — chat-style interface for workspace queries and summarization.

#### Notifications (`components/notifications/`)
- `NotificationBell` — header bell with unread badge and popover feed.
- `NotificationsView` — full notifications page with read/unread filtering and preference panel.

#### Work graph (`components/graph/`)
- `GraphView` — force-directed D3 graph of entity relationships.

#### Video (`components/video/`)
- `CallPanel` — LiveKit room participant grid, mute/camera controls, screen share, transcript capture.

#### Settings (`components/settings/`)
- `SettingsView` — tabbed settings: General, Members, SSO config, Billing, API Keys.

#### Super admin (`app/super-admin/`, `components/super-admin/`)
- Dashboard, workspace management, user management, and audit log pages.

#### Search (`components/search/`)
- `SearchPalette` — `Cmd+K` command palette with live full-text search results grouped by type.

#### Shared UI (`components/ui/`)
- `Button`, `Input`, `Avatar`, `Badge`, `Tooltip`, `Skeleton`, `DropdownMenu`, `Toaster`, `Reveal`.

#### State & data
- `stores/auth.ts` — Zustand store for JWT tokens and user session.
- `stores/workspace.ts` — Active workspace and channel state.
- `stores/presence.ts` — Online member presence map.
- `hooks/use-websocket.ts` — Typed WebSocket hook with auto-reconnect.
- `hooks/use-messages.ts` — TanStack Query + WS-driven message feed.
- `hooks/use-tasks.ts` — Task list with optimistic updates.
- `hooks/use-doc-crdt-sync.ts` — Yjs document sync over WebSocket.
- `hooks/use-transcript-capture.ts` — Browser MediaStream → transcript segment submission.
- `lib/api-client.ts` — Typed fetch wrapper with JWT auto-refresh and 401 handling.
- `lib/csv.ts` — CSV parse/validate utility for the import wizard.
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge), date formatting, truncation.
- `types/` — API response types matching the backend schema.

### Commits (41 total — selected highlights)
```
chore(web): add Next.js app config, tsconfig, and eslint
chore(web): add Tailwind CSS and PostCSS config
feat(web): add root layout, home redirect page, and error boundaries
feat(web/auth): add login, register, forgot-password, and reset-password pages
feat(web/auth): add auth form components
feat(web/marketing): add marketing pages (home, features, pricing, security, changelog, about)
feat(web/workspace): add authenticated workspace shell layout
feat(web/workspace): add sidebar, header, and workspace layout components
feat(web/workspace): add new-workspace creation, workspace selector, and invite acceptance pages
feat(web/channels): add channels page with message thread view
feat(web/channels): add channel list, message feed, composer, and reaction components
feat(web/tasks): add tasks board and list pages
feat(web/tasks): add task card, board, detail, and creation components
feat(web/docs): add document tree and editor pages
feat(web/docs): add document editor, block renderer, and sidebar components
feat(web/canvas): add canvas whiteboard page
feat(web/canvas): add canvas node and infinite whiteboard components
feat(web/ai): add AI assistant page + components
feat(web/notifications): add notification feed and preferences components
feat(web/graph): add work-graph force-directed visualization components
feat(web/video): add LiveKit video call panel and controls components
feat(web/settings): add workspace settings pages and form components
feat(web/super-admin): add platform admin dashboard pages and components
feat(web/search): add global search command palette component
feat(web/ui): add shared UI component library
feat(web/ui): add React providers (auth, query, theme, socket)
feat(web/state): add Zustand stores for UI state
feat(web/state): add custom React hooks (useWebSocket, useAuth, usePresence)
feat(web/lib): add API client, auth helpers, and utility functions
chore(web): add global CSS and Tailwind base styles
```

### Checklist
- [ ] `npm run build -w apps/web` passes with zero TypeScript errors
- [ ] Auth flow: register → login → workspace create → channel view
- [ ] Yjs collaborative editing: two browser tabs see each other's changes
- [ ] Kanban drag-and-drop updates task status via API
- [ ] `Cmd+K` search palette returns results and navigates correctly
- [ ] Mobile nav renders correctly on viewport < 768px

---

## Branch Merge Order

```
feature branches  →  dev  (via these PRs)
dev               →  staging  (after integration testing)
staging           →  main     (after staging sign-off)
```

Never merge `feature/*` directly to `staging` or `main`.  
Never merge `main` back to `staging` or `dev` directly — use a hotfix branch instead.
