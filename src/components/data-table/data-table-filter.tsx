import { CheckIcon, PlusCircleIcon } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Separator } from '#/components/ui/separator'

interface FilterOption {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}

interface DataTableFilterProps {
  title: string
  options: FilterOption[]
  selectedValues: Set<string>
  onChange: (values: Set<string>) => void
}

export function DataTableFilter({
  title,
  options,
  selectedValues,
  onChange,
}: DataTableFilterProps) {
  const toggleValue = (value: string) => {
    const next = new Set(selectedValues)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    onChange(next)
  }

  const clearAll = () => onChange(new Set())

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon data-icon="inline-start" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedValues.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        key={option.value}
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <div className="flex flex-col gap-0.5 p-1">
          {options.map((option) => {
            const isSelected = selectedValues.has(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleValue(option.value)}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-primary',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'opacity-50 [&_svg]:invisible',
                  )}
                >
                  <CheckIcon />
                </div>
                {option.icon && <option.icon className="text-muted-foreground" />}
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
        {selectedValues.size > 0 && (
          <>
            <Separator />
            <div className="p-1">
              <button
                type="button"
                onClick={clearAll}
                className="w-full cursor-default rounded-sm px-2 py-1.5 text-center text-sm outline-hidden hover:bg-accent hover:text-accent-foreground"
              >
                Clear filters
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
