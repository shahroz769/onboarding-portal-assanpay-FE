import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { useAuth } from '#/features/auth/auth-client'
import { MerchantLimitsSkeleton } from '#/features/merchants/merchant-details'
import { MerchantLimitsMdrTab } from '#/features/merchants/merchant-limits-mdr-tab'
import {
  loadMerchantSection,
  merchantLimitsQueryOptions,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/limits')({
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: MerchantLimitsSkeleton,
  loader: ({ context: { queryClient }, params: { merchantId }, preload }) =>
    loadMerchantSection(
      queryClient,
      merchantLimitsQueryOptions(merchantId),
      preload,
    ),
  component: MerchantLimitsRoute,
})

function MerchantLimitsRoute() {
  const { merchantId } = Route.useParams()
  const { data: detail } = useSuspenseQuery(
    merchantLimitsQueryOptions(merchantId),
  )
  const { user } = useAuth()
  const canEdit = user?.roleType === 'super_admin' || user?.roleType === 'admin'

  // Keyed on the saved values so the form resets after a save or a revert.
  return (
    <MerchantLimitsMdrTab
      key={JSON.stringify(detail.limitsAndMdr.effective)}
      detail={detail}
      canEdit={canEdit}
    />
  )
}
