import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Field, FieldError, FieldLabel } from '#/components/ui/field'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'

import {
  linkDeadlinesQueryOptions,
  useUpdateLinkDeadlinesMutation,
} from '#/hooks/use-configuration-query'

import type { LinkDeadlineSettings } from '#/schemas/configuration.schema'

import { linkDeadlineSettingsSchema } from '#/schemas/configuration.schema'

import { LinkDeadlinesSkeleton } from '../configuration-route-skeleton'
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

const fields = [
  {
    key: 'passwordResetHours',
    label: 'Password reset',
    description: 'Password reset links sent to employees.',
  },
  {
    key: 'newPasswordSetHours',
    label: 'New password set',
    description: 'Link sent to new employees to set their first password.',
  },
  {
    key: 'documentsReviewResubmissionHours',
    label: 'Documents review resubmission',
    description: 'Link sent to merchants to resubmit rejected documents.',
  },
] as const

// ─── Link Deadlines ─────────────────────────────────────────────────────────
export function LinkDeadlinesPanel() {
  const { data, isPending } = useQuery(linkDeadlinesQueryOptions())
  const mutation = useUpdateLinkDeadlinesMutation()
  const [form, setForm] = useState<LinkDeadlineSettings | null>(null)
  const value = form ?? data ?? null
  const validationErrors = value
    ? getValidationErrors(linkDeadlineSettingsSchema.safeParse(value))
    : {}

  if (isPending || !value) {
    return <LinkDeadlinesSkeleton />
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
        {fields.map(({ key, label, description }) => (
          <ConfigurationSection
            key={key}
            title={label}
            description={description}
          >
            <Field
              data-invalid={Boolean(validationErrors[key])}
              className="max-w-xs"
            >
              <FieldLabel htmlFor={key}>Expires after</FieldLabel>
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
          </ConfigurationSection>
        ))}
      </ConfigurationPanel>
      <p className="mt-3 text-xs text-muted-foreground">
        Leave a field blank for links that never expire.
      </p>
    </>
  )
}
