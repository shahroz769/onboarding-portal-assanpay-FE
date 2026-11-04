import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Field, FieldLabel } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { useMoveCaseFlowMerchantsMutation } from '#/hooks/use-configuration-query'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { cn } from '#/lib/utils'
import type { CaseFlowMerchantMovePreview } from '#/schemas/configuration.schema'

import { MerchantMoveImpact } from './merchant-move-impact'

export function MoveMerchantsDialog({
  open,
  preview,
  versionId,
  popupProps,
  onOpenChange,
}: {
  open: boolean
  preview: CaseFlowMerchantMovePreview | undefined
  versionId: number
  popupProps?: MorphPopupProps
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useMoveCaseFlowMerchantsMutation()
  const [reason, setReason] = useState('')

  function close() {
    onOpenChange(false)
    setReason('')
  }

  async function handleMove() {
    if (!preview) return
    try {
      await mutation.mutateAsync({
        revision: preview.revision,
        reason: reason.trim(),
      })
      close()
    } catch {
      // The mutation shows the error, and the refreshed preview stays open.
    }
  }

  const count = preview?.eligibleMerchantCount ?? 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return
        if (next) onOpenChange(true)
        else close()
      }}
    >
      <DialogContent
        {...popupProps}
        className={cn('sm:max-w-lg', popupProps?.className)}
      >
        <DialogHeader>
          <DialogTitle>Move merchants to v{versionId}</DialogTitle>
          <DialogDescription>
            From now on these merchants follow v{versionId}. Closed cases and
            their history don't change.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <MerchantMoveImpact preview={preview} targetLabel={`v${versionId}`} />
        ) : null}

        <Field data-disabled={mutation.isPending}>
          <FieldLabel htmlFor="flow-move-reason">Reason</FieldLabel>
          <Textarea
            id="flow-move-reason"
            maxLength={1000}
            value={reason}
            disabled={mutation.isPending}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why are these merchants moving?"
          />
        </Field>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            disabled={mutation.isPending || count === 0 || !reason.trim()}
            onClick={() => void handleMove()}
          >
            {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            Move {count} merchant{count === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
