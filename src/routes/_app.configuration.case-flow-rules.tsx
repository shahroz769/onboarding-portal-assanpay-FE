import { createFileRoute } from '@tanstack/react-router'

import { WorkflowBuilderSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { WorkflowBuilderPanel } from '#/features/configuration/workflow-builder/workflow-builder-panel'
import {
  caseFlowConfigurationQueryOptions,
  caseFlowMerchantMovePreviewQueryOptions,
} from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  staticData: {
    title: 'Caseflow Builder',
    subtitle: 'Design the cross-queue case workflow visually.',
    fitViewport: true,
  },
  // Starts the active configuration and its merchant-move preview together
  // while the route skeleton shows. The panel would otherwise ask for the
  // preview only once the configuration had arrived (it opens on the active
  // version, which is editable). Not awaited: the panel keeps its own states.
  loader: ({ context: { queryClient }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(caseFlowConfigurationQueryOptions())
    void queryClient.prefetchQuery(caseFlowMerchantMovePreviewQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: WorkflowBuilderSkeleton,
  component: WorkflowBuilderPanel,
})
