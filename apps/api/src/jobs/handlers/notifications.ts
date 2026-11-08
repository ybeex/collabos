/**
 * Notification handler — processes mention and thread reply notifications.
 * Uses the BullMQ email queue (not raw Redis lpush) for proper retry/DLQ.
 */
import type { PrismaClient } from '@prisma/client'
import { logger } from '../../utils/logger.js'
import { enqueueEmail } from '../queues/index.js'

interface MentionJob {
  type: string
  messageId: string
  channelId: string
  content: string
  authorId: string
  workspaceId: string
}

const extractMentions = (content: string): string[] => {
  const matches = content.match(/@([a-zA-Z0-9._-]+)/g) ?? []
  return matches.map((m) => m.slice(1))
}

const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'

export const processNotification = async (
  job: Record<string, unknown>,
  db: PrismaClient,
): Promise<void> => {
  // Bug fix (found via tsc): same 'convert to unknown first' pattern as
  // jobs/queues/worker-registry.ts's cast the other direction — this
  // project's local {}Job interfaces are closed shapes that don't
  // structurally overlap with Record<string, unknown> under strict mode.
  const { messageId, channelId, content, authorId, workspaceId } = job as unknown as MentionJob

  const mentioned = extractMentions(content)
  if (mentioned.length === 0) return

  const [author, channel, members] = await Promise.all([
    db.user.findUnique({ where: { id: authorId }, select: { name: true } }),
    db.channel.findUnique({ where: { id: channelId }, select: { name: true, workspaceId: true } }),
    db.channelMember.findMany({
      where: {
        channelId,
        user: { name: { in: mentioned } },
        userId: { not: authorId },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ])

  if (!members.length || !author || !channel) return

  logger.debug({ messageId, mentionCount: members.length }, 'Processing mention notifications')

  const messageUrl = `${appUrl}/${workspaceId}/channels/${channelId}?msg=${messageId}`
  const preview = content.slice(0, 150)

  // Store in-app notifications
  await db.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      workspaceId,
      type: 'mention' as const,
      title: `${author.name} mentioned you`,
      body: preview,
      entityType: 'message',
      entityId: messageId,
      entityUrl: messageUrl,
    })),
    skipDuplicates: true,
  })

  // Queue email notifications via BullMQ (not raw lpush)
  // Check user notification preferences before sending
  const userPrefs = await db.userNotificationPrefs.findMany({
    where: { userId: { in: members.map((m) => m.userId) } },
    select: { userId: true, mentions: true, emailNotifications: true },
  })

  // Bug fix (found via tsc): without an explicit type argument, `new
  // Map(userPrefs.map((p) => [p.userId, p]))` doesn't reliably infer
  // `[string, X]` tuples from a `.map()` callback returning a plain
  // array literal — TS widens it and the Map's value type can collapse
  // to `{}`, which then can't be indexed by `.mentions`/
  // `.emailNotifications` below. Explicit generic matches exactly what
  // the `select` clause above actually queries.
  const prefMap = new Map<string, { userId: string; mentions: boolean; emailNotifications: boolean }>(
    userPrefs.map((p) => [p.userId, p]),
  )

  const emailJobs = members
    .filter((m) => {
      const pref = prefMap.get(m.userId)
      // Default: send if no preference row exists, or both mentions + email enabled
      return !pref || (pref.mentions && pref.emailNotifications)
    })
    .map((m) =>
      enqueueEmail({
        type: 'mention.notification',
        to: m.user.email,
        data: {
          mentionerName: author.name,
          channelName: channel.name,
          messageUrl,
          preview,
        },
      }),
    )

  await Promise.allSettled(emailJobs)
  logger.debug({ messageId, emailsSent: emailJobs.length }, 'Mention notifications queued')
}
