# Worker, Notifications SSE & Auth — Tuning & Hardening Plan

**Status:** Plan only. Nothing implemented. Repos stay read-only.
**Date:** 2026-09-26
**Origin:** PlanetScale Postgres "most expensive queries" report showed 40k+ daily hits
machine-driven (not user-driven). User asked: fix worker polling, explain SSE +
eliminate its DB polling, make auth faster/more secure, and assess a Better Auth
migration for current users.
**Related:** `../ts-hardening/plan.md` (Wave 4 outbox, Wave 6 hygiene), main review
REPORT.md (LOW-25 notifications index, LOW-06 SSE fan-out).

## 0. What the report actually showed

"Most expensive" = most **cumulative** time (count x avg), not slowest. Health check:

| Query | Hits | p99 | Verdict |
|---|---|---|---|
| `db:audit` catalog scan (index bloat) | 7 | 318ms | Maintenance script, not app traffic. Run on staging. |
| `latest_mid` dashboard CTE | 143 | 19ms | Only query that degrades with growth. Needs index (Section 4). |
| Session check `users where id=$1 and status=$2 and session_version=$3` | 20,750 | 0.07ms | Auth middleware; 1 hit per API request. PK lookup, healthy. |
| `case_flow_close_jobs` poll | 10,224 | 0.08ms | Worker idle loop. Wasteful, not slow. |
| `notifications` unread count | 10,401 | 0.07ms | Badge refetch cycle. Wasteful, not slow. |

**Key insight:** with very few users, ~40k hits/day are machine-driven: per-request
auth checks, the worker's 24/7 poll loop, and frontend refetch cycles (30s staleTime
+ refetch-on-window-focus, multiplied by tabs). Nothing is on fire; the work here is
efficiency + a small set of real security upgrades.

**Non-goals:** rewriting auth from scratch, adding Redis, multi-instance deployment.
All fixes work on the current single-process Bun/Hono/Postgres topology.

---

## Part A — Worker polling

### A.1 How it works today (verified in code)

- `be/src/index.ts` (~lines 31-40, 92-100, 170): a `setTimeout` chain.
  Active poll `CASE_FLOW_WORKER_POLL_MS` (default **1,000ms**), idle poll
  `CASE_FLOW_WORKER_IDLE_POLL_MS` (default **60,000ms**). Adaptive: after a cycle
  that does no work, the delay backs off to the idle value.
- `requestCaseFlowCloseJobDrain()` already exists: enqueue paths in the same process
  wake the worker immediately (in-process drain handler).
- Each cycle calls `processCaseFlowCloseJobs(batchSize = 5)`
  (`be/src/modules/cases/case-flow.service.ts:944`): per iteration it runs

  ```sql
  SELECT ... FROM case_flow_close_jobs
  WHERE completed_at IS NULL AND available_at <= now()
  ORDER BY available_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED
  ```

  inside a transaction, then a savepoint for the actual recovery work.
- The ~10,224 hits are overwhelmingly the idle 60s "anything due? no." polls
  (~7 days of uptime at 60s). The poll is correct but chatty.

### A.2 Issues

- **A-I1 (efficiency):** 60s idle polling = ~1,440 empty queries/day/process forever.
  Trivial cost each (0.08ms), but pure waste and it dominates the report.
- **A-I2 (latency gap):** the drain handler only fires for in-process enqueues.
  Jobs enqueued by another process, or future-dated retries (`available_at` in the
  future), still wait for the next poll tick.
- **A-I3 (index):** the poll's `WHERE completed_at IS NULL AND available_at <= now()`
  has no supporting partial index; as the jobs table accumulates completed rows, the
  poll scans more dead weight per cycle.

### A.3 Fixes

**Fix A1 — Raise the idle poll interval (quick win, 10 minutes of work).**
Change the default of `CASE_FLOW_WORKER_IDLE_POLL_MS` in `be/src/config/env.ts`
from `60_000` to `300_000` (5 min). Rationale: the in-process drain handler already
gives instant wake for same-process enqueues; the poll is only a backstop for
cross-process enqueues and future-dated retries. 5x fewer idle polls, no
meaningful latency change.

**Fix A2 — Postgres LISTEN/NOTIFY wake (the proper fix).**
Zero new infrastructure; the textbook Postgres pattern for "wake me when there is
work". Design:

