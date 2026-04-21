import { apiClient } from '#/lib/api-client'
import {
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationFilter,
  type NotificationsListResponse,
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

  const response = await apiClient.get<NotificationsListResponse>(
    '/api/notifications',
    { params: query },
  )
  return response.data
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>(
    '/api/notifications/unread-count',
  )
  return response.data.count
}

export async function markNotificationRead(id: string) {
  const response = await apiClient.patch<{
    id: string
    isRead: boolean
    readAt: string
  }>(`/api/notifications/${id}/read`)
  return response.data
}

export async function markAllNotificationsRead() {
  const response = await apiClient.patch<{ updated: number }>(
    '/api/notifications/read-all',
  )
  return response.data
}
