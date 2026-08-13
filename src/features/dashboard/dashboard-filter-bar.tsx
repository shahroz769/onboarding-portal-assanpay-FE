import { useState } from 'react'
import { CalendarIcon, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/lib/utils'
import { useHydrated } from '#/hooks/use-hydrated'
import {
  DASHBOARD_RANGE_LABELS,
  DASHBOARD_RANGES,
} from '#/schemas/dashboard.schema'
import type {
  DashboardRange,
  DashboardRouteSearch,
} from '#/schemas/dashboard.schema'

type DashboardFilterBarProps = {
  search: DashboardRouteSearch
  onChange: (next: Partial<DashboardRouteSearch>) => void
  onRefresh: () => void
  isFetching: boolean
}

function parseDate(value: string | undefined) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function DashboardFilterBar({
  search,
  onChange,
  onRefresh,
  isFetching,
}: DashboardFilterBarProps) {
  const hydrated = useHydrated()
  const today = hydrated ? new Date() : undefined

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={search.range}
        onValueChange={(value) => onChange({ range: value as DashboardRange })}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_RANGES.map((range) => (
            <SelectItem key={range} value={range}>
              {DASHBOARD_RANGE_LABELS[range]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {search.range === 'custom' ? (
        <>
          <DateField
            label="From"
            value={search.from}
            max={parseDate(search.to) ?? today}
            onChange={(value) => onChange({ from: value })}
          />
          <DateField
            label="To"
            value={search.to}
            min={parseDate(search.from)}
            max={today}
            onChange={(value) => onChange({ to: value })}
          />
        </>
      ) : null}

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Refresh dashboard"
      >
        <RefreshCw className={cn(isFetching && 'animate-spin')} />
      </Button>
    </div>
  )
}

type DateFieldProps = {
  label: string
  value: string | undefined
  min?: Date
  max?: Date
  onChange: (value: string | undefined) => void
}

function DateField({ label, value, min, max, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = parseDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className="w-40 justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          <CalendarIcon data-icon="inline-start" />
          {selected ? format(selected, 'MMM d, yyyy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          disabled={(date) =>
            (min ? date < min : false) || (max ? date > max : false)
          }
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : undefined)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
