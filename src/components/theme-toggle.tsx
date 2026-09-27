import type * as React from 'react'
import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  skipActiveViewTransition,
  startViewTransition,
} from '#/lib/view-transition'

type ThemeMode = 'system' | 'light' | 'dark'

const THEME_OPTIONS: Array<{
  value: ThemeMode
  label: string
  icon: React.ComponentType<React.ComponentProps<'svg'>>
}> = [
  {
    value: 'system',
    label: 'System',
    icon: Laptop,
  },
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
  },
]

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const selectedValue = (theme as ThemeMode | undefined) ?? 'system'

  const selectedTheme =
    THEME_OPTIONS.find((option) => option.value === selectedValue) ??
    THEME_OPTIONS[0]
  const SelectedIcon = selectedTheme.icon

  const updateTheme = (nextTheme: ThemeMode) => {
    // morph.css opts the root out of view transitions; opt it back in so
    // the whole page crossfades between themes (see styles.css).
    const root = document.documentElement
    skipActiveViewTransition()
    root.setAttribute('data-vt-root', '')
    const transition = startViewTransition(() => setTheme(nextTheme))
    if (transition) {
      void transition.finished.finally(() =>
        root.removeAttribute('data-vt-root'),
      )
    } else {
      root.removeAttribute('data-vt-root')
    }
  }

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
                  className="hover:bg-foreground/10 dark:hover:bg-foreground/15"
                  aria-label={`Theme: ${selectedTheme.label}`}
                />
              }
            />
          }
        >
          <SelectedIcon />
          <span className="sr-only">{selectedTheme.label}</span>
        </TooltipTrigger>
        <TooltipContent>Theme: {selectedTheme.label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={selectedValue}
            onValueChange={(value) => updateTheme(value as ThemeMode)}
          >
            {THEME_OPTIONS.map((option) => {
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
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
