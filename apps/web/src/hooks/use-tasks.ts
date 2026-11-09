'use client'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { tasksApi } from '@/lib/api-client'
import type { Task, TaskStatus, TaskPriority, PaginatedResponse } from '@collabos/shared'

export const useTasks = (params: {
  workspaceId: string
  projectId?: string
  status?: string
}) => {
  return useInfiniteQuery({
    queryKey: ['tasks', params],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      tasksApi.list({ ...params, cursor: pageParam }) as Promise<PaginatedResponse<Task>>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: 60 * 1000, // 60s
  })
}

export const useTask = (taskId: string) =>
  useQuery({
    queryKey: ['tasks', taskId],
    queryFn: () => tasksApi.get(taskId) as Promise<Task>,
    staleTime: 30 * 1000,
  })

export const useUpdateTask = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      tasksApi.update(id, data),

    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', id] })
      const prev = queryClient.getQueryData<Task>(['tasks', id])
      queryClient.setQueryData<Task>(['tasks', id], (old) =>
        old ? { ...old, ...data } : old,
      )
      return { prev }
    },

    onError: (_err, { id }, context) => {
      if (context?.prev) queryClient.setQueryData(['tasks', id], context.prev)
    },

    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export const useCreateTask = (workspaceId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    // Bug fix (found via tsc): typed as Omit<Task, ...> before, which
    // requires every Task field (assigneeId, dueDate, tags, etc.) even
    // though the backend's createTaskSchema (apps/api/src/routes/tasks/
    // index.ts) only actually requires title + workspaceId — everything
    // else is optional there, defaulted server-side. This type now
    // matches that real contract instead of the full Task shape.
    mutationFn: (data: {
      title: string
      description?: string
      projectId?: string
      assigneeId?: string
      dueDate?: string
      priority?: TaskPriority
      status?: TaskStatus
      tags?: string[]
    }) => tasksApi.create({ ...data, workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', { workspaceId }] })
    },
  })
}
