import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CircleCheck,
  CircleDashed,
  CirclePause,
  ClipboardList,
  Clock3,
  FileSearch,
  FlaskConical,
  Globe,
  IdCard,
  Layers,
  ListOrdered,
  Pause,
  Play,
  Plus,
  Rocket,
  ShieldCheck,
  Signature,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Spinner } from '#/components/ui/spinner'
import { Switch } from '#/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'
import {
  queueLifecycleBadgeClasses,
  queueWorkflowBadgeClasses,
  statusTint,
} from '#/lib/status-styles'
import { DEFAULT_SLA_HOURS } from '#/lib/sla'
import {
  isQueueRevisionConflict,
  queueDetailQueryOptions,
  useCreateQueueMutation,
  useUpdateQueueMutation,
  useUpdateQueueSlaMutation,
  useUpdateQueueStatusMutation,
} from '#/hooks/use-configuration-query'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import type {
  Queue,
  QueueLifecycle,
  QueueWorkflowType,
} from '#/schemas/cases.schema'
import { ConfigurationHeaderActions } from './configuration-panel-shared'

const STAGE_GRID_COLUMNS =
  'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_76px_132px_56px]'

const WORKFLOW_OPTIONS: Array<{
  value: QueueWorkflowType
  label: string
  icon: LucideIcon
}> = [
  { value: 'generic', label: 'Generic', icon: Layers },
  { value: 'document_review', label: 'Document review', icon: FileSearch },
  { value: 'agreement', label: 'Agreement', icon: Signature },
  { value: 'mid', label: 'MID', icon: IdCard },
  { value: 'testing', label: 'Testing', icon: FlaskConical },
  { value: 'wordpress', label: 'WordPress', icon: Globe },
  { value: 'live', label: 'Live', icon: Rocket },
  {
    value: 'sub_merchant_form',
    label: 'Sub-merchant form',
    icon: ClipboardList,
  },
]

const LIFECYCLE_META: Record<
  QueueLifecycle,
  { label: string; icon: LucideIcon }
> = {
  active: { label: 'Active', icon: CircleCheck },
  draft: { label: 'Draft', icon: CircleDashed },
  inactive: { label: 'Inactive', icon: CirclePause },
}

function lifecycleLabel(queue: {
  lifecycle?: QueueLifecycle | null
  isActive?: boolean | null
}): QueueLifecycle {
  if (queue.lifecycle) return queue.lifecycle
  return queue.isActive === false ? 'inactive' : 'active'
}

type EditingQueue = { id: string; name: string }

function QueueIdentityCell({
  queue,
  onEdit,
}: {
  queue: Queue
  onEdit: (queue: EditingQueue) => void
}) {
  return (
    // Opens the stage editor, like the Edit stages action.
    <button
      type="button"
      onClick={() => onEdit({ id: queue.id, name: queue.name })}
      aria-label={`Edit stages for ${queue.name}`}
      className="group/identity block max-w-full min-w-0 cursor-pointer rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="block truncate text-sm font-medium text-primary group-hover/identity:underline group-hover/identity:decoration-dashed group-hover/identity:underline-offset-4">
        {queue.name}
      </span>
      <span className="block truncate font-mono text-xs text-muted-foreground group-hover/identity:text-primary">
        {queue.slug}
      </span>
    </button>
  )
}

function WorkflowBadge({ workflowType }: { workflowType: QueueWorkflowType }) {
  const option = WORKFLOW_OPTIONS.find((item) => item.value === workflowType)
  const Icon = option?.icon ?? Layers
  return (
    <Badge
      variant="secondary"
      className={queueWorkflowBadgeClasses(workflowType) || undefined}
    >
      <Icon />
      {option?.label ?? workflowType}
    </Badge>
  )
}

function LifecycleBadge({ lifecycle }: { lifecycle: QueueLifecycle }) {
  const { label, icon: Icon } = LIFECYCLE_META[lifecycle]
  return (
    <Badge
      variant="secondary"
      className={queueLifecycleBadgeClasses(lifecycle) || undefined}
    >
      <Icon />
      {label}
    </Badge>
  )
}

