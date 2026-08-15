import { useQuery } from '@tanstack/react-query'

import { Send } from 'lucide-react'

import {
  configurationQueryOptions,
  useUpdatePayoutMethodsMutation,
} from '#/hooks/use-configuration-query'

import { MethodListPanel } from './configuration-panel-shared'

export function PayoutMethodsPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdatePayoutMethodsMutation()
  return (
    <MethodListPanel
      data={data?.payoutMethods ?? null}
      isPending={isPending}
      mutation={mutation}
      icon={Send}
      tone="sky"
      title="Payout Methods"
      description="Manage payout methods available during MID Creation."
      addLabel="Add payout method"
      saveLabel="Save payout methods"
      emptyMessage="No payout methods configured."
    />
  )
}
