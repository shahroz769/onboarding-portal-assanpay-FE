# 06 — Resubmission Flow

## At a glance

| | |
|---|---|
| **What it is** | How a merchant fixes rejected fields through a one-use email link, without starting over. Staff reject just the wrong fields; the merchant fixes exactly those fields and submits. The case then goes back to the reviewer. |
| **Who can use it** | The merchant, with no login — whoever holds the link can use it. Staff create the request by rejecting fields in Documents Review; they do not fill in this form. |
| **Where it lives** | `/onboarding-form/resubmit/:token` (public, no login) |
| **Main API** | `GET /api/public/resubmission/:token` (load the context) · `POST /api/public/resubmission/:token` (submit the fixes) |
| **Main code** | Frontend: `src/features/onboarding/resubmission-form.tsx` (1,039 lines) · Backend: `src/modules/merchants/public-resubmission.routes.ts`, `src/modules/cases/case-resubmission-tokens.service.ts` |
| **Success looks like** | Merchant sees a success screen with the case number, the case goes back to `working`, and the case owner is notified in-app. |

## How it works — the journey

```
Reviewer rejects fields in Documents Review → case moves to awaiting_merchant
        ↓
System issues a resubmission token → emails link to submitter email
        ↓
Merchant opens /onboarding-form/resubmit/<token> → sees only the rejected fields
        ↓
Merchant fixes EVERY rejected field in one sitting (no draft, no partial save)
        ↓
Submits → backend re-checks everything under a lock, consumes the token,
          updates the merchant, records the new documents
        ↓
Case moves back to working (if it was awaiting_merchant) · owner notified
        ↓
Reviewer reviews again — if still wrong, a new link is issued and the old one is superseded
```

## Who can use it

| Who | Rule |
|---|---|
| **The merchant, with no login** | The resubmission page is public at `/onboarding-form/resubmit/:token`. Whoever holds the link can use it — that is the point, and also the risk: the link is the only protection. The link is a long random token, stored only as a hash, and it stops working after one successful use. |
| **Staff** | Do not fill in this form. Staff create the resubmission request from inside the Documents Review case (by rejecting fields — see file 13), and the system emails the link to the merchant's submitter email. Staff can also see the link state (whether it was delivered, used, superseded, or invalidated) from the case. |
| **Nobody else** | The link only works while its case is still open and its merchant is neither terminated nor deleted. Closing the case, terminating the merchant, or issuing a newer link kills the old one. |

## The steps

| Step | What happens |
|---|---|
| 1. Rejection | A reviewer rejects one or more fields in the Documents Review case and the case moves to `awaiting_merchant`. The system issues a resubmission token for that case and emails the merchant a link to `/onboarding-form/resubmit/<token>`. (How the email is composed and sent is covered in files 13 and 23.) The owner can also get the email as a preview (`getResubmissionEmailPreview`) and confirm it was sent by hand (`confirmResubmissionEmailManual`), in `backend/src/modules/cases/case-communications.service.ts`. Only the case owner can send for resubmission (403 "Only the case owner can send for resubmission."), and only in the working or awaiting-merchant stage. |
| 2. Opening the link | The merchant opens the link. The page first loads the resubmission context: the case number, the merchant name, the owner's name, and the list of rejected fields — each with its label, the reviewer's remarks, whether it is a document, whether it is required, and its current value or current document name and link. |
| 3. Bad link | If the link is bad, already used, replaced, or no longer active, the page explains which one it is instead of showing the form. The API returns: `404` "Resubmission link not found." (unknown token); `410` "This resubmission link has already been used." (consumed by a submission); `410` "This resubmission link is no longer active." (superseded, invalidated, the case is closed, or the merchant is terminated or deleted). There is no "expired" state: links never expire (see Tokens). Malformed tokens are rejected in the browser before any request is made. |
| 4. Fixing | The merchant fixes **every** rejected field — all of them are required in the resubmission, not just some (see the table below). |
| 5. Submit | The merchant submits. The backend re-checks everything under a lock: the merchant and the case are locked, the token is consumed in the same database transaction as the changes, and only then are the merchant's fields updated, the replacement documents recorded, removed documents removed, and the case history written. If anything fails, the token stays usable. |
| 6. Case moves back | If the case was waiting on the merchant (`awaiting_merchant`), it moves back to `working` at the queue's `working` stage. If the case had meanwhile gone back to `new` (unassigned), its status is left alone — it must never become `working` without an owner. |
| 7. Notify + success | The case owner (if there is one) is notified in-app that the merchant resubmitted, with how many fields changed. The old Drive files are marked superseded. The merchant sees a success screen with the case number. |
| 8. Repeat | The reviewer reviews the resubmitted fields. If something is still wrong, the cycle repeats: a new link is issued for the new rejection round, and the old link is superseded. |

