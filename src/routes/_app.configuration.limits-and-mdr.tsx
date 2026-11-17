import { createFileRoute } from '@tanstack/react-router'

import { LimitsAndMdrSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { LimitsAndMdrPanel } from '#/features/configuration/panels/limits-and-mdr-panel'
import {
  paymentMethodsQueryOptions,
  payoutMethodsQueryOptions,
} from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/limits-and-mdr')({
  staticData: {
    title: 'Limits and MDR',
    subtitle: 'Review transaction limits and method-wise commission rates.',
  },
  // Starts the panel's requests while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(paymentMethodsQueryOptions())
    void queryClient.prefetchQuery(payoutMethodsQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: LimitsAndMdrSkeleton,
  component: LimitsAndMdrPanel,
})
