import * as React from 'react'
import { CheckIcon, MinusIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'

import { cn } from '#/lib/utils'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        't-check peer group/checkbox relative inline-flex size-4 shrink-0 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-input shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-checked:bg-primary dark:data-indeterminate:bg-primary',
        className,
      )}
      {...props}
    >
      {/* Kept mounted so the mark can un-draw on uncheck. The draw is the
          .t-check transition in styles.css; --check-len is each path's
          getTotalLength(), rounded up. Lucide's check path starts at the long
          arm, so --check-from is negative to draw from the short arm. */}
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        keepMounted
        className="grid place-content-center text-current"
      >
        <CheckIcon className="size-3.5 [--check-from:-23] [--check-len:23] group-data-indeterminate/checkbox:hidden" />
        <MinusIcon className="hidden size-3.5 [--check-len:14] group-data-indeterminate/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
