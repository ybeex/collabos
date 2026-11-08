import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CacheService, cacheKeys, CACHE_TTL } from '../../plugins/cache.js'

const makeMockRedis = () => {
  const store = new Map<string, { value: string; ttl: number }>()
  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    setex: vi.fn(async (key: string, ttl: number, value: string) => { store.set(key, { value, ttl }) }),
    del: vi.fn(async (...keys: string[]) => { keys.forEach((k) => store.delete(k)); return keys.length }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '')
      return [...store.keys()].filter((k) => k.startsWith(prefix))
    }),
    // Bug fix (found by actually running the suite): CacheService.delPattern
    // deliberately uses SCAN over KEYS (see the comment on it in
    // plugins/cache.ts — KEYS blocks the Redis event loop on large
    // keyspaces), but this mock never implemented `scan` at all, so
    // every test exercising delPattern/invalidateWorkspace failed with
    // "this.redis.scan is not a function." The production code was
    // right; the mock was incomplete. Single-pass mock (test stores are
    // tiny) that mimics ioredis's cursor-based SCAN result shape
    // ([nextCursor, keys]) closely enough for delPattern's cursor loop
    // to terminate after one iteration.
    scan: vi.fn(async (_cursor: string, _matchKw: string, pattern: string, ..._rest: string[]) => {
      const prefix = pattern.replace('*', '')
      const matched = [...store.keys()].filter((k) => k.startsWith(prefix))
      return ['0', matched] as [string, string[]]
    }),
    store,
  }
}

describe('CacheService', () => {
  let redis: ReturnType<typeof makeMockRedis>
  let cache: CacheService

  beforeEach(() => {
    redis = makeMockRedis()
    cache = new CacheService(redis as never)
  })

  it('get returns null for missing key', async () => {
    expect(await cache.get('missing')).toBeNull()
  })

  it('set and get round-trip JSON correctly', async () => {
    const value = { id: '123', name: 'test', nested: { a: 1 } }
    await cache.set('key1', value, 60)
    const result = await cache.get<typeof value>('key1')
    expect(result).toEqual(value)
  })

  it('set stores with correct TTL', async () => {
    await cache.set('key2', { x: 1 }, 300)
    expect(redis.setex).toHaveBeenCalledWith('key2', 300, expect.any(String))
    expect(redis.store.get('key2')?.ttl).toBe(300)
  })

  it('del removes key', async () => {
    await cache.set('key3', 'data', 60)
    await cache.del('key3')
    expect(await cache.get('key3')).toBeNull()
  })

  it('getOrSet returns cached value on second call without calling fetcher', async () => {
    const fetcher = vi.fn(async () => ({ fresh: true }))
    const first = await cache.getOrSet('key4', 60, fetcher)
    const second = await cache.getOrSet('key4', 60, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
  })

  it('getOrSet calls fetcher when cache is empty', async () => {
    const fetcher = vi.fn(async () => 'fetched-value')
    const result = await cache.getOrSet('key5', 60, fetcher)
    expect(result).toBe('fetched-value')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('delPattern removes all matching keys', async () => {
    await cache.set('workspace:ws1:meta', 'a', 60)
    await cache.set('workspace:ws1:channels', 'b', 60)
    await cache.set('workspace:ws2:meta', 'c', 60)
    await cache.delPattern('workspace:ws1:*')
    expect(await cache.get('workspace:ws1:meta')).toBeNull()
    expect(await cache.get('workspace:ws1:channels')).toBeNull()
    expect(await cache.get('workspace:ws2:meta')).not.toBeNull()
  })

  it('invalidateWorkspace clears all workspace keys', async () => {
    await cache.set(`workspace:ws99:meta`, 'x', 60)
    await cache.set(`workspace:ws99:members`, 'y', 60)
    await cache.invalidateWorkspace('ws99')
    expect(await cache.get(`workspace:ws99:meta`)).toBeNull()
    expect(await cache.get(`workspace:ws99:members`)).toBeNull()
  })
})

describe('cacheKeys', () => {
  it('generates correct key patterns', () => {
    expect(cacheKeys.workspace('abc')).toBe('workspace:abc:meta')
    expect(cacheKeys.userProfile('xyz')).toBe('user:xyz:profile')
    expect(cacheKeys.workspaceChannels('ws1')).toBe('workspace:ws1:channels')
  })
})

describe('CACHE_TTL', () => {
  it('has expected values', () => {
    expect(CACHE_TTL.SHORT).toBe(60)
    expect(CACHE_TTL.MEDIUM).toBe(300)
    expect(CACHE_TTL.LONG).toBe(3600)
    expect(CACHE_TTL.DAY).toBe(86400)
  })
})
