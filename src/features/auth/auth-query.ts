import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { loginRequest, logoutRequest, refreshSessionRequest } from '#/apis/auth'
import type { AuthClient } from '#/features/auth/auth-client'
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

export function syncAuthSession(
  auth: AuthClient,
  session: LoginResponse,
  queryClient?: QueryClient,
) {
  auth.setSession(session)
  queryClient?.setQueryData(authSessionQueryKey, session)
}

export function clearAuthSession(auth: AuthClient, queryClient?: QueryClient) {
  auth.clear()
  queryClient?.removeQueries({ queryKey: authSessionQueryKey })
}

export async function ensureAuthSession(
  queryClient: QueryClient,
  auth: AuthClient,
) {
  const session = await queryClient.fetchQuery(authSessionQueryOptions())
  syncAuthSession(auth, session, queryClient)
  return session
}

export function useLoginMutation() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const auth = router.options.context.auth

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (session) => {
      syncAuthSession(auth, session, queryClient)
    },
  })
}

export function useLogoutMutation() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const auth = router.options.context.auth

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clearAuthSession(auth, queryClient)
    },
  })
}
