# 08 — Merchant Limits and MDR

## At a glance

| | |
|---|---|
| **What it is** | The smallest and largest amounts a merchant may transact in one collection (money in) or disbursement (money out) — separately for testing and for live trading — and the commission percentage AssanPay charges (MDR, merchant discount rate). |
| **Who can use it** | Any signed-in employee can view a merchant's limits and rates on its MDR and limits tab. The **global** limits screen is `super_admin` or `admin` only. Changing anything needs `super_admin` or `admin`. Merchants never see this portal's limits screen, but the global limits are copied into the MID Creation and Live Activation emails sent to the merchant (see "Where the numbers reach people" below). |
| **Where it lives** | Merchant detail page, tab "MDR and limits" (`/merchants/$merchantId/limits`) · Global values in Configuration → Limits & MDR |
| **Main API** | `GET /api/merchants/:id/limits-mdr` · `PATCH /api/merchants/:id/limits-mdr` · `DELETE /api/merchants/:id/limits-mdr` (revert to global) · `GET`/`PUT /api/configuration/limits-and-mdr` (global) |
| **Main code** | Frontend: `src/features/merchants/merchant-limits-mdr-tab.tsx` · Backend: `src/modules/merchants/merchants.service.ts` (`getMerchantLimitsBundle`, `updateMerchantLimitsMdr`, `resetMerchantLimitsMdr`), `src/modules/configuration/configuration.service.ts` |
| **Success looks like** | A merchant uses the global values unless staff deliberately set an override for it — and anyone looking at the tab can tell at a glance which one applies. |

## How it works — the journey

```
Global limits + rates set once in Configuration (defaults below until changed)
        ↓
New merchant automatically uses the global values (limitsMdrOverride is null)
        ↓
Super admin / admin edits the numbers on the merchant's "MDR and limits" tab
        → whole set saved as one override on that merchant only
        ↓
That merchant's effective values = the override, not the global values
        ↓
"Revert to global" deletes the override → merchant uses global values again
```

There are two layers: **global** limits and rates, set once in Configuration and applying to every merchant; and an optional **per-merchant override**, set on one merchant's detail page, which replaces the global values for that merchant only.

## Who can use it

| Action | Who |
|---|---|
| **Viewing** | Any signed-in employee can open the limits tab on a merchant's detail page (`GET /api/merchants/:id/limits-mdr` uses `requireAuth` only). The global limits screen and `GET /api/configuration/limits-and-mdr` are `super_admin` / `admin` only: an agent gets 403 there. Agents can view a merchant's tab but cannot change anything on it. |
| **Changing a per-merchant override** | `super_admin` or `admin` only — `PATCH /api/merchants/:id/limits-mdr` and `DELETE /api/merchants/:id/limits-mdr` (revert to global) both require one of those two roles. Agents get 403. |
| **Changing the global limits** | `super_admin` or `admin` only, on the Configuration → Limits & MDR screen (see file 25 for the configuration side; the values and rules are described here because this file owns the meaning of the numbers). |
| **Merchants** | Never see the portal's limits or MDR screens. But they do receive the **global** limits in the MID Creation email (testing limits) and the Live Activation email (live limits), so the numbers do reach merchants by email. (The MID Creation email gets the testing limits; see "Where the numbers reach people".) No merchant-facing page shows them in the code reviewed. |

## The steps

