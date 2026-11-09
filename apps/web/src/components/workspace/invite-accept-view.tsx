'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authedFetch } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'

interface InviteData {
  workspaceName: string
  workspaceSlug: string
  inviterName?: string
  role: string
}

interface InviteAcceptViewProps {
  token: string
}

export const InviteAcceptView = ({ token }: InviteAcceptViewProps) => {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [state, setState] = useState<'loading' | 'ready' | 'accepting' | 'done' | 'error'>('loading')
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); setErrorMessage('Invalid invitation link.'); return }

    authedFetch<InviteData>(`/v1/workspaces/invite/${token}`)
      .then((data) => { setInvite(data); setState('ready') })
      .catch((err: Error) => {
        setState('error')
        setErrorMessage(err.message.includes('expired') ? 'This invitation has expired or already been used.' : 'This invitation is invalid.')
      })
  }, [token])

  const accept = async () => {
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=/invite?token=${token}`)
      return
    }
    setState('accepting')
    try {
      await authedFetch(`/v1/workspaces/invite/${token}/accept`, { method: 'POST' })
      setState('done')
      setTimeout(() => router.replace(`/${invite?.workspaceSlug}/channels`), 1500)
    } catch (err: unknown) {
      setState('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to accept invitation.')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="font-mono text-sm text-muted-foreground">Loading invitation...</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-error-bg)]">
          <AlertCircle className="h-6 w-6 text-[var(--color-error)]" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-[var(--color-error)]">Invitation unavailable</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">{errorMessage}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/')}>Go to dashboard</Button>
      </div>
    )
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)]">
          <CheckCircle className="h-6 w-6 text-[var(--color-success)]" />
        </div>
        <p className="font-mono text-sm font-semibold">Welcome to {invite?.workspaceName}</p>
        <p className="font-mono text-xs text-muted-foreground">Taking you to the workspace...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-border rounded bg-card p-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 border border-accent/20">
          <span className="font-display font-bold text-lg text-accent">
            {invite?.workspaceName[0]?.toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-mono text-sm font-semibold">{invite?.workspaceName}</p>
          {invite?.inviterName && (
            <p className="font-mono text-xs text-muted-foreground mt-1">
              {invite.inviterName} invited you as a <strong>{invite.role}</strong>
            </p>
          )}
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs text-center text-muted-foreground">
            Sign in or create an account to accept this invitation.
          </p>
          <Button onClick={() => router.push(`/auth/login?redirect=/invite?token=${token}`)}>
            Sign in to accept
          </Button>
          <Button variant="outline" onClick={() => router.push(`/auth/register?redirect=/invite?token=${token}`)}>
            Create account
          </Button>
        </div>
      ) : (
        <Button onClick={accept} disabled={state === 'accepting'} className="w-full">
          {state === 'accepting' ? (
            <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Joining workspace...</>
          ) : (
            `Join ${invite?.workspaceName}`
          )}
        </Button>
      )}
    </div>
  )
}
