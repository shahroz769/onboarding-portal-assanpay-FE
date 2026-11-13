# 18 — WordPress Website Workflow

## At a glance

| | |
|---|---|
| **What it is** | The check that a merchant's WordPress site is a real working store and that checkout works with AssanPay — done with evidence: a cloned-site link and screenshots. |
| **Who can use it** | Only the case owner, with `work` access to the WordPress queue. Anyone who can view the case can see it. |
| **Where it lives** | WordPress Website queue (`slug: wordpress-website`, prefix `WP`, `workflowType: wordpress`). |
| **What it creates** | The screenshots in Google Drive, recorded in `case_files`, and a `wordpress_website_saved` history row that holds the cloned-site link. There is no `wordpress_case_details` table. |
| **Main API** | `POST /api/cases/:id/wordpress-website` (multipart only) |
| **Main code** | Frontend: `src/features/cases/case-detail/renderers/wordpress-website-renderer.tsx` · Backend: `src/modules/cases/wordpress-case.service.ts` (`loadWordpressWebsiteCase`, `saveWordpressWebsiteCase`) |
| **Success looks like** | Link + all screenshots saved, case closes successfully — which unlocks triggering EP Sub-Merchant Form cases (file 14 / file 20). |

## In plain words — for a non-technical reader

Many merchants sell through a WordPress website. Before they can take live payments, the team copies (clones) the merchant's site, checks it is a real working store, and proves checkout works with AssanPay — with screenshots as evidence. The case owner saves the link to the cloned site, one home-page screenshot, one logo screenshot for each sub-merchant, and one checkout screenshot. Nothing is emailed to the merchant and nothing waits on them. When all the evidence is saved, the case closes — and only then can EP Sub-Merchant Form cases be started for that merchant. What happens next: EP cases (file 20).

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `POST /api/cases/:id/wordpress-website` (multipart only; no JSON endpoint) |
| Request / response | Multipart: `clonedWebsiteLink`, `screenshots`, `subMerchantLogoScreenshots` + `subMerchantLogoScreenshotSubMerchantIds`, `assanpayCheckoutScreenshots`; read back via `getWordpressWebsiteDetails` |
| Validation | `clonedWebsiteLink` must be a valid link (`saveWordpressWebsiteSchema`); exactly one home screenshot and exactly one checkout screenshot; at least 1, at most 30 logo screenshots, exactly one per selected sub-merchant (checked against the latest Documents Review selection — no more, no fewer, no duplicates, none outside the selection); screenshots must be JPEG/PNG/WEBP, max 10 MB (`MAX_FILE_SIZE_BYTES`, `WORDPRESS_SCREENSHOT_MIME_TYPES` / `WORDPRESS_SCREENSHOT_EXTENSIONS`) |
| Database | No `wordpress_case_details` table; the cloned link is read from the latest `case_history` row `wordpress_website_saved` (`details.clonedWebsiteLink`), and screenshots from `case_files` by kind prefix (`wordpress_screenshot_`, `wordpress_sub_merchant_logo_screenshot_`, `wordpress_assanpay_checkout_screenshot_`); close facts via `wordpressChecklistFacts` / `hasLogoForEachSubMerchant` |
| Auth / roles | Case owner only, with `work` access to the WordPress queue; creation by `super_admin` / `admin` or the case-flow engine |
| Errors | `404` case missing, `403 "Only the case owner can update this case."`, `400 "The case must be in the working stage."`, `400 "Content-Type must be multipart/form-data."`, `400 "Invalid multipart form payload."`, plus the per-field `400`s in step 3–4 |
| Integrations / limits | Google Drive storage for screenshots; merchant website CMS `wordpress` \| `shopify` \| `custom_website`; stages New → Working → Closed, no `awaiting_merchant` stage; prefix `WP` |

## How it works — the journey

```
Case arrives new → owner takes it (working)
        ↓
Team clones the merchant's WordPress site (outside the portal)
        ↓
Owner saves website details in one save:
  cloned link + home screenshot + one logo screenshot per selected
  sub-merchant + AssanPay checkout screenshot
        ↓
Backend checks the sub-merchant list against Documents Review
        ↓
Screenshots validated (JPEG/PNG/WEBP, max 10 MB) and stored in Google Drive
        ↓
Close checklist complete → case closes successfully
        ↓
EP Sub-Merchant Form cases can now be triggered for this merchant
```

