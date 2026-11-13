# 31 — APIs And Integrations

## At a glance

| | |
|---|---|
| **What it is** | Every API the portal offers — the backend routes, what each one does, who may call it — and every outside service the portal talks to: Google Drive, Resend email, and the hosting setup. It is the map for anyone building a new screen, checking whether an endpoint already exists, or wondering why a feature depends on a third party. An API is the set of addresses (endpoints) the frontend calls to ask the backend to do something. |
| **Who can use it** | Public (no login): the onboarding form, the resubmission page, the health check and root, login, refresh (cookie), the password-link pages (`GET /api/auth/password-token/:token`, `POST /api/auth/set-password`), and the Resend webhook. Logged-in staff: everything under `/api/merchants`, `/api/cases`, `/api/users`, `/api/queues`, `/api/configuration`, `/api/dashboard`, `/api/notifications`. Outside services: Google Drive and Resend. |
| **Where it lives** | Backend: Bun + Hono, `src/index.ts` mounts the routers. Frontend base URL `VITE_API_URL` (development default `http://localhost:3000`, production `https://onboard.assanpay.net`). |
| **Main code** | Backend: `src/index.ts`, `src/modules/*/ *.routes.ts` (auth, cases, merchants, users, queues, configuration, dashboard, notifications, email/resend-webhook), `backend/apis/*.md`, `src/modules/email/email.client.ts`, `src/lib/storage/google-drive.ts` · Frontend: `src/apis/*.ts`, `src/config/client-env.ts`, `wrangler.jsonc` |
| **Success looks like** | A screen calls the right endpoint, gets the data it needs, and a merchant application flows from the public form through cases, emails and Drive files without any screen needing to talk to Google or Resend directly. |

## How it works — the journey

```
Staff / merchant uses a screen in the browser
        ↓
Frontend calls the backend: base URL VITE_API_URL, withCredentials: true
(so the browser stores and sends the refresh cookie), and
Authorization: Bearer <accessToken> when logged in
        ↓
Backend routes the request (src/index.ts mounts the routers),
applies the public rate limiter to /api/public/*, and the multipart size limit to the merchant-form and resubmission upload routes,
validates the input, checks auth / roles / queue access
        ↓
Backend does the work — database, Google Drive, or Resend email
        ↓
Response: the resource, or a small result object;
failures return { "error": "<message>" }
```

## Who can use it

| Who | What they can do |
|---|---|
| **Public (no login)** | The onboarding form, the resubmission page, the health check and root, login, refresh, logout (cookie-based), the password-link pages (`GET /api/auth/password-token/:token`, `POST /api/auth/set-password`), and the Resend webhook. Every other router applies `requireAuth` to all of its routes (`cases`, `configuration`, `dashboard`, `merchants`, `users`, `queues`, `notifications`), so nothing else is public. |
| **Logged-in staff** | Everything under `/api/merchants`, `/api/cases`, `/api/users`, `/api/queues`, `/api/configuration`, `/api/dashboard`, `/api/notifications`, with role and queue checks per route (see file 29). |
| **Outside services** | Google Drive (service account) and Resend (email sending and delivery webhooks) call into, or are called by, the backend. The frontend never talks to Google or Resend directly. |

## How the pieces fit — business view

1. **The frontend calls the backend.** Base URL `VITE_API_URL` (development default `http://localhost:3000`, production `https://onboard.assanpay.net`). Every request sends `withCredentials: true` so the browser stores and sends the refresh cookie, and (when logged in) `Authorization: Bearer <accessToken>`.
2. **The backend routes the request.** `src/index.ts` mounts the routers (see the mount table below), applies the public rate limiter to `/api/public/*` and the multipart size limit to the merchant-form and resubmission upload routes (`src/index.ts`), and returns `{ "error": "<message>" }` for failures.
3. **Staff work flows through case endpoints.** A case is listed, opened, assigned, advanced and closed through `/api/cases/*`; its documents, agreements and emails are handled by the case sub-routes.
4. **Merchants arrive through the public form.** `POST /api/public/merchant-form` creates the merchant, uploads documents to Drive and creates the starting cases; `POST /api/public/resubmission/:token` handles rejected-document resubmissions.
5. **Email goes out through Resend.** The backend renders a React email template, sends it with the Resend API, logs it in `email_log`, and Resend later reports delivery, bounces and complaints to `POST /api/webhooks/resend`, which updates the same log.
6. **Files go to Google Drive.** Every upload endpoint hands the file to the Drive provider (file 28); the API response carries Drive IDs and links, never file contents.

## Backend — framework, mount points, health, background work

