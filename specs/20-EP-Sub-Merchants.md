# 20 — EP Sub-Merchants

## At a glance

| | |
|---|---|
| **What it is** | Sub-merchants are separate sellers that trade under the main merchant (for example on a WordPress/WooCommerce site). Each sub-merchant needs its own EP Sub-Merchant Form case: staff fill in a final form for that sub-merchant and email it, so the sub-merchant can be set up. |
| **Who can use it** | The EP page and trigger are for `super_admin`, `admin`, and agents with working access to an EP queue. Inside an EP case, only the case owner can do the form work. |
| **Where it lives** | EP Sub-Merchants page `/cases/ep-sub-merchants` · EP queue (`sub_merchant_form`, prefix `SM`, name "EP Sub-Merchant Form", slug `sub-merchant-form`). |
| **What it creates** | One EP case per merchant + sub-merchant (`status: new`, no owner) from the EP page trigger. Case-flow start rules or close triggers that target the EP queue also create EP cases, one per sub-merchant in the latest Documents Review selection, and skip the trigger's WordPress and re-trigger checks (see Data, `case-flow.service.ts`). Each EP case gets a `sub_merchant_form_details` row. |
| **Main API** | `GET /api/cases/ep-sub-merchant/merchants` · `POST /api/cases/ep-sub-merchant/trigger` · case work: `PUT /api/cases/:id/sub-merchant-form/selection`, `POST /api/cases/:id/sub-merchant-form/final-form`, `POST /api/cases/:id/sub-merchant-form/email-proof` |
| **Main code** | Frontend: `src/routes/_app.cases.ep-sub-merchants.tsx` + `src/features/ep-sub-merchants/ep-merchants-table.tsx` · Backend: `src/modules/cases/ep-sub-merchant.service.ts` (761 lines) + `src/modules/cases/sub-merchant-form-case.service.ts` (434 lines) |
| **Success looks like** | Every selected sub-merchant has a successful EP case — the merchant shows as `completed` on the EP page. |

> ⚠️ **"EP" is not spelled out anywhere in the code reviewed.** It is used only as the queue/workflow name, so this spec keeps the name as it appears. The sub-merchant email body is addressed to "Dear Easypaisa Team" (`sub-merchant-form-renderer.tsx`, `buildEmailBody`), which suggests EP means Easypaisa, but the code does not say so.

## In plain words — for a non-technical reader

