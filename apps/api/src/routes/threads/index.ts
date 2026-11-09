import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { buildPaginatedResult, decodeCursor } from '../../utils/cursor.js'
import { withIdempotency } from '../../utils/idempotency.js'

export const threadRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // PRD_AUDIT.md Finding #4: PRD §13 specifies
  // /:workspace/channels/:channel-id/thread/:thread-id as a deep-linkable
  // URL. GET /:threadId/messages (below) returns only the reply messages
  // — there was no way to resolve a threadId to the PARENT message that
  // started the thread, which the frontend needs to open ThreadPanel
  // (its prop contract is parentMessage: Message, not threadId: string).
  // Without this endpoint, a "thread deep link" would be a URL param
  // with nothing reading it — the same class of gap as an unwired
  // feature flagged elsewhere in this audit.
  app.get('/:threadId', {
    handler: async (req) => {
      const { threadId } = req.params as { threadId: string }
      const userId = req.user.sub

      const thread = await app.db.thread.findUnique({
        where: { id: threadId },
        select: { id: true, channelId: true, messageId: true },
      })
      if (!thread) throw new NotFoundError('Thread', threadId)

      const channel = await app.db.channel.findUnique({
        where: { id: thread.channelId, deletedAt: null },
        select: {
          workspaceId: true,
          type: true,
          members: { where: { userId }, select: { id: true } },
        },
      })
      if (!channel) throw new NotFoundError('Channel')
      if (channel.type === 'private' && channel.members.length === 0) throw new ForbiddenError('Access denied')

      if (!thread.messageId) {
        // A Thread row can exist without a parent messageId in this
        // schema (messageId is optional) — return the thread metadata
        // without a parent message rather than erroring, since the
        // reply list itself is still valid and fetchable.
        return { threadId: thread.id, channelId: thread.channelId, parentMessage: null }
      }

      const parentMessage = await app.db.message.findUnique({
        where: { id: thread.messageId },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reactions: { select: { emoji: true, userId: true } },
          attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
        },
      })

      return { threadId: thread.id, channelId: thread.channelId, parentMessage }
    },
  })

  app.get('/:threadId/messages', {
    handler: async (req) => {
      const { threadId } = req.params as { threadId: string }
      const query = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }).parse(req.query)
      const userId = req.user.sub

      const thread = await app.db.thread.findUnique({
        where: { id: threadId },
        select: { id: true, channelId: true },
      })
      if (!thread) throw new NotFoundError('Thread', threadId)

      const channel = await app.db.channel.findUnique({
        where: { id: thread.channelId, deletedAt: null },
        select: {
          workspaceId: true,
          type: true,
          members: { where: { userId }, select: { id: true } },
        },
      })
      if (!channel) throw new NotFoundError('Channel')
      if (channel.type === 'private' && channel.members.length === 0) throw new ForbiddenError('Access denied')

      let cursorCondition = {}
      if (query.cursor) {
        const decoded = decodeCursor(query.cursor)
        cursorCondition = { cursor: { id: decoded['id'] as string }, skip: 1 }
      }

      const messages = await app.db.message.findMany({
        where: { threadId, deletedAt: null },
        ...cursorCondition,
        take: query.limit + 1,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reactions: { select: { emoji: true, userId: true } },
          attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
        },
      })

      return buildPaginatedResult(messages, query.limit, (m) => ({ id: m.id }))
    },
  })

  app.post('/', {
    handler: async (req, reply) => {
      return withIdempotency(req, reply, app.redis, async () => {
        const body = z.object({
          messageId: z.string().min(1),
          content: z.string().min(1).max(10000).trim(),
        }).parse(req.body)
        const userId = req.user.sub

        const parentMessage = await app.db.message.findUnique({
          where: { id: body.messageId, deletedAt: null },
          include: {
            channel: {
              select: {
                id: true, workspaceId: true, type: true,
                members: { where: { userId }, select: { id: true } },
              },
            },
          },
        })
        if (!parentMessage) throw new NotFoundError('Message', body.messageId)
        if (parentMessage.channel.type === 'private' && parentMessage.channel.members.length === 0) throw new ForbiddenError('Access denied')

        const result = await app.db.$transaction(async (tx) => {
          let thread = await tx.thread.findUnique({ where: { messageId: body.messageId } })
          if (!thread) {
            thread = await tx.thread.create({
              data: { id: nanoid(21), messageId: body.messageId, channelId: parentMessage.channelId, lastReplyAt: new Date() },
            })
          }
          const replyMsg = await tx.message.create({
            data: { id: nanoid(21), channelId: parentMessage.channelId, authorId: userId, content: body.content, threadId: thread.id },
            include: { author: { select: { id: true, name: true, avatarUrl: true } }, reactions: { select: { emoji: true, userId: true } }, attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } } },
          })
          await tx.thread.update({ where: { id: thread.id }, data: { lastReplyAt: new Date() } })
          return { thread, reply: replyMsg }
        })

        await app.redis.publish(`ws:channel:${parentMessage.channelId}`, JSON.stringify({ event: 'thread.reply_added', data: { threadId: result.thread.id, messageId: body.messageId, reply: result.reply } }))

        reply.status(201)
        return result
      })
    },
  })
}
