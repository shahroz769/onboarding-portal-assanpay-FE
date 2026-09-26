# AssanPay Onboarding Portal — Complete Bug List
**Date:** 2026-09-26
**Scope:** Frontend (FE) + Backend (BE) — browser E2E + full API sweep (117/117 routes)
**Repos tested (read-only clones, no tracked changes made):**
- github.com/shahroz769/onboarding-portal-assanpay-FE
- github.com/shahroz769/onboarding-portal-assanpay-BE

**Test environment:** Backend Bun+Hono on `http://localhost:3000`, local PostgreSQL (`assanpay_fulltest`) seeded with 8 queues (7 active), 23 stages, 6 merchants, 4 test users, workflow cases. Frontend TanStack Start dev on `http://localhost:5173`. Browser: system Chromium 152 via Playwright. Static: `bun run typecheck` PASS on FE and BE.

---

## P1 — Fix first

### B-001 — Managed-user creation persists user despite email failure
- **Location:** `be/src/modules/users/users.service.ts:412-459` — DB transaction commits (~line 450), `sendPasswordEmail()` runs after (450-456).
- **Repro:** `POST /api/users` with valid payload while invitation-email provider is unconfigured → `502 {"error":"API key is invalid"}`, but the user row is committed and stays `active`. Retrying the same request → `409`.
- **Expected:** Whole operation rolls back on email failure, or API returns explicit "created, invitation pending" state with a resend path.
- **Actual:** Failed-looking request leaves a live, inaccessible account; admin cannot cleanly retry (409 on retry).
- **Impact:** Orphaned active accounts; confusing admin UX; retry path broken.
- **Fix:** Move `sendPasswordEmail()` inside the transaction outcome handling — roll back on failure — or model 202 with explicit pending-invitation semantics and a resend endpoint.

### B-006 — SSE notification stream killed by server idle timeout
- **Location:** `be/src/modules/notifications/notifications.routes.ts:18` (`NOTIFICATION_STREAM_HEARTBEAT_MS = 25_000`); `be/src/index.ts` (Bun serve export sets no `idleTimeout`).
- **Repro:** `curl -N -H "Authorization: Bearer <token>" http://localhost:3000/api/notifications/stream` → server sends `event: ready` / `data: ok`, then closes after ~12s idle (curl exit 18, "transfer closed with bytes remaining"). The 25s heartbeat never fires — Bun's default ~10s idle timeout kills the socket first. Verified twice (~12.0s both runs).
- **Expected:** Stream stays open; heartbeat keeps it alive.
- **Actual:** Every authenticated page's `EventSource` dies with `net::ERR_INCOMPLETE_CHUNKED_ENCODING` and reconnects in an endless ~12s loop (observed in browser on merchant pages).
- **Impact:** Notification delivery unreliable (client mid-reconnect much of the time); reconnect churn adds auth/request load; events missed between kill and reconnect.
- **Fix:** Heartbeat more often than idle timeout (e.g. 5–8s), and/or set `idleTimeout` (e.g. 60s+) on the Bun serve export in `src/index.ts`.

### C-003 — No automated tests exist; FE test runner is broken
- **Location:** FE `package.json` (`"test": "vitest run"`); repo-wide search.
- **Repro:** `bun run test` in FE crashes before discovery: `ReferenceError: module is not defined` from `workers/runner-worker/index.js` while resolving Cloudflare worker types. Zero `*.test.*` / `*.spec.*` files in FE. BE has no `test` script and zero test files.
- **Expected:** Working test command + baseline coverage of auth, case workflow, money-movement config.
- **Actual:** Nothing to run; the runner itself is broken.
- **Impact:** No regression safety net for a system handling merchant PII, agreements, payout configuration.
- **Fix:** Fix Vitest/Cloudflare worker-types resolution, then add baseline suites.

---

## P2 — Fix next

