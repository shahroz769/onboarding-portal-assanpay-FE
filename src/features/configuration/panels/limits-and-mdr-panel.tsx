import type { ComponentType, SVGProps } from 'react'

import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { BadgeDollarSign, ListChecks, Rocket, Save, Wallet } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

import { Button } from '#/components/ui/button'

import { Field, FieldError, FieldLabel } from '#/components/ui/field'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'

import { Spinner } from '#/components/ui/spinner'

import {
  limitsAndMdrQueryOptions,
  paymentMethodsQueryOptions,
  payoutMethodsQueryOptions,
  useUpdateLimitsAndMdrMutation,
} from '#/hooks/use-configuration-query'

import type {
  LimitsAndMdrSettings,
  PaymentMethodSettings,
  PayoutMethodSettings,
} from '#/schemas/configuration.schema'
import type { StatusTint } from '#/lib/status-styles'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

import { limitsAndMdrSettingsSchema } from '#/schemas/configuration.schema'

import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  PanelLoading,
} from './configuration-panel-shared'
import {
  getValidationErrors,
  hasValidationErrors,
} from './configuration-panel-utils'

const numberInputProps = {
  type: 'number',
  min: 0,
  step: '0.01',
  inputMode: 'decimal' as const,
}

// ─── Limits & MDR ───────────────────────────────────────────────────────────
export function LimitsAndMdrPanel() {
  const { data, isPending, error } = useQuery(limitsAndMdrQueryOptions())
  const paymentMethodsQuery = useQuery(paymentMethodsQueryOptions())
  const payoutMethodsQuery = useQuery(payoutMethodsQueryOptions())
  const mutation = useUpdateLimitsAndMdrMutation()
  const [form, setForm] = useState<LimitsAndMdrSettings | null>(null)
  const value = form ?? data ?? null
  const validationErrors = value
    ? {
        ...getValidationErrors(limitsAndMdrSettingsSchema.safeParse(value)),
        ...getRangeOrderErrors(value),
      }
    : {}
  function update(path: string, nextValue: number) {
    const base = form ?? data
    if (!base) return
    const next = structuredClone(base)
    const [group, key] = path.split('.') as [keyof LimitsAndMdrSettings, string]
    ;(next[group] as Record<string, number>)[key] = nextValue
    setForm(next)
  }
  const queryError =
    error ?? paymentMethodsQuery.error ?? payoutMethodsQuery.error
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
  if (
    isPending ||
    paymentMethodsQuery.isPending ||
    payoutMethodsQuery.isPending ||
    !value
  ) {
    return <PanelLoading />
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <LimitSection
          icon={BadgeDollarSign}
          tone="blue"
          title="Testing Limits"
          description="Transaction ranges used before merchant go-live."
          prefix="testing"
          value={value.testing}
          errors={validationErrors}
          onChange={update}
        />
        <LimitSection
          icon={Rocket}
          tone="emerald"
          title="Live Limits"
          description="Production transaction ranges for live merchants."
          prefix="live"
          value={value.live}
          errors={validationErrors}
          onChange={update}
        />
      </div>
      <CommissionRatesSection
        icon={Wallet}
        tone="sky"
        value={value.rates}
        errors={validationErrors}
        onChange={update}
      />
      <MethodPricingSection
        icon={ListChecks}
        tone="violet"
        paymentMethods={paymentMethodsQuery.data ?? []}
        payoutMethods={payoutMethodsQuery.data ?? []}
      />
      <ConfigurationActionBar>
        <Button
          onClick={() => mutation.mutate(value)}
          disabled={mutation.isPending || hasValidationErrors(validationErrors)}
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save configuration
        </Button>
      </ConfigurationActionBar>
    </div>
  )
}

function getRangeOrderErrors(value: LimitsAndMdrSettings) {
  const errors: Record<string, string> = {}
  for (const group of ['testing', 'live'] as const) {
    const range = value[group]
    if (range.collectionMin > range.collectionMax) {
      errors[`${group}.collectionMax`] =
        'Maximum must be greater than or equal to the minimum.'
    }
    if (range.disbursementMin > range.disbursementMax) {
      errors[`${group}.disbursementMax`] =
        'Maximum must be greater than or equal to the minimum.'
    }
  }
  return errors
}

