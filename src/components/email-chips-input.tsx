import { useState } from 'react'
import * as z from 'zod'
import { MailPlusIcon } from 'lucide-react'

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '#/components/ui/combobox'

// 254 characters is the longest address SMTP accepts (RFC 5321).
const emailSchema = z.string().max(254).pipe(z.email())

function isEmail(value: string) {
  return emailSchema.safeParse(value).success
}

/** Typing or pasting one of these commits what came before it. */
const SEPARATOR = /[\s,;]/

/**
 * Free-form list of email addresses as removable chips. Enter, comma, space
 * or blur turns the typed address into a chip; pasting a list adds every
 * address in it; Backspace in the empty input removes the last chip.
 */
export function EmailChipsInput({
  id,
  value,
  onChange,
  max,
  placeholder = 'name@example.com',
  invalid = false,
  disabled = false,
  'aria-describedby': ariaDescribedBy,
}: {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  max?: number
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  'aria-describedby'?: string
}) {
  const anchor = useComboboxAnchor()
  const [inputValue, setInputValue] = useState('')
  const [entryError, setEntryError] = useState<string | null>(null)

  const draft = inputValue.trim().toLowerCase()
  const atMax = max !== undefined && value.length >= max
  const items =
    draft && isEmail(draft) && !value.includes(draft) && !atMax ? [draft] : []

  /** Adds every valid address in `raw`; invalid ones stay in the input. */
  function commit(raw: string) {
    const parts = raw
      .split(/[\s,;]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
    const next = [...value]
    const rejected: string[] = []
    let overLimit = false
    for (const part of parts) {
      if (!isEmail(part)) rejected.push(part)
      else if (next.includes(part)) continue
      else if (max !== undefined && next.length >= max) overLimit = true
      else next.push(part)
    }
    if (next.length !== value.length) onChange(next)
    setInputValue(rejected.join(' '))
    setEntryError(
      rejected.length > 0
        ? `"${rejected[0]}" isn't a valid email address.`
        : overLimit
          ? `Up to ${max} addresses.`
          : null,
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Combobox
        multiple
        autoHighlight
        items={items}
        filter={null}
        value={value}
        onValueChange={(next: string[]) => {
          onChange(next)
          setInputValue('')
          setEntryError(null)
        }}
        inputValue={inputValue}
        onInputValueChange={(next) => {
          if (SEPARATOR.test(next)) {
            commit(next)
            return
          }
          setInputValue(next)
          setEntryError(null)
        }}
        disabled={disabled}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <ComboboxValue>
            {(emails: string[]) => (
              <>
                {emails.map((email) => (
                  <ComboboxChip key={email} className="max-w-full">
                    <span className="min-w-0 truncate">{email}</span>
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder={
                    emails.length > 0
                      ? atMax
                        ? undefined
                        : 'Add another…'
                      : placeholder
                  }
                  aria-invalid={invalid || Boolean(entryError) || undefined}
                  aria-describedby={ariaDescribedBy}
                  onKeyDown={(event) => {
                    // Enter commits the typed text itself, rather than relying
                    // on the "Add …" option being highlighted in the popup.
                    if (
                      event.key !== 'Enter' ||
                      event.nativeEvent.isComposing ||
                      !inputValue.trim()
                    ) {
                      return
                    }
                    event.preventDefault()
                    event.preventBaseUIHandler()
                    commit(inputValue)
                  }}
                  onBlur={() => {
                    if (inputValue.trim()) commit(inputValue)
                  }}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>
            {atMax
              ? `Limit of ${max} reached.`
              : draft
                ? 'Keep typing a full address, e.g. name@example.com'
                : 'Type an address, then press Enter.'}
          </ComboboxEmpty>
          <ComboboxList>
            {(email: string) => (
              <ComboboxItem key={email} value={email}>
                <MailPlusIcon className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  Add <span className="font-medium">{email}</span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {entryError ? (
        <p role="alert" className="text-sm text-destructive">
          {entryError}
        </p>
      ) : null}
    </div>
  )
}
