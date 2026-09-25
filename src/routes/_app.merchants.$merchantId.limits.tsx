import { createFileRoute } from '@tanstack/react-router'

import { useAuth } from '#/features/auth/auth-client'
import { MerchantLimitsSkeleton } from '#/features/merchants/merchant-details'
import { MerchantLimitsMdrTab } from '#/features/merchants/merchant-limits-mdr-tab'
import {
  merchantLimitsQueryOptions,
  useLoadedMerchantSection,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/limits')({
  pendingMs: 0,
  pendingComponent: MerchantLimitsSkeleton,
  component: MerchantLimitsRoute,
})

function MerchantLimitsRoute() {
  const { merchantId } = Route.useParams()
  const detail = useLoadedMerchantSection(
    merchantLimitsQueryOptions(merchantId),
  )
  const { user } = useAuth()
  const canEdit = user?.roleType === 'super_admin' || user?.roleType === 'admin'

  if (!detail) {
    return <MerchantLimitsSkeleton />
  }

  return <MerchantLimitsMdrTab detail={detail} canEdit={canEdit} />
}
