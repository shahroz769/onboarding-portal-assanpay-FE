import { useState } from 'react'

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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import type { MerchantListItem } from '#/schemas/merchants.schema'

interface MerchantDeleteDialogProps {
  merchant: MerchantListItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (confirmation: string) => void
  isPending: boolean
}

export function MerchantDeleteDialog({
  merchant,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: MerchantDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const isConfirmed = confirmation.trim() === merchant.businessName

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isConfirmed) return
    onConfirm(confirmation.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Permanently delete merchant?</DialogTitle>
          <DialogDescription>
            This permanently deletes {merchant.businessName}, all related cases
            and database records, and every owned Google Drive file and folder.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="merchant-delete-confirmation">
                Type {merchant.businessName} to confirm
              </FieldLabel>
              <Input
                id="merchant-delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                disabled={isPending}
              />
              <FieldDescription>
                The name must match exactly before deletion is enabled.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending || !isConfirmed}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Delete permanently
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
