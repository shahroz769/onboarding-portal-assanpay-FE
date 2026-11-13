# 23 — Email System And Templates

## At a glance

| | |
|---|---|
| **What it is** | The portal sends emails to merchants at the key moments of onboarding, and to staff when they join or reset a password. All merchant email goes through one provider (Resend) and one code path, so every email is logged, tracked for delivery, and shown on the case it belongs to. |
| **Who can use it** | Case owners send case emails; `super_admin` / `admin` configure sending and view templates. Merchants only receive. |
| **Where it lives** | Configuration → Emails (`/configuration/email-templates`) for the read-only template preview; case pages for sending. |
| **What it creates** | An `email_log` row per send (starting as `queued`), plus a `case_history` row (`…_email_sent` / `…_email_failed`). |
| **Main API** | `POST /api/webhooks/resend` (public webhook) · `POST /api/cases/:id/email-delivery/confirm-delivered` · `GET /api/configuration/email-templates/:key` |
| **Main code** | Frontend: `src/features/configuration/panels/email-template-panel.tsx` + `src/components/case-email/` · Backend: `src/modules/email/email.service.ts` (`sendEmail`, `prepareEmail`, `deliverEmail`) + `src/modules/email/templates/` |
| **Success looks like** | Every merchant email is sent once, logged, delivered (tracked by webhook), and visible on its case — and a case cannot close successfully while its latest merchant email is undelivered. |

## In plain words — for a non-technical reader

The portal emails merchants at the key moments of onboarding — asking for documents again, sending portal login details, sending the agreement to sign, and telling them the account is live — and it emails staff when they join or reset a password. Every email goes through one provider (Resend) and one code path, so it is logged and its delivery is tracked. The case owner sends it, or sends it manually from Gmail/WhatsApp and uploads a screenshot as proof. Templates cannot be edited in the portal; what staff preview is exactly what the merchant receives. A case cannot close successfully while its latest merchant email is undelivered or still on its way. What happens next: the delivery result appears on the case, the owner is notified if it bounces, and the case can close once the email is delivered (or replaced manually, or confirmed by the owner).

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `POST /api/webhooks/resend` (public, Svix signature for `RESEND_WEBHOOK_SECRET`), `POST /api/cases/:id/email-delivery/confirm-delivered`, `GET /api/configuration/email-templates/:key`, plus per-workflow `…/send-mail`, `…/send-mail/preview`, `…/send-mail/manual` endpoints |
| Request / response | Manual send confirm (`…/send-mail/manual`): multipart `file`, `tokenId` (must equal case id), `channel` (`email` default \| `whatsapp`). Delivery confirm (`POST /api/cases/:id/email-delivery/confirm-delivered`) is plain JSON `{ emailLogId }` (UUID, strict), not multipart; preview returns recipient, CC/BCC/reply-to, subject and plain-text body; send uses an idempotency key (live: `live-activation/${caseId}`) |
| Validation | Sending mode defaults `{ autoEnabled: true, manualEnabled: true }`, at least one must be enabled; recipients defaults `{ ccSender: true, ccOtherMerchantEmail: true, cc: [], bcc: [], replyTo: [] }`; CC/BCC max 20 each, reply-to max 5, addresses trimmed/lower-cased/max 254 chars, duplicates rejected within each list, an address cannot be in both CC and BCC on save (`400`), and at send time a BCC address already used as CC or To is silently dropped (`resolveCaseEmailRecipients`); `recipientEmailType` `submitter` \| `business`, default `submitter` |
| Database | `email_log` (`id`, `toEmail` varchar 255, `subject` varchar 500, `template` varchar 120, `caseId`/`merchantId` nullable set null, `resendId`, `status`, `errorMsg`, `metadata` JSONB, `ccEmails`/`bccEmails`/`replyTo` text arrays, `statusDetail`, `statusUpdatedAt`, `deliveryTracked` default `false`, `createdAt`, `updatedAt`; migration `0082_email_delivery_tracking.sql`); status enum `queued` \| `sent` \| `failed` \| `delivered` \| `delivery_delayed` \| `bounced` \| `complained` \| `suppressed` |
| Auth / roles | Case email: case owner, Working status, per-workflow step; template view / sending configuration: `super_admin` / `admin` only; sending-mode read open to all authenticated users |
| Errors | Webhook: `400 "Invalid webhook signature."`, `503 "Resend webhooks are not configured."` (no secret), `503 "Email not found yet; retry later."` for an unknown email under 10 minutes old (then `200`); close: `409` whose `error` is the reason text (the same text is `emailDelivery.closeBlockedReason` on case detail; the body has no separate `closeBlockedReason` key); manual: `400 "Invalid preview token."`; confirm-delivered: `409` unless the case is Working, the email is the case's latest tracked email, it ended `bounced` / `complained` / `suppressed` with at least one CC address, and no manual send has superseded it (`403` for a non-owner) |
| Integrations / limits | Resend (provider client `getResendClient`, placeholder key `re_placeholder`); webhook events `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`; stale-status refresh after 2 min (`STATUS_CHECK_AFTER_MS = 2 * 60 * 1000`), at most once a minute (`STATUS_CHECK_INTERVAL_MS = 60 * 1000`); `EMAIL_TEST_TO` overrides the recipient and drops CC/BCC; env names `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_TEST_TO`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`; six templates (see table below) |

## How it works — the journey

```
Agent clicks Send on a case step
        ↓
