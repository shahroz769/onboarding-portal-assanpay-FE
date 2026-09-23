import { useQuery } from '@tanstack/react-query'

import { Send } from 'lucide-react'

import {
  payoutMethodsQueryOptions,
  useUpdatePayoutMethodsMutation,
} from '#/hooks/use-configuration-query'

import { payoutMethodSettingsSchema } from '#/schemas/configuration.schema'

import { MethodListPanel } from './method-list-panel'

export function PayoutMethodsPanel() {
  const { data, isPending, error } = useQuery(payoutMethodsQueryOptions())
  const mutation = useUpdatePayoutMethodsMutation()
  return (
    <MethodListPanel
      data={data ?? null}
      isPending={isPending}
      queryError={error}
      mutation={mutation}
      icon={Send}
      noun="payout method"
      title="Payout Methods"
      schema={payoutMethodSettingsSchema}
    />
  )
}
