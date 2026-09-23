# collapsible

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/collapsible.tsx`: Uses Base UI Panel and render composition; CSS height and open hooks now use Base UI names.
- `src/components/nav-main.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/agreement-rounds-card.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/features/cases/case-detail/rejection-rounds-card.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/styles.css`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Expand the sidebar and the agreement and rejection cards; check animation and keyboard use.
