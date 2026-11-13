# 24 — Notifications And Realtime

## At a glance

| | |
|---|---|
| **What it is** | Staff find out about things that need them without refreshing the page: a case assigned to them, someone mentioning them in a comment, a merchant resubmitting documents, or an email bouncing. |
| **Who can use it** | Every authenticated staff user gets their own notifications, scoped to them. No roles are involved — what a user receives depends only on what happened to cases they are connected to. |
| **Where it lives** | The bell icon (unread count + popover list) and a live server-sent events (SSE) stream, mounted app-wide after login. |
| **What it creates** | A `notifications` row per notification, published to the recipient's live stream at the same time. |
| **Main API** | `GET /api/notifications` · `GET /api/notifications/unread-count` · `PATCH /api/notifications/:id/read` · `PATCH /api/notifications/read-all` · `GET /api/notifications/stream` |
| **Main code** | Frontend: `src/features/notifications/notifications-provider.tsx` + `src/features/notifications/notifications-sse.ts` · Backend: `src/modules/notifications/notifications.service.ts` + `src/modules/notifications/notifications.events.ts` |
| **Success looks like** | A notification appears under the bell and as a toast the moment it is created, and the affected case page refreshes itself — no polling, no refresh needed. |

## In plain words — for a non-technical reader

Staff should hear about things that need them without refreshing the page: a case assigned to them, someone mentioning them in a comment, a merchant sending documents back, or an email bouncing. The bell icon shows how many unread notifications they have, and a live stream pushes new ones the moment they happen, with a small pop-up message and the case page refreshing itself. A notification created while someone is logged out simply waits in their list. There are no settings to mute types and no notifications outside the portal — no email or mobile push. What happens next: staff click a notification to open the case it refers to (the comment itself is not targeted), and mark it read.

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `GET /api/notifications` (`cursor`, `limit` 1–50 default 20, `filter: all \| unread` default `all`), `GET /api/notifications/unread-count` → `{ count }`, `PATCH /api/notifications/read-all` → `{ updated }`, `PATCH /api/notifications/:id/read` → `{ id, isRead: true, readAt }`, `GET /api/notifications/stream` (SSE, `Bearer` token via fetch + ReadableStream) |
| Request / response | List returns latest first, strictly older than the cursor, `nextCursor: null` when no more pages, and always includes `unreadCount`; cursor is encoded `{createdAt ISO}__{id}` (`NOTIFICATION_CURSOR_SEPARATOR = '__'`), not the ISO datetime the API doc shows |
| Validation | Mark-as-read is user-scoped (`404 "Notification not found."` for another user's notification; `400 "Invalid notification id."` for a non-UUID id); stream: `event: ready` (`data: ok`), `event: ping` heartbeat every 25 s (`NOTIFICATION_STREAM_HEARTBEAT_MS = 25_000`), `event: notification` (JSON), `event: case-email-status` (`{ caseId, emailLogId, status }`) |
| Database | `notifications` (`id`, `userId` → `users.id` cascade, `actorId` nullable set null, `type`, `caseId` nullable cascade, `commentId` nullable → `case_comments.id` cascade, `title` varchar 255, `body` text, `metadata` JSONB, `isRead` default `false`, `readAt`, `createdAt`); type enum `case_assigned` \| `case_unassigned` \| `comment_mention` \| `comment_reply` \| `comment_thread` \| `case_resubmitted` \| `case_email_undelivered` |
| Auth / roles | All routes behind `requireAuth`, scoped to the session `userId`; no role filter; senders never notify themselves |
| Errors | Stream: `429 "Too many open notification streams. Close some tabs."` for an 11th concurrent stream per user (`NOTIFICATION_STREAM_MAX_PER_USER = 10`); `401` triggers one token refresh + reconnect, a second `401` backs off |
| Integrations / limits | In-process pub/sub only (`notifications.events.ts`: "single-process only. For multi-instance deployments, swap with Redis pub/sub."); reconnect exponential back-off 1s, 2s, 4s … up to 30s (`MAX_RECONNECT_DELAY_MS = 30_000`), reset after a stream stays open 30 s (`STABLE_STREAM_MS = 30_000`); stream paused while the tab is hidden; on reconnect, notifications queries are invalidated except ones loading or fetched in the last 5 s; `case-email-status` is not stored and cannot be replayed; no retention/deletion in the code reviewed |

## How it works — the journey

```
Something happens (assign, comment, resubmission, email bounces)
        ↓
Backend inserts a row in notifications and publishes the same
object to the recipient's live stream
        ↓
Bell icon shows the unread count
        ↓
Staff open the popover/list (latest first, cursor-paginated)
        ↓
Clicking a notification marks it read (or staff mark all as read);
clicking it can open the case (carries caseId + caseNumber,
and commentId for a comment notification, which the UI does not
use: `notification-target.ts` always opens `/cases/$caseId`)
```

## Two ways notifications reach staff — plus a third signal

| Way | What it is |
|---|---|
| **1. Stored notifications** | A list under the bell icon, with an unread count, that staff can open, read and mark as read. |
| **2. Realtime (live) updates** | A server-sent events (SSE) stream that pushes new notifications to the browser the moment they are created, shows a toast, and refreshes the affected case page automatically. |
| **3. `case-email-status` (not a notification)** | A smaller signal on the same stream — it only tells an open case page that an email's delivery status changed, so the page can refresh. It has no id, no row, and does not count toward the unread count. |

## Who can use it

| Rule | Detail |
|---|---|
| **Every authenticated staff user** | Gets their own notifications. The list, the unread count and the stream are all scoped to the current user (`userId` from the session). A user can never see another user's notifications: marking one as read checks `userId` and returns `404` otherwise. |
| **No roles are involved** | There is no admin-only notification, and no role filter on the stream. What a user receives depends only on what happened to cases they are connected to (owner, mentioned, previous commenter, previous owner). |
| **The bell and the stream are app-wide** | The `NotificationsProvider` is mounted once inside the authenticated app layout, so the stream is open on every page after login, not only on the case pages. |
| **Senders never notify themselves** | Every notification source excludes the actor (the person who assigned, commented, or triggered the event). |
| **Assignment is admin-only** | `PATCH /api/cases/:id/assign` and `POST /api/cases/bulk-assign` both sit behind `requireRoles('super_admin', 'admin')` (`cases.routes.ts`). The assignment notifications therefore only ever come from those two admin actions. |

## Step by step — Stored notifications

1. Something happens (see "Trigger sources" below). The backend inserts a row in `notifications` and publishes the same object to the recipient's live stream.
2. The bell icon shows the unread count (`GET /api/notifications/unread-count`).
3. Staff open the notifications popover/list and see the latest first, cursor-paginated (default 20 per page, maximum 50).
4. Clicking a notification marks it read (or staff mark all as read). A notification carries `caseId` and `caseNumber`, so clicking it can open the case; for a comment notification it also carries `commentId`.
5. Notifications are best-effort for assignment, comments and resubmission: if creating one fails, the error is logged (or swallowed) and the action still succeeds (`try/catch` in `case-assignment.service.ts`, `case-comments.service.ts`, `public-resubmission.routes.ts`). **Exception:** the undelivered-email notification (`case_email_undelivered`) is not wrapped in a try/catch, so a failure there makes the Resend webhook return `500`; the history and notification are then not written on the retry. See file 23, delivery tracking step 5 and file 32, item 53.

## Trigger sources

From `backend/apis/notifications.md` and the service code:

| Source | Notification type(s) | Recipients |
|---|---|---|
| `PATCH /api/cases/:id/assign` | `case_assigned`, `case_unassigned` | New owner (assigned); previous owner (unassigned). Excludes the actor. No notice is sent when the new and previous owner are the same person (`notifyAssignment`, `notifications.service.ts`). |
| `POST /api/cases/bulk-assign` | `case_assigned`, `case_unassigned` | Same rules, per case. Called from `case-assignment.service.ts` (`notifyAssignment` per affected case). |
| `POST /api/cases/:id/comments` | `comment_mention` > `comment_reply` > `comment_thread` (precedence per recipient) | @-mentioned users; parent comment author on a reply; **every earlier commenter on the case** (not only the thread). Excludes the author. Before saving, recipients must be `active` and able to view the case's queue (agents need a `view` grant in `user_queue_access` unless `queue_view_scope` is `all`); anyone else is dropped silently. Mentions are client-supplied ids, so unknown ids are dropped too. Called from `case-comments.service.ts` inside a `try` (best-effort). |
| `POST /api/webhooks/resend` (email undelivered) | `case_email_undelivered` | Case owner, when a merchant email is `bounced`, `complained`, `suppressed` or `failed` (`UNDELIVERED_EMAIL_STATUSES`). Not sent for `delivery_delayed`, and not sent when the case has no owner. Actor is `null`. Called from `email-delivery-status.ts`. |
| Merchant submits the public resubmission form (`public-resubmission.routes.ts`) | `case_resubmitted` | Case owner only, and only when the case has an owner (`public-resubmission.routes.ts`, `notifyOnResubmission`). `fieldCount` is the number of fields updated; actor is `null`. Wrapped in `try`, so a failure never fails the submission. |

## Notification texts (`notifications.copy.ts`)

| Type | Title / body |
|---|---|
| `case_assigned` | "Case {number} assigned to you" / "{actor} assigned this {queue} case to you." |
| `case_unassigned` | "You're no longer assigned to {number}" / "{actor} reassigned this case in {queue}." |
| `comment_mention` | "{actor} mentioned you on {number}" / comment snippet. |
| `comment_reply` | "{actor} replied on {number}" / snippet. |
| `comment_thread` | "New comment on {number}" / "{actor}: {snippet}". |
| `case_resubmitted` | "Case {number} — merchant submitted updated details" / "{merchant} resubmitted {n} field(s) for your review." |
| `case_email_undelivered` | "Email not delivered on {number}" / "The {templateLabel} email to {recipient} {bounced / was marked as spam / was blocked by the suppression list / failed to send}. Send it again or send it manually before closing the case; if the case is awaiting the merchant, move it back to Working first." |

## Step by step — Realtime (SSE)

1. After login, the frontend opens `GET /api/notifications/stream` with a `Bearer` access token (fetch + ReadableStream, because a native `EventSource` cannot send an Authorization header).
2. The server replies `event: ready` (`data: ok`), then holds the connection open, sending `event: ping` every 25 seconds as a heartbeat so proxies do not time it out.
3. When a notification is created for that user, the server writes `event: notification` with the notification as JSON. When a case email's delivery status changes, it writes `event: case-email-status` with `{ caseId, emailLogId, status }`.
4. The frontend shows a toast for each live notification (`notification-toast.tsx`), inserts it into the TanStack Query cache, and refreshes the affected data. The toast stays for 8 seconds. Only a notification with a case gets a `View` button, which navigates to `/cases/$caseId` and marks the notification read (the mark-read call is best-effort):

| Live event | What refreshes |
|---|---|
| `case_resubmitted` or `case_email_undelivered` | `invalidateCaseWorkflowQueries` (`use-case-detail-query.ts`): the case detail, its history and the cases list, so a bounced email shows and blocks closing at once |
| `comment_mention` / `comment_reply` / `comment_thread` | Refresh that case's comments |
| `case-email-status` | Refresh that case's detail and history (the delivery badge and the close button update without polling) |

5. If the connection drops, the client reconnects with exponential back-off (1s, 2s, 4s … up to 30s). A stream that stayed open for at least 30 seconds resets the back-off. While the browser tab is hidden the stream is paused; when the tab becomes visible again it reconnects (the backoff counter resets) and calls `onVisible`: the case detail, case history and cases list queries are force-invalidated, then any other active query that is stale is refetched (`notifications-provider.tsx`, the app-wide replacement for refetch-on-window-focus; the QueryClient turns off refetch-on-focus). A `401` triggers one access-token refresh and one reconnect; a second `401` in a row backs off instead of looping. If the refresh fails with a terminal session error (`isTerminalSessionRefreshError`), the client stops for good (`stopped` state) and does not reconnect until the provider remounts.
6. On reconnect, the client invalidates the notifications queries so it catches up on anything missed while the stream was down — but it skips queries that are already loading or were fetched in the last 5 seconds, to avoid cancelling and re-requesting the same data. The same catch-up runs when a `notification` event fails schema validation (`onInvalidEvent`, reported once per connection). A malformed `case-email-status` event is dropped without a resync. The `case-email-status` event refreshes only that case's detail and history queries.

## How it is implemented — Frontend

| File | What it does |
|---|---|
| `frontend/src/features/notifications/notifications-provider.tsx` (`NotificationsProvider`) | Mounts once in the app layout, owns the SSE connection, toasts and cache updates |
| `frontend/src/features/notifications/notifications-sse.ts` (`createNotificationsSseClient`) | SSE client. State machine: `starting → connecting → open → backoff → connecting`, plus `paused` (tab hidden) and `stopped` (final). Constants: `INITIAL_CONNECT_DELAY_MS` 250 in dev, 0 otherwise; `STABLE_STREAM_MS` 30,000; `MAX_RECONNECT_DELAY_MS` 30,000. |
| `notification-bell.tsx` | Bell + unread count |
| `notifications-popover.tsx`, `notification-list.tsx`, `notification-item.tsx`, `notification-toast.tsx` | Popover, list, item, Sonner toast on arrival |
| `notification-target.ts` | Decides where a notification navigates to when clicked. It always returns the case page (`/cases/$caseId`) when the notification has a `caseId`, and nothing otherwise. The comment is not targeted. |
| `frontend/src/apis/notifications.ts` | `fetchNotifications`, `fetchUnreadCount`, `markNotificationRead`, `markAllNotificationsRead` |
| `frontend/src/hooks/use-notifications-query.ts` | `NOTIFICATIONS_KEY`, `applyIncomingNotificationToCache`, `NOTIFICATIONS_PAGE_SIZE` |
| `frontend/src/schemas/notifications.schema.ts` | `notificationSchema`, `caseEmailStatusEventSchema` |

## How it is implemented — Backend

| File | What it does |
|---|---|
| `backend/src/modules/notifications/notifications.service.ts` | `listForUser`, `getUnreadCount`, `markRead`, `markAllRead`, `createBulkNotifications`, plus `notifyOnComment`, `notifyOnUndeliveredEmail` and the assign/resubmit notifiers — the assign path is `notifyAssignment` (called by `case-assignment.service.ts`) and the resubmit path is `notifyOnResubmission` (called by `public-resubmission.routes.ts`); `notifyOnUndeliveredEmail` is called by `email-delivery-status.ts` |
| `backend/src/modules/notifications/notifications.events.ts` | `subscribe`, `publish`, `publishCaseEmailStatus`, `countSubscribers`. It is an **in-process** map of user id → subscriber set. The file itself warns: "single-process only. For multi-instance deployments, swap with Redis pub/sub." |
| `backend/src/modules/notifications/notifications.copy.ts` | `buildNotificationCopy`, `buildCommentSnippet` — strips `@[Name](uuid)` to `@Name` and clips to 140 characters |
| `backend/src/modules/notifications/notifications.schemas.ts` | `notificationTypeValues`, `listNotificationsQuerySchema` |

**Routes** in `backend/src/modules/notifications/notifications.routes.ts` (all behind `requireAuth`):

| Endpoint | Notes |
|---|---|
| `GET /api/notifications` | `cursor`, `limit` (1–50, default 20), `filter` (`all` \| `unread`, default `all`) |
| `GET /api/notifications/unread-count` | Returns `{ count }` |
| `PATCH /api/notifications/read-all` | Returns `{ updated }` |
| `PATCH /api/notifications/:id/read` | User-scoped (`404 "Notification not found."` for another user's or a missing id) → `{ id, isRead: true, readAt }`. Repeat calls succeed and overwrite `readAt` with the new time (`markRead` in `notifications.service.ts`); the first read time is not kept. |
| `GET /api/notifications/stream` | SSE |

**List pagination detail:** the cursor is not the ISO datetime shown in the API doc. The implementation encodes it as `{createdAt ISO}__{id}` (`NOTIFICATION_CURSOR_SEPARATOR = '__'`) and decodes it back; the API doc's table says "cursor: ISO datetime", which is out of date (see "Data" below). Items are returned strictly older than the cursor, latest first; `nextCursor` is `null` when no more pages. The list response also always includes the current `unreadCount`.

**Stream limits and safety** (`notifications.routes.ts`): `NOTIFICATION_STREAM_HEARTBEAT_MS = 25_000`, `NOTIFICATION_STREAM_MAX_PER_USER = 10` — an 11th concurrent stream for the same user returns `429` ("Too many open notification streams. Close some tabs."). Bun's idle timeout is disabled for the stream request (otherwise the default 10s timeout would drop it into a reconnect loop). The session is re-checked at least once per heartbeat, so an expired token, a deactivation or a revoked session ends the stream within one heartbeat. Response headers include `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Content-Encoding: identity`, `X-Accel-Buffering: no`.

**Publishing:** `createBulkNotifications` inserts the rows, then resolves actor names and case numbers (one query each) so a streamed notification has exactly the same shape as a list item, then publishes one event per recipient. A subscriber that throws is caught and logged; it does not break delivery to others.

## Data, validation and edge cases

| Item | Detail |
|---|---|
| **Notification types** (`notification_type` enum in `backend/src/db/schema.ts`, mirrored in `notificationTypeValues`) | `case_assigned`, `case_unassigned`, `comment_mention`, `comment_reply`, `comment_thread`, `case_resubmitted`, `case_email_undelivered`. That is the complete list in the code reviewed. |
| **`notifications` table** | `id`, `userId` (references `users.id`, on delete cascade), `actorId` (nullable, on delete set null), `type`, `caseId` (nullable, on delete cascade), `commentId` (nullable, references `case_comments.id`, on delete cascade), `title` (varchar 255), `body` (text), `metadata` (JSONB, nullable), `isRead` (default `false`), `readAt` (nullable), `createdAt`. Indexes on `createdAt`, (`userId`, `createdAt`, `id`), (`userId`, `isRead`, `createdAt`, `id`), `actorId`, `caseId`, `commentId`. |
| **Unread count query** | Uses `isRead BETWEEN false AND false` deliberately so Postgres uses the unread index instead of filtering afterwards. |
| **Cursor mismatch (docs vs code)** | `backend/apis/notifications.md` documents the list cursor as an ISO datetime and shows an example `nextCursor` of `2026-04-22T09:30:00.000Z`. The implementation encodes `nextCursor` as `2026-04-22T09:30:00.000Z__<uuid>` and decodes both parts. A client that sends a bare ISO datetime will still work (the id part is optional), but a client that expects the documented format will be surprised by the suffix. The doc should be corrected. |
| **No push notifications** | There is no mobile/web push in the code reviewed — only the in-app list, the bell count, toasts, and the SSE stream while the app is open. A notification created while the user is logged out waits in the list. |
| **No notification settings** | There is no per-user preference (mute a type, email me instead) in the code reviewed. Everyone gets every type that applies to them. |
| **System notices have no actor** | `case_email_undelivered` and `case_resubmitted` are written with `actorId = null`, so the list shows no actor name for them. |
| **Notice text is fixed at creation** | `title` and `body` are stored when the row is written (`notifications.copy.ts`). A later change to a case number or to a merchant name does not change old notices. |
| **No retention or deletion** | Notifications are never deleted by the code reviewed except by cascade when the user, case or comment is deleted. There is no "clear all" apart from marking all read, and no expiry. |
| **Single-process realtime** | ⚠️ The SSE pub/sub lives in the memory of one backend process. If the backend ever runs as several processes or servers, a notification published in one process will not reach a stream connected to another. The code comments say to swap in Redis pub/sub for that case. This is a scaling limit, not a bug at the current size. |
| **Stream cap** | 10 concurrent streams per user. One per open tab is normal; more than 10 means a client stuck reconnecting. |
| **Session re-check on the stream** | The stream checks the access token about every 25 seconds (`resolveCurrentSession`). If the session is gone, the user's `userId` no longer matches, or the lookup fails, the stream ends and the client reconnects with a refreshed token or stops. This is how a deactivated user or a revoked session loses the stream. |
| **`case-email-status` goes to the owner only** | Published by `publishCaseEmailStatus` to the case owner's open streams (`email-delivery-status.ts`); other staff never receive it, and a case with no owner sends nothing. |
| **`case-email-status` is not stored** | It has no id, no row, and does not count as a notification or affect the unread count. A client that reconnects cannot replay it — it must refetch the case, which the provider does. |

## What to check — is this what you intended?

- [ ] **Who gets `case_resubmitted`:** who should be notified when a merchant resubmits documents — the case owner only, or also others? Code today: only the case owner, and only when the case has an owner (`public-resubmission.routes.ts`). Please confirm that is the intent.
- [ ] **Notification preferences:** do you want any notification preferences — for example muting comment threads, or an email digest — or is "everyone gets everything that concerns them" fine?
- [ ] **Outside the portal:** should notifications ever be sent outside the portal (email or mobile push), for example for an urgent bounced email when the owner is not logged in?
- [ ] **Cursor doc mismatch:** the API doc says the list cursor is a plain ISO date, but the code returns `date__uuid`. Should the doc be fixed, or the format changed?
- [ ] **Single-process realtime:** the realtime stream only works within a single backend process. If you ever scale the backend to several servers, is Redis pub/sub (as the code suggests) the approach you want, or is that a decision for later?
- [ ] **Expiry / deletion:** should notifications expire or be deletable, or should they stay forever as a record?
- [ ] **Stream limit:** is 10 open tabs per user the right stream limit, or have staff hit the "Too many open notification streams" error?
- [ ] **Thread notices:** `comment_thread` goes to every earlier commenter on the whole case, not just to the people in one thread. Is that intended, or should it be limited to the thread?
- [ ] **Comment deep link:** the notification carries `commentId`, but clicking it opens only the case. Should it scroll to or highlight the comment?

---
*Sources: `frontend/src/features/notifications/notifications-provider.tsx`, `frontend/src/features/notifications/notifications-sse.ts`, `frontend/src/features/notifications/notification-bell.tsx`, `frontend/src/features/notifications/notifications-popover.tsx`, `frontend/src/features/notifications/notification-list.tsx`, `frontend/src/features/notifications/notification-item.tsx`, `frontend/src/features/notifications/notification-toast.tsx`, `frontend/src/features/notifications/notification-target.ts`, `frontend/src/apis/notifications.ts`, `frontend/src/hooks/use-notifications-query.ts`, `frontend/src/schemas/notifications.schema.ts`, `backend/src/modules/notifications/notifications.service.ts`, `backend/src/modules/notifications/notifications.events.ts`, `backend/src/modules/notifications/notifications.copy.ts`, `backend/src/modules/notifications/notifications.schemas.ts`, `backend/src/modules/notifications/notifications.routes.ts`, `backend/apis/notifications.md`, `backend/src/db/schema.ts`, `backend/src/modules/cases/case-assignment.service.ts`, `backend/src/modules/cases/case-comments.service.ts`, `backend/src/modules/merchants/public-resubmission.routes.ts`, `backend/src/modules/email/email-delivery-status.ts`, `frontend/src/routes/_app.tsx`, `frontend/src/hooks/use-case-detail-query.ts`. Related files: 22 (comments / chatter), 23 (email system).*