## How each rejected field is fixed

| Field type | What the merchant does |
|---|---|
| **Text field** | Type the corrected value. The form validates it the same way the original form did. Unchanged stored values are also re-checked against the current rules, so an old value that now breaks a rule can block the resubmission. The exception is an unchanged website, which uses a lenient stored-value rule; a changed website is checked against the current public-URL rule. |
| **Required document** | Choose "Replace" and upload a new file. It goes through the same checks as the original upload (10 MB max, 500 bytes min, PDF/JPG/PNG/WEBP, extension agrees with declared type, content signature matches). It cannot be removed. |
| **Optional document** | Choose "Replace" (upload a new file) or "Remove" (the document is taken out of the submission). It cannot be both uploaded and removed at once. |

## Tokens — the rules

| Rule | Detail |
|---|---|
| **Never expire** | Resubmission links never expire. The service comment says so explicitly: a link stays valid until it is used or a newer one replaces it. There is no expiry timestamp on the table. (This is different from password links, which expire after 24/72 hours — see file 02.) See file 32, gap 5. |
| **Two kinds of link** | `delivered` is the link the merchant actually receives (the automatic email, or a regenerated link the owner shares); it sets `deliveredAt`. `pending` is an email preview the owner sends by hand; `deliveredAt` stays null until the owner confirms the send (`markResubmissionTokenDelivered`, which then returns `409 "This email preview is no longer valid. Load the preview again."` for a stale preview). Issuing a `delivered` link consumes every active link of the case as `superseded`; issuing a `pending` preview consumes only older previews, so the link the merchant already has keeps working. |
| **One active link per case per kind** | A unique index (`case_resubmission_tokens_one_active_per_case_kind_idx`, `caseResubmissionTokensOneActivePerCaseKindIdx` in `backend/src/db/schema.ts`) allows at most one active delivered link and one active pending link per case. Migration `0106_resubmission_token_consumed_reason.sql` adds the consumed-reason rules. |
| **Staff revocation of previews** | When a case is reassigned (`case-assignment.service.ts`, reason `case_reassigned`), or a user is deactivated or has their role or queue access changed (`users.service.ts`, reasons `user_deactivated` / `user_access_changed`), unsent `pending` previews are consumed as `invalidated` and a `resubmission_link_revoked` history entry is written. Delivered links are left alone. |
| **Closing or terminating** | Closing a case (`case-transition.service.ts`) and terminating a merchant (`merchants.service.ts`) consume every active link of the affected cases as `invalidated` (`consumeOpenResubmissionTokens`). |
| **Stored as a hash** | Table `case_resubmission_tokens` (`backend/src/db/schema.ts`): `id`, `caseId` (references `cases.id`, on delete cascade), `tokenHash` (varchar 64, unique — the raw token is never stored), `consumedAt`, `consumedReason` (`used`, `superseded`, `invalidated`), `deliveredAt` (null while the link is only an email preview; set once it reaches the merchant — sent, confirmed manually, or regenerated for sharing), `createdBy`, `createdAt`. |
| **Validation** | `validateToken()` hashes the presented token, finds the row, then: unknown token → 404 "Resubmission link not found."; already consumed → 410, with "This resubmission link has already been used." (reason `used`, or a legacy row with no reason) or "This resubmission link is no longer active." (reasons `superseded` / `invalidated`); case closed, merchant terminated, or merchant deleted → 410 with the inactive message (`assertResubmissionTargetOpen()`). |
| **Consumption is atomic** | `consumeResubmissionTokens()` is the only writer of `consumedAt`, and it only consumes rows where `consumedAt` is null. The POST handler consumes the token in the same transaction as the merchant update, the document records, and the history entry — so a failed submission leaves the token usable, and of two concurrent submissions only the one that atomically consumes the token can commit. After consuming, it also consumes any legacy sibling tokens for the case as `superseded`. Closing a case consumes its open tokens as `invalidated` (`consumeOpenResubmissionTokens()`); terminating a merchant does the same for its cases' tokens (see file 09). |

