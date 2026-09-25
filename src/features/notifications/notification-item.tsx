import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Check } from 'lucide-react'

import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useMarkNotificationReadMutation } from '#/hooks/use-notifications-query'
import { cn } from '#/lib/utils'
import type { Notification } from '#/schemas/notifications.schema'

import { resolveNotificationTarget } from './notification-target'

interface NotificationItemProps {
  notification: Notification
  onNavigate: () => void
}

function getInitials(name: string | null): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '·'
}

export function NotificationItem({
  notification,
  onNavigate,
}: NotificationItemProps) {
  const markRead = useMarkNotificationReadMutation()
  const target = resolveNotificationTarget(notification)

  function markUnread() {
    if (!notification.isRead) {
      markRead.mutate(notification.id)
    }
  }

  const relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  })

  const body = (
    <>
      {!notification.isRead ? (
        <span
          aria-hidden="true"
          className="absolute top-4 left-1.5 size-1.5 rounded-full bg-primary"
        />
      ) : null}

      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-[11px]">
          {getInitials(notification.actorName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p
          className={cn(
            'pr-8 text-sm leading-snug',
            !notification.isRead ? 'font-semibold' : 'font-medium',
          )}
        >
          {notification.title}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </p>
        <span className="mt-0.5 text-[11px] text-muted-foreground/80">
          {relativeTime}
        </span>
      </div>
    </>
  )

  const rowClassName = cn(
    'relative flex min-w-0 flex-1 gap-3 px-4 py-3 text-left transition-colors',
    'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
    !notification.isRead && 'bg-primary/[0.04]',
  )

  return (
    <div
      className={cn(
        'group relative flex border-b border-border/40 last:border-b-0',
      )}
    >
      {target ? (
        <Link
          to={target.to}
          params={target.params}
          className={rowClassName}
          onClick={() => {
            markUnread()
            onNavigate()
          }}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClassName}>{body}</div>
      )}

      {!notification.isRead ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2.5 right-3 size-6 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  markRead.mutate(notification.id)
                }}
                aria-label="Mark as read"
              />
            }
          >
            <Check className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="left">Mark as read</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
