'use client'

import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Send } from 'lucide-react'
import { format } from 'date-fns'
import { nanoid } from 'nanoid'
import { authedFetch } from '@/lib/api-client'
import type { Message, PaginatedResponse } from '@collabos/shared'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'

interface ThreadPanelProps {
  parentMessage: Message
  onClose: () => void
}

export const ThreadPanel = ({ parentMessage, onClose }: ThreadPanelProps) => {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ['thread-messages', parentMessage.id],
    queryFn: ({ pageParam }) =>
      authedFetch<PaginatedResponse<Message>>(
        `/v1/threads/${threadId ?? 'new'}/messages${pageParam ? `?cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.meta.nextCursor ?? undefined,
    enabled: !!threadId,
  })

  const sendReply = useMutation({
    mutationFn: (c: string) =>
      authedFetch<{ thread: { id: string }; reply: Message }>('/v1/threads', {
        method: 'POST',
        body: JSON.stringify({ messageId: parentMessage.id, content: c }),
        headers: { 'Idempotency-Key': nanoid(21) },
      }),
    onSuccess: (res) => {
      if (!threadId) setThreadId(res.thread.id)
      queryClient.invalidateQueries({ queryKey: ['thread-messages', parentMessage.id] })
      setContent('')
    },
    onError: () => toast.error('Failed to send reply'),
  })

  const replies = data?.pages.flatMap((p) => p.data) ?? []

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="font-mono text-sm font-semibold">Thread</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close thread">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Parent message */}
      <div className="border-b border-border p-4">
        <div className="flex gap-3">
          <Avatar src={parentMessage.author.avatarUrl} name={parentMessage.author.name} userId={parentMessage.authorId} size="sm" />
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono text-xs font-semibold">{parentMessage.author.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {format(new Date(parentMessage.createdAt), 'HH:mm')}
              </span>
            </div>
            <p className="font-mono text-xs leading-relaxed">{parentMessage.content}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-4">
        {!threadId ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-xs text-muted-foreground/60 text-center">
              No replies yet.<br />Start the thread below.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <div className="flex flex-col gap-1 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-2">
                <Avatar src={reply.author.avatarUrl} name={reply.author.name} userId={reply.authorId} size="xs" className="mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="font-mono text-xs font-semibold">{reply.author.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {format(new Date(reply.createdAt), 'HH:mm')}
                    </span>
                  </div>
                  <p className="font-mono text-xs leading-relaxed">{reply.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply composer */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded border border-border bg-input px-3 py-2 focus-within:border-accent transition-colors">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (content.trim()) sendReply.mutate(content.trim()) } }}
            placeholder="Reply in thread..."
            rows={1}
            disabled={sendReply.isPending}
            className="flex-1 resize-none bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[20px] max-h-[80px] leading-5"
          />
          <Button size="icon-sm" onClick={() => content.trim() && sendReply.mutate(content.trim())} disabled={!content.trim() || sendReply.isPending} className="h-6 w-6">
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
