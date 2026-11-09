'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Building2, Users, ScrollText, ArrowLeft, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { workspacesApi } from '@/lib/api-client'
import type { Workspace } from '@collabos/shared'

interface WorkspaceMembership {
  workspace: Workspace
  role: string
}

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/super-admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/super-admin/workspaces', label: 'Workspaces', icon: Building2 },
  { href: '/super-admin/users', label: 'Users', icon: Users },
  { href: '/super-admin/audit-log', label: 'Audit Log', icon: ScrollText },
] as const

/**
 * Visually distinct from WorkspaceRail/ModuleSidebar by design — a deep
 * red-toned background rather than the product's usual near-black,
 * specifically so it is immediately, viscerally obvious to whoever is
 * looking at the screen that they are in a higher-trust, platform-wide
 * context and not inside any single workspace. This is a deliberate UX
 * safety signal: a super admin who has two tabs open (one workspace, one
 * platform dashboard) should never be able to mistake which is which at
 * a glance.
 */
export const SuperAdminNav = (): React.JSX.Element => {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  // FINAL_SWEEP.md BUG-3 fix: "Back to workspace" previously linked to
  // href="/", which is the public marketing homepage with no auth-aware
  // redirect logic at all (app/page.tsx unconditionally renders
  // MarketingHome) — clicking it sent a logged-in super admin to a
  // logged-out-looking landing page, never to an actual workspace,
  // regardless of how many workspaces they belonged to. Now resolves to
  // the user's first actual workspace membership, or /new-workspace if
  // they have none (e.g. the seeded super admin, who is deliberately not
  // a member of any workspace by design).
  const { data: memberships } = useQuery({
    queryKey: ['workspaces'],
    queryFn: (): Promise<WorkspaceMembership[]> => workspacesApi.list() as Promise<WorkspaceMembership[]>,
  })

  const firstWorkspace: Workspace | undefined = memberships?.[0]?.workspace
  const backToWorkspaceHref: string = firstWorkspace ? `/${firstWorkspace.slug}/channels` : '/new-workspace'
  const backToWorkspaceLabel: string = firstWorkspace ? 'Back to workspace' : 'Create a workspace'

  const handleLogout = async (): Promise<void> => {
    await logout()
    router.replace('/auth/login')
  }

  const navRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)

  // premium-ui-elevation /elevate-ui: sliding active-item indicator
  // (Section 1D) replacing an instant background-color swap between nav
  // links. Vertical stack here, so this slides on the Y axis rather than
  // X like the horizontal filter-pill pattern used in workspaces-view.tsx.
  useEffect(() => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!nav || !pill) return
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!active) { pill.style.opacity = '0'; return }
    pill.style.opacity = '1'
    pill.style.height = `${active.offsetHeight}px`
    pill.style.transform = `translateY(${active.offsetTop}px)`
  }, [pathname])

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#3a1410] bg-[#1a0c0a]">
      <div className="px-4 py-5 border-b border-[#3a1410]">
        <Link href="/super-admin" className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-white">
            Collab<span className="text-accent">OS</span>
          </span>
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-widest text-red-400/70 mt-1">
          Super Admin
        </p>
      </div>

      <nav ref={navRef} className="relative flex-1 flex flex-col gap-0.5 px-2 py-3" aria-label="Super admin navigation">
        <div
          ref={pillRef}
          className="absolute left-2 right-2 top-3 rounded bg-accent/15 transition-[transform,height] duration-200 ease-[var(--ease-out)] opacity-0"
          aria-hidden="true"
        />
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'group relative z-10 flex items-center gap-2.5 px-3 py-2 rounded font-mono text-sm transition-colors duration-150',
                isActive
                  ? 'text-accent'
                  : 'text-red-100/60 hover:text-red-50 hover:bg-white/5',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t border-[#3a1410] flex flex-col gap-0.5">
        <Link
          href={backToWorkspaceHref}
          title={backToWorkspaceLabel}
          className="group flex items-center gap-2.5 px-3 py-2 rounded font-mono text-sm text-red-100/60 hover:text-red-50 hover:bg-white/5 transition-colors duration-150"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          {backToWorkspaceLabel}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          className="group flex items-center gap-2.5 px-3 py-2 rounded font-mono text-sm text-red-100/60 hover:text-red-50 hover:bg-white/5 transition-colors duration-150 text-left active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          Sign out
        </button>
        {user && (
          <p className="font-mono text-[10px] text-red-100/40 px-3 pt-2 truncate">
            {user.email}
          </p>
        )}
      </div>
    </aside>
  )
}
