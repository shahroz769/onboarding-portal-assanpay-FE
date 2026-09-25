import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Checkbox } from '#/components/ui/checkbox'

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '#/components/ui/field'

import {
  emailSendingModeQueryOptions,
  useUpdateEmailSendingModeMutation,
} from '#/hooks/use-configuration-query'

import type { EmailSendingMode } from '#/schemas/configuration.schema'

import { emailSendingModeSchema } from '#/schemas/configuration.schema'

import { EmailSendingSkeleton } from '../configuration-route-skeleton'
import {
  ConfigurationHeaderActions,
  ConfigurationPanel,
  ConfigurationSaveButton,
  ConfigurationSection,
  ConfigurationLoadError,
} from './configuration-panel-shared'

const modes = [
  {
    field: 'autoEnabled',
    id: 'email-mode-auto',
    label: 'Auto (Resend)',
    description: 'Emails are sent automatically through Resend when triggered.',
  },
  {
    field: 'manualEnabled',
    id: 'email-mode-manual',
    label: 'Manual (Gmail)',
    description:
      'Agent receives subject and body to copy-paste and send from Gmail manually.',
  },
] as const

// ─── Email Sending Mode ───────────────────────────────────────────────────────
export function EmailSendingModePanel() {
  const { data, isPending, error, refetch } = useQuery(
    emailSendingModeQueryOptions(),
  )
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
    mutation.mutate(value, { onSuccess: () => setForm(null) })
  }
  if (error && !data) {
    return (
      <ConfigurationLoadError
        title="Email sending mode"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }

  if (isPending || !value) {
    return <EmailSendingSkeleton />
  }
  return (
    <>
      <ConfigurationHeaderActions>
        <ConfigurationSaveButton
          dirty={form !== null}
          isPending={mutation.isPending}
          disabled={hasError}
          onClick={handleSave}
        />
      </ConfigurationHeaderActions>
      <ConfigurationPanel>
        <ConfigurationSection
          title="Sending modes"
          description="Choose how case emails are sent from the portal. At least one mode must stay enabled."
        >
          <div className="flex flex-col gap-3">
            {modes.map((mode) => (
              <Field
                key={mode.field}
                orientation="horizontal"
                className="items-start rounded-lg border p-4 transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-accent/40"
              >
                <Checkbox
                  id={mode.id}
                  className="mt-0.5"
                  checked={value[mode.field]}
                  onCheckedChange={(checked) => {
                    if (typeof checked === 'boolean') {
                      setMode(mode.field, checked)
                    }
                  }}
                />
                <FieldContent>
                  <FieldLabel htmlFor={mode.id} className="cursor-pointer">
                    {mode.label}
                  </FieldLabel>
                  <FieldDescription>{mode.description}</FieldDescription>
                </FieldContent>
              </Field>
            ))}
            <FieldError>{bothDisabledError}</FieldError>
          </div>
        </ConfigurationSection>
      </ConfigurationPanel>
    </>
  )
}
