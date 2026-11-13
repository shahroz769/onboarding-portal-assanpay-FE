# 09 — Merchant Termination and Deletion

## At a glance

| | |
|---|---|
| **What it is** | How a merchant leaves the portal — in three different strengths that are easy to confuse and must not be: terminate, soft delete, and permanent delete. Plus a separate step to delete the merchant's Google Drive files. |
| **Who can use it** | Terminate: super admin and admin. Delete Drive files, soft delete, and permanent delete: super admin only. Agent: none of these actions. |
| **Where it lives** | The merchants table and the merchant detail page (terminate and delete actions), and the Drive-files dialog for retrying a failed Drive deletion. |
| **What it creates** | No new record. It changes the merchant's status to `terminated`, closes its open cases, and (for the delete steps) hides or erases the merchant and moves its Drive files to the Drive trash. |
| **Main APIs** | `PATCH /api/merchants/:id/terminate` · `POST /api/merchants/bulk-terminate` · `DELETE /api/merchants/:id/drive-files` · `DELETE /api/merchants/:id` · `POST /api/merchants/bulk-delete` · `DELETE /api/merchants/:id/permanent` |
| **Main code** | Frontend: `src/features/merchants/merchants-terminate-dialog.tsx`, `merchant-delete-dialog.tsx`, `merchants-columns.tsx`, `merchant-drive-files-dialog.tsx` · Backend: `src/modules/merchants/merchants.routes.ts`, `merchants.service.ts`, `merchant-state-machine.ts` |
| **Success looks like** | A terminated merchant stops trading, its open cases are closed, and no new cases can be opened for it — while its record stays viewable until a super admin deliberately hides or erases it. |

## The three strengths — do not confuse them

| Strength | What happens | Can it be undone in the portal? |
|---|---|---|
| **1. Terminate** | The merchant stops trading. Its status becomes `terminated`, its open cases are closed, and no new cases can be opened for it. The merchant, its cases, and its documents stay in the system and can still be viewed. | No. There is no "un-terminate" in the code. The only way back is a fresh application. |
| **2. Soft delete (hide)** | A terminated merchant is hidden from the lists and its detail page. The data is still in the database. The table's Delete button does not call this: it performs strength 3. Soft delete is reachable only through the API (`DELETE /api/merchants/:id`, `POST /api/merchants/bulk-delete`). | No. There is no restore endpoint in the code reviewed. |
| **3. Permanent delete (erase)** | The merchant row and all its merchant/case records are removed from the database, and its Google Drive files are moved to the Drive trash. This is the only delete the screens offer: the table's Delete button opens a dialog that requires the exact business name to be typed. | No. This cannot be undone from the portal. |

Separately, a terminated merchant's **Drive files** can be deleted (moved to the Drive trash) while the merchant record itself stays. Each step has different permissions, and deleting Drive files is deliberately harder than terminating.

## Who can do what

| Action | super_admin | admin | agent |
|---|---|---|---|
| Terminate one merchant (`PATCH /api/merchants/:id/terminate`) | Yes | Yes | No |
| Terminate up to 100 merchants (`POST /api/merchants/bulk-terminate`) | Yes | Yes | No |
| Terminate **and** delete Drive files in the same request | Yes only | No — the request is rejected with 403 before anything changes | No |
| Delete a terminated merchant's Drive files only (`DELETE /api/merchants/:id/drive-files`) | Yes | No | No |
| Soft-delete a terminated merchant (`DELETE /api/merchants/:id`, `POST /api/merchants/bulk-delete`) | Yes | No | No |
| Permanently delete a merchant (`DELETE /api/merchants/:id/permanent`) | Yes | No | No |

In the frontend table, the terminate action is shown to super admins and admins when the merchant is not terminated (`canTerminate`), and the delete action only to a super admin when it is terminated (`canDelete`). That delete action is a permanent delete: `merchant-delete-dialog.tsx` requires the exact business name, and `confirmDelete` in `merchants-table-context.tsx` calls `permanentlyDeleteMerchant()`. No screen calls soft delete or bulk-delete. A separate Drive-trash icon (super admin, terminated merchants whose Drive files are not yet moved) opens the Drive-files dialog. The terminate dialog only shows the "delete Drive files" checkbox to a super admin (`canDeleteDriveFiles`); other admins never see it.

## How it works — the journey

