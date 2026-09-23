# scroll-area

2026-09-23 — transformation engine for legacy new-york style; migrated.

## Changed

- `src/components/ui/scroll-area.tsx`: Uses Base UI Scrollarea, Scrollbar, and Thumb while preserving the viewport ref and both scrollbar directions.
- Leftover scan: no `radix-ui` or `@radix-ui` imports remain in this component or its listed consumers.

## Left alone

- The separate Bun Hono backend has no UI primitive dependency. Third-party cmdk, sonner, calendar, and chart primitives were not migrated.

## Behavior changes


## Verify by hand

- Scroll a long case panel vertically and horizontally; check viewport callbacks.
