/**
 * Webhook delivery handler.
 * Signs payloads with HMAC-SHA256 so consumers can verify authenticity.
 * Stores delivery records for audit/replay purposes.
 */
import type { PrismaClient } from '@prisma/client'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { logger } from '../../utils/logger.js'

interface WebhookJob {
  endpointId: string
  event: string
  payload: Record<string, unknown>
  workspaceId: string
}

const TIMEOUT_MS = 10_000

export const signPayload = (secret: string, body: string, timestamp: number): string => {
  const signedContent = `${timestamp}.${body}`
  return createHmac('sha256', secret).update(signedContent).digest('hex')
}

export const verifySignature = (
  secret: string,
  body: string,
  timestamp: number,
  signature: string,
): boolean => {
  const expected = signPayload(secret, body, timestamp)
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

export const processWebhook = async (
  job: Record<string, unknown>,
  db: PrismaClient,
): Promise<void> => {
  // Bug fix (found via tsc): same 'convert to unknown first' pattern as
  // jobs/queues/worker-registry.ts's cast the other direction — this
  // project's local {}Job interfaces are closed shapes that don't
  // structurally overlap with Record<string, unknown> under strict mode.
  const { endpointId, event, payload } = job as unknown as WebhookJob

  const endpoint = await db.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { id: true, url: true, secret: true, enabled: true, events: true },
  })

  if (!endpoint || !endpoint.enabled) {
    logger.debug({ endpointId }, 'Webhook endpoint not found or disabled — skipping')
    return
  }

  // Check if endpoint subscribes to this event
  if (endpoint.events.length > 0 && !endpoint.events.includes(event) && !endpoint.events.includes('*')) {
    logger.debug({ endpointId, event }, 'Endpoint not subscribed to this event')
    return
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({ event, data: payload, timestamp })
  const signature = signPayload(endpoint.secret, body, timestamp)

  const start = Date.now()
  let statusCode: number | null = null
  let response: string | null = null
  let success = false

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CollabOS-Webhooks/1.0',
        'X-CollabOS-Event': event,
        'X-CollabOS-Signature': `sha256=${signature}`,
        'X-CollabOS-Timestamp': String(timestamp),
        'X-CollabOS-Delivery': endpointId,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    statusCode = res.status
    response = await res.text().then((t) => t.slice(0, 1000)) // cap response body stored
    success = res.status >= 200 && res.status < 300

    if (!success) {
      logger.warn({ endpointId, event, statusCode, response }, 'Webhook delivery failed (non-2xx)')
    }
  } catch (err) {
    logger.warn({ endpointId, event, err }, 'Webhook delivery network error')
    response = String(err)
  }

  const duration = Date.now() - start

  // Record delivery
  await db.webhookDelivery.create({
    data: {
      endpointId,
      event,
      payload: payload as object,
      statusCode,
      response,
      duration,
      success,
    },
  })

  // Update endpoint failure counter
  await db.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      lastDeliveryAt: new Date(),
      failureCount: success ? 0 : { increment: 1 },
    },
  })

  // Disable endpoint after 10 consecutive failures to prevent spam
  if (!success) {
    const updated = await db.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { failureCount: true },
    })
    if (updated && updated.failureCount >= 10) {
      await db.webhookEndpoint.update({
        where: { id: endpointId },
        data: { enabled: false },
      })
      logger.warn({ endpointId }, 'Webhook endpoint auto-disabled after 10 consecutive failures')
    }
  }

  if (!success) throw new Error(`Webhook delivery failed: ${statusCode ?? 'network error'}`)

  logger.debug({ endpointId, event, statusCode, duration }, 'Webhook delivered')
}
