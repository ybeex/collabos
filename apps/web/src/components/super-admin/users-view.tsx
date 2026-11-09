'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldAlert, ShieldCheck, ShieldPlus, ShieldMinus } from 'lucide-react'
import { superAdminApi } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from './confirm-action-dialog'
import { Reveal } from '@/components/ui/reveal'
import { toast } from '@/components/ui/toaster'
import { cn, formatRelativeTime } from '@/lib/utils'

interface UserRow {
  id: string
  name: string
  email: string
  plan: string
  isSuperAdmin: boolean
  lockedUntil: string | null
  deletedAt: string | null
  createdAt: string
  _count: { workspaceMembers: number }
}

interface UsersResponse {
  data: UserRow[]
  meta: { hasNextPage: boolean; nextCursor: string | null }
}

type PendingAction =
  | { type: 'suspend'; user: UserRow }
  | { type: 'grant'; user: UserRow }
  | { type: 'revoke'; user: UserRow }
  | null

export const SuperAdminUsers = (): React.JSX.Element => {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const [search, setSearch] = useState<string>('')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-users', search],
    queryFn: (): Promise<UsersResponse> => superAdminApi.users({ search: search || undefined }) as Promise<UsersResponse>,
  })

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['super-admin-users'] })
  }

  const suspend = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }): Promise<unknown> =>
      superAdminApi.suspendUser(userId, reason),
    onSuccess: (): void => { toast.success('User suspended'); invalidate(); setPendingAction(null) },
    onError: (err: unknown): void => toast.error(err instanceof Error ? err.message : 'Failed to suspend user'),
  })

  const reactivate = useMutation({
    mutationFn: (userId: string): Promise<unknown> => superAdminApi.reactivateUser(userId),
    onSuccess: (): void => { toast.success('User reactivated'); invalidate() },
    onError: (): void => toast.error('Failed to reactivate user'),
  })

  const setSuperAdmin = useMutation({
    mutationFn: ({ userId, grant }: { userId: string; grant: boolean }): Promise<unknown> =>
      superAdminApi.setSuperAdmin(userId, grant),
    onSuccess: (_data: unknown, vars: { userId: string; grant: boolean }): void => {
      toast.success(vars.grant ? 'Super admin access granted' : 'Super admin access revoked')
      invalidate()
      setPendingAction(null)
    },
    onError: (err: unknown): void => toast.error(err instanceof Error ? err.message : 'Failed to update super admin status'),
  })

  const users: UserRow[] = data?.data ?? []

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => setSearch(e.target.value)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-2xl font-bold">Users</h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Every user account on this deployment, across every workspace.
        </p>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="user-search" className="sr-only">Search users by name or email</label>
        <input
          id="user-search"
          type="text"
          title="Search users by name or email"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-3 py-2 rounded border border-border bg-input font-mono text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_: unknown, i: number) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground text-center py-12">No users match this search.</p>
      ) : (
        <div className="rounded-lg overflow-hidden elevated-surface">
          {users.map((u: UserRow, i: number) => {
            const isSelf: boolean = u.id === currentUser?.id
            const isLocked: boolean = !!u.lockedUntil && new Date(u.lockedUntil) > new Date()
            return (
              <Reveal
                key={u.id}
                index={i}
                className="border-b border-border last:border-b-0"
              >
              <div
                className={cn(
                  'flex items-center gap-4 px-5 py-4',
                  'transition-colors duration-150 hover:bg-muted/40',
                  isLocked && 'row-alert',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold truncate">{u.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{u.email}</span>
                    {u.isSuperAdmin && <Badge variant="accent" className="text-[10px]">Super Admin</Badge>}
                    {isLocked && <Badge variant="error" className="text-[10px]">Suspended</Badge>}
                    {isSelf && <span className="font-mono text-[10px] text-muted-foreground/60">(you)</span>}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-1 capitalize">
                    {u.plan} plan · {u._count.workspaceMembers} workspace{u._count.workspaceMembers !== 1 ? 's' : ''} · Joined {formatRelativeTime(u.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {u.isSuperAdmin ? (
                    <Button
                      type="button"
                      size="sm" variant="outline"
                      disabled={isSelf}
                      title={isSelf ? 'Cannot change your own super admin status' : `Revoke super admin from ${u.name}`}
                      onClick={(): void => setPendingAction({ type: 'revoke', user: u })}
                    >
                      <ShieldMinus className="h-3.5 w-3.5 mr-1.5" />
                      Revoke admin
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm" variant="outline"
                      disabled={isSelf}
                      title={isSelf ? 'Cannot change your own super admin status' : `Grant super admin to ${u.name}`}
                      onClick={(): void => setPendingAction({ type: 'grant', user: u })}
                    >
                      <ShieldPlus className="h-3.5 w-3.5 mr-1.5" />
                      Grant admin
                    </Button>
                  )}

                  {isLocked ? (
                    <Button
                      type="button"
                      size="sm" variant="outline"
                      title={`Reactivate ${u.name}`}
                      onClick={(): void => reactivate.mutate(u.id)}
                      disabled={reactivate.isPending}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm" variant="destructive"
                      disabled={isSelf || u.isSuperAdmin}
                      title={u.isSuperAdmin ? 'Revoke super admin access first' : isSelf ? 'Cannot suspend your own account' : `Suspend ${u.name}`}
                      onClick={(): void => setPendingAction({ type: 'suspend', user: u })}
                    >
                      <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                      Suspend
                    </Button>
                  )}
                </div>
              </div>
              </Reveal>
            )
          })}
        </div>
      )}

      <ConfirmActionDialog
        open={pendingAction?.type === 'suspend'}
        onClose={(): void => setPendingAction(null)}
        onConfirm={(reason: string): void => {
          if (pendingAction?.type === 'suspend') suspend.mutate({ userId: pendingAction.user.id, reason })
        }}
        title={`Suspend "${pendingAction?.user.name}"?`}
        description="This locks the account indefinitely. Fully reversible via Reactivate."
        confirmLabel="Suspend user"
        isPending={suspend.isPending}
      />

      <ConfirmActionDialog
        open={pendingAction?.type === 'grant'}
        onClose={(): void => setPendingAction(null)}
        onConfirm={(): void => {
          if (pendingAction?.type === 'grant') setSuperAdmin.mutate({ userId: pendingAction.user.id, grant: true })
        }}
        title={`Grant super admin to "${pendingAction?.user.name}"?`}
        description="This grants full platform-wide authority — every workspace, every user, regardless of workspace membership. This is the most powerful action in this dashboard."
        confirmLabel="Grant super admin"
        requireReason={false}
        isDestructive
        isPending={setSuperAdmin.isPending}
      />

      <ConfirmActionDialog
        open={pendingAction?.type === 'revoke'}
        onClose={(): void => setPendingAction(null)}
        onConfirm={(): void => {
          if (pendingAction?.type === 'revoke') setSuperAdmin.mutate({ userId: pendingAction.user.id, grant: false })
        }}
        title={`Revoke super admin from "${pendingAction?.user.name}"?`}
        description="They will lose all platform-wide authority immediately on their next token refresh (within 15 minutes)."
        confirmLabel="Revoke super admin"
        requireReason={false}
        isPending={setSuperAdmin.isPending}
      />
    </div>
  )
}
