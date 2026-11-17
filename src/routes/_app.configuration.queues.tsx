import { createFileRoute } from '@tanstack/react-router'

import { QueuesSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { QueuesPanel } from '#/features/configuration/panels/queues-panel'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/queues')({
  staticData: {
    title: 'Queues',
    subtitle: 'Manage case queues and SLA settings.',
  },
  // Starts the panel's request while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(
      queuesQueryOptions({ includeInactive: true }),
    )
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: QueuesSkeleton,
  component: QueuesPanel,
})
