import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginForm } from '#/components/login-form'
import { sanitizeRedirect } from '#/features/auth/redirect'
import { redirectAuthenticatedUser } from '#/features/auth/route-guards'

const loginSearchSchema = z.object({
  redirect: z.string().optional().transform(sanitizeRedirect),
})

export const Route = createFileRoute('/login')({
  ssr: false,
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ search, context }) => {
    await redirectAuthenticatedUser({
      auth: context.auth,
      queryClient: context.queryClient,
      redirectTo: search.redirect,
    })
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
