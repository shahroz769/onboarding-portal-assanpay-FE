import { useState } from 'react'
import type { ReactNode, TransitionEvent } from 'react'

type MotionSwapItem = {
  id: number
  motionKey: string
  content: ReactNode
  exiting: boolean
  animateIn: boolean
}

type MotionSwapState = {
  motionKey: string
  nextItemId: number
  items: MotionSwapItem[]
}

export function MotionSwap({
  motionKey,
  children,
}: {
  motionKey: string
  children: ReactNode
}) {
  const [currentSwap, setSwap] = useState<MotionSwapState>(() => ({
    motionKey,
    nextItemId: 1,
    items: [
      {
        id: 0,
        motionKey,
        content: children,
        exiting: false,
        animateIn: false,
      },
    ],
  }))
  let swap = currentSwap

  if (swap.motionKey !== motionKey) {
    const items: MotionSwapItem[] = []

    for (const item of swap.items) {
      if (!item.exiting) {
        items.push({ ...item, exiting: true })
      }
    }

    items.push({
      id: swap.nextItemId,
      motionKey,
      content: children,
      exiting: false,
      animateIn: true,
    })

    swap = {
      motionKey,
      nextItemId: swap.nextItemId + 1,
      items,
    }
    setSwap(swap)
  }

  function handleTransitionEnd(
    item: MotionSwapItem,
    event: TransitionEvent<HTMLDivElement>,
  ) {
    if (
      !item.exiting ||
      event.target !== event.currentTarget ||
      event.propertyName !== 'opacity'
    ) {
      return
    }

    setSwap((current) => ({
      ...current,
      items: current.items.filter((candidate) => candidate.id !== item.id),
    }))
  }

  return (
    <div className="motion-swap">
      {swap.items.map((item) => (
        <div
          key={item.id}
          aria-hidden={item.exiting || undefined}
          data-motion={
            item.exiting ? 'exiting' : item.animateIn ? 'entering' : undefined
          }
          className="motion-swap-item"
          onTransitionEnd={(event) => handleTransitionEnd(item, event)}
        >
          {item.exiting || item.motionKey !== motionKey
            ? item.content
            : children}
        </div>
      ))}
    </div>
  )
}
