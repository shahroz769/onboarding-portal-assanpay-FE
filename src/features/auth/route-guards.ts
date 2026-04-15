import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { ensureAuthSession } from '#/features/auth/auth-query'
import { useAuthStore } from '#/stores/auth.store'
import type { RoleType } from '#/types/auth'

export async function requireAuthSession(params: {
  queryClient: QueryClient
  redirectTo: string
}) {
  const { accessToken, clearAuth } = useAuthStore.getState()

  if (accessToken) {
    return
  }

  try {
    await ensureAuthSession(params.queryClient)
  } catch {
    clearAuth()
    throw redirect({
      to: '/login',
      search: { redirect: params.redirectTo },
    })
  }
}

export async function redirectAuthenticatedUser(params: {
  queryClient: QueryClient
  redirectTo?: string
}) {
  const { accessToken, clearAuth } = useAuthStore.getState()

  if (accessToken) {
    throw redirect({ to: '/' })
  }

  try {
    await ensureAuthSession(params.queryClient)
  } catch {
    clearAuth()
    return
  }

  if (params.redirectTo) {
    throw redirect({ href: params.redirectTo })
  }

  throw redirect({ to: '/' })
}

export function requireRoleAccess(blockedRoles: RoleType[], fallbackTo = '/') {
  const roleType = useAuthStore.getState().user?.roleType

  if (roleType && blockedRoles.includes(roleType)) {
    throw redirect({ to: fallbackTo })
  }
}
