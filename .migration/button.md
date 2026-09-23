# button

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/button.tsx`: Uses Base UI Button. Styled links use the ButtonLink composition so anchors and router links keep link semantics.
- `src/components/ui/combobox.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/components/case-email/whatsapp-message-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/components/default-route-error.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/agreement-rounds-card.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/case-history-timeline.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/rejection-rounds-card.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/renderers/agreement-renderer.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/renderers/dialogpay-card-renderer.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/renderers/sub-merchant-form-renderer.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/configuration/panels/sub-merchants-panel.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/merchants/merchants-columns.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/users/user-form.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/users/users-table.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/routes/set-password.$token.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/routes/_app.cases.$caseId.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/routes/_app.merchants.$merchantId.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/routes/__root.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Click a regular button, an internal styled link, and an external file link; verify keyboard activation.