| Topic | Detail |
|---|---|
| **Framework** | Bun + Hono (`src/index.ts`), strict TypeScript, Zod validation (`zodValidator`) on the routes that read a JSON body, query or params (not every route; some path IDs are checked in the handler), Hono `secureHeaders()`, request IDs, CORS with credentials. The `/api/auth` routes add three guards: a 16 KB request body limit (413 "Request body is too large."), a CSRF origin check on `login`, `refresh` and `logout` (origin taken from `CORS_ORIGIN`), and the auth rate limiter on `login`, `password-token/*` and `set-password` (`src/modules/auth/auth.routes.ts`). The API defaults to `http://localhost:3000` (`APP_PORT`, default 3000). Root `GET /` returns `{ "name": "Onboarding Portal API", "status": "ok" }`. |
| **Health** | `GET /health/db` runs `select 1` and reports the case-flow worker. It returns `status` (`ok`, `degraded` or `unhealthy`), `db` (true/false), and a `caseFlowWorker` object (`ready`, `running`, `lastCycleAt`, `lastDurationMs`, `lastCycleSucceeded`, plus pending/retrying/failed/blocked job counts). It returns 503 when the worker is not ready. The backend README also documents `GET /api/cases/flow-jobs/failed` and `POST /api/cases/flow-jobs/:jobId/retry` for admins. |
| **Background work in the same process** | The case-flow close worker (`src/index.ts`; polls every 1 second while active, backs off to 15 minutes idle by default; batch of 5; the idle poll is only a safety net because new jobs and due retries wake it; see `CASE_FLOW_WORKER_*` in `src/config/env.ts`), a merchant-request recovery job (startup, then every 5 minutes, `merchant-request.service.ts`), and a cleanup job (startup, then every 6 hours) that deletes refresh tokens that have expired or were revoked more than 24 hours ago (rotated tokens are kept until they expire, so reuse of a stolen token can still be detected) and submission attempts older than 60 days. |
| **Shutdown** | On `SIGTERM` or `SIGINT` (`src/index.ts`) the process stops its timers, waits up to 10 seconds for an in-flight case-flow cycle, closes the database pool and exits. |
| **Hosting and deploy** | `backend/.github/workflows/deploy.yml` runs on every push to `main`: it SSHes to an EC2 host, updates the checkout at `/var/www/onboarding-portal-assanpay-BE`, does a frozen install and typecheck, runs `bun run db:migrate` through `DIRECT_DATABASE_URL`, restarts the PM2 process `onboarding-backend`, and polls `/health/db` on `127.0.0.1:3000` (overridable with `BACKEND_HEALTH_URL`). Deployments are serialized, and a failed one restores the previous checkout. Migrations are not reversed (`backend/README.md`). |

### Mount points (`src/index.ts`)

| Mount | Router |
|---|---|
| `/api/auth` | `authRoutes` |
| `/api/public` | `merchantFormRoutes` |
| `/api/public/resubmission` | `resubmissionRoutes` |
| `/api/merchants` | `merchantRoutes` |
| `/api/users` | `userRoutes` |
| `/api/queues` | `queueRoutes` |
| `/api/cases` | `caseRoutes` |
| `/api/configuration` | `configurationRoutes` |
| `/api/dashboard` | `dashboardRoutes` |
| `/api/notifications` | `notificationRoutes` |
| `/api/webhooks/resend` | `resendWebhookRoutes` |

## Endpoint inventory — from the route files

Route lists below were taken from the route files, not from `backend/apis/*.md` — where the two disagree, file 32 records it. Unless a role is noted, the endpoint requires login (`requireAuth`); role notes are given where the route file states them.

### Root and health

| Method | Path | Who / notes |
|---|---|---|
| `GET` | `/` | Public. Returns `{ "name": "Onboarding Portal API", "status": "ok" }`. |
| `GET` | `/health/db` | Public. Runs `select 1` and reports the case-flow worker; `200` when the worker is ready, `503` when it is not. |

Any unknown path returns `404` with `{ "error": "Not found." }` (`app.notFound` in `src/index.ts`).

### Auth

| Method | Path | Who / notes |
|---|---|---|
| `POST` | `/api/auth/login` | Public. |
| `POST` | `/api/auth/refresh` | With refresh cookie. |
| `POST` | `/api/auth/logout` | No access token needed. Reads the refresh cookie, revokes that refresh token if present, and clears the cookie (`auth.routes.ts`). |
| `GET` | `/api/auth/password-token/:token` | Public — checks a password link first. |
| `POST` | `/api/auth/set-password` | Public with a valid token. |

All five are covered in `backend/apis/auth.md`.

