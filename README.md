# CollabOS

A unified real-time collaboration platform — Channels, Docs, Canvas, Tasks, and AI intelligence in one coherent workspace. Built with Fastify, Next.js 15, PostgreSQL, Redis, and the Anthropic Claude API.

---

## What is built

| Module | Status | Description |
|---|---|---|
| Auth | Complete | JWT RS256, refresh rotation, argon2id, account lockout, password reset |
| Workspaces | Complete | CRUD, invite flow, plan limits, RBAC |
| Channels | Complete | Public/private, pagination, read receipts, WS events |
| Messages | Complete | Send, edit (inline), delete (soft), reactions, optimistic UI |
| Threads | Complete | Threaded replies with WS broadcast |
| Documents | Complete | Block editor, versioning, public sharing |
| Tasks | Complete | Kanban + list + detail drawer, comments, Work Graph links |
| Canvas | Complete | SVG infinite canvas, pan/zoom/drag, sticky notes, shapes |
| AI | Complete | Workspace Q&A, channel/task summarize, task generation from text |
| Search | Complete | Cross-entity full-text with debounced modal |
| Upload | Complete | S3-compatible multipart, mime/size validation |
| Work Graph | Complete | Cross-module edge creation (message→task, sticky→task, etc.) |
| Admin | Complete | Overview analytics, member management, audit log |
| Invite | Complete | Token-based invite links with accept flow |
| WebSocket | Complete | Per-workspace hub, Redis pub/sub, presence, reconnect |
| Background Jobs | Complete | Redis queue, retry, dead letter, email/notification/search/automation handlers |
| Automations | Complete | Rule engine stored in workspace settings, action executors |
| Email | Complete | Invite, password reset, mention notification templates |
| Monitoring | Complete | Sentry-compatible error reporting |
| Settings | Complete | Profile, appearance, notifications, workspace, security sections |
| Command Palette | Complete | ⌘K global palette with keyboard navigation |
| Search Modal | Complete | ⌘F cross-entity search modal |
| Mobile | Complete | Bottom nav, responsive layout with md breakpoints |
| CI/CD | Complete | Typecheck, lint, test, Docker build, deploy, security scan |
| Infrastructure | Complete | Multi-stage Dockerfiles, nginx SSL, DB backup cron, production compose |

---

## Monorepo structure

```
collabos/
├── apps/
│   ├── api/                    # Fastify 5 REST + WebSocket API
│   │   └── src/
│   │       ├── routes/         # auth, workspaces, channels, messages, docs,
│   │       │                   # tasks, canvas, ai, graph, search, upload,
│   │       │                   # threads, admin, ws
│   │       ├── middleware/     # auth (JWT), error-handler, request-logger
│   │       ├── plugins/        # redis, db, cache
│   │       ├── services/       # rate-limit, presence, audit, email, automations
│   │       ├── jobs/           # worker + handlers (email, notifications,
│   │       │                   # search-index, automations)
│   │       └── utils/          # env, errors, cursor, idempotency, logger, monitoring
│   └── web/                    # Next.js 15 App Router
│       └── src/
│           ├── app/            # Pages (workspace, auth, invite, settings...)
│           ├── components/     # ui/, layout/, channels/, docs/, canvas/,
│           │                   # tasks/, ai/, search/, settings/, auth/, workspace/
│           ├── hooks/          # use-websocket, use-messages, use-tasks,
│           │                   # use-intersection-observer
│           ├── lib/            # api-client, utils
│           └── stores/         # auth, workspace, presence (Zustand)
├── packages/
│   ├── db/                     # Prisma 6 schema + migrations + seeds
│   └── shared/                 # Types, validators, constants, utils
├── docker/
│   ├── docker-compose.yml      # Development
│   ├── docker-compose.prod.yml # Production (with nginx, backup, 2-replica API)
│   ├── nginx/nginx.conf        # SSL termination, rate limiting, WS upgrade
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── Dockerfile.worker
├── scripts/
│   ├── generate-jwt-keys.mjs   # One-time RSA keypair generation
│   ├── health-check.mjs        # Verify all services are up
│   └── backup-db.sh            # pg_dump + S3 upload + retention
└── .github/workflows/
    ├── ci.yml                  # Typecheck → lint → test → build → Docker
    ├── deploy.yml              # Staging auto-deploy + production with approval
    └── security.yml            # npm audit + CodeQL + secret scanning
```

