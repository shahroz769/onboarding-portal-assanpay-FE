import axios from 'axios'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginForm } from '#/components/login-form'
import { useAuthStore } from '#/stores/auth.store'
import type { RefreshResponse } from '#/types/auth'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  ssr: false,
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ search }) => {
    const { accessToken, setAuth, clearAuth } = useAuthStore.getState()

    if (accessToken) {
      throw redirect({ to: '/' })
    }

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
      const { data } = await axios.post<RefreshResponse>(
        `${apiBaseUrl}/api/auth/refresh`,
        {},
        { withCredentials: true }
      )

      setAuth(data.accessToken, data.user)
    } catch {
      clearAuth()
      return
    }

    if (search.redirect) {
      throw redirect({ href: search.redirect })
    }

    throw redirect({ to: '/' })
  },
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect: redirectTo } = Route.useSearch()

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm redirect={redirectTo} />
      </div>
    </main>
  )
}
