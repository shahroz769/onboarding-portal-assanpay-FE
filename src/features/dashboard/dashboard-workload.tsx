import { Suspense, lazy } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { EmptyState } from '#/components/empty-state'
import { useAuth } from '#/features/auth/auth-client'
import { caseWorkloadQueryOptions } from '#/hooks/use-dashboard-query'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import type { CaseWorkloadResponse } from '#/schemas/dashboard.schema'
import { HeaderStat, HeaderStatSkeleton } from './dashboard-header-stat'
import { formatCount } from './dashboard-utils'
import type { WorkloadChartRow } from './dashboard-workload-chart'
import type { OpenStatusKey, WorkloadTotals } from './dashboard-workload-utils'
import {
  WORKLOAD_SERIES,
  buildQueueBacklogRows,
  buildTeamWorkload,
  sumCells,
} from './dashboard-workload-utils'
import { loadDashboardCharts } from './load-dashboard-charts'

const WorkloadBarChart = lazy(() =>
  loadDashboardCharts().then((module) => ({
    default: module.WorkloadBarChart,
  })),
)

// Mirrors the chart's row + chrome heights so loading never shifts layout.
const CHART_ROW_HEIGHT = 36
const CHART_CHROME_HEIGHT = 64
const LOADING_ROWS = 6

function toChartRow(
  id: string,
  label: string,
  totals: WorkloadTotals,
): WorkloadChartRow {
  return {
    id,
    label,
    new: totals.new,
    working: totals.working,
    awaitingMerchant: totals.awaitingMerchant,
    open: totals.open,
  }
}

function statusFor(key: OpenStatusKey) {
  return WORKLOAD_SERIES.find((item) => item.key === key)?.status ?? 'new'
}

/** Header stat per status: New, Working, Awaiting (merchant). */
function StatusStats({ totals }: { totals: WorkloadTotals | null }) {
  return (
    <div className="flex items-start gap-5 text-right">
      {totals ? (
        <>
          <HeaderStat label="New" value={totals.new} format={formatCount} />
          <HeaderStat
            label="Working"
            value={totals.working}
            format={formatCount}
          />
          <HeaderStat
            label="Awaiting"
            value={totals.awaitingMerchant}
            format={formatCount}
          />
        </>
      ) : (
        <>
          <HeaderStatSkeleton label="New" />
          <HeaderStatSkeleton label="Working" />
          <HeaderStatSkeleton label="Awaiting" />
        </>
      )}
    </div>
  )
}

/**
 * Open cases (new, working, awaiting merchant) by queue and by person, right
 * now; the dashboard's date range doesn't apply. With `enabled` false, only
 * renders the loading state (used by the page skeleton).
 */
export function DashboardWorkload({ enabled = false }: { enabled?: boolean }) {
  const query = useQuery({ ...caseWorkloadQueryOptions(), enabled })
  const state: WorkloadState = {
    data: query.data,
    error: query.isError && !query.data ? query.error : null,
    onRetry: () => void query.refetch(),
  }

  return (
    // Cards stretch to the taller one; queue and team row counts differ.
    <div className="grid gap-4 lg:grid-cols-2">
      <QueueCasesCard {...state} />
      <TeamWorkloadCard {...state} />
    </div>
  )
}

type WorkloadState = {
  data: CaseWorkloadResponse | undefined
  error: unknown
  onRetry: () => void
}

// ─── Cases by queue ─────────────────────────────────────────────────────────

function QueueCasesCard({ data, error, onRetry }: WorkloadState) {
  const navigate = useNavigate()
  const queueRows = data ? buildQueueBacklogRows(data) : []
  const rows = queueRows.map(({ queue, totals }) =>
    toChartRow(queue.id, queue.name, totals),
  )
  const totals = data ? sumCells(data.cells) : null

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Cases by queue</CardTitle>
          <CardDescription>Open cases per queue, right now.</CardDescription>
        </div>
        <StatusStats totals={totals} />
      </CardHeader>
      <CardContent>
        <ChartBody
          rows={data ? rows : null}
          error={error}
          onRetry={onRetry}
          emptyTitle="No open cases."
          emptyDescription="New cases appear here when merchants submit the form."
          onSelect={(row, key) =>
            void navigate({
              to: '/cases/all-cases',
              search: { queueId: row.id, status: statusFor(key) },
            })
          }
        />
      </CardContent>
    </Card>
  )
}

