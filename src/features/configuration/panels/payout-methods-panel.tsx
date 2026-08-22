import { useQuery } from '@tanstack/react-query'

import { Send } from 'lucide-react'

import {
  payoutMethodsQueryOptions,
  useUpdatePayoutMethodsMutation,
} from '#/hooks/use-configuration-query'

import { MethodListPanel } from './configuration-panel-shared'
import { payoutMethodSettingsSchema } from '#/schemas/configuration.schema'
import { createEmptyConfiguredMethod } from './configuration-panel-utils'
import { MethodConfigurationFields } from './method-configuration-fields'

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
      tone="sky"
      title="Payout Methods"
      description="Manage payout methods, limits, and commission available during MID Creation."
      addLabel="Add payout method"
      saveLabel="Save payout methods"
      emptyMessage="No payout methods configured."
      methodNameLabel="Payout method name"
      schema={payoutMethodSettingsSchema}
      createMethod={createEmptyConfiguredMethod}
      renderMethodDetails={(props) => (
        <MethodConfigurationFields {...props} transactionType="Disbursement" />
      )}
    />
  )
}
