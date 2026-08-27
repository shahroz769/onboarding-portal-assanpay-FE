import { MarkerType } from '@xyflow/react'

import type {
  CaseFlowCloseBlocker,
  CaseFlowCloseTrigger,
  CaseFlowConfiguration,
  CaseFlowCreationRequirement,
  CaseFlowStartRule,
} from '#/schemas/configuration.schema'

import type {
  CaseFlowQueue,
  QueueFlowNode,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowNode,
} from './workflow-graph-types'
import {
  EDGE_KIND_META,
  KIND_HANDLES,
  SUBMISSION_NODE_ID,
} from './workflow-graph-types'

function isQueueConnectable(queue: CaseFlowQueue) {
  if (queue.lifecycle) return queue.lifecycle === 'active'
  return queue.isActive !== false
}

export function makeWorkflowEdge({
  id,
  kind,
  source,
  target,
  ruleId,
  order,
  isActive,
}: {
  id?: string
  kind: WorkflowEdgeKind
  source: string
  target: string
  ruleId?: string
  order?: number
  isActive: boolean
}): WorkflowEdge {
  const handles = KIND_HANDLES[kind]
  const meta = EDGE_KIND_META[kind]
  return {
    id: id ?? `${kind}:${crypto.randomUUID()}`,
    source,
    target,
    sourceHandle: handles.source,
    targetHandle: handles.target,
    type: 'flow',
    data: {
      kind,
      ...(ruleId ? { ruleId } : {}),
      ...(order !== undefined ? { order } : {}),
      isActive,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: meta.color,
    },
  }
}

/**
 * Maps the case-flow configuration document onto a node/edge graph.
 * Rules referencing queues missing from the catalog still render (as
 * placeholder nodes) so serializing the graph can never silently drop rules.
 */
export function buildWorkflowGraph(config: CaseFlowConfiguration): {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
} {
  const referenced = new Set<string>()
  for (const rule of config.startRules) referenced.add(rule.targetQueueId)
  for (const rule of config.closeTriggers) {
    referenced.add(rule.sourceQueueId)
    referenced.add(rule.targetQueueId)
  }
  for (const rule of config.closeBlockers) {
    referenced.add(rule.blockedQueueId)
    referenced.add(rule.prerequisiteQueueId)
  }
  for (const rule of config.creationRequirements) {
    referenced.add(rule.targetQueueId)
    referenced.add(rule.prerequisiteQueueId)
  }

  const queueById = new Map<string, CaseFlowQueue>()
  for (const queue of config.queues) queueById.set(queue.id, queue)
  for (const queueId of referenced) {
    if (!queueById.has(queueId)) {
      queueById.set(queueId, {
        id: queueId,
        name: 'Unknown queue',
        slug: 'unknown',
        prefix: '?',
        isActive: false,
        lifecycle: 'inactive',
      })
    }
  }

  const activeStartRules = config.startRules.filter(
    (rule) => rule.isActive,
  ).length

  const nodes: WorkflowNode[] = [
    {
      id: SUBMISSION_NODE_ID,
      type: 'submission',
      position: { x: 0, y: 0 },
      deletable: false,
      draggable: false,
      data: { startRuleCount: activeStartRules },
    },
    ...[...queueById.values()].map((queue): QueueFlowNode => ({
      id: queue.id,
      type: 'queue',
      position: { x: 0, y: 0 },
      deletable: false,
      connectable: isQueueConnectable(queue),
      data: {
        queue,
        inFlow: referenced.has(queue.id),
        connectable: isQueueConnectable(queue),
      },
    })),
  ]

  const edges: WorkflowEdge[] = []
  config.startRules.forEach((rule, index) => {
    edges.push(
      makeWorkflowEdge({
        id: rule.id ?? `startRule:draft-${index}`,
        kind: 'startRule',
        source: SUBMISSION_NODE_ID,
        target: rule.targetQueueId,
        ruleId: rule.id,
        order: rule.order,
        isActive: rule.isActive,
      }),
    )
  })
  config.closeTriggers.forEach((rule, index) => {
    edges.push(
      makeWorkflowEdge({
        id: rule.id ?? `closeTrigger:draft-${index}`,
        kind: 'closeTrigger',
        source: rule.sourceQueueId,
        target: rule.targetQueueId,
        ruleId: rule.id,
        order: rule.order,
        isActive: rule.isActive,
      }),
    )
  })
  config.closeBlockers.forEach((rule, index) => {
    edges.push(
      makeWorkflowEdge({
        id: rule.id ?? `closeBlocker:draft-${index}`,
        kind: 'closeBlocker',
        source: rule.prerequisiteQueueId,
        target: rule.blockedQueueId,
        ruleId: rule.id,
        isActive: rule.isActive,
      }),
    )
  })
  config.creationRequirements.forEach((rule, index) => {
    edges.push(
      makeWorkflowEdge({
        id: rule.id ?? `creationRequirement:draft-${index}`,
        kind: 'creationRequirement',
        source: rule.prerequisiteQueueId,
        target: rule.targetQueueId,
        ruleId: rule.id,
        isActive: rule.isActive,
      }),
    )
  })

  return { nodes, edges }
}

