# select

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/select.tsx`: Uses Base UI Positioner, Popup, List, and scroll arrows. Consumers provide items so selected values show their labels and handle nullable callbacks.
- `src/components/case-email/email-recipient-select.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/users/users-table.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/users/user-form.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/cases-table.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-priority-dialog.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/merchants/merchants-priority-dialog.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/dashboard/dashboard-filter-bar.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/dashboard/dashboard-portal-mids.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/onboarding/merchant-onboarding-form.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/onboarding/resubmission-form.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/renderers/merchant-id-renderer.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/workflow-builder/workflow-builder-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/queues-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes

Base UI select can return null on value change; handlers map this to their prior empty or unset state.

## Verify by hand

- Select options in onboarding, case filters, and workflow forms; check selected labels, typeahead, and keyboard navigation.
