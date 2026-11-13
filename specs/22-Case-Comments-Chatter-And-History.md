# 22 — Case Comments, Chatter And History

## At a glance

| | |
|---|---|
| **What it is** | Every case has two different records of what happened: (1) comments (chatter) — the free-form conversation between staff about a case; (2) history (timeline) — the automatic, chronological log of everything that happened to a case. |
| **Who can use it** | Anyone who can view the case can read comments and history. Only people who can **work** the case can post a comment. A merchant never sees either of them. |
| **Where it lives** | The chatter section and the history timeline on the case detail page. |
| **What it creates** | A `case_comments` row per comment; a `case_history` row per significant action. |
| **Main API** | `GET /api/cases/:id/comments` · `POST /api/cases/:id/comments` · `GET /api/cases/:id/history` |
| **Main code** | Frontend: `src/features/cases/case-detail/case-chatter.tsx` + `src/features/cases/case-detail/case-history-timeline.tsx` · Backend: `src/modules/cases/case-comments.service.ts` (`listCaseComments`, `createCaseComment`, `listCaseHistory`, `attachEmailDelivery`) |
| **Success looks like** | Staff can discuss a case in threads with @-mentions, and the timeline shows exactly what happened, when, and by whom — without comments polluting the timeline. |

## In plain words — for a non-technical reader

Every case has two records, and they do different jobs. Comments are the staff conversation about a case — questions, @-mentions and replies, like a chat thread. History is the automatic diary — who did what, and when, written by the system as work happens. Staff can read both if they can view the case, but only staff who can work the case can post a comment. Comments never appear in the history timeline, and the merchant never sees either record. What happens next: the conversation and the diary stay with the case as it moves through onboarding, so anyone picking it up can see what was discussed and what already happened.

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `GET /api/cases/:id/comments`, `POST /api/cases/:id/comments`, `GET /api/cases/:id/history` |
| Request / response | Create comment: `{ content, parentId?, mentions? }`; list comments returns `id`, `caseId`, `authorId`, `authorName`, `authorUsername`, `content`, `parentId`, `mentions`, `createdAt`, `updatedAt` (oldest first); history returns newest first, excluding `comment_added`, with `emailDelivery` attached where `emailLogId` is present and `details.proofFile` where `screenshotFileId` is present |
| Validation | `createCommentSchema` (strict): `content` 1–5000 chars, `parentId` optional UUID, `mentions` optional array of UUIDs max 20; mention ids are not checked when the comment is saved, so an unknown id is stored (notifications later drop ids that are inactive or cannot view the queue); parent comment must exist in the same case (`404 "Parent comment not found."`) |
| Database | `case_comments` (`id` uuid, `caseId` → `cases.id` cascade, `authorId` → `users.id` set null, `content` text, `parentId` self-reference set null, `mentions` text array, `createdAt`, `updatedAt`); `case_history` (`id` uuid, `caseId` cascade, `actorId` set null — `null` = system entry, `action` varchar 64, `details` JSONB, `createdAt`); `action` is a free varchar, not an enum |
| Auth / roles | Read: `assertCanViewCase`; post/reply/mention: `assertCanWorkCase` only; no edit/delete endpoint or button for comments in the code reviewed |
| Errors | `404 Case not found.`; `404 Parent comment not found.`; `403 You do not have access to this queue.` (view); `403 You do not have working access to this queue.` (post). Schema failures return a validation `400`. |
| Integrations / limits | Notifications via `notifyOnComment` (best-effort, failure logged, comment still saved; precedence `comment_mention` > `comment_reply` > `comment_thread`, one per recipient, author excluded; snippet clipped to 140 chars); live comment notifications invalidate the case comments query; history tie-break puts `resubmission_email_sent` above `rejections_prepared` |

## How it works — the journey

```
Staff open a case
        ↓
Chatter: type a comment, @-mention teammates, reply in threads
        ↓
Posting notifies others (mention > reply > thread, one per person)
        ↓
History: every significant action writes one case_history row
automatically (created, assigned, email sent, document rejected,
resubmission received, closed…)
        ↓
Timeline shows newest first, with live email-delivery badges
and manual-send proof files where present
```

## The two records — what each one is for

| Record | Written by | For whom | Where it appears |
|---|---|---|---|
| **Comments (chatter)** | People, for people | Staff discussion — "Can someone check this CNIC?" with an @-mention, a reply, a thread | Chatter section only |
| **History (timeline)** | The system (or an action), automatically | The chronological log: created, assigned, stage changed, email sent, document rejected, resubmission received, closed | History timeline only |

A merchant never sees either of them. Both are staff-only, inside the case detail page.

## Who can use it

