import { createFileRoute } from '@tanstack/react-router'

import { SubMerchantsSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { SubMerchantsPanel } from '#/features/configuration/panels/sub-merchants-panel'
import { subMerchantDraftsQueryOptions } from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/sub-merchants')({
  staticData: {
    title: 'Sub-Merchants',
    subtitle: 'Manage sub-merchant draft forms and seller codes.',
  },
  // Starts the panel's request while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(subMerchantDraftsQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: SubMerchantsSkeleton,
  component: SubMerchantsPanel,
})