## Who can use it

| Action | Who | Checks |
|---|---|---|
| Work the case | Only the case owner, with `work` access to the WordPress queue | In `loadWordpressWebsiteCase`: `404` if the case is missing, `403 "Only the case owner can update this case."`, `400 "The case must be in the working stage."` |
| View the case | Anyone who can view the case | — |
| Create the case | `super_admin` / `admin`, or automatically by the case-flow engine | The merchant's website details (including the CMS: `wordpress`, `shopify` or `custom_website`) come from the original merchant application |

## Step by step

### 1. The case arrives

The case arrives `new`. The owner takes it (`working`) and reviews the merchant's submitted business website (shown in the renderer).

### 2. Clone the website

Outside the portal, the team clones the merchant's WordPress site. The portal does not do the cloning — it records the result.

### 3. Save the website details

| | |
|---|---|
| **Endpoint** | `POST /api/cases/:id/wordpress-website` — multipart only (`400 "Content-Type must be multipart/form-data."`, `400 "Invalid multipart form payload."`). No JSON endpoint exists for this workflow. |
| **Saved in one save** | All of the fields below, together |

| Field | Rule |
|---|---|
| `clonedWebsiteLink` | A valid website link to the cloned site. The route validates it with `saveWordpressWebsiteSchema` and returns `400 "A valid cloned WordPress website link is required."` otherwise. |
| `screenshots` — home page screenshot | Exactly **one** is required: `400 "A home page screenshot is required."` if none, `400 "Upload only one home page screenshot."` if more than one. |
| `subMerchantLogoScreenshots` — one website logo screenshot for each selected sub-merchant | At least one is required (`400 "At least one sub-merchant website logo screenshot is required."`), at most 30 (`400 "Upload no more than 30 sub-merchant logo screenshots."`). Each file is sent together with its sub-merchant id (`subMerchantLogoScreenshotSubMerchantIds` — one id per file, in the same order; the route returns `400 "Each sub-merchant logo screenshot must identify its sub-merchant."` when the counts do not match). |
| `assanpayCheckoutScreenshots` — AssanPay checkout page screenshot | Exactly **one** is required: `400 "An AssanPay checkout page screenshot is required."` / `400 "Upload only one AssanPay checkout page screenshot."` |

### 4. The sub-merchant list is checked against Documents Review

The backend loads the merchant's latest Documents Review selection (`getLatestDocumentReviewDetailsForMerchant`) and requires **exactly one logo screenshot for each selected sub-merchant — no more, no fewer, no duplicates, and no sub-merchant outside the selection**:

`400 "Upload exactly one website logo screenshot for each selected sub-merchant."`

This fails if the merchant has no sub-merchants selected at all, if a selected sub-merchant is missing its screenshot, if the same sub-merchant appears twice, or if a screenshot names a sub-merchant that was not selected.

### 5. Screenshots are stored

The screenshots are validated as image files (JPEG, PNG, WEBP) and stored in Google Drive, recorded in `case_files` with kind prefixes `wordpress_screenshot_`, `wordpress_sub_merchant_logo_screenshot_` and `wordpress_assanpay_checkout_screenshot_`. The cloned link and the file references are returned by `getWordpressWebsiteDetails`.

### 6. Re-saving

The owner can re-save. A save replaces the set: existing screenshot rows of each kind that are not in the new save are deleted from `case_files`, and the Drive objects they pointed to are marked `superseded` (`supersedeStorageObjects`, `src/lib/storage/ownership.ts`). Whether those superseded Drive files are removed later is handled by the storage ledger (see file 28). Each save writes history `wordpress_website_saved`.

### 7. Closing

The close checklist for this workflow is:

| Checklist item |
|---|
| Save the cloned WordPress website link before closing this case. |
| Upload the home page screenshot before closing this case. |
| Upload one website logo screenshot for each selected sub-merchant before closing this case. |
| Upload the AssanPay checkout page screenshot before closing this case. |

