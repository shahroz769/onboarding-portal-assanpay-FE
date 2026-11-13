# 05 — Document Requirements and Uploads

## At a glance

| | |
|---|---|
| **What it is** | Exactly which documents each business type must (and may) upload, and the checks every file goes through — size, type, file name, and a check that the file's contents really are what its name claims. |
| **Who can use it** | Merchants upload (public, no login) on the onboarding form and the resubmission form. Staff never upload merchant documents — they view and approve/reject them. |
| **Where it lives** | Onboarding form Section 7 (`/onboarding-form`) · Resubmission form (`/onboarding-form/resubmit/:token`) |
| **Main API** | `POST /api/public/merchant-form` (documents sent as multipart fields named by document type) |
| **Main code** | Frontend: `src/features/onboarding/document-upload-field.tsx` · Backend: `src/modules/merchants/merchants.schemas.ts`, `src/lib/storage/file-limits.ts`, `src/lib/storage/file-signatures.ts` |
| **Success looks like** | Every required document for the merchant's type passes the checks, lands in Google Drive under `KYC Documents / Pending Review / First Submission`, and is ready for the Documents Review team (file 13). |

## How it works — the journey

```
Merchant picks a merchant type → required/optional document list changes to match
        ↓
Merchant uploads one file per document type
        ↓
Frontend checks size immediately (10 MB) · backend does the real checks
        ↓
File fails → whole submission rejected (400/413/415), nothing uploaded, no merchant created
        ↓
Files pass → uploaded to Google Drive, merchant_documents rows created
        ↓
Each document starts at status pending → reviewer approves or rejects it (file 13)
```

## Who can use it

| Who | Rule |
|---|---|
| **Merchants** | Upload documents in two places, both public and login-free: the onboarding form (`/onboarding-form`, Section 7) and the resubmission form (`/onboarding-form/resubmit/:token`) when a document is rejected. See files 04 and 06. |
| **Staff** | Never upload merchant documents in the code reviewed. Staff view the uploaded documents (as Google Drive links) on the merchant detail page and inside the Documents Review case, and approve or reject each one. Staff-side uploads that do exist in the system (for example, a received signed agreement file, or a sub-merchant form) belong to their own workflows — see files 14 and 15 — not to this document list. |

## The checks every file goes through

