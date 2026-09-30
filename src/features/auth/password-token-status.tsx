import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { AlertCircle, Clock3, RefreshCw } from 'lucide-react'
import axios from 'axios'

import { ErrorPage } from '#/components/error-state'
import { Button, ButtonLink } from '#/components/ui/button'
import { getErrorStateMessage } from '#/lib/get-api-error-message'

export function PasswordTokenNotFound() {
  return (
    <ErrorPage
      icon={<AlertCircle />}
      title="Password link not found"
      description="This link is invalid. Check that you opened the complete link from your email, or ask your administrator for a new one."
      actions={<BackToLogin />}
    />
  )
}

export function PasswordTokenError({
  error,
  onRetry,
}: Pick<ErrorComponentProps, 'error'> & { onRetry?: () => void }) {
  const router = useRouter()
  const status = axios.isAxiosError(error) ? error.response?.status : undefined

  if (status === 410) {
    return (
      <ErrorPage
        tone="muted"
        icon={<Clock3 />}
        title="This password link is no longer valid"
        description="This link may have expired or already been used. Ask your administrator to send you a new password link."
        actions={<BackToLogin />}
      />
    )
  }

  return (
    <ErrorPage
      icon={<AlertCircle />}
      title="Unable to open password link"
      description={getErrorStateMessage(
        error,
        'Unable to verify this link right now. Try again in a moment.',
      )}
      error={error}
      actions={
        <>
          <Button onClick={onRetry ?? (() => void router.invalidate())}>
            <RefreshCw />
            Try again
          </Button>
          <BackToLogin variant="outline" />
        </>
      }
    />
  )
}

function BackToLogin({ variant }: { variant?: 'outline' }) {
  return (
    <ButtonLink variant={variant} render={<Link to="/login" />}>
      Back to login
    </ButtonLink>
  )
}
