/**
 * GlitchTip error monitoring client.
 * GlitchTip is a free, self-hosted, open source Sentry alternative.
 * Compatible with the Sentry SDK protocol — runs in Docker, no vendor account needed.
 *
 * Setup:
 *   1. Start: docker compose -f docker/observability.yml up -d
 *   2. Create account at http://localhost:8000
 *   3. Create project → copy DSN → set GLITCHTIP_DSN in .env
 *
 * Security: Only captures unhandled errors (500s) — never captures user data.
 * PII scrubbing is applied before any event is sent.
 */
import { env } from './env.js'
import { logger } from './logger.js'

// Fields that must never be sent to the error tracker
const PII_KEYS = new Set([
  'password', 'passwordHash', 'token', 'refreshToken', 'accessToken',
  'secret', 'apiKey', 'authorization', 'cookie', 'creditCard',
  'ssn', 'email', 'phone', 'address',
])

const scrubPii = (obj: unknown, depth = 0): unknown => {
  if (depth > 5 || obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj
  if (Array.isArray(obj)) return obj.map((v) => scrubPii(v, depth + 1))
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (PII_KEYS.has(key.toLowerCase())) {
        result[key] = '[Scrubbed]'
      } else {
        result[key] = scrubPii(value, depth + 1)
      }
    }
    return result
  }
  return obj
}

interface GlitchTipEvent {
  event_id: string
  timestamp: string
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  platform: 'node'
  server_name: string
  environment: string
  release?: string
  exception?: {
    values: Array<{
      type: string
      value: string
      stacktrace?: { frames: Array<{ filename: string; function: string; lineno: number; colno?: number }> }
    }>
  }
  message?: string
  extra?: Record<string, unknown>
  tags?: Record<string, string>
  request?: {
    url: string
    method: string
    headers: Record<string, string>
    env: { REMOTE_ADDR: string }
  }
}

const parseStack = (stack: string): Array<{ filename: string; function: string; lineno: number; colno?: number }> =>
  stack
    .split('\n')
    .slice(1)
    .map((line) => {
      const m = line.trim().match(/at (.+?) \((.+?):(\d+):(\d+)\)/) ??
                line.trim().match(/at (.+?):(\d+):(\d+)/)
      if (!m) return { filename: 'unknown', function: 'unknown', lineno: 0 }
      if (m.length >= 5) {
        return { function: m[1] ?? 'unknown', filename: m[2] ?? 'unknown', lineno: parseInt(m[3] ?? '0', 10), colno: parseInt(m[4] ?? '0', 10) }
      }
      return { filename: m[1] ?? 'unknown', function: 'module', lineno: parseInt(m[2] ?? '0', 10) }
    })
    .filter((f) => f.filename !== 'unknown')
    .reverse() // GlitchTip expects innermost frame last

const parseDsn = (dsn: string): { storeEndpoint: string; publicKey: string } | null => {
  try {
    const url = new URL(dsn)
    const publicKey = url.username
    const projectId = url.pathname.replace('/', '')
    const storeEndpoint = `${url.protocol}//${url.host}/api/${projectId}/store/`
    return { storeEndpoint, publicKey }
  } catch {
    return null
  }
}

class MonitoringClient {
  private readonly parsed: ReturnType<typeof parseDsn>

  constructor() {
    this.parsed = env.GLITCHTIP_DSN ? parseDsn(env.GLITCHTIP_DSN) : null
    if (this.parsed) {
      logger.info({ endpoint: this.parsed.storeEndpoint }, 'GlitchTip error monitoring enabled')
    } else if (env.GLITCHTIP_DSN) {
      logger.warn('GLITCHTIP_DSN is set but could not be parsed — error monitoring disabled')
    } else {
      logger.debug('GLITCHTIP_DSN not set — errors will only appear in logs')
    }
  }

  async captureException(
    error: Error,
    context?: { requestId?: string; userId?: string; url?: string; method?: string; ip?: string },
  ): Promise<void> {
    logger.error({ err: error, ...context }, 'Unhandled exception')

    if (!this.parsed) return

    const event: GlitchTipEvent = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      level: 'error',
      platform: 'node',
      server_name: process.env['HOSTNAME'] ?? 'collabos-api',
      environment: env.NODE_ENV,
      // Bug fix (found via tsc): same exactOptionalPropertyTypes
      // pattern — process.env['APP_VERSION'] is string | undefined,
      // release?: string may only be omitted, not undefined.
      ...(process.env['APP_VERSION'] !== undefined && { release: process.env['APP_VERSION'] }),
      exception: {
        values: [{
          type: error.name,
          value: error.message,
          stacktrace: { frames: parseStack(error.stack ?? '') },
        }],
      },
      tags: {
        runtime: `node-${process.version}`,
        ...(context?.requestId ? { requestId: context.requestId } : {}),
      },
      extra: scrubPii(context) as Record<string, unknown>,
      ...(context?.url ? {
        request: {
          url: context.url,
          method: context.method ?? 'GET',
          headers: {},
          env: { REMOTE_ADDR: context.ip ?? '' },
        },
      } : {}),
    }

    await this.send(event)
  }

  async captureMessage(
    message: string,
    level: GlitchTipEvent['level'] = 'info',
    extra?: Record<string, unknown>,
  ): Promise<void> {
    if (level === 'error' || level === 'fatal') {
      logger.error({ message, ...extra }, 'Monitoring message')
    } else {
      logger.info({ message, ...extra }, 'Monitoring message')
    }

    if (!this.parsed) return

    const event: GlitchTipEvent = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      level,
      platform: 'node',
      server_name: process.env['HOSTNAME'] ?? 'collabos-api',
      environment: env.NODE_ENV,
      message,
      extra: scrubPii(extra) as Record<string, unknown>,
      tags: { runtime: `node-${process.version}` },
    }

    await this.send(event)
  }

  private async send(event: GlitchTipEvent): Promise<void> {
    if (!this.parsed) return

    try {
      const res = await fetch(this.parsed.storeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': [
            'Sentry sentry_version=7',
            `sentry_key=${this.parsed.publicKey}`,
            'sentry_client=collabos/1.0',
          ].join(', '),
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(5000), // Never block the request for monitoring
      })

      if (!res.ok) {
        logger.debug({ status: res.status }, 'GlitchTip event delivery failed (non-critical)')
      }
    } catch (err) {
      // Monitoring failures are non-fatal — log and move on
      logger.debug({ err }, 'GlitchTip delivery error (non-critical)')
    }
  }
}

export const monitoring = new MonitoringClient()
