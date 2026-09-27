import { useState } from 'react'
import type { ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import {
  Building2Icon,
  ClipboardCopyIcon,
  SendIcon,
  UserRoundIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { EmailChipsInput } from '#/components/email-chips-input'
import { Badge } from '#/components/ui/badge'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '#/components/ui/field'
import { Switch } from '#/components/ui/switch'
import { cn } from '#/lib/utils'

import {
  emailRecipientsQueryOptions,
  emailSendingModeQueryOptions,
  useUpdateEmailRecipientsMutation,
  useUpdateEmailSendingModeMutation,
} from '#/hooks/use-configuration-query'

import type {
  EmailRecipientSettings,
  EmailSendingMode,
} from '#/schemas/configuration.schema'

import {
  emailRecipientSettingsInputSchema,
  emailSendingModeSchema,
} from '#/schemas/configuration.schema'

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
    label: 'Auto',
    provider: 'Resend',
    icon: SendIcon,
    description: 'Emails go out automatically through Resend when triggered.',
  },
  {
    field: 'manualEnabled',
    id: 'email-mode-manual',
    label: 'Manual',
    provider: 'Gmail',
    icon: ClipboardCopyIcon,
    description:
      'Agents get the subject and body to copy into Gmail and send themselves.',
  },
] as const

const recipientToggles = [
  {
    field: 'ccSender',
    id: 'email-cc-sender',
    label: 'CC the sender',
    icon: UserRoundIcon,
    description: 'The portal user who sends the email gets a copy.',
  },
  {
    field: 'ccOtherMerchantEmail',
    id: 'email-cc-other-merchant',
    label: "CC the merchant's other email",
    icon: Building2Icon,
    description:
      'Sending to the business email copies the submitter email, and the other way round.',
  },
] as const

const recipientLists = [
  {
    field: 'cc',
    id: 'email-cc',
    label: 'CC',
    max: 20,
    description: 'Copied on every case email, e.g. an operations inbox.',
  },
  {
    field: 'bcc',
    id: 'email-bcc',
    label: 'BCC',
    max: 20,
    description: 'Hidden copies merchants never see, e.g. an archive inbox.',
  },
  {
    field: 'replyTo',
    id: 'email-reply-to',
    label: 'Reply-to',
    max: 5,
    description:
      "Where merchant replies go. Leave empty to use the server's default.",
  },
] as const

type RecipientListField = (typeof recipientLists)[number]['field']

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
      <Icon className="size-4" />
    </span>
  )
}

/** A whole-card toggle: clicking anywhere on the card flips the switch. */
function SwitchCard({
  id,
  icon,
  title,
  badge,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  icon: LucideIcon
  title: string
  badge?: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <FieldLabel
      htmlFor={id}
      className={cn(
        // Keep the card's border and background the same when switched on;
        // the switch alone shows the state.
        'cursor-pointer transition-colors hover:bg-accent/40 has-data-checked:border-border has-data-checked:bg-transparent has-data-checked:hover:bg-accent/40 dark:has-data-checked:bg-transparent dark:has-data-checked:hover:bg-accent/40',
        disabled && 'cursor-not-allowed',
      )}
    >
      {/* A locked card stays full-strength: it's on, only the switch is
          locked (the dimmed switch shows that). */}
      <Field orientation="horizontal">
        <IconTile icon={icon} />
        <FieldContent>
          <FieldTitle>
            {title}
            {badge ? (
              <Badge variant="outline" className="font-normal">
                {badge}
              </Badge>
            ) : null}
          </FieldTitle>
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </Field>
    </FieldLabel>
  )
}

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-3 px-4 py-2.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap gap-1.5">{children}</dd>
    </div>
  )
}

function PreviewAddress({ children }: { children: ReactNode }) {
  return (
    <Badge variant="secondary" className="max-w-full font-normal">
      <span className="truncate">{children}</span>
    </Badge>
  )
}

function PreviewPlaceholder({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="border-dashed font-normal">
      {children}
    </Badge>
  )
}

