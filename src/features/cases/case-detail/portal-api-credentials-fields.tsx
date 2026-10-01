import { useEffect, useState } from 'react'

import { Copy, Eye, EyeOff, Info, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import * as z from 'zod'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '#/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import type { PortalApiCredentials } from '#/apis/cases'
import {
  useRevealPortalApiCredentials,
  useSavePortalApiCredentials,
} from '#/hooks/use-case-detail-query'
import type { CaseDetail } from '#/schemas/cases.schema'

type PortalApiCredentialsStatus = NonNullable<
  NonNullable<CaseDetail['testing']>['portalApiCredentials']
>

type CredentialField = 'apiKey' | 'apiSecret'

// Revealed values are dropped from memory after this long.
const AUTO_HIDE_MS = 60_000
const MASK = '••••••••••••'

// Mirrors savePortalApiCredentialsSchema on the backend.
function credentialValue(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(512, `${label} is too long.`)
    .regex(/^[\x21-\x7E]+$/, `${label} must not contain spaces.`)
}

const credentialsSchema = z.object({
  apiKey: credentialValue('API Key'),
  apiSecret: credentialValue('API Secret'),
})

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})

// Keeps browsers and password managers from saving or autofilling secrets.
const SECRET_INPUT_PROPS = {
  autoComplete: 'new-password',
  autoCapitalize: 'off',
  autoCorrect: 'off',
  spellCheck: false,
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
} as const

export function PortalApiCredentialsFields({
  caseId,
  idPrefix,
  status,
  canReveal,
  canEdit = false,
}: {
  caseId: string
  idPrefix: string
  status: PortalApiCredentialsStatus | null
  /** Current owner of a working case. */
  canReveal: boolean
  /** MID Creation only: the owner may save or replace the credentials. */
  canEdit?: boolean
}) {
  const reveal = useRevealPortalApiCredentials(caseId)
  const save = useSavePortalApiCredentials(caseId)
  const [revealed, setRevealed] = useState<PortalApiCredentials | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [draft, setDraft] = useState({ apiKey: '', apiSecret: '' })
  const [showDraft, setShowDraft] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<CredentialField, string>>
  >({})
  const isEditing = canEdit && (!status || replacing)

  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(() => setRevealed(null), AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [revealed])

  if (!canReveal) {
    return (
      <p className="text-sm text-muted-foreground">
        API Key and API Secret {status ? 'are saved. ' : 'are not saved yet. '}
        Only the owner of a working case can view them.
      </p>
    )
  }

  function updateDraft(field: CredentialField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  function closeEditor() {
    setDraft({ apiKey: '', apiSecret: '' })
    setShowDraft(false)
    setErrors({})
    setReplacing(false)
  }

  async function handleSave() {
    const result = credentialsSchema.safeParse(draft)
    if (!result.success) {
      const nextErrors: Partial<Record<CredentialField, string>> = {}
      for (const issue of result.error.issues) {
        const path = issue.path[0] as CredentialField | undefined
        if (path && !nextErrors[path]) nextErrors[path] = issue.message
      }
      setErrors(nextErrors)
      return
    }
    await save.mutateAsync(result.data)
    // Drop the submitted values from the mutation cache and the form.
    save.reset()
    setRevealed(null)
    closeEditor()
  }

  async function handleReveal() {
    const result = await reveal.mutateAsync()
    reveal.reset()
    setRevealed(result)
  }

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy to the clipboard')
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <Info />
          <AlertDescription>
            Use the API Key and API Secret from the live environment, not test.
          </AlertDescription>
        </Alert>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ['apiKey', 'API Key'],
              ['apiSecret', 'API Secret'],
            ] as const
          ).map(([field, label]) => (
            <Field key={field} data-invalid={Boolean(errors[field])}>
              <FieldLabel htmlFor={`${idPrefix}-${field}`}>{label}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id={`${idPrefix}-${field}`}
                  type={showDraft ? 'text' : 'password'}
                  className="font-mono"
                  placeholder={`Enter ${label}`}
                  value={draft[field]}
                  disabled={save.isPending}
                  aria-invalid={Boolean(errors[field])}
                  onChange={(event) => updateDraft(field, event.target.value)}
                  {...SECRET_INPUT_PROPS}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={showDraft ? 'Hide values' : 'Show values'}
                    onClick={() => setShowDraft((current) => !current)}
                  >
                    {showDraft ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError>{errors[field]}</FieldError>
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {replacing ? (
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={closeEditor}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => void handleSave()}
          >
            {save.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {save.isPending ? 'Saving' : 'Save API credentials'}
          </Button>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <p className="text-sm text-muted-foreground">
        API Key and API Secret were not saved in MID Creation, or were cleared.
      </p>
    )
  }

  const values: Record<CredentialField, string | null> = {
    apiKey: revealed?.apiKey ?? null,
    apiSecret: revealed?.apiSecret ?? null,
  }
  const masked: Record<CredentialField, string> = {
    apiKey: status.apiKeyLast4 ? `${MASK}${status.apiKeyLast4}` : MASK,
    apiSecret: MASK,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ['apiKey', 'API Key'],
            ['apiSecret', 'API Secret'],
          ] as const
        ).map(([field, label]) => {
          const value = values[field]
          return (
            <Field key={field}>
              <FieldLabel htmlFor={`${idPrefix}-${field}`}>{label}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id={`${idPrefix}-${field}`}
                  readOnly
                  className="font-mono"
                  value={value ?? masked[field]}
                  {...SECRET_INPUT_PROPS}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={`Copy ${label}`}
                    disabled={!value}
                    onClick={() => value && void handleCopy(value, label)}
                  >
                    <Copy />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <FieldDescription className="mr-auto">
          Saved {DATE_TIME_FORMATTER.format(new Date(status.updatedAt))}
          {status.updatedBy ? ` by ${status.updatedBy.name}` : ''}. Every reveal
          is recorded in the case history.
        </FieldDescription>
        {revealed ? (
          <Button variant="outline" onClick={() => setRevealed(null)}>
            <EyeOff data-icon="inline-start" />
            Hide
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={reveal.isPending}
            onClick={() => void handleReveal()}
          >
            {reveal.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Eye data-icon="inline-start" />
            )}
            Reveal
          </Button>
        )}
        {canEdit ? (
          <Button
            variant="outline"
            onClick={() => {
              setRevealed(null)
              setReplacing(true)
            }}
          >
            <RefreshCw data-icon="inline-start" />
            Replace
          </Button>
        ) : null}
      </div>
    </div>
  )
}
