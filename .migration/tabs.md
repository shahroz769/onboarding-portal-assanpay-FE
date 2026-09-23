# tabs

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/tabs.tsx`: Uses Base UI Tab and Panel. Case panels use keepMounted and Base UI hidden attributes.
- `src/features/cases/case-detail/case-side-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes

Base UI tabs use manual activation by default; arrow keys move focus and Enter or Space activates.

## Verify by hand

- Use arrow keys and Enter across case detail tabs; revisit Chatter and History to verify their state remains.
