import type { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger.js'
// Type-only import — erased at compile time, so this doesn't force
// ioredis to load eagerly (the actual module is still dynamically
// imported below, only where it's used).
import type { RedisOptions } from 'ioredis'

interface AutomationTrigger {
  type: string
  taskId?: string
  workspaceId: string
  from?: string
  to?: string
  triggeredBy?: string
}

interface AutomationRule {
  id: string
  trigger: string
  conditions: Record<string, unknown>
  actions: AutomationAction[]
  workspaceId: string
  enabled: boolean
}

interface AutomationAction {
  type: 'notify_channel' | 'assign_task' | 'create_task' | 'update_field' | 'send_email'
  config: Record<string, unknown>
}

import { enqueueEmail } from '../jobs/queues/index.js'

// Built-in automation action executors
const executors: Record<string, (action: AutomationAction, context: Record<string, unknown>, db: PrismaClient) => Promise<void>> = {
  notify_channel: async (action, context, _db) => {
    const { channelId, message } = action.config as { channelId: string; message: string }
    const resolved = message.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(context[key] ?? ''))
    // Publish via the shared Redis instance when available
    // For automation workers, we import Redis from the queue connection
    const { connection } = await import('../jobs/queues/index.js')
    const { default: Redis } = await import('ioredis')
    // Bug fix (found via tsc): `connection` is typed as BullMQ's
    // `ConnectionOptions`, a union that also includes an
    // already-connected-client shape (`IRedisClient`) — ioredis's own
    // constructor wants specifically its `RedisOptions` shape, and TS
    // won't narrow a union type down for a stricter parameter without
    // help. The actual object (host/port/password/username/tls/
    // maxRetriesPerRequest/enableReadyCheck, built in jobs/queues/
    // index.ts) is valid ioredis constructor options as-is; this is a
    // type-level mismatch between two libraries' overlapping option
    // shapes, not a real runtime issue. (ConstructorParameters<typeof
    // Redis>[0] doesn't work here since Redis comes from a dynamic
    // import — it resolves to a 0-length tuple — so casting straight to
    // the named RedisOptions type instead.)
    const redis = new Redis(connection as RedisOptions)
    try {
      await redis.publish(`ws:channel:${channelId}`, JSON.stringify({
        event: 'message.created',
        data: { id: `auto-${Date.now()}`, channelId, content: `[Automation] ${resolved}`, authorId: 'system', createdAt: new Date().toISOString(), author: { id: 'system', name: 'CollabOS Automation', avatarUrl: null }, reactions: [], attachments: [] },
      }))
    } finally {
      await redis.quit()
    }
  },

  update_field: async (action, context, _db) => {
    logger.info({ action, context }, 'Automation: update_field (implement per field type)')
  },

  send_email: async (action, _context, db) => {
    const { userId, template } = action.config as { userId: string; template: string }
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!user) return
    await enqueueEmail({
      type: template as 'workspace.invite' | 'auth.password_reset' | 'mention.notification' | 'weekly.digest' | 'task.assigned',
      to: user.email,
      data: { name: user.name },
    })
  },
}

export const executeAutomations = async (
  trigger: AutomationTrigger,
  db: PrismaClient,
): Promise<void> => {
  // Query automation rules for this workspace and trigger type
  // NOTE: Automation rules are stored in a JSON settings field on workspace until
  // a dedicated automations table is added. This allows shipping without a migration.
  const workspace = await db.workspace.findUnique({
    where: { id: trigger.workspaceId },
    select: { settings: true },
  })

  if (!workspace) return

  const settings = workspace.settings as Record<string, unknown>
  const rules = (settings['automations'] as AutomationRule[] | undefined) ?? []
  const matchingRules = rules.filter((r) => r.enabled && r.trigger === trigger.type)

  if (matchingRules.length === 0) return

  logger.info({ triggerType: trigger.type, rulesCount: matchingRules.length, workspaceId: trigger.workspaceId }, 'Running automation rules')

  const context: Record<string, unknown> = { ...trigger }

  for (const rule of matchingRules) {
    for (const action of rule.actions) {
      try {
        const executor = executors[action.type]
        if (executor) {
          await executor(action, context, db)
          logger.debug({ ruleId: rule.id, actionType: action.type }, 'Automation action executed')
        }
      } catch (err) {
        logger.error({ err, ruleId: rule.id, actionType: action.type }, 'Automation action failed')
      }
    }
  }
}
