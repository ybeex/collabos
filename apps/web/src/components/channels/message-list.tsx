'use client'

import { memo, useState } from 'react'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import type { Message } from '@collabos/shared'
import { Avatar } from '@/components/ui/avatar'
import { MessageActions } from './message-actions'
import { MessageEditor } from './message-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  channelId: string
  onReply?: (message: Message) => void
}

const formatDateDivider = (date: Date): string => {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

export const MessageList = memo(({ messages, isLoading, channelId, onReply }: MessageListProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 6 }).map((_, i) => <MessageSkeleton key={i} />)}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
        <p className="font-mono text-sm text-muted-foreground">No messages yet.</p>
        <p className="font-mono text-xs text-muted-foreground/60">Send the first message below.</p>
      </div>
    )
  }

  const grouped: Array<{ date: Date; messages: Message[] }> = []
  let currentGroup: { date: Date; messages: Message[] } | undefined

  for (const msg of messages) {
    const msgDate = new Date(msg.createdAt)
    if (!currentGroup || !isSameDay(currentGroup.date, msgDate)) {
      currentGroup = { date: msgDate, messages: [] }
      grouped.push(currentGroup)
    }
    currentGroup.messages.push(msg)
  }

  return (
    <div className="flex flex-col px-4 pb-2">
      {grouped.map((group) => (
        <div key={group.date.toISOString()}>
          <div className="flex items-center gap-3 py-3">
            <div className="flex-1 border-t border-border" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">{formatDateDivider(group.date)}</span>
            <div className="flex-1 border-t border-border" />
          </div>
          {group.messages.map((msg, idx) => {
            const prev = group.messages[idx - 1]
            const isConsecutive = prev && prev.authorId === msg.authorId &&
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
            return <MessageItem key={msg.id} message={msg} isConsecutive={!!isConsecutive} channelId={channelId} onReply={onReply} />
          })}
        </div>
      ))}
    </div>
  )
})
MessageList.displayName = 'MessageList'

interface MessageItemProps {
  message: Message
  isConsecutive: boolean
  channelId: string
  onReply?: (message: Message) => void
}

const MessageItem = memo(({ message, isConsecutive, channelId, onReply }: MessageItemProps) => {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const isDeleted = !!message.deletedAt
  const isTemp = message.id.startsWith('temp-')

  return (
    <div className={cn('group relative flex gap-3 rounded px-2 py-0.5 transition-colors duration-75', hovered && 'bg-muted/40', isConsecutive ? 'mt-0.5' : 'mt-3', isTemp && 'opacity-60')}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="w-9 shrink-0 pt-0.5">
        {!isConsecutive ? (
          <Avatar src={message.author.avatarUrl} name={message.author.name} userId={message.authorId} size="md" />
        ) : (
          <span className="block text-[10px] text-muted-foreground/40 text-right leading-none pt-1 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {!isConsecutive && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-mono text-sm font-semibold">{message.author.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{format(new Date(message.createdAt), 'HH:mm')}</span>
            {message.editedAt && <span className="font-mono text-[9px] text-muted-foreground/50">(edited)</span>}
          </div>
        )}
        {editing ? (
          <MessageEditor message={message} onDone={() => setEditing(false)} />
        ) : (
          <p className={cn('font-mono text-sm leading-relaxed whitespace-pre-wrap break-words', isDeleted && 'text-muted-foreground italic')}>
            {message.content}
          </p>
        )}
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(message.reactions.reduce<Record<string, number>>((acc, r) => { acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc }, {}))
              .map(([emoji, count]) => (
                <button key={emoji} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-xs hover:bg-accent/10 hover:border-accent/40 transition-colors">
                  <span>{emoji}</span>
                  <span className="text-muted-foreground">{count}</span>
                </button>
              ))}
          </div>
        )}
      </div>
      {hovered && !isDeleted && !isTemp && <MessageActions message={message} channelId={channelId} onReply={onReply} onEdit={() => setEditing(true)} />}
    </div>
  )
})
MessageItem.displayName = 'MessageItem'

const MessageSkeleton = () => (
  <div className="flex gap-3">
    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex gap-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-12" /></div>
      <Skeleton className="h-4 w-full max-w-sm" />
      <Skeleton className="h-4 w-48" />
    </div>
  </div>
)
