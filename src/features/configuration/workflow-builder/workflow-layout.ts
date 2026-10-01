import type {
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowNode,
} from './workflow-graph-types'
import { SUBMISSION_NODE_ID } from './workflow-graph-types'

export const QUEUE_NODE_WIDTH = 236
export const QUEUE_NODE_HEIGHT = 76
export const SUBMISSION_NODE_WIDTH = 208

/** Vertical gap between stacked nodes in the same column. */
const ROW_GAP = 36
/** Horizontal gap between columns. */
const COLUMN_GAP = 120
/** Extra space between the flow and the queues that are not in it. */
const GROUP_GAP = 56
const MARGIN = 24

const COLUMN_STEP = QUEUE_NODE_WIDTH + COLUMN_GAP
const ROW_STEP = QUEUE_NODE_HEIGHT + ROW_GAP

/**
 * "Opens" relations shape the layout. Close / creation requirements are
 * constraints between queues that already sit in the flow, so they are
 * drawn but never move a node.
 */
const TREE_EDGE_KINDS = new Set<WorkflowEdgeKind>(['startRule', 'closeTrigger'])

function nodeDimensions(node: WorkflowNode) {
  return node.id === SUBMISSION_NODE_ID
    ? { width: SUBMISSION_NODE_WIDTH, height: QUEUE_NODE_HEIGHT }
    : { width: QUEUE_NODE_WIDTH, height: QUEUE_NODE_HEIGHT }
}

/**
 * Deterministic left-to-right tidy-tree layout. Node positions are never
 * persisted, so this runs on every load and on demand ("Auto-layout").
 *
 * - Columns: a queue sits one column after the latest queue that opens it
 *   (queues linked only by requirements go one after their prerequisite).
 * - Rows: within a parent, children run top to bottom in run order (#1
 *   above #2); leaves stack and every parent is centered on its children,
 *   so each branch point sits visually between its branches.
 * - Queues outside the flow go in a separate row below it.
 */
export function layoutWorkflowGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const validEdges = edges.filter(
    (edge) =>
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target) &&
      edge.source !== edge.target,
  )
  const treeEdges = validEdges.filter((edge) =>
    TREE_EDGE_KINDS.has(edge.data.kind),
  )

  const connected = new Set<string>([SUBMISSION_NODE_ID])
  for (const edge of validEdges) {
    connected.add(edge.source)
    connected.add(edge.target)
  }
  const flowIds = nodes.map((node) => node.id).filter((id) => connected.has(id))
  const looseNodes = nodes.filter((node) => !connected.has(node.id))

  // ── Columns: longest "opens" path from the roots ──
  // Relaxation capped at one pass per node, so a loop of close triggers
  // (allowed by the rules) can't spin forever; it just stops growing.
  const column = new Map<string, number>()
  for (const id of flowIds) column.set(id, id === SUBMISSION_NODE_ID ? 0 : 1)
  const relax = (edgeList: WorkflowEdge[]) => {
    // One pass per node is enough for any acyclic path.
    const maxPasses = flowIds.length
    for (let pass = 0; pass < maxPasses; pass++) {
      let changed = false
      for (const edge of edgeList) {
        const next = column.get(edge.source)! + 1
        if (next > column.get(edge.target)!) {
          column.set(edge.target, next)
          changed = true
        }
      }
      if (!changed) break
    }
  }
  relax(treeEdges)
  // Queues nothing opens (reached only by requirements) follow their
  // prerequisite instead of piling into column 1.
  const opened = new Set(treeEdges.map((edge) => edge.target))
  relax(
    validEdges.filter(
      (edge) =>
        !TREE_EDGE_KINDS.has(edge.data.kind) &&
        !opened.has(edge.target) &&
        edge.target !== SUBMISSION_NODE_ID,
    ),
  )

  // ── Spanning tree: each node hangs off its nearest opener ──
  const parentOf = new Map<string, string>()
  const orderOf = new Map<string, number>()
  const openers = [...treeEdges]
    .filter((edge) => column.get(edge.source)! < column.get(edge.target)!)
    .sort(
      (a, b) =>
        // Nearest column first (shortest edge), then run order.
        column.get(b.source)! - column.get(a.source)! ||
        (a.data.order ?? 0) - (b.data.order ?? 0),
    )
  for (const edge of openers) {
    if (parentOf.has(edge.target)) continue
    parentOf.set(edge.target, edge.source)
    orderOf.set(edge.target, edge.data.order ?? 0)
  }

  const nameOf = (id: string) => {
    const node = nodes.find((item) => item.id === id)
    return node?.type === 'queue' ? node.data.queue.name : id
  }
  const byRunOrder = (a: string, b: string) =>
    (orderOf.get(a) ?? 0) - (orderOf.get(b) ?? 0) ||
    nameOf(a).localeCompare(nameOf(b))

  const childrenOf = new Map<string, string[]>()
  for (const [child, parent] of parentOf) {
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child])
  }
  for (const children of childrenOf.values()) children.sort(byRunOrder)

  // ── Rows: leaves stack, parents center on their children ──
  const centerY = new Map<string, number>()
  let nextLeafY = MARGIN + QUEUE_NODE_HEIGHT / 2

  function place(id: string): number {
    const children = childrenOf.get(id) ?? []
    if (children.length === 0) {
      const y = nextLeafY
      nextLeafY += ROW_STEP
      centerY.set(id, y)
      return y
    }
    const childYs = children.map(place)
    const y = (childYs[0]! + childYs[childYs.length - 1]!) / 2
    centerY.set(id, y)
    return y
  }

  // The submission tree first, then any other roots (queues reached only
  // by requirement rules), left to right.
  const roots = flowIds
    .filter((id) => !parentOf.has(id))
    .sort((a, b) =>
      a === SUBMISSION_NODE_ID
        ? -1
        : b === SUBMISSION_NODE_ID
          ? 1
          : column.get(a)! - column.get(b)! || byRunOrder(a, b),
    )
  for (const root of roots) place(root)

  // ── Queues outside the flow: a wrapped row below it ──
  const flowBottom = Math.max(...centerY.values()) + QUEUE_NODE_HEIGHT / 2
  const perRow = Math.max(3, Math.max(...column.values()) + 1)
  const looseTop = flowBottom + GROUP_GAP

  return nodes.map((node) => {
    const { width, height } = nodeDimensions(node)
    const looseIndex = looseNodes.indexOf(node)
    if (looseIndex >= 0) {
      return {
        ...node,
        width,
        height,
        position: {
          x: MARGIN + (looseIndex % perRow) * COLUMN_STEP,
          y: looseTop + Math.floor(looseIndex / perRow) * ROW_STEP,
        },
      }
    }
    const col = column.get(node.id)
    const y = centerY.get(node.id)
    if (col === undefined || y === undefined) return node
    return {
      ...node,
      width,
      height,
      position: {
        // Narrower nodes (the submission node) center in their column.
        x: MARGIN + col * COLUMN_STEP + (QUEUE_NODE_WIDTH - width) / 2,
        y: y - height / 2,
      },
    }
  })
}
