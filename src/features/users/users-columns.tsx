import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type { UserListItem } from '#/schemas/users.schema'
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from '#/schemas/users.schema'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return format(new Date(dateStr), 'MMM dd, yyyy h:mm a')
}

function UserIdentityCell({ user }: { user: UserListItem }) {
  const avatarSrc =
    user.gender === 'female'
      ? '/assets/avatar-female.webp'
      : '/assets/avatar-male.webp'
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9">
        <AvatarImage src={avatarSrc} alt="" />
        <AvatarFallback>{initials || 'U'}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <Link
          to="/user-management/users/$userId"
          params={{ userId: user.id }}
          className="block truncate text-sm font-medium text-primary hover:underline hover:decoration-dashed hover:underline-offset-4"
        >
          {user.name}
        </Link>
        <Link
          to="/user-management/users/$userId"
          params={{ userId: user.id }}
          className="block truncate text-xs text-muted-foreground hover:text-primary"
        >
          {user.email}
        </Link>
      </div>
    </div>
  )
}

function QueueSummary({
  user,
  kind,
}: {
  user: UserListItem
  kind: 'view' | 'work'
}) {
  const hasAllQueueAccess =
    user.roleType !== 'agent' ||
    (kind === 'view' && user.queueViewScope === 'all')

  if (hasAllQueueAccess) {
    return <Badge variant="secondary">All Queues</Badge>
  }

  const queues = kind === 'view' ? user.viewQueues : user.workQueues

  if (queues.length === 0) {
    return <span className="text-sm text-muted-foreground">None</span>
  }

  if (queues.length === 1) {
    return <Badge variant="secondary">{queues[0].name}</Badge>
  }

  return <Badge variant="secondary">{queues.length} queues</Badge>
}

export function createUserColumns({
  selectedIds,
  allIds,
  onSelectRow,
  onSelectAll,
}: {
  selectedIds: Set<string>
  allIds: string[]
  onSelectRow: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
}): DataTableColumnDef<UserListItem>[] {
  const isAllSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const isSomeSelected =
    !isAllSelected && allIds.some((id) => selectedIds.has(id))

  return [
    {
      id: 'select',
      header: (
        <Checkbox
          checked={isAllSelected}
          indeterminate={isSomeSelected}
          onCheckedChange={(value) => onSelectAll(!!value)}
          aria-label="Select all users"
        />
      ),
      cell: (user) => (
        <Checkbox
          checked={selectedIds.has(user.id)}
          onCheckedChange={(value) => onSelectRow(user.id, !!value)}
          aria-label={`Select ${user.name}`}
        />
      ),
      width: 40,
    },
    {
      id: 'name',
      header: 'Employee',
      cell: (user) => <UserIdentityCell user={user} />,
      width: 260,
    },
    {
      id: 'username',
      header: 'Username',
      cell: (user) => (
        <span className="font-mono text-xs text-muted-foreground">
          {user.username}
        </span>
      ),
      width: 130,
    },
    {
      id: 'roleType',
      header: 'Role',
      cell: (user) => (
        <Badge variant="outline">{USER_ROLE_LABELS[user.roleType]}</Badge>
      ),
      width: 120,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (user) => (
        <Badge variant="outline" className="gap-1.5">
          <span
            className={cn(
              'size-1.5 rounded-full',
              user.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400',
            )}
          />
          {USER_STATUS_LABELS[user.status]}
        </Badge>
      ),
      width: 110,
    },
    {
      id: 'passwordStatus',
      header: 'Password',
      cell: (user) => (
        <Badge variant="outline" className="gap-1.5">
          <span
            className={cn(
              'size-1.5 rounded-full',
              user.hasSetPassword ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
          {user.hasSetPassword ? 'Set' : 'Not set'}
        </Badge>
      ),
      width: 120,
    },
    {
      id: 'viewAccess',
      header: 'View Access',
      cell: (user) => <QueueSummary user={user} kind="view" />,
      width: 150,
    },
    {
      id: 'workAccess',
      header: 'Work Access',
      cell: (user) => <QueueSummary user={user} kind="work" />,
      width: 150,
    },
    {
      id: 'ownedCasesCount',
      header: 'Cases',
      cell: (user) => (
        <Link
          to="/cases/all-cases"
          search={{
            ownerId: user.id,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary tabular-nums hover:underline hover:decoration-dashed hover:underline-offset-4"
        >
          {user.ownedCasesCount}
          <ArrowUpRight className="size-3.5 text-muted-foreground" />
        </Link>
      ),
      width: 90,
    },
    {
      id: 'lastLoginAt',
      header: 'Last Login',
      cell: (user) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(user.lastLoginAt)}
        </span>
      ),
      width: 180,
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (user) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(user.createdAt)}
        </span>
      ),
      width: 180,
    },
  ]
}