```
Staff opens terminate dialog (merchants table or detail page)
        ↓
Types a reason (required) — super admin may also tick "delete Drive files"
        ↓
Backend terminates in one database transaction:
  status → terminated · portal API credentials cleared
  every open case closed as unsuccessful · resubmission links consumed
        ↓
Termination commits FIRST
        ↓
Only then, if requested, Drive files are deleted
  (a Drive failure does NOT undo the termination)
        ↓
Response reports closedCaseCount + driveFiles status
  (null / deleted / failed — a failed deletion can be retried)
```

## Terminate one merchant

1. Staff open the terminate dialog from the merchants table (or the detail page), type a **reason** (required, 1–1000 characters), and — super admin only — optionally tick "delete Drive files".
2. The backend terminates the merchant in one database transaction: status becomes `terminated` (via `writeMerchantState()`, event `terminated`, allowed from `pending`, `testing`, or `live`; a soft-deleted merchant is not matched, so it gets 409), the merchant's portal API credential rows are **deleted** (`clearPortalApiCredentials()` in `backend/src/modules/cases/portal-api-credentials.service.ts`), and **every open case is closed as unsuccessful** through the case state event `merchant_terminated` (any non-closed status; closed cases are final) with the termination reason, the current stage set to the queue's `closed` stage, and a history entry `closed_unsuccessful` with details `{ reason, source: 'merchant_termination' }`. Any open resubmission links for those cases are consumed as `invalidated`, so a merchant cannot resubmit after termination.
3. The termination **commits first**. Only then, if Drive deletion was requested, are the Drive files deleted. A Drive failure does **not** undo the termination — the response reports `driveFiles: { status: 'failed', message: '…' }` and the merchants list offers the deletion again (via `DELETE /api/merchants/:id/drive-files`).
4. The response is `{ id, status: 'terminated', closedCaseCount, driveFiles }`, where `driveFiles` is `null` when deletion was not requested, `{ status: 'deleted', deletedStorageObjectCount }` on success, or `{ status: 'failed', message }` on failure.

## Terminate many merchants

5. Bulk terminate takes `ids` (1–100), a `reason`, and `deleteDriveFiles`, with the same permission rule. Unknown or deleted ids fail the whole request with 404 — nothing is terminated. Merchants that are already terminated are simply left alone (the state machine only moves merchants in `pending`/`testing`/`live`); the response reports `terminatedCount` (how many actually changed) and `closedCaseCount`.
6. Drive deletion for a bulk terminate happens **in the background after the response** (the request would otherwise take too long across many merchants). The background job (`bulkTerminateMerchants()`, `void withQueryTags(...)`) works through the terminated merchants **one at a time** in one loop; each failure is logged as `[merchant-terminate.drive-files]` and the loop moves on, with no retry. Nothing in the response reports the outcome. The response reports `driveFilesQueuedCount` — how many merchants were queued (0 when Drive deletion was not requested). A merchant whose deletion fails keeps a null `driveFilesDeletedAt`, so it can be retried from the list. A failure or a restart leaves the merchant offered for deletion again.

## Delete a terminated merchant's Drive files only

7. `DELETE /api/merchants/:id/drive-files` (super admin only). It requires the merchant to be terminated (otherwise 409 "Only a terminated merchant can have its Google Drive files deleted.") and its files not already deleted (otherwise 409 "This merchant's Google Drive files are already deleted."). It moves the merchant's Drive objects to the Drive trash: `GoogleDriveStorageProvider.deleteFile()` in `backend/src/lib/storage/google-drive.ts` sets `trashed` on the file, and files are never hard-deleted by this portal. A file already in the trash, or a 404 from Google, counts as done. What Google does with the trash later is Google's own policy and is not in the code. The objects it deletes are marked deleted in the `storage_objects` ledger, and the call records `driveFilesDeletedAt` and `driveFilesDeletedBy` and returns `{ id, deletedStorageObjectCount, driveFilesDeletedAt }`. A Drive failure is returned as 502 (Google server errors, and the case where the service account is not allowed to trash the file) or 500 (other Google error responses), via `toStorageError()` in the same file, and is safe to retry. This endpoint is one of the two that raise the request timeout to 120 seconds (see "Routes" below).

## Soft delete (hide)

