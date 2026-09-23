# breadcrumb

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/breadcrumb.tsx`: Uses Base UI useRender for breadcrumb links; router links now pass render.
- `src/routes/_app.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Navigate through a case breadcrumb and check destination and keyboard focus.
