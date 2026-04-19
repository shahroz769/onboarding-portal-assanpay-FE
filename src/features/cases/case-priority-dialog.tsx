import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Spinner } from '#/components/ui/spinner'
import { Field, FieldLabel } from '#/components/ui/field'
import type { CaseListItem } from '#/schemas/cases.schema'
import { useUpdateCasePriorityMutation } from '#/hooks/use-cases-query'

const PRIORITIES = ['normal', 'high'] as const
type Priority = (typeof PRIORITIES)[number]

const PRIORITY_LABELS: Record<Priority, string> = {
  normal: 'Normal',
  high: 'High',
}

interface CasePriorityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseItem: CaseListItem
}

export function CasePriorityDialog({
  open,
  onOpenChange,
  caseItem,
}: CasePriorityDialogProps) {
  const [priority, setPriority] = useState<Priority>(caseItem.priority)
  const mutation = useUpdateCasePriorityMutation()

  useEffect(() => {
    if (open) {
      setPriority(caseItem.priority)
    }
  }, [open, caseItem.priority])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      { caseId: caseItem.id, priority },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Priority</DialogTitle>
          <DialogDescription>
            Update the priority for case{' '}
            <span className="font-mono font-medium text-foreground">
              {caseItem.caseNumber}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>Priority</FieldLabel>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
