'use client'

import { useState } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, FileText, Palette, CheckSquare, Sparkles, Plus, ChevronDown, Hash, Lock, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { channelsApi } from '@/lib/api-client'
import type { Channel } from '@collabos/shared'
import { useWorkspaceStore } from '@/stores/workspace'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { CreateChannelModal } from '@/components/channels/create-channel-modal'

const MODULES = [
  { id: 'channels', label: 'Channels', icon: MessageSquare, path: 'channels' },
  { id: 'docs', label: 'Docs', icon: FileText, path: 'docs' },
  { id: 'canvas', label: 'Canvas', icon: Palette, path: 'canvas' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, path: 'tasks' },
  { id: 'ai', label: 'Intelligence', icon: Sparkles, path: 'ai' },
] as const

type ModuleId = (typeof MODULES)[number]['id']

interface ModuleSidebarProps {
  onOpenSearch?: () => void
  onOpenCommand?: () => void
}

export const ModuleSidebar = ({ onOpenSearch, onOpenCommand }: ModuleSidebarProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams<{ workspaceSlug: string }>()
  const { sidebarOpen, currentWorkspace } = useWorkspaceStore()
  const workspaceSlug = params?.workspaceSlug
  const queryClient = useQueryClient()
  const [createChannelOpen, setCreateChannelOpen] = useState(false)

  const activeModule: ModuleId = (() => {
    for (const m of MODULES) { if (pathname?.includes(`/${m.path}`)) return m.id }
    return 'channels'
  })()

  // Bug fix: this used to call `channelsApi.list(workspaceSlug ?? '')` —
  // passing the raw URL slug (e.g. "acme-corp") directly where a real
  // workspace ID is expected. The backend's membership check correctly
  // found no workspaceMember row for a "workspace" literally named that,
  // and returned 403 — this is exactly the reported
  // `GET /v1/channels?workspaceId=acme-corp` 403. currentWorkspace is now
  // resolved centrally in WorkspaceLayout (the shared parent of every
  // workspace page), so this uses the real `.id` instead. Gated on
  // `!!currentWorkspace` so this doesn't fire with an empty/undefined id
  // during the brief window before that resolution effect runs.
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', currentWorkspace?.id],
    queryFn: () => channelsApi.list(currentWorkspace!.id) as Promise<Channel[]>,
    enabled: !!currentWorkspace && activeModule === 'channels',
  })

  const createChannel = useMutation({
    mutationFn: (data: { name: string; type: 'public' | 'private'; workspaceId: string }) =>
      channelsApi.create(data) as Promise<Channel>,
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['channels', currentWorkspace?.id] })
      setCreateChannelOpen(false)
      if (workspaceSlug) router.push(`/${workspaceSlug}/channels/${channel.id}`)
    },
    onError: () => toast.error('Failed to create channel'),
  })

  const navigate = (path: string) => { if (workspaceSlug) router.push(`/${workspaceSlug}/${path}`) }

  if (!sidebarOpen) return null

  return (
    <aside className="flex h-full w-52 flex-col border-r border-sidebar-border bg-sidebar shrink-0 overflow-hidden" aria-label="Module navigation">
      {/* Search shortcut bar */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded border border-sidebar-border bg-sidebar-border/30 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-border transition-colors"
        aria-label="Search workspace (Ctrl+F)"
      >
        <Search className="h-3 w-3 shrink-0" />
        <span className="font-mono text-[11px] flex-1 text-left">Search...</span>
        <kbd className="font-mono text-[9px] bg-sidebar-border px-1 rounded">Ctrl F</kbd>
      </button>

      {/* Module nav */}
      <nav className="flex flex-col gap-0.5 p-2" aria-label="Modules">
        {MODULES.map((mod) => {
          const isActive = activeModule === mod.id
          return (
            <button key={mod.id} onClick={() => navigate(mod.path)}
              className={cn('flex items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors duration-100 font-mono text-xs',
                isActive ? 'bg-accent/15 text-accent' : 'text-sidebar-foreground/60 hover:bg-sidebar-border hover:text-sidebar-foreground')}
              aria-current={isActive ? 'page' : undefined}>
              <mod.icon className="h-3.5 w-3.5 shrink-0" />
              {mod.label}
            </button>
          )
        })}
      </nav>

      <div className="mx-2 border-t border-sidebar-border" />

      {/* Context sub-navigation */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {activeModule === 'channels' && (
          <ChannelList channels={channels ?? []} isLoading={channelsLoading} pathname={pathname ?? ''}
            onChannelClick={(id) => navigate(`channels/${id}`)}
            onCreateChannel={() => setCreateChannelOpen(true)} />
        )}
        {/* Bug fix: "docs/new" and "canvas/new" pointed to the same
            "/new"-as-a-literal-ID dead end that channels/new did — but
            unlike channels, docs-list-view.tsx and canvas-list-view.tsx
            already have real, working create buttons right on their own
            list pages (createDoc.mutate() / createCanvas.mutate()).
            Rather than duplicate that creation logic here too, these
            just go to the page that already has it. tasks/new-project
            is a separate, bigger gap left as-is: there's no backend
            concept of a "project" at all yet (no create endpoint,
            nothing in TasksView) — that's a missing feature, not a
            broken link a redirect can fix. */}
        {activeModule === 'docs' && <SidebarSection label="Documents" onAdd={() => navigate('docs')} />}
        {activeModule === 'tasks' && <SidebarSection label="Projects" onAdd={() => navigate('tasks/new-project')} />}
        {activeModule === 'canvas' && <SidebarSection label="Canvases" onAdd={() => navigate('canvas')} />}
      </div>

      {/* CMD+K hint */}
      <button onClick={onOpenCommand} className="p-2 border-t border-sidebar-border hover:bg-sidebar-border/30 transition-colors">
        <p className="font-mono text-[10px] text-sidebar-foreground/30 text-center tracking-wider hover:text-sidebar-foreground/50 transition-colors">
          CMD+K FOR COMMANDS
        </p>
      </button>

      {currentWorkspace && (
        <CreateChannelModal
          open={createChannelOpen}
          onClose={() => setCreateChannelOpen(false)}
          workspaceId={currentWorkspace.id}
          onSubmit={(data) => createChannel.mutate(data)}
          isSubmitting={createChannel.isPending}
        />
      )}
    </aside>
  )
}

interface ChannelListProps {
  channels: Channel[]
  isLoading: boolean
  pathname: string
  onChannelClick: (id: string) => void
  onCreateChannel: () => void
}

const ChannelList = ({ channels, isLoading, pathname, onChannelClick, onCreateChannel }: ChannelListProps) => {
  if (isLoading) {
    return <div className="flex flex-col gap-1.5 pt-1">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
  }

  const visible = channels.slice(0, 7)
  const overflow = channels.length - 7

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-1 py-0.5 mb-1">
        <span className="font-mono text-[10px] tracking-widest text-sidebar-foreground/30 uppercase">Channels</span>
        <button onClick={onCreateChannel} className="text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors" aria-label="Create channel"><Plus className="h-3 w-3" /></button>
      </div>
      {visible.map((ch) => {
        const isActive = pathname.includes(`/channels/${ch.id}`)
        return (
          <button key={ch.id} onClick={() => onChannelClick(ch.id)}
            className={cn('flex items-center gap-1.5 rounded px-2 py-1.5 text-left w-full transition-colors duration-100 font-mono text-xs truncate',
              isActive ? 'bg-accent/15 text-accent' : 'text-sidebar-foreground/60 hover:bg-sidebar-border hover:text-sidebar-foreground')}
            aria-current={isActive ? 'page' : undefined}>
            {ch.type === 'private' ? <Lock className="h-3 w-3 shrink-0 opacity-60" /> : <Hash className="h-3 w-3 shrink-0 opacity-60" />}
            <span className="truncate">{ch.name}</span>
          </button>
        )
      })}
      {overflow > 0 && (
        <button className="flex items-center gap-1 px-2 py-1 font-mono text-[10px] text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors">
          <ChevronDown className="h-3 w-3" />{overflow} more
        </button>
      )}
      <button onClick={onCreateChannel} className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-[10px] text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors rounded">
        <Plus className="h-3 w-3" />New channel
      </button>
    </div>
  )
}

const SidebarSection = ({ label, onAdd }: { label: string; onAdd: () => void }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center justify-between px-1 py-0.5 mb-1">
      <span className="font-mono text-[10px] tracking-widest text-sidebar-foreground/30 uppercase">{label}</span>
      <button onClick={onAdd} className="text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors" aria-label={`Create ${label.toLowerCase()}`}><Plus className="h-3 w-3" /></button>
    </div>
    <p className="px-2 font-mono text-[10px] text-sidebar-foreground/25 italic">No {label.toLowerCase()} yet</p>
  </div>
)
