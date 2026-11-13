# 14 — Sub-Merchant Form Workflow

## At a glance

| | |
|---|---|
| **What it is** | Some merchants onboard under an "EP" (eligible partner) arrangement where each of their sub-merchants — for example individual partner brands or outlets — needs its own filled form sent to the partner. The Sub-Merchant Form workflow is that job, one case per sub-merchant. The owner opens the draft form that AssanPay prepared for that sub-merchant, completes it, uploads the finished form, and then sends it to the partner by email — manually, from Gmail — and proves it was sent by uploading a screenshot of the sent mail. The case can only close once the form is uploaded and the sent-mail proof is saved. |
| **Who can use it** | Working the case: only the case owner, with `work` access to this queue. Triggering a case: super admin, admin, or an agent with working access to an EP queue (`canManageEpCases`). |
| **Where it lives** | Case detail page, for an EP Sub-Merchant Form case (`/cases/:caseId`). Triggering happens from the EP Sub-Merchants page (`/cases/ep-sub-merchants`). |
| **What it creates** | One EP case per sub-merchant, holding the uploaded Final Form and the sent-email screenshot proof. |
| **Main APIs** | `GET /api/cases/ep-sub-merchant/merchants` · `POST /api/cases/ep-sub-merchant/trigger` · `PUT /api/cases/:id/sub-merchant-form/selection` · `POST /api/cases/:id/sub-merchant-form/final-form` · `POST /api/cases/:id/sub-merchant-form/email-proof` |
| **Main code** | Frontend: `src/features/cases/case-detail/renderers/sub-merchant-form-renderer.tsx`, `src/routes/_app.cases.ep-sub-merchants.tsx` · Backend: `src/modules/cases/sub-merchant-form-case.service.ts`, `ep-sub-merchant.service.ts` |
| **Success looks like** | The Final Form is uploaded for the right sub-merchant, the email is sent manually from Gmail, the screenshot proof is saved, and the case closes successfully. |

> ⚠️ **Name confusion to keep straight:** the **queue** is called "EP Sub-Merchant Form" (prefix `SM`), the **workflow type** is `sub_merchant_form`, and the **page** that lists merchants for triggering these cases is "EP Sub-Merchants". The sub-merchant itself is chosen earlier, in Documents Review (file 13).

## How it works — the journey

```
EP Sub-Merchants page lists merchants + sub-merchants
        ↓
Trigger (if all checks pass) → new EP case, status new, no owner
        ↓
Owner takes it → working → opens inherited draft form (Google Drive link)
        ↓
Owner completes the form MANUALLY, outside the portal
        ↓
Owner confirms sub-merchant selection → uploads completed Final Form
        ↓
Owner sends email MANUALLY from Gmail (copy subject/body, download + attach files)
        ↓
Owner uploads sent-mail screenshot as proof
        ↓
Final Form + proof saved → Advance → case closes successfully
```

## Who can use it — permissions

| Item | Rule |
|---|---|
| **Queue** | EP Sub-Merchant Form (`slug: sub-merchant-form`, prefix `SM`, `workflowType: sub_merchant_form`). |
| **Working the case** | Only the case owner, with `work` access to this queue. The service checks are `403 "Only the case owner can update this case."` and the case must be in the `working` status (`400 "The case must be in the working stage."`, `loadSubMerchantFormCase`, `sub-merchant-form-case.service.ts`). |
| **Triggering a case** | `super_admin`, `admin`, or an agent with a `work` row on an EP queue (`getSessionWorkAccess`, `auth.service.ts`, sets `canManageEpCases`). The server check is `assertCanManageEpCases` (`ep-sub-merchant.service.ts`), which refuses an agent without EP work access with `403 "You do not have working access to the EP Sub-Merchant queue."`. |
| **Creating the case any other way is blocked** | `POST /api/cases` and `POST /api/cases/bulk-create` return `409` for EP queues. EP cases are only ever created through `POST /api/cases/ep-sub-merchant/trigger`. |

## Triggering (from the EP Sub-Merchants page)

1. Someone opens `/cases/ep-sub-merchants`. The page lists non-terminated merchants with: their status (`pending`, `testing`, `live`), their WordPress result (`successful` / `not_successful`), and per sub-merchant whether an EP case can be triggered and what the latest EP case for that sub-merchant looks like (`GET /api/cases/ep-sub-merchant/merchants`).
2. To trigger, the merchant must pass all of these checks (`triggerEpCase` in `backend/src/modules/cases/ep-sub-merchant.service.ts`):

