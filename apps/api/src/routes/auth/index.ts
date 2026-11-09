import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import argon2 from 'argon2'
import { nanoid } from 'nanoid'
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors.js'
import { withIdempotency } from '../../utils/idempotency.js'
import { enqueueEmail } from '../../jobs/queues/index.js'
import { CacheService, cacheKeys, CACHE_TTL } from '../../plugins/cache.js'
import type { AuthTokenPair } from '../../types/auth.js'

const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).trim(),
})

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  const cache = new CacheService(app.redis)

  const signTokenPair = async (userId: string, email: string, plan: string, isSuperAdmin: boolean): Promise<AuthTokenPair> => {
    const accessToken = app.jwt.sign({
      sub: userId,
      email,
      plan,
      // Super admin dashboard feature: see types/auth.ts JWTPayload comment
      // for why this is a JWT claim rather than a per-request DB lookup,
      // and why destructive super-admin actions independently re-verify
      // against the database rather than trusting this claim alone.
      isSuperAdmin,
    })

    const jti = nanoid(32)
    // Bug fix (found via tsc, but this is a serious functional bug, not
    // just a type error): the sign-options override was wrapped in a
    // `{ sign: {...} }` envelope — that's the shape used at *plugin
    // registration* (app.register(jwt, { sign: {...} }) in app.ts), not
    // the shape `.sign()` itself takes per-call (just the options
    // object directly). Because `sign` isn't a real SignOptions key, this
    // override did nothing, and the refresh token was silently getting
    // signed with the plugin's registration-time default of 15 minutes
    // instead of the intended 30 days — refresh tokens would have
    // expired almost immediately, far short of the 30-day Redis JTI TTL
    // set right below, breaking persistent sessions.
    const refreshToken = app.jwt.sign(
      { sub: userId, jti },
      { expiresIn: '30d' },
    )

    // Store refresh token JTI in Redis for rotation validation
    await app.redis.setex(
      `refresh:${userId}:${jti}`,
      30 * 24 * 60 * 60,
      '1',
    )

    return { accessToken, refreshToken, expiresIn: 900 } // 15 min
  }

  // ─── POST /v1/auth/register ───────────────────────────────────────
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (req, reply) => {
      return withIdempotency(req, reply, app.redis, async () => {
        const body = registerSchema.parse(req.body)

        const existing = await app.db.user.findUnique({
          where: { email: body.email },
          select: { id: true },
        })

        if (existing) {
          throw new ConflictError('An account with this email already exists')
        }

        const passwordHash = await argon2.hash(body.password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        })

        const user = await app.db.user.create({
          data: {
            id: nanoid(21),
            email: body.email,
            name: body.name,
            passwordHash,
            plan: 'free',
          },
          select: { id: true, email: true, name: true, plan: true, isSuperAdmin: true, createdAt: true },
        })

        const tokens = await signTokenPair(user.id, user.email, user.plan, user.isSuperAdmin)

        // Audit log
        await app.db.auditLog.create({
          data: {
            id: nanoid(21),
            userId: user.id,
            action: 'auth.register',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] ?? '',
            metadata: { email: user.email },
          },
        })

        reply.status(201)
        return { user, ...tokens }
      })
    },
  })

  // ─── POST /v1/auth/login ──────────────────────────────────────────
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    handler: async (req, reply) => {
      const body = loginSchema.parse(req.body)

      const user = await app.db.user.findUnique({
        where: { email: body.email },
        select: { id: true, email: true, name: true, plan: true, passwordHash: true, deletedAt: true, isSuperAdmin: true },
      })

      if (!user || user.deletedAt) {
        throw new UnauthorizedError('Invalid email or password')
      }

      const valid = await argon2.verify(user.passwordHash, body.password)
      if (!valid) {
        // Increment failed attempt counter
        const key = `login:fail:${user.id}`
        const fails = await app.redis.incr(key)
        await app.redis.expire(key, 900) // 15 min window

        if (fails >= 5) {
          // Lock account temporarily
          await app.db.user.update({
            where: { id: user.id },
            data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
          })
        }

        throw new UnauthorizedError('Invalid email or password')
      }

      // Reset fail counter on success
      await app.redis.del(`login:fail:${user.id}`)

      const tokens = await signTokenPair(user.id, user.email, user.plan, user.isSuperAdmin)

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId: user.id,
          action: 'auth.login',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: {},
        },
      })

      const { passwordHash: _, ...safeUser } = user
      reply.status(200)
      return { user: safeUser, ...tokens }
    },
  })

  // ─── POST /v1/auth/refresh ────────────────────────────────────────
  app.post('/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
    handler: async (req, reply) => {
      const body = refreshSchema.parse(req.body)

      let payload: { sub: string; jti: string }
      try {
        payload = app.jwt.verify(body.refreshToken) as { sub: string; jti: string }
      } catch {
        throw new UnauthorizedError('Invalid refresh token')
      }

      // Validate JTI exists (rotation check)
      const exists = await app.redis.exists(`refresh:${payload.sub}:${payload.jti}`)
      if (!exists) {
        // Possible token reuse attack — revoke all sessions.
        // Bug fix: `app.redis.del(\`refresh:${payload.sub}:*\`)` doesn't
        // do what it looks like it does — Redis's DEL command takes
        // literal key names, not glob patterns (that's SCAN/KEYS). This
        // was trying to delete one key literally named
        // "refresh:<sub>:*" (which never exists), so it silently
        // no-op'd — a detected token-reuse attack was NOT actually
        // revoking any other sessions, the one specific security
        // response this whole check exists to trigger. CacheService's
        // delPattern (already instantiated above as `cache`) does this
        // correctly via SCAN.
        await cache.delPattern(`refresh:${payload.sub}:*`)
        throw new UnauthorizedError('Refresh token has been revoked')
      }

      // Rotate: delete old JTI
      await app.redis.del(`refresh:${payload.sub}:${payload.jti}`)

      const user = await app.db.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, plan: true, deletedAt: true, isSuperAdmin: true },
      })

      if (!user || user.deletedAt) {
        throw new UnauthorizedError('User not found')
      }

      const tokens = await signTokenPair(user.id, user.email, user.plan, user.isSuperAdmin)
      await cache.invalidateUser(user.id)

      reply.status(200)
      return tokens
    },
  })

  // ─── POST /v1/auth/logout ─────────────────────────────────────────
  app.post('/logout', {
    preHandler: [app.authenticate],
    handler: async (req, reply) => {
      const body = refreshSchema.safeParse(req.body)
      if (body.success) {
        try {
          const payload = app.jwt.verify(body.data.refreshToken) as { sub: string; jti: string }
          await app.redis.del(`refresh:${payload.sub}:${payload.jti}`)
        } catch {
          // Token already invalid — no action needed
        }
      }

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId: req.user.sub,
          action: 'auth.logout',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: {},
        },
      })

      reply.status(204).send()
    },
  })

  // ─── GET /v1/auth/me ──────────────────────────────────────────────
  app.get('/me', {
    preHandler: [app.authenticate],
    handler: async (req) => {
      const userId = req.user.sub

      return cache.getOrSet(
        cacheKeys.userProfile(userId),
        CACHE_TTL.LONG,
        async () => {
          const user = await app.db.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              plan: true,
              timezone: true,
              createdAt: true,
              onboardingRole: true,
            },
          })

          if (!user) throw new NotFoundError('User')
          return user
        },
      )
    },
  })

  // ─── POST /v1/auth/forgot-password ──────────────────────────────────
  app.post('/forgot-password', {
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { email } = z.object({ email: z.string().email().toLowerCase() }).parse(req.body)

      const user = await app.db.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, deletedAt: true },
      })

      // Always respond 200 to prevent email enumeration
      if (!user || user.deletedAt) {
        reply.status(200)
        return { message: 'If that email exists, a reset link has been sent.' }
      }

      const token = nanoid(48)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await app.redis.setex(`password-reset:${token}`, 3600, user.id)

      await enqueueEmail({
        type: 'auth.password_reset',
        to: user.email,
        data: { token, name: user.name },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId: user.id,
          action: 'auth.password_reset_requested',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { expiresAt: expiresAt.toISOString() },
        },
      })

      reply.status(200)
      return { message: 'If that email exists, a reset link has been sent.' }
    },
  })

  // ─── POST /v1/auth/reset-password ───────────────────────────────────
  app.post('/reset-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(8).max(128),
      }).parse(req.body)

      const userId = await app.redis.get(`password-reset:${token}`)
      if (!userId) {
        throw new UnauthorizedError('Reset token is invalid or has expired')
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      })

      await app.db.user.update({
        where: { id: userId },
        data: { passwordHash, lockedUntil: null },
      })

      // Invalidate the token immediately after use
      await app.redis.del(`password-reset:${token}`)

      // Revoke all refresh tokens: use a version counter so all existing JTIs
      // become invalid without needing KEYS scan (O(N) on full keyspace).
      // increment the token version — auth middleware checks this on each verify
      await app.redis.incr(`refresh_version:${userId}`)
      await app.redis.expire(`refresh_version:${userId}`, 30 * 24 * 60 * 60)

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          action: 'auth.password_reset_completed',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: {},
        },
      })

      await cache.invalidateUser(userId)

      reply.status(200)
      return { message: 'Password reset successfully. Please log in again.' }
    },
  })

  // ─── PATCH /v1/auth/me ────────────────────────────────────────────
  app.patch('/me', {
    preHandler: [app.authenticate],
    handler: async (req, reply) => {
      const userId = req.user.sub
      const body = z.object({
        name: z.string().min(1).max(100).trim().optional(),
        timezone: z.string().max(50).optional(),
        avatarUrl: z.string().url().nullable().optional(),
        // PRD_AUDIT.md Finding #9: onboarding's Role Selection step
        // PATCHes this same endpoint — it already accepted partial
        // updates, no new endpoint needed.
        onboardingRole: z.enum(['pm', 'dev', 'designer']).optional(),
      }).parse(req.body)

      if (Object.keys(body).length === 0) {
        throw new ValidationError('No fields provided to update')
      }

      const user = await app.db.user.update({
        where: { id: userId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
          ...(body.onboardingRole !== undefined ? { onboardingRole: body.onboardingRole } : {}),
          updatedAt: new Date(),
        },
        select: { id: true, email: true, name: true, avatarUrl: true, plan: true, timezone: true, createdAt: true, isSuperAdmin: true, onboardingRole: true },
      })

      await cache.invalidateUser(userId)

      reply.status(200)
      return user
    },
  })

  // ─── POST /v1/auth/sso/exchange ───────────────────────────────────
  // Exchange the one-time SSO exchange token for real JWTs.
  // This avoids putting tokens in URL query params (server logs) or fragments (JS-accessible).
  app.post('/sso/exchange', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { exchangeToken } = z.object({ exchangeToken: z.string().min(1) }).parse(req.body)

      const raw = await app.redis.get(`sso:exchange:${exchangeToken}`)
      if (!raw) throw new UnauthorizedError('SSO exchange token is invalid or expired')

      const { accessToken, refreshToken } = JSON.parse(raw) as {
        accessToken: string
        refreshToken: string
        userId: string
      }

      // Consume the exchange token — single use only
      await app.redis.del(`sso:exchange:${exchangeToken}`)

      reply.status(200)
      return { accessToken, refreshToken, expiresIn: 900 }
    },
  })

  app.post('/me/erasure-request', {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const userId = req.user.sub
      const body = z.object({ password: z.string().min(1) }).parse(req.body)

      const user = await app.db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, passwordHash: true, deletedAt: true },
      })
      if (!user || user.deletedAt) throw new NotFoundError('User')

      const valid = await argon2.verify(user.passwordHash, body.password)
      if (!valid) throw new UnauthorizedError('Incorrect password')

      const { processErasureRequest } = await import('../../services/gdpr-erasure.js')
      const result = await processErasureRequest(app.db, userId, user.email)

      if (result.status === 'completed') {
        await app.redis.incr(`refresh_version:${userId}`)
        await app.redis.expire(`refresh_version:${userId}`, 30 * 24 * 60 * 60)
      }

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          action: 'auth.erasure_requested',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { requestId: result.requestId, status: result.status },
        },
      })

      reply.status(result.status === 'completed' ? 200 : 500)
      return {
        requestId: result.requestId,
        status: result.status,
        message: result.status === 'completed'
          ? 'Your account has been anonymized and all sessions revoked.'
          : 'The erasure request could not be completed. Please contact support.',
      }
    },
  })
}

