import type { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'

interface AuditEntry {
  userId: string
  workspaceId?: string
  action: string
  ipAddress: string
  userAgent: string
  metadata?: Record<string, unknown>
}

/**
 * Immutable audit log service.
 * Records all significant user and admin actions.
 * Never updates or deletes records — append-only.
 */
export class AuditService {
  constructor(private readonly db: PrismaClient) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: {
        id: nanoid(21),
        userId: entry.userId,
        ...(entry.workspaceId !== undefined ? { workspaceId: entry.workspaceId } : {}),
        action: entry.action,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (entry.metadata ?? {}) as any,
      },
    })
  }

  async getForUser(
    userId: string,
    limit = 50,
    cursor?: string,
  ): Promise<{ logs: unknown[]; nextCursor: string | null }> {
    const logs = await this.db.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
      },
    })

    const hasNext = logs.length > limit
    const data = hasNext ? logs.slice(0, limit) : logs

    return {
      logs: data,
      nextCursor: hasNext ? (data[data.length - 1]?.id ?? null) : null,
    }
  }

  async getForWorkspace(
    workspaceId: string,
    limit = 100,
    cursor?: string,
  ): Promise<{ logs: unknown[]; nextCursor: string | null }> {
    const logs = await this.db.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    const hasNext = logs.length > limit
    const data = hasNext ? logs.slice(0, limit) : logs

    return {
      logs: data,
      nextCursor: hasNext ? (data[data.length - 1]?.id ?? null) : null,
    }
  }
}
