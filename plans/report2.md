# Backend Review Report — onboarding-portal-assanpay-BE

Scope: code review plus exhaustive live testing of the Bun/Hono API on **PostgreSQL 19**, including a performance pass on a seeded dataset (50k merchants, 100k+ cases). Categories: bugs, security, performance, and API behaviour that surfaces as UI problems.

Test tooling lives in `qa/` (see `qa/README.md`). It is test-only and is not used by the app.

**Load, stress, spike, soak, write-path, SSE and login-storm results are in [`performance-report.md`](performance-report.md).** Headline: about 60 requests/s sustainable for a realistic mix on a 4-core box shared with the DB and load generator, limited by Postgres CPU; the cases-list `count(*)` and search queries are the biggest costs; no load shedding under a 4-5× spike; a 25-minute soak showed no leak or drift.

## How this was tested

- **Database:** `postgres:19beta3` (`PostgreSQL 19beta3 (Debian 19~beta3-1.pgdg13+1)`), run in a container. All 86 Drizzle migrations apply cleanly on it. This is a beta build: the GA and RC image tags were rate-limited when pulled, so beta 3 was the newest available. No PG-19-specific errors appeared (the only DB errors were the expected 22001 / 22003 / 22P02 / 22021 classes listed below). The shared test DB and any `.env` were never touched.
- **External services** were faked locally, so real Drive and Resend behaviour (sharing, quotas, bounces, webhook signatures) is **not** verified: Resend through `RESEND_BASE_URL` (captures invite/reset links), Google Drive/OAuth through an in-memory `fetch` preload.
- **Automated checks:** about 1,300 assertions in 14 suites, plus a scripted walk of the whole pipeline. Suites are listed in `qa/README.md`.
- **Coverage:**
  - Every one of the ~120 routes was called with no token, a bogus token, an agent, an admin and a Super Admin (656 checks), plus a bad UUID and garbage JSON where applicable.
  - Feature scenarios: public form, configuration, queues, cases, merchants, users and auth, notifications and SSE, concurrency, and Drive failure.
  - The full flow Documents Review → Sub-Merchant Form → Agreement → MID Creation → Testing → Live → WordPress was walked with every gate exercised (missing prerequisites, wrong owner, wrong stage, already closed).
- **Not covered:** the multipart "manual send" endpoints were exercised on their negative paths only (bad token, missing file, wrong owner), because the positive path needs a preview token issued in a matching state. Resend webhook signature verification was not exercised (no signing secret). Real Drive quota and permission behaviour is untested.
- `bun run typecheck` passes.
- The repo has no automated tests, and the deploy workflow does not run any.

## Summary

| Severity   | Count |
| ---------- | ----- |
| High       | 4     |
| Medium     | 11    |
| Low / Info | 16    |

## High

### H1. Usernames with uppercase letters can never log in

- **Where:** `src/modules/auth/auth.schemas.ts:51` and `:84` (usernames trimmed, not lower-cased); `:75` (login lower-cases the identifier); `src/modules/auth/auth.service.ts:206` (exact-match lookup).
- **Reproduced (API and UI):** an admin created a user with username `UiCreated` in the Create User dialog and the user set a password from the invite link. Logging in with `UiCreated` (or `uicreated`) failed. Only the email worked.
- Uniqueness is also case-sensitive: `S2ROOT` was accepted next to `s2root`.
- **Fix:** store usernames lower-cased (or compare `lower(username)`), add a unique index on `lower(username)`, and normalise in `registerSuperAdminSchema` and `createUserSchema`. Migrate existing rows.

### H2. `PATCH /api/cases/:id/status` with `closed` bypasses every closing rule

- **Where:** `src/modules/cases/case-stage.service.ts:39` (`updateCaseStatus`) and `src/modules/cases/cases.routes.ts:253`. It only checks ownership and a status-transition table, and never runs the validations that `advanceStage` enforces.
- **Reproduced on all five queues tried** (Agreement, MID, Testing, Live, WordPress): `advance-stage` correctly returned 400 (missing final agreement, missing credentials email, and so on), but `PATCH /status {"status":"closed"}` returned **200 and closed the case as `successful`** with no field reviews, no sub-merchant, no documents and no email sent. On a Documents Review case it also queued a follow-up close job that then sat `blocked`, which keeps `/health/db` at `degraded` (see L13).
- **Impact:** a case owner can mark any case successful without doing the work, and the downstream flow (next-queue case creation, merchant status) is driven by unvalidated data. The FE contains an unused wrapper for this endpoint, so today only direct API callers can trigger it.
- **Fix:** remove `closed` from the status API's allowed targets, or route it through `advanceStage` / `closeUnsuccessful`.

