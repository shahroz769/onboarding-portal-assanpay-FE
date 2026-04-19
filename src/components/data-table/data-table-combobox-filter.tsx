import { useMemo, useState } from 'react'
import { PlusCircleIcon } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'
import { Separator } from '#/components/ui/separator'

interface FilterOption {
  label: string
  value: string
}

interface DataTableComboboxFilterProps {
  title: string
  options: FilterOption[]
  selectedValues: Set<string>
  onChange: (values: Set<string>) => void
  placeholder?: string
}

export function DataTableComboboxFilter({
  title,
  options,
  selectedValues,
  onChange,
  placeholder = 'Search...',
}: DataTableComboboxFilterProps) {
  const [open, setOpen] = useState(false)

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]))
    return Array.from(selectedValues)
      .map((v) => map.get(v))
      .filter(Boolean) as string[]
  }, [options, selectedValues])

  const handleSelect = (value: string) => {
    const next = new Set(selectedValues)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    onChange(next)
  }

  return (
    <Combobox open={open} onOpenChange={setOpen}>
      <ComboboxInput
        showTrigger={false}
        showClear={false}
        render={
          <Button variant="outline" size="sm" className="border-dashed" />
        }
      >
        <div className="flex items-center gap-1.5">
          <PlusCircleIcon className="size-4" />
          <span>{title}</span>
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  selectedLabels.map((label) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      {label}
                    </Badge>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxInput placeholder={placeholder} />
        <ComboboxList>
          <ComboboxGroup>
            {options.map((option) => (
              <ComboboxItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
                className="justify-between"
              >
                <span>{option.label}</span>
                {selectedValues.has(option.value) && (
                  <Badge variant="secondary" className="size-4 rounded-full p-0 text-[10px]">
                    ✓
                  </Badge>
                )}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
          <ComboboxEmpty>No results found.</ComboboxEmpty>
        </ComboboxList>
        {selectedValues.size > 0 && (
          <>
            <Separator />
            <div className="p-1">
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="w-full cursor-default rounded-sm px-2 py-1.5 text-center text-sm outline-hidden hover:bg-accent hover:text-accent-foreground"
              >
                Clear filters
              </button>
            </div>
          </>
        )}
      </ComboboxContent>
    </Combobox>
  )
}