Backend resolves recipient + CC/BCC/reply-to, renders the React
template to HTML, calls Resend
        ↓
email_log row created as queued (with idempotency key, so a
double-click does not send twice) → Resend accepts → sent
        ↓
Resend reports the real outcome by webhook:
delivered / delivery_delayed / bounced / complained /
suppressed / failed
        ↓
case_history records the send or failure; undeliverable
emails notify the case owner
        ↓
Case cannot close successfully until the latest merchant
email is delivered (unless replaced manually or confirmed)
```

## Two ways an email can leave the portal

| Way | How it works |
|---|---|
| **1. Automatic (Resend)** | The agent clicks Send in the portal; the backend renders a React email template and sends it through Resend. |
| **2. Manual (Gmail / WhatsApp)** | The agent copies the message text into Gmail (or WhatsApp), sends it themselves, and uploads a screenshot as proof. The portal records that the manual send happened. |

Which of those is allowed is a configuration setting (see "Sending mode" under "How it is implemented — Backend" below). The templates themselves are **not editable** in the portal: the Configuration → Email Templates page is a read-only preview of the real templates, so what staff see is exactly what merchants receive.

## Who can use it

| Action | Who |
|---|---|
| **Sending a case email** | The case owner, while the case is Working, and only for that case's workflow step (resubmission, MID credentials, agreement, live activation, sub-merchant final form). The exact owner / working checks live in each case service; the Live one is in file 19. |
| **Previewing an email before sending manually** | The case owner, through the `…/send-mail/preview` endpoints. Preview requires manual email to be enabled (`assertManualEmailEnabled`). |
| **Confirming a manual send** | The case owner, by uploading a proof screenshot through the `…/send-mail/manual` endpoints (multipart form data). The proof file kinds are `resubmission_email_proof`, `agreement_email_proof`, `mid_creation_email_proof`, `live_activation_email_proof`, and the WhatsApp equivalents (`…_whatsapp_proof`), plus `sub_merchant_email_proof` (`case-constants.ts`). |
| **Configuring email sending and recipients** | `super_admin` and `admin` only, under Configuration → Emails (see file 25 for the settings themselves). The email-sending-mode read endpoint is open to all authenticated users because case workflows need to know which options are enabled. |
| **Viewing the templates** | `super_admin` and `admin` only (Configuration → Email Templates). Merchants never see the template catalogue. |
| **Receiving the emails** | The merchant, at their business email or their submitter email — the agent picks which one when sending (`recipientEmailType`: `submitter` \| `business`, default `submitter`). |

## Step by step — Automatic send (Resend)

1. The agent clicks Send on a case step (for example "Send Live Mail").
2. The backend resolves the recipient (submitter or business email), resolves extra recipients from the Email Sending settings (CC the sender, CC the merchant's other email, fixed CC/BCC/reply-to lists), renders the React template to HTML, and calls Resend.
3. The attempt is recorded in `email_log` **before** sending, in status `queued`, with an idempotency key (the exact keys are listed under "Data" below) so a double-click does not send twice.
4. Resend accepts the email → status becomes `sent`. Note: `sent` only means Resend accepted it. It does **not** mean the merchant received it.
5. Resend later reports the real outcome through a webhook (see below): `delivered`, `delivery_delayed`, `bounced`, `complained`, `suppressed` or `failed`.
6. A `case_history` row records the send (`…_email_sent`) or the failure (`…_email_failed`) with the `emailLogId`, recipient, CC/BCC/reply-to and any error.

## Step by step — Delivery tracking (Resend webhooks)

1. Resend calls `POST /api/webhooks/resend` (public endpoint) with a Svix signature. Without a valid signature for `RESEND_WEBHOOK_SECRET` the call returns `400`; without the secret configured at all it returns `503`.
2. The webhook must be subscribed in Resend to: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`.
3. Each event is matched to its `email_log` row by the `email_log_id` tag Resend echoes back, or by the Resend id. An event for an unknown email returns `503` while it is under 10 minutes old (so Resend retries) and `200` after that.
4. Status changes follow strict rules (`email-delivery-status.ts`): out-of-order and repeated events are ignored safely. A late `delivery_delayed` never overwrites `delivered`; a `bounced` can follow a premature `delivered` (asynchronous bounces); a `complained` wins over everything except itself.
5. When an email becomes undeliverable (`bounced`, `complained`, `suppressed`, `failed`), the system writes a history entry `email_undelivered` (actor `null`) and notifies the case owner (`case_email_undelivered`, see file 24). Only when the case has an owner. Unlike the other notification paths, this one is not wrapped in a try/catch (`applyEmailDeliveryStatus` in `email-delivery-status.ts`): if the history insert or the notification throws after the status row is updated, the webhook returns `500`, Resend retries, and the retry finds the row already in that status and returns `unchanged`. The history entry and owner notification are then never written. See file 32, item 53.
6. Every applied status change (not a repeat or out-of-order event) pushes a `case-email-status` event to the case owner's open streams, so an open case page refreshes without polling. Only the owner receives it, and a case with no owner gets none. It is not stored.
7. Background: the merchant-request recovery job (every 5 minutes, `src/index.ts`) resolves a stuck resubmission or Agreement request from the email's log status: an undelivered status becomes `failed`, any other status becomes `sent` (`merchant-request.service.ts`).

