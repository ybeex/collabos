/**
 * PRD_AUDIT.md Finding #7: right-to-erasure implementation. PRD §19
 * specifies "Right-to-erasure API endpoint for GDPR compliance" — this
 * did not exist in any form before this fix.
 *
 * Design decision, stated explicitly rather than left implicit: this is
 * ANONYMIZATION, not hard deletion of every row the user ever touched.
 * A user's messages, task comments, and document edits are referenced
 * by other people's content (threads, task histories, Work Graph edges)
 * — hard-deleting those rows would break referential integrity for
 * every OTHER user who participated in that content, which is a worse
 * outcome than the erasure itself. GDPR's right to erasure is
 * satisfied by removing personally identifying information, not by
 * requiring the platform to delete content jointly created with others.
 * This mirrors how every major platform (Slack, GitHub, etc.) actually
 * implements "delete my account" in practice.
 *
 * What this does:
 *   - Overwrites name, email, avatarUrl with anonymized placeholders
 *   - Overwrites passwordHash with an unusable value (login impossible)
 *   - Sets deletedAt (existing soft-delete field, now meaning "erased"
 *     for a user row specifically, distinct from a workspace's own
 *     deletedAt/suspendedAt semantics documented elsewhere in this schema)
 *   - Leaves messages/tasks/documents/comments the user created in place
 *     — their content survives, attributed to "Deleted User" — since
 *     erasing THOSE would erase other people's conversations and work
 *     history along with them
 *   - Records the request in ErasureRequest for audit purposes
 */
import type { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'
import { logger } from '../utils/logger.js'

const ANONYMIZED_NAME = 'Deleted User'

export const processErasureRequest = async (
  db: PrismaClient,
  userId: string,
  requesterEmail: string,
): Promise<{ requestId: string; status: 'completed' | 'failed' }> => {
  const requestId = nanoid(21)

  await db.erasureRequest.create({
    data: { id: requestId, userId, requesterEmail, status: 'pending' },
  })

  try {
    // Anonymized email must remain unique (the column has a unique
    // constraint) — suffixing with the erasure request's own id
    // guarantees uniqueness without needing a second lookup/retry loop.
    const anonymizedEmail = `erased-${requestId}@deleted.invalid`

    await db.user.update({
      where: { id: userId },
      data: {
        name: ANONYMIZED_NAME,
        email: anonymizedEmail,
        avatarUrl: null,
        // Unusable hash — same pattern already used for SSO/SCIM-
        // provisioned users elsewhere in this codebase (a value no
        // password could ever hash to), not a weak or predictable one.
        passwordHash: `erased:${requestId}:${nanoid(32)}`,
        deletedAt: new Date(),
      },
    })

    await db.erasureRequest.update({
      where: { id: requestId },
      data: { status: 'completed', completedAt: new Date() },
    })

    logger.info({ requestId, userId }, 'GDPR erasure request completed')
    return { requestId, status: 'completed' }
  } catch (err) {
    await db.erasureRequest.update({
      where: { id: requestId },
      data: { status: 'failed', notes: err instanceof Error ? err.message : String(err) },
    })
    logger.error({ err, requestId, userId }, 'GDPR erasure request failed')
    return { requestId, status: 'failed' }
  }
}
