# PlanetScale best-practices assessment: query and API performance (db.md)

## Scope

- Organization: `shahrozahmed`
- Database: `onboarding-portal`
- Branches reviewed: `main` (production; no replicas; safe migrations off; deletion protection on)
- Engine: PostgreSQL 18.6
- Repository reviewed: `onboarding-portal-assanpay-BE` at `origin/main` commit `e71b150` (fresh read-only clone in a scratch directory; your working copy and branches were not modified)
- Interfaces used:
  - PlanetScale MCP: `get_insights`, `list_query_tags`, `list_schema_recommendations`, `get_branch`, `execute_read_query` (read-only, tagged `/* agent:db-report source:mcp */`).
  - Local PostgreSQL 18.6 copy of the production schema, seeded to scale (see Method).
  - PlanetScale skills pack (query-insights-and-tags, mcp-agent-operating-model, readonly-inventory, schema-recommendations-agent-loop, customer-report-template).
- Time window: Insights, last 8 days
- Changes applied: none

## Executive summary

- **Baseline.** Production is small: 388 cases, 124 merchants, 1,345 `case_history` rows, 59 `mid_creation_saved` rows, 401 `portal_mid_limit_applications` rows. Production latencies are therefore low and plans favor sequential scans. All growth-sensitive conclusions come from a local PG 18.6 copy with 128,382 cases, 30,000 merchants and 470,860 `case_history` rows. Schema parity with production was verified (md5 of 150 indexes and 349 columns identical).
- **Dashboard MID query family is about 50% of application DB time in production** (14.1% + 13.4% + 12.6% + 5.7% + 3.9% = 49.7% across 920 executions in 8 days). Each execution recomputes the latest MID per merchant from `case_history`. At scale one dashboard load costs 549–679 ms DB time and about 273k buffer hits. A merchant-level rollup reduced the pending-count step from about 82 ms to 5.5 ms and total buffers from about 287k to about 380.
- **Search is not using the existing trigram indexes.** `OR` across a join forces sequential scans of `cases` and `merchants`. A `UNION` rewrite took case search from 159–172 ms to 4–6 ms. Merchant search has no trigram index on `owner_full_name`; adding one took it from 51.7 ms to 1.5 ms.
- **List count and owners do full scans.** The case list count with two joins takes 38.5 ms (9.8 ms without joins). `/api/cases/owners` scans all cases (38.8 ms); an `EXISTS` form takes 0.085 ms.
- **Migration 0094 (drop `cases_updated_id_idx`) regresses one route.** `GET /api/cases?sortBy=updatedAt` went from 29.0 ms to 139.7 ms at scale. The other seven indexes dropped in migrations 0087–0094 showed no measurable effect on any tested route.
- **Everything else in the project is cheap.** The full case pipeline (public form through WordPress close, 176 distinct statements) and all write paths ran at 0.3–3.3 ms mean per statement on a warm cache. The dominant cost in the pipeline run was again the case list/count queries (88% of DB time).
- **Instrumentation gap.** Production queries carry only system tags (`application_name`, `catalog`, `remote_address`, `username`); no application route tags. Load cannot be attributed to routes or jobs. One non-application monitoring query (index-bloat check) accounts for 17.3% of total DB time.

## Current state

### Method

- **Local replica.** PG 18.6 in Docker, schema migrated from `origin/main`. Seeded with 30,000 merchants, 128,382 cases, 470,860 `case_history` rows (17,143 `mid_creation_saved`), 12,190 closed-successful Merchant ID cases.
- **Per-API capture (`apiq`).** 82 routes, 5 calls each against the `origin/main` API, with `pg_stat_statements` reset per route. Recorded per request: API ms, DB ms, queries, buffer hits.
- **Plans.** Local plans use `EXPLAIN (ANALYZE, BUFFERS)`. No `EXPLAIN ANALYZE` was run on production (PlanetScale skill rule).
- **Pipeline run.** Public merchant form → Documents Review → Sub-Merchant Form → Agreement → Merchant ID → Testing → Live → WordPress close, run twice; the second (warm) run is used for timings. 149 statements, 1,362 calls.
- **Static scan.** Searched all of `src/` for queries in loops, unbounded reads, `map(async …)` patterns.
- **Schema checks.** Foreign keys lacking supporting indexes; write cost on large tables.
- **Rewrites tested only on the local scratch DB.** Extra indexes, temp tables and rollup experiments were created and dropped locally. Nothing was changed in production or in your repository.

