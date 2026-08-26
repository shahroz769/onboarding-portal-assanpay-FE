import { createFileRoute } from '@tanstack/react-router'

import { AgreementsSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { AgreementsPanel } from '#/features/configuration/panels/agreements-panel'
import { agreementDraftsQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/agreements')({
  staticData: {
    title: 'Agreements',
    subtitle: 'Manage agreement draft templates.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(agreementDraftsQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: AgreementsSkeleton,
  component: AgreementsPanel,
})
