import { createFileRoute } from '@tanstack/react-router'

import { MerchantPortalPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/merchant-portal')({
  staticData: {
    title: 'Merchant Portal',
    subtitle: 'Manage merchant portal links.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: MerchantPortalPanel,
})
