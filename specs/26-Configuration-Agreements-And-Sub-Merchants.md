# 26 — Configuration: Agreements And Sub-Merchants

## At a glance

| | |
|---|---|
| **What it is** | Two kinds of document template configured in the portal — and both are files, not text. Agreement drafts (one per merchant business type) and sub-merchant drafts (one per sub-merchant, each with a name and a Seller Code). |
| **Who can use it** | `super_admin` and `admin` only, for viewing and managing drafts. Any authenticated user can read the short sub-merchant list (id + name only) for case work. Merchants never upload or see these drafts directly. |
| **Where it lives** | Configuration → Agreements (`/configuration/agreements`) · Sub-Merchants (`/configuration/sub-merchants`) |
| **What it stores** | The file itself lives in Google Drive; the portal stores the name, the Drive links, and (for sub-merchants) the Seller Code. There is no in-portal document editor — an admin uploads a new file to replace the old one. |
| **Main API** | `GET /api/configuration/agreements` · `POST /api/configuration/agreements/:businessType/draft` · `GET /api/configuration/sub-merchants` · `GET /api/configuration/sub-merchants/drafts` · `POST /api/configuration/sub-merchants` · `PATCH /api/configuration/sub-merchants/:id` |
| **Main code** | Frontend: `src/features/configuration/panels/agreements-panel.tsx`, `sub-merchants-panel.tsx` · Backend: `src/modules/configuration/configuration.service.ts` + `configuration.routes.ts` |
| **Success looks like** | An Agreement case sends the merchant the draft that matches the merchant's business type, and an EP Sub-Merchant Form case shows the draft for the sub-merchant inherited from the Documents Review selection. |

## The two kinds of draft

| Draft | What it is | Used by |
|---|---|---|
| **Agreement drafts** | One draft Final Agreement per merchant business type (for example Sole Proprietorship, Private Limited Company). When an Agreement case is worked, the agent sends the merchant the draft that matches the merchant's business type. | Agreement case (file 15). |
| **Sub-merchant drafts** | One draft form per sub-merchant, each with a name and a Seller Code. These are the forms the EP Sub-Merchant Form case works with (see file 20): the sub-merchant is inherited from the Documents Review selection, and the portal shows its draft, and the completed final form is uploaded against it. | EP Sub-Merchant Form case (file 20); also the Documents Review case, where the agent selects which sub-merchants apply to a merchant. |

## How it works — the journey

```
Admin opens Configuration → Agreements / Sub-Merchants
        ↓
Page lists the current drafts (one row per business type / per sub-merchant)
        ↓
Admin uploads a file (PDF, DOC or DOCX only) — new file replaces the old one
        ↓
File is stored in Google Drive (tracked upload) and the draft row is upserted
        ↓
Case work reads the draft: Agreement case by business type, EP case by sub-merchant picked
```

## Who can use it

| Who | What they can do |
|---|---|
| `super_admin`, `admin` | View and manage drafts. The list and upload endpoints sit below the `requireRoles('super_admin', 'admin')` line in `backend/src/modules/configuration/configuration.routes.ts`. |
| Any authenticated user | Read the sub-merchant list for case work: `GET /api/configuration/sub-merchants` (id + name only) is **above** that line, so any authenticated user can call it. The Documents Review case uses it for its sub-merchant picker. |
| Admin-only read | The full drafts list (`GET /api/configuration/sub-merchants/drafts`, with Drive links, Seller Code and sizes) is admin-only. |
| Merchants | Never upload or see these drafts directly. They receive the agreement or the final form by email from the case agent. |
| Agreement case agents | Use the configured draft through the Agreement case, not through Configuration. If no draft is configured for the merchant's business type, the case falls back to one of three built-in Google Drive drafts (`getAgreementDraftForMerchantType` in `backend/src/modules/cases/agreement.config.ts`, imported under the alias `getFallbackAgreementDraftForMerchantType` in `configuration.service.ts`): **Individual** for `sole_proprietorship`, **NGO** for `ngo_npo_charity` and `trust_society_association`, and **Company** for every other type. The case is not blocked. See "Missing draft" below. |

