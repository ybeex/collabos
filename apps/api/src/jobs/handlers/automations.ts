import type { PrismaClient } from '@prisma/client'
import { executeAutomations } from '../../services/automations.js'
import { logger } from '../../utils/logger.js'

export const processAutomation = async (
  job: Record<string, unknown>,
  db: PrismaClient,
): Promise<void> => {
  const { type, workspaceId } = job as { type: string; workspaceId: string }
  logger.debug({ type, workspaceId }, 'Processing automation trigger')
  await executeAutomations(job as { type: string; workspaceId: string }, db)
}
