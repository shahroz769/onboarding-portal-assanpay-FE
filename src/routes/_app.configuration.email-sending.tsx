import { createFileRoute } from '@tanstack/react-router'

import { EmailSendingModePanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/email-sending')({
  staticData: {
    title: 'Email Sending',
    subtitle: 'Manage automatic and manual email modes.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: EmailSendingModePanel,
})
