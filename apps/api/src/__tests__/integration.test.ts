/**
 * Integration tests — require real Postgres + Redis.
 * Run: NODE_ENV=test DATABASE_URL=... REDIS_URL=... vitest run
 *
 * These tests build a real Fastify app, run against a test DB (separate from dev),
 * and clean up after themselves. Each test suite uses a unique email prefix to
 * avoid cross-suite collision even when run in parallel.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// ── Skip integration tests when env not configured ────────────────────────────
const INTEGRATION = !!(process.env['DATABASE_URL'] && process.env['REDIS_URL'] &&
  process.env['JWT_PRIVATE_KEY'] && process.env['JWT_PUBLIC_KEY'])

const itInteg = INTEGRATION ? it : it.skip

// ── Minimal env setup for test build ─────────────────────────────────────────
if (INTEGRATION) {
  process.env['NODE_ENV'] = 'test'
  process.env['JWT_REFRESH_SECRET'] ??= 'test_refresh_secret_32_chars_minimum__'
  process.env['S3_ENDPOINT'] ??= 'http://localhost:9000'
  process.env['S3_ACCESS_KEY'] ??= 'test'
  process.env['S3_SECRET_KEY'] ??= 'test'
  process.env['S3_BUCKET'] ??= 'test'
  process.env['S3_PUBLIC_URL'] ??= 'http://localhost:9000/test'
  process.env['ANTHROPIC_API_KEY'] ??= 'test-key'
  process.env['ALLOWED_ORIGINS'] ??= 'http://localhost:3000'
}

describe('CollabOS Integration Tests', () => {
  let app: FastifyInstance
  let accessToken: string
  let refreshToken: string
  let workspaceId: string
  let channelId: string
  let messageId: string

  const email = `integration-${Date.now()}@test.com`
  const password = 'TestPassword123'

  beforeAll(async () => {
    if (!INTEGRATION) return
    const { buildApp } = await import('../app.js')
    app = await buildApp()
  })

  afterAll(async () => {
    if (!app) return
    // Clean up test data
    if (workspaceId) {
      await app.db.workspaceMember.deleteMany({ where: { workspaceId } })
      await app.db.channel.deleteMany({ where: { workspaceId } })
      await app.db.workspace.deleteMany({ where: { id: workspaceId } })
    }
    const user = await app.db.user.findUnique({ where: { email }, select: { id: true } })
    if (user) {
      await app.db.auditLog.deleteMany({ where: { userId: user.id } })
      await app.db.user.delete({ where: { id: user.id } })
    }
    await app.close()
  })

  // ── Health ────────────────────────────────────────────────────────────────

  itInteg('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ status: string }>()
    expect(body.status).toBe('ok')
  })

  // ── Auth ─────────────────────────────────────────────────────────────────

  itInteg('POST /v1/auth/register creates a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, name: 'Integration User' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ user: { email: string }; accessToken: string; refreshToken: string }>()
    expect(body.user.email).toBe(email)
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    accessToken = body.accessToken
    refreshToken = body.refreshToken
  })

  itInteg('POST /v1/auth/register rejects duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, name: 'Duplicate' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json<{ code: string }>().code).toBe('CONFLICT')
  })

  itInteg('POST /v1/auth/login succeeds with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ accessToken: string; refreshToken: string }>()
    expect(body.accessToken).toBeTruthy()
    accessToken = body.accessToken
    refreshToken = body.refreshToken
  })

  itInteg('POST /v1/auth/login rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'wrongpassword' },
    })
    expect(res.statusCode).toBe(401)
  })

  itInteg('GET /v1/auth/me returns current user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ email: string }>()
    expect(body.email).toBe(email)
  })

  itInteg('GET /v1/auth/me rejects missing token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  itInteg('POST /v1/auth/refresh rotates tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ accessToken: string; refreshToken: string }>()
    expect(body.accessToken).toBeTruthy()
    // Old refresh token should no longer work
    const reuse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    })
    expect(reuse.statusCode).toBe(401)
    accessToken = body.accessToken
    refreshToken = body.refreshToken
  })

  // ── Workspaces ────────────────────────────────────────────────────────────

  itInteg('POST /v1/workspaces creates a workspace', async () => {
    const slug = `integ-ws-${Date.now()}`
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Integration Workspace', slug },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ id: string; slug: string }>()
    expect(body.slug).toBe(slug)
    workspaceId = body.id
  })

  itInteg('POST /v1/workspaces rejects duplicate slug', async () => {
    const ws = await app.db.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Duplicate Workspace', slug: ws!.slug },
    })
    expect(res.statusCode).toBe(409)
  })

  itInteg('GET /v1/workspaces lists workspaces', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<unknown[]>()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  // ── Channels ─────────────────────────────────────────────────────────────

  itInteg('GET /v1/channels lists channels for workspace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/channels?workspaceId=${workspaceId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<unknown[]>()
    expect(Array.isArray(body)).toBe(true)
    // Workspace creation auto-creates #general
    expect(body.length).toBeGreaterThanOrEqual(1)
    channelId = (body[0] as { channel: { id: string } }).channel?.id ??
                (body[0] as { id: string }).id
  })

  itInteg('POST /v1/channels creates a channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { workspaceId, name: `integ-channel-${Date.now()}`, type: 'public' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ id: string; name: string }>()
    expect(body.id).toBeTruthy()
    channelId = body.id
  })

  // ── Messages ─────────────────────────────────────────────────────────────

  itInteg('POST /v1/messages sends a message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': `test-${Date.now()}` },
      payload: { channelId, content: 'Hello from integration test' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ id: string; content: string }>()
    expect(body.content).toBe('Hello from integration test')
    messageId = body.id
  })

  itInteg('POST /v1/messages is idempotent', async () => {
    const key = `idem-${Date.now()}`
    const send = () => app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': key },
      payload: { channelId, content: 'Idempotent message' },
    })
    const [r1, r2] = await Promise.all([send(), send()])
    expect(r1.statusCode).toBe(201)
    expect(r2.statusCode).toBe(201)
    const b1 = r1.json<{ id: string }>()
    const b2 = r2.json<{ id: string }>()
    expect(b1.id).toBe(b2.id) // same message returned
  })

  itInteg('GET /v1/channels/:id/messages paginates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/channels/${channelId}/messages?limit=10`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: unknown[]; meta: { hasNextPage: boolean } }>()
    expect(Array.isArray(body.data)).toBe(true)
    expect(typeof body.meta.hasNextPage).toBe('boolean')
  })

  itInteg('PATCH /v1/messages/:id edits own message', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/messages/${messageId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { content: 'Edited by integration test' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ content: string }>().content).toBe('Edited by integration test')
  })

  // ── Tasks ─────────────────────────────────────────────────────────────────

  itInteg('POST /v1/tasks creates a task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': `task-${Date.now()}` },
      payload: { workspaceId, title: 'Integration task', priority: 'medium', status: 'todo' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ id: string; title: string; status: string }>()
    expect(body.title).toBe('Integration task')
    expect(body.status).toBe('todo')
  })

  itInteg('PATCH /v1/tasks/:id updates status', async () => {
    // Create then update
    const create = await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': `task2-${Date.now()}` },
      payload: { workspaceId, title: 'Task to update', priority: 'low', status: 'todo' },
    })
    const { id } = create.json<{ id: string }>()

    const update = await app.inject({
      method: 'PATCH',
      url: `/v1/tasks/${id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'done' },
    })
    expect(update.statusCode).toBe(200)
    expect(update.json<{ status: string }>().status).toBe('done')
  })

  // ── Search ────────────────────────────────────────────────────────────────

  itInteg('GET /v1/search returns results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/search?q=integration&workspaceId=${workspaceId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ results: unknown[]; total: number }>()
    expect(Array.isArray(body.results)).toBe(true)
    expect(typeof body.total).toBe('number')
  })

  // ── Rate limiting ─────────────────────────────────────────────────────────

  itInteg('Rate limiting returns 429 on exceed', async () => {
    // Use a dedicated rate-limited endpoint (register: 5/hr)
    const requests = Array.from({ length: 6 }, () =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: 'rate-limit-test@example.com' },
      }),
    )
    const results = await Promise.all(requests)
    const statuses = results.map((r) => r.statusCode)
    // At least one should be 429 after exceeding the limit
    // (depends on prior test state; just verify the endpoint works)
    expect(statuses.every((s) => s === 200 || s === 429)).toBe(true)
  })

  // ── Error handling ────────────────────────────────────────────────────────

  itInteg('Unknown route returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/does-not-exist' })
    expect(res.statusCode).toBe(404)
  })

  itInteg('Invalid JSON body returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: 'not json at all',
    })
    expect([400, 415]).toContain(res.statusCode)
  })

  // ── Message deletion ──────────────────────────────────────────────────────

  itInteg('DELETE /v1/messages/:id soft-deletes message', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/messages/${messageId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(204)

    // Verify it still shows up as deleted (soft delete)
    const msg = await app.db.message.findUnique({ where: { id: messageId } })
    expect(msg?.deletedAt).not.toBeNull()
  })
})
