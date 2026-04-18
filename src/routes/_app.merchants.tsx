import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

import { MerchantsTable } from '#/features/merchants/merchants-table'
import { MERCHANT_SORTABLE_COLUMNS } from '#/schemas/merchants.schema'
import type { MerchantFilters } from '#/schemas/merchants.schema'

const merchantSearchSchema = z.object({
  search: z.string().optional(),
  onboardingStage: z.string().optional(),
  priority: z.string().optional(),
  businessScope: z.string().optional(),
  currency: z.string().optional(),
  sortBy: z.enum(MERCHANT_SORTABLE_COLUMNS).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const Route = createFileRoute('/_app/merchants')({
  staticData: {
    title: 'Merchants',
    subtitle: 'Manage and track merchant onboarding progress.',
  },
  validateSearch: merchantSearchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const filters = useSearch({ from: '/_app/merchants' })
  const navigate = useNavigate()

  const handleFiltersChange = (newFilters: MerchantFilters) => {
    void navigate({
      to: '/merchants',
      search: newFilters,
      replace: true,
    })
  }

  return (
    <MerchantsTable filters={filters} onFiltersChange={handleFiltersChange} />
  )
}
