import { createFileRoute } from '@tanstack/react-router'

import {
  MerchantDetails,
  MerchantDetailsSkeleton,
} from '#/features/merchants/merchant-details'
import { merchantDetailQueryOptions } from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId')({
  staticData: {
    title: 'Merchant Details',
    hidePageShell: true,
  },
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      merchantDetailQueryOptions(params.merchantId),
    )
  },
  pendingMs: 0,
  pendingComponent: MerchantDetailsSkeleton,
  component: MerchantDetailsRoute,
})

function MerchantDetailsRoute() {
  const { merchantId } = Route.useParams()
  return <MerchantDetails merchantId={merchantId} />
}
