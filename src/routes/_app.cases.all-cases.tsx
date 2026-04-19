import { createFileRoute } from '@tanstack/react-router'

import { CasesTableComposed } from '#/features/cases/cases-table'
import { casesInfiniteQueryOptions, queuesQueryOptions, usersQueryOptions } from '#/hooks/use-cases-query'
import { caseRouteSearchSchema } from '#/schemas/cases.schema'

export const Route = createFileRoute('/_app/cases/all-cases')({
  staticData: {
    title: 'All Cases',
    subtitle: 'Review and manage all onboarding cases.',
  },
  validateSearch: caseRouteSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureInfiniteQueryData(
        casesInfiniteQueryOptions({
          ...deps,
          createdAtFrom: undefined,
          createdAtTo: undefined,
        }),
      ),
      context.queryClient.ensureQueryData(queuesQueryOptions()),
      context.queryClient.ensureQueryData(usersQueryOptions()),
    ])
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <CasesTableComposed />
}
