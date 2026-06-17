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
  },
  validateSearch: userRouteSearchSchema,
  loaderDeps: ({ search }) => ({
    search: search.search,
    roleType: search.roleType,
    status: search.status,
  }),
  loader: async ({ context, deps }) => {
    void context.queryClient.prefetchQuery(usersQueryOptions(deps))
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
        { width: 260, kind: 'text', headerWidth: 72 },
        { width: 130, kind: 'mono', headerWidth: 72 },
        { width: 120, kind: 'badge', headerWidth: 48 },
        { width: 110, kind: 'badge', headerWidth: 56 },
        { width: 150, kind: 'badge', headerWidth: 88 },
        { width: 150, kind: 'badge', headerWidth: 88 },
        { width: 130, kind: 'link', headerWidth: 48 },
        { width: 180, kind: 'date', headerWidth: 76 },
        { width: 180, kind: 'date', headerWidth: 64 },
      ]}
    />
  )
}
