'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '/marketing/features', label: 'Features' },
  { href: '/marketing/pricing', label: 'Pricing' },
  { href: '/marketing/changelog', label: 'Changelog' },
  { href: '/marketing/security', label: 'Security' },
] as const

export function MarketingNav() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border'
          : 'bg-transparent',
      )}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0 group" aria-label="CollabOS home">
          <span className="font-mono text-xl font-bold tracking-tight">
            Collab<span className="text-accent">OS</span>
          </span>
          <span
            className="font-mono text-accent animate-blink"
            aria-hidden="true"
            style={{ animation: 'blink 1.2s step-end infinite' }}
          >_</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-3 py-1.5 font-mono text-sm transition-colors duration-150 rounded',
                pathname === href
                  ? 'text-accent bg-accent/8'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              aria-current={pathname === href ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
            href="/auth/login"
            className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="font-mono text-sm bg-accent text-white px-4 py-2 rounded hover:bg-accent/90 transition-colors"
          >
            Start free
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden bg-background border-t border-border px-6 py-4 flex flex-col gap-2"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-sm py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
          <div className="border-t border-border pt-3 mt-1 flex flex-col gap-2">
            <Link href="/auth/login" className="font-mono text-sm py-2 text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/auth/register" className="font-mono text-sm bg-accent text-white px-4 py-2 text-center rounded hover:bg-accent/90 transition-colors">
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
