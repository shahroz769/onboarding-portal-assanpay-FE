# Frontend Review Report — onboarding-portal-assanpay-FE

Scope: code review plus live browser testing of the TanStack Start app against the real backend on PostgreSQL 19 (beta 3), including a run against a 100k-case dataset. Categories: bugs, UI/UX, security, performance.

Test scripts are in `qa/` (see `qa/README.md`). They are test-only. The backend and database setup are described in the BE repo's `report.md`.

## How this was tested

- `bun run typecheck` passes. No production build was run, per `CLAUDE.md`, so SSR and hydration results are from the dev server only.
- **Click crawlers** (`qa/ui/crawl*.mjs`): each opens every route for a role and clicks every visible button, link, tab, menu item, checkbox and combobox, plus one level inside menus and dialogs. Destructive confirmations (delete, terminate, send, save, assign and similar) are skipped by design, so those were tested through the targeted flows below. Sidebar and header controls were clicked once per role, not on every page.
  - **Super Admin:** 18 route patterns, 659 clicks.
  - **Restricted agent (`agentdr`, works one queue):** 23 routes, **626 clicks**.
  - **View-only agent (`agentview`, no work queues):** 23 routes, **548 clicks**.
  - **Result across all three: 0 uncaught page errors, 0 5xx responses, 0 error boundaries, 0 unexplained click failures.** The only 4xx was the intentional 404 page.
  - The `admin1` crawl was started and stopped early; Admin was covered by the role check below rather than a full crawl.
- **The 62 click timeouts from the first crawl were re-verified individually** (38 distinct controls): 20 click fine on a fresh page (crawler artefacts caused by an overlay left open by the previous click), 4 are legitimately disabled (`Send Credentials` before limits are applied, the registration-date picker, a row checkbox, `Copy MIDs` with nothing pending), and the other 14 (five email-template variable chips, the chatter `Post update` button, six file chips and generic `BUTTON`/`INPUT` entries) were tested directly: all five chips click, `Post update` posts, and the file links open. The second and third crawlers add scroll-into-view, an overlay reset and one retry, and logged **0 failures**.
- **Role-specific checks** (`ui-roles.mjs` and the agent crawls):
  - Both agent roles see only Dashboard, Merchants and Cases in the sidebar. Admin and Super Admin also see User Management and Configuration.
  - Navigating directly to `/user-management` or any `/configuration/*` page as an agent redirects to the dashboard (9 pages each).
  - The view-only agent has no "Work Queue Cases" entry, and opening it directly redirects to All Cases.
  - The merchant Limits tab has 0 editable inputs and no Save/Reset for agents, versus 5 inputs and a Save button for admins. The merchant row "Terminate" action appears only for Admin and Super Admin.
- **Configuration editors were exercised through the UI with real saves, and each result was checked against the API** (`ui-config.mjs`, `ui-config2.mjs`): every check passed except the one real finding (F6, non-http login URLs). Four other initial "failures" were test mistakes, each re-verified: two used an expired token when reading the API back (the values had saved), the WhatsApp field strips `+` instead of showing an error, and choosing a `.exe` for an agreement leaves Upload disabled instead of showing a toast.
  - Payment and payout methods: empty submit, commission 150, testing min > max, valid add, duplicate name (case-insensitive), edit, delete with cancel, and confirmed delete. Saved values matched what was typed.
  - Merchant portal: invalid URL, bad IP, non-digit WhatsApp, valid save, persistence after reload.
  - Email sending: the mode switches (the last enabled mode cannot be switched off), invalid CC, duplicate CC in a different case, an address in both CC and BCC, and saving a CC (persisted).
  - Queues: SLA of 0, 8761, -3 and 1.5 keep Save disabled, and 48 saves.
  - Sub-merchants: empty add, a `.exe` file, valid add, duplicate name, rename.
  - Agreements: upload persisted; a `.exe` chosen through the file input leaves Upload disabled and is not saved.
  - Case-flow builder: Publish is disabled when unchanged, Discard reverts without creating a version, and Publish created version 3.
- **Other targeted flows:** public onboarding form (empty submit, full valid submission with 6 uploads, double-click submit), create user, invite link, set-password, login with the created username, trigger-case dialog, case detail as an agent (tabs, take ownership, comments, closing rules), and chatter posting.
- **Responsive check:** every route above, plus merchant detail tabs, the public form and login, at **390 px and 768 px**. No horizontal page overflow on any.
- **Performance** against the 100k-case, 50k-merchant database (see below).
- Not covered: a production build, other browsers, keyboard-only navigation and screen readers. The Sub-merchant "remove file" control, agreement upload for six of seven business types, the workflow builder's node-level edits, and the email template editors (they are preview-only) were not saved through the UI. The `admin1` role was not fully crawled (see above). `eslint` could not run (see F3).