| Action | Who |
|---|---|
| **Reading comments and history** | `assertCanViewCase` (`backend/src/modules/cases/case-access.service.ts`). An agent whose view scope is not `all` must have the case's queue in its view queues. Otherwise `403 You do not have access to this queue.`. The check does not look at the case owner separately. Non-agent roles return early and pass without a queue check. |
| **Writing a comment** | `assertCanWorkCase`: an agent without working access to the case's queue gets `403 You do not have working access to this queue.`. When `getAgentQueueAccess` returns nothing (non-agent roles), the check passes. The frontend `CaseChatter` takes a `canPost` prop (default `false`, `case-chatter.tsx`), but the only render site, `case-side-panel.tsx`, passes `canPost` as true. So the composer always shows on the case page and the server enforces the rule. The empty state reads "Write the first comment above." only when `canPost` is true. |
| **Replying and mentioning** | The same work-access rule. There is no separate permission for replies or mentions. |
| **Deleting or editing comments** | ⚠️ Not found in the code reviewed. There is no delete or edit endpoint for comments in `cases.routes.ts`, no delete/edit button in `case-chatter.tsx`, and no `updatedAt` change path other than the column existing in the table. Comments are effectively permanent once posted. |
| **History** | Nobody writes history by hand. It is append-only from the system's point of view; entries are created by the services that perform each action. |

## Step by step — Comments

1. Staff open a case and scroll to the chatter section (`case-chatter.tsx` in the case detail page).
2. Staff type a comment. Typing `@` opens a mention list of teammates; arrow keys and Enter pick one. The composer keeps the typed `@Name` text in the comment. The mentioned user ids are sent separately in `mentions` (only for tokens still present in the text when posting). The stored text does not contain the uuid. The chat view highlights `@Name` tokens (`MENTION_PATTERN` in `case-chatter.tsx`).
3. Staff can reply to a specific comment. The composer shows "Replying to {authorName}: {content}" with a cancel button, and the reply is stored with `parentId` pointing at the comment it answers. Replies can nest: the frontend builds threads from `parentId` and renders children under their parent.
4. Posting sends the comment and notifies other people (see below). The author never gets a notification about their own comment.
5. Threads are shown newest first, grouped into runs that started on the same day. A "jump" button exists because the newest comments sit at the top. Avatar colours are assigned to authors in the order they first commented.

### Notifications from comments

Posting a comment notifies people with this precedence, per recipient (`notifications.md`, `notifyOnComment`):

| Precedence | Notification type | Who gets it |
|---|---|---|
| 1 (highest) | `comment_mention` | A user @-mentioned in the comment |
| 2 | `comment_reply` | The author of the parent comment, when the new comment is a reply |
| 3 | `comment_thread` | Every user who has commented earlier on the same case. The query in `notifyOnComment` does not filter by parent comment, so this is case-wide, not limited to one thread. |

Each person gets at most one notification per comment, at the highest precedence that applies to them. The comment author is always excluded. Recipients are then filtered again: only active users who are not agents, or whose view scope is `all`, or who have view access to the case's queue are kept. A mention of anyone else is dropped silently; the comment is still saved and the author gets no warning. Notification creation is best-effort: if it fails, the error is logged and the comment is still saved.

## Step by step — History

1. Every significant action writes one row to `case_history` with the case id, the actor (or `null` for system entries such as `email_undelivered`), an `action` string, a JSON `details` object, and a timestamp.
2. The timeline shows the newest entries first. Two entries created at the same moment are ordered so a `resubmission_email_sent` entry sorts above a `rejections_prepared` entry.
3. Entries that record an email show the live delivery status next to them (badge: queued / sent / delivered / bounced and so on), plus the CC/BCC that were used. The status comes from `email_log`, not from the history row itself.
4. Entries that record a manual email or WhatsApp send show the uploaded proof file (name, size, Google Drive links) when a `screenshotFileId` is present in the details.
5. `listCaseHistory` excludes `comment_added` rows (`action <> 'comment_added'`), but no backend code writes that action, so the filter does nothing. Comments are never written to history at all. They live only in `case_comments` and the chatter section, so they do not appear in the timeline.

## How it is implemented — Frontend

- **Chatter:** `frontend/src/features/cases/case-detail/case-chatter.tsx` (the composer, mention list, thread building, day grouping).
  - `buildCommentThreads` splits the flat comment list into roots (comments with no `parentId`) and `childrenByParent` maps.
  - Mentions: `getMentionMatch(content, cursorPosition)` finds the `@` being typed; `mentionMapRef` maps the typed token to the chosen user id; the posted `mentions` array is built from that map. The mention listbox filters candidates by name or username, case-insensitively.
  - Escape closes the mention list, or cancels a reply if one is active.
  - The composer placeholder is "Write a comment. Use @ to mention a teammate." (or "Reply to {name}…" when replying).
