import { createFileRoute } from '@tanstack/react-router'

import { LimitsAndMdrPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/limits-and-mdr')({
  staticData: {
    title: 'Limits and MDR',
    subtitle: 'Manage transaction limits and MDR rates.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: LimitsAndMdrPanel,
})
