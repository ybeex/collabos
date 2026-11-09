import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { enqueueSearchIndex, enqueueAutomation } from '../../jobs/queues/index.js'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { buildPaginatedResult, decodeCursor } from '../../utils/cursor.js'
import { withIdempotency } from '../../utils/idempotency.js'
import { CacheService } from '../../plugins/cache.js'
import crypto from 'node:crypto'

const createTaskSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(10000).optional(),
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']).default('todo'),
  tags: z.array(z.string().max(50)).max(10).optional(),
})

const updateTaskSchema = createTaskSchema.partial().omit({ workspaceId: true })

const taskQuerySchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  orderBy: z.enum(['createdAt', 'dueDate', 'priority', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const taskRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)
  // Bug fix: three call sites below used `app.redis.del(\`tasks:${id}:*\`)`
  // to invalidate the cached task list after create/update/comment —
  // Redis's DEL takes literal key names, not glob patterns (SCAN/KEYS do
  // that), so each call was trying to delete one specific key literally
  // named "tasks:<id>:*", which never exists. Every one of those
  // invalidations silently no-op'd, meaning task-list caches never
  // actually got busted after a mutation — stale task lists until the
  // TTL expired on its own. CacheService.delPattern does this correctly
  // via SCAN (same fix as the auth refresh-token-revocation bug).
  const cache = new CacheService(app.redis)

  // ─── GET /v1/tasks ────────────────────────────────────────────────
  app.get('/', {
    handler: async (req) => {
      const query = taskQuerySchema.parse(req.query)
      const userId = req.user.sub

      // Verify workspace membership
      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: query.workspaceId, userId } },
        select: { role: true, status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      // Build a stable hash for cache key based on query params
      const queryHash = crypto
        .createHash('md5')
        .update(JSON.stringify({ ...query, userId }))
        .digest('hex')
        .slice(0, 8)

      const cacheKey = `tasks:${query.workspaceId}:${queryHash}`
      const cached = await app.redis.get(cacheKey)
      if (cached) return JSON.parse(cached)

      const where = {
        workspaceId: query.workspaceId,
        deletedAt: null,
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
      }

      let cursorCondition = {}
      if (query.cursor) {
        const decoded = decodeCursor(query.cursor)
        cursorCondition = { cursor: { id: decoded['id'] as string }, skip: 1 }
      }

      const tasks = await app.db.task.findMany({
        where,
        ...cursorCondition,
        take: query.limit + 1,
        orderBy: { [query.orderBy]: query.order },
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          createdBy: { select: { id: true, name: true } },
          workGraphEdges: {
            select: { id: true, edgeType: true, targetType: true, targetId: true },
            take: 5,
          },
          _count: { select: { comments: true } },
        },
      })

      const result = buildPaginatedResult(tasks, query.limit, (t) => ({ id: t.id }))

      // Cache for 30 seconds (tasks change frequently)
      await app.redis.setex(cacheKey, 30, JSON.stringify(result))

      return result
    },
  })

  // ─── POST /v1/tasks ───────────────────────────────────────────────
  app.post('/', {
    handler: async (req, reply) => {
      return withIdempotency(req, reply, app.redis, async () => {
        const body = createTaskSchema.parse(req.body)
        const userId = req.user.sub

        const member = await app.db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
          select: { role: true, status: true },
        })

        if (!member || member.status !== 'active') {
          throw new ForbiddenError('Not a member of this workspace')
        }

        const task = await app.db.task.create({
          data: {
            id: nanoid(21),
            title: body.title,
            ...(body.description !== undefined ? { description: body.description } : {}),
            workspaceId: body.workspaceId,
            ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
            ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
            ...(body.dueDate !== undefined ? { dueDate: new Date(body.dueDate) } : {}),
            priority: body.priority,
            status: body.status,
            tags: body.tags ?? [],
            createdById: userId,
          },
          include: {
            assignee: { select: { id: true, name: true, avatarUrl: true } },
            createdBy: { select: { id: true, name: true } },
          },
        })

        // Invalidate task list caches for this workspace
        await cache.delPattern(`tasks:${body.workspaceId}:*`)

        // Publish to workspace WS
        await app.redis.publish(
          `ws:workspace:${body.workspaceId}`,
          JSON.stringify({ event: 'task.created', data: task }),
        )

        // Queue search indexing
        // Bug fix (found via tsc): action was never set — new task, so
        // 'upsert'.
        await enqueueSearchIndex({
          type: 'task.index',
          entityId: task.id,
          workspaceId: body.workspaceId,
          action: 'upsert',
        })

        reply.status(201)
        return task
      })
    },
  })

  // ─── GET /v1/tasks/:taskId ────────────────────────────────────────
  app.get('/:taskId', {
    handler: async (req) => {
      const { taskId } = req.params as { taskId: string }
      const userId = req.user.sub

      const task = await app.db.task.findUnique({
        where: { id: taskId, deletedAt: null },
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          createdBy: { select: { id: true, name: true } },
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          },
          workGraphEdges: {
            include: { target: true },
          },
          project: { select: { id: true, name: true } },
        },
      })

      if (!task) throw new NotFoundError('Task', taskId)

      // Verify workspace membership
      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: task.workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Access denied')
      }

      return task
    },
  })

  // ─── PATCH /v1/tasks/:taskId ──────────────────────────────────────
  app.patch('/:taskId', {
    handler: async (req, reply) => {
      const { taskId } = req.params as { taskId: string }
      const userId = req.user.sub
      const body = updateTaskSchema.parse(req.body)

      const task = await app.db.task.findUnique({
        where: { id: taskId, deletedAt: null },
        select: { id: true, workspaceId: true, status: true, assigneeId: true },
      })

      if (!task) throw new NotFoundError('Task', taskId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: task.workspaceId, userId } },
        select: { role: true, status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Access denied')
      }

      const previous = { status: task.status, assigneeId: task.assigneeId }

      const updated = await app.db.task.update({
        where: { id: taskId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
          ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
          ...(body.dueDate !== undefined ? { dueDate: new Date(body.dueDate) } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.tags !== undefined ? { tags: body.tags } : {}),
          updatedAt: new Date(),
        },
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      })

      // Invalidate caches
      await cache.delPattern(`tasks:${task.workspaceId}:*`)

      // Publish status change event
      if (body.status && body.status !== previous.status) {
        await app.redis.publish(
          `ws:workspace:${task.workspaceId}`,
          JSON.stringify({
            event: 'task.status_changed',
            data: { taskId, from: previous.status, to: body.status, updatedBy: userId },
          }),
        )

        // Queue automation trigger check. Bug fix (found via tsc): this
        // used to route through enqueueSearchIndex — the wrong queue
        // entirely, with a payload shape (taskId/from/to/triggeredBy)
        // that doesn't match SearchIndexJobData at all, explicitly
        // marked `// TODO automations` by whoever wrote it.
        // automationsQueue and its full worker/handler chain
        // (worker-registry.ts -> handlers/automations.ts ->
        // executeAutomations, in services/automations.ts) already
        // existed and were fully wired — this call site just never used
        // it, and there was no enqueueAutomation convenience helper
        // matching the rest of this file's pattern (added in
        // jobs/queues/index.ts alongside this fix).
        await enqueueAutomation({
          type: 'task.status_changed',
          taskId,
          workspaceId: task.workspaceId,
          from: previous.status,
          to: body.status,
          triggeredBy: userId,
        })
      }

      reply.status(200)
      return updated
    },
  })

  // ─── DELETE /v1/tasks/:taskId ─────────────────────────────────────
  app.delete('/:taskId', {
    handler: async (req, reply) => {
      const { taskId } = req.params as { taskId: string }
      const userId = req.user.sub

      const task = await app.db.task.findUnique({
        where: { id: taskId, deletedAt: null },
        select: { id: true, workspaceId: true, createdById: true },
      })

      if (!task) throw new NotFoundError('Task', taskId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: task.workspaceId, userId } },
        select: { role: true },
      })

      if (!member) throw new ForbiddenError('Access denied')

      const canDelete = task.createdById === userId || ['admin', 'owner'].includes(member.role)
      if (!canDelete) throw new ForbiddenError('Insufficient permissions to delete this task')

      await app.db.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      })

      await cache.delPattern(`tasks:${task.workspaceId}:*`)

      await app.redis.publish(
        `ws:workspace:${task.workspaceId}`,
        JSON.stringify({ event: 'task.deleted', data: { taskId } }),
      )

      reply.status(204).send()
    },
  })

  // ─── POST /v1/tasks/:taskId/comments ─────────────────────────────
  // Bug fix (found the same way, same shape, as the identical bug in
  // routes/workspaces/index.ts — see that file's fix comment for the
  // full explanation): stray `}` prematurely closed the exported
  // `taskRoutes` function right here, leaving this comments route sitting
  // at module top-level referencing `app` as a free variable — a
  // ReferenceError on import, in any runtime, not just a tsc error.
  app.post('/:taskId/comments', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { taskId } = req.params as { taskId: string }
      const userId = req.user.sub
      const { content } = z.object({ content: z.string().min(1).max(5000).trim() }).parse(req.body)

      const task = await app.db.task.findUnique({
        where: { id: taskId, deletedAt: null },
        select: { workspaceId: true },
      })
      if (!task) throw new NotFoundError('Task', taskId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: task.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      const comment = await app.db.taskComment.create({
        data: {
          id: nanoid(21),
          taskId,
          authorId: userId,
          content,
        },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      })

      await app.redis.publish(
        `ws:workspace:${task.workspaceId}`,
        JSON.stringify({ event: 'task.comment_added', data: { taskId, comment } }),
      )

      reply.status(201)
      return comment
    },
  })
}
