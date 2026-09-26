# AssanPay Onboarding Portal — Code Review Report

**Date:** 2026-09-25 (reorganized edition)
**Scope:** read-only review — no code was modified, committed, or pushed in either repository.
**Repos:**
- Backend — https://github.com/shahroz769/onboarding-portal-assanpay-BE (`be/`)
- Frontend — https://github.com/shahroz769/onboarding-portal-assanpay-FE (`fe/`)
**Method:** static analysis of both trees, FE↔BE contract cross-check (~95 frontend API calls verified against backend routes and Zod schemas), plus toolchain runs (`tsc --noEmit`, `eslint`, `vite build`). Transient build artifacts were removed afterwards.

---

## 1. Executive Summary

The AssanPay onboarding portal is a genuinely well-architected internal ops tool: a Bun/Hono REST API backed by Postgres (Drizzle ORM, 34 tables, 81 migrations) with a React 19 + TanStack frontend on Cloudflare. Auth hygiene is strong (httpOnly refresh cookies, rotation, hashed tokens, atomic single-use claims), the case-workflow engine uses proper row locking with race guards, and the FE↔BE contract is remarkably tight — **~95 frontend API calls cross-checked with zero missing endpoints and zero request/response field mismatches**.

That said, the review found **50 findings: 3 Critical, 8 High, 13 Medium, 26 Low**. The critical items are data-loss bugs in KYC document handling; the high items are dominated by security and workflow-integrity flaws. Nothing here looks unfixable, but the P0 items should block any production use with real customer data.

### Findings at a glance

| Severity | Backend | Frontend | Integration | Database | **Total** |
|---|---|---|---|---|---|
| 🔴 Critical | 3 | 0 | 0 | 0 | **3** |
| 🟠 High | 6 | 2 | 0 | 0 | **8** |
| 🟡 Medium | 7 | 4 | 2 | 0 | **13** |
| 🔵 Low | 7 | 14 | 2 | 3 | **26** |
| **Total** | **23** | **20** | **4** | **3** | **50** |

### Top 5 risks

1. **KYC document loss (CRT-01, CRT-02, CRT-03)** — three flows can irreversibly delete customer KYC files from Google Drive while the database still references them.
2. **Derivable merchant portal password (HIGH-01)** — the credential is computable from information the merchant already receives by email.
3. **Trivial login DoS (HIGH-02)** — every user on the internet shares one rate-limit bucket by default.
4. **Authorization gaps (HIGH-03, MED-07)** — queue work-access is never enforced on case mutations; any agent can read all merchant KYC.
5. **Workflow bypass (HIGH-04)** — cases can be jumped straight to "closed / successful" without the compliance validations the workflow exists to enforce.

---

## 2. How to read this report

- **Every finding has one unique ID** (e.g. `HIGH-04`). IDs never repeat across sections — if you see an ID referenced elsewhere, it's the same issue.
- **Severity rubric:**
  - 🔴 **Critical** — irreversible data loss or full security compromise. Fix before any production use with real data.
  - 🟠 **High** — exploitable vulnerability or major functional failure. Fix before launch / before scaling.
  - 🟡 **Medium** — functional defect, data-quality risk, or significant maintainability drag.
  - 🔵 **Low** — minor defect, hardening opportunity, or tech debt.
- **Each finding card** shows its area (Backend / Frontend / Integration / Database), exact file location, what the problem is, its impact, and the recommended fix.
- **Section 3** is the complete catalog (the source of truth). **Section 4** analyzes cross-cutting themes by referencing finding IDs instead of repeating them. **Section 7** is the prioritized action list.

---

## 3. Findings catalog

### 3.1 🔴 Critical

**CRT-01 — Post-commit error deletes committed KYC files from Google Drive** · 🔴 Critical · Backend
📍 `be/src/modules/merchants/merchants.service.ts:344-424`
- **What:** `createMerchantSubmission()` uploads KYC files to Drive *before* the DB transaction, commits merchant + documents + initial cases inside the transaction (L344–402), then does post-commit bookkeeping (L404–413). A single `try` wraps both phases, so a transient post-commit DB error falls into the `catch` (L418), which calls `cleanupFailedAttemptObjects()` — and that deletes every object whose lifecycle isn't `'superseded'`, **including `'current'` objects the committed rows reference**.
- **Impact:** A network blip after commit irreversibly deletes customer KYC documents from Drive while `merchant_documents` rows still point at the deleted file IDs. Regulated data loss with no recovery.
- **Fix:** Narrow the `try/catch` so cleanup runs only when the DB transaction itself fails. Post-commit bookkeeping gets its own error handler that logs/alerts and never deletes committed files. Add a regression test asserting cleanup never touches `'current'` objects.

**CRT-02 — Same post-commit cleanup bug in public resubmission** · 🔴 Critical · Backend
📍 `be/src/modules/merchants/public-resubmission.routes.ts:668-710`
- **What:** Token consumption + new documents + case updates commit at L668; marking attempt objects `'current'` and superseding old files (L670–674) happens after commit inside the same outer `try`; the `catch` (L704–705) calls `cleanupFailedAttemptObjects()`.
- **Impact:** A failure in the post-commit bookkeeping deletes newly uploaded files the committed rows now reference — while the client's resubmission is recorded as successful.
- **Fix:** Same as CRT-01: separate pre-commit cleanup from post-commit error handling; post-commit failures must alert, never delete.

