'use client'

import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import { MarketingNav } from './nav'
import { MarketingFooter } from './footer'
import { HeroSVG } from './hero-svg'
import { WorkGraphSVG } from './workgraph-svg'

export function MarketingHome() {
  return (
    <div className="bg-background text-foreground">
      <MarketingNav />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col justify-center pt-16 overflow-hidden"
        aria-labelledby="hero-h1"
      >
        {/* Grid bg */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Accent bloom */}
        <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" aria-hidden="true" />
        <div className="absolute top-2/3 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-500/3 blur-[80px] pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/5 mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
              <span className="font-mono text-xs text-accent">Now with AI Intelligence</span>
            </div>

            <h1
              id="hero-h1"
              className="font-mono text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight mb-6"
            >
              Stop switching.{' '}
              <span className="text-accent relative">
                Start shipping.
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 300 8"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M0 6 Q75 2 150 5 Q225 8 300 4" stroke="#e8400a" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>

            <p className="font-mono text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">
              CollabOS is one workspace for channels, docs, canvas, tasks, and AI. Everything connected through a live Work Graph. No integrations to maintain. No context lost.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-12">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-mono text-sm font-medium rounded hover:bg-accent/90 transition-colors group"
              >
                Start free — no card needed
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/marketing/features"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors rounded"
              >
                <Play className="h-3.5 w-3.5" />
                See all features
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2" aria-hidden="true">
                {['#7c3aed', '#059669', '#d97706', '#e8400a', '#1a4fff'].map((color, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-background flex items-center justify-center font-mono text-xs font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {['A', 'B', 'C', 'D', 'E'][i]}
                  </div>
                ))}
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                Trusted by <strong className="text-foreground">2,400+</strong> teams shipping faster
              </p>
            </div>
          </div>

          {/* Right: live workspace preview */}
          <div className="relative">
            <div className="relative rounded-xl border border-border shadow-2xl overflow-hidden bg-card">
              <HeroSVG />
            </div>
            {/* Floating stats */}
            <div className="absolute -left-6 top-12 hidden lg:flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
              <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
              <span className="font-mono text-xs text-muted-foreground">Ship in progress</span>
            </div>
            <div className="absolute -right-6 bottom-16 hidden lg:block bg-card border border-border rounded-lg px-4 py-3 shadow-lg">
              <p className="font-mono text-lg font-bold">∞</p>
              <p className="font-mono text-xs text-muted-foreground">message history</p>
            </div>
            <div className="absolute -right-4 top-8 hidden lg:block bg-accent text-white rounded-lg px-3 py-2 shadow-lg">
              <p className="font-mono text-xs font-bold">2.4s</p>
              <p className="font-mono text-[10px] opacity-80">avg decision time</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logo strip ────────────────────────────────────────── */}
      <section className="border-y border-border py-8 overflow-hidden" aria-label="Customer logos">
        <p className="text-center font-mono text-xs text-muted-foreground/60 uppercase tracking-widest mb-6">
          Trusted by engineering teams at
        </p>
        <div className="relative">
          <div className="flex gap-12 items-center animate-marquee whitespace-nowrap">
            {['Meridian Labs', 'Vortex Systems', 'Ironforge', 'Solaris', 'Axiom', 'Redshift', 'Parallel', 'Flux', 'Meridian Labs', 'Vortex Systems', 'Ironforge', 'Solaris', 'Axiom', 'Redshift', 'Parallel', 'Flux'].map((name, i) => (
              <span key={i} className="font-mono text-base font-semibold text-muted-foreground/40 shrink-0">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem ───────────────────────────────────────────── */}
      <section className="py-32" aria-labelledby="problem-h2">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <p className="font-mono text-xs text-accent uppercase tracking-widest mb-4">The real cost</p>
            <h2 id="problem-h2" className="font-mono text-4xl font-bold leading-tight mb-6">
              Your team isn&apos;t slow. Your tools are.
            </h2>
            <p className="font-mono text-muted-foreground leading-relaxed">
              The average knowledge worker touches 9.4 apps per day. Each context switch costs 23 minutes of deep focus. Your team is losing entire workdays to tab management — before they write a line of code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                stat: '9.4',
                unit: 'apps/day',
                desc: 'The average number of tools open simultaneously on an engineering workstation',
                svg: (
                  <svg viewBox="0 0 120 48" className="w-full mt-4" aria-hidden="true">
                    {[30, 42, 48, 36, 48, 40, 28, 20].map((h, i) => (
                      <rect key={i} x={i * 14 + 4} y={48 - h} width="10" height={h} rx="2"
                        fill="#e8400a" opacity={0.2 + (i / 8) * 0.8} />
                    ))}
                  </svg>
                ),
              },
              {
                stat: '23 min',
                unit: 'per switch',
                desc: 'Lost refocusing time after each tool context switch — per switch, per person, per day',
                svg: (
                  <svg viewBox="0 0 120 48" className="w-full mt-4" aria-hidden="true">
                    <circle cx="60" cy="24" r="20" fill="none" stroke="#e8400a" strokeWidth="2" opacity="0.15" />
                    <circle cx="60" cy="24" r="20" fill="none" stroke="#e8400a" strokeWidth="2"
                      strokeDasharray="125" strokeDashoffset="30" strokeLinecap="round"
                      transform="rotate(-90 60 24)" />
                    <text x="60" y="29" textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                      fontSize="10" fill="var(--color-accent)" fontWeight="600">23m</text>
                  </svg>
                ),
              },
              {
                stat: '1',
                unit: 'workspace',
                desc: 'CollabOS replaces Slack, Notion, Linear, and Miro. One bill. One context. Zero switching.',
                svg: (
                  <svg viewBox="0 0 120 48" className="w-full mt-4" aria-hidden="true">
                    <path d="M10 40 L40 10 L70 25 L110 8" fill="none" stroke="#e8400a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="110" cy="8" r="4" fill="#e8400a" />
                    <path d="M10 40 L110 40" stroke="var(--color-border)" strokeWidth="1" />
                  </svg>
                ),
              },
            ].map(({ stat, unit, desc, svg }) => (
              <div key={stat} className="border border-border rounded-lg p-6 bg-card hover:border-accent/30 transition-colors group">
                <div className="font-mono text-4xl font-bold text-accent">{stat}</div>
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mt-1">{unit}</div>
                <p className="font-mono text-sm text-muted-foreground mt-3 leading-relaxed">{desc}</p>
                {svg}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section id="features" className="py-32 bg-muted/20" aria-labelledby="features-h2">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <p className="font-mono text-xs text-accent uppercase tracking-widest mb-4">What&rsquo;s inside</p>
            <h2 id="features-h2" className="font-mono text-4xl font-bold leading-tight mb-6">
              Every tool your team needs. None of the sprawl.
            </h2>
            <p className="font-mono text-muted-foreground leading-relaxed">
              Five fully integrated modules. All connected through the Work Graph so nothing gets lost between tools.
            </p>
          </div>

          {/* 5-module grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              { icon: '#', title: 'Channels', desc: 'Real-time messaging with threads, reactions, file sharing, and message-to-task conversion. Channels that understand context.' },
              { icon: '✦', title: 'Intelligence', desc: 'Ask anything. Get answers from across your channels, docs, and tasks — with citations and source links. Powered by Claude.' },
              { icon: '✓', title: 'Tasks', desc: 'Kanban and list views, comments, assignments, due dates, and Work Graph links. Tasks that know where they came from.' },
              { icon: '📄', title: 'Docs', desc: 'A block editor with 10+ block types, version history, and public sharing. Embed tasks inside docs. Reference docs in channels.' },
              { icon: '◈', title: 'Canvas', desc: 'An infinite SVG canvas for planning, diagramming, and retrospectives. Sticky notes become real tasks in one click.' },
              { icon: '⬡', title: 'Work Graph', desc: 'The connective tissue. Every piece of work is a node. Every connection is an edge. AI traverses it to answer your questions.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="border border-border rounded-lg p-6 bg-card group hover:border-accent/30 transition-all hover:shadow-sm">
                <div className="font-mono text-2xl text-accent mb-3" aria-hidden="true">{icon}</div>
                <h3 className="font-mono text-base font-semibold mb-2">{title}</h3>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/marketing/features"
              className="inline-flex items-center gap-2 font-mono text-sm text-accent hover:underline underline-offset-4"
            >
              See every feature in detail <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Work Graph visual ─────────────────────────────────── */}
      <section className="py-32 overflow-hidden" aria-labelledby="wg-h2">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="font-mono text-xs text-accent uppercase tracking-widest mb-4">The connective tissue</p>
              <h2 id="wg-h2" className="font-mono text-4xl font-bold leading-tight mb-6">
                Every piece of work,<br/>connected.
              </h2>
              <p className="font-mono text-muted-foreground leading-relaxed mb-8">
                CollabOS maintains a live Work Graph — a semantic map of how everything in your workspace relates. A message references a task. A canvas sticky becomes a decision. A doc cites a channel thread. AI traverses it all to answer your questions.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  'Convert a message to a task — the conversation stays attached',
                  'Canvas sticky notes link to the tasks they produced',
                  'Docs embed tasks and reference channel decisions',
                  'AI answers questions by traversing the graph, not guessing',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 font-mono text-sm text-muted-foreground">
                    <span className="text-accent mt-0.5 shrink-0">→</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden="true">
              <WorkGraphSVG />
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────── */}
      <section className="py-32 bg-muted/20" aria-labelledby="testimonials-h2">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-mono text-xs text-accent uppercase tracking-widest mb-4 text-center">What teams say</p>
          <h2 id="testimonials-h2" className="font-mono text-4xl font-bold text-center mb-16">
            Teams that made the switch.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: 'We replaced Slack, Notion, Linear, and Miro with CollabOS. Deploy frequency went up because decisions actually get implemented now — nothing falls through the cracks.',
                name: 'Sofia M.', role: 'CTO, Meridian Labs', initials: 'SM', color: '#7c3aed',
              },
              {
                quote: 'The Work Graph is what nobody else has. When Alice sends a message and Bob converts it to a task, it doesn\'t just create a task — it preserves the decision.',
                name: 'James K.', role: 'Engineering Lead, Vortex Systems', initials: 'JK', color: '#059669',
              },
              {
                quote: 'Intelligence is the killer feature. I ask "what did we decide about auth?" and it returns the exact message thread from 6 months ago. With full context.',
                name: 'Ravi P.', role: 'Product Director, Ironforge', initials: 'RP', color: '#e8400a',
              },
            ].map(({ quote, name, role, initials, color }) => (
              <blockquote key={name} className="border border-border rounded-lg p-6 bg-card flex flex-col gap-6">
                <p className="font-mono text-sm text-muted-foreground leading-relaxed flex-1">
                  &ldquo;{quote}&rdquo;
                </p>
                <footer className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center font-mono text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div>
                    <cite className="font-mono text-sm font-semibold not-italic">{name}</cite>
                    <p className="font-mono text-xs text-muted-foreground">{role}</p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden" aria-labelledby="cta-h2">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-accent/3" />
          <svg viewBox="0 0 1200 400" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="ctaBloom" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e8400a" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#e8400a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="1200" height="400" fill="url(#ctaBloom)" />
            {[280, 200, 120].map((r, i) => (
              <circle key={i} cx="600" cy="200" r={r} fill="none" stroke="#e8400a"
                strokeWidth="1" opacity={0.04 + i * 0.02} />
            ))}
          </svg>
        </div>

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="font-mono text-xs text-accent uppercase tracking-widest mb-6">Ready?</p>
          <h2 id="cta-h2" className="font-mono text-4xl lg:text-5xl font-bold leading-tight mb-6">
            Your team&rsquo;s work deserves a workspace as good as your work.
          </h2>
          <p className="font-mono text-muted-foreground mb-10">
            Start free. No credit card. Upgrade when you need more.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white font-mono text-sm font-medium rounded hover:bg-accent/90 transition-colors group"
            >
              Create your workspace
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/marketing/pricing"
              className="px-8 py-4 border border-border font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors rounded"
            >
              View pricing
            </Link>
          </div>
          <p className="font-mono text-xs text-muted-foreground/60 mt-6">
            Free forever for teams under 3 · Pro from $12/seat/month
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
