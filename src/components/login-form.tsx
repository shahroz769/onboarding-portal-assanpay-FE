import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { AxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '#/lib/utils'
import { useLoginMutation } from '#/features/auth/auth-query'
import { sanitizeRedirect } from '#/features/auth/redirect'
import { loginSchema } from '#/schemas/auth.schema'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data

    if (typeof data === 'string' && data.trim()) {
      return data
    }

    if (data && typeof data === 'object') {
      const errorMessage =
        'error' in data && typeof data.error === 'string' ? data.error : null
      const message =
        'message' in data && typeof data.message === 'string'
          ? data.message
          : null
      const errors =
        'errors' in data && Array.isArray(data.errors)
          ? data.errors.filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : []

      return (
        errorMessage ??
        message ??
        errors[0] ??
        'Something went wrong. Please try again.'
      )
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

// Solid red edge while invalid, like the reference; focus adds a soft halo so
// the focused invalid field still reads differently from an unfocused one.
const invalidInputClass =
  'aria-invalid:ring-1 aria-invalid:ring-destructive dark:aria-invalid:ring-destructive aria-invalid:focus-visible:ring-[3px] aria-invalid:focus-visible:ring-destructive/30 dark:aria-invalid:focus-visible:ring-destructive/40'

// The last "Trust this device" choice on this browser, so a trusted browser
// stays trusted without re-ticking. Only a convenience: the server decides
// trust from its signed cookie.
const TRUST_DEVICE_STORAGE_KEY = 'login.trustDevice'

function readTrustDevicePreference() {
  try {
    return window.localStorage.getItem(TRUST_DEVICE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveTrustDevicePreference(value: boolean) {
  try {
    window.localStorage.setItem(TRUST_DEVICE_STORAGE_KEY, String(value))
  } catch {
    // Storage blocked; the box simply starts unticked next time.
  }
}

export function LoginForm({
  className,
  redirect,
  ...props
}: React.ComponentProps<'div'> & { redirect?: string }) {
  const navigate = useNavigate()
  const loginMutation = useLoginMutation()
  const [showPassword, setShowPassword] = useState(false)
  // Rendered inline in a persistent alert region rather than a toast, so the
  // failure stays on screen and is announced reliably.
  const [submitError, setSubmitError] = useState('')

  const form = useForm({
    defaultValues: {
      identifier: '',
      password: '',
      trustDevice: false,
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmitInvalid: ({ formApi }) => {
      const firstInvalid = (['identifier', 'password'] as const).find(
        (name) => formApi.getFieldMeta(name)?.isValid === false,
      )
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
    },
    onSubmit: async ({ value }) => {
      setSubmitError('')
      try {
        await loginMutation.mutateAsync({
          identifier: value.identifier,
          password: value.password,
          trustDevice: value.trustDevice,
        })
      } catch (error) {
        setSubmitError(getErrorMessage(error))
        return
      }
      saveTrustDevicePreference(value.trustDevice)
      // Awaited so the form stays submitting (button disabled, spinner on)
      // until the destination route has loaded and this page unmounts.
      await navigate({ href: sanitizeRedirect(redirect) })
    },
  })

  // Read after mount: storage does not exist during server rendering.
  useEffect(() => {
    if (readTrustDevicePreference()) form.setFieldValue('trustDevice', true)
  }, [form])

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold md:text-2xl">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your email or username to continue.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup className="gap-1">
          <form.Field name="identifier">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field className="gap-2">
                  <FieldLabel htmlFor={field.name}>
                    Email or Username
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid || undefined}
                    aria-describedby={
                      isInvalid ? `${field.name}-error` : undefined
                    }
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={invalidInputClass}
                  />

                  {/* One line is always reserved so an error appearing doesn't
                      push the vertically centred form around. */}
                  <div className="min-h-5">
                    {isInvalid && (
                      <FieldError
                        id={`${field.name}-error`}
                        errors={field.state.meta.errors}
                      />
                    )}
                  </div>
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="password">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field className="gap-2">
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id={field.name}
                      name={field.name}
                      type={showPassword ? 'text' : 'password'}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid || undefined}
                      aria-describedby={
                        isInvalid ? `${field.name}-error` : undefined
                      }
                      autoComplete="current-password"
                      className={cn('pr-10', invalidInputClass)}
                    />

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={
                              showPassword ? 'Hide password' : 'Show password'
                            }
                          />
                        }
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" className="size-4" />
                        ) : (
                          <Eye aria-hidden="true" className="size-4" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {showPassword ? 'Hide password' : 'Show password'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {/* One line is always reserved so an error appearing doesn't
                      push the vertically centred form around. */}
                  <div className="min-h-5">
                    {isInvalid && (
                      <FieldError
                        id={`${field.name}-error`}
                        errors={field.state.meta.errors}
                      />
                    )}
                  </div>
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="trustDevice">
            {(field) => (
              <Field orientation="horizontal" className="mb-5">
                <Checkbox
                  id={field.name}
                  name={field.name}
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor={field.name}>
                    Trust this device
                  </FieldLabel>
                  <FieldDescription>
                    Keeps sign-in working here if someone else causes too many
                    failed attempts on your account. Don&apos;t use on shared
                    computers.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ isSubmitting }) => (
              <Field className="relative">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting && <Spinner data-icon="inline-start" />}
                  Sign in
                </Button>
                {/* Always mounted so screen readers pick up the text when
                    it's set. Absolutely placed under the button so showing
                    it doesn't shift the form (the column is vertically
                    centred, so any added height moves everything). */}
                <div
                  role="alert"
                  className="absolute inset-x-0 top-full mt-3 text-sm text-destructive"
                >
                  {submitError}
                </div>
              </Field>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </div>
  )
}
