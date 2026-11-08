'use client'

import { useState } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, FileText, Palette, CheckSquare, Sparkles, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authedFetch } from '@/lib/api-client'
import { MobileMoreSheet } from './mobile-more-sheet'

const MODULES = [
  { id: 'channels', label: 'Chat', icon: MessageSquare, path: 'channels' },
  { id: 'docs', label: 'Docs', icon: FileText, path: 'docs' },
  { id: 'canvas', label: 'Canvas', icon: Palette, path: 'canvas' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, path: 'tasks' },
  { id: 'ai', label: 'AI', icon: Sparkles, path: 'ai' },
] as const

export const MobileNav = () => {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams<{ workspaceSlug: string }>()
  const workspaceSlug = params?.workspaceSlug
  const [moreOpen, setMoreOpen] = useState(false)

  // BUG-8 fix: poll for unread notifications so the "More" tab can carry a
  // badge — otherwise a mobile user would have no signal that anything is
  // waiting for them behind that tab at all, even with the sheet wired up.
  const { data } = useQuery({
    queryKey: ['notifications-unread-count-nav'],
    queryFn: () => authedFetch<{ unreadCount: number }>('/v1/notifications?limit=1'),
    refetchInterval: 30_000,
    enabled: !!workspaceSlug,
  })
  const unread = data?.unreadCount ?? 0

  if (!workspaceSlug) return null

  return (
    <>
      <nav
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm"
        aria-label="Mobile navigation"
      >
        {MODULES.map((mod) => {
          const isActive = pathname?.includes(`/${mod.path}`)
          return (
            <button
              key={mod.id}
              onClick={() => router.push(`/${workspaceSlug}/${mod.path}`)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-3 transition-colors',
                isActive ? 'text-accent' : 'text-muted-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <mod.icon className="h-5 w-5" />
              <span className="font-mono text-[9px] uppercase tracking-wider">{mod.label}</span>
            </button>
          )
        })}

        {/* BUG-8 fix: "More" tab — the only entry point on mobile to
            notifications, workspace switching, and settings, all of which
            previously lived exclusively in the desktop-only WorkspaceRail. */}
        <button
          onClick={() => setMoreOpen(true)}
          className="relative flex flex-1 flex-col items-center gap-1 py-3 text-muted-foreground transition-colors"
          aria-label={`More${unread > 0 ? ` (${unread} unread notifications)` : ''}`}
        >
          <span className="relative">
            <MoreHorizontal className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-mono font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider">More</span>
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
