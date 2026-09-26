import axios from 'axios'

import { API_BASE_URL } from '#/config/client-env'
import type { AuthClient } from '#/features/auth/auth-client'
import type { RefreshResponse } from '#/types/auth'

const refreshPromises = new WeakMap<AuthClient, Promise<RefreshResponse>>()

// All tabs share one refresh cookie, and the server rotates it on every
// refresh. Two tabs refreshing at once would send the same cookie and one of
// them would be refused (and logged out), so refreshes are serialized across
// tabs with a Web Lock, and a tab that waited reuses the session the lock
// holder just broadcast instead of sending the now-rotated cookie.
const REFRESH_LOCK_NAME = 'auth-refresh'
const REFRESH_CHANNEL_NAME = 'auth-refresh'

type BroadcastSession = { session: RefreshResponse; receivedAt: number }

let refreshChannel: BroadcastChannel | null | undefined
let lastBroadcastSession: BroadcastSession | null = null

function getRefreshChannel() {
  if (refreshChannel !== undefined) return refreshChannel
  if (typeof BroadcastChannel === 'undefined') {
    refreshChannel = null
    return refreshChannel
  }

  refreshChannel = new BroadcastChannel(REFRESH_CHANNEL_NAME)
  refreshChannel.onmessage = (event: MessageEvent<RefreshResponse>) => {
    lastBroadcastSession = { session: event.data, receivedAt: Date.now() }
  }
  return refreshChannel
}

function requestRefresh() {
  return axios
    .post<RefreshResponse>(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then(({ data }) => data)
}

async function refreshAcrossTabs(): Promise<RefreshResponse> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) return requestRefresh()

  const channel = getRefreshChannel()
  const requestedAt = Date.now()

  return locks.request(REFRESH_LOCK_NAME, async () => {
    // Another tab refreshed while this one waited for the lock: the cookie it
    // would send is already rotated, so use that tab's session instead.
    if (lastBroadcastSession && lastBroadcastSession.receivedAt >= requestedAt) {
      return lastBroadcastSession.session
    }

    const session = await requestRefresh()
    channel?.postMessage(session)
    return session
  })
}

export function isTerminalSessionRefreshError(error: unknown) {
  if (!axios.isAxiosError(error)) return false
  return error.response?.status === 401 || error.response?.status === 403
}

export function refreshSession(auth: AuthClient): Promise<RefreshResponse> {
  const pendingRefresh = refreshPromises.get(auth)
  if (pendingRefresh) return pendingRefresh

  const refresh = refreshAcrossTabs()
    .then((data) => {
      auth.setSession(data)
      return data
    })
    .catch((error: unknown) => {
      if (isTerminalSessionRefreshError(error)) {
        auth.clear()
      }
      throw error
    })
    .finally(() => {
      refreshPromises.delete(auth)
    })

  refreshPromises.set(auth, refresh)
  return refresh
}
