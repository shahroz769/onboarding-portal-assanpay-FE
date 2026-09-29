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

export function DataTableSearch({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
}: DataTableSearchProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  // Last value we pushed to the parent; anything else arriving is external.
  const emittedRef = useRef(value)

  // Sync only external changes (e.g. filters reset). Never remount the input,
  // or it loses focus while the user is typing.
  useEffect(() => {
    if (value !== emittedRef.current) {
      emittedRef.current = value
      if (timerRef.current) clearTimeout(timerRef.current)
      setLocalValue(value)
    }
  }, [value])

  const emit = (next: string) => {
    emittedRef.current = next
    onChange(next)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setLocalValue(next)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => emit(next), debounceMs)
  }

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setLocalValue('')
    emit('')
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
            aria-label="Clear search"
          >
            <XIcon />
          </Button>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
