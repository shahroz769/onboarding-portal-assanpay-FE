# 11 — Cases List and Queue Access

## At a glance

| | |
|---|---|
| **What it is** | The Cases pages, where employees find work. One shared table with several views over it: all cases, the cases in queues the employee is allowed to work in, the employee's own open cases, the employee's own closed cases, and a special page for EP (eligible-partner) sub-merchants. Underneath all of them is the same idea: a case belongs to a queue, and an employee can only see — and only work in — the queues they have been given access to. |
| **Who can use it** | All signed-in employees can open All Cases, My Open Cases and My Closed Cases. Work Queue Cases is only for people who can actually work a queue. EP Sub-Merchants is only shown when the user's `canManageEpCases` flag is set. Creating a case is super admin / admin only. |
| **Where it lives** | `/cases/all-cases` (default when opening `/cases`) · `/cases/work-queue-cases` · `/cases/my-open-cases` · `/cases/my-closed-cases` · `/cases/ep-sub-merchants` |
| **What it creates** | Cases — via the "Trigger case" button (super admin / admin only), or bulk-create (one case per merchant). EP cases cannot be created that way at all; they must go through the EP trigger (see file 14). |
| **Main APIs** | `GET /api/cases` · `GET /api/cases/owners` · `POST /api/cases` · `POST /api/cases/bulk-create` · `PATCH /api/cases/:id/assign` · `POST /api/cases/bulk-assign` · `PATCH /api/cases/:id/take-ownership` · `PATCH /api/cases/:id/priority` · `GET /api/cases/ep-sub-merchant/merchants` · `POST /api/cases/ep-sub-merchant/trigger` |
| **Main code** | Frontend: `src/routes/_app.cases.*.tsx`, `src/features/cases/cases-table.tsx` · Backend: `src/modules/cases/cases.routes.ts`, `case-query.service.ts`, `case-access.service.ts` |
| **Success looks like** | An employee opens a list, sees only the cases they are allowed to see, filters and searches to find the right one, and opens it to work it (file 12). |

## How it works — the journey

```
Employee opens /cases → redirected to /cases/all-cases
        ↓
Chooses a view: All · Work Queue · My Open · My Closed · EP Sub-Merchants
        ↓
Backend filters by queue access (view vs work) + the view's fixed filters
        ↓
Table: search, queue / owner / status / priority filters, sorting, cursor paging
        ↓
Row → case detail (file 12) · or bulk assign / trigger a case (admins only)
```

## The five list views

| # | View | Route | What it shows |
|---|---|---|---|
| 1 | **All Cases** | `/cases/all-cases`, the default when opening `/cases` | Every case the employee is allowed to see, newest first by default. |
| 2 | **Work Queue Cases** | `/cases/work-queue-cases` | The same table, but the request is sent with `queueAccess=work`, so the backend only returns cases in queues where the employee has `work` access. |
| 3 | **My Open Cases** | `/cases/my-open-cases` | The table is forced to `ownerId = <my user id>` and `status = new,working,awaiting_merchant` (every status except `closed`). The owner and status filters are hidden on this page because they are fixed. |
| 4 | **My Closed Cases** | `/cases/my-closed-cases` | Forced to `ownerId = <my user id>` and the status filter `closed,unsuccessful`. `unsuccessful` is a filter value, not a status (see the status note under "Filtering, searching and sorting"), so the page shows the employee's closed cases, successful and unsuccessful alike. The owner and status filters are hidden here too. |
| 5 | **EP Sub-Merchants** | `/cases/ep-sub-merchants` | Not a case list at all — it lists merchants (non-terminated) with their sub-merchants, WordPress result, and EP progress, so someone can trigger EP cases one sub-merchant at a time. See file 14 for the trigger rules. |

## Who can use it — permissions

| View / action | Who |
|---|---|
| All Cases (`/cases/all-cases`), My Open Cases (`/cases/my-open-cases`), My Closed Cases (`/cases/my-closed-cases`) | All signed-in employees. |
| Work Queue Cases (`/cases/work-queue-cases`) | Only people who can actually work a queue: `super_admin`, or an agent with at least one `work` queue access row. Anyone else is redirected to All Cases (`frontend/src/routes/_app.cases.work-queue-cases.tsx`). In the sidebar the link is shown only to `agent` and `super_admin` roles (`frontend/src/config/navigation.ts`). Super admins always see it; an agent sees it only when they have at least one `work` row (`frontend/src/components/app-sidebar.tsx`). |
| EP Sub-Merchants (`/cases/ep-sub-merchants`) | Shown only when the user's `canManageEpCases` flag is set. That flag mirrors the backend rule: `super_admin`, `admin`, or an agent with working access to an EP queue (`backend/apis/cases.md`, `GET /api/cases/ep-sub-merchant/merchants`). |
| Creating a case from the list (the "Trigger case" button on All Cases) | `super_admin` and `admin` only — `POST /api/cases` and `POST /api/cases/bulk-create` both carry `requireRoles('super_admin', 'admin')`. EP cases are the exception: they cannot be created that way at all (the endpoints return `409` for EP queues) and must go through `POST /api/cases/ep-sub-merchant/trigger` (see file 14). |

