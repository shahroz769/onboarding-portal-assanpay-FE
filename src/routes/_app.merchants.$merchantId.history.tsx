import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { MerchantHistorySkeleton } from '#/features/merchants/merchant-details'
import { MerchantHistoryTab } from '#/features/merchants/merchant-history-tab'
import {
  loadMerchantSection,
  merchantHistoryQueryOptions,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/history')({
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: MerchantHistorySkeleton,
  loader: ({ context: { queryClient }, params: { merchantId }, preload }) =>
    loadMerchantSection(
      queryClient,
      merchantHistoryQueryOptions(merchantId),
      preload,
    ),
  component: MerchantHistoryRoute,
})

function MerchantHistoryRoute() {
  const { merchantId } = Route.useParams()
  const { data: detail } = useSuspenseQuery(
    merchantHistoryQueryOptions(merchantId),
  )

  return <MerchantHistoryTab detail={detail} />
}
