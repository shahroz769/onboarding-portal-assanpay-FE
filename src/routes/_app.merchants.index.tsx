import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { MerchantsTableComposed } from '#/features/merchants/merchants-table'
import { merchantRouteSearchSchema } from '#/schemas/merchants.schema'

export const Route = createFileRoute('/_app/merchants/')({
  staticData: {
    title: 'Merchants',
    subtitle: 'Manage and track merchant onboarding progress.',
    fitViewport: true,
  },
  validateSearch: merchantRouteSearchSchema,
  pendingMs: 0,
  pendingComponent: MerchantsRoutePending,
  component: RouteComponent,
})

function RouteComponent() {
  return <MerchantsTableComposed />
}

function MerchantsRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={3}
      filterWidths={[104, 96, 104]}
      actionWidth={148}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 240, kind: 'text', header: 'Merchant Name' },
        { width: 130, kind: 'text', header: 'Business Scope', cellWidth: 92 },
        { width: 80, kind: 'text', header: 'Currency', cellWidth: 36 },
        { width: 120, kind: 'badge', header: 'Status', cellWidth: 88 },
        { width: 100, kind: 'badge', header: 'Priority', cellWidth: 64 },
        { width: 180, kind: 'date', header: 'Created At' },
        { width: 100, kind: 'actions', header: 'Actions' },
      ]}
    />
  )
}
