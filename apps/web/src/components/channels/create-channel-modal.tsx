'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Hash, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Bug fix: clicking "Create channel" in module-sidebar.tsx used to
// navigate to `/{workspaceSlug}/channels/new`, which rendered
// ChannelView with channelId="new" — treating the literal string "new"
// as a real channel ID and fetching GET /v1/channels/new, which the
// backend correctly 404s since no such channel exists. There was never
// an actual channel-creation UI, just a broken link that looked like one
// — channelsApi.create() (and the matching backend POST /v1/channels)
// already existed and worked, nothing had ever called it. This is that
// missing UI, following the same modal pattern as
// tasks/create-task-modal.tsx.
interface CreateChannelModalProps {
  open: boolean
  onClose: () => void
  workspaceId: string
  onSubmit: (data: { name: string; type: 'public' | 'private'; workspaceId: string }) => void
  isSubmitting: boolean
}

export const CreateChannelModal = ({
  open, onClose, workspaceId, onSubmit, isSubmitting,
}: CreateChannelModalProps) => {
  const [name, setName] = useState('')
  const [type, setType] = useState<'public' | 'private'>('public')
  const [error, setError] = useState('')

  // Matches the backend's createChannelSchema exactly (name gets
  // lowercased/trimmed server-side too, but validating the shape
  // client-side gives an immediate, specific error instead of a round
  // trip for something checkable up front).
  const NAME_PATTERN = /^[a-z0-9-_]+$/

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) { setError('Channel name is required'); return }
    if (!NAME_PATTERN.test(trimmed)) {
      setError('Lowercase letters, numbers, hyphens, and underscores only')
      return
    }
    onSubmit({ name: trimmed, type, workspaceId })
    setName('')
    setType('public')
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
            <Dialog.Title className="font-mono text-sm font-semibold">New Channel</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1.5">Channel name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  {type === 'private' ? <Lock className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
                </span>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  placeholder="team-updates"
                  autoFocus
                  error={error}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1.5">Visibility</label>
              <div className="flex gap-1">
                {([
                  { value: 'public' as const, label: 'Public', icon: Hash },
                  { value: 'private' as const, label: 'Private', icon: Lock },
                ]).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={cn(
                      'flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border transition-colors',
                      type === value
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? 'Creating...' : 'Create channel'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
