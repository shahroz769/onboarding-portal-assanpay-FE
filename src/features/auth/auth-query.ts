import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { loginRequest, logoutRequest, refreshSessionRequest } from '#/apis/auth'
import { useAuthStore } from '#/stores/auth.store'
import type { LoginResponse } from '#/types/auth'

export const authSessionQueryKey = ['auth', 'session'] as const

export function authSessionQueryOptions() {
  return queryOptions({
    queryKey: authSessionQueryKey,
    queryFn: refreshSessionRequest,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
}

export function syncAuthSession(session: LoginResponse, queryClient?: QueryClient) {
  useAuthStore.getState().setAuth(session.accessToken, session.user)
  queryClient?.setQueryData(authSessionQueryKey, session)
}

export function clearAuthSession(queryClient?: QueryClient) {
  useAuthStore.getState().clearAuth()
  queryClient?.removeQueries({ queryKey: authSessionQueryKey })
}

export async function ensureAuthSession(queryClient: QueryClient) {
  const session = await queryClient.fetchQuery(authSessionQueryOptions())
  syncAuthSession(session, queryClient)
  return session
}

export function useLoginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (session) => {
      syncAuthSession(session, queryClient)
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clearAuthSession(queryClient)
    },
  })
}
