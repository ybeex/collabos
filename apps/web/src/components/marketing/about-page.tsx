'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const TIMELINE = [
  { year: '2025', label: 'The idea', desc: 'Frustrated by switching between 9 tools to ship one feature, we started sketching what a unified workspace could look like — one that actually understood how work connects.' },
  { year: 'Q1 2026', label: 'First line of code', desc: 'Started building the monorepo: Fastify API, Next.js frontend, Postgres with pgvector. The Work Graph concept took shape early — every entity, a node; every relationship, an edge.' },
  { year: 'Q2 2026', label: 'Private beta', desc: '40 teams tested CollabOS daily for 8 weeks. The biggest signal: nobody asked for Slack integration. They asked us to go deeper into the Work Graph instead.' },
  { year: 'June 2026', label: 'v1.0 launch', desc: 'CollabOS opens to everyone. Open source, self-hostable, free for small teams. 2,400+ teams onboarded in the first two weeks.' },
] as const

const VALUES = [
  { title: 'Context over convenience', desc: 'We will always choose preserving the full context of a decision over making something one click faster. That tradeoff compounds.' },
  { title: 'Open by default', desc: 'CollabOS is Apache 2.0 licensed. You can read every line, self-host the entire stack, and never depend on us staying in business.' },
  { title: 'No dark patterns', desc: 'No artificial seat limits to force upgrades. No data held hostage on cancellation. Export everything, anytime, in open formats.' },
  { title: 'Free-tier infrastructure', desc: 'We run our own infra on self-hosted, open-source tools wherever possible — and we document exactly how, so you can do the same.' },
] as const

export function AboutPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="relative pt-32 pb-20 border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 0%, rgba(232,64,10,0.06) 0%, transparent 100%)' }}
        />
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="font-mono text-xs text-accent uppercase tracking-widest mb-6">About</p>
          <h1 className="font-mono text-5xl font-bold leading-tight mb-6">
            We got tired of<br/>switching tabs.
          </h1>
          <p className="font-mono text-lg text-muted-foreground leading-relaxed">
            CollabOS exists because the average knowledge worker loses entire workdays to context switching. We built the workspace we wished existed.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-28" aria-labelledby="timeline-heading">
        <div className="max-w-3xl mx-auto px-6">
          <h2 id="timeline-heading" className="font-mono text-3xl font-bold mb-16 text-center">Our story so far</h2>
          <div className="relative">
            <div className="absolute left-[3.5px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
            <div className="flex flex-col gap-12">
              {TIMELINE.map((item, i) => (
                <div key={item.year} className="relative pl-8">
                  <div
                    className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${i === TIMELINE.length - 1 ? 'bg-accent ring-4 ring-accent/20' : 'bg-border'}`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs text-accent uppercase tracking-widest">{item.year}</span>
                  <h3 className="font-mono text-xl font-bold mt-2 mb-3">{item.label}</h3>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-28 border-t border-border bg-muted/20" aria-labelledby="values-heading">
        <div className="max-w-7xl mx-auto px-6">
          <h2 id="values-heading" className="font-mono text-3xl font-bold mb-16 text-center">What we believe</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {VALUES.map(({ title, desc }) => (
              <div key={title} className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-mono text-base font-semibold mb-3">{title}</h3>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28" aria-labelledby="about-cta">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 id="about-cta" className="font-mono text-4xl font-bold mb-6">Come build with us.</h2>
          <p className="font-mono text-muted-foreground mb-10">
            CollabOS is open source. Contributions, bug reports, and feature ideas are always welcome.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth/register" className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-white font-mono text-sm rounded hover:bg-accent/90 transition-colors group">
              Start free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="https://github.com/your-org/collabos" target="_blank" rel="noopener noreferrer" className="px-8 py-3 border border-border font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded transition-colors">
              Contribute on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
