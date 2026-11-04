import { useState } from 'react'

import { useOpenCount } from '#/hooks/use-open-count'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { cn } from '#/lib/utils'

import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
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
  onConfirm: (reason: string, deleteDriveFiles: boolean) => void
  isPending: boolean
  /** Deleting Drive files is limited to Super Admins; others never see it. */
  canDeleteDriveFiles: boolean
  /** From useMorph: the dialog grows out of the button that opened it. */
  popupProps?: MorphPopupProps
}

// The dialog stays mounted so Base UI can run its open/close transitions;
// the form is keyed per open so the reason starts empty every time.
export function MerchantTerminateDialog({
  open,
  popupProps,
  ...props
}: MerchantTerminateDialogProps) {
  const openCount = useOpenCount(open)
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent
        {...popupProps}
        className={cn('sm:max-w-md', popupProps?.className)}
      >
        <TerminateForm key={openCount} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function TerminateForm({
  target,
  onOpenChange,
  onConfirm,
  isPending,
  canDeleteDriveFiles,
}: Omit<MerchantTerminateDialogProps, 'open'>) {
  const [reason, setReason] = useState('')
  const [deleteDriveFiles, setDeleteDriveFiles] = useState(false)
  const trimmedReason = reason.trim()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!trimmedReason) return
    onConfirm(trimmedReason, deleteDriveFiles)
  }

  const targetDescription =
    target?.type === 'single'
      ? target.merchant.businessName
      : `${target?.ids.length ?? 0} selected merchants`

  return (
    <>
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
              placeholder="Reason for termination…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              required
            />
          </Field>
          {canDeleteDriveFiles ? (
            <Field orientation="horizontal">
              <Checkbox
                id="merchant-terminate-delete-drive-files"
                checked={deleteDriveFiles}
                onCheckedChange={(value) => setDeleteDriveFiles(!!value)}
              />
              <FieldContent>
                <FieldLabel htmlFor="merchant-terminate-delete-drive-files">
                  Also move Google Drive files to trash
                </FieldLabel>
                <FieldDescription>
                  Moves this merchant&apos;s Drive files and folders to the
                  Drive trash. Google removes them for good after 30 days.
                </FieldDescription>
              </FieldContent>
            </Field>
          ) : null}
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
            {deleteDriveFiles ? 'Terminate and trash files' : 'Terminate'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
