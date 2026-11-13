# 07 — Merchants List and Detail

## At a glance

| | |
|---|---|
| **What it is** | The staff's main working view of merchants: a searchable, filterable list of every merchant that has applied, and a detail page for each merchant showing who they are, what they submitted, what cases they have, what their limits are, and everything that has happened to them. |
| **Who can use it** | Any signed-in employee can open the list and any merchant's detail page. What each role can *do* on the page differs (see the permissions table). |
| **Where it lives** | List `/merchants` · Detail `/merchants/$merchantId` (Overview / Form / Limits / History tabs) |
| **Main API** | `GET /api/merchants` · `GET /api/merchants/:id` (+ `/overview`, `/form`, `/limits-mdr`, `/history`) · `PATCH /api/merchants/:id/priority` · `POST /api/merchants/bulk-priority` |
| **Main code** | Frontend: `src/features/merchants/merchants-table.tsx`, `src/features/merchants/merchant-details.tsx` · Backend: `src/modules/merchants/merchants.routes.ts`, `src/modules/merchants/merchants.service.ts` |
| **Success looks like** | Staff find any merchant in seconds, see its whole story on one page, and change priority only when they are allowed to. |

## Who can use it — permissions

| Action | super_admin | admin | agent |
|---|---|---|---|
| Open the list and any detail page | Yes | Yes | Yes — there is no queue-access restriction on merchants: unlike cases, merchants are visible to every role, including agents with no queue access (see file 32, gap 6). |
| Change priority | Yes | Yes | No |
| Terminate a merchant | Yes | Yes | No |
| Delete a merchant permanently (the only delete the screens offer) / move its Drive files to trash | Yes | No | No |
| Change limits / MDR | Yes | Yes | No (see file 08) |

An agent can look, but cannot change priority, terminate, or delete — the buttons are hidden for them in the table (`canEdit`, `canTerminate`, `canDelete` in `frontend/src/features/merchants/merchants-columns.tsx`).

Two role details behind the table:
- An admin may terminate, but the backend refuses `deleteDriveFiles: true` for anyone who is not a super admin (`assertCanDeleteDriveFiles()` in `backend/src/modules/merchants/merchants.routes.ts`, error 403 "Only a Super Admin can delete Google Drive files."). So an admin's termination always leaves the Drive files in place.
- The soft-delete route (`DELETE /api/merchants/:id`) and bulk soft delete (`POST /api/merchants/bulk-delete`) are super-admin only in the backend, but no frontend screen calls them (see the API note below and file 09). Its route comment says "admin only", which does not match the `requireRoles('super_admin')` guard on the same route.

## How it works — the list

```
Staff open /merchants → table, newest first, 30 rows per page
        ↓
Search / filter / sort → keyset pages load as staff scroll
        ↓
Row actions: open detail · open open cases · change priority · terminate · move Drive files to trash · delete
        ↓
Bulk actions on the selected rows (up to 100 ids): Trigger Case · Set Priority · Terminate (there is no bulk delete button)
```

### The list (`/merchants`)

