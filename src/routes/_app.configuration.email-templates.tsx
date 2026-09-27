import { createFileRoute } from '@tanstack/react-router'

import { EmailTemplatesLayout } from '#/features/configuration/email-templates-layout'

export const Route = createFileRoute('/_app/configuration/email-templates')({
  staticData: {
    title: 'Emails',
    subtitle:
      'Preview every email the portal sends and manage how they go out.',
  },
  component: EmailTemplatesLayout,
})
