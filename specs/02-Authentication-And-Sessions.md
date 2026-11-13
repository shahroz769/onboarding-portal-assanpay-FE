# 02 — Authentication and Sessions

## At a glance

| | |
|---|---|
| **What it is** | How AssanPay employees sign in to the portal, stay signed in, and sign out — and how the system stops other people getting in. |
| **Who can use it** | Any employee with an `active` user account. Merchants do not sign in at all (they use public links; see files 04 and 06). |
| **Where it lives** | Sign-in page `/login` · First/reset password page `/set-password/:token` |
| **Main API** | `POST /api/auth/login` · `POST /api/auth/refresh` · `POST /api/auth/logout` · `GET /api/auth/password-token/:token` · `POST /api/auth/set-password` |
| **Main code** | Frontend: `src/features/auth/auth-client.ts`, `src/apis/auth.ts` · Backend: `src/modules/auth/auth.routes.ts`, `src/lib/auth.ts`, `src/modules/auth/login-guard.ts` |
| **Success looks like** | Employee signs in, works all day without re-typing a password, and is signed out cleanly everywhere when their password is set, their role changes, or they are deactivated. |

## How it works — the journey

```
Employee opens /login, enters email/username + password (may tick "Trust this device")
        ↓
POST /api/auth/login → access token (15 min, kept in memory only)
                     + refresh token (7 days, secure HttpOnly cookie)
        ↓
Every request sends Bearer access token + refresh cookie
        ↓
Access token expires (401) → frontend silently POSTs /api/auth/refresh once
        → new access token + rotated refresh cookie → original request retried
        ↓
Sign out → POST /api/auth/logout → session revoked, cookie cleared
```

