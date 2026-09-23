# switch

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/switch.tsx`: Uses Base UI Switch with data-checked and data-unchecked styling.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Toggle a switch with pointer and Space, and check its visual state.
