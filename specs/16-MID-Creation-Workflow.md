# 16 — MID Creation Workflow

## At a glance

| | |
|---|---|
| **What it is** | "MID" is the merchant's ID on the AssanPay portal. MID Creation is the step where the operations team creates the merchant's portal account: two merchant IDs (a portal MID and an internal portal MID), the login email and branch codes for both, the merchant's role on the portal, and which payment and payout methods are switched on for them, with their rates. The team also generates a one-time portal password code for the merchant and saves the portal API key and secret for the internal merchant ID. The details are saved on the MID Creation case, and the actual credential email to the merchant is sent later, from the Testing case (file 17) — MID Creation prepares everything; Testing delivers it. The case can only close once the IDs are saved and the API credentials are stored. |
| **Who can use it** | Working the case: only the case owner, with `work` access to the MID Creation queue. Generating / revealing the portal password code: case owner only. Saving / revealing portal API credentials: the working owner of the MID Creation case — or, for revealing, the working owner of the WordPress case. |
| **Where it lives** | Case detail page, for a MID Creation case (`/cases/:caseId`). |
| **What it creates** | The merchant's two portal MIDs, login emails and branch codes, role, payment/payout methods and rates, a one-time portal password code, and the internal merchant ID's API key and secret. |
| **Main APIs** | `POST /api/cases/:id/mid-creation/save` · `GET /api/cases/:id/portal-password-code` · `POST /api/cases/:id/portal-password-code` · `PUT /api/cases/:id/portal-api-credentials` · `POST /api/cases/:id/portal-api-credentials/reveal` |
| **Main code** | Frontend: `src/features/cases/case-detail/renderers/merchant-id-renderer.tsx`, `portal-password-code-card.tsx`, `portal-api-credentials-fields.tsx` · Backend: `src/modules/cases/mid-case.service.ts`, `portal-password-code.service.ts`, `portal-api-credentials.service.ts`, `case-detail-lookups.ts` |
| **Success looks like** | Both MIDs, emails, branch codes, role and methods are saved, the API key/secret are stored, and the case closes — so the Testing case can later send the credentials to the merchant. |

> ⚠️ **The portal password code and the API key/secret are stored encrypted, not as readable text.** Both go through `encryptSecret` / `decryptSecret` (`backend/src/lib/secret-box.ts`). The API credentials use the key `PORTAL_API_CREDENTIALS_ENCRYPTION_KEY`, and each ciphertext is bound to its row id and merchant id, so it cannot be moved to another row. Only the last four characters of the API key are kept readable. MID values themselves are numbers. The full values are revealed only through owner-only, `no-store` endpoints, and each reveal is written to case history. Migration `0036_remove_mid_creation_stored_secrets` removed an earlier stored-secret design (not re-read here).

## How it works — the journey

```
Case arrives new (created by an admin, or by case-flow after Documents Review / WordPress)
        ↓
Owner takes it → working
        ↓
STEP 1 — Generate the portal password code FIRST
  (MID details cannot be saved until a code exists)
        ↓
STEP 2 — Save the MID details (both MIDs, emails, branch codes, role, methods + rates)
        ↓
STEP 3 — Save the portal API credentials (key + secret, write-only)
        ↓
Both MIDs complete + API credentials stored → Advance → case closes successfully
        ↓
After closing: MIDs appear in the dashboard pending-MID lists until an admin applies limits
  · Testing case later sends the credentials email (file 17)
```

## Who can use it — permissions