In short: an employee signs in with an email or username plus a password. The server gives the browser a short-lived access token (kept in the page's memory, not in storage) and a longer-lived refresh token (kept in a secure cookie the browser cannot read with JavaScript). When the access token expires, the browser silently uses the refresh cookie to get a new one. If the refresh token is stolen and reused, every session for that user is revoked.

## Who can use it

| Who | Rule |
|---|---|
| **Any employee with an `active` user account** | Can sign in. Inactive accounts are refused with the same message as a wrong password, so an outsider cannot tell whether the account exists. |
| **No account, no access** | There is no self-registration. Accounts are created by a super admin or admin, who emails the new employee an invitation link (see file 03). Until the employee sets a password through that link, the account has no password and cannot sign in. |
| **Everyone signs in the same way** | There is no separate admin login page and no social login. The only sign-in page is `/login`. |

## Signing in, staying signed in, signing out

| Step | What happens |
|---|---|
| 1. Sign in | Employee opens `/login` and enters an identifier (email or username) and a password, and can tick "Trust this device". |
| 2. Login call | Frontend calls `POST /api/auth/login`. On success it stores the access token in memory and the user details in auth state, then sends the employee to the page they were trying to reach (the `redirect` search parameter, cleaned by `sanitizeRedirect`). |
| 3. Already signed in | If the employee is already signed in and opens `/login`, they are sent straight to the app instead of seeing the form again. |
| 4. Last login | A successful sign-in updates the user's `lastLoginAt`. |
| 5. Every request | Every request to a protected endpoint sends `Authorization: Bearer <accessToken>` plus the refresh cookie (the frontend uses `withCredentials: true`). |
| 6. Refresh | Access token lasts 15 minutes by default (`ACCESS_TOKEN_TTL_MINUTES`, default 15). When a request comes back 401, the frontend calls `POST /api/auth/refresh` once, gets a new access token (and a new refresh cookie — the old refresh token is rotated), and retries the original request. |
| 7. Tabs | Refreshes are coordinated across browser tabs: `frontend/src/features/auth/session-refresh.ts` uses a Web Lock (`navigator.locks`, name `auth-refresh`) and a `BroadcastChannel` of the same name, so two tabs do not refresh at the same time and invalidate each other. A tab that waited for the lock reuses the session the other tab broadcast if it arrived after the tab asked; otherwise it refreshes itself. Without Web Locks it calls refresh directly. |
| 8. Sign out | Employee signs out (user menu). Frontend calls `POST /api/auth/logout`, clears the access token and auth state, and the backend revokes the refresh session and clears the cookie. Logout works even if the refresh cookie is already missing or invalid. |

## Setting a first password / resetting a password

| Step | What happens |
|---|---|
| 1. Link sent | An employee who has never set a password, or who needs a reset, gets an email link to `<PUBLIC_APP_URL>/set-password/<token>`. |
| 2. Link checked | Opening the link first calls `GET /api/auth/password-token/:token`, which returns the person's name, email, the purpose (`invite` or `reset`), and when the link expires — so the form can show who the link is for before anything is typed. The page title is "Set your password" for an invite and "Reset your password" for a reset, with the email underneath. A closed link shows the reason-specific page (see the link-states table). |
| 3. Password set | Submitting the form calls `POST /api/auth/set-password` with the token, the new password, and the confirmation. The link is consumed, all other open invite/reset links for that user are consumed, and all of the user's existing sessions are revoked. The employee then signs in normally with `POST /api/auth/login`. The page shows the toast "Password set successfully. You can now log in." and goes to `/login`. |

## Being locked out (rate limiting)

Failed sign-ins are throttled so passwords cannot be guessed at scale. Only failures count.

**In plain English:** each wrong password uses up a small budget. A browser that is not marked "trusted" is counted against two budgets: one for that account from that network address, and one for the account as a whole. When the account-wide budget runs out, sign-in from untrusted browsers is paused for up to an hour, but a browser the person ticked "Trust this device" on still gets in. A successful sign-in clears the budgets it used. The exact budgets differ between the written docs and the code (see the warning below).

| Layer | Counter key | Limit | Window | Where |
|---|---|---|---|---|
| Per IP, on `/login`, `/password-token/*`, `/set-password` | client IP (`getClientIp`) | 15 failed requests | 15 minutes, rolling; **in memory** (see file 32, gap 3) | `backend/src/modules/auth/auth.routes.ts` (`authRateLimiter`, `skipSuccessfulRequests: true`) |
| Trusted device | `device:<userId>:<deviceId>` | 5 | 1 hour, fixed, from the first failure in the window | `backend/src/modules/auth/login-guard.ts` (`DEVICE_ATTEMPT_LIMIT`) |
| Untrusted, account + IP | `account_ip:<account>:<ip>` | 5 | 1 hour, fixed | `login-guard.ts` (`ACCOUNT_IP_ATTEMPT_LIMIT`) |
| Untrusted, account | `account:<account>` | 15 | 1 hour, fixed | `login-guard.ts` (`ACCOUNT_ATTEMPT_LIMIT`) |

- Counters live in the database table `login_attempt_counters` (keyed by a hash of the key), so they survive restarts and multiple instances. The per-IP limiter does not.
- Each attempt is counted **before** the password is checked, so a blocked request never reveals whether the password was right.
- `<account>` is the user id when the identifier matches a user, otherwise the typed identifier. Unknown identifiers are therefore throttled the same way, and the limits do not show which accounts exist.
- An inactive user never gets the trusted-device budget; their sign-in is treated as untrusted.
- The 429 text from the login guard is `Too many failed sign-in attempts. Please try again in N minutes.` (N is rounded up, minimum 1). The account-wide variant adds: `Sign-in from new devices is paused; a device you chose to trust can still sign in.`
- Cross-reference: this is the same lockout trade-off as file 32, gap 4 (one person can lock another out of an account for an hour).

## Endpoints

| Endpoint | What it does |
|---|---|
| `POST /api/auth/login` | CSRF-protected (Hono `csrf()`, allowed origins from `CORS_ORIGIN`), per-IP limiter, plus the per-account and per-device lockout (see above). Sets `refresh_token` and, when "Trust this device" is ticked, `login_device`; when unticked it removes `login_device`. |
| `POST /api/auth/refresh` | CSRF-protected; reads the `refresh_token` cookie; rotates it. Returns `401 Missing refresh token.` when the cookie is absent. |
| `POST /api/auth/logout` | CSRF-protected; revokes the session if the cookie is present, always clears the cookie, returns `{ success: true }`. |
| `GET /api/auth/password-token/:token` | Validates an invite/reset link before the form is shown. Unknown tokens get `410` with `reason: "invalid"`, not `404`, so the page's "Password link not found" (404) screen is not reached from this endpoint. |
| `POST /api/auth/set-password` | Sets the password, consumes the link, revokes all sessions. |

Every `/api/auth/*` route caps request bodies at 16 KB (`413 Request body is too large.`). Only `/login`, `/refresh` and `/logout` have CSRF middleware; `GET /password-token/:token` and `POST /set-password` do not, and rely on the per-IP limiter instead.

All routes live in `backend/src/modules/auth/auth.routes.ts`, mounted at `/api/auth` in `backend/src/index.ts`.

## Tokens and sessions — how they work

| Piece | Detail |
|---|---|
| **Access token** | A JWT (using the `jose` library, HS256) carrying `sub` (user id), `roleType`, `email`, and `sessionVersion`, expiring after `ACCESS_TOKEN_TTL_MINUTES` (default 15). Made in `backend/src/lib/auth.ts`. Secret: `JWT_ACCESS_SECRET`. |
| **Refresh token** | A JWT carrying `sub` and `sessionId`, expiring after `REFRESH_TOKEN_TTL_DAYS` (default 7). Secret: `JWT_REFRESH_SECRET`. Both secrets must be at least 32 characters (`backend/src/config/env.ts`). The code does not check that the two differ or that they are random; that is down to whoever sets the environment. |
| **Refresh-token storage** | `refresh_tokens` table (`backend/src/db/schema.ts`): `id` (the session id), `userId`, `tokenHash` (SHA-256 hash of the token — the raw token is never stored), `status` (`active`, `revoked`, `rotated`), `expiresAt`, `revokedAt`, `userAgent`, `ipAddress`. Rotation is in `backend/src/modules/auth/refresh-token-state.ts`. Presenting an already-rotated token more than 30 seconds (`REFRESH_TOKEN_REUSE_GRACE_MS = 30_000`) after rotation revokes **all** of the user's sessions and bumps `sessionVersion`, so access tokens die too (`revokeAllUserSessions` in `backend/src/modules/auth/auth.service.ts`), and logs a `[auth] Refresh token reuse detected` warning. Inside the window the request is simply refused with 401 and nothing else changes. Rows whose `expiresAt` has passed, and `revoked` rows whose `revokedAt` is more than 24 hours old, are deleted on startup and every 6 hours (`backend/src/index.ts`, `purgeExpiredRecords()`). Rotated rows are kept until they expire, because reuse detection needs them. |
| **Session invalidation** | `users.sessionVersion` is stored in the access token. `backend/src/middleware/auth.ts` (`requireAuth`) verifies the token and then checks the user is `active` **and** that the token's `sessionVersion` still matches the database. Bumping `sessionVersion` instantly invalidates every access token that user holds, even before it expires. It happens when: a password is set (`setPasswordWithToken`); a user is saved through the update route with `status: inactive`, or with a role or queue-access field (`updateUser` in `backend/src/modules/users/users.service.ts`; the check looks at what the request contains, not whether the value changed, and it also deletes the user's refresh sessions and unsent resubmission previews); a bulk status change runs, for either value (`bulkUpdateUserStatus`); a user is deactivated through `deactivateUser`, which also calls `revokeAllUserSessions`; or refresh-token reuse is detected. **There is no separate "sign out everywhere" action** in the auth routes or the users module reviewed; the closest equivalents are deactivation and reuse detection. |
| **Login** | `login()` in `backend/src/modules/auth/auth.service.ts`: looks the account up by email or by lowercase username (one lookup, so both share one throttling budget); an inactive account, an unknown account, and an account with no password all get the same `401 "Invalid email or password."` and the same password-hashing cost (a dummy hash is verified), so nothing leaks whether the account exists. A successful sign-in clears the throttling counters for that account and sets `lastLoginAt`. Passwords are verified with `Bun.password.verify` (the stored value is `users.passwordHash`, null until a password is set). |

