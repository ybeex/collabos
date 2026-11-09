import type { FastifyRequest, FastifyReply } from 'fastify'
import type { Redis } from 'ioredis'

const IDEMPOTENCY_TTL = 86400 // 24 hours
const IDEMPOTENCY_PREFIX = 'idempotency:'

export interface IdempotencyRecord {
  statusCode: number
  body: unknown
  createdAt: string
}

export const checkIdempotency = async (
  redis: Redis,
  key: string,
): Promise<IdempotencyRecord | null> => {
  const raw = await redis.get(`${IDEMPOTENCY_PREFIX}${key}`)
  if (!raw) return null
  return JSON.parse(raw) as IdempotencyRecord
}

export const saveIdempotencyResult = async (
  redis: Redis,
  key: string,
  statusCode: number,
  body: unknown,
): Promise<void> => {
  const record: IdempotencyRecord = {
    statusCode,
    body,
    createdAt: new Date().toISOString(),
  }
  await redis.setex(`${IDEMPOTENCY_PREFIX}${key}`, IDEMPOTENCY_TTL, JSON.stringify(record))
}

// Middleware factory — wraps mutation routes with idempotency support
export const withIdempotency = async (
  req: FastifyRequest,
  reply: FastifyReply,
  redis: Redis,
  handler: () => Promise<unknown>,
): Promise<unknown> => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined
  if (!idempotencyKey) return handler()

  // Include user ID in key to prevent cross-user replay attacks
  const userId = (req.user as { sub: string } | undefined)?.sub ?? 'anon'
  const compositeKey = `${userId}:${idempotencyKey}`

  const cached = await checkIdempotency(redis, compositeKey)
  if (cached) {
    reply.status(cached.statusCode)
    reply.header('X-Idempotency-Replayed', 'true')
    return cached.body
  }

  const result = await handler()
  await saveIdempotencyResult(redis, compositeKey, reply.statusCode, result)
  return result
}
