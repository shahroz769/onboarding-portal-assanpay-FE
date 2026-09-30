import { cn } from '#/lib/utils'
import type { MerchantOverviewResponse } from '#/schemas/merchants.schema'

export function MerchantPaymentMethodDetails({
  methods,
  currency,
  className,
  kind = 'collection',
}: {
  methods:
    | MerchantOverviewResponse['paymentMethods']
    | MerchantOverviewResponse['payoutMethods']
  currency: string
  className?: string
  kind?: 'collection' | 'payout'
}) {
  if (methods.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        No {kind === 'collection' ? 'collection payment' : 'payout'} methods
        configured.
      </div>
    )
  }

  // Container queries: these cards sit in full- and half-width parents.
  return (
    <div className={cn('@container', className)}>
      <div className="grid gap-4 @2xl:grid-cols-2">
        {methods.map((method) => (
          <div
            key={method.id}
            className="@container flex flex-col gap-4 rounded-xl border bg-muted/20 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{method.label}</p>
                <p className="text-xs text-muted-foreground">
                  {kind === 'collection'
                    ? 'Collection payment method'
                    : 'Payout method'}
                </p>
              </div>
              <div className="rounded-md bg-background px-3 py-2 text-right ring-1 ring-border">
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className="font-semibold tabular-nums">
                  {method.commissionRate}%
                </p>
              </div>
            </div>
            <div className="grid gap-3 @xs:grid-cols-2">
              <LimitSummary
                label="Testing limits"
                min={method.testing.min}
                max={method.testing.max}
                currency={currency}
              />
              <LimitSummary
                label="Live limits"
                min={method.live.min}
                max={method.live.max}
                currency={currency}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LimitSummary({
  label,
  min,
  max,
  currency,
}: {
  label: string
  min: number
  max: number
  currency: string
}) {
  return (
    <div className="rounded-md bg-background p-3 ring-1 ring-border">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums">
        {currency} {min.toLocaleString()} – {max.toLocaleString()}
      </p>
    </div>
  )
}
