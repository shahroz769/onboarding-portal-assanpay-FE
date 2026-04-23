import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ExternalLink,
  Inbox,
  MailCheck,
  RotateCcw,
} from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
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

function buildRounds(history: Array<CaseHistory>): Array<Round> {
  // History is most-recent first; reverse so we walk chronologically.
  const chronological = [...history].reverse()
  const rounds: Array<Round> = []

  for (const entry of chronological) {
    if (entry.action === 'resubmission_email_sent') {
      const details = (entry.details ?? {}) as Record<string, unknown>
      rounds.push({
        index: rounds.length + 1,
        sentEntry: entry,
        resubmittedEntry: null,
        rejectedFields: Array.isArray(details.rejectedFieldLabels)
          ? (details.rejectedFieldLabels as Array<string>)
          : Array.isArray(details.rejectedFields)
            ? (details.rejectedFields as Array<string>)
          : [],
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
      const details = (entry.details ?? {}) as Record<string, unknown>
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
        emailError:
          typeof details.error === 'string' ? details.error : null,
      })
      continue
    }

    if (entry.action === 'client_resubmitted') {
      const last = rounds[rounds.length - 1]
      if (last && !last.resubmittedEntry) {
        const details = (entry.details ?? {}) as Record<string, unknown>
        last.resubmittedEntry = entry
        last.fieldsUpdated = Array.isArray(details.fieldsUpdatedLabels)
          ? (details.fieldsUpdatedLabels as Array<string>)
          : Array.isArray(details.fieldsUpdated)
            ? (details.fieldsUpdated as Array<string>)
            : []
        last.fieldDetails = Array.isArray(details.fieldsUpdatedDetails)
          ? (details.fieldsUpdatedDetails as Round['fieldDetails'])
          : []
      }
    }
  }

  return rounds.reverse() // newest first for display
}

export function RejectionRoundsCard({ caseId }: RejectionRoundsCardProps) {
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))

  const rounds = useMemo(
    () => (historyQuery.data ? buildRounds(historyQuery.data) : []),
    [historyQuery.data],
  )

  if (rounds.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <RotateCcw className="size-4" />
          Rejection rounds
          <Badge variant="secondary">{rounds.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rounds.map((round) => (
          <RoundRow key={round.sentEntry.id} round={round} />
        ))}
      </CardContent>
    </Card>
  )
}

function RoundRow({ round }: { round: Round }) {
  const sentAt = formatDate(round.sentEntry.createdAt)
  const expiresAt = formatDate(round.expiresAt)
  const resubmittedAt = formatDate(
    round.resubmittedEntry?.createdAt ?? null,
  )

  return (
    <Collapsible className="rounded-lg border bg-background">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Round {round.index}</span>
          {round.emailFailed ? (
            <Badge variant="destructive">Email failed</Badge>
          ) : round.resubmittedEntry ? (
            <Badge variant="secondary">Resubmitted</Badge>
          ) : (
            <Badge variant="outline">Awaiting client</Badge>
          )}
          {sentAt ? (
            <span className="text-xs text-muted-foreground">{sentAt}</span>
          ) : null}
        </div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-2">
        <div className="flex flex-col gap-2 text-sm">
          {round.emailFailed ? (
            <div className="text-destructive">
              {round.emailError ?? 'The resubmission email could not be sent.'}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <MailCheck className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sent to
                  </p>
                  <p>{round.recipient ?? '—'}</p>
                  {expiresAt ? (
                    <p className="text-xs text-muted-foreground">
                      Link expires {expiresAt}
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Fields requested ({round.rejectedFields.length})
                </p>
                {round.rejectedFields.length > 0 ? (
                  <ul className="mt-1 ml-4 list-disc text-muted-foreground">
                    {round.rejectedFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">—</p>
                )}
              </div>
              {round.resubmittedEntry ? (
                <div className="flex items-start gap-2">
                  <Inbox className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Client submitted {resubmittedAt}
                    </p>
                    <p>
                    {round.fieldsUpdated.length} field
                    {round.fieldsUpdated.length === 1 ? '' : 's'} updated
                    </p>
                    {round.fieldDetails.length > 0 ? (
                      <ul className="mt-1 ml-4 list-disc text-muted-foreground">
                        {round.fieldDetails.map((field) => (
                          <li key={`${field.fieldName}-${field.action ?? 'text'}`}>
                            <span>{field.label}</span>
                            {field.type === 'document' ? (
                              <span className="ml-1">
                                {field.action === 'remove'
                                  ? '(removed)'
                                  : '(reuploaded)'}
                              </span>
                            ) : null}
                            {field.previousFileUrl ? (
                              <a
                                href={field.previousFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                              >
                                <ExternalLink className="size-3" />
                                Previous file
                              </a>
                            ) : null}
                            {field.nextFileUrl ? (
                              <a
                                href={field.nextFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                              >
                                <ExternalLink className="size-3" />
                                New file
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : round.fieldsUpdated.length > 0 ? (
                      <ul className="mt-1 ml-4 list-disc text-muted-foreground">
                        {round.fieldsUpdated.map((field) => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
