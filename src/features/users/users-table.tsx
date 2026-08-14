import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { MailIcon, PlusIcon } from 'lucide-react'

import {
  DataTable,
  DataTableFilter,
  DataTableSearch,
  DataTableSelectionInfo,
  DataTableToolbar,
} from '#/components/data-table'
import { Button } from '#/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { useAuth } from '#/features/auth/auth-client'
import { TooltipProvider } from '#/components/ui/tooltip'
import { useHydrated } from '#/hooks/use-hydrated'
import {
  usersQueryOptions,
  useBulkSendUserResetPasswordsMutation,
  useBulkUpdateUserStatusMutation,
} from '#/hooks/use-users-query'
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
  const hydrated = useHydrated()
  const portalTarget = hydrated
    ? document.getElementById('page-header-actions')
    : null

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

const EMPTY_USERS: never[] = []

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
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false)
  const { user: currentUser } = useAuth()
  const usersQuery = useQuery(usersQueryOptions(filters))
  const bulkStatusMutation = useBulkUpdateUserStatusMutation()
  const bulkResetMutation = useBulkSendUserResetPasswordsMutation()
  const isTableLoading = usersQuery.isLoading || usersQuery.isFetching

  const users = usersQuery.data ?? EMPTY_USERS
  const allIds = users.map((user) => user.id)
  const selectedIds = Array.from(selectedIdSet)

  const handleSelectRow = (id: string, selected: boolean) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedIdSet(selected ? new Set(allIds) : new Set())
  }

  const columns = createUserColumns({
    selectedIds: selectedIdSet,
    allIds,
    onSelectRow: handleSelectRow,
    onSelectAll: handleSelectAll,
  })

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

  const handleSendResetEmails = () => {
    if (selectedIds.length === 0) return
    bulkResetMutation.mutate(
      { ids: selectedIds },
      {
        onSuccess: (result) => {
          setResetConfirmationOpen(false)
          setSelectedIdSet(new Set(result.failedIds))
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
                {isTableLoading ? (
                  <Skeleton className="h-5 w-32" />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Loaded {users.length} Employees
                  </span>
                )}
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
                disabled={
                  bulkStatusMutation.isPending || bulkResetMutation.isPending
                }
              >
                Set Status
              </Button>
              {currentUser?.roleType === 'super_admin' &&
              selectedIds.length === 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetConfirmationOpen(true)}
                  disabled={
                    bulkStatusMutation.isPending || bulkResetMutation.isPending
                  }
                >
                  <MailIcon data-icon="inline-start" />
                  Send reset email
                </Button>
              ) : null}
            </DataTableSelectionInfo>
          </div>

          <div className="min-h-0 flex-1">
            <DataTable
              columns={columns}
              data={users}
              getRowId={(user) => user.id}
              selectedIds={selectedIdSet}
              isLoading={isTableLoading}
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

      <AlertDialog
        open={resetConfirmationOpen}
        onOpenChange={setResetConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send password reset emails?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.length} selected user
              {selectedIds.length === 1 ? '' : 's'} will receive a secure,
              single-use password link. This works for users with an existing
              password and users who have not set one yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkResetMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkResetMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                handleSendResetEmails()
              }}
            >
              {bulkResetMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <MailIcon data-icon="inline-start" />
              )}
              {bulkResetMutation.isPending ? 'Sending' : 'Send reset emails'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