### Database and branch topology

| Item | Value | Source |
|---|---|---|
| Engine | PostgreSQL 18.6 | `get_branch` |
| Branch | `main`, production | `get_branch` |
| Replicas | none | `get_branch` |
| Safe migrations | off | `get_branch` |
| Deletion protection | on | `get_branch` |
| Extension `pg_trgm` | installed | read query |
| Tables (production row counts) | cases 388, merchants 124, case_history 1,345, `mid_creation_saved` 59, `portal_mid_limit_applications` 401 | read query |

### Observability

- Query Insights: available, collecting.
- Query tags present: `application_name` (`postgres.js` 80,906 queries; `PlanetScale schema recommendations` 24), `catalog` (`postgres`), `remote_address` (6 values), `username` (many `pscale_api_*` values; one dominant application role with 81,641 queries), and one SQL tag `source=planetscale-mcp` (14 queries, from this assessment). No application-submitted tags.
- Raw query collection: not assessed in this run.
- Anomalies, error patterns: reviewed earlier in this engagement; no query-related findings carried into this report.
- Schema recommendations: reviewed earlier; migrations 0087–0094 in `origin/main` already act on the drop-unused-index recommendations.

### Production Insights: top patterns by total time (8 days)

| Pattern | Executions | % of total time | Total ms | p50 ms |
|---|---|---|---|---|
| Index-bloat monitoring query (not the application) | 8 | 17.35% | 2,027.6 | 217.6 |
| Dashboard pending-MID count (`total/portal/internal`) | 273 | 14.07% | 1,644.2 | 5.27 |
| Dashboard pending list (unpaged) | 146 | 13.42% | 1,568.4 | 10.41 |
| Dashboard pending list (first page, `limit`) | 132 | 12.58% | 1,470.7 | 10.41 |
| Dashboard pending list (next page, keyset) | 82 | 5.74% | 670.7 | 8.52 |
| Classified MID / portal MID limit applications | 287 | 3.94% | 460.8 | 1.50 |
| Session check `select id from users where …` | 12,346 | 3.71% | 433.7 | 0.033 |
| `case_flow_close_jobs` worker poll (`for update skip locked`) | 7,564 | 2.63% | 307.0 | 0.042 |

The five MID-family patterns share the same `latest_mid` CTE and total 49.7% of time.

### Automation and repository instrumentation

- Repository stack: Bun, Hono, Drizzle, `postgres.js`, migrations under `drizzle/`.
- No SQL comments or tracing detected on application queries (consistent with the tag inventory).
- Webhooks, agent loops, incident routing, backups/PITR, roles, Traffic Control, private connectivity: not assessed in this run.

## Per-API results (local, 128k cases, current `origin/main` schema)

DB ms = database execution time per request; blks = buffer hits per request; Q = queries per request.

### Slowest routes

