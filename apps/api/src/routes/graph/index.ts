import type { FastifyInstance } from 'fastify'
import { NotFoundError } from '../../utils/errors.js'

interface EnrichedNode {
  entityType: string
  entityId: string
  title: string
  excerpt: string
}

// PRD_AUDIT.md Finding #3: the raw edge list previously returned only
// type/id pairs on both ends of each edge — enough for the API to be
// "real" but nothing a UI could render meaningfully. Follows the exact
// same enrichment pattern established in routes/search/index.ts's
// enrichSemanticResults.
const enrichEntity = async (
  entityType: string,
  entityId: string,
  app: FastifyInstance,
): Promise<EnrichedNode> => {
  try {
    if (entityType === 'message') {
      const msg = await app.db.message.findUnique({
        where: { id: entityId },
        select: { content: true, author: { select: { name: true } } },
      })
      if (msg) return { entityType, entityId, title: `Message by ${msg.author.name}`, excerpt: msg.content.slice(0, 140) }
    } else if (entityType === 'task') {
      const task = await app.db.task.findUnique({
        where: { id: entityId },
        select: { title: true, description: true },
      })
      if (task) return { entityType, entityId, title: task.title, excerpt: task.description?.slice(0, 140) ?? '' }
    } else if (entityType === 'document') {
      const doc = await app.db.document.findUnique({
        where: { id: entityId },
        select: { title: true },
      })
      if (doc) return { entityType, entityId, title: doc.title, excerpt: '' }
    } else if (entityType === 'canvas') {
      const canvas = await app.db.canvas.findUnique({
        where: { id: entityId },
        select: { name: true },
      })
      if (canvas) return { entityType, entityId, title: canvas.name, excerpt: '' }
    } else if (entityType === 'canvas_node') {
      const node = await app.db.canvasNode.findUnique({
        where: { id: entityId },
        select: { content: true },
      })
      if (node) {
        const text = (node.content as { text?: string; label?: string }).text
          ?? (node.content as { text?: string; label?: string }).label ?? 'Canvas node'
        return { entityType, entityId, title: text.slice(0, 60), excerpt: '' }
      }
    }
  } catch {
    // Fall through to the not-found placeholder below.
  }

  return { entityType, entityId, title: '(deleted or unavailable)', excerpt: '' }
}

export const graphRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/graph/:entityType/:entityId/links ────────────────────
  app.get('/:entityType/:entityId/links', {
    handler: async (req) => {
      const { entityType, entityId } = req.params as { entityType: string; entityId: string }
      const userId = req.user.sub

      const validTypes = ['message', 'task', 'document', 'canvas', 'canvas_node']
      if (!validTypes.includes(entityType)) {
        throw new NotFoundError('Entity type', entityType)
      }

      const edges = await app.db.workGraphEdge.findMany({
        where: {
          OR: [
            { sourceType: entityType, sourceId: entityId },
            { targetType: entityType, targetId: entityId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      if (edges.length === 0) return { center: null, edges: [], total: 0 }

      const workspaceIds = [...new Set(edges.map((e) => e.workspaceId))]
      const memberships = await app.db.workspaceMember.findMany({
        where: {
          userId,
          workspaceId: { in: workspaceIds },
          status: 'active',
        },
        select: { workspaceId: true },
      })

      const allowedWorkspaces = new Set(memberships.map((m) => m.workspaceId))
      const filteredEdges = edges.filter((e) => allowedWorkspaces.has(e.workspaceId))

      if (filteredEdges.length === 0) return { center: null, edges: [], total: 0 }

      const center = await enrichEntity(entityType, entityId, app)

      const otherNodeKeys = new Set<string>()
      for (const e of filteredEdges) {
        if (!(e.sourceType === entityType && e.sourceId === entityId)) {
          otherNodeKeys.add(`${e.sourceType}:${e.sourceId}`)
        }
        if (!(e.targetType === entityType && e.targetId === entityId)) {
          otherNodeKeys.add(`${e.targetType}:${e.targetId}`)
        }
      }

      const otherNodes = await Promise.all(
        [...otherNodeKeys].map((key) => {
          const [type, id] = key.split(':') as [string, string]
          return enrichEntity(type, id, app)
        }),
      )

      return {
        center,
        nodes: otherNodes,
        edges: filteredEdges.map((e) => ({
          id: e.id,
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          targetType: e.targetType,
          targetId: e.targetId,
          edgeType: e.edgeType,
          createdAt: e.createdAt,
        })),
        total: filteredEdges.length,
      }
    },
  })
}
