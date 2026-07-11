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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '#/components/ui/field'

import { Spinner } from '#/components/ui/spinner'

import {
  queuesQueryOptions,
  useCreateCaseMutation,
} from '#/hooks/use-cases-query'

import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'

import type { MerchantListItem } from '#/schemas/merchants.schema'

import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  PanelLoading,
  QueueSelect,
} from './configuration-panel-shared'

// ─── Case Triggering ───────────────────────────────────────────────────────
export function CaseTriggeringPanel() {
  const [merchantSearch, setMerchantSearch] = useState('')
  const [selectedMerchant, setSelectedMerchant] =
    useState<MerchantListItem | null>(null)
  const [queueId, setQueueId] = useState('')
  const merchantsQuery = useQuery(merchantOptionsQueryOptions(merchantSearch))
  const queuesQuery = useQuery(queuesQueryOptions({ includeInactive: true }))
  const createCase = useCreateCaseMutation()
  const merchants = merchantsQuery.data?.merchants ?? []
  const queues = queuesQuery.data ?? []
  const selectedQueue = queues.find((queue) => queue.id === queueId)
  const canSubmit = Boolean(
    selectedMerchant?.id && queueId && selectedQueue?.isActive,
  )
  function handleSubmit() {
    if (!canSubmit || !selectedMerchant) return
    createCase.mutate(
      { merchantId: selectedMerchant.id, queueId },
      {
        onSuccess: () => {
          setSelectedMerchant(null)
          setMerchantSearch('')
          setQueueId('')
        },
      },
    )
  }
  if (merchantsQuery.isPending || queuesQuery.isPending) {
    return <PanelLoading />
  }
  return (
    <ConfigurationSectionCard
      icon={Play}
      colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      title="Case Triggering"
      description="Create a case manually for a selected merchant and queue."
    >
      <FieldGroup>
        <FieldSet>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Merchant</FieldLabel>
              <MerchantCombobox
                merchants={merchants}
                value={selectedMerchant ?? null}
                isFetching={merchantsQuery.isFetching}
                onSearchValueChange={setMerchantSearch}
                onValueChange={setSelectedMerchant}
              />
              {merchantsQuery.isFetching ? (
                <FieldDescription>Loading merchants</FieldDescription>
              ) : null}
            </Field>

            <Field
              data-invalid={Boolean(selectedQueue && !selectedQueue.isActive)}
            >
              <FieldLabel>Queue</FieldLabel>
              <QueueSelect
                value={queueId}
                queues={queues}
                placeholder="Select queue"
                onValueChange={setQueueId}
              />
              {selectedQueue && !selectedQueue.isActive ? (
                <FieldError>This queue is inactive.</FieldError>
              ) : null}
            </Field>
          </div>
        </FieldSet>
        <ConfigurationActionBar>
          <Button
            disabled={!canSubmit || createCase.isPending}
            onClick={handleSubmit}
          >
            {createCase.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            Trigger case
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
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
          {isFetching ? 'Loading merchants...' : 'No merchants found.'}
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
