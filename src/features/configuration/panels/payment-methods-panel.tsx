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
      colorClass="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      title="Payment Methods"
      description="Manage collection methods available during MID Creation."
      addLabel="Add payment method"
      saveLabel="Save payment methods"
      emptyMessage="No payment methods configured."
    />
  )
}