## Summary

| Severity | Count |
|---|---|
| Medium | 6 |
| Low / Info | 12 |

No high-severity frontend issue was found. The worst user-visible problems originate in the backend (see the BE report: username case, status bypass, 500 on over-long input).

## Medium

### F1. Public onboarding page fails to hydrate (dev)
- **Where:** `src/routes/onboarding-form.index.tsx`.
- **Observed:** opening `/onboarding-form` logs a React hydration error on every load. The server emitted a `<Suspense>` and the client rendered `<main className="min-h-svh …">`, so React discards the server HTML and re-renders on the client.
- **Impact:** the first page a merchant sees loses its SSR benefit and can flash.
- **Caveat:** dev server only; confirm on a production build.
- **Suggested check:** compare the raw HTML from `curl localhost:5173/onboarding-form` with the client DOM, then make the first render deterministic or set `ssr: false` on this route. The cause was not bisected.

### F2. A successful submission leaves the merchant's personal data in localStorage
- **Where:** `src/features/onboarding/merchant-onboarding-form.tsx:126-162`, plus the removal calls at `:399` and `:543`.
- **Reproduced:** after a fully successful submit (success screen shown, reference ID issued), `localStorage["assanpay:merchant-onboarding-draft"]` still held the submitted email, owner name, phone numbers and business details. The form's own comments say it is cleared on submit; the debounced autosave apparently writes it back after the clear.
- **Impact:** on a shared or kiosk machine, the next visitor gets the previous merchant's data restored into the form ("Your draft was restored"). There is no expiry.
- **Fix:** cancel the pending debounced save on submit and clear after it, add a TTL, and add an explicit "clear draft" control.

### F3. Lint tooling is broken, so lint cannot gate changes
- **Observed:** `bun run lint` crashes: `TypeError: Cannot read properties of undefined (reading 'Cjs')` in `@typescript-eslint/typescript-estree`. `package.json` pins `typescript` to `7.0.2`, which the installed typescript-eslint does not support.
- `prettier --check src` also flags 8 files. There is no CI workflow for the FE.
- **Fix:** upgrade typescript-eslint or pin a supported TypeScript, run `prettier --write`, and add a lint/typecheck job.

### F4. FE validation is weaker than, and drifts from, the API contract
- **Where:** `src/schemas/merchant-onboarding.schema.ts:105-133`, `src/schemas/users.schema.ts:136`.
- **Problems:**
  - Required text fields use `.min(1)` with no `.trim()`, so `"   "` passes the client and is rejected by the server. The user sees only the server's first-issue message.
  - No `max` lengths or numeric bounds, so long text or huge numbers reach the server and return a **500** (BE report M4).
  - `businessWebsite` says "include https://", but the server accepts bare domains and non-http schemes.
  - Usernames are not lower-cased, so an admin can create `UiCreated`, who then **cannot log in with that username** (BE report H1, reproduced through the UI end to end).
- **Fix:** share or mirror the server schema and map server field errors onto the form.

### F5. Time zones are shown inconsistently on the same case page
- **Where:** these files hard-code `timeZone: 'Asia/Karachi'`: `case-side-panel.tsx:1223`, `rejection-rounds-card.tsx:563`, `agreement-rounds-card.tsx:413`, `case-chatter.tsx:733`, `case-history-timeline.tsx:1087`, `documents-review-renderer.tsx:988`, `sub-merchants-panel.tsx:593`. `case-detail-shell.tsx:223` (SLA created/deadline), the merchant Journey card and the table columns use the **browser** zone.
- **Reproduced:** with the browser in UTC, one case page showed "Created at 6:46 PM" and "Round 1 Resubmitted 11:47 PM" for events about a minute apart.
- **Fix:** one formatting helper with an explicit, labelled zone.

### F6. Merchant portal settings accept non-http(s) login URLs in the UI
- **Where:** `src/features/configuration/panels/merchant-portal-panel.tsx` (login URL and server base URL fields).
- **Reproduced:** `javascript:alert(1)` and `ftp://x.example.com` leave **Save changes enabled**, and the API accepts them (BE report M7). A bare `not a url` is correctly blocked. The WhatsApp field correctly strips non-digits.
- **Impact:** that login URL is written into the credentials email sent to merchants.
- **Fix:** validate `http:`/`https:` in the client schema too.

## Low / Info