## Agreement drafts — step by step

1. An admin opens **Configuration → Agreements** (`/configuration/agreements`).
2. The page lists one row per business type, in the order of `BUSINESS_TYPE_OPTIONS`. The seven business types are in the table below.
3. Each row shows the business type label, the current draft file name (linked to its Google Drive view link) or "No draft", and an upload control. The admin picks a file and uploads it; the new file replaces the old draft for that business type.
4. Only PDF, `.doc` and `.docx` files are accepted (`DRAFT_MIME_TYPE_BY_EXTENSION` in `configuration.service.ts`: `.pdf` → `application/pdf`, `.doc` → `application/msword`, `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`). The file is checked in this order (`validateDraftFile`, `configuration.service.ts`): size first, then the extension must be `.pdf`, `.doc` or `.docx`, and the declared MIME type must match that extension unless it is empty or `application/octet-stream` (then the extension decides). Then the content signature is checked (`assertFileContentSignature`). Errors: `413 "Draft file exceeds the 10 MB limit."` (size, `MAX_FILE_SIZE_BYTES` in `lib/storage/file-limits.ts`); `400 "Draft file must be a PDF, DOC, or DOCX file."`. The stored name is cleaned and ends in the validated extension.
5. Uploading stores the file in Google Drive (a tracked upload, so a failed attempt can be cleaned up) and upserts the `agreement_draft_templates` row for that business type. Upsert means insert if new, update if it already exists. The previous Drive file is **not deleted**: the code comment says links to it may already have been sent to merchants. It is only recorded as superseded through the storage-ownership helpers (`supersedeStorageObjects`), and only when the Drive file id actually changed. The upload goes to `Configuration / Agreements / <business type label>` in Drive, as a private tracked upload. The route returns the full agreements list (`listAgreementDrafts`), not the single row.

### The seven business types

| Value | Label |
|---|---|
| `sole_proprietorship` | Sole Proprietorship |
| `private_limited_company` | Private Limited Company / SMC Private Limited |
| `public_limited_company` | Public Limited Company |
| `partnership` | Partnership |
| `limited_liability_partnership` | Limited Liability Partnership |
| `ngo_npo_charity` | NGO / NPO / Charity |
| `trust_society_association` | Trust / Society / Association |

## Sub-merchant drafts — step by step

1. An admin opens **Configuration → Sub-Merchants** (`/configuration/sub-merchants`).
2. The page lists every configured sub-merchant: name, Seller Code, draft file name and Drive link, and size.
3. To add one, the admin enters a **name** and a **Seller Code** and uploads the draft form file (same PDF/DOC/DOCX rule as agreements). The form requires all three; the frontend validates that the name is not empty, the Seller Code is not empty and is at most 80 characters, and that neither the name nor the Seller Code duplicates an existing sub-merchant (case-insensitive). The hint text reads: "Add a sub-merchant name and draft form. Files are stored under Configuration / Sub-Merchants."
4. To edit one, the admin changes the name or Seller Code and/or uploads a new draft file to replace the current one. The hint text reads: "Update the name or Seller Code, or upload a new draft form to replace the current one."
5. Creating returns `201`; updating returns `200`. Both return the **full** sub-merchant drafts list, sorted by name (`listSubMerchantDrafts`), not just the saved row. Before any upload, the backend rejects a name that already exists (case-insensitive, `409 "A sub-merchant with this name already exists."`; on update the row itself is excluded). An unknown `:id` gives `404 "Sub-merchant not found."`. The Seller Code duplicate check (case-insensitive) is in the browser only: the panel shows "A sub-merchant with this Seller Code already exists." and "Seller Code must be 80 characters or fewer.". The backend does not check Seller Code duplicates (see the Data table). A new sub-merchant is uploaded to `Configuration / Sub-Merchants / <name>` in Drive.
6. The drafts are used in two places: the Documents Review case (where the agent selects which sub-merchants apply to a merchant — those selections are what the EP page later uses, see file 20) and the EP Sub-Merchant Form case (where the sub-merchant is inherited from that selection and the agent uploads the completed final form).

