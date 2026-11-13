# 30 — Database Schema And Data Model

## At a glance

| | |
|---|---|
| **What it is** | The complete map of the portal's database: every table, its columns, what each column means in plain words, and how the tables link to each other. It is the reference to use before changing any feature, because almost every rule in the portal (who can work a case, which documents are required, what happens when a merchant is terminated) is enforced here as well as in the application code. |
| **Database** | PostgreSQL (PlanetScale Postgres in production, per the backend README; the backend uses the `postgres` driver with PgBouncer on port 6432 for runtime traffic and a direct connection on port 5432 for migrations, with prepared statements disabled). |
| **Who can use it** | Developers and the owner (Sufyan) reading or changing the portal. Nobody accesses the database directly through the portal UI. Staff see merchants, cases and configuration through the API; merchants see only their own form and resubmission page. |
| **Tables** | 41 in total. |
| **Migrations** | Forward-only. `drizzle/` holds 120 numbered `*.sql` migration files (prefixes `0000`–`0116`; some prefixes are used twice or three times, for example `0004`–`0007`) plus two seed files (`seed-queues.sql`, `seed-queue-stages.sql`). Copies of both seeds also exist in `sql/`; see file 34 and file 32, gaps 16 and 18. `drizzle/meta/_journal.json` lists 116 migrations; four numbered files are not in the journal (see file 32, gap 17). |
| **Main code** | Backend: `src/db/schema.ts` (the single source of truth, Drizzle ORM, PostgreSQL), `drizzle.config.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `src/db/audit.ts`, `src/db/seed-demo.ts`, `sql/seed-queues.sql`, `sql/seed-queue-stages.sql`, and the migration files under `drizzle/`. |
| **Success looks like** | A merchant submission, a case, an email and a file each land in the right tables, linked by IDs, and changing the flow never rewrites history. |

## How it works — the journey

```
Merchant submits the public form
        ↓
One row in merchants + one row per document in merchant_documents
+ one row in public_submission_attempts + storage_objects rows for the Drive files
        ↓
Starting cases created in cases, according to the active flow version
        ↓
Staff work cases: reviews in case_field_reviews, comments in case_comments,
every change in case_history; documents, agreements and sub-merchant forms
have their own detail tables linked to the case
        ↓
Closing a case can create the next case (case_flow_close_triggers → case_flow_close_jobs → case_links)
        ↓
Email and notifications are logged: every email in email_log, every in-app notification in notifications
```

## Rules that apply to the whole database

| Topic | Detail |
|---|---|
| **Migrations are forward-only** | Backend README and `AGENTS.md`: add a new migration under `drizzle/`, update the journal, run `bun run db:migrate` with the direct URL. Never rewrite a migration that may have reached another environment, and never migrate the production database from an agent. |
| **ORM and migrations** | Drizzle ORM (`drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11). Schema in `src/db/schema.ts`; migrations in `drizzle/`; config in `drizzle.config.ts` (PostgreSQL dialect, schema `./src/db/schema.ts`, requires `DIRECT_DATABASE_URL`). Commands: `bun run db:migrate`, `bun run db:generate`, `bun run db:audit` (read-only checks for duplicate indexes, foreign-key index coverage, constraint validation and query-critical indexes), `bun run db:studio`, `bun run db:seed-demo`. |
| **Connections** | `src/db/client.ts` — pooled runtime connection from `DATABASE_URL`, pool max `DATABASE_POOL_MAX` (default 10), connect timeout `DATABASE_CONNECT_TIMEOUT_SECONDS` (default 10), idle timeout `DATABASE_IDLE_TIMEOUT_SECONDS` (default 20). Prepared statements and type fetching are both off (`prepare: false`, `fetch_types: false`), because pooled endpoints can switch server between transactions. Queries are tagged with the matched route template for PlanetScale Insights (`src/db/query-tags.ts`, `RELEASE_SHA` tags the release). |
| **IDs** | Almost every table uses a UUID primary key (`uuid().defaultRandom()`), except `case_flow_versions.id` (serial integer) and `flow_configuration_revisions.id` (integer, always 1 — a singleton row). Tables with one row per parent use the parent's ID as the key: `queue_case_sequences` is keyed by the queue's UUID, and `mid_case_portal_mids` by the case's UUID. `merchants.merchant_number` is a `serial` (auto-incrementing) unique number, and `cases.case_number` is a `varchar(20)` unique string built from the queue prefix plus a per-queue sequence (`queue_case_sequences.last_number`). A UUID is a long random identifier; a serial is an auto-incrementing number. |
| **Timestamps** | `created_at` / `updated_at` are `timestamp with time zone`, usually `defaultNow()`; most tables also carry `updated_at`. Soft delete is a `deleted_at` timestamp (merchants only — see below); there is no soft delete on cases or users. Soft delete means the row is marked deleted instead of being removed. |
| **State guards in the database** | State-guard triggers reject illegal state changes even if application code skips a check. Migration `0101_case_state_guard.sql` raises `P7601` for cases; `0103_merchant_state_guard.sql` raises `P7602` for merchants; `0104` (queues), `0105` (storage objects), `0106` (resubmission tokens), `0109` (case-flow close jobs), `0110` (password links and refresh tokens) and `0111` (case data) raise `P7603`. The error handler (`src/middleware/error-handler.ts`) maps them to HTTP 409 with these messages: `P7601` "This case change is not allowed in its current state."; `P7602` "This is not allowed for the merchant in its current state."; `P7603` "This change is not allowed in its current state.". Published flow versions and rules are immutable (see the flow row above). A trigger is a database rule that runs automatically when a row changes. |
| **Secrets are never stored in plain text** | Passwords are Argon2 hashes in `users.password_hash`; bearer tokens and password links are SHA-256 hashes; portal password codes and API credentials are AES-256-GCM ciphertext (see file 29). |
| **The flow is versioned** | `case_flow_versions` holds published snapshots of the queue flow; `flow_configuration_revisions` points at the active version; every merchant and case records the `flow_version_id` it started under, so changing the flow never rewrites history. Migration `0075_case_flow_versions.sql` creates the enforcement triggers: `case_flow_versions_immutable` (blocks UPDATE and DELETE on published versions), `*_immutable` triggers on `case_flow_start_rules`, `case_flow_close_triggers`, `case_flow_close_blockers` and `case_flow_creation_requirements` (block INSERT, UPDATE and DELETE), `merchants_pin_flow_version`, `cases_inherit_flow_version` and `case_flow_jobs_inherit_version` (set the version on insert and block reassignment), and `flow_configuration_validate_version`. |
| **Frontend has no database access** | The frontend has no database access and no database code. It only talks to the backend API (base URL `VITE_API_URL`, default `http://localhost:3000` in development, `https://onboard.assanpay.net` in production). The shapes it sends and receives are defined by the backend's Zod schemas and mirrored in frontend TypeScript types under `src/apis/` and `src/schemas/` — for example `merchant-onboarding.schema.ts` mirrors the `merchants` columns and the required-document rules. The frontend never invents a column: if a field is not in an API response, it is not shown. |

