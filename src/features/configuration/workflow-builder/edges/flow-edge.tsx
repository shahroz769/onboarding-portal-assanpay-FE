import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  Position,
} from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

import { cn } from '#/lib/utils'

import type { WorkflowEdge } from '../workflow-graph-types'
import { EDGE_KIND_META } from '../workflow-graph-types'

/** Forked edges have a large Y gap; this only catches same-row sag. */
const COLLINEAR_Y_PX = 8

function isHorizontalPair(source: Position, target: Position) {
  return (
    (source === Position.Right && target === Position.Left) ||
    (source === Position.Left && target === Position.Right)
  )
}

function flowPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: Pick<
  EdgeProps<WorkflowEdge>,
  | 'sourceX'
  | 'sourceY'
  | 'targetX'
  | 'targetY'
  | 'sourcePosition'
  | 'targetPosition'
>) {
  if (
    isHorizontalPair(sourcePosition, targetPosition) &&
    Math.abs(sourceY - targetY) <= COLLINEAR_Y_PX
  ) {
    const y = (sourceY + targetY) / 2
    return getStraightPath({
      sourceX,
      sourceY: y,
      targetX,
      targetY: y,
    })
  }
  return getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
}

function edgeLabel(edge: WorkflowEdge['data']) {
  switch (edge.kind) {
    case 'startRule':
    case 'closeTrigger':
      return `#${edge.order ?? 1}`
    case 'closeBlocker':
      return 'blocks close'
    case 'creationRequirement':
      return 'required first'
  }
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<WorkflowEdge>) {
  const [edgePath, labelX, labelY] = flowPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const meta = EDGE_KIND_META[data.kind]
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: meta.color,
          strokeWidth: selected ? 2.5 : 1.75,
          strokeDasharray: meta.strokeDasharray,
          opacity: data.isActive ? 1 : 0.35,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className={cn(
            'pointer-events-none absolute rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium shadow-xs',
            meta.chipClass,
            !data.isActive && 'opacity-60',
            selected && 'ring-2 ring-ring/40',
          )}
        >
          {edgeLabel(data)}
          {data.isActive ? '' : ' · off'}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
