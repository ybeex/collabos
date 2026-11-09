import { z } from 'zod'

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // ── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().default(20),
  // Optional read replica (for search/analytics)
  DATABASE_READ_URL: z.string().url().optional(),

  // ── Redis ───────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().url().default('redis://localhost:6381'),
  REDIS_TLS: z.coerce.boolean().default(false),
  // Separate Redis for job queues — prevents LRU eviction killing queued jobs
  REDIS_QUEUE_URL: z.string().url().optional(),

  // ── JWT (RS256 asymmetric) ──────────────────────────────────────────────────
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),

  // ── CORS ────────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // ── S3-compatible storage (Cloudflare R2 / MinIO) ───────────────────────────
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default('auto'),
  S3_PUBLIC_URL: z.string().url(),

  // ── AI / Embeddings ─────────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().min(1),
  // Self-hosted Ollama for free embeddings (nomic-embed-text)
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_EMBED_MODEL: z.string().default('nomic-embed-text'),
  // Use Ollama for embeddings when available, fall back to Anthropic
  EMBEDDINGS_PROVIDER: z.enum(['ollama', 'anthropic']).default('ollama'),

  // ── Email ───────────────────────────────────────────────────────────────────
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().email().default('noreply@collabos.io'),
  // Resend API key (free: 100 emails/day) — used when SMTP not configured
  RESEND_API_KEY: z.string().optional(),

  // ── Video/Audio (LiveKit self-hosted) ───────────────────────────────────────
  LIVEKIT_URL: z.string().url().default('ws://localhost:7880'),
  LIVEKIT_API_KEY: z.string().default('devkey'),
  // SEC-5 fix: no production-shaped default. The previous default
  // ('devsecret_min32chars_xxxxxxxxxxxxxxxx') is checked into the public
  // repo and is a real, valid-shaped 32+ char secret — any operator who
  // forgot to override it in production would have every LiveKit room
  // token forgeable by anyone who read the source. Dev convenience is now
  // handled by DEV_LIVEKIT_API_SECRET below + a superRefine, not a default
  // here, so production can never silently inherit a known secret.
  LIVEKIT_API_SECRET: z.string().min(32).optional(),
  // Only used when NODE_ENV !== 'production' and LIVEKIT_API_SECRET is unset.
  DEV_LIVEKIT_API_SECRET: z.string().default('devsecret_min32chars_xxxxxxxxxxxxxxxx'),

  // ── Observability (self-hosted, free) ───────────────────────────────────────
  // GlitchTip — open source Sentry alternative
  GLITCHTIP_DSN: z.string().optional(),
  // Prometheus metrics endpoint auth
  METRICS_TOKEN: z.string().optional(),
  // Loki log shipping
  LOKI_URL: z.string().url().optional(),

  // ── Security ────────────────────────────────────────────────────────────────
  // Encryption key for SSO certificates, webhook secrets (AES-256, 32 bytes hex).
  // SEC-1 fix: still optional at the type level (most deployments never touch
  // SSO/SCIM/webhooks and shouldn't be forced to generate a key), but a
  // superRefine below makes it REQUIRED whenever ENABLE_SSO or ENABLE_SCIM
  // is true, and webhooks.ts independently checks encryptionAvailable()
  // before accepting a webhook secret to encrypt.
  ENCRYPTION_KEY: z.string().length(64).optional(),
  // SCIM provisioning shared token namespace
  SCIM_TOKEN_SALT: z.string().min(32).optional(),
  // Content Security Policy report URI
  CSP_REPORT_URI: z.string().url().optional(),
  // App public URL (used in email links)
  APP_URL: z.string().url().default('http://localhost:3000'),

  // ── Rate limit tiers ────────────────────────────────────────────────────────
  RATE_LIMIT_FREE: z.coerce.number().int().default(60),
  RATE_LIMIT_PRO: z.coerce.number().int().default(600),
  RATE_LIMIT_ENTERPRISE: z.coerce.number().int().default(6000),

  // ── Feature flags ───────────────────────────────────────────────────────────
  ENABLE_AI: z.coerce.boolean().default(true),
  ENABLE_WEBSOCKET: z.coerce.boolean().default(true),
  ENABLE_VIDEO: z.coerce.boolean().default(false),
  ENABLE_EMBEDDINGS: z.coerce.boolean().default(false),
  ENABLE_SSO: z.coerce.boolean().default(false),
  ENABLE_SCIM: z.coerce.boolean().default(false),
  MAX_FILE_SIZE_MB: z.coerce.number().int().default(50),
  MAX_VIDEO_CLIP_MINUTES: z.coerce.number().default(5),
  // PRD_AUDIT.md Finding #1: threshold above which a document's encoded
  // Yjs state moves from the inline `state` Bytes column to S3, per
  // PRD §16's storage spec.
  YJS_INLINE_STATE_MAX_BYTES: z.coerce.number().int().default(512 * 1024),

  // ── Logging ─────────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

// SEC-1 fix: cross-field validation. Previously ENABLE_SSO/ENABLE_SCIM could
// be set to true with no ENCRYPTION_KEY configured — the app would boot
// successfully, an admin would walk through the entire SAML setup flow,
// paste their IdP certificate, and only THEN get a 500 from encrypt()
// throwing on a missing key. Failing at boot instead of at first use means
// the operator finds out before any admin has invested time in the flow.
const envSchema = baseEnvSchema.superRefine((data, ctx) => {
  if ((data.ENABLE_SSO || data.ENABLE_SCIM) && !data.ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ENCRYPTION_KEY'],
      message:
        'ENCRYPTION_KEY is required when ENABLE_SSO or ENABLE_SCIM is true ' +
        '(SSO certificates and provisioning secrets are encrypted at rest). ' +
        'Generate one with: openssl rand -hex 32',
    })
  }

  // SEC-5 fix: in production, LIVEKIT_API_SECRET must be explicitly set —
  // never silently fall back to the publicly-known dev default. This is
  // the boot-time check described in the audit's SEC-5 remediation.
  if (data.NODE_ENV === 'production' && data.ENABLE_VIDEO && !data.LIVEKIT_API_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['LIVEKIT_API_SECRET'],
      message:
        'LIVEKIT_API_SECRET must be explicitly set in production when ENABLE_VIDEO ' +
        'is true. It cannot fall back to the development default, which is ' +
        'checked into the public repository and would let anyone forge valid ' +
        'video room tokens. Generate one with: openssl rand -hex 32',
    })
  }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  })
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env

// SEC-5 fix: resolve the actual secret to use at the call site, rather than
// letting LIVEKIT_API_SECRET silently be undefined or rely on a baked-in
// default. Outside production, fall back to the clearly-named dev secret;
// in production the superRefine above already guarantees LIVEKIT_API_SECRET
// is set whenever ENABLE_VIDEO is true, so this function can never return
// the dev secret in a production deployment that has video enabled.
export const getLivekitApiSecret = (): string =>
  env.LIVEKIT_API_SECRET ?? env.DEV_LIVEKIT_API_SECRET
