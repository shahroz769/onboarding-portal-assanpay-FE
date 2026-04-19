import { useSuspenseQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  ShieldAlert,
  UserRoundCheck,
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
  }
> = {
  ownership_taken: {
    label: 'Ownership taken',
    icon: UserRoundCheck,
  },
  owner_changed: {
    label: 'Owner updated',
    icon: UserRoundCheck,
  },
  stage_advanced: {
    label: 'Stage advanced',
    icon: CheckCircle2,
  },
  closed_successful: {
    label: 'Closed successfully',
    icon: CheckCircle2,
  },
  closed_unsuccessful: {
    label: 'Closed unsuccessfully',
    icon: ShieldAlert,
  },
  field_reviews_saved: {
    label: 'Review notes saved',
    icon: CircleDashed,
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
        <div className="relative flex flex-col gap-4 pl-6">
          <div className="absolute bottom-0 left-[0.7rem] top-1 w-px bg-border" />
          {history.map((entry) => {
            const meta = ACTION_META[entry.action] ?? {
              label: entry.action,
              icon: Clock3,
            }
            const Icon = meta.icon
            const detailsText = formatDetails(entry.action, entry.details)

            return (
              <div key={entry.id} className="relative rounded-xl border bg-background p-4">
                <div className="absolute left-[-1.55rem] top-5 flex size-6 items-center justify-center rounded-full border bg-background">
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>

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
            )
          })}
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="flex h-full flex-col gap-3 rounded-xl border bg-muted/10 p-3">{content}</div>
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
      <CardContent>
        {content}
      </CardContent>
    </Card>
  )
}

function formatDetails(
  action: string,
  details: Record<string, unknown> | null,
) {
  if (!details) return null

  const parts: string[] = []

  if (
    (action === 'ownership_taken' || action === 'owner_changed') &&
    typeof details.toOwner === 'string'
  ) {
    const fromOwner = formatHistoryParty(details.fromOwner)
    const toOwner = formatHistoryParty(details.toOwner)

    if (fromOwner && toOwner) {
      return `${fromOwner} -> ${toOwner}`
    }
  }

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

  return parts.join(' · ') || null
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