---

## Quick start (local development)

### Prerequisites

- Node.js 22+
- Docker and Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/your-org/collabos
cd collabos
npm install
```

### 2. Generate JWT keys

```bash
node scripts/generate-jwt-keys.mjs
```

Copy the output `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` values into your `.env`.

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in JWT keys + any optional keys (ANTHROPIC_API_KEY, SMTP settings)
```

Minimum required for local dev (all others have defaults):
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `JWT_REFRESH_SECRET` (any 32+ char string)

### 4. Start services

```bash
npm run docker:dev        # starts postgres + redis
npm run db:generate       # generate Prisma client
npm run db:migrate:dev    # run migrations
npm run db:seed           # seed test data
```

### 5. Start dev servers

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- API docs: http://localhost:3001/docs

### Seed credentials

| Email | Password | Role |
|---|---|---|
| alice@example.com | password123 | Pro, Owner |
| bob@example.com | password123 | Pro, Admin |
| carol@example.com | password123 | Free, Member |
| dana@collabos.io | password123 | **Super Admin** — platform-wide, not a member of any workspace |

Workspace slug: `acme-corp`

---

## Super admin dashboard

A platform-level operator surface, completely separate from any workspace's own admin settings. Reachable at `/super-admin` — a Shield icon appears in the workspace rail (desktop) and the "More" sheet (mobile) only for accounts with `isSuperAdmin: true`, and is invisible to everyone else.

**There is intentionally no self-service way to become a super admin.** The first one on any deployment must be granted directly via SQL:

```sql
UPDATE users SET is_super_admin = true WHERE email = 'you@example.com';
```

Every subsequent grant or revoke goes through the dashboard itself (`Users` → `Grant admin` / `Revoke admin`), which requires an existing super admin and is fully logged.

### What it can do

- **Overview** — live platform-wide counts: total/active/suspended workspaces, users by plan, messages in the last 24h, new signups in the last 7 days.
- **Workspaces** — search, filter by status, change any workspace's plan inline, and **suspend/reactivate**. Suspension is reversible and distinct from deletion: a suspended workspace's members are disconnected from real-time access immediately (across every API replica, via Redis pub/sub) and blocked from further access, but nothing is deleted.
- **Users** — search, suspend/reactivate any non-super-admin account, and grant/revoke super admin access on other accounts.
- **Audit log** — an append-only record of every action taken in this dashboard, visible to every super admin including actions taken on their own account. There is no way to filter yourself out of it.

### Authorization model

Deliberately independent of workspace roles. A workspace owner has zero authority here by default; a super admin has authority here regardless of which workspaces (if any) they belong to. Two enforcement tiers:

- **Fast path** (`requireSuperAdmin`) — trusts the `isSuperAdmin` claim already in the signed JWT. Used for read-only views. A claim can be up to 15 minutes stale (the access token TTL) if access was just revoked elsewhere — an accepted, bounded risk for views that don't change anything.
- **Strict path** (`requireSuperAdminVerified`) — re-checks the database on every call, ignoring the JWT claim. Required before any destructive action: suspending a workspace or user, granting/revoking super admin, and (in the API) changing a workspace's plan.

Self-modification is blocked in both directions: a super admin cannot suspend or grant/revoke their own account. A locked-out super admin requires a *different* super admin (or direct database access) to restore — by design, so a single compromised session can't both lock out every peer and be irreversible from the same session.

---

## Running tests

