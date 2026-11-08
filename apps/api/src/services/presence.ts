import type { Redis } from 'ioredis'

export interface PresenceData {
  status: 'online' | 'away' | 'offline'
  workspaceId: string
  activeChannel?: string
  activePage?: string
  lastSeen: string
}

const PRESENCE_TTL = 300 // 5 minutes — refreshed by WS ping

export class PresenceService {
  constructor(private readonly redis: Redis) {}

  async setPresence(userId: string, data: Partial<PresenceData>): Promise<void> {
    const key = `presence:${userId}`
    const existing = await this.getPresence(userId)
    const merged: PresenceData = {
      status: 'online',
      workspaceId: '',
      lastSeen: new Date().toISOString(),
      ...existing,
      ...data,
    }
    // Bug fix (found via tsc, but a real runtime issue too, not just a
    // type-safety nitpick): `activeChannel`/`activePage` are optional on
    // PresenceData, so `merged` can carry `undefined` values for them.
    // Casting straight to Record<string, string> papered over that at
    // the type level, but passing `undefined` into ioredis's object-form
    // HSET either stringifies it to the literal string "undefined" or
    // throws, depending on version — neither is "field not set," which
    // is what an absent activeChannel/activePage should mean. Filtering
    // undefined out before the hset call is both the type-correct fix
    // and the actually-correct behavior.
    const toStore = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined),
    ) as Record<string, string>
    await this.redis.hset(key, toStore)
    await this.redis.expire(key, PRESENCE_TTL)
  }

  async getPresence(userId: string): Promise<PresenceData | null> {
    const data = await this.redis.hgetall(`presence:${userId}`)
    if (!data || Object.keys(data).length === 0) return null
    return data as unknown as PresenceData
  }

  async getWorkspacePresence(
    userIds: string[],
  ): Promise<Record<string, PresenceData>> {
    if (userIds.length === 0) return {}

    const pipeline = this.redis.pipeline()
    for (const uid of userIds) {
      pipeline.hgetall(`presence:${uid}`)
    }

    const results = await pipeline.exec()
    const presence: Record<string, PresenceData> = {}

    userIds.forEach((uid, idx) => {
      const data = results?.[idx]?.[1] as Record<string, string> | null
      if (data && Object.keys(data).length > 0) {
        presence[uid] = data as unknown as PresenceData
      } else {
        presence[uid] = {
          status: 'offline',
          workspaceId: '',
          lastSeen: new Date(0).toISOString(),
        }
      }
    })

    return presence
  }

  async markOffline(userId: string): Promise<void> {
    await this.redis.hset(`presence:${userId}`, 'status', 'offline')
    // Keep the key for lastSeen tracking but let it expire naturally
  }
}
