import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import type { ReactNode } from 'react'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { AlertCircle, Clock3 } from 'lucide-react'
import axios from 'axios'
import { toast } from 'sonner'

import { fetchPasswordToken, setPasswordRequest } from '#/apis/auth'
import { Button, ButtonLink } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { parseTokenParam } from '#/lib/route-params'
import { setPasswordSchema } from '#/schemas/users.schema'

export const Route = createFileRoute('/set-password/$token')({
  params: {
    parse: ({ token }) => ({ token: parseTokenParam(token) }),
  },
  // No loader: the page fetches the token itself and renders its own
  // loading, not-found and expired states.
  component: RouteComponent,
  errorComponent: PasswordTokenError,
  notFoundComponent: PasswordTokenNotFound,
})

function passwordTokenQueryOptions(token: string) {
  return queryOptions({
    queryKey: ['password-token', token] as const,
    queryFn: () => fetchPasswordToken(token),
  })
}

function RouteComponent() {
  const { token } = Route.useParams()
  const tokenQuery = useQuery(passwordTokenQueryOptions(token))
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setPasswordMutation = useMutation({
    mutationFn: (value: { password: string; confirmPassword: string }) =>
      setPasswordRequest(token, value),
    onSuccess: async () => {
      toast.success('Password set successfully. You can now log in.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      await navigate({ to: '/login' })
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        // Re-check the token so the page switches to the expired state.
        void tokenQuery.refetch()
        return
      }

      toast.error(getApiErrorMessage(error, 'Failed to set password.'))
    },
  })

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    validators: {
      onSubmit: setPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      await setPasswordMutation.mutateAsync(value)
    },
  })

  const tokenContext = tokenQuery.data

  if (tokenQuery.error && !tokenContext) {
    if (
      axios.isAxiosError(tokenQuery.error) &&
      tokenQuery.error.response?.status === 404
    ) {
      return <PasswordTokenNotFound />
    }

    return (
      <PasswordTokenError
        error={tokenQuery.error}
        onRetry={() => void tokenQuery.refetch()}
      />
    )
  }

  if (!tokenContext) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
        <Spinner className="size-6" />
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>
              {tokenContext.purpose === 'invite'
                ? 'Set your password'
                : 'Reset your password'}
            </CardTitle>
            <CardDescription>{tokenContext.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                form.handleSubmit()
              }}
            >
              <FieldGroup>
                <form.Field name="password">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                        <Input
                          id={field.name}
                          type="password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          aria-invalid={isInvalid}
                          autoComplete="new-password"
                        />

                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    )
                  }}
                </form.Field>

                <form.Field name="confirmPassword">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          Confirm Password
                        </FieldLabel>
                        <Input
                          id={field.name}
                          type="password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          aria-invalid={isInvalid}
                          autoComplete="new-password"
                        />

                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    )
                  }}
                </form.Field>

                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Spinner data-icon="inline-start" />
                      ) : null}
                      {isSubmitting ? 'Saving...' : 'Set Password'}
                    </Button>
                  )}
                </form.Subscribe>

                <ButtonLink variant="ghost" render={<Link to="/login" />}>
                  Back to login
                </ButtonLink>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function PasswordTokenNotFound() {
  return (
    <PasswordTokenStatusCard
      tone="destructive"
      icon={<AlertCircle className="size-6" aria-hidden="true" />}
      title="Password link not found"
      description="This link is invalid. Check that you opened the complete link from your email, or ask your administrator for a new one."
    />
  )
}

function PasswordTokenError({
  error,
  onRetry,
}: Pick<ErrorComponentProps, 'error'> & { onRetry?: () => void }) {
  const router = useRouter()
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const isExpired = status === 410

  if (isExpired) {
    return (
      <PasswordTokenStatusCard
        tone="muted"
        icon={<Clock3 className="size-6" aria-hidden="true" />}
        title="This password link is no longer valid"
        description="This link may have expired or already been used. Ask your administrator to send you a new password link."
      />
    )
  }

  return (
    <PasswordTokenStatusCard
      tone="destructive"
      icon={<AlertCircle className="size-6" aria-hidden="true" />}
      title="Unable to open password link"
      description="We could not verify this link right now. Please try again."
      extraAction={
        <Button onClick={onRetry ?? (() => void router.invalidate())}>
          Try again
        </Button>
      }
    />
  )
}

function PasswordTokenStatusCard({
  tone,
  icon,
  title,
  description,
  extraAction,
}: {
  tone: 'muted' | 'destructive'
  icon: ReactNode
  title: string
  description: string
  extraAction?: ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="items-center text-center">
            <div
              className={
                tone === 'muted'
                  ? 'flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground'
                  : 'flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive'
              }
            >
              {icon}
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {extraAction}
            <ButtonLink
              variant={extraAction ? 'ghost' : 'default'}
              render={<Link to="/login" />}
            >
              Back to login
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
