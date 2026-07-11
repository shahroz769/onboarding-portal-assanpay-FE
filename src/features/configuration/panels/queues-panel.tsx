import { useEffect, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { Workflow } from 'lucide-react'

import { DataTable } from '#/components/data-table'

import type { DataTableColumnDef } from '#/components/data-table'

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

import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'

import { Input } from '#/components/ui/input'

import { Spinner } from '#/components/ui/spinner'

import { DEFAULT_SLA_HOURS } from '#/lib/sla'

import {
  useUpdateQueueSlaMutation,
  useUpdateQueueStatusMutation,
} from '#/hooks/use-configuration-query'

import { queuesQueryOptions } from '#/hooks/use-cases-query'

import { ConfigurationSectionCard } from './configuration-panel-shared'

// ─── Queues ─────────────────────────────────────────────────────────────────
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
        width: 260,
        cell: (queue) => (
          <span className="truncate font-medium">{queue.name}</span>
        ),
      },
      {
        id: 'slug',
        header: 'Slug',
        width: 220,
        cell: (queue) => (
          <span className="truncate font-mono text-xs">{queue.slug}</span>
        ),
      },
      {
        id: 'prefix',
        header: 'Prefix',
        width: 140,
        cell: (queue) => <span className="truncate">{queue.prefix}</span>,
      },
      {
        id: 'sla',
        header: 'SLA',
        width: 160,
        cell: (queue) => (
          <QueueSlaCell
            queueId={queue.id}
            queueName={queue.name}
            slaHours={queue.slaHours ?? DEFAULT_SLA_HOURS}
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: 140,
        cell: (queue) => {
          const isActive = queue.isActive !== false
          return (
            <Badge variant={isActive ? 'secondary' : 'outline'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: <span className="block text-right">Actions</span>,
        width: 180,
        cell: (queue) => {
          const isActive = queue.isActive !== false
          return (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={updateStatus.isPending}
                onClick={() =>
                  updateStatus.mutate({
                    queueId: queue.id,
                    isActive: !isActive,
                  })
                }
              >
                {isActive ? 'Set inactive' : 'Set active'}
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
      description="Manage queue availability, prefixes, and SLA hours."
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

function QueueSlaCell({
  queueId,
  queueName,
  slaHours,
}: {
  queueId: string
  queueName: string
  slaHours: number
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
      { queueId, slaHours: parsed },
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
