import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { loginRequest, logoutRequest } from '#/apis/auth'
import type { AuthClient } from '#/features/auth/auth-client'
import { refreshSession } from '#/features/auth/session-refresh'

const authRefreshQueryKey = ['auth', 'refresh'] as const

export function authSessionQueryOptions(auth: AuthClient) {
  return queryOptions({
    queryKey: authRefreshQueryKey,
    queryFn: () => refreshSession(auth),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
}

export function syncAuthSession(
  auth: AuthClient,
  session: Awaited<ReturnType<typeof refreshSession>>,
) {
  auth.setSession(session)
}

export function clearAuthSession(auth: AuthClient) {
  auth.clear()
}

export async function ensureAuthSession(
  queryClient: QueryClient,
  auth: AuthClient,
) {
  const session = await queryClient.fetchQuery(authSessionQueryOptions(auth))
  return session
}

export function useLoginMutation() {
  const router = useRouter()
  const auth = router.options.context.auth
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (session) => {
      syncAuthSession(auth, session)
      queryClient.setQueryData(authRefreshQueryKey, session)
    },
  })
}

export function useLogoutMutation() {
  const router = useRouter()
  const auth = router.options.context.auth
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      clearAuthSession(auth)
      queryClient.removeQueries({ queryKey: authRefreshQueryKey })
    },
  })
}