- **F7. Open-redirect hardening.** `sanitizeRedirect` (`src/features/auth/redirect.ts`) allows `/\host`, which browsers read as `//host`. `navigate({href})` probably keeps it same-origin. Reject backslashes.
- **F8. SSE reconnect.** `notifications-sse.ts`: after a 401 followed by a successful refresh, `connect()` recurses immediately with no delay, which could loop if the server keeps rejecting. Each tab also opens its own stream, and the server never closes it on session revocation (BE report M3).
- **F9. Login errors are toast-only.** `login-form.tsx:91` shows a transient toast. The failure is not tied to the fields and screen readers may miss it. The 429 lockout message needs the same treatment.
- **F10. Mobile case detail.** At 390 px the stage stepper text overlaps ("Working" over "Awaiting Merchant") and the breadcrumb collapses to "Docu…".
- **F11. Wide tables clip columns without a scroll cue.** At 1440 px the cases table cuts "Creation Date" and the users table cuts "Cases".
- **F12. Empty states.** "End of results" is centred in a large empty panel when there are few rows. "Add sub-merchants in configuration before selecting one." is shown in error red to agents who cannot access configuration.
- **F13. Public rate-limit copy.** When the shared public limit trips, the resubmission page shows "Unable to load resubmission / Too many public requests", which reads like a broken link. Add a retry hint.
- **F14. Case closing controls are enabled before they can succeed.** "Mark as successful" is enabled with nothing done; clicking it returns a clear toast ("Select at least one sub-merchant…"), so this is not a bug, but the button could be disabled with an explanation. (The FE correctly disables "Close as unsuccessful" for a whitespace-only reason, which the API alone does not.)
- **F15. Limits & MDR page is read-only.** `/configuration/limits-and-mdr` shows method limits and rates but has no control for the global testing/live limits and rate values that `PUT /api/configuration/limits-and-mdr` accepts. Confirm whether that is intended.
- **F16. Comments on the case chatter** are unpaginated on the server (BE report M11). A case with thousands of comments will download and render all of them.
- **F17. Dev-only:** the TanStack Devtools button overlaps the bottom-right corner of every screen. Make sure it is excluded from production.
- **F18. Email template variable chips give no feedback.** Clicking `{{merchantName}}` and the other four chips does nothing visible (no toast, no copy confirmation). The page text says "click to scroll to it"; consider a visible highlight.

## Performance (UI, 100k cases / 50k merchants, dev server)

- Dashboard data loaded and rendered in about 2.0 s.
- The cases table showed its first rows in about 3.3 s (dev build, cold), rendering 10 rows initially.
- Five infinite-scroll pages took about 3.7 s in total and grew the table to 181 rows with about 6,100 DOM nodes and about 184 MB JS heap. Rows are not virtualised, so memory grows linearly with pages loaded.
- Merchants and user-management tables became visible in about 2.7 s and 2.1 s.
- Case search over 100k cases costs 250-525 ms on the server, and 1-5 s under 20 concurrent users (BE report M10). Debounce is in place.
- These are dev-server numbers (unminified, on-demand compile), so real production load times should be better. A production Lighthouse-style run was not done.

## What held up well

- **XSS:** no `dangerouslySetInnerHTML` outside shadcn's `chart.tsx`. Untrusted values (comment text with `<b>` / `<script>`, business names, website URLs) render as text. React 19 blocks `javascript:` hrefs.
- **Outbound links:** every `target="_blank"` link sets `rel="noreferrer"`.
- **Token handling:**
  - The access token lives in memory and the refresh token in an HttpOnly cookie.
  - Concurrent refreshes are deduplicated, and multi-tab refresh is serialised with Web Locks plus a BroadcastChannel.
  - A terminal 401 clears the session and redirects with a sanitised `redirect`.
- **Route guards:** `/configuration` and `/user-management` are guarded by role. Unauthenticated visits redirect to login.
- **Forms:**
  - Public form: an empty submit shows 49 field messages; a full submission with six uploads reached the success screen with a reference ID; **double-clicking Submit sent exactly one request**.
  - Create user: validation shows on empty submit and the dialog closes on success with a toast.
  - Set-password: a mismatch shows an error and success redirects to login.
  - The trigger-case submit stays disabled until the form is complete.
- **Public pages:** invalid set-password and resubmission links show clear messages, and the unknown route shows a proper 404.
- **Responsive:** zero horizontal overflow on any tested route at 390 px and 768 px.
- **Accessibility spot-check:** icon-only buttons carry `sr-only` labels plus tooltips. There are no `<img>` without `alt`, no `console.log`, no `any` casts, and one `eslint-disable`.
- **Data loading:** query `staleTime`s are sensible, and there is no polling.
- **Console:** only the expected 401s on login and refresh. No React warnings on any authenticated page.
