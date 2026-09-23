# command

2026-09-23 — replaced the final Radix dependent command primitive.

## Changed

- `src/components/ui/command.tsx` now composes an inline Base UI Combobox. It retains the existing shadcn component names and styling hooks.
- The queue picker, owner picker, and mention picker provide explicit items. Mention results continue to use external filtering.
- Removed `cmdk` and its transitive Radix packages from the Bun dependency graph.
- The upstream shadcn `base-nova` command recipe still uses `cmdk`; this local wrapper intentionally uses Base UI instead.

## Verification

- Runtime tests cover search filtering, empty state, pointer and keyboard selection, repeated selection, and externally filtered mentions.
- `bun run typecheck` and `bun run test` pass.
