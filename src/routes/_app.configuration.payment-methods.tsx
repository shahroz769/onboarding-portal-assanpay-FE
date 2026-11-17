import { createFileRoute } from '@tanstack/react-router'

import { MethodListSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { PaymentMethodsPanel } from '#/features/configuration/panels/payment-methods-panel'
import { paymentMethodsQueryOptions } from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/payment-methods')({
  staticData: {
    title: 'Payment Methods',
    subtitle: 'Manage collection methods available in MID Creation.',
  },
  // Starts the panel's request while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(paymentMethodsQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: MethodListSkeleton,
  component: PaymentMethodsPanel,
})
