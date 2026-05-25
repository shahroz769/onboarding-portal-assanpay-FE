import { createFileRoute } from '@tanstack/react-router'

import { CaseTriggeringPanel } from '#/features/configuration/configuration-panels'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/configuration/case-triggering')({
  staticData: {
    title: 'Case Triggering',
    subtitle: 'Create a case manually for a selected merchant and queue.',
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        queuesQueryOptions({ includeInactive: true }),
      ),
      context.queryClient.ensureQueryData(merchantOptionsQueryOptions()),
    ])
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <CaseTriggeringPanel />
}
