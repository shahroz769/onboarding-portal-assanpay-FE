import { useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { cn } from '#/lib/utils'
import {
  useResetMerchantLimitsMdrMutation,
  useUpdateMerchantLimitsMdrMutation,
} from '#/hooks/use-merchants-query'
import type {
  MerchantLimitsMdr,
  MerchantLimitsResponse,
} from '#/schemas/merchants.schema'
import { MerchantPaymentMethodDetails } from './merchant-payment-method-details'

type MerchantLimitsMdrTabProps = {
  detail: MerchantLimitsResponse
  canEdit: boolean
}

type LimitGroup = 'testing' | 'live'
type RateKey = keyof MerchantLimitsMdr['rates']

const numberInputProps = {
  type: 'number',
  min: 0,
  step: '0.01',
  inputMode: 'decimal' as const,
}

const LIMIT_FIELDS: {
  key: keyof MerchantLimitsMdr['testing']
  label: string
}[] = [
  { key: 'disbursementMin', label: 'Disbursement minimum' },
  { key: 'disbursementMax', label: 'Disbursement maximum' },
]

const RATE_FIELDS: { key: RateKey; label: string }[] = [
  { key: 'payout', label: 'Payout (%)' },
]

// Error keys are `testing.disbursementMax` / `rates.payout`; input ids are
// `testing-disbursementMax` / `rate-payout`.
function inputId(errorKey: string) {
  const [group, key] = errorKey.split('.')
  return group === 'rates' ? `rate-${key}` : `${group}-${key}`
}

function validate(form: MerchantLimitsMdr) {
  const errors: Record<string, string> = {}
  for (const group of ['testing', 'live'] as const) {
    if (form[group].disbursementMax < form[group].disbursementMin) {
      errors[`${group}.disbursementMax`] =
        'Enter a maximum at or above the minimum.'
    }
  }
  for (const { key } of RATE_FIELDS) {
    const value = form.rates[key]
    if (value < 0 || value > 100) {
      errors[`rates.${key}`] = 'Enter a rate between 0 and 100.'
    }
  }
  return errors
}

export function MerchantLimitsMdrTab({
  detail,
  canEdit,
}: MerchantLimitsMdrTabProps) {
  const merchantId = detail.merchant.id
  const updateMutation = useUpdateMerchantLimitsMdrMutation(merchantId)
  const resetMutation = useResetMerchantLimitsMdrMutation(merchantId)

  // Seeded once: the route keys this tab on the effective values, so a save
  // or a revert remounts it with the new server state.
  const [form, setForm] = useState<MerchantLimitsMdr>(() =>
    structuredClone(detail.limitsAndMdr.effective),
  )
  const [revertOpen, setRevertOpen] = useState(false)

  const activeGroup: LimitGroup =
    detail.merchant.status === 'live' ? 'live' : 'testing'

  const errors = validate(form)
  const hasErrors = Object.keys(errors).length > 0
  const isDirty =
    JSON.stringify(form) !== JSON.stringify(detail.limitsAndMdr.effective)

  function updateLimit(
    group: LimitGroup,
    key: keyof MerchantLimitsMdr['testing'],
    value: number,
  ) {
    setForm((current) => ({
      ...current,
      [group]: { ...current[group], [key]: value },
    }))
  }

  function save() {
    if (hasErrors) {
      // Validation runs on submit: focus the first invalid field.
      document.getElementById(inputId(Object.keys(errors)[0]))?.focus()
      return
    }
    updateMutation.mutate(form)
  }

  function updateRate(key: RateKey, value: number) {
    setForm((current) => ({
      ...current,
      rates: { ...current.rates, [key]: value },
    }))
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle render={<h2 />}>Collection payment methods</CardTitle>
          <CardDescription>
            Method-wise testing limits, live limits, and commission rates saved
            for this merchant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantPaymentMethodDetails
            methods={detail.paymentMethods}
            currency={detail.merchant.currency}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle render={<h2 />}>Payout methods</CardTitle>
          <CardDescription>
            Method-wise testing limits, live limits, and commission rates saved
            for this merchant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantPaymentMethodDetails
            methods={detail.payoutMethods}
            currency={detail.merchant.currency}
            kind="payout"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <LimitSection
          title="Testing limits"
          group="testing"
          active={activeGroup === 'testing'}
          values={form.testing}
          errors={errors}
          disabled={!canEdit}
          onChange={updateLimit}
        />

        <LimitSection
          title="Live limits"
          group="live"
          active={activeGroup === 'live'}
          values={form.live}
          errors={errors}
          disabled={!canEdit}
          onChange={updateLimit}
        />

        <Card>
          <CardHeader>
            <CardTitle render={<h2 />}>Commission rates (MDR)</CardTitle>
            <CardDescription>Applied across all transactions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {RATE_FIELDS.map(({ key, label }) => (
              <Field key={key} data-invalid={Boolean(errors[`rates.${key}`])}>
                <FieldLabel htmlFor={`rate-${key}`}>{label}</FieldLabel>
                <Input
                  id={`rate-${key}`}
                  {...numberInputProps}
                  max={100}
                  disabled={!canEdit}
                  aria-invalid={Boolean(errors[`rates.${key}`]) || undefined}
                  aria-describedby={
                    errors[`rates.${key}`]
                      ? `${inputId(`rates.${key}`)}-error`
                      : undefined
                  }
                  value={
                    Number.isFinite(form.rates[key]) ? form.rates[key] : ''
                  }
                  onChange={(event) =>
                    updateRate(key, Number(event.target.value))
                  }
                />

                {errors[`rates.${key}`] ? (
                  <FieldError id={`${inputId(`rates.${key}`)}-error`}>
                    {errors[`rates.${key}`]}
                  </FieldError>
                ) : null}
              </Field>
            ))}
          </CardContent>
        </Card>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {detail.limitsAndMdr.isOverridden ? (
            <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      resetMutation.isPending || updateMutation.isPending
                    }
                  />
                }
              >
                <RotateCcw data-icon="inline-start" />
                Revert to global
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revert to global limits?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the custom limits and MDR saved for this
                    merchant. The global configuration applies instead.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={resetMutation.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={resetMutation.isPending}
                    onClick={() =>
                      resetMutation.mutate(undefined, {
                        onSuccess: () => setRevertOpen(false),
                      })
                    }
                  >
                    {resetMutation.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : null}
                    Revert to global
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button
            onClick={save}
            disabled={updateMutation.isPending || !isDirty}
          >
            {updateMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Save override
          </Button>
        </div>
      ) : (
        <p className="text-right text-sm text-muted-foreground">
          You do not have permission to edit limits and MDR.
        </p>
      )}
    </div>
  )
}

function LimitSection({
  title,
  group,
  active,
  values,
  errors,
  disabled,
  onChange,
}: {
  title: string
  group: LimitGroup
  active: boolean
  values: MerchantLimitsMdr['testing']
  errors: Record<string, string>
  disabled: boolean
  onChange: (
    group: LimitGroup,
    key: keyof MerchantLimitsMdr['testing'],
    value: number,
  ) => void
}) {
  return (
    <Card className={cn(active && 'ring-2 ring-primary/40')}>
      <CardHeader>
        <CardTitle
          render={<h2 />}
          className="flex items-center justify-between"
        >
          {title}
          {active ? <Badge>In effect</Badge> : null}
        </CardTitle>
        <CardDescription>Transaction amount boundaries.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {LIMIT_FIELDS.map(({ key, label }) => {
          const errorKey = `${group}.${key}`
          return (
            <Field key={key} data-invalid={Boolean(errors[errorKey])}>
              <FieldLabel htmlFor={`${group}-${key}`}>{label}</FieldLabel>
              <Input
                id={`${group}-${key}`}
                {...numberInputProps}
                disabled={disabled}
                aria-invalid={Boolean(errors[errorKey]) || undefined}
                aria-describedby={
                  errors[errorKey] ? `${group}-${key}-error` : undefined
                }
                value={Number.isFinite(values[key]) ? values[key] : ''}
                onChange={(event) =>
                  onChange(group, key, Number(event.target.value))
                }
              />

              {errors[errorKey] ? (
                <FieldError id={`${group}-${key}-error`}>
                  {errors[errorKey]}
                </FieldError>
              ) : null}
            </Field>
          )
        })}
      </CardContent>
    </Card>
  )
}