### Public merchants

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/public/merchant-form` | Create a merchant, upload documents to Drive, create starting cases. |
| `GET` | `/api/public/resubmission/:token` | Load a resubmission page. |
| `POST` | `/api/public/resubmission/:token` | Handle a rejected-document resubmission. |

### Merchants (all require auth)

| Method | Path | Who / notes |
|---|---|---|
| `GET` | `/api/merchants` | List merchants. |
| `GET` | `/api/merchants/:id` | Merchant detail. |
| `GET` | `/api/merchants/:id/overview` | Overview. |
| `GET` | `/api/merchants/:id/form` | Submitted form. |
| `GET` | `/api/merchants/:id/history` | History. |
| `GET` | `/api/merchants/:id/limits-mdr` | Limits/MDR. |
| `PATCH` | `/api/merchants/:id/limits-mdr` | `super_admin`, `admin`. |
| `DELETE` | `/api/merchants/:id/limits-mdr` | `super_admin`, `admin`. |
| `PATCH` | `/api/merchants/:id/terminate` | `super_admin`, `admin`. |
| `POST` | `/api/merchants/bulk-terminate` | `super_admin`, `admin`. |
| `DELETE` | `/api/merchants/:id/drive-files` | `super_admin` only. |
| `DELETE` | `/api/merchants/:id/permanent` | `super_admin` only. |
| `PATCH` | `/api/merchants/:id/priority` | `super_admin`, `admin`. |
| `POST` | `/api/merchants/bulk-priority` | `super_admin`, `admin`. |
| `DELETE` | `/api/merchants/:id` | `super_admin` only. |
| `POST` | `/api/merchants/bulk-delete` | `super_admin` only. |

> `PATCH /api/merchants/:id/terminate` and `POST /api/merchants/bulk-terminate` accept `deleteDriveFiles`. Only a `super_admin` may set it to true; an `admin` gets 403 "Only a Super Admin can delete Google Drive files." (`merchants.routes.ts`, `assertCanDeleteDriveFiles`). The stand-alone `DELETE /api/merchants/:id/drive-files` route is `super_admin` only.

### Users (all require auth)

| Method | Path | Who / notes |
|---|---|---|
| `GET` | `/api/users` | `super_admin`, `admin`. |
| `GET` | `/api/users/directory` | Any logged-in user. |
| `GET` | `/api/users/:id` | `super_admin`, `admin`. |
| `POST` | `/api/users` | `super_admin`, `admin`. |
| `PATCH` | `/api/users/:id` | `super_admin`, `admin`. |
| `DELETE` | `/api/users/:id` | `super_admin`. Deactivates the user (sets `status` to `inactive` and revokes all of that user's sessions, `deactivateUser` in `users.service.ts`); the row is not deleted. Refuses your own account with `400 "You cannot delete your own account."`; an unknown ID gives `404 "User not found."`. |
| `POST` | `/api/users/bulk-status` | `super_admin`, `admin`. |
| `POST` | `/api/users/:id/reset-password` | `super_admin` only. |
| `POST` | `/api/users/bulk-reset-password` | `super_admin` only. |

### Queues (all require auth)

| Method | Path | Who / notes |
|---|---|---|
| `GET` | `/api/queues` | Any logged-in user. |
| `GET` | `/api/queues/:id` | `super_admin` only. |
| `PATCH` | `/api/queues/:id` | `super_admin` only. |
| `PATCH` | `/api/queues/:id/status` | `super_admin` only. |
| `PATCH` | `/api/queues/:id/sla` | `super_admin` only. |

### Cases (all require auth; `POST /`, `POST /bulk-create`, `POST /bulk-assign` need super_admin or admin)

| Method | Path |
|---|---|
| `GET` | `/api/cases` |
| `POST` | `/api/cases` |
| `POST` | `/api/cases/bulk-create` |
| `POST` | `/api/cases/bulk-assign` |
| `GET` | `/api/cases/owners` |
| `GET` | `/api/cases/ep-sub-merchant/merchants` |
| `POST` | `/api/cases/ep-sub-merchant/trigger` |
| `GET` | `/api/cases/:id` |
| `PATCH` | `/api/cases/:id/assign` (`super_admin`, `admin`) |
| `PATCH` | `/api/cases/:id/priority` (`super_admin`, `admin`) |
| `PATCH` | `/api/cases/:id/take-ownership` |
| `PATCH` | `/api/cases/:id/advance-stage` |
| `PATCH` | `/api/cases/:id/status` |
| `PATCH` | `/api/cases/:id/close-unsuccessful` |
| `PUT` | `/api/cases/:id/field-reviews` |
| `PUT` | `/api/cases/:id/document-review/sub-merchant` |
| `PUT` | `/api/cases/:id/sub-merchant-form/selection` |
| `POST` | `/api/cases/:id/sub-merchant-form/final-form` |
| `POST` | `/api/cases/:id/sub-merchant-form/email-proof` |
| `POST` | `/api/cases/:id/agreement/final-agreement` |
| `POST` | `/api/cases/:id/agreement/received-copy` |
| `POST` | `/api/cases/:id/agreement/send-mail` |
| `POST` | `/api/cases/:id/agreement/send-mail/preview` |
| `POST` | `/api/cases/:id/agreement/send-mail/manual` |
| `POST` | `/api/cases/:id/send-for-resubmission` |
| `POST` | `/api/cases/:id/send-for-resubmission/preview` |
| `POST` | `/api/cases/:id/send-for-resubmission/manual` |
| `POST` | `/api/cases/:id/send-for-resubmission/regenerate-link` |
| `POST` | `/api/cases/:id/live/send-mail` |
| `POST` | `/api/cases/:id/live/send-mail/preview` |
| `POST` | `/api/cases/:id/live/send-mail/manual` |
| `POST` | `/api/cases/:id/live/limits-applied` |
| `POST` | `/api/cases/:id/testing/send-credentials-mail` |
| `POST` | `/api/cases/:id/testing/send-credentials-mail/preview` |
| `POST` | `/api/cases/:id/testing/send-credentials-mail/manual` |
| `POST` | `/api/cases/:id/testing/limits-applied` |
| `POST` | `/api/cases/:id/mid-creation/save` |
| `GET` | `/api/cases/:id/portal-password-code` |
| `POST` | `/api/cases/:id/portal-password-code` |
| `PUT` | `/api/cases/:id/portal-api-credentials` |
| `POST` | `/api/cases/:id/portal-api-credentials/reveal` |
| `POST` | `/api/cases/:id/wordpress-website` |
| `POST` | `/api/cases/:id/email-delivery/confirm-delivered` |
| `GET` | `/api/cases/:id/comments` |
| `POST` | `/api/cases/:id/comments` |
| `GET` | `/api/cases/:id/history` |
| `GET` | `/api/cases/flow-jobs/failed` (`super_admin`, `admin`) |
| `POST` | `/api/cases/flow-jobs/:jobId/retry` (`super_admin`, `admin`) |
| `GET` | `/api/cases/flow-jobs/backfill/preview` (`super_admin`, `admin`) |
| `POST` | `/api/cases/flow-jobs/backfill` (`super_admin`, `admin`) |

### Configuration (all require auth; everything after the first two GETs needs super_admin or admin)

| Method | Path |
|---|---|
| `GET` | `/api/configuration/sub-merchants` |
| `GET` | `/api/configuration/email-sending-mode` |
| `GET` | `/api/configuration` |
| `GET` | `/api/configuration/limits-and-mdr` |
| `GET` | `/api/configuration/payment-methods` |
| `GET` | `/api/configuration/payout-methods` |
| `GET` | `/api/configuration/agreements` |
| `GET` | `/api/configuration/sub-merchants/drafts` |
| `GET` | `/api/configuration/merchant-portal` |
| `GET` | `/api/configuration/case-flow` |
| `GET` | `/api/configuration/case-flow/versions/:versionId` |
| `PUT` | `/api/configuration/case-flow` |
| `GET` | `/api/configuration/case-flow/merchant-move/preview` |
| `POST` | `/api/configuration/case-flow/merchant-move/preview` |
| `POST` | `/api/configuration/case-flow/merchant-move` |
| `PUT` | `/api/configuration/limits-and-mdr` |
| `PUT` | `/api/configuration/email-sending-mode` |
| `GET` | `/api/configuration/email-recipients` |
| `PUT` | `/api/configuration/email-recipients` |
| `GET` | `/api/configuration/email-templates/:key` |
| `PUT` | `/api/configuration/merchant-portal` |
| `PUT` | `/api/configuration/payment-methods` |
| `PUT` | `/api/configuration/payout-methods` |
| `POST` | `/api/configuration/agreements/:businessType/draft` |
| `POST` | `/api/configuration/sub-merchants` |
| `PATCH` | `/api/configuration/sub-merchants/:id` |

> ⚠️ **No template write route exists:** `configuration.routes.ts` has only `GET /api/configuration/email-templates/:key`, which returns a preview. There is no `PUT /api/configuration/email-templates/:key` in the code, and the frontend calls only the GET (`src/apis/configuration.ts`). File 32 (gap 13) records that this PUT does not exist in the code.

### Dashboard (all require auth)

| Method | Path | Who / notes |
|---|---|---|
| `GET` | `/api/dashboard` | |
| `GET` | `/api/dashboard/workload` | |
| `GET` | `/api/dashboard/portal-mids/pending` | |
| `GET` | `/api/dashboard/portal-mids/pending/mids` | |
| `GET` | `/api/dashboard/portal-mids/applied` | |
| `GET` | `/api/dashboard/agreements/awaiting-physical` | |
| `POST` | `/api/dashboard/portal-mids/apply-limits` | `super_admin`, `admin`. |

Every dashboard GET needs login only (no role check in `dashboard.routes.ts`); `POST /api/dashboard/portal-mids/apply-limits` needs `super_admin` or `admin`. `backend/apis/` has no dashboard document — see file 32.

### Notifications (all require auth)

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/notifications` | List notifications. |
| `GET` | `/api/notifications/unread-count` | Unread count. |
| `PATCH` | `/api/notifications/:id/read` | Mark one read. |
| `PATCH` | `/api/notifications/read-all` | Mark all read. |
| `GET` | `/api/notifications/stream` | Server-sent events (SSE) live stream. Sends a heartbeat every 25 seconds. Each user may hold at most 10 open streams; the 11th returns `429 "Too many open notification streams. Close some tabs."`. Event names: `notification` (with an id), `case-email-status`, `ping`, `ready` (`src/modules/notifications/notifications.routes.ts`). |

