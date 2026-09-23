# dropdown-menu

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/dropdown-menu.tsx`: Uses Base UI Menu with Positioner and Popup, renamed submenu and indicator parts, and Base UI CSS variables.
- `src/components/nav-user.tsx`: Updated consumer props, composition, or Base UI class hooks.
- `src/components/theme-toggle.tsx`: Updated consumer props, composition, or Base UI class hooks.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes

Base UI checkbox and radio menu items do not close on click by default. Check menus that use these item types.

## Verify by hand

- Open the user and theme menus; check keyboard navigation, typeahead, submenu placement, and selection.
