'use client'

import { useRef, useEffect, useState } from 'react'
import { messagesApi } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import type { Message } from '@collabos/shared'
import { toast } from '@/components/ui/toaster'

interface MessageEditorProps {
  message: Message
  onDone: () => void
}

export const MessageEditor = ({ message, onDone }: MessageEditorProps) => {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(message.content)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === message.content) { onDone(); return }
    setSaving(true)
    try {
      const updated = await messagesApi.update(message.id, trimmed) as Message
      queryClient.setQueriesData<{ pages: Array<{ data: Message[] }> }>(
        { queryKey: ['messages', message.channelId] },
        (old) => old ? {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((m) => m.id === message.id ? { ...m, ...updated } : m),
          })),
        } : old,
      )
      onDone()
    } catch {
      toast.error('Failed to save edit')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') { onDone() }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        rows={Math.max(2, value.split('\n').length)}
        className="w-full resize-none bg-input border border-accent rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none disabled:opacity-50 leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !value.trim()}
          className="font-mono text-xs text-accent hover:underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <span className="font-mono text-xs text-muted-foreground/40">·</span>
        <button onClick={onDone} className="font-mono text-xs text-muted-foreground hover:text-foreground">
          Cancel (Esc)
        </button>
      </div>
    </div>
  )
}
