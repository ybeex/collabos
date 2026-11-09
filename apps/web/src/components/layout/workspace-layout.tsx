'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { workspacesApi } from '@/lib/api-client'
import { WorkspaceRail } from './workspace-rail'
import { ModuleSidebar } from './module-sidebar'
import { MobileNav } from './mobile-nav'
import { CommandPalette } from '@/components/search/command-palette'
import { SearchModal } from '@/components/search/search-modal'
import { cn } from '@/lib/utils'
import type { Workspace } from '@collabos/shared'

interface WorkspaceLayoutProps {
  children: React.ReactNode
}

interface WorkspaceMembership {
  workspace: Workspace
  role: string
}

export const WorkspaceLayout = ({ children }: WorkspaceLayoutProps) => {
  const { isAuthenticated, hasCheckedSession, refresh } = useAuthStore()
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const router = useRouter()
  const params = useParams<{ workspaceSlug: string }>()
  const workspaceSlug = params?.workspaceSlug
  const [cmdOpen, setCmdOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const checkRanRef = useRef(false)

  // BUG-1 fix: session verification is ALWAYS run on mount, unconditionally —
  // never gated on a previously persisted isAuthenticated value. refresh()
  // itself decides whether a session can be restored; this effect just makes
  // sure that decision always happens exactly once per mount, with no
  // dependency on stale state from a prior session.
  useEffect(() => {
    // A successful login/register already validated the session in this
    // browser tab. Refreshing again during the immediate redirect to a
    // workspace rotates the same one-use refresh token a second time and can
    // race with the workspace's first authenticated requests. Only restore a
    // session on direct loads where the store has not checked it yet.
    if (checkRanRef.current || hasCheckedSession) return
    checkRanRef.current = true
    refresh().then((ok) => {
      if (!ok) router.replace('/auth/login')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCheckedSession])

  // Bug fix: `currentWorkspace` in useWorkspaceStore is never persisted
  // (no localStorage) and nothing else populated it on a direct page
  // load — only components that reached a workspace page by clicking
  // through the workspace-rail switcher or the /workspace landing page
  // (both of which call setWorkspace themselves) ever had it set. Any
  // direct URL visit, bookmark, or plain page refresh left it null, and
  // module-sidebar.tsx was passing the raw URL slug directly as
  // `workspaceId` to the channels API as a workaround/oversight — the
  // backend correctly found no membership row for a "workspace" literally
  // named e.g. "acme-corp" and returned 403. canvas-view.tsx had the same
  // underlying gap one level removed (reading currentWorkspace?.id
  // straight from the store with no fallback). This resolves the slug to
  // a real workspace once, centrally, in the one layout every workspace
  // page shares, instead of leaving each consumer to (sometimes
  // correctly, sometimes not) re-derive it independently.
  const { data: memberships } = useQuery({
    queryKey: ['workspaces'],
    queryFn: (): Promise<WorkspaceMembership[]> => workspacesApi.list() as Promise<WorkspaceMembership[]>,
    enabled: hasCheckedSession && isAuthenticated,
  })

  useEffect(() => {
    if (!workspaceSlug || !memberships) return
    const match = memberships.find((m) => m.workspace.slug === workspaceSlug)
    if (match) setWorkspace(match.workspace)
  }, [workspaceSlug, memberships, setWorkspace])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.key === 'k') { e.preventDefault(); setCmdOpen((v) => !v) }
    if (meta && e.key === 'f') { e.preventDefault(); setSearchOpen((v) => !v) }
    if (e.key === 'Escape') { setCmdOpen(false); setSearchOpen(false) }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Gate on hasCheckedSession, not just isAuthenticated — this guarantees we
  // never render the authenticated shell before the session has actually
  // been verified against the server on this load (closes BUG-1's window).
  if (!hasCheckedSession || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="font-mono text-xs text-muted-foreground">Loading workspace</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop rail + sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <WorkspaceRail />
      </div>
      <div className="hidden md:flex">
        <ModuleSidebar onOpenSearch={() => setSearchOpen(true)} onOpenCommand={() => setCmdOpen(true)} />
      </div>

      {/* Content area */}
      <main className={cn(
        'flex-1 flex flex-col overflow-hidden',
        'pb-16 md:pb-0', // bottom padding for mobile nav
      )}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Overlays */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
