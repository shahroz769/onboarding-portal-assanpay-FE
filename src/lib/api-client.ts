import axios from 'axios'
import type { QueryClient } from '@tanstack/react-query'

import type { AuthClient } from '#/features/auth/auth-client'
import { sanitizeRedirect } from '#/features/auth/redirect'
import type { RefreshResponse } from '#/types/auth'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Matches authSessionQueryKey in auth-query.ts — kept in sync manually to avoid circular deps
const AUTH_SESSION_QUERY_KEY = ['auth', 'session'] as const

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let authClient: AuthClient | null = null
let queryClient: QueryClient | null = null

export function setApiClientAuth(nextAuthClient: AuthClient) {
  authClient = nextAuthClient
}

export function setApiClientQueryClient(nextQueryClient: QueryClient) {
  queryClient = nextQueryClient
}

apiClient.interceptors.request.use((config) => {
  const accessToken = authClient?.getSnapshot().accessToken

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

let isRefreshing = false
let failedQueue: {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}[] = []

function processQueue(error: unknown, token: string | null) {
  for (const pending of failedQueue) {
    if (token) {
      pending.resolve(token)
    } else {
      pending.reject(error)
    }
  }

  failedQueue = []
}

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

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return apiClient(originalRequest)
      })
    }

    isRefreshing = true
    originalRequest._retry = true

    try {
      const { data } = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      )

      authClient?.setSession(data)
      queryClient?.setQueryData(AUTH_SESSION_QUERY_KEY, data)
      processQueue(null, data.accessToken)

      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      authClient?.clear()

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

      if (window.location.pathname !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(
          sanitizeRedirect(currentPath),
        )}`
      }

      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