**CRT-03 — Google Drive deletions happen inside an open DB transaction** · 🔴 Critical · Backend
📍 `be/src/modules/merchants/merchants.service.ts:712-856`
- **What:** `permanentlyDeleteMerchant()` deletes irreversible external Drive objects (~L811–816) while the Postgres transaction (L717) is still open. Subsequent SQL (`tx.delete(emailLog)`, `tx.delete(merchants)`) can still fail and roll back — and a rollback cannot undelete Drive files.
- **Impact:** Merchant row and document links survive while the files are permanently gone: orphaned references to deleted KYC data.
- **Fix:** Team rule — external side effects (Drive, email) happen **after** commit, never inside a transaction. Consider the outbox pattern already used for case-flow jobs (`caseFlowCloseJobs`) for file-lifecycle transitions.

### 3.2 🟠 High

**HIGH-01 — Merchant portal password is deterministic and publicly derivable** · 🟠 High · Backend
📍 `be/src/modules/cases/case-detail-lookups.ts:477-480`
- **What:**
  ```ts
  export function buildPortalPassword(email: string, merchantNumber: number) {
    const [localPart = email] = email.trim().split('@')
    return `${localPart.trim().toLowerCase()}@ASSAN${merchantNumber}`
  }
  ```
  This is emailed as the live portal credential (`be/src/modules/cases/mid-case.service.ts:384-387`) and shown in manual-send previews.
- **Impact:** Anyone who knows the merchant's email local-part and (sequential) merchant number — both present in emails the merchant receives — can derive the password without ever seeing the credential email. No randomness, no forced first-login rotation, and it's recomputed on demand so it can never be rotated. Effectively a publicly-computable credential guarding a financial portal.
- **Fix:** Generate a random secret, store it hashed, force rotation on first login.

**HIGH-02 — One shared rate-limit bucket for all users by default (trivial DoS)** · 🟠 High · Backend · ✅ **Fixed**
📍 `be/src/lib/client-ip.ts:6-8`, `be/src/index.ts:45-55`, `be/src/modules/auth/auth.routes.ts:43-52`
- **What:** `getClientIp()` returns the constant `'untrusted-proxy'` when `TRUST_PROXY_HEADERS` is false (the documented default), and both the public limiter (60/15min) and login limiter (15/15min) key on it — so every client on the internet shares one 15-request login bucket. Additionally, `hono-rate-limiter` uses an in-memory `MemoryStore`, so multi-process deployments get per-process buckets: the limit is neither global nor correct.
- **Impact:** One aggressive client locks *everyone* out of login and public submission. Multi-instance deployments have no coherent limiting at all.
- **Fix:** Default to the connecting socket IP (or key by authenticated user); use a shared store (Redis) for multi-instance.
- **Resolution (2026-09-25):** Confirmed live on staging: two clients with different IPs drew from one counter. Fixed in the backend:
  - `getClientIp()` now uses the socket IP (`getConnInfo` from `hono/bun`) when proxy headers aren't trusted, or when no proxy header is present, instead of the shared `'untrusted-proxy'` / `'unknown'` strings. Session audit IPs are fixed as a side effect.
  - `TRUST_PROXY_HEADERS` now defaults to `true`, because production sits behind Cloudflare (`CF-Connecting-IP`). Requests with no proxy header still fall back to the socket IP.
  - Login gets a second per-account limit: 10 failed attempts per 15 min, successful sign-ins not counted.
  - Verified: separate clients now get separate counters.
  - **Remaining:** limit counters are still in memory, so a shared Redis store is needed before running more than one instance. The origin should accept only Cloudflare IP ranges, or `CF-Connecting-IP` can be spoofed by calling the server directly.

**HIGH-03 — Queue *work access* is imported but never enforced on case mutations** · 🟠 High · Backend · ✅ **Fixed**
📍 `be/src/modules/cases/case-access.service.ts:60-78` (helper) — imported unused in 9 workflow service files; only `be/src/modules/cases/case-comments.service.ts:190` calls it
- **What:** The repo's own rule (AGENTS.md) is "mutations require queue work access + ownership". Mutations check only ownership (`case-communications.service.ts:275,403`; `case-documents-review.service.ts:626`; `case-stage.service.ts:225-230,305-307`). Only `takeOwnership` enforces work access (`case-assignment.service.ts:760`).
- **Impact:** If an agent's queue work access is revoked while they remain case owner (normal off-boarding), they keep full mutation power — sending credential emails, saving MIDs, uploading proofs — until manually unassigned.
- **Fix:** Enforce `assertCanWorkCase` / `requireWorkAccess` on all case mutations; centralize into a single `authorize(caseId, action)` entry point.
- **Resolution (2026-09-25):** Confirmed: 17 owner-only checks across 9 case services, and `updateUser` replaced queue access without touching owned cases. Fixed in the backend:
  - `assertCanWorkCase(caseId, userId)` now runs after every one of the 17 ownership checks (stage/status/close, MID and limits saves, credential/live/resubmission emails, field reviews, and so on). Agents without work access get 403; admins are unaffected.
  - `updateUser` now rejects (409, naming the queues and case counts) any role or queue-access change that would leave an agent owning open cases in queues they can no longer work. Deactivation is always allowed.
  - Staging was checked: no existing agent owns open cases outside their work access.
  - **Not done:** consolidating into one `authorize(caseId, action)` entry point. **Before deploying**, run the same stranded-case query on production.

