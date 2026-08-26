import { createFileRoute } from '@tanstack/react-router'

import { SubMerchantsSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { SubMerchantsPanel } from '#/features/configuration/panels/sub-merchants-panel'
import { subMerchantDraftsQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/sub-merchants')({
  staticData: {
    title: 'Sub-Merchants',
    subtitle: 'Manage sub-merchant draft forms and seller codes.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(subMerchantDraftsQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: SubMerchantsSkeleton,
  component: SubMerchantsPanel,
})
