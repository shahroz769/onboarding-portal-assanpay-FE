import { useQuery } from '@tanstack/react-query'

import { Wallet } from 'lucide-react'

import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { paymentMethodSettingsSchema } from '#/schemas/configuration.schema'

import {
  paymentMethodsQueryOptions,
  useUpdatePaymentMethodsMutation,
} from '#/hooks/use-configuration-query'

import { MethodListPanel } from './configuration-panel-shared'

// ─── Payment Methods ────────────────────────────────────────────────────────
export function PaymentMethodsPanel() {
  const { data, isPending } = useQuery(paymentMethodsQueryOptions())
  const mutation = useUpdatePaymentMethodsMutation()
  return (
    <MethodListPanel
      data={data ?? null}
      isPending={isPending}
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
      createMethod={(id) => ({
        id,
        label: '',
        testing: { min: Number.NaN, max: Number.NaN },
        live: { min: Number.NaN, max: Number.NaN },
        commissionRate: Number.NaN,
      })}
      renderMethodDetails={({ method, index, disabled, update }) => (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['testing', 'live'] as const).map((environment) => (
            <div key={environment} className="grid gap-2">
              <Label className="capitalize">{environment} limits (PKR)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">
                    Minimum
                  </Label>
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
                  <Label className="text-xs text-muted-foreground">
                    Maximum
                  </Label>
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
                  Number.isNaN(method.commissionRate)
                    ? ''
                    : method.commissionRate
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
      )}
    />
  )
}