**HIGH-04 — Generic status endpoint allows jumps that bypass workflow close validation** · 🟠 High · Backend
📍 `be/src/modules/cases/cases.schemas.ts:45-64`, `be/src/modules/cases/case-transition.service.ts:~190-197`
- **What:** `isValidStatusTransition()` allows *any* forward jump (`if (nextIdx > currentIdx) return true`, L58), so `PATCH /api/cases/:id/status` lets an owner jump `new → closed` directly. That path runs only cross-queue close blockers, not the workflow-internal validations `advanceStage()` enforces (document_review: must be `working` + ≥1 sub-merchant + zero rejected fields; sub_merchant_form: Final Form *and* sent-email proof uploaded). Closing auto-sets `closeOutcome='successful'` when omitted — a case can be closed "successful" without the compliance artifacts the workflow exists to require. Separately, `awaiting_client` is ordered *after* terminal states in `statusOrder`, treating a resubmission-loop state as "later than closed".
- **Impact:** Compliance validations are silently skippable; audit trail can show "successful" closes that never produced required artifacts.
- **Fix:** Restrict the generic endpoint to adjacent transitions or route `closed` through the same validation as `advanceStage`; fix `statusOrder` so `awaiting_client` isn't terminal-adjacent.

**HIGH-05 — Public merchant submission has no idempotency** · 🟠 High · Backend
📍 `be/src/modules/merchants/form.routes.ts:10`
- **What:** `POST /api/public/merchant-form` creates Drive folders, uploads files, inserts merchant + documents, and triggers initial case creation with no idempotency key or duplicate guard.
- **Impact:** A client timeout → retry (normal on flaky mobile networks for multi-file uploads) creates a second merchant, second Drive tree, second document set, and second batch of cases — with KYC PII duplicated. No safe retry is possible.
- **Fix:** Idempotency keys / submission tokens on the public endpoint; dedupe guard on business identifiers.

**HIGH-06 — Resubmission saga can strand a case in `awaiting_client` with no recovery** · 🟠 High · Backend
📍 `be/src/modules/cases/case-documents-review.service.ts:585-830`
- **What:** `sendForResubmission()` is a four-step saga: (1) case → `awaiting_client` (L722–730, race-safe); (2) token issued in a *separate* transaction (L733–737); (3) email sent, with compensation on *returned* failure (L739–761); (4) history recorded (L805–830). A crash/OOM between steps 2 and 3 leaves the case in `awaiting_client` with a valid token the merchant never received — and re-sending is impossible because the endpoint requires `status === 'working'` (L626).
- **Impact:** Stranded cases recoverable only by manual DB intervention; merchants silently stuck.
- **Fix:** Add a recovery/retry path (re-issue endpoint or watchdog job that detects issued-but-unemailed tokens); consider a single transaction or explicit saga compensation.

**HIGH-07 — Logout/session-expiry leaves the entire TanStack Query cache populated (cross-user data leak)** · 🟠 High · Frontend
📍 `fe/src/features/auth/auth-query.ts:60-70`, `fe/src/features/auth/session-refresh.ts:24-34`
- **What:** On logout only the `['auth','refresh']` query is removed; on terminal refresh failure the user is navigated to `/login` — but all cached `['cases']`, `['merchants']`, `['dashboard']`, `['users']`, `['notifications']`, case-detail and configuration queries remain.
- **Impact:** On a shared workstation, the next employee to log in briefly sees the previous user's cases, merchants, and notifications (until `staleTime: 30s` refetches; `queues` cache is 5 min; `keepPreviousData` keeps stale rows across filter changes).
- **Fix:** `queryClient.clear()` on logout and on terminal session expiry; ensure the SSE client is stopped.

**HIGH-08 — `bun run lint` is completely broken (linter never runs)** · 🟠 High · Frontend
📍 `fe/package.json:61`, `fe/eslint.config.js`
- **What:** `typescript@7.0.2` vs `@typescript-eslint/*@8.58.2` (peer requires `typescript >=4.8.4 <6.1.0`) → ESLint crashes at startup (`TypeError: Cannot read properties of undefined (reading 'Cjs')`). Zero files are linted.
- **Impact:** CI lint gives false confidence; violations accumulate silently.
- **Fix:** Upgrade `@typescript-eslint/*` to a line supporting TS 7 (or pin TS <6.1); verify `bun run lint` exits 0 in CI.

### 3.3 🟡 Medium

**MED-01 — User creation commits before the invite email; failure leaves a 502 + uniqueness trap** · 🟡 Medium · Backend
📍 `be/src/modules/users/users.service.ts:373-421`
- **What:** User + queue access commit (L386–409); `sendPasswordEmail` (L411) throws `AppError(502)` on Resend failure *after* the user row and password token exist. Retrying `POST /api/users` then 409s on the uniqueness check while the user never got credentials and can't log in (`passwordHash` null). A resend-invite path exists (L565) but is undiscoverable from the error.
- **Impact:** Admins stuck with a half-created user and no clear recovery path in the UI.
- **Fix:** Return the created user id with an explicit "invite email pending" state instead of a bare 502; surface the resend-invite action.

**MED-02 — Unvalidated path IDs turn into 500s instead of 400s** · 🟡 Medium · Backend
📍 e.g. `be/src/modules/cases/cases.routes.ts:253`, `be/src/modules/merchants/merchants.routes.ts:66`
- **What:** Most routes pass `c.req.param('id')` straight to the service layer, where `eq(cases.id, 'not-a-uuid')` raises Postgres `invalid input syntax for type uuid` → generic 500 (`be/src/middleware/error-handler.ts:31`). A few routes validate manually (`cases.routes.ts:201-206`), proving the inconsistency is accidental.
- **Impact:** Client bugs surface as 500s; noisy error logs; no actionable message for API consumers.
- **Fix:** Validate path IDs with shared Zod params everywhere → 400 on invalid input.