## Deleting a draft

> ⚠️ **Not found in the code reviewed:** there is no delete endpoint for agreement drafts or for sub-merchant drafts in `configuration.routes.ts`, and no delete button in `agreements-panel.tsx` or `sub-merchants-panel.tsx`. A draft can be replaced, but not removed through the portal. Removing one would need a code/database change, and for sub-merchants the database restricts deletion while cases reference the draft (see "Data" below).

## Endpoints

Prefix `/api/configuration`.

| Method | Path | Who | What it does / notes |
|---|---|---|---|
| `GET` | `/api/configuration/sub-merchants` | Any authenticated user | Returns `[{ id, name }]`. |
| `GET` | `/api/configuration/agreements` | Admin-only | One entry per business type, including types with no draft yet (the list is built from `BUSINESS_TYPE_OPTIONS`, with the stored row merged in). |
| `POST` | `/api/configuration/agreements/:businessType/draft` | Admin-only | Multipart body with `file`; `businessType` validated against the seven values; `400` "Draft file is required." when no file is sent. |
| `GET` | `/api/configuration/sub-merchants/drafts` | Admin-only | Full drafts list, with Drive links, Seller Code and sizes. |
| `POST` | `/api/configuration/sub-merchants` | Admin-only | Multipart body with `name`, `sellerCode`, `file`; `400` "Sub-merchant name is required." / "Seller Code is required." / "Draft file is required."; `409` "A sub-merchant with this name already exists."; returns `201` with the full list. |
| `PATCH` | `/api/configuration/sub-merchants/:id` | Admin-only | `:id` must be a UUID (`400` "Invalid sub-merchant."); `name` and `sellerCode` required; `file` optional (when omitted the existing file is kept); `400` "Draft file is invalid." if a non-file value is sent; `404` "Sub-merchant not found."; `409` on a duplicate name; returns `200` with the full list. |

## How it is implemented — Frontend

| Piece | File / detail |
|---|---|
| Routes | `/configuration/agreements` → `agreements-panel.tsx` · `/configuration/sub-merchants` → `sub-merchants-panel.tsx` |
| Agreements panel | `frontend/src/features/configuration/panels/agreements-panel.tsx` — table with business type, draft file (Drive link or "No draft"), and the upload cell (`AgreementDraftUploadCell`, using `useUploadAgreementDraftMutation`). The upload button is disabled while an upload is in progress, and a file error blocks it. |
| Sub-merchants panel | `frontend/src/features/configuration/panels/sub-merchants-panel.tsx` — table with name and Seller Code columns, an edit dialog with name / Seller Code fields and a file dropzone, and the duplicate-name / duplicate-Seller-Code validation described above. |
| API | `frontend/src/apis/configuration.ts`: `fetchAgreementDrafts` → `GET /api/configuration/agreements` · `uploadAgreementDraft` → `POST /api/configuration/agreements/:businessType/draft` · `fetchSubMerchantDrafts` → `GET /api/configuration/sub-merchants/drafts` · `fetchSubMerchantOptions` → `GET /api/configuration/sub-merchants` (id + name only, for pickers) · `createSubMerchantDraft` → `POST /api/configuration/sub-merchants` · `updateSubMerchantDraft` → `PATCH /api/configuration/sub-merchants/:id` |
| Hooks | `frontend/src/hooks/use-configuration-query.ts` |
| Overview | The `GET /api/configuration` overview also returns `agreementDrafts` and `subMerchants` alongside the other settings. |

## How it is implemented — Backend

