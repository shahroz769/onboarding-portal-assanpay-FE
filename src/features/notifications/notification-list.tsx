import { useEffect, useRef } from 'react'
import { BellOff, Loader2 } from 'lucide-react'

import { Skeleton } from '#/components/ui/skeleton'
import { ScrollArea } from '#/components/ui/scroll-area'
import { useNotificationsInfiniteQuery } from '#/hooks/use-notifications-query'
import type { NotificationFilter } from '#/schemas/notifications.schema'

import { NotificationItem } from './notification-item'

interface NotificationListProps {
  filter: NotificationFilter
  onNavigate: () => void
}

export function NotificationList({ filter, onNavigate }: NotificationListProps) {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsInfiniteQuery(filter)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRef.current?.querySelector<HTMLDivElement>(
      '[data-slot="scroll-area-viewport"]',
    )
    if (!sentinel || !root) return
    if (!hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root, rootMargin: '120px 0px 0px 0px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div
      ref={scrollRef}
      className="h-[480px]"
    >
      <ScrollArea className="size-full">
        {isLoading ? <NotificationListSkeleton /> : null}

        {isError ? (
          <div className="px-4 py-6 text-center text-sm text-destructive">
            Failed to load notifications.
          </div>
        ) : null}

        {!isLoading && !isError && items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <BellOff className="size-8 opacity-40" aria-hidden="true" />
            <span>You're all caught up.</span>
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="flex flex-col">
            {items.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {hasNextPage ? (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-3 text-xs text-muted-foreground"
          >
            {isFetchingNextPage ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </span>
            ) : (
              <span className="opacity-0">Scroll for more</span>
            )}
          </div>
        ) : null}
      </ScrollArea>
    </div>
  )
}

function NotificationListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
