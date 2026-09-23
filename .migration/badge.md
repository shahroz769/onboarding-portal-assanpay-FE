# badge

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/badge.tsx`: Uses Base UI useRender for polymorphic badges; the clickable priority badge now passes render.
- `src/features/cases/cases-columns.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Open the case priority badge and check its click target and appearance.
