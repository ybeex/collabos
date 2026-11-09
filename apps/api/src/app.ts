import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import websocket from '@fastify/websocket'
import multipart from '@fastify/multipart'
// Bug fix (found while fixing the SAML signature-verification gap in
// routes/sso/index.ts): the SAML HTTP-POST binding — what real IdPs
// actually use to deliver the login response to the ACS callback — sends
// `Content-Type: application/x-www-form-urlencoded`. Nothing anywhere in
// this app registered a parser for that content type (Fastify's built-ins
// only cover application/json and text/plain), so a real IdP's callback
// POST would never have parsed into a usable body at all — this endpoint
// could not have worked end-to-end before this fix, independent of the
// signature-verification gap.
import formbody from '@fastify/formbody'

import { env } from './utils/env.js'
import { logger } from './utils/logger.js'
import { redisPlugin } from './plugins/redis.js'
import { dbPlugin } from './plugins/db.js'
import { authMiddleware } from './middleware/auth.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'

// Core routes
import { authRoutes } from './routes/auth/index.js'
import { workspaceRoutes } from './routes/workspaces/index.js'
import { channelRoutes } from './routes/channels/index.js'
import { messageRoutes } from './routes/messages/index.js'
import { docRoutes } from './routes/docs/index.js'
import { taskRoutes } from './routes/tasks/index.js'
import { canvasRoutes } from './routes/canvas/index.js'
import { aiRoutes } from './routes/ai/index.js'
import { graphRoutes } from './routes/graph/index.js'
import { searchRoutes } from './routes/search/index.js'
import { uploadRoutes } from './routes/upload/index.js'
import { websocketRoutes, subscribeToForceDisconnects } from './routes/ws/index.js'
import { threadRoutes } from './routes/threads/index.js'
import { adminRoutes } from './routes/admin/index.js'
import { superAdminRoutes } from './routes/super-admin/index.js'