### H3. Super Admin can deactivate their own account through `PATCH /api/users/:id`

- **Where:** `src/modules/users/users.service.ts:552` (`updateUser` has no self or last-super-admin guard). `DELETE` and `bulk-status` check for self.
- **Reproduced:** the only Super Admin sent `PATCH {status:"inactive"}` on their own id and got 200, and all sessions were revoked. Recovery needed direct DB access.
- **Fix:** apply the self guard in `updateUser`, and refuse to deactivate the last active `super_admin` in `updateUser`, `bulkUpdateUserStatus` and `deactivateUser`.

### H4. Post-commit failure in public resubmission deletes files the DB now references

- **Where:** `src/modules/merchants/public-resubmission.routes.ts:670-705`. The `catch` at `:704` runs `cleanupFailedAttemptObjects` for any error after the transaction has committed. `src/lib/storage/ownership.ts` (`cleanupFailedAttemptObjects`) deletes every attempt object that is not `superseded`, including `current`.
- **Failure scenario:** the transaction commits, so `merchant_documents` points at the new Drive files. If `listAttemptStorageObjects`, `markStorageObjectsLifecycle` or `supersedeStorageObjects` then throws, the `catch` deletes the freshly uploaded KYC files. The merchant sees a 500, the link is consumed, and the documents are gone.
- **Not reproduced** (needs fault injection); the control flow is unambiguous.
- **Fix:** set a `committed` flag after the transaction and skip cleanup once set, or move the post-commit steps out of the `try` and make them best-effort.

## Medium

### M1. Agents restricted to one queue can read every merchant's PII and KYC links

- **Where:** `src/modules/merchants/merchants.routes.ts:59` (`/:id/form`) and the sibling `/:id`, `/overview`, `/history`, `/limits-mdr` and list routes: `requireAuth` only.
- **Reproduced:** an agent scoped to one queue got 200 on `GET /api/merchants/:id/form` (bank account, IBAN, phone, Drive links), while the same agent got 403 on the case, its comments and its history.
- **Fix:** scope to merchants that have a case in a queue the agent can view, or restrict to admin roles.

### M2. Dashboard aggregates are not queue-scoped

- **Where:** `src/modules/dashboard/dashboard.routes.ts:33` calls `getDashboard(query)` with no actor. The same applies to `portal-mids/pending` and `agreements/awaiting-physical`.
- **Reproduced:** an agent with view access to one queue saw counts for all cases in all queues.

### M3. Notification SSE streams outlive session revocation

- **Where:** `src/modules/notifications/notifications.routes.ts:84`. `requireAuth` runs once at connect, and the stream's timeout is disabled.
- **Reproduced:** after deactivating a user, their normal requests returned 401 but the already-open stream stayed connected for the rest of the test. There is also no per-user connection cap.
- **Fix:** close a user's subscribers when their `sessionVersion` changes, and cap streams per user.

### M4. Public form accepts unbounded or out-of-range values, so bad input returns 500 after Drive uploads

- **Where:** `src/modules/merchants/merchants.schemas.ts:182` (`trimmedStringSchema` has no `.max()`); `estimatedMonthlyTransactions` and `estimatedMonthlyVolume` have no upper bound. The DB columns are limited (e.g. `business_name varchar(200)`, `integer`, `numeric(14,2)`).
- **Reproduced (all `500 Internal server error`, DB codes 22001 / 22003 / 22021):**
  - `businessName` 250 chars, `ownerFullName` 200, email 300, IBAN 100, branch 300, nature 300
  - `estimatedMonthlyTransactions=99999999999`
  - `estimatedMonthlyVolume=99999999999999999`
  - a null byte (`\u0000`) in any text field
- Drive folders and files had already been uploaded before the failure. The cleanup ledger then marked them `failed`, so nothing leaks, but each bad request costs Drive API calls.
- **Fix:** add `.max()` matching each column and a numeric range. Map `22001`, `22003` and `22021` to 400 in `src/middleware/error-handler.ts`. Validate before touching Drive.
- The same class of 500 exists elsewhere (see L4): `GET /api/configuration/case-flow/versions/99999999999`, `POST /api/dashboard/portal-mids/apply-limits` with a huge MID, and a 300-character sub-merchant name.

