# 04 — Public Merchant Onboarding Form

## At a glance

| | |
|---|---|
| **What it is** | The public form a business fills in to apply to become an AssanPay merchant. The front door of the whole portal. |
| **Who can use it** | Anyone on the internet — no login, no account, no invitation. |
| **Where it lives** | `/onboarding-form` |
| **What it creates** | 1 merchant record (`status: pending`; the code reviewed has no `onboardingStage` field) + its documents in Google Drive + the first review case. |
| **Main API** | `POST /api/public/merchant-form` (multipart form data) |
| **Main code** | Frontend: `src/features/onboarding/merchant-onboarding-form.tsx` (1,885 lines) · Backend: `src/modules/merchants/form.routes.ts` + `merchants.service.ts` (`createMerchantSubmission`) |
| **Success looks like** | Merchant sees a success screen with their merchant reference, and the team picks the application up in Document Review (file 13). |

## How it works — the journey

```
Merchant opens /onboarding-form
        ↓
Fills in 7 sections (below) — draft autosaves in their browser
        ↓
Uploads documents — which ones are required depends on merchant type (file 05)
        ↓
Submits → one POST /api/public/merchant-form, with an Idempotency-Key
        ↓
Backend validates → checks duplicate + per-IP limit → uploads to Google Drive
        ↓
Merchant created (status: pending) → first case auto-created by the case-flow engine
        ↓
Success screen shown · draft cleared · team reviews in Document Review
```

## The 7 sections — what the merchant sees

This is a single long page, **not** a step-by-step wizard. There is a section nav on the side, with a tick per section as it is completed. Its short labels are Submitter, Business, Classification, Financial, Owner, Next of kin and Documents. The page heading is "Merchant Onboarding — Complete the form below to submit your merchant application".

| # | Section | Fields |
|---|---|---|
| 1 | **Submitter** | Email of the person applying. This is the contact address, and where resubmission emails go. |
| 2 | **Business Information** | Business name, business phone, business email, business address, business website, website CMS, business description, business registration date, nature of business. |
| 3 | **Business Classification** | Merchant type (7 types, below), estimated monthly transactions, estimated monthly volume. |
| 4 | **Financial Information** | Account title, bank name, branch name, account number / IBAN, SWIFT code (optional). |
| 5 | **Director / CEO / Owner** | Owner full name, owner phone, active WhatsApp number. |
| 6 | **Next of Kin** | Relation only — mother, father, brother, sister, spouse, son, daughter. No name or phone for the next of kin on this form; their CNIC is uploaded in Section 7. |
| 7 | **Documents** | File uploads. Required documents depend on merchant type — see file 05. |

**Merchant types:** `sole_proprietorship` · `private_limited_company` · `public_limited_company` · `partnership` · `limited_liability_partnership` · `ngo_npo_charity` · `trust_society_association`

**Website CMS:** `wordpress` · `shopify` · `custom_website`

**Staff do not use this form.** Staff see the submitted data afterwards on the merchant detail page (`/merchants/$merchantId/form`). There is no staff-side "create a merchant" form in the code reviewed — every merchant starts through this public form.

## Field rules — what is checked, and how

All of this is enforced in the backend (`merchants.schemas.ts`: `scalarMerchantSchema`, `parseMerchantFormData`, `assertPublicUploadFile`, `normalizeMimeType`) and mirrored in the frontend schema. A validation failure returns `400` with the first error message.

