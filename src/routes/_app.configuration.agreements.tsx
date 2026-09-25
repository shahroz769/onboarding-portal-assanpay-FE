import { createFileRoute } from '@tanstack/react-router'

import { AgreementsSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { AgreementsPanel } from '#/features/configuration/panels/agreements-panel'

export const Route = createFileRoute('/_app/configuration/agreements')({
  staticData: {
    title: 'Agreements',
    subtitle: 'Manage agreement draft templates.',
  },
  pendingMs: 0,
  pendingComponent: AgreementsSkeleton,
  component: AgreementsPanel,
})
