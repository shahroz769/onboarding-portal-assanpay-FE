import type { CaseStatus } from '#/schemas/cases.schema'
import type {
  CaseWorkloadCell,
  CaseWorkloadResponse,
} from '#/schemas/dashboard.schema'

// ─── Status series ──────────────────────────────────────────────────────────
// Deep badge backgrounds (statusTintDeep in status-styles.ts). New and Working
// match their badges; Awaiting merchant uses rose rather than its badge's
// sky, which is nearly indistinguishable from New's blue at this lightness.

export type OpenStatusKey = 'new' | 'working' | 'awaitingMerchant'

export const WORKLOAD_SERIES: ReadonlyArray<{
  key: OpenStatusKey
  status: CaseStatus
  label: string
  /** Badge background, as chart fill values per theme. */
  fill: { light: string; dark: string }
  /** Legend/tooltip swatch: badge background with a ring so it stays visible. */
  swatchClassName: string
}> = [
  {
    key: 'new',
    status: 'new',
    label: 'New',
    fill: { light: 'var(--color-blue-300)', dark: 'oklch(0.72 0.1 252)' },
    swatchClassName:
      'bg-blue-300 ring-1 ring-blue-300 dark:bg-[oklch(0.72_0.1_252)] dark:ring-[oklch(0.72_0.1_252)]',
  },
  {
    key: 'working',
    status: 'working',
    label: 'Working',
    fill: { light: 'oklch(0.92 0.1 95)', dark: 'oklch(0.78 0.1 80)' },
    swatchClassName:
      'bg-[oklch(0.92_0.1_95)] ring-1 ring-[oklch(0.92_0.1_95)] dark:bg-[oklch(0.78_0.1_80)] dark:ring-[oklch(0.78_0.1_80)]',
  },
  {
    key: 'awaitingMerchant',
    status: 'awaiting_merchant',
    label: 'Awaiting merchant',
    fill: { light: 'oklch(0.86 0.07 10)', dark: 'oklch(0.72 0.1 15)' },
    swatchClassName:
      'bg-[oklch(0.86_0.07_10)] ring-1 ring-[oklch(0.86_0.07_10)] dark:bg-[oklch(0.72_0.1_15)] dark:ring-[oklch(0.72_0.1_15)]',
  },
]

// ─── Totals ─────────────────────────────────────────────────────────────────

export type WorkloadTotals = Omit<CaseWorkloadCell, 'queueId' | 'ownerId'> & {
  open: number
}

export function sumCells(cells: ReadonlyArray<CaseWorkloadCell>) {
  const totals: WorkloadTotals = {
    new: 0,
    working: 0,
    awaitingMerchant: 0,
    open: 0,
  }

  for (const cell of cells) {
    totals.new += cell.new
    totals.working += cell.working
    totals.awaitingMerchant += cell.awaitingMerchant
  }
  totals.open = totals.new + totals.working + totals.awaitingMerchant

  return totals
}

// ─── Queue backlog ──────────────────────────────────────────────────────────

export type QueueBacklogRow = {
  queue: CaseWorkloadResponse['queues'][number]
  totals: WorkloadTotals
}

/** Largest backlog first; empty queues sink to the bottom by name. */
export function buildQueueBacklogRows(
  data: CaseWorkloadResponse,
): QueueBacklogRow[] {
  return data.queues
    .map((queue) => ({
      queue,
      totals: sumCells(data.cells.filter((cell) => cell.queueId === queue.id)),
    }))
    .sort(
      (a, b) =>
        b.totals.open - a.totals.open ||
        a.queue.name.localeCompare(b.queue.name),
    )
}

// ─── Team workload ──────────────────────────────────────────────────────────

export type TeamMemberRow = {
  member: CaseWorkloadResponse['members'][number]
  totals: WorkloadTotals
}

/** The unassigned pool plus one row per person, busiest first. */
export function buildTeamWorkload(data: CaseWorkloadResponse) {
  const unassigned = sumCells(
    data.cells.filter((cell) => cell.ownerId === null),
  )

  const members: TeamMemberRow[] = data.members
    .map((member) => ({
      member,
      totals: sumCells(data.cells.filter((cell) => cell.ownerId === member.id)),
    }))
    .sort(
      (a, b) =>
        b.totals.open - a.totals.open ||
        a.member.name.localeCompare(b.member.name),
    )

  return { unassigned, members }
}