1. Migration (Drizzle):

   ```sql
   CREATE OR REPLACE FUNCTION notify_case_flow_job() RETURNS trigger
   LANGUAGE plpgsql AS $$
   BEGIN
     PERFORM pg_notify('case_flow_close_jobs', NEW.id::text);
     RETURN NEW;
   END $$;

   CREATE TRIGGER case_flow_close_jobs_notify
     AFTER INSERT ON case_flow_close_jobs
     FOR EACH ROW EXECUTE FUNCTION notify_case_flow_job();
   ```

   Notify on INSERT only. Retry paths (`available_at` pushed into the future) are
   scheduled by the worker itself, which can call the existing
   `requestCaseFlowCloseJobDrain()` directly — no trigger needed on UPDATE.

2. Worker (`be/src/index.ts`): open one dedicated `LISTEN` connection from the
   underlying pg driver (a `PoolClient` that stays checked out for the process
   lifetime; do **not** route through the Drizzle query path). On notification,
   call the existing `requestCaseFlowCloseJobDrain()`.

3. Keep the 5-minute poll (Fix A1) as a **safety net** for missed notifies
   (connection drop between NOTIFY and LISTEN) — the health endpoint
   (`/health` already reports `caseFlowWorker.lastCycleAt`) will show if the
   safety net ever does real work, which is your canary for LISTEN breakage.

4. Shutdown: release the LISTEN client in the existing graceful-shutdown path.

**Fix A3 — Partial index for the poll.**

```sql
CREATE INDEX CONCURRENTLY idx_case_flow_close_jobs_poll
  ON case_flow_close_jobs (available_at)
  WHERE completed_at IS NULL;
```

Turns every poll (and the safety-net poll) into a tiny index-only scan regardless
of how many completed rows accumulate.

### A.4 Alternative architectures considered

- **pg_cron** (if PlanetScale/managed Postgres exposes it): let the database itself
  invoke the worker on a schedule. Rejected for now — cron granularity is minutes,
  worse latency than LISTEN/NOTIFY, and it couples you to a provider extension.
- **Redis Streams / BullMQ-style queue:** the right answer when you need multiple
  competing worker processes with consumer groups and redelivery. You don't yet;
  LISTEN/NOTIFY covers single-process and even a couple of processes (all listeners
  wake; `SKIP LOCKED` keeps them from double-processing). Revisit only with
  multi-instance deployment — at which point Redis also solves the SSE fan-out
  (REPORT.md LOW-06).
- **Polling harder (shorter interval):** wrong direction; latency is already solved
  by the drain handler + NOTIFY.

**Decision: A1 + A2 + A3.** No Redis, no new services.

### A.5 Acceptance criteria

- Idle DB hits from the worker drop ~5x immediately (A1), then to ~zero steady-state
  with NOTIFY wake (A2) — only the 5-min safety-net poll remains.
- Inserting a `case_flow_close_jobs` row from `psql` (simulating a foreign process)
  triggers a worker cycle within ~1s (proves cross-process wake; the old code would
  wait up to 60s).
- Killing the LISTEN connection mid-run: safety-net poll still processes jobs;
  `/health` shows the cycle, and the worker re-establishes LISTEN on next cycle.
- `EXPLAIN` on the poll query shows an index-only scan on the new partial index.

---

## Part B — Notifications SSE: from polling to event-driven

### B.1 How it works today (verified in code)

**Backend** (`be/src/modules/notifications/`):
- `GET /api/notifications/stream` opens `text/event-stream`
  (`notifications.routes.ts:63`). Each connection registers its writer in an
  **in-process** `Map<userId, Set<Subscriber>>` (`notifications.events.ts`).
  Header comment in the file already notes: single-process only; swap for Redis
  pub/sub when multi-instance.
- Notification creation (`notifications.service.ts:216`): inserts the row, then
  calls `publish(userId, event)` — the full payload is pushed down every open
  stream for that user. **The SSE delivery path itself performs zero DB queries.**

**Frontend** (`fe/src/features/notifications/notifications-sse.ts`,
`fe/src/hooks/use-notifications-query.ts`):
- Custom client over fetch + ReadableStream (native `EventSource` can't send
  `Authorization` headers). Auto-reconnect with exponential backoff (max 30s),
  **pauses while the tab is hidden**, refreshes the access token on 401.
