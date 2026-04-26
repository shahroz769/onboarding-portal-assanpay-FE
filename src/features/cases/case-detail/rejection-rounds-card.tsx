import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ExternalLink,
  Inbox,
  MailCheck,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { Separator } from '#/components/ui/separator'
import { caseHistoryQueryOptions } from '#/hooks/use-case-detail-query'
import type { CaseHistory } from '#/schemas/cases.schema'

interface RejectionRoundsCardProps {
  caseId: string
}

type Round = {
  index: number
  sentEntry: CaseHistory
  resubmittedEntry: CaseHistory | null
  rejectedFields: Array<string>
  fieldsUpdated: Array<string>
  fieldDetails: Array<{
    fieldName: string
    label: string
    type?: 'text' | 'document'
    action?: 'replace' | 'remove'
    previousFileName?: string | null
    previousFileUrl?: string | null
    nextFileName?: string | null
    nextFileUrl?: string | null
  }>
  expiresAt: string | null
  recipient: string | null
  emailFailed: boolean
  emailError: string | null
}

function formatDate(value: string | null) {
  if (!value) return null

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return null
  }
}

function getStringList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  )
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function getFieldDetails(value: unknown): Round['fieldDetails'] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []

    const detail = item as Record<string, unknown>
    const fieldName = getOptionalString(detail.fieldName)
    const label = getOptionalString(detail.label)

    if (!fieldName || !label) return []

    return [
      {
        fieldName,
        label,
        type:
          detail.type === 'text' || detail.type === 'document'
            ? detail.type
            : undefined,
        action:
          detail.action === 'replace' || detail.action === 'remove'
            ? detail.action
            : undefined,
        previousFileName: getOptionalString(detail.previousFileName),
        previousFileUrl: getOptionalString(detail.previousFileUrl),
        nextFileName: getOptionalString(detail.nextFileName),
        nextFileUrl: getOptionalString(detail.nextFileUrl),
      },
    ]
  })
}

function buildRounds(history: Array<CaseHistory>): Array<Round> {
  // History is most-recent first; reverse so we walk chronologically.
  const chronological = [...history].reverse()
  const rounds: Array<Round> = []

  for (const entry of chronological) {
    if (entry.action === 'resubmission_email_sent') {
      const details = entry.details ?? {}
      rounds.push({
        index: rounds.length + 1,
        sentEntry: entry,
        resubmittedEntry: null,
        rejectedFields:
          getStringList(details.rejectedFieldLabels).length > 0
            ? getStringList(details.rejectedFieldLabels)
            : getStringList(details.rejectedFields),
        fieldsUpdated: [],
        fieldDetails: [],
        expiresAt:
          typeof details.expiresAt === 'string' ? details.expiresAt : null,
        recipient:
          typeof details.recipient === 'string' ? details.recipient : null,
        emailFailed: false,
        emailError: null,
      })
      continue
    }

    if (entry.action === 'resubmission_email_failed') {
      const details = entry.details ?? {}
      rounds.push({
        index: rounds.length + 1,
        sentEntry: entry,
        resubmittedEntry: null,
        rejectedFields: [],
        fieldsUpdated: [],
        fieldDetails: [],
        expiresAt: null,
        recipient: null,
        emailFailed: true,
        emailError: typeof details.error === 'string' ? details.error : null,
      })
      continue
    }

    if (entry.action === 'client_resubmitted') {
      const last = rounds.at(-1) ?? null
      if (!last || last.resubmittedEntry) continue

      const details = entry.details ?? {}
      last.resubmittedEntry = entry
      last.fieldsUpdated =
        getStringList(details.fieldsUpdatedLabels).length > 0
          ? getStringList(details.fieldsUpdatedLabels)
          : getStringList(details.fieldsUpdated)
      last.fieldDetails = getFieldDetails(details.fieldsUpdatedDetails)
    }
  }

  return rounds.reverse()
}