| Check | Rule |
|---|---|
| Merchant | Not deleted (missing or deleted gives `404 "Merchant not found."`), and not terminated (`409 "EP cases cannot be triggered for terminated merchants."`). |
| EP queue | An active EP queue exists (`409 "The EP Sub-Merchant queue is not active."`). |
| WordPress | The merchant has **any** WordPress Website case closed as successful (`409 "The WordPress case must be closed successfully before an EP case can be triggered."`). The latest WordPress case does not have to be the successful one. |
| Sub-merchant selection | The sub-merchant is in the selection of the merchant's **latest** Documents Review case, meaning the Documents Review selection row with the newest `updated_at` (`409 "This sub-merchant was not selected in the Documents Review case."`). |
| Existing EP case | Every existing EP case for that merchant and sub-merchant, newest first, must be closed as **unsuccessful**, or there is no such case. Otherwise `409 "EP case <number> is already open for this sub-merchant."` or `409 "EP case <number> was already completed for this sub-merchant."` |
| Race | A transaction-scoped advisory lock keyed on the merchant and `ep-case:<subMerchantId>` serialises triggers for the same pair, so only one case is created. |

3. A failed check returns `409`. Success returns `201` with the new case in status `new` and no owner, the same shape as `POST /api/cases`. The trigger calls `createCaseInTransaction` (`case-query.service.ts`), so the creation rules also apply: the merchant row is locked, the EP queue must still be active, and the case-flow creation requirements are checked. The history row is `case_created_manually`, with the trigger's user as actor.
4. The new case's sub-merchant is the one sent in the trigger request (`subMerchantId`, which must pass the selection check above). At creation, `createCaseInTransaction` writes the `sub_merchant_form_details` row from that draft template, with its `draftUrl` (the Google Drive link to the prepared draft) and `not_sent` email state. `ensureInheritedSubMerchantFormDetails` (`backend/src/modules/cases/case-detail-lookups.ts`) is only a fallback for a case that has no details row. It takes the case's own `subMerchantId`, or else the first sub-merchant of the latest Documents Review selection.

## Working the case

5. The owner takes the case (`working`) and opens the inherited draft form from the Drive link. The form itself is completed **manually, outside the portal** — the portal does not edit the draft. The renderer's copy says: "Open the inherited sub-merchant draft, then upload the completed Final Form." / "Open the draft and complete it manually before uploading".
6. The endpoint `PUT /:id/sub-merchant-form/selection` (body `{ subMerchantKey }`, a uuid of a sub-merchant draft template) is **not called by the frontend**: `frontend/src/apis/cases.ts` has no function for it, and the renderer only shows the inherited sub-merchant. When it is called, it does not confirm the inherited sub-merchant. It checks only that the id exists in `sub_merchant_draft_templates` (`400 "Invalid sub-merchant selection."` otherwise), then upserts the case's `sub_merchant_form_details` row to that sub-merchant. The sub-merchant name, draft link and email state are overwritten (email state reset to `not_sent`), and history action `sub_merchant_selected` is written. A different sub-merchant can therefore replace the inherited one on the case. The stored `finalFormFileId` is not cleared by this upsert (see file 32, new discrepancy).
7. The owner uploads the completed Final Form (`POST /:id/sub-merchant-form/final-form`, multipart: `file` + `subMerchantKey`). `subMerchantKey` must match the sub-merchant now stored on the case (`400 "Final Form must be uploaded for the inherited sub-merchant."` otherwise). If the case has no sub-merchant at all, the call returns `400 "Select a sub-merchant in the document review case before uploading the Final Form."`. Accepted types are PDF, DOC and DOCX only, checked by extension, MIME type and file content (see below). Each upload stores a new `sub_merchant_final_form` file and resets the email state to `not_sent`, so an earlier send no longer counts (`sub-merchant-form-case.service.ts`).
8. **Sending is manual.** There is no automatic send for this workflow in the code reviewed — no Resend template, no send endpoint. The case page shows "Manual Email Details": a subject and body to copy into Gmail, and the attachments to download and attach by hand ("Copy this email into Gmail, download the attachments, then upload the sent-mail screenshot below."). The owner sends the email from Gmail themselves. The text is built in the browser by `sub-merchant-form-renderer.tsx`:
   - Subject (constant `EMAIL_SUBJECT`): `Addition of one sub merchant to our account`.
   - Body: addressed to the Easypaisa team. It asks for the addition of the sub-merchant named in the case, and quotes the seller code (from the EP details), the merchant's business name, the merchant's WordPress website link (`clonedWebsiteLink`) and the next-of-kin relation label. Missing values are replaced with fixed fallbacks, for example "Seller Code not configured", "Business name not available", "WordPress website not submitted" and "NOK relation not available".
   - The "Copy subject" and "Copy body" buttons copy the text, and a "Download draft" button saves a `.txt` named `ep-sub-merchant-email.txt` with the subject and body (`downloadEmailDraft`).
   - Attachments are listed for the owner to download by hand.
