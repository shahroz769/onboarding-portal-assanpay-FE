import { createFileRoute } from '@tanstack/react-router'

import { EmailSendingSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { EmailSendingModePanel } from '#/features/configuration/panels/email-sending-mode-panel'

export const Route = createFileRoute('/_app/configuration/email-sending')({
  staticData: {
    title: 'Email Sending',
    subtitle: 'Manage email sending modes and who else receives case emails.',
  },
  pendingMs: 0,
  pendingComponent: EmailSendingSkeleton,
  component: EmailSendingModePanel,
})
