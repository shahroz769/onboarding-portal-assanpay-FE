"use client"

import * as React from "react"
import { Laptop, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "#/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"

type ThemeMode = "system" | "light" | "dark"

const THEME_OPTIONS: Array<{
  value: ThemeMode
  label: string
  icon: React.ComponentType<React.ComponentProps<"svg">>
}> = [
  {
    value: "system",
    label: "System",
    icon: Laptop,
  },
  {
    value: "light",
    label: "Light",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
  },
]

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  const selectedTheme =
    THEME_OPTIONS.find((option) => option.value === theme) ??
    THEME_OPTIONS[0]
  const SelectedIcon = selectedTheme.icon

  const updateTheme = (nextTheme: ThemeMode) => {
    const apply = () => setTheme(nextTheme)

    if (document.startViewTransition) {
      document.startViewTransition(apply)
    } else {
      apply()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${selectedTheme.label}`}
        >
          <SelectedIcon />
          <span className="sr-only">{selectedTheme.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={theme ?? "system"}
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