## "Trust this device"

`backend/src/modules/auth/login-guard.ts` — a signed device cookie named `login_device` (version `v1`, key derived from the refresh secret with HKDF, and the signature covers `sessionVersion`, so a password change or deactivation un-trusts every device at once). A trusted browser counts only against its own budget (5 failed attempts per hour, keyed to user and device). An untrusted browser counts against the account + IP and account budgets. Exhausting the account budget pauses untrusted sign-ins but not trusted ones. The cookie lasts `REFRESH_TOKEN_TTL_DAYS` (7 days by default; `getDeviceCookieMaxAgeSeconds()`) and carries a random device UUID. It is accepted only for the user it was issued to, and only while its signed `sessionVersion` matches the user's current value. The cookie is only ever sent back to `/api/auth/login`, is re-issued on every trusted sign-in so the trust window rolls forward (its lifetime is `REFRESH_TOKEN_TTL_DAYS`, default 7 days, the same as the refresh cookie), and is removed when the employee signs in without ticking the box. Signing out keeps the device cookie — it marks the browser as trusted, it is not a session. The login form also remembers the last state of the checkbox in this browser's `localStorage` under the key `login.trustDevice` (`frontend/src/components/login-form.tsx`, wrapped in try/catch). That is only a convenience; the server's signed cookie decides trust.

