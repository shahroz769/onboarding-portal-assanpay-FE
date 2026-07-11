import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { SubMerchantsPanel } from '#/features/configuration/panels/sub-merchants-panel'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/sub-merchants')({
  staticData: {
    title: 'Sub-Merchants',
    subtitle: 'Manage sub-merchant draft forms and seller codes.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(configurationQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: SubMerchantsPanel,
})