| Step | What happens |
|---|---|
| 1. Global set | The global limits and rates are set in Configuration → Limits & MDR. Until anyone changes them, the built-in defaults apply (see the table below). |
| 2. New merchant | A new merchant automatically uses the global values. Nothing is stored on the merchant at first — its `limitsMdrOverride` is null. |
| 3. View | On the merchant's detail page, tab "MDR and limits", staff see two groups — **Testing** and **Live** — each with collection minimum/maximum and disbursement minimum/maximum, plus the four rates. The page shows which group is active (live if the merchant's status is `live`, otherwise testing) and whether the merchant has an override ("isOverridden"). |
| 4. Override | A super admin or admin edits the numbers and clicks "Save override". The whole set (both groups and all four rates) is saved as one override on the merchant (`limitsMdrOverride`, a JSON object). From then on, that merchant's **effective** limits and rates are the override, not the global values. The "Save override" button stays disabled until a value differs from what is shown. (The API response does carry the `global` values, but the tab does not display them side by side; see the frontend section.) |
| 5. Revert | To undo an override, staff choose "Revert to global" (with a confirmation dialog: "Revert to global limits? … The global configuration applies instead."). The override is deleted (set to null) and the merchant immediately uses the global values again. |
| 6. Where they are used | The merchant overview shows the effective limits/MDR summary. The MID Creation workflow saves the payment/payout methods chosen for the merchant (see below). The limits themselves are copied into the merchant emails and the MID case view, and **those copies always use the global values, not the merchant's override** (see "Where the numbers reach people" below). The Testing step records a `testing_limits_applied` history entry with fixed text, not the configured numbers (`testing-case.service.ts`). What the portal does **not** do in the code reviewed is enforce these limits on real payments — there is no payment-processing code in this portal. |

## Global defaults

`defaultLimitsAndMdrSettings` in `backend/src/modules/configuration/configuration.service.ts`:

| | Collection min | Collection max | Disbursement min | Disbursement max |
|---|---|---|---|---|
| Testing | 10 | 100 | 1,000 | 50,000 |
| Live | 100 | 50,000 | 1,000 | 50,000 |

| Rate | Default (%) |
|---|---|
| eWallets | 2.5 |
| Card (default) | 3 |
| Card (Shopify) | 3.5 |
| Payout | 0 |

The global values are stored as one row in `configuration_settings` under the key `limits-and-mdr` (`LIMITS_AND_MDR_KEY`, `backend/src/modules/configuration/configuration.service.ts`) and read by `getLimitsAndMdrSettings()`. If no row exists, the defaults above are returned. **If the stored row fails validation, the defaults are returned silently** (`readSetting()` falls back to the fallback value with no error or log). A bad global save therefore shows up as the built-in numbers, not as an error. No currency is attached to the numbers in the schema reviewed — the merchant's currency (`merchants.currency`, column default `'PKR'` in `backend/src/db/schema.ts`) is the implied currency; see the questions below.

## The shape of the numbers

| Group | Fields |
|---|---|
| `testing` | `{ collectionMin, collectionMax, disbursementMin, disbursementMax }` |
| `live` | `{ collectionMin, collectionMax, disbursementMin, disbursementMax }` |
| `rates` | `{ eWallets, cardDefault, cardShopify, payout }` |

| Rule | Detail |
|---|---|
| Limits | All limit numbers must be ≥ 0. |
| Rates | All rates must be 0–100. |
| Max ≥ min | Each maximum must be ≥ its minimum. The **per-merchant** schema (`limitRangeSchema`, applied to `testing` and `live` separately) has two refinements per group, for collection and for disbursement, with the messages "Collection maximum must be greater than or equal to the minimum." and "Disbursement maximum must be greater than or equal to the minimum." The **global** schema has four refinements on the whole object (testing collection, testing disbursement, live collection, live disbursement), with messages such as "Testing collection max must be greater than or equal to min." |
| Upper bounds | Limit amounts have no upper cap in either schema (only `min(0)`). Only the rates have a maximum (100). |
| Numeric strings | The schemas use `z.coerce.number()`, so numeric strings are accepted. |
| Unknown keys | The global schema is a `strictObject`, so unknown keys are rejected. The per-merchant schema is a plain `z.object`, so unknown keys are stripped. |

The per-merchant schema is `merchantLimitsMdrSchema` in `backend/src/modules/merchants/merchants.schemas.ts`; the global schema is `limitsAndMdrSettingsSchema` in `backend/src/modules/configuration/configuration.schemas.ts`. They have the same shape, but the rules above differ.

## Endpoints

