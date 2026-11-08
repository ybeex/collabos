'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

interface WorkspaceIndexRedirectProps {
  workspaceSlug: string
}

// PRD_AUDIT.md Finding #9: PRD §14 Flow 1's Role Selection step is
// described as "sets default layout." Honest, minimal reading of that
// line (see CONTINUATION_PLAN.md) — which module a user lands on by
// default, not a full customizable-layout system the PRD doesn't
// actually ask for. Users with no role (everyone who signed up before
// this feature existed, or who used the Skip option) fall through to
// the pre-existing /channels default.
const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  pm: 'tasks',
  dev: 'channels',
  designer: 'canvas',
}

export const WorkspaceIndexRedirect = ({ workspaceSlug }: WorkspaceIndexRedirectProps) => {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession)

  useEffect(() => {
    // Auth lives entirely client-side in this app (zustand persisted to
    // localStorage, no server session), so `user` is null until the
    // persisted store rehydrates AND refresh() completes. Redirecting
    // before hasCheckedSession would always see user=null and wrongly
    // fall back to /channels even for a user who does have a role set.
    if (!hasCheckedSession) return
    const target = (user?.onboardingRole && ROLE_DEFAULT_ROUTE[user.onboardingRole]) || 'channels'
    router.replace(`/${workspaceSlug}/${target}`)
  }, [workspaceSlug, user, hasCheckedSession, router])

  return null
}
