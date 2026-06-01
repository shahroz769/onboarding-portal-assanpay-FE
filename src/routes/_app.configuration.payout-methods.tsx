import { createFileRoute } from '@tanstack/react-router'

import { PayoutMethodsPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/payout-methods')({
  staticData: {
    title: 'Payout Methods',
    subtitle: 'Manage payout methods available in MID Creation.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: PayoutMethodsPanel,
})