9. The owner uploads the sent-mail screenshot as proof (`POST /:id/sub-merchant-form/email-proof`, multipart: `file`). This is only allowed after the Final Form has been uploaded (`400 "Upload the Final Form before uploading proof."`). The file is checked with the WordPress screenshot validator (`validateWordpressScreenshotFile`, `case-upload-validation.ts`), not the email-proof validator: JPG, PNG or WEBP only (`400 "Screenshots must be JPG, PNG, or WEBP files."`), at most 10 MB. A second upload replaces the earlier proof file. The save sets the email state to `sent` with `emailRecipient = "Manual Gmail"` and `emailLogId = null`, so this upload is what marks the email as sent. History action: `sub_merchant_manual_email_proof_uploaded`.
10. **Closing.** The close checklist for this workflow is:
    - "Select a sub-merchant in the document review case before closing this case."
    - "Upload the Final Form before closing this case."
    - "Upload the sent-email screenshot before closing this case."
    The proof only counts when the email state is `sent` **and** a proof file is saved (`loadCloseChecklistFacts`: `emailStatus === 'sent' && emailProofId`). Because the proof upload itself sets `sent`, in practice the checklist passes once a proof file exists. Advancing the case closes it successfully; closing unsuccessfully with a reason is also possible, and a failed EP case is what allows a re-trigger (step 2).

## How it is implemented — Frontend

- Renderer: `frontend/src/features/cases/case-detail/renderers/sub-merchant-form-renderer.tsx`. Sections: "EP Sub-Merchant Form" (draft link + final-form upload), "Uploaded Final Form" (the saved file with a view link), "Manual Email Details" (subject, body, attachments, proof upload with "Proof saved" state).
- EP list page: `frontend/src/routes/_app.cases.ep-sub-merchants.tsx` (redirects to All Cases unless `canManageEpCases`), table in `frontend/src/features/ep-sub-merchants/ep-merchants-table.tsx`. Triggering uses its own dialog, `frontend/src/features/ep-sub-merchants/ep-trigger-dialog.tsx`: title "Trigger EP Case", one selectable row per sub-merchant (rows whose `canTrigger` is false are disabled), and a button labelled "Re-trigger Case" when the sub-merchant already has a latest EP case, otherwise "Trigger Case". Each merchant row shows a tooltip with the reason when it cannot be triggered. The generic trigger dialog (`frontend/src/features/cases/trigger-case-dialog.tsx`) leaves EP queues out, so EP cases cannot be created from it.
- API calls (`frontend/src/apis/cases.ts`): `uploadSubMerchantFinalForm()`, `uploadSubMerchantEmailProof()`; the EP list and trigger are in `frontend/src/apis/ep-sub-merchants.ts` (`fetchEpMerchants()`, `triggerEpCase()`), wrapped by `frontend/src/hooks/use-ep-sub-merchants-query.ts`. Note: there is **no** `sendSubMerchantFormEmail()` function in `frontend/src/apis/cases.ts` — consistent with sending being manual.

## How it is implemented — Backend

- Module: `backend/src/modules/cases/sub-merchant-form-case.service.ts` (`loadSubMerchantFormCase`, `selectSubMerchantForm`, `uploadSubMerchantFinalForm`, `uploadSubMerchantEmailProof`) and `ep-sub-merchant.service.ts` (`listEpMerchants`, `triggerEpCase`, `getEpQueueIds`, `assertCanManageEpCases`, `getLatestEpCases`).

