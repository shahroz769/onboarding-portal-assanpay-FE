# 12 — Case Detail and Case Lifecycle

## At a glance

| | |
|---|---|
| **What it is** | One case is one merchant's journey through one queue — for example, one merchant's Documents Review, or one merchant's Agreement. The case detail page is where that journey is worked: the employee sees the merchant, the queue, the current stage, the SLA position, the workflow form for that queue, and the side panel with ownership, history and discussion. |
| **Who can use it** | Viewing: any signed-in employee who can view the case's queue. Working (saving forms, sending mail, advancing, closing): only the case owner, with `work` access to the queue. Assigning / changing priority: super admin / admin only. |
| **Where it lives** | `/cases/:caseId` |
| **What it creates** | No new record by itself — but a successful close can automatically create the next case in the chain (via the case-flow engine), and can change the merchant's status (testing completed / live). |
| **Main APIs** | `GET /api/cases/:id` · `PATCH /api/cases/:id/take-ownership` · `PATCH /api/cases/:id/assign` · `PATCH /api/cases/:id/status` · `PATCH /api/cases/:id/advance-stage` · `PATCH /api/cases/:id/close-unsuccessful` · `GET/POST /api/cases/:id/comments` · `GET /api/cases/:id/history` |
| **Main code** | Frontend: `src/routes/_app.cases.$caseId.tsx`, `src/features/cases/case-detail/case-detail-shell.tsx` · Backend: `src/modules/cases/case-state-machine.ts`, `case-stage.service.ts`, `case-transition.service.ts`, `case-assignment.service.ts`, `case-close-checklist.ts` |
| **Success looks like** | A case moves `new` → `working` → (sometimes `awaiting_merchant`) → `closed` (successful or unsuccessful), its checklist is complete, and the next case in the chain is created automatically when the flow rules say so. |

## How it works — the journey

```
Case created: status new, no owner, queue's first stage
        ↓
Someone takes it (or an admin assigns it) → working
        ↓
Owner completes the queue's workflow form (files 13–18)
        ↓
Owner may send something to the merchant → awaiting_merchant
  (merchant responds → back to working)
        ↓
Owner presses Advance → checklist checked → case closes successfully
  (or owner closes unsuccessfully with a reason, at any open status)
        ↓
Closed is final — no reopen
  · successful close may auto-create follow-up cases
  · closing a testing case marks merchant testing_completed
  · closing a live case marks the merchant live
```

## The lifecycle, step by step

