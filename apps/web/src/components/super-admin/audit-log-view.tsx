'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { ScrollText, Building2, User } from 'lucide-react'
import { superAdminApi } from '@/lib/api-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Reveal } from '@/components/ui/reveal'
import { formatRelativeTime } from '@/lib/utils'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'

interface AuditEntry {
  id: string
  actorId: string
  actorEmail: string
  action: string
  targetWorkspaceId: string | null
  targetUserId: string | null
  metadata: Record<string, unknown>
  ipAddress: string
  createdAt: string
}

interface AuditLogResponse {
  data: AuditEntry[]
  meta: { hasNextPage: boolean; nextCursor: string | null }
}

type BadgeVariant = 'error' | 'success' | 'accent' | 'warning' | 'default'

const ACTION_LABELS: Record<string, { label: string; variant: BadgeVariant }> = {
  workspace_suspended: { label: 'Workspace suspended', variant: 'error' },
  workspace_reactivated: { label: 'Workspace reactivated', variant: 'success' },
  workspace_plan_changed: { label: 'Plan changed', variant: 'accent' },
  workspace_deleted: { label: 'Workspace deleted', variant: 'error' },
  user_suspended: { label: 'User suspended', variant: 'error' },
  user_reactivated: { label: 'User reactivated', variant: 'success' },
  user_impersonation_started: { label: 'Impersonation started', variant: 'warning' },
  user_impersonation_ended: { label: 'Impersonation ended', variant: 'default' },
  super_admin_granted: { label: 'Super admin granted', variant: 'warning' },
  super_admin_revoked: { label: 'Super admin revoked', variant: 'error' },
  system_setting_changed: { label: 'System setting changed', variant: 'accent' },
}

/**
 * Every super admin sees every entry here — including actions taken by
 * other super admins, including any action taken against their own
 * account (e.g. someone else revoking their access). This is intentional
 * and is not a bug: a platform-level audit trail that any single actor
 * could filter to hide their own actions from peers would defeat the
 * entire point of having one. See routes/super-admin/index.ts GET
 * /audit-log for the corresponding backend comment.
 */
export const SuperAdminAuditLog = (): React.JSX.Element => {
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['super-admin-audit-log'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }): Promise<AuditLogResponse> =>
      superAdminApi.auditLog({ cursor: pageParam }) as Promise<AuditLogResponse>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: AuditLogResponse): string | undefined => lastPage.meta.nextCursor ?? undefined,
  })

  useIntersectionObserver(loadMoreRef, (): void => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, { threshold: 0.1 })

  const entries: AuditEntry[] = data?.pages.flatMap((p: AuditLogResponse): AuditEntry[] => p.data) ?? []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-2xl font-bold">Audit Log</h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Append-only record of every platform-level action. Visible to all super admins, including actions taken on your own account.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_: unknown, i: number) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : entries.length > 0 ? (
        <div className="flex flex-col gap-2">
          {entries.map((entry: AuditEntry, i: number) => {
            const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, variant: 'default' as const }
            return (
              <Reveal key={entry.id} index={i}>
                <div className="rounded-lg p-4 bg-card elevated-card">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <time dateTime={entry.createdAt} className="font-mono text-xs text-muted-foreground/60">
                    {formatRelativeTime(entry.createdAt)}
                  </time>
                </div>
                <p className="font-mono text-sm">
                  <span className="text-muted-foreground">by</span> {entry.actorEmail}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {entry.targetWorkspaceId && (
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" aria-hidden="true" /> {entry.targetWorkspaceId}
                    </span>
                  )}
                  {entry.targetUserId && (
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <User className="h-3 w-3" aria-hidden="true" /> {entry.targetUserId}
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground/50">{entry.ipAddress}</span>
                </div>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <pre className="font-mono text-xs text-muted-foreground/70 mt-2 bg-muted/30 rounded p-2 overflow-x-auto">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                )}
                </div>
              </Reveal>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <ScrollText className="h-10 w-10 text-muted-foreground/20" aria-hidden="true" />
          <p className="font-mono text-sm text-muted-foreground">No platform actions recorded yet</p>
        </div>
      )}

      <div ref={loadMoreRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  )
}