| Endpoint | Roles | What it does |
|---|---|---|
| `GET /api/merchants/:id/limits-mdr` | All roles | Returns `{ merchant: { id, status, currency }, limitsAndMdr, paymentMethods, payoutMethods }`. |
| `PATCH /api/merchants/:id/limits-mdr` | super_admin, admin | Validates against `merchantLimitsMdrSchema`, sets the override, returns `{ id, limitsAndMdr: value }`; 404 if the merchant does not exist or is soft-deleted. |
| `DELETE /api/merchants/:id/limits-mdr` | super_admin, admin | Sets the override to null and returns the global values. |
| `GET` / `PUT /api/configuration/limits-and-mdr` | super_admin, admin | Global values (see file 25). The GET is covered by the `requireRoles('super_admin', 'admin')` guard that `configuration.routes.ts` applies to every route after `/email-sending-mode`, so an agent gets 403. |

Per-merchant routes live in `backend/src/modules/merchants/merchants.routes.ts`. The `PATCH` and `DELETE` use `requireRoles('super_admin', 'admin')`, and the `GET` uses only `requireAuth` (all roles).

## How the effective values are worked out

| Piece | Detail |
|---|---|
| **Per-merchant override** | `merchants.limitsMdrOverride` is a `jsonb` column (`backend/src/db/schema.ts`). `updateMerchantLimitsMdr()` (`backend/src/modules/merchants/merchants.service.ts`) validates the input against `merchantLimitsMdrSchema`, sets the column, and returns `{ id, limitsAndMdr: value }`; 404 if the merchant does not exist or is soft-deleted. `resetMerchantLimitsMdr()` sets the column to null and returns the global values. Note: the update does **not** refuse terminated merchants in the code reviewed — it only checks that the merchant exists and is not soft-deleted. Whether that is intended is an open question (see file 32). |
| **Effective values** | `getMerchantLimitsBundle()` in `merchants.service.ts` loads the global limits, the global payment/payout methods, and the latest methods saved for the merchant by MID Creation (`getLatestMidCreationMethods()`), then parses the override with `resolveLimitsMdrOverride()` (an override that fails validation is treated as no override — it is ignored, not an error). It returns: `limitsAndMdr: { effective, override, global, isOverridden }` where `effective = override ?? global`; `paymentMethods` = the merchant's saved methods, or the global ones if none were saved; `payoutMethods` = likewise. The overview endpoint returns the same bundle's `effective` value and `isOverridden` flag. |
| **Where the global numbers are read** | `getLimitsAndMdrSettings()` is called by the MID case view and its emails, the Live Activation email, the case-communications service, the case-query service (MID case detail `midConfiguration.limitsAndMdr`), and the merchant limits service (`merchants.service.ts`). The configuration service also calls it at `backend/src/modules/configuration/configuration.service.ts` (around lines 216–292) only as a fallback when a stored payment/payout method list does not parse: legacy entries take their min/max from the global testing/live ranges and their rate from `cardDefault`, `eWallets` (by label containing "card") or `payout`. This is a legacy-data fallback, not a per-case calculation. |
| **Where the numbers reach people** | The MID Creation email (`backend/src/modules/email/templates/mid-creation.tsx`) prints the testing limits (`testingLimits`, a "Testing limits · per transaction" section). The caller also passes a `payoutRate` value, which has no matching prop in that template (`rates.payout` is the declared prop), so whether a payout rate is printed was not confirmed. The Live Activation email (`backend/src/modules/email/templates/live-activation.tsx`) prints the live limits. Both are filled from `getLimitsAndMdrSettings()` in `mid-case.service.ts`, `case-communications.service.ts` and `live-case.service.ts`. **So the merchant's per-merchant override never reaches these emails**: merchants receive the global numbers even when an override applies. The MID case detail (`case-query.service.ts`, `midConfiguration.limitsAndMdr`) shows the same global values. |
| **Testing history entry** | The Testing step writes a `testing_limits_applied` history row (`backend/src/modules/cases/testing-case.service.ts`, around line 74) with **fixed** `details`: `{ collection: '10-100', disbursement: '1000-50,000' }`. These are hard-coded strings, not the configured values. That entry is also the source of the merchant's "Testing started" milestone (see file 07). |
| **Enforcement** | No enforcement against live payment traffic exists in this codebase. The limits are stored and sent to staff and merchants, and nothing in the portal checks a transaction against them. |

