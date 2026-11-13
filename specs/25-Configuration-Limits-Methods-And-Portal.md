# 25 — Configuration: Limits, Methods And Portal

## At a glance

| | |
|---|---|
| **What it is** | The pricing and merchant-portal half of Configuration. It holds the numbers that appear in the emails merchants receive and in the limits staff confirm during Testing and Live cases. |
| **Who can use it** | `super_admin` and `admin` only, for viewing and editing. Merchants never see this configuration directly — they see its effects. |
| **Where it lives** | Configuration → Limits & MDR (`/configuration/limits-and-mdr`) · Payment Methods (`/configuration/payment-methods`) · Payout Methods (`/configuration/payout-methods`) · Portal & Support (`/configuration/merchant-portal`) |
| **What it stores** | Four settings, each one row in the `configuration_settings` table, stored as JSON. One row per setting. There is no separate table per setting, and no history of past values — saving overwrites the previous value. |
| **Main API** | `GET` / `PUT /api/configuration/limits-and-mdr`, `/payment-methods`, `/payout-methods`, `/merchant-portal`, plus `GET /api/configuration` (overview) |
| **Main code** | Frontend: `src/features/configuration/panels/limits-and-mdr-panel.tsx`, `method-list-panel.tsx`, `payment-methods-panel.tsx`, `payout-methods-panel.tsx`, `merchant-portal-panel.tsx` · Backend: `src/modules/configuration/configuration.service.ts` + `configuration.schemas.ts` + `configuration.routes.ts` |
| **Success looks like** | An admin saves new numbers, and the new values are used from then on in the Testing and Live case screens and in the MID Creation and Live Activation emails. |

## The four settings

| Setting | What it holds |
|---|---|
| **Limits & MDR** | The default per-transaction limits (testing and live, collection and disbursement) and the commission (MDR) rates. MDR is the commission rate — the percentage the merchant pays on transactions. |
| **Payment Methods** | The collection methods a merchant can be enabled for (for example e-wallets and cards), each with its own testing/live limits and commission rate. Collection means money coming in. |
| **Payout Methods** | The same, for paying money out (disbursement). |
| **Portal & Support** | The merchant portal login URL, server details, office address, WhatsApp support number, and support/legal email addresses. The login URL, server details and office / legal details are inserted into emails (see step 4 under Portal & Support). The WhatsApp support number and the support email are stored but not used by any email or workflow in the code reviewed. |

## How it works — the journey

```
Admin opens a Configuration page
        ↓
Page reads the current setting (GET)
        ↓
Admin edits the numbers / methods / fields and saves (PUT, whole setting at once)
        ↓
Backend validates (max ≥ min, rates 0–100, URLs and emails valid)
        ↓
Value overwrites the previous one in configuration_settings (no history kept)
        ↓
New values are used from then on in case screens and emails
```

## Who can use it

| Who | What they can do |
|---|---|
| `super_admin`, `admin` | View and edit all four settings. Every route below is behind `requireRoles('super_admin', 'admin')` in `backend/src/modules/configuration/configuration.routes.ts`, after the two public-to-staff read exceptions noted below. |
| Any authenticated user | Read `GET /api/configuration/email-sending-mode` (case workflows need it), and `GET /api/configuration/sub-merchants` (id and name only; see file 26). Everything else in this file is admin-only in the routes file as reviewed. |
| Staff working a case | Read the same settings through these endpoints to display limits and to build emails. |
| Merchants | Never see this configuration directly. They see its effects: the limits in their MID and Live emails, and the portal URL they log in at. |

## Limits & MDR — the numbers

### How it works

1. An admin opens **Configuration → Limits & MDR** (`/configuration/limits-and-mdr`).
2. The page shows two groups of limits — **Testing** and **Live** — each with a collection (money in) minimum and maximum and a disbursement (money out) minimum and maximum, all in PKR; plus four rates: e-wallets, card (default), card (Shopify) and payout.
3. The admin edits the numbers and saves. The backend validates that every maximum is greater than or equal to its minimum, and that every rate is between 0 and 100.
4. The new values are used from then on: in the Testing and Live case screens, in the MID Creation and Live Activation emails, and as the fallback limits for any payment/payout method that was saved before per-method limits existed (the legacy migration in `configuration.service.ts`).

### Defaults — used when nothing has ever been saved

