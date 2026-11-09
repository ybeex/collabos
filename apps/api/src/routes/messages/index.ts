import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { enqueueSearchIndex, enqueueNotification } from '../../jobs/queues/index.js'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { withIdempotency } from '../../utils/idempotency.js'

const createMessageSchema = z.object({
  channelId: z.string().min(1),
  content: z.string().min(1).max(10000).trim(),
  threadId: z.string().optional(),
  attachmentIds: z.array(z.string()).max(10).optional(),
})

const reactionSchema = z.object({
  emoji: z.string().min(1).max(12),
})

export const messageRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── POST /v1/messages ────────────────────────────────────────────
  app.post('/', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      return withIdempotency(req, reply, app.redis, async () => {
        const body = createMessageSchema.parse(req.body)
        const userId = req.user.sub

        // Verify channel membership
        const channelMember = await app.db.channelMember.findUnique({
          where: { channelId_userId: { channelId: body.channelId, userId } },
          include: { channel: { select: { workspaceId: true, deletedAt: true } } },
        })

        if (!channelMember || channelMember.channel.deletedAt) {
          throw new ForbiddenError('Not a member of this channel')
        }

        const message = await app.db.message.create({
          data: {
            id: nanoid(21),
            channelId: body.channelId,
            authorId: userId,
            content: body.content,
            ...(body.threadId !== undefined ? { threadId: body.threadId } : {}),
            ...(body.attachmentIds !== undefined
              ? { attachments: { connect: body.attachmentIds.map((id) => ({ id })) } }
              : {}),
          },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
          },
        })

        // Publish to workspace WebSocket subscribers
        await app.redis.publish(
          `ws:channel:${body.channelId}`,
          JSON.stringify({
            event: 'message.created',
            data: message,
            workspaceId: channelMember.channel.workspaceId,
          }),
        )

        // Queue background jobs: AI digest update, mention notifications, search index
        // Bug fix (found via tsc): both calls were missing required
        // fields on their job-data types. SearchIndexJobData.action
        // ('upsert'|'delete') was never set — this is a new message, so
        // 'upsert'. NotificationJobData.workspaceId was never set even
        // though it was right there in scope on channelMember.channel —
        // downstream notification-routing code that keys off
        // workspaceId would have received undefined for every message
        // notification.
        await Promise.all([
          enqueueSearchIndex({
            type: 'message.index',
            entityId: message.id,
            workspaceId: channelMember.channel.workspaceId,
            action: 'upsert',
          }),
          enqueueNotification({
            type: 'message.mentions',
            messageId: message.id,
            channelId: body.channelId,
            content: body.content,
            authorId: userId,
            workspaceId: channelMember.channel.workspaceId,
          }),
        ])

        reply.status(201)
        return message
      })
    },
  })

  // ─── PATCH /v1/messages/:messageId ────────────────────────────────
  app.patch('/:messageId', {
    handler: async (req, reply) => {
      const { messageId } = req.params as { messageId: string }
      const userId = req.user.sub
      const body = z.object({ content: z.string().min(1).max(10000).trim() }).parse(req.body)

      const message = await app.db.message.findUnique({
        where: { id: messageId, deletedAt: null },
        select: { id: true, authorId: true, channelId: true, content: true },
      })

      if (!message) throw new NotFoundError('Message', messageId)
      if (message.authorId !== userId) throw new ForbiddenError('You can only edit your own messages')

      const updated = await app.db.message.update({
        where: { id: messageId },
        data: { content: body.content, editedAt: new Date() },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      })

      await app.redis.publish(
        `ws:channel:${message.channelId}`,
        JSON.stringify({ event: 'message.updated', data: updated }),
      )

      reply.status(200)
      return updated
    },
  })

  // ─── DELETE /v1/messages/:messageId ──────────────────────────────
  app.delete('/:messageId', {
    handler: async (req, reply) => {
      const { messageId } = req.params as { messageId: string }
      const userId = req.user.sub

      const message = await app.db.message.findUnique({
        where: { id: messageId, deletedAt: null },
        include: {
          channel: {
            include: {
              members: { where: { userId, role: { in: ['admin'] } }, select: { id: true } },
            },
          },
        },
      })

      if (!message) throw new NotFoundError('Message', messageId)

      const isAuthor = message.authorId === userId
      const isChannelAdmin = message.channel.members.length > 0

      if (!isAuthor && !isChannelAdmin) {
        throw new ForbiddenError('You cannot delete this message')
      }

      // Soft delete
      await app.db.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date(), content: '[Message deleted]' },
      })

      await app.redis.publish(
        `ws:channel:${message.channelId}`,
        JSON.stringify({ event: 'message.deleted', data: { id: messageId } }),
      )

      reply.status(204).send()
    },
  })

  // ─── POST /v1/messages/:messageId/reactions ───────────────────────
  app.post('/:messageId/reactions', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { messageId } = req.params as { messageId: string }
      const { emoji } = reactionSchema.parse(req.body)
      const userId = req.user.sub

      const message = await app.db.message.findUnique({
        where: { id: messageId, deletedAt: null },
        select: { id: true, channelId: true },
      })
      if (!message) throw new NotFoundError('Message', messageId)

      // Toggle reaction
      const existing = await app.db.messageReaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      })

      if (existing) {
        await app.db.messageReaction.delete({
          where: { messageId_userId_emoji: { messageId, userId, emoji } },
        })
      } else {
        await app.db.messageReaction.create({
          data: { id: nanoid(21), messageId, userId, emoji },
        })
      }

      const reactions = await app.db.messageReaction.findMany({
        where: { messageId },
        select: { emoji: true, userId: true },
      })

      await app.redis.publish(
        `ws:channel:${message.channelId}`,
        JSON.stringify({ event: 'message.reaction', data: { messageId, reactions } }),
      )

      reply.status(200)
      return { reactions }
    },
  })

  // ─── POST /v1/messages/:messageId/tasks ───────────────────────────
  // Core Work Graph: convert a message into a task
  app.post('/:messageId/tasks', {
    handler: async (req, reply) => {
      const { messageId } = req.params as { messageId: string }
      const userId = req.user.sub
      const body = z
        .object({
          title: z.string().min(1).max(500),
          projectId: z.string().optional(),
          assigneeId: z.string().optional(),
          dueDate: z.string().datetime().optional(),
        })
        .parse(req.body)

      const message = await app.db.message.findUnique({
        where: { id: messageId, deletedAt: null },
        include: { channel: { select: { workspaceId: true } } },
      })
      if (!message) throw new NotFoundError('Message', messageId)

      const task = await app.db.$transaction(async (tx) => {
        const t = await tx.task.create({
          data: {
            id: nanoid(21),
            title: body.title,
            workspaceId: message.channel.workspaceId,
            ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
            ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
            ...(body.dueDate !== undefined ? { dueDate: new Date(body.dueDate) } : {}),
            createdById: userId,
            status: 'todo',
          },
        })

        // Create Work Graph edge: task converted_from message
        await tx.workGraphEdge.create({
          data: {
            id: nanoid(21),
            sourceType: 'task',
            sourceId: t.id,
            targetType: 'message',
            targetId: messageId,
            edgeType: 'converted_from',
            workspaceId: message.channel.workspaceId,
            createdById: userId,
          },
        })

        return t
      })

      reply.status(201)
      return task
    },
  })
}
