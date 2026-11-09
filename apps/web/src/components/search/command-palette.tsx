'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Hash, FileText, CheckSquare, Palette, Sparkles,
  Settings, Plus, LogOut, User,
} from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { SearchModal } from './search-modal'
import { cn } from '@/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  group: string
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const router = useRouter()
  const { currentWorkspace, channels } = useWorkspaceStore()
  const { user, logout } = useAuthStore()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)

  const workspaceSlug = currentWorkspace?.slug ?? ''

  const allCommands: Command[] = [
    // Navigation
    {
      id: 'nav-channels',
      label: 'Go to Channels',
      icon: Hash,
      group: 'Navigate',
      action: () => router.push(`/${workspaceSlug}/channels`),
      keywords: ['channels', 'messages', 'chat'],
    },
    {
      id: 'nav-docs',
      label: 'Go to Docs',
      icon: FileText,
      group: 'Navigate',
      action: () => router.push(`/${workspaceSlug}/docs`),
      keywords: ['documents', 'notes', 'wiki'],
    },
    {
      id: 'nav-tasks',
      label: 'Go to Tasks',
      icon: CheckSquare,
      group: 'Navigate',
      action: () => router.push(`/${workspaceSlug}/tasks`),
      keywords: ['tasks', 'projects', 'todos'],
    },
    {
      id: 'nav-canvas',
      label: 'Go to Canvas',
      icon: Palette,
      group: 'Navigate',
      action: () => router.push(`/${workspaceSlug}/canvas`),
      keywords: ['canvas', 'whiteboard', 'diagram'],
    },
    {
      id: 'nav-ai',
      label: 'Go to Intelligence',
      icon: Sparkles,
      group: 'Navigate',
      action: () => router.push(`/${workspaceSlug}/ai`),
      keywords: ['ai', 'intelligence', 'ask'],
    },
    {
      id: 'nav-settings',
      label: 'Workspace Settings',
      icon: Settings,
      group: 'Navigate',
      action: () => router.push(`/${workspaceSlug}/settings`),
      keywords: ['settings', 'preferences', 'config'],
    },

    // Channels
    ...channels.slice(0, 7).map((ch) => ({
      id: `ch-${ch.id}`,
      label: `#${ch.name}`,
      description: ch.description ?? undefined,
      icon: Hash,
      group: 'Channels',
      action: () => router.push(`/${workspaceSlug}/channels/${ch.id}`),
      keywords: [ch.name],
    })),

    // Create
    {
      id: 'create-doc',
      label: 'New Document',
      icon: Plus,
      group: 'Create',
      action: () => { router.push(`/${workspaceSlug}/docs/new`); onClose() },
      keywords: ['create', 'new', 'doc'],
    },
    {
      id: 'create-task',
      label: 'New Task',
      icon: Plus,
      group: 'Create',
      action: () => { router.push(`/${workspaceSlug}/tasks?new=1`); onClose() },
      keywords: ['create', 'new', 'task'],
    },
    {
      id: 'create-canvas',
      label: 'New Canvas',
      icon: Plus,
      group: 'Create',
      action: () => { router.push(`/${workspaceSlug}/canvas/new`); onClose() },
      keywords: ['create', 'new', 'canvas'],
    },

    // Account
    {
      id: 'account-profile',
      label: user?.name ?? 'Profile',
      description: user?.email,
      icon: User,
      group: 'Account',
      action: () => router.push('/settings'),
      keywords: ['profile', 'account', 'me'],
    },
    {
      id: 'account-logout',
      label: 'Sign out',
      icon: LogOut,
      group: 'Account',
      action: async () => { onClose(); await logout(); router.replace('/auth/login') },
      keywords: ['logout', 'signout', 'exit'],
    },
  ]

  const filtered = query.trim()
    ? allCommands.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.toLowerCase().includes(q))
        )
      })
    : allCommands

  const groups = [...new Set(filtered.map((c) => c.group))]

  const flatFiltered = groups.flatMap((g) => filtered.filter((c) => c.group === g))

  useEffect(() => {
    if (open) { setQuery(''); setSelectedIdx(0) }
  }, [open])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, flatFiltered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && flatFiltered[selectedIdx]) {
      flatFiltered[selectedIdx]!.action()
      onClose()
    } else if (e.key === 'Escape') { onClose() }
  }, [flatFiltered, selectedIdx, onClose])

  let globalIdx = 0

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-fade-in" />
          <Dialog.Content
            className={cn(
              'fixed left-1/2 top-[15%] -translate-x-1/2 z-50',
              'w-full max-w-xl bg-card border border-border shadow-2xl',
              'data-[state=open]:animate-slide-down',
            )}
            onKeyDown={handleKeyDown}
          >
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>

            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <span className="font-mono text-xs text-muted-foreground/60 bg-muted border border-border px-1.5 py-0.5">CMD K</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </div>

            <div className="max-h-96 overflow-y-auto py-1">
              {flatFiltered.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-mono text-xs text-muted-foreground">No commands found for <strong>&quot;{query}&quot;</strong></p>
                </div>
              ) : (
                groups.map((group) => {
                  const groupItems = filtered.filter((c) => c.group === group)
                  return (
                    <div key={group}>
                      <div className="px-3 py-1.5">
                        <span className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase">{group}</span>
                      </div>
                      {groupItems.map((cmd) => {
                        const idx = globalIdx++
                        const isSelected = selectedIdx === idx
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => { cmd.action(); onClose() }}
                            onMouseEnter={() => setSelectedIdx(idx)}
                            className={cn(
                              'flex items-center gap-3 w-full px-3 py-2 text-left transition-colors',
                              isSelected ? 'bg-accent/10' : 'hover:bg-muted/30',
                            )}
                          >
                            <div className="flex h-6 w-6 items-center justify-center shrink-0">
                              <cmd.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-mono text-sm">{cmd.label}</span>
                              {cmd.description && (
                                <span className="font-mono text-xs text-muted-foreground ml-2">{cmd.description}</span>
                              )}
                            </div>
                            {isSelected && <kbd className="font-mono text-[10px] bg-muted border border-border px-1.5 text-muted-foreground">Enter</kbd>}
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-border px-4 py-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground/40">
                {flatFiltered.length} command{flatFiltered.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/40">
                <span><kbd className="bg-muted border border-border px-1">↑↓</kbd> navigate</span>
                <span><kbd className="bg-muted border border-border px-1">Enter</kbd> run</span>
                <span><kbd className="bg-muted border border-border px-1">Esc</kbd> close</span>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
