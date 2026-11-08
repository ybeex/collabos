/**
 * SCIM 2.0 provisioning endpoint.
 * Allows enterprise identity providers (Okta, Azure AD, Entra) to
 * automatically create, update, and deactivate users.
 *
 * Security: SCIM endpoints use bearer tokens (separate from user JWTs).
 * Tokens are hashed with SHA-256 before storage — never stored in plaintext.
 *
 * Endpoints follow RFC 7644 (SCIM Protocol Specification):
 *   GET  /v1/scim/:workspaceId/Users       — list users
 *   GET  /v1/scim/:workspaceId/Users/:id   — get user
 *   POST /v1/scim/:workspaceId/Users       — provision new user
 *   PUT  /v1/scim/:workspaceId/Users/:id   — replace user
 *   PATCH /v1/scim/:workspaceId/Users/:id  — update user (deactivate etc)
 *   DELETE /v1/scim/:workspaceId/Users/:id — deprovision user
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto'
import { ForbiddenError, NotFoundError, ConflictError } from '../../utils/errors.js'
import { env } from '../../utils/env.js'
import { requireRole } from '../../middleware/auth.js'

const SCIM_CONTENT_TYPE = 'application/scim+json'

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

// Verify SCIM bearer token — timing-safe comparison
const verifyScimToken = async (
  app: FastifyInstance,
  workspaceId: string,
  authHeader: string | undefined,
): Promise<boolean> => {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const tokenHash = hashToken(token)

  const stored = await app.db.scimToken.findFirst({
    where: { workspaceId, revokedAt: null },
    select: { tokenHash: true },
  })

  if (!stored) return false

  try {
    return timingSafeEqual(
      Buffer.from(tokenHash, 'hex'),
      Buffer.from(stored.tokenHash, 'hex'),
    )
  } catch {
    return false
  }
}

const scimUser = (user: {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  deletedAt: Date | null
}, workspaceId: string) => ({
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
  id: user.id,
  externalId: user.email,
  userName: user.email,
  name: { formatted: user.name, displayName: user.name },
  emails: [{ value: user.email, primary: true }],
  photos: user.avatarUrl ? [{ value: user.avatarUrl, type: 'photo' }] : [],
  active: !user.deletedAt,
  meta: {
    resourceType: 'User',
    location: `${env.APP_URL}/api/v1/scim/${workspaceId}/Users/${user.id}`,
  },
})

export const scimRoutes = async (app: FastifyInstance): Promise<void> => {
  if (!env.ENABLE_SCIM) {
    app.all('/*', async () => ({ error: 'SCIM provisioning is disabled' }))
    return
  }

  // ── SCIM-protocol routes (IdP-facing, bearer-token authenticated) ─────────
  //
  // CRITICAL FIX: previously, `app.addHook('preHandler', scimAuth)` was
  // registered directly on `app` at this plugin's top level, which in
  // Fastify makes the hook apply to EVERY route subsequently registered in
  // this same plugin instance — including POST /:workspaceId/token below,
  // which is the admin-facing endpoint an operator uses to MINT the very
  // first SCIM token for a workspace.
  //
  // The result: that route required `preHandler: [app.authenticate]` (a
  // valid JWT) AND the globally-hooked scimAuth (a valid SCIM bearer
  // token) to both pass, since Fastify preHandlers compose rather than
  // override. But a brand-new workspace has no SCIM token yet — that's
  // exactly what this endpoint exists to create. The route was completely
  // unreachable for its actual purpose: bootstrapping SCIM. This was not
  // caught by the original audit's BUG-6 finding (duplicated role checks)
  // but was discovered while fixing it, since the duplicated inline role
  // check inside this same handler was the only thing standing in for an
  // auth layer that, in practice, could never be reached to run it.
  //
  // Fix: scope scimAuth to a child plugin context via app.register(),
  // which in Fastify creates an encapsulated boundary — hooks registered
  // inside only apply to routes registered inside that same child, not to
  // sibling routes registered on the parent `app` afterward.
  await app.register(async (scimProtocol) => {
    const scimAuth = async (
      req: Parameters<typeof app.authenticate>[0],
      _reply: Parameters<typeof app.authenticate>[1],
    ) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const valid = await verifyScimToken(scimProtocol, workspaceId, req.headers.authorization)
      if (!valid) throw new ForbiddenError('Invalid SCIM token')
    }

    scimProtocol.addHook('preHandler', scimAuth as never)

    // ─── GET /v1/scim/:workspaceId/Users ──────────────────────────────
    scimProtocol.get('/:workspaceId/Users', {
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const { startIndex = 1, count = 100, filter } = req.query as {
        startIndex?: number; count?: number; filter?: string
      }

      // Parse simple SCIM filter: userName eq "email@example.com"
      let emailFilter: string | undefined
      if (filter) {
        const match = filter.match(/userName\s+eq\s+"([^"]+)"/i)
        if (match?.[1]) emailFilter = match[1].toLowerCase()
      }

      const members = await app.db.workspaceMember.findMany({
        where: {
          workspaceId,
          status: 'active',
          ...(emailFilter ? { user: { email: emailFilter } } : {}),
        },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, deletedAt: true } } },
        skip: startIndex - 1,
        take: Math.min(count, 100),
      })

      const total = await app.db.workspaceMember.count({ where: { workspaceId, status: 'active' } })

      reply.header('Content-Type', SCIM_CONTENT_TYPE)
      return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: total,
        startIndex,
        itemsPerPage: members.length,
        Resources: members.map((m) => scimUser(m.user, workspaceId)),
      }
    },
  })

  // ─── GET /v1/scim/:workspaceId/Users/:userId ──────────────────────
  scimProtocol.get('/:workspaceId/Users/:userId', {
    handler: async (req, reply) => {
      const { workspaceId, userId } = req.params as { workspaceId: string; userId: string }

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, deletedAt: true } } },
      })

      if (!member) throw new NotFoundError('User')
      reply.header('Content-Type', SCIM_CONTENT_TYPE)
      return scimUser(member.user, workspaceId)
    },
  })

  // ─── POST /v1/scim/:workspaceId/Users ─────────────────────────────
  scimProtocol.post('/:workspaceId/Users', {
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const body = req.body as {
        userName?: string
        emails?: Array<{ value: string; primary?: boolean }>
        name?: { formatted?: string; displayName?: string }
        active?: boolean
      }

      const email = (body.userName ?? body.emails?.find((e) => e.primary)?.value ?? '').toLowerCase().trim()
      const name = body.name?.formatted ?? body.name?.displayName ?? email.split('@')[0] ?? 'User'

      if (!email) throw new Error('userName or primary email required')

      // Check for existing user
      const existing = await app.db.user.findUnique({
        where: { email },
        select: { id: true, deletedAt: true },
      })

      let userId: string

      if (existing) {
        if (existing.deletedAt) {
          // Reactivate
          await app.db.user.update({ where: { id: existing.id }, data: { deletedAt: null } })
        }
        userId = existing.id
      } else {
        const user = await app.db.user.create({
          data: {
            id: nanoid(21),
            email,
            name,
            passwordHash: `scim:${workspaceId}:${randomBytes(32).toString('hex')}`,
            plan: 'pro',
          },
        })
        userId = user.id
      }

      // Provision workspace membership
      const alreadyMember = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      })

      if (alreadyMember) throw new ConflictError(`User ${email} is already a member`)

      await app.db.workspaceMember.create({
        data: { id: nanoid(21), workspaceId, userId, role: 'member', status: 'active' },
      })

      const user = await app.db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatarUrl: true, deletedAt: true },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId,
          action: 'scim.user_provisioned',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { email, source: 'scim' },
        },
      })

      reply.status(201).header('Content-Type', SCIM_CONTENT_TYPE)
      return scimUser(user!, workspaceId)
    },
  })

  // ─── PATCH /v1/scim/:workspaceId/Users/:userId ────────────────────
  // Handles activate/deactivate operations from IdP
  scimProtocol.patch('/:workspaceId/Users/:userId', {
    handler: async (req, reply) => {
      const { workspaceId, userId } = req.params as { workspaceId: string; userId: string }
      const body = req.body as { Operations?: Array<{ op: string; path?: string; value: unknown }> }

      const ops = body.Operations ?? []

      for (const op of ops) {
        const opLower = op.op.toLowerCase()
        if (opLower === 'replace' || opLower === 'add') {
          const value = op.value as Record<string, unknown>

          // Deactivation: active = false
          if (op.path === 'active' || value['active'] !== undefined) {
            const active = op.path === 'active' ? op.value as boolean : value['active'] as boolean

            if (!active) {
              // Deactivate: suspend workspace membership
              await app.db.workspaceMember.updateMany({
                where: { workspaceId, userId },
                data: { status: 'suspended' },
              })
              await app.db.user.update({
                where: { id: userId },
                data: { deletedAt: new Date() },
              })
            } else {
              // Reactivate
              await app.db.workspaceMember.updateMany({
                where: { workspaceId, userId },
                data: { status: 'active' },
              })
              await app.db.user.update({
                where: { id: userId },
                data: { deletedAt: null },
              })
            }
          }

          // Name update
          if (value['name']) {
            const nameVal = value['name'] as Record<string, string>
            const newName = nameVal['formatted'] ?? nameVal['displayName']
            if (newName) {
              await app.db.user.update({ where: { id: userId }, data: { name: newName } })
            }
          }
        }
      }

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, deletedAt: true } } },
      })

      if (!member) throw new NotFoundError('User')
      reply.header('Content-Type', SCIM_CONTENT_TYPE)
      return scimUser(member.user, workspaceId)
    },
  })

  // ─── DELETE /v1/scim/:workspaceId/Users/:userId ───────────────────
  scimProtocol.delete('/:workspaceId/Users/:userId', {
    handler: async (req, reply) => {
      const { workspaceId, userId } = req.params as { workspaceId: string; userId: string }

      await app.db.workspaceMember.updateMany({
        where: { workspaceId, userId },
        data: { status: 'left' },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId,
          action: 'scim.user_deprovisioned',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { source: 'scim' },
        },
      })

      reply.status(204).send()
    },
  })
  }) // ← closes the scimProtocol child plugin block; everything below this
     //   point is registered on the parent `app` and is NOT subject to the
     //   scimAuth hook above — this is what makes the token route reachable.

  // ─── POST /v1/scim/:workspaceId/token ─────────────────────────────
  // Admin-only: generate SCIM provisioning token. Authenticated by JWT
  // (app.authenticate) + workspace role (requireRole), NOT by the SCIM
  // bearer-token scheme used by the IdP-facing routes above — this route
  // is how an admin MINTS the first SCIM token, so it cannot itself
  // require one. BUG-6 fix: duplicated inline role check replaced with
  // the shared requireRole middleware (workspaceId comes from req.params
  // here, which is requireRole's default source).
  app.post('/:workspaceId/token', {
    preHandler: [app.authenticate, requireRole('admin', 'params')],
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub

      const body = z.object({ description: z.string().min(1).max(100) }).parse(req.body)

      // Revoke existing tokens
      await app.db.scimToken.updateMany({
        where: { workspaceId, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      const rawToken = `scim_${randomBytes(32).toString('hex')}`
      const tokenHash = hashToken(rawToken)

      await app.db.scimToken.create({
        data: { workspaceId, tokenHash, description: body.description },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId,
          action: 'scim.token_generated',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { description: body.description },
        },
      })

      reply.status(201)
      // Return raw token ONCE — never stored in plaintext
      return {
        token: rawToken,
        warning: 'Save this token securely. It will not be shown again.',
        scimBaseUrl: `${env.APP_URL}/api/v1/scim/${workspaceId}`,
      }
    },
  })
}
