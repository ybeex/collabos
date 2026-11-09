import { describe, it, expect, vi } from 'vitest'
import { slugify, truncate, formatBytes, isValidUrl, retryWithBackoff, debounce } from '../utils/index'

describe('slugify', () => {
  it('converts to lowercase', () => expect(slugify('Hello World')).toBe('hello-world'))
  it('replaces spaces with hyphens', () => expect(slugify('  multiple   spaces  ')).toBe('multiple-spaces'))
  it('removes special characters', () => expect(slugify('Hello! World?')).toBe('hello-world'))
  it('collapses multiple hyphens', () => expect(slugify('a---b')).toBe('a-b'))
  it('trims leading/trailing hyphens', () => expect(slugify('-hello-')).toBe('hello'))
  it('handles empty string', () => expect(slugify('')).toBe(''))
  it('handles numbers', () => expect(slugify('My Team 42')).toBe('my-team-42'))
})

describe('truncate', () => {
  it('returns string unchanged if within length', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })
  it('truncates with ellipsis when over length', () => {
    const result = truncate('hello world', 5)
    expect(result).toBe('hello...')
    expect(result.length).toBe(8)
  })
  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })
})

describe('formatBytes', () => {
  it('formats 0 bytes', () => expect(formatBytes(0)).toBe('0 B'))
  it('formats bytes', () => expect(formatBytes(500)).toBe('500 B'))
  it('formats kilobytes', () => expect(formatBytes(1024)).toBe('1 KB'))
  it('formats megabytes', () => expect(formatBytes(1024 * 1024)).toBe('1 MB'))
  it('formats gigabytes', () => expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB'))
  it('respects decimal places', () => {
    expect(formatBytes(1500, 1)).toBe('1.5 KB')
  })
})

describe('isValidUrl', () => {
  it('accepts valid https URL', () => expect(isValidUrl('https://example.com')).toBe(true))
  it('accepts valid http URL', () => expect(isValidUrl('http://localhost:3000')).toBe(true))
  it('rejects invalid URL', () => expect(isValidUrl('not a url')).toBe(false))
  it('rejects empty string', () => expect(isValidUrl('')).toBe(false))
  it('accepts URL with path and query', () => {
    expect(isValidUrl('https://api.example.com/v1/users?page=2')).toBe(true)
  })
})

describe('retryWithBackoff', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await retryWithBackoff(fn, 3, 0)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')
    const result = await retryWithBackoff(fn, 3, 0)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))
    await expect(retryWithBackoff(fn, 2, 0)).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('debounce', () => {
  it('calls function after delay', async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
