import type { ComponentType, SVGProps } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import {
  CheckIcon,
  ChevronsUpDownIcon,
  ListChecksIcon,
  RotateCcwIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { Badge } from '#/components/ui/badge'
import { ScrollArea } from '#/components/ui/scroll-area'
import { useAuth } from '#/features/auth/auth-client'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { useSendUserResetPasswordMutation } from '#/hooks/use-users-query'
import type { Queue } from '#/schemas/cases.schema'
import type { UserFormValues, UserListItem } from '#/schemas/users.schema'
import {
  USER_GENDER_LABELS,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  roleTypes,
  userFormSchema,
} from '#/schemas/users.schema'
import { cn } from '#/lib/utils'

function SectionIcon({
  icon: Icon,
  colorClass,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
}) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        colorClass,
      )}
    >
      <Icon className="size-5" />
    </div>
  )
}

function QueueAccessSelect({
  label,
  queues,
  selectedIds,
  isAllSelected,
  onChangeSelectedIds,
  placeholder,
  showAllOption = true,
  onSelectAll,
  disabled = false,
}: {
  label: string
  queues: Queue[]
  selectedIds: string[]
  isAllSelected: boolean
  onChangeSelectedIds: (value: string[]) => void
  placeholder: string
  showAllOption?: boolean
  onSelectAll?: () => void
  disabled?: boolean
}) {
  const selectedIdsSet = new Set(selectedIds)
  const selectedQueues = queues.filter((queue) => selectedIdsSet.has(queue.id))

  const toggleQueue = (queueId: string) => {
    if (isAllSelected) {
      onChangeSelectedIds([queueId])
    } else if (selectedIdsSet.has(queueId)) {
      onChangeSelectedIds(selectedIds.filter((id) => id !== queueId))
    } else {
      onChangeSelectedIds([...selectedIds, queueId])
    }
  }

  const triggerLabel = isAllSelected
    ? 'All Queues'
    : selectedQueues.length === 0
      ? placeholder
      : selectedQueues.length === 1
        ? selectedQueues[0].name
        : `${selectedQueues.length} queues selected`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-9 w-full min-w-0 justify-between"
          disabled={disabled}
        >
          <span className="min-w-0 truncate text-left">{triggerLabel}</span>
          <ChevronsUpDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] min-w-72 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No queues found.</CommandEmpty>
            <ScrollArea className="max-h-72">
              {showAllOption && onSelectAll ? (
                <>
                  <CommandGroup>
                    <CommandItem value="all-queues" onSelect={onSelectAll}>
                      <CheckIcon
                        className={cn(
                          'opacity-0',
                          isAllSelected && 'opacity-100',
                        )}
                      />

                      <span className="min-w-0 flex-1 truncate">
                        All Queues
                      </span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              ) : null}
              <CommandGroup>
                {queues.map((queue) => {
                  const selected =
                    !isAllSelected && selectedIdsSet.has(queue.id)
                  return (
                    <CommandItem
                      key={queue.id}
                      value={queue.name}
                      onSelect={() => toggleQueue(queue.id)}
                    >
                      <CheckIcon
                        className={cn('opacity-0', selected && 'opacity-100')}
                      />

                      <span className="min-w-0 flex-1 truncate">
                        {queue.name}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
        {!isAllSelected && selectedIds.length > 0 ? (
          <>
            <Separator />
            <div className="p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onChangeSelectedIds([])}
              >
                Clear queues
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
      {isAllSelected || selectedQueues.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1">
          {isAllSelected ? <Badge variant="secondary">All Queues</Badge> : null}
          {!isAllSelected &&
            selectedQueues.slice(0, 4).map((queue) => (
              <Badge key={queue.id} variant="secondary">
                <span className="max-w-48 truncate">{queue.name}</span>
              </Badge>
            ))}
          {!isAllSelected && selectedQueues.length > 4 ? (
            <Badge variant="secondary">+{selectedQueues.length - 4}</Badge>
          ) : null}
        </div>
      ) : null}
    </Popover>
  )
}

function getDefaultValues(user?: UserListItem): UserFormValues {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    username: user?.username ?? '',
    gender: user?.gender ?? 'male',
    roleType: user?.roleType ?? 'agent',
    status: user?.status ?? 'active',
    queueViewScope: user?.queueViewScope ?? 'all',
    viewQueueIds: user?.viewQueueIds ?? [],
    workQueueIds: user?.workQueueIds ?? [],
  }
}

export function UserForm({
  user,
  mode,
  onSubmit,
  disabled = false,
  disabledReason,
}: {
  user?: UserListItem
  mode: 'create' | 'edit'
  onSubmit: (value: UserFormValues) => Promise<void>
  disabled?: boolean
  disabledReason?: string
}) {
  const { user: currentUser } = useAuth()
  const queuesQuery = useQuery(queuesQueryOptions())
  const resetPasswordMutation = useSendUserResetPasswordMutation()
  const queues = queuesQuery.data ?? []
  const isSuperAdminUser = user?.roleType === 'super_admin'
  const isRoleLocked = mode === 'edit' && isSuperAdminUser

  const roleOptions = (() => {
    const editableRoles = new Set<UserFormValues['roleType']>(
      currentUser?.roleType === 'super_admin'
        ? (['admin', 'agent'] as const)
        : (['agent'] as const),
    )

    if (isSuperAdminUser) {
      return roleTypes.filter((role) => role === 'super_admin')
    }

    return roleTypes.filter((role) => editableRoles.has(role))
  })()

  const form = useForm({
    defaultValues: getDefaultValues(user),
    validators: {
      onSubmit: userFormSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  const roleType = useStore(form.store, (state) => state.values.roleType)
  const queueViewScope = useStore(
    form.store,
    (state) => state.values.queueViewScope,
  )
  const viewQueueIds = useStore(
    form.store,
    (state) => state.values.viewQueueIds,
  )
  const workQueueIds = useStore(
    form.store,
    (state) => state.values.workQueueIds,
  )
  const viewQueueIdSet = new Set(viewQueueIds)
  const visibleWorkQueues =
    queueViewScope === 'all'
      ? queues
      : queues.filter((queue) => viewQueueIdSet.has(queue.id))
  const allVisibleWorkQueueIds = visibleWorkQueues.map((queue) => queue.id)
  const workQueueIdSet = new Set(workQueueIds)
  const isAllWorkQueuesSelected =
    allVisibleWorkQueueIds.length > 0 &&
    allVisibleWorkQueueIds.every((queueId) => workQueueIdSet.has(queueId))

  if (queuesQuery.isPending) {
    return <UserFormSkeleton />
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-1 flex-col gap-6"
    >
      {disabledReason ? (
        <Alert>
          <AlertTitle>Editing is restricted</AlertTitle>
          <AlertDescription>{disabledReason}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <SectionIcon
              icon={UserRoundIcon}
              colorClass="bg-blue-500/10 text-blue-500"
            />

            <div className="min-w-0">
              <CardTitle>Employee Details</CardTitle>
              <CardDescription>
                Name, login identity, role, and employee status.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-6 sm:grid-cols-2">
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={isInvalid}
                      disabled={disabled}
                    />

                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="email">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      id={field.name}
                      type="email"
                      placeholder="name@assanpay.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={isInvalid}
                      disabled={disabled || mode === 'edit'}
                    />

                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="username">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={isInvalid}
                      disabled={disabled || mode === 'edit'}
                    />

                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="gender">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>Gender</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) =>
                        field.handleChange(value as UserFormValues['gender'])
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger
                        aria-invalid={isInvalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="male">
                            {USER_GENDER_LABELS.male}
                          </SelectItem>
                          <SelectItem value="female">
                            {USER_GENDER_LABELS.female}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="roleType">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>Role</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        const nextRole = value as UserFormValues['roleType']
                        field.handleChange(nextRole)
                        if (nextRole !== 'agent') {
                          form.setFieldValue('queueViewScope', 'all')
                          form.setFieldValue('viewQueueIds', [])
                          form.setFieldValue('workQueueIds', [])
                        }
                      }}
                      disabled={disabled || isRoleLocked}
                    >
                      <SelectTrigger
                        aria-invalid={isInvalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {USER_ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            {mode === 'edit' ? (
              <form.Field name="status">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel>Status</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value as UserFormValues['status'])
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger
                          aria-invalid={isInvalid}
                          className="w-full"
                        >
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="active">
                              {USER_STATUS_LABELS.active}
                            </SelectItem>
                            <SelectItem value="inactive">
                              {USER_STATUS_LABELS.inactive}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {isInvalid ? (
                        <FieldError errors={field.state.meta.errors} />
                      ) : null}
                    </Field>
                  )
                }}
              </form.Field>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      {roleType === 'agent' ? (
        <Card>
          <CardHeader>
            <div className="flex min-w-0 items-center gap-3">
              <SectionIcon
                icon={ListChecksIcon}
                colorClass="bg-teal-500/10 text-teal-500"
              />

              <div className="min-w-0">
                <CardTitle>Queue Access</CardTitle>
                <CardDescription>
                  View access controls visible queues; working access controls
                  ownership.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-6 lg:grid-cols-2">
              <div className="min-w-0">
                <form.Field name="viewQueueIds">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel>View Access</FieldLabel>
                        <QueueAccessSelect
                          label="View Access"
                          queues={queues}
                          selectedIds={field.state.value}
                          isAllSelected={queueViewScope === 'all'}
                          onSelectAll={() => {
                            form.setFieldValue('queueViewScope', 'all')
                            field.handleChange([])
                          }}
                          onChangeSelectedIds={(value) => {
                            const selectedQueueIdSet = new Set(value)
                            form.setFieldValue('queueViewScope', 'selected')
                            field.handleChange(value)
                            form.setFieldValue(
                              'workQueueIds',
                              form.state.values.workQueueIds.filter((queueId) =>
                                selectedQueueIdSet.has(queueId),
                              ),
                            )
                          }}
                          placeholder="Select view queues"
                          disabled={disabled || queuesQuery.isLoading}
                        />

                        <FieldDescription>
                          Agents can only see cases in queues they can view.
                        </FieldDescription>
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    )
                  }}
                </form.Field>
              </div>

              <div className="min-w-0">
                <form.Field name="workQueueIds">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel>Working Access</FieldLabel>
                        <QueueAccessSelect
                          label="Working Access"
                          queues={visibleWorkQueues}
                          selectedIds={field.state.value}
                          isAllSelected={
                            queueViewScope === 'all' && isAllWorkQueuesSelected
                          }
                          onChangeSelectedIds={field.handleChange}
                          placeholder="Select working queues"
                          showAllOption={queueViewScope === 'all'}
                          onSelectAll={() =>
                            field.handleChange(allVisibleWorkQueueIds)
                          }
                          disabled={
                            disabled ||
                            (queueViewScope === 'selected' &&
                              viewQueueIds.length === 0)
                          }
                        />

                        <FieldDescription>
                          Only these queues can be taken into ownership by this
                          agent.
                        </FieldDescription>
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    )
                  }}
                </form.Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-end gap-3">
        {mode === 'edit' && user ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => resetPasswordMutation.mutate(user.id)}
            disabled={disabled || resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCcwIcon data-icon="inline-start" />
            )}
            Reset Password
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset()}
          disabled={disabled}
        >
          Reset
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={disabled || isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {mode === 'create'
                ? isSubmitting
                  ? 'Creating...'
                  : 'Create User'
                : isSubmitting
                  ? 'Saving...'
                  : 'Save Changes'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

export function UserFormSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Field key={index}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </Field>
            ))}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Field key={index}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </Field>
            ))}
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="mt-auto flex justify-end gap-3">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  )
}
