'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For small teams getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: 'Start free',
    ctaHref: '/auth/register',
    highlight: false,
    features: [
      'Up to 3 workspace members',
      '90-day message history',
      '5 documents',
      '3 canvases',
      '5 GB file storage',
      'Public channels',
      'Basic task management',
      'Community support',
    ],
    limits: ['No AI features', 'No video calling', 'No SSO'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For growing teams that need everything',
    monthlyPrice: 12,
    yearlyPrice: 9,
    cta: 'Start Pro trial',
    ctaHref: '/auth/register?plan=pro',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Unlimited members',
      'Unlimited message history',
      'Unlimited documents & canvases',
      '100 GB file storage',
      'AI Intelligence (Claude-powered)',
      'Video & audio calling (LiveKit)',
      'Full-text + semantic search',
      'Webhook integrations',
      'API key access',
      'Priority support',
    ],
    limits: [],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For teams with compliance requirements',
    monthlyPrice: 24,
    yearlyPrice: 18,
    cta: 'Start Business trial',
    ctaHref: '/auth/register?plan=business',
    highlight: false,
    features: [
      'Everything in Pro',
      '1 TB file storage',
      'Automations engine',
      'Advanced audit logs',
      'Guest access with scoped permissions',
      'Data export (JSON/CSV)',
      'Custom retention policies',
      'SLA: 99.9% uptime',
      'Dedicated Slack support channel',
    ],
    limits: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organisations',
    monthlyPrice: null,
    yearlyPrice: null,
    cta: 'Talk to us',
    ctaHref: 'mailto:enterprise@collabos.io',
    highlight: false,
    features: [
      'Everything in Business',
      'Unlimited storage',
      'SAML 2.0 SSO (Okta, Azure AD)',
      'SCIM provisioning',
      'Self-hosting support',
      'Custom AI fine-tuning',
      'Dedicated infrastructure',
      'Custom SLA',
      'Executive support',
    ],
    limits: [],
  },
] as const

