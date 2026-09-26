# AssanPay Onboarding Portal — Frontend Deep-Dive: Open Findings (UI/UX, Performance, Data Fetching & Routing)

**Date:** 2026-09-25
**Scope:** frontend-only, read-only — no code was modified, committed, or pushed.
**Repo:** https://github.com/shahroz769/onboarding-portal-assanpay-FE (fresh clone at `~/workspace/reviews/assanpay-ux/fe`)
**Stack verified:** React 19 · @tanstack/react-start 1.168.58 · @tanstack/react-router 1.170.39 · @tanstack/react-query 5.103.2 · @tanstack/react-form 1.33.5 · Tailwind CSS 4 · @base-ui/react 1.8 (shadcn/Base UI) · @xyflow/react 12 · recharts 3.10 · axios · Zod 4 · sonner · next-themes · Vite 8 · Cloudflare Workers (wrangler, Start SPA mode)
**Method:** three parallel audits (UI/UX · performance+data-fetching · routing+docs-compliance) over the 238-file tree, plus a production `bun run build` for bundle analysis (transient artifacts removed; git tree left clean). No headless Chromium was available in this environment, so no screenshots were captured — all findings are grounded in code inspection.

**Relationship to the main report:** `plans/code-review-open-findings.md` already filed frontend findings HIGH-08, MED-08–MED-11, LOW-08–LOW-21. Those are **referenced by ID** below where they overlap, not duplicated. Every finding in *this* report has a new unique ID.

---

## Executive summary

The frontend is well above average for an internal tool: token-driven theming with a real dark mode, skeletons on nearly every route, Zod-validated search params on all filter routes, docs-exact TanStack Query integration, working route code-splitting, React Compiler active, and a polished public onboarding form. The problems are concentrated and fixable — nothing here suggests an architectural rewrite.

**20 open findings: 0 High, 4 Medium, 14 Low, 2 Info** (fixed items have been removed from this report).

| Severity | UI/UX | A11Y | Responsive | Perf | Data fetching | Routing | **Total** |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | 1 | 2 | 1 | 0 | 0 | 0 | **4** |
| 🔵 Low | 2 | 6 | 2 | 1 | 0 | 3 | **14** |
| ⚪ Info | 0 | 0 | 0 | 0 | 1 | 1 | **2** |

### The most important open findings

1. **MED-08 (prior, Medium)** — onboarding draft persists PII/bank data in plaintext localStorage with no expiry.
2. **A11Y-01 / A11Y-02 (Medium)** — table search is placeholder-only labeled with a 24px unlabeled clear button; sort state is invisible to screen readers (`aria-sort` unused repo-wide).
3. **RSP-01 (Medium)** — the cases table is ~1,570px wide with no sticky identifier column; row context is lost scrolling on mobile.

---

## How to read this report

- **Unique IDs, one per finding:** `UX-` (visual/layout/forms/tables/feedback/copy), `A11Y-` (accessibility), `RSP-` (responsive), `PERF-` (performance), `QRY-` (data fetching), `RTE-` (routing). IDs from the main report (`HIGH-08`, `MED-08`, …) are referenced, never redefined.
- **Severity rubric:** 🟠 High = ships broken UX, wastes significant resources, or blocks users · 🟡 Medium = degraded UX, real but bounded impact · 🔵 Low = polish, consistency, tech debt · ⚪ Info = noteworthy, no action strictly required.
- Each card: severity · file:line · what / impact / recommendation.

---

## 1. UI/UX findings

### 1.1 Visual design

**UX-01 — Dead utility classes on the public onboarding section nav** · 🟡 Medium
📍 `src/features/onboarding/onboarding-section-nav.tsx:81,119`
- **What:** The chip nav uses `scroll-fade-x scroll-fade-4` and the active section label uses `shimmer` — none of these classes are defined anywhere (`src/styles.css` has zero matches; repo-wide grep shows references only in this file).
- **Impact:** The intended horizontal-scroll fade affordance and active-step shimmer silently do nothing; on mobile users may not realize more sections exist beyond the visible chips.
- **Recommendation:** Implement the fade (mask-image gradient) and shimmer keyframes in `styles.css`, or remove the classes.

### 1.2 Forms

