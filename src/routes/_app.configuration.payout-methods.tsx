import { createFileRoute } from '@tanstack/react-router'

import { MethodListSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { PayoutMethodsPanel } from '#/features/configuration/panels/payout-methods-panel'
import { payoutMethodsQueryOptions } from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/payout-methods')({
  staticData: {
    title: 'Payout Methods',
    subtitle: 'Manage payout methods available in MID Creation.',
  },
  // Starts the panel's request while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(payoutMethodsQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: MethodListSkeleton,
  component: PayoutMethodsPanel,
})
