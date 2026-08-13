import { useEffect, useMemo, useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Plus, Workflow } from 'lucide-react'

import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
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
import type { QueueLifecycle, QueueWorkflowType } from '#/schemas/cases.schema'

import { ConfigurationSectionCard } from './configuration-panel-shared'

const WORKFLOW_OPTIONS: Array<{ value: QueueWorkflowType; label: string }> = [
  { value: 'generic', label: 'Generic' },
  { value: 'document_review', label: 'Document review' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'mid', label: 'MID' },
  { value: 'testing', label: 'Testing' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'card', label: 'Card' },
  { value: 'physical_agreement', label: 'Physical agreement' },
  { value: 'live', label: 'Live' },
  { value: 'sub_merchant_form', label: 'Sub-merchant form' },
]

function lifecycleLabel(queue: {
  lifecycle?: QueueLifecycle | null
  isActive?: boolean | null
}) {
  if (queue.lifecycle) return queue.lifecycle
  return queue.isActive === false ? 'inactive' : 'active'
}

function lifecycleBadgeVariant(lifecycle: string) {
  if (lifecycle === 'active') return 'secondary' as const
  if (lifecycle === 'draft') return 'outline' as const
  return 'outline' as const
}

export function QueuesPanel() {
  const { data: queues = [], isPending } = useQuery(
    queuesQueryOptions({ includeInactive: true }),
  )
  const updateStatus = useUpdateQueueStatusMutation()
  type Queue = (typeof queues)[number]
  const columns = useMemo<DataTableColumnDef<Queue>[]>(
    () => [
      {
        id: 'name',
        header: 'Queue',
        width: 220,
        cell: (queue) => (
          <span className="truncate font-medium">{queue.name}</span>
        ),
      },
      {
        id: 'slug',
        header: 'Slug',
        width: 180,
        cell: (queue) => (
          <span className="truncate font-mono text-xs">{queue.slug}</span>
        ),
      },
      {
        id: 'workflowType',
        header: 'Workflow',
        width: 160,
        cell: (queue) => (
          <span className="truncate font-mono text-xs">
            {queue.workflowType}
          </span>
        ),
      },
      {
        id: 'prefix',
        header: 'Prefix',
        width: 100,
        cell: (queue) => <span className="truncate">{queue.prefix}</span>,
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
        width: 120,
        cell: (queue) => {
          const lifecycle = lifecycleLabel(queue)
          return (
            <Badge variant={lifecycleBadgeVariant(lifecycle)}>
              {lifecycle}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: <span className="block text-right">Actions</span>,
        width: 280,
        cell: (queue) => {
          const lifecycle = lifecycleLabel(queue)
          return (
            <div className="flex justify-end gap-2">
              <QueueEditorDialog queueId={queue.id} queueName={queue.name} />
              <Button
                variant="outline"
                size="sm"
                disabled={updateStatus.isPending || lifecycle === 'active'}
                onClick={() =>
                  updateStatus.mutate({
                    queueId: queue.id,
                    lifecycle: 'active',
                    revision: queue.revision,
                  })
                }
              >
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={updateStatus.isPending || lifecycle === 'inactive'}
                onClick={() =>
                  updateStatus.mutate({
                    queueId: queue.id,
                    lifecycle: 'inactive',
                    revision: queue.revision,
                  })
                }
              >
                Deactivate
              </Button>
            </div>
          )
        },
      },
    ],
    [updateStatus],
  )
  return (
    <ConfigurationSectionCard
      icon={Workflow}
      colorClass="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      title="Queues"
      description="Create queues with workflow types, edit stages, and manage lifecycle."
      action={<CreateQueueDialog />}
    >
      <DataTable
        columns={columns}
        data={queues}
        getRowId={(queue) => queue.id}
        isLoading={isPending}
        emptyContent={
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <p className="text-sm">No queues configured.</p>
          </div>
        }
      />
    </ConfigurationSectionCard>
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
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (createQueue.isPending) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus data-icon="inline-start" />
          Create queue
        </Button>
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
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
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
}: {
  queueId: string
  queueName: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [staleOpen, setStaleOpen] = useState(false)
  const detailQuery = useQuery({
    ...queueDetailQueryOptions(queueId),
    enabled: open,
  })
  const updateQueue = useUpdateQueueMutation()
  const detail = detailQuery.data
  const [stages, setStages] = useState<
    Array<{
      name: string
      slug: string
      order: number
      category: 'new' | 'in_progress' | 'qc' | 'error' | 'closed'
      isActive: boolean
    }>
  >([])

  useEffect(() => {
    if (!detail) return
    setStages(
      detail.stages.map((stage) => ({
        name: stage.name,
        slug: stage.slug,
        order: stage.order,
        category: stage.category as
          'new' | 'in_progress' | 'qc' | 'error' | 'closed',
        isActive: stage.isActive,
      })),
    )
  }, [detail])

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Stages
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
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
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div
                    key={`${stage.slug}-${index}`}
                    className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_90px_140px_auto]"
                  >
                    <Input
                      value={stage.name}
                      onChange={(event) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          name: event.target.value,
                        }
                        setStages(next)
                      }}
                      placeholder="Name"
                    />
                    <Input
                      value={stage.slug}
                      onChange={(event) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          slug: event.target.value,
                        }
                        setStages(next)
                      }}
                      placeholder="Slug"
                    />
                    <Input
                      type="number"
                      value={stage.order}
                      onChange={(event) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          order: Number(event.target.value),
                        }
                        setStages(next)
                      }}
                    />
                    <Select
                      value={stage.category}
                      onValueChange={(value) => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          category: value as typeof stage.category,
                        }
                        setStages(next)
                      }}
                    >
                      <SelectTrigger>
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = [...stages]
                        next[index] = {
                          ...stage,
                          isActive: !stage.isActive,
                        }
                        setStages(next)
                      }}
                    >
                      {stage.isActive ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
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
  useEffect(() => {
    if (open) {
      setValue(String(slaHours))
    }
  }, [open, slaHours])
  const parsed = Number(value)
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 8760
  function handleSave() {
    if (!isValid) return
    updateSla.mutate(
      { queueId, slaHours: parsed, revision },
      { onSuccess: () => setOpen(false) },
    )
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto cursor-pointer justify-start px-0 font-medium text-primary no-underline hover:bg-transparent hover:text-primary hover:underline hover:decoration-dashed hover:underline-offset-4"
        >
          {slaHours} {slaHours === 1 ? 'hour' : 'hours'}
        </Button>
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
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
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