Some merchants sell through sub-merchants — separate sellers trading under the main merchant, for example on a WordPress/WooCommerce site. Each sub-merchant needs its own form filled in and emailed so it can be set up. Staff first open the EP Sub-Merchants page, see which merchants and sub-merchants still need a case, and start one case per sub-merchant — but only after the merchant's WordPress case has closed successfully. The sub-merchant is inherited automatically from the Documents Review selection, so there is no picker on the case page. The case owner uploads the finished Final Form, staff send it from Gmail by hand, and the owner uploads a screenshot of the sent email. When every selected sub-merchant has a successful EP case, the merchant shows as completed. What happens next: the sub-merchant is set up from the emailed final form; a failed EP case can be started again, a successful one cannot.

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `GET /api/cases/ep-sub-merchant/merchants`, `POST /api/cases/ep-sub-merchant/trigger` (`{ merchantId, subMerchantId }` → `201`). Case work (all in `cases.routes.ts`): `PUT /api/cases/:id/sub-merchant-form/selection` (JSON, `selectSubMerchantFormSchema`), `POST /api/cases/:id/sub-merchant-form/final-form` (multipart: `file`, `subMerchantKey` UUID), `POST /api/cases/:id/sub-merchant-form/email-proof` (multipart: `file`). These three are not in `backend/apis/cases.md`. The frontend calls only the final-form and email-proof endpoints (`frontend/src/apis/cases.ts`); no frontend caller was found for the selection endpoint. |
| Request / response | Trigger returns the new case in `POST /api/cases` shape (`caseNumber` prefix `SM`, `status: 'new'`, `ownerId: null`, `priority` copied from the merchant's `priority`, not fixed); list is keyset-paginated (`cursor`, `limit` 1–100, default 30; `nextCursor`, `hasMore`, `limit`, `total` — total computed only on the first page) |
| Validation | Trigger checks in one transaction: merchant exists (deleted merchants count as missing, `404 Merchant not found.`) and is not terminated, EP queue active, WordPress case closed successfully, sub-merchant in the latest Documents Review selection, no open or successful EP case for that pair, checked across every EP case for the pair and not only the latest (only an unsuccessful close allows re-trigger); concurrent triggers serialised with `pg_advisory_xact_lock`; final form must be for the inherited sub-merchant |
| Database | `sub_merchant_form_details` (`caseId` PK, `subMerchantKey` varchar 80, `subMerchantName` varchar 160, `draftUrl`, `finalFormFileId` → `case_files`, `emailStatus`, `emailLogId`, `emailSentAt`, `emailRecipient` varchar 255, `createdAt`, `updatedAt`); email status enum `not_sent` \| `sent` \| `failed` with a consistency check; file kinds `sub_merchant_final_form`, `sub_merchant_email_proof` |
| Auth / roles | Page/trigger: `super_admin`, `admin`, or agents with EP-queue working access (`assertCanManageEpCases`, session flag `canManageEpCases`); case work: case owner only, Working status; `POST /api/cases` and `POST /api/cases/bulk-create` reject EP queues with `409` (`EP Sub-Merchant cases can only be triggered from the EP Sub-Merchants page.`). An agent without EP working access gets `403 You do not have working access to the EP Sub-Merchant queue.` |
| Errors | `404 Merchant not found.`; `409` "EP cases cannot be triggered for terminated merchants." / "The EP Sub-Merchant queue is not active." / "The WordPress case must be closed successfully before an EP case can be triggered." / "This sub-merchant was not selected in the Documents Review case." / "EP case SM-… is already open for this sub-merchant." or "…was already completed for this sub-merchant."; form work: `403 Only the case owner can update this case.`, `400 The case must be in the working stage.`, `400 This action is only available for EP Sub-Merchant Form cases.`, `400 Invalid sub-merchant selection.`, `400 Final Form must be uploaded for the inherited sub-merchant.`, `400 Upload the Final Form before uploading proof.` |
| Integrations / limits | Queues `sub_merchant_form` (`SM`), `wordpress` (`WP`), `document_review` (`DR`); final form MIME types `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.pdf`, `.doc`, `.docx`); list filters by merchant status `pending` \| `testing` \| `live`, WordPress `successful` \| `not_successful`, progress `not_triggered` \| `open` \| `unsuccessful` \| `completed`; Case-flow rules that target the EP queue create EP cases automatically (see Data) |

## How it works — the journey

```
Staff open Cases → EP Sub-Merchants (/cases/ep-sub-merchants)
        ↓
Page lists non-terminated merchants + their selected sub-merchants
        ↓
Staff pick one merchant + one sub-merchant → trigger dialog
        ↓
Backend checks: not terminated, EP queue active, WordPress
closed successfully, sub-merchant in latest Documents Review
selection, no blocking EP case already exists
        ↓
EP case created (SM-…, status new, no owner) → 201
        ↓
Owner takes it (working) → sub-merchant inherited from the
Documents Review selection → uploads the completed Final Form
→ staff send it from Gmail by hand → owner uploads the sent-email
screenshot → closes (checklist: sub-merchant, Final Form, screenshot)
        ↓
Case closes successfully (or unsuccessfully — only an
unsuccessful close allows a re-trigger)
```

## Two things this file covers (easy to confuse)

| # | Thing | What it is |
|---|---|---|
| 1 | **The EP Sub-Merchants page** (`/cases/ep-sub-merchants`) | A list of merchants and, for each one, which sub-merchants still need an EP case. Staff trigger EP cases from here, one sub-merchant at a time. |
| 2 | **The EP Sub-Merchant Form case itself** (queue workflow type `sub_merchant_form`) | The case an agent works once it has been triggered — pick the form, upload the completed final form, and send it by email. |

## Who can use it

