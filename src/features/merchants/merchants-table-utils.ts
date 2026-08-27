import type { MerchantListItem } from '#/schemas/merchants.schema'

export function selectedNonTerminatedIds(
  selectedIds: string[],
  merchants: MerchantListItem[],
) {
  const byId = new Map(merchants.map((item) => [item.id, item]))
  return selectedIds.filter((id) => byId.get(id)?.status !== 'terminated')
}
