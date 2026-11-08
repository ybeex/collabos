'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Workspace } from '@collabos/shared'

// Bug fix: register-form.tsx and login-form.tsx both navigated to `/`
// after a successful register/login (login-form.tsx's own comment even
// said "// redirects to workspace") — but `/` unconditionally renders
// the public marketing homepage (apps/web/src/app/page.tsx), which has
// zero awareness of auth state and does nothing to route the user into
// their workspace. A freshly registered or logged-in user would land
// back on public marketing content, see the same "Start free"/"Sign in"
// CTAs that got them here in the first place, and could easily end up
// clicking back into the auth forms — which is exactly the "stuck on
// the register page" symptom this fixes.
//
// This route was clearly meant to exist already: an empty
// apps/web/src/app/workspace/ directory (no page.tsx inside, so it
// wasn't even a real route) sat there unused. This fills it in.
interface WorkspaceMembership {
  workspace: Workspace
  role: string
}

export default function WorkspaceLandingPage() {
  const router = useRouter()
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const refresh = useAuthStore((s) => s.refresh)
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const checkRanRef = useRef(false)

  // This page isn't nested inside WorkspaceLayout (that only wraps
  // /:workspaceSlug/* routes), so nothing else triggers the initial
  // session check for it. The post-login/post-register case doesn't
  // need this (hasCheckedSession is already true by the time those
  // forms navigate here — set synchronously as part of a successful
  // login()/register()) — but a direct or fresh-reload visit to
  // /workspace (bookmarked, new tab, etc.) would otherwise hang forever
  // waiting on hasCheckedSession that nothing was ever going to set.
  // Same pattern as WorkspaceLayout's own mount effect.
  useEffect(() => {
    if (checkRanRef.current || hasCheckedSession) return
    checkRanRef.current = true
    refresh()
  }, [hasCheckedSession, refresh])

  const { data: memberships, isLoading, isError } = useQuery({
    queryKey: ['workspaces'],
    queryFn: (): Promise<WorkspaceMembership[]> => workspacesApi.list() as Promise<WorkspaceMembership[]>,
    // Same hasCheckedSession gate as WorkspaceIndexRedirect — auth is
    // entirely client-side here, so firing this before the persisted
    // session has actually been verified would either 401 or race the
    // access token being set.
    enabled: hasCheckedSession && isAuthenticated,
  })

  useEffect(() => {
    if (!hasCheckedSession) return

    if (!isAuthenticated) {
      router.replace('/auth/login')
      return
    }

    if (isLoading || isError) return

    const first = memberships?.[0]
    if (first) {
      setWorkspace(first.workspace)
      router.replace(`/${first.workspace.slug}`)
    } else {
      // No workspaces yet — new registration, or every membership was
      // removed. Send them through onboarding rather than to a dead end.
      router.replace('/new-workspace')
    }
  }, [hasCheckedSession, isAuthenticated, isLoading, isError, memberships, router, setWorkspace])

  return null
}
