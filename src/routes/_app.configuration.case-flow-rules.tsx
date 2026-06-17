import { createFileRoute } from '@tanstack/react-router'

import { ConfigurationPanelSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { CaseFlowRulesPanel } from '#/features/configuration/configuration-panels'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { caseFlowConfigurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  staticData: {
    title: 'Case Flow Rules',
    subtitle: 'Manage cross-queue workflow rules.',
  },
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(caseFlowConfigurationQueryOptions())
    void context.queryClient.prefetchQuery(
      queuesQueryOptions({ includeInactive: true }),
    )
  },
  pendingMs: 0,
  pendingComponent: ConfigurationPanelSkeleton,
  component: CaseFlowRulesPanel,
})
