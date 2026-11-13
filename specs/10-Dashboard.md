# 10 — Dashboard

## At a glance

| | |
|---|---|
| **What it is** | The first screen an employee sees after signing in. At a glance: how many cases and merchants are in the pipeline, how many are stuck or over their time limit, who is carrying how much work, which merchant IDs (MIDs) still need limits applied, and which signed agreements are still waiting to arrive as a physical copy at the office. |
| **Who can use it** | Every signed-in employee can open it. The overview counts all cases/merchants for everyone; only the workload panel limits what an agent sees. Applying portal MID limits is super admin / admin only. |
| **Where it lives** | `/` (the app's home page) — first in the sidebar, no role restriction. |
| **What it creates** | Nothing. It is a read-only overview plus two small working lists (pending MIDs and awaiting physical agreements). It does not create cases, edit merchants, or change any case by itself — every number on it links through to the list or case where the work actually happens. |
| **Main APIs** | `GET /api/dashboard` · `GET /api/dashboard/workload` · `GET /api/dashboard/portal-mids/pending` · `GET /api/dashboard/portal-mids/applied` · `GET /api/dashboard/agreements/awaiting-physical` · `POST /api/dashboard/portal-mids/apply-limits` |
| **Main code** | Frontend: `src/routes/_app.index.tsx`, `src/features/dashboard/dashboard.tsx` · Backend: `src/modules/dashboard/dashboard.routes.ts`, `dashboard.service.ts` (889 lines), `dashboard-workload.service.ts`, `dashboard.schemas.ts` |
| **Success looks like** | An employee lands on `/`, sees the pipeline at a glance for the chosen date range, and can jump straight to the cases, MIDs, or agreements that need work. |

## How it works — the journey

```
Employee signs in → lands on /
        ↓
Overview loads for a date range (default last 30 days, range=30d)
        ↓
Case cards + merchant cards (status totals and SLA figures are all-time; only the "in range" counts follow the range) · trend charts (one point per day)
        ↓
Workload (right now, not limited to the range): open cases per queue and per owner
        ↓
Portal MIDs panel: MIDs still needing limits applied (admins can apply them)
        ↓
Awaiting physical agreements panel: sent agreements whose signed paper copy has not arrived
```

## The date range

- A filter bar at the top lets the employee change the range. The choices in the code are `today`, `7d`, `30d`, `90d`, `mtd` (month to date) and `custom` (a from/to date pair). A custom range must span fewer than 120 days (exactly 120 is refused), and its start date must be on or before its end date (`backend/src/modules/dashboard/dashboard.schemas.ts`, `MAX_DASHBOARD_RANGE_DAYS = 120`).
- While a new range loads, the previous numbers stay visible but dimmed, so the page never flashes empty (`frontend/src/features/dashboard/dashboard.tsx` — `keepPreviousData`, `opacity-60` while placeholder data is shown). A refresh button re-loads the data, and a failed load shows "Couldn't load the dashboard." with a Retry button.
- All dashboard dates are computed in the Asia/Karachi time zone (`DASHBOARD_TIME_ZONE = 'Asia/Karachi'` in `backend/src/modules/dashboard/dashboard.service.ts`), not in the viewer's browser time zone.

## What the page shows

| Panel | What it shows |
|---|---|
| **Case cards** | Not limited to the range: total cases, open cases, the split by status (`new`, `working`, `awaiting_merchant`, `closed`) and the three SLA numbers (see below) are **all-time** snapshots. The only case figures that follow the range are `newInRange` (created in range) and `closedInRange` (closed in range). The frontend labels are "New", "Working", "Awaiting merchant", "Closed", "SLA breaches" and "SLA breach rate" (`frontend/src/features/dashboard/dashboard-kpi-cards.tsx`). The breach rate shown is `slaBreached / slaEvaluated × 100`. |
| **Merchant cards** | Not limited to the range: total merchants and the split by merchant status (`pending`, `testing`, `live`, `terminated`) are all-time snapshots. Soft-deleted merchants are excluded from these merchant counts (`liveMerchant` filter in `getDashboard()`), but their cases still count in the case cards. The range-bound figures are `submittedInRange` and `liveInRange`. The "Live rate" is `live ÷ total × 100`. The frontend labels are "Total merchants", "Live", "Testing", "In process" and "Terminated". "In process" is a display label for the `pending` count; clicking it opens `/merchants` filtered to `status=pending`. The code reviewed does not define a merchant status called `in process`. Confirm with the owner whether that wording is intended. |
| **Trend charts** | Loaded lazily (`load-dashboard-charts.ts`), so the page does not wait for them. One point per day across the selected range for three series: submissions (`submissions`, merchants by `submittedAt`), case flow (`caseFlow`: cases opened by `createdAt` as `new`, and cases closed by `closedAt` as `closed`), and merchants going live (`merchantsLive`, by `liveAt`). Days are bucketed in Asia/Karachi. |
| **Workload** | Open cases per queue and per owner, right now (not limited to the date range): counts of `new`, `working` and `awaiting_merchant` cases for each (queue, owner) pair, including the unassigned pool. The frontend folds these cells into a queue view and a team view (`frontend/src/features/dashboard/dashboard-workload.tsx`). |
| **Portal MIDs panel** | Lists MIDs that still need limits applied, grouped as `internal`, `custom_wordpress` and `shopify`, with a copy-all action and an "apply limits" action (admins only). A separate dialog shows MIDs whose limits have already been applied. A MID is pending when it comes from its merchant's latest successful MID Creation case (queue slug `merchant-id`, case closed `successful`), the merchant is not soft-deleted, and the MID is not yet in `portal_mid_limit_applications`. Group: `internal` for internal MIDs; `shopify` when the merchant's website CMS is Shopify; otherwise `custom_wordpress`. An internal MID equal to the portal MID is skipped. |
| **Awaiting physical agreements panel** | Lists agreements that were sent to the merchant and whose signed physical copy has not yet been received by the office. Selection: queue workflow type `agreement`, case status `awaiting_merchant`, agreement email status `sent` (bounced emails excluded), no received agreement file, and the merchant not soft-deleted. Oldest sent first. This is the same information the Agreement workflow tracks when the office scans the received copy (see file 15). |

### SLA — what the numbers mean

- Every queue has an `slaHours` value (default 24 hours, stored on the `queues` table). A case is counted as breached when the time it was evaluated is later than `createdAt + slaHours` (`backend/src/modules/cases/case-sla.ts`, `isCaseSlaBreached`; default 24 hours when no positive value is set). The dashboard does not call this helper: `openOverSla` is raw SQL using `queues.slaHours` directly (not null, default 24, positive-only check in `backend/src/db/schema.ts`), and `slaBreached` counts the stored flag.
- The dashboard reports three SLA figures:

| Figure | Meaning |
|---|---|
| `slaBreached` | Cases in any status (open or closed) whose stored `slaBreached` flag is true. |
| `slaEvaluated` | Cases in any status whose stored `slaBreached` flag is not null. |
| `openOverSla` | Open cases whose created time plus the queue's SLA hours has already passed. |

The breach rate is `slaBreached / slaEvaluated`, so it is not a share of all cases. `openOverSla` is computed live against "now" and the queue's `slaHours`.

## Who can use it — permissions

| Endpoint / action | Who |
|---|---|
| Open the Dashboard (`/`, `frontend/src/routes/_app.index.tsx`, first in the sidebar in `frontend/src/config/navigation.ts`, "Dashboard", no role restriction) | Every signed-in employee. |
| Main overview endpoint `GET /api/dashboard` | All authenticated users (`backend/src/modules/dashboard/dashboard.routes.ts` — `requireAuth` only, no role check). |
| Workload view `GET /api/dashboard/workload` | All authenticated users, but what an agent sees is limited: agents only see queues they can view, and only their own cases plus the unassigned pool (`backend/src/modules/dashboard/dashboard-workload.service.ts`). |
| Applying portal MID limits `POST /api/dashboard/portal-mids/apply-limits` | `super_admin` or `admin` only (`requireRoles('super_admin', 'admin')` in the same routes file). |
| Pending-MID and awaiting-agreement lists | No role restriction in the routes file. Whether an agent should see another queue's MIDs is not decided by a role check in the code reviewed — see the questions at the end. |

> ⚠️ **Inconsistent scoping:** the overview deliberately does **not** scope cases by the viewer's queue access: `getDashboard()` counts across all cases and merchants. Only the workload endpoint applies the agent's queue visibility. That is a real difference in behaviour between the two panels on the same page. Merchant counts also exclude soft-deleted merchants, while case counts do not check the merchant's deletion status.

## How it is implemented — Frontend

- Route: `frontend/src/routes/_app.index.tsx` renders `frontend/src/features/dashboard/dashboard.tsx` (`Dashboard` component).
- Data fetching: `frontend/src/apis/dashboard.ts` — `fetchDashboard(params)`, `fetchCaseWorkload()`, `fetchPendingPortalMids()`, `fetchPendingPortalMidValues(group?)`, `fetchAppliedPortalMids()`, `fetchAwaitingPhysicalAgreements()` and `applyPortalMidLimits(input)`. All go through `apiClient` and are validated against Zod schemas in `frontend/src/schemas/dashboard.schema.ts`.
- Components in `frontend/src/features/dashboard/`:

| File | What it does |
|---|---|
| `dashboard-filter-bar.tsx` | Range picker and refresh. |
| `dashboard-kpi-cards.tsx` | The Cases and Merchants card sections. |
| `dashboard-charts.tsx` | Daily trend charts, loaded lazily via `load-dashboard-charts.ts` inside a `Suspense` boundary. |
| `dashboard-workload.tsx` (+ `dashboard-workload-chart.tsx`, `dashboard-workload-utils.ts`) | The per-queue / per-person workload view. |
| `dashboard-portal-mids.tsx` | Pending and applied MIDs. |
| `dashboard-awaiting-agreements.tsx` | Physical agreements still awaited. |
| `dashboard-header-stat.tsx`, `dashboard-utils.ts`, `dashboard-skeleton.tsx` | Supporting pieces. |

- The filter bar is rendered into the page header through a React portal (`usePageHeaderActions` in `dashboard.tsx`).

## How it is implemented — Backend

- Module: `backend/src/modules/dashboard/` — `dashboard.routes.ts`, `dashboard.service.ts` (889 lines), `dashboard-workload.service.ts`, `dashboard.schemas.ts`. Mounted under `/api/dashboard` (see `backend/src/index.ts` for the mount; the route prefix in the routes file is `/api/dashboard`).

| Endpoint | What it returns / does |
|---|---|
| `GET /api/dashboard?range=today\|7d\|30d\|90d\|mtd\|custom&from=YYYY-MM-DD&to=YYYY-MM-DD` | `getDashboard()` returns `{ range: { key, from, to, label }, cases: {...}, merchants: {...}, trends: { submissions, caseFlow, merchantsLive } }`. The `cases` object contains `total`, `open`, `new`, `working`, `closed`, `awaitingMerchant`, `newInRange`, `closedInRange`, `slaBreached`, `slaEvaluated`, `openOverSla` and `statusDistribution`. The `merchants` object contains `total`, `pending`, `testing`, `live`, `terminated`, `submittedInRange`, `liveInRange` and `funnel`. |
| `GET /api/dashboard/workload` | `getCaseWorkload()` returns `{ queues, members, cells }`, where each cell is one (queue, owner) pair with `new`, `working` and `awaitingMerchant` counts. Open means status is not `closed`. Inactive queues are included only while they still hold open cases. |
| `GET /api/dashboard/portal-mids/pending?cursor&limit` (limit 1–100, default 30) | Paged MIDs awaiting limits, sorted by MID number then row key (keyset cursor). Response `{ data: [{ merchantId, merchantName, subMerchantName, caseId, caseNumber, portalMid, midKind, group, savedAt }], nextCursor, hasMore, limit, counts }`. `counts` (`{ total, internal, customWordpress, shopify }`) is computed on the first page only; later pages omit it. |
| `GET /api/dashboard/portal-mids/pending/mids?group=internal\|custom_wordpress\|shopify` | Every pending MID value (used for copy), optionally filtered to one group. Response `{ mids: number[], csv: string }`, distinct and sorted. No pagination. |
| `GET /api/dashboard/portal-mids/applied` | Every applied MID, by category. Response `{ customWordpress, shopify, internal, csv }`; any category value other than `shopify` or `internal` is listed under `customWordpress`. No pagination. |
| `GET /api/dashboard/agreements/awaiting-physical?cursor&limit` (limit 1–100, default 30) | Sent agreements whose signed physical copy has not been received. Response `{ data: [{ caseId, caseNumber, merchantId, merchantName, emailRecipient, ownerName, emailSentAt }], nextCursor, hasMore, limit, total }`; `total` is on the first page only. |
| `POST /api/dashboard/portal-mids/apply-limits` | Body `{ portalMids: [positive integers], category: 'custom_wordpress' \| 'shopify' \| 'internal' }`, 1–500 MIDs per call, `super_admin`/`admin` only. The body is strict (unknown keys are rejected). Nothing checks that a MID exists or is pending: any positive integer is written, and a MID that is not pending is inserted with `merchantId` null (see file 32, finding M8). Writes rows to `portal_mid_limit_applications` (`portalMid` is unique, so a MID can only be applied once) and records `appliedBy`/`appliedAt` on newly inserted rows only. An already-applied MID keeps its original `appliedBy`/`appliedAt` and only its `category` is overwritten. |

## Data, validation and edge cases

- **Date ranges:** `range` defaults to `30d`. Windows include today: `today` starts at the start of today; `7d` is today plus the 6 days before; `30d` is today plus the 29 days before; `90d` is today plus the 89 days before; `mtd` starts on the 1st of the month. `custom` requires both `from` and `to`; `from` must be ≤ `to`; `to` minus `from` must be under 120 days (`dashboard.schemas.ts`). Trend charts draw one point per day, capped at 120 days (`dashboard.service.ts`).
- **Time zone:** all range boundaries are computed in Asia/Karachi (`+05:00`), not in the viewer's browser time zone.
- **SLA figures:** `slaBreached` counts cases whose stored flag is true, in any status; `slaEvaluated` counts cases whose flag is not null; the breach rate is `slaBreached / slaEvaluated`, so it is not a share of all cases. `openOverSla` is computed live against "now" and the queue's `slaHours`.
- **Workload visibility:** an agent with `viewScope = 'selected'` (from `getAgentQueueAccess()`) and no view queues gets `{ queues: [], members: [], cells: [] }`. Agents see only their own cases plus unassigned ones; admins and super admins see everyone. For admins and super admins, the team list includes agents who can work at least one queue even if they own nothing, plus anyone who owns open cases. An agent's team list contains only that agent (`getCaseWorkload()` filters members to the agent's own id).
- **Portal MIDs:** applying limits is safe to repeat for the same MID. `applyPortalMidLimits()` (`backend/src/modules/dashboard/dashboard.service.ts`) first looks up which requested MIDs are already in `portal_mid_limit_applications`: those come back in `alreadyApplied` and have their `category` updated to the new one — they are **not** rejected. Only MIDs not yet applied are inserted (with `onConflictDoNothing()`), and the call returns `{ applied, alreadyApplied, notFound }`. The pending list's first page carries the counts; the "copy all" action fetches every pending MID through the separate `/mids` endpoint.
- **Terminated merchants' MIDs stay pending.** The pending-MID query excludes only soft-deleted merchants (`merchants.deletedAt is null`), not terminated ones. A terminated merchant that had a successful MID Creation case therefore still appears in the pending list and the copy-all list until someone applies its MIDs. Termination itself is in file 09.
- **Empty states:** the page shows a skeleton while loading and an error state with Retry on failure; the charts area has its own skeleton while the lazy chart bundle loads.

