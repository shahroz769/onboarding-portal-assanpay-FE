import { toast } from 'sonner'
import type { useNavigate } from '@tanstack/react-router'

import type { Notification } from '#/schemas/notifications.schema'
import { markNotificationRead } from '#/apis/notifications'

import { resolveNotificationTarget } from './notification-target'

type Navigate = ReturnType<typeof useNavigate>

export function showNotificationToast(
  notification: Notification,
  navigate: Navigate,
) {
  toast(notification.title, {
    description: notification.body,
    duration: 8000,
    action: notification.caseId
      ? {
          label: 'View',
          onClick: () => {
            const target = resolveNotificationTarget(notification)
            if (target) navigate(target)
            void markNotificationRead(notification.id).catch(() => {
              /* best-effort */
            })
          },
        }
      : undefined,
  })
}
