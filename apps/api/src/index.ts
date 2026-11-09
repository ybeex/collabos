import { buildApp } from './app.js'
import { env } from './utils/env.js'
import { logger } from './utils/logger.js'

const start = async (): Promise<void> => {
  const app = await buildApp()

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received shutdown signal')
    try {
      await app.close()
      logger.info('Server closed gracefully')
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection')
    process.exit(1)
  })

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'CollabOS API server started')
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}

start()