| Action | Who | Checks |
|---|---|---|
| EP page + trigger action | `super_admin`, `admin`, and agents who have **working access to an EP queue** | Backend check `assertCanManageEpCases` in `backend/src/modules/cases/ep-sub-merchant.service.ts`: anyone whose role is not `agent` passes; an agent must have an EP queue id in their `workQueueIds`. Frontend mirrors this with the session flag `canManageEpCases`. Navigation entry "EP Sub-Merchants" (`/cases/ep-sub-merchants`) is only shown when `canManageEpCases` is true (`frontend/src/config/navigation.ts`). |
| Form actions inside an EP case (upload final form, upload sent-email screenshot). The backend selection endpoint also exists, but the frontend never calls it. | The **case owner**, with working access to the case, and status `working` | Same owner/working pattern as the Live case. A non-owner gets `403` ("Only the case owner can update this case."). |
| Ordinary manual case creation | Cannot create EP cases | `POST /api/cases` and `POST /api/cases/bulk-create` reject EP Sub-Merchant Form queues with `409`. EP cases are created only through the trigger endpoint below. |

## Step by step

### A. Finding merchants that need an EP case

1. Staff open **Cases → EP Sub-Merchants** (`/cases/ep-sub-merchants`).
2. The page lists non-terminated, non-deleted merchants. Terminated merchants are excluded (`merchants.status <> 'terminated'`, `deletedAt IS NULL`).
3. For each merchant the page shows:

| Field | Value / meaning |
|---|---|
| Merchant status | `pending`, `testing` or `live` (filter values) |
| WordPress status | `successful` or `not_successful` — whether the merchant has a WordPress Website case closed as successful |
| Selected sub-merchants | The sub-merchants selected in the merchant's **latest Documents Review case** (`document_review_details`, the most recently updated selection). Each selected sub-merchant shows whether it `canTrigger` and its `latestCase`, if any |
| `otherCases` | EP cases for sub-merchants outside the current selection, so they stay visible |
| `isEligible` | Whether the merchant can have an EP case triggered at all (WordPress successful — see below) |

4. Staff filter by merchant status, WordPress outcome, and progress: `not_triggered`, `open`, `unsuccessful`, `completed`. A merchant with several sub-merchants can match more than one progress value, and is `completed` only when **every** selected sub-merchant has a successful EP case.

| Progress value | Matches a merchant when (`progressCondition`, `ep-sub-merchant.service.ts`) |
|---|---|
| `not_triggered` | Some selected sub-merchant has no EP case at all, or there is no selection and no EP case for the merchant. |
| `open` | Any EP case for the merchant is not closed (not limited to the selection). |
| `unsuccessful` | For some selected sub-merchant, its latest EP case is closed as unsuccessful. |
| `completed` | There is at least one selected sub-merchant, and every one has a closed, successful EP case. |

The page's default filters (`DEFAULT_EP_PROGRESS_FILTER` = `not_triggered,open,unsuccessful`, `DEFAULT_EP_WORDPRESS_FILTER` = `successful`, `ep-sub-merchants.schema.ts`) hide completed merchants and merchants without a successful WordPress case until the filters are changed.
5. Staff can search by business name, submitter email, owner name, or merchant number, and sort by `createdAt` (default), `merchantNumber`, `businessName`, `ownerFullName`, `status` or `updatedAt`, ascending (default) or descending.

### B. Triggering one EP case

1. Staff pick one merchant and one sub-merchant and confirm in the trigger dialog (`ep-trigger-dialog.tsx`).
2. The backend checks, inside one transaction:

| Check | Failure |
|---|---|
| The merchant exists (deleted merchants count as missing) | `404` "Merchant not found." |
| The merchant is not terminated | `409` "EP cases cannot be triggered for terminated merchants." |
| An EP queue exists and is active (`lifecycle = 'active'`) | `409` "The EP Sub-Merchant queue is not active." |
| The merchant has a WordPress case closed as successful | `409` "The WordPress case must be closed successfully before an EP case can be triggered." |
| The sub-merchant is in the merchant's latest Documents Review selection | `409` "This sub-merchant was not selected in the Documents Review case." |
| No blocking EP case already exists for that merchant + sub-merchant | A case that is still open blocks with `409` ("…is already open…"). A case closed as successful blocks with `409` ("…was already completed…"). Only a case closed as **unsuccessful** allows a re-trigger. |
| Concurrent triggers | Serialised with a Postgres advisory lock (`pg_advisory_xact_lock`) for the same merchant + sub-merchant, so only one succeeds. |

