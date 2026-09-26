import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod'
import { LoginForm } from '#/components/login-form'
import { sanitizeRedirect } from '#/features/auth/redirect'
import { redirectAuthenticatedUser } from '#/features/auth/route-guards'

const loginSearchSchema = z.object({
  redirect: z.string().optional().transform(sanitizeRedirect),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ search, context, preload }) => {
    await redirectAuthenticatedUser({
      auth: context.auth,
      queryClient: context.queryClient,
      redirectTo: search.redirect,
      preload,
    })
  },
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect: redirectTo } = Route.useSearch()

  return (
    <main className="flex min-h-svh flex-col bg-background md:flex-row-reverse">
      {/* Brand column. On desktop the mark is centred on the divider line
          (shifted left by half its width) and its background masks the line,
          so the line breaks around the logo. */}
      <section className="flex w-full px-4 md:w-1/3 md:items-center md:px-0">
        {/* -left-6 = half the size-12 mark. */}
        <div className="relative mx-auto flex w-full max-w-sm items-center gap-2 bg-background py-4 md:-left-6 md:mx-0 md:w-auto">
          <img src="/favicon.svg" alt="" className="size-12" />
          <div className="flex flex-col gap-1">
            <span className="font-brand text-3xl leading-none font-medium tracking-tight text-foreground/80">
              AssanPay
            </span>
            <span className="pl-0.5 font-brand text-sm leading-none text-muted-foreground">
              Onboarding Portal
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-1 justify-center px-4 md:w-2/3 md:flex-none md:items-center md:border-r md:px-0">
        <div className="w-full max-w-sm py-4 md:w-7/12 md:py-9">
          <LoginForm redirect={redirectTo} />
        </div>
      </section>
    </main>
  )
}
