import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Skeleton } from '#/components/ui/skeleton'
import {
  DASHBOARD_KEY,
  dashboardQueryOptions,
} from '#/hooks/use-dashboard-query'
import type { DashboardRouteSearch } from '#/schemas/dashboard.schema'
import { DashboardCharts } from './dashboard-charts'
import { DashboardFilterBar } from './dashboard-filter-bar'
import { DashboardKpiCards } from './dashboard-kpi-cards'
import { DashboardQueueTable } from './dashboard-queue-table'
import { DashboardRiskTables } from './dashboard-risk-tables'

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
        <>
          <DashboardKpiCards data={query.data} />
          <DashboardCharts data={query.data} />
          <DashboardQueueTable data={query.data} />
          <DashboardRiskTables data={query.data} />
        </>
      ) : (
        <DashboardSkeleton />
      )}
    </div>
  )
}

function FilterBarPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById('page-header-actions'))
  }, [])

  if (!target) return null
  return createPortal(children, target)
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
