import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ForbiddenError } from '../../utils/errors.js'
import { buildPaginatedResult, decodeCursor } from '../../utils/cursor.js'

export const notificationRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/notifications ────────────────────────────────────────
  app.get('/', {
    handler: async (req) => {
      const { cursor, limit = 30, unreadOnly } = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(30),
        unreadOnly: z.coerce.boolean().default(false),
      }).parse(req.query)

      const userId = req.user.sub
      let cursorCondition = {}
      if (cursor) {
        const decoded = decodeCursor(cursor)
        cursorCondition = { cursor: { id: decoded['id'] as string }, skip: 1 }
      }

      const notifications = await app.db.notification.findMany({
        where: { userId, ...(unreadOnly ? { read: false } : {}) },
        ...cursorCondition,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
      })

      const unreadCount = await app.db.notification.count({
        where: { userId, read: false },
      })

      const result = buildPaginatedResult(notifications, limit, (n) => ({ id: n.id }))
      return { ...result, unreadCount }
    },
  })

  // ─── PATCH /v1/notifications/:id/read ────────────────────────────
  app.patch('/:id/read', {
    handler: async (req, reply) => {
      const { id } = req.params as { id: string }
      const userId = req.user.sub

      await app.db.notification.updateMany({
        where: { id, userId },
        data: { read: true, readAt: new Date() },
      })

      reply.status(204).send()
    },
  })

  // ─── POST /v1/notifications/read-all ─────────────────────────────
  app.post('/read-all', {
    handler: async (req, reply) => {
      const userId = req.user.sub
      const { workspaceId } = z.object({ workspaceId: z.string().optional() }).parse(req.body)

      await app.db.notification.updateMany({
        where: { userId, read: false, ...(workspaceId ? { workspaceId } : {}) },
        data: { read: true, readAt: new Date() },
      })

      reply.status(204).send()
    },
  })

  // ─── GET /v1/notifications/preferences ───────────────────────────
  app.get('/preferences', {
    handler: async (req) => {
      const userId = req.user.sub
      const prefs = await app.db.userNotificationPrefs.findUnique({ where: { userId } })
      return prefs ?? {
        mentions: true, threadReplies: true, taskAssigned: true,
        taskUpdates: false, weeklyDigest: true, emailNotifications: true, pushEnabled: false,
      }
    },
  })

  // ─── PUT /v1/notifications/preferences ───────────────────────────
  app.put('/preferences', {
    handler: async (req, reply) => {
      const userId = req.user.sub
      const body = z.object({
        mentions: z.boolean().optional(),
        threadReplies: z.boolean().optional(),
        taskAssigned: z.boolean().optional(),
        taskUpdates: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
      }).parse(req.body)

      const prefs = await app.db.userNotificationPrefs.upsert({
        where: { userId },
        create: {
          userId,
          ...(body.mentions !== undefined ? { mentions: body.mentions } : {}),
          ...(body.threadReplies !== undefined ? { threadReplies: body.threadReplies } : {}),
          ...(body.taskAssigned !== undefined ? { taskAssigned: body.taskAssigned } : {}),
          ...(body.taskUpdates !== undefined ? { taskUpdates: body.taskUpdates } : {}),
          ...(body.weeklyDigest !== undefined ? { weeklyDigest: body.weeklyDigest } : {}),
          ...(body.emailNotifications !== undefined ? { emailNotifications: body.emailNotifications } : {}),
          ...(body.pushEnabled !== undefined ? { pushEnabled: body.pushEnabled } : {}),
        },
        update: {
          ...(body.mentions !== undefined ? { mentions: body.mentions } : {}),
          ...(body.threadReplies !== undefined ? { threadReplies: body.threadReplies } : {}),
          ...(body.taskAssigned !== undefined ? { taskAssigned: body.taskAssigned } : {}),
          ...(body.taskUpdates !== undefined ? { taskUpdates: body.taskUpdates } : {}),
          ...(body.weeklyDigest !== undefined ? { weeklyDigest: body.weeklyDigest } : {}),
          ...(body.emailNotifications !== undefined ? { emailNotifications: body.emailNotifications } : {}),
          ...(body.pushEnabled !== undefined ? { pushEnabled: body.pushEnabled } : {}),
        },
      })

      reply.status(200)
      return prefs
    },
  })
}
