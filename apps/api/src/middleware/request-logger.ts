import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import { logger } from '../utils/logger.js'
import { recordRequest } from '../routes/metrics/index.js'

export const requestLogger = (
  req: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void => {
  const start = Date.now()

  req.raw.on('end', () => {
    const statusCode = req.raw.statusCode ?? 200
    const duration = Date.now() - start
    const route = req.routeOptions?.url ?? req.url

    logger.info({
      requestId: req.id,
      method: req.method,
      url: req.url,
      route,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }, 'Request completed')

    // Record Prometheus metrics
    recordRequest(req.method, route, statusCode, duration)
  })

  done()
}
