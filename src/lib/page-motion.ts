import { useSyncExternalStore } from 'react'

// User preference for UI animations, set from the topbar (MotionToggle).
// Stored per browser.
//   system  follow the OS: full motion, or the reduced-motion fallbacks when
//           the OS asks to reduce motion (the default)
//   on      full motion everywhere, even when the OS asks to reduce it
//   off     no motion: route/view transitions skipped, JS animation off and
//           every CSS animation/transition instant (loaders keep looping)
// CSS reads it from <html data-animations="on|off"> (no attribute = system):
// styles.css and morph.css.

export type PageMotion = 'system' | 'on' | 'off'

const STORAGE_KEY = 'page-motion'
const listeners = new Set<() => void>()

function parse(value: string | null): PageMotion {
  return value === 'on' || value === 'off' ? value : 'system'
}

export function getPageMotion(): PageMotion {
  if (typeof window === 'undefined') return 'system'
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'system'
  }
}

/**
 * Mirrors the setting onto <html data-animations>. Called at startup and on
 * change. (Not `data-motion`: elements already use that for their own
 * entering/exiting states.)
 */
export function applyPageMotion() {
  if (typeof document === 'undefined') return
  const value = getPageMotion()
  if (value === 'system') {
    document.documentElement.removeAttribute('data-animations')
  } else {
    document.documentElement.setAttribute('data-animations', value)
  }
}

export function setPageMotion(value: PageMotion) {
  try {
    if (value === 'system') window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Storage blocked: the choice just won't persist past this session.
  }
  applyPageMotion()
  for (const listener of listeners) listener()
}

export function subscribePageMotion(onChange: () => void) {
  listeners.add(onChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    applyPageMotion()
    onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function usePageMotion() {
  return useSyncExternalStore(
    subscribePageMotion,
    getPageMotion,
    () => 'system' as const,
  )
}
