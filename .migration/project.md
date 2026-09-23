# Frontend Radix to Base UI migration

2026-09-23 — whole frontend migration, one wrapper at a time. The existing `new-york` classes were retained because that legacy style has no Base UI counterpart in the shadcn registry.

## Dependencies

- Removed the direct `radix-ui` dependency from `package.json` and updated `bun.lock` with Bun.
- Removed the stale `package-lock.json`; this project declares Bun as its package manager.
- Kept `@base-ui/react`, which was already installed.
- Radix packages remain in `bun.lock` transitively through `cmdk`. The `cmdk` wrapper was left on its own primitive.

## Consumer sweep

- Replaced Radix `asChild` composition with Base UI `render` for migrated primitives.
- Styled router and anchor links now use `ButtonLink` so they remain links rather than buttons.
- Mapped all 19 select roots to explicit `items` for selected labels, and updated nullable value callbacks.
- Replaced Radix data attributes and CSS variables in migrated UI and consumers.
- Moved the mention picker from Popover Anchor to an explicit positioner anchor ref.
- No direct `radix-ui` or `@radix-ui` imports, or `--radix-*` variables, remain in frontend source.

## Verification

- Baseline and final `bun run typecheck`: passed.
- Prettier ran on all changed TSX and CSS files.
- `git diff --check`: passed.
- Dev server served `/` with HTTP 200 after migration.
- `bun run lint` could not start because the installed ESLint/TypeScript parser crashes while reading `typescript.ModuleKind.Cjs`; it produced no project lint findings.
- Frontend and backend builds were not run, per `AGENTS.md`.
- The separate Bun Hono backend needed no change for this frontend primitive migration.

## Follow-up

- `components.json` still says `new-york`, which shadcn recognizes as Radix. There is no `base-new-york` registry style. Future `shadcn add` commands may install Radix variants; inspect components before adding them.
- Manually check the component interactions listed in the individual reports, especially dialogs, menus, select labels, and keyboard navigation.
