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
  /** `beforeLoad`'s `preload` flag: true for hover/intent preloads. */
  preload?: boolean
}) {
  if (params.auth.isAuthenticated()) {
    return
  }

  if (import.meta.env.SSR) {
    return
  }

  // Don't call the refresh endpoint for a speculative preload. Redirecting
  // here only makes the router preload /login instead; it never navigates.
  if (params.preload) {
    throw redirect({
      to: '/login',
      search: { redirect: sanitizeRedirect(params.redirectTo) },
    })
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
  /** `beforeLoad`'s `preload` flag: true for hover/intent preloads. */
  preload?: boolean
}) {
  if (import.meta.env.SSR) {
    return
  }

  if (params.auth.isAuthenticated()) {
    throw redirect({ href: sanitizeRedirect(params.redirectTo) })
  }

  // Probing the session costs a refresh request; only do it on a real visit.
  if (params.preload) {
    return
  }

  try {
    await ensureAuthSession(params.queryClient, params.auth)
  } catch {
    params.auth.clear()
    return
  }

  throw redirect({ href: sanitizeRedirect(params.redirectTo) })
}

export function requireAllowedRoles(
  auth: AuthClient,
  allowedRoles: readonly RoleType[],
  fallbackTo = '/',
) {
  const roleType = auth.getSnapshot().user?.roleType

  if (!roleType || !allowedRoles.includes(roleType)) {
    throw redirect({ to: fallbackTo })
  }
}