## Frontend — how the tab is built

| Piece | What it does |
|---|---|
| **Merchant tab** | `frontend/src/features/merchants/merchant-limits-mdr-tab.tsx` — the "MDR and limits" tab (`frontend/src/routes/_app.merchants.$merchantId.limits.tsx`). It shows the Testing and Live groups (collection min/max, disbursement min/max) and the rates (e-wallets, card default, card Shopify, payout). The client-side `validate()` checks only that the **disbursement** maximum is at or above its minimum (message "Enter a maximum at or above the minimum.", keys `testing.disbursementMax` / `live.disbursementMax`), and that each rate is between 0 and 100 (message "Enter a rate between 0 and 100.", keys `rates.<key>`). Collection min/max is **not** checked on the frontend, so a bad collection range is only caught by the backend's 400. The form is seeded from `detail.limitsAndMdr.effective`, so an agent or admin who has no override sees the global values as the starting point. The active group is `live` when `detail.merchant.status === 'live'`, otherwise `testing`. The tab shows the effective values and an "isOverridden" state; it does not show the global values side by side. When `detail.limitsAndMdr.isOverridden` is true (and the user can edit) it offers "Revert to global" behind an `AlertDialog` titled "Revert to global limits?" ("This removes the custom limits and MDR saved for this merchant. The global configuration applies instead."). Users who cannot edit (agents) see "You do not have permission to edit limits and MDR." in place of the buttons. The `canEdit` flag is `super_admin` or `admin` (`_app.merchants.$merchantId.limits.tsx`). It also shows the merchant's payment methods and payout methods (from the MID Creation step, or the global methods if none were saved for the merchant). |
| **Configuration screen** | `frontend/src/features/configuration/panels/limits-and-mdr-panel.tsx` — the global editor (see file 25). |
| **API calls** | `frontend/src/apis/merchants.ts`: `fetchMerchantLimits()` (`GET /api/merchants/:id/limits-mdr`), `updateMerchantLimitsMdr(merchantId, input)` (PATCH), `resetMerchantLimitsMdr(merchantId)` (DELETE). The configuration API is in `frontend/src/apis/configuration.ts` (`getLimitsAndMdrSettings` / update — see file 25). |
| **Schemas** | `frontend/src/schemas/merchants.schema.ts` (`merchantLimitsMdrSchema`) and `frontend/src/schemas/configuration.schema.ts` mirror the backend schema above. |

## Data, validation and edge cases

