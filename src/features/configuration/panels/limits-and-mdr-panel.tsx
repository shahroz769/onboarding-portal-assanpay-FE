import type { ComponentType, SVGProps } from 'react'

import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { BadgeDollarSign, Rocket, Save, Wallet } from 'lucide-react'

import { Button } from '#/components/ui/button'

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'

import { Separator } from '#/components/ui/separator'

import { Spinner } from '#/components/ui/spinner'

import {
  configurationQueryOptions,
  useUpdateLimitsAndMdrMutation,
} from '#/hooks/use-configuration-query'

import type { LimitsAndMdrSettings } from '#/schemas/configuration.schema'
import type { StatusTint } from '#/lib/status-styles'

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
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdateLimitsAndMdrMutation()
  const [form, setForm] = useState<LimitsAndMdrSettings | null>(null)
  const value = form ?? data?.limitsAndMdr ?? null
  const validationErrors = value
    ? {
        ...getValidationErrors(limitsAndMdrSettingsSchema.safeParse(value)),
        ...getRangeOrderErrors(value),
      }
    : {}
  function update(path: string, nextValue: number) {
    const base = form ?? data?.limitsAndMdr
    if (!base) return
    const next = structuredClone(base)
    const [group, key] = path.split('.') as [keyof LimitsAndMdrSettings, string]
    ;(next[group] as Record<string, number>)[key] = nextValue
    setForm(next)
  }
  if (isPending || !value) {
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
      <RatesSection
        icon={Wallet}
        tone="sky"
        value={value.rates}
        errors={validationErrors}
        onChange={update}
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
          hint="Incoming payments from customers."
          prefix={`${prefix}.collection`}
          minValue={value.collectionMin}
          maxValue={value.collectionMax}
          errors={errors}
          onChange={onChange}
        />
        <Separator />
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

function RatesSection({
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
      title="Commission Rates"
      description="Global MDR and payout rates used by case emails and reviews. All values are percentages."
    >
      <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AmountField
          id="rate-ewallets"
          label="E-wallets / QR"
          suffix="%"
          value={value.eWallets}
          error={errors['rates.eWallets']}
          onChange={(next) => onChange('rates.eWallets', next)}
        />
        <AmountField
          id="rate-card-default"
          label="Card (default)"
          suffix="%"
          value={value.cardDefault}
          error={errors['rates.cardDefault']}
          onChange={(next) => onChange('rates.cardDefault', next)}
        />
        <AmountField
          id="rate-card-shopify"
          label="Card (Shopify)"
          suffix="%"
          value={value.cardShopify}
          error={errors['rates.cardShopify']}
          onChange={(next) => onChange('rates.cardShopify', next)}
        />
        <AmountField
          id="rate-payout"
          label="Bank Settlement"
          suffix="%"
          value={value.payout}
          error={errors['rates.payout']}
          onChange={(next) => onChange('rates.payout', next)}
        />
      </FieldGroup>
    </ConfigurationSectionCard>
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
