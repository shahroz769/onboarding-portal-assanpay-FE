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
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import type { MerchantListItem } from '#/schemas/merchants.schema'

export type TerminateTarget =
  | { type: 'single'; merchant: MerchantListItem }
  | { type: 'bulk'; ids: string[] }

interface MerchantTerminateDialogProps {
  target: TerminateTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  isPending: boolean
}

export function MerchantTerminateDialog({
  target,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: MerchantTerminateDialogProps) {
  const [reason, setReason] = useState('')
  const trimmedReason = reason.trim()

  useEffect(() => {
    if (open) {
      setReason('')
    }
  }, [open])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!trimmedReason) return
    onConfirm(trimmedReason)
  }

  const targetDescription =
    target?.type === 'single'
      ? target.merchant.businessName
      : `${target?.ids.length ?? 0} selected merchants`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminate Merchant</DialogTitle>
          <DialogDescription>
            Terminate {targetDescription}. Open cases will be closed as
            unsuccessful.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Textarea
                placeholder="Reason for termination..."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                required
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
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending || !trimmedReason}
            >
              {isPending && <Spinner data-icon="inline-start" />}
              Terminate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
