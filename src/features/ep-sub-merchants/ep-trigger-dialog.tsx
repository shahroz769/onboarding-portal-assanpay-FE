import { useState } from 'react'
import { Play } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'
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
import { Spinner } from '#/components/ui/spinner'
import { useTriggerEpCaseMutation } from '#/hooks/use-ep-sub-merchants-query'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { cn } from '#/lib/utils'
import type {
  EpMerchant,
  EpSubMerchant,
} from '#/schemas/ep-sub-merchants.schema'
import { epCaseStatusLabel } from './ep-case-status'

export function EpTriggerDialog({
  merchant,
  open,
  onOpenChange,
  popupProps,
}: {
  merchant: EpMerchant | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** From useMorph: the dialog grows out of its trigger button. */
  popupProps?: MorphPopupProps
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...popupProps}
        className={cn('sm:max-w-md', popupProps?.className)}
      >
        <DialogHeader>
          <DialogTitle>Trigger EP Case</DialogTitle>
          <DialogDescription>
            {merchant
              ? `Create an EP Sub-Merchant Form case for ${merchant.businessName}.`
              : null}
          </DialogDescription>
        </DialogHeader>
        {merchant ? (
          <EpTriggerForm
            merchant={merchant}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// The popup unmounts when closed, so this state resets on every open.
function EpTriggerForm({
  merchant,
  onClose,
}: {
  merchant: EpMerchant
  onClose: () => void
}) {
  const triggerable = merchant.subMerchants.filter(
    (subMerchant) => subMerchant.canTrigger,
  )
  const [selected, setSelected] = useState<EpSubMerchant | null>(
    triggerable.length === 1 ? (triggerable[0] ?? null) : null,
  )
  const trigger = useTriggerEpCaseMutation()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || trigger.isPending) return

    trigger.mutate(
      { merchantId: merchant.id, subMerchantId: selected.id },
      // A rejected trigger means this list is out of date, so close either way.
      { onSettled: onClose },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel>Sub-merchant</FieldLabel>
          <Combobox
            items={merchant.subMerchants}
            value={selected}
            autoHighlight
            itemToStringLabel={(item: EpSubMerchant) => item.name}
            itemToStringValue={(item: EpSubMerchant) => item.id}
            isItemEqualToValue={(item: EpSubMerchant, value: EpSubMerchant) =>
              item.id === value.id
            }
            onValueChange={setSelected}
          >
            <ComboboxInput
              className="w-full"
              placeholder="Select a sub-merchant"
              showClear
            />
            <ComboboxContent>
              <ComboboxEmpty>No sub-merchants found.</ComboboxEmpty>
              <ComboboxList>
                {(subMerchant: EpSubMerchant) => (
                  <ComboboxItem
                    key={subMerchant.id}
                    value={subMerchant}
                    disabled={!subMerchant.canTrigger}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {subMerchant.name}
                    </span>
                    {subMerchant.latestCase ? (
                      <Badge variant="outline">
                        {epCaseStatusLabel(subMerchant.latestCase)}
                      </Badge>
                    ) : null}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <FieldDescription>
            {selected?.latestCase
              ? `Re-trigger: case ${selected.latestCase.caseNumber} closed as unsuccessful and stays in history.`
              : 'Only sub-merchants selected in Documents Review are listed.'}
          </FieldDescription>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!selected || trigger.isPending}>
          {trigger.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {selected?.latestCase ? 'Re-trigger Case' : 'Trigger Case'}
        </Button>
      </DialogFooter>
    </form>
  )
}
