import { describe, it, expect } from 'vitest'
import {
  AppError, NotFoundError, UnauthorizedError,
  ForbiddenError, ConflictError, ValidationError,
} from '../errors.js'

describe('error classes', () => {
  it('AppError has correct shape', () => {
    const err = new AppError(500, 'TEST', 'test message', { detail: 1 })
    expect(err.statusCode).toBe(500)
    expect(err.code).toBe('TEST')
    expect(err.message).toBe('test message')
    expect(err.details).toEqual({ detail: 1 })
    expect(err instanceof Error).toBe(true)
  })

  it('NotFoundError uses 404', () => {
    const err = new NotFoundError('User', 'user-123')
    expect(err.statusCode).toBe(404)
    expect(err.message).toContain('user-123')
    expect(err.code).toBe('NOT_FOUND')
  })

  it('UnauthorizedError uses 401', () => {
    const err = new UnauthorizedError()
    expect(err.statusCode).toBe(401)
  })

  it('ForbiddenError uses 403', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
  })

  it('ConflictError uses 409', () => {
    const err = new ConflictError('already exists')
    expect(err.statusCode).toBe(409)
  })

  it('ValidationError uses 422', () => {
    const err = new ValidationError('invalid input', [{ field: 'email' }])
    expect(err.statusCode).toBe(422)
    expect(err.details).toEqual([{ field: 'email' }])
  })
})
