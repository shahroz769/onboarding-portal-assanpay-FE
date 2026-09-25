import { AxiosError } from 'axios'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button, ButtonLink } from '#/components/ui/button'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

export function DefaultRouteError({
  error,
  onRetry,
}: {
  error: unknown
  /** Defaults to refetching failed queries and re-running route loaders. */
  onRetry?: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isForbidden =
    error instanceof AxiosError && error.response?.status === 403
  const title = isForbidden ? 'Access denied' : 'Something went wrong'
  const message = getApiErrorMessage(
    error,
    isForbidden
      ? 'You do not have access to this page.'
      : 'This page could not be loaded. Please try again.',
  )

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-4 p-6">
      <Alert variant={isForbidden ? 'warning' : 'destructive'}>
        <AlertTriangle />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            if (onRetry) {
              onRetry()
              return
            }
            // Pages fetch their own data, so a failed query has to be reset
            // for the retry to request it again (invalidate only re-runs
            // loaders).
            void queryClient.resetQueries({
              predicate: (query) => query.state.status === 'error',
            })
            void router.invalidate()
          }}
        >
          <RefreshCw />
          Retry
        </Button>
        <ButtonLink variant="outline" render={<Link to="/" />}>
          Go to Dashboard
        </ButtonLink>
      </div>
    </main>
  )
}