| Field | Rule |
|---|---|
| Owner phone, WhatsApp number | Must match `^03\d{9}$` — a Pakistani mobile, `03` + 9 digits. |
| Business phone | Digits only, 1–32 characters. |
| Submitter / business email | Valid email, max 255 chars, lowercased. Reserved domains rejected with "Please use a real email address.": `example.com`, `example.net`, `example.org` (and their subdomains), and any domain ending in `.example`, `.test`, `.invalid` or `.localhost`. |
| Business website | Max 500 chars. A bare domain like `example.com` gets `https://` added. Must then be a public `http`/`https` URL — no username/password, no private IP (10.x, 192.168.x, 127.x, 169.254.x, 100.64–127, 172.16–31, 0.x), no reserved domain, not `.local` / `.internal`. The host must contain a dot, so `localhost` is refused, and IPv6 literals are refused. Errors: "Business website must be a valid URL." or "Business website must be a public http or https website." Staff open this link from review screens, which is why the rule exists. |
| Business registration date | Must be a real date, and cannot be in the future (checked against today at 23:59:59). |
| Estimated monthly transactions | Whole number, more than 0, max 2,147,483,647. |
| Estimated monthly volume | More than 0, max 999,999,999,999.99, stored with 2 decimals. |
| Bank name | Must be exactly one of a fixed list of 27 banks (below). The list is hard-coded in `merchants.schemas.ts` (`bankNames`) — it is **not** a configuration screen. A merchant whose bank is not on the list cannot submit. |
| Next of kin | One of: mother, father, brother, sister, spouse, son, daughter. (Migration `0058_rename_wife_to_spouse` renamed the old `wife` value to `spouse`.) |
| Text lengths | Owner name ≤ 160 · business name ≤ 200 · business address ≤ 1,000 · business description ≤ 5,000 · business nature ≤ 160 · account title ≤ 200 · branch name ≤ 160 · IBAN ≤ 64 · SWIFT ≤ 64. |
| Extra / missing fields | Every text field must be sent exactly once (`Field "x" must be provided once.`). A missing required text field gives `Field "x" is required.`; optional fields may be omitted. An unknown text field gives `Unexpected field "x".` and an unknown file field gives `Unexpected file field "x".` Each file must be uploaded once (`Document "x" must be uploaded once.`), and a 0-byte file is skipped as if it were absent. |
| File checks | Maximum 10 MB (`413` "Document "x" exceeds the 10 MB limit."). At least 500 bytes (`400`, "… is too small to be a valid document. Please upload a clear copy."). File name at most 255 characters with no slashes. The extension must be `pdf`, `jpg`, `jpeg`, `png` or `webp` (otherwise `415`), must agree with the declared MIME type (`415`), and the bytes must match the file type (`lib/storage/file-signatures.ts`). At least one document is required (`400` "At least one document upload is required."), and the documents required for the merchant type must all be present (see file 05). |

### The 27 banks (hard-coded)

Al Baraka Islamic Bank Limited · Bank AlFalah Limited · Bank Al Habib · Allied Bank Limited · Askari Commercial Bank Limited · Bank of Khyber · Bank Islami Pakistan Limited · Burj Bank Limited · Citi Bank · Dubai Islamic Bank Pakistan Limited · Faysal Bank Limited · Habib Bank Limited · Habib Metropolitan Bank · JS Bank · KASB Bank · MCB Bank Limited · MCB Islamic Bank · Meezan Bank · National Bank of Pakistan · NIB Bank · Standard Chartered Bank · Samba Bank · Silkbank · Sindh Bank · Soneri Bank Limited · Summit Bank · United Bank Limited

## Draft autosave — what is saved, and what is not

- As the merchant types, text fields are autosaved, 400 ms after the last change, to that browser's `localStorage` key `assanpay:merchant-onboarding-draft`, stored as `{ v: 1, values }` with empty fields left out. A refresh does not lose the typing. The draft is restored once, on load.
- **Files are not saved in the draft** — they must be re-chosen after a refresh.
- On return with a draft, the form shows the toast *"Your draft was restored from this device."* with the description "Documents are not saved — re-attach them below."
- On success, the draft and the submission key (`assanpay:merchant-onboarding-submission-key`) are removed, and a summary is written under `assanpay:merchant-onboarding-submitted` (reference, merchant number, business name, submitted time). A returning visitor on that device sees the success view instead of a blank form, until the new-application action on that view runs `resetFormState`, which also clears the draft and the summary.

> ⚠️ **Privacy:** the draft and the submitted summary stay in `localStorage` with no expiry and no clear control of their own. They are removed only by the new-application action or by clearing browser data. The debounced save re-checks the submitted flag before it writes, so a save queued before submit should not write the draft back. File 32 (gap 14) records a reported leak; it was not reproduced from the code reviewed, so confirm it before treating it as settled.

