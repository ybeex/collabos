'use client'

import { useQuery } from '@tanstack/react-query'
import { superAdminApi } from '@/lib/api-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Users, ShieldAlert, MessageSquare, UserPlus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OverviewData {
  totalUsers: number
  totalWorkspaces: number
  activeWorkspaces: number
  suspendedWorkspaces: number
  usersByPlan: Array<{ plan: string; count: number }>
  workspacesByPlan: Array<{ plan: string; count: number }>
  messagesLast24h: number
  newUsersLast7Days: number
  superAdminCount: number
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  accent?: boolean
  alert?: boolean
  index: number
}

const StatCard = ({ icon: Icon, label, value, accent, alert, index }: StatCardProps): React.JSX.Element => (
  <div
    className={cn(
      'rounded-lg p-5 bg-card elevated-card mount-rise',
      alert && Number(value) > 0 && 'stat-card-alert',
    )}
    style={{ animationDelay: `${index * 40}ms` }}
  >
    <div className="flex items-center justify-between mb-3">
      <Icon className={cn('h-4 w-4 transition-transform duration-200', alert && Number(value) > 0 ? 'text-[var(--color-error)]' : 'text-muted-foreground')} aria-hidden="true" />
    </div>
    <p className={cn('font-mono text-2xl font-bold', accent && 'text-accent')}>{value}</p>
    <p className="font-mono text-xs text-muted-foreground mt-1">{label}</p>
  </div>
)

export const SuperAdminOverview = (): React.JSX.Element => {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-overview'],
    queryFn: (): Promise<OverviewData> => superAdminApi.overview() as Promise<OverviewData>,
    refetchInterval: 30_000,
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-mono text-2xl font-bold">Platform Overview</h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Live snapshot across every workspace and user on this deployment.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_: unknown, i: number) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard index={0} icon={Building2} label="Total workspaces" value={data.totalWorkspaces} accent />
            <StatCard index={1} icon={Users} label="Total users" value={data.totalUsers} accent />
            <StatCard index={2} icon={ShieldAlert} label="Suspended workspaces" value={data.suspendedWorkspaces} alert />
            <StatCard index={3} icon={MessageSquare} label="Messages, last 24h" value={data.messagesLast24h} />
            <StatCard index={4} icon={UserPlus} label="New users, last 7 days" value={data.newUsersLast7Days} />
            <StatCard index={5} icon={ShieldCheck} label="Super admins" value={data.superAdminCount} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg p-6 bg-card elevated-surface">
              <h2 className="font-mono text-sm font-semibold mb-4">Workspaces by plan</h2>
              <div className="flex flex-col gap-3">
                {data.workspacesByPlan.map(({ plan, count }: { plan: string; count: number }) => {
                  const pct: number = data.totalWorkspaces > 0 ? (count / data.totalWorkspaces) * 100 : 0
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs capitalize text-muted-foreground">{plan}</span>
                        <span className="font-mono text-xs font-semibold">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg p-6 bg-card elevated-surface">
              <h2 className="font-mono text-sm font-semibold mb-4">Users by plan</h2>
              <div className="flex flex-col gap-3">
                {data.usersByPlan.map(({ plan, count }: { plan: string; count: number }) => {
                  const pct: number = data.totalUsers > 0 ? (count / data.totalUsers) * 100 : 0
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs capitalize text-muted-foreground">{plan}</span>
                        <span className="font-mono text-xs font-semibold">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
