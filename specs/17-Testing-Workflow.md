# 17 — Testing Workflow

## At a glance

| | |
|---|---|
| **What it is** | The rehearsal before a merchant goes live. The merchant gets a portal account with small testing limits, tries the system out, and receives their portal credentials by email. |
| **Who can use it** | Only the case owner, with `work` access to the Testing queue. |
| **Where it lives** | Testing queue (`slug: testing`, prefix `TS`, `workflowType: testing`). |
| **What it creates** | A `case_history` record that the testing limits were confirmed, and a credentials-sent record — there is no `testing_case_details` table. |
| **Main API** | `POST /api/cases/:id/testing/limits-applied` · `POST /api/cases/:id/testing/send-credentials-mail` |
| **Main code** | Frontend: `src/features/cases/case-detail/renderers/testing-renderer.tsx` · Backend: `src/modules/cases/testing-case.service.ts` (`markTestingLimitsApplied`) + `src/modules/cases/mid-case.service.ts` (`sendMidCreationCredentialsEmail`, `loadMidCreationCase`) |
| **Success looks like** | Credentials have been sent, the case closes successfully, and the merchant's state moves to `testing_completed` — the precondition for the Live case to close later (file 12). |

## In plain words — for a non-technical reader

Testing is the practice run before a merchant goes live. The merchant gets a portal login with small, safe limits, tries the system, and the team makes sure those limits are really in place before handing over the login details by email (or Gmail / WhatsApp). The case owner does the checking and the sending; an admin sets the limits on the dashboard first. When the login details have been sent, the case can close — and only then is the merchant ready for the Live step. What happens next: the Live case (file 19) can close, and the merchant goes live.

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `POST /api/cases/:id/testing/limits-applied` (`{ applied: true }`, `z.literal(true)`), `POST /api/cases/:id/testing/send-credentials-mail`, `POST /api/cases/:id/testing/send-credentials-mail/preview`, `POST /api/cases/:id/testing/send-credentials-mail/manual` (multipart); dashboard limits: `POST /api/dashboard/portal-mids/apply-limits` (categories `custom_wordpress`, `shopify`, `internal`) |
| Request / response | Limits-applied returns `{ limitsAppliedAt, limitsAppliedBy: { id, name } }`, idempotent on repeat; send body `{ recipientEmailType? }` (`submitter` \| `business`, default `submitter`) |
| Validation | Limits confirmation is the owner's word only — no check against `portal_mid_limit_applications`; sending blocked until MID details exist and limits are applied |
| Database | No `testing_case_details` table; facts are `case_history` rows (`testing_limits_applied` with `{ collection: '10-100', disbursement: '1000-50,000' }`, plus `mid_creation_email_sent` / `_manual` / `mid_creation_whatsapp_sent_manual`); credentials read from the MID Creation case's history |
| Auth / roles | Case owner only, with `work` access; limits applied on the dashboard by `super_admin` / `admin` only |
| Errors | `400 "This action is only available for Testing cases."`, `403 "Only the case owner can update this case."` / `"Only the case owner can send credentials."`, `400 "The case must be in the working stage."` (the `in_progress` stage check applies only to the limits confirmation) |
| Integrations / limits | Google Drive via MID Creation files; Resend / Gmail / WhatsApp for credentials via the `mid-creation` template; merchant status enum `pending` \| `testing` \| `live` \| `terminated`, internal event `testing_completed` |

## How it works — the journey

```
MID Creation case closes successfully
        ↓
Testing case created automatically (case-flow close trigger), status new
        ↓
Owner takes it (working)
        ↓
Admin applies testing limits on the dashboard (Portal MIDs panel)
        ↓
Owner confirms limits on the case → POST /:id/testing/limits-applied (no frontend caller found; see the Frontend section)
        ↓
Owner sends portal credentials → POST /:id/testing/send-credentials-mail
        ↓
Case stays in Working (the Testing template has no awaiting_merchant stage;
the password code is used up by the send)
        ↓
Owner closes the case successfully
        ↓
Merchant state → testing_completed (visible status: testing)
```

## The two jobs of this case