// ─── Team workload ──────────────────────────────────────────────────────────

const UNASSIGNED_ROW_ID = 'unassigned'

function TeamWorkloadCard({ data, error, onRetry }: WorkloadState) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAgent = user?.roleType === 'agent'
  const workload = data ? buildTeamWorkload(data) : null

  // New cases have no owner, so the unassigned pool is the first bar.
  const rows: WorkloadChartRow[] = workload
    ? [
        {
          ...toChartRow(UNASSIGNED_ROW_ID, 'Unassigned', workload.unassigned),
          // Normally only new cases; skip the other statuses while empty.
          omit: (['working', 'awaitingMerchant'] as const).filter(
            (key) => workload.unassigned[key] === 0,
          ),
        },
        ...workload.members.map(({ member, totals }) => ({
          ...toChartRow(member.id, member.name, totals),
          // Cases are unassigned while new, so a person never has any.
          omit: ['new'] as const,
        })),
      ]
    : []
  const sumAssigned = (pick: (totals: WorkloadTotals) => number) =>
    (workload?.members ?? []).reduce(
      (total, row) => total + pick(row.totals),
      0,
    )

  function handleSelect(row: WorkloadChartRow, key: OpenStatusKey) {
    void navigate({
      to: '/cases/all-cases',
      search: {
        ...(row.id === UNASSIGNED_ROW_ID ? {} : { ownerId: row.id }),
        status: statusFor(key),
      },
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{isAgent ? 'My workload' : 'Team workload'}</CardTitle>
          <CardDescription>
            {isAgent
              ? 'Your open cases and the unassigned pool.'
              : 'Open cases per person, right now.'}
          </CardDescription>
        </div>
        <div className="flex items-start gap-5 text-right">
          {workload ? (
            <>
              <HeaderStat
                label="Unassigned"
                value={workload.unassigned.open}
                format={formatCount}
              />
              <HeaderStat
                label="Working"
                value={sumAssigned((totals) => totals.working)}
                format={formatCount}
              />
              <HeaderStat
                label="Awaiting"
                value={sumAssigned((totals) => totals.awaitingMerchant)}
                format={formatCount}
              />
            </>
          ) : (
            <>
              <HeaderStatSkeleton label="Unassigned" />
              <HeaderStatSkeleton label="Working" />
              <HeaderStatSkeleton label="Awaiting" />
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartBody
          rows={workload ? rows : null}
          error={error}
          onRetry={onRetry}
          emptyTitle={isAgent ? 'You have no open cases.' : 'No open cases.'}
          emptyDescription={
            isAgent
              ? 'New cases land in the unassigned pool first.'
              : "Cases appear here per person once they're open."
          }
          onSelect={handleSelect}
        />
      </CardContent>
    </Card>
  )
}

// ─── Chart body ─────────────────────────────────────────────────────────────

function ChartBody({
  rows,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  onSelect,
}: {
  /** null while loading. */
  rows: WorkloadChartRow[] | null
  error: unknown
  onRetry: () => void
  emptyTitle: string
  emptyDescription: string
  onSelect: (row: WorkloadChartRow, key: OpenStatusKey) => void
}) {
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load workload."
        description={getApiErrorMessage(error)}
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        }
      />
    )
  }

  const loadingHeight = LOADING_ROWS * CHART_ROW_HEIGHT + CHART_CHROME_HEIGHT
  const loading = (
    <Skeleton className="w-full rounded-md" style={{ height: loadingHeight }} />
  )

  if (!rows) return loading
  // Queue and Unassigned rows always exist, so check for cases, not rows.
  // Holds the skeleton's height so loading → empty doesn't shift the card.
  if (rows.every((row) => row.open === 0)) {
    return (
      <div style={{ height: loadingHeight }}>
        <EmptyState
          icon={CheckCircle2}
          tone="success"
          title={emptyTitle}
          description={emptyDescription}
          className="h-full py-0"
        />
      </div>
    )
  }

  return (
    <Suspense fallback={loading}>
      <WorkloadBarChart rows={rows} onSelect={onSelect} />
    </Suspense>
  )
}
