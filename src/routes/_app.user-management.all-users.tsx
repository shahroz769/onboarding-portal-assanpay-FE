import { createFileRoute } from '@tanstack/react-router'

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
    await context.queryClient.ensureQueryData(usersQueryOptions(deps))
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter } = useUsersSearchActions('/user-management/all-users')

  return <UsersTableComposed filters={search} setFilter={setFilter} />
}
