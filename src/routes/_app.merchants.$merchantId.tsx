import { AxiosError } from 'axios'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  FileQuestion,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import { ErrorPage } from '#/components/error-state'
import { Button, ButtonLink } from '#/components/ui/button'
import { MerchantDetailsLayout } from '#/features/merchants/merchant-details'
import { merchantHeaderQueryOptions } from '#/hooks/use-merchants-query'
import { useRouteRetry } from '#/hooks/use-route-retry'
import { getErrorStateMessage } from '#/lib/get-api-error-message'
import { parseUuidParam } from '#/lib/route-params'

export const Route = createFileRoute('/_app/merchants/$merchantId')({
  params: {
    parse: ({ merchantId }) => ({ merchantId: parseUuidParam(merchantId) }),
  },
  staticData: {
    title: 'Merchant Details',
    hidePageShell: true,
  },
  // Starts the header request as navigation begins, in parallel with the
  // tab's loader. It isn't awaited: the layout renders straight away with its
  // own header skeleton, so the tab never waits for the header. A failed header
  // request is rethrown by MerchantDetailsLayout into MerchantDetailsError.
  loader: ({ context: { queryClient }, params: { merchantId }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(merchantHeaderQueryOptions(merchantId))
  },
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
    <ErrorPage
      tone="warning"
      icon={<FileQuestion />}
      title="Merchant not found"
      titleAs="h1"
      description={`No merchant matches ID ${merchantId}. It may have been removed, or the link may be out of date.`}
      actions={
        <ButtonLink render={<Link to="/merchants" />}>
          Back to merchants
        </ButtonLink>
      }
    />
  )
}

function MerchantDetailsError({ error }: { error: unknown }) {
  const retryRoute = useRouteRetry()

  if (error instanceof AxiosError && error.response?.status === 404) {
    return <MerchantDetailsNotFound />
  }

  if (error instanceof AxiosError && error.response?.status === 403) {
    return (
      <ErrorPage
        tone="warning"
        icon={<ShieldAlert />}
        title="Access denied"
        titleAs="h1"
        description={getErrorStateMessage(
          error,
          'Your account does not have access to this merchant. Ask an administrator if you need it.',
        )}
        actions={
          <ButtonLink render={<Link to="/merchants" />}>
            Back to merchants
          </ButtonLink>
        }
      />
    )
  }

  return (
    <ErrorPage
      icon={<AlertTriangle />}
      title="Unable to load this merchant"
      titleAs="h1"
      description={getErrorStateMessage(
        error,
        'Try again, or go back to the merchant list.',
      )}
      error={error}
      actions={
        <>
          <Button type="button" onClick={retryRoute}>
            <RefreshCw />
            Try again
          </Button>
          <ButtonLink variant="outline" render={<Link to="/merchants" />}>
            Back to merchants
          </ButtonLink>
        </>
      }
    />
  )
}
