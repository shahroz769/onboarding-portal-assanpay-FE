import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { LinkIcon } from 'lucide-react'

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

import { Spinner } from '#/components/ui/spinner'

import {
  configurationQueryOptions,
  useUpdateLinkDeadlinesMutation,
} from '#/hooks/use-configuration-query'

import type { LinkDeadlineSettings } from '#/schemas/configuration.schema'

import { linkDeadlineSettingsSchema } from '#/schemas/configuration.schema'

import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  PanelLoading,
} from './configuration-panel-shared'
import {
  getValidationErrors,
  hasValidationErrors,
} from './configuration-panel-utils'

// ─── Link Deadlines ─────────────────────────────────────────────────────────
export function LinkDeadlinesPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdateLinkDeadlinesMutation()
  const [form, setForm] = useState<LinkDeadlineSettings | null>(null)
  const value = form ?? data?.linkDeadlines ?? null
  const validationErrors = value
    ? getValidationErrors(linkDeadlineSettingsSchema.safeParse(value))
    : {}
  const fields = [
    ['passwordResetHours', 'Password reset'],
    ['newPasswordSetHours', 'New password set'],
    ['agreementLinkHours', 'Agreement link'],
    ['documentsReviewResubmissionHours', 'Documents review resubmission'],
    ['goLiveAvailabilityHours', 'Go Live availability'],
  ] as const

  if (isPending || !value) {
    return <PanelLoading />
  }
  return (
    <ConfigurationSectionCard
      icon={LinkIcon}
      colorClass="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      title="Link Deadlines"
      description="Configure expiry and availability windows for secure links. Leave a field blank for no expiry."
    >
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fields.map(([key, label]) => (
            <Field key={key} data-invalid={Boolean(validationErrors[key])}>
              <FieldLabel htmlFor={key}>{label}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id={key}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="No expiry"
                  value={value[key] ?? ''}
                  aria-invalid={Boolean(validationErrors[key])}
                  className="text-right tabular-nums"
                  onChange={(event) => {
                    const raw = event.target.value
                    setForm((current) => ({
                      ...(current ?? value),
                      [key]: raw === '' ? null : Number(raw),
                    }))
                  }}
                />
                <InputGroupAddon align="inline-end">hours</InputGroupAddon>
              </InputGroup>
              <FieldError>{validationErrors[key]}</FieldError>
            </Field>
          ))}
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
              <LinkIcon data-icon="inline-start" />
            )}
            Save deadlines
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}