| Job | What it means |
|---|---|
| **1. Confirm the testing limits were applied** | Confirm, on the dashboard, that the small testing limits are actually in place for the merchant's MIDs. |
| **2. Send the merchant their portal credentials** | Send the MID, login email and password code saved during MID Creation (file 16) — by automatic email, manual Gmail, or WhatsApp. The case can only close once those credentials have been sent. |

## Who can do what

| Action | Who | Checks |
|---|---|---|
| Work the Testing case | Only the case owner, with `work` access to the Testing queue | `400 "This action is only available for Testing cases."` · `403 "Only the case owner can update this case."` / `"Only the case owner can send credentials."` · `400 "The case must be in the working stage."` — the send path checks `working` only; the `in_progress` stage check applies to the limits confirmation |
| Apply the testing limits (dashboard action the workflow depends on) | `super_admin` / `admin` only | `POST /api/dashboard/portal-mids/apply-limits` — the Testing owner does **not** apply limits from the case page; they confirm limits that were applied from the dashboard |

## Step by step

### 1. The case arrives

The case arrives `new` — normally created automatically when the MID Creation case closes successfully (case-flow close trigger). The owner takes it (`working`).

### 2. Apply the testing limits (on the dashboard)

An admin opens the dashboard's Portal MIDs panel and applies limits for the merchant's MIDs (file 10: `POST /api/dashboard/portal-mids/apply-limits`, categories `custom_wordpress`, `shopify`, `internal`).

Until that is done, the Testing renderer warns the owner: *"Apply limits from the dashboard before sending credentials to the merchant."*

The case detail carries the applied-limits state so the page can show it (`assertTestingLimitsAppliedForCredentials` / `getInternalPortalMidLimitsAppliedEntryForCredentials` in `case-detail-lookups.ts`).

### 3. Confirm the limits on the case

| | |
|---|---|
| **Endpoint** | `POST /api/cases/:id/testing/limits-applied` |
| **Body** | `{ applied: true }` — the schema is literally `z.literal(true)` |
| **What it writes** | A `case_history` row with action `testing_limits_applied` and details `{ collection: '10-100', disbursement: '1000-50,000' }` — those two ranges **are** the testing limits as recorded in the code |
| **Stage check** | The case must be `working` (`400 "The case must be in the working stage."`) and in an `in_progress` stage (`400 "Testing limits can only be confirmed in an in-progress stage."`). |
| **If it already exists** | Idempotent: it returns the existing `limitsAppliedAt` / `limitsAppliedBy` instead of writing a second row |
| **Returns** | `{ limitsAppliedAt, limitsAppliedBy: { id, name } }` |

> ⚠️ **Confirming is a statement by the owner, not a check against the dashboard.** The endpoint does not verify that limits were actually applied for this merchant's MIDs in the code reviewed. The credentials send does check: see step 4.

### 4. Send the credentials

| | |
|---|---|
| **Endpoint** | `POST /api/cases/:id/testing/send-credentials-mail` |
| **Body** | `{ recipientEmailType? }` (`sendMidCreationEmailSchema`, the same schema the MID flow uses) |
| **Preview** | `POST /api/cases/:id/testing/send-credentials-mail/preview` — same body, preview first |
| **Manual send** | `POST /api/cases/:id/testing/send-credentials-mail/manual` — multipart `file`, `tokenId`, `channel: email \| whatsapp`, `recipientEmailType` |
| **What the email carries** | The merchant portal credentials saved in MID Creation: the portal MID, the login email, and the portal password built from the email plus the generated password code, plus testing instructions |
| **Recipient** | Owner picks `recipientEmailType: 'submitter' \| 'business'`, default `submitter` |
| **How it can be sent** | Automatic Resend, manual Gmail, or WhatsApp — the renderer says: *"Send the saved merchant portal credentials and testing instructions by auto Resend, manual Gmail, or WhatsApp."* |

**Sending is blocked until two things are true:**

| Condition | What happens if it is missing |
|---|---|
| MID details exist | *"Save the portal MID and email in the MID Creation case before sending this mail."* — the renderer disables sending |
| Testing limits have been applied | The renderer disables sending until a `testing_limits_applied` history row exists (see the Frontend section). The server checks the dashboard's applied-limits record instead (step 4). |

