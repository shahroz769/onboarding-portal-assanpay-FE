import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { useAuth } from '#/features/auth/auth-client'
import { QueueSelect } from '#/features/configuration/panels/configuration-panel-shared'
import {
  queuesQueryOptions,
  useBulkCreateCasesMutation,
  useCreateCaseMutation,
} from '#/hooks/use-cases-query'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { useMorph } from '#/hooks/use-morph'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { cn } from '#/lib/utils'
import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'
import type { MerchantListItem } from '#/schemas/merchants.schema'

/** Manual case creation is limited to admins (matches `POST /api/cases`). */
export function useCanTriggerCases() {
  const { user } = useAuth()
  return user?.roleType === 'super_admin' || user?.roleType === 'admin'
}

/** Toolbar button that opens the dialog with a merchant picker. */
export function TriggerCaseButton() {
  const canTrigger = useCanTriggerCases()
  const [open, setOpen] = useState(false)
  const morph = useMorph()

  if (!canTrigger) return null

  return (
    <>
      <Button
        size="sm"
        onClick={(event) => morph.run(() => setOpen(true), event.currentTarget)}
      >
        <Play data-icon="inline-start" />
        Trigger Case
      </Button>
      <TriggerCaseDialog
        open={open}
        onOpenChange={setOpen}
        popupProps={morph.popupProps}
      />
    </>
  )
}

type TriggerCaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselected merchants (from table row selection). Omit to pick one. */
  merchants?: MerchantListItem[]
  onTriggered?: () => void
  /** From useMorph: the dialog grows out of its trigger button. */
  popupProps?: MorphPopupProps
}

export function TriggerCaseDialog({
  open,
  onOpenChange,
  merchants,
  onTriggered,
  popupProps,
}: TriggerCaseDialogProps) {
  const merchantCount = merchants?.length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...popupProps}
        className={cn('sm:max-w-lg', popupProps?.className)}
      >
        <DialogHeader>
          <DialogTitle>Trigger Case</DialogTitle>
          <DialogDescription>
            {merchantCount > 1
              ? `Create a case in the selected queue for each of the ${merchantCount} selected merchants.`
              : 'Create a case manually for a merchant in the selected queue. Only active queues can be selected.'}
          </DialogDescription>
        </DialogHeader>
        <TriggerCaseForm
          merchants={merchants}
          onCancel={() => onOpenChange(false)}
          onTriggered={() => {
            onOpenChange(false)
            onTriggered?.()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

// The popup unmounts when closed, so this state resets on every open.
function TriggerCaseForm({
  merchants: preselectedMerchants,
  onCancel,
  onTriggered,
}: {
  merchants?: MerchantListItem[]
  onCancel: () => void
  onTriggered: () => void
}) {
  const hasPreselection = Boolean(preselectedMerchants?.length)
  const [merchantSearch, setMerchantSearch] = useState('')
  const [pickedMerchant, setPickedMerchant] = useState<MerchantListItem | null>(
    null,
  )
  const [queueId, setQueueId] = useState('')
  // Debounced so typing sends one request after a pause, not one per key.
  const debouncedMerchantSearch = useDebouncedValue(merchantSearch)
  const merchantsQuery = useQuery({
    ...merchantOptionsQueryOptions(debouncedMerchantSearch),
    enabled: !hasPreselection,
  })
  const queuesQuery = useQuery(queuesQueryOptions({ includeInactive: true }))
  const createCase = useCreateCaseMutation()
  const bulkCreateCases = useBulkCreateCasesMutation()
  const isPending = createCase.isPending || bulkCreateCases.isPending

  const targetMerchants = hasPreselection
    ? (preselectedMerchants ?? [])
    : pickedMerchant
      ? [pickedMerchant]
      : []
  // EP cases have their own eligibility rules and are triggered one at a time
  // from the EP Sub-Merchants page.
  const queues = (queuesQuery.data ?? []).filter(
    (queue) => queue.workflowType !== 'sub_merchant_form',
  )
  const selectedQueue = queues.find((queue) => queue.id === queueId)
  const canSubmit =
    targetMerchants.length > 0 && Boolean(queueId && selectedQueue?.isActive)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || isPending) return
    const [onlyMerchant] = targetMerchants

    if (targetMerchants.length === 1 && onlyMerchant) {
      createCase.mutate(
        { merchantId: onlyMerchant.id, queueId },
        { onSuccess: onTriggered },
      )
      return
    }

    bulkCreateCases.mutate(
      {
        merchantIds: targetMerchants.map((merchant) => merchant.id),
        queueId,
      },
      { onSuccess: onTriggered },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        {hasPreselection ? (
          <Field>
            <FieldLabel>
              {targetMerchants.length === 1
                ? 'Merchant'
                : `Merchants (${targetMerchants.length})`}
            </FieldLabel>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin rounded-md border bg-muted/40 p-2">
              {targetMerchants.map((merchant) => (
                <Badge key={merchant.id} variant="secondary">
                  {merchant.businessName}
                  <span className="text-muted-foreground">
                    #{merchant.merchantNumber}
                  </span>
                </Badge>
              ))}
            </div>
          </Field>
        ) : (
          <Field data-invalid={Boolean(merchantsQuery.error)}>
            <FieldLabel>Merchant</FieldLabel>
            <MerchantCombobox
              merchants={merchantsQuery.data?.merchants ?? []}
              value={pickedMerchant}
              isFetching={merchantsQuery.isFetching}
              onSearchValueChange={setMerchantSearch}
              onValueChange={setPickedMerchant}
            />
            {merchantsQuery.error ? (
              <FieldError>Failed to load merchants.</FieldError>
            ) : null}
          </Field>
        )}

        <Field
          data-invalid={Boolean(
            queuesQuery.error || (selectedQueue && !selectedQueue.isActive),
          )}
        >
          <FieldLabel>Queue</FieldLabel>
          <QueueSelect
            value={queueId}
            queues={queues}
            placeholder={
              queuesQuery.isPending ? 'Loading queues…' : 'Select queue'
            }
            onValueChange={setQueueId}
          />
          {queuesQuery.error ? (
            <FieldError>Failed to load queues.</FieldError>
          ) : selectedQueue && !selectedQueue.isActive ? (
            <FieldError>This queue is inactive.</FieldError>
          ) : null}
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || isPending}>
          {isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {targetMerchants.length > 1
            ? `Trigger ${targetMerchants.length} Cases`
            : 'Trigger Case'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function MerchantCombobox({
  merchants,
  value,
  isFetching,
  onSearchValueChange,
  onValueChange,
}: {
  merchants: MerchantListItem[]
  value: MerchantListItem | null
  isFetching: boolean
  onSearchValueChange: (value: string) => void
  onValueChange: (merchant: MerchantListItem | null) => void
}) {
  return (
    <Combobox
      items={merchants}
      value={value}
      autoHighlight
      itemToStringLabel={(merchant) => merchant.businessName}
      itemToStringValue={(merchant) => merchant.id}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      onInputValueChange={onSearchValueChange}
      onValueChange={(merchant) => onValueChange(merchant)}
    >
      <ComboboxInput
        className="w-full"
        placeholder="Search and select merchant"
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {isFetching ? 'Loading merchants…' : 'No merchants found.'}
        </ComboboxEmpty>
        <ComboboxList>
          {(merchant: MerchantListItem) => (
            <ComboboxItem key={merchant.id} value={merchant}>
              <span className="min-w-0 flex-1 truncate">
                {merchant.businessName}
              </span>
              <Badge variant="secondary">#{merchant.merchantNumber}</Badge>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
