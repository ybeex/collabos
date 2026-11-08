export interface JWTPayload {
  sub: string       // user ID
  email: string
  plan: 'free' | 'pro' | 'business' | 'enterprise'
  // Super admin dashboard feature: carried as a JWT claim so the check is
  // free (signature verification, already happening) rather than a DB hit
  // on every request. This is a 15-minute-stale snapshot by design — a
  // super admin whose access was just revoked keeps the claim until their
  // current access token expires. That window is acceptable for read-only
  // dashboard views but NOT for destructive actions (suspend workspace,
  // grant/revoke super admin, impersonate), which independently re-verify
  // against the database in requireSuperAdmin below before proceeding.
  isSuperAdmin?: boolean
  // Bug fix (found via tsc, once req.user was correctly typed as
  // JWTPayload instead of silently widened — see types/fastify.d.ts):
  // required `iat`/`exp` made this interface impossible to satisfy for
  // the API-key auth path (routes/apikeys/index.ts), which attaches a
  // synthetic req.user with no real signed-JWT envelope to have iat/exp
  // from in the first place — there's no token, so no issued-at/expiry
  // claims exist for that request. Nothing in this codebase actually
  // reads .iat/.exp (checked), so making them optional costs no real
  // type safety for JWT-authenticated requests and honestly reflects
  // that API-key requests don't have them.
  iat?: number
  exp?: number
}

export interface RefreshTokenPayload {
  sub: string
  jti: string       // token ID for rotation/revocation
  iat: number
  exp: number
}

export interface AuthTokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}
