import { apiClient } from '#/lib/api-client'
import {
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  notificationsListResponseSchema,
  NOTIFICATIONS_PAGE_SIZE,
  unreadCountResponseSchema,
} from '#/schemas/notifications.schema'
import type {
  NotificationFilter,
  NotificationsListResponse,
} from '#/schemas/notifications.schema'

interface FetchNotificationsParams {
  cursor?: string | null
  limit?: number
  filter?: NotificationFilter
}

export async function fetchNotifications(
  params: FetchNotificationsParams = {},
): Promise<NotificationsListResponse> {
  const query: Record<string, string> = {
    limit: String(params.limit ?? NOTIFICATIONS_PAGE_SIZE),
    filter: params.filter ?? 'all',
  }
  if (params.cursor) {
    query.cursor = params.cursor
  }

  const response = await apiClient.get('/api/notifications', { params: query })
  return notificationsListResponseSchema.parse(response.data)
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await apiClient.get('/api/notifications/unread-count')
  return unreadCountResponseSchema.parse(response.data).count
}

export async function markNotificationRead(id: string) {
  const response = await apiClient.patch(`/api/notifications/${id}/read`)
  return markNotificationReadResponseSchema.parse(response.data)
}

export async function markAllNotificationsRead() {
  const response = await apiClient.patch('/api/notifications/read-all')
  return markAllNotificationsReadResponseSchema.parse(response.data)
}
