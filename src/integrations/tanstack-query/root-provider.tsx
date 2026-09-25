import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { createAuthClient } from '#/features/auth/auth-client'
import { setApiClientAuth } from '#/lib/api-client'

const MAX_QUERY_RETRIES = 1

function shouldRetryQuery(failureCount: number, error: unknown) {
  // 4xx responses (not found, forbidden, validation) won't succeed on retry.
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < MAX_QUERY_RETRIES
}

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Safety net for queries that don't set their own freshness policy.
        staleTime: 30_000,
        retry: shouldRetryQuery,
        // Tab-return refreshes are handled once, in NotificationsProvider's
        // visible-tab sync, which also covers SSE events missed while hidden.
        refetchOnWindowFocus: false,
      },
    },
  })
  const auth = createAuthClient()

  setApiClientAuth(auth)

  return {
    queryClient,
    auth,
  }
}
