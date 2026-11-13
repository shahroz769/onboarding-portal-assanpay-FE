# 15 — Agreement Workflow

## At a glance

| | |
|---|---|
| **What it is** | The Agreement workflow turns an approved merchant into a signed contract. AssanPay prepares a final agreement document from a template matched to the merchant's business type, the employee uploads that final document, sends its Google Drive link to the merchant by email, and then waits. The merchant signs and couriers the physical paper copy to the office; when it arrives, the office scans it and uploads the scan. Only when both the sent final agreement and the received signed copy exist can the case close successfully — and closing it is what can trigger the next step in the chain (a Live case, via the case-flow rules; migration `0074_agreement_driven_live` makes Live creation depend on the Agreement). The dashboard also tracks agreements whose physical copy is still outstanding (file 10). |
| **Who can use it** | Only the case owner, with `work` access to the Agreement queue. Viewing: anyone who can view the case. |
| **Where it lives** | Case detail page, for an Agreement case (`/cases/:caseId`). |
| **What it creates** | The sent Final Agreement (Drive link emailed to the merchant) and the scanned signed physical copy uploaded by the office. |
| **Main APIs** | `POST /api/cases/:id/agreement/final-agreement` · `POST /api/cases/:id/agreement/received-copy` · `POST /api/cases/:id/agreement/send-mail` · `POST /api/cases/:id/agreement/send-mail/preview` · `POST /api/cases/:id/agreement/send-mail/manual` |
| **Main code** | Frontend: `src/features/cases/case-detail/renderers/agreement-renderer.tsx` · Backend: `src/modules/cases/agreement-case.service.ts` |
| **Success looks like** | Final Agreement sent, signed paper copy received and scanned, case closes successfully — and a Live case can then be created. |

## How it works — the journey

```
Case arrives new → owner takes it → working
        ↓
System prepares agreement details from a draft template (by business type)
  → owner reviews the draft (Google Drive link)
        ↓
Owner uploads the Final Agreement (PDF / DOC / DOCX)
        ↓
Owner sends it to the merchant by email (Drive link, not an attachment)
  → case moves to awaiting_merchant
        ↓
Merchant signs + couriers the paper copy to the office (outside the portal)
  → dashboard "awaiting physical agreements" lists it until it arrives
        ↓
Office receives + scans it → owner uploads the scan
  → case returns to working
        ↓
Final Agreement + signed copy both exist → Advance → case closes successfully
```

## Who can use it — permissions

| Item | Rule |
|---|---|
| **Queue** | Agreement (`slug: agreement`, prefix `AG`, `workflowType: agreement`). |
| **Working the case** | Only the case owner, with `work` access to the Agreement queue. Checks are `403 "Only the case owner can update this case."` and `400 "The case must be in the working stage."` (`backend/src/modules/cases/agreement-case.service.ts`, `loadAgreementCase`). |
| **Viewing** | Anyone who can view the case. |
| **Creating the case** | `super_admin`/`admin`, or automatically by the case-flow engine when a previous case closes successfully. |

## Step by step

1. The case arrives `new`. The owner takes it (`working`).
2. **Prepare the final agreement.** The draft is chosen by the merchant's business type. Opening the case shows the configured draft without writing anything (`case-query.service.ts`, `getConfiguredAgreementDraftForMerchantType`). The `agreement_case_details` row is created by `ensureAgreementDetails` inside the first Final Agreement upload transaction (`agreement-case.service.ts`), storing `businessType`, `draftKey`, `draftLabel` and `draftUrl` (a Google Drive link to the draft). The draft comes from the `agreement_draft_templates` row for that business type; if no row exists, the code falls back to the built-in table in `backend/src/modules/cases/agreement.config.ts`. The owner reviews the draft in the renderer ("Review the merchant business type, prepare the final agreement…").
3. **Upload the Final Agreement** (`POST /:id/agreement/final-agreement`, multipart `file`). Accepted types are PDF, DOC and DOCX. Uploading replaces any previous final agreement, but **only before the email has been sent**. Once the email is recorded as `sent`, the server refuses with `400 "The Final Agreement cannot be replaced after the email has been sent."` (a bounced email reads as `failed`, which allows replacement). The case must be `working`. The renderer says: "Upload a new PDF, DOC, or DOCX file to replace the current Final Agreement before sending the email." The file is stored in Google Drive and recorded in `case_files` (kind `agreement_final`, in the public Final Agreement folder via `ensurePublicFinalAgreementFolder`). Each upload writes history `agreement_final_uploaded`.

   > **Replacement is blocked once the email has been sent:** `400 "The Final Agreement cannot be replaced after the email has been sent."` A bounced or failed email reads as `failed`, and then replacement is allowed. A replacement clears the received scan, resets the email state to `not_sent`, and marks the old Drive object superseded (`supersedeStorageObjects`).