Advancing closes the case successfully, with `closeOutcome = 'successful'`. The owner can also close unsuccessfully with a reason.

### 8. What it unlocks

**Credentials are cleared on close.** Closing this case, either outcome, deletes the merchant's stored portal API credentials (`case-transition.service.ts`, `clearPortalApiCredentials`). It writes history `portal_api_credentials_cleared` with reason `wordpress_case_closed`. The credentials were saved on the MID Creation case (file 16) and are needed only until this site is set up. After this close, the MID case can no longer reveal them, and this WordPress case can reveal them only while it is `working` (`loadCredentialsCase` in `portal-api-credentials.service.ts`).

A successful close is the precondition for triggering EP Sub-Merchant Form cases (file 14 — the EP list shows the WordPress result as `successful` / `not_successful` and the trigger requires a successful WordPress case). The case-flow rules may also use it to start the next queue in the chain.

## How it is implemented — Frontend

- **Renderer:** `frontend/src/features/cases/case-detail/renderers/wordpress-website-renderer.tsx`. Sections: "WordPress Website" ("Review the submitted business website, then save the cloned WordPress link and screenshots."), the cloned-link input, the home-page screenshot upload, one logo-screenshot upload per selected sub-merchant, the checkout screenshot upload, and a "Save website details" button (disabled unless the owner can edit; shows "Saving" while the request runs). It also shows a "Merchant ID (Internal)" block with the internal branch code (or "Not saved" when the MID Creation case has not saved one yet).
- The renderer computes its own completeness from the saved data (link set, at least one home screenshot, at least one logo screenshot, at least one checkout screenshot) to enable the save/close controls; the server is the authority at close time.
- **API call** (`frontend/src/apis/cases.ts`): `saveWordpressWebsiteCase()` — builds the multipart form (`clonedWebsiteLink`, `screenshots`, `subMerchantLogoScreenshots` + `subMerchantLogoScreenshotSubMerchantIds`, `assanpayCheckoutScreenshots`) and posts to `/api/cases/:id/wordpress-website`.

## How it is implemented — Backend

| File | What it does |
|---|---|
| `backend/src/modules/cases/wordpress-case.service.ts` | `loadWordpressWebsiteCase`, `saveWordpressWebsiteCase`, with file validation (`validateWordpressScreenshotFile`) |
| `backend/src/modules/cases/case-upload-validation.ts` and `case-constants.ts` | `validateWordpressScreenshotFile`; the screenshot MIME/extension sets and the file-kind prefixes (`wordpress_screenshot_`, `wordpress_sub_merchant_logo_screenshot_`, `wordpress_assanpay_checkout_screenshot_`) |
| `backend/src/modules/cases/case-detail-lookups.ts` | Lookups `getWordpressWebsiteDetails`, `getLatestWordpressWebsiteDetailsForMerchant` |
| `backend/src/modules/cases/case-close-checklist.ts` | `wordpressChecklistFacts`: link present, `screenshots.length > 0`, one logo per selected sub-merchant via `hasLogoForEachSubMerchant`, checkout screenshots present |

**Endpoint:**

| Endpoint | Body | Notes |
|---|---|---|
| `POST /api/cases/:id/wordpress-website` | Multipart only | `400 "Content-Type must be multipart/form-data."`, `400 "Invalid multipart form payload."`. Service checks, in order: `404 "Case not found."`, `400 "This action is only available for WordPress Website cases."` (wrong queue), `403 "Only the case owner can update this case."`, `400 "The case must be in the working stage."` |

**Storage:** there is no `wordpress_case_details` table. The cloned link comes from the latest `wordpress_website_saved` history row, and the screenshots are read back from `case_files` via `getWordpressWebsiteDetails` (`case-detail-lookups.ts`) (files are found by their kind prefixes, and the logo screenshots carry their sub-merchant id). The close-checklist facts are built from the same read.

**Case numbering:** prefix `WP`.

**Stages:** New → Working → Closed (the `wordpress` template in `getStageTemplateDefinitions`, `backend/src/modules/queues/queue-workflow.ts`). There is no `awaiting_merchant` stage — nothing in this workflow waits on the merchant, so the case never leaves `working` until it closes.

## Data, validation and edge cases