The page's button reads **Re-trigger** when every triggerable sub-merchant already has an EP case, and **Trigger** otherwise (`getTriggerState`, `ep-merchants-table.tsx`). When no sub-merchant can be triggered, the button is disabled with one of four reasons: WordPress not successful, no sub-merchant selected in Documents Review, EP cases already open for every selected sub-merchant, or every selected sub-merchant already completed.

3. On success the endpoint returns `201` with the new case in the same shape as `POST /api/cases`:

| Field | Value |
|---|---|
| `id` | New case id |
| `caseNumber` | Prefix `SM`, for example `SM-000000001` |
| `queueId` / `queueName` | EP queue |
| `merchantId` / `merchantName` | The merchant |
| `ownerId` / `ownerName` | `null` / `null` |
| `status` | `'new'` |
| `priority` | Copied from the merchant's `priority` (`createCaseInTransaction`, `case-query.service.ts`) |
| `closedAt` | `null` |
| `createdAt` / `updatedAt` | Timestamps |

The case starts as `new` with no owner. The trigger calls the same `createCaseInTransaction` helper as manual creation, so it writes a `case_created_manually` history row with the triggering user as actor (`case-query.service.ts`).

### C. Working the EP Sub-Merchant Form case

1. The owner takes the case to Working.
2. The sub-merchant is inherited, not picked. `ensureInheritedSubMerchantFormDetails` (`case-detail-lookups.ts`) copies it from the latest Documents Review selection (the first one, when several are selected) into `sub_merchant_form_details` and writes history `sub_merchant_inherited`. The draft (name, seller code and Google Drive draft link) comes from the configured sub-merchant draft (see file 26). The case page shows the sub-merchant, its draft link, a generated email subject and body with Copy buttons, and a "Download" button that saves `ep-sub-merchant-email.txt`.
3. The owner uploads the completed Final Form (PDF, `.doc` or `.docx` only, see Data). The system does not send the email. The page says to attach the files in Gmail and send them by hand, then upload a screenshot of the sent mail (`POST .../email-proof`). That upload is what sets the email state to `sent`, with recipient `Manual Gmail` and no `email_log` row.
4. Successful close (normal close action): the close checklist (`case-close-checklist.ts`, workflow `sub_merchant_form`) blocks it until the case has a sub-merchant (`Select a sub-merchant in the document review case before closing this case.`), a Final Form (`Upload the Final Form before closing this case.`) and a sent-email screenshot (`Upload the sent-email screenshot before closing this case.`). Unsuccessful close is a separate `close_unsuccessful` action. It requires the owner and a reason, skips the checklist, and writes `closed_unsuccessful`. An unsuccessful close is what allows the same sub-merchant to be triggered again from the EP page.

## How it is implemented — Frontend

| File | What it does |
|---|---|
| `frontend/src/routes/_app.cases.ep-sub-merchants.tsx` | Page route, path `/cases/ep-sub-merchants` |
| `frontend/src/features/ep-sub-merchants/ep-merchants-table.tsx` (566 lines) | Merchant rows, per-sub-merchant status, filters, sorting, search and pagination |
| `frontend/src/features/ep-sub-merchants/ep-case-status.tsx` | Status display |
| `frontend/src/features/ep-sub-merchants/ep-trigger-dialog.tsx` | Trigger dialog |
| `frontend/src/apis/ep-sub-merchants.ts` (38 lines) | List and trigger calls against `/api/cases/ep-sub-merchant/merchants` and `/api/cases/ep-sub-merchant/trigger` |
| `frontend/src/hooks/use-ep-sub-merchants-query.ts` | Query hook |
| `frontend/src/features/cases/case-detail/renderers/sub-merchant-form-renderer.tsx` (`SubMerchantFormRenderer`) | EP case renderer, chosen by workflow type `sub_merchant_form`. Covers the inherited sub-merchant, the Final Form upload, the Gmail email text (copy and download buttons), and the sent-email screenshot upload. It does not call the selection endpoint. |
| `frontend/src/schemas/ep-sub-merchants.schema.ts` | Schema |

