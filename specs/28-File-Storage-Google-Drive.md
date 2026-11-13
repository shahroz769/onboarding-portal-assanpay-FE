# 28 — File Storage And Google Drive

## At a glance

| | |
|---|---|
| **What it is** | Every document in the portal — a merchant's ID cards and company papers, a signed agreement, a sub-merchant form, a screenshot proving an email was sent — is stored in Google Drive, not on the portal's own server or in the database. The database only keeps a reference to each file: its Drive file ID, its view/download links, its folder ID, its original name, its type and its size. |
| **Who can use it** | Merchants (public, no login) upload KYC documents through the public form and resubmission page. Staff upload case files and configuration drafts. Super Admin only can delete a terminated merchant's Drive files. Everyone who can view a case or merchant can open a stored file through its Drive view link. |
| **Where it lives** | Google Drive, under two configured parent folders (private and public). The portal never downloads file contents itself; it links out to Drive. |
| **Main API** | `POST /api/public/merchant-form` · `POST /api/public/resubmission/:token` · case upload endpoints (e.g. `POST /api/cases/:id/agreement/final-agreement`) · `DELETE /api/merchants/:id/drive-files` (Super Admin only) |
| **Main code** | Backend: `src/lib/storage/google-drive.ts`, `file-limits.ts`, `file-names.ts`, `file-signatures.ts`, `ownership.ts`, `tracked-upload.ts`, `src/modules/merchants/merchant-drive-folders.ts`, `src/modules/cases/case-drive-folders.ts` · Frontend: `src/features/onboarding/document-upload-field.tsx`, `src/apis/merchant-onboarding.ts`, `src/apis/cases.ts` |
| **Success looks like** | A file is uploaded to Drive, recorded in the database in the same transaction, and staff can open it from the case or merchant page through its Drive link. A failed attempt leaves no orphan file behind. |

## How it works — the journey

```
Merchant / staff picks a file
        ↓
Frontend checks size, type and name first
        ↓
File sent to the backend as multipart form data
        ↓
Backend creates / finds the Drive folders
        ↓
File uploaded to Drive as a "tracked" upload (recorded as provisioning in storage_objects)
        ↓
Database row saved in the same transaction → file becomes current
        ↓
If anything fails before commit → uncommitted file deleted from Drive again
        ↓
Staff open the file later through its Google Drive view / download link
```

## Who can use it

| Who | What they can do |
|---|---|
| **Merchants (public, no login)** | Upload KYC documents through the public onboarding form at `/onboarding-form`, and re-upload rejected documents through the resubmission page at `/onboarding-form/resubmit/:token`. |
| **Staff (logged in)** | Upload final agreements, received (signed) agreements, sub-merchant final forms and email-proof screenshots inside a case; upload agreement and sub-merchant draft templates in Configuration. |
| **Super Admin only** | Delete a terminated merchant's Drive files (`DELETE /api/merchants/:id/drive-files`), and delete Drive files as part of terminating a merchant when `deleteDriveFiles` is set to `true`. Admins may terminate a merchant but may not delete Drive files — the backend returns 403 (`Only a Super Admin can delete Google Drive files.`). |
| **Everyone who can view a case or merchant** | Open a stored file through its Google Drive view link (`googleDriveWebViewLink`) or download link (`googleDriveDownloadLink`). The frontend never downloads file contents itself; it links out to Drive. |

## The eight steps, in detail