> ⚠️ **Not found in the code reviewed:** any per-queue or per-owner breakdown on the main KPI cards (they are totals only); any export/download action for the dashboard; any caching headers or refresh interval for the overview.

## What happens next — in plain words

- **A number that needs work is a doorway, not a report.** Every panel is a starting point: a case count leads to the case list (file 11), an open or over-SLA case leads to the case itself (file 12), a pending MID leads to applying its limits, and an awaiting agreement leads to chasing the paper copy (file 15).
- **Applying limits removes the MID from this list.** A MID whose limits have been applied leaves the pending list. Whether that unblocks the Testing case (file 17) was not verified in this audit.
- **An awaiting agreement clears when the paper arrives.** Once the office receives and scans the signed copy, the agreement leaves the awaiting-physical list (file 15) and its case can close.
- **Nothing on this page changes a case or a merchant by itself.** The dashboard only shows the state of things and (for admins) applies MID limits; all real work happens on the list and case pages it links to.

## Errors and responses

All dashboard routes sit behind `requireAuth` (`dashboardRoutes.use('*', requireAuth)` in `backend/src/modules/dashboard/dashboard.routes.ts`); only the apply-limits route adds a role check.

| Result | Meaning |
|---|---|
| `200` | Every `GET` returns its data as JSON; `POST /api/dashboard/portal-mids/apply-limits` returns `{ applied, alreadyApplied, notFound }` — the MIDs newly applied and the MIDs that were already applied (their category is updated to the one sent). `notFound` is initialised as an empty list in the code reviewed and nothing in the function read adds to it, so do not rely on it to report missing MIDs. |
| `400` | Invalid query or body — a Zod validation failure. The messages in `dashboard.schemas.ts` include "Custom range requires both from and to dates.", "Custom range start must be on or before its end." and "Custom range cannot exceed 120 days." for a bad custom range, and the apply-limits body must be `{ portalMids: [positive integers], category: 'custom_wordpress' \| 'shopify' \| 'internal' }` with 1–500 MIDs. |
| `403` | Applying MID limits as anyone other than `super_admin` / `admin` (`requireRoles('super_admin', 'admin')` on the apply-limits route). |
| `404` | No `404` case was found in the code reviewed for these routes: a MID that is not pending is **not** an error in the apply-limits service — it is inserted as a candidate (with `merchantId: null` when it has no pending row). |