### Frontend behaviours that depend directly on this schema

| Behaviour | Detail |
|---|---|
| Required documents change with merchant type | The public form's required documents change with `merchant_type` (see `merchant_documents` / `merchant_document_type` below and `merchantSpecificDocumentMap` in `merchants.schemas.ts`). |
| Pagination | Lists are paginated by cursor (`createdAt` + `id`) in most places; comments and history are not paginated — the API returns every row (see file 32). |

### Seeds

| Seed | Detail |
|---|---|
| `sql/seed-queues.sql` | Inserts 8 queues in the file (Documents Review `DR`, EP Sub-Merchant Form `SM`, Agreement `AG`, MID Creation `MI`, Testing `TS`, WordPress Website `WP`, Live `LV`, Support Ticket `ST`). **The live database has 7; Support Ticket is missing** (see file 27). with `ON CONFLICT (slug) DO NOTHING`, plus a `queue_case_sequences` row (`last_number` 0) per queue. |
| `sql/seed-queue-stages.sql` | **Empty (0 lines).** The stage seed that exists is `drizzle/seed-queue-stages.sql`, which seeds Documents Review stages only, as its header says. See file 32, gap 18. |
| `src/db/seed-demo.ts` (`bun run db:seed-demo`) | Creates 96 demo merchants on `demo.assanpay.test` with cases and applied MIDs. Submission dates are set 0–60 days before the run, never earlier than 2026-08-01 (UTC+5, `WINDOW_START` in `src/db/seed-demo.ts`). The code comment says "Aug 1 – Sep 30, 2026", which does not match the logic: the dates follow the day the seed runs; re-running it wipes the previous demo set and never touches real rows. |

## Enums — all values, from `src/db/schema.ts`

An enum is a fixed list of allowed values for a column.

| Enum | Values |
|---|---|
| `role_type` | `super_admin`, `admin`, `agent` |
| `user_status` | `active`, `inactive` |
| `user_gender` | `male`, `female` |
| `queue_view_scope` | `all`, `selected` |
| `user_queue_access_type` | `view`, `work` |
| `password_token_purpose` | `invite`, `reset` |
| `password_token_consumed_reason` | `used`, `superseded`, `invalidated` |
| `refresh_token_status` | `active`, `revoked`, `rotated` |
| `merchant_type` | `sole_proprietorship`, `private_limited_company`, `public_limited_company`, `partnership`, `limited_liability_partnership`, `ngo_npo_charity`, `trust_society_association` |
| `merchant_status` | `pending`, `testing`, `live`, `terminated` |
| `kin_relation` | `mother`, `father`, `brother`, `sister`, `spouse`, `son`, `daughter` |
| `website_cms` | `wordpress`, `shopify`, `custom_website` |
| `document_status` | `pending`, `approved`, `rejected` |
| `priority` | `normal`, `high` |
| `business_scope` | `local`, `international` |
| `merchant_document_type` | `owner_cnic_front`, `owner_cnic_back`, `next_of_kin_cnic_front`, `next_of_kin_cnic_back`, `utility_bill`, `company_ntn`, `authority_letter`, `taxpayer_registration_certificate`, `company_incorporation_certificate`, `memorandum_articles`, `form_ii`, `form_a`, `board_resolution`, `certificate_of_commencement`, `partnership_deed`, `form_c`, `llp_form_iii`, `annual_audited_accounts`, `other_entity_certification`, `secp_section_42_license`, `risk_assessment_documents`, `by_laws_rules_regulations`, `trust_deed`, `trust_registration_certificate`, `trustees_authorized_signatories_cnic`, `proof_of_address`, `tax_exemption_certificate`, `other_supporting_documents` |
| `case_status` | `new`, `working`, `closed`, `awaiting_merchant` |
| `case_close_outcome` | `successful`, `unsuccessful` |
| `queue_workflow_type` | `generic`, `document_review`, `agreement`, `mid`, `testing`, `wordpress`, `physical_agreement`, `live`, `sub_merchant_form` |
| `queue_lifecycle` | `draft`, `active`, `inactive` |
| `stage_category` | `new`, `in_progress`, `closed` |
| `public_submission_outcome` | `created`, `replayed`, `rate_limited`, `rejected`, `error` |
| `field_review_status` | `pending`, `approved`, `rejected` |
| `notification_type` | `case_assigned`, `case_unassigned`, `comment_mention`, `comment_reply`, `comment_thread`, `case_resubmitted`, `case_email_undelivered` |
| `email_log_status` | `queued`, `sent`, `failed`, `delivered`, `delivery_delayed`, `bounced`, `complained`, `suppressed` |
| `agreement_email_status` | `not_sent`, `sent`, `failed` |
| `sub_merchant_form_email_status` | `not_sent`, `sent`, `failed` |
| `storage_object_kind` | `file`, `folder` |
| `storage_object_visibility` | `private`, `public` |
| `storage_object_lifecycle` | `provisioning`, `current`, `superseded`, `failed`, `deleted` |
| `resubmission_token_consumed_reason` | `used`, `superseded`, `invalidated` |
| `case_merchant_request_kind` | `document_resubmission`, `agreement`, `document_resubmission_manual`, `agreement_manual` |
| `case_flow_close_jobs.status` | Not an enum: it is a generated `varchar(16)` computed from timestamps — `completed` / `blocked` / `failed` / `retrying` / `pending` (see `case_flow_close_jobs` below). |

## Tables (41 in total)

### 1. `users` — staff accounts

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | The staff member's ID. |
| `name` | varchar(120) | Full name. |
| `email` | varchar(255), unique | Work email. |
| `username` | varchar(64), unique | Login username. |
| `gender` | `user_gender`, default `male` | `male` / `female`. |
| `password_hash` | text, nullable | Argon2 hash of the password. A user with no password cannot log in. |
| `role_type` | `role_type` | `super_admin` / `admin` / `agent`. |
| `status` | `user_status`, default `active` | `active` / `inactive`. |
| `queue_view_scope` | default `all` | `all` or `selected` — which queues the agent may see. |
| `session_version` | integer, default 0, checked ≥ 0 | Bumped to revoke all sessions (see file 29). |
| `created_by_user_id` | → `users.id`, on delete set null | Who created this account. |
| `last_login_at` | timestamp | Last successful login. |
| `created_at`, `updated_at` | timestamps | When the row was created / last changed. |