export function RejectionRoundsCard({ caseId }: RejectionRoundsCardProps) {
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))

  const rounds = useMemo(
    () => (historyQuery.data ? buildRounds(historyQuery.data) : []),
    [historyQuery.data],
  )

  if (rounds.length === 0) return null

  const latestRound = rounds[0]
  const completedRounds = rounds.filter(
    (round) => round.resubmittedEntry,
  ).length
  const openItems = latestRound.resubmittedEntry
    ? 0
    : latestRound.rejectedFields.length

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="gap-2 px-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            <RotateCcw className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm">Rejection rounds</CardTitle>
            <CardDescription className="mt-1">
              Resubmission requests and client updates for this case.
            </CardDescription>
          </div>
          <CardAction className="static row-auto col-auto">
            <Badge variant="secondary">
              {completedRounds}/{rounds.length} complete
            </Badge>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="grid grid-cols-2 gap-2">
          <SummaryMetric
            label="Latest round"
            value={`Round ${latestRound.index}`}
          />
          <SummaryMetric label="Open items" value={String(openItems)} />
        </div>

        {rounds.map((round) => (
          <RoundRow key={round.sentEntry.id} round={round} />
        ))}
      </CardContent>
    </Card>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function RoundRow({ round }: { round: Round }) {
  const sentAt = formatDate(round.sentEntry.createdAt)
  const expiresAt = formatDate(round.expiresAt)
  const resubmittedAt = formatDate(round.resubmittedEntry?.createdAt ?? null)

  return (
    <Collapsible className="rounded-xl border bg-background shadow-xs">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/35">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted/30">
            {round.emailFailed ? (
              <ShieldAlert className="size-4 text-destructive" />
            ) : round.resubmittedEntry ? (
              <Inbox className="size-4 text-muted-foreground" />
            ) : (
              <Send className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Round {round.index}</span>
              <RoundStatusBadge round={round} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {sentAt ?? 'Date unavailable'}
            </p>
          </div>
        </div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Separator />
        <div className="flex flex-col gap-3 p-3 text-sm">
          {round.emailFailed ? (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>Email failed</AlertTitle>
              <AlertDescription>
                {round.emailError ??
                  'The resubmission email could not be sent.'}
              </AlertDescription>
            </Alert>
          ) : (
            <RoundDetails
              round={round}
              expiresAt={expiresAt}
              resubmittedAt={resubmittedAt}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function RoundStatusBadge({ round }: { round: Round }) {
  if (round.emailFailed) {
    return <Badge variant="destructive">Email failed</Badge>
  }

  if (round.resubmittedEntry) {
    return <Badge variant="secondary">Resubmitted</Badge>
  }

  return <Badge variant="outline">Awaiting client</Badge>
}

function RoundDetails({
  round,
  expiresAt,
  resubmittedAt,
}: {
  round: Round
  expiresAt: string | null
  resubmittedAt: string | null
}) {
  return (
    <>
      <DetailBlock
        icon={MailCheck}
        label="Sent to"
        title={round.recipient ?? 'Recipient unavailable'}
        description={expiresAt ? `Link expires ${expiresAt}` : null}
      />

      <DetailListBlock
        label={`Fields requested (${round.rejectedFields.length})`}
        items={round.rejectedFields}
      />

      {round.resubmittedEntry ? (
        <DetailBlock
          icon={Inbox}
          label={
            resubmittedAt
              ? `Client submitted ${resubmittedAt}`
              : 'Client submitted'
          }
          title={`${round.fieldsUpdated.length} field${
            round.fieldsUpdated.length === 1 ? '' : 's'
          } updated`}
        >
          {round.fieldDetails.length > 0 ? (
            <FieldDetailsList fields={round.fieldDetails} />
          ) : round.fieldsUpdated.length > 0 ? (
            <InlineItemList items={round.fieldsUpdated} />
          ) : null}
        </DetailBlock>
      ) : null}
    </>
  )
}

function DetailBlock({
  icon: Icon,
  label,
  title,
  description,
  children,
}: {
  icon: typeof MailCheck
  label: string
  title: string
  description?: string | null
  children?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 wrap-break-word text-sm font-medium">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  )
}

function DetailListBlock({
  label,
  items,
}: {
  label: string
  items: Array<string>
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {items.length > 0 ? (
        <InlineItemList items={items} />
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Not recorded</p>
      )}
    </div>
  )
}

function InlineItemList({ items }: { items: Array<string> }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="max-w-full truncate">
          {item}
        </Badge>
      ))}
    </div>
  )
}

function FieldDetailsList({ fields }: { fields: Round['fieldDetails'] }) {
  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => (
        <div
          key={`${field.fieldName}-${field.action ?? 'text'}`}
          className="rounded-md border bg-background px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {field.label}
            </p>
            {field.type === 'document' ? (
              <Badge variant="outline">
                {field.action === 'remove' ? 'Removed' : 'Reuploaded'}
              </Badge>
            ) : null}
          </div>
          {field.previousFileUrl || field.nextFileUrl ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {field.previousFileUrl ? (
                <FileLink href={field.previousFileUrl} label="Previous file" />
              ) : null}
              {field.nextFileUrl ? (
                <FileLink href={field.nextFileUrl} label="New file" />
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function FileLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="xs">
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLink data-icon="inline-start" />
        {label}
      </a>
    </Button>
  )
}
