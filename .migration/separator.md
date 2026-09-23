# separator

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/separator.tsx`: Uses Base UI Separator and removes the Radix-only decorative prop.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Check horizontal and vertical separators in the app shell.