### M5. Permanent merchant delete removes Drive data inside the DB transaction, unbounded and non-atomic

- **Where:** `src/modules/merchants/merchants.service.ts:743-748`. An unbounded `Promise.all` of Drive deletes runs before the DB `delete`. A DB failure afterwards cannot restore Drive files, and a partial Drive failure aborts midway.
- **Fix:** delete DB rows first (or mark deleted), then delete Drive objects with bounded concurrency and retries.

### M6. Rate limiting is easy to bypass and easy to weaponise

- **X-Forwarded-For bypass:** `TRUST_PROXY_HEADERS` defaults to `true` (`src/config/env.ts:138`). 70 public requests with rotating `X-Forwarded-For` produced **0** 429s, versus 18 without the header. (The whole QA harness relies on this to avoid the public limiter.)
- **Account lockout DoS:** 10 bad passwords for `agent2` locked the real user out for 15 minutes (429 on the correct password). Anyone who knows a username can do this.
- **Process-local counters** reset on every deploy.
- **Fix:** default `TRUST_PROXY_HEADERS` to `false` (or require an allow-list), and key the lock on (account, IP) or add a delay/CAPTCHA.

### M7. URL fields are not restricted to http(s)

- **Where:** the merchant website (`merchants.schemas.ts:185`), the merchant portal `loginUrl` (`configuration.schemas.ts`), and `clonedWebsiteLink` (`cases.schemas.ts:316`) use `z.url()`.
- **Reproduced:** `javascript:alert(1)`, `data:text/html,…` and `ftp://…` were accepted as the merchant website through the public form. `javascript:alert(1)` was accepted as the portal `loginUrl`, which is placed in the credentials email sent to merchants. `clonedWebsiteLink=javascript:alert(1)` also passed URL validation (the request only failed later, on a missing screenshot).
- The FE is not exploitable today (React 19 blocks `javascript:` hrefs), but emails, exports and other consumers are exposed.
- **Fix:** allow `http:` and `https:` only.

### M8. `POST /api/dashboard/portal-mids/apply-limits` records limits for MIDs that don't exist

- **Reproduced:** `portalMids: [999999]` returned `{"applied":[999999],"alreadyApplied":[],"notFound":[]}` and persisted the application. A later real MID with that number would show as already applied and be skipped. `[99999999999999]` returns 500 (integer overflow). The array also has no maximum size.
- **Fix:** validate against existing MIDs (populate `notFound`), and bound the value and array length.

### M9. Cases can be created for terminated merchants, and duplicates are allowed

- **Reproduced:** `POST /api/cases` for a **terminated** merchant returned 201. A second open Documents Review case for the same merchant and queue also returned 201. A bogus `subMerchantId` was silently accepted.
- **Fix:** refuse terminated or deleted merchants, and enforce one open case per (merchant, queue) where the flow expects it.

### M10. (Performance) Case search defeats the trigram indexes

- **Where:** `src/modules/cases/case-query.service.ts:302-305`: `ilike(caseNumber) OR ilike(merchants.businessName)` across a join.
- **Measured (100k cases, PG 19):** the planner falls back to a parallel seq scan of both tables and a hash join with a join filter, even though both GIN trigram indexes exist. Searches take **250-525 ms p95** as a single request. With 20 concurrent searches the wall time was **1-5 s**.
- **Tested fix:** rewriting as a `UNION` of the two indexed lookups dropped the raw query from ~90-160 ms to **5-10 ms**. An `IN (subselect)` rewrite did not help.
- Sorting by merchant name has a similar cost (~200-260 ms p95) because it sorts after the join.

### M11. (Performance) Comments and history are unbounded

- **Where:** `GET /api/cases/:id/comments` and `/history` return every row.
- **Measured:** a case with 5,000 comments returned **1.66 MB** (p95 112 ms), and 5,000 history rows returned **1.1 MB**. The frontend must download and render all of it. Add cursor pagination.

## Low / Info

