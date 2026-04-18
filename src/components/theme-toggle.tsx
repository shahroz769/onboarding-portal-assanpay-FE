"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "#/components/ui/button"

type ThemeMode = "auto" | "light" | "dark"
type ResolvedTheme = "light" | "dark"

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "light" || mode === "dark") {
    return mode
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
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

  return resolved
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<ThemeMode>("auto")
  const [resolvedTheme, setResolvedTheme] =
    React.useState<ResolvedTheme>("light")

  React.useEffect(() => {
    const stored = window.localStorage.getItem("theme")
    const initialTheme: ThemeMode =
      stored === "light" || stored === "dark" || stored === "auto"
        ? stored
        : "auto"

    setTheme(initialTheme)
    setResolvedTheme(applyTheme(initialTheme))

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if ((window.localStorage.getItem("theme") ?? "auto") === "auto") {
        setResolvedTheme(applyTheme("auto"))
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const nextTheme: ThemeMode = isDark ? "light" : "dark"
        const apply = () => {
          setTheme(nextTheme)
          setResolvedTheme(applyTheme(nextTheme))
        }

        if (document.startViewTransition) {
          document.startViewTransition(apply)
        } else {
          apply()
        }
      }}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
