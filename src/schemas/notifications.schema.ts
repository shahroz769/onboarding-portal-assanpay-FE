import * as z from 'zod'

export const notificationTypeValues = [
  'case_assigned',
  'case_unassigned',
  'comment_mention',
  'comment_reply',
  'comment_thread',
  'case_resubmitted',
  'case_email_undelivered',
] as const

export const notificationSchema = z.object({
  id: z.uuid(),
  type: z.enum(notificationTypeValues),
  title: z.string(),
  body: z.string(),
  caseId: z.uuid().nullable(),
  caseNumber: z.string().nullable(),
  commentId: z.uuid().nullable(),
  actorId: z.uuid().nullable(),
  actorName: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
})

export type Notification = z.infer<typeof notificationSchema>

/**
 * Stream signal: a case email's delivery status changed. Not stored and not
 * shown in the bell; it only refreshes the case.
 */
export const caseEmailStatusEventSchema = z.object({
  caseId: z.uuid(),
  emailLogId: z.uuid(),
  status: z.string(),
})

export type CaseEmailStatusEvent = z.infer<typeof caseEmailStatusEventSchema>

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

export const markNotificationReadResponseSchema = z.object({
  id: z.uuid(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
})

export const markAllNotificationsReadResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
})

export type NotificationFilter = 'all' | 'unread'

export const NOTIFICATIONS_PAGE_SIZE = 20