```bash
# Unit tests (all packages)
npm run test

# API unit tests only
npm run test -w apps/api

# Shared utility tests
npm run test -w packages/shared

# Integration tests (requires real DB + Redis)
DATABASE_URL=... REDIS_URL=... JWT_PRIVATE_KEY=... JWT_PUBLIC_KEY=... npm run test -w apps/api

# Watch mode
npm run test:watch -w apps/api

# Type checking across all packages
npm run typecheck
```

---

## Key architectural decisions

### Authentication

- **JWT RS256** (asymmetric) — access tokens expire in 15 minutes. The public key can be distributed to any service for verification without sharing the private key.
- **Refresh token rotation** — every refresh issues a new JTI, invalidates the old one. Reuse of an old token is treated as a replay attack: all sessions for that user are revoked.
- **argon2id** with hardened parameters (64MB memory cost, 3 iterations, 4-way parallelism).
- **Account lockout** after 5 failed logins — unlocks automatically after 15 minutes.
- **Access token stored in memory only** (never localStorage). Refresh token is persisted in Zustand with `partialize`.

### Rate limiting

Implemented at two layers:

1. **Fastify global** (`@fastify/rate-limit`) — 300 req/min per IP, configurable per route.
2. **Per-plan Redis sliding window** via `RateLimitService` — free: 60/min, pro: 600/min, enterprise: 6000/min.

Auth endpoints have additional restrictive limits (e.g. register: 5/hour, login: 10/15min).

### Idempotency

All mutation endpoints (`POST`, `PATCH`) accept an `Idempotency-Key` header. Results are cached in Redis for 24 hours with a composite key of `userId:idempotency-key`. Duplicate requests return the same response without re-executing the handler.

### Pagination

All list endpoints use cursor-based pagination (`next_cursor` / `prev_cursor`), never offset-based. Offset pagination drifts when new records are inserted between page fetches — cursor pagination is stable on live data. Cursors are base64url-encoded JSON objects.

### Caching

- Redis with typed TTLs: SHORT (60s), MEDIUM (300s), LONG (3600s), DAY (86400s).
- `getOrSet()` pattern: check cache → on miss, run fetcher → populate cache.
- Pattern-based invalidation on mutations: `workspace:${id}:*` clears all workspace keys on update.
- Search results: 10-second cache to prevent hammering on rapid keystrokes.

### Real-time

- Single WebSocket connection per workspace per client.
- Redis pub/sub fan-out allows horizontal scaling: any API instance can publish, all subscribed clients receive.
- Heartbeat ping/pong every 30 seconds detects dead connections.
- Exponential backoff reconnect (1s → 30s max) with full session restore on reconnect.
- Presence TTL: 5 minutes, refreshed on any activity. Broadcast on disconnect.

### Work Graph

Every cross-module action creates a typed edge in `work_graph_edges`:

| Trigger | Edge |
|---|---|
| Message → "Create Task" | `task converted_from message` |
| Canvas sticky → "Create Task" | `task converted_from canvas_node` |
| Doc embeds a task | `task referenced_in doc_block` |
| AI detects a decision | `message decided_in thread` |

The Work Graph is queried by the AI layer to answer cross-workspace questions with full context and source citations.

### Database indexes

Indexes are placed on every:
- Foreign key column
- Composite query pattern (e.g. `workspaceId + status + deletedAt` for task filtering)
- Sort column with direction (`createdAt DESC`)
- Unique constraint candidate (slugs, emails, tokens)

### Background jobs

Redis BLPOP queue with:
- Up to 3 retry attempts with exponential backoff (200ms, 400ms, 800ms)
- Dead letter queue (`dlq:jobs:*`) for jobs that exceed max attempts
- Separate queues: `search-index`, `notifications`, `automations`, `email`

### Security

