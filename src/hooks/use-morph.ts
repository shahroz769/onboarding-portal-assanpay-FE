import { useCallback, useId, useRef, useState } from 'react'
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
// once, since shortcuts shouldn't animate. With `morphClose: false` only the
// open morphs; closing uses the popup's regular Base UI exit animation.
//
// Two ways to drive it:
// - `open` / `setOpen` / `onOpenChange` when the hook owns the open state.
// - `run(commit, trigger)` when the open state lives elsewhere: `commit` makes
//   the state updates that open the dialog and runs inside the morph. Close
//   the dialog as usual; it plays the regular exit animation.
// Either way, spread `popupProps` onto the dialog's popup. Icon-only
// triggers skip the morph and use the regular open animation.

const OPEN_CLASSES = 'vt-move vt-expand vt-morph-open'
const CLOSE_CLASSES = 'vt-move vt-expand vt-morph-close'
const INSTANT_REASONS = new Set(['escape-key', 'focus-out', 'navigate'])

/**
 * Applied to the popup only while an open actually morphed. The morph
 * replaces the popup's own zoom and fade on open (a popup still fading in
 * would be captured mid-fade); the exit transition is left intact. Opens
 * that can't morph (no View Transitions support) keep the regular zoom-in.
 */
const MORPH_POPUP_CLASS_NAME =
  'data-starting-style:scale-100 data-starting-style:opacity-100'

export type MorphPopupProps = {
  'data-morph-popup': string
  className?: string
}

type SetMorphOpenOptions = {
  /** Base UI's change reason, or 'navigate' to close without animating. */
  reason?: string
  /** Extra state updates to commit in the same render as the open change. */
  alongside?: () => void
}

/**
 * Icon-only buttons (Button's `icon*` sizes) are too small to grow a dialog
 * out of convincingly: the panel seems to burst from a dot. They keep the
 * dialog's regular zoom-in instead.
 */
function isIconOnly(element: HTMLElement) {
  return element.dataset.size?.startsWith('icon') ?? false
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

export function useMorph({ morphClose = true }: { morphClose?: boolean } = {}) {
  const name = `morph-${useId().replace(/[^\w-]/g, '')}`
  const [open, setOpenState] = useState(false)
  const [morphed, setMorphed] = useState(false)
  // The element the last open grew out of, for morphing back on close.
  const lastTrigger = useRef<HTMLElement | null>(null)

  const find = useCallback(
    (part: 'trigger' | 'popup') =>
      document.querySelector<HTMLElement>(`[data-morph-${part}="${name}"]`),
    [name],
  )

  const run = useCallback(
    (commit: () => void, trigger?: HTMLElement | null) => {
      skipActiveViewTransition()
      const from = trigger ?? find('trigger')
      if (!canViewTransition() || !from?.isConnected || isIconOnly(from)) {
        setMorphed(false)
        commit()
        return
      }

      lastTrigger.current = from
      nameForViewTransition(from, name, OPEN_CLASSES)
      const transition = startViewTransition(async () => {
        clearViewTransitionName(from)
        flushSync(() => {
          setMorphed(true)
          commit()
        })
        const shown = await waitForLayout(() => find('popup'))
        if (shown) nameForViewTransition(shown, name, OPEN_CLASSES)
      })
      void transition?.finished.finally(() => {
        const shown = find('popup')
        if (shown) clearViewTransitionName(shown)
      })
    },
    [find, name],
  )

  const setOpen = useCallback(
    (next: boolean, options?: SetMorphOpenOptions) => {
      const update = () => {
        options?.alongside?.()
        setOpenState(next)
      }

      if (next) {
        if (INSTANT_REASONS.has(options?.reason ?? '')) {
          skipActiveViewTransition()
          setMorphed(false)
          update()
          return
        }
        run(update)
        return
      }

      skipActiveViewTransition()
      const trigger = lastTrigger.current ?? find('trigger')
      const popup = find('popup')
      const animate =
        morphClose &&
        canViewTransition() &&
        !INSTANT_REASONS.has(options?.reason ?? '') &&
        trigger?.isConnected &&
        popup
      if (!animate || !trigger || !popup) {
        update()
        return
      }

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
    [find, morphClose, name, run],
  )

  const onOpenChange = useCallback(
    (next: boolean, details?: { reason?: string }) =>
      setOpen(next, { reason: details?.reason }),
    [setOpen],
  )

  const popupProps: MorphPopupProps = {
    'data-morph-popup': name,
    className: morphed ? MORPH_POPUP_CLASS_NAME : undefined,
  }

  return {
    open,
    setOpen,
    /** Pass straight to Base UI's `onOpenChange`. */
    onOpenChange,
    /** Opens a dialog whose state lives elsewhere, growing it out of `trigger`. */
    run,
    triggerProps: { 'data-morph-trigger': name },
    popupProps,
  }
}
