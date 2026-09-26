import { useCallback, useId, useState } from 'react'
import { flushSync } from 'react-dom'

import {
  canViewTransition,
  clearViewTransitionName,
  nameForViewTransition,
  skipActiveViewTransition,
  startViewTransition,
} from '#/lib/view-transition'

// Morph UI's Morphing Popover and Morph Dialog, on top of Base UI's Popover
// and Dialog: the trigger and the popup share one view-transition-name, so
// the button grows into the panel and folds back into the button. Opening
// and closing run at a relaxed pace (vt-morph-open / vt-morph-close in
// styles.css), closing a little faster; Escape and tabbing away close at
// once, since shortcuts shouldn't animate.

const OPEN_CLASSES = 'vt-move vt-expand vt-morph-open'
const CLOSE_CLASSES = 'vt-move vt-expand vt-morph-close'
const INSTANT_REASONS = new Set(['escape-key', 'focus-out', 'navigate'])

/**
 * For the popup's className. The morph replaces the popup's own zoom and
 * fade: a popup still fading in would be captured mid-fade.
 */
export const morphPopupClassName =
  'transition-none data-starting-style:scale-100 data-starting-style:opacity-100'

type SetMorphOpenOptions = {
  /** Base UI's change reason, or 'navigate' to close without animating. */
  reason?: string
  /** Extra state updates to commit in the same render as the open change. */
  alongside?: () => void
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// Base UI mounts the popup in a portal and positions it asynchronously, so
// wait until it's laid out before the browser takes the new snapshot.
async function waitForLayout(find: () => HTMLElement | null) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const element = find()
    if (element && element.getBoundingClientRect().width > 0) {
      await tick()
      return element
    }
    await tick()
  }
  return find()
}

export function useMorph() {
  const name = `morph-${useId().replace(/[^\w-]/g, '')}`
  const [open, setOpenState] = useState(false)

  const find = useCallback(
    (part: 'trigger' | 'popup') =>
      document.querySelector<HTMLElement>(`[data-morph-${part}="${name}"]`),
    [name],
  )

  const setOpen = useCallback(
    (next: boolean, options?: SetMorphOpenOptions) => {
      const update = () => {
        options?.alongside?.()
        setOpenState(next)
      }
      skipActiveViewTransition()
      const trigger = find('trigger')
      const popup = find('popup')
      const animate =
        canViewTransition() &&
        !INSTANT_REASONS.has(options?.reason ?? '') &&
        trigger?.isConnected &&
        (next || popup)
      if (!animate || !trigger) {
        update()
        return
      }

      if (next) {
        nameForViewTransition(trigger, name, OPEN_CLASSES)
        const transition = startViewTransition(async () => {
          clearViewTransitionName(trigger)
          flushSync(update)
          const shown = await waitForLayout(() => find('popup'))
          if (shown) nameForViewTransition(shown, name, OPEN_CLASSES)
        })
        void transition?.finished.finally(() => {
          const shown = find('popup')
          if (shown) clearViewTransitionName(shown)
        })
        return
      }

      if (!popup) return
      nameForViewTransition(popup, name, CLOSE_CLASSES)
      const transition = startViewTransition(() => {
        clearViewTransitionName(popup)
        // Base UI keeps the popup mounted while it closes; hide it so only
        // the morph back into the trigger shows.
        popup.style.opacity = '0'
        flushSync(update)
        nameForViewTransition(trigger, name, CLOSE_CLASSES)
      })
      void transition?.finished.finally(() => clearViewTransitionName(trigger))
    },
    [find, name],
  )

  const onOpenChange = useCallback(
    (next: boolean, details?: { reason?: string }) =>
      setOpen(next, { reason: details?.reason }),
    [setOpen],
  )

  return {
    open,
    setOpen,
    /** Pass straight to Base UI's `onOpenChange`. */
    onOpenChange,
    triggerProps: { 'data-morph-trigger': name },
    popupProps: { 'data-morph-popup': name },
  }
}
