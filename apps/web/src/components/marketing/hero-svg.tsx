'use client'

import { useEffect, useRef } from 'react'

export function HeroSVG() {
  const typingRef = useRef<SVGTextElement>(null)
  const cursorRef = useRef<SVGRectElement>(null)
  const taskCardRef = useRef<SVGGElement>(null)
  const aiBadgeRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const messages = [
      'Canvas redesign ready for review',
      'Shipping auth API today 🚀',
      'Q3 pricing confirmed — 3 tiers',
    ]
    let msgIdx = 0
    let charIdx = 0
    let phase: 'typing' | 'pause' | 'clearing' = 'typing'
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const el = typingRef.current
      const taskCard = taskCardRef.current
      const aiBadge = aiBadgeRef.current
      if (!el) return

      if (phase === 'typing') {
        const msg = messages[msgIdx]!
        el.textContent = msg.slice(0, charIdx + 1)
        charIdx++
        if (charIdx >= msg.length) {
          phase = 'pause'
          // Show task card when message is complete
          if (taskCard) { taskCard.style.opacity = '1'; taskCard.style.transition = 'opacity 0.4s ease' }
          timer = setTimeout(tick, 1800)
          return
        }
        timer = setTimeout(tick, 60 + Math.random() * 40)
      } else if (phase === 'pause') {
        phase = 'clearing'
        if (aiBadge) { aiBadge.style.opacity = '1'; aiBadge.style.transition = 'opacity 0.4s ease' }
        timer = setTimeout(tick, 1200)
      } else {
        const current = el.textContent ?? ''
        if (current.length > 0) {
          el.textContent = current.slice(0, -1)
          timer = setTimeout(tick, 25)
        } else {
          phase = 'typing'
          charIdx = 0
          msgIdx = (msgIdx + 1) % messages.length
          if (taskCard) taskCard.style.opacity = '0'
          if (aiBadge) aiBadge.style.opacity = '0'
          timer = setTimeout(tick, 400)
        }
      }
    }

    timer = setTimeout(tick, 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <svg
      viewBox="0 0 560 420"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      role="img"
      aria-label="CollabOS workspace preview showing channels, messages, and real-time collaboration"
    >
      {/* Window chrome */}
      <rect width="560" height="420" rx="10" fill="#0d0d0d" />
      <rect width="560" height="36" rx="10" fill="#161616" />
      <rect y="26" width="560" height="10" fill="#161616" />
      <circle cx="20" cy="18" r="5" fill="#ff5f57" />
      <circle cx="38" cy="18" r="5" fill="#febc2e" />
      <circle cx="56" cy="18" r="5" fill="#28c840" />
      <text x="280" y="23" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="10" fill="#444">
        # general — Acme Corp
      </text>

      {/* Workspace rail */}
      <rect x="0" y="36" width="48" height="384" fill="#111" />
      {[
        { y: 52, letter: 'A', color: '#e8400a' },
        { y: 96, letter: 'J', color: '#222' },
        { y: 136, letter: 'M', color: '#222' },
      ].map(({ y, letter, color }) => (
        <g key={y}>
          <rect x="8" y={y} width="32" height="32" rx="8" fill={color} stroke={color === '#222' ? '#333' : 'none'} strokeWidth="1" />
          <text x="24" y={y + 21} textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="11" fontWeight="700" fill={color === '#222' ? '#555' : 'white'}>{letter}</text>
        </g>
      ))}
      {/* Rail module icons */}
      {[
        { y: 200, icon: '#' },
        { y: 230, icon: '✓' },
        { y: 260, icon: '◈' },
        { y: 290, icon: '✦' },
      ].map(({ y, icon }) => (
        <text key={y} x="24" y={y + 10} textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="13" fill="#333">{icon}</text>
      ))}

      {/* Sidebar */}
      <rect x="48" y="36" width="148" height="384" fill="#141414" />
      {/* Search */}
      <rect x="56" y="46" width="132" height="22" rx="5" fill="#1e1e1e" />
      <text x="68" y="61" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fill="#3a3a3a">⌘ Search...</text>

      {/* Module tabs */}
      <rect x="56" y="74" width="132" height="20" rx="4" fill="rgba(232,64,10,0.10)" />
      <text x="64" y="88" fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#e8400a">⬛ Channels</text>
      {['📄 Docs', '◈ Canvas', '✓  Tasks', '✦  AI'].map((label, i) => (
        <text key={label} x="64" y={110 + i * 17} fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#444">{label}</text>
      ))}

      <line x1="56" y1="186" x2="188" y2="186" stroke="#222" strokeWidth="1" />
      <text x="64" y="199" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#3a3a3a" letterSpacing="1">CHANNELS</text>

      {/* Channels list */}
      <rect x="56" y="204" width="132" height="18" rx="3" fill="rgba(232,64,10,0.07)" />
      <text x="64" y="216" fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#e8400a"># general</text>
      {['# product', '# engineering', '🔒 leadership'].map((ch, i) => (
        <text key={ch} x="64" y={232 + i * 16} fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#444">{ch}</text>
      ))}

      {/* Main area */}
      <rect x="196" y="36" width="364" height="384" fill="#0f0f0f" />

      {/* Channel header */}
      <rect x="196" y="36" width="364" height="34" fill="#131313" />
      <line x1="196" y1="70" x2="560" y2="70" stroke="#1e1e1e" strokeWidth="1" />
      <text x="208" y="57" fontFamily="var(--font-dm-mono),monospace" fontSize="11" fill="#999"># general</text>
      <text x="280" y="57" fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#3a3a3a">Company-wide updates · 3 members online</text>

      {/* Date divider */}
      <line x1="208" y1="86" x2="380" y2="86" stroke="#1e1e1e" strokeWidth="1" />
      <text x="295" y="90" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="8" fill="#3a3a3a">Today</text>
      <line x1="320" y1="86" x2="548" y2="86" stroke="#1e1e1e" strokeWidth="1" />

      {/* Message 1 */}
      <circle cx="218" cy="112" r="13" fill="#7c3aed" />
      <text x="218" y="116" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fontWeight="700" fill="white">A</text>
      <text x="237" y="107" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fontWeight="600" fill="#ccc">Alice Chen</text>
      <text x="330" y="107" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#3a3a3a">09:41</text>
      <text x="237" y="120" fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#777">Auth API shipped ✓  Deploy window in 30min</text>
      <rect x="237" y="127" width="38" height="14" rx="7" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1" />
      <text x="252" y="138" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="8" fill="#888">🚀 3</text>

      {/* Message 2 */}
      <circle cx="218" cy="160" r="13" fill="#059669" />
      <text x="218" y="164" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fontWeight="700" fill="white">B</text>
      <text x="237" y="155" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fontWeight="600" fill="#ccc">Bob Kumar</text>
      <text x="330" y="155" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#3a3a3a">09:44</text>
      <text x="237" y="168" fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#777">Monitoring dashboard live too — Grafana looks 🔥</text>

      {/* Message 3 — typing animation */}
      <circle cx="218" cy="204" r="13" fill="#d97706" />
      <text x="218" y="208" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fontWeight="700" fill="white">C</text>
      <text x="237" y="199" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fontWeight="600" fill="#ccc">Carol Zhang</text>
      <text x="330" y="199" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#3a3a3a">now</text>
      <text ref={typingRef} x="237" y="214" fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#888" />

      {/* Task card — appears after message typed */}
      <g ref={taskCardRef} style={{ opacity: 0, transition: 'opacity 0.4s ease' }}>
        <rect x="350" y="108" width="188" height="74" rx="7" fill="#151515" stroke="#e8400a" strokeWidth="1.5" />
        <text x="362" y="124" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#e8400a" letterSpacing="0.8">↗ TASK CREATED</text>
        <text x="362" y="140" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fontWeight="600" fill="#ddd">Deploy auth API</text>
        <rect x="362" y="148" width="36" height="12" rx="3" fill="rgba(16,185,129,0.12)" />
        <text x="366" y="157.5" fontFamily="var(--font-dm-mono),monospace" fontSize="7" fill="#10b981">done</text>
        <rect x="404" y="148" width="44" height="12" rx="3" fill="rgba(139,92,246,0.12)" />
        <text x="408" y="157.5" fontFamily="var(--font-dm-mono),monospace" fontSize="7" fill="#8b5cf6">urgent</text>
        <circle cx="516" cy="154" r="9" fill="#7c3aed" />
        <text x="516" y="158" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="8" fill="white">A</text>
        <text x="362" y="173" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#3a3a3a">via Work Graph · message → task</text>
      </g>

      {/* AI badge — appears after task card */}
      <g ref={aiBadgeRef} style={{ opacity: 0, transition: 'opacity 0.4s ease' }}>
        <rect x="380" y="240" width="160" height="64" rx="8" fill="#111" stroke="rgba(232,64,10,0.3)" strokeWidth="1" />
        <text x="392" y="257" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#e8400a" letterSpacing="0.8">✦ AI SUMMARY</text>
        <text x="392" y="271" fontFamily="var(--font-dm-mono),monospace" fontSize="8" fill="#666">Auth shipped. Canvas in review.</text>
        <text x="392" y="284" fontFamily="var(--font-dm-mono),monospace" fontSize="8" fill="#666">2 tasks updated today.</text>
        <text x="392" y="297" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#3a3a3a">3 decisions recorded</text>
      </g>

      {/* Presence */}
      <circle cx="210" cy="336" r="4" fill="#10b981" />
      <text x="220" y="340" fontFamily="var(--font-dm-mono),monospace" fontSize="8" fill="#3a3a3a">3 members active now</text>

      {/* Composer */}
      <rect x="204" y="374" width="348" height="34" rx="5" fill="#161616" stroke="#252525" strokeWidth="1" />
      <text x="218" y="394" fontFamily="var(--font-dm-mono),monospace" fontSize="8.5" fill="#2e2e2e">
        Message #general · / for commands · @ to mention
      </text>
      {/* Blinking cursor in composer */}
      <rect ref={cursorRef} x="218" y="382" width="1.5" height="14" fill="#e8400a">
        <animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite" />
      </rect>
    </svg>
  )
}
