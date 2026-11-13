# 19 — Live Activation Workflow

## At a glance

| | |
|---|---|
| **What it is** | The last step of merchant onboarding: the point where a merchant's AssanPay account is switched on for real, production transactions. Staff-driven only — nothing in this step is requested by the merchant. |
| **Who can use it** | Only the case owner, with working access to the Live queue. Any authenticated staff member who can view the case can open the page, but cannot perform the Live actions. |
| **Where it lives** | Live queue (`slug: live`, prefix `LV`, `workflowType: live`, lifecycle `active`, SLA 24 hours) — defined in the seed data and in migration `0050_ensure_live_queue.sql`. Case numbers look like `LV-000000001`. |
| **What it creates** | A `live_limits_applied` history row + a live-activation email (sent / manual proof). Only one Live case ever exists per merchant. |
| **Main API** | `POST /api/cases/:id/live/limits-applied` · `POST /api/cases/:id/live/send-mail` |
| **Main code** | Frontend: `src/features/cases/case-detail/renderers/live-renderer.tsx` (`LiveRenderer`) · Backend: `src/modules/cases/live-case.service.ts` (`markLiveLimitsApplied`, `loadLiveCase`, `sendLiveActivationEmail`) |
| **Success looks like** | Live limits confirmed, live email sent and delivered, case closes successfully — onboarding is finished for that merchant. |

## In plain words — for a non-technical reader

Live activation is the final switch-on: the merchant's AssanPay account starts taking real, production payments. The merchant does nothing — staff do it all inside one case. After the Agreement case closes, a Live case appears automatically. The owner ticks that the live limits have been applied, sends the merchant a "your account is live" email listing those limits, and closes the case. Only then is onboarding finished. What happens next: nothing — onboarding is complete for that merchant, and no second Live case can ever be created for them.

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `POST /api/cases/:id/live/limits-applied`, `POST /api/cases/:id/live/send-mail`, `POST /api/cases/:id/live/send-mail/preview`, `POST /api/cases/:id/live/send-mail/manual` (multipart: `file`, `tokenId`, `channel: email \| whatsapp`, `recipientEmailType`) |
| Request / response | Send resolves `recipientEmailType` (`submitter` \| `business`); limits-applied is idempotent (returns existing timestamp/person); send uses idempotency key `live-activation/${caseId}` and template `live-activation` |
| Validation | Case must be `working` (stage `in_progress`) for both actions; a successful close is blocked until `live_limits_applied` exists (checklist text `Confirm live limits were applied before closing this case.`, `case-close-checklist.ts`), but the send does not check it; recorded history details are hard-coded `{ collection: '100-50,000', disbursement: '1000-50,000' }` (defaults `live.collectionMin 100`, `live.collectionMax 50000`, `live.disbursementMin 1000`, `live.disbursementMax 50000`) |
| Database | `case_history` rows `live_limits_applied`, `live_activation_email_sent` / `_manual` / `live_activation_email_failed` (with `emailLogId`, `recipient`, `cc`, `bcc`, `replyTo`, `recipientEmailType`, `error`); proof kinds `live_activation_email_proof` / `live_activation_whatsapp_proof`; trigger `cases_prevent_duplicate_live_case` blocks a second Live case (error `23505`); `mid_go_live_tokens` rows consumed by migration `0074` and the table dropped by migration `0079_drop_dead_go_live_tokens_and_user_deleted_at.sql` (not in `src/db/schema.ts`) |
| Auth / roles | Case owner only, plus working access via `assertCanWorkCase`; view-only staff cannot act |
| Errors | `404` case missing, `400 "Live limits can only be confirmed in an in-progress stage."` (limits confirm), `400 "Confirm live limits were applied before closing this case."` (close checklist), `409 "Close the Testing case before taking this merchant live."` (close, see step 6), `400 "This action is only available for Live cases."`, `403 "Only the case owner can send the live email."` / `"Only the case owner can update this case."`, `400 "The case must be in the working stage."`, `400 "Invalid preview token."` (`tokenId !== caseId`), `409` with `closeBlockedReason` while the latest email is not `delivered` |
| Integrations / limits | Resend via `sendEmail` (`LiveActivationEmail`); email-delivery gate (file 23), stale-status refresh after 2 minutes, at most once a minute per email; SLA 24 hours; `case_status` enum `new` \| `working` \| `closed` \| `awaiting_merchant`, close outcome `successful` \| `unsuccessful`; prefix `LV` |