Roles in the code are `super_admin`, `admin` and `agent` (`backend/src/db/schema.ts`, `role_type` enum). There is no other role.

## Filtering, searching and sorting

| Feature | How it works |
|---|---|
| **Filters** | A text search; a queue filter; an owner filter (a searchable multi-select); a status filter; and a priority filter (`frontend/src/features/cases/cases-table.tsx`). Filters live in the URL, so a filtered view can be bookmarked or shared. |
| **Queue filter** | Lists active queues only (`GET /api/queues` without `includeInactive`, via `queuesQueryOptions()`). On the Work Queue Cases page an agent only sees queues where they hold a `work` row (`cases-table-context.tsx`). EP (`sub_merchant_form`) queues are not excluded here. |
| **Search** | A case-insensitive "contains" match on the case number **or** the merchant's business name (`listCases()` in `backend/src/modules/cases/case-query.service.ts`; the two are matched in separate subqueries). The search box waits 300 ms after the last keystroke before it updates the URL (`frontend/src/components/data-table/data-table-search.tsx`). Its placeholder reads "Search by case number or merchant name…". |
| **Sorting** | Options in the API are `caseNumber`, `status`, `createdAt`, `closedAt`, `updatedAt` and `merchantName`, ascending or descending (default `createdAt` descending, i.e. newest first). The UI schema falls back to `createdAt` descending when the URL holds an unknown sort value (`frontend/src/schemas/cases.schema.ts`). |
| **Paging** | Cursor-based (`cursor` + `limit`, default 30, maximum 100 per page), not page numbers. The table uses an infinite query and requests the next page as the employee scrolls or pages forward. The `total` count is computed on the first page only; later pages return `total: null`. |

## What each row shows

Columns are: a selection checkbox, Case Number (a link to the case), Merchant Name, Case Owner, Queue, Case Status, SLA, Priority, Creation Date, Closed Date and Last Updated At (`frontend/src/features/cases/cases-columns.tsx` and the skeleton in `frontend/src/routes/_app.cases.all-cases.tsx`).

Priority is `normal` or `high` only. SLA is a badge derived from the case's age against its queue's `slaHours` (see file 10 for the rule).

Priority is copied from the merchant when a case is created. A merchant-level priority change (`updateMerchantPriority`, `backend/src/modules/merchants/merchants.service.ts`) overwrites the priority of **every** case of that merchant, closed cases included, and writes no case history. A case-level change (`PATCH /api/cases/:id/priority`) is independent of the merchant and is not recorded in case history either (see file 12).

## Bulk actions and creating cases

| Action | How it works |
|---|---|
| **Bulk assign** | Only `super_admin` and `admin` can select rows; closed cases are never selectable (`cases-table-context.tsx`). The bulk bar's owner picker has an **"AP System (New)"** option, which unassigns the selected cases back to the pool. Choosing it is blocked when any selected case is `awaiting_merchant` and has an owner. The call is `POST /api/cases/bulk-assign` with `{ ids (1–500), ownerId }` and returns `{ updated: n }`. Backend rules (`case-assignment.service.ts`, `bulkAssignCases`): a closed case anywhere in the selection fails the whole call with 400 "Closed cases cannot be assigned or transferred."; an inactive user is refused (403); assigning to an owner moves cases still in their `new` stage to the queue's `working` stage; unassigning moves them back to the `new` stage and clears the close fields; pending resubmission links on reassigned cases are revoked; one history entry per changed case (`owner_assigned`, `owner_transferred` or `owner_unassigned`); assignment notifications are sent best-effort. Single-case assign (`PATCH /api/cases/:id/assign`) follows the same rules. |
| **Trigger (create) a case** | An admin (`super_admin` or `admin`, `useCanTriggerCases()`) can trigger a case from the **Trigger Case** button on All Cases (`TriggerCaseButton`, `frontend/src/features/cases/trigger-case-dialog.tsx`). The button also appears on the Merchants page. The dialog lists every queue except EP (`sub_merchant_form`) queues; inactive queues are shown but cannot be submitted ("This queue is inactive."). One selected merchant calls `POST /api/cases`; more than one calls `POST /api/cases/bulk-create`. |
| **Bulk-create cases** | `POST /api/cases/bulk-create`, 1–200 merchant ids (duplicates ignored); each merchant is created in its own transaction, so a 4xx for one merchant (for example an existing live case) is reported in `failed` without rolling back the others. A 5xx error is re-thrown and fails the whole call. |
| **Take ownership** | `PATCH /api/cases/:id/take-ownership` (no body) lets a user claim an unowned case from the pool. Agents need `work` access to the case's queue; super admins are not restricted. It is refused when the case is closed, already has an owner, or is not in its `new` stage. On success the case gets the caller as owner, moves to the queue's `working` stage and a `ownership_taken` history entry is written (`case-assignment.service.ts`, `takeOwnership`). |

