import { createFileRoute } from '@tanstack/react-router'

import { CaseFlowRulesPanel } from '#/features/configuration/configuration-panels'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { caseFlowConfigurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  staticData: {
    title: 'Case Flow Rules',
    subtitle: 'Manage cross-queue workflow rules.',
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(caseFlowConfigurationQueryOptions()),
      context.queryClient.ensureQueryData(
        queuesQueryOptions({ includeInactive: true }),
      ),
    ])
  },
  component: CaseFlowRulesPanel,
})
