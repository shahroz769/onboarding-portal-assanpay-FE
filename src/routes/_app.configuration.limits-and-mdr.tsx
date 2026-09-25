import { createFileRoute } from '@tanstack/react-router'

import { LimitsAndMdrSkeleton } from '#/features/configuration/configuration-route-skeleton'
import { LimitsAndMdrPanel } from '#/features/configuration/panels/limits-and-mdr-panel'

export const Route = createFileRoute('/_app/configuration/limits-and-mdr')({
  staticData: {
    title: 'Limits and MDR',
    subtitle: 'Review transaction limits and method-wise commission rates.',
  },
  pendingMs: 0,
  pendingComponent: LimitsAndMdrSkeleton,
  component: LimitsAndMdrPanel,
})
