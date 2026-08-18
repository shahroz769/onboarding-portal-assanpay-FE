import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { CaseTriggeringPanel } from '#/features/configuration/panels/case-triggering-panel'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { subMerchantOptionsQueryOptions } from '#/hooks/use-configuration-query'
import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/configuration/case-triggering')({
  staticData: {
    title: 'Case Triggering',
    subtitle: 'Manage automatic case creation rules.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(subMerchantOptionsQueryOptions())
    void context.queryClient.prefetchQuery(
      queuesQueryOptions({ includeInactive: true }),
    )
    void context.queryClient.prefetchQuery(merchantOptionsQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: CaseTriggeringPanel,
})
