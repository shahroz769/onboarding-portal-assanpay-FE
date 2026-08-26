# Composition patterns — fix queue

Todo-only Vercel composition gaps for `onboarding-portal-assanpay-FE`. Sorted by what to land first.

Say **fix 08** (original gap number), not “fix order 1”, unless you mean the next item in this list.

**15 todo** · 4 High · 11 Medium

## Ordering rule

Architecture before state before patterns before React 19 `use()`.

Inside architecture: kill booleans in a file before splitting it; change a shared primitive before the page that sits on it. Reshape context (#33, #32) before the leftover `use()` sweep (#34).

## Waves

### 1–2 · Case side panel (High)

1. **#08** strategy map, then **#09** compound shell. One file; booleans first so `PrimaryAction` does not still take 12 flags.

### 3–4 · Tables (High)

2. **#11** DataTable pieces, then **#10** UsersTable like merchants/cases. Grid should compose Empty/Skeleton, not `isLoading`.

### 5–7 · Shared UI (Medium)

3. Dialog/Sheet/Command close, Combobox slots, sidebar `{state, actions, meta}`.

### 8–10 · Cases table + remaining context (Medium)

4. Hide-filter flags, draft context reshape, then `use()` on leftover consumers (chart).

### 11–15 · Feature variants (Medium)

5. Editable fields, embedded chatter/history, commission picker, then render-prop panels last.

---

## Queue

| Do | Orig | Sev | Skill | Gap | Where | Fix | Why this slot |
| ---: | ---: | --- | --- | --- | --- | --- | --- |
| 1 | 08 | High | `architecture-avoid-boolean-props` | `getPrimaryActionCopy` and the side panel branch on ~12 queue-type booleans. | `src/features/cases/case-detail/case-side-panel.tsx` | Strategy map keyed by queue workflow type, or per-workflow side-panel variants. | Same file as #9. Kill the boolean matrix before splitting the tree, or the compound pieces still take `isAgreementCase`. |
| 2 | 09 | High | `architecture-compound-components` | One monolith owns primary CTA, rejection/agreement extras, and modals via flags. | `src/features/cases/case-detail/case-side-panel.tsx` | Compound shell (Provider + PrimaryAction + QueueExtras) or split per workflow. | Depends on #8. After copy is keyed by workflow, extras/modals compose without flag soup. |
| 3 | 11 | High | `architecture-compound-components` | DataTable loading/infinite state is flag-driven (`isLoading`, `isFetchingMore`, `hasMore`). | `src/components/data-table/data-table.tsx` | Compose Header/Body/Empty/InfiniteSentinel instead of boolean modes. | Shared primitive under merchants, cases, and users. Change the API before splitting UsersTable Grid. |
| 4 | 10 | High | `architecture-compound-components` | `UsersTableComposed` owns query, selection, bulk actions, toolbar, grid, and dialogs in one tree. | `src/features/users/users-table.tsx` | Match MerchantsTable/CasesTable: Provider + Toolbar/BulkActions/Grid/Dialogs with `{state, actions, meta}`. | After #11 so the new Grid composes skeleton/empty/rows instead of passing `isLoading` flags. |
| 5 | 35 | Medium | `architecture-avoid-boolean-props` | Dialog/Sheet/Command expose `showCloseButton` instead of composing DialogClose. | `dialog.tsx`, `sheet.tsx`, `command.tsx` | Always compose close as a child; drop the flag. | Widest blast radius of the medium items — almost every modal in the app. |
| 6 | 36 | Medium | `architecture-avoid-boolean-props` | ComboboxInput/Chip use `showTrigger`, `showClear`, `showRemove`. | `src/components/ui/combobox.tsx` | Compose ComboboxTrigger / ComboboxClear / ChipRemove as children. | Same primitive pattern as #35; fewer call sites than dialogs, still shared. |
| 7 | 33 | Medium | `state-context-interface` | SidebarContext is flat (`open`, `setOpen`, `isMobile`) and uses `React.useContext`. | `src/components/ui/sidebar.tsx` | Reshape to `{state, actions, meta}`; switch `useSidebar` to `use()`. | Shell context used on every authenticated page. Reshape before the generic `use()` sweep (#34). |
| 8 | 29 | Medium | `architecture-avoid-boolean-props` | Cases table hides owner/status filters with `hideOwnerFilter` / `hideStatusFilter`. | `cases-table-context.tsx`, my-open-cases, my-closed-cases | Compose a toolbar without those filter children per route. | Same compose-the-toolbar idea as UsersTable (#10). Cases already have a provider; drop the hide* flags there. |
| 9 | 32 | Medium | `state-context-interface` | Draft context is a flat bag of fields/setters via `useContext`, not `{state, actions, meta}`. | `documents-review-draft-context.tsx` | Reshape to `{state, actions, meta}` and consume with `use()`. | Reshape the remaining feature context before switching remaining `useContext` calls (#34). |
| 10 | 34 | Medium | `react19-no-forwardref` / `use()` | Draft, sidebar, and chart contexts still use `useContext`. App is React 19.2; merchants/cases tables already use `use()`. | `documents-review-draft-context.tsx`, `sidebar.tsx`, `chart.tsx` | Switch consumers to `use(context)`. No `forwardRef` found — keep ref-as-prop. | After #33 and #32 so you are not converting a flat bag then immediately reshaping it. Leftover is mainly `chart.tsx`. |
| 11 | 28 | Medium | `patterns-explicit-variants` | ReadOnlyReviewField / document rows take `isEditable` instead of split components. | `documents-review-renderer.tsx` | EditableReviewField vs ReadOnlyReviewField (and matching document rows). | Feature-local variants. Independent of table/dialog primitives. |
| 12 | 37 | Medium | `patterns-explicit-variants` | CaseChatter and CaseHistoryTimeline take `embedded?: boolean`. | `case-chatter.tsx`, `case-history-timeline.tsx` | Explicit page vs embedded variant components. | Same variant pattern as #28, smaller surface (two components). |
| 13 | 38 | Medium | `patterns-explicit-variants` | Method picker uses `showCommission` / `selectionDisabled` booleans. | `merchant-id-renderer.tsx` | MethodPicker vs MethodPickerWithCommission, or compose commission as children. | One renderer; no shared primitive. After the document/chatter variants. |
| 14 | 30 | Medium | `patterns-children-over-render-props` | MethodListPanel uses `renderMethodDetails` instead of children/slots. | `configuration-panel-shared.tsx`, payment-methods-panel, payout-methods-panel | Accept children or `MethodListPanel.Details` and compose fields at call sites. | Config-only. Children-over-render-props is lower priority than architecture/state skills. |
| 15 | 31 | Medium | `patterns-children-over-render-props` | EmailModeChoice takes `autoContent` / `manualContent` / `whatsappContent`. | `src/components/case-email/email-mode-choice.tsx` | Compound tabs: `EmailModeChoice.Auto` / `.Manual` / `.WhatsApp` as children. | Same skill as #30, fewer call sites. Last because it does not unblock anything else. |

## Ids (for search)

`side-panel-bools` · `side-panel-compound` · `data-table-flags` · `users-table` · `show-close` · `combobox-show` · `sidebar-context` · `hide-filters` · `draft-context-shape` · `use-vs-usecontext` · `docs-editable` · `embedded-variants` · `commission-flag` · `method-render-prop` · `email-mode-slots`