> ⚠️ **Not found in the code reviewed:** any error the dashboard itself raises for a bad `group` value on the pending-MID values endpoint beyond the Zod validation (the group must be `internal`, `custom_wordpress` or `shopify`); any rate limit on the dashboard endpoints.

## What to check — is this what you intended?

- [ ] **All-company overview for agents:** the KPI cards count **all** cases and merchants for every viewer, but the workload panel hides queues an agent cannot view. Should an agent's whole dashboard be limited to the queues they can see, or is the all-company overview intentional?
- [ ] **"In process" label:** the merchant card shows the `pending` count under the label "In process". Is that the wording you want, or should it say "Pending"?
- [ ] **Who sees MIDs and agreements:** who should be able to see the pending-MID list and the awaiting-physical-agreement list — everyone, or only admins and the people who work those queues? Today there is no role check on those two lists.
- [ ] **Range and time zone:** is the 120-day maximum for a custom range the right limit, and is Asia/Karachi the right time zone for the dashboard even when someone views it from elsewhere?
- [ ] **Failed / stuck cases:** should the dashboard show anything about cases that failed or got stuck (for example the degraded case-flow jobs admins can see at `GET /api/cases/flow-jobs/failed`), or is that deliberately kept out of the overview?
- [ ] **Terminated merchants in the pending-MID list:** should a terminated merchant's MIDs drop off the pending list (as soft-deleted merchants' do), so nobody applies limits to a merchant that no longer trades?
- [ ] **All-time totals:** the case and merchant cards show all-time totals and SLA figures, and only the "in range" counts follow the date range. Is that the intent, or should the totals follow the selected range too?
- [ ] **Apply-limits batch:** the "apply limits" action accepts up to 500 MIDs in one call. Is that a realistic batch size for how the team works, and should applying limits require a confirmation step?

