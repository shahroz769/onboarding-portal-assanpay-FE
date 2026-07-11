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

import { Input } from '#/components/ui/input'

import { Spinner } from '#/components/ui/spinner'

import {
  configurationQueryOptions,
  useUpdateLimitsAndMdrMutation,
} from '#/hooks/use-configuration-query'

import type { LimitsAndMdrSettings } from '#/schemas/configuration.schema'

import { limitsAndMdrSettingsSchema } from '#/schemas/configuration.schema'

import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  PanelLoading,
  getValidationErrors,
  hasValidationErrors,
} from './configuration-panel-shared'

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
    ? getValidationErrors(limitsAndMdrSettingsSchema.safeParse(value))
    : {}
  function update(path: string, nextValue: number) {
    setForm((current) => {
      const base = current ?? data?.limitsAndMdr
      if (!base) return current
      const next = structuredClone(base)
      const [group, key] = path.split('.') as [
        keyof LimitsAndMdrSettings,
        string,
      ]
      ;(next[group] as Record<string, number>)[key] = nextValue
      return next
    })
  }
  if (isPending || !value) {
    return <PanelLoading />
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <LimitSection
          icon={BadgeDollarSign}
          colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          title="Testing Limits"
          description="Transaction ranges used before merchant go-live."
          prefix="testing"
          value={value.testing}
          errors={validationErrors}
          onChange={update}
        />
        <LimitSection
          icon={Rocket}
          colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          title="Live Limits"
          description="Production transaction ranges for live merchants."
          prefix="live"
          value={value.live}
          errors={validationErrors}
          onChange={update}
        />
        <RatesSection
          icon={Wallet}
          colorClass="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          value={value.rates}
          errors={validationErrors}
          onChange={update}
        />
      </div>
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

function LimitSection({
  icon,
  colorClass,
  title,
  description,
  prefix,
  value,
  errors,
  onChange,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
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
      colorClass={colorClass}
      title={title}
      description={description}
    >
      <FieldGroup>
        <AmountField
          id={`${prefix}-collection-min`}
          label="Collection Min"
          value={value.collectionMin}
          error={errors[`${prefix}.collectionMin`]}
          onChange={(next) => onChange(`${prefix}.collectionMin`, next)}
        />
        <AmountField
          id={`${prefix}-collection-max`}
          label="Collection Max"
          value={value.collectionMax}
          error={errors[`${prefix}.collectionMax`]}
          onChange={(next) => onChange(`${prefix}.collectionMax`, next)}
        />
        <AmountField
          id={`${prefix}-disbursement-min`}
          label="Disbursement Min"
          value={value.disbursementMin}
          error={errors[`${prefix}.disbursementMin`]}
          onChange={(next) => onChange(`${prefix}.disbursementMin`, next)}
        />
        <AmountField
          id={`${prefix}-disbursement-max`}
          label="Disbursement Max"
          value={value.disbursementMax}
          error={errors[`${prefix}.disbursementMax`]}
          onChange={(next) => onChange(`${prefix}.disbursementMax`, next)}
        />
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}

function RatesSection({
  icon,
  colorClass,
  value,
  errors,
  onChange,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
  value: LimitsAndMdrSettings['rates']
  errors: Record<string, string>
  onChange: (path: string, value: number) => void
}) {
  return (
    <ConfigurationSectionCard
      icon={icon}
      colorClass={colorClass}
      title="Commission Rates"
      description="Global MDR and payout rates used by case emails and reviews."
    >
      <FieldGroup>
        <AmountField
          id="rate-ewallets"
          label="E-wallets / QR"
          value={value.eWallets}
          error={errors['rates.eWallets']}
          onChange={(next) => onChange('rates.eWallets', next)}
        />
        <AmountField
          id="rate-card-default"
          label="Card"
          value={value.cardDefault}
          error={errors['rates.cardDefault']}
          onChange={(next) => onChange('rates.cardDefault', next)}
        />
        <AmountField
          id="rate-card-shopify"
          label="Card Shopify"
          value={value.cardShopify}
          error={errors['rates.cardShopify']}
          onChange={(next) => onChange('rates.cardShopify', next)}
        />
        <AmountField
          id="rate-payout"
          label="Bank Settlement"
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
  onChange,
}: {
  id: string
  label: string
  value: number
  error?: string
  onChange: (value: number) => void
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        {...numberInputProps}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}
