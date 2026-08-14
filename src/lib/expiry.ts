export const NO_EXPIRY_LABEL = 'No expiry'

export function formatExpiryLabel(
  value: string | Date | null | undefined,
  formatter: (date: Date) => string,
) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  if (date.getUTCFullYear() >= 9999) return NO_EXPIRY_LABEL

  return formatter(date)
}