export function QueuesPanel() {
  const {
    data: queues = [],
    isPending,
    error,
    refetch,
  } = useQuery(
    queuesQueryOptions({
      includeInactive: true,
    }),
  )
  const updateStatus = useUpdateQueueStatusMutation()
  // One controlled stage editor for the table; the queue stays set after
  // close so the dialog keeps its content through the exit animation.
  const [editingQueue, setEditingQueue] = useState<EditingQueue | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const openEditor = (queue: EditingQueue) => {
    setEditingQueue(queue)
    setEditorOpen(true)
  }
  const columns: DataTableColumnDef<Queue>[] = [
    {
      id: 'name',
      header: 'Queue',
      width: 260,
      cell: (queue) => <QueueIdentityCell queue={queue} onEdit={openEditor} />,
    },
    {
      id: 'workflowType',
      header: 'Workflow',
      width: 190,
      cell: (queue) => <WorkflowBadge workflowType={queue.workflowType} />,
    },
    {
      id: 'prefix',
      header: 'Prefix',
      width: 100,
      cell: (queue) => (
        <Badge variant="outline" className="font-mono tracking-wide">
          {queue.prefix}
        </Badge>
      ),
    },
    {
      id: 'sla',
      header: 'SLA',
      width: 140,
      cell: (queue) => (
        <QueueSlaCell
          queueId={queue.id}
          queueName={queue.name}
          slaHours={queue.slaHours ?? DEFAULT_SLA_HOURS}
          revision={queue.revision}
        />
      ),
    },
    {
      id: 'qc',
      header: 'QC',
      width: 90,
      cell: (queue) =>
        queue.qcEnabled ? (
          <Badge variant="secondary" className={statusTint('purple')}>
            <ShieldCheck />
            On
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Off</span>
        ),
    },
    {
      id: 'status',
      header: 'Lifecycle',
      width: 130,
      cell: (queue) => <LifecycleBadge lifecycle={lifecycleLabel(queue)} />,
    },
    {
      id: 'createdAt',
      header: 'Created',
      width: 140,
      cell: (queue) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(queue.createdAt), 'MMM dd, yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="block text-right">Actions</span>,
      width: 110,
      cell: (queue) => {
        const lifecycle = lifecycleLabel(queue)
        const nextLifecycle = lifecycle === 'active' ? 'inactive' : 'active'
        return (
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      openEditor({ id: queue.id, name: queue.name })
                    }
                  />
                }
              >
                <ListOrdered className="size-4" />
                <span className="sr-only">Edit stages</span>
              </TooltipTrigger>
              <TooltipContent>Edit stages</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={updateStatus.isPending}
                    onClick={() =>
                      updateStatus.mutate({
                        queueId: queue.id,
                        lifecycle: nextLifecycle,
                        revision: queue.revision,
                      })
                    }
                  />
                }
              >
                {lifecycle === 'active' ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                <span className="sr-only">
                  {lifecycle === 'active' ? 'Deactivate' : 'Activate'}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {lifecycle === 'active' ? 'Deactivate' : 'Activate'}
              </TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
  ]
  return (
    <>
      <ConfigurationHeaderActions>
        <CreateQueueDialog />
      </ConfigurationHeaderActions>
      <DataTable
        columns={columns}
        data={queues}
        getRowId={(queue) => queue.id}
        isLoading={isPending}
        error={error}
        onRetry={() => void refetch()}
        emptyContent={
          <EmptyState
            icon={ListOrdered}
            title="No queues configured."
            description="Use Create Queue to add one."
          />
        }
      />
      {editingQueue ? (
        <QueueEditorDialog
          queueId={editingQueue.id}
          queueName={editingQueue.name}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      ) : null}
    </>
  )
}
function CreateQueueDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [prefix, setPrefix] = useState('')
  const [workflowType, setWorkflowType] = useState<QueueWorkflowType>('generic')
  const [touched, setTouched] = useState(false)
  const createQueue = useCreateQueueMutation()
  const nameError = !name.trim() ? 'Name is required.' : null
  const slugError = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())
    ? 'Slug must be lowercase alphanumeric with hyphens.'
    : null
  const prefixError = !/^[A-Z]{1,4}$/.test(prefix.trim())
    ? 'Prefix must be 1-4 uppercase letters.'
    : null
  function reset() {
    setName('')
    setSlug('')
    setPrefix('')
    setWorkflowType('generic')
    setTouched(false)
  }
  function handleSubmit() {
    setTouched(true)
    if (nameError || slugError || prefixError) return
    createQueue.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        prefix: prefix.trim(),
        workflowType,
        lifecycle: 'draft',
      },
      { onSuccess: () => setOpen(false) },
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (createQueue.isPending) return
        setOpen(next)
      }}
      // Reset after the exit animation so the form doesn't blank out mid-fade.
      onOpenChangeComplete={(next) => {
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <Plus data-icon="inline-start" />
        Create queue
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create queue</DialogTitle>
          <DialogDescription>
            Queues are created as drafts with stages from the selected workflow
            template. Activate after stages are ready.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={touched && nameError ? true : undefined}>
            <FieldLabel htmlFor="queue-name">Name</FieldLabel>
            <Input
              id="queue-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {touched && nameError ? <FieldError>{nameError}</FieldError> : null}
          </Field>
          <Field data-invalid={touched && slugError ? true : undefined}>
            <FieldLabel htmlFor="queue-slug">Slug</FieldLabel>
            <Input
              id="queue-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
            {touched && slugError ? <FieldError>{slugError}</FieldError> : null}
          </Field>
          <Field data-invalid={touched && prefixError ? true : undefined}>
            <FieldLabel htmlFor="queue-prefix">Prefix</FieldLabel>
            <Input
              id="queue-prefix"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value.toUpperCase())}
            />
            {touched && prefixError ? (
              <FieldError>{prefixError}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel>Workflow type</FieldLabel>
            <Select
              items={WORKFLOW_OPTIONS}
              value={workflowType}
              onValueChange={(value) =>
                setWorkflowType(value as QueueWorkflowType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <option.icon />
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createQueue.isPending}
          >
            {createQueue.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function QueueEditorDialog({
  queueId,
  queueName,
  open,
  onOpenChange: setOpen,
}: {
  queueId: string
  queueName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [staleOpen, setStaleOpen] = useState(false)
  const detailQuery = useQuery({
    ...queueDetailQueryOptions(queueId),
    enabled: open,
  })
  const updateQueue = useUpdateQueueMutation()
  const detail = detailQuery.data
  const [stageDraft, setStageDraft] = useState<Array<{
    name: string
    slug: string
    order: number
    category: 'new' | 'in_progress' | 'qc' | 'error' | 'closed'
    isActive: boolean
  }> | null>(null)
  const stages =
    stageDraft ??
    detail?.stages.map((stage) => ({
      name: stage.name,
      slug: stage.slug,
      order: stage.order,
      category: stage.category as
        'new' | 'in_progress' | 'qc' | 'error' | 'closed',
      isActive: stage.isActive,
    })) ??
    []
  async function handleSave() {
    if (!detail) return
    try {
      await updateQueue.mutateAsync({
        queueId,
        revision: detail.revision,
        stages,
      })
      setOpen(false)
    } catch (error) {
      if (isQueueRevisionConflict(error)) {
        setStaleOpen(true)
        return
      }
      // toast handled by mutation unless revision conflict
    }
  }
  async function handleActivate() {
    if (!detail) return
    try {
      await updateQueue.mutateAsync({
        queueId,
        revision: detail.revision,
        lifecycle: 'active',
        stages,
      })
      setOpen(false)
    } catch (error) {
      if (isQueueRevisionConflict(error)) {
        setStaleOpen(true)
        return
      }
    }
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        // Drop the draft after the exit animation so edited stages don't
        // snap back to the saved ones while the dialog fades out.
        onOpenChangeComplete={(nextOpen) => {
          if (!nextOpen) setStageDraft(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit stages — {queueName}</DialogTitle>
            <DialogDescription>
              Update stage names, order, and active flags. Referenced stages
              cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isPending || !detail ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              {!detail.activation.ready ? (
                <Alert variant="destructive">
                  <AlertTitle>Not activation-ready</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {detail.activation.issues.map((issue) => (
                        <li key={issue.code}>{issue.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="success">
                  <AlertTitle>Ready to activate</AlertTitle>
                  <AlertDescription>
                    Stages, prefix, and sequence look valid.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col gap-2">
                <div
                  className={cn(
                    'hidden gap-2 px-3 md:grid',
                    STAGE_GRID_COLUMNS,
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    Name
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Slug
                  </span>
                  <span className="text-right text-xs font-medium text-muted-foreground">
                    Order
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Category
                  </span>
                  <span className="text-right text-xs font-medium text-muted-foreground">
                    Active
                  </span>
                </div>
                {stages.map((stage, index) => (
                  <div
                    key={stage.slug}
                    className={cn(
                      'grid gap-2 rounded-md border bg-background p-3 md:items-center',
                      STAGE_GRID_COLUMNS,
                    )}
                  >
                    <Input
                      value={stage.name}
                      aria-label="Stage name"
                      onChange={(event) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          name: event.target.value,
                        }
                        setStageDraft(next)
                      }}
                      placeholder="Name"
                    />
                    <Input
                      value={stage.slug}
                      aria-label="Stage slug"
                      className="font-mono text-xs"
                      onChange={(event) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          slug: event.target.value,
                        }
                        setStageDraft(next)
                      }}
                      placeholder="Slug"
                    />
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={stage.order}
                      aria-label="Stage order"
                      className="text-right tabular-nums"
                      onChange={(event) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          order: Number(event.target.value),
                        }
                        setStageDraft(next)
                      }}
                    />
                    <Select
                      items={[
                        'new',
                        'in_progress',
                        'qc',
                        'error',
                        'closed',
                      ].map((value) => ({ value, label: value }))}
                      value={stage.category}
                      onValueChange={(value) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          category: value as typeof stage.category,
                        }
                        setStageDraft(next)
                      }}
                    >
                      <SelectTrigger aria-label="Stage category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">new</SelectItem>
                        <SelectItem value="in_progress">in_progress</SelectItem>
                        <SelectItem value="qc">qc</SelectItem>
                        <SelectItem value="error">error</SelectItem>
                        <SelectItem value="closed">closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex md:justify-end">
                      <Switch
                        checked={stage.isActive}
                        aria-label={`${stage.name} is ${stage.isActive ? 'active' : 'inactive'}`}
                        onCheckedChange={(checked) => {
                          const next = [...stages]
                          next[index] = {
                            ...stage,
                            isActive: checked,
                          }
                          setStageDraft(next)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="secondary"
              disabled={!detail || updateQueue.isPending}
              onClick={() => void handleActivate()}
            >
              Save & activate
            </Button>
            <Button
              type="button"
              disabled={!detail || updateQueue.isPending}
              onClick={() => void handleSave()}
            >
              {updateQueue.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Save stages
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={staleOpen} onOpenChange={setStaleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Queue was updated elsewhere</AlertDialogTitle>
            <AlertDialogDescription>
              Reload the queue detail and try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['queue-detail', queueId],
                })
                setStageDraft(null)
                setStaleOpen(false)
              }}
            >
              Reload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
function QueueSlaCell({
  queueId,
  queueName,
  slaHours,
  revision,
}: {
  queueId: string
  queueName: string
  slaHours: number
  revision?: number
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(slaHours))
  const updateSla = useUpdateQueueSlaMutation()
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setValue(String(slaHours))
    }
    setOpen(nextOpen)
  }
  const parsed = Number(value)
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 8760
  function handleSave() {
    if (!isValid) return
    updateSla.mutate(
      {
        queueId,
        slaHours: parsed,
        revision,
      },
      {
        onSuccess: () => setOpen(false),
      },
    )
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* A plain button, not <Button>: the button size variants add
          `has-[>svg]:px-3`, which would indent the icon off the column edge. */}
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline hover:decoration-dashed hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Clock3 className="size-3.5 text-muted-foreground" />
        <span className="tabular-nums">{slaHours}</span>
        {slaHours === 1 ? 'hour' : 'hours'}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit SLA</DialogTitle>
          <DialogDescription>
            Set the SLA in hours for the {queueName} queue. Cases breach this
            SLA when the configured hours pass after creation.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={!isValid ? true : undefined}>
            <FieldLabel htmlFor={`sla-${queueId}`}>SLA in Hours</FieldLabel>
            <Input
              id={`sla-${queueId}`}
              type="number"
              min={1}
              max={8760}
              step={1}
              inputMode="numeric"
              value={value}
              aria-invalid={!isValid ? true : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isValid || updateSla.isPending}
          >
            {updateSla.isPending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
