'use client'

import Link from 'next/link'
import { ArrowRight, Lock, Shield, Eye, Server, FileKey, Activity } from 'lucide-react'

const PILLARS = [
  {
    icon: Lock,
    title: 'Encryption everywhere',
    desc: 'AES-256-GCM authenticated encryption for sensitive fields at rest (SSO certificates, webhook secrets). TLS 1.2/1.3 in transit. JWT access tokens signed with RS256 asymmetric keys.',
    points: [
      'Random 12-byte IV per encryption operation — never reused',
      '16-byte authentication tag detects any tampering attempt',
      'Password hashing via argon2id (64MB memory cost, 3 iterations)',
      'RS256 JWT: public key verification without exposing the signing key',
    ],
  },
  {
    icon: Shield,
    title: 'Access control',
    desc: 'Role-based access control enforced at the API layer on every request. Four-tier hierarchy: owner, admin, member, guest. Scoped API keys limit programmatic access to exactly what is needed.',
    points: [
      'RBAC middleware checks role before any mutation',
      'API keys: 14 granular scopes (messages:read, tasks:write, etc.)',
      'Guest role: scoped to explicitly invited channels only',
      'Workspace admins cannot be removed by other admins — owner-only',
    ],
  },
  {
    icon: Eye,
    title: 'Audit logging',
    desc: 'Every authentication event, permission change, and administrative action is recorded in an append-only audit log. Nothing is ever deleted — only marked.',
    points: [
      'Login, logout, password reset, SSO events all logged',
      'IP address and user agent captured on every entry',
      'Admin actions (role changes, member removal) fully traceable',
      'Soft deletes throughout — full historical record preserved',
    ],
  },
  {
    icon: Server,
    title: 'Self-hosting',
    desc: 'CollabOS is fully open source and self-hostable. Run it on your own infrastructure with complete control over your data. Every feature works identically self-hosted.',
    points: [
      'Apache 2.0 licensed — audit the source yourself',
      'Docker Compose for development and production',
      'Self-hosted Postgres, Redis, LiveKit, Ollama — zero vendor lock-in',
      'Enterprise plan includes dedicated self-hosting support',
    ],
  },
  {
    icon: FileKey,
    title: 'Authentication',
    desc: 'JWT RS256 with rotating refresh tokens and replay attack detection. Account lockout after repeated failed attempts. Optional SAML 2.0 SSO and SCIM provisioning for Enterprise.',
    points: [
      'Refresh token reuse triggers immediate revocation of ALL sessions',
      'Account lockout: 5 failed attempts → 15-minute cooldown',
      'SAML 2.0: SP-initiated flow with one-time exchange tokens (never URL fragments)',
      'SCIM 2.0: timing-safe token verification prevents timing attacks',
    ],
  },
  {
    icon: Activity,
    title: 'Infrastructure security',
    desc: 'Rate limiting at global and per-plan tiers. Idempotency keys prevent duplicate mutations. Replay protection on every sensitive flow. Non-blocking error monitoring with PII scrubbing.',
    points: [
      'Global rate limit: 300 req/min per IP, stricter on auth endpoints',
      'Idempotency-Key header: 24h Redis cache prevents duplicate writes',
      'GlitchTip error tracking scrubs 10+ PII field types before transmission',
      'Webhook payloads HMAC-SHA256 signed — verify authenticity on receipt',
    ],
  },
] as const

