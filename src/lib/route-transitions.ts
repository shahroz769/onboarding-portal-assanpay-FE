import type { AnyRouter, ParsedLocation } from '@tanstack/react-router'

import { MERCHANT_DETAIL_TABS } from '#/features/merchants/merchant-detail-tabs'

// View transition types for route changes, passed to the router as
// `defaultViewTransition`. styles.css turns each type into Morph UI motion:
//   page             the content column blurs between sections
//   tab-next/prev    the merchant detail panel slides toward the new tab
// Search-only changes (filters, sorting, paging) never animate.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MERCHANT_TAB_SLUGS = MERCHANT_DETAIL_TABS.map((tab) =>
  tab.to.slice(tab.to.lastIndexOf('/') + 1),
)

const MERCHANT_DETAIL = new RegExp(`^/merchants/(${UUID})(?:/([\\w-]+))?$`, 'i')

function trimPath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

function merchantTab(pathname: string) {
  const match = MERCHANT_DETAIL.exec(pathname)
  if (!match) return null
  // The bare /merchants/$merchantId redirects to the first tab.
  const index = match[2] ? MERCHANT_TAB_SLUGS.indexOf(match[2]) : 0
  return index < 0 ? null : { merchantId: match[1].toLowerCase(), index }
}

type LocationChange = {
  fromLocation?: ParsedLocation
  toLocation: ParsedLocation
  pathChanged: boolean
}

// Whether the page currently shows a route's pending fallback (skeleton).
let showsPendingFallback = () => false

/**
 * Keeps route motion on the page change itself, not on data arriving:
 *
 * - A route with a pending skeleton shows it through a plain render, and the
 *   router's view transition only wraps the later commit of the loaded page.
 *   So the skeleton's arrival is animated in CSS instead (it rises in,
 *   staggered, like the page transition): `data-vt-pending-enter` on the
 *   root says which motion the navigation gets, and styles.css plays it
 *   while the page shows the skeleton. routeTransitionTypes then skips the
 *   view transition when the loaded page replaces a skeleton; skeletons are
 *   layout-exact, so the data just fills in.
 * - The new page's sections are named only after the old page is captured,
 *   so on a `page` transition they rise in fresh (staggered) while the old
 *   page blurs out, instead of pairing with the old page's sections. The
 *   router commits the new page inside its view transition's update, so
 *   onBeforeRouteMount runs after the old snapshot and before the new one.
 */
export function trackRouteTransitions(router: AnyRouter) {
  const root = document.documentElement
  showsPendingFallback = () =>
    router.state.matches.some((match) => match.status === 'pending')

  const unsubscribeNavigate = router.subscribe('onBeforeNavigate', (event) => {
    root.removeAttribute('data-vt-entering')
    const types = pageTransitionTypes(event)
    const enter = !types
      ? null
      : types.some((type) => type.startsWith('tab-'))
        ? 'tab'
        : 'page'
    if (enter) root.setAttribute('data-vt-pending-enter', enter)
    else root.removeAttribute('data-vt-pending-enter')
  })
  const unsubscribeMount = router.subscribe('onBeforeRouteMount', () =>
    root.setAttribute('data-vt-entering', ''),
  )
  return () => {
    unsubscribeNavigate()
    unsubscribeMount()
  }
}

export function routeTransitionTypes(
  change: LocationChange,
): Array<string> | false {
  if (showsPendingFallback()) return false
  return pageTransitionTypes(change)
}

function pageTransitionTypes({
  fromLocation,
  toLocation,
  pathChanged,
}: LocationChange): Array<string> | false {
  if (!fromLocation || !pathChanged) return false
  const from = trimPath(fromLocation.pathname)
  const to = trimPath(toLocation.pathname)

  const fromTab = merchantTab(from)
  const toTab = merchantTab(to)
  if (fromTab && toTab && fromTab.merchantId === toTab.merchantId) {
    if (fromTab.index === toTab.index) return false
    return [toTab.index > fromTab.index ? 'tab-next' : 'tab-prev']
  }

  return ['page']
}
