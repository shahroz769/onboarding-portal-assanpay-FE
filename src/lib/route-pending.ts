/**
 * `pendingMs` for routes whose loader only starts their requests (nothing is
 * awaited). Such a route is pending just while its code chunk loads, usually
 * a few milliseconds, so it renders straight away with its normal page
 * transition (see route-transitions.ts) and its own loading state, and its
 * data shows the moment the request completes. The route skeleton appears
 * only when the route itself is slow to load (an uncached chunk on a slow
 * connection), so the router's minimum skeleton time no longer delays data.
 */
export const ROUTE_SKELETON_DELAY_MS = 200
