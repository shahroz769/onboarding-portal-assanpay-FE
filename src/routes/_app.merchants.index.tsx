import { createFileRoute } from '@tanstack/react-router'

import { MerchantsTableComposed } from '#/features/merchants/merchants-table'
import { merchantsInfiniteQueryOptions } from '#/hooks/use-merchants-query'
import { merchantRouteSearchSchema } from '#/schemas/merchants.schema'

export const Route = createFileRoute('/_app/merchants/')({
  staticData: {
    title: 'Merchants',
    subtitle: 'Manage and track merchant onboarding progress.',
  },
  validateSearch: merchantRouteSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureInfiniteQueryData(
      merchantsInfiniteQueryOptions(deps),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <MerchantsTableComposed />
}
