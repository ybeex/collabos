import Link from 'next/link'

const FOOTER_COLS = [
  {
    title: 'Product',
    links: [
      { href: '/marketing/features', label: 'Features' },
      { href: '/marketing/pricing', label: 'Pricing' },
      { href: '/marketing/changelog', label: 'Changelog' },
      { href: '/marketing/security', label: 'Security' },
    ],
  },
  {
    title: 'Modules',
    links: [
      { href: '/marketing/features#channels', label: 'Channels' },
      { href: '/marketing/features#docs', label: 'Docs' },
      { href: '/marketing/features#canvas', label: 'Canvas' },
      { href: '/marketing/features#tasks', label: 'Tasks' },
      { href: '/marketing/features#intelligence', label: 'Intelligence' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { href: '/docs', label: 'API Reference' },
      { href: '/docs/webhooks', label: 'Webhooks' },
      { href: '/docs/scim', label: 'SCIM Provisioning' },
      { href: 'https://github.com/your-org/collabos', label: 'GitHub ↗' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/marketing/security', label: 'Security' },
      { href: '/cookies', label: 'Cookie Policy' },
    ],
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card mt-32" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row gap-12 md:gap-20">
          {/* Brand */}
          <div className="shrink-0 max-w-xs">
            <Link href="/" className="font-mono text-xl font-bold tracking-tight" aria-label="CollabOS home">
              Collab<span className="text-accent">OS</span>
            </Link>
            <p className="font-mono text-sm text-muted-foreground mt-3 leading-relaxed">
              The unified real-time collaboration workspace. Channels, docs, canvas, tasks, and AI — all connected.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://github.com/your-org/collabos"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </a>
              <a
                href="https://twitter.com/collabos"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Twitter / X"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Link cols */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1">
            {FOOTER_COLS.map(({ title, links }) => (
              <div key={title}>
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  {title}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {links.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
                        {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-mono text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} CollabOS. Open source and self-hostable.
          </p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" aria-hidden="true" />
            <span className="font-mono text-xs text-muted-foreground/60">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