Rules: usernames are stored lowercase with a unique index on `lower(username)`; exactly one `super_admin` (partial unique index on `role_type` where it is `super_admin`).

### 2. `login_attempt_counters` — sign-in throttling

| Column | Type / rule | What it means |
|---|---|---|
| `key_hash` | text PK | SHA-256 of the budget key, so typed identifiers are not stored in clear text. |
| `attempts` | integer (> 0) | Failed attempts in the current window. |
| `window_started_at` | timestamp | When the current fixed 1-hour window started. |

One row per budget key per fixed 1-hour window (see file 29). Indexed on `window_started_at` (`login_attempt_counters_window_idx`, migration `0112_login_attempt_counters.sql`).

### 3. `queues` — the work queues

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Queue ID. |
| `name` | varchar(120), unique | Queue name, e.g. "Live". |
| `slug` | varchar(120), unique | URL-safe identifier. |
| `prefix` | varchar(4), unique | Case-number prefix, e.g. `LV` — at most 4 characters. |
| `workflow_type` | default `generic` | What kind of work this queue does. |
| `lifecycle` | default `inactive` | `draft` / `active` / `inactive`. |
| `revision` | integer, default 1 (≥ 1) | Version counter for optimistic concurrency (see file 27). |
| `sla_hours` | integer, default 24 (> 0) | SLA in hours. |
| `is_active` | boolean, default false | Mirrors `lifecycle`: a check constraint `is_active = (lifecycle = 'active')` (added by migration `0104_queue_lifecycle_guard.sql`). |
| `created_at` | timestamp | When the queue was created. |

Migration `0029_queue_sla_hours.sql` added `sla_hours`; `0030_case_sla_breached.sql` added `cases.sla_breached`.

### 4. `configuration_settings` — key/value settings store

| Column | Type / rule | What it means |
|---|---|---|
| `key` | varchar(120) PK | Setting name, e.g. `limits-and-mdr`. |
| `value` | jsonb, not null | The setting, stored as JSON. |
| `updated_at` | timestamp | Last change. No `created_at`, no `updated_by`. |

One row per setting (email, limits, payment methods, portal settings and so on are stored here as JSON). See files 25–26.

### 5. `case_flow_versions` — published flow snapshots

| Column | Type / rule | What it means |
|---|---|---|
| `id` | serial PK | Version number. |
| `published_at` | timestamp | When this version was published. |
| `published_by` | → `users.id` (restrict on delete) | Who published it. |
| `change_note` | text | What changed in this version. |
| `queue_snapshot` | jsonb | Array of `{ id, name, slug, prefix, workflowType, lifecycle, isActive }` — a frozen copy of the queues at publish time. |

Published versions and rules are immutable, enforced by database triggers.

### 6. `flow_configuration_revisions` — singleton pointer to the active flow

| Column | Type / rule | What it means |
|---|---|---|
| `id` | integer PK, default 1 (check: `id = 1`) | Always 1 — there is only one row. |
| `revision` | integer, default 1 (≥ 1) | Revision counter. |
| `active_flow_version_id` | → `case_flow_versions.id` | Which flow version is active now. |
| `updated_at` | timestamp | Last change. |

### 7. `case_flow_merchant_moves` — a bulk move of merchants to a new flow version

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Move ID. |
| `to_version_id` | → `case_flow_versions.id` (restrict) | The version merchants are moved to. |
| `moved_by` | → `users.id` (restrict) | Who did the move. |
| `reason` | text | Why the move happened. |
| `merchant_count` | integer | How many merchants were moved. |
| `cancelled_job_count` | integer | How many follow-up jobs were cancelled by the move. |
| `created_at` | timestamp | When the move happened. |

### 8. `case_flow_merchant_move_items` — one row per merchant in a move

| Column | Type / rule | What it means |
|---|---|---|
| `move_id` | → `case_flow_merchant_moves.id` (cascade) | Which move this row belongs to. |
| `merchant_id` | → `merchants.id` (cascade) | Which merchant was moved. |
| `from_version_id` | → `case_flow_versions.id` (restrict) | The version the merchant came from. |

PK is (`move_id`, `merchant_id`). The triggers on merchants/cases/jobs only accept a version change that has a row here, so this also records each merchant's original version.

### 9. `agreement_draft_templates` — agreement draft per business type

| Column | Type / rule | What it means |
|---|---|---|
| `business_type` | varchar(120) PK | The business type this draft is for. At most one draft per business type. |
| `label` | varchar(160) | Display label. |
| `original_name` | varchar(255) | Original file name. |
| `mime_type` | varchar(128) | File type, e.g. `application/pdf`. |
| `size_bytes` | integer (≥ 0) | File size in bytes. |
| `google_drive_file_id` | varchar(255) | Drive file ID. |
| `google_drive_web_view_link` | text | Drive view link. |
| `google_drive_download_link` | text, nullable | Drive download link. |
| `google_drive_folder_id` | varchar(255) | Drive folder ID. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

### 10. `sub_merchant_draft_templates` — sub-merchant draft templates

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Template ID. |
| `name` | varchar(160), unique | Sub-merchant name. |
| `seller_code` | varchar(80) | Seller Code. |
| `original_name` | varchar(255) | Original file name. |
| `mime_type` | varchar(128) | File type. |
| `size_bytes` | integer (≥ 0) | File size in bytes. |
| `google_drive_file_id` | varchar(255) | Drive file ID. |
| `google_drive_web_view_link` | text | Drive view link. |
| `google_drive_download_link` | text, nullable | Drive download link. |
| `google_drive_folder_id` | varchar(255) | Drive folder ID. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

### 11. `queue_stages` — stages inside a queue

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Stage ID. |
| `queue_id` | → `queues.id` (cascade) | Which queue this stage belongs to. |
| `name` | varchar(120) | Stage name. |
| `slug` | varchar(120) | URL-safe identifier. |
| `order` | integer (> 0) | Position in the queue. |
| `category` | `stage_category` | `new` / `in_progress` / `closed`. |
| `is_active` | boolean, default true | Whether the stage is in use. |
| `capabilities` | jsonb, nullable | What this stage can do. |
| `created_at` | timestamp | When created. |

