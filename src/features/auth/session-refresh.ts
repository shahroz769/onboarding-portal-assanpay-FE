import axios from 'axios'

import { API_BASE_URL } from '#/config/client-env'
import type { AuthClient } from '#/features/auth/auth-client'
import type { RefreshResponse } from '#/types/auth'

const refreshPromises = new WeakMap<AuthClient, Promise<RefreshResponse>>()

export function isTerminalSessionRefreshError(error: unknown) {
  if (!axios.isAxiosError(error)) return false
  return error.response?.status === 401 || error.response?.status === 403
}

export function refreshSession(auth: AuthClient): Promise<RefreshResponse> {
  const pendingRefresh = refreshPromises.get(auth)
  if (pendingRefresh) return pendingRefresh

  const refresh = axios
    .post<RefreshResponse>(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then(({ data }) => {
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