function LimitSection({
  icon,
  tone,
  title,
  description,
  prefix,
  value,
  errors,
  onChange,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
  prefix: 'testing' | 'live'
  value: LimitsAndMdrSettings['testing']
  errors: Record<string, string>
  onChange: (path: string, value: number) => void
}) {
  return (
    <ConfigurationSectionCard
      icon={icon}
      tone={tone}
      title={title}
      description={description}
    >
      <div className="flex flex-col gap-5">
        <RangeGroup
          label="Collection"
          hint="Incoming payments collected from customers."
          prefix={`${prefix}.collection`}
          minValue={value.collectionMin}
          maxValue={value.collectionMax}
          errors={errors}
          onChange={onChange}
        />
        <div className="border-t" />
        <RangeGroup
          label="Disbursement"
          hint="Outgoing payouts to merchants."
          prefix={`${prefix}.disbursement`}
          minValue={value.disbursementMin}
          maxValue={value.disbursementMax}
          errors={errors}
          onChange={onChange}
        />
      </div>
    </ConfigurationSectionCard>
  )
}

function RangeGroup({
  label,
  hint,
  prefix,
  minValue,
  maxValue,
  errors,
  onChange,
}: {
  label: string
  hint: string
  prefix: string
  minValue: number
  maxValue: number
  errors: Record<string, string>
  onChange: (path: string, value: number) => void
}) {
  const idPrefix = prefix.replaceAll('.', '-')
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          id={`${idPrefix}-min`}
          label="Minimum"
          suffix="PKR"
          value={minValue}
          error={errors[`${prefix}Min`]}
          onChange={(next) => onChange(`${prefix}Min`, next)}
        />
        <AmountField
          id={`${idPrefix}-max`}
          label="Maximum"
          suffix="PKR"
          value={maxValue}
          error={errors[`${prefix}Max`]}
          onChange={(next) => onChange(`${prefix}Max`, next)}
        />
      </div>
    </div>
  )
}

function CommissionRatesSection({
  icon,
  tone,
  value,
  errors,
  onChange,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  value: LimitsAndMdrSettings['rates']
  errors: Record<string, string>
  onChange: (path: string, value: number) => void
}) {
  return (
    <ConfigurationSectionCard
      icon={icon}
      tone={tone}
      title="Default Commission Rates"
      description="Fallback rates used when a method-specific commission is not available."
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AmountField
          id="rate-e-wallets"
          label="E-wallets & QR"
          suffix="%"
          value={value.eWallets}
          error={errors['rates.eWallets']}
          onChange={(next) => onChange('rates.eWallets', next)}
        />
        <AmountField
          id="rate-card-default"
          label="Card · default"
          suffix="%"
          value={value.cardDefault}
          error={errors['rates.cardDefault']}
          onChange={(next) => onChange('rates.cardDefault', next)}
        />
        <AmountField
          id="rate-card-shopify"
          label="Card · Shopify"
          suffix="%"
          value={value.cardShopify}
          error={errors['rates.cardShopify']}
          onChange={(next) => onChange('rates.cardShopify', next)}
        />
        <AmountField
          id="rate-payout"
          label="Payout · default"
          suffix="%"
          value={value.payout}
          error={errors['rates.payout']}
          onChange={(next) => onChange('rates.payout', next)}
        />
      </div>
    </ConfigurationSectionCard>
  )
}

function MethodPricingSection({
  icon,
  tone,
  paymentMethods,
  payoutMethods,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  paymentMethods: PaymentMethodSettings
  payoutMethods: PayoutMethodSettings
}) {
  return (
    <ConfigurationSectionCard
      icon={icon}
      tone={tone}
      title="Method-specific Pricing"
      description="Commission and transaction limits configured on each collection and payout method."
    >
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
    </ConfigurationSectionCard>
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

function AmountField({
  id,
  label,
  value,
  error,
  suffix,
  onChange,
}: {
  id: string
  label: string
  value: number
  error?: string
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          {...numberInputProps}
          value={value}
          aria-invalid={Boolean(error)}
          className="text-right tabular-nums"
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <InputGroupAddon align="inline-end">{suffix}</InputGroupAddon>
      </InputGroup>
      <FieldError>{error}</FieldError>
    </Field>
  )
}
