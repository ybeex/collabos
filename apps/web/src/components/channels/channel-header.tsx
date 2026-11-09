'use client'

import { Hash, Lock, Info, Search, SlidersHorizontal } from 'lucide-react'
import type { Channel } from '@collabos/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChannelHeaderProps {
  channel: Channel | null
  onToggleContext: () => void
  contextOpen: boolean
}

export const ChannelHeader = ({ channel, onToggleContext, contextOpen }: ChannelHeaderProps) => {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {channel?.type === 'private' ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="font-mono text-sm font-semibold truncate">{channel?.name}</span>
        {channel?.description && (
          <>
            <span className="text-border mx-1">|</span>
            <span className="font-mono text-xs text-muted-foreground truncate hidden sm:block">
              {channel.description}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon-sm" aria-label="Search messages">
          <Search className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Channel settings">
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleContext}
          aria-label="Toggle context panel"
          aria-pressed={contextOpen}
          className={cn(contextOpen && 'bg-accent/15 text-accent')}
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  )
}
