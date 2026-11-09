'use client'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Error</p>
      <h1 className="font-display font-bold text-3xl tracking-tight">Something went wrong</h1>
      <p className="font-mono text-sm text-muted-foreground max-w-sm text-center">
        {error.message || 'An unexpected error occurred.'}
      </p>
      {error.digest && (
        <p className="font-mono text-[10px] text-muted-foreground/50">
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="font-mono text-sm text-accent hover:underline underline-offset-4"
      >
        Try again
      </button>
    </div>
  )
}
