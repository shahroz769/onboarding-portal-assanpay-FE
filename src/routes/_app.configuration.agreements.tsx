import { createFileRoute } from '@tanstack/react-router'

import { AgreementsPanel } from '#/features/configuration/configuration-panels'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/agreements')({
  staticData: {
    title: 'Agreements',
    subtitle: 'Manage agreement draft templates.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(configurationQueryOptions())
  },
  component: AgreementsPanel,
})
