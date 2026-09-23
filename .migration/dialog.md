# dialog

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/dialog.tsx`: Uses Base UI Backdrop and Popup; trigger and close consumers use render.
- `src/components/ui/command.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/method-list-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/queues-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/sub-merchants-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/workflow-builder/workflow-builder-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Open and close a configuration dialog with button, Escape, and backdrop; check focus return.