## Password links

| Piece | Detail |
|---|---|
| **Where** | `backend/src/modules/auth/auth.service.ts` + `password-token-state.ts`. Tokens are stored hashed in `user_password_tokens` with a `purpose` (`invite` or `reset`) and an expiry. |
| **Expiry** | Invites 72 hours, resets 24 hours (`LINK_DEADLINE_HOURS` in `backend/src/modules/configuration/configuration.service.ts`: `passwordReset: 24`, `newPasswordSet: 72`). |
| **Replacement** | Creating a link does not retire older ones. After the email is accepted, `activatePasswordToken` marks older open links of the same kind as `superseded` (only links created before the new one). If the email fails, the new link is deleted (`discardPasswordToken`) and the request fails with `502`, so older links keep working. Setting a password marks every open link for the user, of either kind, as `invalidated`. |
| **Guessing protection** | Failed link lookups and password sets share the per-IP limiter (15 failed requests per 15 minutes, in memory; see file 32, gap 3). A lookup for an unknown or closed link does not reach the password hash. Links are stored hashed (`hashToken`). Migration `backend/drizzle/0110_auth_token_state.sql` stops a consumed link from being reopened or consumed again. |
| **Stored fields** | `user_password_tokens`: `token_hash`, `purpose`, `expires_at`, `created_by`, `consumed_at`, `consumed_reason` (`used`, `superseded`, `invalidated`). |

**Link states** (what a closed link says, from `backend/src/modules/auth/password-token-state.ts`; the frontend copy is in `frontend/src/features/auth/password-token-status.tsx`):

| Reason | Set when | 410 message from the API |
|---|---|---|
| `used` | The password was set with this link. | `This password link was already used.` |
| `superseded` | A newer link of the same kind was sent. | `A newer password link was sent. Use the link in the latest email.` |
| `invalidated` | The password was set with another link. | `This password link stopped working because the password was set with another link.` |
| `expired` | Past `expires_at`. | `This password link has expired.` |
| `invalid` | Unknown token, or an old consumed row with no reason. | `This password link is expired or invalid.` |

An unknown token returns the `invalid` reason with the 410 status. The backend lookup never returns 404, so the frontend's "Password link not found" branch (`set-password.$token.tsx`) is not reached from the API reviewed.

## CSRF and cookies

