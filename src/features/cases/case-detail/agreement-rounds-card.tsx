import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  MailCheck,
  Send,
  ShieldAlert,
  Upload,
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
import { formatExpiryLabel, NO_EXPIRY_LABEL } from '#/lib/expiry'
import type { CaseHistory } from '#/schemas/cases.schema'

interface AgreementRoundsCardProps {
  caseId: string
}

type AgreementRound = {
  index: number
  uploadedEntry: CaseHistory | null
  sentEntry: CaseHistory | null
  submittedEntry: CaseHistory | null
  finalFileName: string | null
  finalSizeBytes: number | null
  recipient: string | null
  remarks: string | null
  expiresAt: string | null
  emailFailed: boolean
  emailError: string | null
  submittedFileName: string | null
  submittedFileUrl: string | null
}

function formatDate(value: string | null) {
  return formatExpiryLabel(value, (date) =>
    AGREEMENT_ROUND_DATE_FORMATTER.format(date),
  )
}

function formatFileSize(bytes: number | null) {
  if (bytes === null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function createRound(index: number): AgreementRound {
  return {
    index,
    uploadedEntry: null,
    sentEntry: null,
    submittedEntry: null,
    finalFileName: null,
    finalSizeBytes: null,
    recipient: null,
    remarks: null,
    expiresAt: null,
    emailFailed: false,
    emailError: null,
    submittedFileName: null,
    submittedFileUrl: null,
  }
}

function buildAgreementRounds(history: Array<CaseHistory>) {
  const chronological = [...history].reverse()
  const rounds: Array<AgreementRound> = []
  let current: AgreementRound | null = null

  for (const entry of chronological) {
    const details = entry.details ?? {}

    if (entry.action === 'agreement_final_uploaded') {
      if (current && !current.sentEntry && !current.emailFailed) {
        current.uploadedEntry = entry
      } else {
        current = createRound(rounds.length + 1)
        current.uploadedEntry = entry
        rounds.push(current)
      }

      current.finalFileName = getString(details.fileName)
      current.finalSizeBytes = getNumber(details.sizeBytes)
      continue
    }

    if (entry.action === 'agreement_email_sent') {
      if (!current || current.sentEntry || current.emailFailed) {
        current = createRound(rounds.length + 1)
        rounds.push(current)
      }

      current.sentEntry = entry
      current.recipient = getString(details.recipient)
      current.remarks = getString(details.remarks)
      current.expiresAt = getString(details.expiresAt)
      continue
    }

    if (entry.action === 'agreement_email_failed') {
      if (!current || current.sentEntry || current.emailFailed) {
        current = createRound(rounds.length + 1)
        rounds.push(current)
      }

      current.sentEntry = entry
      current.emailFailed = true
      current.recipient = getString(details.recipient)
      current.remarks = getString(details.remarks)
      current.emailError = getString(details.error)
      continue
    }

    if (entry.action === 'agreement_client_submitted') {
      const target =
        [...rounds]
          .reverse()
          .find((round) => round.sentEntry && !round.submittedEntry) ?? null

      if (!target) continue

      target.submittedEntry = entry
      target.submittedFileName = getString(details.fileName)
      target.submittedFileUrl = getString(details.fileUrl)
    }
  }

  return rounds
    .filter(
      (round) => round.uploadedEntry || round.sentEntry || round.submittedEntry,
    )
    .reverse()
}

export function AgreementRoundsCard({ caseId }: AgreementRoundsCardProps) {
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))

  const rounds = historyQuery.data
    ? buildAgreementRounds(historyQuery.data)
    : []

  if (rounds.length === 0) return null

  const latestRound = rounds[0]
  const completedRounds = rounds.filter((round) => round.submittedEntry).length

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="gap-2 px-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm">Agreement rounds</CardTitle>
            <CardDescription className="mt-1">
              Final agreement emails and client submissions for this case.
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

          <SummaryMetric
            label="Current state"
            value={getRoundStateLabel(latestRound)}
          />
        </div>

        {rounds.map((round) => (
          <AgreementRoundRow
            key={
              round.sentEntry?.id ??
              round.submittedEntry?.id ??
              round.uploadedEntry?.id ??
              round.index
            }
            round={round}
          />
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

function AgreementRoundRow({ round }: { round: AgreementRound }) {
  const roundDate =
    formatDate(
      round.sentEntry?.createdAt ??
        round.uploadedEntry?.createdAt ??
        round.submittedEntry?.createdAt ??
        null,
    ) ?? 'Date unavailable'

  return (
    <Collapsible className="rounded-xl border bg-background shadow-xs">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/35">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted/30">
            {round.emailFailed ? (
              <ShieldAlert className="size-4 text-destructive" />
            ) : round.submittedEntry ? (
              <CheckCircle2 className="size-4 text-muted-foreground" />
            ) : round.sentEntry ? (
              <Send className="size-4 text-muted-foreground" />
            ) : (
              <Upload className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Round {round.index}</span>
              <RoundStatusBadge round={round} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {roundDate}
            </p>
          </div>
        </div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="motion-collapsible-content">
        <Separator />
        <div className="flex flex-col gap-3 p-3 text-sm">
          {round.emailFailed ? (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>Email failed</AlertTitle>
              <AlertDescription>
                {round.emailError ?? 'The agreement email could not be sent.'}
              </AlertDescription>
            </Alert>
          ) : null}

          <AgreementRoundDetails round={round} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function RoundStatusBadge({ round }: { round: AgreementRound }) {
  if (round.emailFailed) {
    return <Badge variant="destructive">Email failed</Badge>
  }

  if (round.submittedEntry) {
    return <Badge variant="secondary">Submitted</Badge>
  }

  if (round.sentEntry) {
    return <Badge variant="outline">Awaiting client</Badge>
  }

  return <Badge variant="outline">Uploaded</Badge>
}

function AgreementRoundDetails({ round }: { round: AgreementRound }) {
  const uploadedAt = formatDate(round.uploadedEntry?.createdAt ?? null)
  const sentAt = formatDate(round.sentEntry?.createdAt ?? null)
  const expiresAt = formatDate(round.expiresAt)
  const submittedAt = formatDate(round.submittedEntry?.createdAt ?? null)
  const fileSize = formatFileSize(round.finalSizeBytes)

  return (
    <>
      <DetailBlock
        icon={Upload}
        label={
          uploadedAt
            ? `Final agreement uploaded ${uploadedAt}`
            : 'Final agreement'
        }
        title={round.finalFileName ?? 'File name unavailable'}
        description={fileSize}
      />

      {round.sentEntry ? (
        <DetailBlock
          icon={MailCheck}
          label={sentAt ? `Email sent ${sentAt}` : 'Email sent'}
          title={round.recipient ?? 'Recipient unavailable'}
          description={
            expiresAt
              ? expiresAt === NO_EXPIRY_LABEL
                ? expiresAt
                : `Link expires ${expiresAt}`
              : null
          }
        >
          {round.remarks ? (
            <p className="text-sm text-muted-foreground">{round.remarks}</p>
          ) : null}
        </DetailBlock>
      ) : null}

      {round.submittedEntry ? (
        <DetailBlock
          icon={CheckCircle2}
          label={
            submittedAt ? `Client submitted ${submittedAt}` : 'Client submitted'
          }
          title={round.submittedFileName ?? 'Submitted agreement'}
        >
          {round.submittedFileUrl ? (
            <Button asChild variant="outline" size="xs">
              <a href={round.submittedFileUrl} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" />
                Open submitted file
              </a>
            </Button>
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
  icon: typeof FileText
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

function getRoundStateLabel(round: AgreementRound) {
  if (round.emailFailed) return 'Email failed'
  if (round.submittedEntry) return 'Submitted'
  if (round.sentEntry) return 'Awaiting client'
  return 'Uploaded'
}
const AGREEMENT_ROUND_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})
