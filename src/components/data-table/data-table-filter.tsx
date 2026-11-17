import { useState } from 'react'
import { Combobox as ComboboxPrimitive } from '@base-ui/react'
import { PlusCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { InputGroupAddon } from '#/components/ui/input-group'
import { Separator } from '#/components/ui/separator'
import { Spinner } from '#/components/ui/spinner'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

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
  /** Adds a search input and a scrollable list, for long or growing option lists. */
  searchable?: boolean
  /**
   * Searches on the server instead of filtering `options` locally: called
   * with the typed text, and `options` should hold the matching results.
   * Implies `searchable`.
   */
  onSearchChange?: (search: string) => void
  /** Shows a spinner while server-side results load. */
  isLoading?: boolean
  /**
   * Labels for selected values that may be missing from `options` (e.g.
   * server-searched options that aren't in the current results).
   */
  selectedLabels?: ReadonlyMap<string, string>
  /**
   * For options that come from the server: called each time the filter is
   * opened, so nothing loads before the first click. Until `optionsLoaded`,
   * the button shows a spinner in place of its icon and the filter opens
   * once the returned promise resolves.
   */
  loadOptions?: () => Promise<unknown>
  /** The options are already loaded, so the filter opens straight away. */
  optionsLoaded?: boolean
}

/**
 * Open state for a filter whose options may have to load first. Opening
 * waits for `loadOptions` (the button shows a spinner meanwhile) unless the
 * options are already loaded; a failed load shows a toast and stays closed.
 */
function useFilterOpen({
  title,
  loadOptions,
  optionsLoaded = false,
  onOpen,
  onClose,
}: {
  title: string
  loadOptions?: () => Promise<unknown>
  optionsLoaded?: boolean
  onOpen: () => void
  onClose?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(false)

  const openNow = () => {
    onOpen()
    setOpen(true)
  }

  const onOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose?.()
      setOpen(false)
      return
    }
    if (isOpening) return

    const loading = loadOptions?.()
    if (!loading || optionsLoaded) {
      // Already loaded: nothing to wait for, and a failed refresh just
      // leaves the loaded options showing.
      loading?.catch(() => {})
      openNow()
      return
    }

    setIsOpening(true)
    loading
      .then(openNow, (error: unknown) => {
        toast.error(
          getApiErrorMessage(
            error,
            `Could not load the ${title.toLowerCase()} list. Please try again.`,
          ),
        )
      })
      .finally(() => setIsOpening(false))
  }

  return { open, setOpen, isOpening, onOpenChange }
}

// Ticking options edits a draft; nothing is applied (and the table doesn't
// refetch) until Apply. Closing the popover any other way discards the draft.

function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((value) => b.has(value))
}