- **Helmet** — sets all recommended security headers
- **CORS** — allowlist-based, credentials supported
- **Input validation** — Zod on every route, 422 on failure
- **SQL injection** — impossible via Prisma's parameterised queries
- **XSS** — Content-Security-Policy via Helmet, React's default escaping
- **CSRF** — not applicable (stateless JWT, no cookie-based sessions)
- **Audit log** — append-only, covers all auth and admin actions
- **Soft deletes** — nothing is permanently deleted, enabling full audit trails

---

## API reference

### Authentication

All protected routes require: `Authorization: Bearer <accessToken>`

For mutations, add: `Idempotency-Key: <uuid>`

### Response shapes

**Success list:**
```json
{
  "data": [...],
  "meta": { "hasNextPage": true, "nextCursor": "...", "prevCursor": "...", "total": 42 }
}
```

**Error:**
```json
{
  "statusCode": 404,
  "error": "NOT_FOUND",
  "message": "User 'xyz' not found",
  "code": "NOT_FOUND",
  "requestId": "req-abc123"
}
```

### Rate limit headers

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 297
X-RateLimit-Reset: 1720000060
```

### WebSocket

Connect: `wss://api.collabos.io/v1/ws/workspace/:workspaceId`
Auth: `sec-websocket-protocol: <accessToken>`

Events: `message.created`, `message.updated`, `message.deleted`, `message.reaction`, `task.created`, `task.status_changed`, `task.deleted`, `task.comment_added`, `channel.created`, `canvas.node.created`, `canvas.node.moved`, `thread.reply_added`, `presence.updated`, `connected`, `ping`, `pong`

---

## Adding a new developer

1. Install Node.js 22+ and Docker
2. `git clone` + `npm install`
3. `cp .env.example .env`
4. `node scripts/generate-jwt-keys.mjs` — copy output to `.env`
5. Add any 32+ char string as `JWT_REFRESH_SECRET` in `.env`
6. `npm run docker:dev` — starts Postgres + Redis
7. `npm run db:migrate:dev` — creates all tables
8. `npm run db:seed` — populates test data
9. `npm run dev` — starts API on :3001 and Web on :3000
10. API docs: http://localhost:3001/docs
11. Login: alice@example.com / password123

Total time to first working session: **under 10 minutes**.

---

## Production deployment

### Environment

Copy `.env.example` to `.env.production`, fill all values including:
- Real RSA keypair (`node scripts/generate-jwt-keys.mjs`)
- `DATABASE_URL` pointing to production Postgres
- `REDIS_URL` with password (`redis://:password@host:6379`)
- `ANTHROPIC_API_KEY` for AI features
- `SENTRY_DSN` for error monitoring
- `S3_*` variables for file storage

### Deploy

```bash
# Build and push images
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -f docker/Dockerfile.api -t ghcr.io/your-org/collabos/api:$IMAGE_TAG .
docker build -f docker/Dockerfile.web -t ghcr.io/your-org/collabos/web:$IMAGE_TAG .
docker push ghcr.io/your-org/collabos/api:$IMAGE_TAG
docker push ghcr.io/your-org/collabos/web:$IMAGE_TAG

# On production server
export IMAGE_TAG=<sha>
export GITHUB_REPOSITORY=your-org/collabos
docker compose -f docker/docker-compose.prod.yml pull
docker compose -f docker/docker-compose.prod.yml up -d

# Verify
node scripts/health-check.mjs
```

Or use the GitHub Actions deploy workflow — push to `main` deploys to staging automatically, production requires manual approval.

---

## Plan limits

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Members | 3 | Unlimited | Unlimited | Unlimited |
| Message history | 90 days | Unlimited | Unlimited | Unlimited |
| Documents | 5 | Unlimited | Unlimited | Unlimited |
| Canvases | 3 | Unlimited | Unlimited | Unlimited |
| AI features | No | Yes | Yes | Yes |
| Automations | No | No | Yes | Yes |
| Storage | 5 GB | 100 GB | 1 TB | Unlimited |
| API rate limit | 60/min | 600/min | 1200/min | 6000/min |