| Piece | Detail |
|---|---|
| **CSRF** | `POST /login`, `/refresh`, and `/logout` use Hono's `csrf()` middleware with the allowed origins from `CORS_ORIGIN`. Form-style cross-site requests are rejected with 403; JSON cross-site requests are stopped by the CORS preflight. Documented in `backend/apis/auth.md`. |
| **Refresh cookie** | Name `refresh_token`, `HttpOnly: true`, `Path: /`, `SameSite` from `COOKIE_SAME_SITE` (default `lax`; `none` for separately hosted frontend/backend, which then requires `COOKIE_SECURE=true` and HTTPS), `Secure` from `COOKIE_SECURE` (default `false` outside production), `maxAge` = `REFRESH_TOKEN_TTL_DAYS` in seconds. `COOKIE_DOMAIN` is optional. `COOKIE_SAME_SITE=none` without `COOKIE_SECURE=true` fails startup (`backend/src/config/env.ts`). |

## Frontend — how the pages are built

| Piece | What it does |
|---|---|
| **Pages** | `frontend/src/routes/login.tsx` (client-only, `ssr: false`; its `beforeLoad` redirects an already signed-in user away) and `frontend/src/routes/set-password.$token.tsx`. The login page has a brand column ("AssanPay / Onboarding Portal") and the `LoginForm` component (`frontend/src/components/login-form.tsx`). The form has the heading "Sign in", the fields "Email or Username" and "Password", and a "Trust this device" checkbox. The checkbox has no helper text under it (the note was removed from the login screen). After a successful sign-in the form saves the checkbox choice (see the next row about storage) and navigates to the `redirect` target. |
| **Auth state** | `frontend/src/features/auth/auth-client.ts` — `createAuthClient()` keeps `{ accessToken, user }` in a plain in-memory snapshot (a `useSyncExternalStore` hook, `useAuth()`, reads it). Auth state is never written to `localStorage` or `sessionStorage`: closing the tab loses the access token, and the refresh cookie is what brings the session back. The only browser storage on the sign-in path is the trust-device checkbox memory described under "Trust this device". |
| **API calls** | `frontend/src/apis/auth.ts`: `loginRequest()` (`POST /api/auth/login`, sends `identifier`, `password`, `trustDevice`), `logoutRequest()`, `fetchPasswordToken(token)`, `setPasswordRequest(token, input)`. |
| **HTTP client** | `frontend/src/lib/api-client.ts` — Axios with `withCredentials: true`; a request interceptor adds the `Bearer` token; a response interceptor on 401 calls `refreshSession()` once and retries. Login and refresh requests are never retried. If the refresh fails with 401 or 403, the interceptor clears the session, navigates to `/login?redirect=<current location>` (unless already on `/login`) and clears the query cache; other refresh errors are passed back to the caller without logging out. `frontend/src/features/auth/session-refresh.ts` — `refreshSession()` posts to `/api/auth/refresh` with credentials, serialised across tabs, and treats 401/403 from the refresh endpoint as a terminal (logged-out) error. When a terminal refresh fails during an ordinary API call, the same file clears the auth state, navigates to `/login?redirect=<current page>` with `replace` (unless already on `/login`), and clears the query cache so app queries do not refetch without a token. |
| **Route guards** | `frontend/src/features/auth/route-guards.ts`: `requireAuthSession()` (used by the `/_app` layout's `beforeLoad` in `frontend/src/routes/_app.tsx`; if there is no session in memory it tries `ensureAuthSession()` — a refresh — and otherwise redirects to `/login?redirect=…`; it does not call refresh for speculative preloads), `redirectAuthenticatedUser()` (the reverse, for `/login`), and `requireAllowedRoles()` (redirects to `/` when the role is not allowed). `frontend/src/features/auth/auth-query.ts` holds `ensureAuthSession()`; `frontend/src/features/auth/redirect.ts` holds `sanitizeRedirect()`. |
| **Password-token status** | `frontend/src/features/auth/password-token-status.tsx` renders the closed-link screens: "Password link not found" (404), a closed-link screen chosen by the 410 `reason` (`used`, `superseded`, `invalidated`, `expired`, or a general "no longer valid" copy when there is no reason), and "Unable to open password link" with a Try again button for other errors. |
| **Set-password page** | `frontend/src/routes/set-password.$token.tsx` fetches the link, then shows "Set your password" (invite) or "Reset your password" (reset) with the user's email as the description. Fields are "Password" and "Confirm Password"; the button reads "Set Password" and then "Saving…". On success it shows the toast "Password set successfully. You can now log in." and navigates to `/login`. On a 410 it re-fetches the link so the closed-link screen appears. |

## Validation and errors

| Field / case | Rule |
|---|---|
| Login `identifier` | 2–255 characters (matched case-insensitively; the legacy `{ email, password }` shape is still accepted). At least one of `identifier`/`email` is required. |
| Login `password` | 1–128 characters (`min(1)` in both `frontend/src/schemas/auth.schema.ts` and `backend/src/modules/auth/auth.schemas.ts`). The 8-character minimum is enforced only when a password is set, not at sign-in. |
| Set-password | Token 32–256 characters; `password` and `confirmPassword` 8–128 characters and must match (`Passwords do not match.`, reported on `confirmPassword`). The frontend schema (`frontend/src/schemas/users.schema.ts`) checks only the minimum of 8 and the match, not the 128 maximum; the backend enforces both. |
| Password-token path parameter | Token 32–256 characters. |
| Errors | See the full table below. All error responses use `{ "error": "message" }`. |

| Status | Message (exact) | When |
|---|---|---|
| `400` | The first Zod issue's message, e.g. `Passwords do not match.` or `Username or email is required.` | Body or path fails validation (`zodValidator` in `backend/src/lib/validators.ts`). |
| `401` | `Invalid email or password.` | Login: unknown account, inactive account, no password set, or wrong password (all identical). |
| `401` | `Missing refresh token.` | `/refresh` with no `refresh_token` cookie. |
| `401` | `Invalid refresh token.` | Cookie is not a valid signed token, or no matching session row. |
| `401` | `Refresh token is expired or revoked.` | Rotated (inside or outside the grace window), revoked, or expired. |
| `401` | `User is not available.` | Refresh for a user who is no longer active. |
| `401` | `Missing bearer token.` / `Invalid access token.` / `Access token is expired or revoked.` | Any protected route (`requireAuth`, `backend/src/middleware/auth.ts`). |
| `403` | Cross-site form request (Hono `csrf()`) | `/login`, `/refresh`, `/logout` from an origin not in `CORS_ORIGIN`. |
| `410` | Reason-specific link message, with a `reason` field | Closed password link (see the link-state table). |
| `413` | `Request body is too large.` | Body over 16 KB on any `/api/auth/*` route. |
| `429` | `Too many attempts. Please try again later.` | Per-IP limiter (15 failed requests per 15 minutes). |
| `429` | `Too many failed sign-in attempts. Please try again in N minutes.` (or the "paused on this account" variant) | Login guard (per device, or per account and IP, or per account). |
| `500` | `Failed to set password.` | The password-set transaction returns no row. |
| `502` | Mail provider error text, or `Failed to send password email.` | A new invite or reset link could not be emailed (`users.service.ts`). |

Validation lives in `backend/src/modules/auth/auth.schemas.ts`, and `backend/apis/auth.md`.

## The user object returned on sign-in

The login/refresh/set-password responses return the common user object:

| Field | Values / notes |
|---|---|
| `id`, `name`, `email`, `username` | Identity fields. |
| `gender` | `male` / `female`. |
| `roleType` | `super_admin` / `admin` / `agent`. |
| `status` | `active` / `inactive`. |
| `queueViewScope` | `all` / `selected`. |
| `workQueueIds` | Queues the user can work in. |
| `canManageEpCases` | `true` for admins and super admins. For agents, `true` only when they hold work access to a queue whose workflow is `sub_merchant_form`. Only decides what the frontend shows; the server checks again on each request. |
| `createdByUserId`, `lastLoginAt`, `createdAt`, `updatedAt` | Audit/timestamp fields. |

The users-list version additionally returns `hasSetPassword`, `viewQueueIds`, `viewQueues`, `workQueues`, and `ownedCasesCount`. See file 03.

> ⚠️ **Docs disagree with code on rate limits — flag this.** `backend/apis/auth.md` says: `/login` allows 15 failed attempts per IP per 15 minutes, and 10 failed attempts per account per 15 minutes; over the limit returns 429. The code says something different: `backend/src/modules/auth/auth.routes.ts` applies a 15-requests-per-15-minutes limiter that skips successful requests (so it counts failures only) per IP, **and** `backend/src/modules/auth/login-guard.ts` applies its own fixed one-hour windows — 5 attempts per trusted device (`DEVICE_ATTEMPT_LIMIT = 5`), 5 per account + IP (`ACCOUNT_IP_ATTEMPT_LIMIT = 5`), 15 per account (`ACCOUNT_ATTEMPT_LIMIT = 15`) — with a 1-hour window (`ATTEMPT_WINDOW_MS = 3,600,000`). The 10-per-account-per-15-minutes figure in the docs does not appear in the code reviewed. The owner should confirm which behaviour is intended; the code is what actually runs.

## Edge cases and gaps

- **Reuse grace window.** `REFRESH_TOKEN_REUSE_GRACE_MS = 30_000` (30 seconds, `backend/src/modules/auth/auth.service.ts`). A rotated token presented within 30 seconds of rotation is refused with 401 and nothing is revoked, which covers two tabs or a lost response. Later than that, all sessions are revoked.
- **Single super admin.** The database enforces exactly one `super_admin` with a partial unique index (`users_single_super_admin` on `role_type` where it equals `super_admin`). If that account is deactivated or its password is lost, recovery is an owner-level question — see the questions below.
- **No "forgot password" self-service.** An employee cannot request their own reset link from the login page in the code reviewed; only a super admin can send one (see file 03). There is no "forgot password" link on `/login` in the files reviewed.
- **What the frontend never sees.** The refresh token is HttpOnly and never appears in JavaScript; the access token is never written to storage. If the backend and frontend are on different origins, the cookie needs `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, HTTPS on the backend, and the frontend origin in `CORS_ORIGIN`.

## What to check — is this what you intended?

- [ ] Rate limits: should a failed sign-in be limited per 15 minutes (as the API doc says) or per hour (as the code does), and what should the per-IP, per-account, and per-device numbers be? The code is stricter than the doc — is that deliberate?
- [ ] Is 15 minutes the right lifetime for an access token, and 7 days for a refresh token? Should staff be signed out sooner (for example overnight, or after inactivity)?
- [ ] "Trust this device" lets a trusted browser keep signing in while untrusted browsers are locked out of an account. Is that the behaviour you want, and how long should trust last? (Code: the trust cookie lasts 7 days by default, the same as the refresh token. Confirm that is intended.)
- [ ] Only a super admin can send a password-reset email. Should an admin be able to do it too, and should employees be able to request their own reset from the login page?
- [ ] There is exactly one super admin by database design. Who should hold that account, and what is the recovery plan if that person is unavailable or locked out?

---
*Sources: `frontend/src/routes/login.tsx`, `frontend/src/routes/set-password.$token.tsx`, `frontend/src/components/login-form.tsx`, `frontend/src/features/auth/auth-client.ts`, `frontend/src/features/auth/session-refresh.ts`, `frontend/src/features/auth/route-guards.ts`, `frontend/src/features/auth/auth-query.ts`, `frontend/src/features/auth/redirect.ts`, `frontend/src/features/auth/password-token-status.tsx`, `frontend/src/apis/auth.ts`, `frontend/src/lib/api-client.ts`, `frontend/src/routes/_app.tsx`, `backend/src/modules/auth/auth.routes.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/auth.schemas.ts`, `backend/src/modules/auth/login-guard.ts`, `backend/src/modules/auth/refresh-token-state.ts`, `backend/src/modules/auth/password-token-state.ts`, `backend/src/lib/auth.ts`, `backend/src/middleware/auth.ts`, `backend/src/config/env.ts`, `backend/src/index.ts`, `backend/src/db/schema.ts`, `backend/apis/auth.md`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/modules/users/users.service.ts`, `backend/src/lib/validators.ts`, `backend/drizzle/0110_auth_token_state.sql`, `frontend/src/schemas/auth.schema.ts`, `frontend/src/schemas/users.schema.ts`. Related files: 01 (overview), 03 (user management), 06 (resubmission links, which use the same merchant-facing link pattern).*
