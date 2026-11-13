import { useState } from 'react'

import { useOpenCount } from '#/hooks/use-open-count'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Spinner } from '#/components/ui/spinner'
import { PrioritySelectField } from '#/components/priority-select-field'
import type { CaseListItem } from '#/schemas/cases.schema'
import type { Priority } from '#/schemas/merchants.schema'
import { useUpdateCasePriorityMutation } from '#/hooks/use-cases-query'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { cn } from '#/lib/utils'

interface CasePriorityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseItem: CaseListItem | null
  /** From useMorph: the dialog grows out of the Priority badge that opened it. */
  popupProps?: MorphPopupProps
}

// The dialog stays mounted so Base UI can run its open/close transitions;
// the form is keyed per open so it starts from the current case's priority.
export function CasePriorityDialog({
  open,
  onOpenChange,
  caseItem,
  popupProps,
}: CasePriorityDialogProps) {
  const openCount = useOpenCount(open)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...popupProps}
        className={cn('sm:max-w-md', popupProps?.className)}
      >
        {caseItem ? (
          <PriorityForm
            key={openCount}
            caseItem={caseItem}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function PriorityForm({
  onOpenChange,
  caseItem,
}: {
  onOpenChange: (open: boolean) => void
  caseItem: CaseListItem
}) {
  const [priority, setPriority] = useState<Priority>(caseItem.priority)
  const mutation = useUpdateCasePriorityMutation()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      { caseId: caseItem.id, priority },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <>
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
        <PrioritySelectField value={priority} onValueChange={setPriority} />
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
    </>
  )
}
