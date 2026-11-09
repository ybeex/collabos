'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: ReactNode
  /** Position within its list — staggers the first ~10 items by 40ms
   *  each; items beyond that fade in together with no added delay. */
  index?: number
  className?: string
}

// premium-ui-elevation /elevate-ui (Section 2): vanilla IntersectionObserver
// scroll-reveal recipe, as a small wrapper component rather than a hook so
// each list item gets its own independent observer without violating the
// rules of hooks inside a .map() (a hook can't be called from the inline
// callback passed to .map() — this sidesteps that by being a real child
// component, which gets its own hook instance per element the normal way).
// Disconnects after the first reveal — this fires once per item, not on
// every scroll in and out.
//
// Deliberately NOT used for above-the-fold content on initial load (e.g.
// a stat-card grid) — gating already-visible content behind opacity-0
// just makes the page flash in. Only wrap content a user actually
// scrolls to see (long/paginated lists), where the initial-view case is
// naturally handled too: an element already in the viewport when
// observed fires its callback almost immediately, since content here
// only exists post-fetch (after hydration), not as part of first paint.
export const Reveal = ({ children, index = 0, className }: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add('revealed')
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const delay = Math.min(index, 9) * 40

  return (
    <div ref={ref} className={cn('reveal', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}
