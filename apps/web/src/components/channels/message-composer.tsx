'use client'

import { useRef, useState, useCallback } from 'react'
import { Smile, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AttachmentPicker } from './attachment-picker'

interface MessageComposerProps {
  channelId: string
  channelName: string
  workspaceId?: string
  onSend: (content: string, attachmentIds?: string[]) => void
  isSending: boolean
}

export const MessageComposer = ({
  channelName,
  workspaceId = '',
  onSend,
  isSending,
}: MessageComposerProps) => {
  const [content, setContent] = useState('')
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if ((!trimmed && attachmentIds.length === 0) || isSending) return
    onSend(trimmed, attachmentIds.length > 0 ? attachmentIds : undefined)
    setContent('')
    setAttachmentIds([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    textareaRef.current?.focus()
  }, [content, isSending, onSend, attachmentIds])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    setContent(el.value)
  }

  return (
    <div className="shrink-0 border-t border-border bg-card px-4 py-3">
      <div className={cn(
        'flex items-end gap-2 rounded border border-border bg-input px-3 py-2',
        'focus-within:border-accent transition-colors duration-150',
      )}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}  ·  / for commands  ·  @ to mention`}
          rows={1}
          disabled={isSending}
          className={cn(
            'flex-1 resize-none bg-transparent font-mono text-sm text-foreground',
            'placeholder:text-muted-foreground/60 focus:outline-none',
            'min-h-[24px] max-h-[200px] leading-6 disabled:opacity-50',
          )}
          aria-label={`Message #${channelName}`}
        />

        <div className="flex items-center gap-1 pb-0.5 shrink-0">
          {workspaceId && (
            <AttachmentPicker
              workspaceId={workspaceId}
              onAttachmentsChange={setAttachmentIds}
            />
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Add emoji"
            className="text-muted-foreground hover:text-foreground"
            type="button"
          >
            <Smile className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            onClick={handleSend}
            disabled={(!content.trim() && attachmentIds.length === 0) || isSending}
            aria-label="Send message"
            type="button"
            className={cn('transition-opacity', !content.trim() && attachmentIds.length === 0 && 'opacity-30')}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground/40">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
