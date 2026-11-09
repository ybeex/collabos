'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const FEATURES = [
  {
    id: 'channels',
    tag: '#',
    title: 'Channels',
    headline: 'Real-time messaging that threads context',
    desc: 'Channels with threaded replies, emoji reactions, inline file previews, and message-to-task conversion. When a decision happens in a message, one click creates a task with the full conversation attached — forever.',
    points: [
      'Public, private, and direct message channels',
      'Threaded replies that preserve the main channel flow',
      'Convert any message to a task via the Work Graph',
      'Inline edit, soft delete, reaction toggle',
      'Read receipts and unread count per channel',
      'File attachments up to 50MB with video transcoding',
    ],
    svg: (
      <svg viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-lg border border-border" aria-hidden="true">
        <rect width="440" height="280" rx="8" fill="#0f0f0f" />
        <rect width="440" height="34" rx="8" fill="#161616" />
        <rect y="24" width="440" height="10" fill="#161616" />
        <text x="16" y="22" fontFamily="monospace" fontSize="11" fill="#aaa"># engineering</text>
        <text x="120" y="22" fontFamily="monospace" fontSize="9" fill="#3a3a3a">14 members · 3 online</text>
        {/* msg 1 */}
        <circle cx="28" cy="64" r="13" fill="#7c3aed" />
        <text x="28" y="68" textAnchor="middle" fontFamily="monospace" fontSize="9" fontWeight="700" fill="white">B</text>
        <text x="48" y="59" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#ddd">Bob Kumar</text>
        <text x="130" y="59" fontFamily="monospace" fontSize="7.5" fill="#333">10:12</text>
        <text x="48" y="73" fontFamily="monospace" fontSize="9" fill="#777">PR #247 merged — CI green ✓</text>
        <rect x="48" y="80" width="40" height="14" rx="7" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1" />
        <text x="63" y="91" textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#aaa">✓ 5</text>
        {/* thread */}
        <line x1="28" y1="78" x2="28" y2="116" stroke="#2a2a2a" strokeWidth="1" strokeDasharray="2,2" />
        <rect x="44" y="102" width="220" height="28" rx="4" fill="#1a1a1a" stroke="#252525" strokeWidth="1" />
        <circle cx="58" cy="116" r="8" fill="#059669" />
        <text x="58" y="120" textAnchor="middle" fontFamily="monospace" fontSize="7" fill="white">C</text>
        <text x="72" y="112" fontFamily="monospace" fontSize="8" fill="#777">Carol · 2 replies in thread</text>
        <text x="72" y="123" fontFamily="monospace" fontSize="8" fill="#555">LGTM — approving now</text>
        {/* task card */}
        <rect x="270" y="98" width="158" height="52" rx="6" fill="#0f0f0f" stroke="#e8400a" strokeWidth="1.5" />
        <text x="282" y="114" fontFamily="monospace" fontSize="7.5" fill="#e8400a" letterSpacing="0.8">↗ TASK CREATED</text>
        <text x="282" y="128" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#ddd">Review PR #247</text>
        <rect x="282" y="136" width="28" height="10" rx="3" fill="rgba(16,185,129,0.12)" />
        <text x="286" y="144.5" fontFamily="monospace" fontSize="7" fill="#10b981">done</text>
        {/* msg 2 */}
        <circle cx="28" cy="156" r="13" fill="#d97706" />
        <text x="28" y="160" textAnchor="middle" fontFamily="monospace" fontSize="9" fontWeight="700" fill="white">C</text>
        <text x="48" y="151" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#ddd">Carol Zhang</text>
        <text x="48" y="165" fontFamily="monospace" fontSize="9" fill="#777">Canvas redesign ready for review 🎨</text>
        <rect x="48" y="172" width="34" height="14" rx="7" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1" />
        <text x="61" y="183" textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#aaa">👀 2</text>
        {/* composer */}
        <rect x="8" y="244" width="424" height="28" rx="5" fill="#161616" stroke="#222" strokeWidth="1" />
        <text x="20" y="261" fontFamily="monospace" fontSize="8.5" fill="#2e2e2e">Message #engineering...</text>
        <rect x="410" y="252" width="14" height="14" rx="3" fill="#e8400a" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: 'canvas',
    tag: '◈',
    title: 'Canvas',
    headline: 'An infinite board that connects to everything',
    desc: 'A zoomable, pannable SVG canvas for planning, brainstorming, and diagramming. Sticky notes, shapes, and connectors — all linkable to real tasks and docs. Nothing on the canvas stays disconnected.',
    points: [
      'Pan and zoom with mouse, trackpad, or keyboard shortcuts',
      'Sticky notes (5 colours), rectangles, text nodes, connectors',
      'Double-click any sticky note to edit inline',
      'Convert sticky → task in one click via Work Graph',
      'Real-time collaboration — live cursor positions',
      'Canvas thumbnails on list view for fast scanning',
    ],
    svg: (
      <svg viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-lg border border-border" aria-hidden="true">
        <rect width="440" height="280" rx="8" fill="#111" />
        <defs>
          <pattern id="cdots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#1e1e1e" />
          </pattern>
        </defs>
        <rect width="440" height="280" rx="8" fill="url(#cdots)" />
        {/* toolbar */}
        <rect x="8" y="8" width="180" height="26" rx="13" fill="#1a1a1a" stroke="#252525" strokeWidth="1" />
        <text x="22" y="25" fontFamily="monospace" fontSize="10" fill="#e8400a">↖</text>
        <text x="40" y="25" fontFamily="monospace" fontSize="10" fill="#555">✏</text>
        <text x="58" y="25" fontFamily="monospace" fontSize="10" fill="#555">▭</text>
        <text x="76" y="25" fontFamily="monospace" fontSize="10" fill="#555">⊕</text>
        <line x1="90" y1="10" x2="90" y2="32" stroke="#252525" />
        <text x="100" y="25" fontFamily="monospace" fontSize="9" fill="#555">100%</text>
        <text x="140" y="25" fontFamily="monospace" fontSize="9" fill="#555">+  −  ⛶</text>
        {/* frame */}
        <rect x="36" y="52" width="368" height="196" rx="4" fill="none" stroke="#2a2a2a" strokeWidth="1.5" strokeDasharray="4,4" />
        <text x="48" y="68" fontFamily="monospace" fontSize="8.5" fill="#333">Q3 Sprint Planning</text>
        {/* stickies */}
        <rect x="52" y="78" width="116" height="76" rx="4" fill="#fde8e5" />
        <text x="64" y="98" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#0d0d0d">Auth API</text>
        <text x="64" y="112" fontFamily="monospace" fontSize="8" fill="#555">Ship by Friday</text>
        <text x="64" y="126" fontFamily="monospace" fontSize="8" fill="#777">→ Bob</text>
        <rect x="148" y="136" width="14" height="10" rx="2" fill="#e8400a" />
        <text x="152" y="144.5" fontFamily="monospace" fontSize="7" fill="white">↗</text>
        {/* selected */}
        <rect x="50" y="76" width="120" height="80" rx="6" fill="none" stroke="#e8400a" strokeWidth="2" />
        <rect x="162" y="148" width="8" height="8" rx="1" fill="#e8400a" />
        <rect x="184" y="78" width="116" height="76" rx="4" fill="#e3f4ec" />
        <text x="196" y="98" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#0d0d0d">Canvas V2</text>
        <text x="196" y="112" fontFamily="monospace" fontSize="8" fill="#555">Pan+zoom+drag</text>
        <text x="196" y="126" fontFamily="monospace" fontSize="8" fill="#777">→ Carol</text>
        <rect x="52" y="172" width="116" height="64" rx="4" fill="#e8eeff" />
        <text x="64" y="192" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#0d0d0d">Pricing page</text>
        <text x="64" y="206" fontFamily="monospace" fontSize="8" fill="#555">3 tiers confirmed</text>
        <text x="64" y="220" fontFamily="monospace" fontSize="8" fill="#777">Blocked: design</text>
        <rect x="316" y="78" width="76" height="48" rx="4" fill="#fff3e0" />
        <text x="328" y="96" fontFamily="monospace" fontSize="9" fontWeight="600" fill="#0d0d0d">Retro</text>
        <text x="328" y="110" fontFamily="monospace" fontSize="8" fill="#555">Thu 3pm</text>
        {/* connector */}
        <path d="M168 116 C180 116 180 130 184 130" fill="none" stroke="#aaa" strokeWidth="1" strokeDasharray="3,2" />
        {/* cursor dot */}
        <circle cx="52" cy="78" r="3.5" fill="#e8400a" />
        <circle cx="52" cy="78" r="7" fill="none" stroke="#e8400a" strokeWidth="1" opacity="0.3">
          <animate attributeName="r" values="3.5;9;3.5" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    ),
  },
  {
    id: 'intelligence',
    tag: '✦',
    title: 'Intelligence',
    headline: 'Ask anything. Get answers from your whole workspace',
    desc: 'CollabOS Intelligence uses Claude to search channels, docs, and tasks in parallel and returns answers with source citations. Not a chatbot — a workspace-aware research assistant that actually knows what your team decided.',
    points: [
      'Natural language queries across all content types',
      'Sources cited — click any result to jump to the original',
      'Channel and task summarization on demand',
      'Extract tasks from meeting notes or freeform text',
      'Semantic search via Ollama (self-hosted, free) or Anthropic',
      'Full-text PostgreSQL tsvector search as fallback',
    ],
    svg: (
      <svg viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-lg border border-border" aria-hidden="true">
        <rect width="440" height="280" rx="8" fill="#0f0f0f" />
        <rect width="440" height="36" rx="8" fill="#111" />
        <rect y="26" width="440" height="10" fill="#111" />
        <text x="16" y="24" fontFamily="monospace" fontSize="10" fill="#e8400a">✦</text>
        <text x="32" y="24" fontFamily="monospace" fontSize="10" fill="#aaa">Intelligence</text>
        <text x="130" y="24" fontFamily="monospace" fontSize="8.5" fill="#3a3a3a">— Ask anything about your workspace</text>
        {/* user message */}
        <rect x="196" y="50" width="228" height="36" rx="6" fill="rgba(232,64,10,0.1)" stroke="rgba(232,64,10,0.18)" strokeWidth="1" />
        <text x="208" y="65" fontFamily="monospace" fontSize="8.5" fill="#ddd">What did we decide about the</text>
        <text x="208" y="79" fontFamily="monospace" fontSize="8.5" fill="#ddd">Q3 pricing model?</text>
        {/* AI response */}
        <circle cx="24" cy="118" r="12" fill="rgba(232,64,10,0.08)" stroke="rgba(232,64,10,0.2)" strokeWidth="1" />
        <text x="24" y="122" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#e8400a">✦</text>
        <rect x="44" y="102" width="384" height="88" rx="6" fill="#161616" stroke="#222" strokeWidth="1" />
        <text x="58" y="120" fontFamily="monospace" fontSize="8.5" fill="#ddd">Three tiers were confirmed on Jun 4th in #product.</text>
        <text x="58" y="134" fontFamily="monospace" fontSize="8.5" fill="#ddd">Free / Pro $12/seat / Business $24/seat.</text>
        <text x="58" y="148" fontFamily="monospace" fontSize="8.5" fill="#ddd">Alice proposed usage-based, Bob pushed for flat rate.</text>
        <text x="58" y="166" fontFamily="monospace" fontSize="7.5" fill="#3a3a3a">Sources searched:</text>
        <rect x="58" y="174" width="72" height="12" rx="3" fill="#1e1e1e" stroke="#252525" strokeWidth="1" />
        <text x="66" y="183.5" fontFamily="monospace" fontSize="7" fill="#777">💬 42 messages</text>
        <rect x="136" y="174" width="58" height="12" rx="3" fill="#1e1e1e" stroke="#252525" strokeWidth="1" />
        <text x="144" y="183.5" fontFamily="monospace" fontSize="7" fill="#777">📄 3 docs</text>
        <rect x="200" y="174" width="54" height="12" rx="3" fill="#1e1e1e" stroke="#252525" strokeWidth="1" />
        <text x="208" y="183.5" fontFamily="monospace" fontSize="7" fill="#777">✓ 5 tasks</text>
        {/* input */}
        <rect x="16" y="246" width="408" height="26" rx="5" fill="#161616" stroke="#252525" strokeWidth="1" />
        <text x="32" y="262" fontFamily="monospace" fontSize="8.5" fill="#2e2e2e">Ask anything about your workspace...</text>
        <rect x="408" y="252" width="1.5" height="14" fill="#e8400a">
          <animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite" />
        </rect>
      </svg>
    ),
  },
  {
    id: 'tasks',
    tag: '✓',
    title: 'Tasks',
    headline: 'Tasks that know where they came from',
    desc: 'Kanban and list views with full Work Graph integration. Every task links to the message, doc, or canvas node that created it. Comments, assignees, due dates, and status — all in one place.',
    points: [
      'Kanban (4 columns) and sortable list views',
      'Task detail drawer with comments and Work Graph links',
      'Status, priority, assignee, due date — inline editing',
      'Convert messages, canvas stickies, or doc blocks to tasks',
      'BullMQ background indexing for instant search',
      'Webhook events on every status change',
    ],
    svg: (
      <svg viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-lg border border-border" aria-hidden="true">
        <rect width="440" height="280" rx="8" fill="#0f0f0f" />
        <rect width="440" height="34" rx="8" fill="#131313" />
        <rect y="24" width="440" height="10" fill="#131313" />
        <text x="16" y="22" fontFamily="monospace" fontSize="11" fill="#aaa">Tasks</text>
        {/* header buttons */}
        <rect x="290" y="9" width="54" height="18" rx="3" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1" />
        <text x="317" y="22" textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#777">Kanban</text>
        <rect x="350" y="9" width="36" height="18" rx="3" fill="#e8400a" opacity="0.15" stroke="#e8400a" strokeWidth="1" />
        <text x="368" y="22" textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#e8400a">List</text>
        <rect x="394" y="9" width="38" height="18" rx="3" fill="#e8400a" />
        <text x="413" y="22" textAnchor="middle" fontFamily="monospace" fontSize="8" fill="white">+ Task</text>
        {/* col headers */}
        {['To Do', 'In Progress', 'In Review', 'Done'].map((col, i) => (
          <g key={col}>
            <text x={16 + i * 108} y={52} fontFamily="monospace" fontSize="8" fontWeight="600" fill="#555" letterSpacing="0.5">{col.toUpperCase()}</text>
            <rect x={16 + i * 108} y={58} width={10} height={10} rx={5} fill="#1e1e1e" />
            <text x={21 + i * 108} y={66.5} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#555">{[3,2,1,4][i]}</text>
          </g>
        ))}
        {/* task cards col 1 */}
        {[
          { y: 76, title: 'Write API docs', priority: 'low', pColor: '#444', pBg: 'rgba(100,100,100,0.12)', avatar: 'B', avatarColor: '#7c3aed' },
          { y: 128, title: 'Fix rate limiter bug', priority: 'high', pColor: '#f59e0b', pBg: 'rgba(245,158,11,0.12)', avatar: 'A', avatarColor: '#059669' },
          { y: 180, title: 'Update seed data', priority: 'medium', pColor: '#3b82f6', pBg: 'rgba(59,130,246,0.12)', avatar: 'C', avatarColor: '#d97706' },
        ].map(({ y, title, priority, pColor, pBg, avatar, avatarColor }) => (
          <g key={y}>
            <rect x="10" y={y} width="98" height="46" rx="5" fill="#161616" stroke="#222" strokeWidth="1" />
            <text x="18" y={y + 15} fontFamily="monospace" fontSize="8" fontWeight="600" fill="#ddd">{title}</text>
            <rect x="18" y={y + 22} width={priority.length * 6 + 8} height="10" rx="3" fill={pBg} />
            <text x="22" y={y + 30.5} fontFamily="monospace" fontSize="6.5" fill={pColor}>{priority}</text>
            <circle cx="90" cy={y + 34} r="7" fill={avatarColor} />
            <text x="90" y={y + 37.5} textAnchor="middle" fontFamily="monospace" fontSize="6.5" fill="white">{avatar}</text>
          </g>
        ))}
        {/* col 2 */}
        {[
          { y: 76, title: 'Canvas node drag', priority: 'urgent', pColor: '#ef4444', pBg: 'rgba(239,68,68,0.12)', avatar: 'C', avatarColor: '#d97706', due: 'Due today' },
          { y: 140, title: 'BullMQ migration', priority: 'high', pColor: '#f59e0b', pBg: 'rgba(245,158,11,0.12)', avatar: 'B', avatarColor: '#7c3aed', due: '' },
        ].map(({ y, title, priority, pColor, pBg, avatar, avatarColor, due }) => (
          <g key={y}>
            <rect x="116" y={y} width="98" height={due ? 56 : 46} rx="5" fill="#161616" stroke="#222" strokeWidth="1" />
            <text x="124" y={y + 15} fontFamily="monospace" fontSize="8" fontWeight="600" fill="#ddd">{title}</text>
            <rect x="124" y={y + 22} width={priority.length * 6 + 8} height="10" rx="3" fill={pBg} />
            <text x="128" y={y + 30.5} fontFamily="monospace" fontSize="6.5" fill={pColor}>{priority}</text>
            {due && <text x="124" y={y + 47} fontFamily="monospace" fontSize="7" fill="#e8400a">{due}</text>}
            <circle cx="196" cy={y + 34} r="7" fill={avatarColor} />
            <text x="196" y={y + 37.5} textAnchor="middle" fontFamily="monospace" fontSize="6.5" fill="white">{avatar}</text>
          </g>
        ))}
        {/* selected task with detail */}
        <rect x="222" y="76" width="98" height="56" rx="5" fill="#161616" stroke="#e8400a" strokeWidth="1.5" />
        <text x="230" y="92" fontFamily="monospace" fontSize="8" fontWeight="600" fill="#ddd">Deploy auth API</text>
        <rect x="230" y="99" width="32" height="10" rx="3" fill="rgba(16,185,129,0.12)" />
        <text x="234" y="107.5" fontFamily="monospace" fontSize="6.5" fill="#10b981">done</text>
        <rect x="268" y="99" width="38" height="10" rx="3" fill="rgba(139,92,246,0.12)" />
        <text x="272" y="107.5" fontFamily="monospace" fontSize="6.5" fill="#8b5cf6">urgent</text>
        <text x="230" y="122" fontFamily="monospace" fontSize="7" fill="#3a3a3a">via Work Graph ↗</text>
        <circle cx="302" cy="112" r="7" fill="#7c3aed" />
        <text x="302" y="115.5" textAnchor="middle" fontFamily="monospace" fontSize="6.5" fill="white">A</text>
      </svg>
    ),
  },
] as const

