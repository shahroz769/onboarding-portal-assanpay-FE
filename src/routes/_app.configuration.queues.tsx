import { createFileRoute } from '@tanstack/react-router'

import { QueuesSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { QueuesPanel } from '#/features/configuration/panels/queues-panel'

export const Route = createFileRoute('/_app/configuration/queues')({
  staticData: {
    title: 'Queues',
    subtitle: 'Manage case queues and SLA settings.',
  },
  pendingMs: 0,
  pendingComponent: QueuesSkeleton,
  component: QueuesPanel,
})
