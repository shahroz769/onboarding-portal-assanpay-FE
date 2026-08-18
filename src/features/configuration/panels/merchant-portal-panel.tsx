import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Save, Send } from 'lucide-react'

import { Button } from '#/components/ui/button'

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'

import { Input } from '#/components/ui/input'

import { Separator } from '#/components/ui/separator'

import { Spinner } from '#/components/ui/spinner'

import { Textarea } from '#/components/ui/textarea'

import {
  merchantPortalQueryOptions,
  useUpdateMerchantPortalMutation,
} from '#/hooks/use-configuration-query'

import type { MerchantPortalSettings } from '#/schemas/configuration.schema'

import { merchantPortalSettingsSchema } from '#/schemas/configuration.schema'

import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  PanelLoading,
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
    return <PanelLoading />
  }
  return (
    <ConfigurationSectionCard
      icon={Send}
      tone="sky"
      title="Merchant Portal & Support"
      description="Configure the merchant portal link and support contact details."
    >
      <FieldGroup>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Merchant portal</p>
          <Field data-invalid={Boolean(validationErrors.loginUrl)}>
            <FieldLabel htmlFor="merchant-portal-login-url">
              Login URL
            </FieldLabel>
            <Input
              id="merchant-portal-login-url"
              type="url"
              value={value.loginUrl}
              placeholder="https://merchant.assanpay.com/login"
              aria-invalid={Boolean(validationErrors.loginUrl)}
              onChange={(event) => {
                setForm((current) => ({
                  ...(current ?? value),
                  loginUrl: event.target.value,
                }))
              }}
            />
            <FieldError>{validationErrors.loginUrl}</FieldError>
          </Field>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Support contacts</p>
          <Field data-invalid={Boolean(validationErrors.officeAddress)}>
            <FieldLabel htmlFor="merchant-portal-office-address">
              Office Address
            </FieldLabel>
            <Textarea
              id="merchant-portal-office-address"
              value={value.officeAddress}
              placeholder="Enter office address"
              aria-invalid={Boolean(validationErrors.officeAddress)}
              onChange={(event) => {
                setForm((current) => ({
                  ...(current ?? value),
                  officeAddress: event.target.value,
                }))
              }}
            />
            <FieldError>{validationErrors.officeAddress}</FieldError>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              data-invalid={Boolean(validationErrors.whatsappSupportNumber)}
            >
              <FieldLabel htmlFor="merchant-portal-whatsapp-support-number">
                WhatsApp Support Number
              </FieldLabel>
              <Input
                id="merchant-portal-whatsapp-support-number"
                type="tel"
                inputMode="numeric"
                value={value.whatsappSupportNumber}
                placeholder="Enter WhatsApp support number"
                aria-invalid={Boolean(validationErrors.whatsappSupportNumber)}
                onChange={(event) => {
                  setForm((current) => ({
                    ...(current ?? value),
                    whatsappSupportNumber: event.target.value.replace(
                      /\D/g,
                      '',
                    ),
                  }))
                }}
              />
              <FieldError>{validationErrors.whatsappSupportNumber}</FieldError>
            </Field>
            <Field data-invalid={Boolean(validationErrors.supportEmail)}>
              <FieldLabel htmlFor="merchant-portal-support-email">
                Support Email
              </FieldLabel>
              <Input
                id="merchant-portal-support-email"
                type="email"
                value={value.supportEmail}
                placeholder="support@example.com"
                aria-invalid={Boolean(validationErrors.supportEmail)}
                onChange={(event) => {
                  setForm((current) => ({
                    ...(current ?? value),
                    supportEmail: event.target.value,
                  }))
                }}
              />
              <FieldError>{validationErrors.supportEmail}</FieldError>
            </Field>
          </div>
        </div>
        <ConfigurationActionBar>
          <Button
            onClick={() => mutation.mutate(value)}
            disabled={
              mutation.isPending || hasValidationErrors(validationErrors)
            }
          >
            {mutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Save portal settings
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}