- **L1.** `GET /api/users/directory` and `GET /api/cases/owners` return all active users to any authenticated user (name, username). Probably needed for mentions and assignment.
- **L2.** Public responses echo internal Drive identifiers. `POST /api/public/merchant-form` returns `googleDriveFileId`, `googleDriveFolderId` and `googleDriveWebViewLink` for private KYC files to an anonymous caller, and `GET /api/public/resubmission/:token` returns `currentDocumentUrl`.
- **L3.** Resubmission links never expire, and `validateToken` still matches a legacy plaintext `token` column (`case-resubmission-tokens.service.ts:80`).
- **L4.** More 500s from missing range checks: `GET /api/configuration/case-flow/versions/99999999999`, sub-merchant name of 300 characters (`POST /api/configuration/sub-merchants`, varchar limit), and `estimatedMonthlyTransactions` overflow (see M4).
- **L5.** Blank-string acceptance:
  - `PATCH /api/queues/:id {name:"   "}` renamed a queue to whitespace.
  - `PATCH /api/cases/:id/close-unsuccessful {reason:"   "}` closed a case with a blank reason, stored as three spaces. The FE disables the button for whitespace, so this is API-only.
  - Limits fields accept `""`, which coerces to 0 (`{"collectionMin": ""}` saved 0).
- **L6.** Draft uploads (sub-merchant drafts, agreement drafts) have no content check (`validateDraftFile`, `configuration.service.ts:1171`). A file containing `MZ… this is not a pdf`, named `fake.pdf` and sent as `application/pdf`, was accepted (201). Such files are later emailed to merchants. (`evil.html` sent as `application/pdf` was correctly rejected.) Verify signatures as the public form does.
- **L7.** Search terms interpolate `%` and `_` into `ILIKE` patterns unescaped. `%` matches everything (not an injection).
- **L8.** Invalid filters are silently ignored: `GET /api/merchants?status=zzz` and `createdAtFrom=notadate` return **unfiltered** data with 200.
- **L9.** Public form data quality: IBAN, SWIFT and phone are only non-empty checks. **Duplicate submissions** from the same email are not detected (5 parallel identical submissions created 5 merchants).
- **L10.** Large public bodies are fully buffered (`publicMultipartMaxSize` is 225 MB, `index.ts:58`). A 230 MB body was rejected cleanly (4xx), but each accepted request holds whole files in memory.
- **L11.** Deactivating a user (`updateUser` / bulk) can leave open cases owned by an inactive user.
- **L12.** Ops and CI: no tests; the deploy workflow runs typecheck and migrations only, and a failed deploy restores code but not schema. `pm2 restart` resets the in-memory limiter. Password policy is length 8-128 only.
- **L13.** `/health/db` reports `degraded` permanently once any close job is `blocked` (see H2). Blocked jobs retry every ~6 h forever. Also, saving the case flow with no changes still publishes a new version.
- **L14.** Auth docs say curl-style requests are not blocked by CSRF; in practice `POST /api/auth/refresh` and `/logout` with **no `Content-Type` and no `Origin`** return `403 Forbidden`. Browsers and the FE (JSON) are fine.
- **L15.** A failed email send returns HTTP **200** with `{"status":"failed"}` (e.g. `send-for-resubmission`), so the caller must inspect the body. Comments are also accepted on closed cases.
- **L16.** Password reset and invite emails use an idempotency key that includes the expiry timestamp, so identical resends are not deduplicated by Resend.

## Performance results (PostgreSQL 19beta3, 50,000 merchants, 100,484 cases, 500k history rows, 300k documents, 100k notifications, 50k comments, 50k email logs; DB 498 MB)

Single-request latency (p50 / p95, warm) and 20 concurrent identical requests (wall time for all 20). The machine also ran browser tests, so absolute numbers are pessimistic.