> ⚠️ **No expiry means an old link is dangerous if it leaks.** A link emailed months ago still works if the case is still open and no newer link replaced it. The mitigation in the code is the one-active-link rule and the fact that any new rejection round supersedes the old link — but a link that was never superseded stays live indefinitely. See the questions below.

## Endpoints

| Endpoint | What it does |
|---|---|
| `GET /api/public/resubmission/:token` | `validateToken()` then `getResubmissionContext(caseId)` (from `backend/src/modules/cases/case-documents-review.service.ts`). Returns `{ caseNumber, merchantName, merchantOwnerName, rejections: [...] }`. Text rows carry `fieldName`, `label`, `remarks`, `isDocument: false` and `currentValue`. Document rows carry `fieldName`, `label`, `remarks`, `isDocument: true`, `isRequired`, `currentDocumentName`, `documentType` and `currentDocumentUrl` (the Google Drive web view link; see file 32, gap 7). No row ids or user ids are returned. |
| `POST /api/public/resubmission/:token` | The full flow below. Returns `{ success: true, caseNumber }`. |

Routes live in `backend/src/modules/merchants/public-resubmission.routes.ts`, mounted at `/api/public/resubmission` in `backend/src/index.ts`, behind the public rate limiter and the 225 MB multipart limit. Token logic lives in `backend/src/modules/cases/case-resubmission-tokens.service.ts`.

## POST handling, in order

| Step | What happens |
|---|---|
| 1. Validate the token | See the token table above. |
| 2. Load case + merchant | Load the case + merchant row and the rejected field reviews (`case_field_reviews` where `status = 'rejected'`). If there are no rejected fields, 400 "There are no rejected fields to update." |
| 3. Accept only rejected fields | Any other field gives 400 `Field "x" is not pending resubmission.`; a document action for a field that is not pending gives `Field "x" is not pending document resubmission.`. A document action must be `replace` or `remove` (otherwise `Document action for "x" is invalid.`). Document fields must be files (`Expected file upload for "x".`), each sent once (`Document "x" must be uploaded once.`). Text fields must be strings (`Field "x" must be a text value.`) and known merchant fields (`Unknown merchant field "x".`). |
| 4. Every rejected field must be present | A text field left out gives 400 `Field "x" is required in this resubmission.`. A document with no action gives `Document "x" must be resubmitted.`. A required document must be `replace` (400 "<label> must be uploaded again."); a `replace` needs a real file (size > 0, otherwise the same message) that passes the same checks as the original upload (file 05, including the 413 for files over 10 MB). A `remove` with a file gives 400 `Document "x" cannot be uploaded and removed together.`. A document type the merchant type does not allow gives 400 `Document "<type>" is not allowed for this business type.`. |
| 5. Re-validate stored values | A changed website is checked against the current public-URL rule; all stored merchant values (submitted ones plus unchanged ones from the database) are re-validated with `validateStoredMerchantScalarValues()`. The document rules in step 4 use the merchant type **stored before this submission**, even if the submission changes it (see the warning below). |
| 6. Upload replacements first | Replacement files are uploaded to Drive first, into a new attempt folder: the parent path is `KYC Documents / Pending Review / <folder name>`, where the folder name is `getSubmissionFolderName(n)` and `n` is the number of earlier `client_resubmitted` history entries + 2. The first resubmission is therefore `Second Submission`, the second `Third Submission`, and so on. Inside it is a folder named `Attempt <random UUID>`. Each file is recorded in the storage ledger as `provisioning`, and is named `<documentType><extension>`. |
| 7. One transaction | Inside one transaction: lock the merchant then the case (same order as termination, so the two cannot deadlock); re-check the case is open and the merchant is alive; consume the token; update the merchant row; `recordMerchantResubmission()` (replaces documents, removes removed ones, marks the resubmitted reviews); move the case to `working` only if it was `awaiting_merchant`; write a `client_resubmitted` history entry (no actor, because the merchant is anonymous) with the full field details (labels, previous/submitted values, previous/next file names and URLs, rejection reasons, document actions); mark the attempt's storage objects `current`. |
| 8. After commit | Supersede the old Drive files (for replaced and for removed documents) and, if the case has an owner, notify that owner with the number of fields in this resubmission (`notifyOnResubmission`). On any failure before commit, the attempt's Drive objects are cleaned up (`cleanupFailedAttemptObjects()`), and a failure of the notification or of that cleanup is only logged or swallowed. The cleanup is an after-the-fact step, not part of the transaction (see file 32, gap 10). |

