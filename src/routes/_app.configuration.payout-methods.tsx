import { createFileRoute } from '@tanstack/react-router'

import { MethodListSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { PayoutMethodsPanel } from '#/features/configuration/panels/payout-methods-panel'

export const Route = createFileRoute('/_app/configuration/payout-methods')({
  staticData: {
    title: 'Payout Methods',
    subtitle: 'Manage payout methods available in MID Creation.',
  },
  pendingMs: 0,
  pendingComponent: MethodListSkeleton,
  component: PayoutMethodsPanel,
})
