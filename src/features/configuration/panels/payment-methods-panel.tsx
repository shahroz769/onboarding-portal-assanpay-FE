import { useQuery } from '@tanstack/react-query'

import { Wallet } from 'lucide-react'

import { paymentMethodSettingsSchema } from '#/schemas/configuration.schema'

import {
  paymentMethodsQueryOptions,
  useUpdatePaymentMethodsMutation,
} from '#/hooks/use-configuration-query'

import { MethodListPanel } from './method-list-panel'

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
      noun="payment method"
      title="Payment Methods"
      schema={paymentMethodSettingsSchema}
    />
  )
}