## The delivery gate on closing

1. A case cannot close **successfully** while its latest merchant email is undelivered or still in flight. The close returns `409` with a `closeBlockedReason` until the email is `delivered`. The check runs inside the close transition (`case-transition.service.ts`, `assertCaseEmailDelivered`) and only for a successful close. A `queued` or `sent` email blocks too, with the message "hasn't been confirmed as delivered yet".
2. The block is lifted if a later manual (Gmail) or WhatsApp send replaced the automatic email, or if the owner confirms delivery manually (see below). Closing as **unsuccessful** is never blocked.
3. Only the latest email counts: the newest `email_log` row for the case with `delivery_tracked = true` and a non-null `resend_id` (`findLatestTrackedEmail`). The block message depends on the status (`case-email-delivery.ts`): `bounced` → "… bounced."; `complained` → "… was marked as spam by a recipient."; `suppressed` → "… was not delivered: an address is on the suppression list after an earlier bounce or complaint."; `failed` → "… failed to send."; `delivery_delayed` → "… is delayed. Resend keeps retrying for up to 72 hours." (plus a Gmail/WhatsApp suggestion); any other in-flight status → "… hasn't been confirmed as delivered yet. This usually takes a few seconds; try again shortly." When the email had CC addresses, the text adds that any of them may be the cause. When the case is `awaiting_merchant`, the text tells the owner to move it back to Working first.
4. Emails sent before the webhook secret was configured (`delivery_tracked = false`) never block.
5. If the latest email has waited over 2 minutes for a webhook while `queued`, `sent` or `delivery_delayed`, opening or closing the case asks Resend for the status directly — at most once a minute per email — so a lost webhook does not block the case forever. The check runs from `refreshStaleCaseEmailDelivery` (`case-email-delivery.ts`), called when a case is opened (`case-query.service.ts`, only for a user who can work the case) and before a successful close (`case-transition.service.ts`). Only the latest tracked email with a Resend id and an in-flight status (`queued`, `sent`, `delivery_delayed`) is checked. Resend's `last_event` maps as: `sent`, `delivery_delayed`, `delivered` (also `opened` and `clicked`), `bounced`, `complained`, `suppressed`, `failed` (also `canceled`, with the detail "The email was canceled before it was sent."). Other values are ignored. The once-a-minute throttle is an in-process `Map`, so each backend instance keeps its own.

## Owner confirmation of delivery