### B-002 — Duplicate queue slug returns 500 instead of 409
- **Location:** `be/src/modules/queues/queues.routes.ts:63`, `be/src/modules/queues/queues.service.ts` (`createQueue()`).
- **Repro:** `POST /api/queues` with existing slug `documents-review` → `500 {"error":"Internal server error."}`; server log shows `duplicate key value violates unique constraint "queues_slug_unique"`.
- **Expected:** `409` with clear "slug already exists" message.
- **Actual:** 500; clients can't distinguish conflict from server failure.
- **Impact:** Poor API contract; internal error shape leaked. (No partial row — atomic.)
- **Fix:** Pre-check slug/prefix uniqueness or map unique-violation to 409.

### B-007 — CSRF protection on auth endpoints silently bypassed for JSON requests
- **Location:** `be/src/modules/auth/auth.routes.ts:72-74` — `authRoutes.use('/login'|'refresh'|'logout', csrf({ origin: env.CORS_ORIGIN }))`.
- **Root cause:** Hono's `csrf()` only enforces the origin check when Content-Type matches form types (`application/x-www-form-urlencoded|multipart/form-data|text/plain`) — verified in `node_modules/hono/dist/middleware/csrf/index.js:46`. All real API traffic uses `application/json`, so the check is a no-op.
- **Repro:**
  - `curl -X POST http://localhost:3000/api/auth/login -H 'Origin: http://evil.com' -H 'Content-Type: application/json' -d '{...}'` → **200** + `Set-Cookie: refresh_token` (should be 403)
  - `POST /api/auth/refresh` with `Origin: http://evil.com` + JSON → **401** "Missing refresh token" (reached handler; CSRF not enforced — without JSON content-type it correctly 403s)
  - `POST /api/auth/logout` with `Origin: http://evil.com` + JSON → **200** (cross-site logout succeeds)
- **Expected:** Spoofed Origin rejected with 403 regardless of Content-Type.
- **Actual:** Any JSON request bypasses the CSRF check entirely.
- **Impact:** Login CSRF (session planting), logout CSRF, refresh CSRF; code gives false confidence. Qualifies the earlier "verified OK" note (spoofed-origin refresh → 403 holds only without JSON content-type). Note: real browsers preflight cross-site JSON POSTs, limiting practical exploitability — this is a defense-in-depth gap.
- **Fix:** Replace `csrf()` with explicit origin check on all non-safe methods (compare `Origin`/`Referer` against `env.CORS_ORIGIN`), independent of Content-Type.

### B-008 — Password reset/invite invalidates the prior token even when the email fails
- **Location:** `be/src/modules/users/users.service.ts:311-351` (`sendPasswordEmail`); `be/src/modules/auth/auth.service.ts:340-370` (`issuePasswordToken`).
- **Repro:** `POST /api/users/:id/reset-password` (or bulk) when email provider fails → `502`. `sendPasswordEmail` calls `issuePasswordToken()` FIRST (line 318), which consumes/invalidates all prior unconsumed tokens for that user+purpose (auth.service.ts:349-359); then the send fails and throws 502 — the new token is never delivered.
- **Expected:** Token issuance/invalidation of the old token only if the email is accepted for delivery (or old token stays valid until new one is successfully sent).
- **Actual:** Every failed send burns the user's existing valid invite/reset link and replaces it with an undelivered token. Scenario: invite delivered OK (token A works, user hasn't clicked) → admin retries → send fails → 502 → token A dead, token B never delivered → user has NO working link, admin sees only an error.
- **Impact:** Users locked out of invite/reset flow by transient email failures; dead token rows accumulate. Same family as B-001.
- **Fix:** Send email first, then issue/rotate token only on success — or keep previous token valid until new email confirmed sent.

