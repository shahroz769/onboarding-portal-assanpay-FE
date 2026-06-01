import { createFileRoute } from '@tanstack/react-router'

import { LinkDeadlinesPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/link-deadlines')({
  staticData: {
    title: 'Link Deadlines',
    subtitle: 'Manage expiry windows for merchant links.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: LinkDeadlinesPanel,
})
