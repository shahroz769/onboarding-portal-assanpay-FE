import { useEffect, useRef } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

import { refreshSessionRequest } from '#/apis/auth'
import { useAuth } from '#/features/auth/auth-client'
import {
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
 * - On window focus, refreshes the unread count to catch any drops.
 */
export function NotificationsProvider() {
  const auth = useAuth()
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Stable refs so the SSE callbacks don't churn the connection
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const qcRef = useRef(queryClient)
  qcRef.current = queryClient

  const userId = auth.user?.id ?? null

  useEffect(() => {
    if (!userId) return

    const stop = createNotificationsSseClient({
      getAccessToken: () =>
        router.options.context.auth.getSnapshot().accessToken,
      refreshAccessToken: async () => {
        try {
          const data = await refreshSessionRequest()
          router.options.context.auth.setSession(data)
          return data.accessToken
        } catch {
          return null
        }
      },
      onEvent: (notification: Notification) => {
        applyIncomingNotificationToCache(qcRef.current, notification)
        showNotificationToast(notification, navigateRef.current)
      },
      onError: (err) => {
        console.warn('[notifications] SSE error', err)
      },
    })

    return () => {
      stop()
    }
  }, [userId, router])

  // Refresh unread count when tab becomes visible (covers SSE downtime)
  useEffect(() => {
    if (!userId) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({
          queryKey: NOTIFICATIONS_UNREAD_KEY,
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, queryClient])

  return null
}
