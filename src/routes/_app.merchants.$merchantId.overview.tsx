import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { MerchantOverviewSkeleton } from '#/features/merchants/merchant-details'
import { MerchantOverviewTab } from '#/features/merchants/merchant-overview-tab'
import {
  loadMerchantSection,
  merchantOverviewQueryOptions,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/overview')({
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: MerchantOverviewSkeleton,
  loader: ({ context: { queryClient }, params: { merchantId }, preload }) =>
    loadMerchantSection(
      queryClient,
      merchantOverviewQueryOptions(merchantId),
      preload,
    ),
  component: MerchantOverviewRoute,
})

function MerchantOverviewRoute() {
  const { merchantId } = Route.useParams()
  const { data: detail } = useSuspenseQuery(
    merchantOverviewQueryOptions(merchantId),
  )

  return <MerchantOverviewTab detail={detail} />
}