### B-009 — Malformed UUID path params return 500 instead of 400 (systemic)
- **Location:** e.g. `be/src/modules/queues/queues.routes.ts:58` (`GET /:id` → `getQueueDetail(c.req.param('id'))` with no `zodValidator('param', ...)`); same pattern in cases, merchants, notifications, configuration, dashboard routes. Only `users.routes.ts` (4 uses) and `auth.routes.ts` validate params.
- **Repro:** `curl -H "Authorization: Bearer $T" http://localhost:3000/api/queues/not-a-uuid` → `500 {"error":"Internal server error."}` (Postgres invalid-UUID error in logs). Same 500 for `GET /api/merchants/not-a-uuid`, `/overview`, `GET /api/cases/not-a-uuid`, `/comments`, `PATCH /api/notifications/not-a-uuid/read`.
- **Expected:** `400` with clear "invalid id" message (as users routes do via `userIdParamSchema`).
- **Actual:** 500; internal error shape leaked; log noise on every malformed request.
- **Impact:** Poor API contract, error-log spam, minor info disclosure (DB error type in logs).
- **Fix:** Add `zodValidator('param', z.object({ id: z.uuid() }))` (and `stageId` where applicable) to all `:id`/`:stageId` routes, matching the users-routes pattern.

### B-010 — Queue stage reorder always fails with 500
- **Location:** `be/src/modules/queues/queues.service.ts:808-820` (`reorderQueueStages`); route `be/src/modules/queues/queues.routes.ts:121`.
- **Repro:** `curl -X PATCH http://localhost:3000/api/queues/<queueId>/stages/reorder -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"revision":2,"stageIds":[...all 5 in new order...]}'` → `500 {"error":"Internal server error."}`
- **Root cause:** Two-phase reorder sets `order = -(index+1)` as temp values to dodge the unique `(queue_id, order)` constraint, but the DB has a `queue_stages_order_positive` CHECK constraint — the first UPDATE immediately violates it (Postgres 23514, `update "queue_stages" set "order" = -1 ...` in server log). The migration added the check constraint without updating the service code.
- **Expected:** 200 with reordered stages.
- **Actual:** 500 on every valid reorder; endpoint completely non-functional.
- **Impact:** Super admins cannot reorder queue stages at all (no UI/API workaround short of SQL). No data corruption — transaction rolls back cleanly (stages/orders verified intact afterward).
- **Fix:** Use temp values satisfying the check constraint (e.g. offset by large positive base like `order + 100000`), or single CASE-based update instead of two-phase.

### B-012 — `subMerchantKey` not validated as UUID → 500
- **Location:** `be/src/modules/cases/cases.routes.ts:515-527` (route); `be/src/modules/cases/cases.schemas.ts:259-263` (`selectSubMerchantFormSchema` uses `z.string().min(1).max(80)`); service uses the key directly as UUID in DB lookup → Postgres 22P02 → 500.
- **Repro:** `PUT /api/cases/<id>/sub-merchant-form/selection` (owner token) with body `{"subMerchantKey":"sm-key-1"}` → `500 {"error":"Internal server error."}`
- **Expected:** `400` — the key is a `sub_merchant_draft_templates.id` UUID.
- **Actual:** Malformed input → 500; inconsistent with every other ID-bearing endpoint.
- **Impact:** API contract wart; log noise.
- **Fix:** Change schema to `z.string().uuid()` (or safeParse at route and throw 400).

### B-013 — Agreement manual email confirm skips tokenId binding
- **Location:** `be/src/modules/cases/cases.routes.ts:713-740` (`/:id/agreement/send-mail/manual`).
- **Repro:** `POST /api/cases/<id>/agreement/send-mail/manual` (owner token) with multipart `file=<png>`, `tokenId=` (empty), `channel=gmail`, `recipientEmailType=submitter` → `200 {"status":"sent",...}` and case advanced stages.
- **Expected:** `400 "tokenId is required."` — every sibling manual endpoint (`send-for-resubmission/manual` :678-681, `live/send-mail/manual` :278-281, `testing/send-credentials-mail/manual` :766-769) extracts and requires `tokenId` to bind the manual proof to the previewed email.
- **Actual:** Token binding that prevents confirming the wrong email is bypassed for the agreement flow.
- **Impact:** Agent can mark agreement email as manually sent without ever previewing/acknowledging its content.
- **Fix:** Extract and validate `tokenId` like the sibling routes.

