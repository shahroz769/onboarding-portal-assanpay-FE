import dagre from '@dagrejs/dagre'

import type { WorkflowEdge, WorkflowNode } from './workflow-graph-types'
import { SUBMISSION_NODE_ID } from './workflow-graph-types'

export const QUEUE_NODE_WIDTH = 236
export const QUEUE_NODE_HEIGHT = 76
export const SUBMISSION_NODE_WIDTH = 208

function nodeDimensions(node: WorkflowNode) {
  return node.id === SUBMISSION_NODE_ID
    ? { width: SUBMISSION_NODE_WIDTH, height: QUEUE_NODE_HEIGHT }
    : { width: QUEUE_NODE_WIDTH, height: QUEUE_NODE_HEIGHT }
}

/**
 * Deterministic left-to-right layered layout. Node positions are never
 * persisted, so this runs on every load and on demand ("Auto-layout").
 */
export function layoutWorkflowGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const graph = new dagre.graphlib.Graph({ multigraph: true })
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 36,
    ranksep: 120,
    marginx: 24,
    marginy: 24,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    graph.setNode(node.id, nodeDimensions(node))
  }
  for (const edge of edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target, {}, edge.data.kind)
    }
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    const position = graph.node(node.id)
    const { width, height } = nodeDimensions(node)
    if (!position) return node
    return {
      ...node,
      width,
      height,
      position: {
        x: position.x - width / 2,
        y: position.y - height / 2,
      },
    }
  })
}
