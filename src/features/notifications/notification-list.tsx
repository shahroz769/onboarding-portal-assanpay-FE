import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  ViewTransition,
} from 'react'
import { AlertTriangle, BellOff, RefreshCw } from 'lucide-react'

import { EmptyState } from '#/components/empty-state'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'

import { Skeleton } from '#/components/ui/skeleton'
import { ScrollArea } from '#/components/ui/scroll-area'
import { useNotificationsInfiniteQuery } from '#/hooks/use-notifications-query'
import type { NotificationFilter } from '#/schemas/notifications.schema'

import { NotificationItem } from './notification-item'

interface NotificationListProps {
  filter: NotificationFilter
  onNavigate: () => void
}

export function NotificationList({
  filter,
  onNavigate,
}: NotificationListProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
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

  // Morph UI Animated List: new notifications rise in, removed ones fade out
  // and the rest glide into place. Query data lands as a synchronous
  // update, and <ViewTransition> only animates Transitions: the deferred
  // list re-renders the rows in one.
  const loadedItems = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )
  const items = useDeferredValue(loadedItems)
  // Row content (e.g. read state) comes from the latest data, outside the
  // Transition, so in-place changes don't crossfade the row. Only
  // insertions, removals and reorders go through the deferred list.
  const latestById = useMemo(
    () => new Map(loadedItems.map((n) => [n.id, n])),
    [loadedItems],
  )

  return (
    <div ref={scrollRef} className="h-120">
      {/* vt-scroll + view-transition-group: contain clip moving rows to the
          scroll area, so they never slide over the popover's edges. */}
      <ViewTransition update="vt-scroll">
        <ScrollArea className="size-full [view-transition-group:contain]">
          {isLoading ? <NotificationListSkeleton /> : null}

          {isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load notifications."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                >
                  <RefreshCw data-icon="inline-start" />
                  Retry
                </Button>
              }
            />
          ) : null}

          {!isLoading && !isError && items.length === 0 ? (
            filter === 'unread' ? (
              <EmptyState
                icon={BellOff}
                tone="success"
                title="You're all caught up."
                description="New notifications will appear here."
              />
            ) : (
              <EmptyState
                icon={BellOff}
                title="No notifications yet."
                description="New notifications will appear here."
              />
            )
          ) : null}

          {items.length > 0 ? (
            <ul className="flex flex-col gap-1 px-2 pb-2">
              {items.map((notification) => (
                <ViewTransition
                  key={notification.id}
                  default="vt-move vt-presence"
                >
                  <li>
                    <NotificationItem
                      notification={
                        latestById.get(notification.id) ?? notification
                      }
                      onNavigate={onNavigate}
                    />
                  </li>
                </ViewTransition>
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
                  <Spinner className="size-3.5" />
                  Loading…
                </span>
              ) : (
                <span className="opacity-0">Scroll for more</span>
              )}
            </div>
          ) : null}
        </ScrollArea>
      </ViewTransition>
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