| Piece | File / detail |
|---|---|
| Service | `backend/src/modules/configuration/configuration.service.ts` — `listAgreementDrafts`, `uploadAgreementDraft`, `getConfiguredAgreementDraftForMerchantType`, `listSubMerchantDrafts`, `createSubMerchantDraft`, `updateSubMerchantDraft`. |
| Routes | `backend/src/modules/configuration/configuration.routes.ts` (see the endpoints table above). |
| Agreement list | `listAgreementDrafts` returns every business type even when no draft exists for it (size and links `null` in that case), so the frontend can always render seven rows. |
| Sub-merchant create / update | `createSubMerchantDraft` / `updateSubMerchantDraft` trim the name and Seller Code, reject an empty Seller Code, upload the file to Google Drive as a tracked upload, and store the Drive file id, view link, download link, folder id, original name, MIME type and size. |
| Draft used by a case | Resolved by `getConfiguredAgreementDraftForMerchantType(merchantType)`, which reads the `agreement_draft_templates` row for that business type; when there is none, the Agreement case code falls back to `getFallbackAgreementDraftForMerchantType` (`agreement.config.ts`). |
| File handling | Shared storage helpers: `cleanUploadFileName`, `createTrackedUpload`, `supersedeStorageObjects`, `assertFileSizeLimit`, `assertFileContentSignature`, `GoogleDriveStorageProvider`. |

## Data, validation and edge cases

| Topic | Detail |
|---|---|
| **`agreement_draft_templates`** | `businessType` (varchar 120, primary key), `label` (varchar 160), `originalName` (varchar 255), `mimeType` (varchar 128), `sizeBytes` (integer, check ≥ 0), Google Drive file id / view link / download link / folder id, `updatedAt` (no `createdAt` column). Because `businessType` is the primary key, there can be at most one draft per business type. |
| **`sub_merchant_draft_templates`** | `id` (uuid), `name` (varchar 160, unique), `sellerCode` (varchar 80, not null), `originalName` (varchar 255), `mimeType` (varchar 128), `sizeBytes` (integer), Google Drive file id / view link / download link / folder id, `createdAt`, `updatedAt`. The name is unique in the database (`.unique()` in `schema.ts`, case-sensitive); the backend also checks names case-insensitively before uploading. **Seller Code is not unique in the schema** (`seller_code` has no unique constraint in `schema.ts`), and the backend does not check it either: only the browser checks Seller Code duplicates, so a direct API call can save two sub-merchants with the same Seller Code. Migration `0025` created a unique index on Seller Code (`sub_merchant_draft_templates_seller_code_uniq`), and migration `0080_drop_sub_merchant_seller_code_unique.sql` dropped it. So no Seller Code uniqueness remains in the migrations or the schema. The `seller_code` column is `varchar(80)`, so a longer value written through the API would fail at the database, not with a clean `400`. |
| **Referential protection** | `cases.subMerchantId` references `subMerchantDraftTemplates.id` with on delete `restrict`, and so does `document_review_details.subMerchantId`. A sub-merchant that any case or document-review selection refers to cannot be deleted from the database while those rows exist. The same applies to agreement drafts only indirectly, through the cases that used them. Restrict means the database refuses the delete while other rows still point at it. |
| **Business type values** | `businessTypeSchema` / `BUSINESS_TYPE_OPTIONS` in `configuration.schemas.ts`: the seven values listed above. An upload for any other value returns `400` ("Invalid business type."). These are the same values used for the merchant's own business type, including `public_limited_company` (migration `0015`). |
| **File types** | PDF, DOC, DOCX only, for both draft kinds. Any other file is rejected by MIME type / extension mapping. The size limit is 10 MB (`assertFileSizeLimit`, `lib/storage/file-limits.ts`); the sub-merchants panel shows "PDF, DOC, DOCX (max 10 MB)" and the file input accepts `.pdf,.doc,.docx`. |
| **Replacing a draft does not update cases that already used the old draft** | A case stores its own file references (for example `agreement_case_details.finalAgreementFileId`); the configuration draft is only the source for new sends. **Not found in the code reviewed:** any process that re-sends or updates an agreement when its draft changes. |
| **Empty state** | An agreement type with no draft shows "No draft" (`agreements-panel.tsx`). The Agreement case is not blocked: it uses a built-in Drive draft (Individual / NGO / Company, see above). Confirm with the owner whether a missing draft should block instead. |
| **Snapshot on the case** | When an Agreement case is created, `ensureAgreementDetails` (`agreement-case.service.ts`) stores the draft it used on the case: `draftKey`, `draftLabel`, `draftUrl` (and `businessType`). Later draft changes never touch that snapshot. |

## Request and response — technical

