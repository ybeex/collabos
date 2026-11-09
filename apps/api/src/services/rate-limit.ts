import type { FastifyRequest } from 'fastify'
import type { Redis } from 'ioredis'
import { RATE_LIMITS } from '@collabos/shared'
import type { UserPlan } from '@collabos/shared'
import { RateLimitError } from '../utils/errors.js'
import { CACHE_TTL } from '../plugins/cache.js'

/**
 * Per-plan rate limiting service.
 * Uses a sliding window counter in Redis for accurate limiting at scale.
 */
export class RateLimitService {
  constructor(private readonly redis: Redis) {}

  /**
   * Check and increment the rate limit for a user.
   * Returns remaining quota info or throws RateLimitError.
   */
  async checkAndIncrement(
    userId: string,
    plan: UserPlan,
    route: string,
    windowSeconds = 60,
  ): Promise<{ remaining: number; limit: number }> {
    const limit = RATE_LIMITS[plan] ?? RATE_LIMITS.free
    const key = `ratelimit:${plan}:${userId}:${route}:${Math.floor(Date.now() / (windowSeconds * 1000))}`

    const pipeline = this.redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, windowSeconds)
    const results = await pipeline.exec()

    const current = (results?.[0]?.[1] as number | null) ?? 0

    if (current > limit) {
      const ttl = await this.redis.ttl(key)
      throw new RateLimitError(ttl > 0 ? ttl : windowSeconds)
    }

    return { remaining: Math.max(0, limit - current), limit }
  }

  /**
   * Get the rate limit tier for a user, cached for 1 hour.
   */
  async getUserPlan(userId: string, db: { user: { findUnique: (args: unknown) => Promise<{ plan: UserPlan } | null> } }): Promise<UserPlan> {
    const cacheKey = `ratelimit:tier:${userId}`
    const cached = await this.redis.get(cacheKey)
    if (cached) return cached as UserPlan

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    } as never)

    const plan = user?.plan ?? 'free'
    await this.redis.setex(cacheKey, CACHE_TTL.LONG, plan)
    return plan
  }
}