## How it works — the journey

```
Agreement case closes successfully
        ↓
Live case created automatically (exactly one close trigger,
Agreement → Live, enforced by migration 0074)
        ↓
Live case starts new, with no owner
        ↓
Someone takes ownership → case moves to Working
        ↓
Owner confirms the live limits (checkbox)
        ↓
Owner sends the live activation email (recipient: submitter or business email)
        ↓
Email must be delivered before a successful close
        ↓
Case closes successfully → merchant is live
```

## The Live queue

| Field | Value |
|---|---|
| Name | `Live` |
| Slug | `live` |
| Prefix | `LV` |
| Workflow type | `live` |
| Lifecycle | `active` |
| SLA | 24 hours (`sla_hours: 24`) |
| Stages | `New` (`new`, category `new`) → `Working` (`working`, category `in_progress`) → `Closed` (`closed`, category `closed`) |

## Who can use it

| Action | Who | Checks |
|---|---|---|
| Confirm limits / send the live email | The case owner only | `403` for a non-owner: `"Only the case owner can send the live email."` / `"Only the case owner can update this case."` |
| Work the case at all | Caller must also have working access to the Live queue | `assertCanWorkCase` in `backend/src/modules/cases/case-access.service.ts` |
| View the case | Any authenticated staff member who can view the case | Can open the page and see its status, but cannot perform the Live actions |
| Merchant-facing step | None | There is no merchant-facing Live step |

> ⚠️ **No Go-Live link any more.** Migration `0074_agreement_driven_live.sql` deliberately retired the old merchant Go-Live links: it consumed every unconsumed row in `mid_go_live_tokens`, and the configuration documentation states "Merchants are not sent a Go-Live link and do not request Live activation."

## Step by step

### 1. The Agreement case closes successfully

That is the only automatic source of a Live case. Migration `0074_agreement_driven_live.sql` guarantees exactly one active close trigger from the Agreement queue (`workflow_type: 'agreement'`) to the Live queue (`workflow_type: 'live'`), and deletes any start rule or close trigger that would create a Live case from any other source.

### 2. A Live case is created for the merchant

It starts in status `new` with no owner. It is created through the normal case-flow close-job mechanism (see file 21), not by a person.

### 3. Someone takes ownership and moves the case to Working

The case must be in status `working` (stage category `in_progress`) before either Live action is allowed. Both backend functions return `400` ("The case must be in the working stage.") otherwise.

### 4. The owner confirms the live limits

In the case page this is a checkbox, "I have applied the live limits", with the live limits shown from Configuration (see file 25). The frontend text says: *"Confirm the merchant live limits before closing this case."* and *"Only the current case owner can confirm that live limits were applied."*

### 5. The owner sends the live activation email

The owner picks the recipient — the merchant's submitter email or business email — reviews a preview, and sends. The send itself does not check that the limits checkbox was ticked; only the close does (step 6). The email lists the configured live limits (`limitsAndMdr.live`, Configuration) per payment and payout method, and the recipient's CC/BCC/reply-to rules come from `resolveCaseEmailRecipients`.
### 6. The case is closed successfully

Closing is the normal case-close action. A successful close first runs the Live close checklist: it is refused with `400 "Confirm live limits were applied before closing this case."` until the limits confirmation exists in history (`case-close-checklist.ts`). Then it moves the merchant to live. The merchant state change (`went_live`, sets `liveAt`) is rolled back with `409 "Close the Testing case before taking this merchant live."` if the merchant is not in `testing_completed` (`case-stage.service.ts`, `merchant-state-machine.ts`). A successful close is also blocked until the live email is confirmed delivered (see "Data, validation and edge cases" below). Closing as unsuccessful is not blocked by email delivery. A successful close then writes the merchant's `went_live` event and sets `liveAt` (`case-stage.service.ts`, `advanceStage`). That event is refused unless the merchant is in `testing_completed`, so the close is rolled back with `409 "Close the Testing case before taking this merchant live."` (`LIVE_WITHOUT_TESTING_MESSAGE`, `merchant-state-machine.ts`).

