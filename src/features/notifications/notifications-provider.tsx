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
  applyIncomingNotificationToCache,
} from '#/hooks/use-notifications-query'
import type { Notification } from '#/schemas/notifications.schema'

import { createNotificationsSseClient } from './notifications-sse'
import { showNotificationToast } from './notification-toast'

/** Data fetched this recently is current enough to skip on a stream (re)open. */
const RECENT_FETCH_MS = 5_000

/**
 * Headless side-effect component. Mount once inside the auth-gated app layout.
 * - Opens an SSE connection to receive live notifications for the current user.
 * - Pushes incoming events into the TanStack Query cache.
 * - Fires a Sonner toast for each live event.
 * - On tab visible, reconnects SSE and refreshes case caches plus any stale
 *   on-screen query (the app-wide replacement for refetchOnWindowFocus).
 */
export function NotificationsProvider() {
  const auth = useAuth()
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const userId = auth.user?.id ?? null

  // Catch up on events missed while the stream was down. NOTIFICATIONS_KEY is
  // a prefix of every notifications query (unread count included), so one
  // call covers them all. Queries that are loading or were just fetched (e.g.
  // the bell's mount fetch on the initial connect) are skipped instead of
  // being cancelled and requested again.
  const syncNotificationsFromServer = useEffectEvent(() => {
    void queryClient.invalidateQueries(
      {
        queryKey: NOTIFICATIONS_KEY,
        predicate: (query) =>
          query.state.fetchStatus !== 'fetching' &&
          Date.now() - query.state.dataUpdatedAt > RECENT_FETCH_MS,
      },
      { cancelRefetch: false },
    )
  })

  // The single tab-return refresh (the QueryClient disables
  // refetchOnWindowFocus). Case data is force-refreshed because SSE is paused
  // while hidden and may have missed updates; everything else on screen is
  // refetched only if stale, matching TanStack's focus-refetch behaviour.
  const syncVisibleTab = useEffectEvent(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: CASE_DETAIL_KEY }),
      queryClient.invalidateQueries({ queryKey: CASE_HISTORY_KEY }),
      queryClient.invalidateQueries({ queryKey: CASES_KEY }),
      // Runs after the invalidations above have started, so it joins those
      // in-flight fetches (cancelRefetch: false) instead of restarting them.
      queryClient.refetchQueries(
        { type: 'active', stale: true },
        { cancelRefetch: false },
      ),
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
      // The SSE client reconnects on its own; only surface errors in dev.
      onError: (err) => {
        if (import.meta.env.DEV) {
          console.warn('[notifications] SSE error', err)
        }
      },
    })

    return () => {
      stop()
    }
  }, [router, userId])

  return null
}
