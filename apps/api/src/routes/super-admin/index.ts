/**
 * Super admin platform dashboard routes.
 *
 * Deliberately registered at a completely separate prefix (/v1/super-admin)
 * from the workspace-scoped admin routes (/v1/admin). Every route here
 * requires the platform-wide isSuperAdmin flag, NOT any workspace role —
 * a workspace owner has zero authority here by default, and a super admin
 * has authority here regardless of which (if any) workspaces they belong
 * to. See middleware/super-admin.ts for the two-tier (fast JWT-claim /
 * strict DB-reverified) authorization model and why both exist.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js'
import { requireSuperAdmin, requireSuperAdminVerified } from '../../middleware/super-admin.js'
import { buildPaginatedResult, decodeCursor } from '../../utils/cursor.js'
import { publishForceDisconnect } from '../ws/index.js'
import type { SuperAdminAction } from '@prisma/client'

const logSuperAdminAction = async (
  app: FastifyInstance,
  // Bug fix (found via tsc): this minimal duck-type only needs `.ip` and
  // `.headers['user-agent']`. Node's real IncomingHttpHeaders has
  // 'user-agent' as an OPTIONAL property whose value, when present, may
  // be undefined — i.e. `'user-agent'?: string | undefined`, not just
  // one or the other. Matching that exactly (both the optionality and
  // the possible-undefined value) is what satisfies this project's
  // exactOptionalPropertyTypes against a real FastifyRequest.
  req: { ip: string; headers: { 'user-agent'?: string | undefined } },
  actorId: string,
  actorEmail: string,
  action: SuperAdminAction,
  opts: { targetWorkspaceId?: string; targetUserId?: string; metadata?: Record<string, unknown> } = {},
): Promise<void> => {
  await app.db.superAdminAuditLog.create({
    data: {
      id: nanoid(21),
      actorId,
      actorEmail,
      action,
      ...(opts.targetWorkspaceId !== undefined ? { targetWorkspaceId: opts.targetWorkspaceId } : {}),
      ...(opts.targetUserId !== undefined ? { targetUserId: opts.targetUserId } : {}),
      metadata: (opts.metadata ?? {}) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? '',
    },
  })
}

export const superAdminRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)
  app.addHook('preHandler', requireSuperAdmin)

  // ─── GET /v1/super-admin/overview ──────────────────────────────────
  // Platform-wide health snapshot. Read-only — fast-path auth is fine.
  app.get('/overview', {
    handler: async () => {
      const [
        totalUsers,
        totalWorkspaces,
        activeWorkspaces,
        suspendedWorkspaces,
        usersByPlan,
        workspacesByPlan,
        messagesLast24h,
        newUsersLast7Days,
        superAdminCount,
      ] = await Promise.all([
        app.db.user.count({ where: { deletedAt: null } }),
        app.db.workspace.count({ where: { deletedAt: null } }),
        app.db.workspace.count({ where: { deletedAt: null, suspendedAt: null } }),
        app.db.workspace.count({ where: { deletedAt: null, suspendedAt: { not: null } } }),
        app.db.user.groupBy({ by: ['plan'], where: { deletedAt: null }, _count: true }),
        app.db.workspace.groupBy({ by: ['plan'], where: { deletedAt: null }, _count: true }),
        app.db.message.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, deletedAt: null } }),
        app.db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
        app.db.user.count({ where: { isSuperAdmin: true, deletedAt: null } }),
      ])

      return {
        totalUsers,
        totalWorkspaces,
        activeWorkspaces,
        suspendedWorkspaces,
        usersByPlan: usersByPlan.map((g: { plan: string; _count: number }) => ({ plan: g.plan, count: g._count })),
        workspacesByPlan: workspacesByPlan.map((g: { plan: string; _count: number }) => ({ plan: g.plan, count: g._count })),
        messagesLast24h,
        newUsersLast7Days,
        superAdminCount,
      }
    },
  })

  // ─── GET /v1/super-admin/workspaces ─────────────────────────────────
  app.get('/workspaces', {
    handler: async (req) => {
      const { cursor, limit = 30, search, plan, status } = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        search: z.string().optional(),
        plan: z.enum(['free', 'pro', 'business', 'enterprise']).optional(),
        status: z.enum(['active', 'suspended', 'deleted']).optional(),
      }).parse(req.query)

      let cursorCondition = {}
      if (cursor) {
        const decoded = decodeCursor(cursor)
        cursorCondition = { cursor: { id: decoded['id'] as string }, skip: 1 }
      }

      const where = {
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search, mode: 'insensitive' as const } }] } : {}),
        ...(plan ? { plan } : {}),
        ...(status === 'active' ? { deletedAt: null, suspendedAt: null } : {}),
        ...(status === 'suspended' ? { deletedAt: null, suspendedAt: { not: null } } : {}),
        ...(status === 'deleted' ? { deletedAt: { not: null } } : {}),
        ...(status === undefined ? { deletedAt: null } : {}),
      }

      const workspaces = await app.db.workspace.findMany({
        where,
        ...cursorCondition,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, slug: true, plan: true, createdAt: true,
          suspendedAt: true, suspendedReason: true, deletedAt: true,
          ownerId: true,
          _count: { select: { members: true, channels: true } },
        },
      })

      // Fetch owner details for all workspaces in one query
      const ownerIds = [...new Set(workspaces.map((w) => w.ownerId))]
      const owners = await app.db.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
      const ownerMap = new Map(owners.map((o) => [o.id, o]))

      const workspacesWithOwner = workspaces.map((w) => ({
        ...w,
        owner: ownerMap.get(w.ownerId) ?? null,
      }))

      return buildPaginatedResult(workspacesWithOwner, limit, (w: { id: string }) => ({ id: w.id }))
    },
  })

  // ─── GET /v1/super-admin/workspaces/:workspaceId ───────────────────
  app.get('/workspaces/:workspaceId', {
    handler: async (req) => {
      const { workspaceId } = req.params as { workspaceId: string }

      const workspace = await app.db.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          _count: { select: { members: true, channels: true, documents: true, tasks: true, canvases: true } },
        },
      })

      if (!workspace) throw new NotFoundError('Workspace')

      const ownerInfo = await app.db.user.findUnique({
        where: { id: workspace.ownerId },
        select: { id: true, name: true, email: true },
      })

      const recentActivity = await app.db.message.count({
        where: { channel: { workspaceId }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      })

      return { ...workspace, owner: ownerInfo, recentActivityLast7Days: recentActivity }
    },
  })

  // ─── POST /v1/super-admin/workspaces/:workspaceId/suspend ──────────
  // Destructive — strict DB-reverified auth, not the fast JWT-claim path.
  app.post('/workspaces/:workspaceId/suspend', {
    preHandler: [requireSuperAdminVerified],
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const { reason } = z.object({ reason: z.string().min(1).max(500) }).parse(req.body)
      const actor = req.user as { sub: string; email: string }

      const workspace = await app.db.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, suspendedAt: true, deletedAt: true },
      })
      if (!workspace || workspace.deletedAt) throw new NotFoundError('Workspace')
      if (workspace.suspendedAt) throw new ConflictError('Workspace is already suspended')

      await app.db.workspace.update({
        where: { id: workspaceId },
        data: { suspendedAt: new Date(), suspendedReason: reason, suspendedById: actor.sub },
      })

      // Immediately disconnect every currently-connected client across
      // every API replica — see routes/ws/index.ts publishForceDisconnect
      // for why this is necessary beyond the connect-time check alone.
      await publishForceDisconnect(app, workspaceId, `Workspace suspended: ${reason}`)

      await logSuperAdminAction(app, req, actor.sub, actor.email, 'workspace_suspended', {
        targetWorkspaceId: workspaceId,
        metadata: { reason },
      })

      reply.status(200)
      return { message: 'Workspace suspended', suspendedAt: new Date().toISOString() }
    },
  })

  // ─── POST /v1/super-admin/workspaces/:workspaceId/reactivate ───────
  app.post('/workspaces/:workspaceId/reactivate', {
    preHandler: [requireSuperAdminVerified],
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const actor = req.user as { sub: string; email: string }

      const workspace = await app.db.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, suspendedAt: true },
      })
      if (!workspace) throw new NotFoundError('Workspace')
      if (!workspace.suspendedAt) throw new ConflictError('Workspace is not suspended')

      await app.db.workspace.update({
        where: { id: workspaceId },
        data: { suspendedAt: null, suspendedReason: null, suspendedById: null },
      })

      await logSuperAdminAction(app, req, actor.sub, actor.email, 'workspace_reactivated', {
        targetWorkspaceId: workspaceId,
      })

      reply.status(200)
      return { message: 'Workspace reactivated' }
    },
  })

  // ─── PATCH /v1/super-admin/workspaces/:workspaceId/plan ────────────
  app.patch('/workspaces/:workspaceId/plan', {
    preHandler: [requireSuperAdminVerified],
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const { plan } = z.object({ plan: z.enum(['free', 'pro', 'business', 'enterprise']) }).parse(req.body)
      const actor = req.user as { sub: string; email: string }

      const workspace = await app.db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, plan: true } })
      if (!workspace) throw new NotFoundError('Workspace')

      await app.db.workspace.update({ where: { id: workspaceId }, data: { plan } })
      await app.redis.del(`workspace:${workspaceId}:meta`) // invalidate cache (see plugins/cache.ts cacheKeys.workspace)

      await logSuperAdminAction(app, req, actor.sub, actor.email, 'workspace_plan_changed', {
        targetWorkspaceId: workspaceId,
        metadata: { fromPlan: workspace.plan, toPlan: plan },
      })

      reply.status(200)
      return { message: 'Plan updated', plan }
    },
  })

  // ─── GET /v1/super-admin/users ──────────────────────────────────────
  app.get('/users', {
    handler: async (req) => {
      const { cursor, limit = 30, search, status } = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        search: z.string().optional(),
        status: z.enum(['active', 'suspended', 'deleted']).optional(),
      }).parse(req.query)

      let cursorCondition = {}
      if (cursor) {
        const decoded = decodeCursor(cursor)
        cursorCondition = { cursor: { id: decoded['id'] as string }, skip: 1 }
      }

      const where = {
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}),
        ...(status === 'active' ? { deletedAt: null, lockedUntil: null } : {}),
        ...(status === 'suspended' ? { lockedUntil: { not: null }, deletedAt: null } : {}),
        ...(status === 'deleted' ? { deletedAt: { not: null } } : {}),
        ...(status === undefined ? {} : {}),
      }

      const users = await app.db.user.findMany({
        where,
        ...cursorCondition,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, plan: true, isSuperAdmin: true,
          lockedUntil: true, deletedAt: true, createdAt: true,
          _count: { select: { workspaceMembers: true } },
        },
      })

      return buildPaginatedResult(users, limit, (u: { id: string }) => ({ id: u.id }))
    },
  })

  // ─── GET /v1/super-admin/users/:userId ─────────────────────────────
  app.get('/users/:userId', {
    handler: async (req) => {
      const { userId } = req.params as { userId: string }

      const user = await app.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, email: true, plan: true, isSuperAdmin: true,
          lockedUntil: true, deletedAt: true, createdAt: true, timezone: true,
          workspaceMembers: {
            select: { role: true, status: true, workspace: { select: { id: true, name: true, slug: true } } },
          },
        },
      })

      if (!user) throw new NotFoundError('User')
      return user
    },
  })

  // ─── POST /v1/super-admin/users/:userId/suspend ────────────────────
  app.post('/users/:userId/suspend', {
    preHandler: [requireSuperAdminVerified],
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { userId } = req.params as { userId: string }
      const { reason } = z.object({ reason: z.string().min(1).max(500) }).parse(req.body)
      const actor = req.user as { sub: string; email: string }

      if (userId === actor.sub) throw new ForbiddenError('Cannot suspend your own account')

      const targetUser = await app.db.user.findUnique({ where: { id: userId }, select: { id: true, isSuperAdmin: true, deletedAt: true } })
      if (!targetUser || targetUser.deletedAt) throw new NotFoundError('User')

      // A super admin cannot be suspended through this endpoint — that
      // would let one super admin silently disable another's account
      // without going through the explicit, logged super_admin_revoked
      // action below, which is the correct path for removing a peer's
      // authority. This isn't a permissions gap; it's forcing the
      // intentional action to go through its own explicit, more visible
      // endpoint rather than a generic "suspend" that could mask it.
      if (targetUser.isSuperAdmin) {
        throw new ForbiddenError('Revoke super admin access first via /users/:userId/super-admin')
      }

      // 100-year lock — effectively indefinite, reversible via reactivate
      await app.db.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) },
      })

      await logSuperAdminAction(app, req, actor.sub, actor.email, 'user_suspended', {
        targetUserId: userId,
        metadata: { reason },
      })

      reply.status(200)
      return { message: 'User suspended' }
    },
  })

  // ─── POST /v1/super-admin/users/:userId/reactivate ─────────────────
  app.post('/users/:userId/reactivate', {
    preHandler: [requireSuperAdminVerified],
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { userId } = req.params as { userId: string }
      const actor = req.user as { sub: string; email: string }

      const targetUser = await app.db.user.findUnique({ where: { id: userId }, select: { id: true } })
      if (!targetUser) throw new NotFoundError('User')

      await app.db.user.update({ where: { id: userId }, data: { lockedUntil: null } })

      await logSuperAdminAction(app, req, actor.sub, actor.email, 'user_reactivated', { targetUserId: userId })

      reply.status(200)
      return { message: 'User reactivated' }
    },
  })

  // ─── POST /v1/super-admin/users/:userId/super-admin ────────────────
  // Grant or revoke super admin access. The single most sensitive action
  // in this entire route file — strict re-verified auth, tightly rate
  // limited, and self-modification is explicitly blocked in both
  // directions (cannot grant yourself further authority you already
  // have, cannot revoke your own — a locked-out super admin requires a
  // DIFFERENT super admin or direct DB access to restore, by design, so
  // that one compromised session can't permanently lock out everyone
  // else AND can't be undone by the same compromised session either).
  app.post('/users/:userId/super-admin', {
    preHandler: [requireSuperAdminVerified],
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { userId } = req.params as { userId: string }
      const { grant } = z.object({ grant: z.boolean() }).parse(req.body)
      const actor = req.user as { sub: string; email: string }

      if (userId === actor.sub) {
        throw new ForbiddenError('Cannot change your own super admin status')
      }

      const targetUser = await app.db.user.findUnique({ where: { id: userId }, select: { id: true, isSuperAdmin: true, deletedAt: true } })
      if (!targetUser || targetUser.deletedAt) throw new NotFoundError('User')
      if (targetUser.isSuperAdmin === grant) {
        throw new ConflictError(grant ? 'User is already a super admin' : 'User is not a super admin')
      }

      await app.db.user.update({ where: { id: userId }, data: { isSuperAdmin: grant } })

      await logSuperAdminAction(
        app, req, actor.sub, actor.email,
        grant ? 'super_admin_granted' : 'super_admin_revoked',
        { targetUserId: userId },
      )

      reply.status(200)
      return { message: grant ? 'Super admin access granted' : 'Super admin access revoked' }
    },
  })

  // ─── GET /v1/super-admin/audit-log ──────────────────────────────────
  // The platform audit log itself — append-only, never filtered by the
  // viewing super admin's own actions (every super admin sees everything,
  // including actions taken by other super admins, including against
  // their own account).
  app.get('/audit-log', {
    handler: async (req) => {
      const { cursor, limit = 50, action, targetWorkspaceId, targetUserId } = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        action: z.string().optional(),
        targetWorkspaceId: z.string().optional(),
        targetUserId: z.string().optional(),
      }).parse(req.query)

      let cursorCondition = {}
      if (cursor) {
        const decoded = decodeCursor(cursor)
        cursorCondition = { cursor: { id: decoded['id'] as string }, skip: 1 }
      }

      const entries = await app.db.superAdminAuditLog.findMany({
        where: {
          ...(action ? { action: action as SuperAdminAction } : {}),
          ...(targetWorkspaceId ? { targetWorkspaceId } : {}),
          ...(targetUserId ? { targetUserId } : {}),
        },
        ...cursorCondition,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
      })

      return buildPaginatedResult(entries, limit, (e: { id: string }) => ({ id: e.id }))
    },
  })
}