## What the backend does, in order

`POST /api/public/merchant-form` — no authentication. Behind the public rate limiter (60 requests / 15 min / IP) and a 225 MB multipart body limit.

1. Content type must be `multipart/form-data`, otherwise `400`.
2. The optional `Idempotency-Key` header, if present, must match `/^[A-Za-z0-9_-]{16,128}$/`. A malformed key gets `400` "Idempotency-Key header is invalid."; a request with no key is still accepted (older pages). The frontend generates a random UUID once per application and keeps it in `localStorage` (`assanpay:merchant-onboarding-submission-key`, cleared on success), so retrying after a failure returns the same merchant instead of creating a duplicate.
3. **Per-IP quota is checked before the upload is read.** A retry of an accepted key skips the quota check and returns the existing merchant.
4. Form data is parsed and validated (`parseMerchantFormData`).
5. `createMerchantSubmission()` first looks up the key (a known key returns the stored merchant as a replay, before any duplicate check), then runs the duplicate check, then creates the Google Drive folders and uploads the files (ten at a time, **outside** any database transaction). It then opens **one database transaction** that repeats the key and duplicate checks under an advisory lock, checks the per-IP quota, inserts the merchant and its documents, and creates the first case. Drive objects from a failed attempt are cleaned up afterwards.
6. A replayed key returns `200` with the existing merchant; a new submission returns `201`.

### Duplicate protection

A second open application is blocked by `findOpenDuplicateMerchant()` when it has the **same normalised business name AND** the same submitter email, IBAN, or owner phone. Only merchants that are neither soft-deleted (`deleted_at`) nor terminated are compared. The check runs once before any upload, so a rejected form leaves nothing in Drive, and again inside the transaction. Normalisation: business name lowercased with non-alphanumerics stripped; email lowercased and trimmed; IBAN uppercased with spaces stripped; phone reduced to its last 10 digits.

- A terminated merchant **may** apply again.
- One owner **may** run several differently named businesses.
- A duplicate gives `409`: *"An application for this business is already under review. Our team will contact you, so you do not need to submit it again."*
- The check runs twice: once before any Drive work, and again inside the transaction under an advisory lock keyed on the normalised business name (`merchant-submission:<name>`), so two parallel requests cannot both slip through. A race on the submission-key hash (unique constraint `merchants_submission_key_hash_unique`) is caught as a replay instead of an error.

### Per-IP limit

- **3 successful submissions per IP in a rolling 24 hours** (`PUBLIC_SUBMISSION_LIMIT_PER_IP` in `backend/src/config/env.ts`, default 3; counted in `backend/src/modules/merchants/submission-attempts.service.ts`). Only `created` outcomes count; rejected attempts do not.
- Checked twice: a cheap check before the upload is read, and the real check inside the transaction under a per-IP advisory lock.
- Over the limit: `429` — *"Too many applications have been submitted from this network today. Please try again tomorrow."*
- Separate from this quota, every `/api/public/*` route has a general limiter of 60 requests per 15 minutes per IP (`publicRateLimiter` in `backend/src/index.ts`), returning `429` "Too many public requests. Please try again later." It is in memory (see file 32, gap 3), and it counts every public request, not only submissions.

### What is stored

**Merchant row** (`merchants` table — full table in file 30): submitter email, owner name/phone, active WhatsApp number, business name/phone/email/address/website/CMS/description/registration date/nature, merchant type, estimated monthly transactions and volume, account title, bank name, branch name, IBAN, SWIFT (nullable), next-of-kin relation — plus `status: pending`, `priority: normal`, `businessScope: local` (default), `currency: PKR` (default), a sequential `merchantNumber`, `submittedAt`, and `submissionKeyHash` (SHA-256 of the idempotency key; the raw key is never stored). The merchant is assigned the currently active case-flow version on insert (`flowVersionId` defaults to `active_case_flow_version()`).

**Documents** (`merchant_documents`): only Drive metadata and links — see file 05.

