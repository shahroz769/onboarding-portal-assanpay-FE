import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { UsersTableComposed } from '#/features/users/users-table'
import { useUsersSearchActions } from '#/features/users/users-route-filters'
import { usersQueryOptions } from '#/hooks/use-users-query'
import { userRouteSearchSchema } from '#/schemas/users.schema'

export const Route = createFileRoute('/_app/user-management/all-users')({
  staticData: {
    title: 'All Users',
    subtitle: 'Manage employee status, access, and owned cases.',
    fitViewport: true,
  },
  validateSearch: userRouteSearchSchema,
  // Search params are read here instead of via loaderDeps: loaderDeps would
  // create a new pending match per keystroke and unmount the filter toolbar.
  loader: async ({ context, location }) => {
    const search = userRouteSearchSchema.parse(location.search)
    void context.queryClient.prefetchQuery(
      usersQueryOptions({
        search: search.search,
        roleType: search.roleType,
        status: search.status,
      }),
    )
  },
  pendingMs: 0,
  pendingComponent: UsersRoutePending,
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter } = useUsersSearchActions('/user-management/all-users')

  return <UsersTableComposed filters={search} setFilter={setFilter} />
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
