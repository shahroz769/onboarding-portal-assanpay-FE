import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '#/lib/utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default:
          'border-blue-100 bg-blue-50 text-blue-800 *:data-[slot=alert-description]:text-blue-800/90 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 dark:*:data-[slot=alert-description]:text-blue-300/90',
        success:
          'border-emerald-100 bg-emerald-50 text-emerald-800 *:data-[slot=alert-description]:text-emerald-800/90 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:*:data-[slot=alert-description]:text-emerald-300/90',
        warning:
          'border-amber-100 bg-amber-50 text-amber-800 *:data-[slot=alert-description]:text-amber-800/90 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300 dark:*:data-[slot=alert-description]:text-amber-300/90',
        destructive:
          'border-red-100 bg-red-50 text-red-800 *:data-[slot=alert-description]:text-red-800/90 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:*:data-[slot=alert-description]:text-red-300/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
