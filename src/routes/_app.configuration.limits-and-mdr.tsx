import { createFileRoute } from '@tanstack/react-router'

import { LimitsAndMdrSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { LimitsAndMdrPanel } from '#/features/configuration/panels/limits-and-mdr-panel'
import {
  limitsAndMdrQueryOptions,
  paymentMethodsQueryOptions,
  payoutMethodsQueryOptions,
} from '#/hooks/use-configuration-query'

export const Route = createFileRoute('/_app/configuration/limits-and-mdr')({
  staticData: {
    title: 'Limits and MDR',
    subtitle: 'Review transaction limits and method-wise commission rates.',
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(limitsAndMdrQueryOptions()),
      context.queryClient.ensureQueryData(paymentMethodsQueryOptions()),
      context.queryClient.ensureQueryData(payoutMethodsQueryOptions()),
    ])
  },
  pendingMs: 0,
  pendingComponent: LimitsAndMdrSkeleton,
  component: LimitsAndMdrPanel,
})
