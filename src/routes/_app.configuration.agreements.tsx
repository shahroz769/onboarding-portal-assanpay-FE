import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { AgreementsPanel } from '#/features/configuration/panels/agreements-panel'
import { agreementDraftsQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/agreements')({
  staticData: {
    title: 'Agreements',
    subtitle: 'Manage agreement draft templates.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(agreementDraftsQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: AgreementsPanel,
})
