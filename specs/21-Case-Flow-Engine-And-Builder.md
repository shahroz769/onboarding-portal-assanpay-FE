# 21 — Case Flow Engine And Builder

## At a glance

| | |
|---|---|
| **What it is** | The rulebook that decides which cases are created automatically, and in what order. Instead of staff remembering "after Documents Review comes Agreement, then MID Creation…", an admin draws that chain once in the Caseflow Builder, and the system follows it for every merchant. |
| **Who can use it** | `super_admin` and `admin` only for viewing/editing the flow and for recovering failed follow-up jobs. Agents cannot open the Caseflow Builder. Everyone else is affected by the rules without seeing them. |
| **Where it lives** | Configuration → Caseflow Builder (`/configuration/case-flow-rules`). |
| **What it creates** | New immutable versions of the whole flow on every publish; durable follow-up jobs in `case_flow_close_jobs`; links in `case_links` for every automatically created case. A rule that targets the EP Sub-Merchant queue creates one EP case per selected sub-merchant (see file 20). |
| **Main API** | `GET /api/configuration/case-flow` · `PUT /api/configuration/case-flow` · `GET /api/cases/flow-jobs/failed` · `POST /api/cases/flow-jobs/:jobId/retry` |
| **Main code** | Frontend: `src/features/configuration/workflow-builder/workflow-builder-panel.tsx` · Backend: `src/modules/configuration/configuration.service.ts` + `src/modules/cases/case-flow.service.ts` |
| **Success looks like** | A merchant submits the form and the right cases appear, in the right order, with no staff member having to remember the chain. |

## In plain words — for a non-technical reader

The case-flow engine is the rulebook for onboarding: it decides which case comes next, automatically, so nobody has to remember the chain. An admin draws the chain once in the Caseflow Builder — which cases start when a merchant applies, which case follows a successful close, and which cases cannot be created or closed until another case is finished. The system then follows that drawing for every merchant. Publishing a new version of the rules does not move merchants who are already part-way through; moving them is a separate, deliberate step. If a follow-up case fails to appear, an admin can retry it or backfill the missing cases. What happens next: the right cases appear in the right order for each merchant, until Live activation (file 19) finishes onboarding.

## Technical summary — for a developer

