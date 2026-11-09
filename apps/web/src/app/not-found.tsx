import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">404</p>
      <h1 className="font-display font-bold text-4xl tracking-tight">Page not found</h1>
      <p className="font-mono text-sm text-muted-foreground">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/"
        className="font-mono text-sm text-accent hover:underline underline-offset-4"
      >
        Back to workspace
      </Link>
    </div>
  )
}