**The server enforces the same conditions** (`sendMidCreationCredentialsEmail` in `mid-case.service.ts`, checked in this order):

| Condition | Server response |
|---|---|
| Case is the Testing workflow, owner, working | `400 "This action is only available for Testing cases."` / `403 "Only the case owner can send credentials."` / `400 "The case must be in the working stage."` |
| MID details saved | `400 "Save the merchant portal credentials in MID Creation before sending credentials."` |
| Limits applied for the merchant's portal MID (`portal_mid_limit_applications`) | `400 "Limits have not been applied for Portal MID <n>. Apply limits from the dashboard before sending credentials."` (`assertTestingLimitsAppliedForCredentials`) |
| An active portal password code exists | `400 "Generate the portal password code and set it on the merchant portal before sending credentials."` (`requireActivePortalPasswordCode`) |

**What sending does:**

- Sending does **not** change the case status. The Testing template has no `awaiting_merchant` stage (`getStageTemplateDefinitions` in `queue-workflow.ts` gives Testing only New, Working, Closed), and the send code never calls `request_merchant`. The case stays `working`.
- The email uses template `mid-creation`, idempotency key `mid-creation/<caseId>/<random UUID>` (a new key per send, so Resend does not dedupe repeat sends), and carries the portal email, the portal password (`<local part>@<code>`), payment and payout methods, the testing limits and the portal URL.
- A success writes history `mid_creation_email_sent` and then **consumes the password code** (`consumePortalPasswordCode`: `consumedAt` set, ciphertext dropped). A failure writes `mid_creation_email_failed` and leaves the code active, so the owner can retry.
- A manual send is confirmed by uploading a screenshot (see the manual endpoint above).
- Delivery is tracked like other case emails (file 12). The history actions counted as "credentials sent" are `mid_creation_email_sent`, `mid_creation_email_sent_manual` and `mid_creation_whatsapp_sent_manual` (`MID_CREATION_CREDENTIALS_SENT_ACTIONS`). `mid_creation_email_failed` is not counted.

### 5. Closing

The close checklist for this workflow is a single item:

| Checklist item | What satisfies it |
|---|---|
| Send merchant portal credentials by auto Resend, manual Gmail, or WhatsApp before closing this case | At least one credentials-sent history entry must exist for the case (`getMidCreationCredentialsSentEntry`) |

Advancing closes the case successfully.

> ⚠️ **The checklist does *not* require the limits-applied confirmation.** A case can close with credentials sent but limits never confirmed, if the owner never pressed the confirm button.

### 6. What happens on close

| | |
|---|---|
| **Merchant state** | Moves to `testing_completed` (`writeMerchantState`, event `testing_completed`, in `case-stage.service.ts` `advanceStage`). This runs only on a successful close. The unsuccessful close path (`closeUnsuccessful`) has no such hook, so it does not record it. |
| **Merchant status enum** | `pending` \| `testing` \| `live` \| `terminated` — the merchant's visible status during this phase is `testing`; `testing_completed` is the internal merchant state-machine event that records that testing finished |
| **Why it matters** | That completed-testing state is exactly what the Live close guard checks ("Live without testing" — file 12): a Live case cannot close successfully unless the merchant went through testing. If it has not, the Live close is rolled back with `409 "Close the Testing case before taking this merchant live."` (`merchant-state-machine.ts`, `case-stage.service.ts`). |

## How it is implemented — Frontend

- **Renderer:** `frontend/src/features/cases/case-detail/renderers/testing-renderer.tsx`. Sections: "Testing Limits" (shows the limits and whether a `testing_limits_applied` row exists; the code reviewed has no control that confirms the limits) and "Send Credentials" (recipient choice, preview, send, manual confirm). The renderer disables sending when the MID details are missing or the limits have not been applied, and explains why in each case.
- **API calls** (`frontend/src/apis/cases.ts`):

| Function | Endpoint |
|---|---|
| `sendMidCreationEmail()` | `POST /api/cases/:id/testing/send-credentials-mail` — note the function name: the send function lives in the MID service on the backend but is called "sendMidCreationEmail" on the frontend |
| `fetchMidCreationEmailPreview()` | Preview endpoint above |
| `confirmMidCreationEmailManual()` | Manual-confirm endpoint above |