### 7. Only one Live case ever exists per merchant

A database trigger, `cases_prevent_duplicate_live_case` (migration `0074_agreement_driven_live.sql`), rejects any second Live case for the same merchant with "A Live case already exists for this merchant." (error code `23505`). The bulk-create and manual-create endpoints also report this as a failure, for example "Live case LV-000000001 already exists for this merchant."

## How it is implemented — Frontend

- **Renderer:** `frontend/src/features/cases/case-detail/renderers/live-renderer.tsx` (`LiveRenderer`). It is chosen by the case's `workflowType` (`live`), not by its slug or name.
- **The renderer shows two cards:**

| Card | What it shows |
|---|---|
| **Live Limits** | The live limits per method (collection and disbursement ranges in PKR) from the limits configuration, and a checkbox "I have applied the live limits". The checkbox is disabled unless the viewer is the case owner and is working the case. |
| **Send Live Mail** | A "Sent" / "Ready" badge, the recipient picker (submitter or business email), a Send button, and — once sent — a notice "Live email already sent. The merchant was notified that the account is live." |

- The send button is disabled unless `isCaseOwner && isWorking && !liveEmailSent` and the history has finished loading. The email can only be sent once through this screen: `liveEmailSent` is true when the case history contains `live_activation_email_sent` or `live_activation_email_sent_manual`.
- **API calls** (in `frontend/src/apis/cases.ts`):

| Hook / call | Endpoint |
|---|---|
| `useMarkLiveLimitsApplied` | `POST /api/cases/:id/live/limits-applied` |
| `useSendLiveEmail` | `POST /api/cases/:id/live/send-mail` |
| `useFetchLiveEmailPreview` | `POST /api/cases/:id/live/send-mail/preview` |
| `useConfirmLiveEmailManual` | `POST /api/cases/:id/live/send-mail/manual` |

- The preview/manual flow uses the shared manual-email panel components in `frontend/src/components/case-email/` (`manual-email-panel.tsx`, `email-mode-choice.tsx`, `email-recipient-select.tsx`, `email-delivery-badge.tsx`, `whatsapp-message-panel.tsx`). The manual path lets the owner send the same message from Gmail or WhatsApp and then upload a screenshot as proof.
- The plain-text version of the message (used for the Gmail/WhatsApp path) is built in the renderer. Its subject is `AssanPay account is live for ${merchantName}` and its body lists the live limits per method, falling back to a single "Disbursement" row of `PKR 1000-50000` when the merchant has no payout methods.
- **History timeline** (`case-history-timeline.tsx`) labels `live_activation_email_sent` / `live_activation_email_sent_manual` as "Live email sent", `live_activation_email_failed` as "Live email failed", and `live_limits_applied` with its own entry.

## How it is implemented — Backend

- **Service:** `backend/src/modules/cases/live-case.service.ts` (`markLiveLimitsApplied`, `loadLiveCase`, `sendLiveActivationEmail`).
- **Routes** in `backend/src/modules/cases/cases.routes.ts`:

| Endpoint | Body |
|---|---|
| `POST /api/cases/:id/live/limits-applied` | — |
| `POST /api/cases/:id/live/send-mail` | `{ recipientEmailType? }` |
| `POST /api/cases/:id/live/send-mail/preview` | Same body |
| `POST /api/cases/:id/live/send-mail/manual` | Multipart form data: screenshot `file`, `tokenId`, `channel` (`email` \| `whatsapp`), `recipientEmailType` |

**`markLiveLimitsApplied` — checks, in order:**

| # | Check | Failure |
|---|---|---|
| 1 | Case exists | `404` |
| 2 | Queue workflow type is `live` | `400` |
| 3 | Caller is the owner | `403` |
| 4 | Caller can work the case | — |
| 5 | Status is `working` | `400` |
| 6 | Current stage category is `in_progress` | `400` |

