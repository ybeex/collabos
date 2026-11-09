import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { withIdempotency } from '../../utils/idempotency.js'
import { CacheService, CACHE_TTL } from '../../plugins/cache.js'

const createCanvasSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(200).trim(),
})

const canvasNodeSchema = z.object({
  type: z.enum(['sticky', 'shape', 'text', 'image', 'connector', 'doc_embed', 'task_embed', 'frame']),
  content: z.record(z.unknown()),
  x: z.number(),
  y: z.number(),
  width: z.number().min(0),
  height: z.number().min(0),
})

export const canvasRoutes = async (app: FastifyInstance): Promise<void> => {
  const cache = new CacheService(app.redis)

  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/canvases?workspaceId= ────────────────────────────────
  app.get('/', {
    handler: async (req) => {
      const { workspaceId } = z.object({ workspaceId: z.string() }).parse(req.query)
      const userId = req.user.sub

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      return cache.getOrSet(
        `canvas:list:${workspaceId}`,
        CACHE_TTL.MEDIUM,
        () =>
          app.db.canvas.findMany({
            where: { workspaceId, deletedAt: null },
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              name: true,
              thumbnail: true,
              createdAt: true,
              updatedAt: true,
              _count: { select: { nodes: true } },
            },
          }),
      )
    },
  })

  // ─── POST /v1/canvases ─────────────────────────────────────────────
  app.post('/', {
    handler: async (req, reply) => {
      return withIdempotency(req, reply, app.redis, async () => {
        const body = createCanvasSchema.parse(req.body)
        const userId = req.user.sub

        const member = await app.db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
          select: { status: true },
        })
        if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

        const canvas = await app.db.canvas.create({
          data: {
            id: nanoid(21),
            workspaceId: body.workspaceId,
            name: body.name,
          },
        })

        await cache.del(`canvas:list:${body.workspaceId}`)

        await app.redis.publish(
          `ws:workspace:${body.workspaceId}`,
          JSON.stringify({ event: 'canvas.created', data: canvas }),
        )

        reply.status(201)
        return canvas
      })
    },
  })

  // ─── GET /v1/canvases/:canvasId ───────────────────────────────────
  app.get('/:canvasId', {
    handler: async (req) => {
      const { canvasId } = req.params as { canvasId: string }
      const userId = req.user.sub

      const canvas = await app.db.canvas.findUnique({
        where: { id: canvasId, deletedAt: null },
        include: {
          nodes: { orderBy: { id: 'asc' } },
        },
      })

      if (!canvas) throw new NotFoundError('Canvas', canvasId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: canvas.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      return canvas
    },
  })

  // ─── POST /v1/canvases/:canvasId/nodes ────────────────────────────
  app.post('/:canvasId/nodes', {
    config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { canvasId } = req.params as { canvasId: string }
      const userId = req.user.sub
      const body = canvasNodeSchema.parse(req.body)

      const canvas = await app.db.canvas.findUnique({
        where: { id: canvasId, deletedAt: null },
        select: { id: true, workspaceId: true },
      })

      if (!canvas) throw new NotFoundError('Canvas', canvasId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: canvas.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      const node = await app.db.canvasNode.create({
        data: {
          id: nanoid(21),
          canvasId,
          type: body.type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: body.content as any,
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
        },
      })

      await app.redis.publish(
        `ws:workspace:${canvas.workspaceId}`,
        JSON.stringify({
          event: 'canvas.node.created',
          data: { canvasId, node, createdBy: userId },
        }),
      )

      reply.status(201)
      return node
    },
  })

  // ─── PATCH /v1/canvases/:canvasId/nodes/:nodeId ───────────────────
  app.patch('/:canvasId/nodes/:nodeId', {
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { canvasId, nodeId } = req.params as { canvasId: string; nodeId: string }
      const userId = req.user.sub
      const body = canvasNodeSchema.partial().parse(req.body)

      const canvas = await app.db.canvas.findUnique({
        where: { id: canvasId, deletedAt: null },
        select: { workspaceId: true },
      })
      if (!canvas) throw new NotFoundError('Canvas', canvasId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: canvas.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      const node = await app.db.canvasNode.update({
        where: { id: nodeId },
        data: {
          ...(body.type !== undefined ? { type: body.type } : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(body.content !== undefined ? { content: body.content as any } : {}),
          ...(body.x !== undefined ? { x: body.x } : {}),
          ...(body.y !== undefined ? { y: body.y } : {}),
          ...(body.width !== undefined ? { width: body.width } : {}),
          ...(body.height !== undefined ? { height: body.height } : {}),
        },
      })

      // Broadcast cursor/position update to workspace
      await app.redis.publish(
        `ws:workspace:${canvas.workspaceId}`,
        JSON.stringify({
          event: 'canvas.node.moved',
          data: { canvasId, nodeId, ...body, userId },
        }),
      )

      reply.status(200)
      return node
    },
  })

  // ─── POST /v1/canvases/:canvasId/nodes/:nodeId/tasks ──────────────
  // Work Graph: sticky note → task
  app.post('/:canvasId/nodes/:nodeId/tasks', {
    handler: async (req, reply) => {
      const { canvasId, nodeId } = req.params as { canvasId: string; nodeId: string }
      const userId = req.user.sub
      const body = z.object({ title: z.string().min(1).max(500), projectId: z.string().optional() }).parse(req.body)

      const canvas = await app.db.canvas.findUnique({
        where: { id: canvasId, deletedAt: null },
        select: { workspaceId: true },
      })
      if (!canvas) throw new NotFoundError('Canvas', canvasId)

      const task = await app.db.$transaction(async (tx) => {
        const t = await tx.task.create({
          data: {
            id: nanoid(21),
            title: body.title,
            workspaceId: canvas.workspaceId,
            ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
            createdById: userId,
            status: 'todo',
            priority: 'medium',
          },
        })

        await tx.workGraphEdge.create({
          data: {
            id: nanoid(21),
            workspaceId: canvas.workspaceId,
            sourceType: 'task',
            sourceId: t.id,
            targetType: 'canvas_node',
            targetId: nodeId,
            edgeType: 'converted_from',
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
