import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { Play } from 'lucide-react'

import { cn } from '#/lib/utils'

import type { SubmissionFlowNode } from '../workflow-graph-types'

export function SubmissionNode({
  data,
  selected,
}: NodeProps<SubmissionFlowNode>) {
  return (
    <div
      className={cn(
        'w-[208px] rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 shadow-xs transition-colors dark:border-emerald-800 dark:bg-emerald-950/60',
        selected && 'ring-2 ring-emerald-500/40',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white dark:bg-emerald-700">
          <Play className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-tight font-semibold text-emerald-900 dark:text-emerald-100">
            Onboarding submitted
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            {data.startRuleCount === 0
              ? 'No start rules — drag to a queue'
              : `Opens ${data.startRuleCount} case${data.startRuleCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      <Handle
        id="s-start"
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-background !bg-emerald-500 transition-transform hover:!scale-125"
        title="Start rule — drag to the first queue to open"
      />
    </div>
  )
}
