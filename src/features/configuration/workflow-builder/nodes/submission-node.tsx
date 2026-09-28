import { Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { Play } from 'lucide-react'

import { cn } from '#/lib/utils'

import { HintedHandle } from './hinted-handle'

import type { SubmissionFlowNode } from '../workflow-graph-types'
import { EDGE_KIND_META } from '../workflow-graph-types'
import { QUEUE_NODE_HEIGHT, SUBMISSION_NODE_WIDTH } from '../workflow-layout'

export function SubmissionNode({
  data,
  selected,
}: NodeProps<SubmissionFlowNode>) {
  const meta = EDGE_KIND_META.startRule
  return (
    <div
      className={cn(
        'flex items-center rounded-lg border bg-card px-3 shadow-xs transition-colors',
        selected
          ? 'border-primary ring-2 ring-ring/30'
          : 'hover:border-foreground/40',
      )}
      style={{ width: SUBMISSION_NODE_WIDTH, height: QUEUE_NODE_HEIGHT }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            meta.chipClass,
          )}
        >
          <Play className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-tight font-medium">
            Onboarding submitted
          </p>
          <p className="text-[11px] text-muted-foreground">
            {data.startRuleCount === 0
              ? 'No start rules — drag to a queue'
              : `Opens ${data.startRuleCount} case${data.startRuleCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      <HintedHandle
        id="s-start"
        type="source"
        position={Position.Right}
        style={{ top: '50%' }}
        className={cn(
          'size-2.5! border-2! border-background! transition-transform hover:scale-125!',
          meta.handleClass,
        )}
        hint="Start rule — drag to the first queue to open"
      />
    </div>
  )
}