- On each event the provider does `setQueryData` — the list and the unread badge
  update **locally with no refetch** (`use-notifications-query.ts:107,123`).
  Mark-read mutations also do optimistic `setQueryData` (`:160+`).

**Why 10,401 DB hits then?** Everything *around* SSE, not SSE itself:
1. The unread-count query still runs with `staleTime: 30_000` plus TanStack's
   default `refetchOnWindowFocus: true` — every tab focus and every stale cycle
   fires it, per tab.
2. Every SSE (re)connect passes through `requireAuth` = one session-check query
   (feeds the 20,750 number too). Reconnects happen on network blips, laptop
   sleep, tab visibility toggles.

### B.2 Target state

**The unread badge and list hit the DB exactly twice per page lifetime:**
once on mount (initial fetch), and once per reconnect *only if* events were missed
while disconnected. No timers, no focus refetches. In the common case the badge
updates purely from pushed events.

### B.3 Fixes

**Fix B1 — Make the queries event-driven (the core change, ~30 minutes).**
In `fe/src/hooks/use-notifications-query.ts`, for both the list query and the
unread-count query:

```ts
{
  staleTime: Infinity,          // was 30_000
  refetchOnWindowFocus: false,  // was default true
  refetchOnReconnect: false,    // was default true
  refetchOnMount: true,         // keep: one fetch per fresh page load
  gcTime: 10 * 60_000,          // keep cache warm across tab switches
}
```

This is safe *because* the provider already handles every mutation path with
`setQueryData`: SSE events (`:107`), mark-all-read (`:123`), single mark-read
(`:160+`). Audit before shipping: grep for any code path that creates/mutates
notifications *without* going through these (the service-layer `publish` covers
BE-created ones). The notifications popover/list components must not call
`refetch()` on open — verify `notification-bell.tsx` and
`notifications-popover.tsx`.

**Fix B2 — Single reconciliation fetch on reconnect (closes the missed-event gap).**
Today a dropped connection can silently miss events. Implement:
1. Track the last received event id client-side (the stream already sends `id:`).
2. On reconnect, the client sends `Last-Event-ID`; the BE list endpoint gains an
   optional `since_id` (or `since` timestamp) parameter returning only newer rows.
3. Client merges into cache via `setQueryData`. This is **one query per
   reconnect**, only when the stream was actually down — not polling.
4. Server-side: add a heartbeat comment (`: ping`) every ~25s so proxies/LBs don't
   silently kill idle streams (verify whether `streamSSE` already does this; if
   not, add it — it also makes dead-connection detection fast).

**Fix B3 — Partial index for the unread count.**

```sql
CREATE INDEX CONCURRENTLY idx_notifications_unread
  ON notifications (user_id)
  WHERE is_read = false;
```

The remaining queries (mount + reconciliations) become index-only. This is also
REPORT.md LOW-25.

**Not changing:** the in-process pub/sub stays. It is correct for the current
single-process deployment and is already documented as the seam to replace with
Redis pub/sub at multi-instance time (same Redis you'd add for the worker then —
one infra decision, not two).

### B.4 Acceptance criteria

- Unread-count DB hits drop from ~10k/day to roughly (page loads + reconnects).
  Verify via the same PlanetScale report after one week.
- Kill the SSE connection mid-session (devtools offline toggle): on reconnect,
  exactly one reconciliation query fires and any missed notifications appear —
  no duplicates (dedupe by id on merge).
- Mark-read from a second tab: badge updates in the first tab via SSE with no
  refetch (already works; add a regression test).
- No code path creates a notification without `publish()` — add a lint/test
  guard or a code-review checklist item.

---

## Part C — Auth: faster and more secure

### C.1 How it works today (verified in code)

- `be/src/middleware/auth.ts` `requireAuth`: verify JWT signature (HMAC via
  `jose`) -> **one** DB lookup:

  ```sql
  SELECT id FROM users
  WHERE id=$1 AND status='active' AND session_version=$2 AND deleted_at IS NULL
  ```

  (0.07ms p99, PK lookup). `session_version` gives **instant global revocation**:
  `revokeAllUserSessions` bumps the version and every outstanding access token
  dies on its next request.
