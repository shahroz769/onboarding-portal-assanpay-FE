import { createFileRoute } from '@tanstack/react-router'

import { MerchantDetails } from '#/features/merchants/merchant-details'
import { merchantDetailQueryOptions } from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId')({
  staticData: {
    title: 'Merchant Details',
    hidePageShell: true,
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      merchantDetailQueryOptions(params.merchantId),
    ),
  component: MerchantDetailsRoute,
})

function MerchantDetailsRoute() {
  const { merchantId } = Route.useParams()
  return <MerchantDetails merchantId={merchantId} />
}