### C-001 — Optional multipart fields rejected when omitted
- **Location:** `be/src/modules/merchants/merchants.schemas.ts:320-341` (`parseMerchantFormData()`).
- **Repro:** `POST /api/public/merchant-form` (multipart) omitting optional `swiftCode` → `400 {"error":"Field \"swiftCode\" must be a text value."}`. Sending `swiftCode=""` succeeds. Root cause: parser iterates every schema key and requires a string value even for optional fields (`formData.getAll()` returns `[]` → `values[0]` is `undefined`).
- **Expected:** Optional fields omittable, consistent with JSON schema where `swiftCode` is `.optional()`.
- **Actual:** Optional fields must be sent as empty strings.
- **Impact:** FE works around this today (appends every field, `swiftCode: ''` default — `fe/src/features/onboarding/merchant-onboarding-form.tsx:348,384-387`), so no user-facing breakage; third-party API consumers get confusing 400.
- **Fix:** In `parseMerchantFormData`, treat absent optional fields as `undefined` instead of throwing.

---

## P3 — Polish / harden

### B-004 — Field reviews accept arbitrary nonexistent field names
- **Location:** `be/src/modules/cases/case-documents-review.service.ts:225` (`saveFieldReviews()`).
- **Repro:** `PUT /api/cases/:id/field-reviews` with `{"fieldName":"owner_cnic_front","status":"rejected"}` (not a valid reviewable field; documents use `doc_<uuid>`) → `200 {"saved":1}`.
- **Expected:** `fieldName` validated against known merchant fields / `doc_<uuid>` references.
- **Actual:** Bogus rejected field blocks case closure ("resolve all rejected fields") but can never be satisfied via public resubmission (`400 "Unknown merchant field"`); only fix is re-approving the exact bogus name.
- **Impact:** API robustness; mainly typo/misuse trap since FE sends valid names.
- **Fix:** Validate each `fieldName`: must be a key of `MERCHANT_FIELD_LABELS` or a `doc_<uuid>` referencing an existing merchant document for the case.

