'use client'

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { channelsApi, messagesApi } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import type { Message, PaginatedResponse } from '@collabos/shared'
import { nanoid } from 'nanoid'

export const useMessages = (channelId: string) => {
  return useInfiniteQuery({
    queryKey: ['messages', channelId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      channelsApi.messages(channelId, pageParam) as Promise<PaginatedResponse<Message>>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: 30 * 1000, // 30s — messages are kept fresh via WS
  })
}

type MessagesCache = { pages: Array<PaginatedResponse<Message>> }

export const useSendMessage = (channelId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) =>
      // BUG-4 fix: messagesApi.create already returns the real, server-assigned
      // Message (id, createdAt, author, etc.) — we now use that return value
      // in onSuccess to reconcile the optimistic temp message in place,
      // instead of discarding it and leaving the temp message to coexist
      // with whatever the WS broadcast inserts separately.
      messagesApi.create({ channelId, content }, nanoid(21)) as Promise<Message>,

    // Optimistic update — add message to cache immediately
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['messages', channelId] })

      const { user } = useAuthStore.getState()
      const tempId = `temp-${nanoid(8)}`
      const tempMessage: Message = {
        id: tempId,
        channelId,
        authorId: user?.id ?? 'me',
        content,
        threadId: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        author: { id: user?.id ?? 'me', name: user?.name ?? 'You', avatarUrl: user?.avatarUrl ?? null },
        reactions: [],
        attachments: [],
      }

      queryClient.setQueryData<MessagesCache>(
        ['messages', channelId],
        (old) => {
          if (!old) return old
          const firstPage = old.pages[0]
          if (!firstPage) return old
          return {
            ...old,
            pages: [
              { ...firstPage, data: [tempMessage, ...firstPage.data] },
              ...old.pages.slice(1),
            ],
          }
        },
      )

      return { tempId }
    },

    // BUG-4 fix: reconcile the temp message with the real server message by
    // swapping it in place (same array position, real ID/createdAt/author).
    // Previously this callback didn't exist at all — the temp message was
    // simply left in the cache forever, uncoordinated with whatever the WS
    // handler in ChannelView separately inserted for the same logical
    // message, producing a visible duplicate-then-flicker for the sender.
    onSuccess: (realMessage, _content, context) => {
      if (!context?.tempId) return
      queryClient.setQueryData<MessagesCache>(
        ['messages', channelId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((m) => (m.id === context.tempId ? realMessage : m)),
            })),
          }
        },
      )
    },

    onError: (_err, _content, context) => {
      if (context?.tempId) {
        // Remove optimistic message on error
        queryClient.setQueryData<MessagesCache>(
          ['messages', channelId],
          (old) => {
            if (!old) return old
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.filter((m) => m.id !== context.tempId),
              })),
            }
          },
        )
      }
    },

    // BUG-4 fix: no longer unconditionally invalidate on every settle.
    // The optimistic insert + onSuccess reconciliation above already leaves
    // the cache in the correct final state on success, so invalidating here
    // forced an unnecessary refetch that raced against the WS-driven insert
    // in ChannelView and was the second half of the duplicate-then-flicker.
    // We only invalidate when the mutation actually failed, as a safety net
    // to make sure the cache reflects server truth after an error.
    onSettled: (_data, error) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] })
      }
    },
  })
}

export const useDeleteMessage = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageId: string) => messagesApi.delete(messageId),
    onSuccess: (_data, messageId) => {
      // Update cache to soft-delete the message
      queryClient.setQueriesData<MessagesCache>(
        { queryKey: ['messages'] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((m) =>
                m.id === messageId
                  ? { ...m, content: '[Message deleted]', deletedAt: new Date().toISOString() }
                  : m,
              ),
            })),
          }
        },
      )
    },
  })
}
