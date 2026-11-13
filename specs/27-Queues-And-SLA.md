# 27 — Queues And SLA

## At a glance

| | |
|---|---|
| **What it is** | A **queue** is a stage of the onboarding pipeline — Documents Review, Agreement, MID Creation, Testing, WordPress Website, Live, EP Sub-Merchant Form, and Support Ticket (in the seed file only; the live database has seven queues, see The queues). Every case belongs to exactly one queue, and the queue decides three things about the case: what kind of work it is (the workflow type), what its case number looks like (the prefix), and how fast it must be handled (the SLA). |
| **SLA** | Service level agreement — the time allowed for a case, in hours, counted from when the case was created. If the case is still open after that time, it is "SLA breached". Breach is a flag, not an automatic action: the code reviewed does not escalate, reassign or notify anyone when a breach happens. It records the breach and shows it. |
| **Who can use it** | Any authenticated user can list queues. Queue detail and all queue changes are `super_admin` only — stricter than most configuration, which allows `admin` too. Nobody can create a queue or change its stages through the API. |
| **Where it lives** | Configuration → Queues (`/configuration/queues`, subtitle "Manage case queues and SLA settings.") |
| **Main API** | `GET /api/queues` · `GET /api/queues/:id` · `PATCH /api/queues/:id` · `PATCH /api/queues/:id/status` · `PATCH /api/queues/:id/sla` |
| **Main code** | Frontend: `src/features/configuration/panels/queues-panel.tsx` · Backend: `src/modules/queues/queues.routes.ts` + `queues.service.ts` + `queues.schemas.ts`, SLA computation in `src/modules/cases/case-sla.ts` |
| **Success looks like** | Each queue has a positive SLA, a prefix and a case-number sequence, and staff can see at a glance whether a case has breached its deadline. |

## How it works — the journey

```
Merchant submits → case created in a queue
        ↓
Deadline = case createdAt + queue slaHours
        ↓
Case worked through its stages
        ↓
Case closes (on time or late) — breach flag is computed from createdAt, slaHours and closedAt / now
        ↓
Dashboard counts breached cases · staff see the flag on case lists and the case page
```

## The queues

**Live database (production, `onboarding-portal` / `main`, read on the spec date): 7 queues.** The seed file `backend/sql/seed-queues.sql` lists eight, but **Support Ticket (`support-ticket`, `ST`) is not in the database**, and no migration creates or removes it; the seed was not run for that row. The table below is the seed list, with the live SLA values added.

Seeded in `backend/sql/seed-queues.sql`, idempotent `ON CONFLICT DO NOTHING` (running it again does not duplicate rows).

| Queue | Slug | Prefix | Live SLA (hours) | Live database |
|---|---|---|---|---|
| Documents Review | `documents-review` | `DR` | 24 | present |
| EP Sub-Merchant Form | `sub-merchant-form` | `SM` | 72 | present |
| Agreement | `agreement` | `AG` | 168 | present |
| MID Creation | `merchant-id` | `MI` | 24 | present |
| Testing | `testing` | `TS` | 24 | present |
| WordPress Website | `wordpress-website` | `WP` | 48 | present |
| Live | `live` | `LV` | 24 | present |
| Support Ticket | `support-ticket` | `ST` | — | **absent** |

All seven live queues are `lifecycle` `active` and `is_active` true. The Live queue's full definition is in migration `0050_ensure_live_queue.sql`.

The seed script sets only name, slug, prefix and the case-number row. Workflow types are set by migration `0047_queue_workflow_lifecycle.sql`, which maps each queue by slug (for example `documents-review` → `document_review`, `merchant-id` → `mid`, `wordpress-website` → `wordpress`, `support-ticket` → `generic`). SLA is the column default 24 (`0029_queue_sla_hours.sql`). The other queues' stages were created by their own migrations, so the seed list alone does not describe a working queue. A second copy of the seed is in `drizzle/seed-queues.sql` (file 32, gap 16), and `sql/seed-queue-stages.sql` is empty (file 32, gap 18).

