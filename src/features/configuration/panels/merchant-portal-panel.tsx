import { useState } from 'react'

import type { ComponentProps } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Field, FieldError, FieldLabel } from '#/components/ui/field'

import { Input } from '#/components/ui/input'

import { Textarea } from '#/components/ui/textarea'

import {
  merchantPortalQueryOptions,
  useUpdateMerchantPortalMutation,
} from '#/hooks/use-configuration-query'

import type { MerchantPortalSettings } from '#/schemas/configuration.schema'

import { merchantPortalSettingsSchema } from '#/schemas/configuration.schema'

import { MerchantPortalSkeleton } from '../configuration-route-skeleton'
import {
  ConfigurationHeaderActions,
  ConfigurationPanel,
  ConfigurationSaveButton,
  ConfigurationSection,
} from './configuration-panel-shared'
import {
  getValidationErrors,
  hasValidationErrors,
} from './configuration-panel-utils'

// ─── Merchant Portal ───────────────────────────────────────────────────────
export function MerchantPortalPanel() {
  const { data, isPending } = useQuery(merchantPortalQueryOptions())
  const mutation = useUpdateMerchantPortalMutation()
  const [form, setForm] = useState<MerchantPortalSettings | null>(null)
  const value = form ?? data ?? null
  const validationErrors = value
    ? getValidationErrors(merchantPortalSettingsSchema.safeParse(value))
    : {}
  if (isPending || !value) {
    return <MerchantPortalSkeleton />
  }
  const settings = value
  function update(key: keyof MerchantPortalSettings, next: string) {
    setForm((current) => ({ ...(current ?? settings), [key]: next }))
  }
  return (
    <>
      <ConfigurationHeaderActions>
        <ConfigurationSaveButton
          dirty={form !== null}
          isPending={mutation.isPending}
          disabled={hasValidationErrors(validationErrors)}
          onClick={() =>
            mutation.mutate(value, { onSuccess: () => setForm(null) })
          }
        />
      </ConfigurationHeaderActions>
      <ConfigurationPanel>
        <ConfigurationSection
          title="Merchant portal"
          description="Where merchants sign in after onboarding."
        >
          <TextField
            id="merchant-portal-login-url"
            label="Login URL"
            type="url"
            value={value.loginUrl}
            placeholder="https://merchant.assanpay.com/login"
            error={validationErrors.loginUrl}
            onChange={(next) => update('loginUrl', next)}
          />
        </ConfigurationSection>

        <ConfigurationSection
          title="Custom website integration"
          description="Included in credential emails for custom website merchants only."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="merchant-server-base-url"
              label="Server Base URL"
              type="url"
              value={value.serverBaseUrl}
              placeholder="https://api.example.com"
              error={validationErrors.serverBaseUrl}
              onChange={(next) => update('serverBaseUrl', next)}
            />
            <TextField
              id="merchant-server-callback-ip"
              label="Server Callback IP"
              value={value.serverCallbackIp}
              placeholder="203.0.113.10"
              error={validationErrors.serverCallbackIp}
              onChange={(next) => update('serverCallbackIp', next)}
            />
          </div>
        </ConfigurationSection>

        <ConfigurationSection
          title="Support contacts"
          description="Shared with merchants for help and legal queries."
        >
          <div className="flex flex-col gap-4">
            <Field data-invalid={Boolean(validationErrors.officeAddress)}>
              <FieldLabel htmlFor="merchant-portal-office-address">
                Office Address
              </FieldLabel>
              <Textarea
                id="merchant-portal-office-address"
                value={value.officeAddress}
                placeholder="Enter office address"
                aria-invalid={Boolean(validationErrors.officeAddress)}
                onChange={(event) =>
                  update('officeAddress', event.target.value)
                }
              />
              <FieldError>{validationErrors.officeAddress}</FieldError>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="merchant-portal-whatsapp-support-number"
                label="WhatsApp Support Number"
                type="tel"
                inputMode="numeric"
                value={value.whatsappSupportNumber}
                placeholder="Enter WhatsApp support number"
                error={validationErrors.whatsappSupportNumber}
                onChange={(next) =>
                  update('whatsappSupportNumber', next.replace(/\D/g, ''))
                }
              />
              <TextField
                id="merchant-portal-support-email"
                label="Support Email"
                type="email"
                value={value.supportEmail}
                placeholder="support@example.com"
                error={validationErrors.supportEmail}
                onChange={(next) => update('supportEmail', next)}
              />
              <TextField
                id="merchant-portal-legal-email"
                label="Legal Email"
                type="email"
                value={value.legalEmail}
                placeholder="legal@example.com"
                error={validationErrors.legalEmail}
                onChange={(next) => update('legalEmail', next)}
              />
            </div>
          </div>
        </ConfigurationSection>
      </ConfigurationPanel>
    </>
  )
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
  ...inputProps
}: {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
} & Pick<ComponentProps<'input'>, 'type' | 'placeholder' | 'inputMode'>) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}
