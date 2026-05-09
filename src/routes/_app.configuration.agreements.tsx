import { createFileRoute } from '@tanstack/react-router'

import { AgreementsPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/agreements')({
  staticData: {
    title: 'Agreements',
    subtitle: 'Configure agreement templates and approval settings.',
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(configurationQueryOptions()),
  component: RouteComponent,
})

function RouteComponent() {
  return <AgreementsPanel />
}
