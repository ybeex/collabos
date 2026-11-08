import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor, buildPaginatedResult } from '../cursor.js'

describe('cursor pagination', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('round-trips a cursor correctly', () => {
      const values = { id: 'abc123', createdAt: '2024-01-01T00:00:00Z' }
      const encoded = encodeCursor(values)
      expect(typeof encoded).toBe('string')
      expect(encoded).not.toContain('=') // base64url has no padding
      const decoded = decodeCursor(encoded)
      expect(decoded).toEqual(values)
    })

    it('throws on invalid cursor', () => {
      expect(() => decodeCursor('not-valid-base64!!!')).toThrow('Invalid pagination cursor')
    })
  })

  describe('buildPaginatedResult', () => {
    const makeItems = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `item-${i}`, createdAt: new Date() }))

    it('returns hasNextPage=false when items <= limit', () => {
      const result = buildPaginatedResult(makeItems(5), 10, (i) => ({ id: i.id }))
      expect(result.meta.hasNextPage).toBe(false)
      expect(result.data).toHaveLength(5)
    })

    it('returns hasNextPage=true when items > limit', () => {
      const items = makeItems(11) // limit + 1
      const result = buildPaginatedResult(items, 10, (i) => ({ id: i.id }))
      expect(result.meta.hasNextPage).toBe(true)
      expect(result.data).toHaveLength(10) // trimmed to limit
    })

    it('provides a nextCursor when more pages exist', () => {
      const items = makeItems(11)
      const result = buildPaginatedResult(items, 10, (i) => ({ id: i.id }))
      expect(result.meta.nextCursor).toBeTruthy()
      expect(typeof result.meta.nextCursor).toBe('string')
    })

    it('returns null nextCursor on last page', () => {
      const result = buildPaginatedResult(makeItems(3), 10, (i) => ({ id: i.id }))
      expect(result.meta.nextCursor).toBeNull()
    })
  })
})
