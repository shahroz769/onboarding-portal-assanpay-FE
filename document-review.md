# Ignore
# Document Review Case - Complete Flow Plan

## Overview

Wire the existing `documents-review` field-review flow into a complete loop:

1. Owner takes ownership -> case goes `new -> working`
2. Owner reviews each field and adds rejection remarks
3. Owner clicks **Review** in the Resolution tab -> modal opens with the rejection summary and recipient email
4. Owner clicks **Confirm and send email** -> backend persists a resubmission round, sends the email, and then moves the case `working -> awaiting_client`
5. Email contains all rejection details plus a secure link to a partial onboarding form that shows only the rejected fields
6. Client submits updated info -> case moves `awaiting_client -> working`, owner gets an in-app notification
7. Owner sees an **Updated** badge next to each resubmitted field
8. Owner re-reviews -> if all good, clicks **Mark as successful** -> case `closed`
9. A **Rejection Rounds** card in the Resolution tab preserves history of all rounds

This iteration intentionally skips `pending` and `qc` for the `documents-review` case flow. Those stages will be implemented later.

---

## Workflow Decisions

| Concern | Decision |
|---------|----------|
| Email provider | **Resend** |
| Email template engine | **React Email** with React JSX runtime |
| React JSX runtime in Hono | Keep global Hono JSX config; use per-file `/** @jsxImportSource react */` for email templates |
| Stage modeling | Each case type can define its own stage details |
| `documents-review` stages in this iteration | `new -> working -> awaiting_client -> closed` |
| `pending` / `qc` | Explicitly skipped for now in `documents-review`; add later when that workflow is introduced |

---

## New Status: `awaiting_client`

Add `awaiting_client` to the `case_status` PostgreSQL enum.

For `documents-review`, add an `awaiting_client` queue stage between `working` and `closed`.

Important: `awaiting_client` should be a **case status** and a **queue stage slug/name**, but its stage category should stay within the current backend shape unless category modeling is intentionally expanded everywhere. Since this repo currently treats multiple statuses as part of one broader stage category, the safe option is:

- `case_status`: add `awaiting_client`
- `queue_stages.slug`: add `awaiting_client`
- `queue_stages.category`: keep it as `in_progress`

That avoids breaking helpers that currently assume stage categories are only:

- `new`
- `in_progress`
- `qc`
- `error`
- `closed`

Allowed transitions for this iteration:

- `working -> awaiting_client`
- `awaiting_client -> working`
- `working -> closed`

`pending` and `qc` transitions for `documents-review` are out of scope for now.

---

## Resubmission Link Security

| Property | Value |
|----------|-------|
| Mechanism | Random token stored in `case_resubmission_tokens` |
| Token bytes | 64 random bytes, base64url-encoded |
| Expiry | 7 days from issue |
| GET | Reusable until expiry |
| POST | Single-use; token is consumed only after a successful commit |
| After consumption | GET returns 410 Gone with a friendly "link already used" page |
| After expiry | GET returns 410 Gone with a friendly "link expired" page |

---

## Phase 1 - Backend (Hono)

### 1.1 Dependencies and Env

**`hono/package.json`** - add:

```json
"resend": "^6.9.2",
"react": "^19.x",
"react-dom": "^19.x",
"@react-email/components": "^0.5.x",
"@react-email/render": "^1.4.x"
```

Dev dependencies:

```json
"@types/react": "^19.x",
"@types/react-dom": "^19.x"
```

**`hono/src/config/env.ts`** - add:

```ts
RESEND_API_KEY: z.string().min(1).optional(),
EMAIL_FROM: z.string().min(1).default("Onboarding Portal <onboarding@resend.dev>"),
EMAIL_REPLY_TO: z.string().email().optional(),
PUBLIC_APP_URL: z.string().url().default("http://localhost:5173"),
RESUBMISSION_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
```

**`hono/tsconfig.json`**

Do **not** switch the whole backend to React JSX. Keep the existing Hono config.

For React Email template files only, use:

```ts
/** @jsxImportSource react */
```

That is the clean approach.

---

### 1.2 Drizzle Schema and Migration

New file:

`hono/drizzle/0008_resubmission_and_email.sql`

**Schema changes in `hono/src/db/schema.ts`:**

1. Enum additions:
   - `awaiting_client` on `case_status`
   - `case_resubmitted` on `notification_type`
   - new `email_log_status` enum: `queued | sent | failed`

