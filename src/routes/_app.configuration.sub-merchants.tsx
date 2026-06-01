import { createFileRoute } from '@tanstack/react-router'

import { SubMerchantsPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/sub-merchants')({
  staticData: {
    title: 'Sub-Merchants',
    subtitle: 'Manage sub-merchant draft forms and seller codes.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: SubMerchantsPanel,
})