Unique: (`queue_id`, `slug`), (`queue_id`, `order`), and (`id`, `queue_id`).

### 12. `user_queue_access` — an agent's per-queue access

| Column | Type / rule | What it means |
|---|---|---|
| `user_id` | → `users.id` (cascade) | The agent. |
| `queue_id` | → `queues.id` (cascade) | The queue. |
| `access_type` | `view` / `work` | Whether the agent may view or also work cases in this queue. |
| `created_at` | timestamp | When granted. |

PK is (`user_id`, `queue_id`, `access_type`).

### 13. `user_password_tokens` — invite/reset links

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Token row ID. |
| `user_id` | → `users.id` (cascade) | The staff user the link is for. |
| `token_hash` | text, unique | SHA-256 hash of the link token — the token itself is never stored. |
| `purpose` | `invite` / `reset` | Invite (new password) or reset. |
| `expires_at` | timestamp | When the link stops working (24h reset, 72h invite). |
| `consumed_at` | nullable | When the link was used. |
| `consumed_reason` | nullable; check: a reason requires `consumed_at` | `used` / `superseded` / `invalidated`. |
| `created_by` | → `users.id` (set null) | Who created the link. |
| `created_at` | timestamp | When created. |

### 14. `refresh_tokens` — refresh sessions

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Token row ID. |
| `user_id` | → `users.id` (cascade) | The staff user. |
| `token_hash` | text, unique | SHA-256 hash of the refresh token. |
| `status` | default `active` | `active` / `revoked` / `rotated`. |
| `expires_at` | timestamp | When the token expires (7 days). |
| `revoked_at` | nullable | When revoked, if ever. |
| `replaced_by_token_id` | → `refresh_tokens.id` (set null) | The token that replaced this one on rotation. |
| `user_agent` | text, nullable | Browser/device that created the session. |
| `ip_address` | varchar(64), nullable | IP that created the session. |
| `created_at` | timestamp | When created. |

Check: `status = 'active'` exactly when `revoked_at IS NULL`.

### 15. `merchants` — the merchant

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Merchant ID. |
| `flow_version_id` | → `case_flow_versions.id` (restrict; default `active_case_flow_version()`, reassignment rejected) | The flow version this merchant started under. |
| `merchant_number` | serial, unique | Auto-incrementing merchant number. |
| `submitter_email` | varchar(255) | Email of the person who applied. |
| `owner_full_name` | varchar(160) | Owner's full name. |
| `owner_phone` | varchar(32) | Owner's phone. |
| `active_whatsapp_number` | varchar(32), nullable | Active WhatsApp number. |
| `business_name` | varchar(200) | Business name. |
| `business_phone` | varchar(32) | Business phone. |
| `business_email` | varchar(255) | Business email. |
| `business_address` | text | Business address. |
| `business_website` | text | Business website. |
| `website_cms` | `website_cms` | `wordpress` / `shopify` / `custom_website`. |
| `business_description` | text | What the business does. |
| `business_registration_date` | date | When the business was registered. |
| `business_nature` | varchar(160) | Nature of business. |
| `merchant_type` | `merchant_type` | One of the seven business types. |
| `estimated_monthly_transactions` | integer (≥ 0) | Estimated monthly transaction count. |
| `estimated_monthly_volume` | numeric(14,2) (≥ 0) | Estimated monthly volume in PKR, 2 decimals. |
| `account_title` | varchar(200) | Bank account title. |
| `bank_name` | varchar(160) | Bank name. |
| `branch_name` | varchar(160) | Branch name. |
| `account_number_iban` | varchar(64) | Account number / IBAN. |
| `swift_code` | varchar(64), nullable | SWIFT code. |
| `next_of_kin_relation` | `kin_relation` | Mother / father / brother / sister / spouse / son / daughter. |
| `status` | default `pending` | `pending` / `testing` / `live` / `terminated`. |
| `priority` | default `normal` | `normal` / `high`. |
| `priority_note` | varchar(500), nullable | Why the priority was set. |
| `business_scope` | default `local` | `local` / `international`. |
| `currency` | varchar(8), default `PKR` | Currency, default PKR. |
| `limits_mdr_override` | jsonb, nullable | Per-merchant limit/MDR override (see file 25). |
| `google_drive_private_folder_id` | varchar(255), nullable | Private Drive root folder. |
| `google_drive_public_folder_id` | varchar(255), nullable | Public Drive root folder. |
| `live_at` | nullable | When the merchant went live. |
| `submitted_at` | default now | When the application was submitted. |
| `submission_key_hash` | varchar(64), nullable; SHA-256 of the public form's `Idempotency-Key`, unique when present | A retried submission returns this merchant. |
| `drive_files_deleted_at` | nullable | When the merchant's Drive files were deleted. |
| `drive_files_deleted_by` | → `users.id` (set null) | Who deleted the Drive files. |
| `deleted_at` | nullable — soft delete | When the merchant was (soft-)deleted. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Indexes include trigram (GIN) indexes on business name, submitter email and owner full name for search, and partial indexes on active (non-deleted) merchants. A trigram index speeds up partial-text search.

### 16. `public_submission_attempts` — every public onboarding attempt, accepted or not

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Attempt ID. |
| `ip_address` | varchar(64) | IP the attempt came from. |
| `user_agent` | varchar(512), nullable | Browser/device string. |
| `outcome` | `public_submission_outcome` | `created` / `replayed` / `rate_limited` / `rejected` / `error`. |
| `status_code` | integer | HTTP status returned. |
| `error_message` | varchar(500), nullable | Error message, if any. |
| `merchant_id` | → `merchants.id` (set null — it outlives a permanent delete as NULL so the limit and the audit trail still hold) | The merchant created, if any. |
| `created_at` | timestamp | When the attempt happened. |

The per-IP submission limit counts rows with `outcome = 'created'` in the last 24 hours. Kept for 60 days (see file 29).

### 17. `merchant_documents` — one row per uploaded merchant document

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Document ID. |
| `merchant_id` | → `merchants.id` (cascade) | The merchant. |
| `document_type` | `merchant_document_type` | Which document this is (e.g. `owner_cnic_front`). |
| `original_name` | varchar(255) | Original file name. |
| `mime_type` | varchar(128) | File type. |
| `size_bytes` | integer (≥ 0) | File size in bytes. |
| `google_drive_file_id` | varchar(255) | Drive file ID. |
| `google_drive_web_view_link` | text | Drive view link. |
| `google_drive_download_link` | text, nullable | Drive download link. |
| `google_drive_folder_id` | varchar(255) | Drive folder ID. |
| `status` | `document_status`, default `pending` | `pending` / `approved` / `rejected`. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

