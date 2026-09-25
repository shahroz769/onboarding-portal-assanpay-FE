import type { ComponentType, ReactNode, SVGProps } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import { ListChecksIcon, RotateCcwIcon, UserRoundIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button, ButtonLink } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '#/components/ui/combobox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
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
import type { StatusTint } from '#/lib/status-styles'
import { SectionIcon } from '#/components/section-icon'

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

const ALL_QUEUES = '__all_queues__'

function QueueAccessCombobox({
  queues,
  selectedIds,
  isAllSelected,
  onChangeSelectedIds,
  onSelectAll,
  placeholder,
  disabled = false,
  invalid = false,
}: {
  queues: Queue[]
  selectedIds: string[]
  isAllSelected: boolean
  onChangeSelectedIds: (value: string[]) => void
  onSelectAll?: () => void
  placeholder: string
  disabled?: boolean
  invalid?: boolean
}) {
  const anchor = useComboboxAnchor()
  const queueNameById = new Map(queues.map((queue) => [queue.id, queue.name]))
  const items = [
    ...(onSelectAll ? [ALL_QUEUES] : []),
    ...queues.map((queue) => queue.id),
  ]
  const value = isAllSelected ? [ALL_QUEUES] : selectedIds
  const getLabel = (id: string) =>
    id === ALL_QUEUES ? 'All Queues' : (queueNameById.get(id) ?? id)

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={value}
      disabled={disabled}
      itemToStringLabel={getLabel}
      onValueChange={(next: string[]) => {
        if (onSelectAll && next.includes(ALL_QUEUES) && !isAllSelected) {
          onSelectAll()
          return
        }
        onChangeSelectedIds(next.filter((id) => id !== ALL_QUEUES))
      }}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map((id) => (
                <ComboboxChip key={id} className="max-w-full">
                  <span className="min-w-0 truncate">{getLabel(id)}</span>
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={values.length > 0 ? undefined : placeholder}
                aria-invalid={invalid}
                disabled={disabled}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No queues found.</ComboboxEmpty>
        <ComboboxList>
          {(id: string) => (
            <ComboboxItem key={id} value={id}>
              <span className="min-w-0 flex-1 truncate">{getLabel(id)}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

type UserFormLayout = 'page' | 'dialog'

function UserFormSection({
  layout,
  icon,
  tone,
  title,
  description,
  children,
}: {
  layout: UserFormLayout
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: StatusTint
  title: string
  description: string
  children: ReactNode
}) {
  const heading = (
    <div className="flex min-w-0 items-center gap-3">
      <SectionIcon icon={icon} tone={tone} />

      <div className="min-w-0">
        {layout === 'dialog' ? (
          <>
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </>
        ) : (
          <>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </>
        )}
      </div>
    </div>
  )

  if (layout === 'dialog') {
    return (
      <section className="flex min-w-0 flex-col gap-4">
        {heading}
        {children}
      </section>
    )
  }

  return (
    <Card>
      <CardHeader>{heading}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
  layout = 'page',
  onCancel,
}: {
  user?: UserListItem
  mode: 'create' | 'edit'
  onSubmit: (value: UserFormValues) => Promise<void>
  disabled?: boolean
  disabledReason?: string
  layout?: UserFormLayout
  onCancel?: () => void
}) {
  const isDialog = layout === 'dialog'
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
  const canChooseRole = roleOptions.length > 1

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
  const isAgent = roleType === 'agent'
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
    return isDialog ? (
      <div className="flex h-48 items-center justify-center">
        <Spinner />
      </div>
    ) : (
      <UserFormSkeleton />
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      className={cn(
        'flex w-full flex-col',
        isDialog ? 'min-h-0 flex-1' : 'flex-1 gap-6',
      )}
    >
      {disabledReason ? (
        <Alert>
          <AlertTitle>Editing is restricted</AlertTitle>
          <AlertDescription>{disabledReason}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          'grid items-start gap-6',
          isDialog
            ? 'min-h-0 flex-1 overflow-y-auto px-6 py-4'
            : 'xl:grid-cols-2',
        )}
      >
        <UserFormSection
          layout={layout}
          icon={UserRoundIcon}
          tone="blue"
          title="Employee Details"
          description={
            mode === 'create'
              ? 'Basic identity, login, and role for the new employee.'
              : 'Name, login identity, role, and employee status.'
          }
        >
          <FieldGroup className="grid gap-6 sm:grid-cols-2">
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Name <RequiredMark />
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      autoComplete="off"
                      autoFocus={mode === 'create'}
                      placeholder="e.g. Ayesha Khan"
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
                    <FieldLabel htmlFor={field.name}>
                      Email <RequiredMark />
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="email"
                      placeholder="name@assanpay.com"
                      autoComplete="off"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={isInvalid}
                      disabled={disabled || mode === 'edit'}
                    />

                    {mode === 'edit' ? (
                      <FieldDescription>
                        Email cannot be changed after the account is created.
                      </FieldDescription>
                    ) : null}
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
                    <FieldLabel htmlFor={field.name}>
                      Username <RequiredMark />
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      autoComplete="off"
                      placeholder="e.g. ayesha.khan"
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={isInvalid}
                      disabled={disabled || mode === 'edit'}
                    />

                    {mode === 'edit' ? (
                      <FieldDescription>
                        Username cannot be changed after the account is created.
                      </FieldDescription>
                    ) : null}
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
                      items={[
                        { value: 'male', label: USER_GENDER_LABELS.male },
                        { value: 'female', label: USER_GENDER_LABELS.female },
                      ]}
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
                      items={roleOptions.map((role) => ({
                        value: role,
                        label: USER_ROLE_LABELS[role],
                      }))}
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
                      disabled={disabled || isRoleLocked || !canChooseRole}
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
                    <FieldDescription>
                      {!isRoleLocked && !canChooseRole
                        ? 'Admins can only create and manage agent accounts.'
                        : field.state.value === 'agent'
                          ? 'Agents only see cases from their assigned queues.'
                          : 'Full access to every queue, no assignment needed.'}
                    </FieldDescription>
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
                        items={[
                          {
                            value: 'active',
                            label: USER_STATUS_LABELS.active,
                          },
                          {
                            value: 'inactive',
                            label: USER_STATUS_LABELS.inactive,
                          },
                        ]}
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
        </UserFormSection>

        {isDialog ? <Separator /> : null}

        <UserFormSection
          layout={layout}
          icon={ListChecksIcon}
          tone="teal"
          title="Queue Access"
          description={
            isAgent
              ? 'Choose which case queues this agent can view, and which of those they can take ownership from.'
              : 'Queue assignments only apply to agents. This role has access to every queue.'
          }
        >
          <FieldGroup
            className={cn(
              'grid gap-6',
              isDialog
                ? 'sm:grid-cols-2'
                : 'lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2',
            )}
          >
            <div className="min-w-0">
              <form.Field name="viewQueueIds">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel>View Access</FieldLabel>
                      <QueueAccessCombobox
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
                        disabled={disabled || !isAgent || queuesQuery.isLoading}
                        invalid={isInvalid}
                      />

                      <FieldDescription>
                        {isAgent
                          ? 'Agents can only see cases in queues they can view.'
                          : 'This role can view every queue.'}
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
                      <QueueAccessCombobox
                        queues={visibleWorkQueues}
                        selectedIds={field.state.value}
                        isAllSelected={
                          queueViewScope === 'all' &&
                          (!isAgent || isAllWorkQueuesSelected)
                        }
                        onChangeSelectedIds={field.handleChange}
                        placeholder="Select working queues"
                        onSelectAll={
                          queueViewScope === 'all'
                            ? () => field.handleChange(allVisibleWorkQueueIds)
                            : undefined
                        }
                        invalid={isInvalid}
                        disabled={
                          disabled ||
                          !isAgent ||
                          (queueViewScope === 'selected' &&
                            viewQueueIds.length === 0)
                        }
                      />

                      <FieldDescription>
                        {isAgent
                          ? 'Only these queues can be taken into ownership by this agent.'
                          : 'This role can take ownership from every queue.'}
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
        </UserFormSection>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-end gap-3 border-t',
          isDialog
            ? 'bg-muted/50 px-6 py-4'
            : 'sticky bottom-0 z-10 mt-auto bg-background/90 py-4 backdrop-blur-sm',
        )}
      >
        <div className="mr-auto flex items-center gap-3">
          {mode === 'edit' &&
          user &&
          currentUser?.roleType === 'super_admin' ? (
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
        </div>
        {disabled || onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : (
          <ButtonLink
            variant="ghost"
            render={<Link to="/user-management" />}
          >
            Cancel
          </ButtonLink>
        )}
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
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-2">
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
      </div>

      <div className="mt-auto flex justify-end gap-3 border-t py-4">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  )
}