4. **Send it to the merchant** (`POST /:id/agreement/send-mail`):
   - Requires the Final Agreement to be uploaded first (`400 "Upload the Final Agreement before sending mail."`) and the file to still exist (`400 "The Final Agreement file could not be found."`).
   - The owner picks the recipient (`recipientEmailType: 'submitter' | 'business'`, default `submitter`) and may add remarks (max 2000 characters, optional).
   - The merchant portal settings must hold an office address and a legal email, or the send is refused: `400 "Configure the office address before sending the Agreement email."` / `400 "Configure the legal email before sending the Agreement email."` The case must be `working` (`400 "The case must be in the working stage."`). A concurrent send that loses the race gets `409 "This case has already been sent to the merchant."`
   - The email carries the Drive link (`googleDriveWebViewLink`), office address, legal email and remarks. Its Resend idempotency key is `agreement/<caseId>/<details.updatedAt in epoch milliseconds>`.
   - If the send fails, the reservation is undone: the case returns to `working` and the response is `status: 'failed'` with the error (`merchant-request.service.ts`).
   - The owner can preview first (`POST /:id/agreement/send-mail/preview`).
   - Sending emails the **Google Drive link** of the Final Agreement (the merchant downloads it from Drive; the file itself is not attached).
   - Sending moves the case to `awaiting_merchant` (event `request_merchant`, stage `awaiting_merchant`) — the case now waits for the merchant.
   - As with other workflows, the owner can instead confirm a manual send: upload a screenshot of the sent Gmail/WhatsApp message (`POST /:id/agreement/send-mail/manual`, multipart `file`, `tokenId`, `remarks?`, `channel: email | whatsapp`, `recipientEmailType`). Recorded as `agreement_email_sent_manual` / `agreement_whatsapp_sent_manual` (proof kind `agreement_email_proof` / `agreement_whatsapp_proof`). The manual confirm also moves the case to `awaiting_merchant`, stores no email log row (the copy is not tracked by Resend), and is refused with `400 "The email preview is out of date. Load the preview again before confirming."` unless `tokenId` matches a token built from the case, the Final Agreement file, the recipient and the remarks (`buildAgreementPreviewToken`).
5. **The merchant signs and couriers the paper copy.** This happens outside the portal. The case sits in `awaiting_merchant` until the paper arrives. The dashboard's "awaiting physical agreements" list (`GET /api/dashboard/agreements/awaiting-physical`) is the view of all cases in exactly this state — sent, physical copy not yet received.
6. **The office receives and scans it.** The owner uploads the scanned signed copy (`POST /:id/agreement/received-copy`, multipart `file`). Accepted types are PDF, JPG, JPEG, PNG and WEBP (the physical-agreement file set). Uploading the received copy returns the case to `working` (`merchant_responded` — the renderer says: "The case will return to Working and can then be closed successfully."). Preconditions, checked in order: the case must be `awaiting_merchant` (`400 "The case must be awaiting the signed physical agreement."`), and the Agreement email must be `sent` (`400 "Send the Agreement email before uploading the received copy."`). The scan goes to a private "Received Agreement" folder and is stored as kind `agreement_received_scan` (`agreement.config.ts`; one row per case, so a second upload replaces the first; the old Drive object is marked superseded). History action: `agreement_received_uploaded`. The queue must have a stage with slug `working` (`500 "No working stage configured for this queue."` if not).
7. **Closing.** The close checklist for this workflow is:
   - "Upload the Final Agreement before closing this case."
   - "Upload the signed physical agreement received by the office before closing this case."
   Advancing closes the case successfully. The owner can also close unsuccessfully with a reason. Note the email-delivery rule (file 12): a successful close is blocked with `409` until the latest tracked agreement email is `delivered`, unless a manual/WhatsApp send superseded it.
8. **What happens next:** a successful Agreement close can create the next case (Live) through the configured close triggers, and the merchant's agreement email status is recorded so the dashboard and case detail can show it. The agreement case itself does not change the merchant's status in the code reviewed — the merchant goes live only when the Live case closes (file 12).

## How it is implemented — Frontend

- Renderer: `frontend/src/features/cases/case-detail/renderers/agreement-renderer.tsx`. Sections: "Agreement" (business type, draft link, final-agreement upload), "Final Agreement" (the saved file, with a review action), "Received Physical Agreement Scan" / "Upload Scanned Physical Agreement" (with the explanation that the merchant was asked to courier the signed copy), and the send-mail panel (preview, send, manual confirm). The renderer notes that only the current case owner can upload the final agreement and send the email.
- Agreement rounds are shown in `agreement-rounds-card.tsx` (a case can go through more than one send/receive round — for example if the first signed copy is rejected or incomplete; the exact re-send flow is covered under edge cases below).
- API calls (`frontend/src/apis/cases.ts`): `uploadAgreementFinalAgreement()`, `uploadReceivedAgreement()`, `sendAgreementEmail()`, `fetchAgreementEmailPreview()`, `confirmAgreementEmailManual()`.
- Dashboard panel: `frontend/src/features/dashboard/dashboard-awaiting-agreements.tsx` (data from `fetchAwaitingPhysicalAgreements()`).

