// Typed access to the View Transition API. Every caller must handle it being
// missing: those browsers get the same UI change without the animation.

type ViewTransitionHandle = {
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

type ViewTransitionUpdate = () => void | Promise<void>

type ViewTransitionDocument = {
  startViewTransition?: (
    update: ViewTransitionUpdate | { update: ViewTransitionUpdate },
  ) => ViewTransitionHandle
  activeViewTransition?: ViewTransitionHandle | null
}

function viewTransitionDocument() {
  return document as unknown as ViewTransitionDocument
}

export function canViewTransition() {
  return (
    typeof document !== 'undefined' &&
    typeof viewTransitionDocument().startViewTransition === 'function'
  )
}

/** Starts a document view transition, or runs `update` directly without one. */
export function startViewTransition(
  update: ViewTransitionUpdate,
): ViewTransitionHandle | null {
  const doc = viewTransitionDocument()
  if (typeof doc.startViewTransition !== 'function') {
    void update()
    return null
  }
  return doc.startViewTransition.call(document, update)
}

/** Finishes the running transition at once, so a new one can start cleanly. */
export function skipActiveViewTransition() {
  viewTransitionDocument().activeViewTransition?.skipTransition()
}

/** Names an element for the next snapshot, with morph.css classes. */
export function nameForViewTransition(
  element: HTMLElement,
  name: string,
  classes: string,
) {
  element.style.setProperty('view-transition-name', name)
  element.style.setProperty('view-transition-class', classes)
}

export function clearViewTransitionName(element: HTMLElement) {
  element.style.removeProperty('view-transition-name')
  element.style.removeProperty('view-transition-class')
}