- **History timeline:** `frontend/src/features/cases/case-detail/case-history-timeline.tsx`. It holds the `ACTION_META` table that turns each action string into a human label and icon — for example `resubmission_email_sent` → "Auto resubmission email sent", `live_activation_email_sent` → "Live email sent", `live_limits_applied` → its own entry, `email_undelivered` → a warning with the template, recipient, reason and the advice "Send it again or send it manually before closing the case; if the case is awaiting the merchant, move it back to Working first." Unknown actions fall back to a formatted version of the action string (`formatActionLabel`), so a new action never breaks the page.
- **Data hooks:** `frontend/src/hooks/use-case-detail-query.ts` (`caseCommentsQueryOptions`, `CASE_COMMENTS_KEY`, `CASE_HISTORY_KEY`). A live comment notification invalidates the comments query for that case (`notifications-provider.tsx`).
- **API calls** (`frontend/src/apis/cases.ts`):

| Call | Endpoint |
|---|---|
| List comments | `GET /api/cases/:id/comments` |
| Create a comment | `POST /api/cases/:id/comments` |
| Get history | `GET /api/cases/:id/history` |

No edit, delete or resolve action for comments exists in the frontend code reviewed.

## How it is implemented — Backend

| File | What it does |
|---|---|
| `backend/src/modules/cases/case-comments.service.ts` | `listCaseComments`, `createCaseComment`, `listCaseHistory`, `attachEmailDelivery` |
| `backend/src/modules/cases/case-history-format.ts` | `sanitizeCaseHistoryDetails`, `enrichResubmissionWhatsappHistoryDetails`, `getStringDetail` |

**Routes** in `backend/src/modules/cases/cases.routes.ts`:

| Endpoint | Notes |
|---|---|
| `GET /api/cases/:id/comments` | List comments for a case |
| `POST /api/cases/:id/comments` | Create a comment |
| `GET /api/cases/:id/history` | Get the case history timeline |

**`listCaseComments`:** checks view access, checks the case exists (`404`), then returns all comments for the case in ascending `createdAt` order, with `id`, `caseId`, `authorId`, `authorName`, `authorUsername`, `content`, `parentId`, `mentions`, `createdAt`, `updatedAt`.

**`createCaseComment`:** checks work access, then if `parentId` is given verifies the parent comment exists **in the same case** (`404` "Parent comment not found."). It inserts the comment and then calls `notifyOnComment` inside a try/catch — notification failure is logged (`[notifications] createCaseComment notify failed`) and never fails the comment.

**`listCaseHistory`:** checks view access, checks the case exists, then selects history rows newest first (with the resubmission tie-break described above), excluding `comment_added`. Each entry's details are passed through `sanitizeCaseHistoryDetails` and `enrichResubmissionWhatsappHistoryDetails` (which adds the merchant's active WhatsApp number where relevant). Proof files are looked up from `case_files` by `screenshotFileId` and attached as `details.proofFile` (`id`, `originalName`, `mimeType`, `sizeBytes`, `googleDriveWebViewLink`, `googleDriveDownloadLink`, `createdAt`). Finally `attachEmailDelivery` adds an `emailDelivery` object to every entry whose details carry an `emailLogId`: `status`, `detail`, `updatedAt`, `tracked`, `cc`, `bcc` (from `email_log`).

**History actions seen in the code reviewed** (this is not an exhaustive enum — `action` is a free varchar, length 64):

`case_created_manually` · `case_created_from_flow_close` · `closed_unsuccessful` · `sub_merchant_inherited` · `status_updated` · `ownership_taken` · `field_reviews_saved` · `testing_limits_applied` · `mid_creation_saved` · `wordpress_website_saved` · `resubmission_email_failed` · `merchant_request_interrupted` · `portal_password_code_generated` · `portal_password_code_revealed` · `portal_api_credentials_saved` · `portal_api_credentials_revealed` · `portal_api_credentials_cleared` · `agreement_email_sent_manual` · `mid_creation_email_sent_manual` · `live_limits_applied` · `live_activation_email_sent` · `live_activation_email_sent_manual` · `live_activation_email_failed` · `mid_creation_email_sent` · `agreement_email_sent` · `resubmission_email_sent` · `resubmission_email_sent_manual` · `resubmission_whatsapp_sent_manual` · `rejections_prepared` · `resubmission_link_regenerated` · `resubmission_link_prepared` · `resubmission_link_revoked` · `client_resubmitted` · `sub_merchant_selected` · `document_review_sub_merchant_selected` · `sub_merchant_final_form_uploaded` · `sub_merchant_manual_email_proof_uploaded` · `agreement_final_uploaded` · `agreement_received_uploaded` · `email_undelivered` · `email_delivery_confirmed` · `case_created_from_flow_start`