| Item | Rule |
|---|---|
| **Queue** | MID Creation (`slug: merchant-id`, prefix `MI`, `workflowType: mid`). Note the slug is `merchant-id`, not `mid-creation` — the queue is the "merchant-id" queue. |
| **Working the case** | Only the case owner, with `work` access to the MID Creation queue. Checks: `400 "This action is only available for MID Creation cases."` for the wrong workflow, `403 "Only the case owner can save MID details."`, `400 "The case must be in the working stage."`, and the current stage must be an `in_progress` stage (`400 "MID details can only be saved in working."`). |
| **Portal password code** | Generating or revealing the code is case-owner only (`GET`/`POST /api/cases/:id/portal-password-code`). Only `mid` and `testing` cases may use it (`400 "Portal password codes are only available for MID Creation and Testing cases."`). Generating is refused with `409 "Credentials were already sent with this merchant’s portal password code."` once the latest code has been used by a sent credentials email (see step 2). |
| **Portal API credentials** | Saving is restricted to the working owner of the MID Creation case (`loadCredentialsCase(..., ['mid'])`). Revealing is also allowed for the working owner of the WordPress Website case. Both need the case to be `working`. The save response returns only `apiKeyLast4` and `updatedAt`. Revealing is a separate `POST .../reveal` call with `Cache-Control: no-store`. |

## Step by step

1. The case arrives `new` (created by an admin or by the case-flow engine after Documents Review / WordPress, depending on the configured flow). The owner takes it (`working`).
2. **Generate the portal password code first.** `POST /api/cases/:id/portal-password-code` generates (or replaces) a one-time code for the merchant's portal login. The code can be revealed with `GET /api/cases/:id/portal-password-code` (owner only, `no-store`). Saving MID details is refused until a code exists: `400 "Generate the portal password code before saving MID details."` The reason, in the code's own comment, is that "the merchant account is created with the code's password, so saving without one would leave nothing to send." The code is stored per merchant (`merchant_portal_password_codes`, migration `0085_merchant_portal_password_codes`) and the portal password is built by `buildPortalPassword` (`case-detail-lookups.ts`) as the lowercased local part of the merchant's email, then `@`, then the code. The code is 10 characters from a 32-symbol alphabet without look-alikes (`portal-password-code.service.ts`). Generating a code supersedes the active one and drops its ciphertext. Sending a credentials email consumes the code (`consumedAt`, ciphertext dropped), so it cannot be sent again. Generating after that returns `409` (see Errors).
3. **Save the MID details** (`POST /api/cases/:id/mid-creation/save`) with:

