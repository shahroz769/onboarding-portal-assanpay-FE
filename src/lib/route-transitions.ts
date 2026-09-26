import type { AnyRouter, ParsedLocation } from '@tanstack/react-router'

import { MERCHANT_DETAIL_TABS } from '#/features/merchants/merchant-detail-tabs'

// View transition types for route changes, passed to the router as
// `defaultViewTransition`. styles.css turns each type into Morph UI motion:
//   page             the content column blurs between sections
//   stack-push/pop   user detail pushes over the users list (iOS-style)
//   tab-next/prev    the merchant detail panel slides toward the new tab
// Search-only changes (filters, sorting, paging) never animate.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MERCHANT_TAB_SLUGS = MERCHANT_DETAIL_TABS.map((tab) =>
  tab.to.slice(tab.to.lastIndexOf('/') + 1),
)

const MERCHANT_DETAIL = new RegExp(`^/merchants/(${UUID})(?:/([\\w-]+))?$`, 'i')
const USER_LIST = /^\/user-management$/
const USER_DETAIL = /^\/user-management\/users\/[^/]+$/

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

/**
 * Names the new page's sections only after the old page is captured, so on
 * a `page` transition they rise in fresh (staggered) while the old page
 * blurs out, instead of pairing with the old page's sections (styles.css).
 * The router commits the new page inside its view transition's update, so
 * onBeforeRouteMount runs after the old snapshot and before the new one.
 */
export function trackRouteTransitions(router: AnyRouter) {
  const root = document.documentElement
  const unsubscribeNavigate = router.subscribe('onBeforeNavigate', () =>
    root.removeAttribute('data-vt-entering'),
  )
  const unsubscribeMount = router.subscribe('onBeforeRouteMount', () =>
    root.setAttribute('data-vt-entering', ''),
  )
  return () => {
    unsubscribeNavigate()
    unsubscribeMount()
  }
}

export function routeTransitionTypes({
  fromLocation,
  toLocation,
  pathChanged,
}: {
  fromLocation?: ParsedLocation
  toLocation: ParsedLocation
  pathChanged: boolean
}): Array<string> | false {
  if (!fromLocation || !pathChanged) return false
  const from = trimPath(fromLocation.pathname)
  const to = trimPath(toLocation.pathname)

  const fromTab = merchantTab(from)
  const toTab = merchantTab(to)
  if (fromTab && toTab && fromTab.merchantId === toTab.merchantId) {
    if (fromTab.index === toTab.index) return false
    return [toTab.index > fromTab.index ? 'tab-next' : 'tab-prev']
  }

  if (USER_LIST.test(from) && USER_DETAIL.test(to)) return ['stack-push']
  if (USER_DETAIL.test(from) && USER_LIST.test(to)) return ['stack-pop']

  return ['page']
}