| Endpoint | Body / result |
|---|---|
| `GET /api/cases/ep-sub-merchant/merchants` | Filters `search` (business name, submitter email, owner name, or exact merchant number), `status` (`pending`/`testing`/`live`), `wordpress` (`successful`/`not_successful`; choosing both is the same as no filter), `progress` (`not_triggered`/`open`/`unsuccessful`/`completed`), `sortBy` (`createdAt` default, `merchantNumber`, `businessName`, `ownerFullName`, `status`, `updatedAt`), `sortOrder` (default `asc`), `cursor`, `limit` (1–100, default 30). Each merchant row carries its WordPress summary, `isEligible`, the sub-merchants from the latest Documents Review selection (each with `canTrigger` and `latestCase`), and `otherCases` for EP cases outside that selection. |
| `POST /api/cases/ep-sub-merchant/trigger` | `{ merchantId, subMerchantId }` (strict body), `201` on success, `409` on any rule violation, `404 "Merchant not found."` for a missing or deleted merchant. |
| `PUT /api/cases/:id/sub-merchant-form/selection` | `{ subMerchantKey }` (uuid, body error "Select a valid sub-merchant."). Backend only; no frontend caller. Overwrites the case's sub-merchant (see step 6). |
| `POST /api/cases/:id/sub-merchant-form/final-form` | Multipart (`file`, `subMerchantKey` uuid); `400 "Final Form file is required."` / `"Sub-merchant selection is required."` / `"Select a valid sub-merchant."` (route checks) / `"Final Form must be a PDF, DOC, or DOCX file."` (type). |
| `POST /api/cases/:id/sub-merchant-form/email-proof` | Multipart (`file`); `400 "Email screenshot is required."` / `"Screenshots must be JPG, PNG, or WEBP files."` (type). |

- **Storage:** `sub_merchant_form_details` (one row per case, primary key `caseId`): `subMerchantKey`, `subMerchantName`, `draftUrl`, `finalFormFileId` → `case_files`, `emailStatus` (`not_sent` | `sent` | `failed`, default `not_sent`), `emailLogId`, `emailSentAt`, `emailRecipient`. A check constraint enforces that `not_sent` means no sent time and no email log, `sent` means a sent time exists, and `failed` means no sent time (migration 0111). The final form file is stored in `case_files` with kind `sub_merchant_final_form`; the proof is a `case_files` row with kind `sub_merchant_email_proof`. The proof's id is not a column on the details row: the case detail reads it from that `case_files` row (`emailProofId`, `case-detail-lookups.ts`).
- **Email state in this workflow** (`case-email-send-state.ts`): `not_sent` is set on case creation, on every final-form upload and on every selection change. `sent` is set by the proof upload, with `emailLogId` null (a manual copy, no `email_log` row). `failed` is never set here, because the only writer of `failed` is the automatic-send path, which this workflow does not have.
- **Draft templates:** sub-merchants and their draft forms come from `sub_merchant_draft_templates` (each row has a `googleDriveWebViewLink`). Multiple sub-merchants per merchant are supported (migration `0053_multi_sub_merchants`).
- **Case numbering:** prefix `SM` (for example `SM-000000001`).

## Data, validation and edge cases

