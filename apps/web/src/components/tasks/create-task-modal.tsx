'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TaskPriority } from '@collabos/shared'

interface CreateTaskModalProps {
  open: boolean
  onClose: () => void
  workspaceId: string
  onSubmit: (data: { title: string; priority: TaskPriority; status: 'todo'; workspaceId: string }) => void
  isSubmitting: boolean
}

export const CreateTaskModal = ({
  open, onClose, workspaceId, onSubmit, isSubmitting,
}: CreateTaskModalProps) => {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    onSubmit({ title: title.trim(), priority, status: 'todo', workspaceId })
    setTitle('')
    setPriority('medium')
    setError('')
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-fade-in" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-md bg-card border border-border shadow-xl',
          'data-[state=open]:animate-slide-up',
          'p-6',
        )}>
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-mono text-sm font-semibold">New Task</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1.5">Title</label>
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError('') }}
                placeholder="Task title"
                autoFocus
                error={error}
              />
            </div>

            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1.5">Priority</label>
              <div className="flex gap-1">
                {(['urgent', 'high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors',
                      priority === p
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={isSubmitting || !title.trim()}>
                {isSubmitting ? 'Creating...' : 'Create task'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
