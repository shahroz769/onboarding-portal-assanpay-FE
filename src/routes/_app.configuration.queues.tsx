import { createFileRoute } from '@tanstack/react-router'

import { QueuesPanel } from '#/features/configuration/configuration-panels'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/queues')({
  staticData: {
    title: 'Queues',
    subtitle: 'Manage case queues and SLA settings.',
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(configurationQueryOptions()),
      context.queryClient.ensureQueryData(
        queuesQueryOptions({ includeInactive: true }),
      ),
    ])
  },
  component: QueuesPanel,
})