---
*Sources: `frontend/src/routes/_app.index.tsx`, `frontend/src/features/dashboard/dashboard.tsx`, `frontend/src/features/dashboard/dashboard-kpi-cards.tsx`, `frontend/src/features/dashboard/dashboard-workload.tsx`, `frontend/src/features/dashboard/dashboard-portal-mids.tsx`, `frontend/src/features/dashboard/dashboard-awaiting-agreements.tsx`, `frontend/src/features/dashboard/dashboard-filter-bar.tsx`, `frontend/src/features/dashboard/dashboard-charts.tsx`, `frontend/src/apis/dashboard.ts`, `frontend/src/schemas/dashboard.schema.ts`, `frontend/src/config/navigation.ts`, `backend/src/modules/dashboard/dashboard.routes.ts`, `backend/src/modules/dashboard/dashboard.service.ts`, `backend/src/modules/dashboard/dashboard-workload.service.ts`, `backend/src/modules/dashboard/dashboard.schemas.ts`, `backend/src/modules/cases/case-sla.ts`, `backend/src/modules/cases/agreement-email-status.ts`, `backend/src/db/schema.ts`, `frontend/src/hooks/use-dashboard-query.ts`, `frontend/src/features/dashboard/load-dashboard-charts.ts`. Related files: 12 (case lifecycle / SLA), 15 (Agreement workflow / awaiting physical agreements), 16 (MID Creation / pending MIDs), 32 (case-flow failed jobs).*