function PreviewEmpty({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>
}

/** How a case email sent through Resend is addressed with these settings. */
function AddressingPreview({
  recipients,
}: {
  recipients: EmailRecipientSettings
}) {
  const hasCc =
    recipients.ccSender ||
    recipients.ccOtherMerchantEmail ||
    recipients.cc.length > 0
  return (
    <dl className="divide-y rounded-lg border bg-muted/30">
      <PreviewRow label="To">
        <PreviewPlaceholder>Merchant email</PreviewPlaceholder>
      </PreviewRow>
      <PreviewRow label="CC">
        {recipients.ccSender ? (
          <PreviewPlaceholder>Sender</PreviewPlaceholder>
        ) : null}
        {recipients.ccOtherMerchantEmail ? (
          <PreviewPlaceholder>Merchant's other email</PreviewPlaceholder>
        ) : null}
        {recipients.cc.map((email) => (
          <PreviewAddress key={email}>{email}</PreviewAddress>
        ))}
        {!hasCc ? <PreviewEmpty>No one</PreviewEmpty> : null}
      </PreviewRow>
      <PreviewRow label="BCC">
        {recipients.bcc.length > 0 ? (
          recipients.bcc.map((email) => (
            <PreviewAddress key={email}>{email}</PreviewAddress>
          ))
        ) : (
          <PreviewEmpty>No one</PreviewEmpty>
        )}
      </PreviewRow>
      <PreviewRow label="Reply-to">
        {recipients.replyTo.length > 0 ? (
          recipients.replyTo.map((email) => (
            <PreviewAddress key={email}>{email}</PreviewAddress>
          ))
        ) : (
          <PreviewEmpty>Server default</PreviewEmpty>
        )}
      </PreviewRow>
    </dl>
  )
}

// ─── Email Sending ────────────────────────────────────────────────────────────
export function EmailSendingModePanel() {
  const modeQuery = useQuery(emailSendingModeQueryOptions())
  const recipientsQuery = useQuery(emailRecipientsQueryOptions())
  const modeMutation = useUpdateEmailSendingModeMutation()
  const recipientsMutation = useUpdateEmailRecipientsMutation()
  const [modeForm, setModeForm] = useState<EmailSendingMode | null>(null)
  const [recipientsForm, setRecipientsForm] =
    useState<EmailRecipientSettings | null>(null)

  const mode = modeForm ?? modeQuery.data ?? null
  const recipients = recipientsForm ?? recipientsQuery.data ?? null

  const modeValid = mode
    ? emailSendingModeSchema.safeParse(mode).success
    : false
  const enabledModeCount = mode
    ? Number(mode.autoEnabled) + Number(mode.manualEnabled)
    : 0
  const recipientsResult = recipients
    ? emailRecipientSettingsInputSchema.safeParse(recipients)
    : null
  const recipientErrors: Partial<Record<RecipientListField, string>> = {}
  if (recipientsResult && !recipientsResult.success) {
    for (const issue of recipientsResult.error.issues) {
      const field = issue.path[0] as RecipientListField
      recipientErrors[field] ??= issue.message
    }
  }

  const dirty = modeForm !== null || recipientsForm !== null
  const isSaving = modeMutation.isPending || recipientsMutation.isPending
  const hasError =
    (modeForm !== null && !modeValid) ||
    (recipientsForm !== null && !recipientsResult?.success)

  function setMode(field: keyof EmailSendingMode, checked: boolean) {
    setModeForm((prev) => {
      const current = prev ?? modeQuery.data
      return current ? { ...current, [field]: checked } : prev
    })
  }

  function updateRecipients(patch: Partial<EmailRecipientSettings>) {
    setRecipientsForm((prev) => {
      const current = prev ?? recipientsQuery.data
      return current ? { ...current, ...patch } : prev
    })
  }

  function handleSave() {
    if (hasError) return
    if (modeForm && mode) {
      modeMutation.mutate(mode, { onSuccess: () => setModeForm(null) })
    }
    if (recipientsForm && recipientsResult?.success) {
      recipientsMutation.mutate(recipientsResult.data, {
        onSuccess: () => setRecipientsForm(null),
      })
    }
  }

  const loadError = modeQuery.error ?? recipientsQuery.error
  if (loadError && (!modeQuery.data || !recipientsQuery.data)) {
    return (
      <ConfigurationLoadError
        title="Email sending settings"
        error={loadError}
        onRetry={() => {
          void modeQuery.refetch()
          void recipientsQuery.refetch()
        }}
      />
    )
  }

  if (!mode || !recipients) {
    return <EmailSendingSkeleton />
  }

  return (
    <>
      <ConfigurationHeaderActions>
        <ConfigurationSaveButton
          dirty={dirty}
          isPending={isSaving}
          disabled={hasError}
          onClick={handleSave}
        />
      </ConfigurationHeaderActions>
      <ConfigurationPanel>
        <ConfigurationSection
          title="Sending modes"
          description="How agents can send case emails from the portal. At least one mode stays on."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {modes.map((option) => {
              const checked = mode[option.field]
              return (
                <SwitchCard
                  key={option.field}
                  id={option.id}
                  icon={option.icon}
                  title={option.label}
                  badge={option.provider}
                  description={option.description}
                  checked={checked}
                  // The last mode left on can't be switched off.
                  disabled={checked && enabledModeCount === 1}
                  onCheckedChange={(next) => setMode(option.field, next)}
                />
              )
            })}
          </div>
        </ConfigurationSection>

        <ConfigurationSection
          title="Automatic copies"
          description="People copied on every case email, worked out per email."
        >
          <div className="flex flex-col gap-3">
            {recipientToggles.map((option) => (
              <SwitchCard
                key={option.field}
                id={option.id}
                icon={option.icon}
                title={option.label}
                description={option.description}
                checked={recipients[option.field]}
                onCheckedChange={(next) =>
                  updateRecipients({ [option.field]: next })
                }
              />
            ))}
          </div>
        </ConfigurationSection>

        <ConfigurationSection
          title="Fixed recipients"
          description="Addresses added to every case email sent through Resend. Manual (Gmail) previews list the same addresses. Press Enter or comma after each address, or paste a list."
        >
          <FieldGroup>
            {recipientLists.map((list) => {
              const count = recipients[list.field].length
              const error = recipientErrors[list.field]
              return (
                <Field key={list.field} data-invalid={Boolean(error)}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor={list.id}>{list.label}</FieldLabel>
                    <span
                      className={cn(
                        'text-xs text-muted-foreground tabular-nums',
                        count >= list.max && 'text-foreground',
                      )}
                    >
                      {count} / {list.max}
                    </span>
                  </div>
                  <EmailChipsInput
                    id={list.id}
                    value={recipients[list.field]}
                    max={list.max}
                    invalid={Boolean(error)}
                    aria-describedby={`${list.id}-description`}
                    onChange={(emails) =>
                      updateRecipients({ [list.field]: emails })
                    }
                  />
                  <FieldDescription id={`${list.id}-description`}>
                    {list.description}
                  </FieldDescription>
                  <FieldError>{error}</FieldError>
                </Field>
              )
            })}
          </FieldGroup>
        </ConfigurationSection>

        <ConfigurationSection
          title="Preview"
          description="How a case email is addressed with the settings above, including unsaved changes."
        >
          <AddressingPreview recipients={recipients} />
        </ConfigurationSection>
      </ConfigurationPanel>
    </>
  )
}
