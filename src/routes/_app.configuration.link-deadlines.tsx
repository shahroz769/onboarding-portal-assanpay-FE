import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { LinkDeadlinesPanel } from '#/features/configuration/panels/link-deadlines-panel'
import { linkDeadlinesQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/link-deadlines')({
  staticData: {
    title: 'Link Deadlines',
    subtitle: 'Manage expiry windows for merchant links.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(linkDeadlinesQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: LinkDeadlinesPanel,
})
