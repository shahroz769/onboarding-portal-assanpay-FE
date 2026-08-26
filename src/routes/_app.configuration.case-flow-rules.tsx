import { createFileRoute } from '@tanstack/react-router'

import { CaseFlowRulesSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { CaseFlowRulesPanel } from '#/features/configuration/panels/case-flow-rules-panel'
import { caseFlowConfigurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  staticData: {
    title: 'Case Flow Rules',
    subtitle: 'Manage cross-queue workflow rules.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      caseFlowConfigurationQueryOptions(),
    )
  },
  pendingMs: 0,
  pendingComponent: CaseFlowRulesSkeleton,
  component: CaseFlowRulesPanel,
})