Defaults live in `defaultLimitsAndMdrSettings` in `configuration.service.ts`.

| | Collection min | Collection max | Disbursement min | Disbursement max |
|---|---|---|---|---|
| **Testing** | 10 | 100 | 1000 | 50000 |
| **Live** | 100 | 50000 | 1000 | 50000 |

| Rate | Default |
|---|---|
| E-wallets | `2.5` |
| Card (default) | `3` |
| Card (Shopify) | `3.5` |
| Payout | `0` |

All rates are percentages, validated 0–100.

### Validation rules

| Rule | Detail |
|---|---|
| All eight limit numbers | Must be ≥ 0 (coerced to number). |
| Each `max >= min` | Four separate refinements, with messages such as "Testing collection max must be greater than or equal to min." |
| Rates | 0–100. |
| Equal min and max | Allowed — the schema allows `min` and `max` to be equal, and allows 0. Limit fields are coerced with `z.coerce.number()`, so a numeric string is accepted. |
| Messages on the wrong side | The `max >= min` refinements point at `testing.collectionMax` etc. (the field path), and the message names the side ("Testing", "Live") and the kind ("collection" / "disbursement"). The method-level max error reads "Maximum must be greater than or equal to minimum." |
| Schema | `limitsAndMdrSettingsSchema`, a strict object, in `configuration.schemas.ts`. |

## Payment Methods and Payout Methods

### How it works

1. An admin opens **Configuration → Payment Methods** (`/configuration/payment-methods`) or **Payout Methods** (`/configuration/payout-methods`).
2. Each method has: an `id`, a `label` (the name staff and merchants see), a `testing` range (`min`, `max`), a `live` range (`min`, `max`), and a `commissionRate` (0–100).
3. The admin adds, edits, reorders or removes methods and saves the whole list at once (`PUT` with the full array — there is no add-one / edit-one endpoint).
4. The methods appear in the MID Creation and Live emails as one row per method in the saved list, showing that method's limit range only (the templates do not print the commission rate; `case-communication-helpers.ts`, `mid-creation.tsx`, `live-activation.tsx`). The current format has no per-method enable flag (`methodIdentitySchema` is only `id` and `label`, plus the limits and rate). When a merchant has no payout methods, the email shows a single "Disbursement" row using the configured testing (MID) or live (Live) disbursement min/max. No rate is shown. The catalogue note that mentions a "payout rate" is not what the template prints.
5. **Legacy note:** very old saved methods used a combined format with `collectionEnabled` / `disbursementEnabled` flags. The backend still migrates that format on read (`readPaymentMethodSetting`, `configuration.service.ts`): it splits the old list into payment and payout lists using the configured limits as fallbacks. Details from the code: a legacy entry with no `label` or no enabled flag for that side is dropped; the old `key` field is used as the id when there is no `id`; the commission rate falls back to the payout rate for payouts, the card default rate for labels containing "card", and the e-wallet rate otherwise. If the payout setting has never been saved, the payout read falls back to the payment-methods row, but only when that row actually has legacy markers (`collectionEnabled`, `disbursementEnabled` or `key`). If the migrated list still does not validate, the read returns `[]` (no error). New saves always use the current per-method format.

### Validation rules

| Rule | Detail |
|---|---|
| At most 50 methods | The array holds at most 50 methods. |
| Each method's `max >= min` | Applies to both the `testing` and the `live` range. |
| Labels must be unique | Case-insensitive, after trimming. Error: `400 "Method names must be unique."`. |
| `id` and `label` length | At most 80 characters; trimmed, 1–80 characters. |
| `commissionRate` | 0–100. |
| Schema | `paymentMethodSettingsSchema` / `payoutMethodSettingsSchema`. The two schemas are identical in shape — the difference is only which setting key they are saved under. |

> ⚠️ **No per-merchant limits in this configuration.** These are global defaults. Per-merchant limit/MDR overrides live on the merchant record (migration `0032_merchant_limits_mdr_override.sql`, `merchant-limits-mdr-tab.tsx`) and are covered by the merchant specs, not this file. Do not confuse the two: changing a global default does not change a merchant that has an override, and the code reviewed does not state whether a global change re-applies to merchants without an override beyond the fallback behaviour on read.

