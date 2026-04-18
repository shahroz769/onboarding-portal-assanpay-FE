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
import { Textarea } from '#/components/ui/textarea'
import { Spinner } from '#/components/ui/spinner'
import { FieldGroup, Field, FieldLabel } from '#/components/ui/field'
import type { MerchantListItem, Priority } from '#/schemas/merchants.schema'
import { PRIORITIES, PRIORITY_LABELS } from '#/schemas/merchants.schema'

interface MerchantPriorityDialogProps {
  merchant: MerchantListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (merchantId: string, priority: Priority, note?: string) => void
  isPending: boolean
}

export function MerchantPriorityDialog({
  merchant,
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: MerchantPriorityDialogProps) {
  const [priority, setPriority] = useState<Priority>(
    merchant?.priority ?? 'normal',
  )
  const [note, setNote] = useState(merchant?.priorityNote ?? '')

  useEffect(() => {
    if (!open) {
      return
    }

    setPriority(merchant?.priority ?? 'normal')
    setNote(merchant?.priorityNote ?? '')
  }, [merchant, open])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!merchant) return
    onSubmit(merchant.id, priority, note || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Priority</DialogTitle>
          <DialogDescription>
            Update the priority for{' '}
            <span className="font-medium text-foreground">
              {merchant?.businessName}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
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
            <Field>
              <FieldLabel>Note (optional)</FieldLabel>
              <Textarea
                placeholder="Reason for priority change..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