1. **A merchant submits the onboarding form.** They attach documents (for example owner CNIC front/back, utility bill, company NTN). The frontend checks each file first (see below), then sends the whole form as one multipart request to `POST /api/public/merchant-form`.
2. **The backend creates the merchant's Drive folders.** Two root folders are created under two configured parent folders — one "private" root for KYC documents and one "public" root for documents the merchant will be sent. The folder name is built as `<business name, cleaned, max 80 characters> - <merchant UUID>`, for example by `buildMerchantRootFolderName` in `src/modules/merchants/merchant-drive-folders.ts`.
3. **Sub-folders are created inside the roots.** The first submission goes to `KYC Documents / Pending Review / First Submission`. Each later resubmission goes to `KYC Documents / Pending Review / Second Submission`, `Third Submission` or `Submission <n>` (`getSubmissionFolderName`, used by `merchants.service.ts` and `public-resubmission.routes.ts`). Approved documents are moved to `KYC Documents / Approved Documents`. Rejected documents go to `KYC Documents / Rejected Documents / Round 01`, `Round 02` and so on, numbered from the count of earlier rejection rounds (`case-documents-review.service.ts`). Internal case files go under `Internal Case Files / <case folder> / <section>`. In the public root, the final agreement goes under `Merchant-Sent Documents / Agreement / <caseNumber> / Final Agreement` (`case-drive-folders.ts`).
4. **Each file is uploaded to Drive, then recorded in the database.** The upload is "tracked": the file is first recorded in the `storage_objects` table as `provisioning`, and only becomes `current` inside the same database transaction that saves the `merchant_documents` (or `case_files`) row pointing at it. If anything fails before that transaction commits, the uncommitted file is deleted from Drive again, so a failed attempt leaves no orphan file behind.
5. **Staff review documents in the case.** They open the Drive links from the case detail page. Approving or rejecting moves the file between the Pending / Approved / Rejected folders (the folder path constants are `PRIVATE_KYC_PENDING_PATH`, `PRIVATE_KYC_APPROVED_PATH`, `PRIVATE_KYC_REJECTED_PATH` in `merchant-drive-folders.ts`).
6. **Staff upload case files.** For example, in an Agreement case they upload the final agreement (`POST /api/cases/:id/agreement/final-agreement`) and later the scanned signed copy (`POST /api/cases/:id/agreement/received-copy`); in a Sub-Merchant Form case they upload the completed final form (`POST /api/cases/:id/sub-merchant-form/final-form`) and a screenshot proving the email was sent (`POST /api/cases/:id/sub-merchant-form/email-proof`). These files are stored in `case_files` and linked from `agreement_case_details` or `sub_merchant_form_details`.
7. **Configuration drafts are uploaded by admins.** Agreement draft templates (one per business type) and sub-merchant draft templates are uploaded in Configuration and stored in `agreement_draft_templates` / `sub_merchant_draft_templates`. Replacing a draft marks the old file's ledger entry `superseded`; the old Drive file is not trashed by that step.
8. **Deleting files.** Deleting is never a hard delete in Drive: the provider moves the file to the Drive trash (`trashed: true`), which Google empties after 30 days (the code comment in `google-drive.ts` states this; it is Google's trash behaviour and was not checked against Google), so removal stays recoverable for that time. In the database the object is marked `deleted` in `storage_objects`, and for a merchant the timestamp `merchants.drive_files_deleted_at` is set. Document rows themselves stay in the database, so their links must no longer be offered once the files are gone.

## Folder layout

| Location | Contents |
|---|---|
| Merchant root folder name | `<cleaned business name, max 80> - <merchantId>` |
| Case folder name | `<caseNumber> - <business name> - <queue name>` (`buildCaseFolderName`). The business name is cleaned and capped at 80 characters (falls back to `Merchant`); the queue name is cleaned and capped at 60 characters and is left out when there is no queue name. |
| Private root | `KYC Documents / Pending Review / First Submission` (first submission) · `KYC Documents / Pending Review / Second Submission`, `Third Submission`, `Submission <n>` (resubmissions) · `KYC Documents / Rejected Documents / Round 01`, `Round 02`, … (rejected rounds) · `KYC Documents / Approved Documents` · `Internal Case Files / <case folder> / <section>` |
| Public root | `Merchant-Sent Documents / Agreement / <caseNumber> / Final Agreement` |
| Path parts | The name parts built by `buildMerchantRootFolderName` and `buildCaseFolderName` are sanitised by `sanitizeDrivePathPart` (`merchant-drive-folders.ts`): only ASCII letters and digits, `.`, `_`, `-` and spaces are kept (non-ASCII letters are removed), spaces are collapsed and the result is trimmed, with a default cap of 120 characters. |

## File limits and checks

### Frontend checks (public form)

| Check | Rule |
|---|---|
| File size | At most 10 MB (`MAX_FILE_SIZE_BYTES` in `src/lib/file-limits.ts`), at least 500 bytes (`MIN_FILE_SIZE_BYTES`). |
| File type | Must be in `ALLOWED_FILE_TYPES` and the name must end with one of `ALLOWED_EXTENSIONS` (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, from `src/schemas/merchant-onboarding.schema.ts`). |
| File name | At most 255 characters (`MAX_FILE_NAME_LENGTH`). |
| Bad file | Rejected with a message and not attached. The chosen file is shown with its size and a remove button. |

The upload field is `src/features/onboarding/document-upload-field.tsx` (`DocumentUploadField`). One file per field, chosen through a hidden `<input type="file">`.

### Backend checks

| Check | Rule |
|---|---|
| Per-file size | 10 MB maximum per file (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` in `src/lib/storage/file-limits.ts`). `assertFileSizeLimit` throws 413 `<label> exceeds the 10 MB limit.` |
| Whole-request size | 225 MB multipart body limit (`publicMultipartMaxSize = 225 * 1024 * 1024` in `src/index.ts`, HTTP 413 `Request body is too large.`), applied to `/api/public/merchant-form` and `/api/public/resubmission/*`, and also set as Bun's `maxRequestBodySize`. This is a whole-request cap, not a per-file cap — the per-file cap is the 10 MB rule above. |
| Empty files | Rejected (400). |
| File name | At most 255 characters. |
| Content signature | Must match the declared MIME type / extension (415 on mismatch). See "Content check" below. |
| Public form allowed MIME types | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` (`allowedFileMimeTypes` in `merchants.schemas.ts`). Word documents (`.doc` / `.docx`, `application/msword` and the OOXML type) are allowed for case files and configuration drafts but not for the public KYC form. Frontend additionally requires files to be at least 500 bytes. |

### File-name cleaning

`src/lib/storage/file-names.ts` — `cleanUploadFileName` strips control characters and bidirectional control characters (for example U+202E, which can make `invoice<RTL>fdp.exe` display as `invoiceexe.pdf`; also the left-to-right and right-to-left marks U+200E/U+200F, the Arabic letter mark U+061C and the isolates U+2066–U+2069), replaces `/` and `\` with `_`, collapses whitespace, trims, turns a name made only of dots into the fallback, and caps the name at 255 characters (`MAX_UPLOAD_FILE_NAME_LENGTH`) while keeping the extension (up to 16 characters). Falls back to `upload` if nothing usable is left.

### Content check (magic bytes)

`src/lib/storage/file-signatures.ts` — `assertFileContentSignature` reads the first 16 bytes (`FILE_SIGNATURE_PROBE_BYTES = 16`) and checks the real content against the declared type. Magic bytes are the first few bytes of a file that identify its real type, whatever its name says.

| Family | Signature |
|---|---|
| `pdf` | `%PDF` |
| `jpeg` | JPEG signature |
| `png` | PNG signature |
| `webp` | RIFF/WEBP |
| `doc` | OLE compound |
| `docx` | ZIP (local-file, empty-archive or spanned-archive header) |

It rejects empty files (400), truncated files (400), unsupported types (415), and content that does not match the declared type (415). The declared type is taken from the MIME type first, falling back to the file extension. The messages are `Document "<label>" is empty.`, `Document "<label>" is truncated or corrupted.`, `Document "<label>" has an unsupported file type.`, `Document "<label>" content does not match a supported file signature.` and `Document "<label>" content does not match its declared file type.`.

### Per-case file rules

From `src/modules/cases/case-upload-validation.ts` and `case-constants.ts`:

| File | Must be |
|---|---|
| Sub-merchant final form and agreement files | PDF/DOC/DOCX |
| Received (physical) agreement copies | PDF/JPG/PNG/WEBP |
| WordPress screenshots and email-proof screenshots | JPG/PNG/WEBP |
| All of the above | Size-checked, then type-checked (`400` on a disallowed type or extension), then content-checked (see the messages below the table). |

Case uploads whose declared type is not allowed are rejected with `400` (the content-signature check can still return `415`), with these messages: "Final Form must be a PDF, DOC, or DOCX file.", "Agreement must be a PDF, DOC, or DOCX file.", "Screenshots must be JPG, PNG, or WEBP files.", "Received agreement copy must be a PDF, JPG, PNG, or WebP file." (`case-upload-validation.ts`).

Proof file kinds recorded in `case_files.file_kind` include `sub_merchant_final_form`, `sub_merchant_email_proof`, `resubmission_email_proof`, `agreement_email_proof`, `mid_creation_email_proof`, `live_activation_email_proof`, and the matching `*_whatsapp_proof` kinds; WordPress screenshots use the prefixes `wordpress_screenshot_`, `wordpress_sub_merchant_logo_screenshot_` and `wordpress_assanpay_checkout_screenshot_`.

### Configuration drafts

From `configuration.service.ts`, `validateDraftFile`: a draft must be PDF/DOC/DOCX by extension, declared type and content signature. A missing or generic (`application/octet-stream`) declared type is allowed when the extension decides, but the content check still applies. A wrong type returns `400` "Draft file must be a PDF, DOC, or DOCX file.", and the size check uses the 10 MB message ("Draft file exceeds the 10 MB limit."). Replacing a draft marks the previous ledger entry `superseded` (`supersedeStorageObjects`); the Drive file itself is not trashed.

### One file per document type

| Table | Rule |
|---|---|
| `merchant_documents` | No unique constraint on (merchant, document type) was found in the schema. On resubmission, the previous file for a replaced document is marked `superseded` in `storage_objects` (`public-resubmission.routes.ts`); the Drive file is not trashed. |
| `case_files` | Unique index `case_files_case_kind_uniq` on (`case_id`, `file_kind`), so a case can hold only one file of each kind. |

## How it is implemented — Frontend

| Piece | File / detail |
|---|---|
| Public form upload field | `src/features/onboarding/document-upload-field.tsx` (`DocumentUploadField`) — see the frontend checks table above. |
| Submitting | `src/apis/merchant-onboarding.ts` sends a `FormData` object with `Content-Type: multipart/form-data` to `POST /api/public/merchant-form`, and to `POST /api/public/resubmission/:token` for resubmissions. The response returns the merchant and the uploaded documents, including `googleDriveFileId`, `googleDriveWebViewLink`, `googleDriveDownloadLink` and `googleDriveFolderId` for each document. |
| Case uploads | `src/apis/cases.ts` sends `FormData` for `uploadSubMerchantFinalForm`, `uploadSubMerchantEmailProof`, `uploadAgreementFinalAgreement`, `uploadReceivedAgreement`, and the manual-email proof uploads. The case renderers (`agreement-renderer.tsx`, `sub-merchant-form-renderer.tsx`, `wordpress-website-renderer.tsx`) show Drive view/download links taken from `googleDriveWebViewLink` / `googleDriveDownloadLink`. |
| Configuration drafts | `src/apis/configuration.ts` sends `FormData` for `uploadAgreementDraft` and the sub-merchant draft uploads. |
| Deleting Drive files | `src/features/merchants/merchant-drive-files-dialog.tsx` (`MerchantDriveFilesDialog`) asks "Move Google Drive files to trash?" and explains that every Drive file and folder for the merchant goes to the Drive trash and that Google removes them. It calls `deleteMerchantDriveFiles` in `src/apis/merchants.ts`, which calls `DELETE /api/merchants/:id/drive-files` and returns `driveFilesDeletedAt`. After deletion the merchant's Form tab shows a "Drive files moved to trash on <date>" tooltip, marks documents "File deleted" and hides their Drive links (`src/features/merchants/merchant-form-tab.tsx`). |
| What the frontend does not do | It never talks to Google Drive directly, never holds Drive credentials, and never uploads a file anywhere except to the backend. All Drive links are plain links opened in the browser. |

## How it is implemented — Backend

### Provider — Google Drive

`src/lib/storage/google-drive.ts` (`GoogleDriveStorageProvider`, implementing `FileStorageProvider`). It does not use Google's official client library; it calls the Drive REST API directly with `fetch`:

| Item | Detail |
|---|---|
| Token endpoint | `https://oauth2.googleapis.com/token` |
| Files endpoint | `https://www.googleapis.com/drive/v3/files` |
| Upload endpoint | `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink,parents` |
| Scope | `https://www.googleapis.com/auth/drive.file` |
| Authentication | A service account: a signed JWT (RS256, `jose` library, 1-hour expiry) is exchanged for an access token. The token is cached in memory and reused until 60 seconds before expiry; concurrent callers share one in-flight token request (`tokenPromise`). A service account is a Google account that belongs to an application, not a person. |
| Methods | `createMerchantFolder`, `createMerchantRootFolder`, `createFolder`, `findOrCreateFolder`, `ensureFolderPath`, `uploadFile`, `moveFile`, `deleteFile`, plus `getFileMetadata`. `findOrCreateFolder` searches Drive (`'<parent>' in parents and name = '<name>' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, `pageSize: '1'`) and only creates the folder if it is not found. |
| `deleteFile` | First checks the file (`fields=trashed,capabilities(canTrash)`); a 404 or an already-trashed file is a no-op, a file the service account cannot trash returns 502, otherwise it PATCHes `{ trashed: true }`. It never hard-deletes. |
| `moveFile` | Reads the file's metadata, then PATCHes with `addParents` / `removeParents` (all current parents except the destination). If the file's only parent is already the destination it returns without the PATCH. It is called only from the document review step when staff approve or reject a merchant document (`src/modules/cases/case-documents-review.service.ts`). |
| Errors from Google | Turned into `AppError` 502 (server-side) or 500, with a specific message when a parent folder is not found or not shared with the service account. |

### Configuration (environment variables)

From `src/config/env.ts` and backend `.env.example`:

| Variable | What it is |
|---|---|
| `GOOGLE_DRIVE_CLIENT_EMAIL` | Service-account email (optional in the schema, but uploads fail with 500 if it or the key is missing). |
| `GOOGLE_DRIVE_PRIVATE_KEY` | Service-account private key. |
| `GOOGLE_DRIVE_PARENT_FOLDER_ID` | Parent folder for private merchant roots. |
| `GOOGLE_DRIVE_PARENT_FOLDER_ID_PUBLIC` | Parent folder for public merchant roots. |

`createMerchantFolder` / `createMerchantRootFolder` pick the parent by visibility (`private` → `GOOGLE_DRIVE_PARENT_FOLDER_ID`, `public` → `GOOGLE_DRIVE_PARENT_FOLDER_ID_PUBLIC`) and throw 500 `<key> is not configured.` if it is missing.

### Ownership ledger — `storage_objects`

`src/lib/storage/ownership.ts` and the `storage_objects` table. Every Drive object created by the portal is recorded with `provider` (`google_drive`), `providerObjectId`, `objectKind` (`file` / `folder`), `visibility` (`private` / `public`), `attemptId` (a UUID per upload attempt), `lifecycle`, `parentProviderObjectId` and `metadata`.

| Lifecycle step | Meaning |
|---|---|
| `provisioning → current → superseded → deleted` | Normal path: created, committed, replaced, then deleted. |
| `provisioning → failed → deleted` | Failed path. Only `provisioning` objects can fail, so cleanup never deletes a committed object. |

`cleanupFailedAttemptObjects` deletes only `failed` objects from this attempt, files before folders, and never deletes a `pending-root:<attemptId>` placeholder. Merchant-root creation is serialised with a database advisory lock and a claim row (`metadata.role = 'merchant_root'`, unique while `provisioning` or `current`); the loser waits and re-reads (`ROOT_CLAIM_POLL_ATTEMPTS = 20`, `ROOT_CLAIM_POLL_DELAY_MS = 100`), and a losing attempt deletes only the root folder it created itself.

### Tracked uploads

`src/lib/storage/tracked-upload.ts` (`createTrackedUpload`): `upload()` puts the file in Drive and immediately records it as `provisioning`; `commit(tx)` marks the attempt's objects `current` inside the caller's transaction; `run()` runs the steps and, on any error, cleans up the attempt's uncommitted files. If recording fails, the just-uploaded file is deleted immediately because cleanup could not find it otherwise. Delete errors during cleanup are logged (`console.error`) and not thrown, so the object stays `failed` in `storage_objects`. No job that retries `failed` objects was found in the code reviewed; a later cleanup only sees objects of its own attempt.

### Drive deletion on terminate / permanent delete

From `src/modules/merchants/merchants.service.ts`:

| Action | Rule |
|---|---|
| `deleteMerchantDriveFiles` | Only works for a `terminated` merchant that has not already had its files deleted (otherwise 409); it sets `driveFilesDeletedAt` / `driveFilesDeletedBy`. |
| Terminating with `deleteDriveFiles: true` | Tries the deletion and returns `status: 'deleted'` or `status: 'failed'` with a message instead of failing the termination. Only `super_admin` may send `deleteDriveFiles: true`; an `admin` gets `403` "Only a Super Admin can delete Google Drive files." (`merchants.routes.ts`). |
| Bulk termination with `deleteDriveFiles: true` | The bulk terminate endpoint does not wait for Drive. It returns `driveFilesQueuedCount` (the number of merchants terminated) and then deletes each merchant's Drive files one after another in a background task. A failure is only logged; the merchants list then offers the deletion again. |
| `DELETE /api/merchants/:id/drive-files` response | Returns the merchant `id`, `deletedStorageObjectCount` and `driveFilesDeletedAt`. The route is `super_admin` only (`requireRoles('super_admin')`). |
| Drive-delete request timeout | Raised to 120 seconds (`DRIVE_DELETE_REQUEST_TIMEOUT_SECONDS`) because deleting many files can take longer than Bun's 10-second idle timeout. |
| `permanentlyDeleteMerchant` (`DELETE /api/merchants/:id/permanent`, `super_admin` only) | Requires the merchant to be `terminated` (`409` "Only terminated merchants can be permanently deleted.") and the typed confirmation to equal the business name (`400` "Merchant name confirmation does not match."). Inside one database transaction it trashes every Drive object in the merchant's deletion plan (through the same `deleteFile` trash call, so no Drive file is hard-deleted), deletes the `email_log` rows for the merchant and its cases, and then deletes the merchant row, so the database rows go as well. It returns `deletedStorageObjectCount`. Because the Drive calls run inside the transaction, a Drive failure rolls back the database delete. See file 32, gap 9. |

## Data, validation and edge cases

| Topic | Detail |
|---|---|
| **Duplicate / orphan handling** | A repeated public submission with the same `Idempotency-Key` returns the original merchant (200, `replayed`) instead of uploading again. A failed attempt's Drive files are trashed by `cleanupFailedAttemptObjects`; a file whose database record was never written is deleted immediately by `createTrackedUpload`. An idempotency key is a unique key sent with a request so a retry returns the original result instead of creating a duplicate. |
| **Drive unavailable** | Google API network failures become 502 (`Unable to connect to Google Drive while … Check the server network connection, firewall/proxy settings, and outbound HTTPS access to Google APIs.`); a missing or unshared parent folder becomes 502 with instructions to share the folder with the service-account email or use a shared-drive folder ID. Missing Drive credentials become 500 (`Google Drive credentials are not configured. Set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY.`). |
| **Not found in the code reviewed** | No local-disk or S3 fallback storage; no Drive quota or storage-usage reporting; no endpoint that lists a merchant's Drive folder contents directly (the frontend only follows the stored links); no virus/malware scan beyond the magic-byte content check; no automatic retry of a failed Drive upload was found in the storage provider (`google-drive.ts`). |

> ⚠️ **No virus/malware scan:** the only content check on uploads is the magic-byte signature check. A file whose first bytes look right passes, even if its contents are harmful.

> ⚠️ **No fallback if Drive is down:** a submission fails outright with a 502 when Google Drive is unavailable or the service account loses access to a parent folder.

## Request and response, and errors — technical

| Item | Detail |
|---|---|
| Request shape | Uploads are multipart form data (`FormData`, `Content-Type: multipart/form-data`) sent to the backend — never directly to Google Drive. The response returns the merchant/case and the uploaded documents, including `googleDriveFileId`, `googleDriveWebViewLink`, `googleDriveDownloadLink` and `googleDriveFolderId` for each document. File contents are never returned by the API; staff open files through the Drive links. |
| Error codes | `400` — empty file, truncated file, or a file whose name/content is invalid. `403` — an admin (not Super Admin) tries to delete Drive files (`Only a Super Admin can delete Google Drive files.`). `409` — deleting Drive files for a merchant that is not `terminated` or whose files were already deleted. `413` — a file exceeds the 10 MB limit (`<label> exceeds the 10 MB limit.`) or the whole request exceeds 225 MB (`Request body is too large.`). `415` — unsupported file type, or content that does not match the declared type. `500` — Drive credentials not configured (`Google Drive credentials are not configured. Set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY.`) or a parent folder ID not configured (`<key> is not configured.`). `502` — Google Drive unreachable or a parent folder not found / not shared with the service account. |

## What happens next — business rules

- After a merchant submits, their documents sit in `KYC Documents / Pending Review` until staff approve or reject them in the Documents Review case; approved documents move to `Approved Documents`, rejected ones to `Rejected Documents`, and rejected documents can be re-uploaded through the resubmission link.
- After staff upload a final agreement or a completed sub-merchant form in a case, that file is linked from the case's detail row (`agreement_case_details` / `sub_merchant_form_details`) and can be opened from the case page through its Drive link.
- When a resubmission replaces a rejected document, the previous file's ledger entry is marked `superseded` (`public-resubmission.routes.ts`). Its Drive file is left in place, not trashed. Replacing a configuration draft works the same way (`configuration.service.ts`, `supersedeStorageObjects`).
- After a merchant is terminated and a Super Admin deletes their Drive files, the files go to the Drive trash (recoverable for 30 days), the database object is marked `deleted`, and `merchants.drive_files_deleted_at` is set — but the document rows stay in the database. The Form tab hides their Drive links once `driveFilesDeletedAt` is set (`merchant-form-tab.tsx`); the API itself still returns the stored link fields.
- If a submission fails before the database transaction commits, the uploaded files are deleted from Drive again, so a failed attempt leaves no orphan file behind.

## What to check — is this what you intended?

- [ ] **10 MB limit:** is 10 MB per file the right limit, or should some documents (for example scanned agreements) be allowed to be larger?
- [ ] **Merchant access to their own documents:** should merchants be able to see or download their own documents after submitting, or should Drive links stay staff-only? Today the public form response returns the Drive file IDs and links to the anonymous submitter.
- [ ] **Trash vs hard delete:** is moving deleted files to the Drive trash (recoverable for 30 days) the right behaviour, or should a permanent delete also hard-delete them from Drive?
- [ ] **Two parent folders:** the portal has two parent folders (private and public). Is the split between "private KYC" and "public merchant-sent" folders still how you want documents organised, and who should have access to each parent folder in Google Drive?
- [ ] **Drive down:** if Google Drive is down or the service account loses access to a parent folder, should a merchant submission fail outright (today it does, with a 502), or should the form be accepted and the files uploaded later?
- [ ] **Bulk terminate with Drive delete:** the bulk endpoint returns before Drive work finishes and only logs failures. Is a per-merchant result (or a retry queue) wanted, or is the merchants-list retry enough?
- [ ] **Whole-submission limit:** should there be a size or count limit on a whole submission (today only the 225 MB whole-request cap and the 10 MB per-file cap exist), and a limit on how many files one case can hold?

---
*Sources: `backend/src/lib/storage/google-drive.ts`, `backend/src/lib/storage/file-limits.ts`, `backend/src/lib/storage/file-names.ts`, `backend/src/lib/storage/file-signatures.ts`, `backend/src/lib/storage/ownership.ts`, `backend/src/lib/storage/tracked-upload.ts`, `backend/src/modules/merchants/merchant-drive-folders.ts`, `backend/src/modules/cases/case-drive-folders.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchants.routes.ts`, `backend/src/modules/merchants/form.routes.ts`, `backend/src/modules/merchants/public-resubmission.routes.ts`, `backend/src/modules/cases/case-documents-review.service.ts`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/modules/cases/case-upload-validation.ts`, `backend/src/index.ts`, `backend/src/config/env.ts`, `frontend/src/features/onboarding/document-upload-field.tsx`, `frontend/src/apis/merchant-onboarding.ts`, `frontend/src/apis/cases.ts`, `frontend/src/apis/configuration.ts`, `frontend/src/apis/merchants.ts`, `frontend/src/features/merchants/merchant-drive-files-dialog.tsx`, `frontend/src/features/merchants/merchant-form-tab.tsx`, `frontend/src/lib/file-limits.ts`, `frontend/src/schemas/merchant-onboarding.schema.ts`, `backend/src/modules/merchants/merchants.schemas.ts`, `backend/src/modules/cases/case-constants.ts`, `backend/src/modules/cases/cases.routes.ts`. Related files: 04 (public form), 05 (documents), 06 (resubmission), 26 (configuration drafts), 30 (database), 32 (known gaps, gap 9 for permanent delete).*
