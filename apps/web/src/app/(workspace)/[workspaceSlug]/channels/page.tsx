'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { channelsApi } from '@/lib/api-client'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Channel } from '@collabos/shared'
import { Hash } from 'lucide-react'

// Redirect to the first available channel
//
// Bug fix: this used to hand-roll its own `fetch()` to /v1/workspaces,
// reading an Authorization token from `localStorage.getItem('_ctkn')` —
// a key nothing else in this app ever wrote. Access tokens are
// deliberately kept in memory only (see lib/api-client.ts's
// accessToken module variable / getAccessToken()), never persisted to
// localStorage, so that read was always null and every request this
// page made went out with an empty bearer token — meaning this redirect
// could never actually have worked; it always fell through to "Select a
// channel from the sidebar" and just sat there. Rewritten to use
// currentWorkspace from the store (resolved centrally in
// WorkspaceLayout, the shared parent of every workspace page — see
// module-sidebar.tsx's fix for the same underlying gap) via the app's
// real authedFetch-backed API client instead of a parallel, broken
// fetch path.
export default function ChannelsIndexPage() {
  const router = useRouter()
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace)
  const workspaceSlug = currentWorkspace?.slug ?? ''

  const { data: channels, isLoading } = useQuery({
    queryKey: ['channels-for-redirect', currentWorkspace?.id],
    queryFn: () => channelsApi.list(currentWorkspace!.id) as Promise<Channel[]>,
    enabled: !!currentWorkspace,
    retry: false,
  })

  useEffect(() => {
    if (!isLoading && channels && channels.length > 0) {
      const first = channels[0]
      if (first) router.replace(`/${workspaceSlug}/channels/${first.id}`)
    }
  }, [channels, isLoading, router, workspaceSlug])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <Hash className="h-8 w-8 text-muted-foreground/30" />
      <p className="font-mono text-sm text-muted-foreground">
        {isLoading ? 'Loading channels...' : 'Select a channel from the sidebar'}
      </p>
    </div>
  )
}
