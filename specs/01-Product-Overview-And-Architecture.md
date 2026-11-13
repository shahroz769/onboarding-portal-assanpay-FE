# 01 — Product Overview and Architecture

## At a glance

| | |
|---|---|
| **What it is** | The internal system AssanPay staff use to take a new merchant from a public application form all the way to a live, trading merchant — and to manage that merchant afterwards. |
| **Who can use it** | Merchants (public, no login) and AssanPay employees (login required). They never use the same part of the system. |
| **Where it lives** | Public form at `/onboarding-form` · Staff app under `/_app` (Dashboard `/`, Merchants `/merchants`, Cases `/cases`, User Management, Configuration) |
| **Main code** | Frontend: `onboarding-portal-assanpay-FE` (TanStack Start / React 19) · Backend: `onboarding-portal-assanpay-BE` (Bun / Hono, PostgreSQL via Drizzle) |
| **Outside services** | Google Drive (document storage) · Resend (email) · Cloudflare (frontend hosting) · PlanetScale Postgres in production |
| **Success looks like** | A merchant applies, staff work it through the case queues, and it ends up `live` — with every step, document, email, and conversation tracked in one place. |

## How it works — the journey

```
Merchant opens /onboarding-form and applies
        ↓
Backend creates merchant (status: pending) + first case (Documents Review)
        ↓
Staff work the case through its queue — each queue is one step of the journey
        ↓
Rejected fields go back to the merchant by email link (resubmission)
        ↓
Testing case closes → merchant becomes testing
        ↓
Live case closes → merchant becomes live
        ↓
Staff manage the live merchant from its detail page (limits, MDR, priority, history)
```

This file is the map. The detail for each part lives in its own spec file (see `00-README-Index.md`).

## Who can use it

| User | How they get in | What they use |
|---|---|---|
| **Merchants (the public, no login)** | Anyone on the internet | Public onboarding form at `/onboarding-form`; a one-use resubmission link at `/onboarding-form/resubmit/:token` if asked to fix fields. Merchants never get a staff login. |
| **AssanPay employees (login required)** | Sign in at `/login` | App shell under `/_app`: Dashboard (`/`), Merchants (`/merchants`), Cases (`/cases`), User Management (`/user-management`, super admin and admin only), Configuration (`/configuration`, super admin and admin only). |

Employees have one of three roles — `super_admin`, `admin`, `agent` — and what they can see and do depends on that role and, for agents, on which queues they have been given access to. See files 02 and 03.

The merchant's own payment portal (where a live merchant logs in to AssanPay) is a separate system. This portal only stores that portal's login URL and, temporarily, its credentials — see files 16 and 25. It does not host the merchant portal itself.

## The journey, step by step

| Step | What happens | See file |
|---|---|---|
| 1. Apply | Merchant opens `/onboarding-form`, fills in seven sections (submitter, business, classification, financial, owner, next of kin, documents) and submits. | 04 |
| 2. Created | Backend checks the form, uploads documents to Google Drive, creates a merchant record with status `pending`, and creates the first case (Documents Review) automatically. | 04, 05, 13, 21 |
| 3. Worked | Staff work the case through its queue. Each queue is one step: Documents Review, Sub-Merchant Form, Agreement, MID Creation, Testing, WordPress Website, Live, and others. Closing one case successfully can automatically create the next case. | 11–21 |
| 4. Fix | If a document or field is rejected, the merchant gets a resubmission link by email and fixes only the rejected fields. | 06 |
| 5. Testing → Live | When the Testing case closes successfully the merchant becomes `testing`; when the Live case closes successfully the merchant becomes `live`. | 17, 19 |
| 6. Manage | After that, staff manage the live merchant from its detail page: its limits and commission rates (MDR), its priority, its history, and — if needed — termination and deletion. | 07, 08, 09 |
| 7. Throughout | The portal sends emails (via Resend), shows in-app notifications, and keeps a history timeline on every case and merchant. | 22, 23, 24 |

## How it is implemented — Frontend