### Webhooks

| Method | Path | Who / notes |
|---|---|---|
| `POST` | `/api/webhooks/resend` | Public, Svix signature required; see below. |

## Request and response shapes

| Topic | Detail |
|---|---|
| **Response shapes** | Success is the resource or a small result object; errors are always `{ "error": "<message>" }` with the status codes listed in file 29. List endpoints return paged results; the case list, merchant list and user list accept filters, search text, sorting and cursor pagination, while comments and history return every row. |
| **Idempotency** | The public form's `Idempotency-Key` header is optional: older pages send none, and then a retry creates a new merchant (see file 32). When sent, it must match `^[A-Za-z0-9_-]{16,128}$`, otherwise 400 "Idempotency-Key header is invalid." (`merchants/form.routes.ts`). The first submission returns 201; a replay returns the original merchant with 200 and `outcome: 'replayed'` in `public_submission_attempts`. Password-reset/invite emails use an idempotency key that includes the expiry timestamp (review report L16), so identical resends are not deduplicated by Resend. Other email sends use keys built from the case: `agreement/<caseId>/<updatedAt>`, `resubmit/<caseId>/<tokenId>`, `live-activation/<caseId>`, `mid-creation/<caseId>/<communicationId>`. An idempotency key is a unique key sent with a request so a retry returns the original result instead of creating a duplicate. |
| **Manual-send endpoints** | The `*/manual` case endpoints accept `multipart/form-data` with `file` (screenshot proof), `tokenId`, `channel` (`whatsapp` or `email`; any other value becomes `email`) and `recipientEmailType`. The agreement manual send also takes `remarks`. The file must be a JPEG/PNG/WebP screenshot and is content-checked (see file 28). |
| **Common error responses** | Public form: more than `PUBLIC_SUBMISSION_LIMIT_PER_IP` (default 3) created applications from one IP in 24 hours returns 429 "Too many applications have been submitted from this network today. Please try again tomorrow."; a wrong `Content-Type` returns 400 "Content-Type must be multipart/form-data."; each failed attempt is recorded in `public_submission_attempts` with outcome `rate_limited`, `rejected` or `error` (`merchants/form.routes.ts`, `submission-attempts.service.ts`). Every public route under `/api/public/*` shares a limit of 60 requests per 15 minutes per IP, returning 429 "Too many public requests. Please try again later." (`src/index.ts`). Public multipart bodies over 225 MB return 413 "Request body is too large." (`/api/public/merchant-form` and `/api/public/resubmission/*`). Each uploaded file is capped at 10 MB (`lib/storage/file-limits.ts`). |
| **Email preview endpoints** | `*/preview` return the rendered email without sending it, so staff can check the content before sending. |
| **Delivery confirmation** | `POST /api/cases/:id/email-delivery/confirm-delivered` lets the case owner confirm from Resend that the latest email reached its To address and only a CC bounced. Only the current owner may call it; anyone else gets 403 "Only the current case owner can work on this case." (`case-email-delivery.ts`, `confirmCaseEmailDelivered`). The case must be in `working` (409 "Delivery can only be confirmed while the case is in Working."); the `emailLogId` in the body must be the case's latest email (409 "A newer email was sent for this case. Refresh and check it again."); and the call is allowed only when that email bounced and was copied to CC addresses (409 "This email can only be force closed when it bounced and was copied to CC addresses."). A successful confirmation writes a case-history entry. A failed email send returns HTTP 200 with `{ "status": "failed" }` in the body (review report L15), so callers must inspect the body, not just the status code. |