### 18. `queue_case_sequences` — per-queue case-number counter

| Column | Type / rule | What it means |
|---|---|---|
| `queue_id` | → `queues.id` (cascade) PK | The queue. |
| `last_number` | integer, default 0 (≥ 0) | Last case number issued for this queue. |

### 19. `cases` — one case per merchant per queue step

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Case ID. |
| `flow_version_id` | → `case_flow_versions.id` (restrict; default `NULL`, assigned on insert by the database, reassignment rejected) | The flow version this case started under. |
| `case_number` | varchar(20), unique | Case number, e.g. `DR-123` (queue prefix + sequence). |
| `queue_id` | → `queues.id` (restrict) | The queue this case belongs to. |
| `merchant_id` | → `merchants.id` (cascade) | The merchant. |
| `sub_merchant_id` | → `sub_merchant_draft_templates.id` (restrict, nullable) | The sub-merchant, for EP cases. |
| `owner_id` | → `users.id` (set null, nullable) | The staff member working the case. |
| `current_stage_id` | uuid, nullable; FK to (`queue_stages.id`, `queue_stages.queue_id`) together with `queue_id`, on delete set null | Current stage — a stage must belong to the case's queue. |
| `status` | default `new` | `new` / `working` / `closed` / `awaiting_merchant`. |
| `priority` | default `normal` | `normal` / `high`. |
| `close_outcome` | nullable | `successful` / `unsuccessful`. |
| `sla_breached` | boolean, nullable | `true` breached, `false` not breached, `null` not yet evaluated. |
| `close_reason` | text, nullable | Why the case was closed. |
| `closed_at` | nullable | When the case closed. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Indexes include `cases_open_merchant_idx` (open cases per merchant+queue) and `cases_successful_flow_idx` (closed+successful per merchant+queue), and a trigram (GIN) index `cases_case_number_trgm_idx` on `case_number` for search (created in migrations 0007 and 0011).

### 20. `case_field_reviews` — field-by-field review of a Documents Review case

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Review ID. |
| `case_id` | → `cases.id` (cascade) | The case. |
| `field_name` | varchar(120) | Which form field was reviewed. |
| `status` | `field_review_status`, default `pending` | `pending` / `approved` / `rejected`. |
| `remarks` | text, nullable | Reviewer's remarks. |
| `reviewed_by` | → `users.id` (set null, nullable) | Who reviewed it. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |
| `resubmitted_at` | nullable | When the field was resubmitted. |

Unique: (`case_id`, `field_name`).

### 21. `document_review_details` — which sub-merchants a Documents Review case covers

| Column | Type / rule | What it means |
|---|---|---|
| `case_id` | → `cases.id` (cascade) | The case. |
| `sub_merchant_id` | → `sub_merchant_draft_templates.id` (restrict) | The sub-merchant selected. |
| `sub_merchant_name` | varchar(160) | Sub-merchant name (copied at selection time). |
| `selected_by` | → `users.id` (set null, nullable) | Who selected it. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

PK is (`case_id`, `sub_merchant_id`).

### 22. `case_comments` — chatter on a case

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Comment ID. |
| `case_id` | → `cases.id` (cascade) | The case. |
| `author_id` | → `users.id` (set null, nullable) | Who wrote it. |
| `content` | text | The comment text. |
| `parent_id` | → `case_comments.id` (set null, nullable — replies) | The comment this replies to, if any. |
| `mentions` | text array, nullable | Users mentioned (`@name`). |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

### 23. `case_history` — the case timeline

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | History entry ID. |
| `case_id` | → `cases.id` (cascade) | The case. |
| `actor_id` | → `users.id` (set null, nullable) | Who did it. |
| `action` | varchar(64) | What happened, e.g. `assigned`, `closed`. |
| `details` | jsonb, nullable | Extra detail about the action. |
| `created_at` | timestamp | When it happened. |

### 24. `case_flow_start_rules` — which queues start automatically for a merchant under a flow version

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Rule ID. |
| `flow_version_id` | → `case_flow_versions.id` (restrict) | The flow version. |
| `target_queue_id` | → `queues.id` (restrict) | The queue that starts. |
| `order` | integer, default 1 (> 0) | Order in which queues start. |
| `is_active` | boolean, default true | Whether the rule is in force. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Unique: (`flow_version_id`, `target_queue_id`) where active.

### 25. `case_flow_close_triggers` — closing a case in the source queue creates a case in the target queue

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Trigger ID. |
| `flow_version_id` | → `case_flow_versions.id` (restrict) | The flow version. |
| `source_queue_id` | → `queues.id` (restrict) | The queue whose closure triggers the next case. |
| `target_queue_id` | → `queues.id` (restrict) | The queue the new case is created in. |
| `order` | integer, default 1 (> 0) | Order of triggers. |
| `is_active` | boolean, default true | Whether the trigger is in force. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Unique: (`flow_version_id`, `source_queue_id`, `target_queue_id`) where active.

### 26. `case_flow_close_blockers` — a queue cannot close until its prerequisite queue has closed successfully

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Blocker ID. |
| `flow_version_id` | → `case_flow_versions.id` (restrict) | The flow version. |
| `blocked_queue_id` | → `queues.id` (restrict) | The queue that is blocked. |
| `prerequisite_queue_id` | → `queues.id` (restrict) | The queue that must close successfully first. |
| `is_active` | boolean, default true | Whether the blocker is in force. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Unique: (`flow_version_id`, `blocked_queue_id`, `prerequisite_queue_id`) where active.

### 27. `case_flow_creation_requirements` — a case in the target queue may only be created once the prerequisite queue has closed successfully

Same shape as close blockers, with `target_queue_id` and `prerequisite_queue_id`; unique on (`flow_version_id`, `target_queue_id`, `prerequisite_queue_id`) where active.

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Requirement ID. |
| `flow_version_id` | → `case_flow_versions.id` (restrict) | The flow version. |
| `target_queue_id` | → `queues.id` (restrict) | The queue the new case would be created in. |
| `prerequisite_queue_id` | → `queues.id` (restrict) | The queue that must have closed successfully first. |
| `is_active` | boolean, default true | Whether the requirement is in force. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

