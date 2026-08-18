import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { PayoutMethodsPanel } from '#/features/configuration/panels/payout-methods-panel'
import { payoutMethodsQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/payout-methods')({
  staticData: {
    title: 'Payout Methods',
    subtitle: 'Manage payout methods available in MID Creation.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(payoutMethodsQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: PayoutMethodsPanel,
})
