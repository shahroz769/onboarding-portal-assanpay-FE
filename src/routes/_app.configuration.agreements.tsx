import { createFileRoute } from '@tanstack/react-router'

import { AgreementsSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { AgreementsPanel } from '#/features/configuration/panels/agreements-panel'
import { agreementDraftsQueryOptions } from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/agreements')({
  staticData: {
    title: 'Agreements',
    subtitle: 'Manage agreement draft templates.',
  },
  // Starts the panel's request while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(agreementDraftsQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: AgreementsSkeleton,
  component: AgreementsPanel,
})
