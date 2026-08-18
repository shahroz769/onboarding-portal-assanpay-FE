import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Mail, Save } from 'lucide-react'

import { Button } from '#/components/ui/button'

import { Checkbox } from '#/components/ui/checkbox'

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'

import { Spinner } from '#/components/ui/spinner'

import {
  emailSendingModeQueryOptions,
  useUpdateEmailSendingModeMutation,
} from '#/hooks/use-configuration-query'

import type { EmailSendingMode } from '#/schemas/configuration.schema'

import { emailSendingModeSchema } from '#/schemas/configuration.schema'

import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  PanelLoading,
} from './configuration-panel-shared'

// ─── Email Sending Mode ───────────────────────────────────────────────────────
export function EmailSendingModePanel() {
  const { data, isPending } = useQuery(emailSendingModeQueryOptions())
  const mutation = useUpdateEmailSendingModeMutation()
  const [form, setForm] = useState<EmailSendingMode | null>(null)
  const value = form ?? data ?? null
  const validationResult = value
    ? emailSendingModeSchema.safeParse(value)
    : null
  const hasError = validationResult ? !validationResult.success : false
  const bothDisabledError =
    value && !value.autoEnabled && !value.manualEnabled
      ? 'At least one mode must be enabled.'
      : null
  function setMode(field: keyof EmailSendingMode, checked: boolean) {
    setForm((prev) => {
      const current = prev ??
        data ?? {
          autoEnabled: true,
          manualEnabled: true,
        }
      const next = { ...current, [field]: checked }
      if (!next.autoEnabled && !next.manualEnabled) {
        return {
          ...next,
          [field === 'autoEnabled' ? 'manualEnabled' : 'autoEnabled']: true,
        }
      }
      return next
    })
  }
  function handleSave() {
    if (!value || hasError) return
    mutation.mutate(value)
  }
  if (isPending || !value) {
    return <PanelLoading />
  }
  return (
    <ConfigurationSectionCard
      icon={Mail}
      tone="blue"
      title="Email Sending"
      description="Choose how case emails are sent from the portal."
    >
      <FieldGroup>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            orientation="horizontal"
            className="items-start rounded-lg border p-4 transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-accent/40"
          >
            <Checkbox
              id="email-mode-auto"
              className="mt-0.5"
              checked={value.autoEnabled}
              onCheckedChange={(checked) => {
                if (typeof checked === 'boolean') {
                  setMode('autoEnabled', checked)
                }
              }}
            />
            <FieldContent>
              <FieldLabel htmlFor="email-mode-auto" className="cursor-pointer">
                Auto (Resend)
              </FieldLabel>
              <FieldDescription>
                Emails are sent automatically through Resend when triggered.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            className="items-start rounded-lg border p-4 transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-accent/40"
          >
            <Checkbox
              id="email-mode-manual"
              className="mt-0.5"
              checked={value.manualEnabled}
              onCheckedChange={(checked) => {
                if (typeof checked === 'boolean') {
                  setMode('manualEnabled', checked)
                }
              }}
            />
            <FieldContent>
              <FieldLabel
                htmlFor="email-mode-manual"
                className="cursor-pointer"
              >
                Manual (Gmail)
              </FieldLabel>
              <FieldDescription>
                Agent receives subject and body to copy-paste and send from
                Gmail manually.
              </FieldDescription>
            </FieldContent>
          </Field>
        </div>

        <FieldError>{bothDisabledError}</FieldError>

        <ConfigurationActionBar>
          <Button
            disabled={mutation.isPending || hasError || !form}
            onClick={handleSave}
          >
            {mutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Save email mode
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}
