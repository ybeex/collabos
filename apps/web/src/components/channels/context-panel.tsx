'use client'

import { useQuery } from '@tanstack/react-query'
import { Link2, Users, Sparkles } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { workspacesApi } from '@/lib/api-client'
import type { WorkspaceMember } from '@collabos/shared'
import { usePresenceStore } from '@/stores/presence'
import { cn } from '@/lib/utils'

interface ContextPanelProps {
  channelId: string
  workspaceId: string
}

export const ContextPanel = ({ workspaceId }: ContextPanelProps) => {
  const { presence } = usePresenceStore()

  const { data: members, isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.members(workspaceId) as Promise<WorkspaceMember[]>,
    enabled: !!workspaceId,
  })

  const online = members?.filter((m) => presence[m.userId]?.status === 'online') ?? []
  const activeMembers = members?.slice(0, 5) ?? []

  return (
    <aside
      className="flex h-full w-52 shrink-0 flex-col border-l border-border bg-card overflow-y-auto"
      aria-label="Context panel"
    >
      {/* Linked items */}
      <section className="p-3 border-b border-border">
        <div className="flex items-center gap-1.5 mb-2">
          <Link2 className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Linked Items
          </span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/50 italic">
          No linked items yet. Convert a message to a task or doc.
        </p>
      </section>

      {/* Active now */}
      <section className="p-3 border-b border-border">
        <div className="flex items-center gap-1.5 mb-2">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Active Now
          </span>
          {online.length > 0 && (
            <span className="ml-auto font-mono text-[10px] text-[var(--color-success)]">
              {online.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activeMembers.map((m) => {
              const userPresence = presence[m.userId]
              const status = userPresence?.status ?? 'offline'
              return (
                <div key={m.userId} className="flex items-center gap-2">
                  <Avatar
                    src={m.user.avatarUrl}
                    name={m.user.name}
                    userId={m.userId}
                    size="xs"
                    showPresence
                    presence={status}
                  />
                  <span
                    className={cn(
                      'font-mono text-xs truncate',
                      status === 'online' ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {m.user.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* AI digest */}
      <section className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            AI Digest
          </span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/50 italic">
          Upgrade to Pro to see daily AI summaries for this channel.
        </p>
      </section>
    </aside>
  )
}
