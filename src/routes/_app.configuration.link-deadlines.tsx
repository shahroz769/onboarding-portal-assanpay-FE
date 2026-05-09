import { createFileRoute } from '@tanstack/react-router'

import { LinkDeadlinesPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/link-deadlines')({
  staticData: {
    title: 'Link Deadlines',
    subtitle: 'Configure expiry and availability windows for secure links. All values are in hours.',
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(configurationQueryOptions()),
  component: RouteComponent,
})

function RouteComponent() {
  return <LinkDeadlinesPanel />
}
