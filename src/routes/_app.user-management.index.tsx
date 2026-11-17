import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { UsersTableComposed } from '#/features/users/users-table'
import { useUsersSearchActions } from '#/features/users/users-route-filters'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { usersInfiniteQueryOptions } from '#/hooks/use-users-query'
import { userRouteSearchSchema } from '#/schemas/users.schema'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/user-management/')({
  staticData: {
    title: 'User Management',
    subtitle: 'Manage employee status, access, and owned cases.',
    fitViewport: true,
  },
  validateSearch: userRouteSearchSchema,
  // Starts the table's requests (the list, and the queues its dialogs need)
  // while the route skeleton shows. Not awaited: the table keeps its own
  // loading and error states. Same parse as validateSearch, so keys match.
  loader: ({ context: { queryClient }, location, preload }) => {
    if (preload) return
    const search = userRouteSearchSchema.safeParse(location.search)
    if (search.success) {
      void queryClient.prefetchInfiniteQuery(
        usersInfiniteQueryOptions(search.data),
      )
    }
    void queryClient.prefetchQuery(queuesQueryOptions())
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: UsersRoutePending,
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter, setFilters } = useUsersSearchActions('/user-management')

  return (
    <UsersTableComposed
      filters={search}
      setFilter={setFilter}
      clearFilters={() =>
        setFilters({
          search: undefined,
          roleType: undefined,
          status: undefined,
        })
      }
    />
  )
}

function UsersRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={2}
      filterWidths={[96, 112]}
      actionWidth={112}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 260, kind: 'text', header: 'Employee' },
        { width: 130, kind: 'mono', header: 'Username' },
        { width: 120, kind: 'badge', header: 'Role' },
        { width: 110, kind: 'badge', header: 'Status' },
        { width: 120, kind: 'badge', header: 'Password' },
        { width: 150, kind: 'badge', header: 'View Access' },
        { width: 150, kind: 'badge', header: 'Work Access' },
        { width: 90, kind: 'text', header: 'Cases' },
        { width: 180, kind: 'date', header: 'Last Login' },
        { width: 180, kind: 'date', header: 'Created' },
      ]}
    />
  )
}