## How it is implemented — Frontend

- Routes (all under `frontend/src/routes/`):
  - `_app.cases.tsx` — parent route; `_app.cases.index.tsx` redirects `/cases` to `/cases/all-cases`.
  - `_app.cases.all-cases.tsx`, `_app.cases.work-queue-cases.tsx`, `_app.cases.my-open-cases.tsx`, `_app.cases.my-closed-cases.tsx`, `_app.cases.ep-sub-merchants.tsx` — the five views. Each validates its URL search params with `caseRouteSearchSchema` (`frontend/src/schemas/cases.schema.ts`).
  - `_app.cases.$caseId.tsx` — the case detail page (file 12).
- Table: `frontend/src/features/cases/cases-table.tsx` (`CasesTableComposed`), columns in `cases-columns.tsx`, filter state and URL sync in `cases-route-filters.ts`, selection/assign/priority dialogs in `cases-table-context.tsx`, `case-assign-owner-dialog.tsx` and `case-priority-dialog.tsx`.
- API calls: `frontend/src/apis/cases.ts` — `fetchCases()` (calls `GET /api/cases`), `createCase()`, `bulkCreateCases()`, `assignCase()`, `bulkAssignCases()`, `updateCasePriority()`, plus `fetchQueues()` for the queue filter.
- Navigation: `frontend/src/config/navigation.ts` — "Cases" group with All Cases, Work Queue Cases (roles `agent` + `super_admin`, requires work access), EP Sub-Merchants (requires EP access), My Open Cases, My Closed Cases. Visibility is decided by `getFilteredNavItems(roleType, hasWorkingAccess, canManageEpCases)`.

## How it is implemented — Backend

- Module: `backend/src/modules/cases/` — routes in `cases.routes.ts`, listing in `case-query.service.ts` (`listCases`, `listCaseOwners`, `createCase`, `bulkCreateCases`), access checks in `case-access.service.ts`.
- `GET /api/cases` — query params: `cursor`, `limit` (default 30, max 100), `queueAccess` (`view` default | `work`), `search`, `queueId`, `ownerId` (comma-separated), `priority` (comma-separated `normal`/`high`), `merchantId` (comma-separated), `status` (comma-separated; allowed values `new`, `working`, `closed`, `awaiting_merchant`, `unsuccessful`), `sortBy`, `sortOrder` (default `desc`), `createdAtFrom`, `createdAtTo` (`backend/src/modules/cases/cases.schemas.ts`, `listCasesQuerySchema`).

### Access filtering (`listCases` in `case-query.service.ts`)

| Mode | What an agent sees |
|---|---|
| `queueAccess=work` | An agent only sees cases in queues where they hold a `work` row. Admins and super admins are not limited this way. |
| `queueAccess=view` (default) | An agent whose `queueViewScope` is `selected` only sees cases in queues where they hold a `view` row; an agent with scope `all` sees everything. A `work` row does not grant view access, so an agent with scope `selected` and only work rows sees nothing on All Cases. Admins and super admins are never filtered. |
| Asking for a specific `queueId` the employee may not see | Returns no rows for that queue (the queue is silently excluded), rather than an error — confirm whether that silent behaviour is intended (see questions). |

### Queue access data (`backend/src/db/schema.ts`)

