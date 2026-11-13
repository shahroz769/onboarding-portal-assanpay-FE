import type * as React from 'react'
import { MonitorCog, Sparkles, ZapOff } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useSystemReducedMotion } from '#/hooks/use-reduced-motion'
import type { PageMotion } from '#/lib/page-motion'
import { setPageMotion, usePageMotion } from '#/lib/page-motion'

const MOTION_OPTIONS: Array<{
  value: PageMotion
  label: string
  icon: React.ComponentType<React.ComponentProps<'svg'>>
}> = [
  { value: 'system', label: 'System', icon: MonitorCog },
  { value: 'on', label: 'On', icon: Sparkles },
  { value: 'off', label: 'Off', icon: ZapOff },
]

export function MotionToggle() {
  const value = usePageMotion()
  const reducedBySystem = useSystemReducedMotion()
  const selected =
    MOTION_OPTIONS.find((option) => option.value === value) ?? MOTION_OPTIONS[0]
  // The trigger shows what actually happens: full motion or not. "System"
  // resolves through the OS setting.
  const fullMotion = value === 'on' || (value === 'system' && !reducedBySystem)
  const SelectedIcon = fullMotion ? Sparkles : ZapOff
  const stateLabel =
    value === 'system'
      ? `System (${reducedBySystem ? 'reduced' : 'on'})`
      : selected.label

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full hover:bg-foreground/10 dark:hover:bg-foreground/15"
                  aria-label={`Animations: ${stateLabel}`}
                />
              }
            />
          }
        >
          <SelectedIcon />
        </TooltipTrigger>
        <TooltipContent>Animations: {stateLabel}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Animations</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => setPageMotion(next as PageMotion)}
          >
            {MOTION_OPTIONS.map((option) => {
              const OptionIcon = option.icon

              return (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  className="pl-2 pr-8 [&>span:first-child]:left-auto [&>span:first-child]:right-2"
                >
                  <OptionIcon />
                  <span>{option.label}</span>
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
          {value === 'system' && reducedBySystem ? (
            <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
              Your device is set to reduce motion. Choose On for full
              animations.
            </p>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
