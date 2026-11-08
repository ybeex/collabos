/**
 * API key management for workspace integrations.
 * Keys are stored as SHA-256 hashes — the raw key is shown ONCE on creation.
 * Authentication: keys are passed as Bearer tokens and looked up by hash.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { createHash, randomBytes } from 'node:crypto'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { requireRole } from '../../middleware/auth.js'

const VALID_SCOPES = [
  'messages:read', 'messages:write',
  'channels:read', 'channels:write',
  'tasks:read', 'tasks:write',
  'docs:read', 'docs:write',
  'search:read',
  'ai:query',
  'workspace:read',
] as const

export type ApiKeyScope = (typeof VALID_SCOPES)[number]

export const hashApiKey = (key: string): string =>
  createHash('sha256').update(key).digest('hex')

export const apiKeyRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/apikeys ──────────────────────────────────────────────
  // BUG-6 fix: was an inline findUnique + role check duplicated across
  // 6+ route files. Now uses the shared requireRole middleware, reading
  // workspaceId from the query string as this endpoint always has.
  app.get('/', {
    preHandler: [requireRole('admin', 'query')],
    handler: async (req) => {
      const { workspaceId } = z.object({ workspaceId: z.string() }).parse(req.query)

      const keys = await app.db.apiKey.findMany({
        where: { workspaceId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, keyPrefix: true, scopes: true,
          lastUsedAt: true, expiresAt: true, createdAt: true,
          user: { select: { id: true, name: true } },
        },
      })

      return keys
    },
  })

  // ─── POST /v1/apikeys ─────────────────────────────────────────────
  // BUG-6 fix: requireRole('admin', 'body') reads workspaceId from the
  // raw parsed JSON body (available in preHandler — Fastify's body parser
  // runs before preHandler hooks), then the handler does its own Zod
  // .parse() as before for the full typed shape. No duplicated role check.
  app.post('/', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    preHandler: [requireRole('admin', 'body')],
    handler: async (req, reply) => {
      const userId = req.user.sub
      const body = z.object({
        workspaceId: z.string().min(1),
        name: z.string().min(1).max(100).trim(),
        scopes: z.array(z.enum(VALID_SCOPES)).min(1),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      }).parse(req.body)

      // Generate key: prefix (display) + full random key
      const rawKey = `csk_live_${randomBytes(32).toString('hex')}`
      const keyPrefix = rawKey.slice(0, 16)
      const keyHash = hashApiKey(rawKey)
      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86400 * 1000)
        : undefined

      const apiKey = await app.db.apiKey.create({
        data: {
          workspaceId: body.workspaceId,
          userId,
          name: body.name,
          keyHash,
          keyPrefix,
          scopes: body.scopes,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        },
        select: { id: true, name: true, keyPrefix: true, scopes: true, expiresAt: true, createdAt: true },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId: body.workspaceId,
          action: 'api_key.created',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { name: body.name, scopes: body.scopes },
        },
      })

      reply.status(201)
      return {
        ...apiKey,
        key: rawKey,
        warning: 'Store this key securely. It will not be shown again.',
      }
    },
  })

  // ─── DELETE /v1/apikeys/:keyId ────────────────────────────────────
  app.delete('/:keyId', {
    handler: async (req, reply) => {
      const { keyId } = req.params as { keyId: string }
      const userId = req.user.sub

      const key = await app.db.apiKey.findUnique({
        where: { id: keyId, revokedAt: null },
        select: { workspaceId: true, userId: true },
      })
      if (!key) throw new NotFoundError('API key')

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: key.workspaceId, userId } },
        select: { role: true },
      })
      const isOwner = key.userId === userId
      if (!isOwner && (!member || !['owner', 'admin'].includes(member.role))) {
        throw new ForbiddenError('Insufficient permissions')
      }

      await app.db.apiKey.update({
        where: { id: keyId },
        data: { revokedAt: new Date() },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId: key.workspaceId,
          action: 'api_key.revoked',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { keyId },
        },
      })

      reply.status(204).send()
    },
  })
}

// ─── API key authentication middleware ───────────────────────────────────────

export const apiKeyAuthMiddleware = async (
  req: Parameters<FastifyInstance['authenticate']>[0],
  _reply: Parameters<FastifyInstance['authenticate']>[1],
  db: FastifyInstance['db'],
): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer csk_live_')) return // not an API key — let JWT auth handle it

  const rawKey = authHeader.slice(7)
  const keyHash = hashApiKey(rawKey)

  // SEC-3 / SEC-4 fix: previously this query only selected workspaceId and
  // userId, and the plan/email attached to req.user were hardcoded
  // ('pro' / '') rather than looked up. That meant:
  //   SEC-3 — any API key, even one minted under a Free-plan workspace,
  //           silently passed any downstream `req.user.plan === 'pro'` gate.
  //   SEC-4 — every audit log entry and notification triggered by an
  //           API-key-driven request recorded an empty email, degrading
  //           the audit trail exactly where the highest-risk actor class
  //           (automation) is involved.
  // Fix: pull the real plan from the key's workspace and the real email
  // from the key's owning user, in the same round trip via Prisma's
  // relation include — no extra query needed.
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
      workspace: { select: { plan: true } },
      user: { select: { email: true } },
    },
  })

  if (!apiKey || apiKey.revokedAt) throw new ForbiddenError('Invalid API key')
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) throw new ForbiddenError('API key has expired')

  // Update lastUsedAt asynchronously (fire-and-forget — don't block the request)
  db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  // Attach user context — plan and email are now the REAL values, not
  // hardcoded placeholders, so any downstream plan-gated feature check or
  // audit log entry reflects reality.
  //
  // Super admin dashboard feature: isSuperAdmin is explicitly forced to
  // false here, always, regardless of whether the key's owning user is a
  // platform super admin. API keys are workspace-scoped credentials by
  // design (created for one workspace, carrying that workspace's plan) —
  // letting one transitively carry platform-wide authority would be a
  // privilege-escalation path through a credential type never meant to
  // hold that kind of power. Every requireSuperAdmin check in
  // routes/super-admin/index.ts is therefore unreachable via API key auth,
  // by construction, not just by convention.
  ;(req as typeof req & { apiKeyScopes: string[] }).apiKeyScopes = apiKey.scopes
  ;(req as typeof req & { user: { sub: string; email: string; plan: string; isSuperAdmin: boolean } }).user = {
    sub: apiKey.userId,
    email: apiKey.user.email,
    plan: apiKey.workspace.plan,
    isSuperAdmin: false,
  }
}
