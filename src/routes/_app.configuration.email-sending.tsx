import { createFileRoute } from '@tanstack/react-router'

import { EmailSendingSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { EmailSendingModePanel } from '#/features/configuration/panels/email-sending-mode-panel'
import { emailSendingModeQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/email-sending')({
  staticData: {
    title: 'Email Sending',
    subtitle: 'Manage automatic and manual email modes.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(emailSendingModeQueryOptions())
  },
  pendingMs: 0,
  pendingComponent: EmailSendingSkeleton,
  component: EmailSendingModePanel,
})
