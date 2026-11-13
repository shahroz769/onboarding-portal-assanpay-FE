# AssanPay Onboarding Portal — Spec Index

## At a glance

| | |
|---|---|
| **What this is** | A plain-English specification of the AssanPay Onboarding Portal as it exists in the code today — what each part is supposed to do, who can use it, how it works step by step, and how it is built. |
| **Who it is for** | The owner (Sufyan), so he can check each part against what the business intended. |
| **How it was written** | By reading the code, not by interviewing anyone and not by guessing. |
| **Scope** | 35 files, 00–34. Files 00–09 are Group A (foundations); files 10–32 are Groups B–D (dashboard, cases, configuration, email, storage, security, database, APIs, gaps); files 33–34 are complete inventories of every frontend and backend source file, each with the spec that owns it. |
| **Rule** | Where the code and the written docs disagree, the file says so. Where something could not be found in the code reviewed, the file says "Not found in the code reviewed" instead of inventing an answer. |

## Scope — the two repos

| Repo | What it is |
|---|---|
| **Frontend (FE)** | `Desktop\Onboarding Portal\onboarding-portal-assanpay-FE` — repo `onboarding-portal-assanpay-FE`. TanStack Start / React frontend. |
| **Backend (BE)** | `Desktop\Onboarding Portal\onboarding-portal-assanpay-BE` — repo `onboarding-portal-assanpay-BE`. Bun / Hono API with a PostgreSQL database (Drizzle). |

The specs live in the FE repo at `onboarding-portal-assanpay-FE/specs/`. Source paths in each file are written relative to their repo: `frontend/...` means the FE repo and `backend/...` means the BE repo.

## How to read these files

- Start here (file 00) for the map, then read file 01 for the big picture.
- Files 02–09 (Group A) cover the foundations: signing in, users and roles, the public merchant form, documents, resubmission, the merchants list and detail pages, limits and MDR, and termination/deletion.
- Files 10–34 (Groups B–D and the two inventories, written separately) cover the dashboard, cases and their workflows, configuration, email and notifications, storage, security, the database, APIs, and a final list of gaps and open questions.
- Every file uses the same improved format, in the same order:
  1. **At a glance** — a table: what it is, who can use it, where it lives, the main API/code, what success looks like.
  2. **How it works** — the journey as a simple flow diagram, then the steps.
  3. **Tables, not long paragraphs** — for fields, rules, errors, endpoints, and permissions.
  4. **Warnings** — called out with ⚠️ where something is risky, unfinished, or disagrees with the docs.
  5. **What to check** — intent questions for the owner (Sufyan), as checkboxes.
  6. **Sources** — the actual frontend/backend files the facts came from, at the bottom of each file.
- Route paths, endpoint method + path, status/enum values, file paths, and numbers are quoted from the code wherever they were found. If a number or rule is a default that can be changed by an environment variable or a configuration screen, the file says so.

## What each file contains — both sides

Every spec file is written for two readers at once, and both sides are in every file:

| Side | What it covers |
|---|---|
| **Technical** — for a developer | Routes, endpoints (method + path), request/response shapes, validation rules, database tables and fields, auth and roles, error codes, integrations (Google Drive, Resend, Cloudflare), and limits (rate limits, size caps, counts). Enough to implement from. |
| **Non-technical** — for the owner | Business purpose, who uses the feature and why, the user journey in plain words, the business rules, what success looks like, what happens next, and the intent-check questions at the end. Enough to understand how the feature works today without reading code. |

If a file ever reads as only-technical or only-plain-English, that is a gap in the spec, not the intent — both sides belong in every file.

## How the spec was grounded

The writer read, in both repos: `README.md`, `AGENTS.md` / `CLAUDE.md`, `package.json`, `.env.example`, the backend environment contract (`backend/src/config/env.ts`), the backend entry point (`backend/src/index.ts`), the Drizzle schema (`backend/src/db/schema.ts`) and migrations, the API docs under `backend/apis/*.md`, backend route/service/schema files under `backend/src/modules/`, frontend routes under `frontend/src/routes/`, frontend API clients under `frontend/src/apis/`, and the feature components under `frontend/src/features/`.

## All 35 spec files

