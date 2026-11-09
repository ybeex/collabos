'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, List, Calendar, KanbanSquare } from 'lucide-react'
import { workspacesApi } from '@/lib/api-client'
import type { Workspace } from '@collabos/shared'
import { useTasks, useCreateTask } from '@/hooks/use-tasks'
import { TaskKanban } from './task-kanban'
import { TaskList } from './task-list'
import { CreateTaskModal } from './create-task-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ViewMode = 'kanban' | 'list' | 'calendar'

interface TasksViewProps {
  workspaceSlug: string
}

export const TasksView = ({ workspaceSlug }: TasksViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list() as Promise<Array<{ workspace: Workspace }>>,
  })

  const currentWorkspace = workspaces?.find((m) => m.workspace.slug === workspaceSlug)?.workspace
  const workspaceId = currentWorkspace?.id ?? ''

  const { data, isLoading, fetchNextPage, hasNextPage } = useTasks({
    workspaceId,
    status: statusFilter,
  })

  const createTask = useCreateTask(workspaceId)

  const allTasks = data?.pages.flatMap((p) => p.data) ?? []

  const statusCounts = allTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Task header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-sm font-semibold">Tasks</h1>
          <div className="flex items-center gap-1">
            {(['todo', 'in_progress', 'in_review', 'done'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? undefined : status)}
                className={cn(
                  'font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded transition-colors',
                  statusFilter === status
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {status.replace('_', ' ')}
                {statusCounts[status] !== undefined && (
                  <span className="ml-1 opacity-60">{statusCounts[status]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded overflow-hidden">
            {([
              { mode: 'kanban' as const, icon: KanbanSquare, label: 'Kanban' },
              { mode: 'list' as const, icon: List, label: 'List' },
              { mode: 'calendar' as const, icon: Calendar, label: 'Calendar' },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex items-center justify-center h-7 w-7 transition-colors',
                  viewMode === mode
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label={label}
                aria-pressed={viewMode === mode}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New task
          </Button>
        </div>
      </header>

      {/* Task content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' && (
          <TaskKanban
            tasks={allTasks}
            isLoading={isLoading}
            workspaceId={workspaceId}
          />
        )}
        {viewMode === 'list' && (
          <TaskList
            tasks={allTasks}
            isLoading={isLoading}
            hasNextPage={hasNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        )}
        {viewMode === 'calendar' && (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-sm text-muted-foreground">Calendar view coming soon</p>
          </div>
        )}
      </div>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceId={workspaceId}
        onSubmit={(data) => {
          createTask.mutate(data, { onSuccess: () => setCreateOpen(false) })
        }}
        isSubmitting={createTask.isPending}
      />
    </div>
  )
}
