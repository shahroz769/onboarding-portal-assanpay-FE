# label

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/label.tsx`: Uses a native label element instead of Radix Label.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Click labels beside each form control and confirm focus moves to the control.