**UX-05 — Three different required-field marking conventions** · 🔵 Low
📍 `src/features/onboarding/merchant-onboarding-form.tsx:645` (`Submitter Email *` literal text) · `src/features/users/user-form.tsx:71-77` (`RequiredMark` component, `aria-hidden` red asterisk) · `src/features/onboarding/document-upload-field.tsx:89-101`, `resubmission-form.tsx:725-726,970-971` ("Required"/"Optional" Badges)
- **What:** Three visual languages for the same concept across forms.
- **Impact:** Inconsistent UX; the literal `*` is announced as "star" by screen readers (see A11Y-08).
- **Recommendation:** Standardize on one pattern — the Required/Optional badge is the most accessible; if `*` is kept it must be `aria-hidden` with a legend.

**UX-08 — Generic validation toast gives no field-level guidance** · 🔵 Low
📍 `src/features/onboarding/merchant-onboarding-form.tsx:234-241` (toast), `:342-358` (focus-to-first-invalid)
- **What:** `showValidationErrorsToast` always says "Please review the highlighted fields and try again." Combined with focus-to-first-invalid this is acceptable, but on a 7-section form the toast never names the count or section that failed.
- **Impact:** Users still have to hunt for the failing section.
- **Recommendation:** Include the failing field count and/or section name in the toast.

*Related (main report, not duplicated):* **MED-10** — resubmission form hand-rolls validation instead of reusing the shared Zod schemas (drift risk); **LOW-19** — set-password validates on submit only.

### 1.3 Accessibility

**A11Y-01 — Table search input is placeholder-only labeled; clear button has no accessible name and a 24px target** · 🟡 Medium
📍 `src/components/data-table/data-table-search.tsx:42-56` (input), `:61-70` (clear button)
- **What:** The search `InputGroupInput` has no `aria-label`/visible label — only a placeholder ("Search by case number or merchant name…") that disappears on typing. The clear button is `size-6` (24px) with only an `<XIcon />` and no `aria-label`.
- **Impact:** Screen-reader users get no input purpose; the clear control is undiscoverable and hard to hit.
- **Recommendation:** Add `aria-label="Search cases"` (per-table label) to the input; `aria-label="Clear search"` and a ≥32px target on the clear button.

**A11Y-02 — Sort state is not exposed to assistive tech** · 🟡 Medium
📍 `src/components/data-table/data-table-column-header.tsx:22-31`
- **What:** Sortable columns render a ghost `h-8` button with title + up/down icon, but `aria-sort` is unused repo-wide and the button carries no state label.
- **Impact:** Screen-reader users hear "Case Number, button" with no indication of current sort or direction.
- **Recommendation:** Put `aria-sort="ascending|descending|none"` on `TableHead` and add an `aria-label` like "Sort by case number, currently ascending".

**A11Y-03 — Faceted filter selections are invisible to screen readers** · 🔵 Low
📍 `src/components/data-table/data-table-filter.tsx:66-84`, styled via `src/styles.css:163-170`
- **What:** Filter options are plain `<button>`s with a CSS-only checkmark (`div[data-slot='data-table-filter-tick']`); no `aria-pressed`/`role="checkbox"`/`aria-checked`.
- **Impact:** SR users can't tell which filters are active.
- **Recommendation:** Add `aria-pressed={isSelected}` to the option buttons.

**A11Y-04 — Several icon-only controls are below comfortable touch targets** · 🔵 Low
📍 `data-table-search.tsx:65-70` (24px clear) · `document-upload-field.tsx:128-136` (28px remove) · `src/components/ui/dialog.tsx:70-80` (~20px visual close) · `src/features/notifications/notification-item.tsx:106-118` (24px mark-as-read)
- **What:** Button variants top out at `icon-lg` (40px); default `icon` is 36px (`button-variants.ts`), but several usages shrink below that.
- **Impact:** Hard-to-hit controls, especially on touch.
- **Recommendation:** Standardize icon buttons at ≥36–40px; enlarge the dialog close hit area with padding.