export function SecurityPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="relative pt-32 pb-20 border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 0%, rgba(232,64,10,0.06) 0%, transparent 100%)' }}
        />
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="font-mono text-xs text-accent uppercase tracking-widest mb-6">Security</p>
            <h1 className="font-mono text-5xl font-bold leading-tight mb-6">
              Built secure.<br/>Not bolted on.
            </h1>
            <p className="font-mono text-lg text-muted-foreground leading-relaxed mb-8">
              Encryption, access control, and audit logging aren&apos;t features we added later — they&apos;re foundational to how CollabOS is built. Self-host it and verify every claim yourself.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-mono text-sm rounded hover:bg-accent/90 transition-colors group">
                Start free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a href="https://github.com/your-org/collabos" target="_blank" rel="noopener noreferrer" className="px-6 py-3 border border-border font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded transition-colors">
                Audit the source ↗
              </a>
            </div>
          </div>

          {/* Security shield SVG */}
          <div aria-hidden="true">
            <svg viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" className="w-full">
              <defs>
                <radialGradient id="shieldGlow" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#e8400a" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#e8400a" stopOpacity="0" />
                </radialGradient>
                <filter id="shield-blur"><feGaussianBlur stdDeviation="2"/></filter>
              </defs>
              <rect width="400" height="320" fill="url(#shieldGlow)" />

              {/* Shield outline */}
              <path
                d="M200 30 L300 65 L300 165 C300 230 250 270 200 290 C150 270 100 230 100 165 L100 65 Z"
                fill="#111"
                stroke="#e8400a"
                strokeWidth="2"
              />
              <path
                d="M200 30 L300 65 L300 165 C300 230 250 270 200 290 C150 270 100 230 100 165 L100 65 Z"
                fill="none"
                stroke="#e8400a"
                strokeWidth="6"
                opacity="0.15"
                filter="url(#shield-blur)"
              />

              {/* Lock icon inside */}
              <rect x="178" y="140" width="44" height="36" rx="4" fill="none" stroke="#e8400a" strokeWidth="2" />
              <path d="M188 140 L188 124 C188 112 212 112 212 124 L212 140" fill="none" stroke="#e8400a" strokeWidth="2" />
              <circle cx="200" cy="156" r="5" fill="#e8400a" />
              <rect x="198" y="158" width="4" height="10" fill="#e8400a" />

              {/* Orbiting dots representing distributed security layers */}
              {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                const rad = (angle * Math.PI) / 180
                const cx = 200 + 130 * Math.cos(rad)
                const cy = 160 + 130 * Math.sin(rad)
                return (
                  <circle key={angle} cx={cx} cy={cy} r="4" fill="#e8400a" opacity="0.5">
                    <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  </circle>
                )
              })}

              {/* Encryption text labels around shield */}
              <text x="200" y="20" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#555">AES-256-GCM</text>
              <text x="60" y="170" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#555">RS256</text>
              <text x="340" y="170" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#555">argon2id</text>
              <text x="200" y="312" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#555">SCIM · SAML</text>
            </svg>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-28" aria-labelledby="pillars-heading">
        <div className="max-w-7xl mx-auto px-6">
          <h2 id="pillars-heading" className="sr-only">Security pillars</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PILLARS.map(({ icon: Icon, title, desc, points }) => (
              <div key={title} className="border border-border rounded-lg p-6 bg-card hover:border-accent/30 transition-colors">
                <div className="h-10 w-10 rounded bg-accent/8 flex items-center justify-center mb-5">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                </div>
                <h3 className="font-mono text-base font-semibold mb-3">{title}</h3>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-5">{desc}</p>
                <ul className="flex flex-col gap-2">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
                      <span className="text-accent mt-0.5 shrink-0" aria-hidden="true">→</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance strip */}
      <section className="py-20 border-t border-border bg-muted/20" aria-labelledby="compliance-heading">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 id="compliance-heading" className="font-mono text-3xl font-bold mb-6">
            Built for teams with compliance requirements
          </h2>
          <p className="font-mono text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto">
            CollabOS&rsquo;s open-source nature means you can audit every security claim yourself. Self-hosting gives you full data residency control. Enterprise customers get dedicated support for compliance documentation.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Data residency', desc: 'Self-host anywhere' },
              { label: 'Source available', desc: 'Apache 2.0 license' },
              { label: 'Audit trail', desc: 'Append-only logs' },
              { label: 'Encryption', desc: 'AES-256-GCM + RS256' },
            ].map(({ label, desc }) => (
              <div key={label} className="border border-border rounded-lg p-5 bg-card">
                <p className="font-mono text-sm font-semibold mb-1">{label}</p>
                <p className="font-mono text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Responsible disclosure */}
      <section className="py-20 border-t border-border" aria-labelledby="disclosure-heading">
        <div className="max-w-2xl mx-auto px-6">
          <div className="border border-border rounded-lg p-8 bg-card">
            <h2 id="disclosure-heading" className="font-mono text-xl font-bold mb-4">
              Found a vulnerability?
            </h2>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-6">
              We take security reports seriously and credit researchers who report responsibly. Email us with details and we&rsquo;ll respond within 48 hours.
            </p>
            <a
              href="mailto:security@collabos.io"
              className="inline-flex items-center gap-2 font-mono text-sm text-accent hover:underline underline-offset-4"
            >
              security@collabos.io
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28" aria-labelledby="sec-cta">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 id="sec-cta" className="font-mono text-4xl font-bold mb-6">
            See it for yourself.
          </h2>
          <p className="font-mono text-muted-foreground mb-10">
            Start free, or clone the repo and audit every line.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth/register" className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-white font-mono text-sm rounded hover:bg-accent/90 transition-colors group">
              Start free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="https://github.com/your-org/collabos" target="_blank" rel="noopener noreferrer" className="px-8 py-3 border border-border font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded transition-colors">
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
