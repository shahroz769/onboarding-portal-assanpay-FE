import { useState } from 'react'
import { useInfiniteQuery, usePrefetchQuery } from '@tanstack/react-query'
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
import { Spinner } from '#/components/ui/spinner'
import { useAuth } from '#/features/auth/auth-client'
import { TooltipProvider } from '#/components/ui/tooltip'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import {
  usersInfiniteQueryOptions,
  useBulkSendUserResetPasswordsMutation,
  useBulkUpdateUserStatusMutation,
} from '#/hooks/use-users-query'
import type { UserListItem, UserRouteSearch } from '#/schemas/users.schema'
import {
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  roleTypes,
  userStatuses,
} from '#/schemas/users.schema'
import { useMorph } from '#/hooks/use-morph'
import { CreateUserDialog } from './create-user-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { createUserColumns } from './users-columns'
import { USER_ROLE_ICONS } from './user-role-icons'

const roleFilterOptions = roleTypes.map((roleType) => ({
  label: USER_ROLE_LABELS[roleType],
  value: roleType,
  icon: USER_ROLE_ICONS[roleType],
}))

const statusFilterOptions = userStatuses.map((status) => ({
  label: USER_STATUS_LABELS[status],
  value: status,
}))

function CreateUserButton() {
  const [open, setOpen] = useState(false)
  const morph = useMorph()

  return (
    <>
      <Button
        size="sm"
        onClick={(event) => morph.run(() => setOpen(true), event.currentTarget)}
      >
        <PlusIcon data-icon="inline-start" />
        Create User
      </Button>
      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        popupProps={morph.popupProps}
      />
    </>
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
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const { user: currentUser } = useAuth()
  // Infinite pages, like the cases and merchants tables: the next page loads
  // as the table scrolls to its end, and the footer shows loaded / total.
  const usersQuery = useInfiniteQuery(usersInfiniteQueryOptions(filters))
  // The Create / Edit User form needs the queue list and shows a spinner
  // until it has it; loading it with the page means the dialogs open
  // straight into the form, without the spinner-to-form layout jump.
  usePrefetchQuery(queuesQueryOptions())
  const bulkStatusMutation = useBulkUpdateUserStatusMutation()
  const bulkResetMutation = useBulkSendUserResetPasswordsMutation()
  // Skeleton only while there is nothing to show for these filters: a
  // background refetch of cached rows keeps them visible and swaps quietly.
  const isTableLoading =
    usersQuery.isLoading ||
    (usersQuery.isFetching && usersQuery.isPlaceholderData)

  const users =
    usersQuery.data?.pages.flatMap((page) => page.users) ?? EMPTY_USERS
  const totalCount = usersQuery.data?.pages[0]?.total ?? null
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
    onEditUser: (user) => {
      setEditingUser(user)
      setEditOpen(true)
    },
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
                {selectedIds.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.length} of {users.length} row(s) selected
                  </span>
                )}
                <CreateUserButton />
              </DataTableToolbar.Actions>
            </DataTableToolbar>
          </div>

          <div className="shrink-0">
            <DataTableSelectionInfo
              selectedCount={selectedIds.length}
              visibleCount={users.length}
            >
              <Select
                items={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
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
              error={usersQuery.error}
              onRetry={() => void usersQuery.refetch()}
              onScrollEnd={() => {
                if (usersQuery.hasNextPage && !usersQuery.isFetchingNextPage) {
                  void usersQuery.fetchNextPage()
                }
              }}
              isFetchingMore={usersQuery.isFetchingNextPage}
              hasMore={usersQuery.hasNextPage}
              totalCount={totalCount}
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

      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={editingUser}
      />

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
