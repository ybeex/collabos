'use client'

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Sparkles, MessageSquare, CheckSquare, UserPlus } from 'lucide-react'
import { authedFetch } from '@/lib/api-client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { useRef } from 'react'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  entityUrl: string | null
  read: boolean
  createdAt: string
}

interface NotificationsResponse {
  data: Notification[]
  unreadCount: number
  meta: { hasNextPage: boolean; nextCursor: string | null }
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mention: MessageSquare,
  thread_reply: MessageSquare,
  task_assigned: CheckSquare,
  task_status_changed: CheckSquare,
  task_comment: CheckSquare,
  workspace_invite: UserPlus,
  workspace_member_joined: UserPlus,
  ai_digest_ready: Sparkles,
}

interface NotificationsViewProps {
  workspaceSlug: string
}

// BUG-8 fix: full-page notification view. Previously notifications were
// only reachable via the desktop-only dropdown in WorkspaceRail — this
// component gives every screen size (mobile via the new "More" sheet,
// desktop via direct navigation) a proper place to review the complete
// notification history with infinite scroll, not just the most-recent-20
// the dropdown shows.
export const NotificationsView = ({ workspaceSlug }: NotificationsViewProps) => {
  const queryClient = useQueryClient()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['notifications-full', workspaceSlug],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      authedFetch<NotificationsResponse>(`/v1/notifications?limit=30${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })

  useIntersectionObserver(loadMoreRef, () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, { threshold: 0.1 })

  const markRead = useMutation({
    mutationFn: (id: string) => authedFetch(`/v1/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-full', workspaceSlug] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => authedFetch('/v1/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-full', workspaceSlug] }),
  })

  const notifications = data?.pages.flatMap((p) => p.data) ?? []
  const unreadCount = data?.pages[0]?.unreadCount ?? 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-lg font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-accent text-white">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-6 py-4 border-b border-border">
                <Skeleton className="h-9 w-9 rounded shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Bell className="h-10 w-10 text-muted-foreground/20" />
            <p className="font-mono text-sm text-muted-foreground">No notifications yet</p>
            <p className="font-mono text-xs text-muted-foreground/60 max-w-xs text-center">
              Mentions, task assignments, and thread replies will show up here.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell
            return (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id)
                  if (n.entityUrl) window.location.href = n.entityUrl
                }}
                className={cn(
                  'flex gap-3 w-full px-6 py-4 text-left border-b border-border',
                  'hover:bg-muted/30 transition-colors',
                  !n.read && 'bg-accent/5',
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded mt-0.5',
                  n.read ? 'bg-muted' : 'bg-accent/10',
                )}>
                  <Icon className={cn('h-4 w-4', n.read ? 'text-muted-foreground' : 'text-accent')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-mono text-sm leading-relaxed', !n.read && 'font-semibold')}>{n.title}</p>
                  {n.body && <p className="font-mono text-xs text-muted-foreground mt-1">{n.body}</p>}
                  <p className="font-mono text-xs text-muted-foreground/50 mt-1.5">{formatRelativeTime(n.createdAt)}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-accent shrink-0 mt-2" aria-hidden="true" />}
              </button>
            )
          })
        )}
        <div ref={loadMoreRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
