import { createFileRoute } from '@tanstack/react-router'

import { MerchantOverviewSkeleton } from '#/features/merchants/merchant-details'
import { MerchantOverviewTab } from '#/features/merchants/merchant-overview-tab'
import {
  merchantOverviewQueryOptions,
  useLoadedMerchantSection,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/overview')({
  pendingMs: 0,
  pendingComponent: MerchantOverviewSkeleton,
  component: MerchantOverviewRoute,
})

function MerchantOverviewRoute() {
  const { merchantId } = Route.useParams()
  const detail = useLoadedMerchantSection(
    merchantOverviewQueryOptions(merchantId),
  )

  if (!detail) {
    return <MerchantOverviewSkeleton />
  }

  return <MerchantOverviewTab detail={detail} />
}
