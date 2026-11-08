import type { FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError, ForbiddenError, RateLimitError } from '../utils/errors.js'
import type { JWTPayload } from '../types/auth.js'
import { RateLimitService } from '../services/rate-limit.js'
import type { UserPlan } from '@collabos/shared'

// BUG-7 fix: RateLimitService existed as a fully-implemented, well-tested
// class (per-plan sliding window, Redis-backed, 1h-cached plan lookup) but
// `new RateLimitService` appeared NOWHERE outside its own file — it was
// never instantiated, never called, never wired into the request path.
// The only rate limiting actually enforced was the flat global
// @fastify/rate-limit (300/min/IP for every plan), even though the README
// and .env.example both document differentiated per-plan limits
// (Free 60/min, Pro 600/min, Business 1200/min, Enterprise 6000/min).
//
// Singleton instance, lazily created on first use since this module is
// imported before app.redis exists (Fastify decorators aren't available
// at import time, only once the redis plugin has registered). See
// getRateLimitService() below for the lazy-init pattern this requires.
let rateLimitServiceInstance: RateLimitService | null = null
const getRateLimitService = (req: FastifyRequest): RateLimitService => {
  if (!rateLimitServiceInstance) {
    rateLimitServiceInstance = new RateLimitService(req.server.redis)
  }
  return rateLimitServiceInstance
}

export const authMiddleware = async (
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    await req.jwtVerify()
  } catch {
    throw new UnauthorizedError('Invalid or expired token')
  }

  // BUG-7 fix continued: this is the architecturally correct place to wire
  // in plan-aware rate limiting. authMiddleware is registered as a
  // per-route preHandler (via app.decorate('authenticate', authMiddleware),
  // then preHandler: [app.authenticate] on individual routes) rather than
  // a global hook — which matters because Fastify runs GLOBAL preHandler
  // hooks before ROUTE-LEVEL preHandler arrays. A global hook added in
  // app.ts would have run before req.user existed, since req.user is only
  // populated by the jwtVerify() call directly above. Putting the check
  // here, immediately after verification succeeds, guarantees req.user is
  // always fresh and avoids any hook-ordering ambiguity entirely.
  //
  // This is layered ON TOP of the flat global @fastify/rate-limit (300/min
  // for everyone), not a replacement for it — defense in depth. A 429 from
  // either layer is a legitimate rate-limit rejection.
  const user = req.user as JWTPayload
  const route = req.routeOptions?.url ?? req.url

  // FINAL_SWEEP.md BUG-1 fix: super admin authority has no relationship to
  // a user's personal workspace billing plan, but this check previously
  // used user.plan unconditionally — meaning a super admin granted to a
  // free-tier account (nothing prevents that; grant has no plan
  // requirement) would be capped at 60 req/min platform-wide while
  // managing an incident, including on /v1/super-admin/* routes, since
  // that plugin registers app.authenticate as a plugin-wide preHandler.
  // Super admins are exempt from this per-plan check entirely — they are
  // still subject to the flat global @fastify/rate-limit (300/min/IP),
  // which is plan-independent and remains the correct backstop for them.
  if (user.isSuperAdmin) return

  const plan = (user.plan as UserPlan | undefined) ?? 'free'

  try {
    const { remaining, limit } = await getRateLimitService(req).checkAndIncrement(user.sub, plan, route)
    reply.header('X-RateLimit-Plan-Limit', limit)
    reply.header('X-RateLimit-Plan-Remaining', remaining)
  } catch (err) {
    if (err instanceof RateLimitError) throw err
    // Redis hiccup on the rate-limit check itself should never take down
    // an otherwise-valid authenticated request — fail open, not closed,
    // and let the flat global rate limit remain as the backstop.
  }
}

// BUG-6 fix: this middleware previously only read workspaceId from
// req.params, which is why grep found ZERO call sites across the entire
// routes/ directory — every route needing this check (apikeys, webhooks,
// admin, sso, scim) actually carries workspaceId in the request BODY or
// QUERY STRING, not the URL path. The abstraction didn't fit any real call
// site, so every route independently re-implemented the exact same
// findUnique + role-hierarchy check inline instead.
//
// Fixed by accepting an explicit resolver for where workspaceId lives in
// THIS particular route, defaulting to params for backward compatibility
// with any future param-based routes. Now genuinely reusable, and wired
// into every route that previously duplicated this logic — see routes/
// apikeys, webhooks, admin, sso, scim.
type WorkspaceIdSource = 'params' | 'query' | 'body'

export const requireRole = (
  minRole: 'guest' | 'member' | 'admin' | 'owner',
  source: WorkspaceIdSource = 'params',
) => {
  const roleHierarchy: Record<string, number> = {
    guest: 0,
    member: 1,
    admin: 2,
    owner: 3,
  }

  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = req.user as JWTPayload

    const container =
      source === 'query' ? (req.query as Record<string, unknown>) :
      source === 'body' ? (req.body as Record<string, unknown>) :
      (req.params as Record<string, unknown>)

    const workspaceId = container?.['workspaceId'] as string | undefined

    if (!workspaceId) {
      throw new ForbiddenError('Workspace context required')
    }

    // Super admin dashboard feature: check workspace suspension here, not
    // by reusing the existing deletedAt soft-delete filters anywhere —
    // suspension is a distinct, reversible platform-level state (see
    // schema.prisma comment on Workspace.suspendedAt). This check sits in
    // requireRole specifically because it's the one properly-wired-in
    // shared middleware from the prior audit's BUG-6 fix; the 13 routes
    // that still hand-roll their own workspaceMember.findUnique instead of
    // using requireRole do NOT get this enforcement automatically — that
    // is a known, pre-existing structural gap this feature does not by
    // itself close, called out explicitly rather than left silent.
    const workspace = await req.server.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { suspendedAt: true },
    })
    if (workspace?.suspendedAt) {
      throw new ForbiddenError('This workspace has been suspended')
    }

    const member = await req.server.db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.sub } },
      select: { role: true, status: true },
    })

    if (!member || member.status !== 'active') {
      throw new ForbiddenError('Not a member of this workspace')
    }

    const userRoleLevel = roleHierarchy[member.role] ?? -1
    const requiredLevel = roleHierarchy[minRole] ?? 99

    if (userRoleLevel < requiredLevel) {
      throw new ForbiddenError(`Requires ${minRole} role or higher`)
    }

    // Attach to request for downstream use — route handlers that previously
    // re-fetched the member row just to read .role can use this instead.
    ;(req as FastifyRequest & { workspaceRole: string }).workspaceRole = member.role
  }
}
