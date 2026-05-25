import { createFileRoute } from '@tanstack/react-router'

import { EmailSendingModePanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/email-sending')({
  staticData: {
    title: 'Email Sending',
    subtitle:
      'Configure whether case emails are sent automatically via Resend, manually via Gmail, or both.',
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(configurationQueryOptions()),
  component: RouteComponent,
})

function RouteComponent() {
  return <EmailSendingModePanel />
}
