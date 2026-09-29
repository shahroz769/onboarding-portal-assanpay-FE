import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ClipboardList,
  Clock3,
  FileSearch,
  FlaskConical,
  Globe,
  IdCard,
  Layers,
  ListOrdered,
  Rocket,
  Signature,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'
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
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import {
  queueLifecycleBadgeClasses,
  queueWorkflowBadgeClasses,
} from '#/lib/status-styles'
import { DEFAULT_SLA_HOURS } from '#/lib/sla'
import { useUpdateQueueSlaMutation } from '#/hooks/use-configuration-query'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import type {
  Queue,
  QueueLifecycle,
  QueueWorkflowType,
} from '#/schemas/cases.schema'

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

const LIFECYCLE_META: Record<QueueLifecycle, { label: string }> = {
  active: { label: 'Active' },
  draft: { label: 'Draft' },
  inactive: { label: 'Inactive' },
}

function lifecycleLabel(queue: {
  lifecycle?: QueueLifecycle | null
  isActive?: boolean | null
}): QueueLifecycle {
  if (queue.lifecycle) return queue.lifecycle
  return queue.isActive === false ? 'inactive' : 'active'
}

function QueueIdentityCell({ queue }: { queue: Queue }) {
  return (
    <div className="min-w-0">
      <span className="block truncate text-sm font-medium">{queue.name}</span>
      <span className="block truncate font-mono text-xs text-muted-foreground">
        {queue.slug}
      </span>
    </div>
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
  const { label } = LIFECYCLE_META[lifecycle]
  return (
    <Badge
      variant="secondary"
      className={queueLifecycleBadgeClasses(lifecycle) || undefined}
    >
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
  const columns: DataTableColumnDef<Queue>[] = [
    {
      id: 'name',
      header: 'Queue',
      width: 260,
      cell: (queue) => <QueueIdentityCell queue={queue} />,
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
  ]
  return (
    <>
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
            description="Queues are added by developers through a release."
          />
        }
      />
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
