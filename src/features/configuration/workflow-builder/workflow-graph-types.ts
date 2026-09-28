import type { Edge, Node } from '@xyflow/react'

import { statusTint } from '#/lib/status-styles'
import type { StatusTint } from '#/lib/status-styles'
import type { CaseFlowConfiguration } from '#/schemas/configuration.schema'

export const SUBMISSION_NODE_ID = 'submission'

export type CaseFlowQueue = CaseFlowConfiguration['queues'][number]

const WORKFLOW_EDGE_KINDS = [
  'startRule',
  'closeTrigger',
  'closeBlocker',
  'creationRequirement',
] as const

export type WorkflowEdgeKind = (typeof WORKFLOW_EDGE_KINDS)[number]

export type WorkflowEdgeData = {
  kind: WorkflowEdgeKind
  /** Server-side rule id. Absent for rules drafted in this editing session. */
  ruleId?: string
  /** Start rules and close triggers run in ascending order. */
  order?: number
  isActive: boolean
}

// The base Edge type marks `data` optional; every workflow edge always
// carries its rule data, so the intersection makes it required everywhere.
export type WorkflowEdge = Edge<WorkflowEdgeData, 'flow'> & {
  data: WorkflowEdgeData
}

export type QueueNodeData = {
  queue: CaseFlowQueue
  /** True when at least one rule references this queue. */
  inFlow: boolean
  /** Only active-lifecycle queues may receive new connections. */
  connectable: boolean
}

export type SubmissionNodeData = {
  startRuleCount: number
}

export type SubmissionFlowNode = Node<SubmissionNodeData, 'submission'>
export type QueueFlowNode = Node<QueueNodeData, 'queue'>
export type WorkflowNode = SubmissionFlowNode | QueueFlowNode

/**
 * Each rule kind attaches to its own pair of handles so edges of different
 * kinds between the same two queues do not overlap.
 */
export const KIND_HANDLES: Record<
  WorkflowEdgeKind,
  { source: string; target: string }
> = {
  startRule: { source: 's-start', target: 't-flow' },
  closeTrigger: { source: 's-close', target: 't-flow' },
  closeBlocker: { source: 's-prereq-close', target: 't-blocked' },
  creationRequirement: { source: 's-prereq-create', target: 't-require' },
}

/** Dragging from a handle creates the rule kind that handle represents. */
export const SOURCE_HANDLE_KIND: Record<string, WorkflowEdgeKind> = {
  's-start': 'startRule',
  's-close': 'closeTrigger',
  's-prereq-close': 'closeBlocker',
  's-prereq-create': 'creationRequirement',
}

export type WorkflowEdgeKindMeta = {
  label: string
  /**
   * Theme token (see --flow-* in styles.css) for SVG strokes and arrow
   * markers; follows light/dark mode.
   */
  color: string
  strokeDasharray?: string
  /** Portal tint for chips, icons and labels (lib/status-styles). */
  tint: StatusTint
  /** Tint classes for edge label chips and rule icons. */
  chipClass: string
  /** Fill for this rule's connection handles. */
  handleClass: string
  description: string
}

export const EDGE_KIND_META: Record<WorkflowEdgeKind, WorkflowEdgeKindMeta> = {
  startRule: {
    label: 'Start rule',
    color: 'var(--flow-start)',
    tint: 'emerald',
    chipClass: statusTint('emerald'),
    handleClass: 'bg-(--flow-start)!',
    description: 'Opens when onboarding is submitted',
  },
  closeTrigger: {
    label: 'Close trigger',
    color: 'var(--flow-trigger)',
    tint: 'blue',
    chipClass: statusTint('blue'),
    handleClass: 'bg-(--flow-trigger)!',
    description: 'Closing the case opens the next one',
  },
  closeBlocker: {
    label: 'Close requirement',
    color: 'var(--flow-close)',
    strokeDasharray: '7 5',
    tint: 'amber',
    chipClass: statusTint('amber'),
    handleClass: 'bg-(--flow-close)!',
    description: 'Case cannot close until the prerequisite closes',
  },
  creationRequirement: {
    label: 'Creation requirement',
    color: 'var(--flow-create)',
    strokeDasharray: '2 4',
    tint: 'violet',
    chipClass: statusTint('violet'),
    handleClass: 'bg-(--flow-create)!',
    description: 'Case cannot be created until the prerequisite closes',
  },
}

/** Rule kinds that may exist between two queue nodes (switchable). */
export const QUEUE_TO_QUEUE_KINDS = [
  'closeTrigger',
  'closeBlocker',
  'creationRequirement',
] as const satisfies readonly WorkflowEdgeKind[]
