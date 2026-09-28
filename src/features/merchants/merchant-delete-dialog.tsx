import { useState } from 'react'

import { useOpenCount } from '#/hooks/use-open-count'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { cn } from '#/lib/utils'

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
  merchant: MerchantListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (confirmation: string) => void
  isPending: boolean
  /** From useMorph: the dialog grows out of the button that opened it. */
  popupProps?: MorphPopupProps
}

// The dialog stays mounted so Base UI can run its open/close transitions;
// the form is keyed per open so the confirmation starts empty every time.
export function MerchantDeleteDialog({
  merchant,
  open,
  popupProps,
  ...props
}: MerchantDeleteDialogProps) {
  const openCount = useOpenCount(open)
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent
        {...popupProps}
        className={cn('sm:max-w-md', popupProps?.className)}
      >
        {merchant ? (
          <DeleteForm key={openCount} merchant={merchant} {...props} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DeleteForm({
  merchant,
  onOpenChange,
  onConfirm,
  isPending,
}: Omit<MerchantDeleteDialogProps, 'open' | 'merchant'> & {
  merchant: MerchantListItem
}) {
  const [confirmation, setConfirmation] = useState('')
  const isConfirmed = confirmation.trim() === merchant.businessName

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isConfirmed) return
    onConfirm(confirmation.trim())
  }

  return (
    <>
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
    </>
  )
}
