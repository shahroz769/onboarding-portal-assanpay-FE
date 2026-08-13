import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Clock3 } from 'lucide-react'
import axios from 'axios'
import { toast } from 'sonner'

import { fetchPasswordToken, setPasswordRequest } from '#/apis/auth'
import { Button } from '#/components/ui/button'
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
import { setPasswordSchema } from '#/schemas/users.schema'

export const Route = createFileRoute('/set-password/$token')({
  loader: async ({ params }) => {
    try {
      return await fetchPasswordToken(params.token)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 410) {
          throw new Error('PASSWORD_TOKEN_EXPIRED')
        }

        if (error.response?.status === 404) {
          throw new Error('PASSWORD_TOKEN_NOT_FOUND')
        }
      }

      throw error
    }
  },
  component: RouteComponent,
  errorComponent: PasswordTokenError,
})

function RouteComponent() {
  const tokenContext = Route.useLoaderData()
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const setPasswordMutation = useMutation({
    mutationFn: (value: { password: string; confirmPassword: string }) =>
      setPasswordRequest(token, value),
    onSuccess: async () => {
      toast.success('Password set successfully. You can now login.')
      await navigate({ to: '/login' })
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        void router.invalidate()
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

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
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
              <form.Field
                name="password"
                children={(field) => {
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
              />
              <form.Field
                name="confirmPassword"
                children={(field) => {
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
              />
              <form.Subscribe
                selector={(state) => state.isSubmitting}
                children={(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                    {isSubmitting ? 'Saving...' : 'Set Password'}
                  </Button>
                )}
              />
              <Button asChild variant="ghost">
                <Link to="/login">Back to login</Link>
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function PasswordTokenError({ error }: { error: Error }) {
  const router = useRouter()
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const isExpired = status === 410 || error.message === 'PASSWORD_TOKEN_EXPIRED'
  const isMissing =
    status === 404 || error.message === 'PASSWORD_TOKEN_NOT_FOUND'

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div
            className={
              isExpired
                ? 'flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground'
                : 'flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive'
            }
          >
            {isExpired ? (
              <Clock3 className="size-6" aria-hidden="true" />
            ) : (
              <AlertCircle className="size-6" aria-hidden="true" />
            )}
          </div>
          <CardTitle>
            {isExpired
              ? 'This password link is no longer valid'
              : isMissing
                ? 'Password link not found'
                : 'Unable to open password link'}
          </CardTitle>
          <CardDescription>
            {isExpired
              ? 'This link may have expired or already been used. Ask your administrator to send you a new password link.'
              : isMissing
                ? 'This link is invalid. Check that you opened the complete link from your email, or ask your administrator for a new one.'
                : 'We could not verify this link right now. Please try again.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!isExpired && !isMissing ? (
            <Button onClick={() => router.invalidate()}>Try again</Button>
          ) : null}
          <Button
            asChild
            variant={isExpired || isMissing ? 'default' : 'ghost'}
          >
            <Link to="/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