Writers not found in the backend code reviewed, so these rows are not written today: `sub_merchant_form_email_sent`, `sub_merchant_form_email_failed` (the frontend labels them only), `mid_go_live_started`, `case_created_from_mid_go_live` (frontend `ACTION_META` only). `comment_added` is filtered out but not written (see Data).

The full list lives in the frontend `ACTION_META` table and in the individual services that write history — there is no single backend enum of history actions.

## Data, validation and edge cases

| Item | Detail |
|---|---|
| **`case_comments`** (`backend/src/db/schema.ts`) | `id` (uuid), `caseId` (references `cases.id`, on delete cascade), `authorId` (references `users.id`, on delete set null), `content` (text, not null), `parentId` (self-reference to `case_comments.id`, on delete set null — so deleting a parent would orphan its replies rather than deleting them, though no delete path exists), `mentions` (text array), `createdAt`, `updatedAt`. Indexes on (`caseId`, `createdAt`, `id`), `authorId`, `parentId`. |
| **`case_history`** | `id` (uuid), `caseId` (references `cases.id`, on delete cascade), `actorId` (references `users.id`, on delete set null — `null` means a system entry), `action` (varchar 64, not null), `details` (JSONB, nullable), `createdAt`. Indexes on (`caseId`, `action`, `createdAt`), (`caseId`, `createdAt`, `id`), `actorId`. |
| **Comment validation** (`createCommentSchema` in `cases.schemas.ts`, strict object) | `content`: string, minimum 1 character, maximum 5000 characters. `parentId`: optional UUID. `mentions`: optional array of UUIDs, maximum 20. There is no validation in the code reviewed that a mentioned user id actually exists, or that mentioned users can view the case. A mention of a stranger would be stored and would presumably notify nobody. |
| **Mentions are stored as user ids** | `mentions: text[]` holds the user ids the composer sent. The text keeps plain `@Name` tokens. `buildCommentSnippet` in `notifications.copy.ts` also strips a `@[Name](uuid)` form (no current writer found), then clips the snippet to 140 characters with an ellipsis. |
| **History is not a security log** | `actorId` is set null for system entries, and details are sanitised before display (`sanitizeCaseHistoryDetails`). The code reviewed does not show history rows being used to enforce permissions. |
| **Ordering edge case** | Comments are returned oldest first; history is returned newest first. The frontend reverses/groups each accordingly — a consumer that assumes one order for both will display them wrong. |
| **Comment on a closed case** | Accepted. `createCaseComment` checks only `assertCanWorkCase` (queue access), with no case-status check. See file 32, gap 8 and L15. |
| **`comment_added` history** | No backend code writes a `comment_added` history row any more. `createCaseComment` writes none. The `action <> 'comment_added'` filter in `listCaseHistory` remains. |
| **No pagination** | Comments and history are returned in full, with no limit (see file 32, gap 8). |
| **No comment count or "last comment" field** | No comment count or "last comment" field is stored on the case row; counts would have to be computed from `case_comments`. |

## What to check — is this what you intended?

- [ ] **Edit / delete comments:** should staff be able to edit or delete their own comments (for example to fix a typo), or is "comments are permanent" the intended rule?
- [ ] **Who can comment:** who should be allowed to comment — anyone who can view a case, or only people who can work it? Today posting requires work access.
- [ ] **Mentions of strangers:** should @-mentions be limited to people who can see the case, and should mentioning someone who cannot see it warn the author instead of silently notifying nobody?
- [ ] **Comments on closed cases:** should comments on a closed case be allowed, or locked once the case is closed?
- [ ] **Free-text history actions:** the history `action` is a free-text string, not a fixed list, so new actions can appear without anyone noticing. Do you want a fixed list of history actions with a review step when a new one is added?
- [ ] **History as audit record:** is the history timeline meant to be the audit record for the business (kept forever, never deleted), and what happens to it if a merchant is deleted — today the rows cascade-delete with the case?
- [ ] **Merchant visibility:** should the merchant ever see any part of the history or comments, for example a "what happened to my application" view in the portal?

---
*Sources: `frontend/src/features/cases/case-detail/case-chatter.tsx`, `frontend/src/features/cases/case-detail/case-history-timeline.tsx`, `frontend/src/hooks/use-case-detail-query.ts`, `frontend/src/features/notifications/notifications-provider.tsx`, `frontend/src/apis/cases.ts`, `backend/src/modules/cases/case-comments.service.ts`, `backend/src/modules/cases/case-history-format.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/case-access.service.ts`, `backend/src/modules/notifications/notifications.copy.ts`, `backend/src/modules/notifications/notifications.service.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/modules/cases/case-email-delivery.ts`, `backend/src/modules/email/email-delivery-status.ts`, `frontend/src/features/cases/case-detail/case-side-panel.tsx`, `backend/src/db/schema.ts`. Related files: 24 (notifications), 32 (gap 8, L15).*