| Item | Detail |
|---|---|
| `users.queueViewScope` | `all` \| `selected` (default `all`). |
| `userQueueAccess` table | One row per (user, queue, access type), where `accessType` is `view` or `work` (primary key on all three columns). |
| `getAgentQueueAccess()` | Returns `{ viewScope, viewQueueIds, workQueueIds }` for agents and `null` for admins/super admins (who are never restricted). |
| Enforcement | `assertCanViewCase()` (403 "You do not have access to this queue."), `assertCanWorkCase()` (403 "You do not have working access to this queue."), `assertCanWorkQueue()` and `assertOwnerCanWorkCases()` enforce the same rules on single-case reads and writes. |

### Case creation and assignment

| Endpoint | Body / result |
|---|---|
| `POST /api/cases` | `{ merchantId, queueId, subMerchantId? }`, returns `201` with the new case (`caseNumber` like `DR-000000001`, `status: new`, `ownerId: null`). `404` if the queue does not exist; `409` if the queue is not `active`; `409` for EP queues; `409` if the merchant is terminated or deleted. |
| `GET /api/cases/owners` | Returns the users who own at least one case (`listCaseOwners`, `case-query.service.ts`). No caller was found in `frontend/src/apis/cases.ts`. |
| `POST /api/cases/bulk-create` | `{ merchantIds (1–200), queueId, subMerchantId? }`, returns `200` with `{ created: [...], failed: [...] }`. |
| `POST /api/cases/ep-sub-merchant/trigger` | `{ merchantId, subMerchantId }`, returns `201`. Rules are in file 14. |
| `PATCH /api/cases/:id/assign` | `{ ownerId: uuid \| null }`, admin only; `null` unassigns. |
| `POST /api/cases/bulk-assign` | `{ ids (1–500), ownerId }`, admin only. |
| `PATCH /api/cases/:id/take-ownership` | No body; see "Bulk actions and creating cases". Any signed-in user, subject to the agent work-access rule. |
| `PATCH /api/cases/:id/priority` | `{ priority: 'normal' \| 'high' }`, admin only. Refused with 409 "Priority cannot be changed for a closed case." |
| `GET /api/cases/flow-jobs/failed`, `POST /api/cases/flow-jobs/:jobId/retry`, `GET /api/cases/flow-jobs/backfill/preview?triggerId=`, `POST /api/cases/flow-jobs/backfill` | Admin-only recovery for durable follow-up case creation (`cases.routes.ts`, "Operational recovery"). They list failed close-triggered case-flow jobs, retry one, and preview or create the missing follow-up cases for a close trigger. `super_admin` and `admin` only. |
| `GET /api/queues` (default: `active` only; `includeInactive=true` adds draft/inactive) and `GET /api/queues/:id` | Queues list for filters (`backend/src/modules/queues/queues.routes.ts`). See file 32's area for queue administration; this file only covers what the list needs. |

**Creation rules** (`createCaseInTransaction`, `backend/src/modules/cases/case-query.service.ts`): the merchant row is locked first. A terminated or deleted merchant gets `409` "This merchant is terminated. New cases cannot be opened for it." (`merchant-state-machine.ts`). A Live queue case is refused when the merchant already has a live case: `409` "Live case <caseNumber> already exists for this merchant." Other queues have no duplicate check, so a second open Documents Review case for the same merchant is accepted (see file 32, open finding M9: the terminated-merchant part appears fixed in this code, the duplicate part does not). `subMerchantId` is used only on EP queues and is ignored elsewhere. Each created case gets history action `case_created_manually`.

## Data, validation and edge cases

- **Case numbers** are per-queue sequences (`DR-…`, `SM-…`, `AG-…`, `MI-…`, `TS-…`, `WP-…`, `LV-…` from `backend/drizzle/seed-queues.sql`; `ST-…` is in that seed file only, because Support Ticket is not in the production database) and are unique across the `cases` table.
- **Status filter `unsuccessful`:** it is a filter convenience, not a status. The status dropdown labels it "Closed (unsuccessful)" and the plain `closed` value "Closed (successful)" (`frontend/src/schemas/cases.schema.ts`). The filter combinations work like this (`listCases()`):
  - `unsuccessful` alone: only cases with `closeOutcome = 'unsuccessful'`.
  - `closed` alone: closed cases **except** unsuccessful ones, so successful closes only.
  - `closed,unsuccessful`: every closed case, successful and unsuccessful (this is what My Closed Cases sends).
  - All four statuses plus `unsuccessful`: no status condition at all, so every case (open and closed) is returned.
  - Unsuccessful closes are written with `closeOutcome = 'unsuccessful'` by `closeUnsuccessful()` in `case-stage.service.ts`.
