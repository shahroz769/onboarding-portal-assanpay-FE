# Bug Report — Merchant List Cursor Pagination 500s on Date-Sorted Pages

**ID:** TS-MCH-CURSOR-001
**Severity:** High (breaks pagination for the primary merchant list view)
**Status:** Open — root cause identified, fix proposed, not yet applied
**Reported:** 2026-09-26
**Reporter:** Differential testing (Go backend vs TS backend, 596 probes)

---

## Summary

`GET /merchants` (and any merchant list endpoint using keyset pagination) returns **HTTP 500** on every cursor page (page 2+) whenever the active sort is a **date** column (e.g. `createdAt`). Page 1 works fine because no cursor is involved.

## Location

- **File:** `src/modules/merchants/merchants.service.ts`
- **Function:** `buildKeysetCondition` (line 188)
- **Call site:** same file, ~line 572 (inside the merchant list query builder)

## Reproduction

1. `GET /merchants?sortBy=createdAt&sortOrder=desc` → 200, response includes a `nextCursor`.
2. `GET /merchants?sortBy=createdAt&sortOrder=desc&cursor=<nextCursor>` → **500**.

Any date-kind sort column triggers it. Number/string sorts are unaffected.

## Root Cause

`decodeKeysetCursor` (line 132) correctly deserializes the cursor's date value into a JS `Date` object:

```ts
value = new Date(parsed.value)
```

But `buildKeysetCondition` then interpolates that raw `Date` object directly into a drizzle `sql` template as a bind parameter:

```ts
function buildKeysetCondition(input: {
  expression: unknown
  idExpression: unknown
  sortOrder: 'asc' | 'desc'
  value: Date | number | string   // <-- Date arrives here
  id: string
}) {
  const operator = input.sortOrder === 'desc' ? '<' : '>'
  return or(
    sql`${input.expression} ${sql.raw(operator)} ${input.value}`,  // <-- raw Date as bind param
    and(
      sql`${input.expression} = ${input.value}`,                    // <-- same here
      sql`${input.idExpression} ${sql.raw(operator)} ${input.id}`,
    ),
  )!
}
```

The postgres.js driver throws when it receives the `Date` instance through this parameter path, and the error surfaces as an unhandled 500. The bug is pre-existing (present at least since `73b220e`) and was likely missed because page 1 — the path exercised in manual testing — never touches this code.

## Expected vs Actual

| Request | Expected | Actual |
|---|---|---|
| Page 1 (no cursor), date sort | 200 + rows + `nextCursor` | 200 ✓ |
| Page 2+ (with cursor), date sort | 200 + rows + `nextCursor`/`null` | **500** ✗ |
| Page 2+ (with cursor), string/number sort | 200 | 200 ✓ |

## Suggested Fix

Serialize the `Date` to an ISO string before it reaches the query — either at the call site or inside `buildKeysetCondition`:

```ts
// Option A — normalize inside buildKeysetCondition
const value = input.value instanceof Date ? input.value.toISOString() : input.value
```

then use `${value}` in both `sql` fragments. This mirrors what `encodeKeysetCursor` already does when *creating* cursors (`input.value instanceof Date ? input.value.toISOString() : input.value`, line ~121) — the decode path just never got the symmetric treatment.

## Verification Steps (for the fixing agent)

1. Apply the fix.
2. Seed ≥ 2 pages of merchants (or lower the page size).
3. `GET /merchants?sortBy=createdAt&sortOrder=desc` → capture `nextCursor`.
4. `GET /merchants?sortBy=createdAt&sortOrder=desc&cursor=<cursor>` → expect 200 with the correct next slice of rows and no overlap with page 1.
5. Repeat for `sortOrder=asc` and for a string sort (`businessName`) to confirm no regression.
6. Confirm an invalid/tampered cursor still returns 400 `Invalid pagination cursor.`

## Notes

- Do **not** "fix" this by catching the driver error and returning 500/400 — the cursor value is valid; only its serialization is wrong.
- The Go backend port of this service formats the cursor timestamp as a string and paginates correctly; behavior after the TS fix should match it exactly.
