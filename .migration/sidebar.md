# sidebar

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/sidebar.tsx`: Removes Radix Slot. Polymorphic menu links use Base UI useRender and consumers pass render.
- `src/components/nav-main.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/components/team-switcher.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Navigate from the sidebar and team switcher in expanded and collapsed states.
