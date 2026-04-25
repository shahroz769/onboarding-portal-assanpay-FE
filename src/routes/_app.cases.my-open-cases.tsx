import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { Skeleton } from '#/components/ui/skeleton'
import { CasesTableComposed } from '#/features/cases/cases-table'
import { useCasesSearchActions } from '#/features/cases/cases-route-filters'
import { useAuth } from '#/features/auth/auth-client'
import {
  casesInfiniteQueryOptions,
  queuesQueryOptions,
  usersQueryOptions,
} from '#/hooks/use-cases-query'
import { CASE_STATUSES, caseRouteSearchSchema } from '#/schemas/cases.schema'

const OPEN_CASE_STATUSES = CASE_STATUSES.filter(
  (status) => status !== 'closed' && status !== 'error',
)
const OPEN_CASES_STATUS_FILTER = OPEN_CASE_STATUSES.join(',')

export const Route = createFileRoute('/_app/cases/my-open-cases')({
  staticData: {
    title: 'My Open Cases',
    subtitle: 'Cases you currently own that are still in progress.',
  },
  validateSearch: caseRouteSearchSchema,
  loaderDeps: ({ search }) => ({
    search: search.search,
    queueId: search.queueId,
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
  }),
  pendingMs: 0,
  pendingComponent: CasesRoutePending,
  loader: async ({ context, deps }) => {
    void context.queryClient.prefetchQuery(queuesQueryOptions())
    void context.queryClient.prefetchQuery(usersQueryOptions())

    const userId = context.auth.getSnapshot().user?.id

    if (!userId) {
      return
    }

    await context.queryClient.ensureInfiniteQueryData(
      casesInfiniteQueryOptions({
        ...deps,
        ownerId: userId,
        status: OPEN_CASES_STATUS_FILTER,
        createdAtFrom: undefined,
        createdAtTo: undefined,
      }),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter, setFilters } = useCasesSearchActions(
    '/cases/my-open-cases',
  )
  const { user } = useAuth()

  return (
    <CasesTableComposed
      filters={{
        ...search,
        ownerId: user?.id,
        status: OPEN_CASES_STATUS_FILTER,
      }}
      setFilter={setFilter}
      setFilters={setFilters}
      hideOwnerFilter
      hideStatusFilter
    />
  )
}

function CasesRoutePending() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('page-header-actions'))
  }, [])

  return (
    <>
      {portalTarget
        ? createPortal(<Skeleton className="h-9 w-50" />, portalTarget)
        : null}
      <DataTableRouteSkeleton
        filterCount={0}
        actionWidth={124}
        columns={[
          { width: 40, kind: 'checkbox' },
          { width: 160, kind: 'link', headerWidth: 112, cellWidth: 118 },
          { width: 200, kind: 'text', headerWidth: 128 },
          { width: 130, kind: 'badge', headerWidth: 52, cellWidth: 92 },
          { width: 120, kind: 'badge', headerWidth: 96, cellWidth: 78 },
          { width: 100, kind: 'badge', headerWidth: 56, cellWidth: 64 },
          { width: 150, kind: 'link', headerWidth: 84, cellWidth: 104 },
          { width: 180, kind: 'date', headerWidth: 104 },
          { width: 180, kind: 'date', headerWidth: 92 },
          { width: 180, kind: 'date', headerWidth: 124 },
        ]}
      />
    </>
  )
}
