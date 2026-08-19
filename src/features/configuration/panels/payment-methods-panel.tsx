import { useQuery } from '@tanstack/react-query'

import { Wallet } from 'lucide-react'

import { paymentMethodSettingsSchema } from '#/schemas/configuration.schema'

import {
  paymentMethodsQueryOptions,
  useUpdatePaymentMethodsMutation,
} from '#/hooks/use-configuration-query'

import { MethodListPanel } from './configuration-panel-shared'
import {
  createEmptyConfiguredMethod,
  MethodConfigurationFields,
} from './method-configuration-fields'

// ─── Payment Methods ────────────────────────────────────────────────────────
export function PaymentMethodsPanel() {
  const { data, isPending, error } = useQuery(paymentMethodsQueryOptions())
  const mutation = useUpdatePaymentMethodsMutation()
  return (
    <MethodListPanel
      data={data ?? null}
      isPending={isPending}
      queryError={error}
      mutation={mutation}
      icon={Wallet}
      tone="violet"
      title="Payment Methods"
      description="Manage collection methods available during MID Creation."
      addLabel="Add payment method"
      saveLabel="Save payment methods"
      emptyMessage="No payment methods configured."
      methodNameLabel="Payment method name"
      schema={paymentMethodSettingsSchema}
      createMethod={createEmptyConfiguredMethod}
      renderMethodDetails={(props) => (
        <MethodConfigurationFields {...props} transactionType="Collection" />
      )}
    />
  )
}
