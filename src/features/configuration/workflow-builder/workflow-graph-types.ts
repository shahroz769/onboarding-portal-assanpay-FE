import type { Edge, Node } from '@xyflow/react'

import type { CaseFlowConfiguration } from '#/schemas/configuration.schema'

export const SUBMISSION_NODE_ID = 'submission'

export type CaseFlowQueue = CaseFlowConfiguration['queues'][number]

export const WORKFLOW_EDGE_KINDS = [
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
  /** Hex color — needed for SVG stroke and arrow markers. */
  color: string
  strokeDasharray?: string
  /** Tailwind classes for edge label chips and legend swatches. */
  chipClass: string
  description: string
}

export const EDGE_KIND_META: Record<WorkflowEdgeKind, WorkflowEdgeKindMeta> = {
  startRule: {
    label: 'Start rule',
    color: '#10b981',
    chipClass:
      'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    description: 'Opens when onboarding is submitted',
  },
  closeTrigger: {
    label: 'Close trigger',
    color: '#3b82f6',
    chipClass:
      'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    description: 'Closing the case opens the next one',
  },
  closeBlocker: {
    label: 'Close requirement',
    color: '#f59e0b',
    strokeDasharray: '7 5',
    chipClass:
      'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    description: 'Case cannot close until the prerequisite closes',
  },
  creationRequirement: {
    label: 'Creation requirement',
    color: '#8b5cf6',
    strokeDasharray: '2 4',
    chipClass:
      'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300',
    description: 'Case cannot be created until the prerequisite closes',
  },
}

/** Rule kinds that may exist between two queue nodes (switchable). */
export const QUEUE_TO_QUEUE_KINDS = [
  'closeTrigger',
  'closeBlocker',
  'creationRequirement',
] as const satisfies readonly WorkflowEdgeKind[]

export function isQueueToQueueKind(kind: WorkflowEdgeKind) {
  return kind !== 'startRule'
}
