import { useEffect, useRef, useState } from 'react'
import type { ReactNode, TransitionEvent } from 'react'

type MotionSwapItem = {
  id: number
  motionKey: string
  content: ReactNode
  exiting: boolean
  animateIn: boolean
}

export function MotionSwap({
  motionKey,
  children,
}: {
  motionKey: string
  children: ReactNode
}) {
  const latestChildrenRef = useRef(children)
  const nextItemIdRef = useRef(1)
  const [items, setItems] = useState<MotionSwapItem[]>(() => [
    {
      id: 0,
      motionKey,
      content: children,
      exiting: false,
      animateIn: false,
    },
  ])

  latestChildrenRef.current = children

  useEffect(() => {
    setItems((current) => {
      const activeItem = current.find((item) => !item.exiting)
      if (activeItem?.motionKey === motionKey) return current

      return [
        ...current
          .filter((item) => !item.exiting)
          .map((item) => ({ ...item, exiting: true })),
        {
          id: nextItemIdRef.current++,
          motionKey,
          content: latestChildrenRef.current,
          exiting: false,
          animateIn: true,
        },
      ]
    })
  }, [motionKey])

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

    setItems((current) =>
      current.filter((candidate) => candidate.id !== item.id),
    )
  }

  return (
    <div className="motion-swap">
      {items.map((item) => (
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
