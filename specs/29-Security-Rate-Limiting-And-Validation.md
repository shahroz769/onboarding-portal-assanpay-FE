# 29 — Security, Rate Limiting And Validation

## At a glance

| | |
|---|---|
| **What it is** | How the portal protects itself and its users: who can log in and how, what stops someone guessing passwords or flooding the public form, how the portal decides what each staff member is allowed to do, how incoming data is checked before it is trusted, and what happens when something is wrong. |
| **Who can use it** | Staff log in with an email or username plus a password. Their accounts are created by an admin or Super Admin; there is no public sign-up. Merchants (public, no login) can only use the public onboarding form and the resubmission link they were emailed. |
| **Roles** | `super_admin`, `admin`, `agent` (`role_type` enum). Only one Super Admin can exist at a time (unique index `users_single_super_admin` on `role_type` where it equals `super_admin`). |
| **Tokens** | Access token: 15 minutes, in memory only. Refresh token: 7 days, in an HttpOnly cookie, rotates on every refresh. |
| **Main code** | Backend: `src/index.ts`, `src/config/env.ts`, `src/lib/auth.ts`, `src/lib/security.ts`, `src/lib/secret-box.ts`, `src/lib/client-ip.ts`, `src/lib/validators.ts`, `src/lib/errors.ts`, `src/middleware/auth.ts`, `src/middleware/rbac.ts`, `src/middleware/error-handler.ts`, `src/modules/auth/*`, `src/modules/merchants/submission-attempts.service.ts` · Frontend: `src/lib/api-client.ts`, `src/features/auth/*`, `src/config/client-env.ts` |
| **Success looks like** | A staff member logs in, stays logged in for their session, can only do what their role and queue access allow, and bad input or abuse is rejected early with a clear error. |

## How it works — the journey

```
Staff enters email/username + password at /login
        ↓
POST /api/auth/login → password checked (Argon2) → access token (15 min) + refresh cookie (7 days)
        ↓
Every protected request: requireAuth (valid token, user active, sessionVersion matches)
        ↓
Then requireRoles(...) and queue view/work checks where the route needs them
        ↓
Input validated with a Zod schema before any work is done
        ↓
Bad input → 400 with the first error message · database errors never exposed raw
```

## Who can use it

| Who | Rule |
|---|---|
| **Staff users** | Log in with an email or username plus a password. Their accounts are created by an admin or Super Admin; there is no public sign-up. Staff email addresses must end in `@assanpay.com` (`assanPayEmail` in `auth.schemas.ts`). |
| **Merchants (public, no login)** | Can only use the public onboarding form and the resubmission link they were emailed. They have no account and no password in this portal. |
| **Agents** | Can additionally be restricted to selected queues: `queue_view_scope` is `all` or `selected`, with per-queue `view` / `work` access in `user_queue_access` (`user_queue_access_type` enum: `view`, `work`). Working access must be within view access. |

## Login, sessions and passwords — step by step

