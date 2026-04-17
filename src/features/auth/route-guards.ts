import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { ensureAuthSession } from '#/features/auth/auth-query'
import type { AuthClient } from '#/features/auth/auth-client'
import { sanitizeRedirect } from '#/features/auth/redirect'
import type { RoleType } from '#/types/auth'

export async function requireAuthSession(params: {
  auth: AuthClient
  queryClient: QueryClient
  redirectTo: string
}) {
  if (params.auth.isAuthenticated()) {
    return
  }

  try {
    await ensureAuthSession(params.queryClient, params.auth)
  } catch {
    params.auth.clear()
    throw redirect({
      to: '/login',
      search: { redirect: sanitizeRedirect(params.redirectTo) },
    })
  }
}

export async function redirectAuthenticatedUser(params: {
  auth: AuthClient
  queryClient: QueryClient
  redirectTo?: string
}) {
  if (params.auth.isAuthenticated()) {
    throw redirect({ href: sanitizeRedirect(params.redirectTo) })
  }

  try {
    await ensureAuthSession(params.queryClient, params.auth)
  } catch {
    params.auth.clear()
    return
  }

  throw redirect({ href: sanitizeRedirect(params.redirectTo) })
}

export function requireRoleAccess(
  auth: AuthClient,
  blockedRoles: RoleType[],
  fallbackTo = '/',
) {
  const roleType = auth.getSnapshot().user?.roleType

  if (roleType && blockedRoles.includes(roleType)) {
    throw redirect({ to: fallbackTo })
  }
}