> ⚠️ **Empty method lists are valid:** the defaults are `[]`. An empty payout list is what triggers the single "Disbursement" fallback row in the emails.

## Portal & Support

### How it works

1. An admin opens **Configuration → Portal & Support** (`/configuration/merchant-portal`).
2. The fields are listed in the table below.
3. Saving validates as listed in the table below.
4. These values are used in the emails: the portal login URL in the MID Creation and Live emails; the server base URL and callback IP in the MID email's server-integration section (custom-website merchants only); the office address and legal email in the Agreement email. The WhatsApp support number and the support email are not referenced by any email, case or other workflow in the code reviewed (only the config panel and schema use them). **Prerequisite:** the Agreement email send is refused with `400` until both the office address and the legal email are saved ("Configure the office address before sending the Agreement email." / "Configure the legal email before sending the Agreement email."; `agreement-case.service.ts`, `case-communications.service.ts`). Empty values elsewhere are allowed.

### Fields and rules

| Field | Rule |
|---|---|
| `loginUrl` | The merchant portal login page. Required. Must be a valid web URL, max 2048 characters. Error: "Enter a valid http or https URL." (only `http`/`https` protocols). |
| `serverBaseUrl` | Must be empty or a valid web URL, max 2048 characters. Error: "Enter a valid server base URL." |
| `serverCallbackIp` | Must be empty or a valid IPv4/IPv6 address, max 45 characters. An IP address is the numeric address of a server on the internet. IPv4 and IPv6 are the two address formats. Error: "Enter a valid IPv4 or IPv6 address." |
| `officeAddress` | Max 1000 characters. |
| `whatsappSupportNumber` | Digits only, max 32 characters. Error: "WhatsApp support number must contain numbers only." The frontend also strips non-digits as the user types. |
| `supportEmail` | Must be empty or a valid email, max 320 characters. Error: "Enter a valid support email." |
| `legalEmail` | Must be empty or a valid email, max 320 characters. Error: "Enter a valid legal email." |

Schema: `merchantPortalSettingsSchema`, a strict object (`configuration.schemas.ts`). `loginUrl` is required and must be a URL; the other fields default to `''`. Values are trimmed before checks.

### Defaults

Defaults live in `defaultMerchantPortalSettings`:

| Field | Default |
|---|---|
| `loginUrl` | `https://merchant.assanpay.com/login` |
| Every other field | Empty (`''`) |

> ⚠️ **Self-healing read (it is a write on GET):** `getMerchantPortalSettings` runs on every read. If the stored value is missing, does not parse, or differs from the parsed value in any field, it writes the parsed value (or the defaults) back to `configuration_settings`. So a `GET /api/configuration/merchant-portal` on a fresh database creates the row, and a stored value that fails validation is replaced by the defaults without any log or error. The override is silent.

## Endpoints

