import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'

import type { CaseRouteSearch } from '#/schemas/cases.schema'

export function cleanEmptyCaseSearch(search: Record<string, unknown>) {
  const cleaned = { ...search }

  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key]

    if (
      value === undefined ||
      value === '' ||
      (typeof value === 'number' && Number.isNaN(value))
    ) {
      delete cleaned[key]
    }
  }

  return cleaned
}

export function useCasesSearchActions(to: string) {
  const navigate = useNavigate()

  const setFilters = useCallback(
    (partialFilters: Partial<CaseRouteSearch>) => {
      void navigate({
        to,
        search: (prev) =>
          cleanEmptyCaseSearch({
            ...prev,
            ...partialFilters,
          }) as CaseRouteSearch,
        replace: true,
      })
    },
    [navigate, to],
  )

  const setFilter = useCallback(
    (key: keyof CaseRouteSearch, value: string | undefined) => {
      setFilters({ [key]: value || undefined })
    },
    [setFilters],
  )

  return {
    setFilter,
    setFilters,
  }
}