> ⚠️ **No frontend caller:** a search of `frontend/src` finds no call to `POST /api/cases/:id/testing/limits-applied` (not in `apis/cases.ts`, not in the hooks, not in the renderer). The Send button needs `limitsAppliedAt` (`canSendCredentials` in `testing-renderer.tsx` includes `Boolean(limitsAppliedAt)`), which the case detail reads from a `testing_limits_applied` history row (`case-query.service.ts`). So in the UI, credentials cannot be sent until another API client calls that endpoint. The server's send check is the dashboard record (step 4), not this row.

## How it is implemented — Backend

| File | What it does |
|---|---|
| `backend/src/modules/cases/testing-case.service.ts` | `markTestingLimitsApplied` — the whole file |
| `backend/src/modules/cases/mid-case.service.ts` | `sendMidCreationCredentialsEmail`, `loadMidCreationCase` — the send side lives here, not in the testing service |
| `backend/src/modules/cases/case-communications.service.ts` | `getMidCreationEmailPreview` and `confirmMidCreationEmailManual` (preview and manual confirm for the credentials email) |
| `backend/src/modules/cases/portal-password-code.service.ts` | `requireActivePortalPasswordCode`, `consumePortalPasswordCode`, and the generate guard that returns 409 once a code has been used |

**Endpoints** (all under `/api/cases/:id`):

| Endpoint | Body | Notes |
|---|---|---|
| `POST /:id/testing/limits-applied` | JSON `{ applied: true }` (`markTestingLimitsAppliedSchema`) | Returns `{ limitsAppliedAt, limitsAppliedBy: { id, name } }` |
| `POST /:id/testing/send-credentials-mail` | JSON `{ recipientEmailType? }` | `sendMidCreationEmailSchema`, the same schema the MID flow uses |
| `POST /:id/testing/send-credentials-mail/preview` | Same body | Preview |
| `POST /:id/testing/send-credentials-mail/manual` | Multipart (`file`, `tokenId`, `channel`, `recipientEmailType`) | Manual confirm with screenshot. `tokenId` must equal the active portal password code id, else `409 "The portal password code changed after this preview. Load the preview again."`. Stores the screenshot as `mid_creation_email_proof` / `mid_creation_whatsapp_proof`, writes `mid_creation_email_sent_manual` / `mid_creation_whatsapp_sent_manual`, and consumes the code (`case-communications.service.ts`, `confirmMidCreationEmailManual`). |

**Storage:** there is no `testing_case_details` table. Both facts are `case_history` rows on the case: `testing_limits_applied` (with the `10-100` / `1000-50,000` details) and the credentials-sent actions. The lookups (`getTestingLimitsAppliedEntry`, `getMidCreationCredentialsSentEntry` in `case-detail-lookups.ts`) read history to answer "did this happen?". The credentials themselves are read from the MID Creation case's saved history (`getMidCreationCredentials` / `getMidCreationCredentialsSentEntryForCredentials`), **not** re-entered on the Testing case.

**Email:** the `mid-creation` template (`backend/src/modules/email/templates/mid-creation.tsx`). Proof kinds for manual sends are `mid_creation_email_proof` / `mid_creation_whatsapp_proof`.

**Case numbering:** prefix `TS`.

**Stages:** New → Working → Closed (`getStageTemplateDefinitions` in `backend/src/modules/queues/queue-workflow.ts`). No `awaiting_merchant` stage.

## Data, validation and edge cases

