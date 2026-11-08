import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { enqueueSearchIndex } from '../../jobs/queues/index.js'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { withIdempotency } from '../../utils/idempotency.js'

const createDocSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(500).trim(),
  parentId: z.string().optional(),
  isPublic: z.boolean().default(false),
})

const blockUpdateSchema = z.object({
  blocks: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['paragraph', 'heading1', 'heading2', 'heading3', 'code', 'quote',
        'callout', 'bulleted_list', 'numbered_list', 'todo', 'divider', 'image',
        'file', 'embed', 'task_embed', 'table', 'canvas_embed']),
      content: z.record(z.unknown()),
      order: z.number().int().min(0),
      parentBlockId: z.string().nullable().optional(),
    }),
  ).max(5000),
})

export const docRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/docs?workspaceId= ────────────────────────────────────
  app.get('/', {
    handler: async (req) => {
      const { workspaceId } = z.object({ workspaceId: z.string() }).parse(req.query)
      const userId = req.user.sub

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      return app.db.document.findMany({
        where: { workspaceId, deletedAt: null, parentId: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          icon: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          lastEditedBy: { select: { id: true, name: true } },
          _count: { select: { children: true } },
        },
      })
    },
  })

  // ─── POST /v1/docs ────────────────────────────────────────────────
  app.post('/', {
    handler: async (req, reply) => {
      return withIdempotency(req, reply, app.redis, async () => {
        const body = createDocSchema.parse(req.body)
        const userId = req.user.sub

        const member = await app.db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
          select: { status: true },
        })

        if (!member || member.status !== 'active') {
          throw new ForbiddenError('Not a member of this workspace')
        }

        const doc = await app.db.document.create({
          data: {
            id: nanoid(21),
            workspaceId: body.workspaceId,
            title: body.title,
            ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
            isPublic: body.isPublic,
            createdById: userId,
            lastEditedById: userId,
          },
        })

        // Create initial empty paragraph block
        await app.db.documentBlock.create({
          data: {
            id: nanoid(21),
            documentId: doc.id,
            type: 'paragraph',
            content: {},
            order: 0,
          },
        })

        await app.redis.publish(
          `ws:workspace:${body.workspaceId}`,
          JSON.stringify({ event: 'doc.created', data: { id: doc.id, title: doc.title } }),
        )

        reply.status(201)
        return doc
      })
    },
  })

  // ─── GET /v1/docs/:docId ──────────────────────────────────────────
  app.get('/:docId', {
    handler: async (req) => {
      const { docId } = req.params as { docId: string }
      const userId = req.user.sub

      const doc = await app.db.document.findUnique({
        where: { id: docId, deletedAt: null },
        include: {
          blocks: {
            where: { deletedAt: null },
            orderBy: { order: 'asc' },
          },
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          lastEditedBy: { select: { id: true, name: true } },
        },
      })

      if (!doc) throw new NotFoundError('Document', docId)

      if (!doc.isPublic) {
        const member = await app.db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
          select: { status: true },
        })
        if (!member || member.status !== 'active') {
          throw new ForbiddenError('Access denied')
        }
      }

      return doc
    },
  })

  // ─── PATCH /v1/docs/:docId ────────────────────────────────────────
  app.patch('/:docId', {
    handler: async (req, reply) => {
      const { docId } = req.params as { docId: string }
      const userId = req.user.sub
      const body = z.object({
        title: z.string().min(1).max(500).optional(),
        icon: z.string().max(10).optional(),
        isPublic: z.boolean().optional(),
      }).parse(req.body)

      const doc = await app.db.document.findUnique({
        where: { id: docId, deletedAt: null },
        select: { workspaceId: true },
      })

      if (!doc) throw new NotFoundError('Document', docId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      const updated = await app.db.document.update({
        where: { id: docId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.icon !== undefined ? { icon: body.icon } : {}),
          ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
          lastEditedById: userId,
          updatedAt: new Date(),
        },
      })

      await app.redis.publish(
        `ws:doc:${docId}`,
        JSON.stringify({ event: 'doc.meta_updated', data: { id: docId, ...body } }),
      )

      reply.status(200)
      return updated
    },
  })

  // ─── PUT /v1/docs/:docId/blocks ───────────────────────────────────
  // PRD_AUDIT.md Finding #1: this comment previously read "Receives full
  // block array — CRDT deltas handled at WS layer, HTTP is fallback,"
  // which was false — no CRDT handling existed anywhere in this codebase
  // at the time that comment was written. Real-time CRDT sync now exists
  // at WS /v1/ws/doc/:docId (services/yjs-sync.ts) using Yjs. This HTTP
  // endpoint genuinely is now what its old comment claimed it was: a
  // fallback path used when no client has an active Yjs session open for
  // this document. It still does last-write-wins full block replacement
  // — correct and unavoidable for a stateless HTTP call with no CRDT
  // session context to merge against — but a version snapshot is taken
  // first specifically because this path has no conflict-resolution
  // guarantee the way the Yjs socket does.
  app.put('/:docId/blocks', {
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { docId } = req.params as { docId: string }
      const userId = req.user.sub
      const { blocks } = blockUpdateSchema.parse(req.body)

      const doc = await app.db.document.findUnique({
        where: { id: docId, deletedAt: null },
        select: { workspaceId: true },
      })

      if (!doc) throw new NotFoundError('Document', docId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      // Create document version snapshot before overwriting
      const currentBlocks = await app.db.documentBlock.findMany({
        where: { documentId: docId, deletedAt: null },
        orderBy: { order: 'asc' },
      })

      if (currentBlocks.length > 0) {
        await app.db.documentVersion.create({
          data: {
            id: nanoid(21),
            documentId: docId,
            blocks: currentBlocks,
            createdById: userId,
          },
        })
      }

      // Upsert all blocks in a transaction
      await app.db.$transaction([
        // Soft-delete blocks not in the incoming set
        app.db.documentBlock.updateMany({
          where: {
            documentId: docId,
            id: { notIn: blocks.map((b) => b.id) },
          },
          data: { deletedAt: new Date() },
        }),
        // Upsert each block
        ...blocks.map((block) =>
          app.db.documentBlock.upsert({
            where: { id: block.id },
            create: {
              id: block.id,
              documentId: docId,
              type: block.type,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: block.content as any,
              order: block.order,
              parentBlockId: block.parentBlockId ?? null,
            },
            update: {
              type: block.type,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: block.content as any,
              order: block.order,
              parentBlockId: block.parentBlockId ?? null,
              deletedAt: null,
            },
          }),
        ),
        // Update doc metadata
        app.db.document.update({
          where: { id: docId },
          data: { lastEditedById: userId, updatedAt: new Date() },
        }),
      ])

      // Queue search re-indexing
      // Bug fix (found via tsc): SearchIndexJobData.action is required
      // ('upsert' | 'delete') and this call never set it — the doc was
      // just edited, so 'upsert' is correct.
      await enqueueSearchIndex({
        type: 'doc.index',
        entityId: docId,
        workspaceId: doc.workspaceId,
        action: 'upsert',
      })

      reply.status(200)
      return { blockCount: blocks.length }
    },
  })

  // ─── GET /v1/docs/:docId/history ──────────────────────────────────
  app.get('/:docId/history', {
    handler: async (req) => {
      const { docId } = req.params as { docId: string }
      const userId = req.user.sub

      const doc = await app.db.document.findUnique({
        where: { id: docId, deletedAt: null },
        select: { workspaceId: true },
      })

      if (!doc) throw new NotFoundError('Document', docId)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') throw new ForbiddenError('Access denied')

      return app.db.documentVersion.findMany({
        where: { documentId: docId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      })
    },
  })
}
