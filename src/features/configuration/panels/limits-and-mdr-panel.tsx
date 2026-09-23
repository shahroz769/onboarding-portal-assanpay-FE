import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

import { Card, CardContent } from '#/components/ui/card'

import {
  paymentMethodsQueryOptions,
  payoutMethodsQueryOptions,
} from '#/hooks/use-configuration-query'

import type {
  PaymentMethodSettings,
  PayoutMethodSettings,
} from '#/schemas/configuration.schema'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

import { LimitsAndMdrSkeleton } from '../configuration-route-skeleton'

// ─── Limits & MDR ───────────────────────────────────────────────────────────
export function LimitsAndMdrPanel() {
  const paymentMethodsQuery = useQuery(paymentMethodsQueryOptions())
  const payoutMethodsQuery = useQuery(payoutMethodsQueryOptions())
  const queryError = paymentMethodsQuery.error ?? payoutMethodsQuery.error
  if (queryError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Limits & MDR could not be loaded</AlertTitle>
        <AlertDescription>
          {getApiErrorMessage(
            queryError,
            'Failed to load limits and commission rates.',
          )}
        </AlertDescription>
      </Alert>
    )
  }
  if (!paymentMethodsQuery.data || !payoutMethodsQuery.data) {
    return <LimitsAndMdrSkeleton />
  }
  return (
    <MethodPricingSection
      paymentMethods={paymentMethodsQuery.data}
      payoutMethods={payoutMethodsQuery.data}
    />
  )
}

function MethodPricingSection({
  paymentMethods,
  payoutMethods,
}: {
  paymentMethods: PaymentMethodSettings
  payoutMethods: PayoutMethodSettings
}) {
  return (
    <Card>
      <CardContent>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <MethodGroup
            eyebrow="Collection"
            title="Payment methods"
            methods={paymentMethods}
            empty="No collection payment methods configured."
          />
          <MethodGroup
            eyebrow="Disbursement"
            title="Payout methods"
            methods={payoutMethods}
            empty="No payout methods configured."
          />
        </div>
      </CardContent>
    </Card>
  )
}

function MethodGroup({
  eyebrow,
  title,
  methods,
  empty,
}: {
  eyebrow: string
  title: string
  methods: PaymentMethodSettings | PayoutMethodSettings
  empty: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-b pb-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-base font-semibold">{title}</h3>
      </div>
      {methods.length > 0 ? (
        <div className="flex flex-col gap-3">
          {methods.map((method) => (
            <MethodPricingCard key={method.id} method={method} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </section>
  )
}

function MethodPricingCard({
  method,
}: {
  method: PaymentMethodSettings[number] | PayoutMethodSettings[number]
}) {
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-semibold">{method.label}</p>
        <div className="rounded-md bg-background px-3 py-2 text-right ring-1 ring-border">
          <p className="text-xs text-muted-foreground">Commission</p>
          <p className="font-semibold tabular-nums">{method.commissionRate}%</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MethodLimitSummary
          label="Testing limits"
          min={method.testing.min}
          max={method.testing.max}
        />
        <MethodLimitSummary
          label="Live limits"
          min={method.live.min}
          max={method.live.max}
        />
      </div>
    </div>
  )
}

function MethodLimitSummary({
  label,
  min,
  max,
}: {
  label: string
  min: number
  max: number
}) {
  return (
    <div className="rounded-md bg-background p-3 ring-1 ring-border">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums">
        PKR {min.toLocaleString()} – {max.toLocaleString()}
      </p>
    </div>
  )
}
