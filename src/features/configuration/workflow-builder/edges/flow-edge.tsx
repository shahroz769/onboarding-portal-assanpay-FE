import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

import { cn } from '#/lib/utils'

import type { WorkflowEdge } from '../workflow-graph-types'
import { EDGE_KIND_META } from '../workflow-graph-types'

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
  const [edgePath, labelX, labelY] = getBezierPath({
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