**A11Y-05 — "Mark as read" is hover-only visible, undiscoverable on touch** · 🔵 Low
📍 `src/features/notifications/notification-item.tsx:107`
- **What:** `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`. Touch devices have no hover, so the action is effectively invisible on mobile (it does have `aria-label="Mark as read"`, so it's keyboard/SR reachable).
- **Impact:** Mobile users can't discover the action visually.
- **Recommendation:** Show persistently on small screens (`max-md:opacity-100`) or move it into accessible item actions.

**A11Y-06 — No skip link in the app shell** · 🔵 Low
📍 `src/routes/_app.tsx` (repo-wide grep confirms no skip link)
- **What:** The sidebar nav renders before main content on every staff page; keyboard users tab through the entire nav (+ TeamSwitcher) on every page load.
- **Impact:** Keyboard navigation tax on every page.
- **Recommendation:** Add a visually-hidden-until-focused "Skip to main content" link targeting the content region.

**A11Y-07 — Field errors not programmatically associated with inputs** · 🔵 Low
📍 Onboarding / resubmission / user forms (only 5 `aria-describedby` usages exist repo-wide, all in case-detail renderers)
- **What:** `<FieldError role="alert">` renders as a sibling but inputs never get `aria-describedby` pointing at it. `role="alert"` announces on appearance, so impact is limited — but SR users reviewing a field later get no error association.
- **Impact:** Errors aren't re-discoverable per-field for SR users.
- **Recommendation:** Generate an error id per field and wire `aria-describedby`.

**A11Y-08 — Literal `*` in onboarding labels is announced as "star"** · 🔵 Low
📍 `src/features/onboarding/merchant-onboarding-form.tsx:645` (vs `aria-hidden` mark in `user-form.tsx`)
- **What:** `<FieldLabel>Submitter Email *</FieldLabel>` renders the asterisk as text; neither form provides a legend.
- **Impact:** Noisy SR announcements.
- **Recommendation:** Fold into UX-05's standardization: `aria-hidden` mark + legend.

*Related (main report):* **MED-09** — login password-visibility toggle unreachable via keyboard (`tabIndex={-1}`); **LOW-16** — hidden file input has no accessible label.

### 1.4 Responsive

**RSP-01 — Cases table is ~1,570px wide with no sticky key column on 360px screens** · 🟡 Medium
📍 `src/features/cases/cases-columns.tsx` (column widths ≈ 40+160+200+150+130+160+110+100+180+180+180), `src/components/data-table/data-table.tsx:135-140`
- **What:** Horizontal scrolling on mobile is handled correctly (`ScrollArea` + header scroll sync), but with no sticky checkbox/identifier column, row context (which case you're looking at) is lost mid-scroll.
- **Impact:** Mobile triage of case queues is disorienting.
- **Recommendation:** Make the select/identifier column sticky (`position: sticky; left: 0`), or reduce the column count on small screens.

**RSP-02 — Small touch targets on mobile controls** · 🔵 Low
📍 `src/features/dashboard/dashboard-charts.tsx:98-105` (`h-7` chart tabs, `text-xs`) · `src/features/onboarding/onboarding-section-nav.tsx:94-98` (`py-1.5` ≈ 30px chips)
- **Recommendation:** Bump interactive controls to ≥40px height on coarse pointers.

**RSP-03 — @xyflow canvas touch ergonomics** · 🔵 Low
📍 `src/features/configuration/workflow-builder/workflow-builder-panel.tsx:611-636`, `edges/flow-edge.tsx:115`, `nodes/queue-node.tsx:44-58`
- **What:** The builder stacks correctly on mobile (canvas `h-[60vh] min-h-[420px]`, inspector below) with `fitView` + zoom controls. But edge labels and node badges are `text-[10px]` and connection drag handles are mouse-sized — precise node-connecting is hard on touch.
- **Impact:** Flow editing is effectively desktop-only.
- **Recommendation:** Accept as desktop-first, but consider disabling edge creation on coarse pointers or enlarging handles via a CSS media query.

### What's done well (UI/UX)

- **Theme system:** token-driven oklch palette in `src/styles.css` with a thoughtfully adjusted dark variant (lighter brand teal for contrast); `next-themes` system/light/dark toggle in the header; view-transition theme changes respecting `prefers-reduced-motion`.
- **Loading states:** `pendingComponent` skeletons on nearly every staff route; the table skeleton mirrors real column widths.
- **Public onboarding form craft:** sticky scrollspy section nav with progress bar and per-section completion; draft autosave with "draft restored" toast; failed submit toasts + focuses the first `[aria-invalid]` field + `role="alert"` inline errors; `aria-invalid` red borders via theme tokens; submit spinner + disabled state + persistent error `Alert`; success screen with reference ID and next steps.
- **Shared `EmptyState`** with consistent title + hint + optional action and a `success` tone for inbox-zero.
- **Table engineering:** fixed-layout column alignment, 200px-rootMargin infinite-scroll sentinel, header scroll sync, `content-visibility-auto` rows.
- **Dialogs:** Base UI gives focus trapping + Escape for free; every `DialogContent` has a close button with `sr-only` "Close".
- **Notifications:** bell `aria-label` includes unread count; popover constrained with `max-w-[calc(100vw-2rem)]`; error/empty states handled.
- **Route errors:** `default-route-error.tsx` distinguishes 403 from generic errors with Retry + Dashboard escape hatch.

---

## 2. Performance findings

**PERF-05 — DataTable has no row memoization; column defs rebuilt per render** · 🔵 Low
📍 `src/components/data-table/data-table.tsx` (rows via `data.map`, no `memo`); `src/features/cases/cases-table-context.tsx:218` (`createCaseColumns(...)` per render, new `cell` closures)
- **What:** Any table state change (selection, fetching flags) re-runs all cell closures and reconciles all rows.
- **Impact:** Mitigated in practice — React Compiler **is** enabled and verified active (`vite.config.ts:11` `reactCompilerPreset()`; `useMemoCache` calls in built chunks), plus rows use `content-visibility-auto`. Risk returns only if the compiler bails out on heavier closures.
- **Recommendation:** No urgent action; if table interactions ever feel janky, add explicit `memo` on rows and `useMemo` around `createCaseColumns` rather than relying solely on the compiler.

### What's done well (performance)

- **Route code-splitting works:** every route chunk is a real dynamic `import()` from the entry; heavy `@xyflow/react` + `@dagrejs/dagre` correctly isolated in the lazy case-flow-rules chunk (259.7 kB / 83.4 kB gzip); per-component splits for select/combobox/tooltip.
- **Re-render safety:** React Compiler enabled *and* verified active in output; auth state via `useSyncExternalStore` (`auth-client.ts:57-61`), no context churn at root.
- **Table UX perf:** debounced (300 ms) local-state search — no per-keystroke refetch; `keepPreviousData` on infinite lists; stable infinite-query keys.
- **Bundle hygiene:** date-fns named ESM imports, no lodash/moment, single axios client, per-icon lucide chunks, zero third-party scripts, self-hosted font with `font-display: swap`.
- **SSE discipline:** exponential backoff that suspends while the tab is hidden (`notifications-sse.ts:24-47`).

---

## 3. Data-fetching findings (TanStack Query)

**QRY-04 — SPA mode: no SSR/dehydration by design** · ⚪ Info
📍 `vite.config.ts:9-11` (`tanstackStart({ spa: { enabled: true } })`)
- **What:** No `createServerFn`, no dehydration/hydration — loaders run client-side on navigation. Nothing breaks SSR because there is none.
- **Impact:** None — appropriate for an internal portal; the SSR audit dimension is N/A by design.

*Related (main report, not duplicated):* **LOW-08** — assign/priority mutations don't invalidate the open case-detail query; **LOW-20** — background refetch failures are silent.

### What's done well (data fetching)

- **Query key hygiene:** centralized key factories (`CASES_KEY`, `CASE_DETAIL_KEY`, `DASHBOARD_KEY`, …) and `queryOptions` helpers in `src/hooks/`; invalidation coverage thorough via `invalidateCaseWorkflowQueries` / `invalidateCaseDetailQueries` (`use-case-detail-query.ts:142-162`) — every audited mutation invalidates or surgically updates cache.
- **Loaders:** `ensureQueryData` everywhere, parallelized with `Promise.all` (e.g. `case-triggering.tsx:15-20`); case-detail preload fires comments/history/user-directory as non-blocking prefetches (`use-case-detail-query.ts:99-118`).
- **Optimistic updates with rollback:** merchant priority/terminate (`use-merchants-query.ts:231-278`: cancel, snapshot, `setQueryData`, `onError` restore, `onSettled` invalidate) and notification read states.
- **Prefetching:** `defaultPreload: 'intent'` (`src/router.tsx:16`) preloads route chunks + loaders on link hover; case rows use `Link`.
- **No 401 stampede:** token refresh deduplicated via `WeakMap` (`src/features/auth/session-refresh.ts:7`).
- **Every mutation has an `onError` → toast** (full scan of `src/hooks/`).

---

## 4. Routing findings (TanStack Router / Start)

**RTE-02 — User detail route: awaited loader but no `pendingComponent`** · 🔵 Low
📍 `src/routes/_app.user-management.users.$userId.tsx:15`
- **What:** `ensureQueryData` for user + queues is awaited, but no `pendingComponent` is set and no router-level `defaultPendingComponent` exists in `src/router.tsx`.
- **Impact:** Slow loads render a blank content area under the sidebar.
- **Recommendation:** Add `pendingComponent: UserFormSkeleton` (already used by the sibling `user-creation` route).

**RTE-03 — Set-password: awaited token-validation loader but no `pendingComponent`** · 🔵 Low
📍 `src/routes/set-password.$token.tsx:28`
- **What:** Loader validates the token via `fetchPasswordToken`; blank public page while it resolves.
- **Recommendation:** Add a small pending component (the route already imports `Spinner`).

**RTE-05 — Two redirect idioms: in-component `<Navigate>` vs `beforeLoad` redirect** · 🔵 Low
📍 `src/routes/_app.cases.index.tsx:8-10`, `_app.user-management.index.tsx:8-10` vs `_app.configuration.index.tsx`, `_app.merchants.$merchantId.index.tsx`
- **What:** Two index routes render `<Navigate to="..." replace />` in the component (render flash, runs post-mount); the other two use `beforeLoad: () => { throw redirect(...) }` — the codebase's own established pattern, redirecting before any render.
- **Impact:** Minor flash + inconsistency.
- **Recommendation:** Unify on `beforeLoad` + `throw redirect({ replace: true })`.

**RTE-07 — Zero `createLazyFileRoute` usage is fine (auto-splitting verified)** · ⚪ Info
📍 Repo-wide; extra split point at `src/hooks/use-case-detail-query.ts:107` (`import('#/features/cases/case-detail/queue-registry')`)
- **What:** No `route.lazy`/`lazyRouteComponent` anywhere. Not a violation: Start's bundler plugin auto-splits route files, all route components are module-private (the stated requirement), and the build confirms per-route lazy chunks.
- **Impact:** None — informational.

*Related (main report):* **LOW-18** — merchant detail route lacks `pendingComponent`; **LOW-21** — breadcrumb passes possibly-`undefined` `queueId`.

**Auth/redirect-loop assessment:** No loop risk. `_app` `beforeLoad` → `requireAuthSession` → on failure `redirect({ to: '/login', search: { redirect } })`; `login` `beforeLoad` only redirects *away* when authenticated, and `sanitizeRedirect(undefined)` returns `'/'`, never `/login`. Role guards redirect to `/` or `/cases/all-cases`, both guarded by the parent `_app` beforeLoad (runs top-down) — an unauthenticated user can never reach a role guard. Expired sessions: `isAuthenticated()` is presence-only (`auth-client.ts:51-53`), so expired tokens pass `beforeLoad` and surface as 401s in loaders, where the axios interceptor does single-flight refresh + transparent retry, and on terminal 401/403 clears auth and navigates to `/login`. Layered and sound.

### What's done well (routing)

- **Search-param hygiene is excellent:** Zod v4 schemas on every filterable list route + login; `stripSearchParams({ range: '30d' })` for clean dashboard URLs; login's `redirect` param sanitized against open redirects.
- **Auth architecture:** single parent `_app` `beforeLoad` gate for all staff routes; hierarchical role guards on `configuration`/`user-management`; layered expired-session handling.
- **Docs-exact Query integration:** `defaultPreloadStaleTime: 0` with `ensureQueryData`/`prefetchQuery` loaders is precisely the pattern the official data-loading guide prescribes for external caches.
- **Deliberate loader decisions documented in code:** `loaderDeps`-vs-keystroke comments on filter routes; intentional error-swallowing loader on the resubmit route.
- **Detail-route error/404 UX:** custom `errorComponent`s with `router.invalidate()` retry; `notFoundComponent`s with back-links; 404s from `ensureMerchantQuery`/`preloadCaseDetailPageQueries` resolve to the nearest parent `notFoundComponent`.
- **Canonical Start setup:** `createRootRouteWithContext` DI, `getRouter()`, `Register` augmentation, `HeadContent`/`Scripts`/`shellComponent`, `ClientOnly` + `lazy()` devtools.

---

## 5. TanStack Start docs compliance checklist

Docs checked against the official `tanstack.com/start` SPA-mode guide (fetched in full) and official `tanstack.com` Router docs excerpts / `tanstack/router` repo skill files for preloading, data-loading, not-found/errors, authenticated routes, and `stripSearchParams`. The quickstart, server-functions, router-options reference, and static-prerendering pages were **not** individually opened — anything about those is marked unverified. (`node_modules` was not installed, so the repo's AGENTS.md skill files were unavailable.)

| Practice | Status | Docs reference |
|---|---|---|
| SPA mode (`tanstackStart({ spa: { enabled: true } })`, `ssr: false` on `_app`, root `shellComponent` with `HeadContent`/`Scripts`) | ✅ OK | Start guide "SPA mode": shell prerender of root route, pending fallback in shell |
| No `createServerFn`; raw axios to external Hono backend | ✅ OK (no deviation) | SPA-mode guide: SPA "pairs very nicely with … server functions … or even other external APIs"; backend is separately hosted per repo AGENTS.md |
| Router options: `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 0`, `scrollRestoration: true`, `defaultErrorComponent`, context DI, `Wrap` + `QueryClientProvider`, `getRouter()` + `Register` augmentation | ✅ OK | Router Preloading guide ("simplest way … set defaultPreload to intent"); Data-loading guide: *"if you'd like to use an external cache like TanStack Query … set the defaultPreloadStaleTime option on the router to 0"* — exactly this repo's config |
| Search validation: Zod v4 schemas passed directly to `validateSearch` on all filter routes + login; `sanitizeRedirect` against open redirects; `stripSearchParams` on dashboard | ✅ OK | Router docs: "for Zod v4, use the schema directly"; `stripSearchParams` API doc — dashboard usage matches |
| Auth guards in `beforeLoad` + `throw redirect()` | ✅ OK | Router "Authenticated Routes" guide: gate UI in `beforeLoad`, `throw redirect()`; *"A route guard is not a data authorization boundary"* — this repo authorizes at the API, guards are UX-only ✓ |
| pending/error/notFound coverage | ⚠️ PARTIAL | RTE-02, RTE-03 (+ main-report LOW-18); not-found handling itself matches the Not-Found guide (root `notFoundComponent` + `throw notFound()` + nearest-parent `notFoundComponent`) |
| Path-param validation (`params.parse`) | ✅ OK | Route options API reference documents `params: { parse, stringify }` |
| Code splitting | ✅ OK (info RTE-07) | Official router code-splitting guidance: auto code-splitting via bundler plugin; route components must not be exported — complied with |
| Prerendering beyond the SPA shell | ℹ️ INFO — not configured | SPA-mode guide: *"it is recommended to prerender as much as you can in SPA mode"* — public routes (`/login`, `/onboarding-form`) are static-ish candidates; no `spa.prerender` options set |
| Streaming / Suspense | N/A | SPA mode — no server streaming; `Suspense` used only for devtools |
| Deprecated / legacy patterns | ✅ OK — none found | All `createFileRoute`, `getRouter()` present, no legacy `createRouter` singleton misuse |
| `pendingMs: 0`, no `pendingMinMs` tuning | ✅ OK (deliberate) | Docs defaults are 1000/500; `0` shows skeletons immediately — a valid, consistently applied UX choice |

**Net:** the TanStack integration is unusually docs-faithful. Remaining gaps are the partial pending coverage (RTE-02/03) and the unconfigured prerendering opportunity.

---

## 6. Prioritized action list

Effort hints: **S** = small (hours) · **M** = medium (~a day) · **L** = large (multi-day).

### P1 — Fix before scaling / shortly after launch

- [ ] **HIGH-08** (S, main report) — Repair `bun run lint` (typescript-eslint vs TS 7).
- [ ] **MED-08** (S, main report) — Stop persisting PII/bank fields in plaintext localStorage; add draft expiry.
- [ ] **UX-01** (S) — Implement or remove the dead `scroll-fade-x`/`shimmer` classes on the onboarding section nav.
- [ ] **A11Y-01** (S) — Label the table search input; accessible name + ≥32px target for the clear button.
- [ ] **A11Y-02** (S) — `aria-sort` on table headers + sort-state labels on sort buttons.
- [ ] **RSP-01** (S/M) — Sticky identifier column (or fewer columns) for tables on mobile.
- [ ] **RTE-02 / RTE-03** (S) — Add `pendingComponent` to user-detail and set-password routes.
- [ ] **MED-11** (S, main report) — 401 interceptor should reject with the original request's error.
- [ ] **LOW-18** (S, main report) — `pendingComponent` on the merchant detail route.

### P2 — Polish, hardening, tech debt

- [ ] **UX-05** (S) — Standardize required-field marking (badge pattern recommended).
- [ ] **UX-08** (S) — Name failing count/section in the validation toast.
- [ ] **A11Y-03** (S) — `aria-pressed` on filter options. **A11Y-04** (S) — icon buttons ≥36–40px. **A11Y-05** (S) — persistent "mark as read" on touch. **A11Y-06** (S) — skip link. **A11Y-07** (S) — `aria-describedby` for field errors. **A11Y-08** (S) — fold into UX-05.
- [ ] **RSP-02** (S) — ≥40px touch targets on mobile controls. **RSP-03** (S) — xyflow touch ergonomics (or declare desktop-first).
- [ ] **RTE-05** (S) — Unify index redirects on `beforeLoad` + `throw redirect()`.
- [ ] **PERF-05** (—) — no action unless tables feel janky.
- [ ] **MED-09 / LOW-16** (S, main report) — keyboard-reachable password toggle; label the hidden file input.
- [ ] **MED-10 / LOW-19** (S, main report) — reuse Zod schemas in resubmission form; validate set-password on blur/change.
- [ ] **LOW-08 / LOW-20** (S, main report) — invalidate case-detail on assign/priority; surface background refetch errors.
- [ ] **LOW-09 / LOW-14 / LOW-15** (S, main report) — dedupe error extraction; align API/hook layering; single API-URL source of truth.
- [ ] Consider SPA prerendering for `/login` and `/onboarding-form` (docs recommend prerendering what you can in SPA mode).

---

## Appendix A — Bundle breakdown (production build, client)

Entry `index-*.js` is the `<script src>` in `_shell.html` — downloaded on **every** page, including `/login`.

| Chunk | Raw kB | Gzip kB | Notes |
|---|---|---|---|
| `index-*.js` **(entry)** | 1,033.6 | **302.1** | react, router, query, **recharts + full Dashboard feature** (pre-fix snapshot; charts are now a lazy chunk) |
| `_app.configuration.case-flow-rules-*.js` (lazy) | 259.7 | 83.4 | @xyflow/react + @dagrejs/dagre ✓ correctly isolated |
| `schemas-*.js` | 88.4 | 25.0 | shared Zod schemas |
| `_app-*.js` (lazy) | 82.8 | 25.9 | staff layout shell |
| `useForm-*.js` | 63.5 | 15.6 | TanStack Form |
| `usePositioner-*.js` | 60.0 | 21.9 | floating-ui (Base UI) |
| `api-client-*.js` | 51.4 | 19.3 | axios + interceptors |
| `dist-*.js` ×2 (vendor shared) | 32.6 / 37.3 | 10.8 / 10.6 | — |
| `select-*`, `combobox-*`, `tooltip-*`, … | 12–30 | 4–10 | per-component splits ✓ |
| route chunks (`_app.merchants.index-*`, `_app.cases.*`, …) | 0.3–25 | 0.3–8.7 | all lazy via `import()` ✓ |
| **Total JS** | **2,474** | **805** | 154 chunks |
| `styles-*.css` | 157.3 | 25.3 | Tailwind |

Note: the earlier review's 1,465 kB / 310.9 kB gzip figure was the **server** build's `router-*.js`; what browsers download is the client entry above — same problem, current number verified.

## Appendix B — Route inventory (41 routes)

`loader`: ✓a = awaited · ✓f = fire-and-forget · – = none. `beforeLoad`: auth / roles / redir.

| Route | loader | pending | error | notFound | validateSearch | beforeLoad | lazy* |
|---|---|---|---|---|---|---|---|
| `__root.tsx` (shell, `notFoundComponent`) | – | – | – | ✓ | – | – | – |
| `_app.tsx` (staff layout, `ssr:false`) | – | – | – | – | – | auth | ✓ chunk |
| `_app.index.tsx` (dashboard) | ✓a | ✓ | – | – | ✓ | – | ✓ |
| `_app.cases.tsx` (pathless) | – | – | – | – | – | – | – |
| `_app.cases.index.tsx` | – | – | – | – | – | – | ✓ |
| `_app.cases.all-cases.tsx` | ✓f | ✓† | – | – | ✓ | – | ✓ |
| `_app.cases.my-open-cases.tsx` | ✓f | ✓† | – | – | ✓ | – | ✓ |
| `_app.cases.my-closed-cases.tsx` | ✓f | ✓† | – | – | ✓ | – | ✓ |
| `_app.cases.work-queue-cases.tsx` | ✓f | ✓† | – | – | ✓ | roles+redir | ✓ |
| `_app.cases.$caseId.tsx` | ✓a | ✓ | ✓ | ✓ | – | – | ✓ |
| `_app.merchants.tsx` (pathless) | – | – | – | – | – | – | – |
| `_app.merchants.index.tsx` | ✓f | ✓† | – | – | ✓ | – | ✓ |
| `_app.merchants.$merchantId.tsx` | ✓a | ✗ (LOW-18) | ✓ | ✓ | – | – | ✓ |
| `_app.merchants.$merchantId.index.tsx` | – | – | – | – | – | redir | ✓ |
| `_app.merchants.$merchantId.{overview,form,history,limits}.tsx` | ✓a | ✓ | –¹ | –¹ | – | – | ✓ |
| `_app.configuration.tsx` (pathless) | – | – | – | – | – | roles | – |
| `_app.configuration.index.tsx` | – | – | – | – | – | redir | ✓ |
| `_app.configuration.{11 panels}.tsx` | ✓a | ✓ | – | – | – | – | ✓ |
| `_app.user-management.tsx` (pathless) | – | – | – | – | – | roles | – |
| `_app.user-management.index.tsx` | – | – | – | – | – | – | ✓ |
| `_app.user-management.all-users.tsx` | ✓f | ✓† | – | – | ✓ | – | ✓ |
| `_app.user-management.user-creation.tsx` | ✓f | ✓† | – | – | – | – | ✓ |
| `_app.user-management.users.$userId.tsx` | ✓a | ✗ (RTE-02) | – | – | – | – | ✓ |
| `login.tsx` | – | – | – | – | ✓ | auth bounce | ✓ |
| `onboarding-form.tsx` (pathless) | – | – | – | – | – | – | – |
| `onboarding-form.index.tsx` | – | – | – | – | – | – | ✓ |
| `onboarding-form.resubmit.$token.tsx` | ✓ (swallows errors by design) | –² | –² | – | – | – | ✓ |
| `set-password.$token.tsx` | ✓a | ✗ (RTE-03) | ✓ | ✓ | – | – | ✓ |

\* All route components are module-private → Start's bundler plugin auto-splits (RTE-07); every route ships as its own lazy chunk.
† `pendingComponent` configured but never renders because the loader is fire-and-forget (kept deliberately so filter typing never blocks).
¹ Sub-tabs rely on the parent `$merchantId` error/notFound boundary (`ensureMerchantQuery` throws `notFound()`) — correct per docs.
² Resubmit route handles pending/error inline (`useQuery` + `Spinner` + `TokenErrorScreen`) — documented in a code comment.

---

*End of report. All analysis was read-only; no code was modified, committed, or pushed. No screenshots were captured (no headless Chromium available in this environment).*
