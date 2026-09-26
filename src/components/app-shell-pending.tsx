import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

// Start time shared by every mounted copy of the loader (see below).
let bootStartTime: CSSNumberish | null = null
let mountedCount = 0

/**
 * Shown while the signed-in app (an `ssr: false` route) boots. TanStack Start
 * server-renders this in place of the route, so the first HTML already paints
 * the logo instead of a blank page while the auth check runs. The motion is
 * pure CSS, so it keeps running while the client bundle loads and hydrates.
 *
 * The router swaps the hydrated copy for a fresh one (ClientOnly fallback →
 * Suspense fallback) right after hydration, which would restart every CSS
 * animation. A later copy adopts the first copy's start time instead, so the
 * motion continues without a jump.
 */
export function AppShellPending() {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const animations = ref.current?.getAnimations({ subtree: true }) ?? []
    if (mountedCount > 0 || bootStartTime !== null) {
      for (const animation of animations) animation.startTime = bootStartTime
    } else {
      bootStartTime =
        animations.find((animation) => animation.startTime !== null)
          ?.startTime ?? document.timeline.currentTime
    }
    mountedCount++

    return () => {
      mountedCount--
      // The replacement copy mounts in the same commit, before this runs.
      queueMicrotask(() => {
        if (mountedCount === 0) bootStartTime = null
      })
    }
  }, [])

  return (
    <main className="grid min-h-svh place-items-center bg-background">
      <div
        ref={ref}
        role="status"
        aria-label="Loading"
        className="relative size-16"
      >
        {GHOSTS.map((ghost) => (
          <GhostMark key={ghost} ghost={ghost} />
        ))}
        <LoaderMark />
      </div>
    </main>
  )
}

// The brand logo's colour, from `public/favicon.svg`.
const BRAND_COLOR = '#e09145'

/**
 * A loader-only take on the AssanPay mark (the brand logo itself lives in
 * `public/favicon.svg`). The two halves are identical and sit 180° apart
 * around the viewBox centre, so each half turn lands on a matching frame.
 *
 * Each half is its own <svg>, so the fly-in and the spin animate outer
 * elements the browser can run off the main thread while JS boots.
 */
function LoaderMark() {
  return (
    <div className="app-shell-logo-spin absolute inset-0">
      <svg
        viewBox="15 15 345 345"
        overflow="visible"
        aria-hidden="true"
        className="app-shell-logo-half absolute inset-0 size-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <MarkHalf color={BRAND_COLOR} />
      </svg>
      <svg
        viewBox="15 15 345 345"
        overflow="visible"
        aria-hidden="true"
        className="app-shell-logo-half app-shell-logo-half-b absolute inset-0 size-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="rotate(180 187.5 187.5)">
          <MarkHalf color={BRAND_COLOR} />
        </g>
      </svg>
    </div>
  )
}

// Afterimages behind the spinning mark, farthest (faintest) first.
const GHOSTS = [6, 5, 4, 3, 2, 1]

/**
 * One afterimage for the motion trail: a flat, single-colour silhouette of
 * both halves (no speed trails or dots, which just add noise when smeared).
 */
function GhostMark({ ghost }: { ghost: number }) {
  return (
    <div
      className="app-shell-logo-ghost absolute inset-0"
      style={{ '--ghost': ghost } as CSSProperties}
    >
      <svg
        viewBox="15 15 345 345"
        overflow="visible"
        aria-hidden="true"
        className="size-full"
        fill={BRAND_COLOR}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path transform={HALF_FRAME} d={HALF_BODY} />
        <path transform={`rotate(180 187.5 187.5) ${HALF_FRAME}`} d={HALF_BODY} />
      </svg>
    </div>
  )
}

// A half's local frame: rotated 30° so its long leg runs down the y axis.
const HALF_FRAME = 'translate(128.4 67.4) rotate(30)'
const HALF_BODY =
  'M0 205L0 14Q0 0 12.12 -7L55.38 -31.97Q67.5 -38.97 79.63 -31.98L126.87 -4.79Q139 2.2 139 16.2L139 66Q139 80 126.86 73.04L79.64 45.96Q67.5 39 67.5 53L67.5 180H54V174.45A6.75 6.75 0 0 0 40.5 174.45V200H27V194.75A6.75 6.75 0 0 0 13.5 194.75V205Z'

// Speed trails, inner first. `len` is the resting length from the root.
const TRAILS = [
  { x: 60.75, len: 81.25 },
  { x: 33.75, len: 64.25, dotY: 240 },
  { x: 6.75, len: 49.25, dotY: 223 },
]

const TRAIL_ROOT = 150
const TRAIL_WIDTH = 13.5

/** One half with its speed trails, drawn in its local frame. */
function MarkHalf({ color }: { color: string }) {
  return (
    <g transform={HALF_FRAME}>
      <g fill={color}>
        <path d={HALF_BODY} />
        {TRAILS.map((trail, i) => {
          const style = {
            '--len': `${trail.len}px`,
            '--i': i,
          } as CSSProperties
          return (
            <g key={trail.x}>
              <line
                className="app-shell-logo-trail"
                x1={trail.x}
                y1={TRAIL_ROOT}
                x2={trail.x}
                y2={TRAIL_ROOT + 200}
                stroke={color}
                strokeWidth={TRAIL_WIDTH}
                strokeLinecap="round"
                style={style}
              />
              {trail.dotY && (
                <circle
                  className="app-shell-logo-dot"
                  cx={trail.x}
                  cy={trail.dotY}
                  r={TRAIL_WIDTH / 2}
                  style={style}
                />
              )}
            </g>
          )
        })}
      </g>
    </g>
  )
}