### 28. `case_links` — parent/child links between cases

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Link ID. |
| `parent_case_id` | → `cases.id` (set null, nullable) | The earlier case. |
| `child_case_id` | → `cases.id` (cascade, unique — a case has at most one parent link) | The later case. |
| `merchant_id` | → `merchants.id` (cascade) | The merchant. |
| `trigger_type` | varchar(40) | What kind of trigger created the link. |
| `source_queue_id` | → `queues.id` (set null, nullable) | The queue the parent case was in. |
| `target_queue_id` | → `queues.id` (restrict) | The queue the child case is in. |
| `created_at` | timestamp | When the link was created. |

### 29. `case_flow_close_jobs` — durable follow-up-case jobs

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Job ID. |
| `flow_version_id` | → `case_flow_versions.id` (restrict; default `NULL`, assigned by the database) | The flow version. |
| `source_case_id` | → `cases.id` (cascade) | The case that closed. |
| `merchant_id` | → `merchants.id` (cascade) | The merchant. |
| `source_queue_id` | → `queues.id` (restrict) | The queue the closed case was in. |
| `target_queue_id` | → `queues.id` (restrict) | The queue the follow-up case goes to. |
| `attempts` | integer, default 0 (≥ 0) | How many times the job has been tried. |
| `only_if_target_missing` | boolean, default true | Only create the follow-up if it does not already exist. |
| `available_at` | default now | When the job may run. |
| `last_error` | text, nullable | Last error message. |
| `last_attempt_at` | nullable | When it was last tried. |
| `blocked_at` | nullable | When it became blocked. |
| `completed_at` | nullable | When it completed. |
| `failed_at` | nullable | When it failed. |
| `status` | varchar(16), generated always as: `completed` if `completed_at` is set, else `blocked` if `blocked_at` is set, else `failed` if `failed_at` is set, else `retrying` if `last_error` is set, else `pending` | Current state, computed from the timestamps. |

A check forbids `blocked_at` and `failed_at` together and requires `last_error` whenever the job is blocked or failed, and forbids an error/blocked/failed marker on a completed job. Unique: (`source_case_id`, `target_queue_id`).

### 30. `case_resubmission_tokens` — merchant resubmission links

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Token row ID. |
| `case_id` | → `cases.id` (cascade) | The case the link belongs to. |
| `token_hash` | varchar(64), unique, nullable | SHA-256 hash of the link token. |
| `consumed_at` | nullable | When the link was used. |
| `consumed_reason` | nullable | `used` / `superseded` / `invalidated`. |
| `delivered_at` | nullable — null while the link is only an email preview; set once it reaches the merchant | When the link was delivered. |
| `created_by` | → `users.id` (set null, nullable) | Who created the link. |
| `created_at` | timestamp | When created. |

Unique partial index `case_resubmission_tokens_one_active_per_case_kind_idx` on (`case_id`, whether `delivered_at` is set) where `consumed_at` is null: at most one unconsumed pending link and one unconsumed delivered link per case. No expiry column was found in the code reviewed; migration `0083_drop_resubmission_token_expiry.sql` dropped it. The plaintext token column was removed by `0116_drop_resubmission_plaintext_token.sql` (only `token_hash` is stored). `delivered_at` was added by `0113`.

### 31. `merchant_portal_password_codes` — the temporary password code for the merchant portal

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Code row ID. |
| `merchant_id` | → `merchants.id` (cascade) | The merchant. |
| `case_id` | → `cases.id` (set null, nullable) | The case that generated it. |
| `code_ciphertext` | text, nullable — cleared when the credentials email is sent (`consumePortalPasswordCode`) or when a newer code supersedes it (`generatePortalPasswordCode`, `portal-password-code.service.ts`); the row stays as an audit record | The encrypted password code. |
| `created_by` | → `users.id` (set null, nullable) | Who created it. |
| `created_at` | timestamp | When created. |
| `consumed_at` | nullable | When the code was used. |
| `superseded_at` | nullable | When the code was replaced. |

Check (`merchant_portal_password_codes_state_check`): the ciphertext is present exactly when the code is active (neither consumed nor superseded), and a code cannot be both consumed and superseded. A unique partial index (`merchant_portal_password_codes_one_active_idx`) allows at most one active code per merchant.

### 32. `merchant_portal_api_credentials` — portal API key and secret for the merchant's internal merchant ID

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Credentials row ID. |
| `merchant_id` | → `merchants.id` (cascade; unique — one row per merchant) | The merchant. |
| `case_id` | → `cases.id` (set null, nullable) | The case that generated them. |
| `api_key_ciphertext` | text | Encrypted API key. |
| `api_secret_ciphertext` | text | Encrypted API secret. |
| `api_key_last4` | varchar(4) | The last 4 characters of the key — the only part kept in clear text. |
| `updated_by` | → `users.id` (set null, nullable) | Who last updated them. |
| `updated_at` | timestamp | Last change. |

The row is deleted when the WordPress Website case closes.

### 33. `email_log` — every email the portal sends

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Email log ID. |
| `to_email` | varchar(255) | Recipient. |
| `subject` | varchar(500) | Email subject. |
| `template` | varchar(120) | Which template was used. |
| `case_id` | → `cases.id` (set null, nullable) | The case, if any. |
| `merchant_id` | → `merchants.id` (set null, nullable) | The merchant, if any. |
| `resend_id` | varchar(255), nullable | Resend's ID for this email. |
| `status` | `email_log_status`, default `queued` | `queued` / `sent` / `failed` / `delivered` / `delivery_delayed` / `bounced` / `complained` / `suppressed`. |
| `error_msg` | text, nullable | Error message, if the send failed. |
| `metadata` | jsonb, nullable | Extra data about the email. |
| `cc_emails` | text array, default `[]` | CC recipients. |
| `bcc_emails` | text array, default `[]` | BCC recipients. |
| `reply_to` | text array, default `[]` | Reply-to addresses. |
| `status_detail` | text, nullable — provider detail for the last status, for example a bounce reason | Delivery detail from Resend. |
| `status_updated_at` | nullable | When the status last changed. |
| `delivery_tracked` | boolean, default false | Whether delivery is being tracked. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

### 34. `portal_mid_limit_applications` — MIDs for which limits were applied

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Application ID. |
| `portal_mid` | integer (> 0; unique) | The merchant ID in the merchant portal (MID). |
| `category` | varchar(32), NOT NULL (check: one of `custom_wordpress`, `shopify`, `internal`) | Which kind of MID this is. |
| `merchant_id` | → `merchants.id` (cascade, nullable) | The merchant. |
| `applied_by` | → `users.id` (set null, nullable) | Who applied the limits. |
| `applied_at` | default now | When the limits were applied. |

