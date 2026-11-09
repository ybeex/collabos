'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { superAdminApi } from '@/lib/api-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from './confirm-action-dialog'
import { Reveal } from '@/components/ui/reveal'
import { toast } from '@/components/ui/toaster'
import { cn, formatRelativeTime } from '@/lib/utils'

interface WorkspaceRow {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: string
  suspendedAt: string | null
  suspendedReason: string | null
  deletedAt: string | null
  owner: { id: string; name: string; email: string }
  _count: { members: number; channels: number }
}

interface WorkspacesResponse {
  data: WorkspaceRow[]
  meta: { hasNextPage: boolean; nextCursor: string | null }
}

const PLANS = ['free', 'pro', 'business', 'enterprise'] as const
type Plan = (typeof PLANS)[number]
type StatusFilter = 'active' | 'suspended' | undefined

interface PendingPlanChange {
  workspace: WorkspaceRow
  newPlan: Plan
}

export const SuperAdminWorkspaces = (): React.JSX.Element => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined)
  const [suspendTarget, setSuspendTarget] = useState<WorkspaceRow | null>(null)
  // FINAL_SWEEP.md BUG-2 fix: plan changes now go through the same
  // confirmation pattern as suspend, rather than firing immediately on
  // <select> onChange. A misclick on an adjacent option used to change a
  // customer's billing tier instantly with no undo — more consequential
  // than "Suspend" (fully reversible via Reactivate) but the only action
  // in this view with zero confirmation step.
  const [pendingPlanChange, setPendingPlanChange] = useState<PendingPlanChange | null>(null)
  const pillGroupRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)

  // premium-ui-elevation /elevate-ui: reposition the sliding filter pill
  // whenever the active filter changes. Runs after paint (useEffect, not
  // useLayoutEffect) since a one-frame lag on a 200ms slide is
  // imperceptible and this avoids the SSR/hydration mismatch risk
  // useLayoutEffect carries in a Next.js App Router client component.
  useEffect(() => {
    const group = pillGroupRef.current
    const pill = pillRef.current
    if (!group || !pill) return
    const active = group.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!active) return
    pill.style.width = `${active.offsetWidth}px`
    pill.style.transform = `translateX(${active.offsetLeft - 4}px)`
  }, [statusFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-workspaces', search, statusFilter],
    queryFn: (): Promise<WorkspacesResponse> =>
      superAdminApi.workspaces({ search: search || undefined, status: statusFilter }) as Promise<WorkspacesResponse>,
  })

  const suspend = useMutation({
    mutationFn: ({ workspaceId, reason }: { workspaceId: string; reason: string }): Promise<unknown> =>
      superAdminApi.suspendWorkspace(workspaceId, reason),
    onSuccess: (): void => {
      toast.success('Workspace suspended. Connected members have been disconnected.')
      queryClient.invalidateQueries({ queryKey: ['super-admin-workspaces'] })
      setSuspendTarget(null)
    },
    onError: (): void => toast.error('Failed to suspend workspace'),
  })

  const reactivate = useMutation({
    mutationFn: (workspaceId: string): Promise<unknown> => superAdminApi.reactivateWorkspace(workspaceId),
    onSuccess: (): void => {
      toast.success('Workspace reactivated')
      queryClient.invalidateQueries({ queryKey: ['super-admin-workspaces'] })
    },
    onError: (): void => toast.error('Failed to reactivate workspace'),
  })

  const changePlan = useMutation({
    mutationFn: ({ workspaceId, plan }: { workspaceId: string; plan: string }): Promise<unknown> =>
      superAdminApi.changeWorkspacePlan(workspaceId, plan),
    onSuccess: (): void => {
      toast.success('Plan updated')
      queryClient.invalidateQueries({ queryKey: ['super-admin-workspaces'] })
      setPendingPlanChange(null)
    },
    onError: (): void => toast.error('Failed to update plan'),
  })

  const workspaces: WorkspaceRow[] = data?.data ?? []

  const handlePlanSelectChange = (ws: WorkspaceRow, e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newPlan = e.target.value as Plan
    if (newPlan === ws.plan) return
    // Reset the <select> back to the current plan visually until the
    // confirmation dialog resolves — the mutation has not run yet, so the
    // displayed value must not get ahead of server state.
    e.target.value = ws.plan
    setPendingPlanChange({ workspace: ws, newPlan })
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-2xl font-bold">Workspaces</h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Every workspace on this deployment. Suspension disconnects members immediately.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="workspace-search" className="sr-only">Search workspaces by name or slug</label>
          <input
            id="workspace-search"
            type="text"
            title="Search workspaces by name or slug"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setSearch(e.target.value)}
            placeholder="Search by name or slug..."
            className="w-full pl-9 pr-3 py-2 rounded border border-border bg-input font-mono text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]"
          />
        </div>
        <div ref={pillGroupRef} className="relative flex items-center gap-1 p-1 border border-border rounded-lg" role="group" aria-label="Filter workspaces by status">
          {/* premium-ui-elevation /elevate-ui: sliding pill indicator
              (Section 1D) replacing an instant background-color swap
              between buttons — the active pill now animates to its new
              position/width instead of teleporting. Position is
              recomputed in a useEffect keyed on statusFilter (see below)
              — a ref callback here would only fire once on mount and
              never move again when the filter changes. */}
          <div
            ref={pillRef}
            className="absolute inset-y-1 left-1 rounded bg-foreground transition-[transform,width] duration-200 ease-[var(--ease-out)]"
            aria-hidden="true"
          />
          {([undefined, 'active', 'suspended'] as const).map((s) => (
            <button
              key={s ?? 'all'}
              type="button"
              title={`Show ${s ? s : 'all'} workspaces`}
              onClick={(): void => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={cn(
                'relative z-10 px-3 py-1.5 font-mono text-xs rounded transition-colors duration-200',
                statusFilter === s ? 'text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s ? s[0]!.toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : workspaces.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground text-center py-12">No workspaces match these filters.</p>
      ) : (
        <div className="rounded-lg overflow-hidden elevated-surface">
          {workspaces.map((ws, i) => (
            <Reveal
              key={ws.id}
              index={i}
              className="border-b border-border last:border-b-0"
            >
            <div
              className={cn(
                'flex items-center gap-4 px-5 py-4',
                'transition-colors duration-150 hover:bg-muted/40',
                ws.suspendedAt && 'row-alert',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold truncate">{ws.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">/{ws.slug}</span>
                  {ws.suspendedAt && (
                    <Badge variant="error" className="text-[10px]">Suspended</Badge>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Owner: {ws.owner.name} ({ws.owner.email}) · {ws._count.members} members · {ws._count.channels} channels · Created {formatRelativeTime(ws.createdAt)}
                </p>
                {ws.suspendedAt && ws.suspendedReason && (
                  <p className="font-mono text-xs mt-1" style={{ color: 'var(--color-error)' }}>Reason: {ws.suspendedReason}</p>
                )}
              </div>

              <label htmlFor={`plan-select-${ws.id}`} className="sr-only">Change plan for {ws.name}</label>
              <select
                id={`plan-select-${ws.id}`}
                title={`Change plan for ${ws.name}`}
                defaultValue={ws.plan}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>): void => handlePlanSelectChange(ws, e)}
                disabled={changePlan.isPending}
                className="px-2 py-1.5 rounded border border-border bg-input font-mono text-xs capitalize outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]"
              >
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>

              {ws.suspendedAt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  title={`Reactivate ${ws.name}`}
                  onClick={(): void => reactivate.mutate(ws.id)}
                  disabled={reactivate.isPending}
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  Reactivate
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  title={`Suspend ${ws.name}`}
                  onClick={(): void => setSuspendTarget(ws)}
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                  Suspend
                </Button>
              )}
            </div>
            </Reveal>
          ))}
        </div>
      )}

      <ConfirmActionDialog
        open={!!suspendTarget}
        onClose={(): void => setSuspendTarget(null)}
        onConfirm={(reason: string): void => {
          if (suspendTarget) suspend.mutate({ workspaceId: suspendTarget.id, reason })
        }}
        title={`Suspend "${suspendTarget?.name}"?`}
        description="All members will be immediately disconnected from real-time access. The workspace remains fully recoverable via Reactivate."
        confirmLabel="Suspend workspace"
        isPending={suspend.isPending}
      />

      <ConfirmActionDialog
        open={!!pendingPlanChange}
        onClose={(): void => setPendingPlanChange(null)}
        onConfirm={(): void => {
          if (pendingPlanChange) {
            changePlan.mutate({ workspaceId: pendingPlanChange.workspace.id, plan: pendingPlanChange.newPlan })
          }
        }}
        title={`Change "${pendingPlanChange?.workspace.name}" to ${pendingPlanChange?.newPlan}?`}
        description={`This immediately changes billing tier from ${pendingPlanChange?.workspace.plan} to ${pendingPlanChange?.newPlan}. The change is logged and reversible by selecting a different plan, but takes effect right away.`}
        confirmLabel="Change plan"
        requireReason={false}
        isDestructive={pendingPlanChange ? PLANS.indexOf(pendingPlanChange.newPlan) < PLANS.indexOf(pendingPlanChange.workspace.plan as Plan) : false}
        isPending={changePlan.isPending}
      />
    </div>
  )
}
