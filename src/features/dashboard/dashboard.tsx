import { Suspense, lazy } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { cn } from '#/lib/utils'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/empty-state'
import {
  DASHBOARD_KEY,
  dashboardQueryOptions,
} from '#/hooks/use-dashboard-query'
import type { DashboardRouteSearch } from '#/schemas/dashboard.schema'
import { usePageHeaderActions } from '#/hooks/use-page-header-actions'
import { DashboardFilterBar } from './dashboard-filter-bar'
import { DashboardKpiCards } from './dashboard-kpi-cards'
import { DashboardPortalMids } from './dashboard-portal-mids'
import {
  DashboardChartsSkeleton,
  DashboardSkeleton,
} from './dashboard-skeleton'
import { loadDashboardCharts } from './load-dashboard-charts'

const DashboardCharts = lazy(() =>
  loadDashboardCharts().then((module) => ({ default: module.DashboardCharts })),
)

type DashboardProps = {
  search: DashboardRouteSearch
  onChange: (next: Partial<DashboardRouteSearch>) => void
}

export function Dashboard({ search, onChange }: DashboardProps) {
  const queryClient = useQueryClient()
  const query = useQuery(dashboardQueryOptions(search))

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY })
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBarPortal>
        <DashboardFilterBar
          search={search}
          onChange={onChange}
          onRefresh={handleRefresh}
          isFetching={query.isFetching}
        />
      </FilterBarPortal>

      {query.data ? (
        // While a new range loads, the previous range's numbers stay visible
        // (keepPreviousData), dimmed so they don't read as current.
        <div
          aria-busy={query.isPlaceholderData}
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            query.isPlaceholderData && 'opacity-60',
          )}
        >
          <DashboardKpiCards data={query.data} />
          <Suspense fallback={<DashboardChartsSkeleton />}>
            <DashboardCharts data={query.data} />
          </Suspense>
          <DashboardPortalMids data={query.data} />
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load the dashboard."
          description={getApiErrorMessage(query.error)}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          }
        />
      ) : (
        <DashboardSkeleton />
      )}
    </div>
  )
}

function FilterBarPortal({ children }: { children: React.ReactNode }) {
  const target = usePageHeaderActions()

  if (!target) return null
  return createPortal(children, target)
}
