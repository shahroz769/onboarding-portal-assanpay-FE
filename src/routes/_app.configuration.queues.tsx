import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { QueuesPanel } from '#/features/configuration/configuration-panels'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/queues')({
  staticData: {
    title: 'Queues',
    subtitle: 'Manage case queues and SLA settings.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(configurationQueryOptions())
    void context.queryClient.prefetchQuery(
      queuesQueryOptions({ includeInactive: true }),
    )
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: QueuesPanel,
})