| Piece | Detail |
|---|---|
| **Repo and stack** | `onboarding-portal-assanpay-FE`, package name `onboarding-portal-assanpay-fe`. TanStack Start / React 19, TanStack Router (file-based routes), TanStack Query, TanStack Form, Tailwind CSS v4, shadcn/ui components built on Base UI, Zod for validation. Package manager is Bun 1.4.4. Linting/formatting: oxlint and oxfmt. See `frontend/package.json` and `frontend/AGENTS.md`. |
| **Running it** | `bun install --frozen-lockfile`, then `bun run dev` serves on `http://localhost:5173`. Production is deployed to Cloudflare with Wrangler (`bun run deploy` — only when explicitly authorised). See `frontend/README.md` and `frontend/wrangler.jsonc`. |
| **Routes** | All routes live in `frontend/src/routes/`. Public: `/login`, `/set-password/:token`, `/onboarding-form`, `/onboarding-form/resubmit/:token`. Signed-in app shell: `/_app` (layout in `frontend/src/routes/_app.tsx`), with `/` (dashboard), `/merchants`, `/merchants/$merchantId` (overview / form / limits / history tabs), `/cases` (all-cases, work-queue-cases, my-open-cases, my-closed-cases, ep-sub-merchants, `$caseId`), `/user-management`, and `/configuration/*` (limits-and-mdr, payment-methods, payout-methods, agreements, sub-merchants, merchant-portal, queues, case-flow-rules, email-templates, email-sending). The route tree is generated in `frontend/src/routeTree.gen.ts`; the router is created in `frontend/src/router.tsx`. |
| **Talking to the backend** | All API calls go through an Axios client in `frontend/src/lib/api-client.ts` (`withCredentials: true`, so the refresh cookie is sent; a `Bearer` access token is attached from memory; a 401 triggers one refresh and a retry). Per-area API functions live in `frontend/src/apis/` (`auth.ts`, `users.ts`, `merchants.ts`, `merchant-onboarding.ts`, `cases.ts`, `configuration.ts`, `dashboard.ts`, `notifications.ts`, `ep-sub-merchants.ts`). The API base URL comes from `VITE_API_URL`, defaulting in development to `http://localhost:3000` and in production to `https://onboard.assanpay.net` (`frontend/src/config/client-env.ts`). |
| **Navigation and permissions in the UI** | The sidebar menu is defined in `frontend/src/config/navigation.ts` and filtered by role (`getFilteredNavItems`): User Management and Configuration are hidden unless the role is `super_admin` or `admin`; Work Queue Cases needs `agent` or `super_admin` plus work access; EP Sub-Merchants needs EP access. Route guards live in `frontend/src/features/auth/route-guards.ts` (`requireAuthSession`, `redirectAuthenticatedUser`, `requireAllowedRoles`). |
| **State and data** | TanStack Query caches server data; forms use TanStack Form with Zod schemas in `frontend/src/schemas/`. Feature code is grouped under `frontend/src/features/` (`auth`, `cases`, `configuration`, `dashboard`, `ep-sub-merchants`, `merchants`, `notifications`, `onboarding`, `users`). |

## How it is implemented — Backend

| Piece | Detail |
|---|---|
| **Repo and stack** | `onboarding-portal-assanpay-BE`, package name `onboarding-portal-assanpay-BE`. Bun 1.3.14+ with Hono, strict TypeScript, Drizzle ORM, PostgreSQL, Zod. See `backend/package.json` and `backend/README.md`. |
| **Running it** | `bun install --frozen-lockfile`, then `bun run dev` (`bun run --hot src/index.ts`) serves on `http://localhost:3000` by default (`APP_PORT`, default 3000). Typecheck with `bun run typecheck`; migrations with `bun run db:migrate`. See `backend/README.md`. |
| **Entry point** | `backend/src/index.ts` builds the Hono app: request IDs, secure headers, CORS (origins from `CORS_ORIGIN`, credentials allowed, `Idempotency-Key` header allowed), a public rate limiter (60 requests per 15 minutes per IP on `/api/public/*`), a 225 MB body limit on the public multipart routes, error handling, `GET /` (returns `{ name: "Onboarding Portal API", status: "ok" }`), and `GET /health/db` (database + case-flow worker health). It also runs two background jobs: a case-flow worker that drains follow-up case-creation jobs, and a cleanup that purges expired refresh tokens and old submission attempts every 6 hours, plus a merchant-request recovery job every 5 minutes. |
| **Route mounting** | `backend/src/index.ts` mounts: `/api/auth` (auth), `/api/public` (public merchant form), `/api/public/resubmission` (resubmission), `/api/merchants`, `/api/users`, `/api/queues`, `/api/cases`, `/api/configuration`, `/api/dashboard`, `/api/notifications`, `/api/webhooks/resend`. |
| **Modules** | Code is organised by area under `backend/src/modules/`: `auth`, `cases`, `configuration`, `dashboard`, `email`, `merchants`, `notifications`, `queues`, `users`. Shared code lives in `backend/src/lib/` (auth, security, validators, storage), `backend/src/middleware/` (authentication, roles, error handler), `backend/src/config/env.ts` (validated environment contract), and `backend/src/db/` (schema, client, migrations). |
| **Database** | PostgreSQL (PlanetScale Postgres in production; Neon is mentioned for development in `backend/README.md`). Drizzle schema in `backend/src/db/schema.ts` (about 1,951 lines); forward-only migrations under `backend/drizzle/` (122 migration files at the time of writing, `0000_…` to `0116_…`). Migrations must stay compatible with the previous app version until the new version passes its health check. Pushes to `main` run a frozen install and typecheck, migrate via `DIRECT_DATABASE_URL`, restart PM2, and poll `/health/db`; a failed deployment restores the previous checkout. |
| **Outside services** | Google Drive (document storage — files are stored in Drive; the database keeps only Drive file IDs, links, and metadata), Resend (email sending and delivery webhooks), Cloudflare (the frontend is hosted there; the backend trusts proxy headers by default — `TRUST_PROXY_HEADERS`, default `true` — because production runs behind Cloudflare, which sets `CF-Connecting-IP`). |
| **Configuration** | Environment variables are validated in `backend/src/config/env.ts` and documented in `backend/.env.example`. Key ones: `DATABASE_URL` / `DIRECT_DATABASE_URL` (pooled vs direct; PlanetScale uses the PgBouncer URL on port 6432 for runtime and port 5432 only for migrations), `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (distinct random values of at least 32 characters), `ACCESS_TOKEN_TTL_MINUTES` (default 15), `REFRESH_TOKEN_TTL_DAYS` (default 7), `PUBLIC_SUBMISSION_LIMIT_PER_IP` (default 3), `COOKIE_DOMAIN` / `COOKIE_SECURE` / `COOKIE_SAME_SITE`, `CORS_ORIGIN`, `PUBLIC_APP_URL` (default `http://localhost:5173`), Google Drive variables, Resend variables, and `EMAIL_FROM` (default `AssanPay Onboarding <onboarding@tech.assanpaybd.com>`). Backend credentials must never be exposed to the frontend. |

