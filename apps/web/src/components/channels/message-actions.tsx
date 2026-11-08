'use client'

import { Reply, CheckSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Message } from '@collabos/shared'
import { messagesApi } from '@/lib/api-client'
import { useDeleteMessage } from '@/hooks/use-messages'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const QUICK_REACTIONS = ['', '', '', '', ''] as const

interface MessageActionsProps {
  message: Message
  channelId: string
  onReply?: (message: Message) => void
  onEdit?: () => void
}

export const MessageActions = ({ message, onReply, onEdit }: MessageActionsProps) => {
  const { user } = useAuthStore()
  // onEdit passed from parent
  const deleteMessage = useDeleteMessage()
  const isAuthor = user?.id === message.authorId

  const handleReact = async (emoji: string) => {
    try { await messagesApi.react(message.id, emoji) }
    catch { toast.error('Failed to add reaction') }
  }

  return (
    <div className="absolute right-2 -top-4 flex items-center gap-0.5 bg-card border border-border rounded shadow-sm px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      {QUICK_REACTIONS.map((emoji) => (
        <button key={emoji} onClick={() => handleReact(emoji)}
          className="h-6 w-6 flex items-center justify-center text-xs hover:bg-muted rounded transition-colors" aria-label={`React with ${emoji}`}>
          {emoji}
        </button>
      ))}
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button variant="ghost" size="icon-sm" onClick={() => onReply?.(message)} aria-label="Reply in thread" className="h-6 w-6">
        <Reply className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => toast.info('Create task from message')} aria-label="Create task" className="h-6 w-6">
        <CheckSquare className="h-3 w-3" />
      </Button>
      {isAuthor && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="h-6 w-6" aria-label="More options"><MoreHorizontal className="h-3 w-3" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--color-error)]" onClick={() => deleteMessage.mutate(message.id)} disabled={deleteMessage.isPending}>
              <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
