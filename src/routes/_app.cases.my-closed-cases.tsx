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
import { caseRouteSearchSchema } from '#/schemas/cases.schema'

const CLOSED_CASES_STATUS_FILTER = ['closed', 'error'].join(',')

export const Route = createFileRoute('/_app/cases/my-closed-cases')({
  staticData: {
    title: 'My Closed Cases',
    subtitle: 'Cases you owned that have already reached a terminal stage.',
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
        status: CLOSED_CASES_STATUS_FILTER,
        createdAtFrom: undefined,
        createdAtTo: undefined,
      }),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter, setFilters } = useCasesSearchActions('/cases/my-closed-cases')
  const { user } = useAuth()

  return (
    <CasesTableComposed
      filters={{
        ...search,
        ownerId: user?.id,
        status: CLOSED_CASES_STATUS_FILTER,
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
      {portalTarget ? createPortal(<Skeleton className="h-9 w-50" />, portalTarget) : null}
      <DataTableRouteSkeleton
        filterCount={0}
        actionWidth={124}
        columnWidths={[40, 160, 200, 130, 120, 100, 150, 180, 180, 180]}
      />
    </>
  )
}
