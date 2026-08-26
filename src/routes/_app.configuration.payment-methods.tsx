import { createFileRoute } from '@tanstack/react-router'

import { MethodListSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { PaymentMethodsPanel } from '#/features/configuration/panels/payment-methods-panel'
import { paymentMethodsQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/payment-methods')({
  staticData: {
    title: 'Payment Methods',
    subtitle: 'Manage collection methods available in MID Creation.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(paymentMethodsQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: MethodListSkeleton,
  component: PaymentMethodsPanel,
})