1. **Login.** A staff member enters an identifier (email or username) and password at `/login`. The frontend calls `POST /api/auth/login`. The backend finds the user, checks the password, and returns a short-lived access token plus the user object. It also sets a `refresh_token` cookie.
2. **Staying logged in.** The access token lives only in the frontend's memory (never in `localStorage`), is sent as `Authorization: Bearer <token>` on every protected request, and expires after 15 minutes (`ACCESS_TOKEN_TTL_MINUTES`, default 15). When a request returns 401, the frontend calls `POST /api/auth/refresh` once with the cookie, gets a new access token, and retries the request. Refresh tokens rotate on every refresh and last 7 days (`REFRESH_TOKEN_TTL_DAYS`, default 7).
3. **Logging out.** `POST /api/auth/logout` revokes the refresh token and clears the cookie; the frontend clears the in-memory token and goes to `/login`.
4. **Setting a password.** New users and password resets get an emailed link to `/set-password/:token`. `GET /api/auth/password-token/:token` checks the link first; `POST /api/auth/set-password` sets the password, consumes that link and any other open links for the user, and revokes all of the user's sessions (their `session_version` is bumped, so old access tokens stop working).
5. **Doing work.** Every protected route first runs `requireAuth` (valid token, user still `active`, token's `sessionVersion` still matches the database). Then, where the route needs it, `requireRoles(...)` checks the role, and case/queue helpers check queue view/work access and case ownership.
6. **Public submissions.** Anyone can submit the onboarding form, but each IP address may only create 3 successful submissions in a rolling 24 hours (`PUBLIC_SUBMISSION_LIMIT_PER_IP`, default 3). Every attempt — accepted or not — is recorded in `public_submission_attempts`.
7. **Bad input is rejected early.** Every route validates its JSON, query string, path parameters or multipart form with a Zod schema before doing any work. The first validation problem is returned as a 400 with that message. Database errors are never exposed raw: known unique-constraint conflicts become 409 with a friendly message, and anything else becomes a generic 500 (`Internal server error.`).

## Authentication and sessions — how it is implemented

### Tokens

| Item | Detail |
|---|---|
| Library / file | `src/lib/auth.ts` (library `jose`). |
| Access tokens | HS256 JWTs signed with `JWT_ACCESS_SECRET`. A JWT is a signed token that carries a small payload; HS256 is the signing algorithm. |
| Refresh tokens | HS256 JWTs signed with a different secret, `JWT_REFRESH_SECRET`, carrying only `sessionId`. |
| Secrets | Both secrets must be at least 32 characters (`env.ts`). |
| Access-token payload | Carries `roleType`, `email` and `sessionVersion`; `verifyAccessToken` rejects a token whose `sessionVersion` is not a non-negative integer. |

### Passwords

| Item | Detail |
|---|---|
| Hashing | `src/modules/auth/auth.service.ts`: passwords are hashed with `Bun.password.hash` (Argon2) and checked with `Bun.password.verify`. Argon2 is a password-hashing algorithm; a hash is a one-way fingerprint that cannot be turned back into the password. |
| Length | Passwords must be 8–128 characters (`setPasswordSchema`). The set-password request also needs `confirmPassword` to equal `password` (a refine check in `auth.schemas.ts`, on the `confirmPassword` field). There is no complexity rule in the code reviewed (no required digits, capitals or symbols). |
| Unknown accounts | A dummy hash is computed for unknown accounts and accounts with no password, so a failed login costs the same Argon2 work either way and does not leak whether the account exists; the error is always the same 401 `Invalid email or password.` |

### Refresh-token rotation and reuse detection

| Item | Detail |
|---|---|
| Table | `refresh_tokens` (`refresh_token_status`: `active`, `revoked`, `rotated`). |
| Rotation | Refreshing stores the new token's SHA-256 hash and marks the old one `rotated`, linked by `replaced_by_token_id`. SHA-256 is a one-way hash; only the hash is stored, never the token itself. |
| Reuse | Presenting an already-rotated token after the grace period below revokes **all** of that user's sessions (`revokeAllUserSessions` in `auth.service.ts`), not only the one presented. The backend logs "Refresh token reuse detected; revoked all sessions." |
| Grace period | A 30-second reuse grace period (`REFRESH_TOKEN_REUSE_GRACE_MS = 30_000`) tolerates a retry arriving just after rotation. |
| Retention | Rotated tokens are kept until they expire. Expired refresh tokens, and tokens revoked more than 24 hours ago, are purged on startup and every 6 hours (`purgeExpiredRecords` in `src/index.ts`). |

### Session revocation

| Item | Detail |
|---|---|
| `users.session_version` | Default 0, never negative. It is bumped when: a password is set through a link (`setPasswordWithToken`); a user update sends `status: inactive`, a role, or a queue-access field (`updateUser` in `users.service.ts`; other edits do not bump it); a bulk status change runs (`bulkUpdateUserStatus`); a user is deactivated (`deactivateUser`, which calls `revokeAllUserSessions`); or refresh-token reuse is detected after the grace period. A "sign out everywhere" action was **not found** in the code reviewed: only deactivation and reuse detection call `revokeAllUserSessions`. |
| `requireAuth` | `src/middleware/auth.ts`: rejects any access token whose `sessionVersion` no longer matches the database, or whose user is not `active`. `resolveCurrentSession` applies the same checks for the notification stream. Errors: `401` "Missing bearer token.", `401` "Invalid access token.", `401` "Access token is expired or revoked.". |

### Password links

| Item | Detail |
|---|---|
| Table | `user_password_tokens` (`password_token_purpose`: `invite`, `reset`; token stored only as `tokenHash`, SHA-256). |
| Lifetimes | In `LINK_DEADLINE_HOURS` (`configuration.service.ts`): reset links 24 hours, new-password (invite) links 72 hours. |
| One use only | A link can be consumed only once, for a recorded reason (`password_token_consumed_reason`: `used`, `superseded`, `invalidated`); a dead link returns 410 with a reason the set-password page turns into its message. |
| Resubmission links | Separate (`case_resubmission_tokens`, reasons `used`, `superseded`, `invalidated`) and, in the code reviewed, have no expiry column — see file 32. |

### Trusted-device sign-in

`src/modules/auth/login-guard.ts`: ticking "Trust this device" issues a `login_device` cookie, `v1.<userId>.<deviceId>.<expiresAt>.<signature>`, HMAC-signed with a key derived from `JWT_REFRESH_SECRET` (HKDF, info string `login-device-cookie-v1`), covering the user's `sessionVersion`, so a password set through a link, a deactivation, or a role or queue-access change untrusts all devices at once. The cookie is only ever sent back to `/api/auth/login`, lives as long as the refresh token, and is kept on sign-out because it marks the browser as trusted, not as a session. A sign-in from a trusted device is checked only against its own device budget (5 failures, `device:<userId>:<deviceId>`); the account-wide limits do not apply to it. The "Trust this device" checkbox state is also kept in `localStorage` (`TRUST_DEVICE_STORAGE_KEY` in `src/components/login-form.tsx`) as a UI preference, not as a credential.

When the account-wide limit (15 failed attempts per hour) is hit, the login response says: "Too many failed sign-in attempts on this account. Sign-in from new devices is paused; a device you chose to trust can still sign in." A trusted device is therefore the only way in during that hour. The `login_device` cookie name and HKDF info string `login-device-cookie-v1` are in `login-guard.ts`.

## Roles and queue access

### Middleware

`src/middleware/rbac.ts`: `requireRoles(...roles)` returns 403 `Insufficient permissions.` when the logged-in user's role is not listed.

| Need | Who |
|---|---|
| Creating users, cases and configuration changes | `super_admin` or `admin` |
| Queue detail and queue edits, permanent merchant delete and Drive-file delete | `super_admin` alone |
| Terminating a merchant (or bulk terminate) with `deleteDriveFiles: true` | `super_admin` only; an admin gets `403` "Only a Super Admin can delete Google Drive files." (`merchants.routes.ts`). Admins can still terminate without Drive deletion. |
| Updating users (single or bulk status change) | An admin may only change agents: `403` "Admins can only update agents." (`users.service.ts`, `updateUser` and the bulk status change). |
| Most reads | Only `requireAuth` |

### Queue scoping for agents

`src/modules/cases/case-access.service.ts`:

| Helper | Rule |
|---|---|
| `getAgentQueueAccess` | Returns `null` for non-agents (no restriction). |
| `assertCanViewCase` | 403 `You do not have access to this queue.` |
| `assertCanWorkCase` / `assertCanWorkQueue` | 403 `You do not have working access to this queue.` |
| Scope `all` | Agents with scope `all` are unrestricted. |
| Scope `selected` | The agent's `selected` scope is enforced. |
| Case reads | Require view access. Case mutations require work access plus, in most services, ownership by the current case owner. |
| Creating a user | With `queueViewScope: selected` and role `agent`, requires at least one view queue ("Select at least one queue for view access.") and every work queue must also be a view queue ("Working access must be within view access.") (`validateQueueAccess` in `auth.schemas.ts`). |

> ⚠️ **Known scope gap (reported, not re-tested here):** the backend review report (`frontend/plans/be-report.md`, M1) found that merchant routes (`GET /api/merchants/:id/form` and the sibling merchant reads) check only `requireAuth`, so an agent restricted to one queue could read any merchant's personal and bank details and Drive links, and that dashboard aggregates are not queue-scoped (M2). That matches the route code read for this spec — merchant routes use `requireAuth` only — so treat it as an open decision, not as settled.

## Rate limiting

There are three separate layers, and they do not share state:

| Layer | Where | Limit | Window | Key | On limit |
|---|---|---|---|---|---|
| Public requests | `src/index.ts`, `publicRateLimiter` on `/api/public/*` | 60 requests | 15 minutes | Client IP (`getClientIp`) | 429 `Too many public requests. Please try again later.` |
| Auth (login, password-token, set-password) | `src/modules/auth/auth.routes.ts`, `authRateLimiter` | 15 requests | 15 minutes | Client IP | 429 `Too many attempts. Please try again later.` — only failed attempts count (`skipSuccessfulRequests: true`) |
| Login attempts (database) | `src/modules/auth/login-guard.ts`, `login_attempt_counters` | Trusted device: 5; untrusted: 5 per account+IP and 15 per account | Fixed 1 hour | SHA-256 hash of `device:<userId>:<deviceId>`, `account_ip:<account>:<ip>` or `account:<account>` | 429 `Too many failed sign-in attempts. Please try again in <n> minute(s).` — counted before the password is checked; a successful sign-in clears the counters it used |
| Public submissions | `src/modules/merchants/submission-attempts.service.ts` | 3 successful submissions (`PUBLIC_SUBMISSION_LIMIT_PER_IP`, default 3) | Rolling 24 hours | Client IP, counted in `public_submission_attempts` where `outcome = 'created'` | 429 `Too many applications have been submitted from this network today. Please try again tomorrow.` |
| Notification streams | `src/modules/notifications/notifications.routes.ts` | 10 open streams per user (`NOTIFICATION_STREAM_MAX_PER_USER = 10`), heartbeat every 25 seconds | Per connection | User ID | 429 `Too many open notification streams. Close some tabs.` |

### In-memory counters

The public and auth limiters use `hono-rate-limiter` with its default in-memory store, and the backend `.env.example` warns: "Rate-limit counters live in process memory: fine for one instance, but multiple instances each get their own limits (use a shared store first)." A restart or a second server instance resets or splits the budget. The login-attempt counters and the submission counters live in the database, so they survive restarts and are shared.

### Client IP

`src/lib/client-ip.ts`: when `TRUST_PROXY_HEADERS` is `true` (the default), the IP is taken from `cf-connecting-ip` first, then the first entry of `x-forwarded-for`; otherwise the socket (TCP peer) address is used, falling back to `unknown`. The `.env.example` and `env.ts` comments say to enable it only behind a proxy that overwrites forwarding headers, and that production runs behind Cloudflare, which sets `CF-Connecting-IP`. Because the header is client-controlled unless a trusted proxy overwrites it, a caller that can set `X-Forwarded-For` can rotate its apparent IP and bypass the IP-keyed limits — this is the review report's M6 finding, and it matches the code read here.

### Submission quota race safety

`claimSubmissionQuota` takes a per-IP advisory lock (`pg_advisory_xact_lock(hashtext('merchant-submission-ip:<ip>'))`) inside the merchant-creation transaction, so parallel requests from one IP cannot all pass the check. `assertSubmissionQuota` is a cheaper pre-check before the upload is read. Attempts older than 60 days are purged (`ATTEMPT_RETENTION_MS`).

> ⚠️ **No rate limit was found in the code reviewed** on the authenticated API (cases, merchants, users, configuration, dashboard) other than the notification-stream cap above. There is also no global request-rate limit and no CAPTCHA anywhere in the code reviewed.

## Cookies, CORS and headers

| Topic | Detail |
|---|---|
| **CORS** | `src/index.ts`: origins come from `CORS_ORIGIN` (comma-separated, each validated as a URL, default `http://localhost:5173`); `credentials: true`; allowed methods `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`; allowed headers `Content-Type, Authorization, Idempotency-Key`; exposed headers `Content-Length, X-Request-Id`; preflight cache `maxAge: 86400` (24 hours). CORS (Cross-Origin Resource Sharing) controls which websites may call the API from a browser. |
| **Cookies** | Refresh cookie `refresh_token`: `HttpOnly: true`, `path: /`, `maxAge` = refresh-token lifetime in seconds, `SameSite` from `COOKIE_SAME_SITE` (`lax` default; `strict` or `none`), `Secure` from `COOKIE_SECURE` (default `true` in production, `false` otherwise). `env.ts` refuses `COOKIE_SAME_SITE=none` without `COOKIE_SECURE=true`. Optional `COOKIE_DOMAIN`. HttpOnly means JavaScript in the page cannot read the cookie. |
| **CSRF** | `auth.routes.ts`: Hono's `csrf()` middleware on `/login`, `/refresh` and `/logout`, with origin `CORS_ORIGIN`. It rejects form-style cross-site requests (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) with 403 unless the Origin is allowed or `Sec-Fetch-Site` is `same-origin`. JSON requests rely on CORS preflight instead. The `apis/auth.md` doc says non-browser clients are not blocked by an Origin mismatch on JSON requests — that matches the code. CSRF (cross-site request forgery) is a trick where another website makes the browser send a request as the logged-in user. |
| **Security headers** | `app.use('*', secureHeaders())` in `src/index.ts` (Hono's default secure headers). Every response also carries a request ID (`requestId()` middleware, exposed as `X-Request-Id`). |
| **Body-size limits** | Auth routes: 16 KB (`bodyLimit`, 413 `Request body is too large.`); public multipart: 225 MB whole-request cap (see file 28); Bun's global `maxRequestBodySize` is also set to the 225 MB value. No per-route body limit was found on the other authenticated JSON routes in the code reviewed. |

## Stored secrets

| Kind | Detail |
|---|---|
| **Hashing (one-way)** | Bearer tokens and password/reset links are stored only as SHA-256 hex digests (`hashToken` in `src/lib/security.ts`, `crypto.subtle.digest`). Plaintext resubmission tokens were removed in migration 0116 (`drop_resubmission_plaintext_token`); password-token plaintext is never stored. |
| **Encryption (reversible, must be read back)** | `src/lib/secret-box.ts` — AES-256-GCM, format `v1.<iv>.<ciphertext>` in base64url, with associated data binding the ciphertext to its database row so it cannot be copied onto another record and decrypted there. Two separate 32-byte base64 keys, each from its own environment variable: `PORTAL_PASSWORD_ENCRYPTION_KEY` (merchant portal password codes, held until the credentials email is sent) and `PORTAL_API_CREDENTIALS_ENCRYPTION_KEY` (portal API key and secret, held from MID Creation until the WordPress Website case closes). The keys are optional in the schema, but generating or reading a code without the key fails with 500. Rotating a key makes the codes stored under it unreadable — the code comments say so explicitly. AES-256-GCM is an encryption method; unlike a hash, encrypted data can be decrypted with the key. |
| **Webhook signing** | Resend webhook events are verified with `RESEND_WEBHOOK_SECRET` (Svix signature over the raw body); without the secret the endpoint returns 503 `Resend webhooks are not configured.`, and a bad signature returns 400 `Invalid webhook signature.` (`resend-webhook.routes.ts`). See file 31. |

## How it is implemented — Frontend

| Piece | File / detail |
|---|---|
| API base URL | `src/config/client-env.ts`: `VITE_API_URL`, falling back to `http://localhost:3000` in development and `https://onboard.assanpay.net` in production (the deployed `wrangler.jsonc` also sets `VITE_API_URL` to `https://onboard.assanpay.net`). The URL is validated as a URL and trailing slashes are stripped. |
| API client | `src/lib/api-client.ts` (axios, `withCredentials: true`, default `Content-Type: application/json`). A request interceptor adds the in-memory access token as a Bearer header. A response interceptor retries a 401 once via `POST /api/auth/refresh` (except for login/refresh themselves), then redirects to `/login` with a sanitised `redirect` parameter if the refresh fails. Concurrent refreshes are deduplicated and multi-tab refresh is serialised (see the frontend review report in `frontend/plans/fe-report.md`). |
| Auth state | `src/features/auth/auth-client.ts`: the access token and user live in a small in-memory store (`createAuthClient`); there is no token in `localStorage`. `session-refresh.ts` handles the refresh call. |
| Route guards | `src/features/auth/route-guards.ts` (`requireAllowedRoles`) and the `_app` routes: `_app.user-management.tsx` and `_app.configuration.tsx` call `requireAllowedRoles(context.auth, ['super_admin', 'admin'])`, so agents are redirected away from User Management and Configuration pages, and a view-only agent (no work queues) is redirected from Work Queue Cases to All Cases. |
| Form validation | Zod schemas in `src/schemas/` (for example `merchant-onboarding.schema.ts`, `users.schema.ts`, `auth.schema.ts`) check input in the browser first, so the user gets immediate feedback. The frontend schemas are deliberately close to the backend ones but are not shared code — see below for where they drift. Zod is a validation library. |
| Draft storage | The public onboarding form autosaves text fields (not files) to `localStorage` under keys such as `assanpay:merchant-onboarding-draft`, and keeps an idempotency key in `localStorage` so a retried submission returns the same merchant. See file 32 for the reported issue that a successful submission's data can remain in `localStorage`. |

## Data, validation and edge cases

### Validation library

Zod, through `zodValidator` in `src/lib/validators.ts` — a failed parse throws `AppError` 400 with the first issue's message. `webUrlSchema` in the same file restricts URLs to `http:`/`https:` (`z.url({ protocol: /^https?$/ })`). It is used for the portal `loginUrl` (`configuration.schemas.ts`) and the case `clonedWebsiteLink` (`cases.schemas.ts`), so `javascript:` and `data:` values are rejected there. The public business website is different: its base schema is plain `z.url()`, but the public-form schema adds the `isPublicWebsiteUrl` check (see the table below), so those schemes are also rejected on submission. The gap is narrower: the stored-value schema used on resubmission for a website that was not changed (`storedBusinessWebsiteSchema`) is plain `z.url()`, so an old stored unsafe value passes if nobody changes it. The frontend onboarding schema checks `http:`/`https:` (`isHttpUrl`).

### Public form field rules (backend, `merchants.schemas.ts`)

| Field | Rule |
|---|---|
| Emails | Max 255 characters and must be real (reserved domains such as `example.com` / `test` / `invalid` / `localhost` are rejected). |
| Business name | Max 200. |
| Owner full name | Max 160. |
| Business phone | Digits only and max 32. |
| Owner/submitter phones | Must match `03` followed by 9 digits. |
| Business website | Max 500. A bare domain (for example `example.com`) gets `https://` added. The result must be a URL that also passes `isPublicWebsiteUrl`: `http:` or `https:` only, no credentials, a dotted public hostname, no private IPv4 address, no reserved domain, and no `.local` / `.internal` host (`merchants.schemas.ts`). The public form uses this check, and resubmission uses it for a website that was changed. |
| `estimatedMonthlyTransactions` | Max 2,147,483,647. |
| `estimatedMonthlyVolume` | Max 999,999,999,999.99. |
| `bankName` | Must be one of the 27 listed banks. |
| `swiftCode` | Max 64. |
| Frontend mirrors | The frontend schema mirrors most of these (business address max 1000, business description max 5000) — but the frontend review report (F4) notes the frontend schemas drift from the backend and that required text fields there use `.min(1)` without `.trim()`, so whitespace-only text passes the browser and is rejected by the server. |

### User rules (backend, `auth.schemas.ts`)

| Field | Rule |
|---|---|
| Name | 2–120 characters. |
| Email | Must be `@assanpay.com` and is lower-cased. |
| Username | 2–64 characters, lower-cased on create, only `a-z0-9._-` (`USERNAME_PATTERN`). |
| Role | Must be one of `super_admin` / `admin` / `agent`. |
| Gender | `male` / `female`. |
| Status | `active` / `inactive`. |
| Queue ID lists | Max 500 entries each. |
| Login | The identifier (email or username) is trimmed and 2–255 characters; the password is 1–128 characters. The 8-character minimum applies only when a password is set (`setPasswordSchema`), so an old short password can still log in. |

### Bulk endpoints, list queries and errors

| Topic | Detail |
|---|---|
| **Bulk endpoints** | Bulk ID arrays are capped — for example merchants bulk-terminate / bulk-priority / bulk-delete accept 1–100 IDs (`z.array(z.uuid()).min(1).max(100)`); terminate reason 1–1000 characters; priority note max 500; permanently deleting a merchant requires typing the exact business name as confirmation (max 160 characters). |
| **List-query validation** | List endpoints validate their query strings with Zod (for example `listCasesQuerySchema`, `listMerchantsQuerySchema`). The review report (L8) notes that an invalid filter value such as `status=zzz` or an unparseable date is silently ignored and returns unfiltered data with 200 — that behaviour is in the schema parsing, not an error, and was not re-tested for this spec. |
| **Error shape** | All errors are `{ "error": "<message>" }`, sometimes with extra `details`. |
| **Status codes used** | 400 validation (the first Zod message; a malformed id or enum value reaching a query, Postgres `22P02`, returns `Invalid identifier or value.`) · 401 missing/invalid/expired token · 403 insufficient permission or wrong owner/queue · 404 not found · 409 conflict (including unique-constraint messages such as `A queue with this name already exists.` and `There can be only one Super Admin.`, and the database state-guard codes mapped in `error-handler.ts`: `P7601` "This case change is not allowed in its current state.", `P7602` "This is not allowed for the merchant in its current state.", `P7603` "This change is not allowed in its current state.") · 410 dead password link · 413 body too large · 429 rate limited · 500 `Internal server error.` for anything not mapped (the SQL error is logged, never returned; `P7501` returns 409 "This queue or its stages are required by a published flow…"; any other unique violation returns 409 "This record conflicts with an existing one.") · 502 Drive/Resend unreachable · 503 webhook not configured or worker unhealthy. The database triggers in migrations 0101–0106 enforce case, merchant, queue, storage and resubmission-token state rules even if application code skips a check. |
| **What validation does not cover (in the code reviewed)** | No upper bound was found on comment/history length beyond the database column types; comments and history are returned unpaginated; the public form does not detect duplicate submissions from the same email (only the per-IP count and the optional `Idempotency-Key` replay); IBAN, SWIFT and phone numbers are only checked as non-empty / length / digits, not validated as real IBANs or numbers. These are the review report's M4, M11, L9 and L5 items; they were not re-tested live for this spec. |

## What happens next — business rules

- After a staff member logs in, they stay logged in while they keep using the portal: the access token refreshes silently (15-minute access token, 7-day refresh token). If they are deactivated, have a password set through a link, or have their role, status or queue access changed, their `session_version` is bumped and all their sessions stop working at once — including trusted devices, which are untrusted by the same bump. A "sign out everywhere" action was not found in the code reviewed.
- After a password is set through an emailed link, that link and any other open links for the user are consumed, and all of the user's sessions are revoked.
- After a merchant submits the public form, every attempt — accepted or not — is recorded in `public_submission_attempts` and kept for 60 days; only `created` outcomes count towards the 3-per-IP-per-24-hours limit.
- After a case is assigned or a comment mentions someone, the notification is created (file 24) — but a breach of SLA, on its own, triggers no notification, reassignment or priority change (see file 27).
- When a staff member's role or queue access changes, their `session_version` is bumped, so their old access token stops working and they must log in again to pick up the new permissions.

## What to check — is this what you intended?

- [ ] **IP trust:** the public rate limit (60 requests per 15 minutes per IP) and the login limits rely on the `X-Forwarded-For` / `CF-Connecting-IP` header. Are you happy that anyone who can set that header can get a fresh limit, or should the portal only trust the header from Cloudflare?
- [ ] **Login lockout:** should the login lockout stay as it is — 5 failed attempts per device, 5 per account+IP and 15 per account per hour — knowing that someone who knows a username can lock the real user out of new devices for an hour? Would you prefer a CAPTCHA or a delay instead of a lockout?
- [ ] **Authenticated API limit:** the authenticated API (cases, merchants, configuration) has no rate limit in the code reviewed. Is that intended, or should staff endpoints have one too?
- [ ] **Password rule:** is a password rule of "8–128 characters, nothing else" enough, or do you want complexity rules (digits, capitals, symbols) or a minimum higher than 8?
- [ ] **Resubmission links:** should resubmission links to merchants expire (password links expire after 24/72 hours, but resubmission links have no expiry in the code reviewed)?
- [ ] **Agent merchant access:** should agents restricted to one queue be blocked from reading any merchant's personal, bank and Drive details, as the review report suggests — or is it intended that all staff can see all merchants?
- [ ] **URL schemes:** the backend now rejects non-`http(s)` values for the public website, portal login URL and cloned-website link. Should the stored-value path on resubmission (an unchanged website saved before the rule) also be checked, so an old unsafe value cannot pass?

---
*Sources: `backend/src/index.ts`, `backend/src/config/env.ts`, `backend/src/lib/auth.ts`, `backend/src/lib/security.ts`, `backend/src/lib/secret-box.ts`, `backend/src/lib/client-ip.ts`, `backend/src/lib/validators.ts`, `backend/src/lib/errors.ts`, `backend/src/middleware/auth.ts`, `backend/src/middleware/rbac.ts`, `backend/src/middleware/error-handler.ts`, `backend/src/modules/auth/auth.routes.ts`, `backend/src/modules/auth/auth.schemas.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/login-guard.ts`, `backend/src/modules/auth/password-token-state.ts`, `backend/src/modules/users/users.service.ts`, `backend/src/modules/configuration/configuration.schemas.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/modules/email/resend-webhook.routes.ts`, `backend/src/modules/notifications/notifications.routes.ts`, `backend/src/modules/merchants/merchants.routes.ts`, `backend/src/modules/merchants/public-resubmission.routes.ts`, `backend/src/modules/merchants/submission-attempts.service.ts`, `backend/src/modules/merchants/merchants.schemas.ts`, `backend/src/modules/cases/case-access.service.ts`, `frontend/src/components/login-form.tsx`, `frontend/src/lib/api-client.ts`, `frontend/src/features/auth/auth-client.ts`, `frontend/src/features/auth/session-refresh.ts`, `frontend/src/features/auth/route-guards.ts`, `frontend/src/routes/_app.configuration.tsx`, `frontend/src/routes/_app.user-management.tsx`, `frontend/src/config/client-env.ts`. Related files: 02 (Authentication), 03 (User Management), 28 (Google Drive), 30 (database), 32 (known gaps).*