**Drive folders:** a merchant root folder is created, then `KYC Documents / Pending Review / First Submission` under it (`PRIVATE_KYC_PENDING_PATH = ['KYC Documents', 'Pending Review']`, `getSubmissionFolderName(1)` = `First Submission`; 2 and 3 are `Second Submission` and `Third Submission`, and higher numbers are `Submission N`). The root folder name comes from `buildMerchantRootFolderName` (merchant id and business name), in `backend/src/modules/merchants/merchant-drive-folders.ts`. Every folder and file is recorded in the `storage_objects` ownership ledger before the transaction commits; if the submission fails, only that attempt's objects are cleaned up. See file 28.

**Attempt log:** every attempt is stored in `public_submission_attempts` (IP, user agent, outcome, status code, error message, merchant id) and kept for 60 days (`ATTEMPT_RETENTION_MS`). Outcomes: `created`, `replayed`, `rate_limited`, `rejected`, `error`. A logging failure never changes what the applicant sees. Old attempts are purged on startup and every 6 hours.

**First case:** the initial case creation is driven by the case-flow engine (see file 21); the merchant starts at status `pending` and the Documents Review case is the first step. The trigger is `triggerStartCasesForMerchant()` in `backend/src/modules/cases/case-flow.service.ts`. It is called inside the same database transaction as the merchant insert, and creates the cases for each active start rule of the merchant's flow version (trigger type `form_submission`); see file 21. The storage ledger rows are attached to the merchant in that transaction too.

### Responses and errors

| Result | Meaning |
|---|---|
| `201` | New merchant created. Returns the merchant + its documents. |
| `200` | Replayed idempotency key — the original merchant, no duplicate created. |
| `400` | Invalid payload, missing required fields or documents, unexpected field, malformed `Idempotency-Key`, non-multipart request, unreadable multipart body (`Invalid multipart form payload.`), or a per-file rule (see Field rules). |
| `409` | Duplicate application already under review (`DUPLICATE_SUBMISSION_MESSAGE`). |
| `413` | A file over 10 MB (`Document "x" exceeds the 10 MB limit.`), or a request body over 225 MB (`Request body is too large.`, from the body-limit middleware in `backend/src/index.ts`). |
| `415` | Unsupported file type, or a file whose extension or content does not match its declared type. |
| `429` | Per-IP submission limit (`SUBMISSION_LIMIT_MESSAGE`), or the general public limiter (`Too many public requests. Please try again later.`). |
| `500` | Google Drive credentials or a folder ID not configured (`Google Drive credentials are not configured…` or `<KEY> is not configured.`, `backend/src/lib/storage/google-drive.ts`). Also `Storage provider does not support claimed merchant root creation.` |
| `502` | Google Drive upload / folder creation failed, or a parent folder is not shared with the service account. Partial Drive objects from that attempt are cleaned up afterwards (failures of the cleanup are only logged). |
| (any other error) | Returned as `500` `Unexpected server error.` in the attempt log (outcome `error`). |

**Success response shape:** `{ merchant: { id, merchantNumber, submitterEmail, ownerFullName, ownerPhone, activeWhatsappNumber, businessName, businessPhone, businessEmail, businessAddress, businessWebsite, websiteCms, businessDescription, businessRegistrationDate, businessNature, merchantType, estimatedMonthlyTransactions, estimatedMonthlyVolume, accountTitle, bankName, branchName, accountNumberIban, swiftCode, nextOfKinRelation, status, submittedAt, createdAt, updatedAt }, documents: [...] }`

## Frontend — how the page is built

| Piece | What it does |
|---|---|
| Routes | `frontend/src/routes/onboarding-form.tsx` (layout, renders an `<Outlet />`), `onboarding-form.index.tsx` (the page itself, heading "Merchant Onboarding", hides the heading once submitted), `onboarding-form.resubmit.$token.tsx` (resubmission page — file 06). |
| Form component | `frontend/src/features/onboarding/merchant-onboarding-form.tsx` (1,885 lines) — the seven sections, built with TanStack Form; section navigation in `onboarding-section-nav.tsx`; file input in `document-upload-field.tsx` (shows the 10 MB limit, accepts PDF/JPG/PNG/WEBP). |
| Validation | `frontend/src/schemas/merchant-onboarding.schema.ts` mirrors the backend Zod rules (phone formats, bank list, document lists per merchant type). |
| API call | `frontend/src/apis/merchant-onboarding.ts` — `submitMerchantOnboardingForm({ formData, submissionKey })` posts to `/api/public/merchant-form` with headers `Content-Type: multipart/form-data` and `Idempotency-Key: <submissionKey>`; `useSubmitMerchantOnboardingMutation()` does not retry on failure, and on success invalidates the `merchants`, `cases`, and `dashboard` query caches. |
| Success screen | `frontend/src/features/onboarding/submission-success.tsx`. |