| # | File | What it covers (one line) |
|---|---|---|
| 00 | `00-README-Index.md` | This index: scope, how to read the specs, and the full file list. |
| 01 | `01-Product-Overview-And-Architecture.md` | What the portal is, who it is for, and how the frontend, backend, database, Drive, and email fit together. |
| 02 | `02-Authentication-And-Sessions.md` | Employee sign-in, access/refresh tokens, "trust this device", password links, sign-out, and lockouts. |
| 03 | `03-User-Management-And-Roles.md` | The three roles, creating/editing/deactivating employees, queue access, and password-reset emails. |
| 04 | `04-Public-Merchant-Onboarding-Form.md` | The public form a merchant fills in to apply, field by field, and what happens on submit. |
| 05 | `05-Document-Requirements-And-Uploads.md` | Which documents each business type must upload, and the file size, type, and content checks. |
| 06 | `06-Resubmission-Flow.md` | How a merchant fixes rejected fields through a one-use email link, and what happens after they submit. |
| 07 | `07-Merchants-List-And-Detail.md` | The staff merchants list (search, filters, sorting) and the merchant detail page with its four tabs. |
| 08 | `08-Merchant-Limits-And-MDR.md` | Global limits and commission rates, and per-merchant overrides of those limits and rates. |
| 09 | `09-Merchant-Termination-And-Deletion.md` | Terminating a merchant, deleting its Drive files, hiding it (soft delete), and permanently deleting it. |
| 10 | `10-Dashboard.md` | The staff dashboard: figures, charts, workload, and what each number is supposed to mean. |
| 11 | `11-Cases-List-And-Queue-Access.md` | The cases lists, who can see or work which queue, and how cases are filtered and sorted. |
| 12 | `12-Case-Detail-And-Case-Lifecycle.md` | The case detail page and the case lifecycle: new, working, awaiting the merchant, closed. |
| 13 | `13-Document-Review-Workflow.md` | How staff review each submitted field and document, approve or reject it, and ask for fixes. |
| 14 | `14-Sub-Merchant-Form-Workflow.md` | The sub-merchant form step inside a case: sending it, filling it in, and checking it. |
| 15 | `15-Agreement-Workflow.md` | The agreement step: drafting, sending, receiving the signed agreement, and its rounds. |
| 16 | `16-MID-Creation-Workflow.md` | Creating the merchant ID (MID) and the portal credentials that go with it. |
| 17 | `17-Testing-Workflow.md` | The testing step that moves a merchant from pending to testing, and its limits. |
| 18 | `18-WordPress-Website-Workflow.md` | The WordPress website step and how it connects to the merchant going live. |
| 19 | `19-Live-Activation-Workflow.md` | Taking a merchant live, and what "live" changes for the merchant and its cases. |
| 20 | `20-EP-Sub-Merchants.md` | EP sub-merchants: what they are, how they are triggered, and how their cases are tracked. |
| 21 | `21-Case-Flow-Engine-And-Builder.md` | The case-flow engine that creates follow-up cases automatically, and the visual builder staff use to change it. |
| 22 | `22-Case-Comments-Chatter-And-History.md` | Case comments/chatter, mentions, and the case history timeline. |
| 23 | `23-Email-System-And-Templates.md` | How email is sent (Resend), the templates, delivery tracking, and manual sending. |
| 24 | `24-Notifications-And-Realtime.md` | In-app notifications, the notification bell, and live updates (SSE). |
| 25 | `25-Configuration-Limits-Methods-And-Portal.md` | Configuration screens for limits/MDR, payment and payout methods, and the merchant portal. |
| 26 | `26-Configuration-Agreements-And-Sub-Merchants.md` | Configuration screens for agreement drafts and sub-merchant forms. |
| 27 | `27-Queues-And-SLA.md` | Queues, their stages, and the SLA (time limit) rules and breach handling. |
| 28 | `28-File-Storage-Google-Drive.md` | Google Drive storage: folder structure, the ownership ledger, uploads, and cleanup. |
| 29 | `29-Security-Rate-Limiting-And-Validation.md` | Security rules across the system: rate limits, CORS, cookies, CSRF, and input validation. |
| 30 | `30-Database-Schema-And-Data-Model.md` | The database tables, their fields, and how they link to each other. |
| 31 | `31-APIs-And-Integrations.md` | The full API surface and the outside services the portal talks to. |
| 32 | `32-Known-Gaps-Open-Findings-And-Intent-Checks.md` | Everything found that looks unfinished, unclear, or contradictory, plus the questions only the owner can answer. |
| 33 | `33-Frontend-Complete-Inventory.md` | Every frontend route, guard, redirect, feature folder, shared component, hook, helper, schema and config file, and the spec that owns each. |
| 34 | `34-Backend-Complete-Inventory.md` | Every backend module, middleware, database file, migration and seed, shared library, storage layer and script, and the spec that owns each. |

## Status values used across the specs

Two short lists appear again and again, so they are recorded here once:

| List | Values |
|---|---|
| **Merchant status** (`merchant_status` in the database) | `pending`, `testing`, `live`, `terminated`. A merchant starts at `pending`, moves to `testing` when its Testing case closes successfully, moves to `live` only from `testing`, and can be terminated from `pending`, `testing`, or `live`. Terminated is final. |
| **Employee role** (`role_type` in the database) | `super_admin`, `admin`, `agent`. There is exactly one super admin, enforced by a database unique index. |

## Read-only with respect to code

The specs describe the code; they do not change it. Writing or updating a spec file must not edit FE or BE source. Where a spec disagrees with the code, the spec records the disagreement in file 32 rather than changing the code.

---
*Sources: frontend repo `onboarding-portal-assanpay-FE` (`README.md`, `AGENTS.md`, `package.json`, `src/routes/`, `src/apis/`, `src/features/`), backend repo `onboarding-portal-assanpay-BE` (`README.md`, `package.json`, `.env.example`, `src/config/env.ts`, `src/index.ts`, `src/db/schema.ts`, `drizzle/` migrations, `apis/*.md`, `src/modules/`).*
