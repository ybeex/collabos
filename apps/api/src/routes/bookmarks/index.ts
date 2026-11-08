import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ConflictError } from '../../utils/errors.js'

export const bookmarkRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/bookmarks ────────────────────────────────────────────
  app.get('/', {
    handler: async (req) => {
      const userId = req.user.sub
      return app.db.bookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    },
  })

  // ─── POST /v1/bookmarks ───────────────────────────────────────────
  app.post('/', {
    handler: async (req, reply) => {
      const userId = req.user.sub
      const body = z.object({
        entityType: z.enum(['message', 'task', 'doc', 'canvas_node']),
        entityId: z.string().min(1),
        note: z.string().max(500).optional(),
      }).parse(req.body)

      const existing = await app.db.bookmark.findUnique({
        where: { userId_entityType_entityId: { userId, entityType: body.entityType, entityId: body.entityId } },
      })
      if (existing) throw new ConflictError('Already bookmarked')

      const bookmark = await app.db.bookmark.create({
        data: {
          id: nanoid(21),
          userId,
          entityType: body.entityType,
          entityId: body.entityId,
          ...(body.note !== undefined ? { note: body.note } : {}),
        },
      })

      reply.status(201)
      return bookmark
    },
  })

  // ─── DELETE /v1/bookmarks/:entityType/:entityId ───────────────────
  app.delete('/:entityType/:entityId', {
    handler: async (req, reply) => {
      const { entityType, entityId } = req.params as { entityType: string; entityId: string }
      const userId = req.user.sub

      await app.db.bookmark.deleteMany({
        where: { userId, entityType, entityId },
      })

      reply.status(204).send()
    },
  })
}