2. New column:
   - `case_field_reviews.resubmitted_at` timestamp with timezone, nullable

3. New table `case_resubmission_tokens`:

```sql
id           uuid primary key
case_id      uuid not null references cases(id) on delete cascade
token        varchar(86) unique not null
expires_at   timestamptz not null
consumed_at  timestamptz null
created_by   uuid null references users(id) on delete set null
created_at   timestamptz not null default now()
```

Indexes:

- unique `(token)`
- index `(case_id)`

4. New table `email_log`:

```sql
id           uuid primary key
to_email     varchar(255) not null
subject      varchar(500) not null
template     varchar(120) not null
case_id      uuid null references cases(id) on delete set null
merchant_id  uuid null references merchants(id) on delete set null
resend_id    varchar(255) null
status       email_log_status not null default 'queued'
error_msg    text null
metadata     jsonb null
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()
```

Indexes:

- `(case_id)`
- `(status)`
- `(created_at)`

5. `documents-review` stage seed:
   - add `awaiting_client` stage between `working` and `closed`
   - do not seed `pending` / `qc` for this case type in this iteration if this queue is moving to case-specific stage definitions

If queue stages are now case-specific, update the seeding logic to stop assuming one universal stage list for every queue.

---

### 1.3 Email Module

**`hono/src/modules/email/email.client.ts`**

```ts
export const resendClient = new Resend(env.RESEND_API_KEY ?? "re_placeholder")
```

**`hono/src/modules/email/email.service.ts`**

```ts
sendEmail({
  to: string,
  subject: string,
  react: JSX.Element,
  template: string,
  caseId?: string,
  merchantId?: string,
  idempotencyKey: string,
  from?: string,
  replyTo?: string,
}): Promise<{
  status: "sent" | "failed"
  resendId?: string
  emailLogId: string
  error?: string
}>
```

Rules:

- render the React element to HTML using `@react-email/render`
- call `resend.emails.send()` with the idempotency key
- always create an `email_log` row before the external call
- update that same log row after the external call
- return a failure result instead of throwing on provider errors

**`hono/src/modules/email/templates/document-resubmission.tsx`**

Put `/** @jsxImportSource react */` at the top of the file.

Props:

```ts
{
  caseNumber: string
  merchantName: string
  ownerName: string
  rejections: Array<{ label: string; remarks: string | null }>
  resubmissionUrl: string
  expiresAt: string
}
```

Layout:

- branded header
- greeting
- "we reviewed your application" message
- rejection list with remarks
- primary CTA button
- expiry notice
- footer

---

### 1.4 Token Service

**`hono/src/modules/cases/case-resubmission-tokens.service.ts`**

```ts
issueToken(caseId: string, createdByUserId: string): Promise<{
  token: string
  expiresAt: Date
  tokenId: string
}>

validateToken(token: string): Promise<{
  caseId: string
  tokenId: string
  expiresAt: Date
}>

consumeToken(tokenId: string): Promise<void>
```

Validation behavior:

- throw 404 if token does not exist
- throw 410 if token is expired
- throw 410 if token is already consumed

Token generation:

```ts
Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString("base64url")
```

---

### 1.5 Case Workflow Extensions

**New endpoint: `POST /api/cases/:id/send-for-resubmission`**

Auth required, owner-only.

Flow:

1. Load case
   - must be `documents-review`
   - must be `working`
   - current user must be owner
2. Load rejected `case_field_reviews`
   - at least one required
3. Load `merchants.submitterEmail`
   - required
4. Issue token
5. Map rejected field names to human labels via `field-labels.ts`
6. In a DB transaction, create a new resubmission round record:
   - insert `email_log` with status `queued`
   - insert `case_history` with action `resubmission_email_queued`
   - persist the token row
7. Call `email.service.sendEmail()`
8. In a second DB transaction:
   - if email send failed:
     - update `email_log` to `failed`
     - leave case in `working`
     - keep the token unusable until a fresh round is created, or explicitly invalidate it now
     - record `case_history` action `resubmission_email_failed`
     - return a failure response
   - if email send succeeded:
     - update case to `awaiting_client`
     - set `current_stage_id` to the `awaiting_client` stage
     - update `email_log` to `sent`
     - insert `case_history` action `resubmission_email_sent` with `{ tokenId, expiresAt, rejectedFields, emailLogId, recipient }`
