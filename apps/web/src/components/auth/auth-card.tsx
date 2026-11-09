import Image from 'next/image'
import Link from 'next/link'

interface AuthCardProps {
  heading: string
  subheading: string
  children: React.ReactNode
}

// Redesign: login/register used to be a bare centered single-column card
// with no illustration. This wraps both in a shared two-column card —
// illustration + wordmark on the left (dark panel, hidden below `md` so
// the form stays the focus on small screens), the actual form on the
// right. One `AuthCard` avoids duplicating this shell between
// login/register — only the heading/subheading/form content differs.
export const AuthCard = ({ heading, subheading, children }: AuthCardProps) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl border border-border bg-card shadow-sm overflow-hidden grid md:grid-cols-2">
        {/* Illustration panel — hidden on small screens so the card
            collapses to the familiar single-column form, not a
            squeezed-down two-column layout. */}
        <div className="hidden md:flex flex-col justify-between bg-sidebar p-10">
          <Link href="/" className="font-display font-bold text-2xl tracking-tight text-sidebar-foreground w-fit">
            Collab<span className="text-accent">OS</span>
          </Link>
          <div className="flex-1 flex items-center justify-center py-8">
            <Image
              src="/auth-illustration.png"
              alt=""
              width={700}
              height={549}
              priority
              className="w-full max-w-xs h-auto"
            />
          </div>
          <p className="font-mono text-xs text-sidebar-foreground/60 leading-relaxed max-w-[26ch]">
            Channels, docs, canvas, tasks, and AI — all connected in one workspace.
          </p>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          {/* Wordmark only shown here on small screens, where the
              illustration panel above is hidden entirely. */}
          <Link href="/" className="font-display font-bold text-2xl tracking-tight mb-8 w-fit md:hidden">
            Collab<span className="text-accent">OS</span>
          </Link>
          <div className="mb-6">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">{heading}</h1>
            <p className="font-mono text-sm text-muted-foreground mt-1">{subheading}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
