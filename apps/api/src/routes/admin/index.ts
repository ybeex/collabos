import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ForbiddenError } from '../../utils/errors.js'
import { AuditService } from '../../services/audit.js'
import { buildPaginatedResult, decodeCursor } from '../../utils/cursor.js'

export const adminRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  const requireAdmin = async (req: Parameters<typeof app.authenticate>[0]): Promise<void> => {
    const { workspaceId } = req.params as { workspaceId: string }
    const member = await app.db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.sub } },
      select: { role: true, status: true },
    })
    if (!member || member.status !== 'active' || !['admin', 'owner'].includes(member.role)) {
      throw new ForbiddenError('Admin role required')
    }
  }

  app.get('/:workspaceId/overview', {
    preHandler: [requireAdmin as never],
    handler: async (req) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const [members, channels, tasks, docs, messages] = await Promise.all([
        app.db.workspaceMember.count({ where: { workspaceId, status: 'active' } }),
        app.db.channel.count({ where: { workspaceId, deletedAt: null } }),
        app.db.task.count({ where: { workspaceId, deletedAt: null } }),
        app.db.document.count({ where: { workspaceId, deletedAt: null } }),
        app.db.message.count({ where: { channel: { workspaceId }, deletedAt: null, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      ])
      const tasksByStatus = await app.db.task.groupBy({ by: ['status'], where: { workspaceId, deletedAt: null }, _count: { status: true } })
      return { members, channels, tasks, docs, messagesLast30Days: messages, tasksByStatus: tasksByStatus.map((t) => ({ status: t.status, count: t._count.status })) }
    },
  })

  app.get('/:workspaceId/audit-log', {
    preHandler: [requireAdmin as never],
    handler: async (req) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const { cursor, limit } = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query)
      return new AuditService(app.db).getForWorkspace(workspaceId, limit, cursor)
    },
  })

  app.patch('/:workspaceId/members/:userId', {
    preHandler: [requireAdmin as never],
    handler: async (req, reply) => {
      const { workspaceId, userId: targetId } = req.params as { workspaceId: string; userId: string }
      const body = z.object({ role: z.enum(['member', 'admin']).optional(), status: z.enum(['active', 'suspended']).optional() }).parse(req.body)
      const target = await app.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetId } }, select: { role: true } })
      if (target?.role === 'owner') throw new ForbiddenError('Cannot modify workspace owner')
      const updated = await app.db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: targetId } },
        data: {
          ...(body.role !== undefined ? { role: body.role } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      })
      await app.db.auditLog.create({ data: { id: nanoid(21), userId: req.user.sub, workspaceId, action: 'admin.member_updated', ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? '', metadata: { targetId, changes: body } } })
      await app.redis.del(`workspace:${workspaceId}:members`)
      reply.status(200)
      return updated
    },
  })

  app.delete('/:workspaceId/members/:userId', {
    preHandler: [requireAdmin as never],
    handler: async (req, reply) => {
      const { workspaceId, userId: targetId } = req.params as { workspaceId: string; userId: string }
      const target = await app.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetId } }, select: { role: true } })
      if (target?.role === 'owner') throw new ForbiddenError('Cannot remove workspace owner')
      await app.db.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: targetId } }, data: { status: 'left' } })
      await app.db.auditLog.create({ data: { id: nanoid(21), userId: req.user.sub, workspaceId, action: 'admin.member_removed', ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? '', metadata: { targetId } } })
      await app.redis.del(`workspace:${workspaceId}:members`)
      reply.status(204).send()
    },
  })

  app.get('/:workspaceId/members', {
    preHandler: [requireAdmin as never],
    handler: async (req) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const { cursor, limit, status } = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50), status: z.enum(['active', 'suspended', 'invited', 'left']).optional() }).parse(req.query)
      let cursorCondition = {}
      if (cursor) { const decoded = decodeCursor(cursor); cursorCondition = { cursor: { id: decoded['id'] as string }, skip: 1 } }
      const members = await app.db.workspaceMember.findMany({ where: { workspaceId, ...(status ? { status } : {}) }, ...cursorCondition, take: limit + 1, orderBy: { joinedAt: 'asc' }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, plan: true } } } })
      return buildPaginatedResult(members, limit, (m) => ({ id: m.id }))
    },
  })
}
