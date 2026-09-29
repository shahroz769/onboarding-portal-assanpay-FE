import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { MerchantFormSkeleton } from '#/features/merchants/merchant-details'
import { MerchantFormTab } from '#/features/merchants/merchant-form-tab'
import {
  loadMerchantSection,
  merchantFormQueryOptions,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/form')({
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: MerchantFormSkeleton,
  loader: ({ context: { queryClient }, params: { merchantId }, preload }) =>
    loadMerchantSection(
      queryClient,
      merchantFormQueryOptions(merchantId),
      preload,
    ),
  component: MerchantFormRoute,
})

function MerchantFormRoute() {
  const { merchantId } = Route.useParams()
  const { data: detail } = useSuspenseQuery(
    merchantFormQueryOptions(merchantId),
  )

  return <MerchantFormTab detail={detail} />
}