### 35. `mid_case_portal_mids` — each MID Creation case's latest saved MIDs, kept current by a trigger on `case_history` (migration 0095)

| Column | Type / rule | What it means |
|---|---|---|
| `case_id` | → `cases.id` (cascade) PK | The MID Creation case. |
| `portal_mid` | integer | The portal MID. |
| `internal_portal_mid` | integer, nullable | The internal portal MID, if any. |
| `saved_at` | timestamp | When saved. |

Holds MID values only; case status and merchant deletion are read from their own tables.

### 36. `notifications` — in-app notifications

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Notification ID. |
| `user_id` | → `users.id` (cascade) | Who the notification is for. |
| `actor_id` | → `users.id` (set null, nullable) | Who caused it. |
| `type` | `notification_type` | `case_assigned` / `case_unassigned` / `comment_mention` / `comment_reply` / `comment_thread` / `case_resubmitted` / `case_email_undelivered`. |
| `case_id` | → `cases.id` (cascade, nullable) | The case, if any. |
| `comment_id` | → `case_comments.id` (cascade, nullable) | The comment, if any. |
| `title` | varchar(255) | Notification title. |
| `body` | text | Notification body. |
| `metadata` | jsonb, nullable | Extra data. |
| `is_read` | boolean, default false | Whether it has been read. |
| `read_at` | nullable | When it was read. |
| `created_at` | timestamp | When created. |

### 37. `case_files` — files uploaded inside a case (final agreements, proofs, screenshots)

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | File ID. |
| `case_id` | → `cases.id` (cascade) | The case. |
| `file_kind` | varchar(80) | What kind of file this is, e.g. `agreement_email_proof`. |
| `original_name` | varchar(255) | Original file name. |
| `mime_type` | varchar(128) | File type. |
| `size_bytes` | integer (≥ 0) | File size in bytes. |
| `google_drive_file_id` | varchar(255) | Drive file ID. |
| `google_drive_web_view_link` | text | Drive view link. |
| `google_drive_download_link` | text, nullable | Drive download link. |
| `google_drive_folder_id` | varchar(255) | Drive folder ID. |
| `uploaded_by` | → `users.id` (set null, nullable) | Who uploaded it. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Unique: (`case_id`, `file_kind`) — a case can hold only one file of each kind.

### 38. `sub_merchant_form_details` — one row per Sub-Merchant Form case

| Column | Type / rule | What it means |
|---|---|---|
| `case_id` | → `cases.id` (cascade) PK | The case. |
| `sub_merchant_key` | varchar(80) | Sub-merchant key. |
| `sub_merchant_name` | varchar(160) | Sub-merchant name. |
| `draft_url` | text | URL of the draft form. |
| `final_form_file_id` | → `case_files.id` (set null, nullable) | The uploaded completed form. |
| `email_status` | `sub_merchant_form_email_status`, default `not_sent` | `not_sent` / `sent` / `failed`. |
| `email_log_id` | → `email_log.id` (set null, nullable) | The email log row for the sent email. |
| `email_sent_at` | nullable | When the email was sent. |
| `email_recipient` | varchar(255), nullable | Who the email went to. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Check: `not_sent` means no sent time and no email log; `sent` means a sent time is set; `failed` means no sent time.

### 39. `storage_objects` — the Drive ownership ledger (see file 28)

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Object ID. |
| `provider` | varchar(40), default `google_drive` | Storage provider. |
| `provider_object_id` | varchar(255) | The Drive file/folder ID. |
| `object_kind` | `file` / `folder` | Whether it is a file or a folder. |
| `merchant_id` | → `merchants.id` (cascade, nullable) | The merchant it belongs to. |
| `case_id` | → `cases.id` (set null, nullable) | The case it belongs to, if any. |
| `visibility` | `private` / `public` | Private (KYC) or public (merchant-sent). |
| `attempt_id` | uuid, not null | The upload attempt this object came from. |
| `lifecycle` | default `provisioning` | `provisioning` / `current` / `superseded` / `failed` / `deleted`. |
| `parent_provider_object_id` | varchar(255), nullable | The Drive ID of its parent folder. |
| `metadata` | jsonb, nullable — for example `{ role: 'merchant_root' }` | Extra data. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Unique: (`provider`, `provider_object_id`), and one active merchant-root claim per (`merchant_id`, `visibility`).

### 40. `case_merchant_requests` — a case reserved as `awaiting_merchant` while its email is sent (or its manual proof uploaded)

| Column | Type / rule | What it means |
|---|---|---|
| `id` | uuid PK | Request ID. |
| `case_id` | → `cases.id` (cascade) | The case. |
| `kind` | `case_merchant_request_kind` | `document_resubmission` / `agreement` / `document_resubmission_manual` / `agreement_manual`. |
| `actor_id` | → `users.id` (set null, nullable) | Who made the request. |
| `email_log_id` | → `email_log.id` (set null, nullable — null for a manual proof) | The email that was sent. |
| `token_id` | uuid, nullable — the resubmission link the email carries; note: no foreign key was found on this column in the code reviewed | The resubmission token. |
| `release_stage_id` | uuid, nullable — the stage the case returns to if the request is undone | Stage to return to. |
| `details` | jsonb, not null | Details of the request. |
| `created_at` | timestamp | When created. |
| `resolved_at` | nullable | When resolved. |
| `outcome` | varchar(20), nullable | The outcome. |

Written in the reservation's transaction and resolved once; a request left unresolved by a crash is resolved by the recovery job that runs at startup and every 5 minutes (`merchant-request.service.ts`).

### 41. `agreement_case_details` — one row per Agreement case

| Column | Type / rule | What it means |
|---|---|---|
| `case_id` | → `cases.id` (cascade) PK | The case. |
| `business_type` | varchar(120) | The merchant's business type. |
| `draft_key` | varchar(80) | Which draft was used. |
| `draft_label` | varchar(120) | Draft label. |
| `draft_url` | text | Draft URL. |
| `final_agreement_file_id` | → `case_files.id` (set null, nullable) | The uploaded final agreement. |
| `received_agreement_file_id` | → `case_files.id` (set null, nullable) | The uploaded signed/received agreement. |
| `email_status` | `agreement_email_status`, default `not_sent` | `not_sent` / `sent` / `failed`. |
| `email_log_id` | → `email_log.id` (set null, nullable) | The email log row. |
| `email_sent_at` | nullable | When the email was sent. |
| `email_recipient` | varchar(255), nullable | Who the email went to. |
| `last_rejection_remarks` | text, nullable | Remarks from the last rejection. |
| `created_at`, `updated_at` | timestamps | When created / last changed. |

