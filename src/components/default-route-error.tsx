import { AxiosError } from 'axios'
import {
  AlertTriangle,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { ErrorPage } from '#/components/error-state'
import { Button, ButtonLink } from '#/components/ui/button'
import { useRouteRetry } from '#/hooks/use-route-retry'
import { getErrorStateMessage } from '#/lib/get-api-error-message'

export function DefaultRouteError({
  error,
  onRetry,
}: {
  error: unknown
  /** Defaults to refetching failed queries and re-running route loaders. */
  onRetry?: () => void
}) {
  const retryRoute = useRouteRetry()
  const isForbidden =
    error instanceof AxiosError && error.response?.status === 403

  if (isForbidden) {
    return (
      <ErrorPage
        tone="warning"
        icon={<ShieldAlert />}
        title="Access denied"
        description={getErrorStateMessage(
          error,
          'Your account does not have access to this page. Ask an administrator if you need it.',
        )}
        actions={
          <ButtonLink render={<Link to="/" />}>
            <LayoutDashboard />
            Go to dashboard
          </ButtonLink>
        }
      />
    )
  }

  return (
    <ErrorPage
      icon={<AlertTriangle />}
      title="Unable to load this page"
      description={getErrorStateMessage(
        error,
        'Try again. If it keeps happening, go to the dashboard and come back to this page.',
      )}
      error={error}
      actions={
        <>
          <Button type="button" onClick={onRetry ?? retryRoute}>
            <RefreshCw />
            Try again
          </Button>
          <ButtonLink variant="outline" render={<Link to="/" />}>
            <LayoutDashboard />
            Go to dashboard
          </ButtonLink>
        </>
      }
    />
  )
}