## How it is implemented — Backend

- Module: `backend/src/modules/cases/agreement-case.service.ts` (`loadAgreementCase`, `ensureAgreementDetails`, `uploadAgreementFinalAgreement`, `sendAgreementToClient`, `uploadReceivedAgreement`).

| Endpoint | Body / result |
|---|---|
| `POST /:id/agreement/final-agreement` | Multipart `file`; `400 "Final Agreement file is required."` |
| `POST /:id/agreement/received-copy` | Multipart `file`; `400 "Received Agreement copy is required."` |
| `POST /:id/agreement/send-mail` | JSON `{ remarks?, recipientEmailType? }` (`sendAgreementEmailSchema`). |
| `POST /:id/agreement/send-mail/preview` | Same body, preview only. |
| `POST /:id/agreement/send-mail/manual` | Multipart (`file`, `tokenId`, `remarks?`, `channel`, `recipientEmailType`). |

All endpoints are under `/api/cases/:id`.

- **Storage:** `agreement_case_details` (one row per case, primary key `caseId`): `businessType`, `draftKey`, `draftLabel`, `draftUrl`, `finalAgreementFileId` → `case_files`, `receivedAgreementFileId` → `case_files`, `emailStatus` (`not_sent` | `sent` | `failed`, default `not_sent`), `emailLogId`, `emailSentAt`, `emailRecipient`, `lastRejectionRemarks`. A check constraint enforces the email state shape (migration 0111): `not_sent` ⇒ no sent time and no log; `sent` ⇒ a sent time exists; `failed` ⇒ no sent time.
- **Draft templates:** `agreement_draft_templates` — one template per business type, chosen by `businessType`. The template key/label/url are copied onto the case details when the case is prepared.
- **Email:** the `agreement` template (`backend/src/modules/email/templates/agreement.tsx`); delivery tracked in `email_log` with the same blocking rule as other workflows (file 12). `agreementEmailStatusSql` (`agreement-email-status.ts`) reads the stored status but reports `failed` when the linked `email_log` row is in an undelivered status (bounce, complaint, suppression). The dashboard (`dashboard.service.ts`) and case query use it. The awaiting-physical list (`dashboard.routes.ts`, `GET /api/dashboard/agreements/awaiting-physical`) selects agreements whose status reads `sent`. Also see file 32, gap 15 (no virus scan, no Drive fallback).
- **Case numbering:** prefix `AG`.

## Data, validation and edge cases

| Item | Rule |
|---|---|
| **File types: Final Agreement** | PDF, DOC, DOCX (`AGREEMENT_FILE_MIME_TYPES` = the sub-merchant final-form set). |
| **File types: Received physical scan** | PDF, JPG, JPEG, PNG, WEBP (`PHYSICAL_AGREEMENT_MIME_TYPES` / `PHYSICAL_AGREEMENT_EXTENSIONS`). |
| **File types: Manual-send proof screenshots** | JPEG, PNG, WEBP. |
| **File size** | All uploads max 10 MB. |
| **Send requires the file** | The agreement cannot be emailed before the Final Agreement is uploaded, and the Drive file must still exist at send time. |
| **Replacing the Final Agreement** | Before the email is sent (or after a failed/bounced send) a new upload replaces the file, clears the received scan and resets the email state. Once the email status is `sent`, the upload is refused with `400` (see step 3), so the merchant's Drive link always matches the file that was emailed. |
| **File size and content** | All uploads max 10 MB. Validators are in `case-upload-validation.ts` (`validateAgreementFile`, `validateReceivedAgreementFile`): extension and MIME type first, then a file content signature check. Messages: `Agreement must be a PDF, DOC, or DOCX file.` and `Received agreement copy must be a PDF, JPG, PNG, or WebP file.` Storage risks: see file 32, gap 15. |
| **Received copy returns the case to working** | The upload itself moves the case out of `awaiting_merchant`. The code reviewed has no reject action. A second scan is refused unless the case is `awaiting_merchant` again, and the send path does not check for an earlier send, so a re-send from `working` is the only route back to a second scan. `lastRejectionRemarks` is set from the remarks of a manual send. |
| **Physical agreement queue merge** | Migration `0057_merge_physical_agreement_workflow` merged a formerly separate physical-agreement workflow into this one; `physical_agreement` still exists as a `workflowType` value in the enum and in the stage templates, but the Agreement queue itself uses `agreement`. Do not confuse the two. |

