import { createFileRoute } from '@tanstack/react-router'

import { CaseFlowRulesPanel } from '#/features/configuration/configuration-panels'
import { caseFlowConfigurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  staticData: {
    title: 'Case Flow Rules',
    subtitle: 'Configure first cases, close triggers, and close requirements.',
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(caseFlowConfigurationQueryOptions()),
  component: RouteComponent,
})

function RouteComponent() {
  return <CaseFlowRulesPanel />
}
