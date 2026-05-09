import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'

import {
  DataTable,
  DataTableFilter,
  DataTableSearch,
  DataTableSelectionInfo,
  DataTableToolbar,
} from '#/components/data-table'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { TooltipProvider } from '#/components/ui/tooltip'
import {
  usersQueryOptions,
  useBulkUpdateUserStatusMutation,
} from '#/hooks/use-users-query'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import type { UserRouteSearch } from '#/schemas/users.schema'
import {
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  roleTypes,
  userStatuses,
} from '#/schemas/users.schema'
import { createUserColumns } from './users-columns'

const roleFilterOptions = roleTypes.map((roleType) => ({
  label: USER_ROLE_LABELS[roleType],
  value: roleType,
}))

const statusFilterOptions = userStatuses.map((status) => ({
  label: USER_STATUS_LABELS[status],
  value: status,
}))

function CreateUserHeaderAction() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('page-header-actions'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <Button asChild size="sm">
      <Link to="/user-management/user-creation">
        <PlusIcon data-icon="inline-start" />
        Create User
      </Link>
    </Button>,
    portalTarget,
  )
}

function commaToSet(value: string | undefined) {
  return new Set(value?.split(',').filter(Boolean) ?? [])
}

function setToCommaString(set: Set<string>) {
  return set.size > 0 ? Array.from(set).join(',') : undefined
}

type UsersTableComposedProps = {
  filters: UserRouteSearch
  setFilter: (key: keyof UserRouteSearch, value: string | undefined) => void
}

export function UsersTableComposed({
  filters,
  setFilter,
}: UsersTableComposedProps) {
  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<'active' | 'inactive'>('active')
  const usersQuery = useQuery(usersQueryOptions(filters))
  const queuesQuery = useQuery(queuesQueryOptions())
  const bulkStatusMutation = useBulkUpdateUserStatusMutation()

  const users = usersQuery.data ?? []
  const allIds = useMemo(() => users.map((user) => user.id), [users])
  const selectedIds = useMemo(() => Array.from(selectedIdSet), [selectedIdSet])

  const handleSelectRow = useCallback((id: string, selected: boolean) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      setSelectedIdSet(selected ? new Set(allIds) : new Set())
    },
    [allIds],
  )

  const columns = useMemo(
    () =>
      createUserColumns({
        selectedIds: selectedIdSet,
        allIds,
        onSelectRow: handleSelectRow,
        onSelectAll: handleSelectAll,
      }),
    [allIds, handleSelectAll, handleSelectRow, selectedIdSet],
  )

  const handleSubmitBulkStatus = () => {
    if (selectedIds.length === 0) return
    bulkStatusMutation.mutate(
      { ids: selectedIds, status: bulkStatus },
      {
        onSuccess: () => {
          setSelectedIdSet(new Set())
        },
      },
    )
  }

  return (
    <>
      <CreateUserHeaderAction />
      <TooltipProvider>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="shrink-0">
            <DataTableToolbar>
              <DataTableToolbar.Filters>
                <DataTableSearch
                  value={filters.search ?? ''}
                  onChange={(value) => setFilter('search', value || undefined)}
                  placeholder="Search by name, email, or username..."
                />
                <DataTableFilter
                  title="Role"
                  options={roleFilterOptions}
                  selectedValues={commaToSet(filters.roleType)}
                  onChange={(set) =>
                    setFilter('roleType', setToCommaString(set))
                  }
                />
                <DataTableFilter
                  title="Status"
                  options={statusFilterOptions}
                  selectedValues={commaToSet(filters.status)}
                  onChange={(set) => setFilter('status', setToCommaString(set))}
                />
              </DataTableToolbar.Filters>
              <DataTableToolbar.Actions>
                <span className="text-sm text-muted-foreground">
                  Loaded {users.length} Employees
                </span>
              </DataTableToolbar.Actions>
            </DataTableToolbar>
          </div>

          <div className="shrink-0">
            <DataTableSelectionInfo
              selectedCount={selectedIds.length}
              visibleCount={users.length}
            >
              <Select
                value={bulkStatus}
                onValueChange={(value) =>
                  setBulkStatus(value as 'active' | 'inactive')
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubmitBulkStatus}
                disabled={bulkStatusMutation.isPending}
              >
                Set Status
              </Button>
            </DataTableSelectionInfo>
          </div>

          <div className="min-h-0 flex-1">
            <DataTable
              columns={columns}
              data={users}
              getRowId={(user) => user.id}
              selectedIds={selectedIdSet}
              isLoading={usersQuery.isLoading || queuesQuery.isLoading}
              emptyContent={
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <p className="text-sm">No users found.</p>
                  <p className="text-xs">
                    Try adjusting your search or filters.
                  </p>
                </div>
              }
            />
          </div>
        </div>
      </TooltipProvider>
    </>
  )
}