1. A case is created with status `new`, no owner, and the queue's first stage (`initialCaseState` in `backend/src/modules/cases/case-state-machine.ts`). Case numbers come from the queue's sequence (for example `DR-000000001`).
2. **Start work.** Someone takes the case (`PATCH /:id/take-ownership`) or an admin assigns it (`PATCH /:id/assign`). Taking ownership on a `new` case moves it to `working` (event `start_work`). An admin assigning an owner to a case still in its `new` stage also moves it to `working` (event `start_work`, `assignCase` in `case-assignment.service.ts`). Assigning an owner to a case that is already `working` or `awaiting_merchant` changes the owner without changing the status (event `change_owner`). Assigning `ownerId: null` returns a `new` or `working` case to the pool (event `return_to_pool`, back to `new`). Unassigning a case that is `awaiting_merchant` and has an owner is refused with `409` ("This case is waiting on the merchant and cannot be unassigned. Transfer it to another owner instead."). Assigning the case to the person who already owns it changes nothing and returns the case as it is.
3. **Work.** The owner completes the queue's workflow form (files 13–18). While the case is `working`, the owner may also move it back to `working` from `awaiting_merchant` with `PATCH /:id/status` (`manual_resume`) — this is the only status change an owner is allowed to make directly (`isManualStatusChangeAllowed` only permits `awaiting_merchant → working`).
4. **Wait for the merchant.** When the owner sends something to the merchant (a resubmission email, an agreement, credentials), the case moves to `awaiting_merchant` (event `request_merchant`, only from `working`). If the send fails after the case was already reserved in that state, the code reverses it (event `release_request`, back to `working`).
5. **Merchant responds.** A resubmission, or the signed agreement coming back, moves the case back to `working` (event `merchant_responded`).
6. **Advance / close successfully.** The owner presses Advance (or the workflow's close action), which calls `PATCH /:id/advance-stage`:
   - For queues **without** a close checklist (only `generic` and `physical_agreement` in the code reviewed — see below), it moves to the next stage by order. If that stage is `closed`, the case closes with `closeOutcome = 'successful'`.
   - For queues **with** a checklist (`document_review`, `sub_merchant_form`, `agreement`, `mid`, `testing`, `live`, `wordpress`), advancing is only allowed from `working` and from the `working` stage itself, and the first unmet checklist item is returned as a `400` error naming exactly what is missing. When the checklist passes, the case jumps straight to the `closed` stage with `closeOutcome = 'successful'`, `closeReason = null` and `closedAt = now`.
   - `slaBreached` is computed at close time from `createdAt` plus the queue's `slaHours` (default 24 hours).
   - For the Live queue, a successful close also marks the merchant live (`went_live`). Testing closes mark the merchant `testing_completed`. Both happen inside the same transaction as the close (`afterUpdate` in `advanceStage`, `case-stage.service.ts`).
7. **Close unsuccessfully.** The owner gives a reason (1–2000 characters) and calls `PATCH /:id/close-unsuccessful`. This is allowed from any open status (`new`, `working`, `awaiting_merchant`), sets `closeOutcome = 'unsuccessful'`, records the reason, and closes the case. It is **not** blocked by the close checklist and **not** blocked by undelivered email.
8. **Closed is final.** The state machine has no event out of `closed`, and the database trigger from migration `0101_case_state_guard` enforces the same rules for any other writer. There is no reopen in the code reviewed.
9. **After a successful close**, the case-flow engine may create follow-up cases automatically (see "Follow-up cases" below), and a merchant state change may happen: closing a `testing` case marks the merchant `testing_completed`; closing a `live` case marks the merchant live (`went_live`, `liveAt = now`) — and that close is rolled back with `409` if the merchant was not in `testing` first ("Live without testing" guard in `case-stage.service.ts`).

## Who can use it — permissions

| Action | Who |
|---|---|
| **Viewing a case:** `GET /api/cases/:id` and the page `/cases/:caseId` | Any signed-in employee. Agents with `queueViewScope = 'selected'` may only view cases in queues where they hold a `view` row — otherwise `403` ("You do not have access to this queue.", `assertCanViewCase` in `backend/src/modules/cases/case-access.service.ts`). |
| **Working a case** (saving forms, sending mail, advancing, closing) | Only the case owner, and only if they also have `work` access to the case's queue (`assertCanWorkCase`). Almost every workflow service starts with the same two checks: `ownerId !== userId` → `403 "Only the case owner can …"`, then the queue work-access check. Admins and super admins are not owners by default — they must be assigned the case (or take it) before they can work it. The one exception in the code reviewed is assignment itself (below). |
| **Assigning / transferring / unassigning** (`PATCH /api/cases/:id/assign`, `POST /api/cases/bulk-assign`) | `super_admin` and `admin` only. |
| **Changing priority** (`PATCH /api/cases/:id/priority`) | `super_admin` and `admin` only. Refused with `409` "Priority cannot be changed for a closed case." on a closed case. The change writes no case-history row (`updateCasePriority` in `case-assignment.service.ts`). |
| **Taking ownership** (`PATCH /api/cases/:id/take-ownership`) | Any employee with work access to the queue (`requireWorkAccess`), on an unowned case in status `new` whose current stage is the queue's first (`new`) stage (`takeOwnership`, `case-assignment.service.ts`). |
| **Closing as unsuccessful** (`PATCH /api/cases/:id/close-unsuccessful`) | Only the case owner (`403 "Only the case owner can close the case."`), who also needs `work` access to the queue (`assertCanWorkCase`). |
| **Comments** (`GET`/`POST /api/cases/:id/comments`) | Reading needs view access (`assertCanViewCase`). Writing needs working access to the queue (`createCaseComment` calls `assertCanWorkCase`), not ownership: any agent with a `work` row for the queue, and any admin or super admin, can post. Comments are also accepted on closed cases (see file 32, open finding L15 and gap 8 for the lack of pagination). |

## The state machine, in full

From `backend/src/modules/cases/case-state-machine.ts` (`CASE_TRANSITIONS`):

| Event | From | To |
|---|---|---|
| `start_work` | `new` | `working` |
| `change_owner` | any open status | unchanged |
| `return_to_pool` | `new`, `working` | `new` |
| `request_merchant` | `working` | `awaiting_merchant` |
| `release_request` | `awaiting_merchant` | `working` |
| `merchant_responded` | `awaiting_merchant` | `working` |
| `manual_resume` | `awaiting_merchant` | `working` |
| `advance_stage` | `working`, `awaiting_merchant` | next stage's status |
| `close_successful` | `working`, `awaiting_merchant` | `closed` |
| `close_unsuccessful` | any open status | `closed` |
| `merchant_terminated` | any open status | `closed` |
| `repair_stage` | any status | unchanged |

The database enforces the same rules on every UPDATE, whoever writes it. Migration `backend/drizzle/0101_case_state_guard.sql` (function `enforce_case_state`) rejects: reopening a closed case; `new → awaiting_merchant` and `awaiting_merchant → new`; a closed case without `closed_at` and `close_outcome`, or an open case with them; a case becoming `working` (or losing its owner while `working`) with no owner; and a status that does not match its stage category. A violation raises SQLSTATE `P7601`, which `middleware/error-handler.ts` returns as 409 "This case change is not allowed in its current state." Inserts and unrelated updates (priority, flow version) are not checked.

Statuses are `new`, `working`, `awaiting_merchant`, `closed` (`case_status` enum). Stage slugs map to statuses: a stage called `awaiting_merchant` (or `awaiting-merchant`) means `awaiting_merchant`, a stage called `working` means `working`; otherwise the stage's category decides (`new` → `new`, `in_progress` → `working`, `closed` → `closed`).

### Stages per queue

Stage templates live in `backend/src/modules/queues/queue-workflow.ts` (`getStageTemplateDefinitions`) and are seeded into `queue_stages`:

| Queues | Stages |
|---|---|
| **Documents Review, Agreement** | New → Working → Awaiting Merchant → Closed (slugs `new`, `working`, `awaiting_merchant`, `closed`; categories `new`, `in_progress`, `in_progress`, `closed`). |
| **EP Sub-Merchant Form, MID Creation, Testing, WordPress Website, Live, Support Ticket (generic), Physical Agreement** | New → Working → Closed. |

Note the mismatch to watch: Document Review and Agreement have a real `awaiting_merchant` stage, so their "send to merchant" step moves the stage as well as the status. The other queues have no such stage, so their waiting is represented by status alone. The seed file (`backend/drizzle/seed-queue-stages.sql`) still uses the older slug `awaiting_client` for Documents Review and Agreement; migration `0077_rename_awaiting_client_stage` renames it. A second, empty copy at `backend/sql/seed-queue-stages.sql` exists (see file 32, gap 18). If the seed and the template disagree in a given environment, the stage actually in the database wins.

## Email delivery can block a successful close

- Case emails sent through Resend are recorded in `email_log`. `sent` only means Resend accepted the email. Webhooks (`POST /api/webhooks/resend`) move it to `delivered`, `delivery_delayed`, `bounced`, `complained`, `suppressed` or `failed` (see `backend/apis/cases.md`).
- Closing a case successfully returns `409` with a `closeBlockedReason` until the latest tracked email is `delivered` — unless a later manual (Gmail) or WhatsApp send replaced it. Closing as unsuccessful is not affected. Emails sent before the webhook secret was configured (`delivery_tracked = false`) never block.
- If the latest email has waited over 2 minutes for a webhook, opening the case or closing it asks Resend directly for the status (at most once a minute per email), so a lost webhook does not block the case forever.
- The case owner can also confirm delivery manually: `POST /api/cases/:id/email-delivery/confirm-delivered` with an `emailLogId` — for the situation where Resend says the "To" address got it but a CC bounced. The side panel offers this as **Force close** (only in the mark-successful action, and only to the owner). It is offered only when the latest tracked email is `bounced`, `complained` or `suppressed` and was copied to at least one CC address, and the case is `working`. Confirming writes an `email_delivery_confirmed` history entry and lets the close through; it does **not** change the email's Resend status. Refusals: 409 "Delivery can only be confirmed while the case is in Working.", 409 "This email can only be force closed when it bounced and was copied to CC addresses.", and 409 "A newer email was sent for this case. Refresh and check it again." when `emailLogId` is no longer the latest email (`case-email-delivery.ts`).
- The text of a blocked close is built by `closeBlockedReason()` in `case-email-delivery.ts`. Examples: "The … email to … bounced. … Send it again to a working address, or send it manually by Gmail or WhatsApp, before closing this case." For a delayed email it says Resend keeps retrying for up to 72 hours. The API returns it as the 409 error text (`case-transition.service.ts`).

## Follow-up cases (case flow)

- Admins configure flow rules (start rules, close triggers, close blockers, creation requirements) in versioned rule sets (`case_flow_versions` and related tables; the UI is the Caseflow Builder, file 32's area). A merchant submission and a successful case closure can create follow-up cases when those rules are configured.
- The work is durable: closing a case enqueues close jobs (`case_flow_close_jobs`), processed by a background worker (`case-flow.service.ts`, scheduled from `backend/src/index.ts`). Timing comes from environment variables with these defaults (`backend/src/config/env.ts`):
  - `CASE_FLOW_WORKER_POLL_MS` = 1,000 ms while the worker has work.
  - `CASE_FLOW_WORKER_IDLE_POLL_MS` = 15 minutes. When a cycle claims nothing, the delay doubles up to this cap, and the worker wakes early when the next retry is due. It is **not** one minute.
  - `CASE_FLOW_WORKER_BATCH_SIZE` = 5 jobs per cycle.
  - `CASE_FLOW_WORKER_DEGRADED_AFTER_ATTEMPTS` = 8 (falls back to the `CASE_FLOW_WORKER_MAX_ATTEMPTS` variable, then 8). After that many failed attempts the job is reported as degraded, and it keeps retrying.
  - Retry backoff: base 30 s, capped at 15 minutes (`CASE_FLOW_WORKER_RETRY_MAX_MS`), with ±10% jitter (`case-flow-retry.ts`, minimum 1 s).
  - Blocked jobs are retried every 6 hours (`CASE_FLOW_WORKER_BLOCKED_RETRY_MS`), so a health check that counts them stays "degraded" (see file 32, open finding L13).
- Admins can inspect degraded jobs (`GET /api/cases/flow-jobs/failed`), retry one (`POST /api/cases/flow-jobs/:jobId/retry`), and preview/backfill missing close-trigger cases (`GET /api/cases/flow-jobs/backfill/preview`, `POST /api/cases/flow-jobs/backfill` with `{ triggerId }`).

## How it is implemented — Frontend

- Route: `frontend/src/routes/_app.cases.$caseId.tsx` renders `frontend/src/features/cases/case-detail/case-detail-shell.tsx` (`CaseDetailShell`). A failed load renders "Case not found" via the route's error component.
- `CaseDetailShell` shows: a stage progress bar (stages from the detail payload, current stage highlighted, passed stages marked), Case Number, Case Owner (or "AP System" when unassigned), Merchant Name, and an SLA box (`getCaseSlaStatus` in `frontend/src/lib/sla.ts`).
- The workflow form is chosen by **workflow type, not slug**: `queue-registry.ts` maps `document_review` → `documents-review-renderer`, `sub_merchant_form` → `sub-merchant-form-renderer`, `agreement` → `agreement-renderer`, `mid` → `merchant-id-renderer`, `testing` → `testing-renderer`, `wordpress` → `wordpress-website-renderer`, `live` → `live-renderer`, `generic` → `generic-renderer`. A temporary slug bridge exists for older payloads without `workflowType`.
- Side panel: `case-side-panel.tsx` — ownership actions (take ownership, assign, priority), the advance/close controls, the close-as-unsuccessful dialog (reason required), the close-checklist display, plus tabs for chatter (`case-chatter.tsx`) and history (`case-history-timeline.tsx`). Supporting pieces: `case-section.tsx`, `case-closed.ts`, `case-detail-skeletons.tsx`, `agreement-rounds-card.tsx`, `rejection-rounds-card.tsx`, `documents-review-summary-modal.tsx`, `portal-api-credentials-fields.tsx`, `portal-password-code-card.tsx`.
- API calls: `frontend/src/apis/cases.ts` — `fetchCaseDetail()`, `takeOwnership()`, `advanceStage()`, `moveCaseBackToWorking()` (PATCH `/status` with `{ status: 'working' }`), `closeUnsuccessful()`, `assignCase()`, `updateCasePriority()`, `fetchCaseComments()`, `createCaseComment()`, `fetchCaseHistory()`, `confirmCaseEmailDelivered()`.
- Documents Review pages are wrapped in `DocumentsReviewDraftProvider` (draft field-review state kept locally until saved).

## How it is implemented — Backend

- Module: `backend/src/modules/cases/`. Key files:

| File | What it does |
|---|---|
| `case-state-machine.ts` | `CASE_TRANSITIONS`, `writeCaseState()` (the only writer of status/stage/owner), `getStatusForStage()`, `initialCaseState()`. |
| `case-stage.service.ts` | `updateCaseStatus()` (manual resume), `advanceStage()` (checklist + close-successful + merchant state changes), `closeUnsuccessful()`. |
| `case-transition.service.ts` | `transitionCaseState()` (locks the case row, checks the expected status/stage/owner, applies the event, writes history, runs the after-update hook) and `loadQueueStageForCase()`. |
| `case-assignment.service.ts` | `assignCase()`, `bulkAssignCases()`, `takeOwnership()`, `updateCasePriority()`. |
| `case-close-checklist.ts` | `hasCloseChecklist()`, `getCloseChecklistBlockers()`, `loadCloseChecklistFacts()` (the per-workflow rules; the checklist text itself lives here and is repeated in files 13–18). |
| `case-query.service.ts` | `getCaseDetail()` (case + merchant + queue + stages + workflow data + `emailDelivery` + close blockers). |
| `case-comments.service.ts` | `listCaseComments()`, `createCaseComment()`, `listCaseHistory()`. |
| `case-flow.service.ts` / `case-flow-worker.ts` / `case-flow-retry.ts` / `case-flow-job-state.ts` | Follow-up case creation. |
| `case-sla.ts` | `isCaseSlaBreached()` (default 24h). |
| `case-email-delivery.ts`, `agreement-email-status.ts`, `case-email-send-state.ts` | The delivery-blocking logic. |

- `GET /api/cases/:id` returns the case, its queue (`{ id, name, slug, workflowType, lifecycle, slaHours }`), merchant, owner, stages, current stage, workflow-specific detail, `emailDelivery` for the latest tracked merchant email, and the close checklist blockers. `GET /api/cases/:id/history` adds `emailDelivery` to every entry that records an email.
- Comments: `POST /api/cases/:id/comments` body `{ content (1–5000 chars), parentId?, mentions? (max 20 user ids) }` — replies via `parentId`, mentions as a list of user ids (`createCommentSchema`).
- History: most state changes, assignments, emails and workflow actions write a row to `case_history` (`action` varchar 64, `details` jsonb, `actorId`). Priority changes are the exception (none is written). History action names seen in the code include:
  - Ownership and state: `owner_assigned`, `owner_transferred`, `owner_unassigned` (assign / bulk assign), `ownership_taken` (take ownership), `status_updated` (manual resume), `stage_advanced`, `closed_successful`, `closed_unsuccessful`, `case_created_manually`.
  - Documents Review: `field_reviews_saved` (written by `saveFieldReviews` only for queues other than Documents Review; the Documents Review history for saves was not traced in this pass), `document_review_sub_merchant_selected`, `resubmission_link_regenerated`, `resubmission_link_revoked` (with reason `case_reassigned`, `user_deactivated` or `user_access_changed`), plus the send actions `resubmission_email_sent`, `resubmission_email_sent_manual`, `resubmission_whatsapp_sent_manual`.
  - EP Sub-Merchant Form: `sub_merchant_selected`, `sub_merchant_final_form_uploaded`, `sub_merchant_manual_email_proof_uploaded`.
  - Other queues: `mid_creation_saved`, `testing_limits_applied`, `mid_creation_email_sent` and its manual variants.

## Data, validation and edge cases

- **Owner-only writes:** nearly every mutation checks `ownerId === userId` first and returns `403` otherwise. An admin who is not the owner cannot advance, close, save forms or send mail on a case — they must assign it to themselves first. The code reviewed does not show an admin override.
- **Concurrent edits:** `transitionCaseState` checks the expected status/stage/owner and reports "Case stage was already updated." on conflict, so two people advancing the same case cannot both succeed.
- **No reopen:** once `closed`, no event and no API in the code reviewed can move a case back. A case closed by mistake can only be replaced by creating a new case (or, for EP, re-triggering — file 14).
- **Advance from the wrong place:** advancing requires an `in_progress` stage; advancing a `new` case, or a checklist case that is not in `working` on the `working` stage, returns `400`.
- **Missing stage:** a case with no `currentStageId` cannot be advanced (`400 "Case has no current stage."`); a `repair_stage` event exists to point such a case at the stage for its status.
- **Merchant terminated:** closing a merchant terminates its open cases via the `merchant_terminated` event (bulk unsuccessful close).
- **Email blocking:** a successful close can be blocked by an undelivered email even when the checklist is complete. The `closeBlockedReason` text is built in `case-email-delivery.ts` from the template label, the recipient and any CC addresses, for example "The <template> email to <recipient> bounced. <fix>". The fix text is "Send it again to a working address, or send it manually by Gmail or WhatsApp, before closing this case." and, when the case is `awaiting_merchant`, it starts with "Move the case back to Working, then send it again...". Wording exists for the bounced, spam-complaint, suppressed and failed statuses. Any CC address is named as a possible cause.
- **Case-flow jobs:** a follow-up case that fails to create is retried automatically; it is only surfaced to admins through the failed-jobs endpoint, not on the case page itself.
- **Reassignment and pending resubmission links:** every assign, transfer and unassign (single or bulk) revokes the case's **unsent previewed** resubmission links with reason `case_reassigned` and writes a `resubmission_link_revoked` row. Links the merchant already has (delivered links) are kept (`case-resubmission-tokens.service.ts`).
- **Merchant-level priority:** a change to the merchant's priority overwrites every case of that merchant, closed cases included, with no history row. Case-level priority is separate. See file 11 ("What each row shows").
- **Unsuccessful close reason:** `closeUnsuccessfulSchema` requires `min(1)`, so a reason of only spaces passes validation (see file 32, open finding L5).

> ⚠️ **Not found in the code reviewed:** any "reopen case" endpoint; any way to change a case's queue after creation. Priority changes (case or merchant level) are **not** written to case history (`updateCasePriority`, `updateMerchantPriority`), so there is no audit view of who changed a case's priority.

## Requests, responses and errors

All case routes sit behind `requireAuth` (`caseRoutes.use('*', requireAuth)`).

| Endpoint | Request body | Result |
|---|---|---|
| `PATCH /api/cases/:id/take-ownership` | No body (route in `cases.routes.ts` takes no validator). | Moves a `new` case to `working` with the caller as owner. Errors: 400 "Closed cases cannot be assigned or transferred.", 400 "Case already has an owner.", 400 "Case is not in the initial stage.", 409 "Case was assigned by another user." (lost race). |
| `PATCH /api/cases/:id/advance-stage` | No body (no validator on the route). | Moves to the next stage, or closes successfully when the checklist passes / the `closed` stage is reached. |
| `PATCH /api/cases/:id/status` | `{ status }` (`updateCaseStatusSchema`, `cases.schemas.ts` — `status` must be a valid case status). | Only `awaiting_merchant → working` is allowed (`manual_resume`); any other manual change is refused. |
| `PATCH /api/cases/:id/assign` | `{ ownerId: uuid \| null }` (`assignCaseSchema`); `null` unassigns. Admin only. | Changes the owner (and the status, for `start_work` / `change_owner` / `return_to_pool` — see the lifecycle above). |
| `PATCH /api/cases/:id/priority` | `{ priority: 'normal' \| 'high' }` (`updateCasePrioritySchema`). Admin only. | Updates the case priority. |
| `PATCH /api/cases/:id/close-unsuccessful` | `{ reason }` (`closeUnsuccessfulSchema` — 1–2000 characters). | Closes the case with `closeOutcome = 'unsuccessful'`. |
| `POST /api/cases/:id/comments` | `{ content (1–5000 chars), parentId?, mentions? (max 20 user ids) }`. | Adds a comment (or a reply via `parentId`). |
| `POST /api/cases/:id/email-delivery/confirm-delivered` | `{ emailLogId: uuid }` (`confirmEmailDeliverySchema`). | Records the owner's confirmation that the email reached its To address (only a CC bounced); see "Email delivery can block a successful close". Does not change the email's status. Idempotent when already confirmed. |

| Result | Meaning |
|---|---|
| `400` | "Case has no current stage." / "Case can only be advanced from an in-progress stage." / the first unmet checklist item, named exactly / "Case is already in a terminal stage." (close-unsuccessful on a closed case) / `Invalid status transition from "…" to "…".` (manual status change) — all from `case-stage.service.ts`. |
| `403` | "Only the case owner can advance the stage." / "Only the case owner can close the case." / "Only the current case owner can work on this case." (manual status change) — owner-only checks in `case-stage.service.ts`, plus the queue work-access check (`assertCanWorkCase`). |
| `404` | "Case not found." |
| `409` | Successful close blocked by an undelivered tracked email (`closeBlockedReason`); "Live without testing" guard when a Live close would mark the merchant live without it ever being in testing. |
| `500` | "Case queue is not configured." / "No closed stage configured." / "No next stage configured." — a queue-configuration problem, not a user error. "No next stage configured for this queue." comes from take-ownership. |

Errors from the assignment, take-ownership and priority endpoints (`case-assignment.service.ts`):

| Result | Meaning |
|---|---|
| `400` | "Closed cases cannot be assigned or transferred." (assign, bulk assign, take ownership). "Case already has an owner." and "Case is not in the initial stage." (take ownership). "Case has no current stage." (assign to a case with no stage). |
| `400` | "<Name> cases can only be closed successfully from working." (advance on a checklist queue that is not in `working`). The name is the queue label, for example "Documents-review", "EP Sub-Merchant Form", "WordPress Website" (`closeOnlyFromWorkingMessage`, `case-close-checklist.ts`). |
| `403` | "Inactive employees cannot own cases." (assign to an inactive user). "Selected employee does not have work access to: <queue names>." (assign to someone without `work` access to the case's queue). |
| `404` | "User not found." (assignee missing). "Case not found." (priority, assign). |
| `409` | "Case was assigned by another user." (take ownership lost a race). "Case assignment was already updated." (assign lost a race). "Priority cannot be changed for a closed case." |
| `409` | "This case is waiting on the merchant and cannot be unassigned. Transfer it to another owner instead." |

## What happens next — in plain words

- **After a successful close, the merchant moves on without anyone having to start the next step by hand.** The case-flow engine creates the follow-up case (for example Agreement after Documents Review, or Live after Agreement) when the rules say so, and the new case appears in the lists as `new`, waiting for an owner. Closing a testing case marks the merchant `testing_completed`; closing a live case marks the merchant `live`.
- **After an unsuccessful close, the journey stops for that case.** Nothing follows automatically; the merchant's other cases are unaffected, and a new case has to be created (or, for EP, re-triggered — file 14) if the work needs to be tried again.
- **After a case is closed, it is history, not work.** It stays readable — its timeline, comments and workflow data remain on the detail page — but it can never be reopened or edited again in the code reviewed.
- **If the next case never appears,** the follow-up creation may have failed in the background: admins can see degraded case-flow jobs at `GET /api/cases/flow-jobs/failed` and retry them, rather than the case owner seeing anything on the case page itself.

## What to check — is this what you intended?

- [ ] **Admin override:** should an admin be able to work a case they do not own (an override), or is "assign it to yourself first" the rule you want to keep?
- [ ] **Reopen:** there is no way to reopen a closed case. When a case is closed by mistake, is creating a brand-new case the right fix, or do you need a reopen action (and who should be allowed to use it)?
- [ ] **Email blocking a close:** a successful close can be blocked by an undelivered email (`409` with a reason). Is that the behaviour you want, or should the owner be able to close anyway and deal with the email separately?
- [ ] **Checklist on the list:** the close checklist is enforced at advance time and shown on the case page. Should the checklist also be visible on the case list, so a manager can see at a glance why a case cannot close yet?
- [ ] **Notify on termination:** when a merchant is terminated, all its open cases close unsuccessfully automatically. Should the case owners be notified when that happens?
- [ ] **Live without testing guard:** the Live queue's successful close marks the merchant live, and rolls the close back if the merchant was never in testing. Is that guard correct for merchants that legitimately skip testing?
- [ ] **Priority history:** priority changes (case or merchant level, normal/high) write no history row in the code reviewed. Should they be recorded in the case timeline?
- [ ] **Closed-case comments:** comments can still be added to a closed case. Should closed cases be read-only for comments too?

---

Case numbers are generated per queue (`PREFIX-000000001`, nine digits) by `modules/cases/case-number.ts`; see file 34.

*Sources: `frontend/src/routes/_app.cases.$caseId.tsx`, `frontend/src/features/cases/case-detail/case-detail-shell.tsx`, `frontend/src/features/cases/case-detail/case-side-panel.tsx`, `backend/src/config/env.ts`, `backend/src/index.ts`, `backend/src/middleware/error-handler.ts`, `backend/src/modules/cases/case-comments.service.ts`, `backend/src/modules/cases/case-email-delivery.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/cases/case-flow-job-state.ts`, `backend/src/modules/cases/case-flow-retry.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchant-state-machine.ts`, `backend/src/modules/queues/queue-workflow.ts`, `backend/drizzle/0077_rename_awaiting_client_stage.sql`, `backend/drizzle/0101_case_state_guard.sql`, `backend/sql/seed-queue-stages.sql`, `frontend/src/features/cases/case-detail/case-chatter.tsx`, `frontend/src/features/cases/case-detail/case-history-timeline.tsx`, `frontend/src/features/cases/case-detail/queue-registry.ts`, `frontend/src/apis/cases.ts`, `frontend/src/lib/sla.ts`, `backend/src/modules/cases/case-state-machine.ts`, `backend/src/modules/cases/case-stage.service.ts`, `backend/src/modules/cases/case-transition.service.ts`, `backend/src/modules/cases/case-assignment.service.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/case-comments.service.ts`, `backend/src/modules/cases/case-flow.service.ts`, `backend/src/modules/cases/case-flow-worker.ts`, `backend/src/modules/cases/case-sla.ts`, `backend/src/modules/cases/case-email-delivery.ts`, `backend/src/modules/queues/queue-workflow.ts`, `backend/drizzle/seed-queue-stages.sql`, `backend/src/config/env.ts`, `backend/src/index.ts`, `backend/src/modules/cases/case-flow-retry.ts`, `backend/src/modules/cases/case-resubmission-tokens.service.ts`, `backend/src/modules/cases/case-comments.service.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchant-state-machine.ts`. Related files: 11 (cases list / queue access), 13–18 (individual workflows), 32 (Caseflow Builder).*
