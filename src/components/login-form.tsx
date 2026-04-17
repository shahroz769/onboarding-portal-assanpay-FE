import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "@tanstack/react-form"
import { AxiosError } from "axios"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { cn } from "#/lib/utils"
import { useLoginMutation } from "#/features/auth/auth-query"
import { sanitizeRedirect } from "#/features/auth/redirect"
import { loginSchema } from "#/schemas/auth.schema"
import { Button } from "#/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "#/components/ui/field"
import { Input } from "#/components/ui/input"
import { Spinner } from "#/components/ui/spinner"

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data

    if (typeof data === "string" && data.trim()) {
      return data
    }

    if (data && typeof data === "object") {
      const errorMessage =
        "error" in data && typeof data.error === "string" ? data.error : null
      const message =
        "message" in data && typeof data.message === "string"
          ? data.message
          : null
      const errors =
        "errors" in data && Array.isArray(data.errors)
          ? data.errors.filter((value): value is string => typeof value === "string")
          : []

      return errorMessage ?? message ?? errors[0] ?? "Something went wrong. Please try again."
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

export function LoginForm({
  className,
  redirect,
  ...props
}: React.ComponentProps<"div"> & { redirect?: string }) {
  const navigate = useNavigate()
  const loginMutation = useLoginMutation()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await loginMutation.mutateAsync({
          identifier: value.identifier,
          password: value.password,
        })
        navigate({ href: sanitizeRedirect(redirect) })
      } catch (error) {
        const message = getErrorMessage(error)
        toast.error(message)
      }
    },
  })

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email or username below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldGroup>
              <form.Field
                name="identifier"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid || undefined}>
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
                        autoComplete="username"
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
              <form.Field
                name="password"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <div className="relative">
                        <Input
                          id={field.name}
                          name={field.name}
                          type={showPassword ? "text" : "password"}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid || undefined}
                          autoComplete="current-password"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                      </div>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
              <form.Subscribe
                selector={(state) => ({
                  isSubmitting: state.isSubmitting,
                })}
                children={({ isSubmitting }) => (
                  <Field>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Spinner data-icon="inline-start" />
                      )}
                      {isSubmitting ? "Logging in..." : "Login"}
                    </Button>
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