The EP status is also used as a filter on the merchants list: `epCaseStatusFilterValues` in `ep-sub-merchant.service.ts` are `not_created`, `new`, `working`, `awaiting_merchant`, `closed_successful`, `closed_unsuccessful`. Note that `closed_unsuccessful` only counts while it is the latest case — a re-trigger supersedes it.

## How it is implemented — Backend

| File | What it does |
|---|---|
| `backend/src/modules/cases/ep-sub-merchant.service.ts` (761 lines) | `listEpMerchants`, `triggerEpCase`, `assertCanManageEpCases`, `getEpQueueIds`, `getLatestEpCases`, `buildEpCaseStatusFilter`, plus the progress/WordPress/selection SQL fragments |
| `backend/src/modules/cases/sub-merchant-form-case.service.ts` (434 lines) | `loadSubMerchantFormCase`, `selectSubMerchantForm`, `uploadSubMerchantFinalForm`, `uploadSubMerchantEmailProof`. The inheritance helper `ensureInheritedSubMerchantFormDetails` is in `case-detail-lookups.ts`, and the flow-created EP case logic (`getFlowSubMerchants`, `createConfiguredCases`) is in `case-flow.service.ts`. |

**Routes** in `backend/src/modules/cases/cases.routes.ts`:

| Endpoint | Body | Returns |
|---|---|---|
| `GET /api/cases/ep-sub-merchant/merchants` | — | Paginated merchant list (see below) |
| `POST /api/cases/ep-sub-merchant/trigger` | `{ merchantId, subMerchantId }` (strict object, both UUIDs) | `201` with the new case |
| `PUT /api/cases/:id/sub-merchant-form/selection` | `{ subMerchantKey }` | The `sub_merchant_form_details` row. Not called by the frontend. |
| `POST /api/cases/:id/sub-merchant-form/final-form` | multipart `file`, `subMerchantKey` (UUID) | The saved `case_files` row |
| `POST /api/cases/:id/sub-merchant-form/email-proof` | multipart `file` | The saved `case_files` row |

The EP queue is found by workflow type, never by slug or name: `EP_WORKFLOW = 'sub_merchant_form'`, `WORDPRESS_WORKFLOW = 'wordpress'`, `DOCUMENT_REVIEW_WORKFLOW = 'document_review'`. The seed data (`backend/sql/seed-queues.sql`) names it "EP Sub-Merchant Form", slug `sub-merchant-form`, prefix `SM`.

**List pagination:** `listEpMerchants` is keyset-paginated (`cursor`, `limit` 1–100, default 30). The total count is only computed on the first page; later pages reuse it. The response includes `nextCursor`, `hasMore`, `limit` and `total`.

**Latest Documents Review selection:** the selection belonging to the most recently updated `document_review_details` row across the merchant's Documents Review cases. That single selection is what the EP page and the trigger both use — an older selection does not count.

**Form selection:** `selectSubMerchantForm` upserts one row in `sub_merchant_form_details` (keyed by `caseId`) and writes history action `sub_merchant_selected`. The draft URL is copied from the configured sub-merchant template's Google Drive link. It accepts any sub-merchant draft id (`400 Invalid sub-merchant selection.` if unknown) and does not check it against the Documents Review selection. No frontend caller was found.

**Final form upload:** `uploadSubMerchantFinalForm` validates the file, stores it in the private Drive folder section "Sub-Merchant Final Form", writes `case_files` kind `sub_merchant_final_form` (one per case; a re-upload replaces it and the old Drive file is superseded), resets the email state to `not_sent`, and writes history `sub_merchant_final_form_uploaded`. It requires the inherited sub-merchant details to exist ("Select a sub-merchant in the document review case before uploading the Final Form."), and rejects a file for a different sub-merchant ("Final Form must be uploaded for the inherited sub-merchant.").

**Email state** for the EP form lives in `sub_merchant_form_details` (see "Data" below). The history timeline labels `sub_merchant_form_email_sent` as "Final Form email sent", `sub_merchant_form_email_failed` as "Final Form email failed", and `sub_merchant_manual_email_proof_uploaded` as "Manual email proof uploaded". No backend code writes `sub_merchant_form_email_sent` or `sub_merchant_form_email_failed`; the proof upload writes `sub_merchant_manual_email_proof_uploaded` instead. The two email labels are therefore dormant.

