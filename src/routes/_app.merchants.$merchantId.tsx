import { AxiosError } from 'axios'
import type { ReactNode } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileQuestion, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button, ButtonLink } from '#/components/ui/button'
import { MerchantDetailsLayout } from '#/features/merchants/merchant-details'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { parseUuidParam } from '#/lib/route-params'

export const Route = createFileRoute('/_app/merchants/$merchantId')({
  params: {
    parse: ({ merchantId }) => ({ merchantId: parseUuidParam(merchantId) }),
  },
  staticData: {
    title: 'Merchant Details',
    hidePageShell: true,
  },
  // No loader: MerchantDetailsLayout and each tab fetch their own data (in
  // parallel, since the layout renders the tab without waiting for its
  // header). Query errors thrown from them land in MerchantDetailsError.
  errorComponent: MerchantDetailsError,
  notFoundComponent: MerchantDetailsNotFound,
  component: MerchantDetailsLayoutRoute,
})

function MerchantDetailsLayoutRoute() {
  const { merchantId } = Route.useParams()
  return <MerchantDetailsLayout merchantId={merchantId} />
}

function MerchantDetailsNotFound() {
  const { merchantId } = Route.useParams()

  return (
    <RouteStateShell>
      <Alert variant="warning">
        <FileQuestion />
        <AlertTitle>Merchant not found</AlertTitle>
        <AlertDescription>
          Merchant {merchantId} could not be found. It may have been removed or
          you may be using an old link.
        </AlertDescription>
      </Alert>
      <ButtonLink variant="outline" render={<Link to="/merchants" />}>
        Back to merchants
      </ButtonLink>
    </RouteStateShell>
  )
}

function MerchantDetailsError({ error }: { error: unknown }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  if (error instanceof AxiosError && error.response?.status === 404) {
    return <MerchantDetailsNotFound />
  }

  const isForbidden =
    error instanceof AxiosError && error.response?.status === 403
  const title = isForbidden ? 'Access denied' : 'Merchant could not be loaded'
  const message = getApiErrorMessage(
    error,
    isForbidden
      ? 'You do not have access to this merchant.'
      : 'The merchant detail request failed. Please try again.',
  )

  return (
    <RouteStateShell>
      <Alert variant={isForbidden ? 'warning' : 'destructive'}>
        <AlertTriangle />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            // Reset the failed query so the page requests it again.
            void queryClient.resetQueries({
              predicate: (query) => query.state.status === 'error',
            })
            void router.invalidate()
          }}
        >
          <RefreshCw />
          Retry
        </Button>
        <ButtonLink variant="outline" render={<Link to="/merchants" />}>
          Back to merchants
        </ButtonLink>
      </div>
    </RouteStateShell>
  )
}

function RouteStateShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-4 p-6">
      {children}
    </main>
  )
}
