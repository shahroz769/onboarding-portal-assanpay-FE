import { createFileRoute } from '@tanstack/react-router'

import { EmailTemplateSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { EmailTemplatePanel } from '#/features/configuration/panels/email-template-panel'

export const Route = createFileRoute(
  '/_app/configuration/email-templates/$templateKey',
)({
  staticData: {
    title: 'Email Templates',
    subtitle:
      'Preview every email the portal sends, with variables in place of real data.',
  },
  pendingMs: 0,
  pendingComponent: EmailTemplateSkeleton,
  component: EmailTemplatePanel,
})