| Area | Detail |
|---|---|
| Routes / endpoints | `GET /api/configuration/case-flow`, `GET /api/configuration/case-flow/versions/:versionId`, `PUT /api/configuration/case-flow`, `GET /api/configuration/case-flow/merchant-move/preview`, `POST /api/configuration/case-flow/merchant-move`, `GET /api/cases/flow-jobs/failed`, `POST /api/cases/flow-jobs/:jobId/retry`, `GET /api/cases/flow-jobs/backfill/preview?triggerId=…`, `POST /api/cases/flow-jobs/backfill` |
| Request / response | `PUT` carries a `revision` and the full rule set, returns the new revision and rules; merchant move body `{ revision, reason }` (plus `moveExistingMerchants: true` + required `changeNote` max 1000 chars on publish); backfill body `{ triggerId }` |
| Validation | Error messages include `Creation requirements contain a cycle`, `Close requirements contain a cycle`, `Active rules cannot reference inactive queues: …`, `Queues are missing a usable initial stage: …`, `Queues are missing a usable terminal stage: …` and `First-case queues cannot also require another case to close first: …` (`configuration.service.ts`). Also: no cycles in creation requirements or close blockers, no duplicate active edges, no impossible trigger/requirement combinations, no inactive queue targets, no targets without usable initial/terminal stages; each rule list max 500 entries, `order` integer ≥ 1 (default 1), a queue cannot trigger/block/require itself; stale `revision` → `409` |
| Database | `case_flow_start_rules`, `case_flow_close_triggers`, `case_flow_close_blockers`, `case_flow_creation_requirements` (all with `flowVersionId`, `isActive` default `true`); `case_flow_versions`, `flow_configuration_revisions` (singleton `id = 1`), `case_flow_merchant_moves` / `case_flow_merchant_move_items`; `case_flow_close_jobs` (generated `status`: `pending` \| `retrying` \| `failed` \| `blocked` \| `completed`); `case_links` (unique on `childCaseId`); published versions/rules immutable via DB triggers (`case_flow_versions_immutable` and the per-rule `*_immutable` triggers, migration `0075`). Other DB guards: `enqueue_case_flow_jobs_after_successful_close` (migration `0075`, a second writer of close jobs, deduplicated by the unique index); `protect_case_flow_queue_definition` (rejects changes to a queue's lifecycle, active flag, workflow type or slug, changes to its stages, and deletes, while a published flow uses the queue; error `Queue definition is required by a published flow`; migration `0084`); `enforce_case_flow_close_job_state` (a completed job cannot be reopened; migration `0109`); `merchants_pin_flow_version`, `cases_inherit_flow_version` and `case_flow_jobs_inherit_version` (set flow versions on insert and update; migrations `0075` and `0099`) |
| Auth / roles | `super_admin` / `admin` only (`requireRoles` in `configuration.routes.ts`); agents cannot open the builder |
| Errors | `409` creation/close blocked ("Close … before creating/closing this case."), `409` stale revision, `409` job flow-version mismatch (classed as a client error, so the job is `blocked`), failed-job list capped at 100 rows, `400 Invalid case-flow job ID.` (bad job id), `404 Problem case-flow job not found.` (manual retry of a job with no open error) |
| Integrations / limits | Worker: `CASE_FLOW_WORKER_POLL_MS` 1000, idle poll 15 min (900,000 ms), batch 5, degraded after 8 attempts, retry base 30,000 ms, retry max 15 min, blocked retry 6 h, jitter 10% (`CASE_FLOW_WORKER_DEGRADED_AFTER_ATTEMPTS` defaults to `CASE_FLOW_WORKER_MAX_ATTEMPTS`, then 8); `CASE_FLOW_WORKER_POLL_MS` is limited to 250–60,000 ms and the idle poll to 250 ms–1 h; each job runs under a Postgres advisory lock on (merchant, target queue) inside a savepoint; jobs claimed `FOR UPDATE SKIP LOCKED`, oldest `availableAt` first, `onlyIfTargetMissing: true`, unique index on (`sourceCaseId`, `targetQueueId`); health via `GET /health/db`; Agreement → Live seeded by migration `0074` (not hard-enforced, see the note under "The four kinds of rule") |

## How it works — the journey

```
Merchant submits the onboarding form
        ↓
triggerStartCasesForMerchant reads the merchant's flow version
and creates one case per active start rule, in order order
        ↓
Staff work a case → close it successfully
        ↓
enqueueCasesAfterSuccessfulClose creates one durable job
per target queue in case_flow_close_jobs (onlyIfTargetMissing: true)
        ↓
Background worker claims due jobs (oldest first) and creates
the follow-up case (or finishes the job without creating one
if the merchant is terminated/deleted)
        ↓
Transient failures retry with exponential back-off (30 s base,
15 min cap); after 8 of them the job is `failed` ("degraded"),
still retrying every 15 min. Client errors (4xx) make it `blocked`,
retried every 6 hours
```

## The four kinds of rule

Together they describe the whole onboarding chain:

| # | Rule | What it means |
|---|---|---|
| 1 | **Start rules** | Which queues get a first case when a merchant submits the onboarding form. |
| 2 | **Close triggers** | When a case in one queue closes successfully, which queue gets a new case next. |
| 3 | **Close blockers** | A case in one queue cannot close until a case in another queue has closed successfully for the same merchant. |
| 4 | **Creation requirements** | A case in one queue cannot be created until a case in another queue has closed successfully for the same merchant. |

Rules are **global for all merchants**. There is no per-merchant rule in the code reviewed. What varies per merchant is which version of the rules they are on (see "Versions and merchant moves" below).

> ⚠️ **Agreement → Live is seeded by a migration, not enforced by the builder:** a successfully closed Agreement case creates the Live case (see file 19). Migration `0074_agreement_driven_live.sql` inserts that close trigger if it is missing, removes the redundant Agreement → Live creation requirement, and adds the database trigger `cases_prevent_duplicate_live_case`, which refuses a second Live case for a merchant. Nothing in the builder code stops an admin from deactivating or editing the trigger afterwards (no guard found in `configuration.service.ts`).

## Who can use it

| Action | Who |
|---|---|
| Viewing and editing the flow | `super_admin` and `admin` only. All configuration routes below the `requireRoles('super_admin', 'admin')` line in `backend/src/modules/configuration/configuration.routes.ts` enforce this, including `GET /api/configuration/case-flow` and `PUT /api/configuration/case-flow`. |
| Opening the builder | `super_admin` / `admin` only. The navigation entry "Caseflow Builder" (`/configuration/case-flow-rules`) sits under Configuration, which is itself restricted to `super_admin` and `admin` (`frontend/src/config/navigation.ts`). Agents and other staff cannot open it. |
| Recovery of failed follow-up jobs | `super_admin` and `admin` only (`GET /api/cases/flow-jobs/failed`, `POST /api/cases/flow-jobs/:jobId/retry`, `GET /api/cases/flow-jobs/backfill/preview`, `POST /api/cases/flow-jobs/backfill`). |
| Everyone else | Affected by the rules without seeing them: cases appear automatically, and close/create buttons fail with a `409` when a rule is not satisfied. |

## Step by step

### Editing the flow in the builder

1. An admin opens **Configuration → Caseflow Builder** (`/configuration/case-flow-rules`).
2. The builder shows a visual graph of queues as nodes and rules as edges. The canvas is `workflow-canvas.tsx`; node types are `workflow-builder/nodes/queue-node.tsx` and `submission-node.tsx`; edges are `workflow-builder/edges/flow-edge.tsx`. The side panel (`workflow-inspector.tsx`) edits the selected node or rule.
3. The admin adds, removes or reorders rules: start rules (which queues start after form submission), close triggers (source queue → target queue), close blockers (blocked queue needs prerequisite queue), creation requirements (target queue needs prerequisite queue).
4. The admin publishes. Publishing is one `PUT /api/configuration/case-flow` call carrying a `revision` number (see below). The response contains the new revision and the full rule set.
5. Publishing creates a **new immutable version** of the whole flow. Old versions are never edited in place. Each merchant is stamped with the version that was active when their cases were created (`cases.flow_version_id`).

### What the engine does at runtime

| Step | What happens |
|---|---|
| **1. Form submission** | When a merchant submits the onboarding form, `triggerStartCasesForMerchant` reads the merchant's flow version and creates one case per active start rule, in `order` order, with `triggerType: 'form_submission'`. If no start rules are configured, no cases are created automatically — the docs say "Empty arrays mean cases are manual-only until configured." |
| **2. Manual creation** | `POST /api/cases` and `POST /api/cases/bulk-create` check creation requirements first (`assertCreationRequirementsSatisfied`): if a prerequisite queue has no successfully closed case for this merchant, creation fails with `409` ("Close … before creating this case."). |
| **3. Closing** | Before a case can close successfully, close blockers are checked (`assertCloseBlockersSatisfied`): if a prerequisite queue has no successfully closed case for this merchant, closing fails with `409` ("Close … before closing this case."). The check locks the candidate prerequisite cases in stable id order to avoid two simultaneous closes seeing a stale result. |
| **4. After a successful close** | `enqueueCasesAfterSuccessfulClose` looks up the active close triggers for the closed case's queue and creates one durable job per target queue in `case_flow_close_jobs`, with `triggerType: 'case_close'` and `onlyIfTargetMissing: true`. The job does not create the case immediately — a background worker does. Triggers skip their target when that case already exists. |
| **5. The worker creates the follow-up case** | `processCaseFlowCloseJobs(batchSize)` claims due jobs one at a time (oldest `availableAt` first, `FOR UPDATE SKIP LOCKED`), creates the case inside a nested transaction (a savepoint, so a failed creation rolls back without losing the job), and marks the job completed. If the merchant is terminated or deleted, the job is finished without creating a case instead of retrying forever. If the job's flow version no longer matches the merchant's version, it fails with `409` ("Job flow version does not match its merchant."), which is a client error, so the job becomes `blocked` and retries every 6 hours rather than backing off. Each job takes a Postgres advisory lock on (merchant, target queue) before it creates anything. |
| **6. Retries** | A transient failure (anything that is not a 4xx) is retried automatically with exponential back-off, from 30 s up to a 15-minute cap, with ±10% jitter (see "Worker timing" below). After 8 transient failures the job is `failed` and reported as degraded, but it keeps retrying every 15 minutes until it succeeds. A 4xx failure (for example a missing creation requirement) makes the job `blocked`, retried every 6 hours. A successful close, or a merchant move, releases blocked jobs to run now. An admin can inspect degraded jobs at `GET /api/cases/flow-jobs/failed` and force an immediate retry with `POST /api/cases/flow-jobs/:jobId/retry` — optional, because retries continue automatically. |
| **7. Backfill** | If a close trigger was added late, some merchants may already have the source case closed successfully but never got the follow-up case. `GET /api/cases/flow-jobs/backfill/preview?triggerId=…` lists the missing cases, and `POST /api/cases/flow-jobs/backfill` (`{ triggerId }`) creates them. The builder exposes this through `backfill-dialog.tsx`. |

### Versions and merchant moves

1. Publishing a new version does **not** move merchants that are already in progress. They stay on their old version, and their jobs stay pinned to it ("Publishing alone never wakes or changes jobs pinned to earlier versions.").
2. To move in-progress merchants, the admin uses the merchant-move flow: `GET /api/configuration/case-flow/merchant-move/preview` shows what would change — merchant counts, rule differences per source version, open cases left on removed steps, and pending jobs that would be cancelled. Merchants move when they are not deleted or terminated, are not already on the target version, and are either pending or testing, or still have a non-closed case or an uncompleted job (`eligibleMerchantsWhere` and `hasUnfinishedWork`, `case-flow-move.service.ts`). Live merchants with nothing left open keep their version.
3. `POST /api/configuration/case-flow/merchant-move` (body `{ revision, reason }`) moves them in one transaction, re-stamps their cases and jobs, and records one audit row per merchant (`case_flow_merchant_moves` + `case_flow_merchant_move_items`). Open cases stay open. Jobs for rules that no longer exist are deleted, because a completed job would permanently block that target from being created again. Open jobs that remain are re-stamped to the target version, and blocked jobs are released to run now.
4. The same move can be done in the same transaction as publishing, by sending `moveExistingMerchants: true` with `PUT /api/configuration/case-flow`. Then `changeNote` is required, and the response's `merchantMove` holds the result.
5. A stale `revision` on either move call returns `409` with the current revision.

## How it is implemented — Frontend

- **Page route:** `frontend/src/routes/_app.configuration.case-flow-rules.tsx` (title "Caseflow Builder", subtitle "Design the cross-queue case workflow visually.").
- **Panel:** `frontend/src/features/configuration/workflow-builder/workflow-builder-panel.tsx`.
- **Canvas and state:**

| File | What it does |
|---|---|
| `workflow-canvas.tsx` | The graph canvas |
| `workflow-editor-state.ts` | Editor state |
| `workflow-graph-mapper.ts` / `workflow-graph-types.ts` | Mapping between the API rule shape and graph nodes/edges |
| `workflow-layout.ts` | Automatic layout of the graph |
| `workflow-validation.ts` | Client-side validation (`getWorkflowFormError`); the server re-validates |
| `workflow-inspector.tsx` | The side panel for the selection |
| `backfill-dialog.tsx` | The missing-cases backfill dialog |
| `move-merchants-dialog.tsx` / `merchant-move-impact.tsx` | The merchant-move preview and confirmation |

- **API** (`frontend/src/apis/configuration.ts`):

| Function | Endpoint |
|---|---|
| `fetchCaseFlowConfiguration` | `GET /api/configuration/case-flow` |
| `updateCaseFlowConfiguration` | `PUT /api/configuration/case-flow` |
| `fetchCaseFlowMerchantMovePreview` | `GET /api/configuration/case-flow/merchant-move/preview` |
| `previewCaseFlowMerchantMoveForDraft` | `POST` to the same preview path with the draft `PUT` body, to preview unpublished rules |
| `moveCaseFlowMerchants` | `POST /api/configuration/case-flow/merchant-move` |
| `previewMissingCloseTriggerCases` / `createMissingCloseTriggerCases` | The backfill endpoints |

- The frontend converts the API shape to a graph and back with `toCaseFlowPayload` in `configuration.ts`. Each rule keeps its `id`, `order` and `isActive` in the editor; the backend assigns fresh ids on every publish (see below).

## How it is implemented — Backend

| File | What it does |
|---|---|
| `backend/src/modules/configuration/configuration.service.ts` | `getCaseFlowConfiguration`, `updateCaseFlowConfiguration`, `readCaseFlowConfiguration`, `assertActiveFlowGraphValid` |
| `backend/src/modules/cases/case-flow.service.ts` | `getMerchantFlowVersionId`, `triggerStartCasesForMerchant`, `assertCloseBlockersSatisfied`, `assertCreationRequirementsSatisfied`, `enqueueCasesAfterSuccessfulClose`, `processCaseFlowCloseJobs`, `getNextCaseFlowCloseJobDueAt`, `getCaseFlowCloseJobHealth`, `listFailedCaseFlowCloseJobs`, `retryFailedCaseFlowCloseJob`, `previewMissingCloseTriggerCases`, `createMissingCloseTriggerCases` |
| `backend/src/modules/cases/case-flow-worker.ts` | `setCaseFlowCloseJobDrainHandler`, `requestCaseFlowCloseJobDrain` — publishing with a merchant move wakes the worker |
| `backend/src/modules/configuration/case-flow-graph.ts` | `buildCaseFlowDependencyEdges`, `findDependencyCycle`. Edges are built from close triggers (target → source), creation requirements (target → prerequisite) and close blockers (blocked → prerequisite), and a depth-first search finds cycles. |
| `backend/src/modules/cases/case-flow-job-state.ts` | Job state transitions: `recordCloseJobFailure` (sets `blocked` for 4xx, `failed` after 8 transient attempts), `completeCloseJobs`, `releaseBlockedCloseJobs`, `retryCloseJob` (manual retry resets attempts to 0) |
| `backend/src/modules/cases/case-flow-retry.ts` | `classifyCaseFlowFailure` (any 4xx is `blocked`, everything else `transient`) and `calculateCaseFlowRetryDelay` (exponential back-off, 1 s minimum) |
| `backend/src/modules/configuration/case-flow-move.service.ts` | `previewMoveToActiveVersion`, `previewMoveToDraftRules`, `moveMerchantsToActiveVersionTx`, `moveMerchantsToActiveVersion` |

**Endpoints** (prefix `/api/configuration`, plus the case endpoints):

| Endpoint | Notes |
|---|---|
| `GET /api/configuration/case-flow` | Current revision, queues, and all configured rules including inactive ones. Also returns `versionId`, `activeVersionId` and the list of published `versions` (the API doc in `backend/apis/configuration.md` shows a shorter shape without those fields; the code returns them — see "Data" note). |
| `GET /api/configuration/case-flow/versions/:versionId` | The same, for one published version (queues come from that version's stored `queueSnapshot` when it is not the active version). |
| `PUT /api/configuration/case-flow` | Create/update/deactivate rules in one revisioned transaction. |
| `GET /api/configuration/case-flow/merchant-move/preview` | Merchant-move preview. |
| `POST /api/configuration/case-flow/merchant-move` | Merchant move. |
| `GET /api/cases/flow-jobs/failed` | Lists every open job that has a recorded error (retrying, failed or blocked), newest `lastAttemptAt` first, at most 100 rows. The name is narrower than the content. |
| `POST /api/cases/flow-jobs/:jobId/retry` | Resets `attempts` to 0, makes the job due now and wakes the worker. Only works on an open job with a recorded error. |
| `GET /api/cases/flow-jobs/backfill/preview?triggerId=…` | Preview missing cases. |
| `POST /api/cases/flow-jobs/backfill` | Create missing cases (`{ triggerId }`). |

**How `PUT /api/configuration/case-flow` works:** `revision` is required and must match the current server revision, or the call fails with `409` ("Case flow configuration was updated by someone else. Reload and try again.", plus the current `revision`). Each publish inserts a brand-new `case_flow_versions` row and copies each submitted rule into it with a new id; rules left out of the payload are not copied into the new version (earlier versions are kept unchanged) ("Editor IDs belong to the previous version; every published rule gets a new ID"), stamps `publishedAt`, and bumps the singleton `flow_configuration_revisions` row (`id = 1`) to the new version id and `revision + 1`.

**Validation before commit** (server): no cycles in creation requirements or close blockers, no duplicate active edges, no impossible trigger/requirement combinations, no inactive queue targets, and no targets without usable initial/terminal stages. Validation errors name queue ids/names and cycle paths, and never include SQL details. Schema-level rules (`configuration.schemas.ts`): each rule list holds at most 500 entries; `order` is an integer ≥ 1 (default 1); a queue cannot trigger, block or require itself; duplicate active edges and duplicate rule ids are rejected; `moveExistingMerchants: true` requires a `changeNote` (max 1000 characters).

**Job health:** `GET /health/db` (`backend/src/index.ts`) returns `status: "unhealthy"` when the worker is not ready, `"degraded"` when any job is retrying, failed or blocked, and `"ok"` otherwise. It also reports pending, retrying, failed and blocked counts, the oldest timestamps, the next retry time and the last cycle. A permanently blocked job therefore keeps the endpoint degraded (see file 32, gap L13).

**Case links:** every automatically created case is recorded in `case_links` (`parentCaseId`, `childCaseId`, `merchantId`, `triggerType`, `sourceQueueId`, `targetQueueId`), with one child per row (unique on `childCaseId`).

## Data, validation and edge cases

**Rule tables** (`backend/src/db/schema.ts`), all with `flowVersionId` (references `case_flow_versions`, on delete restrict), `isActive` (default `true`), `createdAt`, `updatedAt`:

| Table | Columns | Unique active rule |
|---|---|---|
| `case_flow_start_rules` | `targetQueueId`, `order` (default 1, check `order > 0`) | Per (`flowVersionId`, `targetQueueId`) |
| `case_flow_close_triggers` | `sourceQueueId`, `targetQueueId`, `order` | Per (`flowVersionId`, `sourceQueueId`, `targetQueueId`) |
| `case_flow_close_blockers` | `blockedQueueId`, `prerequisiteQueueId` | Per (`flowVersionId`, `blockedQueueId`, `prerequisiteQueueId`) |
| `case_flow_creation_requirements` | `targetQueueId`, `prerequisiteQueueId` | Per (`flowVersionId`, `targetQueueId`, `prerequisiteQueueId`) |

**Version tables:** `case_flow_versions` (`id` serial, `publishedAt`, `publishedBy`, `changeNote`, `queueSnapshot` JSONB); `flow_configuration_revisions` (singleton `id = 1`, `revision`, `activeFlowVersionId`, `updatedAt`); `case_flow_merchant_moves` (`toVersionId`, `movedBy`, `reason`, `merchantCount`, `cancelledJobCount`, `createdAt`) and `case_flow_merchant_move_items` (composite key `moveId` + `merchantId`, `fromVersionId`). Published versions and rules are immutable, enforced by database triggers.

**Job table** `case_flow_close_jobs`: `flowVersionId`, `sourceCaseId`, `merchantId`, `sourceQueueId`, `targetQueueId`, `attempts` (≥ 0), `onlyIfTargetMissing` (default `true`), `availableAt`, `lastError`, `lastAttemptAt`, `blockedAt`, `completedAt`, `failedAt`, `createdAt`, and a generated `status` column.

**Job statuses** (`CASE_FLOW_CLOSE_JOB_STATUSES`): `pending`, `retrying`, `failed`, `blocked`, `completed`. The status is a generated column (migration `0109_case_flow_close_job_state.sql`): `completedAt` set → `completed`; `blockedAt` set → `blocked`; `failedAt` set → `failed`; `lastError` set → `retrying`; otherwise `pending`. A check constraint stops `blockedAt` and `failedAt` from both being set. A unique index on (`sourceCaseId`, `targetQueueId`) enforces once-only follow-up creation.

**Worker timing** (`backend/src/config/env.ts`):

| Setting | Default |
|---|---|
| `CASE_FLOW_WORKER_POLL_MS` | 1000 |
| `CASE_FLOW_WORKER_IDLE_POLL_MS` | 15 minutes (900,000 ms) |
| `CASE_FLOW_WORKER_BATCH_SIZE` | 5 |
| `CASE_FLOW_WORKER_DEGRADED_AFTER_ATTEMPTS` | 8 |
| `CASE_FLOW_WORKER_RETRY_BASE_MS` | 30,000 |
| `CASE_FLOW_WORKER_RETRY_MAX_MS` | 15 minutes |
| `CASE_FLOW_WORKER_BLOCKED_RETRY_MS` | 6 hours |
| `CASE_FLOW_WORKER_RETRY_JITTER_PERCENT` | 10 |

> ⚠️ **Docs disagree with code on the idle poll.** The backend README says the worker "poll[s] every second while active, back[s] off to one minute while idle". The code default in `env.ts` is 15 minutes idle, not one minute. The active poll (1 second) and batch size (5) agree. The README should be corrected, or the default changed — this spec follows the code.

The idle delay does not jump straight to 15 minutes. Each empty cycle doubles the delay from the 1-second active poll, up to the idle maximum, and the worker wakes early when the next job's `availableAt` is due (`nextCaseFlowWorkerDelay` and `getNextCaseFlowCloseJobDueAt`, `backend/src/index.ts`). The idle poll is therefore a safety net for jobs enqueued without a drain request. A successful close or a merchant move calls `requestCaseFlowCloseJobDrain`, which wakes the worker at once.

| Case | What happens |
|---|---|
| **Stale revision** | Any `PUT` with a mismatched `revision` returns `409` with the current revision. Clients must reload and retry with the returned revision, not overwrite. |
| **Empty rules** | All four rule lists may be empty. The system then creates no automatic cases; staff create cases manually. |
| **Trigger skips existing target** | If the target case already exists, the close trigger does nothing (and the job's `onlyIfTargetMissing` flag records that rule). |
| **Terminated merchant** | The worker finishes the job without creating a case. No error, no retry. |
| **Version mismatch** | A job whose `flowVersionId` differs from the merchant's current version fails with `409`, which is a client error, so it becomes `blocked` and is retried every 6 hours. A merchant move re-stamps the merchant's open jobs to the target version and releases blocked jobs to run now (`case-flow-move.service.ts`). |
| **Failed-job list is capped** | `listFailedCaseFlowCloseJobs` returns at most 100 open jobs that have a `lastError` (retrying, failed or blocked), newest `lastAttemptAt` first. |
| **Manual retry** | `POST /api/cases/flow-jobs/:jobId/retry` sets attempts to 0 and makes the job due now (`retryCloseJob`), then wakes the worker. It returns `404 Problem case-flow job not found.` when the job is completed or has no `lastError`. |
| **Backfill candidates** | `listMissingCloseTriggerCandidates` picks one candidate per merchant on the trigger's flow version, excluding terminated and deleted merchants. The candidate's source-queue case must be closed successfully, the merchant must have no case in the target queue, and no completed job may exist for that target. The preview returns `eligibleMerchantCount`, a `jobBreakdown`, `retryIssues` and up to 10 `sampleMerchants`. Creation runs one merchant at a time under the (merchant, target) advisory lock, and per-merchant failures are returned and counted as attempts on any open job (`case-flow.service.ts`). |
| **Start rule targets the EP queue** | `triggerStartCasesForMerchant` runs inside the form-submission transaction (`merchants.service.ts`). An EP target needs a Documents Review selection, which does not exist at submission, so `createConfiguredCases` throws `409 Select at least one sub-merchant in document review before creating EP Sub-Merchant Form cases.` inside that transaction, which would fail the submission. The builder does not reject this combination (no `sub_merchant_form` check in `configuration.service.ts`). Not run; from code reading. |
| **API doc shape differs from code** | `backend/apis/configuration.md` shows `GET /api/configuration/case-flow` returning only `revision`, `queues`, `startRules`, `closeTriggers`, `closeBlockers`, `creationRequirements`. The code in `readCaseFlowConfiguration` also returns `versionId`, `activeVersionId` and `versions`. The doc is out of date on that point. |

## What to check — is this what you intended?

- [ ] **Current chain:** is the current chain (the four rule types and their order) the onboarding order you want, or are there steps that should be added, removed or reordered?
- [ ] **Publish does not move anyone:** when you publish a new version, should in-progress merchants move to it automatically, or is the current "publish does not move anyone; moving is a separate, explicit step" the right safety rule?
- [ ] **Idle poll mismatch:** the README says the worker backs off to one minute when idle, but the code defaults to 15 minutes. Which idle delay do you want — and does a 15-minute delay ever leave a merchant waiting too long for their next case?
- [ ] **Retry forever:** after 8 failed attempts a job is called "degraded" but keeps retrying forever. Should a job ever give up permanently and need a person, or is "retry forever" correct?
- [ ] **Blocked jobs every 6 hours:** a job blocked by a 4xx error (a missing creation requirement, or a flow-version mismatch) is retried only every 6 hours. Is that the right delay, or should a blocked job be retried sooner or flagged to a person?
- [ ] **EP targets:** a start rule or close trigger that targets the EP Sub-Merchant queue creates an EP case per selected sub-merchant, without the WordPress gate that the EP page enforces (see file 20). Is that intended?
- [ ] **Skip when target exists:** should a close trigger ever create a second case for the same target queue (for example after the first was closed unsuccessfully), or is "skip when the target already exists" always right?
- [ ] **Agreement → Live hard rule:** is Agreement → Live the only hard rule that should never be editable in the builder, or should an admin be able to remove it? Today the builder can deactivate it; migration `0074` only seeds it and guards against a second Live case.
- [ ] **API doc out of date:** the API doc for `GET /api/configuration/case-flow` is missing the `versionId`, `activeVersionId` and `versions` fields the code returns. Do you want the API docs updated to match the code?

---
*Sources: `frontend/src/routes/_app.configuration.case-flow-rules.tsx`, `frontend/src/features/configuration/workflow-builder/workflow-builder-panel.tsx`, `frontend/src/features/configuration/workflow-builder/workflow-canvas.tsx`, `frontend/src/features/configuration/workflow-builder/workflow-editor-state.ts`, `frontend/src/features/configuration/workflow-builder/workflow-graph-mapper.ts`, `frontend/src/features/configuration/workflow-builder/workflow-graph-types.ts`, `frontend/src/features/configuration/workflow-builder/workflow-layout.ts`, `frontend/src/features/configuration/workflow-builder/workflow-validation.ts`, `frontend/src/features/configuration/workflow-builder/workflow-inspector.tsx`, `frontend/src/features/configuration/workflow-builder/backfill-dialog.tsx`, `frontend/src/features/configuration/workflow-builder/move-merchants-dialog.tsx`, `frontend/src/features/configuration/workflow-builder/merchant-move-impact.tsx`, `frontend/src/apis/configuration.ts`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/modules/configuration/case-flow-graph.ts`, `backend/src/modules/configuration/case-flow-move.service.ts`, `backend/src/modules/cases/case-flow.service.ts`, `backend/src/modules/cases/case-flow-worker.ts`, `backend/src/modules/configuration/configuration.routes.ts`, `backend/src/config/env.ts`, `backend/src/db/schema.ts`, `backend/src/modules/cases/case-flow-job-state.ts`, `backend/src/modules/cases/case-flow-retry.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/cases.routes.ts`, `backend/src/modules/cases/case-transition.service.ts`, `backend/src/modules/cases/case-stage.service.ts`, `backend/src/modules/configuration/configuration.schemas.ts`, `backend/src/modules/merchants/merchant-state-machine.ts`, `backend/src/index.ts`, `backend/drizzle/0071_case_flow_safe_backfill.sql`, `backend/drizzle/0074_agreement_driven_live.sql`, `backend/drizzle/0075_case_flow_versions.sql`, `backend/drizzle/0109_case_flow_close_job_state.sql`, `backend/apis/configuration.md`, `backend/README.md`, `frontend/src/config/navigation.ts`. Related files: 19 (Live Activation), 20 (EP Sub-Merchants), 25 (Configuration), 32 (Known Gaps).*
