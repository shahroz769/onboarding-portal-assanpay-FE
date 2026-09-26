import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { AlertCircle, Clock3 } from 'lucide-react'
import axios from 'axios'

import { Button, ButtonLink } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export function PasswordTokenNotFound() {
  return (
    <PasswordTokenStatusCard
      tone="destructive"
      icon={<AlertCircle className="size-6" aria-hidden="true" />}
      title="Password link not found"
      description="This link is invalid. Check that you opened the complete link from your email, or ask your administrator for a new one."
    />
  )
}

export function PasswordTokenError({
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
