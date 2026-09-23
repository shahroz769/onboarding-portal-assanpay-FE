# sheet

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/sheet.tsx`: Uses Base UI Dialog Backdrop and Popup while preserving side variants.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Open the mobile sidebar sheet; check Escape, backdrop close, and focus return.