### B-005 — Public resubmission lookup exposes internal UUIDs
- **Location:** `GET /api/public/resubmission/:token` response.
- **Repro:** Response includes `caseId`, `merchantId`, and `ownerId` (agent's internal user UUID) to unauthenticated callers.
- **Expected:** Merchant-facing payload contains only `caseNumber`, `merchantName`, `rejections`, `expiresAt`.
- **Actual:** Internal row/user UUIDs exposed (unguessable, so low risk, but unnecessary).
- **Impact:** Information disclosure (low); aids enumeration.
- **Fix:** Strip internal IDs from the public response.

### B-011 — Agreement draft upload with invalid businessType returns 500
- **Location:** `be/src/modules/configuration/configuration.routes.ts:179-191` (no param validation); `be/src/modules/configuration/configuration.service.ts:432` (`businessTypeSchema.parse(...)` throws); `be/src/middleware/error-handler.ts` (no ZodError → 400 translation).
- **Repro:** `curl -X POST http://localhost:3000/api/configuration/agreements/bogus_type/draft -H "Authorization: Bearer $T" -F "file=@/tmp/draft.pdf;type=application/pdf"` → `500 {"error":"Internal server error."}`
- **Expected:** `400` with clear "invalid business type" message.
- **Actual:** Uncaught ZodError → 500.
- **Impact:** API contract wart; log noise. Other `.parse()` calls are defense-in-depth behind route-level `zodValidator`, so this route is the live instance.
- **Fix:** Add `zodValidator('param', z.object({ businessType: businessTypeSchema }))` on the route, or translate ZodError to 400 in the global error handler.

### C-002 — API documentation stale
- **Location:** `be/apis/auth.md`, `be/apis/users.md`.
- **Detail:** `auth.md` documents `/api/auth/register-admin` and roles `admin/supervisor/employee`; code uses `/api/auth/register-super-admin` and `super_admin/admin/agent`. `users.md` documents old password-in-create flow; current flow sends invitation links and requires gender/queue access fields.
- **Impact:** Misleading for integrators.
- **Fix:** Regenerate docs from zod schemas and route table.

---

## Candidates (need expected-behavior confirmation)

### C-004 — Sub-merchant draft allows duplicate seller codes
- **Location:** `be/src/modules/configuration/configuration.routes.ts:193-210`; `configuration.service.ts:516-...` (`createSubMerchantDraft`); schema `src/db/schema.ts:311` (no unique constraint on `seller_code`).
- **Repro:** `POST /api/configuration/sub-merchants` twice with `sellerCode=E2ESM002` → both `201`.
- **Question:** Seller codes are normally unique business identifiers — should the API enforce uniqueness (409 on duplicate)?
- **Note:** `sellerCode` is currently only displayed/carried through case payloads, never used as a lookup key, so duplicates don't break joins today.

### C-005 — Bulk ops silently skip unknown IDs while bulk-assign 404s
- **Location:** `POST /api/users/bulk-status`, `POST /api/merchants/bulk-priority`, `POST /api/merchants/bulk-terminate` → `200 {"updatedCount":0}` for unknown IDs; `POST /api/cases/bulk-assign` → `404 {"error":"One or more cases were not found."}` for unknown case ID.
- **Question:** Pick one contract — all bulk endpoints 404 on unknown IDs (strict), or all return counts (lenient). The count field makes lenient behavior observable, so consistency-only, not data loss.

---

## Verified OK (not bugs)

- **Auth:** 401 without/invalid token; wrong password rejected; deactivated user cannot log in; refresh rotation invalidates old token (replay → 401); logout revokes refresh session (residual 15-min access-token validity is standard); login rate limiter → 429 under brute force.
- **RBAC:** Agent 403 on user-admin routes; non-owner admin cannot mutate others' cases; agent operates only in authorized queues.
- **Case workflow:** take-ownership, advance-stage guards (sub-merchant required, rejections must be resolved), close successful/unsuccessful, comments CRUD + empty-comment validation, history events, field-review remarks-required validation.
- **Resubmission:** preview generates merchant message + URL; email-failure path invalidates token, restores case to working, records `resubmission_email_failed`; invalid public token → 404. (Preview minting the token is **by design** — manual-confirm requires the `tokenId` from preview.)
- **Merchants:** list, overview, form, history, limits/MDR all 200 for admin and agent; config PUT round-trips; terminate/permanent-delete guards (409 non-terminated, name confirmation) work.
- **Uploads:** missing file → 400; non-multipart → 400; wrong-queue upload → clear 400 business error.
- **Public onboarding form:** all 7 steps render; empty submit → 400 with field errors; invalid resubmit token → clean "Link not found".
- **Browser sweep:** login (valid/invalid), session persistence, logout + post-logout bounce, dashboard, all case list views, case detail (Resolution/Chatter/History tabs, comment post), merchants list + 4 detail tabs, user management, all 12 configuration pages — all render with real data, no error boundaries, no failed API calls (excluding B-006 SSE reconnect loop).
- **Repos:** `git status` clean in both clones — no tracked source modified.

## Environment-only observations (not product bugs)

- Dev-mode React hydration-mismatch warnings on every page (TanStack Start SSR dev artifact; production build not run per repo rules).
- Occasional blank-page/renderer crashes during sweep under sandbox memory pressure; not reproducible in isolation.
- Local migration-runner quirk (not the product) initially skipped digest-based statements; repaired locally, no product impact.

## Suggested action order

- **P0:** none — no data-loss or auth-bypass found.
- **P1:** B-001 (user creation atomicity), B-008 (reset token burn — same family), B-006 (SSE idle timeout), C-003 (test suite baseline).
- **P2:** B-010 (stage reorder 100% broken), B-007 (CSRF for JSON), B-009 (malformed UUID → 500, systemic), B-002 (409 on duplicate slug), B-012 (subMerchantKey validation), B-013 (agreement tokenId binding), C-001 (optional multipart fields).
- **P3:** B-004 (field-name validation), B-005 (public payload minimization), B-011 (ZodError → 400), C-002 (docs refresh).
- **Candidates:** C-004 (duplicate seller codes), C-005 (bulk contract consistency).