| API | API ms | DB ms | Q | blks | Verdict |
|---|---|---|---|---|---|
| `GET /api/dashboard` (30d) | 295.4 | 678.7 | 6 | 273,120 | Optimize (Q1) |
| `GET /api/dashboard` (90d) | 256.6 | 591.3 | 6 | 273,352 | Optimize (Q1) |
| `GET /api/dashboard` (agent) | 257.7 | 587.1 | 6 | 273,107 | Optimize (Q1) |
| `GET /api/dashboard` (7d) | 242.1 | 549.0 | 6 | 273,010 | Optimize (Q1) |
| `GET /api/cases?search=<merchant>` | 363.3 | 353.7 | 3 | 8,607 | Optimize (Q2) |
| `GET /api/dashboard/portal-mids/pending` | 180.6 | 343.2 | 3 | 287,593 | Optimize (Q1) |
| `GET /api/cases?search=<number>` | 208.3 | 196.5 | 3 | 48,854 | Optimize (Q2) |
| `GET /api/dashboard/portal-mids/pending/mids` | 172.9 | 153.0 | 2 | 137,007 | Optimize (Q1) |
| `GET /api/cases?sortBy=updatedAt` | 146.2 | 139.7 | 3 | 7,370 | Regression from 0094 (Q6) |
| `GET /api/merchants?search=<name>` | 127.7 | 121.7 | 3 | 2,815 | Optimize (Q3) |
| `GET /api/cases?sortBy=merchantName` | 130.1 | 119.3 | 3 | 4,556 | Sort on joined column (Q7) |
| `GET /api/merchants?search=<email>` | 112.5 | 105.0 | 3 | 2,815 | Optimize (Q3) |
| `GET /api/merchants?search=<miss>` | 103.4 | 96.1 | 3 | 2,811 | Optimize (Q3) |
| `GET /api/cases/owners` | 43.2 | 38.8 | 2 | 2,898 | Optimize (Q5) |
| `GET /api/merchants?sortBy=ownerFullName` | 37.2 | 33.9 | 3 | 1,631 | Low priority |
| `GET /api/merchants?sortBy=updatedAt` | 39.3 | 33.4 | 3 | 1,630 | Low priority |
| `GET /api/cases` (default) | 41.0 | 30.5 | 3 | 3,172 | Count cost (Q4) |
| `GET /api/cases?sortBy=caseNumber` | 40.6 | 30.4 | 3 | 3,199 | Count cost (Q4) |
| `GET /api/cases?sortBy=status` | 38.0 | 30.3 | 3 | 3,202 | Count cost (Q4) |
| `GET /api/cases?sortBy=closedAt` | 40.0 | 30.2 | 3 | 3,170 | Count cost (Q4) |
| `GET /api/cases?limit=100` | 39.0 | 29.5 | 3.4 | 3,354 | Count cost (Q4) |
| `GET /api/cases?ownerId=…` | 31.8 | 20.9 | 3 | 3,139 | Count cost (Q4) |
| `GET /api/users` | 29.2 | 19.9 | 6 | 2,915 | Count-by-owner scan; low priority |
| `GET /api/users?search=…` | 27.9 | 18.7 | 6 | 2,909 | Low priority |
| `GET /api/cases` agent, `queueAccess=work` | 24.5 | 17.2 | 4 | 3,113 | Count cost (Q4) |
| `GET /api/cases?priority=high` | 25.5 | 16.9 | 3 | 3,613 | Count cost (Q4) |
| `GET /api/dashboard/agreements/awaiting-physical` | 17.0 | 16.3 | 3 | 13,506 | Low priority |
| `GET /api/cases?status=working` | 22.7 | 14.0 | 3 | 3,111 | Fine |
| `GET /api/dashboard/workload` | 19.8 | 13.1 | 4 | 3,192 | Fine |
| `GET /api/cases` restricted agent | 20.7 | 11.2 | 4 | 1,037 | Fine |
| `GET /api/cases?queueId=…` | 17.7 | 10.6 | 3 | 1,036 | Fine |

### Routes at or below 6 ms DB time

