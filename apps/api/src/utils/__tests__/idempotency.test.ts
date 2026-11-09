import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkIdempotency, saveIdempotencyResult } from '../idempotency.js'

const makeMockRedis = () => {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => { store.set(key, value) }),
    store,
  }
}

describe('idempotency utils', () => {
  let redis: ReturnType<typeof makeMockRedis>

  beforeEach(() => {
    redis = makeMockRedis()
  })

  it('returns null for unknown key', async () => {
    const result = await checkIdempotency(redis as never, 'unknown-key')
    expect(result).toBeNull()
  })

  it('saves and retrieves idempotency record', async () => {
    await saveIdempotencyResult(redis as never, 'key-1', 201, { id: 'abc' })
    const result = await checkIdempotency(redis as never, 'key-1')
    expect(result).not.toBeNull()
    expect(result?.statusCode).toBe(201)
    expect(result?.body).toEqual({ id: 'abc' })
    expect(result?.createdAt).toBeTruthy()
  })

  it('setex is called with 24h TTL', async () => {
    await saveIdempotencyResult(redis as never, 'key-2', 200, {})
    expect(redis.setex).toHaveBeenCalledWith(
      'idempotency:key-2',
      86400,
      expect.any(String),
    )
  })
})
