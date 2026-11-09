import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PresenceService } from '../presence.js'

const makeMockRedis = () => {
  const store = new Map<string, Record<string, string>>()
  return {
    hset: vi.fn(async (key: string, data: Record<string, string> | string) => {
      if (typeof data === 'string') {
        store.set(key, { ...(store.get(key) ?? {}), status: data })
      } else {
        store.set(key, { ...(store.get(key) ?? {}), ...data })
      }
    }),
    hgetall: vi.fn(async (key: string) => store.get(key) ?? null),
    expire: vi.fn(async () => {}),
    pipeline: vi.fn(() => ({ hgetall: vi.fn(), exec: vi.fn(async () => []) })),
    store,
  }
}

describe('PresenceService', () => {
  let redis: ReturnType<typeof makeMockRedis>
  let service: PresenceService

  beforeEach(() => {
    redis = makeMockRedis()
    service = new PresenceService(redis as never)
  })

  it('setPresence stores data in redis hash', async () => {
    await service.setPresence('user1', { status: 'online', workspaceId: 'ws1' })
    expect(redis.hset).toHaveBeenCalledWith('presence:user1', expect.objectContaining({ status: 'online', workspaceId: 'ws1' }))
  })

  it('setPresence sets TTL of 300s', async () => {
    await service.setPresence('user2', { status: 'online', workspaceId: 'ws1' })
    expect(redis.expire).toHaveBeenCalledWith('presence:user2', 300)
  })

  it('getPresence returns null for unknown user', async () => {
    const result = await service.getPresence('unknown-user')
    expect(result).toBeNull()
  })

  it('getPresence returns stored data', async () => {
    redis.store.set('presence:user3', { status: 'online', workspaceId: 'ws1', lastSeen: '2024-01-01T00:00:00Z' })
    const result = await service.getPresence('user3')
    expect(result?.status).toBe('online')
    expect(result?.workspaceId).toBe('ws1')
  })

  it('markOffline sets status to offline', async () => {
    await service.markOffline('user4')
    // Bug fix (found by actually running the suite): this asserted a
    // 2-arg hset('presence:user4', 'offline') call, but the real Redis
    // HSET command needs field-value pairs — presence.ts's markOffline
    // has always correctly called hset(key, 'status', 'offline') (3
    // args). The test's own mock even already special-cased a 2-arg
    // string form to make this pass, which no real call site uses. The
    // assertion was wrong, not the implementation.
    expect(redis.hset).toHaveBeenCalledWith('presence:user4', 'status', 'offline')
  })
})