> ⚠️ **Failed email sends return HTTP 200:** a failed send returns 200 with `{ "status": "failed" }` in the body, so code that only checks the status code will think the email went out.

## How it is implemented — Frontend

| Piece | File / detail |
|---|---|
| API layer | `src/apis/`: `auth.ts`, `cases.ts`, `configuration.ts`, `dashboard.ts`, `ep-sub-merchants.ts`, `merchant-onboarding.ts`, `merchants.ts`, `notifications.ts`, `users.ts`. Each exports typed functions that call `apiClient` (axios) — for example `uploadAgreementFinalAgreement`, `deleteMerchantDriveFiles`, `submitResubmission`. Multipart uploads use `FormData` with `Content-Type: multipart/form-data`; everything else is JSON. `src/lib/api-client.ts` is the axios instance (`withCredentials: true`, base URL from `API_BASE_URL`). A request interceptor adds `Authorization: Bearer` from the auth snapshot. A response interceptor handles 401 by refreshing the session once and retrying the request. Refresh and login calls are never retried. If the refresh fails terminally, the client clears the session and sends the user to `/login` (unless already there). |
| Queries | `src/hooks/` (TanStack Query): `use-cases-query.ts`, `use-case-detail-query.ts`, `use-merchants-query.ts`, `use-users-query.ts`, `use-dashboard-query.ts`, `use-ep-sub-merchants-query.ts`, `use-configuration-query.ts` and `use-notifications-query.ts`. The cases, merchants, dashboard and EP sub-merchant hooks use `placeholderData: keepPreviousData` while refetching; the users hook does not. Lists use cursor pagination in most places. |
| Notifications stream | `src/features/notifications/notifications-sse.ts` opens a server-sent-events stream to `GET /api/notifications/stream` with `fetch` and a Bearer header (not `EventSource`, which cannot send headers), reconnects with exponential backoff, and pauses while the tab is hidden; the bell, list and toasts live in `src/features/notifications/`. |
| Routes (frontend pages) | `src/routes/`: `/login`, `/set-password/:token`, `/onboarding-form`, `/onboarding-form/resubmit/:token`, and under `_app`: dashboard (`/`), cases (all / my-open / my-closed / work-queue / EP sub-merchants / `$caseId`), merchants (list / `$merchantId` with overview, form, history and limits tabs), user management, and configuration (agreements, case-flow-rules, email-sending, email-templates, limits-and-mdr, merchant-portal, payment-methods, payout-methods, queues, sub-merchants). |
| Deployment | Cloudflare Workers via Wrangler (`wrangler.jsonc`: name `onboarding-portal-assanpay`, compatibility date `2026-05-26`, `nodejs_compat`, main `@tanstack/react-start/server-entry`, `VITE_API_URL` set to `https://onboard.assanpay.net`, observability enabled). The backend README notes the frontend is hosted separately and its origin must be in the backend's `CORS_ORIGIN`. |

