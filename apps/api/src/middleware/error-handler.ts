import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { monitoring } from '../utils/monitoring.js'

interface ErrorResponse {
  statusCode: number
  error: string
  message: string
  code: string
  details?: unknown
  requestId: string
}

export const errorHandler = (
  error: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
): void => {
  const requestId = req.id

  if (error instanceof AppError) {
    logger.warn({ requestId, code: error.code, statusCode: error.statusCode }, error.message)
    const response: ErrorResponse = {
      statusCode: error.statusCode,
      error: error.code,
      message: error.message,
      code: error.code,
      requestId,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
    reply.status(error.statusCode).send(response)
    return
  }

  // Bug fix (found while investigating a reported 500 on /v1/auth/refresh):
  // every route in this codebase validates its body/query/params with a
  // direct zod `schema.parse(...)` call (62 call sites across
  // apps/api/src/routes) rather than passing a schema through Fastify's
  // own route-level validation — so on bad input, what's actually thrown
  // is a raw ZodError. That error is not `instanceof AppError`, has no
  // Fastify `.validation` property (that's specifically AJV-based
  // schema validation, a different mechanism this codebase doesn't use),
  // and has no `.statusCode`. It fell through every special case below
  // straight into the generic "unexpected error" branch — turning any
  // malformed request, anywhere in the API, into an opaque 500 instead
  // of a proper 400 with the actual validation problem. This was
  // probably at least part of what surfaced as the reported refresh
  // 500 — a malformed or empty body reaching refreshSchema.parse would
  // hit exactly this path.
  if (error instanceof ZodError) {
    logger.warn({ requestId, issues: error.issues }, 'Request validation failed')
    reply.status(400).send({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      details: error.issues,
      requestId,
    })
    return
  }

  if (error.validation) {
    logger.warn({ requestId, validation: error.validation }, 'Validation error')
    reply.status(422).send({ statusCode: 422, error: 'VALIDATION_ERROR', message: 'Request validation failed', code: 'VALIDATION_ERROR', details: error.validation, requestId })
    return
  }

  if (error.statusCode === 400) {
    reply.status(400).send({ statusCode: 400, error: 'BAD_REQUEST', message: error.message, code: 'BAD_REQUEST', requestId })
    return
  }

  // Unexpected — capture in monitoring
  logger.error({ requestId, err: error, stack: error.stack }, 'Unexpected server error')
  monitoring.captureException(error, { requestId, url: req.url, method: req.method }).catch(() => {})

  reply.status(500).send({ statusCode: 500, error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred', code: 'INTERNAL_SERVER_ERROR', requestId })
}
