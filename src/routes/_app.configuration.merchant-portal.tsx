import { createFileRoute } from '@tanstack/react-router'

import { MerchantPortalSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { MerchantPortalPanel } from '#/features/configuration/panels/merchant-portal-panel'
import { merchantPortalQueryOptions } from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/merchant-portal')({
  staticData: {
    title: 'Merchant Integration Settings',
    subtitle:
      'Manage merchant portal, server integration, and support details.',
  },
  // Starts the panel's request while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(merchantPortalQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: MerchantPortalSkeleton,
  component: MerchantPortalPanel,
})
