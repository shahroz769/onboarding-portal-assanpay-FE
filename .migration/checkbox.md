# checkbox

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/checkbox.tsx`: Uses Base UI Checkbox and data-checked styling. Table headers pass a separate indeterminate prop.
- `src/components/ui/field.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/cases-columns.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/merchants/merchants-columns.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/users/users-columns.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes

Base UI renders a different root and hidden input structure. Check focus and form submission.

## Verify by hand

- Select one row, select all rows, then clear selection; check mixed and keyboard states.
