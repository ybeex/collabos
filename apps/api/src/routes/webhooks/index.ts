import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { randomBytes } from 'node:crypto'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { encrypt } from '../../utils/encryption.js'
import { enqueueWebhook } from '../../jobs/queues/index.js'
import { buildPaginatedResult } from '../../utils/cursor.js'
import { requireRole } from '../../middleware/auth.js'

const VALID_EVENTS = [
  'message.created', 'message.updated', 'message.deleted',
  'task.created', 'task.status_changed', 'task.deleted',
  'channel.created', 'doc.created', 'doc.updated',
  'member.joined', 'member.left',
  'canvas.node.created',
  '*', // subscribe to all
] as const

// BUG-6 fix: this entire file previously re-implemented the same
// findUnique + role-hierarchy check 5 separate times (once per route).
// Two routes (GET list, POST create) have workspaceId directly in
// query/body and now use the shared requireRole middleware. The other
// three (DELETE, deliveries GET, replay POST) only have an endpointId or
// deliveryId in the URL and need a lookup to resolve workspaceId BEFORE
// requireRole could run as a preHandler — so for those, this single
// shared helper replaces the duplicated lookup-then-check block instead.
// Same outcome (one authorization rule, one place it's defined), correct
// shape for routes where the workspace isn't known until after a query.
const assertWebhookAdmin = async (
  app: FastifyInstance,
  userId: string,
  workspaceId: string,
): Promise<void> => {
  const member = await app.db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new ForbiddenError('Admin required')
  }
}

export const webhookRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/webhooks?workspaceId= ────────────────────────────────
  app.get('/', {
    preHandler: [requireRole('admin', 'query')],
    handler: async (req) => {
      const { workspaceId } = z.object({ workspaceId: z.string() }).parse(req.query)

      const endpoints = await app.db.webhookEndpoint.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, url: true, events: true, enabled: true,
          failureCount: true, lastDeliveryAt: true, createdAt: true,
          // Never expose the secret
        },
      })
      return endpoints
    },
  })

  // ─── POST /v1/webhooks ────────────────────────────────────────────
  app.post('/', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    preHandler: [requireRole('admin', 'body')],
    handler: async (req, reply) => {
      const userId = req.user.sub
      const body = z.object({
        workspaceId: z.string().min(1),
        url: z.string().url().max(500),
        events: z.array(z.enum(VALID_EVENTS)).min(1),
      }).parse(req.body)

      // Generate signing secret — encrypt before storage
      const rawSecret = `whsec_${randomBytes(32).toString('hex')}`
      const encryptedSecret = encrypt(rawSecret)

      const endpoint = await app.db.webhookEndpoint.create({
        data: {
          workspaceId: body.workspaceId,
          url: body.url,
          secret: encryptedSecret,
          events: body.events,
          enabled: true,
          createdById: userId,
        },
        select: { id: true, url: true, events: true, enabled: true, createdAt: true },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId: body.workspaceId,
          action: 'webhook.created',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { url: body.url, events: body.events },
        },
      })

      reply.status(201)
      return {
        ...endpoint,
        secret: rawSecret,
        warning: 'Store this secret securely. It will not be shown again. Use it to verify webhook signatures.',
      }
    },
  })

  // ─── DELETE /v1/webhooks/:endpointId ─────────────────────────────
  app.delete('/:endpointId', {
    handler: async (req, reply) => {
      const { endpointId } = req.params as { endpointId: string }
      const userId = req.user.sub

      const endpoint = await app.db.webhookEndpoint.findUnique({
        where: { id: endpointId },
        select: { workspaceId: true },
      })
      if (!endpoint) throw new NotFoundError('Webhook endpoint')

      await assertWebhookAdmin(app, userId, endpoint.workspaceId)

      await app.db.webhookEndpoint.delete({ where: { id: endpointId } })

      reply.status(204).send()
    },
  })

  // ─── GET /v1/webhooks/:endpointId/deliveries ─────────────────────
  app.get('/:endpointId/deliveries', {
    handler: async (req) => {
      const { endpointId } = req.params as { endpointId: string }
      const { limit = 50 } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query)
      const userId = req.user.sub

      const endpoint = await app.db.webhookEndpoint.findUnique({
        where: { id: endpointId },
        select: { workspaceId: true },
      })
      if (!endpoint) throw new NotFoundError('Webhook endpoint')

      await assertWebhookAdmin(app, userId, endpoint.workspaceId)

      const deliveries = await app.db.webhookDelivery.findMany({
        where: { endpointId },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        select: {
          id: true, event: true, statusCode: true, success: true,
          duration: true, attemptCount: true, createdAt: true,
          response: true,
        },
      })

      return buildPaginatedResult(deliveries, limit, (d) => ({ id: d.id }))
    },
  })

  // ─── POST /v1/webhooks/:endpointId/replay/:deliveryId ────────────
  app.post('/:endpointId/replay/:deliveryId', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { endpointId, deliveryId } = req.params as { endpointId: string; deliveryId: string }
      const userId = req.user.sub

      const delivery = await app.db.webhookDelivery.findUnique({
        where: { id: deliveryId },
        include: { endpoint: { select: { workspaceId: true } } },
      })
      if (!delivery) throw new NotFoundError('Webhook delivery')

      await assertWebhookAdmin(app, userId, delivery.endpoint.workspaceId)

      await enqueueWebhook({
        endpointId,
        event: delivery.event,
        payload: delivery.payload as Record<string, unknown>,
        workspaceId: delivery.endpoint.workspaceId,
      })

      reply.status(202)
      return { message: 'Delivery queued for replay' }
    },
  })
}
