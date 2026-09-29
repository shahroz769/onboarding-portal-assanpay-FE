import { NumberFlip } from '#/components/number-flip'
import { Skeleton } from '#/components/ui/skeleton'

// The small uppercase label + figure pairs in chart card headers.

export function HeaderStat({
  label,
  value,
  format,
  hint,
}: {
  label: string
  value: number
  format: (value: number) => string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      {/* Digits roll on a range or granularity change, like the KPI cards. */}
      <NumberFlip
        value={value}
        format={format}
        className="justify-end text-lg leading-none font-semibold"
      />
      {hint ? (
        <span className="text-[11px] leading-none text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

// Mirrors HeaderStat: the label is real text so its line box matches; the
// value/hint skeletons equal their leading-none heights.
export function HeaderStatSkeleton({
  label,
  hasHint = false,
}: {
  label: string
  hasHint?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      {/* h-4.5 = text-lg leading-none */}
      <Skeleton className="h-4.5 w-8 self-end" />
      {/* h-2.75 = text-[11px] leading-none */}
      {hasHint ? <Skeleton className="h-2.75 w-12 self-end" /> : null}
    </div>
  )
}