`POST /api/cases/:id/email-delivery/confirm-delivered` lets the case owner confirm (after checking on Resend) that the email reached the merchant's To address. The rules in `case-email-delivery.ts` are: the case must be in Working (`409` otherwise), and the confirmation writes history action `email_delivery_confirmed`. The frontend history text for it reads: *"Checked on Resend: the … email reached … and only a CC address failed, so the case can close successfully."* The body is `{ "emailLogId": "<uuid>" }` (`confirmEmailDeliverySchema`). Checks run in this order (`confirmCaseEmailDelivered`, `case-email-delivery.ts`): the caller must be the current owner (`403 "Only the current case owner can work on this case."`); the case must be Working (`409 "Delivery can only be confirmed while the case is in Working."`); the `emailLogId` must be the latest tracked email (`409 "A newer email was sent for this case. Refresh and check it again."`); and the email must be force-closable, meaning its status is `bounced`, `complained` or `suppressed` (not `failed`, because nothing reached anyone), it had at least one CC address, no later manual send has superseded it, and it is not already confirmed (`409 "This email can only be force closed when it bounced and was copied to CC addresses."`). Confirming an already-confirmed email returns the current state and writes no second history row. A successful confirm writes `email_delivery_confirmed` with `emailLogId`, `template`, `templateLabel`, `recipient`, `cc` and `status`, and sets `closeBlockedReason` to null. The route is `cases.routes.ts`.

## Step by step — Manual send (Gmail / WhatsApp)

1. The agent opens the manual panel for the case step and fetches a preview (`…/send-mail/preview`). The preview returns the recipient, the CC/BCC/reply-to that the automatic send would use, the subject, and the plain-text body to paste into Gmail (or WhatsApp).
2. The agent sends the message themselves, then returns to the portal and confirms: they upload a screenshot of the sent message. The endpoint requires multipart form data, a `file`, a `tokenId` and a `channel` (`email` default, or `whatsapp`). For the Live step the `tokenId` must equal the case id (`400` "Invalid preview token.", `case-communications.service.ts`); the resubmission step checks a resubmission token instead. The other steps' token checks were not all traced.
3. The portal stores the proof file and writes the history entry (`…_email_sent_manual` / `…_whatsapp_sent_manual`). That manual send supersedes the automatic email for the close gate.

## How it is implemented — Frontend

- **Template preview page:** Configuration → Emails (`/configuration/email-templates`, detail `/configuration/email-templates/:templateKey`). Tabs, in onboarding order, are defined in `frontend/src/features/configuration/email-template-tabs.ts`: Resubmission Request (`document-resubmission`), Portal Credentials (`mid-creation`), Agreement (`agreement`), Live Activation (`live-activation`), Password Setup (`user-password-invite`), Password Reset (`user-password-reset`).
- **Panel:** `frontend/src/features/configuration/panels/email-template-panel.tsx`; layout: `email-templates-layout.tsx`.
- **API:** `fetchEmailTemplatePreview` in `frontend/src/apis/configuration.ts` → `GET /api/configuration/email-templates/:key`.
- **Email sending settings dialog:** `frontend/src/features/configuration/panels/email-sending-settings-dialog.tsx` (auto/manual toggles plus the recipients form). It opens from the "Sending settings" button in `email-templates-layout.tsx`. The old page `/configuration/email-sending` (`_app.configuration.email-sending.tsx`) is only a redirect now and is not in the sidebar.
- **Case email UI (shared):** `frontend/src/components/case-email/` (`manual-email-panel.tsx`, `email-mode-choice.tsx`, `email-recipient-select.tsx`, `email-delivery-badge.tsx`, `whatsapp-message-panel.tsx`, `email-chips-input.tsx`).
- **Delivery badge:** `email-delivery-badge.tsx` shows the current `email_log` status on the case page and in history.
- **Case API calls** (`frontend/src/apis/cases.ts`): send, preview and manual confirm for each workflow step, plus `confirmCaseEmailDelivered` → `POST /api/cases/:id/email-delivery/confirm-delivered`.

## How it is implemented — Backend