> ⚠️ **Not found in the code reviewed:** a deadline after which an unreturned agreement is chased or the case is closed; any automatic reminder to the merchant; whether the merchant can upload the signed copy themselves (the upload is employee-only in the code reviewed).

## What happens next — in plain words

- **For the merchant:** they download the Final Agreement from the Drive link in the email, sign the paper copy, and courier it to the office. They do not upload anything themselves in the code reviewed — the paper has to physically arrive before anything else can happen.
- **For the team:** while the paper is in transit, the case waits in `awaiting_merchant` and the agreement sits on the dashboard's "awaiting physical agreements" list (file 10), so the office can see what is still outstanding. When the parcel arrives, the office scans it, the owner uploads the scan, and the case can close.
- **After a successful close,** the next step in the chain can be created through the case-flow rules — a Live case (migration `0074_agreement_driven_live` makes Live creation depend on the Agreement). The merchant itself does **not** go live at this point: it goes live only when the Live case closes (file 12).
- **If the case closes unsuccessfully,** no Live case follows from it, and the merchant's agreement has to be started again with a new Agreement case if the deal is to proceed.

## Errors

| Result | Meaning |
|---|---|
| `400` | "The case must be in the working stage." / "Final Agreement file is required." / "Received Agreement copy is required." / "Upload the Final Agreement before sending mail." / "The Final Agreement file could not be found." — from `agreement-case.service.ts` and `cases.routes.ts`. |
| `403` | "Only the case owner can update this case." — plus the queue work-access check. |
| `404` | "Case not found." |
| `409` | Successful close blocked until the latest tracked agreement email is `delivered` (file 12) — unless a manual/WhatsApp send superseded it. |
| `400` (more) | "Configure the office address before sending the Agreement email." / "Configure the legal email before sending the Agreement email." / "The Final Agreement cannot be replaced after the email has been sent." / "The case must be awaiting the signed physical agreement." / "Send the Agreement email before uploading the received copy." / "The email preview is out of date. Load the preview again before confirming." — from `agreement-case.service.ts` and `case-communications.service.ts`. |
| `409` (more) | "This case has already been sent to the merchant." — a second send raced the first. |
| `500` | "Failed to prepare Agreement details." / "Failed to save Final Agreement." / "Failed to save the received Agreement." / "No working stage configured for this queue." — configuration or save failures, not user errors. |

## What to check — is this what you intended?

- [ ] **Replacing a sent agreement:** the code now blocks replacement once the email is `sent` (`400`). Is that the rule you want? If a wrong Final Agreement has already been emailed, what is the correct fix: a new Agreement case, a fresh email, or something else?
- [ ] **Wrong / incomplete signed copy:** what happens when the signed copy that arrives is incomplete or wrong? The code has no reject step, and the only route to a second scan is a re-send from `working`. Is that the intended re-do route, or is a reject step needed?
- [ ] **Deadline / reminder:** should there be a deadline or an automatic reminder if the merchant does not return the signed agreement — for example after 7 or 14 days?
- [ ] **Who chases:** the dashboard lists every agreement waiting for its physical copy. Who should chase those — the case owner, or someone in the office who receives the courier parcels?
- [ ] **Merchant uploads the scan:** the merchant downloads the agreement from a Google Drive link. Should the merchant also be able to upload the signed scan themselves through a link, instead of couriering paper to the office?
- [ ] **Merged workflow:** migration 0057 merged the old separate physical-agreement workflow into this one. Is the merged flow (one Agreement case covering both send and receive) how the team actually works now, or do some merchants still need a separate physical-agreement step?

---
*Sources: `frontend/src/features/cases/case-detail/renderers/agreement-renderer.tsx`, `frontend/src/features/cases/case-detail/agreement-rounds-card.tsx`, `frontend/src/features/dashboard/dashboard-awaiting-agreements.tsx`, `frontend/src/apis/cases.ts`, `backend/src/modules/cases/agreement-case.service.ts`, `backend/src/modules/cases/agreement.config.ts`, `backend/src/modules/cases/agreement-email-status.ts`, `backend/src/modules/cases/case-upload-validation.ts`, `backend/src/modules/cases/case-constants.ts`, `backend/src/modules/cases/case-communications.service.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/merchant-request.service.ts`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/dashboard/dashboard.routes.ts`, `backend/src/modules/email/templates/agreement.tsx`, `backend/drizzle/0111_case_data_state_guards.sql`, `backend/drizzle/0074_agreement_driven_live.sql`. Related files: 10 (Dashboard / awaiting physical agreements), 12 (case lifecycle / email-delivery blocking), 16 (MID Creation), 17 (Testing).*