| Piece | Detail |
|---|---|
| **Columns** | The table shows, in order: Merchant Name (links to the Overview tab), Owner, Status, Priority (badge; the priority note is a tooltip), Open Cases (count, links to that merchant's open cases), EP Status (latest EP sub-merchant summaries), Created, Went Live (`liveAt`), Updated, and Actions. The merchant number is **not** a column: it appears only in the detail header as `#<merchantNumber>`. Currency and business scope are not columns either (business scope is only a filter). |
| **Search** | Business name, submitter email, owner full name, or merchant number (typed as a whole number). The search box is labelled "Search merchants". |
| **Filters (on screen)** | Search, Status, Priority, Scope (business scope), and EP Status. The URL also accepts `currency` and a created-date range (`createdAtFrom` / `createdAtTo`), but the table has no control for them: `merchants-table-context.tsx` forces the date range to `undefined` on every list request. Currency is only reachable by editing the URL. |
| **Sort** | The sortable columns are merchant number, business name, owner name, status, priority, business scope, created date and updated date (eight in total; clicking a header toggles asc/desc). The frontend's default is `sortBy=merchantNumber`, `sortOrder=desc` (`merchantRouteSearchSchema` in `frontend/src/schemas/merchants.schema.ts`). Because the merchant number is a serial, that is effectively newest first. The backend's own default (`createdAt desc`) only applies when a caller omits `sortBy`. An unknown `sortBy` in the URL silently falls back to `merchantNumber` (the frontend `.catch`); the 400 described below applies only to direct API calls. |
| **Terminated hidden by default** | The default is set by `DEFAULT_MERCHANT_STATUS_FILTER` (every status except `terminated`, defined in `frontend/src/schemas/merchants.schema.ts`) and applied in `frontend/src/features/merchants/merchants-table-context.tsx` as `status: filters.status ?? DEFAULT_MERCHANT_STATUS_FILTER`. Clearing the Status filter brings the default back; it does not show terminated merchants. Staff must pick `terminated` explicitly to see them. |
| **Row actions** | Open the detail page; open the merchant's open cases; change priority (super admin/admin, not for terminated merchants); terminate (super admin/admin, not for terminated merchants); move Drive files to trash (super admin only, only for terminated merchants whose Drive files are not yet trashed — the icon then changes to a "Drive files moved to trash on <date>" indicator, see file 09); permanently delete (super admin only, only for terminated merchants). |
| **Bulk actions** | On the selected rows, the toolbar offers Trigger Case (opens `frontend/src/features/cases/trigger-case-dialog.tsx`), Set Priority (super admin/admin) and Terminate (super admin/admin). Terminated rows are removed from the selection before these run (`selectedNonTerminatedIds()` in `merchants-table-utils.ts`). Bulk delete has no button in the frontend. |
| **Paging** | Scrolling/paging loads the next keyset page; the total count is shown from the first page only. |

## How it works — the detail page

```
Staff open /merchants/$merchantId → redirects to /overview tab
        ↓
Header: merchant number · business name · status · priority · owner · submitted date
        ↓
Four tabs: Overview · Form and agreement · MDR and limits · History
```

### The four tabs

| Tab | Route | What it shows |
|---|---|---|
| **Overview** | `/merchants/$merchantId/overview` | The merchant's identity and status, milestones (how far along the journey it is), case counts (total, open, working, closed, SLA-breached open cases), the effective limits/MDR summary, and the payment/payout methods. The milestones are: **Form filled** (`submittedAt`), **Testing started** (the earliest `testing_limits_applied` case-history entry across the merchant's cases; empty if none), and **Went live** (`liveAt`). |
| **Form and agreement** | `/merchants/$merchantId/form` | The submitted form fields exactly as the merchant entered them, the uploaded documents with their Drive links and review status, the received signed agreement file (if any), and whether Documents Review was approved. The approval check is done in code by matching the queue **name** "Documents Review" (case-insensitive, hyphens and underscores read as spaces), not by workflow type; a closed Documents Review case with outcome `successful` shows the approved message in `merchant-form-tab.tsx`. |
| **MDR and limits** | `/merchants/$merchantId/limits` | The limits and commission rates. See file 08. |
| **History** | `/merchants/$merchantId/history` | The merchant's milestones, its cases with SLA state, and a timeline of events. |

The default tab is Overview: the index route (`/merchants/$merchantId`) redirects to `/merchants/$merchantId/overview`. Tabs are defined in `frontend/src/features/merchants/merchant-detail-tabs.ts`.

## Endpoints

