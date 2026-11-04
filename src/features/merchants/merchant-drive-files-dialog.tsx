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
import { Spinner } from '#/components/ui/spinner'
import type { MerchantListItem } from '#/schemas/merchants.schema'

interface MerchantDriveFilesDialogProps {
  merchant: MerchantListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
  /** From useMorph: the dialog grows out of the button that opened it. */
  popupProps?: MorphPopupProps
}

export function MerchantDriveFilesDialog({
  merchant,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  popupProps,
}: MerchantDriveFilesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...popupProps}
        className={cn('sm:max-w-md', popupProps?.className)}
      >
        <DialogHeader>
          <DialogTitle>Move Google Drive files to trash?</DialogTitle>
          <DialogDescription>
            This moves every Google Drive file and folder for{' '}
            {merchant?.businessName} to the Drive trash. Google removes them for
            good after 30 days. The merchant and its cases stay.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Move to trash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
