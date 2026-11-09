'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings, LogOut, Shield } from 'lucide-react'
import { workspacesApi } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { Avatar } from '@/components/ui/avatar'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { cn } from '@/lib/utils'
import type { Workspace } from '@collabos/shared'

interface WorkspaceMembership {
  workspace: Workspace
  role: string
}

export const WorkspaceRail = (): React.JSX.Element => {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  // Type-mismatch sweep: this previously destructured `setCurrentWorkspace`,
  // which does not exist on WorkspaceState (apps/web/src/stores/workspace.ts
  // exports `setWorkspace`). Destructuring a non-existent property from a
  // Zustand store silently returns undefined rather than throwing at this
  // line — the failure only surfaced when handleWorkspaceClick actually
  // called it as a function, throwing "setCurrentWorkspace is not a
  // function" on every workspace-switch click in the rail. Fixed to the
  // store's real exported name.
  const { currentWorkspace, setWorkspace, sidebarOpen, setSidebarOpen } = useWorkspaceStore()

  const { data: memberships } = useQuery({
    queryKey: ['workspaces'],
    queryFn: (): Promise<WorkspaceMembership[]> => workspacesApi.list() as Promise<WorkspaceMembership[]>,
  })

  const workspaces: Workspace[] = memberships?.map((m: WorkspaceMembership): Workspace => m.workspace) ?? []

  const handleWorkspaceClick = (ws: Workspace): void => {
    setWorkspace(ws)
    router.push(`/${ws.slug}/channels`)
  }

  const handleLogout = async (): Promise<void> => {
    await logout()
    router.replace('/auth/login')
  }

  return (
    <aside
      className="flex h-full w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3 gap-1"
      aria-label="Workspace switcher"
    >
      {/* Workspace switcher */}
      <div className="flex flex-col items-center gap-1.5 flex-1 w-full px-2 overflow-y-auto">
        {workspaces.map((ws) => {
          const isActive = currentWorkspace?.id === ws.id
          return (
            <button
              key={ws.id}
              type="button"
              onClick={(): void => handleWorkspaceClick(ws)}
              title={ws.name}
              aria-label={ws.name}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded transition-all duration-150',
                'font-display font-bold text-sm',
                isActive
                  ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                  : 'bg-muted text-muted-foreground hover:bg-accent/15 hover:text-accent',
              )}
            >
              {ws.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ws.logoUrl} alt={ws.name} className="h-full w-full rounded object-cover" />
              ) : (
                ws.name[0]?.toUpperCase()
              )}
            </button>
          )
        })}

        <button
          type="button"
          onClick={(): void => router.push('/new-workspace')}
          title="Create a new workspace"
          aria-label="Create new workspace"
          className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-sidebar-border text-sidebar-foreground/30 hover:border-accent/40 hover:text-accent transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-2 w-full px-2 shrink-0">
        {/* Toggle sidebar */}
        <button
          type="button"
          onClick={(): void => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-pressed={sidebarOpen}
          className="flex h-7 w-7 items-center justify-center rounded text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-border transition-colors"
        >
          <span className="font-mono text-[10px] font-bold">{sidebarOpen ? '«' : '»'}</span>
        </button>

        {/* Notification bell */}
        <NotificationBell />

        {/* Settings */}
        <button
          type="button"
          onClick={(): void => { if (currentWorkspace) router.push(`/${currentWorkspace.slug}/settings`) }}
          title="Settings"
          aria-label="Settings"
          disabled={!currentWorkspace}
          className="flex h-7 w-7 items-center justify-center rounded text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {/* Super admin dashboard entry point — conditionally rendered, only
            visible to users with isSuperAdmin true. A regular user never
            sees this button exist at all, which matters more than it might
            seem: an undiscoverable-but-technically-reachable admin route is
            a worse security posture than a reachable-but-clearly-gated one,
            since hidden URLs invite "security through obscurity" assumptions
            that the actual backend authorization (requireSuperAdmin /
            requireSuperAdminVerified) does not rely on and should not need. */}
        {user?.isSuperAdmin && (
          <button
            type="button"
            onClick={(): void => router.push('/super-admin')}
            title="Open super admin dashboard"
            aria-label="Super admin dashboard"
            className="flex h-7 w-7 items-center justify-center rounded text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
          </button>
        )}

        {/* User avatar + logout */}
        {user && (
          <div className="relative group">
            <Avatar
              src={user.avatarUrl}
              name={user.name}
              userId={user.id}
              size="sm"
              className="cursor-pointer"
            />
            {/* Logout tooltip */}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className={cn(
                'absolute bottom-full mb-1 left-1/2 -translate-x-1/2',
                'hidden group-hover:flex items-center gap-1',
                'bg-card border border-border rounded px-2 py-1 shadow-md',
                'font-mono text-[10px] whitespace-nowrap text-muted-foreground hover:text-foreground',
                'transition-colors z-50',
              )}
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