| Endpoint | Roles | What it does |
|---|---|---|
| `GET /api/merchants` | All roles | List (query below). |
| `GET /api/merchants/:id` | All roles | Header only: `id`, `merchantNumber`, `businessName`, `status`, `priority`, `ownerFullName`, `submittedAt`. |
| `GET /api/merchants/:id/overview` | All roles | Merchant identity, milestones, case counts, limits/MDR summary, payment/payout methods. |
| `GET /api/merchants/:id/form` | All roles | Full submitted merchant record, documents, received signed agreement (latest), and `documentReviewApproved` (true when a Documents Review case for this merchant is `closed` with a `successful` outcome). |
| `GET /api/merchants/:id/limits-mdr` | All roles | The limits bundle (see file 08). |
| `GET /api/merchants/:id/history` | All roles | Submitter email, milestones, cases with SLA state, timeline. |
| `PATCH /api/merchants/:id/priority` | super_admin, admin | `{ priority: normal\|high, note?: string (max 500) }`. Returns `{ id, priority, priorityNote }`. |
| `POST /api/merchants/bulk-priority` | super_admin, admin | `{ ids (1–100 UUIDs), priority, note? }`. Returns `{ updatedCount }`. |
| `PATCH /api/merchants/:id/limits-mdr`, `DELETE /api/merchants/:id/limits-mdr` | super_admin, admin | Set or reset the merchant's own limits/MDR (see file 08). |
| `PATCH /api/merchants/:id/terminate`, `POST /api/merchants/bulk-terminate`, `DELETE /api/merchants/:id/drive-files`, `DELETE /api/merchants/:id/permanent`, `DELETE /api/merchants/:id`, `POST /api/merchants/bulk-delete` | See file 09 | Termination, Drive-file trash, permanent delete and soft delete. |

Routes live in `backend/src/modules/merchants/merchants.routes.ts`, mounted at `/api/merchants`; every route requires authentication. List, header, overview, form, history, and limits reads are open to all roles; the writes are role-checked (see the permissions table).

Priority-change request body: `{ priority: normal|high, note?: string (max 500) }`. The note is trimmed, and an empty or missing note is stored as `null`, so a priority change without a note **clears** the previous priority note (`updatePrioritySchema` and `bulkPrioritySchema` in `backend/src/modules/merchants/merchants.schemas.ts`). The priority dialog pre-fills the note box with the current note, so a staff member who only changes the priority keeps the note only if it is still in the box.

### List query (`listMerchantsQuerySchema` in `merchants.schemas.ts`)

| Parameter | Rule |
|---|---|
| `cursor` | Keyset cursor. |
| `limit` | 1–100 (default 30). Outside 1–100 is rejected (400) with the Zod message as the error text (`zodValidator` in `backend/src/lib/validators.ts`). |
| `search` | Max 200 characters. |
| `status` / `priority` / `currency` / `businessScope` | Comma-separated. |
| `createdAtFrom`, `createdAtTo` | Date range. |
| `epStatus` | EP case status filter. |
| `sortBy` | One of the eight sortable columns, default `createdAt`. An invalid `sortBy` is rejected by the Zod schema (400). |
| `sortOrder` | `asc` / `desc`, default `desc`. |

## Frontend — how the pages are built