| File | What it does |
|---|---|
| `backend/src/modules/email/email.service.ts` | `sendEmail`, `prepareEmail`, `deliverEmail`. `prepareEmail` creates the `email_log` row as `queued`; `deliverEmail` renders the template with `@react-email/render`, sends through Resend with the idempotency key, and updates the row to `sent` or `failed`. It never throws on provider errors — it returns `{ status: 'failed', error }` instead. A render error is also stored as `failed`, with `render: <message>` as the error. A send that Resend rejects stores the Resend message in `errorMsg` and `statusDetail`, which the Failed badge shows. The `email_log` row is written before the Resend call, so a crash between the two leaves a `queued` row. |
| `backend/src/modules/email/email.client.ts` | `getResendClient`, cached `Resend` instance; placeholder key `re_placeholder` when no key is configured |
| `backend/src/modules/email/templates/` | `_brand.tsx` (shared brand wrapper), `agreement.tsx`, `document-resubmission.tsx`, `live-activation.tsx`, `mid-creation.tsx`, `user-password.tsx` |
| `backend/src/modules/email/email-template-catalog.ts` | `getEmailTemplatePreview` is the only export; the template summary fields (`toSummary`) are returned inside the preview response, and there is no template list endpoint. The Emails page tab list is hard-coded in `email-template-tabs.ts`. The catalogue is read-only and renders the **real** template with `{{variable}}` placeholders instead of merchant data, "so the page can never drift from what is actually sent". Placeholders in the body are highlighted in the preview HTML; placeholders inside attributes (links) are left alone. |
| `backend/src/modules/email/email-templates.ts` | `getEmailTemplateLabel`: `agreement` → "Agreement", `document-resubmission` → "Resubmission request", `live-activation` → "Live activation", `mid-creation` → "Portal credentials", `user-password-invite` → "Password setup", `user-password-reset` → "Password reset"; anything else → "Case" |
| `backend/src/modules/email/resend-webhook.routes.ts` + `resend-webhook.service.ts` | `handleResendWebhookEvent`, plus `email-delivery-status.ts` (`applyEmailDeliveryStatus`, `UNDELIVERED_EMAIL_STATUSES`, `IN_FLIGHT_EMAIL_STATUSES`) |
| `backend/src/modules/cases/case-email-delivery.ts` | `getCaseEmailDelivery`, `assertCaseEmailDelivered`, `confirmCaseEmailDelivered`, `refreshStaleCaseEmailDelivery`; `STATUS_CHECK_AFTER_MS = 2 * 60 * 1000`, `STATUS_CHECK_INTERVAL_MS = 60 * 1000` |
| `backend/src/modules/cases/case-communication-helpers.ts` | `assertAutoEmailEnabled`, `assertManualEmailEnabled`, `resolveCaseEmailRecipients`, `resolveMerchantEmailRecipient`, `buildResubmissionEmailBody`, `buildMidCreationMessageBody`, `buildAgreementEmailBody`, `buildLiveActivationEmailBody` |

**Sending mode:** `getEmailSendingModeSettings` / `updateEmailSendingModeSettings` in `configuration.service.ts`, stored under the `configuration_settings` key `email-sending-mode`. Defaults: `{ autoEnabled: true, manualEnabled: true }`, with the rule that at least one must be enabled.

**Recipients:** `getEmailRecipientSettings` / `updateEmailRecipientSettings`, key `email-recipients`. Defaults: `{ ccSender: true, ccOtherMerchantEmail: true, cc: [], bcc: [], replyTo: [] }`. Rules: CC/BCC at most 20 addresses each, reply-to at most 5; addresses trimmed, lower-cased, max 254 characters; duplicates rejected; an address cannot be in both CC and BCC on save (`400 "<address> is already in CC."`, on the `bcc` path). Each address must be a valid email (`z.email()`, max 254), and a repeated address in one list gives `400 "Each address can only be listed once."`. Sending mode: `400 "At least one email sending mode must be enabled."`. With `EMAIL_TEST_TO` set, CC and BCC are dropped (kept in the log metadata) so test sends only reach the test inbox.

**Send-time recipients** (`resolveCaseEmailRecipients`, `case-communication-helpers.ts`): the To address is the submitter or business email per `recipientEmailType`; if that address is missing the send fails with `400 "No submitter email is on file for this merchant."` (or `business email`). CC order: the sending portal user (only if `ccSender`), the merchant's other address (only if `ccOtherMerchantEmail`), then the fixed `cc` list. BCC is the fixed `bcc` list. Any address equal to the To address, or already used earlier in the list, is dropped. Reply-to is the configured `replyTo` list, or `EMAIL_REPLY_TO` when that is empty. The same resolution feeds the manual preview, so the preview shows what the automatic send would use.