- **Unassigned cases** have `ownerId: null` and appear in the workload "pool". Filtering by owner never matches them; they are found through the Work Queue view and the dashboard workload panel.
- **Stale filters:** because filters live in the URL, a link can carry a `queueId` the viewer no longer has access to, or an `ownerId` of a deleted user. The code reviewed does not show a specific error for those; the list simply returns fewer (or no) rows.
- **Bulk create:** duplicates in `merchantIds` are ignored; a merchant rejected with a 4xx (for example an existing live case, or unmet case-flow creation requirements) lands in `failed` with the error text and does not roll back the other merchants. A merchant that fails with a 5xx error stops the whole call.
- **Owner filter:** the owner dropdown is fed from the user directory (`userDirectoryQueryOptions`, `frontend/src/features/cases/cases-table-context.tsx`), not from `GET /api/cases/owners`. Unassigned cases are never matched by the owner filter.
- **EP page filters:** `GET /api/cases/ep-sub-merchant/merchants` accepts `search` (matches business name, submitter email, owner full name, or an exact merchant number), `status` (`pending`, `testing`, `live`), `wordpress` (`successful`, `not_successful`), `progress` (`not_triggered`, `open`, `unsuccessful`, `completed` — a merchant with several sub-merchants can match more than one), `sortBy` (`createdAt` default, `merchantNumber`, `businessName`, `ownerFullName`, `status`, `updatedAt`), `sortOrder` (default `asc`), `cursor`, `limit` (default 30, max 100). Soft-deleted merchants are excluded as well as terminated ones. Access is checked first by `assertCanManageEpCases` (`ep-sub-merchant.service.ts`). A merchant is `completed` only when every selected sub-merchant has a successful case. The default sort is `createdAt`, ascending (`sortOrder` defaults to `asc` here, unlike the case list).

> ⚠️ **Not found in the code reviewed:** an export of the case list; a saved-view feature; any limit on how many rows can be selected for bulk assign in the UI (the API caps at 500).

## What happens next — in plain words

- **Finding a case is the start, not the end.** The employee opens the case (file 12), takes it or is assigned it, and works it through its queue's workflow (files 13–18). An unassigned case sits in the pool until someone takes it; a case nobody picks up is visible in the dashboard workload panel (file 10) as unassigned work.
- **Assigning is how work is handed over.** An admin can move a case to the right person from the list (single or bulk assign); the new owner then sees it under My Open Cases. Assigning to someone who cannot work that queue is refused, so the case cannot be handed to the wrong person by mistake.
- **Triggering starts a new journey.** An admin triggering a case for a merchant creates that merchant's next step in the chain — for example a fresh Documents Review — and the new case appears in the lists as `new`, waiting for an owner.
- **EP work ends on the EP page, not here.** Triggering an EP case is the one creation that happens from the EP Sub-Merchants page (file 14); once triggered, the EP case is worked like any other case from its detail page.

## Responses and errors

All case routes sit behind `requireAuth` (`caseRoutes.use('*', requireAuth)` in `backend/src/modules/cases/cases.routes.ts`).

| Result | Meaning |
|---|---|
| `200` | `GET /api/cases` returns `{ cases, nextCursor, hasMore, limit, total }` (`listCases` in `case-query.service.ts`) — `cases` is the page of rows, `nextCursor` is null on the last page, and `total` is the count matching the filters. `POST /api/cases/bulk-create` also returns `200` with `{ created: [...], failed: [...] }`. |
| `201` | `POST /api/cases` and `POST /api/cases/ep-sub-merchant/trigger` return the new case (`status: new`, `ownerId: null`). |
| `400` | Invalid query or body — a Zod validation failure (for example a bad `sortBy`, a non-uuid `queueId`, or a `limit` over 100 on `GET /api/cases`). |
| `403` | "You do not have access to this queue." (viewing a case in a queue the employee cannot view) or "You do not have working access to this queue." (working or taking a case, or assigning it to someone without `work` access). Bulk or single assign to an agent without `work` access returns "Selected employee does not have work access to: <queue names>." Assigning to an inactive user returns "Inactive employees cannot own cases." A non-admin calling an admin-only route gets "Insufficient permissions." (`requireRoles`, `backend/src/middleware/rbac.ts`). Only the current owner can run owner-only case actions: "Only the current case owner can work on this case.". |
| `404` | A case that does not exist (single-case reads/writes), "User not found." for an unknown assignee, and "One or more cases were not found." in bulk assign. For bulk-create, a merchant rejected with a 4xx lands in the `failed` list with the error text instead of failing the whole call. |
| `400` | Also: "Closed cases cannot be assigned or transferred." (assign, bulk assign, take ownership), "Case already has an owner." and "Case is not in the initial stage." (take ownership), "Select a valid sub-merchant before creating an EP Sub-Merchant Form case." (create on an EP queue without a valid sub-merchant). |
| `409` | The queue is not `active` on create ("This queue is inactive. Case creation is disabled."); an EP queue on `POST /api/cases` / `POST /api/cases/bulk-create` ("EP Sub-Merchant cases can only be triggered from the EP Sub-Merchants page."); a second live case for the same merchant ("Live case <number> already exists for this merchant."); unassigning an `awaiting_merchant` case that has an owner ("This case is waiting on the merchant and cannot be unassigned. Transfer it to another owner instead."); priority change on a closed case; a stale write during assign ("Case assignment was already updated."); any failed EP trigger check (file 14). |