> ⚠️ **API doc gap:** `backend/apis/cases.md` documents only the list and trigger endpoints for EP. The three case-work endpoints above are in `cases.routes.ts` but not in the API doc (see file 31).

## Data, validation and edge cases

| Item | Detail |
|---|---|
| **Queues involved** | EP Sub-Merchant Form (`sub_merchant_form`, prefix `SM`), WordPress Website (`wordpress`, prefix `WP`), Documents Review (`document_review`, prefix `DR`) |
| **Merchant statuses on the EP page** | `pending`, `testing`, `live`. Terminated and deleted merchants never appear. |
| **`sub_merchant_form_details`** (`backend/src/db/schema.ts`) | `caseId` (primary key), `subMerchantKey` (varchar 80), `subMerchantName` (varchar 160), `draftUrl` (text), `finalFormFileId` (references `case_files`, on delete set null), `emailStatus`, `emailLogId`, `emailSentAt`, `emailRecipient` (varchar 255), `createdAt`, `updatedAt` |
| **Email status enum** `sub_merchant_form_email_status` | `not_sent`, `sent`, `failed`. A database check enforces consistency: `not_sent` means no `emailSentAt` and no `emailLogId`; `sent` means `emailSentAt` is set; `failed` means no `emailSentAt`. |
| **Final form file rules** (`case-constants.ts`, `case-upload-validation.ts`) | `SUB_MERCHANT_FINAL_FORM_MIME_TYPES` — `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; extensions `.pdf`, `.doc`, `.docx`. Wrong type: `400 Final Form must be a PDF, DOC, or DOCX file.` Size limit is 10 MB (`assertFileSizeLimit`, `lib/storage/file-limits.ts`), plus a file-content signature check. The same set is reused for agreement files (`AGREEMENT_FILE_MIME_TYPES` / `AGREEMENT_FILE_EXTENSIONS`). ⚠️ The Final Form upload text on the case page says "Maximum size is 1 MB", but the backend accepts up to 10 MB. |
| **Email proof file kind** | `sub_merchant_email_proof` (`SUB_MERCHANT_EMAIL_PROOF_KIND`); final form kind: `sub_merchant_final_form` |
| **Sent-email screenshot rules** | JPG, PNG or WEBP only (`validateWordpressScreenshotFile`, the WordPress screenshot validator), 10 MB. Wrong type: `400 Screenshots must be JPG, PNG, or WEBP files.`. Upload needs a Final Form first (`400 Upload the Final Form before uploading proof.`). On success the email state becomes `sent` (`email_sent_at` = now, recipient `Manual Gmail`, `email_log_id` = null) and history `sub_merchant_manual_email_proof_uploaded` is written. Uploading again replaces the screenshot. |
| **Re-trigger rule, precisely** | A new EP case for the same merchant + sub-merchant is allowed only when every existing EP case for that pair is closed as unsuccessful. One open case, or one successful case, blocks with `409`. There is no "force" option in the code reviewed. |
| **WordPress rule, precisely** | The merchant needs *a* WordPress case closed as successful. A later WordPress case does not undo eligibility: the list logic keeps a merchant eligible once a successful WordPress case exists, even if a newer WordPress case exists. |
| **Selection rule, precisely** | The sub-merchant must be in the *latest* Documents Review selection. If the selection changes later, an EP case already created stays valid; only new triggers use the new selection. |
| **Case-flow rules can create EP cases** | `case-flow.service.ts` (`getFlowSubMerchants`, `createConfiguredCases`): when a start rule or close trigger targets the EP queue (`sub_merchant_form`), the engine creates one EP case per sub-merchant in the latest Documents Review selection, ordered by name, with history `case_created_from_flow_start` or `case_created_from_flow_close`. It sets the sub-merchant from the selection and does not apply the EP page's WordPress gate or its re-trigger rule. Its only duplicate check is `onlyIfTargetMissing`: a target case already existing for that merchant and sub-merchant is skipped, whatever its status. With no selection it fails with `409 Select at least one sub-merchant in document review before creating EP Sub-Merchant Form cases.`. A start rule that targets the EP queue therefore fails at form submission, because no selection exists yet (see file 21). The configuration docs say a queue not referenced by case-flow rules can still be triggered manually, which EP is through its own page. |
| **Merchants list EP filter** | `GET /api/merchants` accepts `epStatus` (comma-separated), handled by `buildEpCaseStatusFilter` in `ep-sub-merchant.service.ts` (`merchants.service.ts`, `epStatus` in `merchants.schemas.ts`). |
| **`open` progress filter scope** | `open` matches any merchant with an open EP case for any sub-merchant, including ones outside the current selection. `unsuccessful` looks only at the latest EP case for each selected sub-merchant. |
| **What "completed" means on the page** | Every selected sub-merchant has a successful EP case. One missing or unsuccessful sub-merchant means the merchant is not `completed`, even if the others are done. |
| **Empty selection** | If the merchant has no Documents Review selection and no EP cases, the progress filter treats the merchant as `not_triggered`. |

## What to check — is this what you intended?

- [ ] **What does "EP" stand for?** What does "EP" stand for in your business, and should the page and the queue be renamed to something a new starter would understand?
- [ ] **WordPress gate:** is WordPress-successful the right gate for triggering an EP case, or should some merchants be triggerable without a WordPress case (for example non-WordPress merchants)?
- [ ] **Successful case blocks forever:** should a successful EP case really block forever — is there ever a case where the same sub-merchant needs a second, fresh EP case after a successful one (for example a corrected form)?
- [ ] **Selection changes:** when the Documents Review selection changes, should EP cases that were triggered from the old selection be cancelled, or is "already created stays valid" correct?
- [ ] **Who can trigger:** who should be able to trigger EP cases — is agent access by EP queue working access the right rule, or should it be admin-only?
- [ ] **Owner-only case work:** the EP case work (select form, upload final form, send email) is owner-only and requires Working status. Is that right, or should an admin be able to step in on someone else's EP case?
- [ ] **Flow-created EP cases:** a case-flow start rule or close trigger that targets the EP queue creates EP cases without the EP page's WordPress gate or re-trigger rule. Is that intended, or should flow-created EP cases follow the same rules as the EP page?
- [ ] **Who sends the email:** staff send the EP form from Gmail by hand, and the app only stores a screenshot. Should the app send the email itself, as the agreement and MID flows do?
- [ ] **Unused selection endpoint:** `PUT /api/cases/:id/sub-merchant-form/selection` exists in the backend, but no frontend code calls it. Keep it or remove it?
- [ ] **Final Form size text:** the case page says 1 MB and the backend allows 10 MB. Which limit do you want, and should the copy be fixed to match?

---
*Sources: `frontend/src/routes/_app.cases.ep-sub-merchants.tsx`, `frontend/src/features/ep-sub-merchants/ep-merchants-table.tsx`, `frontend/src/features/ep-sub-merchants/ep-case-status.tsx`, `frontend/src/features/ep-sub-merchants/ep-trigger-dialog.tsx`, `frontend/src/apis/ep-sub-merchants.ts`, `frontend/src/hooks/use-ep-sub-merchants-query.ts`, `frontend/src/features/cases/case-detail/renderers/sub-merchant-form-renderer.tsx`, `frontend/src/schemas/ep-sub-merchants.schema.ts`, `frontend/src/config/navigation.ts`, `backend/src/modules/cases/ep-sub-merchant.service.ts`, `backend/src/modules/cases/sub-merchant-form-case.service.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/sql/seed-queues.sql`, `backend/src/modules/cases/case-flow.service.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/case-upload-validation.ts`, `backend/src/modules/cases/case-constants.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/cases/case-detail-lookups.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/modules/cases/case-access.service.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/lib/storage/file-limits.ts`, `backend/src/db/schema.ts`, `backend/apis/cases.md`, `frontend/src/apis/cases.ts`. Related files: 14 (EP Sub-Merchant Form), 18 (WordPress Website), 26 (sub-merchant draft configuration).*
