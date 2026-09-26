import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { differenceInCalendarDays, format } from 'date-fns'
import { CheckCircle2, FileSignature, Info } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'
import { awaitingPhysicalAgreementsInfiniteQueryOptions } from '#/hooks/use-dashboard-query'
import { statusTint } from '#/lib/status-styles'
import type { AwaitingPhysicalAgreement } from '#/schemas/dashboard.schema'

// A week without the signed copy is worth a nudge; two weeks is overdue.
function waitingTint(days: number) {
  if (days >= 14) return statusTint('red')
  if (days >= 7) return statusTint('amber')
  return ''
}

function WaitingBadge({ sentAt }: { sentAt: string }) {
  const sentDate = new Date(sentAt)
  const days = Math.max(differenceInCalendarDays(new Date(), sentDate), 0)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="secondary"
            className={waitingTint(days) || undefined}
          />
        }
      >
        {days === 0 ? 'Today' : `${days}d`}
      </TooltipTrigger>
      <TooltipContent>
        Agreement sent {format(sentDate, 'MMM dd, yyyy h:mm a')}
      </TooltipContent>
    </Tooltip>
  )
}

const columns: DataTableColumnDef<AwaitingPhysicalAgreement>[] = [
  {
    id: 'merchant',
    header: 'Merchant',
    cell: (item) => (
      <div className="flex min-w-0 flex-col leading-tight">
        <Link
          to="/merchants/$merchantId/overview"
          params={{ merchantId: item.merchantId }}
          className="truncate font-medium hover:underline hover:decoration-dashed hover:underline-offset-4"
        >
          {item.merchantName}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {item.emailRecipient ?? 'Recipient not recorded'}
        </span>
      </div>
    ),
  },
  {
    id: 'case',
    header: 'Case',
    width: 150,
    cell: (item) => (
      <div className="flex min-w-0 flex-col leading-tight">
        <Link
          to="/cases/$caseId"
          params={{ caseId: item.caseId }}
          className="font-mono text-sm font-medium tabular-nums hover:underline hover:decoration-dashed hover:underline-offset-4"
        >
          {item.caseNumber}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {item.ownerName ?? 'Unassigned'}
        </span>
      </div>
    ),
  },
  {
    id: 'waiting',
    header: <span className="block text-right">Waiting</span>,
    width: 90,
    cell: (item) => (
      <div className="flex justify-end">
        <WaitingBadge sentAt={item.emailSentAt} />
      </div>
    ),
  },
]

/**
 * Agreement cases on Awaiting Client: the agreement was emailed but the
 * signed physical copy has not reached the office yet.
 */
export function DashboardAwaitingAgreements() {
  const query = useInfiniteQuery(
    awaitingPhysicalAgreementsInfiniteQueryOptions(),
  )
  const rows = query.data?.pages.flatMap((page) => page.data) ?? []
  const total = query.data?.pages[0]?.total ?? rows.length

  return (
    <Card>
      <CardHeader>
        {/* min-h-8 matches the portal MIDs card's action row. */}
        <div className="flex min-h-8 min-w-0 items-center gap-2">
          <CardTitle>Physical agreements awaiting</CardTitle>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Which agreements are listed?"
                  className="text-muted-foreground"
                />
              }
            >
              <Info />
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              Agreement cases on Awaiting Client where the agreement email was
              sent but the signed physical copy has not been uploaded. Sorted by
              longest waiting.
            </TooltipContent>
          </Tooltip>
          {query.isPending ? (
            // h-5.5 = Badge height (py-0.5 + text-xs line + border)
            <Skeleton className="h-5.5 w-9 rounded-full" />
          ) : (
            <Badge variant={total > 0 ? 'outline' : 'secondary'}>
              {total > 0 ? <FileSignature /> : <CheckCircle2 />}
              {total}
            </Badge>
          )}
        </div>
        <CardDescription>
          Agreements sent, signed physical copy not received yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(item) => item.caseId}
          isLoading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          onScrollEnd={() => void query.fetchNextPage()}
          hasMore={query.hasNextPage}
          isFetchingMore={query.isFetchingNextPage}
          totalCount={total}
          // Fixed base height, grows to match the neighbouring card.
          className="h-80 flex-1"
          emptyContent={
            <EmptyState
              icon={CheckCircle2}
              tone="success"
              title="All physical agreements received"
              description="No sent agreements are waiting on a signed physical copy."
            />
          }
        />
      </CardContent>
    </Card>
  )
}
