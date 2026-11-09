'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { authedFetch, workspacesApi } from '@/lib/api-client'
import { formatRelativeTime } from '@/lib/utils'
import type { Workspace, Document } from '@collabos/shared'
import { nanoid } from 'nanoid'

interface DocsListViewProps {
  workspaceSlug: string
}

export const DocsListView = ({ workspaceSlug }: DocsListViewProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list() as Promise<Array<{ workspace: Workspace }>>,
  })
  const workspace = workspaces?.find((m) => m.workspace.slug === workspaceSlug)?.workspace

  const { data: docs, isLoading } = useQuery({
    queryKey: ['docs', workspace?.id],
    queryFn: () => authedFetch<Document[]>(`/v1/docs?workspaceId=${workspace!.id}`),
    enabled: !!workspace,
  })

  const createDoc = useMutation({
    mutationFn: () =>
      authedFetch<Document>('/v1/docs', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace!.id, title: 'Untitled' }),
        headers: { 'Idempotency-Key': `doc-${nanoid(16)}` },
      }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['docs', workspace?.id] })
      router.push(`/${workspaceSlug}/docs/${doc.id}`)
    },
    onError: () => toast.error('Failed to create document'),
  })

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-semibold">Docs</span>
        </div>
        <Button size="sm" onClick={() => createDoc.mutate()} disabled={createDoc.isPending || !workspace}>
          <Plus className="h-3.5 w-3.5 mr-1" />New document
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !docs?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-medium mb-1">No documents yet</p>
              <p className="font-mono text-xs text-muted-foreground">Create docs for meeting notes, specs, wikis, and more.</p>
            </div>
            <Button onClick={() => createDoc.mutate()} disabled={createDoc.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Create first document
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-[1fr_120px_40px] gap-3 px-3 py-2 border-b border-border bg-muted/20">
              {['Title', 'Last edited', ''].map((h) => (
                <span key={h} className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{h}</span>
              ))}
            </div>
            {docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => router.push(`/${workspaceSlug}/docs/${doc.id}`)}
                className="grid grid-cols-[1fr_120px_40px] gap-3 px-3 py-3 border-b border-border hover:bg-muted/20 transition-colors text-left items-center"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{doc.icon ?? '📄'}</span>
                  <span className="font-mono text-sm truncate">{doc.title}</span>
                </div>
                <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />{formatRelativeTime(doc.updatedAt)}
                </span>
                <div />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