| Case | What happens |
|---|---|
| **Testing limits in two places** | The `testing_limits_applied` history row always records the fixed strings `collection: '10-100'`, `disbursement: '1000-50,000'` (`markTestingLimitsApplied`), whatever the configuration says. The credentials email, by contrast, shows the configured testing limits (`limitsAndMdr.testing` from Configuration → Limits & MDR; the defaults are the same numbers). If the configured testing limits change, the email follows and the history row does not. |
| **Confirming limits does not verify them** | The endpoint trusts the owner's `{ applied: true }`. It does not check `portal_mid_limit_applications` for the merchant's MIDs. An owner can confirm limits that were never applied. |
| **Credentials depend on MID Creation** | If the MID Creation case never saved the MID/email, or no portal password code was generated, the credentials email has nothing to send. The renderer blocks sending in that case. The backend refuses with the messages listed in step 4 (`Save the merchant portal credentials in MID Creation…`, `Limits have not been applied for Portal MID…`, `Generate the portal password code…`). |
| **Re-sending is blocked** | After one successful send the password code is consumed (`consumedAt`). A second send then finds no active code and returns `400 "Generate the portal password code and set it on the merchant portal before sending credentials."`. Generating a new code is refused with `409 "Credentials were already sent with this merchant’s portal password code."` (`portal-password-code.service.ts`). So credentials cannot be re-sent for the same merchant once sent, through either the code or the send endpoints. |
| **Credentials-sent is per case, not per merchant** | The close checklist looks for a credentials-sent entry on **this** Testing case. Sending credentials from a different case does not satisfy it. |
| **Re-sending** | Not possible after a successful send, because the password code is consumed (see the row above). A failed send can be retried, since the code stays active. |
| **Merchant state on close** | Closing Testing successfully is what records `testing_completed` for the merchant. Closing it unsuccessfully does not. A merchant whose Testing case was closed unsuccessfully cannot go live until a new Testing case closes successfully (the Live guard enforces it). |
| **Not found in the code reviewed** | Any record of what the merchant actually did during testing (test transactions, issues found); any expiry of the testing phase; any check that the merchant logged in with the credentials. |

## What to check — is this what you intended?

- [ ] **Testing limits recorded as fixed text:** the history row always says `10-100` / `1000-50,000`, while the email shows the configured testing limits. Should the history row record the configured values instead, or are the fixed numbers intended?
- [ ] **No confirm control:** no screen calls `POST /api/cases/:id/testing/limits-applied`, so the Send button stays disabled unless another client calls it. Should the confirm control be added, or should the Send gate read the dashboard's applied-limits record instead?
- [ ] **Confirm is the owner's word:** confirming "limits applied" is the owner's word — the system does not check the dashboard's applied-limits records. Should the confirm button verify against the applied records, or even be automatic once limits are applied?
- [ ] **Close does not require limits confirmation:** the close checklist requires the credentials to be sent, but **not** the limits to be confirmed. Should a Testing case be closable without the limits ever being confirmed?
- [ ] **No record of testing activity:** there is no record of what the merchant did while testing. Do you need one — for example a note from the merchant, or a test-transaction check — before the case closes?
- [ ] **No time limit:** should the Testing phase have a time limit (for example, the case goes overdue if the merchant does not test within a week)?
- [ ] **Single send:** the code is consumed by the first successful send, so the merchant cannot be sent credentials twice. Is that intended, or should the owner be able to resend (for example after the merchant loses the email)?
- [ ] **Split responsibilities:** the credentials email is sent from the Testing case, but the send code lives in the MID Creation service and is named "sendMidCreationEmail". That is only a naming detail, but is the split of responsibilities (MID Creation prepares, Testing sends) how you want it to stay?

---
*Sources: `frontend/src/features/cases/case-detail/renderers/testing-renderer.tsx`, `frontend/src/apis/cases.ts`, `frontend/src/hooks/`, `backend/src/modules/cases/testing-case.service.ts`, `backend/src/modules/cases/mid-case.service.ts`, `backend/src/modules/cases/case-detail-lookups.ts`, `backend/src/modules/cases/case-stage.service.ts`, `backend/src/modules/email/templates/mid-creation.tsx`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/case-communications.service.ts`, `backend/src/modules/cases/portal-password-code.service.ts`, `backend/src/modules/cases/case-detail-lookups.ts` (`assertTestingLimitsAppliedForCredentials`, `buildPortalPassword`), `backend/src/modules/merchants/merchant-state-machine.ts`, `backend/src/modules/queues/queue-workflow.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/case-close-checklist.ts`. Related files: 10 (dashboard / Portal MIDs), 12 (case emails / Live guard), 16 (MID Creation).*