## Who can use it

| Who | What they can do |
|---|---|
| Any authenticated user | Call `GET /api/queues` (active queues by default). |
| `super_admin` only | `GET /api/queues/:id` (full detail), and changing a queue (name, prefix, workflow type, lifecycle, SLA) or its status through the API. The routes in `backend/src/modules/queues/queues.routes.ts` all use `requireRoles('super_admin')` for `GET /:id`, `PATCH /:id`, `PATCH /:id/status` and `PATCH /:id/sla`. The page itself only uses the SLA endpoint (see below). |
| `admin` | Can open the Queues configuration page (`/configuration/queues`) — the route `_app.configuration.tsx` allows `super_admin` and `admin` — and the page shows an **Edit SLA** dialog to them too. Saving it fails: the backend returns `403` ("Insufficient permissions.") and the page shows that message in an error toast (the "Failed to update queue SLA." text is only the fallback when the server gives no message). The page does not hide the control from admins. |
| Nobody, through the API | Create a queue, or create, edit, reorder, deactivate or delete stages. There is no endpoint for creating a queue or for creating, editing, reordering, deactivating or deleting stages. Developers add a queue or change stages through a forward-only migration in `drizzle/` (see `drizzle/0050_ensure_live_queue.sql` for the pattern). A new queue needs its `queues` row, its `queue_case_sequences` row, and its `queue_stages`, plus any backend/frontend code its workflow type needs. |
| Every staff member who can see a case | See whether it breached SLA (the `slaBreached` flag is part of the case list/detail responses). |

## The queue list

1. An admin opens **Configuration → Queues** (`/configuration/queues`, subtitle "Manage case queues and SLA settings.").
2. The page lists every queue with its name and slug, workflow type badge, prefix, SLA in hours, lifecycle badge and created date. The panel calls the API with `includeInactive=true`, so draft and inactive queues are shown too. (The API itself returns active queues only unless `?includeInactive=true` is sent.) If there are no queues, the page says "No queues configured." and "Queues are added by developers through a release."

## Changing a queue

### Edit — `PATCH /api/queues/:id`

Body must include `revision` (required on this route, minimum 1). Changes the name, prefix, workflow type, lifecycle or SLA in one transaction. The queues panel never calls this endpoint (see Frontend).

| Rule | Detail |
|---|---|
| Prefix immutable once cases exist | Changing the prefix returns `409` ("Queue prefix cannot be changed after cases exist."). |
| Workflow type immutable once cases exist | Changing it returns `409` ("Queue workflow type cannot be changed after cases exist."). |
| Activating (`lifecycle: 'active'`) | Runs the readiness checks; an incomplete definition returns `422` ("Queue is not ready for activation.", with `issues`) and nothing is written. |
| Stale `revision` | Returns `409` ("Queue was updated by someone else. Reload and try again.") with the current `revision`. |
| Retired workflow type | The workflow type `physical_agreement` is rejected outright (`400` "The Physical Agreement workflow has been retired."). |
| Field limits | `prefix` must be 1–4 uppercase letters (`400` "Prefix must be 1-4 uppercase letters."); `name` 1–120 characters; `slaHours` an integer from 1 to 8760; `revision` an integer of at least 1. Unknown fields are rejected. |
| Lifecycle moves | Allowed moves are `draft` → `active` or `inactive`, `active` ↔ `inactive`, and `inactive` → `active`. Nothing can move back to `draft`. Any other move returns `409` ("A queue cannot move from {current} to {next}."). Sending both `lifecycle` and `isActive` returns `400` ("Provide either lifecycle or isActive, not both."). |

### Change status — `PATCH /api/queues/:id/status`

Set `lifecycle` (`draft` | `active` | `inactive`) or the legacy `isActive` boolean, but not both (`400` "Provide lifecycle or isActive." if neither is sent). `revision` is optional. Activating runs the same readiness checks (`422` if not ready). The same lifecycle-move rules as above apply. The response is the queue without its `stages`.