function byOrderThenId<T extends { order: number; id?: string }>(a: T, b: T) {
  if (a.order !== b.order) return a.order - b.order
  return (a.id ?? '').localeCompare(b.id ?? '')
}

/** Serializes graph edges back into the four case-flow rule arrays. */
export function graphToConfig(
  base: CaseFlowConfiguration,
  edges: WorkflowEdge[],
): CaseFlowConfiguration {
  const startRules: CaseFlowStartRule[] = []
  const closeTriggers: CaseFlowCloseTrigger[] = []
  const closeBlockers: CaseFlowCloseBlocker[] = []
  const creationRequirements: CaseFlowCreationRequirement[] = []

  for (const edge of edges) {
    const { kind, ruleId, order, isActive } = edge.data
    const idPart = ruleId ? { id: ruleId } : {}
    switch (kind) {
      case 'startRule':
        startRules.push({
          ...idPart,
          targetQueueId: edge.target,
          order: order ?? 1,
          isActive,
        })
        break
      case 'closeTrigger':
        closeTriggers.push({
          ...idPart,
          sourceQueueId: edge.source,
          targetQueueId: edge.target,
          order: order ?? 1,
          isActive,
        })
        break
      case 'closeBlocker':
        closeBlockers.push({
          ...idPart,
          blockedQueueId: edge.target,
          prerequisiteQueueId: edge.source,
          isActive,
        })
        break
      case 'creationRequirement':
        creationRequirements.push({
          ...idPart,
          targetQueueId: edge.target,
          prerequisiteQueueId: edge.source,
          isActive,
        })
        break
    }
  }

  startRules.sort(byOrderThenId)
  closeTriggers.sort(byOrderThenId)

  return {
    ...base,
    startRules,
    closeTriggers,
    closeBlockers,
    creationRequirements,
  }
}

/** Stable fingerprint of just the four rule arrays — used for dirty checks. */
export function canonicalizeFlowRules(config: CaseFlowConfiguration): string {
  const sortStrings = (values: string[]) => [...values].sort()
  return JSON.stringify({
    startRules: sortStrings(
      config.startRules.map(
        (rule) => `${rule.targetQueueId}|${rule.order}|${rule.isActive}`,
      ),
    ),
    closeTriggers: sortStrings(
      config.closeTriggers.map(
        (rule) =>
          `${rule.sourceQueueId}|${rule.targetQueueId}|${rule.order}|${rule.isActive}`,
      ),
    ),
    closeBlockers: sortStrings(
      config.closeBlockers.map(
        (rule) =>
          `${rule.blockedQueueId}|${rule.prerequisiteQueueId}|${rule.isActive}`,
      ),
    ),
    creationRequirements: sortStrings(
      config.creationRequirements.map(
        (rule) =>
          `${rule.targetQueueId}|${rule.prerequisiteQueueId}|${rule.isActive}`,
      ),
    ),
  })
}

export function nextRuleOrder(
  edges: WorkflowEdge[],
  kind: 'startRule' | 'closeTrigger',
) {
  let max = 0
  for (const edge of edges) {
    if (edge.data.kind === kind && (edge.data.order ?? 0) > max) {
      max = edge.data.order ?? 0
    }
  }
  return max + 1
}

const SELF_EDGE_ERRORS: Record<WorkflowEdgeKind, string> = {
  startRule: 'A queue cannot start itself.',
  closeTrigger: 'A queue cannot trigger itself.',
  closeBlocker: 'A queue cannot require itself before closing.',
  creationRequirement: 'A queue cannot require itself before creation.',
}

/**
 * Guards evaluated while connecting and while switching an edge's kind.
 * Returns a user-facing error message, or null when the edge is allowed.
 */
export function getNewEdgeError({
  edges,
  nodes,
  kind,
  source,
  target,
  ignoreEdgeId,
}: {
  edges: WorkflowEdge[]
  nodes: WorkflowNode[]
  kind: WorkflowEdgeKind
  source: string
  target: string
  ignoreEdgeId?: string
}): string | null {
  if (source === target) return SELF_EDGE_ERRORS[kind]

  const targetNode = nodes.find((node) => node.id === target)
  if (targetNode?.type === 'queue' && targetNode.data.connectable === false) {
    return 'Only active queues can be part of new rules.'
  }

  const duplicate = edges.some(
    (edge) =>
      edge.id !== ignoreEdgeId &&
      edge.data.kind === kind &&
      edge.source === source &&
      edge.target === target,
  )
  if (duplicate) {
    return 'This relation already exists. Select the existing rule to edit or activate it.'
  }

  return null
}
