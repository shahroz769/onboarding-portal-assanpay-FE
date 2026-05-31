import { useMemo, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { cn } from '#/lib/utils'
import {
  useResetMerchantLimitsMdrMutation,
  useUpdateMerchantLimitsMdrMutation,
} from '#/hooks/use-merchants-query'
import type {
  MerchantDetailResponse,
  MerchantLimitsMdr,
} from '#/schemas/merchants.schema'

type MerchantLimitsMdrTabProps = {
  detail: MerchantDetailResponse
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

const LIMIT_FIELDS: { key: keyof MerchantLimitsMdr['testing']; label: string }[] =
  [
    { key: 'collectionMin', label: 'Collection minimum' },
    { key: 'collectionMax', label: 'Collection maximum' },
    { key: 'disbursementMin', label: 'Disbursement minimum' },
    { key: 'disbursementMax', label: 'Disbursement maximum' },
  ]

const RATE_FIELDS: { key: RateKey; label: string }[] = [
  { key: 'eWallets', label: 'E-Wallets (%)' },
  { key: 'cardDefault', label: 'Card — Default (%)' },
  { key: 'cardShopify', label: 'Card — Shopify (%)' },
  { key: 'payout', label: 'Payout (%)' },
]

function validate(form: MerchantLimitsMdr) {
  const errors: Record<string, string> = {}
  for (const group of ['testing', 'live'] as const) {
    if (form[group].collectionMax < form[group].collectionMin) {
      errors[`${group}.collectionMax`] = 'Max must be ≥ min.'
    }
    if (form[group].disbursementMax < form[group].disbursementMin) {
      errors[`${group}.disbursementMax`] = 'Max must be ≥ min.'
    }
  }
  for (const { key } of RATE_FIELDS) {
    const value = form.rates[key]
    if (value < 0 || value > 100) {
      errors[`rates.${key}`] = 'Must be between 0 and 100.'
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

  const [form, setForm] = useState<MerchantLimitsMdr>(() =>
    structuredClone(detail.limitsAndMdr.effective),
  )

  const activeGroup: LimitGroup =
    detail.merchant.status === 'live' ? 'live' : 'testing'

  const errors = useMemo(() => validate(form), [form])
  const hasErrors = Object.keys(errors).length > 0
  const isDirty = useMemo(
    () =>
      JSON.stringify(form) !==
      JSON.stringify(detail.limitsAndMdr.effective),
    [form, detail.limitsAndMdr.effective],
  )

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

  function updateRate(key: RateKey, value: number) {
    setForm((current) => ({
      ...current,
      rates: { ...current.rates, [key]: value },
    }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <LimitSection
          title="Testing Limits"
          group="testing"
          active={activeGroup === 'testing'}
          values={form.testing}
          errors={errors}
          disabled={!canEdit}
          onChange={updateLimit}
        />
        <LimitSection
          title="Live Limits"
          group="live"
          active={activeGroup === 'live'}
          values={form.live}
          errors={errors}
          disabled={!canEdit}
          onChange={updateLimit}
        />
        <Card>
          <CardHeader>
            <CardTitle>Commission Rates (MDR)</CardTitle>
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
                  value={Number.isFinite(form.rates[key]) ? form.rates[key] : ''}
                  onChange={(event) =>
                    updateRate(key, Number(event.target.value))
                  }
                />
                {errors[`rates.${key}`] ? (
                  <p className="text-xs text-destructive">
                    {errors[`rates.${key}`]}
                  </p>
                ) : null}
              </Field>
            ))}
          </CardContent>
        </Card>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {detail.limitsAndMdr.isOverridden ? (
            <Button
              variant="outline"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending || updateMutation.isPending}
            >
              {resetMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              Revert to global
            </Button>
          ) : null}
          <Button
            onClick={() => updateMutation.mutate(form)}
            disabled={
              updateMutation.isPending || hasErrors || !isDirty
            }
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
        <CardTitle className="flex items-center justify-between">
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
                value={Number.isFinite(values[key]) ? values[key] : ''}
                onChange={(event) =>
                  onChange(group, key, Number(event.target.value))
                }
              />
              {errors[errorKey] ? (
                <p className="text-xs text-destructive">{errors[errorKey]}</p>
              ) : null}
            </Field>
          )
        })}
      </CardContent>
    </Card>
  )
}