const COMPARISON_ROWS = [
  { feature: 'Members', free: '3', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited', category: 'workspace' },
  { feature: 'Message history', free: '90 days', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited', category: 'workspace' },
  { feature: 'Storage', free: '5 GB', pro: '100 GB', business: '1 TB', enterprise: 'Unlimited', category: 'workspace' },
  { feature: 'Documents', free: '5', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited', category: 'workspace' },
  { feature: 'Canvases', free: '3', pro: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited', category: 'workspace' },
  { feature: 'AI Intelligence', free: false, pro: true, business: true, enterprise: true, category: 'features' },
  { feature: 'Semantic search', free: false, pro: true, business: true, enterprise: true, category: 'features' },
  { feature: 'Video & audio calling', free: false, pro: true, business: true, enterprise: true, category: 'features' },
  { feature: 'Automations', free: false, pro: false, business: true, enterprise: true, category: 'features' },
  { feature: 'API keys', free: false, pro: true, business: true, enterprise: true, category: 'integrations' },
  { feature: 'Webhooks', free: false, pro: true, business: true, enterprise: true, category: 'integrations' },
  { feature: 'SAML SSO', free: false, pro: false, business: false, enterprise: true, category: 'security' },
  { feature: 'SCIM provisioning', free: false, pro: false, business: false, enterprise: true, category: 'security' },
  { feature: 'Audit logs', free: false, pro: false, business: true, enterprise: true, category: 'security' },
  { feature: 'Self-hosting', free: false, pro: false, business: false, enterprise: true, category: 'security' },
  { feature: 'Support', free: 'Community', pro: 'Priority email', business: 'Slack channel', enterprise: 'Executive', category: 'support' },
  { feature: 'SLA', free: 'None', pro: 'None', business: '99.9%', enterprise: 'Custom', category: 'support' },
] as const

type PlanId = 'free' | 'pro' | 'business' | 'enterprise'

const CellValue = ({ value }: { value: string | boolean | undefined }) => {
  if (value === true) return <Check className="h-4 w-4 text-accent mx-auto" aria-label="Included" />
  if (value === false) return <span className="text-muted-foreground/30 font-mono text-lg mx-auto block text-center">—</span>
  return <span className="font-mono text-xs text-muted-foreground text-center block">{value}</span>
}

export function PricingPage() {
  const [yearly, setYearly] = useState(true)

  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="relative pt-32 pb-20 border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 0%, rgba(232,64,10,0.06) 0%, transparent 100%)' }}
        />
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="font-mono text-xs text-accent uppercase tracking-widest mb-6">Pricing</p>
          <h1 className="font-mono text-5xl font-bold leading-tight mb-6">
            Simple, honest pricing.
          </h1>
          <p className="font-mono text-muted-foreground text-lg leading-relaxed mb-10">
            Start free. No credit card. No surprise charges. Upgrade when your team grows.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 p-1 border border-border rounded-full bg-card">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                'px-5 py-2 font-mono text-sm rounded-full transition-all duration-200',
                !yearly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={!yearly}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                'px-5 py-2 font-mono text-sm rounded-full transition-all duration-200 flex items-center gap-2',
                yearly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={yearly}
            >
              Yearly
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-bold',
                yearly ? 'bg-accent text-white' : 'bg-accent/15 text-accent',
              )}>
                −25%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="py-20" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="sr-only">Pricing plans</h2>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  'relative rounded-xl border p-6 flex flex-col',
                  plan.highlight
                    ? 'border-accent bg-accent/3 shadow-lg shadow-accent/10'
                    : 'border-border bg-card',
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-white font-mono text-xs px-3 py-1 rounded-full">
                      {'badge' in plan ? plan.badge : ''}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-mono text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{plan.tagline}</p>
                </div>

                <div className="mb-6">
                  {plan.monthlyPrice === null ? (
                    <div>
                      <span className="font-mono text-3xl font-bold">Custom</span>
                      <p className="font-mono text-xs text-muted-foreground mt-1">Contact us for pricing</p>
                    </div>
                  ) : plan.monthlyPrice === 0 ? (
                    <div>
                      <span className="font-mono text-4xl font-bold">$0</span>
                      <span className="font-mono text-muted-foreground ml-1">/month</span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-mono text-4xl font-bold">
                        ${yearly ? plan.yearlyPrice : plan.monthlyPrice}
                      </span>
                      <span className="font-mono text-muted-foreground ml-1 text-sm">/seat/month</span>
                      {yearly && (
                        <p className="font-mono text-xs text-muted-foreground mt-1">
                          Billed annually · ${plan.yearlyPrice! * 12}/seat/year
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Link
                  href={plan.ctaHref}
                  className={cn(
                    'block text-center py-2.5 font-mono text-sm rounded transition-colors mb-6',
                    plan.highlight
                      ? 'bg-accent text-white hover:bg-accent/90'
                      : 'border border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {plan.cta}
                </Link>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 font-mono text-xs">
                      <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                  {'limits' in plan && plan.limits.map((l) => (
                    <li key={l} className="flex items-start gap-2.5 font-mono text-xs">
                      <span className="text-muted-foreground/30 shrink-0 mt-0.5 font-bold">✕</span>
                      <span className="text-muted-foreground/50">{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 border-t border-border" aria-labelledby="compare-heading">
        <div className="max-w-7xl mx-auto px-6">
          <h2 id="compare-heading" className="font-mono text-3xl font-bold mb-12 text-center">
            Compare plans in detail
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" role="table">
              <thead>
                <tr>
                  <th className="text-left font-mono text-xs text-muted-foreground uppercase tracking-widest py-3 pr-6 w-48" scope="col">Feature</th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      className={cn('font-mono text-sm font-bold py-3 px-4 text-center', p.highlight && 'text-accent')}
                      scope="col"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['workspace', 'features', 'integrations', 'security', 'support'] as const).map((cat) => {
                  const rows = COMPARISON_ROWS.filter((r) => r.category === cat)
                  return (
                    <>
                      <tr key={`cat-${cat}`}>
                        <td
                          colSpan={5}
                          className="pt-8 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50"
                        >
                          {cat}
                        </td>
                      </tr>
                      {rows.map((row) => (
                        <tr
                          key={row.feature}
                          className="border-t border-border hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-3 pr-6 font-mono text-sm">{row.feature}</td>
                          {(['free', 'pro', 'business', 'enterprise'] as PlanId[]).map((planId) => (
                            <td
                              key={planId}
                              className={cn(
                                'py-3 px-4',
                                planId === 'pro' && 'bg-accent/3',
                              )}
                            >
                              <CellValue value={(row as Record<string, string | boolean>)[planId] as string | boolean} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 border-t border-border bg-muted/20" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto px-6">
          <h2 id="faq-heading" className="font-mono text-3xl font-bold mb-12 text-center">
            Frequently asked questions
          </h2>
          <dl className="flex flex-col gap-6">
            {[
              {
                q: 'Can I self-host CollabOS?',
                a: 'Yes. CollabOS is open source (Apache 2.0). Clone the repo, run docker compose up, and you have a full production deployment. All features work identically self-hosted. Enterprise plan includes dedicated support for self-hosting.',
              },
              {
                q: 'What happens when I exceed 3 members on the free plan?',
                a: 'You can invite more people but they will be blocked from accessing the workspace until you upgrade to Pro. Existing members are never blocked.',
              },
              {
                q: 'Is the AI feature powered by Anthropic Claude?',
                a: 'Yes. The Intelligence module uses Anthropic Claude for Q&A, summarization, and task extraction. Embeddings use Ollama (nomic-embed-text, self-hosted, free) with Anthropic as fallback. On self-hosted deployments you supply your own API keys.',
              },
              {
                q: 'Does the yearly plan auto-renew?',
                a: 'Yes, yearly plans auto-renew 30 days before expiry. You will receive an email reminder and can cancel any time before the renewal date for a prorated refund.',
              },
              {
                q: 'What is included in Enterprise that is not in Business?',
                a: 'SAML 2.0 SSO (Okta, Azure AD, Google Workspace), SCIM auto-provisioning, dedicated infrastructure, custom SLA agreements, executive support, and self-hosting assistance.',
              },
              {
                q: 'Can I switch plans mid-cycle?',
                a: 'Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the end of the current billing cycle.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-border rounded-lg p-6 bg-card">
                <dt className="font-mono text-sm font-semibold mb-3">{q}</dt>
                <dd className="font-mono text-sm text-muted-foreground leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28" aria-labelledby="pricing-cta">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 id="pricing-cta" className="font-mono text-4xl font-bold mb-6">
            Start free today.
          </h2>
          <p className="font-mono text-muted-foreground mb-10">
            No card. No commitment. Full access to every Pro feature for 14 days.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white font-mono text-sm rounded hover:bg-accent/90 transition-colors group"
          >
            Create your workspace — free
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  )
}
