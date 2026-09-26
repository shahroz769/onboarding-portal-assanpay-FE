import { useDeferredValue, useState, ViewTransition } from 'react'

import { cn } from '#/lib/utils'

// Morph UI Number Flip: changed digits roll a full line in the direction of
// the change (vt-roll), with a short right-to-left stagger. Each digit keeps
// a stable key by its position from the right, so unchanged digits stay put.
// Only an already-shown value rolls; the first value renders as is.

export function NumberFlip({
  value,
  format,
  stagger = true,
  className,
}: {
  value: number
  format: (value: number) => string
  stagger?: boolean
  className?: string
}) {
  // Query data lands as a synchronous update, and <ViewTransition> only
  // animates Transitions: the deferred value re-renders the digits in one.
  const shown = useDeferredValue(value)
  const [previous, setPrevious] = useState(shown)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  if (previous !== shown) {
    setPrevious(shown)
    setDirection(shown >= previous ? 'forward' : 'back')
  }

  const formatted = format(shown)
  return (
    <span className={cn('inline-flex tabular-nums', className)}>
      <span className="sr-only">{formatted}</span>
      <span aria-hidden="true" className="inline-flex">
        {formatted.split('').map((char, index) => {
          const position = formatted.length - index
          const delay = stagger
            ? Math.min(formatted.slice(index + 1).replace(/\D/g, '').length, 2)
            : 0
          return /\d/.test(char) ? (
            <ViewTransition
              key={position}
              default={`vt-roll vt-${direction}${delay ? ` vt-delay-${delay}` : ''}`}
            >
              <span>{char}</span>
            </ViewTransition>
          ) : (
            <span key={position}>{char}</span>
          )
        })}
      </span>
    </span>
  )
}