## Integrations

### Google Drive — see file 28 for the full detail

| Item | Detail |
|---|---|
| Auth | Service-account auth (client email + private key), scope `https://www.googleapis.com/auth/drive.file`. |
| Endpoints | REST endpoints `https://oauth2.googleapis.com/token`, `https://www.googleapis.com/drive/v3/files` and the multipart upload URL. |
| Parent folders | From `GOOGLE_DRIVE_PARENT_FOLDER_ID` (private) and `GOOGLE_DRIVE_PARENT_FOLDER_ID_PUBLIC` (public). |
| Library | No Google client library is used; calls are plain `fetch`. Drive is required by the production workflows (backend README). |

### Resend (email)

| Item | Detail |
|---|---|
| Client | `src/modules/email/email.client.ts`: `getResendClient()` builds a `Resend` client from `RESEND_API_KEY`, falling back to the literal string `re_placeholder` when the key is unset (so the client can be constructed without a key; sending then fails). |
| Sender | `EMAIL_FROM`, default `AssanPay Onboarding <onboarding@tech.assanpaybd.com>`; optional `EMAIL_REPLY_TO` (an email address or a domain, turned into `support@<domain>`); optional `EMAIL_TEST_TO`. |
| Templates | React components under `src/modules/email/templates/` (`_brand.tsx`, `agreement.tsx`, `document-resubmission.tsx`, `live-activation.tsx`, `mid-creation.tsx`, `user-password.tsx`), with a preview catalogue in `email-template-catalog.ts`. |
| Logging | Every send is logged in `email_log` with `resend_id`. Each send also carries an `email_log` ID tag (`EMAIL_LOG_ID_TAG`), which the webhook uses to find the row. Sends use a Resend idempotency key (see the Idempotency row above). |

### Resend webhooks

| Item | Detail |
|---|---|
| Endpoint | `POST /api/webhooks/resend`: public, but every request must carry a valid Svix signature for `RESEND_WEBHOOK_SECRET`, verified against the raw unparsed body (`webhooks.verify` with `svix-id` / `svix-timestamp` / `svix-signature`, or the `webhook-*` header names). |
| Without the secret | The endpoint returns 503 `"Resend webhooks are not configured."`. |
| Bad signature | Returns 400 `"Invalid webhook signature."`. |
| Unknown email | An event whose email is not in `email_log` returns 503 `"Email not found yet; retry later."`, so Resend retries it, but only while the event is less than 10 minutes old (`UNKNOWN_EMAIL_RETRY_WINDOW_MS` in `resend-webhook.service.ts`). Older unknown events are acknowledged with 200 `{ "received": true }` and ignored. |
| Thrown error | Returns 500 so Resend retries later. |
| Handled events | `email.sent` (sets `sent`), `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` and `email.suppressed` move `email_log.status` to the matching value. The event detail (bounce type and message, failure reason, suppression message) is stored in `email_log.status_detail`. Late or repeated events are handled by the ordering rules in `email-delivery-status.ts`. Other event types are ignored. |
| Event names | The `.env.example` lists the event names as sent, delivered, delivery_delayed, bounced, complained, failed, suppressed. |

### Environment variables that shape the APIs and integrations

Names and defaults from `backend/src/config/env.ts` (the backend validates them at startup with Zod). Values are never recorded here; `.env.example` lists the names.

