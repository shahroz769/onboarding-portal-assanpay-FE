import * as React from 'react'
import type { VariantProps } from 'class-variance-authority'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'

import { cn } from '#/lib/utils'
import { buttonVariants } from '#/components/ui/button-variants'

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

function ButtonLink({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: useRender.ComponentProps<'a'> & VariantProps<typeof buttonVariants>) {
  return useRender({
    defaultTagName: 'a',
    props: mergeProps<'a'>(
      { className: cn(buttonVariants({ variant, size, className })) },
      props,
    ),
    render,
    state: { slot: 'button', variant, size },
  })
}

export { Button, ButtonLink }
