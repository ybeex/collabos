/**
 * SAML 2.0 SSO routes.
 * Supports SP-initiated and IdP-initiated flows.
 * samlify handles XML parsing, signature verification, and assertion validation.
 *
 * Flow:
 * 1. Admin configures SAML in workspace settings (entityId, ssoUrl, certificate)
 * 2. User clicks "Sign in with SSO" → GET /v1/auth/sso/:workspaceSlug → redirect to IdP
 * 3. IdP authenticates user → POST /v1/auth/sso/:workspaceSlug/callback (ACS)
 * 4. We parse assertion, find/create user, issue JWT tokens
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import * as saml from 'samlify'
import { ForbiddenError, NotFoundError, ValidationError, ServiceUnavailableError } from '../../utils/errors.js'
import { encrypt, decrypt } from '../../utils/encryption.js'
import { env } from '../../utils/env.js'

// Bug fix: this file's own header comment already claimed "samlify
// handles XML parsing, signature verification, and assertion validation"
// — but nothing here ever actually imported or called samlify. The real
// implementation below was a hand-rolled regex match against raw XML
// with NO cryptographic signature verification at all (the removed code
// even said so directly: "simplified — production would use samlify for
// full XML-DSig verification"). That meant anyone who could POST to
// /v1/sso/:workspaceSlug/callback with a forged SAMLResponse containing
// any victim's email in a fake attribute would receive a valid, real
// access+refresh token pair for that account on any workspace with SSO
// enabled — a complete authentication bypass. This wires up the library
// the comment always claimed was in use.
//
// Schema (XSD) validation is deliberately skipped rather than wired to
// @authenio/samlify-xsd-schema-validator: that package requires a JVM
// (it shells out to a Java-based validator), which is a new operational
// dependency this app's stack doesn't otherwise have and that isn't
// guaranteed to exist in every deployment target. Schema validation is a
// defense-in-depth structural check, layered ON TOP OF signature
// verification in samlify's architecture — not a prerequisite for it
// (confirmed: libsaml.verifySignature runs as its own step, independent
// of whether a schema validator is configured). Skipping it means
// malformed-but-still-correctly-signed XML isn't rejected for structural
// non-conformance; it does NOT mean signatures go unchecked.
saml.setSchemaValidator({
  validate: () => Promise.resolve('skipped'),
})

const configureSsoSchema = z.object({
  provider: z.literal('saml'),
  entityId: z.string().min(1).max(500).trim(),
  ssoUrl: z.string().url(),
  certificate: z.string().min(100).trim(), // PEM certificate
  attributeMapping: z.object({
    email: z.string().default('email'),
    name: z.string().default('displayName'),
    role: z.string().optional(),
  }).optional(),
})

// Builds the samlify SP/IdP pair for one workspace's SSO config. Called
// fresh per request rather than cached: the IdP's certificate can change
// (PUT /:workspaceSlug/config) and a stale cached signingCert would
// either reject legitimate logins after a rotation or, worse, keep
// trusting a revoked certificate.
const buildSamlEntities = (workspaceSlug: string, ssoConfig: { entityId: string; ssoUrl: string; certificate: string }) => {
  const acsUrl = `${env.APP_URL}/api/v1/sso/${workspaceSlug}/callback`
  const idp = saml.IdentityProvider({
    entityID: ssoConfig.entityId,
    signingCert: decrypt(ssoConfig.certificate),
    singleSignOnService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect', Location: ssoConfig.ssoUrl }],
  })
  const sp = saml.ServiceProvider({
    entityID: env.APP_URL,
    assertionConsumerService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: acsUrl }],
    // The actual security-critical flags: reject any response whose
    // assertion (or top-level message) isn't signed. Without these,
    // samlify's default settings can accept an unsigned assertion as
    // long as SOME part of the envelope validates, which reopens
    // exactly the kind of gap this whole fix is for.
    wantAssertionsSigned: true,
    wantMessageSigned: true,
  })
  return { idp, sp }
}

export const ssoRoutes = async (app: FastifyInstance): Promise<void> => {
  if (!env.ENABLE_SSO) {
    app.get('/status', async () => ({ enabled: false, message: 'SSO is disabled. Set ENABLE_SSO=true.' }))
    return
  }

  // ─── GET /v1/sso/:workspaceSlug ─────────────────────────────────────
  // Initiate SP-initiated SAML flow — redirect to IdP login page
  app.get('/:workspaceSlug', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { workspaceSlug } = req.params as { workspaceSlug: string }

      const workspace = await app.db.workspace.findUnique({
        where: { slug: workspaceSlug },
        include: { ssoConfig: true },
      })

      if (!workspace) throw new NotFoundError('Workspace')
      if (!workspace.ssoConfig?.enabled) throw new ServiceUnavailableError('SSO not configured for this workspace')

      const { idp, sp } = buildSamlEntities(workspaceSlug, workspace.ssoConfig)

      // samlify's redirect binding builds a correctly deflated + base64
      // + URL-encoded AuthnRequest and returns the full redirect target
      // as `context`, plus the generated request `id` for replay
      // protection. Bug fix: the hand-rolled version this replaced
      // built the AuthnRequest XML manually but never actually deflated
      // it before base64-encoding, despite its own comment claiming it
      // did — the SAML HTTP-Redirect binding (unlike HTTP-POST) requires
      // raw DEFLATE compression before encoding; a real IdP would have
      // rejected or failed to parse every request this endpoint sent.
      const { id, context } = sp.createLoginRequest(idp, 'redirect', { relayState: workspaceSlug })

      // Store request ID to prevent replay attacks. Bug fix: this was
      // already being stored before, but the callback handler never
      // actually checked InResponseTo against it — replay protection was
      // prepared but not enforced. Fixed in the callback handler below.
      await app.redis.setex(`sso:request:${id}`, 300, workspaceSlug) // 5-min window

      reply.redirect(context)
    },
  })

  // ─── POST /v1/sso/:workspaceSlug/callback ─────────────────────────
  // ACS (Assertion Consumer Service) — receives SAML response from IdP
  app.post('/:workspaceSlug/callback', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { workspaceSlug } = req.params as { workspaceSlug: string }
      const body = req.body as { SAMLResponse?: string; RelayState?: string }

      if (!body.SAMLResponse) throw new ValidationError('Missing SAMLResponse')

      const workspace = await app.db.workspace.findUnique({
        where: { slug: workspaceSlug },
        include: { ssoConfig: true },
      })

      if (!workspace?.ssoConfig?.enabled) throw new ForbiddenError('SSO not configured')

      const { idp, sp } = buildSamlEntities(workspaceSlug, workspace.ssoConfig)

      // Bug fix: this used to base64-decode the response and pull the
      // email out with a regex match against raw XML text — no signature
      // verification at all, so a forged SAMLResponse containing any
      // victim's email in a fake attribute would pass straight through.
      // sp.parseLoginResponse validates the XML-DSig signature against
      // the workspace's registered IdP certificate (via xml-crypto),
      // checks NotBefore/NotOnOrAfter conditions, and only returns
      // `extract` on success — throwing/rejecting for anything
      // unsigned, wrongly signed, expired, or malformed.
      const flowResult = await sp.parseLoginResponse(idp, 'post', { body: req.body as Record<string, unknown> })
      const { extract } = flowResult

      // Bug fix: replay protection was stored on the initiate side (see
      // GET /:workspaceSlug above) but never actually checked here — an
      // attacker who intercepted or reused a legitimately-signed old
      // response could replay it indefinitely. InResponseTo now has to
      // match a request this app actually issued, and is deleted on use
      // so the same response can't be replayed twice within its window.
      const inResponseTo = extract.response?.['InResponseTo']
      const requestId = Array.isArray(inResponseTo) ? inResponseTo[0] : inResponseTo
      if (!requestId) throw new ValidationError('SAML response missing InResponseTo')
      const pendingSlug = await app.redis.get(`sso:request:${requestId}`)
      if (!pendingSlug || pendingSlug !== workspaceSlug) {
        throw new ValidationError('SAML response does not match a pending request (expired, replayed, or forged)')
      }
      await app.redis.del(`sso:request:${requestId}`)

      const mapping = workspace.ssoConfig.attributeMapping as Record<string, string>
      const emailAttr = mapping['email'] ?? 'email'
      const nameAttr = mapping['name'] ?? 'displayName'

      const rawEmail = extract.attributes?.[emailAttr]
      const rawName = extract.attributes?.[nameAttr]
      const emailValue = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail

      if (!emailValue) throw new ValidationError('Could not extract email from SAML assertion')

      const email = emailValue.toLowerCase().trim()
      const nameValue = Array.isArray(rawName) ? rawName[0] : rawName
      const name = nameValue?.trim() ?? email.split('@')[0] ?? 'User'

      // Find or create user
      let user = await app.db.user.findUnique({
        where: { email },
        select: { id: true, email: true, plan: true, deletedAt: true, isSuperAdmin: true },
      })

      if (user?.deletedAt) throw new ForbiddenError('Account has been deactivated')

      if (!user) {
        // Super admin dashboard feature: isSuperAdmin is deliberately NOT
        // settable via this create() call, even implicitly — it uses the
        // schema default of false. An external SAML identity provider
        // must never be able to influence platform-level authority; that
        // trust boundary (IdP attributes → workspace role) is intentionally
        // narrower than (IdP attributes → platform authority), which does
        // not exist anywhere in this codebase and should not be added here.
        user = await app.db.user.create({
          data: {
            id: nanoid(21),
            email,
            name,
            passwordHash: `sso:${workspace.id}:${nanoid(32)}`, // unusable password for SSO users
            plan: 'pro', // SSO users get Pro plan (enterprise feature)
          },
          select: { id: true, email: true, plan: true, deletedAt: true, isSuperAdmin: true },
        })
      }

      // user is guaranteed non-null: either found above or just created
      const resolvedUser = user!

      // Ensure workspace membership
      await app.db.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: resolvedUser.id } },
        create: { id: nanoid(21), workspaceId: workspace.id, userId: resolvedUser.id, role: 'member', status: 'active' },
        update: { status: 'active' },
      })

      // Issue JWT tokens
      const accessToken = app.jwt.sign({ sub: resolvedUser.id, email: resolvedUser.email, plan: resolvedUser.plan, isSuperAdmin: resolvedUser.isSuperAdmin })
      const jti = nanoid(32)
      // Bug fix — same as auth/index.ts's register/login flow (see that
      // file's fix comment): `{ sign: {...} }` is the plugin-registration
      // shape, not what `.sign()` takes per-call, so this override did
      // nothing and SSO refresh tokens were also silently expiring in 15
      // minutes instead of 30 days.
      const refreshToken = app.jwt.sign({ sub: resolvedUser.id, jti }, { expiresIn: '30d' })
      await app.redis.setex(`refresh:${resolvedUser.id}:${jti}`, 30 * 24 * 60 * 60, '1')

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId: resolvedUser.id,
          workspaceId: workspace.id,
          action: 'auth.sso_login',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { provider: 'saml', workspaceSlug },
        },
      })

      // Use HttpOnly short-lived SSO exchange cookie instead of URL fragment.
      // Fragment tokens are readable by any JavaScript on the page.
      // The frontend reads this cookie once and exchanges it for in-memory tokens.
      const exchangeToken = nanoid(32)
      await app.redis.setex(
        `sso:exchange:${exchangeToken}`,
        60, // 60-second window to complete the exchange
        JSON.stringify({ accessToken, refreshToken, userId: resolvedUser.id }),
      )

      const redirectUrl = `${env.APP_URL}/${workspaceSlug}/channels?sso_exchange=${exchangeToken}`
      reply
        .header('Cache-Control', 'no-store')
        .redirect(redirectUrl)
    },
  })

  // ─── GET /v1/sso/:workspaceSlug/config ────────────────────────────
  app.get('/:workspaceSlug/config', {
    preHandler: [app.authenticate],
    handler: async (req) => {
      const { workspaceSlug } = req.params as { workspaceSlug: string }
      const userId = req.user.sub

      const workspace = await app.db.workspace.findUnique({
        where: { slug: workspaceSlug },
        include: { ssoConfig: true, members: { where: { userId, role: { in: ['owner', 'admin'] } } } },
      })

      if (!workspace) throw new NotFoundError('Workspace')
      if (workspace.members.length === 0) throw new ForbiddenError('Admin required')

      if (!workspace.ssoConfig) return { configured: false }

      return {
        configured: true,
        enabled: workspace.ssoConfig.enabled,
        provider: workspace.ssoConfig.provider,
        entityId: workspace.ssoConfig.entityId,
        ssoUrl: workspace.ssoConfig.ssoUrl,
        // Never return the certificate to the client
        hasCertificate: !!workspace.ssoConfig.certificate,
        acsUrl: `${env.APP_URL}/api/v1/sso/${workspaceSlug}/callback`,
        entityIdForIdp: env.APP_URL,
      }
    },
  })

  // ─── PUT /v1/sso/:workspaceSlug/config ────────────────────────────
  app.put('/:workspaceSlug/config', {
    preHandler: [app.authenticate],
    handler: async (req, reply) => {
      const { workspaceSlug } = req.params as { workspaceSlug: string }
      const userId = req.user.sub
      const body = configureSsoSchema.parse(req.body)

      const workspace = await app.db.workspace.findUnique({
        where: { slug: workspaceSlug },
        include: { members: { where: { userId, role: { in: ['owner', 'admin'] } } } },
      })

      if (!workspace) throw new NotFoundError('Workspace')
      if (workspace.members.length === 0) throw new ForbiddenError('Admin required')
      if (workspace.plan === 'free' || workspace.plan === 'pro') throw new ForbiddenError('SSO requires Business or Enterprise plan')

      // Encrypt certificate before storing
      const encryptedCert = encrypt(body.certificate)

      await app.db.workspaceSsoConfig.upsert({
        where: { workspaceId: workspace.id },
        create: {
          workspaceId: workspace.id,
          provider: body.provider,
          entityId: body.entityId,
          ssoUrl: body.ssoUrl,
          certificate: encryptedCert,
          attributeMapping: body.attributeMapping ?? {},
          enabled: true,
        },
        update: {
          entityId: body.entityId,
          ssoUrl: body.ssoUrl,
          certificate: encryptedCert,
          attributeMapping: body.attributeMapping ?? {},
          enabled: true,
          updatedAt: new Date(),
        },
      })

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId: workspace.id,
          action: 'sso.config_updated',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { provider: body.provider, entityId: body.entityId },
        },
      })

      reply.status(200)
      return { message: 'SSO configured successfully' }
    },
  })
}