export function FeaturesPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="relative pt-32 pb-20 border-b border-border overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(232,64,10,0.06) 0%, transparent 100%)' }} />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="font-mono text-xs text-accent uppercase tracking-widest mb-6">What&rsquo;s inside</p>
          <h1 className="font-mono text-5xl font-bold leading-tight mb-6">
            Every tool your team needs.<br />None of the sprawl.
          </h1>
          <p className="font-mono text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
            Five fully integrated modules. Everything connected through the Work Graph. No integrations to configure, no context lost between tools.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: '#', label: 'Channels', href: '#channels' },
              { icon: '◈', label: 'Canvas', href: '#canvas' },
              { icon: '✦', label: 'Intelligence', href: '#intelligence' },
              { icon: '✓', label: 'Tasks', href: '#tasks' },
              { icon: '📄', label: 'Docs', href: '#docs' },
            ].map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                <span className="text-accent" aria-hidden="true">{icon}</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Feature blocks */}
      {FEATURES.map(({ id, tag, title, headline, desc, points, svg }, i) => (
        <section
          key={id}
          id={id}
          className="py-28 border-b border-border"
          aria-labelledby={`feat-${id}`}
        >
          <div className="max-w-7xl mx-auto px-6">
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${i % 2 !== 0 ? 'lg:grid-flow-dense' : ''}`}>
              <div className={i % 2 !== 0 ? 'lg:col-start-2' : ''}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-accent/20 bg-accent/5 rounded font-mono text-xs text-accent mb-6">
                  <span aria-hidden="true">{tag}</span>
                  {title}
                </div>
                <h2 id={`feat-${id}`} className="font-mono text-3xl font-bold leading-snug mb-5">
                  {headline}
                </h2>
                <p className="font-mono text-muted-foreground leading-relaxed mb-8">{desc}</p>
                <ul className="flex flex-col gap-3 mb-8">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-3 font-mono text-sm text-muted-foreground">
                      <span className="text-accent mt-0.5 shrink-0" aria-hidden="true">→</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={i % 2 !== 0 ? 'lg:col-start-1 lg:row-start-1' : ''}>
                {svg}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-28" aria-labelledby="feat-cta">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 id="feat-cta" className="font-mono text-4xl font-bold mb-6">
            Ready to try it yourself?
          </h2>
          <p className="font-mono text-muted-foreground mb-10">
            All features are available on the free plan for teams under 3. No credit card required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth/register" className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-white font-mono text-sm rounded hover:bg-accent/90 transition-colors group">
              Start building free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/marketing/pricing" className="px-8 py-3 border border-border font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 rounded transition-colors">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
