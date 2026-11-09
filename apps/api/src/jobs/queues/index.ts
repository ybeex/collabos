/**
 * BullMQ queue definitions.
 * All queues share a Redis connection but are logically separated.
 * Queue-specific Redis uses REDIS_QUEUE_URL if set, else REDIS_URL.
 * This prevents LRU cache eviction from deleting queued jobs.
 */
import { Queue, Worker, QueueEvents, type ConnectionOptions } from 'bullmq'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'

const redisUrl = new URL(env.REDIS_QUEUE_URL ?? env.REDIS_URL)

export const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  tls: env.REDIS_TLS ? {} : undefined,
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
}

// ─── Queue definitions ────────────────────────────────────────────────────────

export const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },     // keep completed for 1 hour
    removeOnFail: { age: 7 * 86400 },    // keep failed for 7 days
  },
})

export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7 * 86400 },
  },
})

export const searchIndexQueue = new Queue('search-index', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { age: 1800 },
    removeOnFail: { age: 3 * 86400 },
    priority: 10, // lower = higher priority; search index is low priority
  },
})

export const embeddingsQueue = new Queue('embeddings', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { age: 1800 },
    removeOnFail: { age: 7 * 86400 },
    priority: 20,
  },
})

export const automationsQueue = new Queue('automations', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7 * 86400 },
  },
})

export const transcodeQueue = new Queue('transcode', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7 * 86400 },
    priority: 15,
    // Bug fix (found via tsc): `timeout` isn't a real BullMQ
    // DefaultJobOptions property (that's a Bull v3/legacy option) —
    // unknown properties are silently ignored at runtime, so this never
    // actually enforced anything. The real 10-minute-class timeout is
    // already correctly implemented where it belongs: as `{ timeout:
    // 300_000 }` / `{ timeout: 30_000 }` options on the actual
    // `execFileAsync('ffmpeg', ...)` calls in
    // jobs/handlers/transcode.ts, which Node's child_process module
    // does genuinely support. Removed rather than left as misleading
    // dead config implying a protection that wasn't there.
  },
})

export const webhookQueue = new Queue('webhooks', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7 * 86400 },
  },
})

export const scheduledQueue = new Queue('scheduled', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 7 * 86400 },
  },
})

// PRD_AUDIT.md Finding #2: meeting transcription + AI summary. Runs as a
// background job matching PRD §14 Flow 4's "within ~30 seconds" async
// expectation.
export const meetingSummaryQueue = new Queue('meeting-summary', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7 * 86400 },
  },
})

// ─── Type-safe job data interfaces ───────────────────────────────────────────

export interface EmailJobData {
  type: 'workspace.invite' | 'auth.password_reset' | 'mention.notification' | 'weekly.digest' | 'task.assigned'
  to: string
  data: Record<string, unknown>
}

export interface NotificationJobData {
  type: 'message.mentions' | 'thread.reply' | 'task.assigned' | 'task.comment'
  messageId?: string
  taskId?: string
  threadId?: string
  channelId?: string
  authorId: string
  content?: string
  workspaceId: string
}

export interface SearchIndexJobData {
  type: 'message.index' | 'task.index' | 'doc.index' | 'canvas.index'
  entityId: string
  workspaceId: string
  action: 'upsert' | 'delete'
}

export interface EmbeddingsJobData {
  type: 'message.embed' | 'task.embed' | 'doc.embed' | 'canvas_node.embed'
  entityId: string
  workspaceId: string
  text: string
}

export interface TranscodeJobData {
  attachmentId: string
  s3Key: string
  workspaceId: string
  uploadedById: string
}

export interface WebhookJobData {
  endpointId: string
  event: string
  payload: Record<string, unknown>
  workspaceId: string
}

export interface ScheduledJobData {
  type: 'daily.digest' | 'weekly.digest' | 'reindex.vectors' | 'cleanup.expired'
  workspaceId?: string
  userId?: string
}

export interface MeetingSummaryJobData {
  transcriptId: string
  channelId: string
  workspaceId: string
}

// Bug fix (found via tsc, following up on the tasks/index.ts fix — see
// that file's comment): matches services/automations.ts's
// AutomationTrigger shape. automationsQueue and its worker/handler chain
// (worker-registry.ts -> handlers/automations.ts -> executeAutomations)
// already existed and were fully wired — the only missing piece was a
// convenience enqueue helper matching every other job type's pattern
// here, which is presumably why the task-status-change call site never
// used it and instead misrouted through enqueueSearchIndex.
export interface AutomationTriggerJobData {
  type: string
  taskId?: string
  workspaceId: string
  from?: string
  to?: string
  triggeredBy?: string
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const enqueueEmail = (data: EmailJobData) =>
  emailQueue.add(data.type, data)

export const enqueueNotification = (data: NotificationJobData) =>
  notificationQueue.add(data.type, data)

export const enqueueSearchIndex = (data: SearchIndexJobData) =>
  searchIndexQueue.add(data.type, data, { jobId: `${data.type}:${data.entityId}`, deduplication: { id: `${data.type}:${data.entityId}` } })

export const enqueueEmbedding = (data: EmbeddingsJobData) =>
  embeddingsQueue.add(data.type, data, { jobId: `embed:${data.entityId}`, deduplication: { id: `embed:${data.entityId}` } })

export const enqueueTranscode = (data: TranscodeJobData) =>
  transcodeQueue.add('transcode', data)

export const enqueueWebhook = (data: WebhookJobData) =>
  webhookQueue.add(data.event, data)

export const enqueueMeetingSummary = (data: MeetingSummaryJobData) =>
  meetingSummaryQueue.add('summarize', data, { jobId: `meeting-summary:${data.transcriptId}` })

export const enqueueAutomation = (data: AutomationTriggerJobData) =>
  automationsQueue.add(data.type, data)

// ─── Queue metrics for Prometheus ────────────────────────────────────────────

export const getQueueMetrics = async () => {
  const queues = [emailQueue, notificationQueue, searchIndexQueue, embeddingsQueue, automationsQueue, transcodeQueue, webhookQueue]
  const metrics = await Promise.all(
    queues.map(async (q) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        q.getWaitingCount(),
        q.getActiveCount(),
        q.getCompletedCount(),
        q.getFailedCount(),
        q.getDelayedCount(),
      ])
      return { name: q.name, waiting, active, completed, failed, delayed }
    }),
  )
  return metrics
}

logger.info({ queues: ['email','notifications','search-index','embeddings','automations','transcode','webhooks'] }, 'BullMQ queues initialized')