| Piece | What it does |
|---|---|
| **Routes** | `frontend/src/routes/_app.merchants.tsx` (layout), `_app.merchants.index.tsx` (list), `_app.merchants.$merchantId.tsx` (detail layout with the tab bar), `_app.merchants.$merchantId.index.tsx` (redirect to overview), `…/overview.tsx`, `…/form.tsx`, `…/limits.tsx`, `…/history.tsx`. The detail layout is `frontend/src/features/merchants/merchant-details.tsx`. |
| **List** | `frontend/src/features/merchants/merchants-table.tsx` (table, filters, bulk selection) with columns in `merchants-columns.tsx`, table state/context in `merchants-table-context.tsx`, and helpers in `merchants-table-utils.ts`. The sortable columns are `merchantNumber`, `businessName`, `status`, `priority`, `createdAt`, `businessScope`, `ownerFullName`, `updatedAt`. The priority cell shows a badge and, for editors, a button to change it; it also shows the priority note as a tooltip. The open-cases cell links to the cases list pre-filtered to that merchant's open cases (`status: new,working,awaiting_merchant`). Row actions are hidden by status: terminate only when the merchant is not terminated; the Drive-trash icon only for a super admin when the merchant is terminated and its Drive files are not yet moved (after that, a non-clickable icon shows the date); delete only for a super admin when it is terminated (it opens the permanent-delete dialog, file 09). The Trigger Case bulk button is shown to users who pass `useCanTriggerCases()`. Priority editing is also hidden for terminated merchants. |
| **Detail tabs** | `merchant-overview-tab.tsx`, `merchant-form-tab.tsx`, `merchant-limits-mdr-tab.tsx`, `merchant-history-tab.tsx`, plus `merchant-detail-helpers.ts`, `merchant-payment-method-details.tsx`, and `merchant-drive-files-dialog.tsx` (a confirmation, "Move Google Drive files to trash?", for a terminated merchant; it does not list the files. See file 09). Priority editing uses `merchants-priority-dialog.tsx`. |
| **API calls** | `frontend/src/apis/merchants.ts`: `fetchMerchants()` (`GET /api/merchants`, strips empty values so they do not appear as `"undefined"` in the query string), `fetchMerchantHeader()`, `fetchMerchantOverview()`, `fetchMerchantForm()`, `fetchMerchantLimits()`, `fetchMerchantHistory()`, `updateMerchantPriority()`, `terminateMerchant()`, `deleteMerchantDriveFiles()`, `permanentlyDeleteMerchant()`, `bulkTerminateMerchants()`, `bulkUpdatePriority()`. There is **no** frontend client for `DELETE /api/merchants/:id` or `POST /api/merchants/bulk-delete`: the soft-delete endpoints exist only in the backend (see file 09). The delete dialog (`frontend/src/features/merchants/merchant-delete-dialog.tsx`, "Delete permanently") calls `permanentlyDeleteMerchant()` only. |
| **Schemas** | `frontend/src/schemas/merchants.schema.ts`: `MERCHANT_STATUSES` (`pending`, `testing`, `live`, `terminated`), `PRIORITIES` (`normal`, `high`), `BUSINESS_SCOPES` (`local`, `international`), `MERCHANT_SORTABLE_COLUMNS`, `EP_CASE_STATUS_FILTERS`, the list-item, header, overview, form, limits, and history response schemas, and the route-search schema. |

## Backend — how the list and detail are built