Same email-state check as `sub_merchant_form_details`.

## Relations summary — the important chains

| Chain | Links |
|---|---|
| Users | `users` → created `users` (`created_by_user_id`); `users` → `user_queue_access` → `queues`; `users` → `refresh_tokens`, `user_password_tokens`, `notifications`, `case_comments`, `case_history`. |
| Merchants | `merchants` → `merchant_documents`, `cases`, `storage_objects`, `email_log`, `portal_mid_limit_applications`, `merchant_portal_password_codes`, `merchant_portal_api_credentials`, `public_submission_attempts`. |
| Cases | `cases` → `merchants`, `queues`, `queue_stages` (current stage), `users` (owner), `sub_merchant_draft_templates`; `cases` → `case_field_reviews`, `document_review_details`, `case_comments`, `case_history`, `case_files`, `case_links` (as parent and as child), `case_flow_close_jobs`, `case_resubmission_tokens`, `case_merchant_requests`, `agreement_case_details`, `sub_merchant_form_details`, `mid_case_portal_mids`, `notifications`, `email_log`. |
| Queues and flow | `queues` → `queue_stages`, `queue_case_sequences`, `user_queue_access`; `case_flow_versions` → `flow_configuration_revisions`, `case_flow_start_rules`, `case_flow_close_triggers`, `case_flow_close_blockers`, `case_flow_creation_requirements`, `case_flow_merchant_moves`, `merchants.flow_version_id`, `cases.flow_version_id`, `case_flow_close_jobs.flow_version_id`. |
| Deleting — what cascades, what is restricted | Deleting a merchant cascades to its documents, cases, storage objects, portal codes/credentials and MID applications; deleting a case cascades to its reviews, comments, history, files, detail rows, resubmission tokens and close jobs. Deleting a queue is restricted while cases or flow rules reference it; deleting a user sets most references to null instead of deleting the rows, but a user's refresh tokens, password-link tokens, queue access and notifications are deleted with the user (cascade). The API never hard-deletes a user: `DELETE /api/users/:id` deactivates the account (file 31). Cascade means the linked rows are deleted too; restrict means the delete is refused while links exist; set null means the link is cleared but the row stays. |

## What happens next — how a developer uses this file

A developer changing any feature should check this file first: find the tables the feature touches, check the columns, enums, unique rules and delete behaviour (cascade / restrict / set null), and check the state-guard triggers (migrations 0101–0106) before writing code. A new column or a new enum value needs a forward-only migration under `drizzle/` — never edit an old migration, and never migrate production from an agent.

> ⚠️ **No expiry on resubmission links:** `case_resubmission_tokens` has no expiry column in the database. See the intent question below and file 32 (gap 5).

> ⚠️ **`case_merchant_requests.token_id` has no foreign key** in the schema read (`drizzle/0108_case_merchant_requests.sql` declares it as a plain `uuid`, and no later migration adds a reference). It is not clear whether that is deliberate — see the intent question below and file 32 (gap 11).

> ⚠️ **Comments and history are not paginated** and have no size cap in the schema. A very old case can hold thousands of rows that are all loaded at once. See file 32 (gap 8).

## What to check — is this what you intended?

- [ ] **Defaults:** `merchants.currency` defaults to `PKR` and `business_scope` defaults to `local`. Are those the right defaults, and should the currency ever be anything else?
- [ ] **One submission identity:** a merchant has only one `submission_key_hash` and one active portal password code and one API-credentials row. Is one submission identity per merchant enough, or should a merchant be able to submit a second, separate application?
- [ ] **Resubmission links:** resubmission links (`case_resubmission_tokens`) have no expiry date in the database. Should they expire like password links (24/72 hours), or stay valid until used?
- [ ] **Missing foreign key:** `case_merchant_requests.token_id` has no foreign key in the schema read. Is that intentional, or should it point at `case_resubmission_tokens.id`?
- [ ] **Comments and history:** comments and history have no pagination and no size cap in the schema. Is it acceptable that a very old case can hold thousands of rows that are all loaded at once?
- [ ] **Demo data:** the demo seed (`db:seed-demo`) creates 96 fake merchants. Should demo data ever be allowed near production, or is it development-only by rule?
- [ ] **MID categories:** `portal_mid_limit_applications.category` allows `custom_wordpress`, `shopify` and `internal`. Are those the three categories you use, and should the list be changeable without a code change?

---
*Sources: `backend/src/db/schema.ts` (all 41 tables, checks and indexes), `backend/src/middleware/error-handler.ts` (P7601/P7602/P7603 mapping), `backend/src/modules/cases/portal-password-code.service.ts`, `backend/src/modules/auth/auth.service.ts` (`Bun.password`), `backend/src/lib/security.ts` (`hashToken`, SHA-256), `backend/src/lib/secret-box.ts` (AES-256-GCM), `backend/src/modules/merchants/submission-attempts.service.ts`, `backend/drizzle/0075_case_flow_versions.sql`, `0101_case_state_guard.sql`, `0103_merchant_state_guard.sql`, `0104_queue_lifecycle_guard.sql`, `0083`, `0113`, `0116` and `0029`/`0030` migrations, `backend/package.json`, `backend/src/db/client.ts`, `backend/src/db/seed-demo.ts`, `backend/sql/seed-queues.sql`, `backend/drizzle/seed-queue-stages.sql`, `frontend/src/schemas/merchant-onboarding.schema.ts`, `backend/src/modules/merchants/merchants.schemas.ts`. Earlier list: `backend/src/db/schema.ts`, `backend/drizzle.config.ts`, `backend/src/db/client.ts`, `backend/src/db/migrate.ts`, `backend/src/db/audit.ts`, `backend/src/db/seed-demo.ts`, `backend/sql/seed-queues.sql`, `backend/sql/seed-queue-stages.sql`, `backend/drizzle/` (migrations `0000`–`0116`, journal `meta/_journal.json`; checked `0007`, `0011`, `0073`, `0096`, `0101`–`0106`, `0108`, `0110`, `0111`, `0113`), `backend/src/db/query-tags.ts`, `backend/src/config/env.ts`, `backend/AGENTS.md`, `backend/src/modules/auth/login-guard.ts`. Related files: 04 (public form), 21 (case-flow engine), 27 (queues and SLA), 28 (Google Drive), 29 (security), 31 (APIs).*