### Change SLA — `PATCH /api/queues/:id/sla`

Set `slaHours` (integer, 1 to 8760). `revision` is optional. On the page, each queue's SLA cell shows the value as "{n} hours" (or "hour" when it is 1). Clicking it opens an **Edit SLA** dialog with a numeric field labelled "SLA in Hours" (min 1, max 8760) and Cancel / Save buttons. Save sends the queue's current `revision`. The response is the queue without its `stages`.

Every successful mutation bumps the queue's `revision` by one (`bumpQueueRevision`). Only `PATCH /api/queues/:id` returns the queue with its `stages`; the status and SLA endpoints return the queue without them.

## Activation readiness

A queue can only be activated when its stored stage graph satisfies all of these (`evaluateQueueActivationReadiness` in `queues.service.ts`):

| # | Check | Detail |
|---|---|---|
| 1 | Exactly one active initial stage | `category: new`. Issue code `initial_stage`. A queue with no stages fails first with `stages_required`. |
| 2 | At least one active terminal stage | `category: closed`. Issue code `terminal_stage`. |
| 3 | Unique stage order and slug | Checked by `validateStageDefinitions` (`queue-workflow.ts`). Issue codes `stage_order` (order must be positive), `stage_order_unique` and `stage_slug_unique`. |
| 4 | A prefix is set | Issue code `prefix_required`. |
| 5 | A case sequence exists | Issue code `sequence_required` — the `queue_case_sequences` row that numbers cases `DR-…`, `LV-…`. |
| 6 | SLA is positive | Issue code `sla_positive` — `slaHours > 0`, also enforced by the database check `queues_sla_hours_positive`. |
| 7 | Required capabilities present | Issue code `capability_required` — any capabilities the workflow type requires are present on active stages. In the code reviewed the required capability list is empty for every workflow type (`document_review`, `agreement`, `mid`, `testing`, `wordpress`, `physical_agreement`, `live`, `sub_merchant_form`, `generic` all map to `[]`), so this check currently never fires. |

The detail endpoint returns the queue with its `stages` and an `activation` object: `{ ready: boolean, issues: [{ code, message }] }`.

## SLA — how breach is decided

1. Each queue has `slaHours` (integer, column default 24; the API accepts 1 to 8760 and the database check requires > 0). The Live queue is seeded with 24. Other queues' SLA values were set by their migrations or by an admin on this page. The live values are in the queue table above; the code's only default is 24 hours (the column default and the fallback).
2. A case's deadline is `createdAt + slaHours` (from its queue at the time of the check). Both the backend (`case-sla.ts`, `isCaseSlaBreached`) and the frontend (`lib/sla.ts`, `getSlaStatus`, `getCaseSlaStatus`) compute it the same way, falling back to 24 hours when the queue has no positive SLA value (`DEFAULT_CASE_SLA_HOURS = 24`, `DEFAULT_SLA_HOURS = 24`).
3. The case is breached when the evaluation time is after the deadline (`evaluatedAt > createdAt + slaHours`, strictly after). For a case that closes, the evaluation time is the close time (`closedAt`), so a case closed late is marked breached; for an open case the frontend and merchant list use the current time. The stored flag `cases.slaBreached` is a nullable boolean: `true` means breached, `false` means not breached, `null` means it has not been evaluated. It is reset to `null` when a closed case is reopened (the leaving-terminal branch in `case-transition.service.ts`) and when a case is returned to the pool or has its owner cleared (`case-assignment.service.ts`, the `return_to_pool` write and the `ownerId === null` branch). Open cases therefore normally hold `null`, and their breach is worked out on read.
4. The stored flag is written only when a case moves into a closed (terminal) stage. In `case-transition.service.ts` (and `case-stage.service.ts` when advancing to closed), if the caller does not supply `slaBreached`, the code computes it from the case's `createdAt`, the queue's `slaHours` and the close time. When a case leaves a terminal stage, the transition code clears `closedAt` and sets `slaBreached` to `null`. Open cases do not have the stored flag rewritten on every change; their breach is evaluated on read (see point 5).
5. The frontend shows the breach in case lists and on the case page (`getCaseSlaStatus`: a stored boolean overrides the computed value, otherwise the live computation is used). The dashboard reports two figures in `dashboard.service.ts`: `slaBreached`, which is `count(*) filter (where slaBreached = true)` and so counts only closed cases flagged at close, and `openOverSla`, which counts open cases where `now()` is past `createdAt + slaHours`, computed live in SQL. For a merchant's case list, `merchants.service.ts` recomputes breach live for open cases; closed cases use the stored flag (treated as `false` when it is `null`).