| Case | What happens |
|---|---|
| **File types** | Screenshots must be `image/jpeg`, `image/png` or `image/webp` (`.jpg`, `.jpeg`, `.png`, `.webp` — `WORDPRESS_SCREENSHOT_MIME_TYPES` / `WORDPRESS_SCREENSHOT_EXTENSIONS`). A file that fails is refused with `400 "Screenshots must be JPG, PNG, or WEBP files."`. The file content signature is also checked (`validateWordpressScreenshotFile` in `case-upload-validation.ts`). All uploads max 10 MB (`MAX_FILE_SIZE_BYTES`). |
| **Exactly-one rules** | One home screenshot, one checkout screenshot, one logo screenshot per selected sub-merchant. These are enforced at save time, not just at close time — a save with two home screenshots is rejected outright. |
| **The sub-merchant list comes from Documents Review, not from this case** | If Documents Review has not selected sub-merchants yet, or its selection changed since the owner started, the save fails with the "exactly one … for each selected sub-merchant" error. The owner cannot pick a different sub-merchant list on the WordPress case itself. |
| **Merchants without WordPress** | ⚠️ The merchant's website CMS can be `wordpress`, `shopify` or `custom_website`. The code reviewed does not show the WordPress queue being skipped for Shopify/custom merchants, nor a different workflow for them. The dashboard's pending-MID groups (`custom_wordpress`, `shopify`, `internal`) show the CMS matters elsewhere, but for this queue the rule was not found — see the questions. In the code reviewed, `websiteCms` only changes the integration guide label in the MID and Testing emails and, for `custom_website`, adds the server base URL and callback IP (`case-communication-helpers.ts`, `resolveCustomWebsiteServerIntegration`). |
| **Re-saving** | A second save replaces the website details and the screenshot rows of each kind. Replaced Drive objects are marked `superseded` in the storage ledger (`supersedeStorageObjects`), not deleted in this code path (see file 28). Old history rows remain. |
| **No merchant interaction** | Unlike Documents Review, Agreement and Testing, this workflow never emails the merchant and never moves to `awaiting_merchant`. The email-delivery close block (file 12) therefore never applies to a WordPress case. |
| **Not found in the code reviewed** | Who performs the cloning and where the clone is hosted; any automated check that the cloned link actually loads or that the checkout screenshot shows a working AssanPay checkout (the check is the owner's eyes on the screenshots); any expiry if the clone goes stale. |

## What to check — is this what you intended?

- [ ] **Non-WordPress merchants:** what happens for merchants whose site is **not** WordPress (Shopify or a custom website)? Should they get a WordPress case at all, skip it, or go through a different website check?
- [ ] **No automatic check:** the screenshots are judged by the owner's eyes — nothing verifies the link loads or the checkout works. Is that enough, or should the portal check the cloned link automatically?
- [ ] **Selection changes after save:** if the Documents Review sub-merchant selection changes after the WordPress case is saved (a sub-merchant added or removed), the saved screenshots no longer match the selection. Should the case re-open, warn the owner, or is a fresh save the fix?
- [ ] **Re-save and old files:** when the owner re-saves with new screenshots, should the old ones be deleted from Google Drive, or kept as history?
- [ ] **No re-check:** the workflow has no merchant waiting step. If the merchant's live site changes after the clone is checked, is there a re-check, or is the clone a one-time snapshot?
- [ ] **Who clones:** who does the cloning — is it the case owner, or a different person/team? If it is someone else, should the case show who cloned the site and when?

---
*Sources: `frontend/src/features/cases/case-detail/renderers/wordpress-website-renderer.tsx`, `frontend/src/apis/cases.ts`, `backend/src/modules/cases/wordpress-case.service.ts`, `backend/src/modules/cases/case-detail-lookups.ts`, `backend/src/modules/cases/case-close-checklist.ts`, `backend/src/modules/cases/case-upload-validation.ts`, `backend/src/modules/cases/case-constants.ts`, `backend/src/modules/cases/case-transition.service.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/lib/storage/ownership.ts`, `backend/src/modules/queues/queue-workflow.ts`. Related files: 14 (EP Sub-Merchant Form), 20 (EP Sub-Merchants), 12 (case emails / close block).*