| API | DB ms | Q |
|---|---|---|
| `GET /api/dashboard/workload` (agent) | 5.1 | 5 |
| `GET /api/merchants?limit=100` | 4.4 | 3 |
| `GET /api/notifications` | 4.3 | 3 |
| `GET /api/merchants` scope + date | 3.9 | 3 |
| `GET /api/merchants` (default) | 3.7 | 3 |
| `GET /api/notifications?filter=unread` | 3.5 | 3 |
| `GET /api/notifications/unread-count` | 3.4 | 2 |
| `GET /api/merchants` sort priority / status / businessName / merchantNumber / createdAt / businessScope | 2.6–3.0 | 3 |
| `GET /api/users/:id` | 2.7 | 4 |
| `GET /api/merchants?status=live` | 1.8 | 3 |
| `PATCH /api/merchants/:id/priority` | 1.7 | 10 |
| `POST /api/cases/:id/comments` | 1.6 | 15.4 |
| `PATCH /api/cases/:id/priority` | 1.3 | 4 |
| `PATCH /api/cases/:id/assign` | 1.0 | 7.8 |
| `GET /api/cases/:id` (closed MID / testing / open DR / agreement) | 0.7 / 0.6 / 0.5 / 0.2 | 16 / 11 / 11 / 8 |
| `GET /api/merchants/:id/overview` / `history` / `form` | 0.4 / 0.4 / 0.3 | 9 / 5 / 5 |
| `GET /api/cases?merchantId=…` | 0.2 | 3 |
| `GET /api/cases/:id/history` / `comments` | 0.2 / 0.1 | 4 / 3 |
| `GET /api/configuration` and case-flow | 0.2 | 9 |
| `GET /api/merchants/:id`, `/limits-mdr` | 0.1 | 2, 7 |
| `PATCH /api/notifications/:id/read` | 0.1 | 2 |
| `GET /api/queues`, `/api/queues/:id` | 0.1 | 2, 4 |
| `GET /api/configuration/sub-merchants` and `/drafts` | 0.1 | 2 |
| `GET /api/cases/:id/portal-password-code` (returned 403 for this case) | 0.1 | 2 |
| Auth check per request, `GET /api/users/directory` | 0.0–0.1 | 2 |
| `GET /api/cases/flow-jobs/failed` | 0 | 2 |
| Configuration reads: limits-and-mdr, payment-methods, payout-methods, agreements, merchant-portal, email-recipients, email-sending-mode, email-templates/agreement | ≈0 | 1–3 |
| `GET /health/db` | 0 | 2 |

## Whole-project results beyond the API sweep

Full case pipeline, warm second run (149 statements, 1,362 calls):

| Statement | Calls | Mean ms | Max ms |
|---|---|---|---|
| Case list `count(*)` with joins | 16 | 156.4 | 169.3 |
| Case list select | 16 | 154.1 | 166.2 |
| `insert into case_comments` (first call in run) | 1 | 287.8 | 287.8 |
| `insert into case_history` (31 calls; one outlier) | 31 | 7.85 | 92.4 |
| `update cases` (stage close) | 7 | 3.28 | 5.9 |
| `insert into cases` | 7 | 2.00 | 3.7 |
| `insert into case_flow_close_jobs` | 7 | 1.13 | 2.1 |
| `update cases` (owner/stage) | 7 | 1.07 | 1.7 |
| `insert into case_links` | 7 | 0.94 | 1.5 |
| `insert into storage_objects` | 10 | 0.63 | 1.8 |
| `insert into merchant_documents` | 1 | 4.12 | 4.1 |
| `insert into email_log` | 3 | 0.96 | 1.1 |
| `insert into merchants` | 1 | 2.55 | 2.5 |
| `insert into case_files` | 10 | 0.25 | 0.4 |
| FK check `… FOR KEY SHARE OF x` on `merchants` | 208 | 0.01 | 0.0 |

Follow-up on the two outliers:

- `case_comments`: 10 repeated warm inserts through the API averaged 0.88 ms (max 2.6 ms). The 288 ms call was not reproduced.
- `case_history`: 30 of 31 inserts averaged about 0.5 ms; one took 92.4 ms. Not reproduced. A direct probe (insert plus both FK triggers) took 1.3 ms warm.

Other whole-project checks:

- **Static scan.** No queries inside loops that constitute N+1. Loops containing `await tx…` are per-file writes inside one transaction, bounded by document count (`merchants.service.ts:204`, `wordpress-case.service.ts`, `case-documents-review.service.ts`). Only unbounded `select().from()` found: `configuration.service.ts:414` (agreement draft templates; small configuration table).
- **Queries per request.** Case detail issues 8–16 queries; comment write about 15; every authenticated request runs a session check plus a role/queue-access lookup. DB time for these is under 1 ms locally; the cost that matters is round trips, which depends on app-to-database latency (not measured).
- **Worker poll.** `case_flow_close_jobs` poll ran 7,564 times in 8 days (0.042 ms p50, 2.6% of time). Cheap per call; frequency is set by `CASE_FLOW_WORKER_POLL_MS`.
- **Foreign keys without a supporting index.** 11 single-column FKs, all referencing `queues` (7 rows): `case_links.source_queue_id`, `case_links.target_queue_id`, `case_flow_start_rules.target_queue_id`, `case_flow_close_triggers.source_queue_id`/`target_queue_id`, `user_queue_access.queue_id`, `flow_configuration_revisions.active_flow_version_id` (→ `case_flow_versions`), `case_flow_close_blockers.blocked_queue_id`/`prerequisite_queue_id`, `case_flow_creation_requirements.prerequisite_queue_id`/`target_queue_id`. The only cost is a scan of the referencing table when a queue row is deleted; largest is `case_links` at 1.2 MB. No action recommended.
- **`sub_merchant_form_details`** (candidate for an "unused table" recommendation): referenced in `case-flow.service.ts:523` (insert) and `case-detail-lookups.ts:313–317` (select). Not unused; do not drop.

## Query analysis and measured evidence

### Q1. Dashboard MID query family (`dashboard.service.ts`, ~lines 225–410)

Pattern:

```sql
with latest_mid as (
  select distinct on (cases.merchant_id)
         cases.merchant_id, merchants.business_name, cases.id, cases.case_number,
         case_history.details, case_history.created_at
  from case_history
  join cases on case_history.case_id = cases.id
  join queues on cases.queue_id = queues.id
  join merchants on cases.merchant_id = merchants.id
  where case_history.action = 'mid_creation_saved'
    and queues.slug = 'merchant-id'
    and cases.status = 'closed' and cases.close_outcome = 'successful'
    and merchants.deleted_at is null
    and (case_history.details ->> 'portalMid') ~ '^[0-9]+$'
  order by cases.merchant_id, case_history.created_at desc)
```

then `candidate_mid` (portal MID plus internal MID) left-joined to `portal_mid_limit_applications`.

Measured at scale (12,190 closed-successful MID cases):

| Variant | Execution ms | Buffers |
|---|---|---|
| Current `latest_mid` CTE | 81.9–82.7 | 88,245 |
| Partial covering index on `case_history` (details included) | 63.7–66.8 | 76,057 |
| Rollup table holding `details` jsonb (wide) | 36.6 (pending count) | ~5,000 local reads |
| Narrow rollup (merchant, case_id, portal_mid int, internal_mid int, saved_at) | **5.5** (pending count) | 115 shared + 256 local |

Plan of the current CTE: Parallel Seq Scan on `cases` (42,667 rows per worker), then 12,190 index lookups into `case_history_case_action_created_idx` (48,761 buffers), then a sort. The dashboard runs about three recomputations per load (273k buffers ≈ 3 × 88k), which explains 549–679 ms per dashboard request.

Production evidence: five patterns, 49.7% of total time (table above). Production p50s are 1.5–10.4 ms today because the tables are small; growth scales the cost linearly in merchants and in `case_history`.

### Q2. Case search (`case-query.service.ts:304`)

Current: `(cases.case_number ilike $1 or merchants.business_name ilike $2)` across `cases` ⨝ `merchants` ⨝ `queues`. The `OR` spans two tables, so neither `cases_case_number_trgm_idx` nor `merchants_business_name_trgm_idx` can be used. Plan: Seq Scan on `cases` (2,896 buffers) and on `merchants` (1,406 buffers), 4,303 buffers total.

| Term | Current ms | `UNION` rewrite ms |
|---|---|---|
| Merchant term (`%Merchant 1234%`) | 171.6 | 6.1 |
| Case-number term (`%P0000123%`) | 158.9 | 4.2 |

Rewrite tested (list form):

```sql
select id from (
  select c.id, c.created_at from cases c where c.case_number ilike $1
  union
  select c.id, c.created_at
  from cases c join merchants m on m.id = c.merchant_id
  where m.business_name ilike $2
) s
order by created_at desc, id desc
limit 20
```

The `UNION` form uses both trigram indexes and `cases_merchant_created_idx`. The count query needs the same rewrite. Other list filters (status, queue, owner, permitted-queue scope) must be reapplied to the outer query.