function DataTableFilterLabel({
  title,
  selectedValues,
  labelFor,
  isLoading = false,
}: {
  title: string
  selectedValues: Set<string>
  labelFor: (value: string) => string | undefined
  isLoading?: boolean
}) {
  const labels = [...selectedValues].map(labelFor)
  const allLabelled = labels.every((label) => label !== undefined)
  return (
    <>
      {isLoading ? (
        <Spinner data-icon="inline-start" aria-label={`Loading ${title}`} />
      ) : (
        <PlusCircleIcon data-icon="inline-start" />
      )}
      {title}
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
            {selectedValues.size > 2 || !allLabelled ? (
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {selectedValues.size} selected
              </Badge>
            ) : (
              labels.map((label) => (
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
    </>
  )
}

function FilterFooter({
  draft,
  applied,
  onClear,
  onApply,
}: {
  draft: Set<string>
  applied: Set<string>
  onClear: () => void
  onApply: () => void
}) {
  return (
    <>
      <Separator />
      <div className="flex items-center justify-between gap-2 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={draft.size === 0}
          onClick={onClear}
        >
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={sameSet(draft, applied)}
          onClick={onApply}
        >
          Apply
          {draft.size > 0 ? ` (${draft.size})` : ''}
        </Button>
      </div>
    </>
  )
}

export function DataTableFilter(props: DataTableFilterProps) {
  if (props.searchable || props.onSearchChange) {
    return <SearchableDataTableFilter {...props} />
  }

  return <PlainDataTableFilter {...props} />
}

function PlainDataTableFilter({
  title,
  options,
  selectedValues,
  onChange,
  loadOptions,
  optionsLoaded,
}: DataTableFilterProps) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set())
  const { open, setOpen, isOpening, onOpenChange } = useFilterOpen({
    title,
    loadOptions,
    optionsLoaded,
    onOpen: () => setDraft(new Set(selectedValues)),
  })

  const labelFor = (value: string) =>
    options.find((option) => option.value === value)?.label

  const toggleValue = (value: string) => {
    setDraft((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="border-dashed" />
        }
      >
        <DataTableFilterLabel
          title={title}
          selectedValues={selectedValues}
          labelFor={labelFor}
          isLoading={isOpening}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="flex flex-col gap-0.5 p-1">
          {options.map((option) => {
            const isSelected = draft.has(option.value)
            return (
              <label
                key={option.value}
                className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none hover:bg-accent hover:text-accent-foreground has-focus-visible:bg-accent"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleValue(option.value)}
                />
                {option.icon && (
                  <option.icon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
        <FilterFooter
          draft={draft}
          applied={selectedValues}
          onClear={() => setDraft(new Set())}
          onApply={() => {
            onChange(draft)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function SearchableDataTableFilter({
  title,
  options,
  selectedValues,
  onChange,
  onSearchChange,
  isLoading = false,
  selectedLabels,
  loadOptions,
  optionsLoaded,
}: DataTableFilterProps) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set())
  const serverSearch = Boolean(onSearchChange)
  const { open, setOpen, isOpening, onOpenChange } = useFilterOpen({
    title,
    loadOptions,
    optionsLoaded,
    onOpen: () => setDraft(new Set(selectedValues)),
    onClose: () => onSearchChange?.(''),
  })

  // Labels of every option seen so far, so a draft selection stays labelled
  // after a server search stops returning it.
  const [seenLabels, setSeenLabels] = useState(() => new Map<string, string>())
  if (options.some((option) => seenLabels.get(option.value) !== option.label)) {
    setSeenLabels(
      new Map([
        ...seenLabels,
        ...options.map((option) => [option.value, option.label] as const),
      ]),
    )
  }
  const labelFor = (value: string) =>
    seenLabels.get(value) ?? selectedLabels?.get(value)

  // Selected values missing from the current results are listed first, so
  // they can still be unticked while searching for something else.
  const optionValues = new Set(options.map((option) => option.value))
  const pinned: FilterOption[] = [...draft]
    .filter((value) => !optionValues.has(value))
    .flatMap((value) => {
      const label = labelFor(value)
      return label ? [{ value, label }] : []
    })
  const items = serverSearch ? [...pinned, ...options] : options
  const draftOptions = items.filter((option) => draft.has(option.value))

  return (
    <Combobox
      multiple
      autoHighlight
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      value={draftOptions}
      // Server-searched options are already filtered.
      filter={serverSearch ? null : undefined}
      onInputValueChange={(value) => onSearchChange?.(value)}
      itemToStringLabel={(option: FilterOption) => option.label}
      itemToStringValue={(option: FilterOption) => option.value}
      isItemEqualToValue={(item: FilterOption, selected: FilterOption) =>
        item.value === selected.value
      }
      onValueChange={(next: FilterOption[]) =>
        setDraft(new Set(next.map((option) => option.value)))
      }
    >
      <ComboboxPrimitive.Trigger
        render={
          <Button variant="outline" size="sm" className="border-dashed" />
        }
      >
        <DataTableFilterLabel
          title={title}
          selectedValues={selectedValues}
          labelFor={labelFor}
          isLoading={isOpening}
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent align="start" className="w-64 min-w-64">
        <ComboboxInput
          showTrigger={false}
          aria-label={`Search ${title.toLowerCase()}`}
          placeholder={`Search ${title.toLowerCase()}…`}
        >
          {isLoading ? (
            <InputGroupAddon align="inline-end">
              <Spinner className="size-3.5 text-muted-foreground" />
            </InputGroupAddon>
          ) : null}
        </ComboboxInput>
        <ComboboxEmpty>
          {isLoading ? 'Searching…' : 'No results found.'}
        </ComboboxEmpty>
        <ComboboxList className="max-h-72">
          {(option: FilterOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.icon && (
                <option.icon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
        <FilterFooter
          draft={draft}
          applied={selectedValues}
          onClear={() => setDraft(new Set())}
          onApply={() => {
            onChange(draft)
            setOpen(false)
          }}
        />
      </ComboboxContent>
    </Combobox>
  )
}