**Env** (from `backend/src/config/env.ts` — names only; values are secrets and were not read): `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_TEST_TO`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`.

## Data, validation and edge cases

### The six templates (catalogue in `email-template-catalog.ts`)

| Key | Group | Trigger (as written in the catalogue) | Subject |
|---|---|---|---|
| `document-resubmission` | case / Merchant | Agent rejects items in document review and sends the case back | Fixed subject `DOCUMENT_RESUBMISSION_EMAIL_SUBJECT` |
| `mid-creation` | case / Merchant | MID creation case is sent, giving the merchant their testing portal login | `midCreationEmailSubject(merchantName)` → "AssanPay merchant portal credentials for …" |
| `agreement` | case / Merchant | Agreement case is sent with the Final Agreement to sign | `agreementEmailSubject(merchantName)` → "AssanPay Agreement for …" |
| `live-activation` | case / Merchant | "The Live case is closed and the merchant account goes live" | `liveActivationEmailSubject(merchantName)` — "AssanPay account is live for …" |
| `user-password-invite` | account / Portal user | An admin creates a portal user | `userPasswordEmailSubject('invite')` → "Set up your AssanPay onboarding portal account" |
| `user-password-reset` | account / Portal user | The catalogue says "an admin sends a password reset from User Management", but the code allows only `super_admin` (single: `403 "Only Super Admins can send reset emails."`; bulk: `403 "Only Super Admins can send bulk reset emails."`, 1–100 users, `400 "Select between 1 and 100 users."`, sent 5 at a time) | `userPasswordEmailSubject('reset')` → "Reset your AssanPay onboarding portal password" |

Variables per template are listed in the catalogue (for example live-activation: `merchantName`, `merchantPortalUrl`, `method.label`, `method.liveMin`, `method.liveMax`, `method.commissionRate`; the MID template uses `method.testingMin` / `method.testingMax`). The per-method helper and the rendered rows do not show the commission rate, so treat `method.commissionRate` as listed but not printed. Password templates always send automatically through Resend — they have no manual path and no plain-text body.

### `email_log` (`backend/src/db/schema.ts`)

`id`, `toEmail` (varchar 255), `subject` (varchar 500), `template` (varchar 120), `caseId` (nullable, on delete set null), `merchantId` (nullable, on delete set null), `resendId` (varchar 255, nullable), `status`, `errorMsg`, `metadata` (JSONB), `ccEmails` / `bccEmails` / `replyTo` (text arrays, default `[]`), `statusDetail` (for example a bounce reason), `statusUpdatedAt`, `deliveryTracked` (boolean, default `false` — true only when the webhook secret was configured), `createdAt`, `updatedAt`. Migration `0082_email_delivery_tracking.sql` added the delivery tracking columns.

**Email status enum** `email_log_status`: `queued`, `sent`, `failed`, `delivered`, `delivery_delayed`, `bounced`, `complained`, `suppressed`.

| Case | What happens |
|---|---|
| **"Sent" does not mean delivered** | ⚠️ This is stated in three places (schema comment, `email.service.ts`, `apis/cases.md`). Any report or check that treats `sent` as delivered is wrong. |
| **Test inbox override** | When `EMAIL_TEST_TO` is set, the real recipient is replaced, CC/BCC are dropped, and the original addresses are kept in `metadata` (`originalTo`, `originalCc`, `originalBcc`, `overriddenTo`). A test send therefore never reaches a merchant — but it also means delivery tracking for a test send is meaningless. |
| **Idempotency** | Every send carries a Resend idempotency key (`idempotencyKey` in `sendEmail`). Verified formats: `live-activation/${caseId}` (`live-case.service.ts`); `mid-creation/${caseId}/${communicationId}` (`mid-case.service.ts`); `agreement/${caseId}/${details.updatedAt ms}` (`agreement-case.service.ts`); `resubmit/${caseId}/${tokenId}` (`case-documents-review.service.ts`); `user-password/${purpose}/${userId}/${expiresAt ms}` (`users.service.ts`). Consequence to check: the live key is the same for every live send on a case, so a second live-activation send for that case is keyed the same as the first. How Resend treats a reused key is not in the code reviewed. |
| **Invite send failure deletes the user** | `users.service.ts` (invite send, around line 540): if the invitation email fails, the new `users` row is deleted, so the email/username can be reused for a retry. |
| **Reset send failure keeps the old link** | `sendPasswordEmail` (`users.service.ts`): on `failed`, the new token is discarded and the call throws `502` with the provider's message; the user's previous link stays valid. Only a delivered link replaces it. |
| **Template drift** | Because the preview renders the real template, a template code change changes the preview automatically. There is no separate stored template text to go stale — but also no way for an admin to edit wording without a code change and a deploy. |
| **Password emails** | `user-password-invite`, `user-password-reset` are sent automatically and are not affected by the CC/BCC/recipient settings (configuration docs: "Staff password emails are not affected."). |
| **Catalogue note vs. rendered email** | The `mid-creation` catalogue note says the "Disbursement" fallback row uses the default testing limits and "payout rate"; the `live-activation` note says "default live limits". The rendered templates print only the PKR limit range on every row, and the fallback uses the configured limits, not the defaults. No commission rate appears in any rendered template, although `method.commissionRate` is listed as a catalogue variable. See file 25. |
| **Catalogue vs. runtime trigger wording** | The live-activation catalogue trigger says the email is sent when the Live case is closed, but the Live service sends it while the case is Working (see file 19). The same check should be applied to the other catalogue triggers before quoting them to the owner. |

## What to check — is this what you intended?

- [ ] **Editable templates?** Should admins be able to edit email wording in the portal, or is "templates change only by a code change and deploy" acceptable?
- [ ] **Live catalogue wording:** the live email's catalogue entry says it is sent when the Live case closes, but the code sends it before closing. Which is correct, and should the other catalogue triggers be checked the same way?
- [ ] **Delivery gate scope:** is the delivery gate (no successful close until the email is delivered) wanted for every case email, or only for some steps? Today it applies to the latest merchant email on any case.
- [ ] **Owner away:** when an email bounces, the owner is notified and the case is blocked. Who should act if the owner is away — should an admin be able to confirm delivery or re-send on their behalf?
- [ ] **Manual path scope:** should the manual (Gmail/WhatsApp) path stay available for every email, or only as a fallback when automatic sending fails? Today both can be enabled at once.
- [ ] **Test inbox:** is the test-inbox override (`EMAIL_TEST_TO`) still used, and who should be told when test mode is on so nobody mistakes a test send for a real one?
- [ ] **Owner confirmation:** the owner-confirmation path ("I checked on Resend") relies on the owner actually checking. Should confirmation require anything more — for example a Resend link or a note — or is the owner's word enough? (The code already limits it: only `bounced`, `complained` or `suppressed` emails that had CC addresses can be confirmed. A `failed` email, or one with no CC, cannot.)
- [ ] **Agreement status reads "failed":** an Agreement case's stored email status is shown as `failed` when its `email_log` row is undelivered (`agreement-email-status.ts`). Is that the wording the owner wants? (See file 15.)
- [ ] **Password reset rights:** the catalogue says "an admin" can send a reset, but the code allows only `super_admin`. Which is intended?
- [ ] **Invite failure:** if the invitation email fails, the new user is deleted. Should the account be kept so the admin can resend instead?

---
*Sources: `frontend/src/features/configuration/email-template-tabs.ts`, `frontend/src/features/configuration/panels/email-template-panel.tsx`, `frontend/src/features/configuration/panels/email-sending-settings-dialog.tsx`, `frontend/src/components/case-email/`, `frontend/src/apis/configuration.ts`, `frontend/src/apis/cases.ts`, `backend/src/modules/email/email.service.ts`, `backend/src/modules/email/email.client.ts`, `backend/src/modules/email/templates/`, `backend/src/modules/email/email-template-catalog.ts`, `backend/src/modules/email/email-templates.ts`, `backend/src/modules/email/resend-webhook.routes.ts`, `backend/src/modules/email/resend-webhook.service.ts`, `backend/src/modules/email/email-delivery-status.ts`, `backend/src/modules/cases/case-email-delivery.ts`, `backend/src/modules/cases/case-communication-helpers.ts`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/config/env.ts`, `backend/src/db/schema.ts`, `backend/src/modules/email/templates/user-password.tsx`, `backend/src/modules/cases/case-transition.service.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/modules/cases/agreement-email-status.ts`, `backend/src/modules/cases/live-case.service.ts`, `backend/src/modules/users/users.service.ts`, `backend/src/middleware/error-handler.ts`, `frontend/src/routes/_app.configuration.email-sending.tsx`, `frontend/src/features/configuration/email-templates-layout.tsx`. Related files: 15 (Agreement), 19 (Live Activation), 24 (notifications), 25 (Configuration).*