### Q3. Merchant search (`merchants.service.ts:389–400`)

Current: `business_name ilike or submitter_email ilike or owner_full_name ilike (or merchant_number =)`. Trigram indexes exist for `business_name` and `submitter_email` only; production and local both have no `owner_full_name` index. The missing third column forces a Seq Scan (1,406 buffers).

| Variant | Execution ms |
|---|---|
| Current (three-way OR, no owner index) | 51.7 |
| Two-way OR (business_name, email) using both trigram indexes, `BitmapOr` | 1.1 |
| Three-way OR after adding `gin (owner_full_name gin_trgm_ops)` | 1.5 |

### Q4. Case list `count(*)` (`case-query.service.ts`)

Current count joins `cases`, `merchants`, `queues` even when no filter needs the joined tables.

| Variant | Execution ms | Buffers |
|---|---|---|
| Count with joins | 38.5 | 3,053 (Parallel Seq Scan on `cases`) |
| Count from `cases` only | 9.8 | 262 (Index Only Scan on `cases_flow_version_idx`) |

Valid only while `merchant_id` and `queue_id` remain non-null with foreign keys, and only when the request has no filter on the joined tables.

### Q5. `/api/cases/owners` (`listCaseOwners`)

| Variant | Execution ms | Buffers |
|---|---|---|
| Grouped join over `cases` | 40.2 | 2,897 (Seq Scan on `cases`) |
| `select u.id from users u where exists (select 1 from cases c where c.owner_id = u.id)` | 0.085 | 23 (7 index-only probes via `cases_owner_created_idx`) |

### Q6. Indexes dropped by migrations 0087–0094

I recreated the eight dropped indexes on the local copy and re-ran affected routes.

| Index | Effect at 128k cases |
|---|---|
| `cases_updated_id_idx` (0094) | `GET /api/cases?sortBy=updatedAt`: 139.7 ms without, 29.0 ms with |
| `cases_current_stage_queue_idx` | none measurable |
| `storage_objects_case_attempt_idx` | none measurable |
| `case_flow_close_jobs_source_queue_idx` | none measurable |
| `case_flow_close_jobs_target_queue_idx` | none measurable |
| `case_resubmission_tokens_case_id_idx` | none measurable |
| `cases_case_number_id_idx` | none measurable |
| `user_password_tokens_user_idx` | none measurable |

Only routes tested were affected; queries not exercised by the harness are not covered by this conclusion.

### Q7. Sort by `merchantName` (`GET /api/cases?sortBy=merchantName`)

119.3 ms DB time, 4,556 buffers. The sort key lives on the joined `merchants` table, so the sort cannot use a `cases` index. No fix was tested; options are a denormalized name column or a design change to sorting.

### Q8. Lower-priority scans

- `GET /api/users` and search: 18.7–19.9 ms, 6 queries; count-by-owner scan over `cases`.
- `GET /api/dashboard/agreements/awaiting-physical`: 16.3 ms, 13,506 buffers.
- `GET /api/merchants` sort by `ownerFullName` / `updatedAt`: 33.4–33.9 ms.
- Per-request query counts of 8–16 on case detail and comment write (see APP-5).

## Recommendations

