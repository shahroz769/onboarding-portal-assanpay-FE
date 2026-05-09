import { createFileRoute } from '@tanstack/react-router'

import { QueuesPanel } from '#/features/configuration/configuration-panels'
import { queuesQueryOptions } from '#/hooks/use-cases-query'

export const Route = createFileRoute('/_app/configuration/queues')({
  staticData: {
    title: 'Queues',
    subtitle: 'Manage queue availability for filters and case creation.',
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      queuesQueryOptions({ includeInactive: true }),
    ),
  component: RouteComponent,
})

function RouteComponent() {
  return <QueuesPanel />
}
