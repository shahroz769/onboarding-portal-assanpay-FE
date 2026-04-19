import { Check } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'
import type { QueueStage, StageCategory } from '#/schemas/cases.schema'

interface StageProgressBarProps {
  stages: QueueStage[]
  currentStageId: string | null
  closeOutcome?: 'successful' | 'unsuccessful' | null
  fallbackStageName?: string
  fallbackStatus?: StageCategory
}

type StageState = 'completed' | 'active' | 'upcoming'

function getStageState(currentIndex: number, stageIndex: number): StageState {
  if (currentIndex < 0) return 'upcoming'
  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'active'
  return 'upcoming'
}

const categoryStyles: Record<
  StageCategory,
  { badge: string; dot: string; line: string }
> = {
  new: {
    badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dot: 'border-blue-500/40 bg-blue-500/10 text-blue-600',
    line: 'bg-blue-500/50',
  },
  in_progress: {
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    dot: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
    line: 'bg-amber-500/50',
  },
  qc: {
    badge: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    dot: 'border-violet-500/40 bg-violet-500/10 text-violet-600',
    line: 'bg-violet-500/50',
  },
  error: {
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    dot: 'border-destructive/40 bg-destructive/10 text-destructive',
    line: 'bg-destructive/50',
  },
  closed: {
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dot: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
    line: 'bg-emerald-500/50',
  },
}

const completedStyles = {
  badge: 'bg-muted text-muted-foreground border-border',
  dot: 'border-border bg-muted text-muted-foreground',
  line: 'bg-border',
}

const activeRingClassByCategory: Record<StageCategory, string> = {
  new: 'ring-blue-500/30',
  in_progress: 'ring-amber-500/30',
  qc: 'ring-violet-500/30',
  error: 'ring-destructive/30',
  closed: 'ring-emerald-500/30',
}

export function StageProgressBar({
  stages,
  currentStageId,
  closeOutcome,
  fallbackStageName,
  fallbackStatus = 'in_progress',
}: StageProgressBarProps) {
  if (stages.length === 0) {
    const fallbackStyles = categoryStyles[fallbackStatus]

    return (
      <div className="w-full rounded-xl border bg-card px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Case stage
            </span>
            <p className="text-sm font-semibold text-foreground">
              {fallbackStageName ?? 'Workflow stage unavailable'}
            </p>
            <p className="text-xs text-muted-foreground">
              Detailed workflow steps are not available for this case yet.
            </p>
          </div>
          <Badge className={cn('border', fallbackStyles.badge)}>
            Current
          </Badge>
        </div>
      </div>
    )
  }

  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId)

  return (
    <div className="w-full rounded-xl border bg-card px-6 py-5">
      <div className="flex items-start">
        {stages.map((stage, index) => {
          const state = getStageState(currentIndex, index)
          const styles = categoryStyles[stage.category]
          const isLast = index === stages.length - 1
          const isClosed = stage.category === 'closed'
          const isError = stage.category === 'error'
          const isUnsuccessful = isError || (isClosed && closeOutcome === 'unsuccessful')

          const dotClass =
            state === 'upcoming'
              ? completedStyles.dot
              : styles.dot

          const lineClass =
            state === 'completed'
              ? styles.line
              : 'bg-border'

          return (
            <div
              key={stage.id}
              className={cn(
                'flex flex-1 flex-col items-center',
                isLast && 'flex-none',
              )}
            >
              {/* Row: dot + connector */}
              <div className="flex w-full items-center">
                {/* Step dot */}
                <div
                  className={cn(
                    'relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    dotClass,
                    state === 'active' && 'ring-2 ring-offset-2 ring-offset-card',
                    state === 'active' && activeRingClassByCategory[stage.category],
                  )}
                >
                  {state === 'completed' ? (
                    <Check className="size-3.5 stroke-[2.5]" />
                  ) : (
                    <span className="text-xs font-bold tabular-nums">{index + 1}</span>
                  )}
                  {state === 'active' && (
                    <span
                      className={cn(
                        'absolute inset-0 rounded-full animate-ping opacity-30',
                        stage.category === 'new' && 'bg-blue-500',
                        stage.category === 'in_progress' && 'bg-amber-500',
                        stage.category === 'qc' && 'bg-violet-500',
                        stage.category === 'error' && 'bg-destructive',
                        stage.category === 'closed' && 'bg-emerald-500',
                      )}
                    />
                  )}
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div className={cn('h-0.5 flex-1 transition-all', lineClass)} />
                )}
              </div>

              {/* Label below dot */}
              <div className="mt-2 flex flex-col items-center gap-1 pr-2 last:pr-0">
                <span
                  className={cn(
                    'text-xs font-medium text-center leading-tight',
                    state === 'upcoming' && 'text-muted-foreground',
                    state === 'completed' && 'text-muted-foreground',
                    state === 'active' && 'text-foreground font-semibold',
                  )}
                >
                  {stage.name}
                </span>
                {state === 'active' ? (
                  <Badge
                    className={cn(
                      'border text-[10px] px-1.5 py-0',
                      isUnsuccessful
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : styles.badge,
                    )}
                  >
                    Current
                  </Badge>
                ) : state === 'completed' ? (
                  <Badge className="border text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border">
                    Done
                  </Badge>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
