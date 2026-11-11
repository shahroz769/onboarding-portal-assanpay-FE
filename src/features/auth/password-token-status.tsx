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
    const copy = CLOSED_LINK_COPY[getClosedLinkReason(error)]
    return (
      <ErrorPage
        tone="muted"
        icon={<Clock3 />}
        title={copy.title}
        description={copy.description}
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

// The server says why a link is closed (410 with `reason`); older servers
// send no reason and get the general copy.
type ClosedLinkReason =
  | 'used'
  | 'superseded'
  | 'invalidated'
  | 'expired'
  | 'unknown'

const CLOSED_LINK_COPY: Record<
  ClosedLinkReason,
  { title: string; description: string }
> = {
  used: {
    title: 'This password link was already used',
    description:
      'Your password is set. Log in with it, or ask your administrator for a new link if you have forgotten it.',
  },
  superseded: {
    title: 'A newer password link was sent',
    description:
      'Sending a new link turns off the older ones. Open the link in the most recent email.',
  },
  invalidated: {
    title: 'This password link no longer works',
    description:
      'Your password was set with another link. Log in with it, or ask your administrator for a new link.',
  },
  expired: {
    title: 'This password link has expired',
    description: 'Ask your administrator to send you a new password link.',
  },
  unknown: {
    title: 'This password link is no longer valid',
    description:
      'This link may have expired or already been used. Ask your administrator to send you a new password link.',
  },
}

function getClosedLinkReason(error: unknown): ClosedLinkReason {
  const data = axios.isAxiosError(error) ? error.response?.data : undefined
  const reason =
    data && typeof data === 'object' && 'reason' in data ? data.reason : null
  return reason === 'used' ||
    reason === 'superseded' ||
    reason === 'invalidated' ||
    reason === 'expired'
    ? reason
    : 'unknown'
}

function BackToLogin({ variant }: { variant?: 'outline' }) {
  return (
    <ButtonLink variant={variant} render={<Link to="/login" />}>
      Back to login
    </ButtonLink>
  )
}
