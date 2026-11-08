import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { CacheService, cacheKeys, CACHE_TTL } from '../../plugins/cache.js'
import { buildPaginatedResult, decodeCursor } from '../../utils/cursor.js'

const createChannelSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).toLowerCase().trim().regex(/^[a-z0-9-_]+$/),
  description: z.string().max(250).optional(),
  type: z.enum(['public', 'private']).default('public'),
})

export const channelRoutes = async (app: FastifyInstance): Promise<void> => {
  const cache = new CacheService(app.redis)

  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/channels?workspaceId= ────────────────────────────────
  app.get('/', {
    schema: {
      querystring: {
        type: 'object',
        required: ['workspaceId'],
        properties: { workspaceId: { type: 'string' } },
      },
    },
    handler: async (req) => {
      const { workspaceId } = req.query as { workspaceId: string }
      const userId = req.user.sub

      const membership = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true, status: true },
      })

      if (!membership || membership.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      return cache.getOrSet(
        `${cacheKeys.workspaceChannels(workspaceId)}:${userId}`,
        CACHE_TTL.MEDIUM,
        () =>
          app.db.channel.findMany({
            where: {
              workspaceId,
              deletedAt: null,
              OR: [
                { type: 'public' },
                { members: { some: { userId } } },
              ],
            },
            include: {
              _count: { select: { members: true } },
              members: {
                where: { userId },
                select: { lastReadAt: true, isMuted: true },
              },
            },
            orderBy: { name: 'asc' },
          }),
      )
    },
  })

  // ─── POST /v1/channels ────────────────────────────────────────────
  app.post('/', {
    handler: async (req, reply) => {
      const body = createChannelSchema.parse(req.body)
      const userId = req.user.sub

      const membership = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
        select: { role: true, status: true },
      })

      if (!membership || membership.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      const existing = await app.db.channel.findFirst({
        where: { workspaceId: body.workspaceId, name: body.name, deletedAt: null },
        select: { id: true },
      })

      if (existing) {
        throw new ConflictError(`Channel #${body.name} already exists in this workspace`)
      }

      const channel = await app.db.$transaction(async (tx) => {
        const ch = await tx.channel.create({
          data: {
            id: nanoid(21),
            workspaceId: body.workspaceId,
            name: body.name,
            ...(body.description !== undefined ? { description: body.description } : {}),
            type: body.type,
            createdById: userId,
          },
        })

        // Auto-join creator
        await tx.channelMember.create({
          data: {
            id: nanoid(21),
            channelId: ch.id,
            userId,
            role: 'admin',
          },
        })

        return ch
      })

      await cache.delPattern(`workspace:${body.workspaceId}:channels:*`)

      // Broadcast new channel to workspace over WS
      await app.redis.publish(
        `ws:workspace:${body.workspaceId}`,
        JSON.stringify({ event: 'channel.created', data: channel }),
      )

      reply.status(201)
      return channel
    },
  })

  // ─── GET /v1/channels/:channelId ──────────────────────────────────
  app.get('/:channelId', {
    handler: async (req) => {
      const { channelId } = req.params as { channelId: string }
      const userId = req.user.sub

      const channel = await app.db.channel.findUnique({
        where: { id: channelId, deletedAt: null },
        include: {
          _count: { select: { members: true, messages: true } },
          members: {
            where: { userId },
            select: { lastReadAt: true, isMuted: true, role: true },
          },
        },
      })

      if (!channel) throw new NotFoundError('Channel', channelId)

      // Check access
      if (channel.type === 'private' && channel.members.length === 0) {
        throw new ForbiddenError('You do not have access to this channel')
      }

      return channel
    },
  })

  // ─── GET /v1/channels/:channelId/messages ─────────────────────────
  app.get('/:channelId/messages', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          cursor: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          before: { type: 'string' },
          after: { type: 'string' },
        },
      },
    },
    handler: async (req) => {
      const { channelId } = req.params as { channelId: string }
      const query = req.query as { cursor?: string; limit?: number; before?: string; after?: string }
      const limit = query.limit ?? 50
      const userId = req.user.sub

      // Verify access
      const channel = await app.db.channel.findUnique({
        where: { id: channelId, deletedAt: null },
        select: {
          id: true,
          type: true,
          workspaceId: true,
          members: { where: { userId }, select: { id: true } },
        },
      })

      if (!channel) throw new NotFoundError('Channel', channelId)
      if (channel.type === 'private' && channel.members.length === 0) {
        throw new ForbiddenError('Access denied')
      }

      // Resolve cursor
      let cursorCondition = {}
      if (query.cursor) {
        const decoded = decodeCursor(query.cursor)
        cursorCondition = {
          cursor: { id: decoded['id'] as string },
          skip: 1,
        }
      }

      const messages = await app.db.message.findMany({
        where: {
          channelId,
          deletedAt: null,
          ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
          ...(query.after ? { createdAt: { gt: new Date(query.after) } } : {}),
        },
        ...cursorCondition,
        take: limit + 1, // fetch one extra to detect hasNextPage
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reactions: { select: { emoji: true, userId: true } },
          attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
          thread: {
            select: { _count: { select: { messages: true } }, lastReplyAt: true },
          },
        },
      })

      return buildPaginatedResult(
        messages,
        limit,
        (msg) => ({ id: msg.id }),
      )
    },
  })

  // ─── POST /v1/channels/:channelId/join ────────────────────────────
  app.post('/:channelId/join', {
    handler: async (req, reply) => {
      const { channelId } = req.params as { channelId: string }
      const userId = req.user.sub

      const channel = await app.db.channel.findUnique({
        where: { id: channelId, deletedAt: null },
        select: { id: true, type: true, workspaceId: true },
      })

      if (!channel) throw new NotFoundError('Channel', channelId)
      if (channel.type === 'private') throw new ForbiddenError('Cannot join a private channel directly')

      await app.db.channelMember.upsert({
        where: { channelId_userId: { channelId, userId } },
        create: { id: nanoid(21), channelId, userId, role: 'member' },
        update: { leftAt: null },
      })

      await cache.delPattern(`workspace:${channel.workspaceId}:channels:*`)

      reply.status(204).send()
    },
  })

  // ─── PATCH /v1/channels/:channelId/read ───────────────────────────
  app.patch('/:channelId/read', {
    handler: async (req, reply) => {
      const { channelId } = req.params as { channelId: string }
      const userId = req.user.sub

      await app.db.channelMember.updateMany({
        where: { channelId, userId },
        data: { lastReadAt: new Date() },
      })

      // Update presence in Redis
      await app.redis.hset(`presence:${userId}`, 'activeChannel', channelId)

      reply.status(204).send()
    },
  })
}
