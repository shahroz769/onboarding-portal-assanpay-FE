import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { MerchantPortalPanel } from '#/features/configuration/panels/merchant-portal-panel'
import { merchantPortalQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/merchant-portal')({
  staticData: {
    title: 'Merchant Integration Settings',
    subtitle:
      'Manage merchant portal, server integration, and support details.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(merchantPortalQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: MerchantPortalPanel,
})
