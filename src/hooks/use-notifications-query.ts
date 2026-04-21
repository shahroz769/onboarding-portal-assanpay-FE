import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '#/apis/notifications'
import type {
  Notification,
  NotificationFilter,
  NotificationsListResponse,
} from '#/schemas/notifications.schema'

export const NOTIFICATIONS_KEY = ['notifications'] as const
export const NOTIFICATIONS_UNREAD_KEY = ['notifications', 'unread-count'] as const

export function notificationsInfiniteKey(filter: NotificationFilter) {
  return [...NOTIFICATIONS_KEY, 'list', filter] as const
}

export function notificationsInfiniteQueryOptions(filter: NotificationFilter) {
  return infiniteQueryOptions({
    queryKey: notificationsInfiniteKey(filter),
    queryFn: ({ pageParam }) =>
      fetchNotifications({ cursor: pageParam, filter }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function unreadCountQueryOptions() {
  return queryOptions({
    queryKey: NOTIFICATIONS_UNREAD_KEY,
    queryFn: fetchUnreadCount,
    staleTime: 30_000,
  })
}

export function useNotificationsInfiniteQuery(filter: NotificationFilter) {
  return useInfiniteQuery(notificationsInfiniteQueryOptions(filter))
}

export function useUnreadCountQuery() {
  return useQuery(unreadCountQueryOptions())
}

// ─── Cache helpers (used by both mutations and SSE provider) ───────────────

type ListCache = InfiniteData<NotificationsListResponse, string | null>

function mapPages(
  cache: ListCache | undefined,
  fn: (n: Notification) => Notification,
): ListCache | undefined {
  if (!cache) return cache
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.map(fn),
    })),
  }
}

function filterPages(
  cache: ListCache | undefined,
  predicate: (n: Notification) => boolean,
): ListCache | undefined {
  if (!cache) return cache
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.filter(predicate),
    })),
  }
}

export function applyMarkReadToCache(
  qc: QueryClient,
  notificationId: string,
) {
  // Update "all" list
  qc.setQueryData<ListCache>(notificationsInfiniteKey('all'), (cache) =>
    mapPages(cache, (n) =>
      n.id === notificationId
        ? { ...n, isRead: true, readAt: new Date().toISOString() }
        : n,
    ),
  )
  // Remove from "unread" list
  qc.setQueryData<ListCache>(notificationsInfiniteKey('unread'), (cache) =>
    filterPages(cache, (n) => n.id !== notificationId),
  )
  // Decrement unread count
  qc.setQueryData<number>(NOTIFICATIONS_UNREAD_KEY, (current) =>
    current && current > 0 ? current - 1 : 0,
  )
}

export function applyMarkAllReadToCache(qc: QueryClient) {
  qc.setQueryData<ListCache>(notificationsInfiniteKey('all'), (cache) =>
    mapPages(cache, (n) =>
      n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() },
    ),
  )
  qc.setQueryData<ListCache>(notificationsInfiniteKey('unread'), (cache) =>
    cache
      ? { ...cache, pages: cache.pages.map((p) => ({ ...p, items: [] })) }
      : cache,
  )
  qc.setQueryData<number>(NOTIFICATIONS_UNREAD_KEY, 0)
}

export function applyIncomingNotificationToCache(
  qc: QueryClient,
  notification: Notification,
) {
  const prepend = (cache: ListCache | undefined): ListCache | undefined => {
    if (!cache) return cache
    const [first, ...rest] = cache.pages
    if (!first) return cache
    // Avoid duplicates if id already present (e.g. event arrives during refetch)
    if (first.items.some((n) => n.id === notification.id)) return cache
    return {
      ...cache,
      pages: [
        {
          ...first,
          items: [notification, ...first.items],
          unreadCount: first.unreadCount + (notification.isRead ? 0 : 1),
        },
        ...rest,
      ],
    }
  }

  qc.setQueryData<ListCache>(notificationsInfiniteKey('all'), prepend)
  if (!notification.isRead) {
    qc.setQueryData<ListCache>(notificationsInfiniteKey('unread'), prepend)
    qc.setQueryData<number>(NOTIFICATIONS_UNREAD_KEY, (current) =>
      (current ?? 0) + 1,
    )
  }
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      applyMarkReadToCache(qc, id)
    },
    onError: () => {
      toast.error('Failed to mark notification as read.')
      // Refetch to recover
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    },
  })
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      applyMarkAllReadToCache(qc)
    },
    onSuccess: () => {
      toast.success('All notifications marked as read.')
    },
    onError: () => {
      toast.error('Failed to mark all as read.')
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    },
  })
}
