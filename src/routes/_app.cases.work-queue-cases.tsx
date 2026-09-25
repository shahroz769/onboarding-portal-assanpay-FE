import { createFileRoute, redirect } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { CasesTableComposed } from '#/features/cases/cases-table'
import { useCasesSearchActions } from '#/features/cases/cases-route-filters'
import {
  DEFAULT_CASE_STATUS_FILTER,
  caseRouteSearchSchema,
} from '#/schemas/cases.schema'

export const Route = createFileRoute('/_app/cases/work-queue-cases')({
  staticData: {
    title: 'Work Queue Cases',
    subtitle: 'All cases in queues where you have working access.',
    fitViewport: true,
  },
  validateSearch: caseRouteSearchSchema,
  beforeLoad: ({ context }) => {
    const user = context.auth.getSnapshot().user

    if (user?.roleType !== 'agent' || user.workQueueIds.length === 0) {
      throw redirect({ to: '/cases/all-cases' })
    }
  },
  pendingMs: 0,
  pendingComponent: CasesRoutePending,
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter, setFilters } = useCasesSearchActions(
    '/cases/work-queue-cases',
  )
  const filters = {
    ...search,
    status: search.status ?? DEFAULT_CASE_STATUS_FILTER,
  }

  return (
    <CasesTableComposed
      filters={filters}
      setFilter={setFilter}
      setFilters={setFilters}
      queueAccess="work"
    />
  )
}

function CasesRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={2}
      filterWidths={[96, 128]}
      actionWidth={124}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 160, kind: 'link', header: 'Case Number', cellWidth: 118 },
        { width: 200, kind: 'text', header: 'Merchant Name' },
        { width: 150, kind: 'link', header: 'Case Owner', cellWidth: 104 },
        { width: 130, kind: 'badge', header: 'Queue', cellWidth: 92 },
        { width: 160, kind: 'badge', header: 'Case Status', cellWidth: 78 },
        { width: 110, kind: 'badge', header: 'SLA', cellWidth: 64 },
        { width: 100, kind: 'badge', header: 'Priority', cellWidth: 64 },
        { width: 180, kind: 'date', header: 'Creation Date' },
        { width: 180, kind: 'date', header: 'Closed Date' },
        { width: 180, kind: 'date', header: 'Last Updated At' },
      ]}
    />
  )
}
