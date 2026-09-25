import { createFileRoute } from '@tanstack/react-router'

import { MethodListSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { PaymentMethodsPanel } from '#/features/configuration/panels/payment-methods-panel'

export const Route = createFileRoute('/_app/configuration/payment-methods')({
  staticData: {
    title: 'Payment Methods',
    subtitle: 'Manage collection methods available in MID Creation.',
  },
  pendingMs: 0,
  pendingComponent: MethodListSkeleton,
  component: PaymentMethodsPanel,
})
