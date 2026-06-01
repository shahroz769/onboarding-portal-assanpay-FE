import { createFileRoute } from '@tanstack/react-router'

import { CaseTriggeringPanel } from '#/features/configuration/configuration-panels'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import {
  caseFlowConfigurationQueryOptions,
  configurationQueryOptions,
} from '#/hooks/use-configuration-query'
import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/configuration/case-triggering')({
  staticData: {
    title: 'Case Triggering',
    subtitle: 'Manage automatic case creation rules.',
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(configurationQueryOptions()),
      context.queryClient.ensureQueryData(caseFlowConfigurationQueryOptions()),
      context.queryClient.ensureQueryData(
        queuesQueryOptions({ includeInactive: true }),
      ),
      context.queryClient.ensureQueryData(merchantOptionsQueryOptions()),
    ])
  },
  component: CaseTriggeringPanel,
})
