import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'

import type { UserRouteSearch } from '#/schemas/users.schema'

export function cleanEmptyUserSearch(search: Record<string, unknown>) {
  const cleaned = { ...search }

  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key]

    if (value === undefined || value === '') {
      delete cleaned[key]
    }
  }

  return cleaned
}

export function useUsersSearchActions(to: string) {
  const navigate = useNavigate()

  const setFilters = useCallback(
    (partialFilters: Partial<UserRouteSearch>) => {
      void navigate({
        to,
        search: (prev) =>
          cleanEmptyUserSearch({
            ...prev,
            ...partialFilters,
          }) as UserRouteSearch,
        replace: true,
      })
    },
    [navigate, to],
  )

  const setFilter = useCallback(
    (key: keyof UserRouteSearch, value: string | undefined) => {
      setFilters({ [key]: value || undefined })
    },
    [setFilters],
  )

  return { setFilter, setFilters }
}