9. Return:

```ts
{
  tokenExpiresAt: string
  emailLogId: string
  status: "sent" | "failed"
}
```

Important:

- do not move the case to `awaiting_client` unless the email send succeeded
- do not leave a valid client round that the case history/status does not reflect

**New file: `hono/src/modules/cases/field-labels.ts`**

Do not copy labels from multiple frontend files manually. Define one stable backend mapping for:

- merchant field keys
- document field keys

It should align with existing frontend review labels, but the backend must not depend on importing frontend files.

---

### 1.6 Public Resubmission Routes

**New file: `hono/src/modules/merchants/public-resubmission.routes.ts`**

`GET /api/public/resubmission/:token`

- validate token
- load case, merchant, and rejected `case_field_reviews`
- load current document rows for rejected document fields
- return:

```ts
{
  caseNumber: string
  expiresAt: string
  merchantName: string
  rejections: Array<{
    fieldName: string
    label: string
    remarks: string | null
    isDocument: boolean
    currentValue?: string
    currentDocumentName?: string
  }>
}
```

`POST /api/public/resubmission/:token`

- validate token
- parse multipart `FormData`
- whitelist accepted field names against the current rejected field set
- reject extra fields with 400

For each accepted field:

- text field -> update `merchants`
- document field -> upload file and upsert `merchant_documents`
- set `case_field_reviews.resubmitted_at = now()`
- keep field review `status = 'rejected'` until owner re-reviews

Atomicity rule:

- external uploads and DB updates cannot be treated as one real transaction
- the implementation must make the handler idempotent and compensate for partial failure

Safe execution order:

1. Validate token and build the allowed field set
2. Upload files first and collect uploaded metadata
3. Run a DB transaction that:
   - applies merchant field updates
   - applies document row updates
   - stamps `resubmitted_at`
   - consumes token
   - moves case to `working`
   - sets `current_stage_id` to the `working` stage
   - records `case_history` action `client_resubmitted`
4. If DB commit fails after external upload:
   - log the failure
   - do not consume the token
   - either clean up the uploaded file or mark it orphaned for reconciliation

After successful commit:

- fire `case_resubmitted` notification to the case owner as best-effort
- return `{ success: true }`

Mount in **`hono/src/index.ts`**:

```ts
import { resubmissionRoutes } from "./modules/merchants/public-resubmission.routes"

app.route("/api/public/resubmission", resubmissionRoutes)
```

---

### 1.7 Notifications

**`hono/src/modules/notifications/notifications.schemas.ts`**

Add `"case_resubmitted"` to `notificationTypeValues`.

**`hono/src/modules/notifications/notifications.copy.ts`**

Add:

```ts
case "case_resubmitted":
  return {
    title: `Case ${input.caseNumber} - client submitted updated details`,
    body: `${input.clientName ?? "The client"} resubmitted ${input.fieldCount} field(s) for your review.`,
  }
```

---

## Phase 2 - Frontend: Review Modal and Owner UX

### 2.1 Schema and API Updates

**`src/schemas/cases.schema.ts`**

- add `'awaiting_client'` to `CASE_STATUSES`
- add `'awaiting_client'` to `CASE_STATUS_LABELS`
- add `resubmittedAt: z.string().nullable()` to `fieldReviewSchema`
- do **not** add `awaiting_client` to `STAGE_CATEGORIES` if backend categories remain unchanged

**`src/apis/cases.ts`**

Add:

```ts
export async function sendForResubmission(caseId: string): Promise<{
  tokenExpiresAt: string
  emailLogId: string
  status: "sent" | "failed"
}>
```

Target:

`POST /api/cases/${caseId}/send-for-resubmission`

**`src/schemas/notifications.schema.ts`**

Add `'case_resubmitted'` to the notification type union.

---

### 2.2 Hook

**New: `src/hooks/use-send-for-resubmission.ts`**

Use `useMutation` around `sendForResubmission()`.

Behavior:

- on success with `status === "sent"`:
  - invalidate case detail
  - invalidate case history
  - toast success
- on success with `status === "failed"`:
  - toast failure
- on error:
  - toast failure

---

### 2.3 Review Summary Modal

**New: `src/features/cases/case-detail/documents-review-summary-modal.tsx`**

Compound component using shadcn `Dialog`.

