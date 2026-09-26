# T-FIXED-01 — Queue stage reorder always 500s (TS backend)

## Summary
`PATCH /api/queues/:id/stages/reorder` is completely non-functional in the
TypeScript backend. Every reorder request — even a fully valid one — fails
with `500 {"error":"Internal server error."}` and the stage order is left
unchanged. Admins cannot reorder workflow queue stages at all.

## Affected code (repo: `onboarding-portal-assanpay-BE`)
- Handler: `src/modules/queues/queues.service.ts` → `reorderQueueStages()` (≈line 781)
- Route: `src/modules/queues/queues.routes.ts` → `'/:id/stages/reorder'` (≈line 121)
- Input schema: `src/modules/queues/queues.schemas.ts` → `reorderQueueStagesSchema` (≈line 192)
- Table definition: `src/db/schema.ts` → `queueStages` (≈line 365–380)

## Reproduction
1. Pick any queue with ≥2 stages, note each stage's `id` and the queue's
   current `revision`.
2. Send:
   `PATCH /api/queues/{queueId}/stages/reorder`
   body: `{ "stageIds": ["<every stage id exactly once, in the desired order>"], "revision": <current revision> }`
3. Observe: `500 {"error":"Internal server error."}`. Stage order unchanged.

Any valid permutation of the full stage-id set reproduces it — the endpoint
cannot succeed under any input.

## Root cause
`reorderQueueStages()` uses a two-phase update to avoid collisions on the
unique index `queue_stages_queue_order_uniq (queue_id, "order")`. Phase 1
parks each stage at a **negative** order value as a transient step:

```ts
// Two-phase update to avoid unique (queue_id, order) collisions.
for (let index = 0; index < input.stageIds.length; index += 1) {
  await tx
    .update(queueStages)
    .set({ order: -(index + 1) })          // ← -1, -2, -3, …
    .where(eq(queueStages.id, input.stageIds[index]!))
}
for (let index = 0; index < input.stageIds.length; index += 1) {
  await tx
    .update(queueStages)
    .set({ order: index + 1 })            // ← 1, 2, 3, …
    .where(eq(queueStages.id, input.stageIds[index]!))
}
```

But the table carries a CHECK constraint (defined in the schema itself and
in the database via `0042_postgres_optimization.sql`):

```ts
queueStagesOrderPositive: check(
  'queue_stages_order_positive',
  sql`${table.order} > 0`,
),
```

The very first UPDATE of phase 1 writes `order = -1`, which violates
`"order" > 0`. PostgreSQL aborts the statement, the transaction rolls back,
and the generic error handler returns 500. Phase 2 is never reached. The
transient values are illegal by the schema's own rule, so this can never
work as written.

## Fix specification
Keep everything else identical (404 on unknown queue, 422 unless the body
lists every stage id exactly once, revision-bump with optimistic
concurrency, single transaction, response DTO shape). Change only the
two-phase update to use a **positive offset** instead of negative parking:

- Phase 1: `SET order = order + 1000000` for all stages of the queue
  (any offset larger than any plausible stage count works; values stay
  positive and cannot collide with existing positions `1..n`).
- Phase 2: `SET order = <final position>` (`1..n` in the requested
  `stageIds` order) per stage id.

Both phases must stay as separate statements inside the existing
transaction. Do NOT collapse this into a single `CASE`-based UPDATE:
PostgreSQL enforces unique indexes row-by-row during statement execution,
so an in-statement swap of two rows still raises a unique violation.

Reference: the Go backend implements exactly this scheme
(`internal/queues`, two-phase positive-offset; regression tests in
`internal/queues/reorder_test.go`) and the endpoint returns 200 with the
correct order there.

## Acceptance criteria
1. Reorder with a valid full permutation + correct revision → `200`, stages
   returned in the requested order with positions `1..n`, revision bumped.
2. Second reorder to a different permutation → `200`, correct new order
   (proves no leftover offset/collision state).
3. Unknown queue id → `404`; missing/duplicate/unknown stage id → `422`;
   stale revision → the existing concurrency error (unchanged behavior).
4. `SELECT * FROM queue_stages WHERE "order" <= 0` is empty after any
   sequence of reorders (CHECK constraint never violated, even transiently
   — verify with concurrent reorder attempts if practical).
5. No new migration needed: the schema and constraints are unchanged; this
   is a service-layer-only fix.

## Out of scope
Do not change the route path, request/response shapes, auth, or the
revision-concurrency mechanism. Do not touch the database schema.
