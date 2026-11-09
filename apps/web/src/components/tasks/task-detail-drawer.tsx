'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { X, Link2, MessageSquare, Trash2, Network } from 'lucide-react'
import { format } from 'date-fns'
import { tasksApi, authedFetch } from '@/lib/api-client'
import type { Task, TaskStatus, TaskPriority } from '@collabos/shared'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

interface TaskComment {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string; avatarUrl: string | null }
}

interface TaskDetailDrawerProps {
  taskId: string
  onClose: () => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; variant: 'error' | 'warning' | 'info' | 'default' }[] = [
  { value: 'urgent', label: 'Urgent', variant: 'error' },
  { value: 'high', label: 'High', variant: 'warning' },
  { value: 'medium', label: 'Medium', variant: 'info' },
  { value: 'low', label: 'Low', variant: 'default' },
]

export const TaskDetailDrawer = ({ taskId, onClose }: TaskDetailDrawerProps) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const params = useParams<{ workspaceSlug: string }>()
  const [comment, setComment] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')

  const { data: task, isLoading } = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: () => tasksApi.get(taskId) as Promise<Task & { comments: TaskComment[]; workGraphEdges: unknown[] }>,
  })

  const updateTask = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.update(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Failed to update task'),
  })

  const addComment = useMutation({
    mutationFn: (content: string) =>
      authedFetch(`/v1/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] })
      setComment('')
    },
    onError: () => toast.error('Failed to add comment'),
  })

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onClose()
      toast.success('Task deleted')
    },
    onError: () => toast.error('Failed to delete task'),
  })

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-border bg-card overflow-hidden" aria-label="Task details">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Task Details</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => deleteTask.mutate()} aria-label="Delete task" className="text-[var(--color-error)] hover:text-[var(--color-error)]">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !task ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-xs text-muted-foreground">Task not found</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-5">
            {/* Title */}
            {editingTitle ? (
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={() => {
                  if (titleValue.trim() && titleValue !== task.title) {
                    updateTask.mutate({ title: titleValue.trim() })
                  }
                  setEditingTitle(false)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } if (e.key === 'Escape') { setEditingTitle(false) } }}
                className="font-mono text-base font-semibold bg-transparent border-b border-accent outline-none w-full"
              />
            ) : (
              <h2
                className="font-mono text-base font-semibold cursor-text hover:text-accent transition-colors"
                onClick={() => { setTitleValue(task.title); setEditingTitle(true) }}
              >
                {task.title}
              </h2>
            )}

            {/* Properties grid */}
            <div className="flex flex-col gap-3">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">Status</span>
                <div className="flex flex-wrap gap-1">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateTask.mutate({ status: opt.value })}
                      className={cn(
                        'font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border transition-colors',
                        task.status === opt.value ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:border-accent/40',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">Priority</span>
                <div className="flex flex-wrap gap-1">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => updateTask.mutate({ priority: opt.value })}>
                      <Badge variant={task.priority === opt.value ? opt.variant : 'default'} className={cn('cursor-pointer transition-opacity', task.priority !== opt.value && 'opacity-40 hover:opacity-80')}>
                        {opt.label}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee. Note: read-only in this drawer — unlike
                  Priority above, there's no picker to change it. Fixing
                  that needs a workspace-member dropdown (fetch members,
                  render a select/combobox) that doesn't exist yet
                  anywhere in this app; flagged here rather than either
                  silently left unmentioned or built speculatively. */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">Assignee</span>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar src={task.assignee.avatarUrl} name={task.assignee.name} userId={task.assigneeId ?? ''} size="xs" />
                    <span className="font-mono text-xs">{task.assignee.name}</span>
                  </div>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground/50">Unassigned</span>
                )}
              </div>

              {/* Due date. Same note as Assignee above — read-only here;
                  changing it needs a date-input/picker component that
                  doesn't exist yet anywhere in this app either. */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">Due</span>
                {task.dueDate ? (
                  <span className="font-mono text-xs">{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground/50">No due date</span>
                )}
              </div>

              {/* Created by */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">Created</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {task.createdBy.name} · {format(new Date(task.createdAt), 'MMM d')}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div className="border-t border-border pt-4">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                <p className="font-mono text-xs leading-relaxed text-muted-foreground">{task.description}</p>
              </div>
            )}

            {/* Work graph links */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Link2 className="h-3 w-3 text-muted-foreground" />
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Linked Items</p>
              </div>
              {(task as unknown as { workGraphEdges: unknown[] }).workGraphEdges?.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {(task as unknown as { workGraphEdges: Array<{ id: string; edgeType: string; targetType: string; targetId: string }> }).workGraphEdges.map((edge) => (
                    <div key={edge.id} className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span className="text-accent/60">{edge.edgeType.replace('_', ' ')}</span>
                      <span>{edge.targetType} · {edge.targetId.slice(0, 8)}</span>
                    </div>
                  ))}
                  {/* PRD_AUDIT.md Finding #3: previously this list was the
                      entire Work Graph experience — a flat text summary
                      with no path to the actual relationship-aware view
                      the PRD names as the product's primary defensible
                      moat. This link is that path. */}
                  <button
                    type="button"
                    title="View this task's full Work Graph"
                    onClick={() => router.push(`/${params.workspaceSlug}/graph/${taskId}?type=task`)}
                    className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-accent hover:underline underline-offset-2 self-start"
                  >
                    <Network className="h-3 w-3" />
                    View full Work Graph
                  </button>
                </div>
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground/40 italic">No linked items yet</p>
              )}
            </div>

            {/* Comments */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-1.5 mb-3">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Comments {(task as unknown as { comments: unknown[] }).comments?.length > 0 && `(${(task as unknown as { comments: unknown[] }).comments.length})`}
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-3">
                {((task as unknown as { comments: TaskComment[] }).comments ?? []).map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar src={c.author.avatarUrl} name={c.author.name} userId={c.author.id} size="xs" className="shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="font-mono text-xs font-semibold">{c.author.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{format(new Date(c.createdAt), 'MMM d, HH:mm')}</span>
                      </div>
                      <p className="font-mono text-xs leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add comment */}
              <div className="flex gap-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (comment.trim()) addComment.mutate(comment.trim()) } }}
                  placeholder="Add a comment..."
                  rows={2}
                  className="flex-1 resize-none bg-input border border-border rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-accent transition-colors placeholder:text-muted-foreground/60"
                />
              </div>
              {comment.trim() && (
                <div className="flex justify-end mt-1.5">
                  <Button size="sm" onClick={() => addComment.mutate(comment.trim())} disabled={addComment.isPending}>
                    {addComment.isPending ? 'Saving...' : 'Comment'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