- **An override is all-or-nothing.** The override is one JSON object containing both groups and all four rates. There is no way to override only the live collection maximum, or only the card rate — saving any change saves the complete set, starting from whatever the form was filled with. If the form is opened for a merchant with no override, it is filled from the global values. The "Save override" button is disabled until the form differs from the effective values (`!isDirty`), so an unchanged form cannot be saved, and an override identical to global cannot be created by clicking Save with no edits.
- **Global changes do not touch overridden merchants.** Changing the global limits affects every merchant without an override immediately (they have no stored copy — the effective value is computed at read time). Merchants with an override are unaffected, silently. There is no warning in the code reviewed when a global change leaves overridden merchants behind.
- **Invalid stored overrides are silently ignored.** If a `limitsMdrOverride` value in the database fails schema validation, `resolveLimitsMdrOverride()` returns null and the merchant falls back to global with no error. That can hide a bad write.
- **Invalid stored global settings are silently replaced by the defaults.** The same applies to the global `limits-and-mdr` row: `readSetting()` returns the built-in defaults (the table above) if the stored value does not parse. Nothing in the screens says the defaults are in use.
- **Override and reset ignore terminated status.** `PATCH` and `DELETE /api/merchants/:id/limits-mdr` only check that the merchant exists and is not soft-deleted (`updateMerchantLimitsMdr()` and `resetMerchantLimitsMdr()`), so they work on terminated merchants (see the open question below).
- **Emails and the MID view use the global values, not the override.** Changing a merchant's override changes its overview and limits tab, but not the numbers in the MID Creation or Live Activation emails or the MID case detail (see "Where the numbers reach people"). If a merchant has an override, the email it receives can show different numbers from the ones staff see on the merchant's tab.
- **Numbers have no currency label.** The limits are plain numbers; the merchant's `currency` (default `PKR`) is returned next to them but is not part of the limits schema. A merchant whose currency is not PKR would still be shown the same numbers, with no conversion or warning. The emails print the numbers with `toLocaleString()` and no currency code.
- **Rates are percentages, 0–100.** A rate of 0 is allowed (the payout default is 0). A rate above 100 is rejected. There is no check that the card-Shopify rate is higher than the card-default rate, or any other relationship between the rates — only that each is in range and each max ≥ its min.
- **The frontend and backend agree on the shape but validate in two places.** The tab checks only the disbursement maximum against its minimum (and rates 0–100) before sending; collection maximum against minimum is checked only by the backend's Zod schema, which re-validates everything. A request sent by any other client gets the backend's 400.
- **Not found in the code reviewed:** a history of who changed a merchant's limits or the global limits, or what the previous values were; an approval step for limit changes; any link between the limits and the estimated monthly volume the merchant declared on the form; any scheduled review or expiry of an override.

## What to check — is this what you intended?

- [ ] Are the default numbers right — testing collections 10–100, live collections 100–50,000, disbursements 1,000–50,000, and rates 2.5% / 3% / 3.5% / 0%? In which currency are the limits?
- [ ] Should a per-merchant override be all-or-nothing, or should staff be able to override a single number (for example, just the live collection maximum) and inherit the rest from global?
- [ ] When global limits change, should merchants with overrides be flagged, or should they stay on their override silently?
- [ ] Should changing a merchant's limits need a second person's approval, and should the old values be kept in history?
- [ ] The payout rate defaults to 0%. Is that correct — are payouts really free — or is that a placeholder that was never set?
- [ ] Can limits be changed on a terminated merchant today (the backend does not refuse it)? Should it refuse, the way priority changes do?
- [ ] The MID Creation and Live Activation emails print the **global** limits, not the merchant's override. Is that intended? If a merchant has an override, which numbers should the merchant be told?
- [ ] Agents can see each merchant's limits but not the global limits screen. Is that the intent?
- [ ] The Testing step records fixed text ("10-100" and "1000-50,000") instead of the configured numbers. Should it record the numbers in force at that time?

---
*Sources: `backend/src/modules/email/templates/mid-creation.tsx`, `backend/src/modules/email/templates/live-activation.tsx`, `backend/src/modules/cases/mid-case.service.ts`, `backend/src/modules/cases/live-case.service.ts`, `backend/src/modules/cases/testing-case.service.ts`, `backend/src/modules/cases/case-communications.service.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/configuration/configuration.routes.ts`, `backend/src/db/schema.ts`, `frontend/src/features/merchants/merchant-limits-mdr-tab.tsx`, `frontend/src/routes/_app.merchants.$merchantId.limits.tsx`, `frontend/src/features/configuration/panels/limits-and-mdr-panel.tsx`, `frontend/src/apis/merchants.ts`, `frontend/src/apis/configuration.ts`, `frontend/src/schemas/merchants.schema.ts`, `frontend/src/schemas/configuration.schema.ts`, `backend/src/modules/merchants/merchants.schemas.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchants.routes.ts`, `backend/src/modules/configuration/configuration.schemas.ts`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/db/schema.ts`. Related files: 07 (merchants list and detail), 16 (MID Creation), 17 (Testing), 25 (configuration — limits and methods).*
