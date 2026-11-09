/**
 * Super admin authorization. Deliberately a separate module from
 * middleware/auth.ts's requireRole — that middleware checks WORKSPACE-
 * scoped roles (owner/admin/member/guest within a single workspace).
 * requireSuperAdmin checks PLATFORM-wide authority, which has no
 * workspace context at all. Sharing an abstraction between these two
 * would be exactly the kind of role-meaning confusion flagged in the
 * prior audit's SEC-3 finding (API keys silently inheriting 'pro' plan
 * authority they shouldn't have) — keeping them structurally separate
 * means a bug in one can never accidentally grant the other.
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js'
import type { JWTPayload } from '../types/auth.js'

/**
 * Fast path: trusts the JWT claim. Suitable for read-only dashboard views
 * where a up-to-15-minutes-stale claim is an acceptable risk (the access
 * token TTL bounds the blast radius of a just-revoked super admin).
 * NOT suitable for destructive actions — see requireSuperAdminVerified.
 */
export const requireSuperAdmin = async (
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  const user = req.user as JWTPayload | undefined
  if (!user?.sub) throw new UnauthorizedError('Authentication required')
  if (!user.isSuperAdmin) throw new ForbiddenError('Super admin access required')
}

/**
 * Strict path: re-verifies isSuperAdmin against the database on every
 * call, ignoring the JWT claim entirely. Required before any destructive
 * or sensitive action: suspending a workspace, granting/revoking another
 * super admin, starting an impersonation session, or changing system-wide
 * settings. The extra DB round trip is the deliberate cost of closing the
 * up-to-15-minute window the fast path above accepts for read-only views.
 */
export const requireSuperAdminVerified = async (
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  const user = req.user as JWTPayload | undefined
  if (!user?.sub) throw new UnauthorizedError('Authentication required')

  const dbUser = await req.server.db.user.findUnique({
    where: { id: user.sub },
    select: { isSuperAdmin: true, deletedAt: true },
  })

  if (!dbUser || dbUser.deletedAt || !dbUser.isSuperAdmin) {
    throw new ForbiddenError('Super admin access required')
  }
}