## What "resubmitted" means in the case

`recordMerchantResubmission()` lives in `backend/src/modules/cases/document-review-state.ts`; the case-history entry and the review-state updates are the audit trail the reviewer sees. The document rows' statuses are reset by migration `0107_reset_resubmitted_document_status`.

## Frontend — how the page is built

| Piece | What it does |
|---|---|
| **Route** | `frontend/src/routes/onboarding-form.resubmit.$token.tsx` — parses the token with `parseTokenParam` (malformed tokens render a "Link not found" screen without any request), loads the context with `resubmissionContextQueryOptions(token)` (no loader, so a failed token request is not fetched twice), and renders loading, error, and form states itself. The error screen distinguishes 404 from 410 and, for 410, reads the server message to decide between "already used" and "no longer active"; any other 410 text falls back to "This link was already used or replaced" with the server message. The "expired" branch is never reached because the backend sends no expiry message. |
| **Form** | `frontend/src/features/onboarding/resubmission-form.tsx` (1,039 lines) — renders each rejection with its label, a "Required"/"Optional" marker, and the reviewer's remarks ("Please update this field." / "Please upload an updated document." when there are none). Document rows have Replace/Remove buttons; a required document starts with action `replace` pre-selected, an optional one with no action selected. Client-side checks: a text field is required; a document needs an action; `replace` needs a file; `remove` is only offered for optional documents. The form warns "Complete resubmission required" — every rejected field must be re-uploaded or removed before submitting. |
| **API calls** | `frontend/src/apis/merchant-onboarding.ts`: `fetchResubmissionContext(token)` (`GET /api/public/resubmission/:token`); `submitResubmission(token, formData)` posts `multipart/form-data` to the same path and returns `{ success: true, caseNumber }`. The mutation does not retry and invalidates the resubmission-context query on success. |

## Data, validation and edge cases