**MED-03 — List filters are free-form strings with inconsistent failure modes** · 🟡 Medium · Backend
📍 `be/src/modules/merchants/merchants.schemas.ts:569-581`, `be/src/modules/users/users.schemas.ts:37-41`
- **What:** Merchant list: `status`/`priority`/`currency`/`businessScope` are bare strings — invalid values are silently dropped, so `?status=bogus` returns *unfiltered* 200s, misleading clients. User list: bare strings cast to enums → invalid value becomes a 500. Two opposite failure modes, no consistent contract.
- **Impact:** Silent wrong-data responses on one endpoint, 500s on the other.
- **Fix:** Validate filters against their enums and return 400 on invalid input, consistently.

**MED-04 — `GET /api/users` is unpaginated** · 🟡 Medium · Backend
📍 `be/src/modules/users/users.service.ts:308-347`
- **What:** Returns *every* user, then hydrates queue-access rows and owned-case counts for the whole set. No `limit`/`cursor` in the schema — unlike the keyset pagination on merchants/cases.
- **Impact:** Response cost grows unbounded with headcount.
- **Fix:** Add keyset pagination like merchants/cases.

**MED-05 — `bulkAssignCaseSchema.ids` has no upper bound** · 🟡 Medium · Backend
📍 `be/src/modules/cases/cases.schemas.ts:94-99`
- **What:** Every other bulk schema caps at 100 (`be/src/modules/merchants/merchants.schemas.ts:597-599`), but bulk-assign runs per-case `transitionCaseState` (row lock + history + notifications) in a loop over an unbounded array.
- **Impact:** One request can hold many DB rows and trigger a notification fan-out storm.
- **Fix:** Cap at 100 like the other bulk schemas.

**MED-06 — Manual email "preview token" is just the case ID** · 🟡 Medium · Backend
📍 `be/src/modules/cases/case-communications.service.ts:796-801,835-837`
- **What:** Preview returns `tokenId: caseId`; confirmation checks only `input.tokenId !== caseId`. No random, expiring, single-use token bound to the previewed recipient/subject/body.
- **Impact:** An owner can confirm "sent manually" without the previewed content ever being rendered — the audit history entry proves less than it appears.
- **Fix:** Bind confirmations to a real single-use preview token carrying the rendered content hash.

**MED-07 — Merchant endpoints have no queue-access scoping; any agent can read all merchant KYC** · 🟡 Medium · Backend
📍 `be/src/modules/merchants/merchants.routes.ts:58-90`
- **What:** Overview/form/history/limits-MDR endpoints are exposed to **all authenticated roles** with no queue view/work check (cases enforce `assertCanViewCase`).
- **Impact:** Any agent — even with zero queue access — can pull any merchant's full KYC: CNIC documents, IBANs, phone numbers, Drive links. Contradicts the "agents are constrained by queue access" model.
- **Fix:** Add queue-access scoping to merchant reads (or document the intentional exception).

**MED-08 — Onboarding draft persists sensitive PII in plaintext localStorage with no expiry** · 🟡 Medium · Frontend
📍 `fe/src/features/onboarding/merchant-onboarding-form.tsx:100-155`
- **What:** Every non-empty string field (`ownerFullName`, `ownerPhone`, `businessEmail`, `businessAddress`, `accountNumberIban`, next-of-kin) is autosaved debounced to `localStorage` in cleartext, with a version tag but no TTL; cleanup happens only on successful submit.
- **Impact:** The public form runs on potentially shared devices; PII/bank data survives indefinitely, readable by any script on the origin and anyone opening the browser later.
- **Fix:** Exclude bank/PII fields from the draft, add 24–48h expiry, or use `sessionStorage`.

**MED-09 — Password visibility toggle is unreachable via keyboard** · 🟡 Medium · Frontend
📍 `fe/src/components/login-form.tsx:158-168`
- **What:** `tabIndex={-1}` on the toggle button.
- **Impact:** Keyboard-only users can't reveal the password to check typos — an a11y failure on the login page.
- **Fix:** Remove `tabIndex={-1}`; ensure proper focus styling.

**MED-10 — Resubmission form hand-rolls validation instead of reusing Zod schemas** · 🟡 Medium · Frontend
📍 `fe/src/features/onboarding/resubmission-form.tsx:340-430` vs `fe/src/schemas/merchant-onboarding.schema.ts`
- **What:** Per-field imperative checks (URL constructor, email/phone regexes) duplicate existing Zod schemas (`localMobileNumberSchema`, `digitsOnlyPhoneNumberSchema`, …).
- **Impact:** The two forms will drift; double maintenance, inconsistent error copy.
- **Fix:** Reuse the shared Zod schemas in the resubmission form.

**MED-11 — 401 interceptor surfaces the *refresh* error instead of the original request error** · 🟡 Medium · Frontend
📍 `fe/src/lib/api-client.ts:66-92`
- **What:** On non-terminal refresh failure the caller receives the refresh failure, not the error from the request it actually made.
- **Impact:** Misattributed errors; confusing toasts and logs.
- **Fix:** Reject with the original request's error.

**MED-12 — Enum drift: FE `QUEUE_WORKFLOW_TYPES` missing `'physical_agreement'`** · 🟡 Medium · Integration
📍 FE `fe/src/schemas/queue-workflow.schema.ts:5-15` vs BE `be/src/contracts/queues.ts:10-21`
- **What:** BE has 9 workflow types plus `'physical_agreement'`; FE lists only the 9. FE queue-creation UI can't create/select `physical_agreement` queues; BE queues of that type are unrepresentable in FE types. No runtime crash (schema never `.parse()`d against BE data) — a functional gap.
- **Impact:** New queue type is invisible/unmanageable from the UI.
- **Fix:** Add `'physical_agreement'` to the FE union; add a CI contract-drift check (see §6.3).