Structure:

```tsx
<Dialog open onOpenChange>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Review Summary</DialogTitle>
      <DialogDescription>
        Review the rejected fields before sending the client email.
      </DialogDescription>
    </DialogHeader>

    <ScrollArea>
      <RecipientPreview email={...} />
      <RejectionsList rejections={[...]} />
      <EmptyState />
    </ScrollArea>

    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={handleConfirm} disabled={noRejections || noSubmitterEmail || isPending}>
        Confirm and send email
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Notes:

- keep small subcomponents instead of boolean-heavy props
- source labels from the same review summary data already used by the current document review UI

---

### 2.4 Side Panel Changes

**`src/features/cases/case-detail/case-side-panel.tsx`**

Add a new primary-action branch for `status === "awaiting_client"`:

```ts
{
  title: "Awaiting client",
  description: "An email was sent to the client with a resubmission link. The case will return to Working once they submit.",
  actionLabel: null,
  actionKind: "awaiting-client",
}
```

Resolution tab behavior:

- when `actionKind === "review"`, clicking **Review** opens `DocumentsReviewSummaryModal`
- when `actionKind === "awaiting-client"`, show an informational `Alert` with the expiry date from the latest `resubmission_email_sent` history entry

Remove the old assumption that Review means "approve all and save". In this workflow, Review becomes "final review before sending the resubmission email".

---

### 2.5 Rejection Rounds Card

**New: `src/features/cases/case-detail/rejection-rounds-card.tsx`**

Data source:

- use the existing case history query, not `caseDetail`
- no new backend endpoint required if history details are rich enough

Grouping rules:

- each `resubmission_email_sent` starts a round
- pair it with the next `client_resubmitted` if present

Render as a `Card` with a `Collapsible` per round.

Example:

```text
Round 1 - Apr 20, 2026
Sent to: submitter@email.com
Rejected fields:
- Business Name - "Name doesn't match NTN"
- Owner CNIC Front - "Image is blurry"
Client submitted: Apr 21, 2026
Updated: Business Name, Owner CNIC Front
```

---

### 2.6 Updated Badge

**`src/features/cases/case-detail/renderers/documents-review-renderer.tsx`**

Next to the Reject badge for each field row, render:

```tsx
{fieldReview?.resubmittedAt &&
 (!fieldReview.updatedAt || fieldReview.resubmittedAt > fieldReview.updatedAt) ? (
  <Badge variant="secondary" className="text-xs">Updated</Badge>
) : null}
```

Tooltip copy:

```ts
`Client updated this field on ${formatDate(fieldReview.resubmittedAt)}`
```

Important:

- use the saved `fieldReviews` data from the backend, not only the local draft state
- make sure document review item keys still map correctly to backend `field_name` values

---

### 2.7 Notification Support

**`src/features/notifications/notification-target.ts`**

Keep mapping `case_resubmitted` to:

`/cases/$caseId`

That file already resolves case-linked notifications generically, so only update it if the current logic becomes type-specific.

**`src/features/notifications/` display**

Use the same copy as backend notification copy.

---

## Phase 3 - Frontend: Public Resubmission Form

### 3.1 New Route

**New: `src/routes/onboarding-form.resubmit.$token.tsx`**

Path:

`/onboarding-form/resubmit/$token`

Behavior:

- public route, no auth
- loader fetches resubmission context using TanStack Query
- on 404 or 410, render `TokenExpiredScreen`
- on success, render `ResubmissionForm`

This route shape matches the current TanStack Router file-route convention already used in the repo.

---

### 3.2 Resubmission Form

**New: `src/features/onboarding/resubmission-form.tsx`**

Render only the rejected fields from loader data.

For each rejected field:

- show the field label
- show rejection remarks in a destructive `Alert`
- prefill the current value for text fields
- show current document name plus replace-file upload for document fields

Validation:

- build a Zod schema dynamically from the rejected field list
- derive field-level rules from the existing merchant onboarding schema where possible

Submit:

`POST /api/public/resubmission/:token`

Success state:

- replace the form with a success state
- do not keep the form interactive after success

---

### 3.3 API Functions

**`src/apis/merchant-onboarding.ts`**

Add:

```ts
fetchResubmissionContext(token: string): Promise<ResubmissionContext>
submitResubmission(token: string, formData: FormData): Promise<{ success: boolean }>
```

Add TanStack Query helpers:

```ts
resubmissionContextQueryOptions(token: string)
useSubmitResubmissionMutation(token: string)
```

---

## Phase 4 - Polish

1. Add `awaiting_client` to frontend stage-progress display if that component uses status-derived styling
2. Add `awaiting_client` badge color and label to case list status badges
3. Run `bunx drizzle-kit generate` in `hono/`
4. Type-check backend with `bunx tsc --noEmit` in `hono/`
5. Type-check frontend with `bunx tsc --noEmit` in the project root
6. Lint both

Do not run the backend server.

---

## New Files Summary

| File | Type | Purpose |
|------|------|---------|
| `hono/src/config/env.ts` | edit | Add Resend and public URL env vars |
| `hono/src/db/schema.ts` | edit | New tables, enum values, and `resubmitted_at` |
| `hono/drizzle/0008_resubmission_and_email.sql` | new | Migration |
| `hono/src/modules/email/email.client.ts` | new | Resend singleton |
| `hono/src/modules/email/email.service.ts` | new | Email send and logging |
| `hono/src/modules/email/templates/document-resubmission.tsx` | new | React Email template |
| `hono/src/modules/cases/case-resubmission-tokens.service.ts` | new | Token issue, validate, consume |
| `hono/src/modules/cases/field-labels.ts` | new | Stable backend field label map |
| `hono/src/modules/cases/cases.schemas.ts` | edit | Add `awaiting_client` status support |
| `hono/src/modules/cases/cases.service.ts` | edit | Add resubmission workflow |
| `hono/src/modules/cases/cases.routes.ts` | edit | Mount new endpoint |
| `hono/src/modules/merchants/public-resubmission.routes.ts` | new | Public token GET/POST |
| `hono/src/modules/merchants/merchants.service.ts` | edit | Reuse upload helpers |
| `hono/src/modules/notifications/notifications.schemas.ts` | edit | Add `case_resubmitted` |
| `hono/src/modules/notifications/notifications.copy.ts` | edit | Add notification copy |
| `hono/src/index.ts` | edit | Mount resubmission routes |
| `src/schemas/cases.schema.ts` | edit | Add `awaiting_client` and `resubmittedAt` |
| `src/schemas/notifications.schema.ts` | edit | Add `case_resubmitted` |
| `src/apis/cases.ts` | edit | Add `sendForResubmission()` |
| `src/apis/merchant-onboarding.ts` | edit | Add resubmission API functions |
| `src/hooks/use-send-for-resubmission.ts` | new | Mutation hook |
| `src/features/cases/case-detail/documents-review-summary-modal.tsx` | new | Review and send modal |
| `src/features/cases/case-detail/rejection-rounds-card.tsx` | new | Round history UI |
| `src/features/cases/case-detail/case-side-panel.tsx` | edit | New status branch and modal wiring |
| `src/features/cases/case-detail/renderers/documents-review-renderer.tsx` | edit | Updated badge |
| `src/features/onboarding/resubmission-form.tsx` | new | Partial onboarding form |
| `src/routes/onboarding-form.resubmit.$token.tsx` | new | Public resubmission route |

---

## Verification Checklist

- [ ] `bunx tsc --noEmit` passes in `hono/`
- [ ] `bunx drizzle-kit generate` produces only intended schema changes
- [ ] `bunx tsc --noEmit` passes in the project root
- [ ] frontend lint passes
- [ ] backend lint passes if configured
- [ ] happy path: review -> send email -> open token -> resubmit -> owner sees updated badges -> case returns to working -> owner closes successfully
- [ ] negative: no rejected fields -> send action blocked in UI and rejected by backend
- [ ] negative: missing submitter email -> send action blocked or backend 400
- [ ] negative: expired token -> 410
- [ ] negative: consumed token -> 410
- [ ] negative: extra POST fields -> 400
- [ ] negative: double-click send -> idempotency prevents duplicate provider sends
- [ ] failure path: email provider error -> case stays `working`
- [ ] failure path: upload succeeds but DB commit fails -> token is not consumed and failure is recoverable
- [ ] second round works and appears in Rejection Rounds

---

## Out of Scope

- `pending` and `qc` for `documents-review`
- per-case-type `from` address routing beyond a flexible service signature
- Resend webhook ingestion for delivery events
- email localization
- editing a sent round in place instead of creating a new round
