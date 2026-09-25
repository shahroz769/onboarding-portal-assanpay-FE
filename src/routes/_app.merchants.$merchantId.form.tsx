import { createFileRoute } from '@tanstack/react-router'

import { MerchantFormSkeleton } from '#/features/merchants/merchant-details'
import { MerchantFormTab } from '#/features/merchants/merchant-form-tab'
import {
  merchantFormQueryOptions,
  useLoadedMerchantSection,
} from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/merchants/$merchantId/form')({
  pendingMs: 0,
  pendingComponent: MerchantFormSkeleton,
  component: MerchantFormRoute,
})

function MerchantFormRoute() {
  const { merchantId } = Route.useParams()
  const detail = useLoadedMerchantSection(merchantFormQueryOptions(merchantId))

  if (!detail) {
    return <MerchantFormSkeleton />
  }

  return <MerchantFormTab detail={detail} />
}
