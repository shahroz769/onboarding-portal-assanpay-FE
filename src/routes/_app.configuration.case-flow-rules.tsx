import { createFileRoute } from '@tanstack/react-router'

import { WorkflowBuilderSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { WorkflowBuilderPanel } from '#/features/configuration/workflow-builder/workflow-builder-panel'
import { caseFlowConfigurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  staticData: {
    title: 'Caseflow Builder',
    subtitle: 'Design the cross-queue case workflow visually.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      caseFlowConfigurationQueryOptions(),
    )
  },
  pendingMs: 0,
  pendingComponent: WorkflowBuilderSkeleton,
  component: WorkflowBuilderPanel,
})
