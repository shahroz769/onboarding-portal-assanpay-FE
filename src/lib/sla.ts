export const DEFAULT_SLA_HOURS = 24

export interface SlaStatus {
  slaHours: number
  deadline: Date
  isBreached: boolean
  hoursElapsed: number
  hoursRemaining: number
}

/**
 * Compute SLA status for a case from its creation time and the queue SLA hours.
 * Falls back to the default 24-hour SLA when no value is configured.
 */
export function getSlaStatus(
  createdAt: string | Date,
  slaHours: number | null | undefined,
  now: Date = new Date(),
): SlaStatus {
  const effectiveSlaHours =
    typeof slaHours === 'number' && slaHours > 0 ? slaHours : DEFAULT_SLA_HOURS
  const created = new Date(createdAt)
  const deadline = new Date(
    created.getTime() + effectiveSlaHours * 60 * 60 * 1000,
  )
  const msElapsed = now.getTime() - created.getTime()
  const hoursElapsed = msElapsed / (60 * 60 * 1000)
  const hoursRemaining = effectiveSlaHours - hoursElapsed

  return {
    slaHours: effectiveSlaHours,
    deadline,
    isBreached: now.getTime() > deadline.getTime(),
    hoursElapsed,
    hoursRemaining,
  }
}

export function getCaseSlaStatus({
  createdAt,
  closedAt,
  status,
  slaHours,
  slaBreached,
  now = new Date(),
}: {
  createdAt: string | Date
  closedAt?: string | Date | null
  status: string
  slaHours: number | null | undefined
  slaBreached?: boolean | null
  now?: Date
}): SlaStatus {
  const evaluatedAt =
    (status === 'closed' || status === 'error') && closedAt
      ? new Date(closedAt)
      : now

  const sla = getSlaStatus(createdAt, slaHours, evaluatedAt)

  if (typeof slaBreached === 'boolean') {
    return {
      ...sla,
      isBreached: slaBreached,
    }
  }

  return sla
}
