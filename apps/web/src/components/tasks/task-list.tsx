'use client'

import { memo, useState } from 'react'
import type { Task } from '@collabos/shared'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskDetailDrawer } from './task-detail-drawer'
import { formatRelativeTime } from '@/lib/utils'
import { PRIORITY_ORDER, TASK_STATUS_ORDER } from '@collabos/shared'

interface TaskListProps {
  tasks: Task[]
  isLoading: boolean
  hasNextPage: boolean | undefined
  onLoadMore: () => void
}

export const TaskList = memo(({ tasks, isLoading, hasNextPage, onLoadMore }: TaskListProps) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const sorted = [...tasks].sort((a, b) => {
    const s = (TASK_STATUS_ORDER[a.status] ?? 0) - (TASK_STATUS_ORDER[b.status] ?? 0)
    if (s !== 0) return s
    return (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0)
  })

  if (isLoading) {
    return <div className="p-4 flex flex-col gap-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="grid grid-cols-[1fr_100px_80px_80px_32px] gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
          {['Title', 'Status', 'Priority', 'Due date', ''].map((h) => (
            <span key={h} className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{h}</span>
          ))}
        </div>
        {sorted.map((task) => (
          <div
            key={task.id}
            onClick={() => setSelectedTaskId(task.id)}
            className="grid grid-cols-[1fr_100px_80px_80px_32px] gap-2 px-4 py-2.5 border-b border-border hover:bg-muted/20 transition-colors cursor-pointer items-center"
          >
            <span className="font-mono text-xs truncate">{task.title}</span>
            <Badge variant={task.status === 'done' ? 'success' : task.status === 'in_progress' ? 'info' : 'default'} className="w-fit text-[9px]">
              {task.status.replace('_', ' ')}
            </Badge>
            <Badge variant={task.priority === 'urgent' ? 'error' : task.priority === 'high' ? 'warning' : 'default'} className="w-fit text-[9px]">
              {task.priority}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground">{task.dueDate ? formatRelativeTime(task.dueDate) : '—'}</span>
            {task.assignee ? <Avatar src={task.assignee.avatarUrl} name={task.assignee.name} userId={task.assigneeId ?? ''} size="xs" /> : <div />}
          </div>
        ))}
        {hasNextPage && (
          <div className="flex justify-center py-3 border-t border-border shrink-0">
            <button onClick={onLoadMore} className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">Load more tasks</button>
          </div>
        )}
      </div>
      {selectedTaskId && <TaskDetailDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  )
})
TaskList.displayName = 'TaskList'
