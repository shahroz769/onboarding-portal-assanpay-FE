import { useQuery } from '@tanstack/react-query'

import { Wallet } from 'lucide-react'

import {
  configurationQueryOptions,
  useUpdatePaymentMethodsMutation,
} from '#/hooks/use-configuration-query'

import { MethodListPanel } from './configuration-panel-shared'

// ─── Payment Methods ────────────────────────────────────────────────────────
export function PaymentMethodsPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdatePaymentMethodsMutation()
  return (
    <MethodListPanel
      data={data?.paymentMethods ?? null}
      isPending={isPending}
      mutation={mutation}
      icon={Wallet}
      tone="violet"
      title="Payment Methods"
      description="Manage collection methods available during MID Creation."
      addLabel="Add payment method"
      saveLabel="Save payment methods"
      emptyMessage="No payment methods configured."
    />
  )
}
