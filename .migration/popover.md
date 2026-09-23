# popover

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/popover.tsx`: Uses Base UI Positioner and Popup. Triggers pass render, and the mention picker passes an explicit anchor ref.
- `src/components/data-table/data-table-filter.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-assign-owner-dialog.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/case-chatter.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/dashboard/dashboard-filter-bar.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/notifications/notification-bell.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/onboarding/merchant-onboarding-form.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/onboarding/resubmission-form.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/users/user-form.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes

Popover Anchor has no Base UI part; the mention picker now anchors through Positioner.anchor.

## Verify by hand

- Open a filter and mention suggestion popover; check placement, outside close, and focus.
