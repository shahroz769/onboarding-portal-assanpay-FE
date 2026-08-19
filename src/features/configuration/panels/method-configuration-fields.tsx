import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { PaymentMethod } from '#/schemas/configuration.schema'

export function createEmptyConfiguredMethod(id: string): PaymentMethod {
  return {
    id,
    label: '',
    testing: { min: Number.NaN, max: Number.NaN },
    live: { min: Number.NaN, max: Number.NaN },
    commissionRate: Number.NaN,
  }
}

export function MethodConfigurationFields({
  method,
  index,
  disabled,
  update,
  transactionType,
}: {
  method: PaymentMethod
  index: number
  disabled: boolean
  update: (method: PaymentMethod) => void
  transactionType: 'Collection' | 'Disbursement'
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="border-b pb-2 sm:col-span-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {transactionType}
        </p>
      </div>
      {(['testing', 'live'] as const).map((environment) => (
        <div key={environment} className="grid gap-2">
          <Label className="capitalize">
            {environment} {transactionType.toLowerCase()} limits (PKR)
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Minimum</Label>
              <Input
                type="number"
                min={0}
                value={
                  Number.isNaN(method[environment].min)
                    ? ''
                    : method[environment].min
                }
                aria-label={`Method ${index + 1} ${environment} minimum`}
                disabled={disabled}
                placeholder="0"
                onChange={(event) =>
                  update({
                    ...method,
                    [environment]: {
                      ...method[environment],
                      min: event.target.valueAsNumber,
                    },
                  })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Maximum</Label>
              <Input
                type="number"
                min={0}
                value={
                  Number.isNaN(method[environment].max)
                    ? ''
                    : method[environment].max
                }
                aria-label={`Method ${index + 1} ${environment} maximum`}
                disabled={disabled}
                placeholder="0"
                onChange={(event) =>
                  update({
                    ...method,
                    [environment]: {
                      ...method[environment],
                      max: event.target.valueAsNumber,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      ))}
      <div className="grid gap-1 sm:col-span-2 sm:max-w-xs">
        <Label>Commission rate</Label>
        <div className="relative">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={
              Number.isNaN(method.commissionRate) ? '' : method.commissionRate
            }
            aria-label={`Method ${index + 1} commission rate`}
            disabled={disabled}
            placeholder="0.00"
            className="pr-8"
            onChange={(event) =>
              update({
                ...method,
                commissionRate: event.target.valueAsNumber,
              })
            }
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            %
          </span>
        </div>
      </div>
    </div>
  )
}
