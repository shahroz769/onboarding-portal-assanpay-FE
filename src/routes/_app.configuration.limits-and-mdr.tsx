import { createFileRoute } from '@tanstack/react-router'

import { LimitsAndMdrPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/limits-and-mdr')({
  staticData: {
    title: 'Limits and MDR',
    subtitle: 'Configure transaction limits and MDR settings.',
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(configurationQueryOptions()),
  component: RouteComponent,
})

function RouteComponent() {
  return <LimitsAndMdrPanel />
}