| Item | Detail |
|---|---|
| Request shape | Draft uploads are multipart form data with a `file` field. Agreement upload: `POST /api/configuration/agreements/:businessType/draft`. Sub-merchant create: multipart with `name`, `sellerCode`, `file`. Sub-merchant update: `PATCH /api/configuration/sub-merchants/:id`, `file` optional — when omitted the existing file is kept. |
| Response shape | Creating a sub-merchant returns `201`; updating returns `200`. Both return the full sub-merchant drafts list (name-sorted), not the single row. The agreement upload returns the full agreements list. `GET /api/configuration/agreements` returns one entry per business type, including types with no draft yet (size and links `null` in that case). |
| Error codes | `400` "Draft file is required." (no file sent) · `400` "Invalid business type." (upload for a value other than the seven) · `400` "Sub-merchant name is required." / "Seller Code is required." / "Draft file is required." · `400` "Invalid sub-merchant." (`:id` is not a UUID) · `400` "Draft file is invalid." (a non-file value sent on update). `400` "Draft file must be a PDF, DOC, or DOCX file." · `413` "Draft file exceeds the 10 MB limit." · `404` "Sub-merchant not found." · `409` "A sub-merchant with this name already exists." · `403` "Insufficient permissions." for a non-admin caller. |

## What happens next — business rules

- After an admin uploads an agreement draft, the next Agreement case for that business type sends the new draft. Cases that already used the old draft are not updated — a case stores its own file references (for example `agreement_case_details.finalAgreementFileId`), and there is no process that re-sends or updates an agreement when its draft changes (not found in the code reviewed).
- After an admin adds a sub-merchant, the Documents Review case can select it for a merchant, and the EP Sub-Merchant Form case inherits that sub-merchant and takes the completed final form against it.
- If no draft is configured for a merchant's business type, the Agreement case uses one of three built-in Drive drafts (Individual, NGO or Company; see the table above) and is not blocked.
- Deleting a draft is not possible in the portal, and replacing one keeps the old Drive file (see above).
- There is no approval or legal-review step in the portal before a new draft is uploaded: any admin can replace one freely (see the intent question below).

## What to check — is this what you intended?

- [ ] **Deleting drafts:** should an admin be able to delete an agreement draft or a sub-merchant draft, or is "replace only" the intended rule? If deletion is wanted, what should happen to cases that already used the draft?
- [ ] **Missing draft:** what should happen in an Agreement case when no draft is configured for the merchant's business type? Today the code uses one of three hard-coded Drive drafts (Individual / NGO / Company), so a draft for, say, `partnership` silently falls back to the Company draft. Keep that, or block the agent until an admin uploads the right one?
- [ ] **Seller Code uniqueness:** is the Seller Code meant to be unique per sub-merchant? The browser checks for duplicates, but the schema has no unique constraint and the backend does not check, so the API accepts duplicates.
- [ ] **Business types:** are the seven business types still the complete list, or has a new business type been added that needs its own agreement draft?
- [ ] **File size limit:** the limit is 10 MB and is enforced by the backend. The sub-merchants panel shows it; confirm the agreements panel should show it too.
- [ ] **Replaced drafts:** when an agreement draft is replaced, should merchants who already received the old draft be told, or is the new draft only for new cases?
- [ ] **Ownership:** who owns the wording of these drafts — is there a legal review step before a new draft is uploaded, or can any admin replace one freely?

---
*Sources: `frontend/src/features/configuration/panels/agreements-panel.tsx`, `frontend/src/features/configuration/panels/sub-merchants-panel.tsx`, `frontend/src/apis/configuration.ts`, `frontend/src/hooks/use-configuration-query.ts`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/modules/configuration/configuration.routes.ts`, `backend/src/modules/configuration/configuration.schemas.ts`, `backend/src/modules/cases/agreement.config.ts`, `backend/src/modules/cases/agreement-case.service.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/db/schema.ts`, `backend/src/lib/storage/file-limits.ts`. Related files: 15 (Agreement Workflow), 20 (EP Sub-Merchants), 28 (Google Drive), 30 (database).*