| Field | Rule |
|---|---|
| `portalMid` | Positive integer (the merchant's portal MID). |
| `internalPortalMid` | Positive integer (the internal portal MID). |
| `email` | The merchant's portal login email (max 255 chars, valid email). |
| `branchCode` | The branch code for the portal MID (1–100 chars). |
| `internalEmail` | Derived automatically from `email` by inserting the word `internal` before the `@` (for example `name@domain.com` becomes `nameinternal@domain.com`; `buildInternalMerchantEmail` in `cases.schemas.ts`). The caller still sends the field, but the server overwrites it with the derived value. The field is still validated as an email before the overwrite, so a non-email value is refused. |
| `internalBranchCode` | The branch code for the internal MID (1–100 chars). |
| `merchantRole` | `merchant_admin` or `international_merchant_admin`. |
| `paymentMethods` | Array of method objects from configuration: each has an `id`, `testing` and `live` collection limits, and `commissionRate` (0–100) (`configuration.schemas.ts`). At least one, else `400 "Select at least one payment method."` |
| `payoutMethods` | Same object shape; at least one, else `400 "Select a payout method."` Payout methods are taken from the configuration for the chosen merchant role (`getPayoutMethodsForMerchantRole`, which finds them by label: `Bank Settlement` for `merchant_admin`, `All supported banks/e-wallets` for `international_merchant_admin`, see `ROLE_PAYOUT_METHOD_LABELS`), and the submitted commission rates are merged onto the configured methods — a method not in the role's configuration is not stored as submitted. |

4. Saving writes a `case_history` row with action `mid_creation_saved` and the full details in its `details` JSON — **there is no dedicated `mid_case_details` table.** The latest saved MIDs per case are kept current in `mid_case_portal_mids` (`caseId`, `portalMid`, `internalPortalMid`, `savedAt`) by a database trigger on `case_history` (migration `0095_mid_case_portal_mids`). Reads of the saved values (`getMidCreationCredentials`, `case-detail-lookups.ts`) take the latest `mid_creation_saved` row across **all of the merchant's cases** (`cases.merchantId`), not only this MID case. So the Testing case reads the same values. That table is what the dashboard pending-MID lists read ("Holds MID values only; case status and merchant deletion are read from their own tables.").
5. **Save the portal API credentials** (`PUT /api/cases/:id/portal-api-credentials`, body `{ apiKey, apiSecret }` — the exact field names are in `savePortalApiCredentialsSchema`; both values must be printable ASCII without spaces, 1–512 chars). This is the internal merchant ID's API key and secret, used by the portal. It is write-only: the save response returns only `apiKeyLast4` and `updatedAt`. Each value is trimmed, 1–512 characters, and printable ASCII with no spaces (`savePortalApiCredentialsSchema` in `cases.schemas.ts`; messages such as `API Key must not contain spaces.`). Saving replaces the merchant's previous pair in one transaction (delete then insert, serialised by a row lock on the merchant). It writes history `portal_api_credentials_saved` with `replacedPrevious` only, never the values.
6. **Reveal when needed** (`POST /api/cases/:id/portal-api-credentials/reveal`, owner only, `no-store`). Each reveal writes history `portal_api_credentials_revealed` with the credential id. The frontend shows these fields in `portal-api-credentials-fields.tsx` on the case page.
7. **Closing.** The close checklist for this workflow is:
   - "Save the email, MID, and Branch Code for both merchant IDs before closing this case." (Both MIDs count as complete only when `branchCode`, `internalEmail` and `internalBranchCode` are all non-empty — `hasCompleteMerchantIds`. Note the message mentions email/MID/branch code, but the code checks branch code, internal email and internal branch code; the two MIDs themselves are read from the saved history entry.)
   - "Save the API Key and API Secret for the internal merchant ID before closing this case."
   Advancing closes the case successfully. The credentials email itself is **not** sent from this case — it is sent from the Testing case (file 17), which reads the details saved here.
8. **After closing,** the merchant's MIDs appear in the dashboard's pending portal-MID lists until an admin applies limits to them (`POST /api/dashboard/portal-mids/apply-limits`, file 10). The Testing workflow is blocked from sending credentials until the relevant limits are applied (file 17).

## How it is implemented — Frontend

- Renderer: `frontend/src/features/cases/case-detail/renderers/merchant-id-renderer.tsx`. Sections: "Merchant Platform" (portal MID, internal MID, emails, branch codes, merchant role), "Financial Information" (payment methods), "Payout Rate" (payout methods and commission rates). It reads the saved values from `caseDetail.testing` (the case detail payload carries the saved MID details under the `testing` key — the same payload section the Testing renderer uses — with `credentialsReady`, `portalMid`, `internalPortalMid`, `email`, `branchCode`, `internalBranchCode`, `merchantRole`, `paymentMethods`, `payoutMethods`).
- Supporting components: `portal-password-code-card.tsx` (generate/reveal the code) and `portal-api-credentials-fields.tsx` (save/reveal key and secret).
- API calls (`frontend/src/apis/cases.ts`): `saveMidCreationDetails()`, `revealPortalPasswordCode()`, `generatePortalPasswordCode()`, `savePortalApiCredentials()`, `revealPortalApiCredentials()`.

## How it is implemented — Backend

- Module: `backend/src/modules/cases/mid-case.service.ts` (`saveMidCreationDetails`, `loadMidCreationCase`, `sendMidCreationCredentialsEmail` — note: the send function lives in the MID service file but is routed under the **Testing** case, see file 17), `portal-password-code.service.ts`, `portal-api-credentials.service.ts`, `case-detail-lookups.ts` (`getMidCreationCredentials`, `getPortalPasswordCodeStatus`, `hasPortalApiCredentials`).

| Endpoint | Body / result |
|---|---|
| `POST /:id/mid-creation/save` | JSON, validated by `saveMidCreationDetailsSchema` (`cases.schemas.ts`): `portalMid` and `internalPortalMid` positive integers; `email`/`internalEmail` valid emails ≤255 chars; `branchCode`/`internalBranchCode` 1–100 chars; `merchantRole` enum; `paymentMethods` ≥ 1; `payoutMethods` ≥ 1. Returns the saved values plus `savedAt`. |
| `GET /:id/portal-password-code` | Reveal the active code (owner only). |
| `POST /:id/portal-password-code` | Generate or replace the code (owner only). |
| `PUT /:id/portal-api-credentials` | Save/replace key and secret (write-only; `Cache-Control: no-store`). |
| `POST /:id/portal-api-credentials/reveal` | Reveal key and secret (working owner of the MID Creation or WordPress case only; `no-store`). |

All endpoints are under `/api/cases/:id`.

- **Storage:** no dedicated details table. The saved values live in `case_history` (`mid_creation_saved`) and the latest MIDs are mirrored into `mid_case_portal_mids` by trigger. The password code lives in `merchant_portal_password_codes`. API credentials are stored encrypted in `merchant_portal_api_credentials` (`merchantPortalApiCredentials` in `schema.ts`): two ciphertexts, `apiKeyLast4`, `updatedBy`, `updatedAt`, one row per merchant. The password code is in `merchant_portal_password_codes` (`merchantPortalPasswordCodes`) with a `codeCiphertext` that is dropped when the code is superseded or consumed. The DB constraints for that state are in migration `0111_case_data_state_guards.sql`. This workflow stores no files. The key material and its rotation process were not read (`lib/secret-box`, not re-verified here). Applied limits live in `portal_mid_limit_applications` (file 10).
- **Case numbering:** prefix `MI`.

## Data, validation and edge cases

| Item | Rule |
|---|---|
| **Password code first** | MID details cannot be saved until the portal password code exists for the merchant. The code is per merchant, not per case — generating a new code replaces the merchant's active code, which affects any other case that reads it. Once a credentials email has used the code it is consumed, and generating another is refused with `409` (see Errors). |
| **Reveal after use** | Once a credentials email has consumed the code, `GET /api/cases/:id/portal-password-code` returns `404 "No portal password code has been generated."` even though a spent code exists, because only an unconsumed, unsuperseded code counts as active (`getActivePortalPasswordCode`). Every reveal writes history `portal_password_code_revealed`. |
| **Internal email is derived, not typed** | The server recomputes `internalEmail` from `email` on every save, so whatever the caller sent for `internalEmail` is discarded. If the merchant's real internal email differs from the derived pattern, there is no way to store the real one through this endpoint. |
| **Re-saving overwrites** | Saving MID details again writes a new `mid_creation_saved` history row and the trigger updates `mid_case_portal_mids` to the latest values. The dashboard pending-MID list follows the latest values. Earlier values remain only in history. |
| **Payout methods are role-scoped** | The saved payout methods are the role's configured methods with the submitted rates merged in. Submitting a payout method that is not configured for the merchant's role silently drops it from what is stored (it is not in the merged list), rather than erroring. |
| **API credentials are write-only** | A saved key/secret can never be listed or read back except through the owner-only reveal endpoint. The working owner sees a status instead (`apiKeyLast4`, `updatedAt`, `updatedBy`, via `getPortalApiCredentialsStatus`). The close checklist uses `hasPortalApiCredentials`. |
| **MID uniqueness** | The code reviewed does not show a uniqueness check on `portalMid`/`internalPortalMid` at save time (uniqueness is enforced on `portal_mid_limit_applications.portal_mid` when limits are applied, not here). Two merchants could in principle be saved with the same MID and the clash would surface only at the apply-limits step. |

> ⚠️ **Not found in the code reviewed:** where the portal account itself is actually created (the portal is a separate system; the code reviewed only records the values and sends them by email — whether account creation is manual or automatic was not established); any check that the portal MID actually exists on the portal.

## What happens next — in plain words

- **For the merchant:** nothing is sent to them from this case. They receive their portal login details later, from the Testing case (file 17), which reads everything saved here — the MIDs, the login email, the branch codes, and the portal password code. Until then, the merchant waits; this case is back-office preparation, not a message to them.
- **For the team:** once this case closes, the merchant's MIDs appear in the dashboard's pending portal-MID lists (file 10) until an admin applies limits to them. The Testing case cannot send the credentials email until the relevant limits are applied (file 17), so applying limits is the next admin job after this close.
- **If the MID details change after saving,** re-saving overwrites them (a new `mid_creation_saved` history row; the dashboard follows the latest values). Earlier values remain only in history — and if the Testing case has already sent the credentials email, the merchant is not automatically told about the change (see the questions).
- **If the merchant is terminated later,** the portal API credentials are cleared when the WordPress Website case closes, either outcome (`case-transition.service.ts`, history `portal_api_credentials_cleared`, reason `wordpress_case_closed`), and when the merchant is terminated (file 09; `merchants.service.ts`) — the credentials prepared here stop being usable, even though the saved MID details remain in the case history.

## Errors

| Result | Meaning |
|---|---|
| `400` | "Generate the portal password code before saving MID details." / "This action is only available for MID Creation cases." / "MID details can only be saved in working." / "The case must be in the working stage." / "Portal password codes are only available for MID Creation and Testing cases." / "API credentials are not available for this case type." — from `mid-case.service.ts`, `portal-password-code.service.ts` and `portal-api-credentials.service.ts`. |
| `403` | "Only the case owner can save MID details." / "Only the case owner can manage the portal password code." / "Only the case owner can access API credentials." — plus the queue work-access check. |
| `404` | "Case not found." / "No portal password code has been generated." (revealing before one exists) / "No API credentials have been saved." (revealing before any are saved). |
| `409` | "Credentials were already sent with this merchant’s portal password code." — generating a new code after a credentials email used the current one (`portal-password-code.service.ts`). |
| `400` (more) | "API Key is required." / "API Secret is required." / "… must not contain spaces." / "… is too long." (save credentials); "Generate the portal password code and set it on the merchant portal before sending credentials." (sending, when no active code exists — file 17) / "Configure \"<label>\" in payout methods before saving MID details." (saving, when a payout method configured for the merchant role is missing — `getPayoutMethodsForMerchantRole` in `case-detail-lookups.ts`). |

## What to check — is this what you intended?

- [ ] **Portal account creation:** is the merchant's portal account created by hand using these saved values, or does something create it automatically? The code reviewed only records the values — it does not show an account-creation call.
- [ ] **Internal email pattern:** the internal email is always derived by inserting `internal` before the `@`. Is that always the merchant's real internal login email, or are there merchants whose internal email is different?
- [ ] **Duplicate MIDs:** should two merchants be blocked from saving the same portal MID, or is it fine for a clash to surface only when limits are applied?
- [ ] **API credential storage and reveal:** the key and secret are encrypted under `PORTAL_API_CREDENTIALS_ENCRYPTION_KEY`. Who besides the case owner should ever be able to reveal them (for example, should an admin be able to)? Who owns rotating that encryption key?
- [ ] **MID reporting:** the saved MID details live in case history, not in their own table. Is that acceptable for reporting (for example "show me every merchant's MIDs"), or should there be a proper MID record per merchant?
- [ ] **Changed MIDs after sending:** if a merchant's MID details change after the Testing case has already sent the credentials email, should the merchant be told, or is a re-save enough?

---
*Sources: `frontend/src/features/cases/case-detail/renderers/merchant-id-renderer.tsx`, `frontend/src/features/cases/case-detail/portal-password-code-card.tsx`, `frontend/src/features/cases/case-detail/portal-api-credentials-fields.tsx`, `frontend/src/apis/cases.ts`, `backend/src/modules/cases/mid-case.service.ts`, `backend/src/modules/cases/portal-password-code.service.ts`, `backend/src/modules/cases/portal-api-credentials.service.ts`, `backend/src/modules/cases/case-detail-lookups.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/case-transition.service.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/configuration/configuration.schemas.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/db/schema.ts`. Related files: 10 (Dashboard / pending MIDs / apply limits), 12 (case lifecycle), 17 (Testing / credentials email), 18 (WordPress Website / API credential reveal).*
