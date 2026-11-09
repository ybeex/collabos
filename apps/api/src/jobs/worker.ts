import { startAllWorkers } from './queues/worker-registry.js'
import { logger } from '../utils/logger.js'

export function startWorker(): void {
  const workers = startAllWorkers()

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutdown initiated')
    await Promise.all(workers.map((w) => w.close()))
    logger.info('All workers shut down cleanly')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection in worker process')
    process.exit(1)
  })
}