- `be/src/modules/auth/auth.service.ts` `refreshSession` (`:222`): rotating
  refresh tokens — atomic `UPDATE ... SET status='rotated', revokedAt=...,
  replacedByTokenId=... WHERE id AND token_hash AND status='active' AND
  expires_at > now()`. Token hashes (not raw tokens) stored at rest. User agent +
  IP recorded per session.
- Passwords: `Bun.password.hash/verify` (`:156,198`) — Bun's default is
  **bcrypt, cost 10** (`$2b$`).

This is a genuinely solid design. The review found no auth findings above Low.

### C.2 "Faster" — analysis and fixes

**Honest assessment:** at 0.07ms the query is not the bottleneck; the *count* is,
and the count is a proxy for total API request volume. The biggest auth-speed win
is Part B (fewer requests -> fewer session checks). Within auth itself:

**Fix C1 — Drop the dead `deleted_at` predicate.** The column is always NULL
(review found it's never set; Wave 6 of the hardening plan drops it). One less
predicate on the hottest query. Trivial, do it with the Wave 6 cleanup.

**Fix C2 — Short-TTL session cache (OPTIONAL, default: skip).**
A 30-60s in-memory `Map<userId:sessionVersion, expiry>` in the middleware would
cut session-check queries ~10-50x. **Trade-off: revocation takes up to the TTL
to propagate.** For a financial onboarding portal, instant revocation on demand
is a feature. If adopted anyway: cache reads only, never mutations; keep TTL
<= 60s; expose a metric for cache-hit rate. **Recommendation: skip unless
connection churn (not query time) becomes a problem — which the report shows it
isn't.**

**Explicitly rejected:** stateless sessions (putting status/version claims in the
JWT and skipping the DB). That trades instant revocation for up-to-15-minute
revocation lag (your access-token lifetime). Wrong trade for this product.

### C.3 "More secure" — fixes

**Fix C3 — Refresh-token reuse detection (theft signal). HIGH value, small code.**
Today, presenting an already-rotated refresh token just 401s
(`auth.service.ts:278`). Change `refreshSession`: look up the token row by hash
*first*, then branch —
- `status='active'` + not expired -> rotate as today.
- `status='rotated'` (or revoked/expired-but-known) -> **suspected theft**:
  call `revokeAllUserSessions(userId)` (bumps `session_version`, killing every
  session including the attacker's), write an audit log entry, and return 401.
  This is the standard OWASP-style rotation defense and your schema already has
  every column it needs (`status`, `revokedAt`, `replacedByTokenId`).

**Fix C4 — Per-account login rate limiting.**
The login route already has a per-IP bucket (shared-bucket finding HIGH-02 in the
main report covers the general problem). Add a second, per-*account* bucket keyed
by normalized email (e.g. 10 attempts / 15 min / account). This stops targeted
credential stuffing that rotates IPs — per-IP alone doesn't. Reuse the existing
rate-limit middleware with a different key extractor; keep the response
indistinguishable (same 429 shape) to avoid user enumeration.

**Fix C5 — Keep (don't regress):** instant revocation via `session_version`,
hashed refresh tokens at rest, rotation with `replacedByTokenId` chain. These
are already right; the plan must not "simplify" them away.

### C.4 Better Auth migration — feasibility assessment

**Question:** can we migrate to Better Auth (the library) while keeping current
users, no password resets?

**Answer: yes, technically feasible — but recommended against.**

What it would take:
1. **Schema:** add Better Auth's tables (`user`, `session`, `account`,
   `verification`) alongside yours. Bulk-import existing users into Better Auth's
   `user` table (id mapping preserved).
2. **Passwords:** your hashes are bcrypt `$2b$` cost 10 via `Bun.password`.
   Better Auth's credentials plugin verifies bcrypt — **existing hashes work
   without resets** (verify the cost factor against Better Auth's expected
   settings in a spike before committing).
3. **Sessions (the hard part):** your current JWTs/refresh tokens will not
   validate under Better Auth. Two cutover options:
   - *Clean cutover:* maintenance window, migrate, everyone logs in again.
     Painless here — few users, internal tool.
   - *Dual-run:* accept both old JWTs and Better Auth sessions during a
     transition window, then drop the old path. More code, no benefit at your
     scale.
4. **Custom logic stays custom regardless:** the queue-access model
   (`requireCaseMutationContext`), role types, and `session_version` revocation
   semantics don't exist in Better Auth — they become plugins/hooks either way.

**Recommendation: do not migrate.** Your auth is already strong (instant
revocation, rotation, hashed tokens at rest — most Better Auth adopters get
*less* than this out of the box). Better Auth buys you social login, magic links,
and organization management you don't need, in exchange for touching your most
security-critical code. If you want a specific capability (TOTP 2FA, passkeys),
bolt just that onto the current system — an order of magnitude smaller blast
radius for the actual gain. Revisit only if auth requirements fundamentally
change (e.g. customer-facing SSO).

### C.5 Acceptance criteria

- Reuse detection: presenting a rotated refresh token twice revokes all user
  sessions (assert `session_version` incremented, all tokens dead) and writes an
  audit entry. Test: login -> refresh (ok) -> replay old refresh token ->
  expect 401 + all sessions revoked.
- Per-account bucket: 11th login attempt for one email within 15 min -> 429,
  while a different email from the same IP still works.
- Session-check p99 unchanged or better; `/health` unaffected.
- No behavior change for legitimate users: rotation, logout, revoke-all all keep
  working (existing auth tests must pass unmodified).

---

## 4. The `latest_mid` index (from the report)

Included here because it came from the same report, though it's dashboard code,
not worker/SSE/auth:

```sql
CREATE INDEX CONCURRENTLY idx_case_history_mid_saved
  ON case_history (created_at DESC)
  WHERE action = 'mid_creation_saved';
```

Narrows the `latest_mid` CTE (`dashboard.service.ts:218`) to only MID-save rows
before the join + regex. Longer-term (when `case_history` is 10x today's size):
replace the scan with a `merchant_latest_mid` summary table maintained by the
case-flow worker. Not needed now.

---

## 5. Work plan (agents-only)

**Phase 1 — Quick wins (2-3 days).** No migrations beyond `CONCURRENTLY` indexes.
- A1: idle poll default 60s -> 300s (`env.ts`).
- A3, B3, Section 4: three `CREATE INDEX CONCURRENTLY` migrations.
- B1: FE query config (`staleTime: Infinity`, `refetchOnWindowFocus/Reconnect:
  false`) + audit of `notification-bell.tsx` / `notifications-popover.tsx` for
  stray `refetch()` calls.
- C1: drop `deleted_at` predicate (fold into hardening Wave 6 if that's running).
- C4: per-account login bucket.

**Phase 2 — Structural (1-2 weeks).**
- A2: LISTEN/NOTIFY trigger + worker LISTEN client + graceful-shutdown handling.
- B2: `since_id` reconciliation + SSE heartbeat.
- C3: refresh-token reuse detection + audit logging.

**Phase 3 — Decision (no code until decided).**
- Better Auth: spike-verify bcrypt cost compatibility IF the user overrides the
  recommendation; otherwise closed.

**Ordering note:** Phase 1 items are independent and can parallelize across
agents. Phase 2's A2 and C3 both touch `index.ts`/auth service startup — sequence
them, don't parallelize.

## 6. Test plan

- **Worker:** integration test — insert job row from a second connection, assert
  worker cycle starts < 1s; kill LISTEN mid-run, assert safety-net poll recovers;
  `EXPLAIN` assertion on the poll query in a migration test.
- **SSE:** client test — offline/online toggle, assert exactly one reconciliation
  fetch, no duplicates; two-tab test — mark-read in tab 2 updates tab 1's badge
  with zero fetches (assert via request counter).
- **Auth:** reuse-detection test per C.5; rate-limit test per C.5; full existing
  auth suite green unmodified.
- **Load sanity:** replay 24h of the PlanetScale report after one week in prod;
  expect worker + notification queries to fall off the "most expensive" list.

## 7. Open questions for the user

1. **C2 cache:** skip the session cache (recommended), or do you want the
   30-60s read cache despite the revocation-delay trade-off?
2. **B2 heartbeat interval:** 25s ok, or does your proxy/LB need shorter?
3. **Better Auth:** confirm the recommendation to *not* migrate stands, or
   authorize the bcrypt-compatibility spike.
4. Should these items be folded into `../ts-hardening/plan.md` as scheduled waves,
   or tracked as a separate workstream?