| Piece | Detail |
|---|---|
| **List service** | `listMerchants()` in `backend/src/modules/merchants/merchants.service.ts`: soft-deleted merchants (`deletedAt` not null) are always excluded. Search matches business name, submitter email, and owner full name with case-insensitive `ilike`, plus an exact merchant-number match when the search text is an integer. Date filters are strict greater-than / less-than on `createdAt` (an invalid date is silently ignored, not an error). The `epStatus` filter narrows to merchants whose latest EP-sub-merchant case has that status. Pagination is keyset-based (a cursor encoding the sort value and id), `limit + 1` rows are fetched to know whether there is another page, and `total` is counted only on the first page (`null` afterwards). Each row carries `openCasesCount` (a subquery counting that merchant's cases whose status is not `closed`) and the latest EP cases for the page. |
| **Detail service** | `getMerchantHeader()`, `getMerchantOverview()`, `getMerchantForm()`, `getMerchantHistory()`, `getMerchantLimits()` in `merchants.service.ts`. All of them first load the merchant through `requireMerchant()` — which, in the code reviewed, returns 404 for a soft-deleted merchant (the detail page therefore cannot be opened for a soft-deleted merchant). Overview counts cases by status (`working`, open vs closed, SLA-breached open cases) and includes the effective limits bundle. History lists the merchant's cases with SLA state and a timeline built from case history. The form endpoint returns the full merchant record (via `toFormMerchant()`), the documents, and the received agreement. |
| **Priority** | `updateMerchantPriority()` runs in a transaction: the merchant must exist, not be soft-deleted, and not be terminated (terminated → 409 "Terminated merchant priority cannot be changed."). It updates the merchant's `priority` and `priorityNote`, and also updates the `priority` of all of that merchant's cases (open and closed — the update is not filtered by case status in the code reviewed). Bulk priority (`bulkUpdatePriority()`) does the same for up to 100 merchants; unknown or deleted ids fail the whole request with 404 ("One or more merchants were not found.") instead of being skipped. Terminated merchants in a bulk request are **silently skipped** (no 409, no error): the update's `WHERE` excludes them, and `updatedCount` simply comes back lower. The frontend removes terminated rows from the selection first, so this is mainly a direct-API behaviour. Only merchants that were actually updated get their cases' priority changed. The note rule is the same as for a single change (a missing note clears it). |
| **Merchant number** | `merchants.merchantNumber` is a database `serial` — a sequential number assigned on insert, unique. It is the human-friendly identifier staff see and search by; the UUID `id` is the technical identifier used in URLs and API paths. |

## Data, validation and edge cases

- **Visibility.** Every signed-in role reads every merchant's full record, including bank and Drive details. This is the gap recorded in file 32 (gap 6: merchant reads are not queue-scoped).
- **Soft-deleted merchants vanish from the list and the detail page.** `deletedAt` is set by soft delete (file 09). In the UI, soft delete is never called (the table's Delete button performs a permanent delete), so this state is reachable only through the API. The list always filters them out, and `requireMerchant()` rejects them with 404. There is no "show deleted merchants" view in the code reviewed — once soft-deleted, a merchant can only come back by direct database action.
- **Terminated merchants are hidden by default but not gone.** The backend returns them if asked; the frontend simply defaults the status filter to everything except `terminated`.
- **Invalid filter values are ignored, not rejected** (see file 32, finding L8). Unknown status/priority/scope/EP-status values in the comma-separated filters are dropped by `parseCsvValues()`; an invalid `createdAtFrom`/`createdAtTo` is ignored. The `currency` filter is not validated at all: any string is passed to the query. An invalid `sortBy` is rejected by the Zod schema (400). A `limit` outside 1–100 is rejected (400).
- **Terminated merchants cannot be re-prioritised.** The single change returns 409 "Terminated merchant priority cannot be changed."; the bulk change skips them silently (see the priority section).
- **Case counts are live, not stored.** `openCasesCount` is computed by a subquery on every list request, and the overview counts are computed from the merchant's cases on every detail request. There is no cached counter to go stale.
- **Priority changes ripple to cases.** Changing a merchant's priority updates all of its cases' priorities in the same transaction. The reason (visible in the code, not in a user-facing label) is that case queues and workload views sort/filter by case priority; keeping them in step avoids a merchant marked urgent whose cases still look normal. Whether closed cases should also change was not a deliberate choice visible in the code — it is a side effect of the unfiltered update.
- **EP status in the list.** The `epStatus` filter and the per-row EP case summaries come from `getEpQueueIds()` / `getLatestEpCases()` in `backend/src/modules/cases/ep-sub-merchant.service.ts`. The EP queues are the queues whose `workflowType` is `sub_merchant_form` (see file 20). The filter values and what they match (`buildEpCaseStatusFilter()` / `epCaseStatusCondition()`):
  - `not_created`: merchants with **no** case in an EP queue. With no EP queue configured, this matches **every** merchant.
  - `new`, `working`, `awaiting_merchant`: merchants with any EP case in that status.
  - `closed_successful`: any EP case closed with outcome `successful`.
  - `closed_unsuccessful`: an EP case closed `unsuccessful` that has not been superseded by a newer EP case for the same merchant, queue and sub-merchant.
  
  With no EP queue configured, the other four values match nothing. Values not in this list are dropped silently; if none remain, no EP filter is applied.
- **Not found in the code reviewed:** an export (CSV/Excel) of the merchants list; a way to merge two merchant records; a way to edit a submitted form field from the detail page (the form tab is read-only in the code reviewed — corrections go through resubmission, file 06); a display of the merchant's Drive folder links on the overview tab (Drive files have their own dialog).

## What to check — is this what you intended?

- [ ] Is it right that every employee — including agents with no queue access — can see every merchant and every submitted document? Or should merchant visibility be limited somehow?
- [ ] Terminated merchants are hidden by default. Should they be hidden, or should staff always see them (marked clearly) so nothing is missed?
- [ ] Priority (`normal`/`high`) changes the merchant and all its cases at once. Is that the meaning you want — "this merchant is urgent everywhere" — or should case priority be set per case?
- [ ] The list has no export. Do you need to export merchants (for example, for reporting or for the bank), and if so, which columns?
- [ ] Clearing a priority note: a priority change made without re-entering the note deletes the old note. Is that intended, or should an empty note keep the existing one?
- [ ] Bulk delete exists in the backend but has no button. Is that deliberate, given that delete is permanent in the UI?
- [ ] Currency and the created-date range can be used in the URL and the API but have no filter control. Should staff have them on screen?
- [ ] Should staff be able to correct a typo in a submitted form (name spelling, phone number) directly from the detail page, or must every correction go through the merchant via resubmission?

---
*Sources: `frontend/src/features/merchants/merchant-delete-dialog.tsx`, `frontend/src/features/cases/trigger-case-dialog.tsx`, `backend/src/db/schema.ts`, `backend/src/lib/validators.ts`, `backend/src/modules/cases/ep-sub-merchant.service.ts`, `backend/src/modules/merchants/merchants.schemas.ts` (also read: `merchants.routes.ts` and `merchants.service.ts`, listed below), `frontend/src/routes/_app.merchants.tsx`, `frontend/src/routes/_app.merchants.index.tsx`, `frontend/src/routes/_app.merchants.$merchantId.tsx`, `frontend/src/routes/_app.merchants.$merchantId.index.tsx`, `frontend/src/routes/_app.merchants.$merchantId.overview.tsx`, `frontend/src/routes/_app.merchants.$merchantId.form.tsx`, `frontend/src/routes/_app.merchants.$merchantId.limits.tsx`, `frontend/src/routes/_app.merchants.$merchantId.history.tsx`, `frontend/src/features/merchants/merchants-table.tsx`, `frontend/src/features/merchants/merchants-columns.tsx`, `frontend/src/features/merchants/merchants-table-context.tsx`, `frontend/src/features/merchants/merchants-table-utils.ts`, `frontend/src/features/merchants/merchant-details.tsx`, `frontend/src/features/merchants/merchant-detail-tabs.ts`, `frontend/src/features/merchants/merchant-overview-tab.tsx`, `frontend/src/features/merchants/merchant-form-tab.tsx`, `frontend/src/features/merchants/merchant-limits-mdr-tab.tsx`, `frontend/src/features/merchants/merchant-history-tab.tsx`, `frontend/src/features/merchants/merchant-detail-helpers.ts`, `frontend/src/features/merchants/merchant-payment-method-details.tsx`, `frontend/src/features/merchants/merchant-drive-files-dialog.tsx`, `frontend/src/features/merchants/merchants-priority-dialog.tsx`, `frontend/src/features/cases/trigger-case-dialog.tsx`, `frontend/src/apis/merchants.ts`, `frontend/src/schemas/merchants.schema.ts`, `backend/src/modules/merchants/merchants.routes.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchants.schemas.ts`. Related files: 08 (limits and MDR), 09 (termination and deletion), 20 (EP sub-merchants), 06 (resubmission).*