Note: the frontend resubmission form strips non-digits as the user types; the main form's behaviour for pasted characters was not verified in the files reviewed.

## Edge cases to know

- **Submit, then submit again from the same browser:** replays the first submission (same idempotency key) and returns the original merchant with `200`.
- **Submit again from a different browser, or after clearing `localStorage`:** a new key is generated, so the **duplicate check** — not the key — is what stops the second application.
- **Empty (0-byte) files** are silently skipped by the parser. At least one document upload is required overall, but the per-type required-document check (file 05) is what really decides.
- **Staff cannot edit a submitted form before review.** Corrections happen only through the Document Review rejection / resubmission flow (file 06) or, for text fields, through a resubmission that the reviewer requested.
- **There is no staff-side "create a merchant" form** in the code reviewed — every merchant starts through this public form.
- **A terminated merchant can apply again** from scratch.

## What to check — is this what you intended?

- [ ] **Bank list:** the 27 banks are hard-coded. Is the list still correct and complete — any banks missing, renamed, or closed (e.g. Burj Bank, KASB Bank, NIB Bank, Summit Bank)? Should staff be able to edit it without a code change?
- [ ] **Pakistani numbers only:** owner phone and WhatsApp must be `03…` mobiles. Do you ever onboard merchants whose owner is abroad or uses a non-Pakistani number?
- [ ] **Website required?** The form blocks reserved / private website addresses. Should a merchant with no website at all be able to apply, or is a website always required?
- [ ] **3 per IP per 24 hours:** is that the right number, given several applicants can share one office or mobile network?
- [ ] **Draft recovery:** the draft lives on the applicant's own device only. Should a half-finished application be recoverable from another device, or is "same browser only" acceptable?
- [ ] **Staff-created merchants:** should there be a staff-side way to create a merchant (e.g. for a phone application), or should every merchant always come through this public form?

---
*Sources: `frontend/src/routes/onboarding-form.index.tsx`, `frontend/src/routes/onboarding-form.tsx`, `frontend/src/routes/onboarding-form.resubmit.$token.tsx`, `frontend/src/features/onboarding/merchant-onboarding-form.tsx`, `frontend/src/features/onboarding/submission-success.tsx`, `frontend/src/features/onboarding/onboarding-section-nav.tsx`, `frontend/src/features/onboarding/document-upload-field.tsx`, `frontend/src/schemas/merchant-onboarding.schema.ts`, `frontend/src/apis/merchant-onboarding.ts`, `backend/src/modules/merchants/form.routes.ts`, `backend/src/modules/merchants/merchants.schemas.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchant-drive-folders.ts`, `backend/src/modules/merchants/submission-attempts.service.ts`, `backend/src/config/env.ts`, `backend/src/index.ts` (public rate limiter, 225 MB multipart limit, route mounting), `backend/src/modules/cases/case-flow.service.ts` (`triggerStartCasesForMerchant`), `backend/src/modules/merchants/merchant-state-machine.ts`, `backend/src/lib/storage/file-limits.ts`, `backend/src/lib/storage/file-signatures.ts`, `backend/src/lib/storage/google-drive.ts`, `backend/src/db/schema.ts`, `frontend/src/schemas/merchant-onboarding.schema.ts`, `frontend/src/apis/merchant-onboarding.ts` (no retry; cache invalidation). Related files: 05 (documents), 06 (resubmission), 13 (Document Review), 21 (case-flow engine), 28 (Google Drive), 30 (database).*