| Variable | Default / rule | What it controls |
|---|---|---|
| `APP_PORT` | 3000 | Port the API listens on. |
| `ACCESS_TOKEN_TTL_MINUTES` | 15 | Access-token lifetime. |
| `REFRESH_TOKEN_TTL_DAYS` | 7 | Refresh-token lifetime. |
| `PUBLIC_SUBMISSION_LIMIT_PER_IP` | 3 | Created applications per IP in a rolling 24 hours. |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origins (comma-separated, with credentials). |
| `COOKIE_SECURE` | `true` when `NODE_ENV=production`, otherwise `false` | Refresh cookie `Secure` flag. |
| `COOKIE_SAME_SITE` | `lax` | Refresh cookie `SameSite`. `none` requires `COOKIE_SECURE=true`. |
| `COOKIE_DOMAIN` | unset | Refresh cookie domain. |
| `TRUST_PROXY_HEADERS` | `true` | Whether `CF-Connecting-IP` and `X-Forwarded-For` are read for the client IP. |
| `PUBLIC_APP_URL` | `http://localhost:5173` | Base URL for the links in emails: `/set-password/<token>` and `/onboarding-form/resubmit/<token>`. |
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | required / optional | Runtime (pooler) URL and direct URL for migrations. |
| `DATABASE_POOL_MAX` | 10 (max 100) | Connection pool size. |
| `DATABASE_CONNECT_TIMEOUT_SECONDS` / `DATABASE_IDLE_TIMEOUT_SECONDS` | 10 / 20 | Connect and idle timeouts. |
| `CASE_FLOW_WORKER_POLL_MS` | 1000 | Worker poll interval while busy. |
| `CASE_FLOW_WORKER_IDLE_POLL_MS` | 900000 (15 minutes) | Idle safety-net poll. |
| `CASE_FLOW_WORKER_BATCH_SIZE` | 5 (max 100) | Jobs claimed per cycle. |
| `CASE_FLOW_WORKER_RETRY_BASE_MS` / `_RETRY_MAX_MS` | 30000 / 900000 | Exponential retry backoff for transient failures. |
| `CASE_FLOW_WORKER_BLOCKED_RETRY_MS` | 21600000 (6 hours) | Slow retry for deterministic blockers. |
| `CASE_FLOW_WORKER_RETRY_JITTER_PERCENT` | 10 (max 50) | Random spread on retry times. |
| `CASE_FLOW_WORKER_DEGRADED_AFTER_ATTEMPTS` | 8 (max 20) | Attempts before a retrying job is marked degraded (it keeps retrying). |
| `PORTAL_PASSWORD_ENCRYPTION_KEY` | optional; base64 of 32 bytes | AES-256-GCM key for merchant portal password codes. Without it, codes cannot be generated or read. Rotating it makes unsent codes unreadable. |
| `PORTAL_API_CREDENTIALS_ENCRYPTION_KEY` | optional; base64 of 32 bytes | AES-256-GCM key for the portal API key and secret. Must differ from the password key. Rotating it makes stored credentials unreadable. |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_PARENT_FOLDER_ID`, `GOOGLE_DRIVE_PARENT_FOLDER_ID_PUBLIC` | optional | Drive service account and the private and public parent folders. |
| `RESEND_API_KEY` | optional (falls back to `re_placeholder`) | Resend client key. |
| `RESEND_WEBHOOK_SECRET` | optional | Svix signing secret for `POST /api/webhooks/resend`. Without it the endpoint returns 503. |
| `EMAIL_FROM` | `AssanPay Onboarding <onboarding@tech.assanpaybd.com>` | Sender address. |
| `EMAIL_REPLY_TO` | optional | Reply-to. An email address is used as is; a domain becomes `support@<domain>`. |
| `EMAIL_TEST_TO` | optional | When set, every email goes to this inbox instead of the real recipient, and CC and BCC are dropped (kept in the log metadata) (`email.service.ts`). |
| `RELEASE_SHA` | optional | Release tag for PlanetScale Insights query tags. |

### PostgreSQL / PlanetScale — see file 30

Runtime via PgBouncer (port 6432), migrations via the direct URL (port 5432); `DATABASE_POOL_MAX` default 10.

### Cloudflare

The frontend is deployed on Cloudflare Workers; production runs behind Cloudflare, which sets `CF-Connecting-IP`. When `TRUST_PROXY_HEADERS` is true (its default), the backend takes the client IP from `CF-Connecting-IP`, then the first `X-Forwarded-For` value, then the socket address (`src/lib/client-ip.ts`). Trusting `X-Forwarded-For` is the subject of file 32, gap 3. There is no other Cloudflare integration (no KV, R2 or queues) in the code reviewed.

### No other integrations were found in the code reviewed

No payment gateway, no SMS/WhatsApp API (WhatsApp is a manual channel — staff send the message themselves and upload a screenshot as proof), no CRM, no accounting system, no analytics. The merchant portal itself (login URL, API base URL) is configuration, not an integration — the portal's API key and secret are generated and stored by this portal (see file 30, `merchant_portal_api_credentials`), and the credentials email is sent by this portal through Resend.

> ⚠️ **Resend placeholder key:** the Resend client is built with the placeholder key `re_placeholder` when `RESEND_API_KEY` is unset, so a missing key only fails at send time — not at startup.

## What happens next — how a developer uses this file

A developer building a new screen should check the endpoint inventory first: if the endpoint already exists, use it; if it does not, the new work is a backend route plus a frontend function in `src/apis/` and a query hook. A developer adding a new outside service should follow the Drive/Resend pattern — the backend calls the service, the frontend never calls it directly, and every send or upload is logged (`email_log` / `storage_objects`) so failures can be traced.

## What to check — is this what you intended?

- [ ] **API docs:** the API docs under `backend/apis/` cover only some endpoints (auth, cases, configuration, health, merchants, notifications, queues, users — and cases/configuration only partly). There is no API document for dashboard at all. Should the docs be completed, or is the code the only reference you want to keep?
- [ ] **Direct calls:** should the frontend ever call Google Drive or Resend directly, or should all outside-service calls keep going through the backend (as today)?
- [ ] **WhatsApp:** WhatsApp is manual today — staff send the message and upload a screenshot. Do you want a real WhatsApp integration (API sending) instead, or is the manual proof enough?
- [ ] **Resend key:** the Resend client is built with the placeholder key `re_placeholder` when `RESEND_API_KEY` is unset, so a missing key only fails at send time. Should the backend refuse to start (or fail loudly at startup) when email is not configured?
- [ ] **Health / monitoring:** should there be a public status page or a richer health endpoint for monitoring, or is `GET /health/db` (database + case-flow worker) enough?
- [ ] **Sessions:** is the 15-minute access token / 7-day refresh token split right, and should staff be able to see or revoke their own active sessions anywhere in the UI? (Today revocation is by password change, deactivation, or sign-out-everywhere — there is no per-session list in the code reviewed.)

---
*Sources: `backend/src/index.ts` (mounts, limiters, body limit, cleanup, worker, shutdown), `backend/src/config/env.ts` (defaults), `backend/src/lib/client-ip.ts`, `backend/src/middleware/error-handler.ts`, `backend/src/modules/merchants/submission-attempts.service.ts`, `backend/src/modules/email/resend-webhook.routes.ts`, `backend/src/modules/email/resend-webhook.service.ts`, `backend/src/modules/email/email.client.ts`, `backend/src/modules/email/email.service.ts`, `backend/src/modules/cases/case-email-delivery.ts`, `backend/src/modules/users/users.routes.ts`, `backend/src/modules/users/users.service.ts` (`deactivateUser`), `backend/src/modules/configuration/configuration.routes.ts`, `backend/src/modules/notifications/notifications.routes.ts`, `backend/src/modules/queues/queues.routes.ts`, `backend/src/modules/dashboard/dashboard.routes.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/merchants/merchants.routes.ts` (`assertCanDeleteDriveFiles`), `backend/src/modules/merchants/form.routes.ts`, `backend/src/modules/merchants/public-resubmission.routes.ts`, `backend/src/lib/storage/file-limits.ts`, `backend/src/lib/storage/google-drive.ts`, `backend/.github/workflows/deploy.yml`, `backend/README.md`, `backend/.env.example` (names only), `backend/apis/` (file list), `frontend/src/lib/api-client.ts`, `frontend/src/features/notifications/notifications-sse.ts`, `frontend/src/config/client-env.ts`, `frontend/wrangler.jsonc`, `frontend/src/hooks/` (file list). Earlier list: `backend/src/index.ts`, `backend/src/modules/auth/auth.routes.ts`, `backend/src/modules/merchants/form.routes.ts`, `backend/src/modules/merchants/merchants.routes.ts`, `backend/src/modules/email/resend-webhook.routes.ts`, `backend/src/modules/email/email.client.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/case-email-delivery.ts`, `backend/src/modules/configuration/configuration.routes.ts`, `backend/src/modules/dashboard/dashboard.routes.ts`, `backend/src/config/env.ts`, `backend/src/lib/storage/google-drive.ts`, `frontend/src/lib/api-client.ts`, `frontend/src/features/notifications/notifications-sse.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/merchants/merchants.routes.ts`, `backend/src/modules/merchants/form.routes.ts`, `backend/src/modules/users/users.routes.ts`, `backend/src/modules/queues/queues.routes.ts`, `backend/src/modules/configuration/configuration.routes.ts`, `backend/src/modules/dashboard/dashboard.routes.ts`, `backend/src/modules/notifications/notifications.routes.ts`, `backend/src/modules/email/email.client.ts`, `backend/src/lib/storage/google-drive.ts`, `backend/apis/auth.md`, `backend/apis/cases.md`, `backend/apis/configuration.md`, `backend/apis/health.md`, `backend/apis/merchants.md`, `backend/apis/notifications.md`, `backend/apis/queues.md`, `backend/apis/users.md`, `frontend/src/apis/auth.ts`, `frontend/src/apis/cases.ts`, `frontend/src/apis/configuration.ts`, `frontend/src/apis/dashboard.ts`, `frontend/src/apis/ep-sub-merchants.ts`, `frontend/src/apis/merchant-onboarding.ts`, `frontend/src/apis/merchants.ts`, `frontend/src/apis/notifications.ts`, `frontend/src/apis/users.ts`, `frontend/src/config/client-env.ts`, `frontend/wrangler.jsonc`. Related files: 28 (Google Drive), 29 (security), 30 (database), 32 (known gaps).*
