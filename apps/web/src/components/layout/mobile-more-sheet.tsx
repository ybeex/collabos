'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { X, Bell, Settings, ChevronRight, Shield, LogOut } from 'lucide-react'
import { authedFetch, workspacesApi } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { cn } from '@/lib/utils'
import type { Workspace } from '@collabos/shared'

interface MobileMoreSheetProps {
  open: boolean
  onClose: () => void
}

interface WorkspaceMembership {
  workspace: Workspace
  role: string
}

interface UnreadCountResponse {
  unreadCount: number
}

// BUG-8 fix: MobileNav previously covered only the five content modules
// (Channels/Docs/Canvas/Tasks/AI). NotificationBell, workspace switching,
// and /settings all lived exclusively in WorkspaceRail, which is hidden
// below the md breakpoint — a mobile user had no way to view notifications
// or reach settings without manually typing a URL. This is a full-screen
// bottom sheet, opened from a new "More" tab in MobileNav, that surfaces
// all three.
export const MobileMoreSheet = ({ open, onClose }: MobileMoreSheetProps): React.JSX.Element | null => {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { currentWorkspace, setWorkspace } = useWorkspaceStore()
  const params = useParams<{ workspaceSlug: string }>()
  const workspaceSlug = params?.workspaceSlug
  const sheetRef = useRef<HTMLDivElement>(null)

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: (): Promise<UnreadCountResponse> => authedFetch<UnreadCountResponse>('/v1/notifications?limit=1'),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  })

  const { data: memberships } = useQuery({
    queryKey: ['workspaces'],
    queryFn: (): Promise<WorkspaceMembership[]> => workspacesApi.list() as Promise<WorkspaceMembership[]>,
    enabled: open,
  })

  // Close on Escape, lock body scroll while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return (): void => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const unread: number = unreadData?.unreadCount ?? 0
  const workspaces: Workspace[] = memberships?.map((m: WorkspaceMembership): Workspace => m.workspace) ?? []

  const handleWorkspaceSelect = (ws: Workspace): void => {
    setWorkspace(ws)
    router.push(`/${ws.slug}/channels`)
    onClose()
  }

  const handleSignOut = async (): Promise<void> => {
    await logout()
    router.replace('/auth/login')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="More options"
    >
      {/* Backdrop */}
      <button
        type="button"
        title="Close menu"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={-1}
      />

      {/* Sheet — animate-sheet-up, not animate-slide-up: see the
          consolidation note in globals.css. This needs a distinctly
          larger, sheet-appropriate rise; the shared dropdown-style
          utility is intentionally smaller. */}
      <div
        ref={sheetRef}
        className="relative bg-card border-t border-border rounded-t-2xl max-h-[80vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border sticky top-0 bg-card">
          <span className="font-mono text-sm font-semibold">More</span>
          <button type="button" title="Close" onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notifications */}
        <button
          type="button"
          title="View notifications"
          onClick={(): void => { router.push(`/${workspaceSlug}/notifications`); onClose() }}
          className="flex items-center gap-3 w-full px-4 py-4 border-b border-border hover:bg-muted/30 transition-colors"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded bg-muted shrink-0">
            <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-mono font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          <span className="font-mono text-sm flex-1 text-left">Notifications</span>
          {unread > 0 && <span className="font-mono text-xs text-accent">{unread} new</span>}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
        </button>

        {/* Settings */}
        <button
          type="button"
          title="Open settings"
          onClick={(): void => { router.push(`/${workspaceSlug}/settings`); onClose() }}
          className="flex items-center gap-3 w-full px-4 py-4 border-b border-border hover:bg-muted/30 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted shrink-0">
            <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <span className="font-mono text-sm flex-1 text-left">Settings</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
        </button>

        {/* Super admin dashboard entry point — same conditional rendering
            as the desktop WorkspaceRail equivalent; see that file's
            comment for why this is deliberately discoverable-when-
            authorized rather than hidden behind a manually-typed URL. */}
        {user?.isSuperAdmin && (
          <button
            type="button"
            title="Open super admin dashboard"
            onClick={(): void => { router.push('/super-admin'); onClose() }}
            className="flex items-center gap-3 w-full px-4 py-4 border-b border-border hover:bg-red-500/5 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded bg-red-500/10 shrink-0">
              <Shield className="h-4 w-4 text-red-500" aria-hidden="true" />
            </div>
            <span className="font-mono text-sm flex-1 text-left text-red-500">Super Admin Dashboard</span>
            <ChevronRight className="h-4 w-4 text-red-500/40" aria-hidden="true" />
          </button>
        )}

        {/* Workspace switcher */}
        {workspaces.length > 0 && (
          <div className="border-b border-border">
            <p className="px-4 pt-4 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Switch workspace
            </p>
            {workspaces.map((ws: Workspace) => {
              const isActive: boolean = currentWorkspace?.id === ws.id
              return (
                <button
                  key={ws.id}
                  type="button"
                  title={`Switch to ${ws.name}`}
                  onClick={(): void => handleWorkspaceSelect(ws)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 transition-colors',
                    isActive ? 'bg-accent/5' : 'hover:bg-muted/30',
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded font-mono text-xs font-bold shrink-0',
                    isActive ? 'bg-accent text-white' : 'bg-muted text-muted-foreground',
                  )}>
                    {ws.name[0]?.toUpperCase()}
                  </div>
                  <span className="font-mono text-sm flex-1 text-left">{ws.name}</span>
                  {isActive && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}

        {/* Sign out */}
        <button
          type="button"
          title="Sign out"
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-4 py-4 text-[var(--color-error)] hover:bg-muted/30 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted shrink-0">
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="font-mono text-sm">Sign out</span>
        </button>

        {/* Safe-area padding for iOS home indicator */}
        <div className="h-6" />
      </div>
    </div>
  )
}
