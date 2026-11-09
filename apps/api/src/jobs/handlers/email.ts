import type { PrismaClient } from '@prisma/client'
import { sendEmail, emailTemplates } from '../../services/email.js'
import { logger } from '../../utils/logger.js'

interface EmailJob {
  type: string
  to: string
  data: Record<string, unknown>
}

export const processEmail = async (
  job: Record<string, unknown>,
  _db: PrismaClient,
): Promise<void> => {
  // Bug fix (found via tsc): same 'convert to unknown first' pattern as
  // jobs/queues/worker-registry.ts's cast the other direction — this
  // project's local {}Job interfaces are closed shapes that don't
  // structurally overlap with Record<string, unknown> under strict mode.
  const { to, data, type } = job as unknown as EmailJob

  let opts

  if (type === 'workspace.invite') {
    opts = {
      ...emailTemplates.workspaceInvite(data as { workspaceName: string; token: string; inviterName?: string }),
      to,
    }
  } else if (type === 'auth.password_reset') {
    opts = {
      ...emailTemplates.passwordReset(data as { name: string; token: string }),
      to,
    }
  } else if (type === 'mention.notification') {
    opts = {
      ...emailTemplates.mentionNotification(data as { mentionerName: string; channelName: string; messageUrl: string; preview: string }),
      to,
    }
  } else {
    logger.warn({ type }, 'Unknown email job type')
    return
  }

  await sendEmail(opts)
  logger.info({ to, type }, 'Email job processed')
}
