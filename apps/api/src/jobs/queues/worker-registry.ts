/**
 * BullMQ worker registry — registers all workers and their processors.
 * Run as a separate process: node apps/api/dist/jobs/worker.js
 * Workers are long-running processes that consume queued jobs.
 */
import { Worker, type Job } from 'bullmq'
import { db } from '@collabos/db'
import { connection } from './index.js'
import { logger } from '../../utils/logger.js'
import { processSearchIndex } from '../handlers/search-index.js'
import { processNotification } from '../handlers/notifications.js'
import { processAutomation } from '../handlers/automations.js'
import { processEmail } from '../handlers/email.js'
import { processEmbedding } from '../handlers/embeddings.js'
import { processTranscode } from '../handlers/transcode.js'
import { processWebhook } from '../handlers/webhook.js'
import { processMeetingSummary } from '../handlers/meeting-summary.js'
import type {
  EmailJobData, NotificationJobData, SearchIndexJobData,
  EmbeddingsJobData, TranscodeJobData, WebhookJobData, MeetingSummaryJobData,
} from './index.js'

const createWorker = <T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 5,
): Worker<T> => {
  const worker = new Worker<T>(
    queueName,
    async (job) => {
      const start = Date.now()
      try {
        await processor(job)
        logger.debug({ queue: queueName, jobId: job.id, type: job.name, duration: Date.now() - start }, 'Job completed')
      } catch (err) {
        logger.error({ queue: queueName, jobId: job.id, type: job.name, err, duration: Date.now() - start }, 'Job failed')
        throw err // re-throw so BullMQ handles retry logic
      }
    },
    { connection, concurrency },
  )

  worker.on('failed', (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      logger.error({ queue: queueName, jobId: job.id, type: job.name, err, attempts: job.attemptsMade }, 'Job moved to failed state after max retries')
    }
  })

  worker.on('error', (err) => {
    logger.error({ queue: queueName, err }, 'Worker error')
  })

  return worker
}

export const startAllWorkers = (): Worker[] => {
  // Bug fix (found via tsc): each `job.data as Record<string, unknown>`
  // cast below failed under strict mode — the specific JobData interfaces
  // (EmailJobData, SearchIndexJobData, etc.) are closed shapes with no
  // index signature, so TS won't structurally narrow them straight to
  // Record<string, unknown> without an intermediate `unknown` step. Every
  // handler (jobs/handlers/*.ts) already accepts Record<string, unknown>
  // and does its own internal cast back to a locally-defined shape
  // matching what it expects — so this is a real type-system limitation
  // on a deliberately-loose boundary, not a masked runtime issue.
  const workers: Worker[] = [
    createWorker<EmailJobData>('email', async (job) => {
      await processEmail(job.data as unknown as Record<string, unknown>, db)
    }, 5),

    createWorker<NotificationJobData>('notifications', async (job) => {
      await processNotification(job.data as unknown as Record<string, unknown>, db)
    }, 10),

    createWorker<SearchIndexJobData>('search-index', async (job) => {
      await processSearchIndex(job.data as unknown as Record<string, unknown>, db)
    }, 3),

    createWorker<EmbeddingsJobData>('embeddings', async (job) => {
      await processEmbedding(job.data as unknown as Record<string, unknown>, db)
    }, 2),

    createWorker<Record<string, unknown>>('automations', async (job) => {
      await processAutomation(job.data, db)
    }, 5),

    createWorker<TranscodeJobData>('transcode', async (job) => {
      await processTranscode(job.data as unknown as Record<string, unknown>, db)
    }, 2),

    createWorker<WebhookJobData>('webhooks', async (job) => {
      await processWebhook(job.data as unknown as Record<string, unknown>, db)
    }, 10),

    createWorker<MeetingSummaryJobData>('meeting-summary', async (job) => {
      await processMeetingSummary(job.data as unknown as Record<string, unknown>, db)
    }, 3),
  ]

  logger.info({ workerCount: workers.length }, 'All BullMQ workers started')
  return workers
}
