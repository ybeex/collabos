import type { Redis } from 'ioredis'

export const CACHE_TTL = {
  SHORT: 60,          // 1 min — presence data, active users
  MEDIUM: 300,        // 5 min — workspace metadata, channel lists
  LONG: 3600,         // 1 hour — user profiles, plan info
  DAY: 86400,         // 24 hours — search index data
} as const

export class CacheService {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key)
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value))
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  /**
   * Pattern-based deletion using SCAN instead of KEYS.
   * KEYS is O(N) and blocks the Redis event loop on large keyspaces.
   * SCAN is O(1) per call and non-blocking, returning results in batches.
   */
  async delPattern(pattern: string): Promise<void> {
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', '100',
      )
      cursor = nextCursor
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } while (cursor !== '0')
  }

  async getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached
    const fresh = await fetcher()
    await this.set(key, fresh, ttl)
    return fresh
  }

  async invalidateWorkspace(workspaceId: string): Promise<void> {
    await this.delPattern(`workspace:${workspaceId}:*`)
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.delPattern(`user:${userId}:*`)
  }
}

export const cacheKeys = {
  workspace: (id: string) => `workspace:${id}:meta`,
  workspaceChannels: (id: string) => `workspace:${id}:channels`,
  workspaceMembers: (id: string) => `workspace:${id}:members`,
  userProfile: (id: string) => `user:${id}:profile`,
  userWorkspaces: (id: string) => `user:${id}:workspaces`,
  channelMessages: (id: string, cursor: string) => `channel:${id}:msgs:${cursor}`,
  taskList: (projectId: string, hash: string) => `tasks:${projectId}:${hash}`,
  rateLimitTier: (userId: string) => `ratelimit:tier:${userId}`,
} as const
