import { Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { Badge } from '#/components/ui/badge'

import { cn } from '#/lib/utils'

import { HintedHandle } from './hinted-handle'

import type { QueueFlowNode } from '../workflow-graph-types'
import { QUEUE_NODE_HEIGHT, QUEUE_NODE_WIDTH } from '../workflow-layout'

const HANDLE_BASE =
  'size-2.5! border-2! border-background! transition-transform hover:scale-125!'

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  generic: 'Generic',
  document_review: 'Document review',
  agreement: 'Agreement',
  mid: 'MID',
  testing: 'Testing',
  wordpress: 'WordPress',
  card: 'Card',
  live: 'Live',
  sub_merchant_form: 'Sub-merchant form',
}

export function QueueNode({ data, selected }: NodeProps<QueueFlowNode>) {
  const { queue, inFlow, connectable } = data
  const workflowLabel = queue.workflowType
    ? (WORKFLOW_TYPE_LABELS[queue.workflowType] ?? queue.workflowType)
    : null
  return (
    <div
      className={cn(
        'flex items-center rounded-lg border bg-card px-3 shadow-xs transition-colors',
        selected
          ? 'border-primary ring-2 ring-ring/30'
          : 'hover:border-foreground/40',
        !inFlow && 'border-dashed opacity-70',
        !connectable && 'bg-muted/40',
      )}
      style={{ width: QUEUE_NODE_WIDTH, height: QUEUE_NODE_HEIGHT }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {queue.prefix.slice(0, 3)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-medium">
            {queue.name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {inFlow
              ? (workflowLabel ?? 'In flow')
              : 'Not in flow — drag a connection'}
          </p>
        </div>
        {!connectable ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {queue.lifecycle ?? 'inactive'}
          </Badge>
        ) : null}
      </div>

      <HintedHandle
        id="t-blocked"
        type="target"
        position={Position.Left}
        style={{ top: '24%' }}
        isConnectable={connectable}
        className={cn(HANDLE_BASE, 'bg-amber-500!')}
        hint="Close requirement: this case cannot close until the other closes"
      />
      <HintedHandle
        id="t-flow"
        type="target"
        position={Position.Left}
        style={{ top: '50%' }}
        isConnectable={connectable}
        className={cn(HANDLE_BASE, 'bg-blue-500!')}
        hint="Opens when the connected case closes"
      />
      <HintedHandle
        id="t-require"
        type="target"
        position={Position.Left}
        style={{ top: '76%' }}
        isConnectable={connectable}
        className={cn(HANDLE_BASE, 'bg-violet-500!')}
        hint="Creation requirement: this case needs the other closed first"
      />
      <HintedHandle
        id="s-prereq-close"
        type="source"
        position={Position.Right}
        style={{ top: '24%' }}
        isConnectable={connectable}
        className={cn(HANDLE_BASE, 'bg-amber-500!')}
        hint="Drag to a queue whose closing this one must precede"
      />
      <HintedHandle
        id="s-close"
        type="source"
        position={Position.Right}
        style={{ top: '50%' }}
        isConnectable={connectable}
        className={cn(HANDLE_BASE, 'bg-blue-500!')}
        hint="Close trigger — drag to the queue that opens next"
      />
      <HintedHandle
        id="s-prereq-create"
        type="source"
        position={Position.Right}
        style={{ top: '76%' }}
        isConnectable={connectable}
        className={cn(HANDLE_BASE, 'bg-violet-500!')}
        hint="Drag to a queue that requires this one closed before creation"
      />
    </div>
  )
}