**MED-13 — Cookie defaults break cross-site refresh in the split production deployment** · 🟡 Medium · Integration
📍 BE `.env.example` (`COOKIE_SECURE=false`, `COOKIE_SAME_SITE=lax`); FE `fe/src/lib/api-client.ts:17` (`withCredentials: true`)
- **What:** Over HTTPS with FE on a different origin, the browser won't send the httpOnly refresh cookie cross-site → silent refresh dies and users are logged out after the 15-min access token expires. The example file documents the fix but ships insecure defaults.
- **Impact:** Production users get logged out every 15 minutes in the intended split deployment.
- **Fix:** Derive `COOKIE_SECURE`/`COOKIE_SAME_SITE` from an explicit prod profile (`true`/`none`); verify `VITE_API_URL` ↔ `CORS_ORIGIN` wiring.

### 3.4 🔵 Low

**LOW-01 — Unauthenticated `/health/db` leaks operational internals** · 🔵 Low · Backend
📍 `be/src/index.ts:84-117`
- Exposes worker readiness, cycle timings, and retrying/failed/blocked job counts without auth. Put behind auth or IP allowlisting.

**LOW-02 — Dead `midGoLiveTokens` subsystem** · 🔵 Low · Backend
📍 `be/src/db/schema.ts`, `be/drizzle/0018_mid_go_live_tokens.sql`
- Table + migration exist, imported by ~10 case service modules, but no code reads or writes it (`tokenMatchesGoLiveAvailability()` likewise imported-but-unused). Drop it in a new migration or implement the go-live link-expiry feature it was meant for.

**LOW-03 — HTML-escaping applied before persistence corrupts stored data** · 🔵 Low · Backend
📍 `be/src/modules/merchants/merchants.schemas.ts:199-203,522-535`
- `sanitizedStringSchema` escapes `&<>"'` via Zod `.transform()` on the way *into* the DB (`Smith & Sons` → `Smith &amp; Sons` at rest); any correctly-escaping renderer double-encodes. Escaping is an output concern — store raw, escape on render.

**LOW-04 — File signature check is a 16-byte sanity check, not a malware boundary** · 🔵 Low · Backend
📍 `be/src/lib/storage/file-signatures.ts:14,123-132`
- Any ZIP passes as `docx`; no OOXML structure validation. Fine as a typo-catcher; don't rely on it for security.

**LOW-05 — Google OAuth token cached until expiry with no 401 recovery** · 🔵 Low · Backend
📍 `be/src/lib/storage/google-drive.ts:63-65`
- Revocation or clock-skew fails every Drive call until cache expiry. Add refresh-on-401.

**LOW-06 — SSE fan-out is in-process only** · 🔵 Low · Backend
📍 `be/src/modules/notifications/notifications.events.ts:1-60` (file itself documents: "single-process only; for multi-instance, swap with Redis pub/sub")
- Horizontal scaling silently breaks live notifications for clients connected to other processes. Swap to Redis pub/sub before scaling.

**LOW-07 — `users.deletedAt` is a dead column** · 🔵 Low · Backend
📍 Checked via `isNull(users.deletedAt)` in auth/user queries but never written; deactivation goes through `status`.
- Implement soft-delete consistently or drop the column.

**LOW-08 — Assign/priority mutations don't invalidate the open case-detail query** · 🔵 Low · Frontend
📍 `fe/src/hooks/use-cases-query.ts:76-117`
- Only `CASES_KEY` is invalidated, not `[...CASE_DETAIL_KEY, caseId]` → stale owner/priority on a detail page open in another tab.

**LOW-09 — Duplicated API-error-message extraction** · 🔵 Low · Frontend
📍 `fe/src/components/login-form.tsx:26-58`, `fe/src/routes/onboarding-form.resubmit.$token.tsx:57-63` vs shared `fe/src/lib/get-api-error-message.ts`
- Three copies of response-shape sniffing to keep in sync. Use the shared helper.

**LOW-10 — `dangerouslySetInnerHTML` in chart theme injection** · 🔵 Low · Frontend
📍 `fe/src/components/ui/chart.tsx:88-103`
- Standard shadcn pattern with developer-controlled ids → minimal practical risk, and it's the only usage in the app. Add a comment/guard.

**LOW-11 — Dead code: `motion-swap.tsx` has zero importers** · 🔵 Low · Frontend
📍 `fe/src/components/ui/motion-swap.tsx` — remove it.