If a `live_limits_applied` history entry already exists it returns the existing timestamp and person instead of writing a second one (idempotent). Otherwise it inserts a `case_history` row with action `live_limits_applied` and details `{ collection: '100-50,000', disbursement: '1000-50,000' }`.

**`loadLiveCase`** (shared by the send, preview and manual paths) applies the same owner / `live` / `working` checks.

**`sendLiveActivationEmail`:**

1. First checks that automatic email is enabled (`assertAutoEmailEnabled`).
2. Loads the MID Creation credentials for the merchant (`getMidCreationCredentials`) so the email can list the merchant's payment and payout methods.
3. Loads the limits/MDR settings and the merchant portal settings.
4. Resolves the recipient from `recipientEmailType` (`submitter` or `business` — see `emailRecipientTypeValues` in `cases.schemas.ts`).
5. Resolves extra recipients (CC sender, CC other merchant email, CC/BCC/reply-to from Configuration → Email Sending) via `resolveCaseEmailRecipients`.
6. Sends through `sendEmail` with template `live-activation`, subject from `liveActivationEmailSubject(merchantName)` ("AssanPay account is live for …"), React template `LiveActivationEmail`, and idempotency key `live-activation/${caseId}`.
7. Writes a `case_history` row: `live_activation_email_sent` on success, `live_activation_email_failed` on failure, with `emailLogId`, `recipient`, `cc`, `bcc`, `replyTo`, `recipientEmailType` and `error`.

**Email template:** `backend/src/modules/email/templates/live-activation.tsx` (`LiveActivationEmail`, `liveActivationEmailSubject`). Its catalog entry (see file 23) says its trigger is "The Live case is closed and the merchant account goes live" — note this wording describes the business moment, while the code sends the email while the case is still Working, before it is closed.

**Manual confirmation:** `confirmLiveActivationEmailManual` in `backend/src/modules/cases/case-communications.service.ts`. It requires manual email to be enabled, validates the proof file, requires `tokenId === caseId` (`400` "Invalid preview token."), and stores the proof under file kind `live_activation_email_proof` (or `live_activation_whatsapp_proof` for WhatsApp), as defined in `case-constants.ts`.

**Old Go-Live tokens:** the old Go-Live token table `mid_go_live_tokens` (created by migration `0018_mid_go_live_tokens.sql`) was emptied by migration `0074`, then dropped by migration `0079_drop_dead_go_live_tokens_and_user_deleted_at.sql`. It is no longer in `src/db/schema.ts`, and nothing reads or writes it. Not found in the code reviewed: any remaining endpoint that creates or redeems a Go-Live token.

## Data, validation and edge cases

