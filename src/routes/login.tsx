import { createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '#/components/login-form'

export const Route = createFileRoute('/login')({
  component: LoginRoute,
})

function LoginRoute() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  )
}