// New feature routes
import { ssoRoutes } from './routes/sso/index.js'
import { scimRoutes } from './routes/scim/index.js'
import { notificationRoutes } from './routes/notifications/index.js'
import { bookmarkRoutes } from './routes/bookmarks/index.js'
import { apiKeyRoutes } from './routes/apikeys/index.js'
import { webhookRoutes } from './routes/webhooks/index.js'
import { videoRoutes } from './routes/video/index.js'
import { metricsRoutes } from './routes/metrics/index.js'
import { documentRoute, openApiSchemas } from './openapi.js'

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false,
    // Remote database providers can need more than Fastify's 10s default
    // during cold start; keep the startup connection check bounded.
    pluginTimeout: 30_000,
    trustProxy: true,
    ajv: { customOptions: { strict: 'log', keywords: ['kind', 'modifier'] } },
  })

  // ── Security headers ──────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:', env.LIVEKIT_URL],
        mediaSrc: ["'self'", 'blob:'],
        ...(env.CSP_REPORT_URI ? { reportUri: [env.CSP_REPORT_URI] } : {}),
      },
    },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false, // needed for LiveKit
  })

  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  })

  // ── Rate limiting ─────────────────────────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? req.ip,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded. Retry in ${Math.ceil(context.ttl / 1000)}s.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  })

  // ── JWT ───────────────────────────────────────────────────────────────────
  // Bug fix (found via `npm audit`): @fastify/jwt <=9.1.0 depends on
  // fast-jwt <=6.2.3, which has multiple CVEs — including a JWT
  // algorithm-confusion issue (incomplete fix for CVE-2023-48223,
  // whitespace-prefixed RSA public keys) directly relevant to this app's
  // RS256 configuration. Bumped to 10.2.2 (pins fast-jwt ^6.2.4, past the
  // fixed boundary). Verified before upgrading: the only documented
  // breaking changes for this package were in the 3.x→4.0 migration
  // (renamed sign/verify option keys — audience/issuer/jwtid/subject/
  // keyId — none of which this app uses), and the v10 type surface is a
  // refactor of the same call signatures (jwtSign/jwtVerify/req.user),
  // not a functional change, confirmed by diffing the published type
  // definitions between versions.
  await app.register(jwt, {
    secret: { private: env.JWT_PRIVATE_KEY, public: env.JWT_PUBLIC_KEY },
    sign: { algorithm: 'RS256', expiresIn: '15m' },
    verify: { algorithms: ['RS256'] },
  })

  // ── WebSocket + File uploads ──────────────────────────────────────────────
  await app.register(websocket)
  await app.register(multipart, {
    limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 10 },
  })
  await app.register(formbody)

  // ── API docs (dev only) ───────────────────────────────────────────────────
  if (env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      transform: documentRoute,
      openapi: {
        info: { title: 'CollabOS API', description: 'Unified real-time collaboration platform', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token returned by /v1/auth/login or /v1/auth/refresh.' },
            scimBearerAuth: { type: 'http', scheme: 'bearer', description: 'Workspace SCIM provisioning token.' },
          },
          schemas: openApiSchemas,
        },
        servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local API server' }],
        security: [{ bearerAuth: [] }],
      },
    })
    await app.register(swaggerUi, { routePrefix: '/docs' }) // Bug fix (npm audit): @fastify/swagger-ui bumped to 6.1.1 — <=6.1.0 pulled in a vulnerable @fastify/static (auth bypass via non-canonical paths, path-traversal route-guard bypass). Usage here is the minimal `{ routePrefix }` form, unchanged across the major bump.
  }

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(redisPlugin)
  await app.register(dbPlugin)

  // ── Hooks ─────────────────────────────────────────────────────────────────
  app.addHook('onRequest', requestLogger)
  app.setErrorHandler(errorHandler)
  app.decorate('authenticate', authMiddleware)

  // ── Health + metrics (no auth) ────────────────────────────────────────────
  app.get('/health', {
    config: { rateLimit: { max: 1000 } },
    schema: { hide: true },
    handler: async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
    }),
  })

  await app.register(metricsRoutes)

  // ── Core API routes ───────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/v1/auth' })
  await app.register(workspaceRoutes, { prefix: '/v1/workspaces' })
  await app.register(channelRoutes, { prefix: '/v1/channels' })
  await app.register(messageRoutes, { prefix: '/v1/messages' })
  await app.register(docRoutes, { prefix: '/v1/docs' })
  await app.register(taskRoutes, { prefix: '/v1/tasks' })
  await app.register(canvasRoutes, { prefix: '/v1/canvases' })
  await app.register(aiRoutes, { prefix: '/v1/ai' })
  await app.register(graphRoutes, { prefix: '/v1/graph' })
  await app.register(searchRoutes, { prefix: '/v1/search' })
  await app.register(uploadRoutes, { prefix: '/v1/upload' })
  await app.register(websocketRoutes, { prefix: '/v1/ws' })
  // Super admin dashboard feature: subscribe this replica to cross-replica
  // force-disconnect events, so a workspace suspension issued on any one
  // replica immediately disconnects that workspace's members regardless
  // of which replica they're connected to. Must run after websocketRoutes
  // has registered (it needs the route's exported subscribe function) and
  // after redisPlugin (it needs app.redis to exist).
  subscribeToForceDisconnects(app)
  await app.register(threadRoutes, { prefix: '/v1/threads' })
  await app.register(adminRoutes, { prefix: '/v1/admin' })
  // Deliberately separate prefix and route file from adminRoutes above —
  // /v1/admin is workspace-scoped (an owner managing their own workspace),
  // /v1/super-admin is platform-scoped (an operator managing every
  // workspace and user on the deployment). See routes/super-admin/index.ts
  // module comment for the full rationale.
  await app.register(superAdminRoutes, { prefix: '/v1/super-admin' })

  // ── New feature routes ────────────────────────────────────────────────────
  await app.register(ssoRoutes, { prefix: '/v1/sso' })
  await app.register(scimRoutes, { prefix: '/v1/scim' })
  await app.register(notificationRoutes, { prefix: '/v1/notifications' })
  await app.register(bookmarkRoutes, { prefix: '/v1/bookmarks' })
  await app.register(apiKeyRoutes, { prefix: '/v1/apikeys' })
  await app.register(webhookRoutes, { prefix: '/v1/webhooks' })
  await app.register(videoRoutes, { prefix: '/v1/video' })

  await app.ready()
  logger.info({ routeCount: app.printRoutes().split('\n').length }, 'All routes registered')
  return app
}
