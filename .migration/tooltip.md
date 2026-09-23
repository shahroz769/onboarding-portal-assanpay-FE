# tooltip

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/tooltip.tsx`: Uses Base UI Positioner and Popup; triggers pass render and provider uses delay.
- `src/components/ui/sidebar.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/merchants/merchants-columns.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/renderers/sub-merchant-form-renderer.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/agreements-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/method-list-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/queues-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/sub-merchants-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Hover and focus icon actions and collapsed sidebar entries; check tooltip placement and delay.
