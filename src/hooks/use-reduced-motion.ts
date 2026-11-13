import { useSyncExternalStore } from 'react'

import { getPageMotion, subscribePageMotion } from '#/lib/page-motion'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Whether the OS itself asks to reduce motion, ignoring the in-app setting. */
export function prefersReducedMotionBySystem() {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  const unsubscribePageMotion = subscribePageMotion(onChange)
  return () => {
    media.removeEventListener('change', onChange)
    unsubscribePageMotion()
  }
}

/**
 * Whether to reduce motion, after the topbar animations setting
 * (lib/page-motion.ts): "off" always reduces, "on" never does, "system"
 * follows the OS. For JS-driven animation.
 */
export function prefersReducedMotion() {
  const setting = getPageMotion()
  if (setting === 'system') return prefersReducedMotionBySystem()
  return setting === 'off'
}

/** Reactive `prefersReducedMotion`, for JS animations CSS can't reach. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}

/** Reactive OS-only `prefers-reduced-motion`. */
export function useSystemReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    prefersReducedMotionBySystem,
    () => false,
  )
}
