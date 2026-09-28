import {
  addTransitionType,
  startTransition,
  useState,
  ViewTransition,
} from 'react'
import { CheckCheck } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useMarkAllNotificationsReadMutation } from '#/hooks/use-notifications-query'
import { skipActiveViewTransition } from '#/lib/view-transition'
import type { NotificationFilter } from '#/schemas/notifications.schema'

import { NotificationList } from './notification-list'

// Tab order, for the direction the list slides on a filter change.
const FILTERS: NotificationFilter[] = ['all', 'unread']
const FILTER_NEXT = 'notification-filter-next'
const FILTER_PREV = 'notification-filter-prev'

interface NotificationsPopoverContentProps {
  onNavigate: () => void
  unreadCount: number
}

export function NotificationsPopoverContent({
  onNavigate,
  unreadCount,
}: NotificationsPopoverContentProps) {
  // Open on what needs attention; fall back to history when nothing does.
  const [filter, setFilter] = useState<NotificationFilter>(
    unreadCount > 0 ? 'unread' : 'all',
  )
  const markAll = useMarkAllNotificationsReadMutation()

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              {unreadCount} unread
            </span>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={unreadCount === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="size-3.5" />
          Mark all read
        </Button>
      </div>

      <Separator />

      <div className="px-3 pt-2 pb-2">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            const to = FILTERS.indexOf(value as NotificationFilter)
            const from = FILTERS.indexOf(filter)
            if (to < 0 || to === from) return
            // Same motion as the case side panel tabs: the list slides
            // toward the picked tab. Own transition types, so the side
            // panel's tab-next/tab-prev boundaries stay still.
            skipActiveViewTransition()
            startTransition(() => {
              addTransitionType(to > from ? FILTER_NEXT : FILTER_PREV)
              setFilter(FILTERS[to])
            })
          }}
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Keyed by filter: the old list exits and the new one enters, each
          sliding toward the picked tab. Not an `update` transition: the
          list's own <ViewTransition>s would claim its DOM changes, so an
          outer update never fires. Only this outermost boundary animates on
          enter/exit; the rows' animations sit it out. The remount also
          starts the new list scrolled to the top. */}
      <ViewTransition
        key={filter}
        default="none"
        enter={{
          [FILTER_NEXT]: 'vt-slide vt-quick vt-clip vt-forward',
          [FILTER_PREV]: 'vt-slide vt-quick vt-clip vt-back',
          default: 'none',
        }}
        exit={{
          [FILTER_NEXT]: 'vt-slide vt-quick vt-clip vt-forward',
          [FILTER_PREV]: 'vt-slide vt-quick vt-clip vt-back',
          default: 'none',
        }}
      >
        <div>
          <NotificationList filter={filter} onNavigate={onNavigate} />
        </div>
      </ViewTransition>
    </div>
  )
}
