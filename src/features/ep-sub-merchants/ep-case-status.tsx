import { Link } from '@tanstack/react-router'
import { ChevronDownIcon } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  CLICKABLE_BADGE_CLASSES,
  caseStatusBadgeClasses,
  statusTint,
} from '#/lib/status-styles'
import { cn } from '#/lib/utils'
import { CASE_STATUS_LABELS } from '#/schemas/cases.schema'
import type { EpCaseSummary } from '#/schemas/merchants.schema'

const NOT_TRIGGERED_LABEL = 'Not Triggered'

export function epCaseStatusLabel(
  epCase: Pick<EpCaseSummary, 'status' | 'closeOutcome'>,
) {
  if (epCase.status !== 'closed') return CASE_STATUS_LABELS[epCase.status]
  return epCase.closeOutcome === 'unsuccessful'
    ? 'Closed Unsuccessful'
    : 'Closed Successful'
}

function EpCaseBadge({ epCase }: { epCase: EpCaseSummary }) {
  const label = epCaseStatusLabel(epCase)
  const details = [
    epCase.caseNumber,
    epCase.subMerchantName,
    epCase.ownerName ?? 'No owner',
  ].filter(Boolean)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="secondary"
            className={caseStatusBadgeClasses(
              epCase.status,
              epCase.closeOutcome,
            )}
            render={
              <Link
                to="/cases/$caseId"
                params={{ caseId: epCase.id }}
                aria-label={`${label}, open case ${epCase.caseNumber}`}
              />
            }
          />
        }
      >
        {label}
      </TooltipTrigger>
      <TooltipContent>{details.join(' · ')}</TooltipContent>
    </Tooltip>
  )
}

export function EpNotCreatedBadge({
  label = 'Not Created',
}: {
  label?: string
}) {
  return <Badge className={statusTint('neutral')}>{label}</Badge>
}

export type EpCaseStatusEntry = {
  key: string
  name: string | null
  epCase: EpCaseSummary | null
}

function EntryBadge({ entry }: { entry: EpCaseStatusEntry }) {
  return entry.epCase ? (
    <EpCaseBadge epCase={entry.epCase} />
  ) : (
    <EpNotCreatedBadge label={NOT_TRIGGERED_LABEL} />
  )
}

/**
 * Stays on one line so rows keep the table's fixed height: a single entry is
 * its badge, and several are status counts that open the full list.
 */
export function EpCaseStatusSummary({
  entries,
}: {
  entries: EpCaseStatusEntry[]
}) {
  const [onlyEntry] = entries
  if (onlyEntry && entries.length === 1) return <EntryBadge entry={onlyEntry} />

  const groups = new Map<
    string,
    { count: number; epCase: EpCaseSummary | null }
  >()
  for (const { epCase } of entries) {
    const label = epCase ? epCaseStatusLabel(epCase) : NOT_TRIGGERED_LABEL
    const group = groups.get(label)
    groups.set(label, { count: (group?.count ?? 0) + 1, epCase })
  }
  const summary = [...groups].map(([label, group]) => ({ label, ...group }))

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`EP status by sub-merchant: ${summary
              .map(({ count, label }) => `${count} ${label}`)
              .join(', ')}`}
            className={cn(
              'flex max-w-full items-center gap-1 overflow-hidden rounded-full',
              CLICKABLE_BADGE_CLASSES,
            )}
          />
        }
      >
        {summary.map(({ label, count, epCase }) => (
          <Badge
            key={label}
            variant="secondary"
            className={
              epCase
                ? caseStatusBadgeClasses(epCase.status, epCase.closeOutcome)
                : statusTint('neutral')
            }
          >
            {count} {label}
          </Badge>
        ))}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground"
        />
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-2 p-3" align="start">
        {entries.map((entry) => (
          <div key={entry.key} className="flex min-w-0 items-center gap-2">
            <span
              className="min-w-0 flex-1 truncate text-sm"
              title={entry.name ?? undefined}
            >
              {entry.name ?? 'EP case'}
            </span>
            <EntryBadge entry={entry} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
