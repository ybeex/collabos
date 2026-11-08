'use client'

import { memo, useState } from 'react'
import type { Task, TaskStatus } from '@collabos/shared'
import { useUpdateTask } from '@/hooks/use-tasks'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/ui/avatar'
import { TaskDetailDrawer } from './task-detail-drawer'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
]

const PRIORITY_VARIANTS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  urgent: 'error', high: 'warning', medium: 'info', low: 'default',
}

interface TaskKanbanProps {
  tasks: Task[]
  isLoading: boolean
  workspaceId: string
}

export const TaskKanban = memo(({ tasks, isLoading }: TaskKanbanProps) => {
  const updateTask = useUpdateTask()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const byStatus = COLUMNS.reduce<Record<TaskStatus, Task[]>>(
    (acc, col) => { acc[col.id] = tasks.filter((t) => t.status === col.id); return acc },
    { todo: [], in_progress: [], in_review: [], done: [], cancelled: [] },
  )

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4 h-full overflow-x-auto">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col gap-2 w-64 shrink-0">
            <Skeleton className="h-5 w-20" />
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex gap-3 p-4 overflow-x-auto flex-1">
        {COLUMNS.map((col) => {
          const colTasks = byStatus[col.id] ?? []
          return (
            <div key={col.id} className="flex flex-col gap-2 w-64 shrink-0 min-h-0">
              <div className="flex items-center gap-2 px-1">
                <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground/60 bg-muted px-1.5 rounded">{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto flex-1 pb-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => setSelectedTaskId(task.id)}
                    onStatusChange={(status) => updateTask.mutate({ id: task.id, status })}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="flex items-center justify-center h-20 border border-dashed border-border rounded">
                    <span className="font-mono text-[11px] text-muted-foreground/40">No tasks</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedTaskId && (
        <TaskDetailDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  )
})
TaskKanban.displayName = 'TaskKanban'

interface TaskCardProps {
  task: Task
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (status: TaskStatus) => void
}

const TaskCard = memo(({ task, isSelected, onSelect }: TaskCardProps) => (
  <div
    onClick={onSelect}
    className={cn(
      'group flex flex-col gap-2 rounded border bg-card p-3 cursor-pointer transition-all',
      isSelected ? 'border-accent shadow-sm' : 'border-border hover:border-accent/40',
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="font-mono text-xs font-medium leading-relaxed flex-1">{task.title}</p>
      <Badge variant={PRIORITY_VARIANTS[task.priority] ?? 'default'} className="shrink-0 text-[9px]">
        {task.priority}
      </Badge>
    </div>
    <div className="flex items-center justify-between gap-2">
      {task.dueDate && <span className="font-mono text-[10px] text-muted-foreground">Due {formatRelativeTime(task.dueDate)}</span>}
      {task.assignee && <Avatar src={task.assignee.avatarUrl} name={task.assignee.name} userId={task.assigneeId ?? ''} size="xs" className="ml-auto" />}
    </div>
  </div>
))
TaskCard.displayName = 'TaskCard'
