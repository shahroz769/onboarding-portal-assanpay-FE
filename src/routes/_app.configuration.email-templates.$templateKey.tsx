import { createFileRoute } from '@tanstack/react-router'

import { EmailTemplateSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { EmailTemplatePanel } from '#/features/configuration/panels/email-template-panel'
import { emailTemplatePreviewQueryOptions } from '#/hooks/use-configuration-query'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute(
  '/_app/configuration/email-templates/$templateKey',
)({
  // Starts the preview request while the route skeleton shows; not awaited,
  // so the panel keeps its own loading and error states.
  loader: ({ context: { queryClient }, params: { templateKey }, preload }) => {
    if (preload) return
    void queryClient.prefetchQuery(
      emailTemplatePreviewQueryOptions(templateKey),
    )
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: EmailTemplateSkeleton,
  component: EmailTemplatePanel,
})
