import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { db } from '@collabos/db'
import { logger } from '../utils/logger.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db
  }
}

export const dbPlugin = fp(async (app: FastifyInstance) => {
  // Verify connection on startup
  try {
    await db.$queryRaw`SELECT 1`
    logger.info('Database connected')
  } catch (err) {
    logger.error({ err }, 'Database connection failed')
    throw err
  }

  app.decorate('db', db)

  app.addHook('onClose', async () => {
    await db.$disconnect()
    logger.info('Database disconnected')
  })
})
