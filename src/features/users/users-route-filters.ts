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

  const setFilters = (partialFilters: Partial<UserRouteSearch>) => {
    void navigate({
      to,
      search: (prev) =>
        cleanEmptyUserSearch({
          ...prev,
          ...partialFilters,
        }) as UserRouteSearch,
      replace: true,
    })
  }

  const setFilter = (key: keyof UserRouteSearch, value: string | undefined) => {
    setFilters({ [key]: value || undefined })
  }

  return { setFilter, setFilters }
}