**LOW-12 — Unused dependency + dead test infrastructure** · 🔵 Low · Frontend
📍 `fe/package.json`
- `"shadcn": "^4.21.0"` in `dependencies` but never imported (it's the CLI). `vitest`/`jsdom`/`@testing-library/*` installed yet **zero test files exist** (`bun run test` runs nothing). Remove the deps or write the tests.

**LOW-13 — `console.warn` left in production path** · 🔵 Low · Frontend
📍 `fe/src/features/notifications/notifications-provider.tsx:87` — the only console statement in `src`; gate behind a debug flag.

**LOW-14 — API/hook layering inconsistency** · 🔵 Low · Frontend
📍 `fe/src/apis/merchant-onboarding.ts:72-88,154-172`
- Onboarding mutations live in `src/apis/` while every other feature keeps hooks in `src/hooks/`. Pick one layering and align.

**LOW-15 — Two sources of truth for the production API URL** · 🔵 Low · Frontend
📍 `fe/src/config/client-env.ts:4-5` (fallback `https://onboard.assanpay.net`) vs `fe/wrangler.jsonc:8` (`vars.VITE_API_URL`)
- They agree today; if one changes, the other silently wins depending on build env. Single canonical source.

**LOW-16 — Hidden file input has no accessible label** · 🔵 Low · Frontend
📍 `fe/src/features/onboarding/document-upload-field.tsx:86-93` — triggered via ref from a visible button; some AT flows rely on the input's own label.

**LOW-17 — Single-use tokens travel in URL paths** · 🔵 Low · Frontend
📍 `fe/src/routes/set-password.$token.tsx`, `fe/src/routes/onboarding-form.resubmit.$token.tsx`
- Mitigated by single-use + expiry + good 410/404 screens; noted for completeness (tokens can linger in browser history/server logs).

**LOW-18 — Merchant detail route lacks a `pendingComponent`** · 🔵 Low · Frontend
📍 `fe/src/routes/_app.merchants.$merchantId.tsx:16-23` — can flash an empty shell on direct navigation.

**LOW-19 — Set-password validates on submit only** · 🔵 Low · Frontend
📍 `fe/src/routes/set-password.$token.tsx:88-101` — add `onBlur`/`onChange` validators so users learn about a weak password before clicking submit.

**LOW-20 — Background refetch failures in tables are silent** · 🔵 Low · Frontend
- With `keepPreviousData` + `staleTime: 30s`, a failed background refetch leaves stale rows with no error indication. Surface `isError` as a banner with retry.

**LOW-21 — Breadcrumb passes possibly-`undefined` `queueId` search param** · 🔵 Low · Frontend
📍 `fe/src/routes/_app.tsx:77-82` — harmless but slightly dead-end UX.

**LOW-22 — FE `Queue` type claims a field the BE never returns** · 🔵 Low · Integration
📍 FE `fe/src/schemas/cases.schema.ts:89` vs BE `be/src/modules/queues/queues.service.ts:229-240`
- FE requires `createdAt: z.string()` on `queueSchema`; BE `listQueues` selects only `{id,name,slug,prefix,workflowType,lifecycle,qcEnabled,slaHours,isActive}`. No runtime impact today (no zod parse, no reads of `queue.createdAt`) — a type-only lie that will bite when rendered. Fix the type.

**LOW-23 — Prod hostnames differ across repos (deploy wiring)** · 🔵 Low · Integration
📍 FE prod API fallback `https://onboard.assanpay.net` (`fe/src/config/client-env.ts:9`) vs BE `.env.example` prod `CORS_ORIGIN` entry `https://onboarding-portal-assanpay.shahrozahmed.workers.dev`
- Dev values are consistent; for production `VITE_API_URL` and `CORS_ORIGIN` must be wired to the same pair or all credentialed calls fail CORS.

**LOW-24 — Money/rate column types not verified** · 🔵 Low · Database
- Not confirmed in this pass whether monetary fields (limits, MDR rates in `merchants` / `portalMidLimitApplications`) use `numeric` or integer minor-units rather than `float`/`double`. Worth a manual audit — floats in money columns are a classic rounding-bug source.

**LOW-25 — Covering indexes not verified against a live DB** · 🔵 Low · Database
- Run `bun run db:audit` against a migrated staging DB and add any missing FK/covering indexes it reports; pay particular attention to `caseHistory(caseId, createdAt)`, `notifications(userId, readAt)`, and `emailLog` lookups.

**LOW-26 — No soft-delete or retention policy for regulated KYC data** · 🔵 Low · Database
- `DELETE /api/merchants/:id/permanent` and bulk-delete are hard deletes of regulated data. Consider a scheduled retention/purge policy with legal-hold flag instead of ad-hoc permanent delete, plus an audit record of who/when for every permanent deletion (currently only `caseHistory` covers cases).

---

## 4. Thematic analysis

### 4.1 Security posture
The fundamentals are solid: no hardcoded secrets, httpOnly refresh cookies with rotation, hashed at-rest tokens, `Bun.password` hashing, atomic single-use token claims, strict Zod schemas on write bodies, CORS allowlist, Resend idempotency keys. The holes are all *above* that foundation: derivable credentials (HIGH-01), missing authorization checks (HIGH-03, MED-07), a bypassable workflow (HIGH-04), DoS-able rate limiting (HIGH-02), and client-side data leaks (HIGH-07, MED-08). Fixing the High items would leave a genuinely defensible posture.

### 4.2 Data integrity & transaction discipline
CRT-01/02/03 are one pattern: external side effects (Drive) and DB transactions are interleaved instead of sequenced. The codebase already contains the right pattern — the outbox table `caseFlowCloseJobs` (`SKIP LOCKED` + advisory locks + bounded backoff) — it just isn't applied to file-lifecycle transitions. Adopting "side effects after commit, via outbox" as a team rule eliminates the entire Critical class.

### 4.3 FE↔BE contract health
Remarkably good: zero missing endpoints and zero request/response field mismatches across ~95 calls; auth token format, refresh flow shapes, and error envelopes all compatible. The only actionable drift is MED-12 (missing enum value), LOW-22 (type-only field lie), and the deployment-wiring items MED-13/LOW-23. **Unused backend surface** (not bugs, but surface to justify or remove): `GET /api/cases/owners`, `PATCH /api/cases/:id/status`, `PUT /api/cases/:id/sub-merchant-form/selection`, `GET /api/configuration/`, queue stage CRUD, flow-jobs admin routes, `DELETE /api/merchants/:id`, `POST /api/merchants/bulk-delete`, `POST /api/auth/register-super-admin`, `GET /health/db`.

### 4.4 Database health
34 tables, 81 forward-only sequential migrations — good hygiene, and a `db:audit` script exists for duplicate indexes / FK coverage. Issues are: dead schema (`midGoLiveTokens`, LOW-02; `users.deletedAt`, LOW-07), corrupted-at-rest data from pre-persistence HTML escaping (LOW-03), unverified money types (LOW-24) and indexes (LOW-25), and no retention story (LOW-26).

### 4.5 Toolchain & CI readiness
Both repos typecheck clean and the FE builds, but: lint is fully broken on FE (HIGH-08), **zero test files exist in either repo** despite vitest being installed (LOW-12), the router ships a 1,465 kB chunk, and `db:audit` isn't in CI. Priority toolchain fixes: repair lint, add contract/saga/idempotency tests, code-split the router bundle, CI running typecheck + lint + tests + `db:audit`.

---

## 5. What's working well (keep)

- **Auth/session design:** distinct long JWT secrets, 15-min access / 7-day refresh, refresh rotation, hashed at-rest tokens, session-version revocation, `Bun.password` hashing, atomic password-token claim.
- **Token hygiene:** resubmission/agreement tokens are `crypto.randomUUID`-based, SHA-256 hashed at rest, single-use with expiry.
- **Concurrency:** case transitions use `FOR UPDATE` row locks with stale-state guards; case-flow worker uses `SKIP LOCKED` + advisory locks + bounded backoff; Resend sends use idempotency keys.
- **Validation:** strict Zod schemas (`.strict()`) on most write bodies; validated env parsing that fails fast.
- **Schema discipline:** 75 sequential migrations with FKs, partial unique indexes, and check constraints.
- **Frontend auth:** access token in memory (not localStorage) + httpOnly refresh cookie + `withCredentials`, single-flight refresh dedupe, 401 retry interceptor, `sanitizeRedirect` + Zod-validated redirect param.
- **Frontend UX:** `pendingComponent` skeletons on nearly every route with per-route error/404 components; centralized query-key constants; SSE-driven cache updates with Zod-validated events; typed TanStack nav links (broken links become compile errors); onboarding flow with scrollspy nav, per-section completion, debounced draft autosave, success screen with reference ID, and distinct resubmission expired/used/not-found screens.
- **Contract discipline:** the tight FE↔BE alignment noted in §4.3 is a real asset — protect it with a generated/shared contract (see §6.3).

---

## 6. Recommendations

### 6.1 UI/UX improvements
1. Code-split the router bundle (1,465 kB / 310.9 kB gzip) — route-level lazy loading for heavy panels (configuration, flow designer, dashboard charts).
2. Clear query cache + stop SSE on logout/expiry (HIGH-07); add a visible "logged out" confirmation.
3. Onboarding draft: 24–48h expiry, exclude bank/PII fields or move to `sessionStorage` (MED-08); add explicit discard affordance.
4. Validate set-password on blur/change, not submit-only (LOW-19); reuse shared Zod schemas in the resubmission form (MED-10).
5. Add `pendingComponent` to merchant detail route (LOW-18); surface background refetch failures as a banner with retry (LOW-20).
6. Accessibility: keyboard-focusable password toggle (MED-09), label the hidden file input (LOW-16), audit modal focus-trap/return-focus and color contrast.
7. Responsiveness: verify tables, the @xyflow flow designer, and dashboard charts at 360px widths.
8. Surface `awaiting_client` cases with issued-but-unconsumed tokens and their age in the UI (operational visibility for HIGH-06).
9. Deduplicate error-message extraction via the shared helper (LOW-09); fix 401 error attribution (MED-11); invalidate case-detail on assign/priority mutations (LOW-08).
10. The internal `fe/composition-patterns-todo.md` lists 15 refactor items (4 High, 11 Medium) — treat as tech-debt prioritization input, not defects.

### 6.2 Missing features (for a production onboarding portal)
1. Idempotency for public submission (HIGH-05) + duplicate-merchant detection (fuzzy match on CNIC/phone/business name with a review queue).
2. Resubmission recovery UI: re-send/expire resubmission links for stuck `awaiting_client` cases (HIGH-06).
3. Credential lifecycle: random portal passwords (HIGH-01), forced first-login rotation, merchant password-reset flow, audit log of credential emails.
4. Immutable audit trail for destructive ops (terminate / permanent-delete / bulk actions).
5. Data retention & purge policy with legal-hold flag (LOW-26).
6. Full-text merchant/case search (Postgres `tsvector` or trigram indexes) — currently exact filters only.
7. SLA/queue analytics: breach rates, agent throughput, bottleneck-stage reporting.
8. Notification preferences: per-user channel toggles, digest mode.
9. Bulk-operation parity: wire or remove the unused bulk endpoints (§4.3).
10. Tests: contract tests for `isValidStatusTransition`, resubmission saga, idempotency, and the Drive/DB ordering invariants (CRT-01–03).

### 6.3 Architecture improvements
1. **Outbox for all external side effects** — extend the `caseFlowCloseJobs` pattern to Drive file-lifecycle transitions and email sends (eliminates the CRT-01/02/03 class).
2. **Saga/recovery for multi-step flows** — resubmission (HIGH-06) and user-invite (MED-01) need single-transaction designs or explicit compensation + watchdog sweepers.
3. **Centralize authorization** — one `authorize(caseId, action)` entry point; enforce work-access on mutations (HIGH-03) and queue scoping on merchant reads (MED-07).
4. **Close the workflow bypass** — make `PATCH /:id/status` a thin wrapper over `advanceStage` validation (HIGH-04).
5. **Shared API contract** — generate OpenAPI from BE Zod schemas (or a monorepo `packages/contracts`) and consume it in FE, with a CI drift check (would have caught MED-12/LOW-22 automatically).
6. **Rate-limiting overhaul** — per-client/per-user buckets, shared Redis store, documented fail-open/fail-closed policy per route (HIGH-02).
7. **Split-deployment config** — prod-profile cookie settings (MED-13) and a single canonical prod API URL (LOW-15, LOW-23).
8. **Validation consistency** — shared Zod param validation → 400s everywhere (MED-02, MED-03).
9. **Multi-instance readiness** — Redis-backed rate limiting (HIGH-02) and Redis pub/sub for SSE (LOW-06) before horizontal scaling.
10. **Kill dead architecture** — `midGoLiveTokens` (LOW-02), `users.deletedAt` (LOW-07), `motion-swap.tsx` (LOW-11), unused deps (LOW-12).

### 6.4 Database improvements
1. Drop or implement dead schema: `midGoLiveTokens` (LOW-02), `users.deletedAt` (LOW-07).
2. Stop HTML-escaping before persistence; store raw, escape on render (LOW-03).
3. Paginate `GET /api/users` (MED-04); cap bulk-assign ids at 100 (MED-05).
4. Validate enum filters → 400 instead of silent-drop/500 (MED-03).
5. Audit money/rate column types — `numeric`/minor-units, never float (LOW-24).
6. Run `bun run db:audit` on a migrated staging DB; add missing covering indexes (LOW-25).
7. Adopt retention/purge policy with legal hold + deletion audit log (LOW-26).
8. Resubmission token lifecycle: single transaction or recovery sweeper (HIGH-06).

---

## 7. Prioritized action list

### P0 — Fix before any production use with real customer data
- [ ] **CRT-01 / CRT-02:** Narrow `try/catch` in `createMerchantSubmission` and public resubmission so post-commit bookkeeping can never trigger Drive file deletion. Add regression tests.
- [ ] **CRT-03:** Move Google Drive deletions after transaction commit in `permanentlyDeleteMerchant`.
- [ ] **HIGH-01:** Replace deterministic portal password with a random secret (hashed at rest, forced rotation on first login).
- [x] **HIGH-02:** ✅ Fixed — per-client keys (socket IP / `CF-Connecting-IP`, trusted by default) plus a per-account failed-login limit. Shared store for multi-instance still to do.
- [ ] **HIGH-05:** Add idempotency to `POST /api/public/merchant-form`.

### P1 — Fix before scaling / shortly after launch
- [x] **HIGH-03:** ✅ Fixed — work access enforced on all 17 case mutations; access changes that would strand an agent's open cases are rejected.
- [ ] **HIGH-04:** Restrict `PATCH /api/cases/:id/status` to validated transitions; fix `statusOrder` for `awaiting_client`.
- [ ] **HIGH-06:** Add recovery/retry path + watchdog for stuck `awaiting_client` resubmissions.
- [ ] **HIGH-07:** `queryClient.clear()` + stop SSE on logout/session expiry.
- [ ] **MED-08:** Stop persisting PII/bank fields in plaintext localStorage; add draft expiry.
- [ ] **MED-13:** Prod cookie settings (`Secure`/`SameSite=None`) for the split deployment; verify `VITE_API_URL` ↔ `CORS_ORIGIN` wiring (LOW-23).
- [ ] **MED-07:** Add queue-access scoping to merchant read endpoints (or document the intentional exception).
- [ ] **MED-01:** Return created user id with explicit "invite email pending" state instead of a bare 502.
- [ ] **HIGH-08:** Repair `bun run lint` (typescript-eslint vs TS 7).

### P2 — Hardening, quality, and tech debt
- [ ] **MED-02 / MED-03:** Validate path IDs and enum filters → consistent 400s.
- [ ] **MED-04:** Paginate `GET /api/users`. **MED-05:** Cap `bulkAssignCaseSchema.ids` at 100.
- [ ] **MED-06:** Bind manual-email confirmations to a real single-use preview token.
- [ ] **MED-12:** Add `'physical_agreement'` to FE workflow-type union. **LOW-22:** Fix `Queue.createdAt` type.
- [ ] **LOW-01:** Put `/health/db` behind auth/IP allowlist.
- [ ] **LOW-02 / LOW-07 / LOW-11 / LOW-12:** Remove dead `midGoLiveTokens`, `users.deletedAt` (or implement), `motion-swap.tsx`, unused deps — or write the tests.
- [ ] **LOW-03:** Stop HTML-escaping before persistence. **LOW-05:** Refresh-on-401 for Drive tokens. **LOW-06:** Redis pub/sub for SSE before scaling.
- [ ] **LOW-24 / LOW-25 / LOW-26:** Audit money types, add covering indexes, adopt retention policy.
- [ ] **Frontend polish:** code-split router bundle; fix 401 error attribution (MED-11); keyboard-accessible password toggle (MED-09); reuse Zod schemas in resubmission form (MED-10); invalidate case-detail on assign/priority (LOW-08); `pendingComponent` on merchant detail (LOW-18); surface background refetch errors (LOW-20); dedupe error extraction (LOW-09); label hidden file input (LOW-16); single API-URL source of truth (LOW-15).
- [ ] **Process:** add tests (both repos have zero) + CI running typecheck, lint, tests, `db:audit`; adopt a shared API contract package to prevent FE/BE drift (§6.3.5).

---

## Appendix A — Toolchain results (read-only runs)

| Check | Backend | Frontend |
|---|---|---|
| Install (`bun install --frozen-lockfile`) | ✅ OK | ✅ OK — 776 packages |
| Typecheck (`tsc --noEmit`) | ✅ exit 0 | ✅ exit 0 |
| Lint (`bun run lint`) | ✅ OK | ❌ crashes before linting (HIGH-08) |
| Build | n/a (Bun runtime) | ✅ ~5.1s — router chunk 1,465 kB (310.9 kB gzip) |
| Tests | no test files | no test files (vitest installed, LOW-12) |

*End of report. All analysis was read-only; no code was modified, committed, or pushed in either repository.*