- **Only rejected fields can change.** The allowed set is exactly the `case_field_reviews` rows with `status = 'rejected'` for that case. A merchant cannot use a resubmission link to change a field that was approved or never reviewed. A document that is not allowed for the merchant type on file is refused ("Document … is not allowed for this business type.").
- **⚠️ Merchant type can change without the document rules following it.** "Business Type" (`merchantType`) is a rejectable text field (`MERCHANT_FIELD_LABELS`). If it is rejected, the merchant can submit a different type. Step 5 validates the new values, and step 7 saves `merchantType` on the merchant row. But the document checks (allowed and required types, step 4) use the **stored** type from before the submission, so the required documents of the new type are never checked. The code review found no check that blocks or re-checks this. Confirm the intended rule, and see file 32 for the open finding.
- **All or nothing.** Every rejected field must be answered in one submission. There is no partial save and no draft: closing the page loses the work. (The frontend keeps the in-progress choices in component state only; no `localStorage` draft was found for resubmission in the files reviewed.)
- **One link, one use, but uploads can race.** Two browsers submitting the same link at once both upload into isolated attempt folders; only one consumes the token and commits. The loser's files are cleaned up as a failed attempt.
- **A link can die while the form is open.** If the case closes or the merchant is terminated while the merchant is filling the form (or while files are uploading), the final transaction re-checks under lock and fails with 410 "This resubmission link is no longer active." — after the files were already uploaded. The failed-attempt cleanup removes those files.
- **The merchant never sees their case.** The resubmission context contains only the case number, merchant/owner names, and the rejected fields. No case status, queue, comments, or other merchants' data are exposed.
- **Notification is best-effort.** If notifying the case owner fails, the resubmission still succeeds — the failure is caught and ignored.
- **A Drive-superseding error after commit is reported as a failure.** In `public-resubmission.routes.ts`, `supersedeStorageObjects()` runs after the database transaction has committed, inside the same `try` block as the upload. Its only guard is the outer `catch`, which runs failed-attempt cleanup and rethrows. So if that call throws, the merchant gets an error even though the resubmission was saved. The notification call, by contrast, is wrapped in its own `try`. (Found from the code reviewed; not reproduced at runtime.) A resubmission on a case with no owner sends no notification at all.
- **The browser keeps nothing.** `resubmission-form.tsx` makes no `localStorage` or `sessionStorage` calls; the in-progress choices live in component state only.
- **Not found in the code reviewed:** a way for staff to see how many resubmission rounds a case has had other than counting `client_resubmitted` history entries (the submission index is derived from that count: `previousResubmissions + 2`); a way for staff to revoke a single delivered link without issuing a new one or closing the case; any expiry or reminder for links that sit unused.

## What to check — is this what you intended?

- [ ] Resubmission links never expire. Should they — for example, 7 or 14 days — so an old link found in an inbox cannot be used months later? Or is "valid until used or replaced" the right rule?
- [ ] Should a merchant be able to save a half-finished resubmission and come back, or is "finish it in one sitting" acceptable?
- [ ] When a case is rejected a second time, should the merchant see what they submitted last time and why it failed again, or only the latest rejection notes?
- [ ] Is it right that an optional document can be removed entirely in resubmission — could that let a merchant drop a document the business actually needs, just because it was marked optional?
- [ ] Should the merchant get an email confirmation after a successful resubmission, or is the on-screen success message enough?

---
*Sources: `frontend/src/routes/onboarding-form.resubmit.$token.tsx`, `frontend/src/features/onboarding/resubmission-form.tsx`, `frontend/src/apis/merchant-onboarding.ts`, `backend/src/modules/merchants/public-resubmission.routes.ts`, `backend/src/modules/cases/case-resubmission-tokens.service.ts`, `backend/src/modules/cases/case-documents-review.service.ts`, `backend/src/modules/cases/document-review-state.ts`, `backend/src/db/schema.ts`, `backend/src/index.ts`, `backend/src/modules/cases/case-communications.service.ts`, `backend/src/modules/cases/case-assignment.service.ts`, `backend/src/modules/cases/case-transition.service.ts`, `backend/src/modules/cases/field-labels.ts`, `backend/src/modules/users/users.service.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchants.schemas.ts`, `backend/src/lib/storage/file-signatures.ts`, `backend/drizzle/0106_resubmission_token_consumed_reason.sql`, `backend/drizzle/0107_reset_resubmitted_document_status.sql`. Related files: 04 (public form), 05 (documents), 13 (Document Review), 23 (email), 09 (termination).*
