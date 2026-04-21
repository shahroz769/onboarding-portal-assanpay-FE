import { z } from 'zod'

export const notificationTypeValues = [
  'case_assigned',
  'case_unassigned',
  'comment_mention',
  'comment_reply',
  'comment_thread',
] as const

export type NotificationType = (typeof notificationTypeValues)[number]

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(notificationTypeValues),
  title: z.string(),
  body: z.string(),
  caseId: z.string().uuid().nullable(),
  caseNumber: z.string().nullable(),
  commentId: z.string().uuid().nullable(),
  actorId: z.string().uuid().nullable(),
  actorName: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
})

export type Notification = z.infer<typeof notificationSchema>

export const notificationsListResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
})

export type NotificationsListResponse = z.infer<
  typeof notificationsListResponseSchema
>

export const unreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
})

export type NotificationFilter = 'all' | 'unread'

export const NOTIFICATIONS_PAGE_SIZE = 20
