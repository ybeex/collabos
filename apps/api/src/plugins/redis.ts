import fp from 'fastify-plugin'
import Redis from 'ioredis'
import type { FastifyInstance } from 'fastify'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

export const redisPlugin = fp(async (app: FastifyInstance) => {
  const redis = new Redis(env.REDIS_URL, {
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 5) return null // stop retrying
      return Math.min(times * 200, 2000)
    },
    reconnectOnError: (err: Error) => {
      logger.warn({ err: err.message }, 'Redis connection error — attempting reconnect')
      return true
    },
    enableReadyCheck: true,
    lazyConnect: false,
  })

  redis.on('connect', () => logger.info('Redis connected'))
  redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'))
  redis.on('close', () => logger.warn('Redis connection closed'))

  app.decorate('redis', redis)

  app.addHook('onClose', async () => {
    await redis.quit()
    logger.info('Redis disconnected')
  })
})