## Data, validation and edge cases

- **One source of truth for status.** Merchant status is a database enum (`merchant_status`: `pending`, `testing`, `live`, `terminated`) and every status change goes through one function, `writeMerchantState()` in `backend/src/modules/merchants/merchant-state-machine.ts`, with database triggers from migration `0103_merchant_state_guard` enforcing the same rules for any other writer. A merchant only moves forward; it goes live only from `testing`; terminated is final and a terminated merchant gets no new cases.
- **Case flow is data, not hard-coded.** Which queue follows which is stored in configuration tables (`case_flow_*`) and driven by a background worker, so the journey can be changed without a code deploy. See file 21.
- **Everything is keyed and audited.** Public submissions are logged per IP in `public_submission_attempts` (kept 60 days); cases have a history timeline; resubmission and password links are stored only as hashes and are single-use.

> ⚠️ **Known disagreement between docs and code.** `backend/apis/auth.md` says login is limited to 15 failed attempts per IP per 15 minutes and 10 per account per 15 minutes. The code in `backend/src/modules/auth/login-guard.ts` uses fixed one-hour windows with different budgets (5 per trusted device, 5 per account + IP, 15 per account). See file 02.

> ⚠️ **Test database note.** Both repos' `AGENTS.md`/`CLAUDE.md` say the current database is a test database that may be used for read/write tests. Production (`main` branch) is read-only for agents; changes go through deploy only.

## What to check — is this what you intended?

- [ ] Is the journey above the journey you want — in particular, is Documents Review always the first step, and is the order of the later steps (sub-merchant form, agreement, MID, testing, website, live) fixed or does it vary by merchant?
- [ ] The merchant's own payment portal is treated here as a separate system. Is that right, and should this portal ever let a merchant log in directly, or should merchants always stay on public links with no account?
- [ ] Are there any other systems the portal should talk to (accounting, CRM, a payment gateway, WhatsApp) that are not in the code today?
- [ ] The production API is `https://onboard.assanpay.net` (frontend default). Is that the live address staff and merchants should be using, and is there a separate staging environment?

---
*Sources: `frontend/package.json`, `frontend/AGENTS.md`, `frontend/README.md`, `frontend/wrangler.jsonc`, `frontend/src/routes/`, `frontend/src/routeTree.gen.ts`, `frontend/src/router.tsx`, `frontend/src/lib/api-client.ts`, `frontend/src/apis/`, `frontend/src/config/client-env.ts`, `frontend/src/config/navigation.ts`, `frontend/src/features/auth/route-guards.ts`, `backend/package.json`, `backend/README.md`, `backend/.env.example`, `backend/src/index.ts`, `backend/src/config/env.ts`, `backend/src/db/schema.ts`, `backend/drizzle/`, `backend/src/modules/merchants/merchant-state-machine.ts`, `backend/apis/auth.md`, `backend/src/modules/auth/login-guard.ts`. Related files: 00 (index), 02 (auth), 03 (users), 04 (public form), 21 (case-flow engine).*
