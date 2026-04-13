"use client"

import * as React from "react"
import { Laptop, Moon, Sun } from "lucide-react"

import { Button } from "#/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"

type ThemeMode = "auto" | "light" | "dark"

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode
  const root = document.documentElement

  root.classList.remove("light", "dark")
  root.classList.add(resolved)

  if (mode === "auto") {
    root.removeAttribute("data-theme")
  } else {
    root.setAttribute("data-theme", mode)
  }

  root.style.colorScheme = resolved
  window.localStorage.setItem("theme", mode)
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<ThemeMode>("auto")

  React.useEffect(() => {
    const stored = window.localStorage.getItem("theme")
    const initialTheme =
      stored === "light" || stored === "dark" || stored === "auto"
        ? stored
        : "auto"

    setTheme(initialTheme)
    applyTheme(initialTheme)

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if ((window.localStorage.getItem("theme") ?? "auto") === "auto") {
        applyTheme("auto")
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            const nextTheme = value as ThemeMode
            setTheme(nextTheme)
            applyTheme(nextTheme)
          }}
        >
          <DropdownMenuRadioItem value="auto">System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
