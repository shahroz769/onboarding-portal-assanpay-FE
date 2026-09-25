import { createFileRoute } from '@tanstack/react-router'

import { WorkflowBuilderSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { WorkflowBuilderPanel } from '#/features/configuration/workflow-builder/workflow-builder-panel'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  staticData: {
    title: 'Caseflow Builder',
    subtitle: 'Design the cross-queue case workflow visually.',
    fitViewport: true,
  },
  pendingMs: 0,
  pendingComponent: WorkflowBuilderSkeleton,
  component: WorkflowBuilderPanel,
})