| ID | Recommendation | Target | Benefit (measured) | Risk | Approval needed | Test first? | Evidence |
|---|---|---|---|---|---|---|---|
| APP-1 | Replace the per-request `latest_mid` CTE with a merchant-level rollup (one row per merchant: case_id, portal_mid, internal_mid, saved_at). | `dashboard.service.ts` (~225–410); new table and migration | Pending-count step 82 → 5.5 ms; buffers ~287k → ~380. Addresses about 50% of production DB time. | Rollup must remain consistent with `case_history`, case status/outcome and `merchants.deleted_at`. | Yes (schema and code) | Yes | Q1; Insights table |
| APP-1a | Interim: compute `latest_mid` once per request and reuse it across the dashboard queries. | Same file | Dashboard runs about three recomputations per load (273k buffers ≈ 3 × 88k). | Low | Code review | Yes | Q1 |
| PG-1 | Partial covering index `case_history (case_id, created_at desc) include (details) where action = 'mid_creation_saved'`. | Migration | 82 → 64–67 ms; buffers 88k → 76k. Small gain alone; 8.6 MB locally. | Extra write cost on a hot table | Yes | Yes | Q1 |
| APP-2 | Rewrite case search as a `UNION` of case-number and merchant-name lookups (list and count). | `case-query.service.ts:304` | 171.6 → 6.1 ms (merchant term); 158.9 → 4.2 ms (number term). | Ordering, pagination and other filters must match. | Code review | Yes | Q2 |
| PG-2 | Add `gin (owner_full_name gin_trgm_ops)` on `merchants`. | Migration | Merchant search 51.7 → 1.5 ms. | Write cost on merchant updates; table is small | Yes | Yes | Q3 |
| APP-3 | Skip the `merchants` and `queues` joins in the case list count when no filter needs them. | `case-query.service.ts` | 38.5 → 9.8 ms; buffers 3,053 → 262. | Valid only while FKs stay non-null | Code review | Yes | Q4 |
| APP-4 | Rewrite `/api/cases/owners` with `EXISTS` (or `distinct` on `owner_id`). | `listCaseOwners` | 38.8 → 0.085 ms. | Low | Code review | Yes | Q5 |
| PG-3 | Decide whether to keep migration 0094's drop of `cases_updated_id_idx`, or recreate it. | Migration 0094 | Sort by `updatedAt`: 139.7 ms without, 29.0 ms with. | Extra write cost vs. one regressed sort | Yes (owner decision) | Yes | Q6 |
| APP-5 | Reduce round trips per request (case detail 8–16 queries; comment write about 15; session check plus access lookup on every authenticated request). | Service layer | Local DB time per request is under 1 ms; benefit depends on app-to-database latency, which was not measured. Measure before changing. | Low | Code review | Yes | Whole-project results |
| OBS-1 | Add SQLCommenter tags: `application`, `route` (normalized template), `release_sha`, `source`, and `job` for the close-job poller. Do not tag user or request IDs. | Backend DB layer | Enables attribution of load per route and per background job; today none exists. | Low | Yes (code) | Yes | Tag inventory |
| OBS-2 | Identify what runs the index-bloat query (17.35% of total time, 8 executions at 217.6 ms p50). | External tool/schedule | Largest single share of measured time; not application traffic. | None | No | No | Insights table |
| OBS-3 | Evaluate raw query collection for the dashboard MID family. | Cluster parameter `pginsights.raw_queries` | Would expose literal parameters per execution; applicable only if pattern-level data proves insufficient after APP-1. Literal values become visible to the observability pipeline. | Data-handling review | Yes | n/a | Capability gap |
| AGENT-1 | Add a database-targeting section and agent-query tag policy to `AGENTS.md`. | `AGENTS.md` | Consistent tagging of agent queries (`source=agent`). | None | Yes (doc edit) | No | Skills pack |

## Proposed change set requiring approval

For all items: no change has been made. All items change code, and PG-1, PG-2, PG-3 and APP-1 also change the schema.

### APP-1 / APP-1a: dashboard MID rollup

- Exact target: `src/modules/dashboard/dashboard.service.ts` (~225–410) and, for APP-1, a new forward-only migration plus journal entry.
- Exact change: APP-1a computes `latest_mid` once per request. APP-1 adds a narrow table (proposed shape, subject to review): `merchant_latest_mid (merchant_id uuid primary key, case_id uuid, portal_mid int, internal_mid int, saved_at timestamptz)`, backfilled from the current CTE and maintained where MID details are saved or the case closes.
- Interface: repository PR; migration applied to a non-production branch first.
- Expected effect: about 50% less production DB time.
- Availability impact: none if the table is added and backfilled before code reads it.
- Test plan: compare rollup output to the current CTE on the scale copy and on a non-production branch; check merchant soft-delete and MID-edit cases.
- Rollback: revert the PR; the extra table is harmless.
- Changes production: yes, once migrated and deployed.

### APP-2 / APP-3 / APP-4: query rewrites

