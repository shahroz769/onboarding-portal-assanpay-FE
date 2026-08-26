import axios from 'axios'
import type { RegisteredRouter } from '@tanstack/react-router'

import { API_BASE_URL } from '#/config/client-env'
import type { AuthClient } from '#/features/auth/auth-client'
import { sanitizeRedirect } from '#/features/auth/redirect'
import {
  isTerminalSessionRefreshError,
  refreshSession,
} from '#/features/auth/session-refresh'

export { API_BASE_URL } from '#/config/client-env'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let authClient: AuthClient | null = null
let router: RegisteredRouter | null = null

export function setApiClientAuth(nextAuthClient: AuthClient) {
  authClient = nextAuthClient
}

export function setApiClientRouter(nextRouter: RegisteredRouter) {
  router = nextRouter
}

apiClient.interceptors.request.use((config) => {
  const accessToken = authClient?.getSnapshot().accessToken

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes('/api/auth/refresh') ||
      originalRequest.url?.includes('/api/auth/login')
    ) {
      return Promise.reject(error)
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      if (!authClient) return Promise.reject(error)
      const data = await refreshSession(authClient)

      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      if (!isTerminalSessionRefreshError(refreshError)) {
        return Promise.reject(refreshError)
      }

      if (router && !import.meta.env.SSR) {
        const { pathname, href } = router.state.location

        if (pathname !== '/login') {
          authClient?.clear()
          void router.navigate({
            to: '/login',
            search: { redirect: sanitizeRedirect(href) },
            replace: true,
          })
        }
      }

      return Promise.reject(refreshError)
    }
  },
)