8. `DELETE /api/merchants/:id` (super admin only, `softDeleteMerchant()`). Only a terminated merchant can be soft-deleted (otherwise 409 "Only terminated merchants can be deleted."; an unknown id gets 404 "Merchant not found."). It sets `deletedAt` and leaves the status as `terminated`. The merchant disappears from the list and its detail page returns 404 (see file 07). The response is `{ id }`.
   `POST /api/merchants/bulk-delete` (up to 100 ids, super admin only, `bulkSoftDeleteMerchants()`) behaves differently: an unknown or deleted id fails the whole request with 404 ("One or more merchants were not found."), but a **non-terminated** id is **silently skipped**, because the state rule for `soft_deleted` only matches terminated rows. No 409 is returned. The response is `{ deletedCount }`, which can be lower than the number of ids sent. There is no restore endpoint in the code reviewed.

## Permanent delete (erase)

9. `DELETE /api/merchants/:id/permanent` (super admin only) with a JSON body `{ confirmation: "<exact business name>" }`. The confirmation must match the merchant's business name **exactly** — a mismatch gives 400 "Merchant name confirmation does not match."
10. Only a terminated merchant can be permanently deleted (otherwise 409 "Only terminated merchants can be permanently deleted."). The status check runs before the confirmation check, so a wrong name on a non-terminated merchant gets the 409. An unknown id gets 404 "Merchant not found.". The backend first builds a Drive deletion plan from the storage-ownership ledger (`getMerchantDriveDeletionPlan()`) and refuses if a merchant root folder or a linked merchant/case file is not represented in the ledger (409 "Merchant Drive ownership is incomplete. Run pending migrations before deleting this merchant."), or if the merchant has ledger objects from a provider other than Google Drive (409 "Merchant storage includes unsupported providers: <names>."). Drive cleanup is restricted to objects the ledger says this merchant owns, so one merchant's deletion can never remove another merchant's files. It then moves those Drive objects to the trash, deletes the merchant's email-log rows (and email logs for its cases), and deletes the merchant row itself (which cascades to its documents and cases through the database foreign keys). It returns `{ id, deletedStorageObjectCount }`. The delete does not check `deletedAt`, so it also works on a soft-deleted terminated merchant. A Drive ownership gap (409 "Merchant Drive ownership is incomplete. Run pending migrations before deleting this merchant.") and any storage provider other than Google Drive (409) stop it before the database delete.
11. Note the ordering: the Drive deletion happens before the database delete inside the same transaction in the code reviewed, and the plan is built under a row lock (`for update`) on the merchant. This ordering is gap 9 in file 32. If the Drive step fails, the database transaction rolls back and the merchant row survives. **But Drive objects already moved to the trash by then are not restored**, and this cannot be undone from the portal (see file 32, gap 9).

## How it is implemented — Frontend

- **Dialogs.** `frontend/src/features/merchants/merchants-terminate-dialog.tsx` (`MerchantTerminateDialog`) — a reason textarea (cleared every time the dialog opens) plus, for super admins only, the delete-Drive-files checkbox. `frontend/src/features/merchants/merchant-delete-dialog.tsx` — the permanent-delete confirmation (the exact business name must be typed). Both support a single merchant and a bulk target (`{ type: 'single', merchant }` / `{ type: 'bulk', ids }`).
- **Table actions.** `frontend/src/features/merchants/merchants-columns.tsx` — terminate is offered when `canTerminate && merchant.status !== 'terminated'`; delete is offered when `canDelete && merchant.status === 'terminated'`. Priority editing is refused for terminated merchants in the UI as well as the backend.
- **Drive files dialog.** `frontend/src/features/merchants/merchant-drive-files-dialog.tsx` — shows the merchant's Drive files and asks for confirmation to move them to the Drive trash ("Move Google Drive files to trash?"). The dialog has no separate retry control; a failed deletion is retried by clicking the same row icon again, which stays visible while `driveFilesDeletedAt` is null.
- **API calls.** `frontend/src/apis/merchants.ts`: `terminateMerchant(merchantId, reason, deleteDriveFiles)` (PATCH), `bulkTerminateMerchants(ids, reason, deleteDriveFiles)` (POST `/api/merchants/bulk-terminate`, returns `{ terminatedCount, closedCaseCount, driveFilesQueuedCount }`), `deleteMerchantDriveFiles(merchantId)` (DELETE), `permanentlyDeleteMerchant(merchantId, confirmation)` (DELETE with `{ data: { confirmation } }` — Axios sends a body with a DELETE, which the backend reads as JSON). `apis/merchants.ts` has no soft-delete or bulk-delete client function.

