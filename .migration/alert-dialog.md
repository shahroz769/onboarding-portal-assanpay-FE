# alert-dialog

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/alert-dialog.tsx`: Uses Base UI backdrop, popup, close, and trigger composition.
- `src/features/cases/case-detail/case-side-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes

The action is now a styled button, as in the Base UI registry. It no longer closes the dialog automatically; check controlled dialog flows.

## Verify by hand

- Open a confirmation, cancel it, then run its action and check focus and close behavior.
