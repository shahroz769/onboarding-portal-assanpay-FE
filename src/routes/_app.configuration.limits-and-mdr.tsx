import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { LimitsAndMdrPanel } from '#/features/configuration/panels/limits-and-mdr-panel'
import { limitsAndMdrQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/limits-and-mdr')({
  staticData: {
    title: 'Limits and MDR',
    subtitle: 'Manage transaction limits and MDR rates.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(limitsAndMdrQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: LimitsAndMdrPanel,
})
