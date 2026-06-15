import { useSuspenseQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  MailCheck,
  MailWarning,
  RotateCcw,
  Send,
  ShieldAlert,
  Sliders,
  Upload,
  UserRoundCheck,
  Globe,
} from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { caseHistoryQueryOptions } from '#/hooks/use-case-detail-query'

interface CaseHistoryTimelineProps {
  caseId: string
  embedded?: boolean
}

const ACTION_META: Record<
  string,
  {
    label: string
    icon: typeof Clock3
    iconClassName: string
    iconWrapperClassName: string
  }
> = {
  ownership_taken: {
    label: 'Ownership taken',
    icon: UserRoundCheck,
    iconClassName: 'text-blue-700 dark:text-blue-300',
    iconWrapperClassName:
      'border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60',
  },
  owner_changed: {
    label: 'Owner updated',
    icon: UserRoundCheck,
    iconClassName: 'text-sky-700 dark:text-sky-300',
    iconWrapperClassName:
      'border-sky-200 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60',
  },
  owner_assigned: {
    label: 'Owner assigned',
    icon: UserRoundCheck,
    iconClassName: 'text-sky-700 dark:text-sky-300',
    iconWrapperClassName:
      'border-sky-200 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60',
  },
  owner_transferred: {
    label: 'Ownership transferred',
    icon: UserRoundCheck,
    iconClassName: 'text-violet-700 dark:text-violet-300',
    iconWrapperClassName:
      'border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60',
  },
  owner_unassigned: {
    label: 'Returned to AP System',
    icon: RotateCcw,
    iconClassName: 'text-amber-700 dark:text-amber-300',
    iconWrapperClassName:
      'border-amber-200 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60',
  },
  stage_advanced: {
    label: 'Stage advanced',
    icon: CheckCircle2,
    iconClassName: 'text-amber-700 dark:text-amber-300',
    iconWrapperClassName:
      'border-amber-200 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60',
  },
  closed_successful: {
    label: 'Closed successfully',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    iconWrapperClassName:
      'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
  },
  closed_unsuccessful: {
    label: 'Closed unsuccessfully',
    icon: ShieldAlert,
    iconClassName: 'text-red-700 dark:text-red-300',
    iconWrapperClassName:
      'border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-950/60',
  },
  rejections_prepared: {
    label: 'Rejections finalized',
    icon: Send,
    iconClassName: 'text-orange-700 dark:text-orange-300',
    iconWrapperClassName:
      'border-orange-200 bg-orange-100 dark:border-orange-800 dark:bg-orange-950/60',
  },
  resubmission_email_sent: {
    label: 'Resubmission email sent',
    icon: MailCheck,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
  resubmission_email_failed: {
    label: 'Resubmission email failed',
    icon: MailWarning,
    iconClassName: 'text-rose-700 dark:text-rose-300',
    iconWrapperClassName:
      'border-rose-200 bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60',
  },
  client_resubmitted: {
    label: 'Client resubmitted',
    icon: RotateCcw,
    iconClassName: 'text-teal-700 dark:text-teal-300',
    iconWrapperClassName:
      'border-teal-200 bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60',
  },
  field_reviews_saved: {
    label: 'Review notes saved',
    icon: CircleDashed,
    iconClassName: 'text-violet-700 dark:text-violet-300',
    iconWrapperClassName:
      'border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60',
  },
  case_created_from_mid_go_live_email: {
    label: 'Physical Agreement case created',
    icon: FileText,
    iconClassName: 'text-sky-700 dark:text-sky-300',
    iconWrapperClassName:
      'border-sky-200 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60',
  },
  case_created_from_documents_review: {
    label: 'Case created',
    icon: FileText,
    iconClassName: 'text-blue-700 dark:text-blue-300',
    iconWrapperClassName:
      'border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60',
  },
  case_created_manually: {
    label: 'Case created',
    icon: FileText,
    iconClassName: 'text-blue-700 dark:text-blue-300',
    iconWrapperClassName:
      'border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60',
  },
  case_created_from_flow_start: {
    label: 'First case created automatically',
    icon: FileText,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    iconWrapperClassName:
      'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
  },
  case_created_from_flow_close: {
    label: 'Next case created automatically',
    icon: FileText,
    iconClassName: 'text-blue-700 dark:text-blue-300',
    iconWrapperClassName:
      'border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60',
  },
  next_case_created: {
    label: 'Next case created',
    icon: FileText,
    iconClassName: 'text-blue-700 dark:text-blue-300',
    iconWrapperClassName:
      'border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60',
  },
  sub_merchant_selected: {
    label: 'Sub-merchant selected',
    icon: CheckCircle2,
    iconClassName: 'text-sky-700 dark:text-sky-300',
    iconWrapperClassName:
      'border-sky-200 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60',
  },
  document_review_sub_merchant_selected: {
    label: 'Sub-merchant selected',
    icon: CheckCircle2,
    iconClassName: 'text-sky-700 dark:text-sky-300',
    iconWrapperClassName:
      'border-sky-200 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60',
  },
  sub_merchant_inherited: {
    label: 'Sub-merchant inherited',
    icon: CheckCircle2,
    iconClassName: 'text-sky-700 dark:text-sky-300',
    iconWrapperClassName:
      'border-sky-200 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60',
  },
  sub_merchant_final_form_uploaded: {
    label: 'Final Form uploaded',
    icon: FileText,
    iconClassName: 'text-violet-700 dark:text-violet-300',
    iconWrapperClassName:
      'border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60',
  },
  sub_merchant_form_email_sent: {
    label: 'Final Form email sent',
    icon: MailCheck,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
  sub_merchant_manual_email_proof_uploaded: {
    label: 'Manual email proof uploaded',
    icon: MailCheck,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
  sub_merchant_form_email_failed: {
    label: 'Final Form email failed',
    icon: MailWarning,
    iconClassName: 'text-rose-700 dark:text-rose-300',
    iconWrapperClassName:
      'border-rose-200 bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60',
  },
  agreement_final_uploaded: {
    label: 'Final Agreement uploaded',
    icon: Upload,
    iconClassName: 'text-violet-700 dark:text-violet-300',
    iconWrapperClassName:
      'border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60',
  },
  physical_agreement_uploaded: {
    label: 'Physical Agreement uploaded',
    icon: Upload,
    iconClassName: 'text-violet-700 dark:text-violet-300',
    iconWrapperClassName:
      'border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60',
  },
  agreement_email_sent: {
    label: 'Agreement email sent',
    icon: MailCheck,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
  agreement_email_sent_manual: {
    label: 'Agreement email sent',
    icon: MailCheck,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
  agreement_email_failed: {
    label: 'Agreement email failed',
    icon: MailWarning,
    iconClassName: 'text-rose-700 dark:text-rose-300',
    iconWrapperClassName:
      'border-rose-200 bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60',
  },
  agreement_client_submitted: {
    label: 'Client agreement submitted',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    iconWrapperClassName:
      'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
  },
  mid_creation_email_sent: {
    label: 'MID credentials email sent',
    icon: MailCheck,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
  mid_creation_email_sent_manual: {
    label: 'MID credentials email sent',
    icon: MailCheck,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
  mid_creation_email_failed: {
    label: 'MID credentials email failed',
    icon: MailWarning,
    iconClassName: 'text-rose-700 dark:text-rose-300',
    iconWrapperClassName:
      'border-rose-200 bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60',
  },
  mid_go_live_started: {
    label: 'Go-Live started',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    iconWrapperClassName:
      'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
  },
  live_activation_email_sent: {
    label: 'Live email sent',
    icon: MailCheck,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    iconWrapperClassName:
      'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
  },
  live_activation_email_sent_manual: {
    label: 'Live email sent',
    icon: MailCheck,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    iconWrapperClassName:
      'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
  },
  live_activation_email_failed: {
    label: 'Live email failed',
    icon: MailWarning,
    iconClassName: 'text-rose-700 dark:text-rose-300',
    iconWrapperClassName:
      'border-rose-200 bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60',
  },
  case_created_from_mid_go_live: {
    label: 'Live case created',
    icon: FileText,
    iconClassName: 'text-blue-700 dark:text-blue-300',
    iconWrapperClassName:
      'border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60',
  },
  testing_limits_applied: {
    label: 'Testing limits applied',
    icon: Sliders,
    iconClassName: 'text-indigo-700 dark:text-indigo-300',
    iconWrapperClassName:
      'border-indigo-200 bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60',
  },
  mid_creation_saved: {
    label: 'MID creation saved',
    icon: Sliders,
    iconClassName: 'text-indigo-700 dark:text-indigo-300',
    iconWrapperClassName:
      'border-indigo-200 bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60',
  },
  live_limits_applied: {
    label: 'Live limits applied',
    icon: Sliders,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    iconWrapperClassName:
      'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
  },
  wordpress_website_saved: {
    label: 'WordPress website saved',
    icon: Globe,
    iconClassName: 'text-cyan-700 dark:text-cyan-300',
    iconWrapperClassName:
      'border-cyan-200 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60',
  },
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const HISTORY_SYSTEM_LABEL = 'FP System'

export function CaseHistoryTimeline({
  caseId,
  embedded = false,
}: CaseHistoryTimelineProps) {
  const { data: history } = useSuspenseQuery(caseHistoryQueryOptions(caseId))
  const content = (
    <>
      {embedded ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Case history</h3>
          <p className="text-sm text-muted-foreground">
            Ownership changes, review activity, and key stage transitions stay
            visible here.
          </p>
        </div>
      ) : null}
      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No history has been recorded for this case yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {history.map((entry, index) => {
            const meta = ACTION_META[entry.action] ?? {
              label: formatActionLabel(entry.action),
              icon: Clock3,
              iconClassName: 'text-muted-foreground',
              iconWrapperClassName: 'border-border bg-background',
            }
            const Icon = meta.icon
            const detailsText = formatDetails(entry.action, entry.details)

            return (
              <div key={entry.id} className="relative pl-8">
                {index > 0 ? (
                  <div className="absolute left-3.5 top-0 h-[calc(50%-0.875rem)] w-px -translate-x-1/2 bg-border" />
                ) : null}
                {index < history.length - 1 ? (
                  <div className="absolute -bottom-4 left-3.5 top-[calc(50%+0.875rem)] w-px -translate-x-1/2 bg-border" />
                ) : null}

                <div
                  className={`absolute left-3.5 top-1/2 z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border ${meta.iconWrapperClassName}`}
                >
                  <Icon className={`size-4 ${meta.iconClassName}`} />
                </div>

                <div className="relative rounded-xl border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-col gap-2">
                        <p className="truncate text-sm font-semibold tracking-tight">
                          {entry.actorName ?? 'System'}
                        </p>
                        {detailsText ? (
                          <p className="wrap-break-word whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {detailsText}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant="secondary">{meta.label}</Badge>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  if (embedded) {
    return (
      <div className="flex h-full flex-col gap-3 rounded-xl border bg-muted/10 p-3">
        {content}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>
          A complete audit trail of ownership, review, and stage movement for
          this case.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

function formatDetails(
  action: string,
  details: Record<string, unknown> | null,
) {
  if (!details) return null

  if (
    [
      'ownership_taken',
      'owner_changed',
      'owner_assigned',
      'owner_transferred',
      'owner_unassigned',
    ].includes(action) &&
    typeof details.toOwner === 'string'
  ) {
    const fromOwner = formatHistoryParty(details.fromOwner)
    const toOwner = formatHistoryParty(details.toOwner)

    if (fromOwner && toOwner) {
      return `${fromOwner} -> ${toOwner}`
    }
  }

  if (action === 'rejections_prepared') {
    const total = typeof details.total === 'number' ? details.total : null
    const labels = Array.isArray(details.rejectedFieldLabels)
      ? details.rejectedFieldLabels.filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        )
      : []

    if (total && labels.length > 0) {
      return `${total} rejected item${total === 1 ? '' : 's'} finalized: ${labels.join(', ')}`
    }

    if (total) {
      return `${total} rejected item${total === 1 ? '' : 's'} finalized`
    }
  }

  const parts: string[] = []

  if (details.fromStage && details.toStage) {
    parts.push(`${details.fromStage} -> ${details.toStage}`)
  }

  if (details.fromOwner && details.toOwner) {
    parts.push(`${details.fromOwner} -> ${details.toOwner}`)
  }

  if (details.reason) {
    parts.push(`Reason: ${details.reason}`)
  }

  if (details.total !== undefined) {
    parts.push(
      `${details.total} items reviewed (${details.approved} accepted, ${details.rejected} rejected)`,
    )
  }

  if (
    action === 'resubmission_email_sent' &&
    typeof details.recipient === 'string'
  ) {
    const rejectedFields = Array.isArray(details.rejectedFields)
      ? details.rejectedFields.length
      : null
    parts.push(
      rejectedFields && rejectedFields > 0
        ? `Sent to ${details.recipient} for ${rejectedFields} rejected item${rejectedFields === 1 ? '' : 's'}`
        : `Sent to ${details.recipient}`,
    )
  }

  if (
    action === 'resubmission_email_failed' &&
    typeof details.error === 'string'
  ) {
    parts.push(`Delivery failed: ${details.error}`)
  }

  if (action === 'client_resubmitted') {
    const labels = Array.isArray(details.fieldsUpdatedLabels)
      ? details.fieldsUpdatedLabels.filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        )
      : []
    const total = Array.isArray(details.fieldsUpdated)
      ? details.fieldsUpdated.length
      : labels.length

    if (total > 0 && labels.length > 0) {
      parts.push(
        `${total} item${total === 1 ? '' : 's'} resubmitted: ${labels.join(', ')}`,
      )
    } else if (total > 0) {
      parts.push(`${total} item${total === 1 ? '' : 's'} resubmitted`)
    } else {
      parts.push('Client submitted the requested updates')
    }
  }

  if (
    action === 'sub_merchant_selected' &&
    typeof details.subMerchantName === 'string'
  ) {
    parts.push(`Selected ${details.subMerchantName}`)
  }

  if (
    action === 'sub_merchant_final_form_uploaded' &&
    typeof details.fileName === 'string'
  ) {
    parts.push(`Uploaded ${details.fileName}`)
  }

  if (
    action === 'sub_merchant_form_email_sent' &&
    typeof details.recipient === 'string'
  ) {
    parts.push(`Sent to ${details.recipient}`)
  }

  if (
    action === 'sub_merchant_manual_email_proof_uploaded' &&
    typeof details.fileName === 'string'
  ) {
    parts.push(`Uploaded ${details.fileName}`)
  }

  if (
    action === 'sub_merchant_form_email_failed' &&
    typeof details.error === 'string'
  ) {
    parts.push(`Delivery failed: ${details.error}`)
  }

  if (
    action === 'agreement_final_uploaded' &&
    typeof details.fileName === 'string'
  ) {
    parts.push(`Uploaded ${details.fileName}`)
  }

  if (
    action === 'agreement_email_sent' &&
    typeof details.recipient === 'string'
  ) {
    parts.push(`Sent to ${details.recipient}`)
  }

  if (
    action === 'agreement_email_failed' &&
    typeof details.error === 'string'
  ) {
    parts.push(`Delivery failed: ${details.error}`)
  }

  if (
    action === 'agreement_client_submitted' &&
    typeof details.fileName === 'string'
  ) {
    parts.push(`Submitted ${details.fileName}`)
  }

  if (
    action === 'mid_creation_email_sent' &&
    typeof details.recipient === 'string'
  ) {
    parts.push(`Sent to ${details.recipient}`)
    if (typeof details.availableAt === 'string') {
      parts.push(`Go-Live unlocks ${formatDateTime(details.availableAt)}`)
    }
  }

  if (
    action === 'mid_creation_email_failed' &&
    typeof details.error === 'string'
  ) {
    parts.push(`Delivery failed: ${details.error}`)
  }

  if (
    action === 'mid_go_live_started' &&
    typeof details.liveCaseNumber === 'string'
  ) {
    parts.push(`Live case ${details.liveCaseNumber}`)
  }

  if (
    action === 'case_created_from_mid_go_live' &&
    typeof details.midCaseNumber === 'string'
  ) {
    parts.push(`Started from ${details.midCaseNumber}`)
  }

  if (
    action === 'case_created_from_flow_start' &&
    typeof details.targetQueueName === 'string'
  ) {
    parts.push('Created automatically after onboarding form submission')
  }

  if (action === 'case_created_from_flow_close') {
    const sourceCaseNumber =
      typeof details.sourceCaseNumber === 'string'
        ? details.sourceCaseNumber
        : null
    const sourceQueueName =
      typeof details.sourceQueueName === 'string'
        ? details.sourceQueueName
        : null

    if (sourceCaseNumber && sourceQueueName) {
      parts.push(
        `Created automatically after ${sourceCaseNumber} (${sourceQueueName}) closed`,
      )
    } else if (sourceCaseNumber) {
      parts.push(`Created automatically after ${sourceCaseNumber} closed`)
    } else if (sourceQueueName) {
      parts.push(`Created automatically after ${sourceQueueName} closed`)
    } else {
      parts.push('Created automatically after a configured case closed')
    }
  }

  if (action === 'case_created_from_mid_go_live_email') {
    const sourceCaseNumber =
      typeof details.sourceCaseNumber === 'string'
        ? details.sourceCaseNumber
        : null
    const sourceQueueName =
      typeof details.sourceQueueName === 'string'
        ? details.sourceQueueName
        : null

    if (sourceCaseNumber && sourceQueueName) {
      parts.push(
        `Created after ${sourceCaseNumber} (${sourceQueueName}) sent MID credentials`,
      )
    } else if (sourceCaseNumber) {
      parts.push(`Created after ${sourceCaseNumber} sent MID credentials`)
    }
  }

  if (
    action === 'next_case_created' &&
    typeof details.nextCaseNumber === 'string'
  ) {
    parts.push(`Created ${details.nextCaseNumber}`)
  }

  if (
    action === 'wordpress_website_saved' &&
    typeof details.clonedWebsiteLink === 'string'
  ) {
    parts.push(`Cloned link: ${details.clonedWebsiteLink}`)
    if (typeof details.screenshots === 'number') {
      parts.push(
        `${details.screenshots} screenshot${details.screenshots === 1 ? '' : 's'}`,
      )
    }
  }

  if (
    action === 'case_created_from_documents_review' &&
    typeof details.sourceCaseNumber === 'string'
  ) {
    parts.push(`Created after ${details.sourceCaseNumber}`)
  }

  if (
    action === 'case_created_manually' &&
    typeof details.queueName === 'string'
  ) {
    parts.push(`Created in ${details.queueName}`)
  }

  return parts.join(' · ') || null
}

function formatActionLabel(action: string) {
  return action
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatHistoryParty(value: unknown) {
  if (typeof value !== 'string') return null

  const normalizedValue = value.trim()

  if (!normalizedValue) return null

  if (normalizedValue === 'Unassigned') {
    return HISTORY_SYSTEM_LABEL
  }

  return normalizedValue
}
