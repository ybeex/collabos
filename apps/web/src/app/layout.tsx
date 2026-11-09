import type { Metadata, Viewport } from 'next'
import { Syne, DM_Mono, Fraunces } from 'next/font/google'
import { Providers } from '@/components/providers'
import '@/styles/globals.css'

// PRD_AUDIT.md Finding #5: PRD §15 specifies Syne (display/H1/H2),
// DM Mono (body), and Fraunces Light Italic (subheading/callout) — the
// build previously used Geist Sans/Geist Mono instead.
//
// Found while fixing this: tailwind.config.ts's `display` font family was
// ALREADY mapped to var(--font-syne), but that CSS variable was never
// defined anywhere — every one of the 14 components using font-display
// has been silently falling back to system-ui this whole time. Someone
// clearly intended Syne already; this fix actually defines the variable
// that mapping needed rather than just adding a new, unrelated one.
const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-syne' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono' })
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300'],
  style: ['italic'],
  variable: '--font-fraunces',
})

export const metadata: Metadata = {
  // Bug fix: without this, Next.js can't resolve the OG/Twitter image
  // convention files (opengraph-image.jpg etc.) to absolute URLs for
  // social platforms and falls back to localhost — wrong in any real
  // deployment. NEXT_PUBLIC_APP_URL should be set to the real deployed
  // origin; defaults to localhost for local dev, matching the existing
  // NEXT_PUBLIC_API_URL pattern in lib/api-client.ts.
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'),
  title: { default: 'CollabOS', template: '%s | CollabOS' },
  description: 'The unified real-time collaboration platform',
  // Default to noindex; marketing pages and the homepage explicitly opt back
  // in via their own metadata export (Next.js merges, child page wins).
  // Authenticated workspace routes inherit this default and stay noindex.
  robots: { index: false, follow: false },
  // Bug fix: no favicon, OG image, or Twitter card existed anywhere in
  // this app before — apps/web/src/app/icon.png, apple-icon.png,
  // opengraph-image.jpg, and twitter-image.jpg are picked up
  // automatically by Next.js's file-convention system (no path or
  // `images` array needed here — that field is for explicit-URL images
  // and requires a full descriptor including `url`, which conflicts with
  // the auto-detected file's own URL). Alt text for the convention files
  // is supplied via sibling opengraph-image.alt.txt /
  // twitter-image.alt.txt files instead.
  openGraph: {
    siteName: 'CollabOS',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0e8' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${syne.variable} ${dmMono.variable} ${fraunces.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
