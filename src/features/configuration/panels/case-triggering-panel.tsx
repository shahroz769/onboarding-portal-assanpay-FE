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
import { subMerchantOptionsQueryOptions } from '#/hooks/use-configuration-query'

import type { MerchantListItem } from '#/schemas/merchants.schema'
import type { SubMerchantOption } from '#/schemas/configuration.schema'

import { CaseTriggeringSkeleton } from '../configuration-route-skeleton'
import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  QueueSelect,
} from './configuration-panel-shared'

// ─── Case Triggering ───────────────────────────────────────────────────────
export function CaseTriggeringPanel() {
  const [merchantSearch, setMerchantSearch] = useState('')
  const [selectedMerchant, setSelectedMerchant] =
    useState<MerchantListItem | null>(null)
  const [queueId, setQueueId] = useState('')
  const [selectedSubMerchant, setSelectedSubMerchant] =
    useState<SubMerchantOption | null>(null)
  const merchantsQuery = useQuery(merchantOptionsQueryOptions(merchantSearch))
  const queuesQuery = useQuery(queuesQueryOptions({ includeInactive: true }))
  const subMerchantsQuery = useQuery(subMerchantOptionsQueryOptions())
  const createCase = useCreateCaseMutation()
  const merchants = merchantsQuery.data?.merchants ?? []
  const queues = queuesQuery.data ?? []
  const selectedQueue = queues.find((queue) => queue.id === queueId)
  const isSubMerchantFormQueue =
    selectedQueue?.workflowType === 'sub_merchant_form' ||
    selectedQueue?.slug === 'sub-merchant-form'
  const canSubmit = Boolean(
    selectedMerchant?.id &&
    queueId &&
    selectedQueue?.isActive &&
    (!isSubMerchantFormQueue || selectedSubMerchant),
  )
  function handleSubmit() {
    if (!canSubmit || !selectedMerchant) return
    createCase.mutate(
      {
        merchantId: selectedMerchant.id,
        queueId,
        subMerchantId: selectedSubMerchant?.id,
      },
      {
        onSuccess: () => {
          setSelectedMerchant(null)
          setMerchantSearch('')
          setQueueId('')
          setSelectedSubMerchant(null)
        },
      },
    )
  }
  if (
    merchantsQuery.isPending ||
    queuesQuery.isPending ||
    subMerchantsQuery.isPending
  ) {
    return <CaseTriggeringSkeleton />
  }
  return (
    <ConfigurationSectionCard
      icon={Play}
      tone="emerald"
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
                onValueChange={(value) => {
                  setQueueId(value)
                  setSelectedSubMerchant(null)
                }}
              />
              {selectedQueue && !selectedQueue.isActive ? (
                <FieldError>This queue is inactive.</FieldError>
              ) : null}
            </Field>
            {isSubMerchantFormQueue ? (
              <Field>
                <FieldLabel>Sub-merchant</FieldLabel>
                <SubMerchantCombobox
                  subMerchants={subMerchantsQuery.data ?? []}
                  value={selectedSubMerchant}
                  onValueChange={setSelectedSubMerchant}
                />
                <FieldDescription>
                  This EP case and its form will be linked to this sub-merchant.
                </FieldDescription>
              </Field>
            ) : null}
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

function SubMerchantCombobox({
  subMerchants,
  value,
  onValueChange,
}: {
  subMerchants: SubMerchantOption[]
  value: SubMerchantOption | null
  onValueChange: (subMerchant: SubMerchantOption | null) => void
}) {
  return (
    <Combobox
      items={subMerchants}
      value={value}
      autoHighlight
      itemToStringLabel={(item) => item.name}
      itemToStringValue={(item) => item.id}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      onValueChange={onValueChange}
    >
      <ComboboxInput
        className="w-full"
        placeholder="Search and select sub-merchant"
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>No sub-merchants found.</ComboboxEmpty>
        <ComboboxList>
          {(subMerchant: SubMerchantOption) => (
            <ComboboxItem key={subMerchant.id} value={subMerchant}>
              {subMerchant.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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