| Item | Rule |
|---|---|
| **File types: Final Form** | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.pdf`, `.doc`, `.docx`), checked by extension, MIME type and file content (`validateSubMerchantFinalFormFile`, `case-upload-validation.ts`). |
| **File types: Email proof screenshot** | `image/jpeg`, `image/png`, `image/webp`, with the same extension and content checks (`validateWordpressScreenshotFile`, `WORDPRESS_SCREENSHOT_MIME_TYPES`, `case-constants.ts`). |
| **File size** | All uploads max 10 MB (`backend/src/lib/storage/file-limits.ts`, `backend/src/modules/cases/case-constants.ts`). |
| **Order matters** | Proof cannot be uploaded before the Final Form (`400 "Upload the Final Form before uploading proof."`). The Final Form must match the sub-merchant stored on the case, which the selection endpoint can change (see step 6). |
| **Re-trigger only after failure** | If an EP case for the sub-merchant is still open, or closed as successful, triggering again is a `409`. The "completed" progress state means every selected sub-merchant has a successful EP case. |
| **WordPress gate** | A merchant with no successful WordPress case cannot get an EP case at all — even if everything else is ready. This ordering (WordPress before EP) is enforced in the trigger, not just in the case-flow rules. |
| **Stale selection** | The trigger reads the merchant's **latest** Documents Review selection. If Documents Review is re-run and the selection changes, an EP case triggered afterwards follows the new selection; cases already created keep the sub-merchant they inherited. |
| **Manual email has no delivery tracking** | Because the email is sent from Gmail by hand, there is no `email_log` row, no Resend webhook, and nothing that can block the close on delivery grounds. The only proof is the screenshot. The proof upload sets `emailStatus` to `sent` (manual copy); no path in this workflow sets `failed`. |

> ⚠️ **Not found in the code reviewed:** any check that the uploaded proof screenshot actually shows a sent email (it is a human judgement); any deadline for sending the form after it is uploaded. The manual email's subject and body are now pinned (step 8), but the text is written in the frontend, not in a backend template.

## What happens next — in plain words

- **For the partner:** the partner receives the completed form by email from the owner's Gmail, with the attachments the owner attached by hand. The portal does not track whether the partner received or acted on it — the screenshot is the only record that it was sent.
- **For the merchant:** once every selected sub-merchant has a successful EP case, the merchant's EP progress shows as `completed` on the EP Sub-Merchants page. There is no further EP step after that in the code reviewed; the merchant's other queues (for example MID Creation, Testing, Live) carry the onboarding forward.
- **If the case closes unsuccessfully,** that sub-merchant can be triggered again — a failed EP case is exactly what allows a re-trigger. If it closes successfully, it cannot be triggered again for that sub-merchant; a form that needs re-sending after a successful close has no re-send path in the code reviewed (see the questions).
- **If the merchant's sub-merchant selection changes** in a later Documents Review, cases already created keep the sub-merchant they inherited; only newly triggered cases follow the new selection.

## Errors

| Result | Meaning |
|---|---|
| `400` | "The case must be in the working stage." / "This action is only available for EP Sub-Merchant Form cases." (wrong queue) / "Invalid sub-merchant selection." / "Final Form must be uploaded for the inherited sub-merchant." / "Select a sub-merchant in the document review case before uploading the Final Form." / "Select a sub-merchant in the document review case before uploading proof." / "Final Form file is required." / "Sub-merchant selection is required." / "Select a valid sub-merchant." / "Final Form must be a PDF, DOC, or DOCX file." / "Upload the Final Form before uploading proof." / "Email screenshot is required." / "Screenshots must be JPG, PNG, or WEBP files." — from `sub-merchant-form-case.service.ts`, `case-upload-validation.ts` and `cases.routes.ts`. |
| `403` | "Only the case owner can update this case." — plus the queue work-access check. "You do not have working access to the EP Sub-Merchant queue." (trigger, agent without EP work access). |
| `404` | "Case not found." / "Merchant not found." (trigger). |
| `409` | Any failed EP trigger check: "EP cases cannot be triggered for terminated merchants." / "The EP Sub-Merchant queue is not active." / "The WordPress case must be closed successfully before an EP case can be triggered." / "This sub-merchant was not selected in the Documents Review case." / "EP case <number> is already open for this sub-merchant." / "EP case <number> was already completed for this sub-merchant." Plus the creation errors from `createCaseInTransaction`, for example "This queue is inactive. Case creation is disabled." |
| `500` | "Failed to save Final Form." / "Failed to save email proof." — a save failure, not a user error. |

## What to check — is this what you intended?

- [ ] **Manual sending:** sending is entirely manual (copy into Gmail, attach, screenshot). Is that the long-term plan, or should the portal send this email automatically like the resubmission and agreement emails?
- [ ] **Screenshot proof:** the proof of sending is a screenshot that nobody verifies in code. Is a screenshot enough, or should a second person confirm it?
- [ ] **WordPress gate:** the WordPress gate blocks EP cases until WordPress closes successfully. Should that always be true, or are there merchants whose EP form should go out before their website is ready?
- [ ] **Re-send after success:** a successful EP case blocks any re-trigger for that sub-merchant. If a form needs to be re-sent after a successful close (for example the partner lost it), how should that be handled — a new case, or a re-send on the old one?
- [ ] **Show blocked merchants:** the EP list shows merchants whose WordPress result is `not_successful`. Should those merchants be hidden, or is it useful to see them and know why they cannot be triggered yet?
- [ ] **Selection endpoint:** `PUT /:id/sub-merchant-form/selection` has no frontend caller, yet on the backend it can replace the case's sub-merchant with any draft template, and it resets the email state. Should this endpoint be removed, or limited to the sub-merchant the trigger chose?
- [ ] **Confirm selection by hand:** the close checklist says "Select a sub-merchant in the document review case" — but the sub-merchant is set when the case is triggered. Should the owner still have to confirm the selection by hand, or is the trigger choice enough?

---
*Sources: `frontend/src/features/cases/case-detail/renderers/sub-merchant-form-renderer.tsx`, `frontend/src/routes/_app.cases.ep-sub-merchants.tsx`, `frontend/src/features/cases/trigger-case-dialog.tsx`, `frontend/src/apis/cases.ts`, `backend/src/modules/cases/sub-merchant-form-case.service.ts`, `backend/src/modules/cases/ep-sub-merchant.service.ts`, `backend/src/modules/cases/case-detail-lookups.ts`, `backend/src/modules/cases/case-email-send-state.ts`, `backend/src/modules/cases/case-upload-validation.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/lib/storage/file-limits.ts`, `backend/src/modules/cases/case-constants.ts`. Related files: 11 (Cases List / EP page), 12 (case lifecycle), 13 (Document Review / sub-merchant selection), 18 (WordPress Website).*
