import { useEffect, useEffectEvent } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '#/features/auth/auth-client'
import { refreshSession } from '#/features/auth/session-refresh'
import {
  CASE_COMMENTS_KEY,
  CASE_DETAIL_KEY,
  CASE_HISTORY_KEY,
  invalidateCaseWorkflowQueries,
} from '#/hooks/use-case-detail-query'
import { CASES_KEY } from '#/hooks/use-cases-query'
import {
  NOTIFICATIONS_KEY,
  NOTIFICATIONS_UNREAD_KEY,
  applyIncomingNotificationToCache,
} from '#/hooks/use-notifications-query'
import type { Notification } from '#/schemas/notifications.schema'

import { createNotificationsSseClient } from './notifications-sse'
import { showNotificationToast } from './notification-toast'

/**
 * Headless side-effect component. Mount once inside the auth-gated app layout.
 * - Opens an SSE connection to receive live notifications for the current user.
 * - Pushes incoming events into the TanStack Query cache.
 * - Fires a Sonner toast for each live event.
 * - On tab visible, reconnects SSE and refreshes notification/case caches.
 */
export function NotificationsProvider() {
  const auth = useAuth()
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const userId = auth.user?.id ?? null

  const syncNotificationsFromServer = useEffectEvent(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_KEY }),
    ])
  })

  const syncVisibleTab = useEffectEvent(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: CASE_DETAIL_KEY }),
      queryClient.invalidateQueries({ queryKey: CASE_HISTORY_KEY }),
      queryClient.invalidateQueries({ queryKey: CASES_KEY }),
    ])
  })

  const handleNotification = useEffectEvent((notification: Notification) => {
    applyIncomingNotificationToCache(queryClient, notification)
    if (notification.caseId && notification.type === 'case_resubmitted') {
      void invalidateCaseWorkflowQueries(queryClient, notification.caseId)
    }
    if (
      notification.caseId &&
      (notification.type === 'comment_mention' ||
        notification.type === 'comment_reply' ||
        notification.type === 'comment_thread')
    ) {
      void queryClient.invalidateQueries({
        queryKey: [...CASE_COMMENTS_KEY, notification.caseId],
      })
    }
    showNotificationToast(notification, navigate)
  })

  useEffect(() => {
    if (!userId) return

    const stop = createNotificationsSseClient({
      getAccessToken: () =>
        router.options.context.auth.getSnapshot().accessToken,
      refreshAccessToken: async () => {
        const data = await refreshSession(router.options.context.auth)
        return data.accessToken
      },
      onEvent: handleNotification,
      onOpen: syncNotificationsFromServer,
      onInvalidEvent: syncNotificationsFromServer,
      onVisible: syncVisibleTab,
      onError: (err) => {
        console.warn('[notifications] SSE error', err)
      },
    })

    return () => {
      stop()
    }
  }, [router, userId])

  return null
}
