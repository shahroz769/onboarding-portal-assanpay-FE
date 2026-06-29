import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  DASHBOARD_KEY,
  dashboardQueryOptions,
} from '#/hooks/use-dashboard-query'
import type { DashboardRouteSearch } from '#/schemas/dashboard.schema'
import { DashboardCharts } from './dashboard-charts'
import { DashboardFilterBar } from './dashboard-filter-bar'
import { DashboardKpiCards } from './dashboard-kpi-cards'
import { DashboardPortalMids } from './dashboard-portal-mids'
import { DashboardQueueTable } from './dashboard-queue-table'
import { DashboardRiskTables } from './dashboard-risk-tables'
import { DashboardSkeleton } from './dashboard-skeleton'

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
          <DashboardPortalMids data={query.data} />
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

export { DashboardSkeleton } from './dashboard-skeleton'
