import { queryOptions, useMutation } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { loginRequest, logoutRequest, refreshSessionRequest } from '#/apis/auth'
import type { AuthClient } from '#/features/auth/auth-client'

const authRefreshQueryKey = ['auth', 'refresh'] as const

export function authSessionQueryOptions() {
  return queryOptions({
    queryKey: authRefreshQueryKey,
    queryFn: refreshSessionRequest,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
}

export function syncAuthSession(
  auth: AuthClient,
  session: Awaited<ReturnType<typeof refreshSessionRequest>>,
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
  const session = await queryClient.fetchQuery(authSessionQueryOptions())
  syncAuthSession(auth, session)
  return session
}

export function useLoginMutation() {
  const router = useRouter()
  const auth = router.options.context.auth

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (session) => {
      syncAuthSession(auth, session)
    },
  })
}

export function useLogoutMutation() {
  const router = useRouter()
  const auth = router.options.context.auth

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clearAuthSession(auth)
    },
  })
}