| Endpoint                                                                       | p50                                  | p95                | 20 concurrent (wall)         |
| ------------------------------------------------------------------------------ | ------------------------------------ | ------------------ | ---------------------------- |
| `GET /api/cases` (30 rows, with total)                                         | 41 ms                                | 51 ms              | 613 ms                       |
| `GET /api/cases?limit=100`                                                     | 69 ms                                | 102 ms             | 820 ms                       |
| cases, any sort except merchantName                                            | 37-49 ms                             | 41-60 ms           | 515-618 ms                   |
| cases, sort merchantName                                                       | 195-212 ms                           | 232-258 ms         | 1.8 s                        |
| cases, deep page (300 pages in)                                                | 27 ms                                | 28 ms              | 191 ms                       |
| cases, filters (status, priority, queue, owner, merchant)                      | 10-37 ms                             | 27-53 ms           | 61-307 ms                    |
| cases, search (number / merchant / miss)                                       | 129-345 ms                           | 247-525 ms         | 1.1-4.9 s                    |
| case detail (normal / 5k-comment case)                                         | 19 / 20 ms                           | 27 / 49 ms         | 180-201 ms                   |
| case comments / history on the 5k case                                         | 66 / 49 ms                           | 112 / 58 ms        | 1.1 s / 0.7 s (1.7 / 1.1 MB) |
| `GET /api/merchants` (default / limit 100)                                     | 15 / 15 ms                           | 37 / 20 ms         | 73 / 88 ms                   |
| merchants, sorts and filters (ownerFullName / updatedAt sorts are the slowest) | 7-14 ms (70-75 ms)                   | 9-18 ms (78-93 ms) | 35-118 ms (331-493 ms)       |
| merchants, search (name / email / phone / miss)                                | 156-190 ms (57 ms for a 2-char term) | 162-200 ms         | 1.0-1.1 s                    |
| merchant detail / overview / form / history / limits                           | 3-8 ms                               | 7-15 ms            | 26-91 ms                     |
| users list, directory, queues                                                  | 2-21 ms                              | 6-25 ms            | 17-101 ms                    |
| dashboard (7d / 30d / 90d)                                                     | 74-102 ms                            | 79-120 ms          | 0.8-1.0 s                    |
| notifications (list / unread / count, 100k rows)                               | 6-9 ms                               | 10-44 ms           | 47-65 ms                     |
| config endpoints, `/health/db`                                                 | 2-9 ms                               | 4-15 ms            | 13-71 ms                     |

Sustained load (50 concurrent clients, 400 requests, no errors on any endpoint):

| Endpoint           | Throughput  | p50    | p95    |
| ------------------ | ----------- | ------ | ------ |
| queues (100 conc.) | 1,106 req/s | 89 ms  | 110 ms |
| merchants list     | 338 req/s   | 128 ms | 345 ms |
| dashboard          | 19 req/s    | 2.6 s  | 3.0 s  |
| cases list         | 36 req/s    | 858 ms | 6.3 s  |
| merchants search   | 15 req/s    | 3.0 s  | 4.0 s  |
| cases search       | 8 req/s     | 5.9 s  | 7.2 s  |

- **Errors:** none in any run, and the API stayed healthy afterwards.
- **What limits throughput:** cases list, dashboard and searches. They are 10-40× more expensive per request than merchants list. The cases list computes a total on every first page.
- **Indexing:** the schema is well indexed (keyset pagination and trigram indexes are used everywhere except the search path in M10).
- **Caveat:** the load run shared CPU with three Chromium crawlers, so req/s figures are conservative.

## What held up well

- **Access control matrix:** across ~120 routes × 5 identities (656 checks) there were no unauthenticated 2xx responses, no role-gate leaks (admin-only and super-admin-only routes returned 403 for lower roles), and **zero 5xx** on empty bodies, bad UUIDs or garbage JSON.
- **Case access control** is consistent: an agent scoped to one queue got 403 on case detail, comments and history, and an empty list.
- **Ownership races:** 6 parallel advances → one success and one follow-up case; 5 parallel takes → one 200; parallel creates of the same follow-up case → at most one 201.
- **Single-use public tokens are atomic:** two concurrent resubmissions of the same link produced one success and one 410; two concurrent `set-password` calls produced one 200 and one 410.
- **Session security:** argon2 with a dummy hash (login timing for unknown vs known accounts within tolerance), refresh-token rotation with reuse detection (a rotated token replayed after the 30 s grace window revoked the whole chain and the access token), hashed single-use invite/reset tokens, CSRF layers on cookie routes (evil-origin form posts rejected), correct CORS, security headers present, alg-none and tampered JWTs rejected.
- **Uploads:** magic-byte checks (an EXE or HTML file renamed to `.pdf`/`.png` is rejected), 10 MB per-file cap (exactly at the limit accepted, over rejected), path-traversal and unicode filenames handled.
- **Pipeline gates:** each stage refuses to advance until its prerequisites exist (final form, final agreement, physical agreement, MID save, limits applied, credentials sent, WordPress link), and closed cases reject assign / take / advance / status changes.
- **Failure handling:** a simulated Drive outage during a multi-file submission returned a clean 502, persisted no merchant row, and left no `current` storage objects; a retry after recovery succeeded. A failing email provider is recorded and surfaced without corrupting case state.
- **Pagination:** cursors are validated (garbage and forged cursors → 400), `limit` is capped, and walking every page across all sort columns and directions visited each row exactly once.
- **SQL:** no injection paths found; only two `sql.raw` uses, both fed by internal constants.
