import type { PrismaClient } from '@prisma/client'
import { logger } from '../../utils/logger.js'

interface SearchIndexJob {
  type: string
  entityId: string
  workspaceId: string
}

export const processSearchIndex = async (
  job: Record<string, unknown>,
  db: PrismaClient,
): Promise<void> => {
  // Bug fix (found via tsc): same 'convert to unknown first' pattern as
  // jobs/queues/worker-registry.ts's cast the other direction — this
  // project's local {}Job interfaces are closed shapes that don't
  // structurally overlap with Record<string, unknown> under strict mode.
  const { entityId, workspaceId, type } = job as unknown as SearchIndexJob

  // Extract text content for indexing based on entity type
  let content = ''
  let title = ''

  if (type === 'message.index') {
    const msg = await db.message.findUnique({
      where: { id: entityId },
      select: { content: true, author: { select: { name: true } } },
    })
    if (!msg) return
    content = msg.content
    title = `Message by ${msg.author.name}`
  } else if (type === 'task.index') {
    const task = await db.task.findUnique({
      where: { id: entityId },
      select: { title: true, description: true },
    })
    if (!task) return
    title = task.title
    content = task.description ?? ''
  } else if (type === 'doc.index') {
    const doc = await db.document.findUnique({
      where: { id: entityId },
      select: {
        title: true,
        blocks: {
          where: { deletedAt: null, type: { in: ['paragraph', 'heading1', 'heading2', 'heading3'] } },
          orderBy: { order: 'asc' },
          take: 100,
          select: { content: true },
        },
      },
    })
    if (!doc) return
    title = doc.title
    content = doc.blocks
      .map((b) => {
        const c = b.content as { text?: string }
        return c.text ?? ''
      })
      .join(' ')
  }

  // Upsert Work Graph node with text for full-text search
  // In production, also generate and store vector embeddings here
  await db.workGraphNode.upsert({
    where: { entityId },
    create: {
      entityType: type.split('.')[0] ?? 'unknown',
      entityId,
      workspaceId,
      embedding: [], // placeholder — vector embedding goes here in production
      metadata: { title, contentPreview: content.slice(0, 500) },
    },
    update: {
      metadata: { title, contentPreview: content.slice(0, 500) },
      updatedAt: new Date(),
    },
  })

  logger.debug({ entityId, type }, 'Search index updated')
}
