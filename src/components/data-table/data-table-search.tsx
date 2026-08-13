import { useEffect, useRef, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'
import { Button } from '#/components/ui/button'

interface DataTableSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

export function DataTableSearch({ value, ...props }: DataTableSearchProps) {
  return <DataTableSearchInput key={value} value={value} {...props} />
}

function DataTableSearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
}: DataTableSearchProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setLocalValue(next)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(next), debounceMs)
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <InputGroup className="max-w-sm">
      <InputGroupAddon align="inline-start">
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
      />

      {localValue && (
        <InputGroupAddon align="inline-end">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={handleClear}
          >
            <XIcon />
          </Button>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