## How it is implemented — Backend

### The state machine

`backend/src/modules/merchants/merchant-state-machine.ts` is the single place merchant status changes: `MERCHANT_TRANSITIONS`:

| Event | From | To |
|---|---|---|
| `testing_completed` | `pending` / `testing` | `testing` |
| `went_live` | `testing` | `live` |
| `terminated` | `pending` / `testing` / `live` | `terminated` |
| `soft_deleted` | `terminated` | unchanged (only sets `deletedAt`) |
| `drive_files_deleted` | `terminated` | unchanged (also applies to a soft-deleted merchant) |

`writeMerchantState()` applies the event only to rows in an allowed "from" status and (unless the event says otherwise) only to rows that are not soft-deleted. Database triggers from migration `0103_merchant_state_guard` enforce the same rules for any other writer. A merchant only moves forward; terminated is final; a terminated merchant gets no new cases (`canMerchantOpenCases()` returns false when status is `terminated` or `deletedAt` is set, and `lockMerchantForNewCase()` throws 409 "This merchant is terminated. New cases cannot be opened for it.").

### Routes

`backend/src/modules/merchants/merchants.routes.ts` (all require authentication; the 120-second request timeout is set only for `drive-files` and for the terminate call when Drive deletion is requested, not for permanent or soft delete, because Bun drops a request after 10 idle seconds):

| Endpoint | Who | Body / notes |
|---|---|---|
| `PATCH /api/merchants/:id/terminate` | super_admin, admin | `{ reason (1–1000), deleteDriveFiles (default false) }`. A non-super-admin sending `deleteDriveFiles: true` is rejected with 403 "Only a Super Admin can delete Google Drive files." before anything changes (`assertCanDeleteDriveFiles()`). |
| `POST /api/merchants/bulk-terminate` | super_admin, admin | `{ ids (1–100), reason, deleteDriveFiles }`, same 403 rule. |
| `DELETE /api/merchants/:id/drive-files` | super_admin only | — |
| `DELETE /api/merchants/:id` | super_admin only (soft delete) | The route's own comment says "admin only", which does not match its `requireRoles('super_admin')` guard. The code is the authority: super admin only. |
| `DELETE /api/merchants/:id/permanent` | super_admin only | Body `{ confirmation (1–160) }`. |
| `POST /api/merchants/bulk-delete` | super_admin only | `{ ids (1–100) }`. |

### Service

