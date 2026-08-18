import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

import { statusTint, statusTintDeep } from '#/lib/status-styles'
import type { StatusTint } from '#/lib/status-styles'
import { cn } from '#/lib/utils'

export type OnboardingNavSection = {
  id: string
  label: string
  tone: StatusTint
  complete: boolean
}

// How close to the page bottom counts as "at the end" — the last section
// often can't scroll high enough to enter the scrollspy band.
const BOTTOM_THRESHOLD_PX = 24

// Sticky section nav for the long onboarding form: scrollspy highlights the
// current section (in that section's tone), completed sections show a check,
// and the bar doubles as a progress indicator. Chips scroll horizontally on
// small screens.
export function OnboardingSectionNav({
  sections,
}: {
  sections: OnboardingNavSection[]
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  // While a chip-initiated smooth scroll is in flight, the scrollspy stays
  // pinned to the clicked section instead of flickering through the sections
  // it passes over.
  const pinnedUntilRef = useRef(0)

  useEffect(() => {
    const lastId = sections[sections.length - 1]?.id ?? ''
    const isNearBottom = () =>
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - BOTTOM_THRESHOLD_PX

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < pinnedUntilRef.current) return
        // At the page end the last card may never reach the spy band, so it
        // wins by position rather than by intersection.
        if (isNearBottom()) {
          setActiveId(lastId)
          return
        }
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-25% 0px -65% 0px' },
    )
    for (const section of sections) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }

    const onScroll = () => {
      if (Date.now() < pinnedUntilRef.current) return
      if (isNearBottom()) setActiveId(lastId)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [sections])

  const completedCount = sections.filter((section) => section.complete).length
  const progress = Math.round((completedCount / sections.length) * 100)

  return (
    <div className="sticky top-0 z-20 rounded-xl border bg-background px-2 pt-2 pb-2.5 shadow-sm">
      <nav
        aria-label="Form sections"
        className="scroll-fade-x scroll-fade-4 flex items-stretch gap-1 overflow-x-auto"
      >
        {sections.map((section, index) => {
          const isActive = section.id === activeId
          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => {
                setActiveId(section.id)
                pinnedUntilRef.current = Date.now() + 800
                document.getElementById(section.id)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }}
              className={cn(
                'flex min-w-max flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-center text-xs font-medium whitespace-nowrap transition-colors',
                isActive
                  ? statusTint(section.tone)
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-4 items-center justify-center rounded-full text-[10px] font-semibold',
                  section.complete || isActive
                    ? statusTintDeep(section.tone)
                    : 'bg-muted-foreground/15 text-muted-foreground',
                )}
              >
                {section.complete ? (
                  <Check className="size-2.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span className={cn(isActive && !section.complete && 'shimmer')}>
                {section.label}
              </span>
            </button>
          )
        })}
      </nav>
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Form completion"
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
