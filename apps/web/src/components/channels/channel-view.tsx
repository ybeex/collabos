'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { channelsApi, authedFetch } from '@/lib/api-client'
import type { Channel, Message, WSEvent } from '@collabos/shared'
import { useMessages, useSendMessage } from '@/hooks/use-messages'
import { useWebSocket } from '@/hooks/use-websocket'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { MessageList } from './message-list'
import { MessageComposer } from './message-composer'
import { ChannelHeader } from './channel-header'
import { ContextPanel } from './context-panel'
import { ThreadPanel } from './thread-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { prefersReducedMotion } from '@/lib/utils'

interface ChannelViewProps {
  workspaceSlug: string
  channelId: string
}

// BUG-5 fix: only auto-scroll to the bottom on a new message if the user is
// already near the bottom. Previously this fired unconditionally on every
// message.created event for the channel, yanking the viewport down even
// while someone had deliberately scrolled up to read history.
const NEAR_BOTTOM_THRESHOLD_PX = 150

export const ChannelView = ({ channelId }: ChannelViewProps) => {
  const queryClient = useQueryClient()
  const { currentWorkspace } = useWorkspaceStore()
  const { user } = useAuthStore()
  const searchParams = useSearchParams()
  // PRD_AUDIT.md Finding #4: PRD §13 specifies
  // /:workspace/channels/:channel-id/thread/:thread-id as a deep-linkable
  // URL. Implemented as a query param on the existing channel route,
  // same reasoning as the doc/canvas deep links above.
  const targetThreadId = searchParams.get('thread')
  const [contextPanelOpen, setContextPanelOpen] = useState(false)
  const [threadMessage, setThreadMessage] = useState<Message | null>(null)
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false)
  // PRD_AUDIT.md Finding #8 (accessibility): screen-reader announcement for
  // new messages arriving while the user has scrolled away from the
  // bottom — the same signal that already drives the visible "New
  // messages" pill below, routed to an sr-only aria-live region so a
  // screen reader user gets the equivalent notice. Deliberately does NOT
  // announce every message in an actively-read channel (near-bottom case)
  // — that would bury the user in noise; same channel, same signal as the
  // sighted-user affordance.
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Resolves targetThreadId to its parent message via the new
  // GET /v1/threads/:threadId endpoint (routes/threads/index.ts), which
  // previously did not exist — GET /:threadId/messages only ever
  // returned replies, with no way to fetch the parent message ThreadPanel
  // needs to render at all.
  const { data: resolvedThread } = useQuery({
    queryKey: ['thread-resolve', targetThreadId],
    queryFn: () => authedFetch<{ threadId: string; channelId: string; parentMessage: Message | null }>(`/v1/threads/${targetThreadId}`),
    enabled: !!targetThreadId,
  })

  useEffect(() => {
    if (resolvedThread?.parentMessage) {
      setThreadMessage(resolvedThread.parentMessage)
    }
  }, [resolvedThread])

  const { data: channel, isLoading: channelLoading } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => channelsApi.get(channelId) as Promise<Channel>,
    enabled: !!channelId,
  })

  const { data: messagesData, isLoading: messagesLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(channelId)
  const sendMessage = useSendMessage(channelId)

  // Infinite scroll — load more when top sentinel is visible
  useIntersectionObserver(topSentinelRef, () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, { threshold: 0.1 })

  const isNearBottom = useCallback((): boolean => {
    const el = scrollAreaRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX
  }, [])

  const handleWsEvent = useCallback((event: WSEvent) => {
    if (event.event === 'message.created' && event.data.channelId === channelId) {
      // BUG-4 fix: skip inserting our own messages from the WS broadcast.
      // The sender's copy is already in the cache via the optimistic insert
      // in useSendMessage, reconciled to the real server message in its
      // onSuccess callback. Inserting it again here was the second half of
      // the duplicate-then-flicker bug — for a brief window the sender saw
      // both the temp bubble AND this WS-broadcast bubble simultaneously.
      const authorId = (event.data as { authorId?: string }).authorId
      if (authorId && authorId === user?.id) return

      const wasNearBottom = isNearBottom()

      queryClient.setQueryData<{ pages: Array<{ data: Message[]; meta: unknown }> }>(
        ['messages', channelId],
        (old) => {
          if (!old) return old
          const first = old.pages[0]
          if (!first) return old
          const exists = (first.data as Message[]).some((m) => m.id === event.data.id)
          if (exists) return old
          return { ...old, pages: [{ ...first, data: [event.data, ...(first.data as Message[])] }, ...old.pages.slice(1)] }
        },
      )

      // BUG-5 fix: only auto-scroll if the user was already near the
      // bottom. Otherwise surface a non-intrusive "new messages" pill so
      // someone reading history isn't yanked away from what they're doing.
      if (wasNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      } else {
        setShowNewMessagesPill(true)
        const msg = event.data as Message
        const preview = msg.content.length > 60 ? `${msg.content.slice(0, 60)}…` : msg.content
        setLiveAnnouncement(`New message from ${msg.author.name}: ${preview}`)
      }
    }
    if (event.event === 'message.updated') {
      queryClient.setQueriesData<{ pages: Array<{ data: Message[] }> }>(
        { queryKey: ['messages', channelId] },
        (old) => old ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((m) => m.id === event.data.id ? { ...m, ...event.data } : m) })) } : old,
      )
    }
    if (event.event === 'message.deleted') {
      queryClient.setQueriesData<{ pages: Array<{ data: Message[] }> }>(
        { queryKey: ['messages', channelId] },
        (old) => old ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((m) => m.id === event.data.id ? { ...m, content: '[Message deleted]', deletedAt: new Date().toISOString() } : m) })) } : old,
      )
    }
  }, [channelId, queryClient, user?.id, isNearBottom])

  useWebSocket({ workspaceId: currentWorkspace?.id ?? '', onEvent: handleWsEvent })

  useEffect(() => {
    if (!messagesLoading) bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messagesLoading, channelId])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    setShowNewMessagesPill(false)
    setLiveAnnouncement('')
  }, [])

  const allMessages = messagesData?.pages.flatMap((p) => p.data).reverse() ?? []

  if (channelLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 border-b border-border px-4 flex items-center gap-3"><Skeleton className="h-4 w-32" /></div>
        <div className="flex-1 p-4 flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChannelHeader channel={channel ?? null} onToggleContext={() => setContextPanelOpen((v) => !v)} contextOpen={contextPanelOpen} />
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto relative" id="message-scroll-area">
          {/* Top sentinel for infinite scroll */}
          <div ref={topSentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          )}
          <MessageList messages={allMessages} isLoading={messagesLoading} channelId={channelId} onReply={(msg) => setThreadMessage(msg)} />
          <div ref={bottomRef} className="h-px" />
          {showNewMessagesPill && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white font-mono text-xs shadow-lg hover:bg-accent/90 transition-colors"
            >
              New messages ↓
            </button>
          )}
        </div>
        <MessageComposer channelId={channelId} channelName={channel?.name ?? ''} onSend={(content) => sendMessage.mutate(content)} isSending={sendMessage.isPending} />
      </div>
      {contextPanelOpen && !threadMessage && <ContextPanel channelId={channelId} workspaceId={currentWorkspace?.id ?? ''} />}
      {threadMessage && <ThreadPanel parentMessage={threadMessage} onClose={() => setThreadMessage(null)} />}
    </div>
  )
}
