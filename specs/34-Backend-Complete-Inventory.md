# 34 — Backend Complete Inventory

## At a glance

| | |
|---|---|
| **What it is** | The complete map of the backend (BE) repo: the server entry point, middleware, database layer, shared libraries, storage layer, every module, the SQL seed files, the migration history, the scripts, and the API docs. Files 02–31 describe behaviour; this file makes sure no BE file is left without an owner. |
| **Who can use it** | The owner (Sufyan), to see what the server is made of. Developers, to find which spec to read before changing a module, and where a new file belongs. |
| **Where it lives** | `Desktop\Onboarding Portal\onboarding-portal-assanpay-BE\` (`src/`, `apis/`, `sql/`, `drizzle/`, root config). |
| **Main code** | `src/index.ts` (entry and mounts), `src/modules/*` (features), `src/db/` (schema and client), `src/lib/` (shared helpers and storage), `src/middleware/` (auth, roles, errors). |
| **Success looks like** | Every BE source file appears in the tables below with a spec that owns it. Adding a module or a migration means adding a row here. |

## How to read this file

1. **Stack and entry point** — what the server is built with and how it starts.
2. **Modules** — each `src/modules/<area>` folder, what it does, and the spec that explains it.
3. **Database layer** — the schema, the client, migrations, seeds, and audit.
4. **Shared libraries** — middleware, lib helpers, storage, and contracts.
5. **Scripts and config** — what `package.json` runs and how the environment is read.
6. **Full file inventory** — every source file, its main exports, and the spec that cites or owns it. `(owner)` means no spec names the file; the spec shown owns its behaviour.

## Stack and entry point

| Piece | File | What it does |
|---|---|---|
| Entry and app | `src/index.ts` | Creates the Hono app, applies middleware (secure headers, request IDs, CORS with credentials, error handler), mounts the routers, and starts the background jobs. |
| Mounts | `src/index.ts` | `/api/auth`, `/api/public`, `/api/public/resubmission`, `/api/merchants`, `/api/users`, `/api/queues`, `/api/cases`, `/api/configuration`, `/api/dashboard`, `/api/notifications`, `/api/webhooks/resend`. Root `GET /` and `GET /health/db`. |
| Public limits | `src/index.ts` | Public routes (`/api/public/*`) share a rate limiter (60 requests per 15 minutes per IP). Public form and resubmission bodies are capped at 225 MB. |
| Runtime | `package.json` | Bun, Hono, TypeScript (strict), Drizzle ORM, PostgreSQL, Zod, React Email, Resend, Google Drive. |
| Background work | `src/index.ts` and `src/modules/cases/case-flow-worker.ts` | Case-flow close worker, merchant-request recovery (startup, then every 5 minutes), refresh-token and submission-attempt cleanup (startup, then every 6 hours). |

Details of the mounts and background jobs are in file 31 (APIs) and file 21 (case-flow engine).

## Modules

One row per `src/modules/<area>` folder. Route files and service files are listed in the full inventory.

| Module | What it does | Spec |
|---|---|---|
| `auth/` | Sign-in, refresh, sign-out, password-token links, login guard (database counters and trusted-device cookie), refresh-token state, password-token state. | 02 |
| `users/` | Staff list, directory, create, update, deactivate, bulk status, password reset. | 03 |
| `merchants/` | Public merchant form (`/api/public/merchant-form`), public resubmission (`/api/public/resubmission/:token`), merchant list and detail reads, limits and MDR, terminate, delete, priority, submission attempts, merchant Drive folders, merchant state machine. | 04, 05, 06, 07, 08, 09 |
| `cases/` | Case lists and detail, assignment, ownership, stage and status transitions, close checklist, documents review, sub-merchant form, agreement, MID creation, testing, WordPress, live activation, EP sub-merchants, comments, history, emails, resubmission tokens, case-flow engine and worker, SLA, portal credentials and password codes, case numbering and cursor pagination, upload validation. | 11–22 |
| `configuration/` | Case-flow graph, merchant move, email recipients, email sending mode, limits and MDR, payment and payout methods, agreements, sub-merchant drafts, merchant portal, email templates. | 21, 23, 25, 26 |
| `queues/` | Queues list, queue update, status, SLA, workflow, stage defaults. | 27 |
| `dashboard/` | Dashboard figures, workload, portal MIDs, awaiting physical agreements. | 10 |
| `email/` | Email client (Resend), templates (React Email), template catalog, delivery status, Resend webhook. | 23 |
| `notifications/` | Notification list, unread count, read-all, the SSE stream, event and copy definitions. | 24 |

## Database layer (`src/db/`)

| File | What it does | Spec |
|---|---|---|
| `schema.ts` | Drizzle schema: 41 tables and 32 enums. The single source of truth for the data model. | 30 |
| `client.ts` | Database client. Built for pooled endpoints (transaction pooling): no session-bound prepared statements, and the `pg_type` catalog scan is skipped. | 30 |
| `query-tags.ts` | SQLCommenter-style tags so PlanetScale Insights can attribute queries to a route or background job. Tags are low-cardinality: route templates and job names only, never ids, emails or tokens. | 29, 30 |
| `audit.ts` | `db:audit` script. A read-only audit of the database using `DIRECT_DATABASE_URL`; reports categories of issues. | 30 |
| `migrate.ts` | `db:migrate` script. Runs migrations over a direct connection so they bypass PgBouncer and do not use the application pool. | 30 |
| `seed-demo.ts` | `db:seed-demo` script. Builds demo merchants, cases, links, history and comments under the demo email domain. A re-run wipes the previous demo set first. Intended for development and test data only. | 30 |

### Migrations (`drizzle/`)

- **Count:** 120 numbered `.sql` files (prefixes `0000` to `0116`; some prefixes are used two or three times, for example `0004`–`0007`), plus two seed files and `meta/` snapshots. `meta/_journal.json` lists 116 migrations. Four numbered files are not in the journal (`0005_cases_priority`, `0007_notifications`, `0008_resubmission_and_email`, `0027_physical_agreement_queue`); see file 32, gap 17.
- **Rule:** forward-only. Add a new migration and a journal entry; do not edit a shipped one.
- **Notable milestones** (for orientation; the full list is in the inventory): `0040_rename_user_roles` (role names), `0041_hash_public_tokens` (tokens hashed at rest), `0083_drop_resubmission_token_expiry` (resubmission links have no expiry column), `0106_resubmission_token_consumed_reason`, `0110_auth_token_state`, `0112_login_attempt_counters`, `0114_username_lowercase`, `0115_single_super_admin`, `0116_drop_resubmission_plaintext_token`.
- **Migration `0050_ensure_live_queue.sql`** holds the full definition of the Live queue (see file 27).

### SQL seeds (`sql/`)

| File | What it does | Spec |
|---|---|---|
| `sql/seed-queues.sql` | Inserts the 8 default queues. Idempotent (`ON CONFLICT DO NOTHING`). | 27, 30 |
| `sql/seed-queue-stages.sql` | **Empty (0 lines).** The stage seed is `drizzle/seed-queue-stages.sql` (Documents Review stages only). See file 32, gap 18. | 27, 30 |

## Shared libraries (`src/lib/`, `src/middleware/`, `src/types/`, `src/config/`, `src/contracts/`)

| File | What it does | Spec |
|---|---|---|
| `middleware/auth.ts` | `requireAuth`: reads the bearer token, resolves the current session, rejects invalid, expired, inactive or revoked sessions. `getBearerToken`. | 02, 29 |
| `middleware/rbac.ts` | `requireRoles(...)`: allows only the listed role types. | 03, 29 |
| `middleware/error-handler.ts` | One error shape: `{ "error": "<message>" }`. Maps known database constraint violations to 409, Hono and validator errors to their status, and everything else to 500 without leaking detail. | 29, 31 |
| `lib/auth.ts` | Access and refresh token signing and verification. | 02 |
| `lib/security.ts` | `hashToken` for storing tokens as hashes. | 02, 29 |
| `lib/secret-box.ts` | AES-256-GCM encryption for short secrets that must be read back later (`v1.<iv>.<ciphertext>`, bound to the row). | 29 |
| `lib/client-ip.ts` | Client IP for rate limits, from `cf-connecting-ip` and `x-forwarded-for` when proxy headers are trusted (`TRUST_PROXY_HEADERS`, default `true`). | 29 |
| `lib/errors.ts` | `AppError(status, message)`: the error type services throw for expected failures. | 29 |
| `lib/validators.ts` | `zodValidator(target, schema)` for routes, and `webUrlSchema` (http and https only). Plain `z.url()` also accepts `javascript:` and `data:`, so use `webUrlSchema` for values shown as links. | 29 |
| `lib/concurrency.ts` | `mapWithConcurrency(items, limit, fn)`: runs at most `limit` calls at once, keeps input order, and after the first failure starts no new calls and waits for running ones so cleanup sees every side effect. `DRIVE_UPLOAD_CONCURRENCY = 10` uploads per request. | 28 |
| `types/auth.ts` | Role type list (`super_admin`, `admin`, `agent`). | 03 |
| `config/env.ts` | The environment contract: Zod-validated variables with defaults (for example `APP_PORT` 3000, `ACCESS_TOKEN_TTL_MINUTES` 15, `REFRESH_TOKEN_TTL_DAYS` 7, `PUBLIC_SUBMISSION_LIMIT_PER_IP` 3, `CASE_FLOW_WORKER_*`). Values are never printed. | 29, 31 |
| `contracts/queues.ts` | Queue workflow types and lifecycles, shared with the frontend (`src/schemas/queue-workflow.schema.ts` must mirror it). `contracts/README.md` explains that contracts hold no runtime imports. | 21, 27 |

### Storage (`src/lib/storage/`)

| File | What it does | Spec |
|---|---|---|
| `file-limits.ts` | Maximum upload size: 10 MB per file (matches the frontend). | 05, 28 |
| `file-names.ts` | Cleans upload names: removes control characters and bidirectional overrides; caps length at 255 (the `original_name` column). | 05, 28 |
| `file-signatures.ts` | Checks the first bytes (magic bytes) of an upload against the claimed type; rejects empty or truncated files. This is the only content check on uploads (no virus scan). | 05, 28 |
| `google-drive.ts` | Google Drive provider: creates merchant roots and case folders, uploads, deletes, and returns Drive IDs and links. Always creates a new merchant root under the configured parent. | 28 |
| `ownership.ts` | Storage-object lifecycle (`provisioning`, `current`, `superseded`, `failed`, `deleted`) and the ledger in `storage_objects`. An object becomes `current` in the same transaction that commits its database rows. | 28 |
| `tracked-upload.ts` | Uploads whose database rows are written afterwards, tracked in `storage_objects` so a failed save never leaves an untracked Drive file. | 28 |

## Shared helpers inside modules

| File | What it does | Spec |
|---|---|---|
| `modules/cases/case-cursor.ts` | Keyset (cursor) pagination for case lists. A cursor is base64 of URI-encoded JSON holding `sortBy`, `sortOrder`, `kind` (date, number or string), `value` and `id`. A cursor that does not match the active sort, or has an invalid value, returns `400 Invalid pagination cursor.`. Date values round-trip as UTC ISO strings with microseconds. | 11 |
| `modules/cases/case-number.ts` | Generates case numbers: the queue's prefix, a dash, then a 9-digit sequence (for example `DR-000000001`). The sequence increments atomically per queue in `queue_case_sequences`. A missing queue returns 404. | 12 |
| `modules/queues/queue-stage-defaults.ts` | Seeds a queue's default stages from its workflow type when it has none. Legacy `in-review` counts as `working` for document review. `resolveUniqueStageForStatus` returns exactly one stage for a status and errors when none or several match, instead of guessing. | 27 |

## Deployment, CI and repo-level files

| File | What it is | Spec |
|---|---|---|
| `.github/workflows/deploy.yml` | Deploys the backend to EC2 on every push to `main` (one deploy at a time, no cancel). Steps: fetch and hard-reset to `origin/main`, frozen install, `typecheck`, `db:migrate`, PM2 restart of `onboarding-backend`. On failure it restores the previous commit, reinstalls and restarts. The schema is **not** rolled back on failure (see file 32, open finding L12). | 31, 32 |
| `.env.example` | Environment template (66 lines). Names and defaults only; never copy real values into docs or commits. | 29, 31 |
| `.gitignore` | Ignores `node_modules`, environment files and build output. | 34 |

## Full file inventory

Every source file in the BE repo (`src/`, `apis/`, `sql/`, root config; `node_modules` excluded). The migration files in `drizzle/` are listed in the migration table at the end of this file. Exports are the first five top-level exports of each file. "Cited in spec" lists the spec that names the file; `(owner)` means no spec names it and the spec shown owns its behaviour.

### `root` (20 files)

| File | Exports | Cited in spec |
|---|---|---|
| `.oxfmtrc.json` | — | 34 (owner) |
| `.oxlintrc.json` | — | 34 (owner) |
| `.vscode/extensions.json` | — | 34 (owner) |
| `.vscode/settings.json` | — | 34 (owner) |
| `AGENTS.md` | — | 00, 01, 30 |
| `CLAUDE.md` | — | 00, 01 |
| `README.md` | — | 00, 01 |
| `apis/auth.md` | — | 01, 02, 29, 31, 32 |
| `apis/cases.md` | — | 11, 12, 20, 23, 31, 32 |
| `apis/configuration.md` | — | 21, 31, 32 |
| `apis/health.md` | — | 31, 32 |
| `apis/merchants.md` | — | 31, 32 |
| `apis/notifications.md` | — | 22, 24, 31 |
| `apis/queues.md` | — | 27, 31 |
| `apis/users.md` | — | 31 |
| `drizzle.config.ts` | — | 30 |
| `package.json` | — | 00, 01, 32 |
| `sql/seed-queue-stages.sql` | — | 12, 30 |
| `sql/seed-queues.sql` | — | 11, 19, 20, 27, 30 |
| `tsconfig.json` | — | 34 (owner) |

### `src/config` (1 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/config/env.ts` | env | 00, 01, 02, 04, 21, 23, 28, 29, 31 |

### `src/contracts` (2 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/contracts/README.md` | — | 00, 01 |
| `src/contracts/queues.ts` | QUEUE_WORKFLOW_TYPES, QueueWorkflowType, QUEUE_LIFECYCLES, QueueLifecycle | 27 |

### `src/db` (6 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/db/audit.ts` | — | 30 |
| `src/db/client.ts` | getQueryClient, getDb, DbTransaction, closeQueryClient | 01, 02, 23, 29, 30, 31, 32 |
| `src/db/migrate.ts` | — | 30 |
| `src/db/query-tags.ts` | QueryTags, withQueryTags, withSqlCommenter | 30 |
| `src/db/schema.ts` | roleTypeEnum, userStatusEnum, userGenderEnum, queueViewScopeEnum, userQueueAccessTypeEnum | 00, 01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 32 |
| `src/db/seed-demo.ts` | — | 30 |

### `src/index.ts` (1 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/index.ts` | — | 00, 01, 02, 03, 04, 05, 06, 07, 10, 11, 28, 29, 31, 32 |

### `src/lib` (13 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/lib/auth.ts` | signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken | 01, 02, 29, 31 |
| `src/lib/client-ip.ts` | getClientIp | 29 |
| `src/lib/concurrency.ts` | mapWithConcurrency, DRIVE_UPLOAD_CONCURRENCY | 34 (owner) |
| `src/lib/errors.ts` | AppError | 29 |
| `src/lib/secret-box.ts` | SecretKeyName, encryptSecret, decryptSecret | 29 |
| `src/lib/security.ts` | hashToken | 29 |
| `src/lib/storage/file-limits.ts` | MAX_FILE_SIZE_BYTES, assertFileSizeLimit | 05, 13, 14, 28 |
| `src/lib/storage/file-names.ts` | MAX_UPLOAD_FILE_NAME_LENGTH, cleanUploadFileName | 28 |
| `src/lib/storage/file-signatures.ts` | FILE_SIGNATURE_PROBE_BYTES, SupportedUploadFamily, assertFileContentSignature | 05, 28 |
| `src/lib/storage/google-drive.ts` | GoogleDriveVisibility, StorageUploadInput, StorageUploadResult, FileStorageProvider, GoogleDriveStorageProvider | 05, 28, 31 |
| `src/lib/storage/ownership.ts` | STORAGE_PROVIDER, StorageObjectKind, StorageObjectLifecycle, RecordStorageObjectInput, createStorageAttemptId | 28 |
| `src/lib/storage/tracked-upload.ts` | createTrackedUpload | 28 |
| `src/lib/validators.ts` | zodValidator, webUrlSchema | 29 |

### `src/middleware` (3 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/middleware/auth.ts` | resolveCurrentSession, getBearerToken, requireAuth | 01, 02, 29, 31 |
| `src/middleware/error-handler.ts` | errorHandler | 29 |
| `src/middleware/rbac.ts` | requireRoles | 03, 29 |

### `src/modules/auth` (6 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/auth/auth.routes.ts` | authRoutes | 02, 29, 31, 32 |
| `src/modules/auth/auth.schemas.ts` | loginSchema, createUserSchema, passwordTokenParamSchema, setPasswordSchema | 02, 03, 29 |
| `src/modules/auth/auth.service.ts` | login, refreshSession, logout, canCreateRole, issuePasswordToken | 02, 29 |
| `src/modules/auth/login-guard.ts` | DEVICE_COOKIE_NAME, getDeviceCookieMaxAgeSeconds, issueDeviceCookie, getTrustedDeviceId, getAttemptBudgets | 01, 02, 29, 32 |
| `src/modules/auth/password-token-state.ts` | PasswordTokenConsumedReason, consumePasswordTokens, ClosedPasswordLinkReason, getClosedPasswordLinkReason, closedPasswordLinkError | 02, 29 |
| `src/modules/auth/refresh-token-state.ts` | rotateRefreshToken, revokeRefreshTokens | 02 |

### `src/modules/cases` (42 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/cases/agreement-case.service.ts` | AgreementEmailResult, loadAgreementCase, ensureAgreementDetails, uploadAgreementFinalAgreement, sendAgreementToClient | 15 |
| `src/modules/cases/agreement-email-status.ts` | AgreementEmailStatus, agreementEmailStatusSql, getAgreementEmailStatus | 12 |
| `src/modules/cases/agreement.config.ts` | AGREEMENT_FINAL_FILE_KIND, AGREEMENT_RECEIVED_FILE_KIND, AGREEMENT_DRAFTS, AgreementDraftKey, getAgreementDraftForMerchantType | 26 |
| `src/modules/cases/case-access.service.ts` | getAgentQueueAccess, assertCanViewCase, assertCanWorkCase, assertCanWorkQueue, assertOwnerCanWorkCases | 11, 12, 19, 22, 29 |
| `src/modules/cases/case-assignment.service.ts` | bulkAssignCases, assignCase, updateCasePriority, takeOwnership | 12, 27 |
| `src/modules/cases/case-close-checklist.ts` | CloseChecklistFacts, CloseChecklistWorkflowType, hasCloseChecklist, closeOnlyFromWorkingMessage, getCloseChecklistBlockers | 12, 18, 19 |
| `src/modules/cases/case-comments.service.ts` | listCaseComments, createCaseComment, listCaseHistory | 12, 22 |
| `src/modules/cases/case-communication-helpers.ts` | getRejectionLabel, ServerIntegrationDetails, resolveCustomWebsiteServerIntegration, getMerchantIntegrationGuideLabel, assertAutoEmailEnabled | 23 |
| `src/modules/cases/case-communications.service.ts` | ManualEmailRecipients, ResubmissionEmailPreviewResult, getResubmissionEmailPreview, ManualEmailResult, confirmResubmissionEmailManual | 19 |
| `src/modules/cases/case-constants.ts` | SUB_MERCHANT_FINAL_FORM_MIME_TYPES, SUB_MERCHANT_FINAL_FORM_EXTENSIONS, AGREEMENT_FILE_MIME_TYPES, AGREEMENT_FILE_EXTENSIONS, WORDPRESS_SCREENSHOT_FILE_KIND_PREFIX | 14, 19, 20, 23, 28 |
| `src/modules/cases/case-cursor.ts` | parseCsvValues, KeysetCursorKind, DecodedKeysetCursor, keysetCursorExpression, encodeKeysetCursor | 11 (owner) |
| `src/modules/cases/case-detail-lookups.ts` | getTestingLimitsAppliedEntry, getMidCreationCredentialsSentEntry, getLiveLimitsAppliedEntry, getWordpressWebsiteDetails, getLatestWordpressWebsiteDetailsForMerchant | 14, 16, 17, 18 |
| `src/modules/cases/case-documents-review.service.ts` | saveFieldReviews, saveDocumentReviewSubMerchant, sendForResubmission, regenerateResubmissionLink, ResubmissionContext | 06, 13 |
| `src/modules/cases/case-drive-folders.ts` | ensurePrivateInternalCaseFolder, ensurePublicFinalAgreementFolder | 28 |
| `src/modules/cases/case-email-delivery.ts` | CaseEmailDelivery, EMAIL_DELIVERY_CONFIRMED_ACTION, getCaseEmailDelivery, assertCaseEmailDelivered, confirmCaseEmailDelivered | 12, 23 |
| `src/modules/cases/case-email-send-state.ts` | notSentEmailFields, sentEmailFields, failedEmailFields | 12 |
| `src/modules/cases/case-flow-job-state.ts` | formatCaseFlowJobError, completeCloseJobs, recordCloseJobFailure, releaseBlockedCloseJobs, retryCloseJob | 12 |
| `src/modules/cases/case-flow-retry.ts` | CaseFlowFailureKind, classifyCaseFlowFailure, calculateCaseFlowRetryDelay | 12 |
| `src/modules/cases/case-flow-worker.ts` | setCaseFlowCloseJobDrainHandler, requestCaseFlowCloseJobDrain | 12, 21 |
| `src/modules/cases/case-flow.service.ts` | getMerchantFlowVersionId, previewMissingCloseTriggerCases, createMissingCloseTriggerCases, triggerStartCasesForMerchant, assertCloseBlockersSatisfied | 12, 21 |
| `src/modules/cases/case-history-format.ts` | sanitizeCaseHistoryDetails, enrichResubmissionWhatsappHistoryDetails, getStringDetail | 22 |
| `src/modules/cases/case-number.ts` | generateCaseNumber | 12 (owner) |
| `src/modules/cases/case-query.service.ts` | createCase, createCaseInTransaction, bulkCreateCases, listCases, listCaseOwners | 11, 12 |
| `src/modules/cases/case-resubmission-tokens.service.ts` | IssuedToken, ValidatedToken, ResubmissionTokenConsumedReason, consumeResubmissionTokens, ResubmissionTokenKind | 06, 13, 32 |
| `src/modules/cases/case-sla.ts` | isCaseSlaBreached | 10, 12, 27 |
| `src/modules/cases/case-stage.service.ts` | updateCaseStatus, advanceStage, closeUnsuccessful | 12, 17, 27 |
| `src/modules/cases/case-state-machine.ts` | CaseEvent, CASE_TRANSITIONS, isManualStatusChangeAllowed, getStatusForStage, initialCaseState | 12 |
| `src/modules/cases/case-transition.service.ts` | LockedCaseRow, TransitionCaseStateInput, transitionCaseState, loadQueueStageForCase | 12, 27 |
| `src/modules/cases/case-upload-validation.ts` | getFileExtension, validateSubMerchantFinalFormFile, validateWordpressScreenshotFile, validateEmailProofFile, validateAgreementFile | 28 |
| `src/modules/cases/cases.routes.ts` | caseRoutes | 11, 12, 14, 15, 19, 20, 22, 31, 32 |
| `src/modules/cases/cases.schemas.ts` | caseStatusValues, CaseStatusValue, caseListStatusFilterValues, CaseListStatusFilterValue, createCaseSchema | 11, 12, 16, 19, 22 |
| `src/modules/cases/document-review-state.ts` | FieldReviewDecision, ReviewedDocumentMove, recordFieldReviews, recordMerchantResubmission | 06, 13 |
| `src/modules/cases/ep-sub-merchant.service.ts` | getEpQueueIds, assertCanManageEpCases, epCaseStatusFilterValues, EpCaseStatusFilterValue, buildEpCaseStatusFilter | 14, 20 |
| `src/modules/cases/field-labels.ts` | MERCHANT_FIELD_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_FIELD_PREFIX, isDocumentFieldName, getDocumentIdFromFieldName | 05, 13 |
| `src/modules/cases/live-case.service.ts` | markLiveLimitsApplied, loadLiveCase, sendLiveActivationEmail | 19 |
| `src/modules/cases/merchant-request.service.ts` | MerchantRequestKind, MerchantRequestOutcome, MERCHANT_REQUEST_STALE_AFTER_MS, INTERRUPTED_REQUEST_MESSAGE, openMerchantRequest | 30 |
| `src/modules/cases/mid-case.service.ts` | saveMidCreationDetails, MidCreationEmailResult, loadMidCreationCase, sendMidCreationCredentialsEmail | 16, 17 |
| `src/modules/cases/portal-api-credentials.service.ts` | PortalApiCredentialsStatus, getPortalApiCredentialsStatus, hasPortalApiCredentials, savePortalApiCredentials, revealPortalApiCredentials | 16 |
| `src/modules/cases/portal-password-code.service.ts` | PortalPasswordCodeStatus, getPortalPasswordCodeStatus, generatePortalPasswordCode, revealPortalPasswordCode, getActivePortalPasswordCode | 16 |
| `src/modules/cases/sub-merchant-form-case.service.ts` | loadSubMerchantFormCase, selectSubMerchantForm, uploadSubMerchantFinalForm, uploadSubMerchantEmailProof | 14, 20 |
| `src/modules/cases/testing-case.service.ts` | markTestingLimitsApplied | 17 |
| `src/modules/cases/wordpress-case.service.ts` | loadWordpressWebsiteCase, saveWordpressWebsiteCase | 18 |

### `src/modules/configuration` (5 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/configuration/case-flow-graph.ts` | CaseFlowDependencyEdge, buildCaseFlowDependencyEdges, findDependencyCycle | 21 |
| `src/modules/configuration/case-flow-move.service.ts` | previewMoveToActiveVersion, previewMoveToDraftRules, moveMerchantsToActiveVersionTx, rethrowMoveLockFailure, moveMerchantsToActiveVersion | 21 |
| `src/modules/configuration/configuration.routes.ts` | configurationRoutes | 21, 25, 26, 31, 32 |
| `src/modules/configuration/configuration.schemas.ts` | emailSendingModeSettingsSchema, emailRecipientSettingsSchema, emailRecipientSettingsInputSchema, merchantPortalSettingsSchema, paymentMethodSettingsSchema | 08, 21, 25, 26 |
| `src/modules/configuration/configuration.service.ts` | defaultLimitsAndMdrSettings, LINK_DEADLINE_HOURS, defaultEmailSendingModeSettings, defaultEmailRecipientSettings, defaultMerchantPortalSettings | 02, 03, 08, 19, 21, 23, 25, 26, 28, 29, 32 |

### `src/modules/dashboard` (4 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/dashboard/dashboard-workload.service.ts` | getCaseWorkload | 10 |
| `src/modules/dashboard/dashboard.routes.ts` | dashboardRoutes | 10, 31 |
| `src/modules/dashboard/dashboard.schemas.ts` | dashboardRangeKeys, DashboardRangeKey, MAX_DASHBOARD_RANGE_DAYS, dashboardQuerySchema, DashboardQuery | 10 |
| `src/modules/dashboard/dashboard.service.ts` | listAppliedPortalMids, listPendingPortalMidLimitsPage, listPendingPortalMidValues, listAwaitingPhysicalAgreementsPage, applyPortalMidLimits | 10, 27 |

### `src/modules/email` (13 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/email/email-delivery-status.ts` | EmailDeliveryStatus, UNDELIVERED_EMAIL_STATUSES, IN_FLIGHT_EMAIL_STATUSES, applyEmailDeliveryStatus | 23 |
| `src/modules/email/email-template-catalog.ts` | getEmailTemplatePreview | 23, 31 |
| `src/modules/email/email-templates.ts` | getEmailTemplateLabel | 23 |
| `src/modules/email/email.client.ts` | getResendClient | 23, 31, 32 |
| `src/modules/email/email.service.ts` | EMAIL_LOG_ID_TAG, SendEmailInput, SendEmailResult, sendEmail, PreparedEmail | 23 |
| `src/modules/email/resend-webhook.routes.ts` | resendWebhookRoutes | 23 |
| `src/modules/email/resend-webhook.service.ts` | handleResendWebhookEvent | 23 |
| `src/modules/email/templates/_brand.tsx` | brand, fontStack, EmailShellProps, EmailShell, Paragraph | 23, 31 |
| `src/modules/email/templates/agreement.tsx` | AgreementEmailProps, AgreementEmail, agreementEmailSubject | 15, 23, 31 |
| `src/modules/email/templates/document-resubmission.tsx` | DocumentResubmissionEmailRejection, DocumentResubmissionEmailProps, DocumentResubmissionEmail, DOCUMENT_RESUBMISSION_EMAIL_SUBJECT | 13, 23, 31 |
| `src/modules/email/templates/live-activation.tsx` | LiveActivationEmailProps, LiveActivationEmail, liveActivationEmailSubject | 19, 23, 31 |
| `src/modules/email/templates/mid-creation.tsx` | MidCreationEmailProps, MidCreationEmail, midCreationEmailSubject | 17, 23, 31 |
| `src/modules/email/templates/user-password.tsx` | UserPasswordEmailProps, UserPasswordEmail, userPasswordEmailSubject | 23, 31 |

### `src/modules/merchants` (8 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/merchants/form.routes.ts` | merchantFormRoutes | 04, 31, 32 |
| `src/modules/merchants/merchant-drive-folders.ts` | PRIVATE_KYC_PENDING_PATH, PRIVATE_KYC_APPROVED_PATH, PRIVATE_KYC_REJECTED_PATH, PRIVATE_INTERNAL_CASE_FILES_PATH, PUBLIC_AGREEMENT_PATH | 04, 13, 28 |
| `src/modules/merchants/merchant-state-machine.ts` | MerchantStatusValue, MerchantEvent, MERCHANT_TRANSITIONS, initialMerchantState, LIVE_WITHOUT_TESTING_MESSAGE | 01, 09 |
| `src/modules/merchants/merchants.routes.ts` | merchantRoutes | 07, 08, 09, 31, 32 |
| `src/modules/merchants/merchants.schemas.ts` | merchantTypes, websiteCmsValues, kinRelations, baseDocumentTypes, merchantSpecificDocumentMap | 04, 05, 07, 08, 13, 28, 29, 30, 32 |
| `src/modules/merchants/merchants.service.ts` | DUPLICATE_SUBMISSION_MESSAGE, isExistingSubmissionKey, createMerchantSubmission, listMerchants, updateMerchantPriority | 04, 05, 07, 08, 09, 28, 32 |
| `src/modules/merchants/public-resubmission.routes.ts` | resubmissionRoutes | 06, 32 |
| `src/modules/merchants/submission-attempts.service.ts` | SUBMISSION_LIMIT_MESSAGE, SubmissionClient, assertSubmissionQuota, claimSubmissionQuota, recordCreatedSubmission | 04, 29 |

### `src/modules/notifications` (5 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/notifications/notifications.copy.ts` | buildCommentSnippet, NotificationCopy, buildNotificationCopy | 22, 24 |
| `src/modules/notifications/notifications.events.ts` | NotificationStreamEvent, CaseEmailStatusEvent, StreamMessage, subscribe, countSubscribers | 24 |
| `src/modules/notifications/notifications.routes.ts` | notificationRoutes | 24, 29, 31, 32 |
| `src/modules/notifications/notifications.schemas.ts` | notificationTypeValues, NotificationType, listNotificationsQuerySchema, ListNotificationsQuery | 24 |
| `src/modules/notifications/notifications.service.ts` | listForUser, getUnreadCount, markRead, markAllRead, createBulkNotifications | 24 |

### `src/modules/queues` (5 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/queues/queue-stage-defaults.ts` | resolveUniqueStageForStatus, ensureQueueStages, getStageCategoryFromStatus, resolveStageForCase, getVisibleStagesForQueue | 27 (owner) |
| `src/modules/queues/queue-workflow.ts` | lifecycleToIsActive, QUEUE_LIFECYCLE_TRANSITIONS, queueLifecycleFields, isActiveToLifecycle, StageDefinitionInput | 12, 18 |
| `src/modules/queues/queues.routes.ts` | queueRoutes | 11, 27, 31 |
| `src/modules/queues/queues.schemas.ts` | updateQueueSchema, UpdateQueueInput, updateQueueStatusSchema, UpdateQueueStatusInput, updateQueueSlaSchema | 27 |
| `src/modules/queues/queues.service.ts` | evaluateQueueActivationReadiness, listQueues, getQueueDetail, updateQueue, updateQueueStatus | 27 |

### `src/modules/users` (3 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/modules/users/users.routes.ts` | userRoutes | 03, 31 |
| `src/modules/users/users.schemas.ts` | userIdParamSchema, listUsersQuerySchema, updateUserSchema, bulkUserStatusSchema, bulkResetPasswordSchema | 03 |
| `src/modules/users/users.service.ts` | listUsers, listActiveUserDirectory, getUserById, createUser, updateUser | 03, 32 |

### `src/types` (1 files)

| File | Exports | Cited in spec |
|---|---|---|
| `src/types/auth.ts` | roleTypes, RoleType, SessionUser, AppVariables, AppEnv | 01, 02, 29, 31 |



### Migration files (`drizzle/`)

Every SQL file and meta file in `drizzle/`. "In journal" means the tag appears in `meta/_journal.json`; files marked **no** are not applied by `bun run db:migrate` (see file 32, gap 17).

| File | In journal |
|---|---|
| `drizzle/0000_vengeful_natasha_romanoff.sql` | yes |
| `drizzle/0001_wide_hex.sql` | yes |
| `drizzle/0002_familiar_the_stranger.sql` | yes |
| `drizzle/0003_flippant_maginty.sql` | yes |
| `drizzle/0004_happy_blacklash.sql` | yes |
| `drizzle/0004_shallow_ser_duncan.sql` | yes |
| `drizzle/0005_cases_priority.sql` | **no** |
| `drizzle/0005_heavy_stephen_strange.sql` | yes |
| `drizzle/0005_overjoyed_quasimodo.sql` | yes |
| `drizzle/0006_case_error_stage.sql` | yes |
| `drizzle/0006_glossy_khan.sql` | yes |
| `drizzle/0007_backend_query_indexes.sql` | yes |
| `drizzle/0007_notifications.sql` | **no** |
| `drizzle/0008_resubmission_and_email.sql` | **no** |
| `drizzle/0011_amused_lizard.sql` | yes |
| `drizzle/0012_backfill_documents_review_cases.sql` | yes |
| `drizzle/0013_ep_sub_merchant_form.sql` | yes |
| `drizzle/0014_woozy_thena.sql` | yes |
| `drizzle/0015_public_limited_company.sql` | yes |
| `drizzle/0016_agreement_case.sql` | yes |
| `drizzle/0017_mid_creation_queue.sql` | yes |
| `drizzle/0018_mid_go_live_tokens.sql` | yes |
| `drizzle/0019_testing_queue.sql` | yes |
| `drizzle/0020_wordpress_website_queue.sql` | yes |
| `drizzle/0021_dialogpay_card_queue.sql` | yes |
| `drizzle/0022_user_queue_access.sql` | yes |
| `drizzle/0023_configuration.sql` | yes |
| `drizzle/0024_document_review_submerchant.sql` | yes |
| `drizzle/0025_sub_merchant_seller_code.sql` | yes |
| `drizzle/0026_case_flow_rules.sql` | yes |
| `drizzle/0027_physical_agreement_queue.sql` | **no** |
| `drizzle/0028_merchant_terminated_status.sql` | yes |
| `drizzle/0029_queue_sla_hours.sql` | yes |
| `drizzle/0030_case_sla_breached.sql` | yes |
| `drizzle/0031_simplify_merchant_status.sql` | yes |
| `drizzle/0032_merchant_limits_mdr_override.sql` | yes |
| `drizzle/0033_ensure_physical_agreement_queue.sql` | yes |
| `drizzle/0034_case_flow_creation_requirements.sql` | yes |
| `drizzle/0035_active_whatsapp_number.sql` | yes |
| `drizzle/0036_remove_mid_creation_stored_secrets.sql` | yes |
| `drizzle/0037_merchant_drive_roots.sql` | yes |
| `drizzle/0038_portal_mid_limit_applications.sql` | yes |
| `drizzle/0039_utility_bill_document.sql` | yes |
| `drizzle/0040_rename_user_roles.sql` | yes |
| `drizzle/0041_hash_public_tokens.sql` | yes |
| `drizzle/0042_postgres_optimization.sql` | yes |
| `drizzle/0043_drop_stale_case_indexes.sql` | yes |
| `drizzle/0044_storage_objects.sql` | yes |
| `drizzle/0045_cases_stage_queue_fk.sql` | yes |
| `drizzle/0046_flow_configuration_revision.sql` | yes |
| `drizzle/0047_queue_workflow_lifecycle.sql` | yes |
| `drizzle/0048_trust_documents.sql` | yes |
| `drizzle/0049_cases_current_stage_queue_index.sql` | yes |
| `drizzle/0050_ensure_live_queue.sql` | yes |
| `drizzle/0051_remove_dialogpay_card_queue.sql` | yes |
| `drizzle/0052_portal_mid_limit_category.sql` | yes |
| `drizzle/0053_multi_sub_merchants.sql` | yes |
| `drizzle/0054_case_flow_close_outbox.sql` | yes |
| `drizzle/0055_repair_case_flow_close_jobs_failure_tracking.sql` | yes |
| `drizzle/0056_backfill_merchant_root_ownership.sql` | yes |
| `drizzle/0057_merge_physical_agreement_workflow.sql` | yes |
| `drizzle/0058_rename_wife_to_spouse.sql` | yes |
| `drizzle/0059_cases_merchant_created_idx.sql` | yes |
| `drizzle/0060_drop_cases_current_stage_id_idx.sql` | yes |
| `drizzle/0061_drop_cases_owner_id_idx.sql` | yes |
| `drizzle/0062_drop_cases_queue_id_idx.sql` | yes |
| `drizzle/0063_drop_cases_status_idx.sql` | yes |
| `drizzle/0064_drop_queue_stages_queue_id_idx.sql` | yes |
| `drizzle/0065_drop_case_flow_close_blockers_prerequisite_idx.sql` | yes |
| `drizzle/0066_drop_case_flow_close_triggers_target_idx.sql` | yes |
| `drizzle/0067_drop_case_flow_creation_requirements_prerequisite_idx.sql` | yes |
| `drizzle/0068_drop_case_links_source_queue_idx.sql` | yes |
| `drizzle/0069_drop_case_links_target_queue_idx.sql` | yes |
| `drizzle/0070_drop_user_queue_access_queue_idx.sql` | yes |
| `drizzle/0071_case_flow_safe_backfill.sql` | yes |
| `drizzle/0072_case_flow_job_classification.sql` | yes |
| `drizzle/0073_resubmission_single_active_token.sql` | yes |
| `drizzle/0074_agreement_driven_live.sql` | yes |
| `drizzle/0075_case_flow_versions.sql` | yes |
| `drizzle/0076_decode_merchant_html_entities.sql` | yes |
| `drizzle/0077_rename_awaiting_client_stage.sql` | yes |
| `drizzle/0078_sub_merchant_seller_code_unique.sql` | yes |
| `drizzle/0079_drop_dead_go_live_tokens_and_user_deleted_at.sql` | yes |
| `drizzle/0080_drop_sub_merchant_seller_code_unique.sql` | yes |
| `drizzle/0081_drop_card_workflow_type.sql` | yes |
| `drizzle/0082_email_delivery_tracking.sql` | yes |
| `drizzle/0083_drop_resubmission_token_expiry.sql` | yes |
| `drizzle/0084_simplify_case_stages.sql` | yes |
| `drizzle/0085_merchant_portal_password_codes.sql` | yes |
| `drizzle/0086_merchant_portal_api_credentials.sql` | yes |
| `drizzle/0087_drop_cases_current_stage_queue_idx.sql` | yes |
| `drizzle/0088_drop_storage_objects_case_attempt_idx.sql` | yes |
| `drizzle/0089_drop_case_flow_close_jobs_source_queue_idx.sql` | yes |
| `drizzle/0090_drop_case_flow_close_jobs_target_queue_idx.sql` | yes |
| `drizzle/0091_drop_case_resubmission_tokens_case_id_idx.sql` | yes |
| `drizzle/0092_drop_cases_case_number_id_idx.sql` | yes |
| `drizzle/0093_drop_user_password_tokens_user_idx.sql` | yes |
| `drizzle/0094_drop_cases_updated_id_idx.sql` | yes |
| `drizzle/0095_mid_case_portal_mids.sql` | yes |
| `drizzle/0096_merchants_owner_full_name_trgm_idx.sql` | yes |
| `drizzle/0097_small_table_stats_and_dup_index.sql` | yes |
| `drizzle/0098_merchants_submission_key.sql` | yes |
| `drizzle/0099_case_flow_merchant_moves.sql` | yes |
| `drizzle/0100_submission_attempts_and_drive_file_deletion.sql` | yes |
| `drizzle/0101_case_state_guard.sql` | yes |
| `drizzle/0102_audit_cases_reopened_in_error.sql` | yes |
| `drizzle/0103_merchant_state_guard.sql` | yes |
| `drizzle/0104_queue_lifecycle_guard.sql` | yes |
| `drizzle/0105_storage_lifecycle_guard.sql` | yes |
| `drizzle/0106_resubmission_token_consumed_reason.sql` | yes |
| `drizzle/0107_reset_resubmitted_document_status.sql` | yes |
| `drizzle/0108_case_merchant_requests.sql` | yes |
| `drizzle/0109_case_flow_close_job_state.sql` | yes |
| `drizzle/0110_auth_token_state.sql` | yes |
| `drizzle/0111_case_data_state_guards.sql` | yes |
| `drizzle/0112_login_attempt_counters.sql` | yes |
| `drizzle/0113_resubmission_token_delivered_at.sql` | yes |
| `drizzle/0114_username_lowercase.sql` | yes |
| `drizzle/0115_single_super_admin.sql` | yes |
| `drizzle/0116_drop_resubmission_plaintext_token.sql` | yes |
| `drizzle/seed-queue-stages.sql` | **no** |
| `drizzle/seed-queues.sql` | **no** |

| `drizzle/meta/0000_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0001_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0002_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0003_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0004_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0005_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0006_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0011_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/0014_snapshot.json` | Schema snapshot used by drizzle-kit |
| `drizzle/meta/_journal.json` | Migration journal: 116 entries |

---
*Sources: every file under `backend/src/` (index, middleware, db, lib, lib/storage, config, contracts, types, modules), `backend/drizzle/` (migrations, `meta/_journal.json`, seed files), `backend/sql/`, `backend/apis/`, `backend/package.json`, `backend/drizzle.config.ts`, `backend/CLAUDE.md`. Key files read directly: `src/index.ts`, `src/lib/concurrency.ts`, `src/modules/cases/case-cursor.ts`, `src/modules/cases/case-number.ts`, `src/modules/queues/queue-stage-defaults.ts`, `src/lib/storage/*.ts`, `src/db/query-tags.ts`, `src/db/audit.ts`, `src/db/seed-demo.ts`, `src/middleware/*.ts`, `drizzle/meta/_journal.json`, `sql/seed-queue-stages.sql`, `drizzle/seed-queue-stages.sql`. Related files: 02–31 (behaviour), 32 (gaps 16–18).*
