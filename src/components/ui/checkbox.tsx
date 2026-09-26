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
        'peer group/checkbox relative inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-checked:bg-primary dark:data-indeterminate:bg-primary',
        className,
      )}
      {...props}
    >
      {/* Kept mounted so unchecking can fade out too. Deliberately tiny: this
          is toggled tens of times a day in bulk selection. */}
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        keepMounted
        className="grid place-content-center text-current transition-[opacity,scale] duration-100 ease-out data-unchecked:opacity-0 data-unchecked:scale-90 data-starting-style:opacity-0 data-starting-style:scale-90 motion-reduce:transition-opacity"
      >
        <CheckIcon className="size-3.5 group-data-indeterminate/checkbox:hidden" />
        <MinusIcon className="hidden size-3.5 group-data-indeterminate/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
