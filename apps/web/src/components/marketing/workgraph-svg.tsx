'use client'

export function WorkGraphSVG() {
  return (
    <svg
      viewBox="0 0 520 380"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      aria-hidden="true"
    >
      <defs>
        <marker id="wg-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#e8400a" opacity="0.5" />
        </marker>
        <radialGradient id="wg-center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8400a" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#e8400a" stopOpacity="0" />
        </radialGradient>
        <filter id="wg-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Orbit rings */}
      <circle cx="260" cy="190" r="130" fill="none" stroke="rgba(232,64,10,0.06)" strokeWidth="1" strokeDasharray="3,8" />
      <circle cx="260" cy="190" r="80" fill="none" stroke="rgba(232,64,10,0.04)" strokeWidth="1" />

      {/* Center node */}
      <circle cx="260" cy="190" r="48" fill="url(#wg-center-glow)" />
      <circle cx="260" cy="190" r="44" fill="#0f0f0f" stroke="#e8400a" strokeWidth="1.5" filter="url(#wg-glow)" />
      <text x="260" y="185" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="13" fontWeight="700" fill="#e8400a">Collab</text>
      <text x="260" y="200" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="13" fontWeight="700" fill="#e8400a">OS</text>

      {/* Satellite nodes */}
      {/* Channels — top left */}
      <line x1="224" y1="153" x2="150" y2="90" stroke="#e8400a" strokeWidth="1" strokeDasharray="4,3" opacity="0.35" markerEnd="url(#wg-arrow)" />
      <rect x="72" y="58" width="100" height="52" rx="8" fill="#151515" stroke="#252525" strokeWidth="1.5" />
      <text x="122" y="79" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="12" fill="#e8400a">#</text>
      <text x="122" y="95" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fill="#ccc">Channels</text>
      <text x="122" y="106" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#444">real-time</text>

      {/* Tasks — top right */}
      <line x1="296" y1="153" x2="368" y2="88" stroke="#e8400a" strokeWidth="1" strokeDasharray="4,3" opacity="0.35" markerEnd="url(#wg-arrow)" />
      <rect x="348" y="56" width="100" height="52" rx="8" fill="#151515" stroke="#252525" strokeWidth="1.5" />
      <text x="398" y="77" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="12" fill="#e8400a">✓</text>
      <text x="398" y="93" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fill="#ccc">Tasks</text>
      <text x="398" y="104" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#444">kanban / list</text>

      {/* AI — top center */}
      <line x1="260" y1="146" x2="260" y2="52" stroke="#e8400a" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" markerEnd="url(#wg-arrow)" />
      <rect x="206" y="16" width="108" height="44" rx="8" fill="rgba(232,64,10,0.08)" stroke="#e8400a" strokeWidth="1.5" />
      <text x="260" y="36" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fill="#e8400a">✦ Intelligence</text>
      <text x="260" y="52" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#e8400a" opacity="0.6">AI-powered</text>

      {/* Docs — bottom left */}
      <line x1="225" y1="228" x2="150" y2="295" stroke="#e8400a" strokeWidth="1" strokeDasharray="4,3" opacity="0.35" markerEnd="url(#wg-arrow)" />
      <rect x="72" y="276" width="100" height="52" rx="8" fill="#151515" stroke="#252525" strokeWidth="1.5" />
      <text x="122" y="297" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="11" fill="#e8400a">📄</text>
      <text x="122" y="312" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fill="#ccc">Docs</text>
      <text x="122" y="323" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#444">block editor</text>

      {/* Canvas — bottom right */}
      <line x1="295" y1="228" x2="368" y2="296" stroke="#e8400a" strokeWidth="1" strokeDasharray="4,3" opacity="0.35" markerEnd="url(#wg-arrow)" />
      <rect x="348" y="278" width="100" height="52" rx="8" fill="#151515" stroke="#252525" strokeWidth="1.5" />
      <text x="398" y="299" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="11" fill="#e8400a">◈</text>
      <text x="398" y="314" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="9" fill="#ccc">Canvas</text>
      <text x="398" y="325" textAnchor="middle" fontFamily="var(--font-dm-mono),monospace" fontSize="7.5" fill="#444">infinite board</text>

      {/* Edge type labels */}
      <text x="155" y="125" fontFamily="var(--font-dm-mono),monospace" fontSize="7" fill="#333">converted_from</text>
      <text x="330" y="118" fontFamily="var(--font-dm-mono),monospace" fontSize="7" fill="#333">referenced_in</text>
      <text x="148" y="266" fontFamily="var(--font-dm-mono),monospace" fontSize="7" fill="#333">decided_in</text>
      <text x="320" y="268" fontFamily="var(--font-dm-mono),monospace" fontSize="7" fill="#333">produced_by</text>

      {/* Animated pulse on center */}
      <circle cx="260" cy="190" r="44" fill="none" stroke="#e8400a" strokeWidth="1" opacity="0">
        <animate attributeName="r" values="44;70;44" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
