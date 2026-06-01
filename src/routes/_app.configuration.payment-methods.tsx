import { createFileRoute } from '@tanstack/react-router'

import { PaymentMethodsPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/payment-methods')({
  staticData: {
    title: 'Payment Methods',
    subtitle: 'Manage collection methods available in MID Creation.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: PaymentMethodsPanel,
})