- Target: `case-query.service.ts` (search and count), `listCaseOwners`.
- Change: `UNION` search (list and count), count without unneeded joins, `EXISTS` for owners (SQL above).
- Interface: repository PR.
- Test plan: identical result sets and ordering against the current queries, with each list filter combination.
- Rollback: revert the PR.
- Changes production: yes, on deploy.

### PG-1 / PG-2: indexes

- PG-1: `create index concurrently on case_history (case_id, created_at desc) include (details) where action = 'mid_creation_saved'`.
- PG-2: `create index concurrently on merchants using gin (owner_full_name gin_trgm_ops)`.
- Interface: forward-only migrations with journal entries; test on a non-production branch first.
- Availability impact: use `concurrently` in production to avoid write locks.
- Rollback: drop the index in a further forward migration.
- Changes production: yes.

### PG-3: migration 0094

- Change: recreate `cases_updated_id_idx (updated_at, id)` in a new forward-only migration, or accept the regression.
- Rollback: drop it again.
- Changes production: yes.

### OBS-1: SQLCommenter tags

- Target: backend DB layer.
- Change: bounded tag set above; no user, request, tenant or session IDs.
- Rollback: revert.
- Changes production: yes, on deploy.

## Limits of this evidence

- Production data is small; production plans mostly use sequential scans and are not informative. Absolute milliseconds come from the local scale copy; the ranking carries over.
- Real usage may differ from my seeded distribution of MID cases and search terms.
- The local Docker environment restarted during this work. Write latencies measured on the cold run (tens of ms to over 1 s on case insert, `case_history`, `email_log`, merchant insert) are cache artifacts and were replaced by warm-run numbers.
- Local `pg_stat_user_indexes` counters were reset by that restart; "zero scans" figures from the local DB were not used for any index-drop recommendation.
- `sub_merchant_form_details` is in use; do not drop it.
- Not assessed in this run: webhooks, backups and PITR, roles, Traffic Control, private connectivity, raw query collection state, a plain `EXPLAIN` on production, app-to-database network latency.

## Changes intentionally not applied

- No PlanetScale settings changed.
- No schema changed on production or any branch.
- No traffic controls changed.
- No roles or credentials changed.
- No webhooks changed.
- No code changed in your repositories.
- No branches, backups, restores, deploy requests or migrations created.
- Local scratch experiments (extra indexes, temp tables, pipeline test data) exist only in a throwaway local PostgreSQL.

## Evidence appendix

| Source | Command / path | Value / notes |
|---|---|---|
| MCP | `get_insights` `sort_by=totalTime`, `period=8d`, `limit=8` | Top-pattern table above |
| MCP | `list_query_tags` `period=8d` | System tags only plus `source=planetscale-mcp` (14) |
| MCP | `execute_read_query` (tagged) | cases 388, merchants 124, case_history 1,345, `mid_creation_saved` 59, `portal_mid_limit_applications` 401, `pg_trgm` installed, no `owner_full_name` index |
| Repository | `origin/main` `e71b150` | Migrations 0087–0094; `dashboard.service.ts`, `case-query.service.ts:304`, `merchants.service.ts:389–400` |
| Local DB | per-API capture (82 routes) | Per-API tables above |
| Local DB | `EXPLAIN (ANALYZE, BUFFERS)` | Q1–Q6 timings and buffers |
| Local DB | pipeline run, warm | 149 statements, 1,362 calls |

## Run log (assessment mechanics, not findings)

- A tool call was interrupted once to pull the latest backend first; done (fetch, then clone of `origin/main` into scratch).
- Several shell `pkill -f`/`pgrep -f` patterns matched the invoking command line and killed the shell; process ids were used instead.
- Local Docker daemon and the `pg18` container were stopped by an environment restart; restarted, data intact.
- The PlanetScale MCP disconnected and reconnected during the whole-project pass; production figures are from the earlier read-only session in this conversation.
- Test harness scripts had hard-coded state paths and merchant names; copies were adapted in the scratch directory.
- Access tokens expire after 15 minutes; refreshed between runs.

No changes have been applied. Approve specific change IDs before any mutation.
