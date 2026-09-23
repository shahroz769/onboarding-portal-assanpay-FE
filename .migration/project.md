# Frontend Radix to Base UI migration

2026-09-23 — whole frontend migration, one wrapper at a time. The existing `new-york` classes were retained because that legacy style has no Base UI counterpart in the shadcn registry.

## Dependencies

- Removed the direct `radix-ui` dependency from `package.json` and updated `bun.lock` with Bun.
- Removed the stale `package-lock.json`; this project declares Bun as its package manager.
- Kept `@base-ui/react`, which was already installed.
- Replaced the `cmdk` command interface with an inline Base UI Combobox and removed `cmdk`. No Radix package remains in `package.json` or `bun.lock`.

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

### Runtime follow-up

- Fixed the account menu's missing `Menu.Group` around its `Menu.GroupLabel`, which caused the reported `MenuGroupContext is missing` error when opened.
- Added a jsdom integration suite that mounts every migrated wrapper and the existing Base UI combobox, including open overlays, grouped menu/select content, basic interactions, and the real account menu. All 5 tests pass.
- Added a minimal Vitest config so `bun run test` works without loading the Cloudflare development plugin. `bun run typecheck` passes.

## Follow-up

- `components.json` now uses the official `base-nova` style. `shadcn info` reports `base: base`, so future `shadcn add` commands resolve Base UI variants. Existing component classes retain the customized legacy appearance.
- The current shadcn `base-nova` registry still defines `command` with `cmdk`. Keep this project's Base UI backed `command.tsx` when updating components; overwriting it from the registry would reinstall `cmdk` and Radix packages.
- Manually check the component interactions listed in the individual reports, especially dialogs, menus, select labels, and keyboard navigation.

### Full Radix removal follow-up

- The command interface's three consumers now provide explicit item collections; filtering, pointer selection, keyboard selection, empty state, and externally filtered mentions have runtime coverage.
- `bun run typecheck` and 8 runtime tests pass. The dependency tree, frontend source, and Bun lockfile contain no Radix or `cmdk` references.
- `bun run test` also runs `scripts/check-no-radix.mjs`, which fails if a future component update restores Radix or `cmdk` dependencies, imports, CSS variables, or a Radix shadcn style.
- A stale `node_modules/@radix-ui` directory remains on this workstation. Automatic command review rejected its recursive deletion; `bun install --frozen-lockfile --force` also left it in place. It is not present in the installed dependency tree and is not part of the project lockfile.