## What to check — is this what you intended?

- [ ] **"All Cases" name:** an agent who opens All Cases with `queueAccess=view` and scope `selected` only sees their selected queues — but the page is still called "All Cases". Is that the right name, or should it say something like "Cases I can view"?
- [ ] **Silent empty list:** when someone filters by a queue they have no access to, the list silently shows nothing instead of saying "you don't have access to this queue". Should that be an explicit message?
- [ ] **Work Queue page scope:** should agents be able to see cases in queues they can only *view* on the Work Queue page, or is that page correctly limited to queues they can *work* in?
- [ ] **Who sets queue access:** who decides an agent's `queueViewScope` (`all` vs `selected`) and their view/work rows — is that an admin job in User Management, and should changing it take effect immediately for lists the agent already has open?
- [ ] **Unsuccessful closes:** My Closed Cases uses `status=closed,unsuccessful`, so unsuccessful closes do appear there alongside successful ones. Should unsuccessful closes be kept apart from successful ones, or have their own view?
- [ ] **Merchant priority cascade:** a merchant-level priority change overwrites every case of that merchant, closed cases included, and no case history is written. Should closed cases keep their priority, and should priority changes be logged?
- [ ] **EP page for admins:** the EP Sub-Merchants page is driven by `canManageEpCases`. Should admins always see it even if they have no EP queue access, or is the current rule (admin/super admin, or an agent with EP work access) correct?

---

Case-list pagination is keyset (cursor-based) pagination; the cursor format and its error response are described in file 34 (`modules/cases/case-cursor.ts`).

*Sources: `frontend/src/routes/_app.cases.tsx`, `frontend/src/routes/_app.cases.index.tsx`, `frontend/src/routes/_app.cases.all-cases.tsx`, `frontend/src/routes/_app.cases.work-queue-cases.tsx`, `frontend/src/routes/_app.cases.my-open-cases.tsx`, `frontend/src/routes/_app.cases.my-closed-cases.tsx`, `frontend/src/routes/_app.cases.ep-sub-merchants.tsx`, `frontend/src/features/cases/cases-table.tsx`, `frontend/src/features/cases/cases-columns.tsx`, `frontend/src/features/cases/cases-route-filters.ts`, `frontend/src/features/cases/trigger-case-dialog.tsx`, `frontend/src/apis/cases.ts`, `frontend/src/config/navigation.ts`, `frontend/src/schemas/cases.schema.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/case-access.service.ts`, `backend/src/modules/cases/cases.schemas.ts`, `backend/src/modules/cases/case-assignment.service.ts`, `backend/src/modules/cases/case-stage.service.ts`, `backend/src/modules/cases/case-sla.ts`, `backend/src/modules/cases/ep-sub-merchant.service.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/merchants/merchant-state-machine.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/middleware/rbac.ts`, `backend/src/modules/queues/queues.routes.ts`, `backend/src/modules/queues/queues.service.ts`, `backend/src/db/schema.ts`, `backend/drizzle/seed-queues.sql`, `frontend/src/components/app-sidebar.tsx`, `frontend/src/components/data-table/data-table-search.tsx`, `frontend/src/features/cases/cases-table-context.tsx`, `frontend/src/features/merchants/merchants-table.tsx`, `frontend/src/lib/sla.ts`, `frontend/src/routes/_app.cases.my-closed-cases.tsx`, `frontend/src/routes/_app.cases.my-open-cases.tsx`, `frontend/src/routes/_app.cases.all-cases.tsx`. Related files: 12 (case detail / lifecycle), 14 (EP Sub-Merchant Form), 32 (queue administration).*
