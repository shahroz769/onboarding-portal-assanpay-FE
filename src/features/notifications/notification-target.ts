import type { Notification } from '#/schemas/notifications.schema'

/**
 * Resolve the in-app navigation target for a notification.
 * Returns a TanStack Router-compatible nav object, or null if not navigable.
 */
export function resolveNotificationTarget(notification: Notification) {
  if (!notification.caseId) return null
  return {
    to: '/cases/$caseId' as const,
    params: { caseId: notification.caseId },
  }
}