`backend/src/modules/merchants/merchants.service.ts`: `terminateMerchant()` (lines ~1165), `bulkTerminateMerchants()` (~1224), `closeOpenCasesAsUnsuccessful()` (closes cases, consumes their resubmission tokens, writes `closed_unsuccessful` history, and computes `slaBreached` from the queue's SLA hours), `deleteDriveFilesAfterTermination()` (catches Drive errors and reports them instead of throwing; the single-terminate response then carries `error.message` for an `AppError`, or the fixed text "Google Drive files could not be deleted." otherwise, and the error is logged as `[merchant-terminate.drive-files]`), `deleteMerchantDriveFiles()` (~1027), `softDeleteMerchant()` (~812), `bulkSoftDeleteMerchants()` (~1280), `permanentlyDeleteMerchant()` (~841), plus the Drive plan helpers `getMerchantDriveDeletionPlan()` / `deleteMerchantDriveObjects()`. `clearPortalApiCredentials()` is not in this file: it is imported from `backend/src/modules/cases/portal-api-credentials.service.ts`, and it **deletes** the merchant's credential rows (see file 16).

### Drive deletion details

Deletion moves objects to the Drive trash (never a hard delete) and is restricted to objects in the `storage_objects` ledger; the plan is rejected with 409 if Drive ownership is incomplete. After a successful deletion, the storage objects are marked deleted in the ledger (`markStorageObjectsDeleted()`). For permanent delete, the merchant's `email_log` rows are deleted by a raw SQL condition covering the merchant and its cases, and the merchant row delete cascades. Submission attempts for the merchant survive a permanent delete — their `merchantId` is set to null (`onDelete: 'set null'`), so the per-IP limit history and audit trail still hold.

### Errors

| Result | Meaning |
|---|---|
| `403` "Only a Super Admin can delete Google Drive files." | A non-super-admin sends `deleteDriveFiles: true` on terminate / bulk-terminate — rejected before anything changes. |
| `409` "Merchant is already terminated or does not exist." | Terminate a merchant that is already terminated or does not exist (single) — note this message does not distinguish the two cases. |
| `409` | Soft delete: "Only terminated merchants can be deleted." Permanent delete: "Only terminated merchants can be permanently deleted." |
| `409` | Drive-files delete of a non-terminated merchant, or one whose files are already deleted, or with incomplete ownership. |
| `400` | Permanent delete with a wrong confirmation. |
| `404` | Bulk calls with an unknown or deleted id — whole request fails. `drive-files` on a soft-deleted merchant. |
| `502` | Drive could not be reached (network error), Drive returned a 5xx, or the service account cannot trash the file (`canTrash` false). Safe to retry. Other Drive error responses become `500` (`toStorageError()` in `google-drive.ts`). |

## What happens next — in plain words

- **For the merchant:** a terminated merchant stops trading through AssanPay. It cannot open new cases, and its portal API credentials are cleared, so it can no longer trade on the portal. Its record and history stay viewable until a super admin deliberately hides or erases it.
- **For the team:** the merchant's open cases are already closed as unsuccessful, with the termination reason recorded on them, so nobody needs to work them any further. If the Drive files were not deleted at termination, the list still offers that deletion (and a failed deletion can be retried).
- **If the merchant wants to come back:** it applies again from scratch through the public form (file 04) — the duplicate check allows a terminated merchant to re-apply — and is worked through the queues again. There is no shortcut back from `terminated`.
- **If the merchant is hidden or erased:** a soft-deleted merchant disappears from the lists and its detail page returns 404; a permanently deleted merchant is gone from the database (its Drive files moved to the Drive trash), with its public submission-attempt rows kept but unlinked (`merchantId` set to null; the code reviewed changes no other column of those rows).

## Database fields touched

| Table / field | What it records |
|---|---|
| `merchants.status` | Becomes `terminated` (via the state machine; `terminated` is final). |
| `merchants.deletedAt` | Set on soft delete; the merchant is then hidden from lists and its detail page returns 404. The status stays `terminated`. |
| `merchants.driveFilesDeletedAt` / `merchants.driveFilesDeletedBy` | Set when the merchant's Drive files are moved to the Drive trash (who did it, and when). A null `driveFilesDeletedAt` is how the list knows the deletion can still be offered / retried. |
| `cases` (the merchant's open cases) | Closed as unsuccessful, with the termination reason and a `closed_unsuccessful` history entry (`{ reason, source: 'merchant_termination' }`). |
| `storage_objects` | The ownership ledger for the merchant's Drive files; deletion is restricted to objects it lists, and deleted objects are marked deleted in the ledger. |
| `email_log` | The merchant's (and its cases') email-log rows are deleted on permanent delete. |
| `public_submission_attempts` | Survive a permanent delete — `merchantId` is set to null, so the per-IP limit history and audit trail still hold. |

## Edge cases to know

- **Termination is not undoable in the portal.** There is no endpoint, button, or state-machine event that moves a merchant out of `terminated`. The only way back is a fresh application (which the duplicate check allows for a terminated merchant — see file 04). If a merchant was terminated by mistake, the only recovery in the code reviewed is for the merchant to apply again and be worked through the queues again. There is no "restore" for a soft-deleted merchant either.
- **A terminated merchant's cases are closed as unsuccessful, not deleted.** Their history stays, with the termination reason recorded. Their resubmission links are consumed. Their portal API credentials are cleared. Their limits override, documents, and Drive files stay until separately deleted.
- **Termination and new cases race safely.** `lockMerchantForNewCase()` takes a share lock on the merchant row; termination updates the same row. Either the case commits first (and termination then closes it) or termination commits first (and the case creation throws 409). The case-creation paths that take this lock are `case-query.service.ts` (~line 123) and `case-flow.service.ts` (~line 459). File 32 finding M9 reports a 201 for a case created for a terminated merchant, which this code does not allow, so M9 should be re-tested.
- **The 409 on re-terminate hides whether the merchant exists.** `terminateMerchant()` returns null from the transaction when no row changed and then throws 409 "Merchant is already terminated or does not exist." — an operator cannot tell from the message alone whether they typed a wrong id or the merchant was already terminated.
- **Bulk terminate is not all-or-nothing on already-terminated merchants.** Unknown/deleted ids fail the whole request (404), but already-terminated ids are silently skipped and counted out of `terminatedCount`. Staff must read the count, not assume every selected merchant changed.
- **Drive deletion is best-effort after termination, strict before permanent delete.** After a single terminate, a Drive failure is reported, not thrown; after a bulk terminate it runs in the background and a failure is only visible as a null `driveFilesDeletedAt`. For permanent delete, the Drive plan is built and executed first and a failure fails the request — but the doc comment on `getMerchantDriveDeletionPlan()` says the deletion is "limited to objects in the ownership ledger" and refuses "when a root folder or linked file is missing from it", so a merchant with an incomplete ledger cannot be permanently deleted at all until that is fixed.
- **Soft delete hides the merchant from its own detail page.** `requireMerchant()` returns 404 for soft-deleted merchants, so after a soft delete there is no portal screen that shows the merchant again. The data is only reachable by direct database access.

> ⚠️ **Not found in the code reviewed:** an "un-terminate" or "restore" action; a reason history for terminations (the reason is stored on the closed cases' history entries and as the cases' `closeReason`, not as a merchant-level termination record); a check that a merchant has no outstanding balance or obligation before termination; any waiting period or second-person approval for permanent delete — the only guard is typing the exact business name.

## What to check — is this what you intended?

- [ ] **Delete button means erase:** the table's Delete button permanently erases a terminated merchant (after the name is typed). Soft delete (hide) exists in the API but no screen uses it. Is erase the intent, or should the button hide first and leave erase for later?
- [ ] **Reversible termination:** should termination be reversible? Today a merchant terminated by mistake must apply again from scratch. Is that acceptable, or do you need an "un-terminate" for staff mistakes?
- [ ] **Who deletes Drive files:** who should be able to delete Drive files — only the super admin (as today), or should an admin be able to as well? The split exists because Drive deletion destroys evidence; is that the right line?
- [ ] **Permanent delete retention:** permanent delete erases the merchant and its cases from the database (keeping only the submission-attempt rows, unlinked from the merchant). Is that the retention you want, or should records be kept for a fixed period (for example, for audits or disputes) before they can be permanently deleted?
- [ ] **Second-person guard:** the only guard on permanent delete is typing the exact business name. Is that enough, or should it need a second person to confirm?
- [ ] **"Unsuccessful" label:** when a merchant is terminated, its open cases close as "unsuccessful". Is that the right outcome label, or should termination have its own outcome so reports can tell "we rejected them" apart from "they were terminated"?
- [ ] **Documents after Drive deletion:** should a terminated merchant's documents stay viewable to staff after its Drive files are deleted? Today the document rows stay but their links must no longer be offered (the `driveFilesDeletedAt` flag exists for exactly that) — is that enforced everywhere staff can see documents?

---
*Sources: `frontend/src/features/merchants/merchants-terminate-dialog.tsx`, `frontend/src/features/merchants/merchant-delete-dialog.tsx`, `frontend/src/features/merchants/merchants-columns.tsx`, `frontend/src/features/merchants/merchant-drive-files-dialog.tsx`, `frontend/src/apis/merchants.ts`, `backend/src/modules/merchants/merchants.routes.ts`, `backend/src/modules/merchants/merchants.service.ts`, `backend/src/modules/merchants/merchant-state-machine.ts`, `frontend/src/features/merchants/merchants-table-context.tsx`, `frontend/src/features/merchants/merchants-table.tsx`, `backend/src/lib/storage/google-drive.ts`, `backend/src/lib/storage/ownership.ts`, `backend/src/modules/cases/portal-api-credentials.service.ts`, `backend/src/modules/cases/case-query.service.ts`, `backend/src/modules/cases/case-flow.service.ts`, `backend/src/db/schema.ts`, `backend/src/modules/cases/case-state-machine.ts`, `backend/src/modules/cases/case-resubmission-tokens.service.ts`, `backend/drizzle/0103_merchant_state_guard.sql`. Related files: 04 (duplicate check allows a terminated merchant to re-apply), 07 (merchant detail / 404 for soft-deleted), 16 (portal API credentials cleared on termination), 28 (Google Drive / storage ledger).*
