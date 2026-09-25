import { createFileRoute } from '@tanstack/react-router'

import { MerchantHistorySkeleton } from '#/features/merchants/merchant-details'
import { MerchantHistoryTab } from '#/features/merchants/merchant-history-tab'
import {
  merchantHistoryQueryOptions,
  useLoadedMerchantSection,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/history')({
  pendingMs: 0,
  pendingComponent: MerchantHistorySkeleton,
  component: MerchantHistoryRoute,
})

function MerchantHistoryRoute() {
  const { merchantId } = Route.useParams()
  const detail = useLoadedMerchantSection(
    merchantHistoryQueryOptions(merchantId),
  )

  if (!detail) {
    return <MerchantHistorySkeleton />
  }

  return <MerchantHistoryTab detail={detail} />
}
