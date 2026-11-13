# 13 — Document Review Workflow

## At a glance

| | |
|---|---|
| **What it is** | The first real check in onboarding. A merchant submits an application (form fields plus documents such as CNICs and a utility bill). An employee reviews every field and every document, approves the good ones, rejects the bad ones with a written reason, and — when anything is rejected — sends the merchant a link to fix only the rejected items. When the merchant resubmits, the case comes back to the owner for another look. When everything is approved, the owner also picks which sub-merchants this merchant will onboard under (for example the merchant's partner brands), because the later EP Sub-Merchant Form and WordPress steps depend on that selection. Only when there is at least one sub-merchant selected and nothing still rejected can the case close successfully. |
| **Who can use it** | Only the case owner, with `work` access to the Documents Review queue. Viewing: anyone who can view the case. |
| **Where it lives** | Case detail page, for a Documents Review case (`/cases/:caseId`). The merchant's resubmission form is public: `/onboarding-form/resubmit/:token`. |
| **What it creates** | Field reviews (approve/reject per field), a resubmission link + email when things are rejected, and the sub-merchant selection that later queues read. |
| **Main APIs** | `PUT /api/cases/:id/field-reviews` · `PUT /api/cases/:id/document-review/sub-merchant` · `POST /api/cases/:id/send-for-resubmission` · `POST /api/cases/:id/send-for-resubmission/preview` · `POST /api/cases/:id/send-for-resubmission/manual` · `POST /api/cases/:id/send-for-resubmission/regenerate-link` |
| **Main code** | Frontend: `src/features/cases/case-detail/renderers/documents-review-renderer.tsx` · Backend: `src/modules/cases/case-documents-review.service.ts`, `document-review-state.ts`, `case-resubmission-tokens.service.ts` |
| **Success looks like** | Every field/document approved, at least one sub-merchant selected, and the case closes successfully — ready for the next step in the chain. |

## How it works — the journey

```
Case arrives new → owner takes it → working
        ↓
Owner reviews every field + document: pending / approved / rejected
  (a rejection MUST carry written remarks)
        ↓
Owner saves reviews (PUT /:id/field-reviews)
        ↓
If anything rejected → owner sends resubmission email + single-use link
  → case moves to awaiting_merchant
        ↓
Merchant resubmits only the rejected fields → resubmitted fields back to pending
  → case returns to working → owner reviews again (cycle repeats if needed)
        ↓
Owner picks sub-merchants (1–30) for this merchant
        ↓
Nothing rejected + at least one sub-merchant selected → Advance → case closes successfully
```

## Who can use it — permissions

| Item | Rule |
|---|---|
| **Queue** | Documents Review (`slug: documents-review`, prefix `DR`, `workflowType: document_review`). |
| **Working the case** | Only the case owner, with `work` access to the Documents Review queue. Every action below returns `403 "Only the case owner can …"` for anyone else (including admins who are not the owner). |
| **Viewing** | Anyone who can view the case (file 11/12 access rules). |
| **Creating the case** | `super_admin`/`admin` only, or automatically by the case-flow engine when a merchant submits (`triggerStartCasesForMerchant`). A Documents Review case is normally the first case a merchant gets. |

## Step by step

1. The case arrives `new`. The owner takes it, and it becomes `working`.
2. The owner reviews the merchant's submitted fields and documents one by one in the Documents Review form. Each item gets a status: `pending`, `approved` or `rejected`. A rejection **must** carry written remarks explaining what is wrong.
3. The owner saves the reviews (`PUT /:id/field-reviews`). Saving is only allowed while the case is `working`, and only in a stage of category `in_progress`. While the case is `awaiting_merchant` (waiting for the merchant to resubmit), rejections are locked: saving returns `400 "Rejection changes are locked while awaiting merchant resubmission."`. Any other status returns `400 "Field reviews can only be saved while the case is working."` (`saveFieldReviews`, `case-documents-review.service.ts`).
4. **If anything is rejected**, the owner sends the case back to the merchant:
   - The owner picks who the email goes to — the submitter or the business email (`recipientEmailType: 'submitter' | 'business'`, default `submitter`).
   - The owner can preview the email first (`POST /:id/send-for-resubmission/preview`), then send it (`POST /:id/send-for-resubmission`).
   - Sending does four things in one database transaction: it reserves the case in the `awaiting_merchant` stage (event `request_merchant`), issues a single-use resubmission link scoped to the rejected fields, records the email (`prepareEmail`), and opens a merchant request. The link looks like `{PUBLIC_APP_URL}/onboarding-form/resubmit/{token}`. The email itself is delivered after that transaction commits, and the merchant request is then resolved as `sent` or `failed`.
   - The send is gated by the email-sending mode: automatic sending is refused with `403 "Automatic email sending is disabled. Use the manual email workflow."` when that mode is off (`assertAutoEmailEnabled`, `case-communication-helpers.ts`). The Resend email uses idempotency key `resubmit/{caseId}/{tokenId}`. CC and BCC addresses come from Configuration → Email sending (`resolveCaseEmailRecipients`, `case-communication-helpers.ts`). CC gets the sending user's email if the `ccSender` setting is on, the other merchant address if `ccOtherMerchantEmail` is on (the submitter address when the recipient is the business, and the business address when the recipient is the submitter), and the configured extra CC list. BCC is the configured BCC list. Duplicates and the recipient are removed.
   - The owner can confirm a manual send instead: upload a screenshot of the sent Gmail/WhatsApp message (`POST /:id/send-for-resubmission/manual`, multipart form with `file`, `tokenId`, `channel: email | whatsapp`, `recipientEmailType`). A manual send is recorded as `resubmission_email_sent_manual` or `resubmission_whatsapp_sent_manual`. Rules (`confirmResubmissionEmailManual`, `case-communications.service.ts`): the email channel needs the case in `working`; the WhatsApp channel also works while the case is `awaiting_merchant`, and needs an active WhatsApp number (`400 "No active WhatsApp number is on file."`); `tokenId` must still be an unconsumed preview link, otherwise `409 "This email preview is no longer valid. Load the preview again."`; manual sending is refused with `403 "Manual email sending is disabled. Use the automatic email workflow."` when that mode is off (`assertManualEmailEnabled`). The screenshot must be JPEG, PNG or WebP (`400 "Screenshot must be a JPEG, PNG, or WebP image."`).
   - If the send itself fails after the case was reserved, the reservation is undone (`release_request`) and the result is `{ status: 'failed', emailLogId, error }` instead of a half-finished state. If another send reserved the case first, the call returns `409 "This case has already been sent for resubmission."`
5. **The merchant resubmits** through the public form (`/onboarding-form/resubmit/:token`, frontend route `onboarding-form.resubmit.$token.tsx`). Only the rejected fields can be changed; the token is single-use and scoped to the latest rejection round. Resubmitted fields go back to `pending` (migration `0107_reset_resubmitted_document_status`), the merchant request is resolved, and the case returns to `working` (`merchant_responded`). The owner reviews the new versions and the cycle repeats if needed.
6. If the rejection list changed since the link was issued (for example the owner edited the rejections), the owner can issue a fresh link scoped to the latest rejections without re-sending the whole email (`POST /:id/send-for-resubmission/regenerate-link`, returns `{ url, rejectedFieldCount }`). It is owner-only and needs the case in `awaiting_merchant`; otherwise it returns `400 "The case must be awaiting the merchant to regenerate its resubmission link."`. It returns `400 "There are no rejected fields to resubmit."` when there is nothing to fix.
7. **Sub-merchant selection.** The owner picks the sub-merchants this merchant will onboard (`PUT /:id/document-review/sub-merchant`, 1–30 sub-merchant ids). Each id must exist in the sub-merchant draft catalogue (`sub_merchant_draft_templates`); the backend does **not** check that the id belongs to this merchant (see the checks below). Saving replaces the whole previous selection (old rows deleted, new rows inserted in one transaction) and writes history action `document_review_sub_merchant_selected`. The selection is stored in `document_review_details` and is what the EP Sub-Merchant Form queue (file 14) and the WordPress Website queue (file 18) read later. Saving it is owner-only, and the case must be `working` (`400 "Sub-merchants can only be selected while the case is working."`). A case on another queue gets `400 "Sub-merchant selection is only available for document review cases."`
8. **Closing.** When there is nothing rejected and at least one sub-merchant is selected, the owner advances the case and it closes successfully (file 12). The close checklist for this workflow is exactly:
   - "Select at least one sub-merchant before closing this case."
   - "Resolve all rejected fields and documents before closing this case."
   The owner can also close unsuccessfully with a reason at any open status.
9. **Rejection rounds are visible** on the case page (`rejection-rounds-card.tsx`) and in a summary modal (`documents-review-summary-modal.tsx`), so the owner and the merchant's history of what was rejected, when, and what came back can be followed round by round.

### What counts as a "field"

Field names cover merchant form fields (names, emails, business details) and documents. Document fields are recognised by `isDocumentFieldName()` and map to document ids (`getDocumentIdFromFieldName` in `backend/src/modules/cases/field-labels.ts`); the labels shown in the UI come from `DOCUMENT_TYPE_LABELS` and `MERCHANT_FIELD_LABELS`. The list of document types a merchant must supply depends on their business type (`getRequiredDocumentTypes` in `backend/src/modules/merchants/merchants.schemas.ts`). The exact required set per business type is defined there, not in this file — see the questions.

## How it is implemented — Frontend

- Renderer: `frontend/src/features/cases/case-detail/renderers/documents-review-renderer.tsx` (loaded for `workflowType: document_review` by `queue-registry.ts`). Draft review state is held in `renderers/documents-review-draft-context.tsx` and only sent when the owner saves.
- The renderer shows the merchant's documents and fields, approve/reject controls with a remarks dialog for rejections, a save button, the sub-merchant selector, the resubmission email panel (preview, send, manual confirm) and the rejection-rounds card.
- API calls (`frontend/src/apis/cases.ts`): `saveFieldReviews()`, `saveDocumentReviewSubMerchant()`, `sendForResubmission()`, `fetchResubmissionEmailPreview()`, `regenerateResubmissionLink()`, `confirmResubmissionEmailManual()`. The manual-email UI is shared: `frontend/src/components/case-email/` (`manual-email-panel.tsx`, `email-mode-choice.tsx`, `email-recipient-select.tsx`, `email-delivery-badge.tsx`, `whatsapp-message-panel.tsx`).
- The public resubmission form is `frontend/src/routes/onboarding-form.resubmit.$token.tsx`.

## How it is implemented — Backend

- Module: `backend/src/modules/cases/case-documents-review.service.ts` (the largest workflow service in the module) with `document-review-state.ts` (recording reviews, moving rejected documents in Google Drive) and `case-resubmission-tokens.service.ts` (issuing tokens).

| Endpoint | Body / result |
|---|---|
| `PUT /:id/field-reviews` | `{ reviews: [{ fieldName (1–120 chars), status: 'pending' \| 'approved' \| 'rejected', remarks? (max 2000 chars) }] }`, 1–200 reviews per call; remarks are required for every rejected item. |
| `PUT /:id/document-review/sub-merchant` | `{ subMerchantIds: [uuid], 1–30 }`. |
| `POST /:id/send-for-resubmission` | `{ recipientEmailType? }`; requires status `working` and at least one rejected field; returns `{ status: 'sent' \| 'failed', emailLogId, error? }`. |
| `POST /:id/send-for-resubmission/preview` | Same body, returns the email preview without sending. |
| `POST /:id/send-for-resubmission/manual` | Multipart (`file`, `tokenId`, `channel`, `recipientEmailType`); screenshot file required. |
| `POST /:id/send-for-resubmission/regenerate-link` | Returns `{ url, rejectedFieldCount }`. |

All endpoints are under `/api/cases/:id`, all require authentication; write actions are owner-only plus queue work access.

- **Storage:** reviews live in `case_field_reviews` (unique per case + field, `resubmittedAt` marks a field that came back). The sub-merchant selection lives in `document_review_details` (primary key case + sub merchant, with `subMerchantName` and `selectedBy`). Resubmission tokens live in `case_resubmission_tokens`, hashed at rest (migrations `0041_hash_public_tokens` and `0116_drop_resubmission_plaintext_token`). Token rules (`case-resubmission-tokens.service.ts`): a case has at most one active **delivered** link (the one the merchant has) and at most one active **pending** preview link. Issuing a delivered link supersedes every active link on the case; a preview only replaces an older preview, so the merchant's link keeps working until the owner confirms the new one. Links are consumed with a reason (`superseded`, `invalidated`, or used). Migration `0073` introduced the single-active rule, and `0106` records the consumed reason. Links have no expiry (migration `0083`; see file 32, gap 5). `case_merchant_requests.token_id` has no foreign key (file 32, gap 11).
- **Google Drive:** when the owner saves reviews on a Documents Review case, each reviewed document is moved in Google Drive: approved documents go to `KYC Documents / Approved Documents`, and rejected documents go to `KYC Documents / Rejected Documents / Round NN` (`PRIVATE_KYC_APPROVED_PATH`, `PRIVATE_KYC_REJECTED_PATH`, `getRejectedRoundFolderName`, `backend/src/modules/merchants/merchant-drive-folders.ts`). The round number is the count of earlier resubmission-sent history rows plus one (`prepareDocumentReviewDocumentMoves`, `case-documents-review.service.ts`). This is why the merchant's resubmitted files land cleanly and the rejected versions stay separate.
- **Email:** the resubmission email is the `document-resubmission` template (`backend/src/modules/email/templates/document-resubmission.tsx`, subject constant `DOCUMENT_RESUBMISSION_EMAIL_SUBJECT`). Delivery is tracked in `email_log` and can block a successful close (file 12). The public link is validated by `validateToken`: an unknown link returns `404 "Resubmission link not found."`; a used link returns `410 "This resubmission link has already been used."`; a superseded or invalidated link, or one whose case is closed or whose merchant is terminated or deleted, returns `410 "This resubmission link is no longer active."` (file 06 covers the public form).

## Data, validation and edge cases

| Situation | What happens |
|---|---|
| **Unknown field** | Saving a review for a field name the backend does not recognise returns `400 'Unknown review field "…"'.` A document id (`doc_<id>`) that does not belong to this merchant returns `400 'Unknown review field "doc_<id>": the document does not belong to this merchant.'`. A field name already reviewed on this case is accepted, so it can be cleared (`assertReviewableFieldNames`). |
| **Rejected without remarks** | Rejected by validation before anything is saved ("Remarks are required for rejected fields."). |
| **No rejected fields** | Sending for resubmission returns `400 "There are no rejected fields to send for resubmission."` |
| **Locked while waiting** | Field reviews cannot be changed while the case is `awaiting_merchant`. The owner must wait for the merchant to resubmit (or move the case back to `working` manually) before editing rejections. |
| **Active links** | At most one delivered link and one pending preview link are active per case (see Storage above). Regenerating the link issues a delivered link that supersedes the older ones, and writes `resubmission_link_regenerated`. |
| **Sub-merchant ids must exist** | Each id is checked against the draft catalogue (`sub_merchant_draft_templates`), not against the merchant's own sub-merchants. An unknown id returns `400 "One or more sub-merchant selections are invalid."`. Duplicate ids are removed first. |
| **File proof** | Manual-send screenshots go through `validateEmailProofFile`: at most 10 MB (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`, `backend/src/lib/storage/file-limits.ts`), MIME type JPEG, PNG or WebP (`EMAIL_PROOF_MIME_TYPES`, `case-constants.ts`), and a file-content check. Wrong type returns `400 "Screenshot must be a JPEG, PNG, or WebP image."` (`case-upload-validation.ts`). |
| **Reassignment** | When the case changes owner, previewed (not yet sent) links are revoked with reason `case_reassigned`. Links the merchant already has keep working (file 12). |

> ⚠️ **Not found in the code reviewed:** a limit on how many resubmission rounds a merchant may go through; any automatic reminder if the merchant never resubmits. Links have no expiry time: migration `0083_drop_resubmission_token_expiry` removed it, so links are valid until they are used, superseded or invalidated (file 32, gap 5).

## What happens next — in plain words

- **For the merchant:** if anything was rejected, they get an email with a link to fix only the rejected items — they do not have to fill the whole form again. They change just those fields or re-upload just those documents, submit, and wait. If everything was approved, they hear nothing from this step; their application simply moves on.
- **For the team:** once this case closes successfully, the merchant is ready for the next steps in the chain — the sub-merchant selection made here is what the EP Sub-Merchant Form queue (file 14) and the WordPress Website queue (file 18) work from, so a wrong selection here follows the merchant downstream.
- **If the case closes unsuccessfully,** the merchant's application stops at this step. Nothing is sent to the merchant by this close itself; a fresh application (file 04) is the way back in.
- **If the merchant never resubmits,** the case simply waits in `awaiting_merchant`. Nothing in the code reviewed chases them or closes the case for them — see the questions below.

## Errors

| Result | Meaning |
|---|---|
| `400` | `Unknown review field "…".` / "Remarks are required for rejected fields." / "Rejection changes are locked while awaiting merchant resubmission." / "Field reviews can only be saved while the case is working." / "Field reviews can only be saved in an in-progress stage." / "There are no rejected fields to send for resubmission." / "The case must be in the working stage to send for resubmission." / "The case must be in the working or awaiting-merchant stage to send for resubmission." (preview) / "There are no rejected fields to resubmit." (regenerate-link) / "The case must be awaiting the merchant to regenerate its resubmission link." (regenerate-link) / "One or more sub-merchant selections are invalid." / "Sub-merchant selection is only available for document review cases." / "Sub-merchants can only be selected while the case is working." / "Resubmission is only available for documents-review cases." / "Case has no current stage." — from `case-documents-review.service.ts` and `case-communications.service.ts`. |
| `403` | "Only the case owner can save field reviews." / "Only the case owner can select sub-merchants." / "Only the case owner can send for resubmission." / "Only the case owner can regenerate the resubmission link." — owner-only checks; the queue work-access check applies as well. "Automatic email sending is disabled. Use the manual email workflow." / "Manual email sending is disabled. Use the automatic email workflow." — email-mode switches. |
| `404` | "Case not found." / "Merchant not found." / "Resubmission link not found." (public link, file 06). |
| `409` | "This case has already been sent for resubmission." (a second send while the case is already reserved). "This email preview is no longer valid. Load the preview again." (manual confirm with a stale preview). |
| `410` | "This resubmission link is no longer active." / "This resubmission link has already been used." (public link, file 06). |
| `500` | "Failed to save sub-merchant selection." — a save failure, not a user error. "No awaiting_merchant stage configured for this queue." — a queue-configuration problem. |

## What to check — is this what you intended?

- [ ] **Sub-merchant required:** the close checklist demands at least one sub-merchant selected. Should a merchant with genuinely no sub-merchants be able to close Documents Review without one, or is the selection always required?
- [ ] **Link expiry:** resubmission links no longer expire (migration 0083 removed expiry). Is that intended, or should a link stop working after some days?
- [ ] **Round limit:** is there a maximum number of resubmission rounds before the case should be closed as unsuccessful, or can the back-and-forth go on indefinitely?
- [ ] **Reminders:** should the merchant get an automatic reminder if they do not resubmit within a few days? Nothing in the code reviewed sends one.
- [ ] **Selection source:** the owner picks sub-merchants from the global draft catalogue, and the backend does not check that they belong to the merchant. Should the choice be limited to this merchant's own sub-merchants?
- [ ] **Recipient:** the email goes to the "submitter" or the "business" address. Who are those two people in practice, and is the default (submitter) the right one?
- [ ] **Rejected documents in Drive:** when a document is rejected, the file is moved to a rejection-round folder in Google Drive. Should the merchant still be able to see the rejected version, or is hiding it the point?

---
*Sources: `frontend/src/features/cases/case-detail/renderers/documents-review-renderer.tsx`, `frontend/src/features/cases/case-detail/renderers/documents-review-draft-context.tsx`, `frontend/src/features/cases/case-detail/rejection-rounds-card.tsx`, `frontend/src/features/cases/case-detail/documents-review-summary-modal.tsx`, `frontend/src/components/case-email/manual-email-panel.tsx`, `frontend/src/components/case-email/email-mode-choice.tsx`, `frontend/src/components/case-email/email-recipient-select.tsx`, `frontend/src/components/case-email/email-delivery-badge.tsx`, `frontend/src/components/case-email/whatsapp-message-panel.tsx`, `frontend/src/routes/onboarding-form.resubmit.$token.tsx`, `frontend/src/apis/cases.ts`, `backend/src/modules/cases/case-documents-review.service.ts`, `backend/src/modules/cases/document-review-state.ts`, `backend/src/modules/cases/case-resubmission-tokens.service.ts`, `backend/src/modules/cases/field-labels.ts`, `backend/src/modules/merchants/merchants.schemas.ts`, `backend/src/modules/merchants/merchant-drive-folders.ts`, `backend/src/modules/email/templates/document-resubmission.tsx`, `backend/src/lib/storage/file-limits.ts`, `backend/src/modules/cases/case-communications.service.ts`, `backend/src/modules/cases/case-communication-helpers.ts`, `backend/src/modules/cases/case-upload-validation.ts`, `backend/src/modules/cases/case-constants.ts`, `backend/src/modules/cases/case-flow.service.ts` (`triggerStartCasesForMerchant`), `backend/src/modules/cases/case-stage.service.ts`. Related files: 04 (public form / required documents), 05 (documents), 06 (resubmission form), 12 (case lifecycle / email blocking), 14 (EP Sub-Merchant Form), 18 (WordPress Website).*