## Endpoints

All behind `requireAuth`; mutations and detail behind `requireRoles('super_admin')`.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/queues` | List queues (`?includeInactive=true` adds draft and inactive ones; active only by default). |
| `GET` | `/api/queues/:id` | Full detail, with stages and the `activation` object. Super admin only. |
| `PATCH` | `/api/queues/:id` | Edit name, prefix, workflow type, lifecycle or SLA in one transaction. Body includes `revision`. |
| `PATCH` | `/api/queues/:id/status` | Set `lifecycle` or legacy `isActive` (exactly one). `revision` optional. |
| `PATCH` | `/api/queues/:id/sla` | Set `slaHours`. `revision` optional. |

## How it is implemented — Frontend

| Piece | File / detail |
|---|---|
| Page route | `frontend/src/routes/_app.configuration.queues.tsx` (title "Queues", subtitle "Manage case queues and SLA settings."). |
| Panel | `frontend/src/features/configuration/panels/queues-panel.tsx` — table with queue name and slug, workflow badge (`WorkflowBadge`, from `WORKFLOW_OPTIONS`), prefix, SLA cell (opens the Edit SLA dialog; `DEFAULT_SLA_HOURS` fallback), lifecycle badge (`LifecycleBadge`, from `LIFECYCLE_META`) and created date. The only edit control is the SLA dialog: there is no UI for renaming a queue, changing its prefix or workflow type, or changing its lifecycle (status), so those endpoints are API-only in the code reviewed. The panel loads the list with `includeInactive: true`. |
| List data | `queuesQueryOptions` in `frontend/src/hooks/use-cases-query.ts` (query key cached 5 minutes) → `fetchQueues` → `GET /api/queues`. |
| SLA save | `useUpdateQueueSlaMutation` in `frontend/src/hooks/use-configuration-query.ts` (success toast "Queue SLA updated.", error toast from the API message) → `updateQueueSla` in `frontend/src/apis/configuration.ts` → `PATCH /api/queues/:id/sla`, sending `slaHours` and the queue's `revision`. |
| SLA display | `frontend/src/lib/sla.ts` (`getSlaStatus`, `getCaseSlaStatus`, `SlaStatus` type with `slaHours`, `deadline`, `isBreached`, `hoursElapsed`, `hoursRemaining`). When a stored `slaBreached` boolean exists it overrides the computed value; otherwise the computed value is used. |
| Labels | Workflow-type labels (`WORKFLOW_OPTIONS`) and lifecycle labels (`LIFECYCLE_META`: Active, Draft, Inactive) are defined in `queues-panel.tsx`. The backend string unions live in `backend/src/contracts/queues.ts`, which the frontend mirrors by hand. |

## How it is implemented — Backend

| Piece | File / detail |
|---|---|
| Routes | `backend/src/modules/queues/queues.routes.ts` (all behind `requireAuth`; mutations and detail behind `requireRoles('super_admin')`). |
| Service | `backend/src/modules/queues/queues.service.ts` — `listQueues`, `getQueueDetail`, `updateQueue`, `updateQueueStatus`, `updateQueueSla`, `evaluateQueueActivationReadiness`, `validateStageDefinitions`, `bumpQueueRevision`, `queueLifecycleFields`, `isActiveToLifecycle`. |
| Schemas | `backend/src/modules/queues/queues.schemas.ts` — `updateQueueSchema`, `updateQueueStatusSchema`, `updateQueueSlaSchema`. |
| SLA computation | `backend/src/modules/cases/case-sla.ts` — `isCaseSlaBreached`, `DEFAULT_CASE_SLA_HOURS = 24`. |
| Queue stages | `queueStages` table (`id`, `queueId`, `name`, `slug`, `order`, `category`, `isActive`, `capabilities`, `createdAt`). **Stage categories** (`stage_category` enum in `schema.ts`): exactly `new`, `in_progress`, `closed`. Only one active `new` stage and at least one active `closed` stage are required for activation. |
| Lifecycle, stage rules and templates | `backend/src/modules/queues/queue-workflow.ts` — `QUEUE_LIFECYCLE_TRANSITIONS` and `queueLifecycleFields` (the allowed lifecycle moves), `validateStageDefinitions` (readiness issue codes), and `getStageTemplateDefinitions` (default stages: `document_review` and `agreement` get New, Working, Awaiting Merchant, Closed; the other workflow types get New, Working, Closed). `queue-stage-defaults.ts` builds a queue's default stage rows from these templates and maps a case status to exactly one stage (`400` "No stage in this queue maps to status ..." when none or several match). |
| API documentation | `backend/apis/queues.md` — concepts (slug is only an identifier, `workflowType` is the behaviour key, `lifecycle` is the API field while `is_active` stays synced in the database), the activation rules, and the "no API for creating queues or stages" rule. It agrees with the code on all points checked. |

## Data, validation and edge cases

| Topic | Detail |
|---|---|
| **Workflow types** (`queue_workflow_type` enum in `schema.ts`) | `generic`, `document_review`, `agreement`, `mid`, `testing`, `wordpress`, `physical_agreement`, `live`, `sub_merchant_form`. Note that `physical_agreement` still exists in the enum and in the seed-era code, but the queue service refuses to set it (`400` "The Physical Agreement workflow has been retired.") and migration `0057_merge_physical_agreement_workflow.sql` merged that workflow away. `card` appears in the queues API doc's workflow list (`generic`, `document_review`, `agreement`, `mid`, `testing`, `wordpress`, `card`, `live`, `sub_merchant_form`) but **not** in the database enum in `schema.ts` — the doc is out of date on that point (migration `0081_drop_card_workflow_type.sql` dropped it). |
| **Lifecycle values** (`queue_lifecycle` enum) | `draft`, `active`, `inactive`. The API uses `lifecycle`; the database column `is_active` mirrors it (`active` ↔ `true`) under a check constraint. |
| **Case status values** (`case_status` enum) | `new`, `working`, `closed`, `awaiting_merchant`. |
| **Close outcome** (`case_close_outcome`) | `successful`, `unsuccessful`. |
| **`queues` table** | `id`, `name` (varchar 120, unique), `slug` (varchar 120, unique), `prefix` (varchar 4, unique — so a prefix can be at most 4 characters), `workflowType` (default `generic`), `lifecycle` (default `inactive`), `revision` (integer, default 1, check ≥ 1), `slaHours` (integer, default 24, check > 0), `isActive` (default `false`), `createdAt`. Migration `0029_queue_sla_hours.sql` added `sla_hours`; `0030_case_sla_breached.sql` added `cases.sla_breached`; `0047_queue_workflow_lifecycle.sql` added the revision, workflow type and lifecycle columns; `0104_queue_lifecycle_guard.sql` added the database guard on lifecycle moves. |
| **`queue_case_sequences`** | `queueId`, `last_number` — one row per queue; without it a queue cannot be activated and cases cannot be numbered. |
| **SLA is per queue, not per case** | Changing a queue's SLA changes the deadline for all its open cases from that moment (the deadline is computed from `createdAt + current slaHours`). It does not rewrite the stored `slaBreached` flag on existing cases until each case next changes state — a case that already breached under the old SLA keeps its flag until then, and a case that would breach under a shorter SLA is not flagged until it is next evaluated. This is a consequence of the code, not a stated design decision; confirm with the owner whether a SLA change should re-evaluate open cases immediately. |
| **No SLA pause** | Time in `awaiting_merchant` counts towards the SLA exactly like time in `working` — the computation uses only `createdAt` and the queue SLA. There is no pause, no business-hours adjustment, and no per-stage SLA in the code reviewed. |
| **No escalation on breach** | Nothing in the code reviewed sends a notification, reassigns the case, or raises its priority when `slaBreached` becomes true. The dashboard counts breached cases, and staff see the flag — that is the whole response. |
| **Optimistic concurrency** | Queue edits use `revision`; a stale revision returns `409` (`Queue was updated by someone else. Reload and try again.`) with the current revision. The status and SLA endpoints accept an optional `revision`; when it is omitted they use the revision they read in the same transaction, so they are protected only against a change in that short window. `bumpQueueRevision` is the only writer of the counter, and its conditional update (`WHERE revision = expected`) makes the losing one of two racing edits fail with `409`. |
| **Draft queues cannot receive cases** | Manual creation requires an active queue: `409` "This queue is inactive. Case creation is disabled." (`case-query.service.ts`). The case-flow engine rejects an inactive target queue with `409` "{queue name} is inactive. Automatic case creation is disabled." (`case-flow.service.ts`). The EP Sub-Merchant service also returns `409` "The EP Sub-Merchant queue is not active." (`ep-sub-merchant.service.ts`). |

## Request and response — technical

| Item | Detail |
|---|---|
| Request shape | `PATCH /api/queues/:id` takes `revision` plus the fields to change (name, prefix, workflow type, lifecycle, SLA). `PATCH /api/queues/:id/status` takes `lifecycle` (`draft` \| `active` \| `inactive`) or the legacy `isActive` boolean; `revision` is optional. `PATCH /api/queues/:id/sla` takes `slaHours`; `revision` is optional. |
| Response shape | Every successful mutation bumps `revision` by one. `PATCH /api/queues/:id` returns the queue with its `stages`; `PATCH /:id/status` and `PATCH /:id/sla` return the queue without `stages`. The detail endpoint returns the queue with its `stages` and an `activation` object: `{ ready: boolean, issues: [{ code, message }] }`. |
| Error codes | `403` — caller is not `super_admin` (`requireRoles` returns "Insufficient permissions."; this includes an `admin` opening the page and trying to save). `409` — prefix or workflow type changed after cases exist ("Queue prefix cannot be changed after cases exist." / "Queue workflow type cannot be changed after cases exist."), a stale `revision` (returned with the current `revision`), an illegal lifecycle move ("A queue cannot move from {current} to {next}."), or manual case creation for a non-active queue ("This queue is inactive. Case creation is disabled."). `400` — workflow type `physical_agreement` ("The Physical Agreement workflow has been retired."), a schema failure (the first Zod message), or both `lifecycle` and `isActive` sent. `404` — "Queue not found.". `422` — queue not ready for activation ("Queue is not ready for activation.", with `issues`). Schema failures on the mutation endpoints are returned as `400`. |

## What happens next — business rules

- When a case is created, its deadline is set by its queue's SLA (`createdAt + slaHours`). Staff work the case through its stages. The stored breach flag is written when the case closes and cleared when it leaves a closed stage; while open, breach is worked out from the current time.
- When a case breaches SLA, nothing automatic happens: no notification is sent, the case is not reassigned, and its priority does not rise. The dashboard counts breached cases, and staff see the flag on case lists and the case page — that is the whole response.
- When an admin changes a queue's SLA, the deadline for all its open cases changes from that moment (the deadline is computed from `createdAt + current slaHours`), but the stored `slaBreached` flag on existing cases is not rewritten until each case next changes state.
- When a case closes, a follow-up case can be created in the next queue by the case-flow engine (file 21) — the queue a case belongs to decides which queue follows it.

## What to check — is this what you intended?

- [ ] **SLA per queue:** the live database has Documents Review 24, EP Sub-Merchant Form 72, Agreement 168, MID Creation 24, Testing 24, WordPress Website 48, Live 24 hours. Are these the intended values? The code defaults to 24 hours where no value is set.
- [ ] **Support Ticket queue:** the seed file lists it, but the live database does not have it. Should it exist?
- [ ] **SLA pause:** should the SLA clock pause while a case is waiting for the merchant (`awaiting_merchant`), or is "time from creation, no pauses" correct?
- [ ] **Escalation on breach:** should anything happen automatically when a case breaches SLA — a notification, a priority rise to `high`, an escalation to an admin — or is showing the flag and counting it on the dashboard enough?
- [ ] **SLA change re-evaluation:** when an admin changes a queue's SLA, should all open cases in that queue be re-evaluated immediately, or only when they next change state (today's behaviour)?
- [ ] **Admin access:** the Queues page is visible to admins and shows the Edit SLA dialog, but saving is super-admin-only (`403`). Should admins be able to change SLA, or should the page hide the edit control from them?
- [ ] **Cleanup:** the API doc still lists a `card` workflow type that the database no longer has, and the Physical Agreement workflow is retired but still in the enum. Should the docs and the enum be cleaned up?
- [ ] **New queues:** do you ever need a new queue or a new stage without a developer and a migration, or is "queues and stages change only by migration" the right rule?
- [ ] **Queue edit screen:** the panel only edits SLA. Renaming a queue, changing its prefix or workflow type, and switching its lifecycle (activate or deactivate) are API-only, and no frontend code calls them. Is API-only right, or should super admins get these controls on the page?

---

Default stages for a queue come from its workflow type (`modules/queues/queue-stage-defaults.ts`), and the two seed copies are listed in file 34 with the gaps in file 32 (gaps 16–18).

*Sources: `frontend/src/routes/_app.configuration.queues.tsx`, `frontend/src/routes/_app.configuration.tsx`, `frontend/src/features/configuration/panels/queues-panel.tsx`, `frontend/src/apis/configuration.ts`, `frontend/src/apis/cases.ts`, `frontend/src/hooks/use-configuration-query.ts`, `frontend/src/hooks/use-cases-query.ts`, `frontend/src/lib/sla.ts`, `backend/src/modules/queues/queues.routes.ts`, `backend/src/modules/queues/queues.service.ts`, `backend/src/modules/queues/queues.schemas.ts`, `backend/src/modules/queues/queue-workflow.ts`, `backend/src/modules/queues/queue-stage-defaults.ts`, `backend/src/modules/cases/case-sla.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/case-flow.service.ts`, `backend/src/modules/cases/case-stage.service.ts`, `backend/src/modules/cases/case-transition.service.ts`, `backend/src/modules/cases/case-assignment.service.ts`, `backend/src/modules/cases/ep-sub-merchant.service.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/dashboard/dashboard.service.ts`, `backend/src/db/schema.ts`, `backend/src/contracts/queues.ts`, `backend/apis/queues.md`, `backend/sql/seed-queues.sql`, `backend/drizzle/0029_queue_sla_hours.sql`, `backend/drizzle/0030_case_sla_breached.sql`, `backend/drizzle/0047_queue_workflow_lifecycle.sql`, `backend/drizzle/0050_ensure_live_queue.sql`, `backend/drizzle/0057_merge_physical_agreement_workflow.sql`, `backend/drizzle/0081_drop_card_workflow_type.sql`, `backend/drizzle/0104_queue_lifecycle_guard.sql`. Related files: 11 (Cases List), 12 (Case Detail), 19 (Live Activation), 21 (case-flow engine), 30 (database), 32 (known gaps).*
