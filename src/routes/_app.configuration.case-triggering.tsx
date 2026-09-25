import { createFileRoute } from '@tanstack/react-router'

import { CaseTriggeringSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { CaseTriggeringPanel } from '#/features/configuration/panels/case-triggering-panel'

export const Route = createFileRoute('/_app/configuration/case-triggering')({
  staticData: {
    title: 'Case Triggering',
    subtitle: 'Manage automatic case creation rules.',
  },
  pendingMs: 0,
  pendingComponent: CaseTriggeringSkeleton,
  component: CaseTriggeringPanel,
})
