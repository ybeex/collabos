'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Palette, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { authedFetch, workspacesApi } from '@/lib/api-client'
import { formatRelativeTime } from '@/lib/utils'
import type { Workspace } from '@collabos/shared'

interface CanvasMeta {
  id: string
  name: string
  thumbnail: string | null
  updatedAt: string
  _count: { nodes: number }
}

interface CanvasListViewProps {
  workspaceSlug: string
}

export const CanvasListView = ({ workspaceSlug }: CanvasListViewProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list() as Promise<Array<{ workspace: Workspace }>>,
  })
  const workspace = workspaces?.find((m) => m.workspace.slug === workspaceSlug)?.workspace

  const { data: canvases, isLoading } = useQuery({
    queryKey: ['canvases', workspace?.id],
    queryFn: () => authedFetch<CanvasMeta[]>(`/v1/canvases?workspaceId=${workspace!.id}`),
    enabled: !!workspace,
  })

  const createCanvas = useMutation({
    mutationFn: () =>
      authedFetch<{ id: string }>('/v1/canvases', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace!.id, name: 'Untitled Canvas' }),
        headers: { 'Idempotency-Key': `canvas-${Date.now()}` },
      }),
    onSuccess: (canvas) => {
      queryClient.invalidateQueries({ queryKey: ['canvases', workspace?.id] })
      router.push(`/${workspaceSlug}/canvas/${canvas.id}`)
    },
    onError: () => toast.error('Failed to create canvas'),
  })

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-semibold">Canvas</span>
        </div>
        <Button size="sm" onClick={() => createCanvas.mutate()} disabled={createCanvas.isPending || !workspace}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New canvas
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : !canvases?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Palette className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-medium mb-1">No canvases yet</p>
              <p className="font-mono text-xs text-muted-foreground">Create a canvas for brainstorming, planning, and diagramming.</p>
            </div>
            <Button onClick={() => createCanvas.mutate()} disabled={createCanvas.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create first canvas
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {canvases.map((canvas) => (
              <button
                key={canvas.id}
                onClick={() => router.push(`/${workspaceSlug}/canvas/${canvas.id}`)}
                className="group flex flex-col rounded border border-border bg-card hover:border-accent/40 transition-all text-left overflow-hidden"
              >
                <div className="h-28 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[size:16px_16px] flex items-center justify-center border-b border-border">
                  {canvas.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={canvas.thumbnail} alt={canvas.name} className="w-full h-full object-cover" />
                  ) : (
                    <Palette className="h-8 w-8 text-muted-foreground/20" />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-mono text-sm font-medium truncate">{canvas.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{canvas._count.nodes} nodes</span>
                    <span className="font-mono text-[10px] text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {formatRelativeTime(canvas.updatedAt)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
