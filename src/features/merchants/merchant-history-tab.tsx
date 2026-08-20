import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  CheckCircle2,
  CircleDot,
  FilePlus2,
  FileSignature,
  Flag,
  History,
  XCircle,
} from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Badge } from '#/components/ui/badge'
import { EmptyState } from '#/components/empty-state'
import { SectionIcon } from '#/components/section-icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { cn } from '#/lib/utils'
import type { StatusTint } from '#/lib/status-styles'
import type {
  MerchantCase,
  MerchantDetailResponse,
  MerchantTimelineEvent,
} from '#/schemas/merchants.schema'
import {
  caseStatusBadgeClasses,
  humanize,
  isCaseOpen,
} from './merchant-detail-helpers'

type MerchantHistoryTabProps = {
  detail: MerchantDetailResponse
}
type HistoryTone = 'amber' | 'sky' | 'emerald' | 'violet' | 'red' | 'muted'
type HistoryItem = {
  id: string
  at: number
  date: string
  title: string
  description?: string
  actorName?: string | null
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: HistoryTone
  badge?: {
    label: string
    className?: string
  }
}
type CaseHistoryGroup = {
  caseRow: MerchantCase
  items: HistoryItem[]
}
const ACTION_LABELS: Record<string, string> = {
  case_created_manually: 'Case created manually',
  case_created_from_flow_start: 'First case created automatically',
  case_created_from_flow_close: 'Next case created automatically',
  case_created_from_mid_go_live: 'Live case created',
  testing_limits_applied: 'Testing limits applied',
  live_limits_applied: 'Live limits applied',
  wordpress_website_saved: 'WordPress website saved',
  mid_creation_saved: 'MID creation saved',
  resubmission_email_sent: 'Resubmission email sent',
  resubmission_email_sent_manual: 'Resubmission email sent',
  resubmission_email_failed: 'Resubmission email failed',
  client_resubmitted: 'Merchant resubmitted',
  rejections_prepared: 'Rejections prepared',
  field_reviews_saved: 'Field reviews saved',
  owner_changed: 'Owner changed',
  owner_assigned: 'Owner assigned',
  owner_transferred: 'Ownership transferred',
  owner_unassigned: 'Returned to AP System',
  ownership_taken: 'Ownership taken',
  agreement_received_uploaded: 'Received Agreement uploaded',
  agreement_email_sent: 'Agreement email sent',
  agreement_email_sent_manual: 'Agreement email sent',
  agreement_email_failed: 'Agreement email failed',
  agreement_final_uploaded: 'Agreement final uploaded',
  mid_creation_email_sent: 'MID creation email sent',
  mid_creation_email_sent_manual: 'MID creation email sent',
  mid_creation_email_failed: 'MID creation email failed',
  live_activation_email_sent: 'Live email sent',
  live_activation_email_sent_manual: 'Live email sent',
  live_activation_email_failed: 'Live email failed',
  mid_go_live_started: 'MID go-live started',
  sub_merchant_selected: 'Sub-merchant selected',
  document_review_sub_merchant_selected: 'Sub-merchant selected',
  sub_merchant_final_form_uploaded: 'Final form uploaded',
  sub_merchant_manual_email_proof_uploaded: 'Email proof uploaded',
  sub_merchant_inherited: 'Sub-merchant inherited',
  closed_unsuccessful: 'Closed — unsuccessful',
  closed_successful: 'Closed — successful',
}
function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? humanize(action)
}
function actionTone(action: string): HistoryTone {
  if (action.includes('failed') || action.includes('unsuccessful')) return 'red'
  if (action.includes('live')) return 'emerald'
  if (action.includes('testing')) return 'sky'
  if (action.includes('rejection')) return 'red'
  if (action.includes('closed')) return 'emerald'
  if (action.includes('resubmission')) return 'amber'
  return 'violet'
}
const toneClasses: Record<HistoryTone, string> = {
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  violet:
    'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  muted: 'bg-muted text-muted-foreground',
}
export function MerchantHistoryTab({ detail }: MerchantHistoryTabProps) {
  const { merchant, cases, timeline, milestones } = detail
  const openCases = cases.filter((caseRow) =>
    isCaseOpen(caseRow.status, caseRow.stageCategory),
  )
  const workingCases = cases.filter((caseRow) => caseRow.status === 'working')
  const closedCases = cases.filter(
    (caseRow) => !isCaseOpen(caseRow.status, caseRow.stageCategory),
  )
  const milestoneItems = (() => {
    const collected: HistoryItem[] = []
    if (milestones.formFilledAt) {
      collected.push({
        id: 'form-submitted',
        at: new Date(milestones.formFilledAt).getTime(),
        date: milestones.formFilledAt,
        title: 'Onboarding form submitted',
        description: `Submitted by ${merchant.submitterEmail}`,
        icon: FileSignature,
        tone: 'amber',
      })
    }
    if (milestones.liveAt) {
      collected.push({
        id: 'went-live',
        at: new Date(milestones.liveAt).getTime(),
        date: milestones.liveAt,
        title: 'Merchant went live',
        icon: Flag,
        tone: 'emerald',
      })
    }
    return collected.sort((a, b) => a.at - b.at)
  })()
  const caseGroups = (() => {
    const eventsByCase = new Map<string, MerchantTimelineEvent[]>()
    for (const event of timeline) {
      const current = eventsByCase.get(event.caseId) ?? []
      current.push(event)
      eventsByCase.set(event.caseId, current)
    }
    return cases
      .map((caseRow) => {
        const items: HistoryItem[] = [
          {
            id: `case-open-${caseRow.id}`,
            at: new Date(caseRow.createdAt).getTime(),
            date: caseRow.createdAt,
            title: 'Case created',
            description: caseRow.queueName,
            icon: FilePlus2,
            tone: 'sky',
          },
        ]
        for (const event of eventsByCase.get(caseRow.id) ?? []) {
          if (isDuplicateCaseBoundaryAction(event.action)) continue
          items.push({
            id: `event-${event.id}`,
            at: new Date(event.createdAt).getTime(),
            date: event.createdAt,
            title: actionLabel(event.action),
            actorName: event.actorName,
            icon: CircleDot,
            tone: actionTone(event.action),
            badge: statusBadgeForAction(event.action),
          })
        }
        if (caseRow.closedAt) {
          const unsuccessful = caseRow.closeOutcome === 'unsuccessful'
          items.push({
            id: `case-close-${caseRow.id}`,
            at: new Date(caseRow.closedAt).getTime(),
            date: caseRow.closedAt,
            title: 'Case closed',
            description: caseRow.closeReason ?? undefined,
            icon: unsuccessful ? XCircle : CheckCircle2,
            tone: unsuccessful ? 'red' : 'emerald',
            badge: caseRow.closeOutcome
              ? {
                  label: humanize(caseRow.closeOutcome),
                }
              : undefined,
          })
        }
        return {
          caseRow,
          items: items.sort((a, b) => a.at - b.at),
        }
      })
      .sort((a, b) => {
        const firstItemA = a.items[0]
        const firstItemB = b.items[0]
        return firstItemA.at - firstItemB.at
      })
  })()
  if (milestoneItems.length === 0 && caseGroups.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={History}
            title="No history recorded for this merchant yet."
            className="py-14"
          />
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {milestoneItems.length > 0 ? (
        <HistorySection
          icon={FileSignature}
          tone="amber"
          title="Merchant milestones"
          description="Merchant-level lifecycle events."
        >
          <HistoryRows items={milestoneItems} />
        </HistorySection>
      ) : null}

      {caseGroups.length > 0 ? (
        <HistorySection
          icon={History}
          tone="blue"
          title="Cases"
          description="Each case groups its creation, status changes, client actions, and closing activity."
        >
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <CaseStatusSummary
                label="Open cases"
                value={openCases.length}
                tone="sky"
              />
              <CaseStatusSummary
                label="Working"
                value={workingCases.length}
                tone="amber"
              />
              <CaseStatusSummary
                label="Closed"
                value={closedCases.length}
                tone="emerald"
              />
            </div>
            {caseGroups.map((group) => (
              <CaseHistoryPanel key={group.caseRow.id} group={group} />
            ))}
          </div>
        </HistorySection>
      ) : null}
    </div>
  )
}
function CaseStatusSummary({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: HistoryTone
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn('size-2 rounded-full', toneDotClasses[tone])} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
function HistorySection({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <SectionIcon icon={icon} tone={tone} />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
function CaseHistoryPanel({ group }: { group: CaseHistoryGroup }) {
  const { caseRow, items } = group
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-none">
            {caseRow.queueName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              to="/cases/$caseId"
              params={{
                caseId: caseRow.id,
              }}
              className="font-mono text-sm font-medium tabular-nums text-primary no-underline hover:underline hover:decoration-dashed hover:underline-offset-4"
            >
              {caseRow.caseNumber}
            </Link>
            <Badge
              variant="secondary"
              className={caseStatusBadgeClasses(caseRow.status)}
            >
              {humanize(caseRow.status)}
            </Badge>
          </div>
          {caseRow.stageName ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {caseRow.stageName}
            </p>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(caseRow.createdAt), 'dd MMM yyyy')}
        </span>
      </div>

      <div className="mt-4">
        <HistoryRows items={items} compact />
      </div>
    </div>
  )
}
function HistoryRows({
  items,
  compact = false,
}: {
  items: HistoryItem[]
  compact?: boolean
}) {
  return (
    <ol className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <span
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
              toneClasses[item.tone],
            )}
          >
            <item.icon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{item.title}</span>
              {item.badge ? (
                <Badge variant="secondary" className={item.badge.className}>
                  {item.badge.label}
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground tabular-nums">
                {format(new Date(item.date), 'dd MMM yyyy, hh:mm a')}
              </span>
            </div>
            {item.description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            {item.actorName ? (
              <p className="mt-1 text-xs text-muted-foreground">
                by {item.actorName}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
const toneDotClasses: Record<HistoryTone, string> = {
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  red: 'bg-red-500',
  muted: 'bg-muted-foreground',
}
function isDuplicateCaseBoundaryAction(action: string) {
  return (
    action.startsWith('case_created') ||
    action === 'closed_successful' ||
    action === 'closed_unsuccessful'
  )
}
function statusBadgeForAction(action: string) {
  if (action === 'client_resubmitted') {
    return {
      label: 'Working',
      className: caseStatusBadgeClasses('working'),
    }
  }
  if (
    action === 'resubmission_email_sent' ||
    action === 'resubmission_email_sent_manual'
  ) {
    return {
      label: 'Awaiting client',
      className: caseStatusBadgeClasses('awaiting_client'),
    }
  }
  if (action === 'rejections_prepared') {
    return {
      label: 'Pending review',
      className: caseStatusBadgeClasses('pending'),
    }
  }
  return undefined
}