Prefix `/api/configuration`. All admin-only as above, except where noted.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/configuration/limits-and-mdr` | Read Limits & MDR. |
| `PUT` | `/api/configuration/limits-and-mdr` | Save Limits & MDR. |
| `GET` | `/api/configuration/payment-methods` | Read payment methods. |
| `PUT` | `/api/configuration/payment-methods` | Save the whole payment-methods list. |
| `GET` | `/api/configuration/payout-methods` | Read payout methods. |
| `PUT` | `/api/configuration/payout-methods` | Save the whole payout-methods list. |
| `GET` | `/api/configuration/merchant-portal` | Read Portal & Support. |
| `PUT` | `/api/configuration/merchant-portal` | Save Portal & Support. |
| `GET` | `/api/configuration/email-sending-mode` | Read `{ autoEnabled, manualEnabled }`. Open to **any authenticated user** (declared before the admin guard in `configuration.routes.ts`). |
| `PUT` | `/api/configuration/email-sending-mode` | Save the sending mode (admin). Validation in the Email sending section of file 23. |
| `GET` / `PUT` | `/api/configuration/email-recipients` | Read / save the CC, BCC and reply-to settings (admin). Validation in file 23. |
| `GET` | `/api/configuration/email-templates/:key` | Read-only rendered template preview (admin). Unknown key → `404 "Email template not found."`. See file 23. |
| `GET` | `/api/configuration/sub-merchants` | Any authenticated user: `[{ id, name }]` only. See file 26. |
| `…/case-flow…` | Case-flow builder endpoints (`GET`/`PUT /case-flow`, `…/versions/:versionId`, `…/case-flow/merchant-move…`) | Admin. Not part of these four settings: see file 21. |
| `GET` | `/api/configuration` | Overview — returns all of these together (`limitsAndMdr`, `emailSendingMode`, `merchantPortal`, `paymentMethods`, `payoutMethods`, `agreementDrafts`, `subMerchants`, `businessTypes`) for pages that need several settings at once. |

## How it is implemented — Frontend

| Piece | File |
|---|---|
| Routes | `/configuration/limits-and-mdr` → `limits-and-mdr-panel.tsx` · `/configuration/payment-methods` → `payment-methods-panel.tsx` · `/configuration/payout-methods` → `payout-methods-panel.tsx` · `/configuration/merchant-portal` → `merchant-portal-panel.tsx` — all under `frontend/src/routes/_app.configuration.*.tsx`, all restricted by the Configuration nav item to `super_admin` / `admin`. |
| Panels | `frontend/src/features/configuration/panels/limits-and-mdr-panel.tsx` · `method-list-panel.tsx` (shared list editor used by the payment and payout panels) · `payment-methods-panel.tsx`, `payout-methods-panel.tsx` · `merchant-portal-panel.tsx` (fields for login URL, server base URL, office address, WhatsApp number — digits only, stripped of non-digits on input — support email and legal email) |
| Shared helpers | `configuration-panel-shared.tsx`, `configuration-panel-utils.ts` |
| API | `frontend/src/apis/configuration.ts`: `fetchLimitsAndMdr` / `updateLimitsAndMdr` (via the `updateLimitsAndMdrSettings` mutation in `use-configuration-query.ts`) · `fetchPaymentMethods` / `updatePaymentMethods` · `fetchPayoutMethods` / `updatePayoutMethods` · `fetchMerchantPortal` / `updateMerchantPortal` |
| Hooks | `frontend/src/hooks/use-configuration-query.ts` |
| Schemas | `frontend/src/schemas/configuration.schema.ts` |

## How it is implemented — Backend

| Piece | File / detail |
|---|---|
| Service | `backend/src/modules/configuration/configuration.service.ts` — `getLimitsAndMdrSettings`, `updateLimitsAndMdrSettings`, `getPaymentMethodSettings`, `updatePaymentMethodSettings`, `getPayoutMethodSettings`, `updatePayoutMethodSettings`, `getMerchantPortalSettings`, `updateMerchantPortalSettings`, `getConfigurationOverview`, `readSetting`, `writeSetting`, `readPaymentMethodSetting`. |
| Schemas | `backend/src/modules/configuration/configuration.schemas.ts` — `limitsAndMdrSettingsSchema`, `paymentMethodSettingsSchema`, `payoutMethodSettingsSchema`, `merchantPortalSettingsSchema`. |
| Routes | `backend/src/modules/configuration/configuration.routes.ts` (prefix `/api/configuration`, all admin-only as above). |
| Storage keys | In `configuration_settings` (`configuration.service.ts`): `limits-and-mdr`, `payment-methods`, `payout-methods`, `merchant-portal`. `writeSetting` is an upsert on `key`, stamping `updatedAt`. An upsert means insert if the key is new, update if it already exists. |
| Consumers | The Live service reads `getLimitsAndMdrSettings()` for the live email and the Live Limits card; the MID service reads the same settings plus the payment/payout methods for the credentials email. The portal settings are read the same way for the MID, Agreement and Live emails. |

## Data, validation and edge cases

| Topic | Detail |
|---|---|
| **`configuration_settings` table** | `key` (varchar 120, primary key), `value` (JSONB, not null), `updatedAt`. There is no `createdAt`, no `updatedBy`, and no audit trail of who changed a value or what it was before. JSONB is a database type that stores structured data as JSON. |
| **Stale or corrupt stored values** | For limits, email settings and the method lists, `readSetting` returns the default silently when the stored value does not parse (the row is left alone). For the merchant portal the bad row is also overwritten (see the self-healing note above). Either way, a bad save that reached the database would be masked rather than reported. |
| **Where the numbers surface** | The Testing case's "limits applied" step and the Live case's "limits applied" step show these numbers; the MID and Live emails print them per method. Changing a limit after an email has been sent does not change the sent email, and the history text of a Live limits confirmation is hard-coded (see file 19) rather than taken from this setting. |
| **Link expiry windows are fixed** | "Link expiry windows are fixed; they are no longer configurable." (`configuration.service.ts`): password reset 24 hours, new-password set 72 hours (`LINK_DEADLINE_HOURS`). Do not look for a setting for these — there is not one. |

## Request and response — technical

| Item | Detail |
|---|---|
| Request shape | `PUT` sends the whole setting at once — the full limits object, or the full methods array. There is no add-one / edit-one endpoint for methods. |
| Response shape | `GET` returns the stored setting (or the default when nothing has ever been saved); `PUT` returns the saved setting. The overview `GET /api/configuration` returns all settings together. |
| Error codes | Validation failures return `400` with the first error message (for example "Testing collection max must be greater than or equal to min."). A non-admin caller gets `403 "Insufficient permissions."` (`requireRoles`, `middleware/rbac.ts`). Schema failures on PUT come from Zod and are returned as `400` with the first issue's message (`middleware/error-handler.ts`). A stored value that fails to parse does not error — the read falls back to the default silently. |

## What happens next — business rules

- After an admin saves new limits or rates, the new values are used from then on in the Testing and Live case screens and in the MID Creation and Live Activation emails.
- Changing a limit after an email has been sent does not change the sent email.
- Changing a global default does not change a merchant that has its own per-merchant override (see the warning in "Payment Methods and Payout Methods").
- After an admin uploads a new portal URL or support contact, the next MID, Agreement or Live email uses the new value; emails already sent keep the old value.
- There is no approval step and no history: saving overwrites the previous value immediately, and the only record of the change is the `updatedAt` timestamp — there is no audit trail of who changed a value or what it was before.

## What to check — is this what you intended?

- [ ] **Defaults:** are the default limits and rates (Testing 10–100, Live 100–50000, disbursement 1000–50000; e-wallets 2.5%, card 3%, card Shopify 3.5%, payout 0%) still the numbers you want, or have they changed?
- [ ] **Retroactive changes:** should changing a global limit or rate apply to merchants already in progress, or only to new merchants? And should it ever overwrite a merchant's own override?
- [ ] **Audit trail:** the portal settings have no record of who changed them or when (apart from `updatedAt`). Do you want an audit trail for pricing and portal changes?
- [ ] **Portal URL:** is `https://merchant.assanpay.com/login` still the correct merchant portal login URL, and are the server base URL / callback IP still needed in the MID email?
- [ ] **Support contacts:** the WhatsApp support number and the support email are saved but not printed in any email or shown in any case flow (the legal email and office address are used by the Agreement email). Should they be inserted into an email or shown to merchants, or removed from the panel?
- [ ] **Whole-list saves:** payment and payout methods are saved as one whole list. Is that fine, or do you want to add, edit or remove a single method without re-saving everything?
- [ ] **Link expiry:** password link expiry (reset 24 hours, new password 72 hours) is fixed in code and "no longer configurable". Should it become configurable again?

---
*Sources: `frontend/src/routes/_app.configuration.*.tsx`, `frontend/src/features/configuration/panels/limits-and-mdr-panel.tsx`, `frontend/src/features/configuration/panels/method-list-panel.tsx`, `frontend/src/features/configuration/panels/payment-methods-panel.tsx`, `frontend/src/features/configuration/panels/payout-methods-panel.tsx`, `frontend/src/features/configuration/panels/merchant-portal-panel.tsx`, `frontend/src/features/configuration/panels/configuration-panel-shared.tsx`, `frontend/src/features/configuration/panels/configuration-panel-utils.ts`, `frontend/src/apis/configuration.ts`, `frontend/src/hooks/use-configuration-query.ts`, `frontend/src/schemas/configuration.schema.ts`, `frontend/src/features/configuration/email-templates-layout.tsx`, `frontend/src/config/navigation.ts`, `backend/src/middleware/rbac.ts`, `backend/src/middleware/error-handler.ts`, `backend/src/lib/validators.ts`, `backend/src/modules/configuration/configuration.service.ts`, `backend/src/modules/configuration/configuration.schemas.ts`, `backend/src/modules/configuration/configuration.routes.ts`. Related files: 19 (Live Activation), 21 (case-flow engine), 30 (database).*