| Case | What happens |
|---|---|
| **Case status values** | From `case_status` enum in `backend/src/db/schema.ts`: `new`, `working`, `closed`, `awaiting_merchant`. |
| **Close outcome values** | From `case_close_outcome`: `successful`, `unsuccessful`. |
| **Limits confirmation is enforced at close, not at send** | A successful close is blocked by the close checklist until `live_limits_applied` exists (`case-close-checklist.ts`). The live email can be sent before that confirmation, because `sendLiveActivationEmail` does not check it. The frontend text ("Confirm the merchant live limits before closing this case.") matches the close blocker. |
| **The recorded limits text is hard-coded** | `markLiveLimitsApplied` writes `collection: '100-50,000'` and `disbursement: '1000-50,000'` into the history details regardless of the configured limits. Those numbers match the default live limits in `configuration.service.ts` (`live.collectionMin 100`, `live.collectionMax 50000`, `live.disbursementMin 1000`, `live.disbursementMax 50000`), but if the configured defaults are changed, the history text will not follow them. This looks like a bug worth confirming with the owner. |
| **Email delivery blocks a successful close** | The latest merchant email must be `delivered` before a Live case (like any case) can close successfully, unless a later manual (Gmail) or WhatsApp send replaced it, or the owner confirms delivery manually (see file 23). The block returns `409` with a `closeBlockedReason`. Closing as unsuccessful is not affected. Emails sent before the Resend webhook secret was configured (`delivery_tracked = false`) never block. |
| **Stale delivery status is refreshed** | If the latest email has waited over 2 minutes for a webhook while `queued`, `sent` or `delivery_delayed`, opening or closing the case asks Resend directly, at most once a minute per email. |
| **Sending twice** | The automatic send uses idempotency key `live-activation/${caseId}`. The frontend also hides the send button after the first sent history entry. Not found in the code reviewed: an explicit backend rejection if `send-mail` is called twice — the idempotency key is the protection, and its exact duplicate behaviour depends on Resend. |
| **Wrong queue** | All Live endpoints (limits-applied, send-mail, preview and manual) return `400` ("This action is only available for Live cases.") for any other workflow type. |
| **Not the owner / not working** | `403` for a non-owner; `400` unless the case is `working`. The Live queue has no `awaiting_merchant` stage (`queue-workflow.ts` gives it only New, Working and Closed), so the working check is what gates the actions. |
| **Duplicate Live case** | The database trigger blocks a second Live case for a merchant even if the first one was closed unsuccessfully. This is different from EP cases, where re-triggering after an unsuccessful close is allowed (see file 20). |
| **Terminated merchant** | A terminated or deleted merchant cannot get a new case. `lockMerchantForNewCase` (`merchant-state-machine.ts`, used by `case-flow.service.ts` and `case-query.service.ts`) throws `409 "This merchant is terminated. New cases cannot be opened for it."`. The Live service itself has no separate check. |
| **Other Live messages** | `400 "Live limits can only be confirmed in an in-progress stage."` (stage check in `markLiveLimitsApplied`); `400 "Screenshot file is required."` and `400 "tokenId is required."` (manual route, `cases.routes.ts`); `403 "Manual email sending is disabled. Use the automatic email workflow."` (preview and manual); `403 "Automatic email sending is disabled. Use the manual email workflow."` (automatic send, `assertAutoEmailEnabled`). |

## What to check — is this what you intended?

- [ ] **Internal checklist only?** Is the Live case meant to be purely an internal checklist (confirm limits, send the email, close), or should the merchant do anything in the portal at this stage?
- [ ] **Limits confirmation at send time:** the close is blocked until the checkbox is confirmed, but the live email can be sent before that. Should the send also require the confirmation?
- [ ] **Hard-coded limits text:** the history entry for "limits applied" always writes `100-50,000` and `1000-50,000`, even if you change the configured live limits. Should it record the actual configured limits instead?
- [ ] **One Live case forever?** Should a merchant ever be able to have a second Live case — for example if the first Live case was closed unsuccessfully — or is "one Live case per merchant, forever" the intended rule?
- [ ] **Catalogue wording vs code:** the email template catalogue says the live email is triggered "when the Live case is closed", but the code sends it while the case is still Working, before closing. Which timing do you want, and should the catalogue wording be fixed?
- [ ] **Old Go-Live table:** the old merchant Go-Live link system was retired in favour of Agreement-close creating the Live case. Is there any merchant or partner who still expects a Go-Live link? (The table itself was dropped by migration 0079.)
- [ ] **Who owns a new Live case:** who should own a newly created Live case — should it auto-assign to the person who closed the Agreement case, or stay unassigned until someone picks it up?

---
*Sources: `frontend/src/features/cases/case-detail/renderers/live-renderer.tsx`, `frontend/src/apis/cases.ts`, `frontend/src/components/case-email/`, `frontend/src/features/cases/case-detail/case-history-timeline.tsx`, `backend/src/modules/cases/live-case.service.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/case-access.service.ts`, `backend/src/modules/cases/case-communications.service.ts`, `backend/src/modules/email/templates/live-activation.tsx`, `backend/src/db/schema.ts`, `backend/sql/seed-queues.sql`, `backend/src/modules/cases/case-stage.service.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/merchants/merchant-state-machine.ts`, `backend/src/modules/cases/case-email-delivery.ts`, `backend/drizzle/0074_agreement_driven_live.sql`, `backend/drizzle/0079_drop_dead_go_live_tokens_and_user_deleted_at.sql`. Related files: 21 (case-flow engine), 23 (email system), 25 (Configuration).*