| Check | Rule | If it fails |
|---|---|---|
| Size — maximum | At most 10 MB (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`). | `413` "… exceeds the 10 MB limit." |
| Size — minimum | At least 500 bytes. | `400` "Document "x" is too small to be a valid document. Please upload a clear copy." |
| File name | At most 255 characters, and no `/` or `\` in the name. | `400` "… has a file name longer than 255 characters. Please rename it." or "… has an invalid file name." |
| Extension | Must be one of `pdf`, `jpg`, `jpeg`, `png`, `webp`. | `415` "… has an unsupported file type." |
| Declared type agrees | Only when the browser declares one of the four allowed MIME types (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) must it match the extension. Any other declared type skips this check. | `415` "… does not match its declared file type." |
| Content signature | The file's first bytes must match the real signature for its type — so a renamed `.exe` or a PNG saved as `.pdf` is refused. | `415` "… content does not match a supported file signature." (no signature matches) or "… content does not match its declared file type." (a different supported type). |
| Empty or truncated | A 0-byte file is skipped at parse time. A file shorter than its signature needs is refused. | `400` "… is truncated or corrupted." (a 0-byte file reaching the signature check gives "… is empty.") |
| One file per type | Every file field must be a known document type and appear exactly once. | `400` "Unexpected file field "x"." for an unknown field; `400` "Document "x" must be uploaded once." for a repeat. |
| At least one document | At least one document must be uploaded in total. | `400` "At least one document upload is required." |

Content signatures checked (`assertFileContentSignature()` in `backend/src/lib/storage/file-signatures.ts`):

| Type | First bytes must be |
|---|---|
| PDF | `%PDF` |
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| WEBP | `RIFF…WEBP` |

`file-signatures.ts` also recognises Word files (`.doc`: OLE compound header; `.docx`: ZIP header) and an empty-file check. These are not reachable from the public form, because `normalizeMimeType()` accepts only `pdf`, `jpg`, `jpeg`, `png` and `webp`, and 0-byte files are skipped before the check runs.

The file checks are enforced by `assertPublicUploadFile()` (size minimum, file-name length and slashes) and `normalizeMimeType()` (extension and declared MIME type must agree) in `merchants.schemas.ts`, and by `assertFileContentSignature()` in `backend/src/lib/storage/file-signatures.ts`. The frontend checks the file size immediately ("File exceeds 10 MB limit (…).") and only offers the allowed extensions in the file picker. The real checks happen on the backend.

Files that fail are rejected with the whole submission (400, 413, or 415) — nothing is uploaded to Drive and no merchant is created. The merchant must fix the file and submit again.

## Required and optional documents by merchant type

"Base (all types)" is always required: `owner_cnic_front`, `owner_cnic_back`, `next_of_kin_cnic_front`, `next_of_kin_cnic_back`, `utility_bill`.

| Merchant type | Required (in addition to the base five) | Optional |
|---|---|---|
| `sole_proprietorship` | `company_ntn` | `authority_letter`, `taxpayer_registration_certificate` |
| `private_limited_company` | `company_ntn`, `company_incorporation_certificate`, `form_a` | `memorandum_articles`, `form_ii`, `board_resolution`, `certificate_of_commencement` |
| `public_limited_company` | `company_ntn`, `company_incorporation_certificate` | `memorandum_articles`, `form_ii`, `form_a`, `board_resolution`, `certificate_of_commencement` |
| `partnership` | `company_ntn` | `authority_letter`, `partnership_deed`, `form_c` |
| `limited_liability_partnership` | `company_ntn`, `company_incorporation_certificate` | `authority_letter`, `partnership_deed`, `llp_form_iii` |
| `ngo_npo_charity` | `company_ntn`, `company_incorporation_certificate` | `memorandum_articles`, `form_ii`, `form_a`, `board_resolution`, `annual_audited_accounts`, `other_entity_certification`, `secp_section_42_license`, `risk_assessment_documents`, `by_laws_rules_regulations` |
| `trust_society_association` | `company_ntn`, `board_resolution`, `annual_audited_accounts`, `trust_deed`, `trust_registration_certificate`, `trustees_authorized_signatories_cnic`, `proof_of_address` | `tax_exemption_certificate`, `other_supporting_documents` |

The database enum `merchant_document_type` also contains every type above (28 values in total: the five base types plus 23 others). The resubmission route uses the same `getRequiredDocumentTypes()` and `getAllowedDocumentTypes()` functions (`public-resubmission.routes.ts`), so `utility_bill` is required there too, as part of the base five.

## How the document list is defined (code, not configuration)

| Piece | Detail |
|---|---|
| **Base types** | `baseDocumentTypes` in `backend/src/modules/merchants/merchants.schemas.ts` (required for every merchant type): `owner_cnic_front`, `owner_cnic_back`, `next_of_kin_cnic_front`, `next_of_kin_cnic_back`, `utility_bill`. |
| **Per-type map** | `merchantSpecificDocumentMap` (required and optional per merchant type) — see the table above. |
| **All types** | `allDocumentTypes` is the base five, then every type named in the map (de-duplicated with a `Set`), then six trust types appended again (`trust_deed`, `trust_registration_certificate`, `trustees_authorized_signatories_cnic`, `proof_of_address`, `tax_exemption_certificate`, `other_supporting_documents`). Those six are already in the map, so they appear twice. `MAX_FILE_COUNT` equals `allDocumentTypes.length`, which is 34, not 28. The count is only an upper bound, so the duplicates do no harm. |
| **Database enum** | `merchant_document_type` in `backend/src/db/schema.ts` holds 28 types: the five base types plus the 23 distinct types in the per-type map. |
| **Required vs allowed** | `getRequiredDocumentTypes(merchantType)` returns base five + that type's required list. `getAllowedDocumentTypes(merchantType)` returns base five + required + optional. `assertRequiredDocuments()` rejects any uploaded document that is not allowed for the merchant type ("Document … is not allowed for business type …") and any required document that is missing ("Document … is required."). |

## How files are stored

| Step | What happens |
|---|---|
| 1. Parse | `parseMerchantFormData()` in `merchants.schemas.ts`: every text field must appear exactly once; every file field must be a known document type and appear exactly once; empty (0-byte) files are skipped; at least one document must be uploaded in total; then the scalar values are validated and the required-document check runs. An unexpected file field gives 400 "Unexpected file field …". |
| 2. Upload | `createMerchantSubmission()` in `backend/src/modules/merchants/merchants.service.ts` uploads with `GoogleDriveStorageProvider` (`backend/src/lib/storage/google-drive.ts`), up to 10 uploads at a time (`DRIVE_UPLOAD_CONCURRENCY = 10` in `backend/src/lib/concurrency.ts`), naming each file `<documentType><extension>` via `buildDocumentFileName()`. The extension is the lower-cased original one, and the original name is kept separately as `originalName`. For example: `owner_cnic_front.pdf`. |
| 3. Folder | Files go to Google Drive under the merchant's folder (`KYC Documents / Pending Review / First Submission`). |
| 4. Record | Only Drive metadata is stored in `merchant_documents` (see the table below). The whole public multipart request is capped at 225 MB in `backend/src/index.ts` (`publicMultipartMaxSize`), so the total of all files in one submission cannot exceed that either. |
| 5. Review | `merchant_documents.status` starts at `pending`. The Documents Review workflow (file 13) moves individual documents to `approved` or `rejected`; the resubmission flow resets a resubmitted document's status (migration `0107_reset_resubmitted_document_status`). Rejected documents are re-uploaded through the resubmission flow (file 06). The replaced Drive file is marked superseded in the storage ledger (`supersedeStorageObjects` in `public-resubmission.routes.ts`); the code reviewed here does not show where the replacement is placed (see file 06). Approved documents are moved in Drive from Pending Review to the approved area (see files 13 and 28 for the exact folder moves). |

## The `merchant_documents` table

| Column | Detail |
|---|---|
| `id` | UUID. |
| `merchantId` | References `merchants.id`, on delete cascade. |
| `documentType` | The enum above. |
| `originalName` | varchar 255. |
| `mimeType` | varchar 128. |
| `sizeBytes` | Integer, never negative. |
| `googleDriveFileId` | varchar 255, not null. |
| `googleDriveWebViewLink` | Text, not null. |
| `googleDriveDownloadLink` | Text, nullable. |
| `googleDriveFolderId` | varchar 255, not null. |
| `status` | `pending` / `approved` / `rejected`, default `pending`. |
| `createdAt`, `updatedAt` | Timestamps. |

There is no uniqueness rule in the schema reviewed preventing two rows of the same document type for one merchant — the single-upload-per-type rule is enforced by the form parser (one file per field name), not by the database.

## Frontend — how the upload field is built

| Piece | What it does |
|---|---|
| **Upload field** | `frontend/src/features/onboarding/document-upload-field.tsx` — shows the per-file size, accepts the allowed extensions, and reports "File exceeds 10 MB limit (…)" client-side. It also reports "Unsupported file type. Allowed: .pdf, .jpg, .jpeg, .png, .webp" for other extensions. The shared schema (`frontend/src/schemas/merchant-onboarding.schema.ts`) has the same 500-byte minimum and 255-character name limit as the backend. The resubmission page reuses the same field with a replace/remove choice (see file 06). |
| **Form wiring** | `frontend/src/features/onboarding/merchant-onboarding-form.tsx`, Section 7 (Documents): the document list is driven by the selected merchant type; labels come from a `DOCUMENT_LABELS` map, and the next-of-kin documents are relabelled with the chosen relation (for example "Spouse's CNIC Front" instead of "Next Of Kin CNIC Front"; the label is changed with `label.replace('Next Of Kin', …)`). |
| **Submission** | Files are sent as `multipart/form-data` fields whose names are the document types themselves (`owner_cnic_front`, `company_ntn`, …) — see `frontend/src/apis/merchant-onboarding.ts` and file 04. The success screen lists what was submitted. |

## Edge cases and gaps

- **A file that is a valid image but unreadable** (for example, a photo of a blank page) passes every check in this file. Readability is a human review decision in Documents Review, not a system check.
- **Signature families beyond the public four.** `file-signatures.ts` also knows Word `.doc` and `.docx` (OLE and ZIP signatures), but the public form and resubmission only accept the four extensions above, so Word files are refused before the signature check runs.
- **The 500-byte minimum is a guess, not a measurement.** The code comment says it is "smaller than any real scan or PDF; the smallest genuine upload so far is 961 B." A very small but genuine file under 500 bytes would be refused.
- **No virus/malware scanning** was found in the code reviewed. The signature check proves the file is really a PDF or image; it does not prove it is safe.
- **No page-count, resolution, or expiry checks** (for example, CNIC expiry) were found in the code reviewed.
- **The whole submission is atomic on validation, not on upload.** Files are uploaded to Drive before the database transaction commits; if the transaction then fails (duplicate, quota), the attempt's Drive objects are cleaned up through the storage-ownership ledger (see file 28). If Drive itself fails mid-upload, the submission fails with 502 and the merchant must submit again.
- **Resubmission uses the same checks** (size, minimum, extension/MIME agreement, content signature) for replacement files — see file 06. The one difference is that in resubmission a required document must be replaced (`replace`), while an optional document may instead be removed (`remove`).
- **Document labels.** Human-readable labels for each document type live in `backend/src/modules/cases/field-labels.ts` (`DOCUMENT_TYPE_LABELS`) and in the frontend `DOCUMENT_LABELS` map. If a label is changed in one place and not the other, the merchant and the reviewer can see different names for the same document.

## What to check — is this what you intended?

- [ ] Is the required/optional table above still right for each business type — in particular, should a sole proprietorship really need only a company NTN beyond the base five, and should a trust really need seven extra documents?
- [ ] Is 10 MB per file the right cap? Some phone photos and multi-page scans are larger; would you rather raise it, or keep it and ask merchants to compress?
- [ ] Should the bank's or regulator's document list be editable by staff (a configuration screen) instead of hard-coded, so a new requirement does not need a code change and a deploy?
- [ ] Do you want any check the system does not do today — for example, CNIC expiry dates, a minimum image resolution, or malware scanning?
- [ ] `utility_bill` is required for every merchant. Is that right even for a business run from the owner's home, where the bill is in a personal name?

---
*Sources: `frontend/src/features/onboarding/document-upload-field.tsx`, `frontend/src/features/onboarding/merchant-onboarding-form.tsx`, `frontend/src/apis/merchant-onboarding.ts`, `backend/src/modules/merchants/merchants.schemas.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/lib/storage/file-limits.ts`, `backend/src/lib/storage/file-signatures.ts`, `backend/src/lib/storage/google-drive.ts`, `backend/src/lib/concurrency.ts`, `backend/src/db/schema.ts`, `backend/src/index.ts`, `backend/src/modules/cases/field-labels.ts`, `backend/src/modules/merchants/public-resubmission.routes.ts`, `frontend/src/schemas/merchant-onboarding.schema.ts`. Related files: 04 (public form), 06 (resubmission), 13 (Document Review), 28 (Google Drive).*
