'use client'

import { useState, useRef, useEffect } from 'react'
// PRD_AUDIT.md Finding #8 (accessibility), same design as channel-view.tsx:
// this codebase has no WS event for notifications (confirmed — it's purely
// 30s-poll-based via refetchInterval below), so the closest honest "new
// arrival" signal is a rise in unreadCount between polls. Announced via
// sr-only aria-live, same pattern as the channel new-message pill.
// NotificationsView (the full-page browse view) is NOT wired the same way:
// it's a one-shot infinite-scroll query with no polling or live signal at
// all, so there is nothing "real-time" to announce there without adding
// new polling infrastructure — out of scope for this accessibility finding.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Sparkles, MessageSquare, CheckSquare, UserPlus, X } from 'lucide-react'
import { authedFetch } from '@/lib/api-client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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

export const NotificationBell = () => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const previousUnreadRef = useRef<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => authedFetch<NotificationsResponse>('/v1/notifications?limit=20'),
    refetchInterval: 30_000, // Poll every 30s as a fallback to WS
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!data) return
    const prev = previousUnreadRef.current
    // Skip the initial load (prev === null) — only announce increases
    // between polls, not the count that was already there on page load.
    if (prev !== null && data.unreadCount > prev) {
      const newest = data.data[0]
      if (newest) {
        setLiveAnnouncement(`New notification: ${newest.title}`)
      }
    }
    previousUnreadRef.current = data.unreadCount
  }, [data])

  const markRead = useMutation({
    mutationFn: (id: string) =>
      authedFetch(`/v1/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => authedFetch('/v1/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = data?.unreadCount ?? 0
  const notifications = data?.data ?? []

  return (
    <div className="relative" ref={panelRef}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>
      <button
        onClick={() => setOpen((v) => { if (!v) setLiveAnnouncement(''); return !v })}
        className="relative flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-mono font-bold text-white"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-10 z-50 w-80 bg-card border border-border shadow-xl',
            'flex flex-col max-h-[480px]',
            'animate-slide-down',
          )}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="font-mono text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="h-6 text-[10px] px-2"
                  aria-label="Mark all as read"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  All read
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col gap-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3 border-b border-border">
                    <Skeleton className="h-6 w-6 rounded shrink-0" />
                    <div className="flex flex-col gap-1.5 flex-1">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Bell className="h-8 w-8 text-muted-foreground/20" />
                <p className="font-mono text-xs text-muted-foreground">No notifications yet</p>
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
                      setOpen(false)
                    }}
                    className={cn(
                      'flex gap-3 w-full px-4 py-3 text-left border-b border-border',
                      'hover:bg-muted/30 transition-colors',
                      !n.read && 'bg-accent/5',
                    )}
                  >
                    <div className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded mt-0.5',
                      n.read ? 'bg-muted' : 'bg-accent/10',
                    )}>
                      <Icon className={cn('h-3.5 w-3.5', n.read ? 'text-muted-foreground' : 'text-accent')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-mono text-xs leading-relaxed', !n.read && 'font-semibold')}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                          {n.body}
                        </p>
                      )}
                      <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="h-2 w-2 rounded-full bg-accent shrink-0 mt-2" aria-hidden="true" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2 shrink-0">
              <p className="font-mono text-[10px] text-center text-muted-foreground/50">
                Showing {notifications.length} most recent
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
