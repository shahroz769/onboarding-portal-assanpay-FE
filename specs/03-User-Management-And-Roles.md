# 03 — User Management and Roles

## At a glance

| | |
|---|---|
| **What it is** | How AssanPay controls who works in the portal: creating employee accounts, choosing their role, deciding which queues they can see and work, deactivating them when they leave, and sending them password links. |
| **Who can use it** | Super admins and admins manage users; agents cannot. There is no self-registration — every account is created by someone who already has the right role. |
| **Where it lives** | `/user-management` (super admin and admin only) |
| **Main API** | `GET /api/users` · `POST /api/users` · `PATCH /api/users/:id` · `DELETE /api/users/:id` · `POST /api/users/bulk-status` · `POST /api/users/:id/reset-password` · `POST /api/users/bulk-reset-password` |
| **Main code** | Frontend: `src/features/users/` · Backend: `src/modules/users/users.routes.ts`, `src/modules/users/users.service.ts` (814 lines) |
| **Success looks like** | A new employee gets an invite email, sets a password within 72 hours, and signs in with exactly the role and queue access they were given — nothing more. |

## Who can use it — permissions

The rules are deliberately narrow, and they are enforced in both the frontend (menu and buttons are hidden) and the backend (the request is rejected with 403):

| Action | super_admin | admin | agent |
|---|---|---|---|
| See the User Management page (`/user-management`) | Yes | Yes | No |
| Create a user | Yes — admin or agent | Yes — agent only | No |
| Edit a user | Yes | Agents only | No |
| Deactivate a user (the "delete" button, `DELETE /api/users/:id`) | Yes | No | No |
| Deactivate an agent by saving the edit form with status Inactive (`PATCH`) | Yes | Agents only | No |
| Bulk activate / deactivate | Yes | Agents only | No |
| Send one password-reset email | Yes | No | No |
| Bulk send password-reset emails | Yes | No | No |
| See the user directory (for mentions) | Yes | Yes | Yes (any signed-in user) |

Two extra hard rules from the code:

- **There is exactly one super admin.** A database unique index (`users_single_super_admin`) allows only one row with `roleType = 'super_admin'`. A super admin's role cannot be changed, and the "create super admin" path is therefore not usable in practice while one exists — an admin who tries to create a user with a role above their own gets 403 "You cannot create a user with this role."
- **You cannot deactivate your own account — only partly enforced.** The bulk status route refuses the actor's own id with 400 (`You cannot deactivate your own account.`), and the delete route refuses it with 400 (`You cannot delete your own account.`). The edit route (`PATCH /api/users/:id` with `status: "inactive"`) has no self-check in `updateUser`, so a super admin can deactivate their own account from the edit dialog. This is the open finding H3 in file 32.

## How it works — the journey

```
Super admin / admin opens User Management
        ↓
Creates a user (name, email, username, gender, role, status, queue access)
        ↓
Backend creates the account → emails an invitation link (72 hours)
        ↓
New employee opens the link, sets a password, signs in
        ↓
Later: edits, queue-access changes, password resets, deactivation
        — each change that affects access signs the user out everywhere at once
```

### Creating a user

| Step | What happens |
|---|---|
| 1. Form | A super admin or admin opens User Management and creates a user with: name, email, username, gender, role, status, and (for agents) queue access. |
| 2. Email + username rules | The email must be an `@assanpay.com` address. The username is stored lowercase and may only use letters, numbers, dots, dashes, and underscores. There is no password field on the form — the new employee chooses their own password later. |
| 3. Invite | The backend creates the account and emails an invitation link to `<PUBLIC_APP_URL>/set-password/<token>`. The link lasts 72 hours. |
| 4. Email failure | The account row is written first. If the invitation email cannot be sent, the row is deleted again and the request fails with the send error (502: the mail provider's message, or "Failed to send password email."), so the user is **not** left behind and the request can simply be retried. If the email or username is already in use, the request fails with 409 ("Email is already in use." or "Username is already in use."). |
| 5. First sign-in | The new employee opens the link, sets a password, and signs in. Until then `hasSetPassword` is `false`. |

### Editing a user

| Step | What happens |
|---|---|
| 6. What can change | Name, gender, role, status, and queue access can be changed. **Email and username cannot be changed** after creation. |
| 7. Instant sign-out | Changing a user's status to `inactive`, changing their role, or sending any queue-access field revokes all of their sessions immediately (their `sessionVersion` is bumped — see file 02), so they are signed out everywhere at once. The check looks at what the request contains, not whether the value changed, so re-saving the same queues still signs the user out. The same change also revokes their refresh sessions and retires their unsent resubmission previews (`revokePendingResubmissionTokens`, see file 06). A request that changes only name or gender does not sign anyone out, but the edit dialog always sends role and queue fields, so in practice every save does (see the warning below). |
| 8. Limits | An admin can only update agents (403 "Admins can only update agents."). A super admin's role cannot be changed (403 "Super Admin role cannot be changed."). Choosing a role the actor could not create gives 403 "You cannot assign this role." Email and username are not in the update schema, so any value sent for them is dropped. |

### Queue access (agents only)

| Rule | Detail |
|---|---|
| Super admin / admin | Queue fields are ignored — they see every queue. Saving a super admin or admin also deletes any queue rows the user had, so the stored scope is `all` with no queue rows. |
| Agent scope | `queueViewScope` is `all` (sees every queue) or `selected` (sees only the queues in `viewQueueIds`). At least one view queue is required when the scope is `selected`. |
| Work queues | `workQueueIds` are the queues the agent can actually work in. When the scope is `selected`, work queues must be inside the view queues. |
| Open cases block a change | If an access change would leave an agent owning open cases in queues they could no longer work, the change is rejected with 409 — those cases must be reassigned first. The check covers agents only, counts only cases that are not `closed`, and runs only when role or queue access changes. Deactivation is never blocked by it. The message lists the counts, for example "This user still owns open cases in queues they would no longer be able to work (2 in Queue A). Reassign those cases first." |

### Deactivating and resetting passwords

| Step | What happens |
|---|---|
| 13. "Deleting" a user | Does not remove the row. `DELETE /api/users/:id` sets `status` to `inactive` and revokes all of their sessions. Only a super admin can do it, and not to their own account. Inactive users stay in the User Management list (filter by status `inactive` to find them). Only the mentions directory hides them, because it lists active users only. There is no deleted flag on users in the schema reviewed. A super admin's own account is refused with 400 "You cannot delete your own account." (see file 32, gap 13 for the route). |
| 14. Password resets | A super admin can send one password-reset email (`POST /api/users/:id/reset-password`) or reset up to 100 users at once (`POST /api/users/bulk-reset-password`, which reports `requested`, `sent`, `failed`, and `failedIds`). Reset links last 24 hours. If the email fails, the user's previous reset link stays valid. Both endpoints are refused for anyone but a super admin (403 "Only Super Admins can send reset emails." / "Only Super Admins can send bulk reset emails."). A reset does not change the password or sign the user out; the password changes only when the user uses the link. The bulk call first checks that every id exists (404 "One or more selected users no longer exist."), sends five at a time, returns 502 "Failed to send password reset emails." only when none were sent, and otherwise returns 200 with `failedIds`. Each send issues a new `reset` link and retires older reset links only after the mail is accepted. |
| 15. Bulk status change | `POST /api/users/bulk-status` activates or deactivates several users at once and revokes their sessions. If any selected user no longer exists, nothing is updated (404). A bulk call also refuses the actor's own account when deactivating (400 "You cannot deactivate your own account."), and an admin is refused if any selected user is not an agent (403 "Admins can only update agents."). Deactivating retires unsent resubmission previews those users created. |

## Endpoints

| Endpoint | Roles | What it does |
|---|---|---|
| `GET /api/users` | super_admin, admin | List. Query: `search` (name, email, or username, case-insensitive), `roleType` (comma-separated; the backend accepts any string and unknown values simply match nothing, the frontend validates them), `status` (comma-separated), `cursor`, `limit` 1–100 (default 30). Returns `{ users, nextCursor, hasMore, limit, total }`; `total` is the filtered count, returned on the first page only (`null` on later pages). Newest first by creation date, with a keyset cursor (`backend/src/modules/cases/case-cursor.ts`). Inactive users are included unless a status filter excludes them. |
| `GET /api/users/directory` | Any authenticated user | Active users only (there is no deleted flag). Returns `{ users }` with `id`, `name`, `username`, sorted by name then username. Used for mentions. |
| `GET /api/users/:id` | super_admin, admin | One user. 404 if not found. |
| `POST /api/users` | super_admin, admin | Creates the user and sends the invite email; 201 on success. |
| `PATCH /api/users/:id` | super_admin, admin | All fields optional, at least one required (`At least one field is required.`); email and username are not in the schema, so they are silently dropped, not rejected. No self-check (see H3 in file 32). |
| `DELETE /api/users/:id` | super_admin only | Deactivates (status `inactive`) and revokes sessions; returns `{ user }`. Refused for the actor's own id (400). Never removes the row. (See file 32, gap 13.) |
| `POST /api/users/bulk-status` | super_admin, admin | `{ ids, status }` (1–100 UUIDs), returns `{ updated }`. |
| `POST /api/users/:id/reset-password` | super_admin only | Returns `{ success: true }`. |
| `POST /api/users/bulk-reset-password` | super_admin only | `{ ids }` (1–100), returns `{ requested, sent, failed, failedIds }`. |

All routes live in `backend/src/modules/users/users.routes.ts`, mounted at `/api/users`; every route requires authentication (`requireAuth` on the whole router) and then a role check (`requireRoles`, `backend/src/middleware/rbac.ts` — 403 "Insufficient permissions." when the role is not allowed). `:id` must be a UUID, otherwise 400.

## Validation rules

| Field | Rule |
|---|---|
| `name` | Trimmed, 2–120 characters. |
| `email` | Must end in `@assanpay.com` and is lowercased. Message: `Email must use the @assanpay.com domain.` |
| `username` | Trimmed, lowercased, 2–64 characters, pattern `^[a-z0-9._-]+$` (no "@", so a username can never equal someone's email in the login lookup). |
| `gender` | `male` / `female` (required). |
| `roleType` | One of `super_admin`, `admin`, `agent`. |
| `status` | `active` / `inactive` (default `active`). |
| `queueViewScope` | `all` / `selected` (default `all`). |
| `viewQueueIds` / `workQueueIds` | Arrays of queue UUIDs (max 500, default `[]`). Agent with `selected` scope: at least one view queue, and every work queue must be a view queue (messages `Select at least one queue for view access.` and `Working access must be within view access.`). Queue ids that do not exist give 400 `One or more selected queues are invalid.` |
| `ids` (bulk routes) | 1–100 UUIDs. |
| List query | `limit` 1–100, default 30; `cursor` a non-empty string. |

Creation rules live in `backend/src/modules/auth/auth.schemas.ts` (`createUserSchema`); update rules are in `backend/src/modules/users/users.schemas.ts` (`updateUserSchema`, `listUsersQuerySchema`, `bulkUserStatusSchema`, `bulkResetPasswordSchema`, `userIdParamSchema`).

## Frontend — how the page is built

| Piece | What it does |
|---|---|
| **Route** | `frontend/src/routes/_app.user-management.tsx` (layout) and `frontend/src/routes/_app.user-management.index.tsx` (title "User Management", subtitle "Manage employee status, access, and owned cases."). The navigation entry is restricted to `super_admin` and `admin` in `frontend/src/config/navigation.ts`. |
| **Table** | `frontend/src/features/users/users-table.tsx` with columns in `users-columns.tsx` (employee, username, role, status, password — i.e. whether they have set one — view access, work access, cases owned, last login, created). Filters in `users-route-filters.ts` (search, role, status). The list is keyset-paginated like the merchants list. |
| **Dialogs and forms** | `frontend/src/features/users/create-user-dialog.tsx`, `edit-user-dialog.tsx`, and `user-form.tsx`. Role icons in `user-role-icons.ts`. Table columns are Employee, Username, Role, Status, Password, View Access, Work Access, Cases, Last Login and Created. The create form checks the username pattern (`USERNAME_FORMAT_MESSAGE`: "Use lowercase letters, numbers, dots, dashes or underscores."); the username validator is skipped in edit mode. The edit dialog sends the whole form minus email and username, which is why every save carries role and queue fields (see step 7). The role select is locked for a super admin. The single-user reset is a "Reset Password" button on the user form (super admin only). The table's bulk reset is "Send Reset Email", which opens the confirmation "Send password reset emails?" with the button "Send Reset Emails" (super admin only). |
| **Validation** | `frontend/src/schemas/users.schema.ts`: `roleType` must be one of the three roles, `status` is `active`/`inactive`, `gender` is `male`/`female`; queue rules mirror the backend (for a non-agent, queue fields are not applied; for an agent with `selected` scope, at least one view queue is required). |
| **API calls** | `frontend/src/apis/users.ts`: `fetchUsers()` (`GET /api/users`), `fetchUserDirectory()` (`GET /api/users/directory`), `fetchUser(id)`, `createUser()`, `updateUser()` (PATCH, email and username omitted), `bulkUpdateUserStatus()`, `bulkSendUserResetPasswords()`, `sendUserResetPassword(id)`. |

## Backend — service and database

| Piece | Detail |
|---|---|
| **Service** | `backend/src/modules/users/users.service.ts` (814 lines): `listUsers()`, `listActiveUserDirectory()`, `getUserById()`, `createUser()`, `updateUser()`, `bulkUpdateUserStatus()`, `sendResetPassword()`, `bulkSendResetPasswords()`, `deactivateUser()`. The common user object is built by `sanitizeUserBase` plus `hydrateUsers` and includes `hasSetPassword` (`passwordHash !== null`), `viewQueueIds`, `workQueueIds`, `viewQueues` / `workQueues` (id + name), and `ownedCasesCount` (every case with that owner, closed cases included; `hydrateUsers`). |
| **Invite/reset emails** | Sending is done through the email module (see file 23). Invite subject: "Set up your AssanPay onboarding portal account". Reset subject: "Reset your AssanPay onboarding portal password". The expiry date in the email is formatted in Asia/Karachi time. Each send uses an idempotency key built from the purpose, user and expiry. Invite links expire after 72 hours, reset links after 24 hours (`LINK_DEADLINE_HOURS` in `backend/src/modules/configuration/configuration.service.ts`). A new link replaces the previous link of the same kind only once its email has been sent successfully. Setting a password consumes every open link for the user (see file 02). |
| **Database — `users` table** | `id` (UUID), `name` (varchar 120), `email` (varchar 255, unique), `username` (varchar 64, unique; plus a unique index on `lower(username)`), `gender` (default `male`), `passwordHash` (nullable text), `roleType`, `status` (default `active`), `queueViewScope` (default `all`), `sessionVersion` (integer, default 0, check `>= 0`), `createdByUserId` (references `users.id`, on delete set null), `lastLoginAt`, `createdAt`, `updatedAt`. Source: `backend/src/db/schema.ts`. Queue access itself lives in `user_queue_access` (`userId`, `queueId`, `accessType` `view`/`work`). Exactly one super admin is enforced by the partial unique index `users_single_super_admin`. |
| **Role hierarchy in code** | `backend/src/modules/users/users.service.ts`: `createUser()` throws 403 "You cannot create a user with this role." when the actor's role does not allow it; `updateUser()` throws 403 "Admins can only update agents." for admins editing non-agents, and 403 "Super Admin role cannot be changed." for a super admin role change; `sendResetPassword()` / `bulkSendResetPasswords()` throw 403 unless the actor is super admin. Session revocation on status/role/access change is done by incrementing `sessionVersion` (`sessionVersion: sql\`${users.sessionVersion} + 1\``) and revoking refresh tokens. |

## Data, validation and edge cases

- **Email domain is a business rule, not a suggestion.** Only `@assanpay.com` addresses can be created, enforced in the Zod schema (`ASSANPAY_EMAIL_DOMAIN`). Contractors or staff on another domain cannot be given an account without a code change.
- **Usernames are case-insensitive and cannot look like emails.** Usernames are lowercased on write, login lowercases what is typed, and the pattern forbids "@". "Ali" and "ali" are the same username; the unique index on `lower(username)` enforces it.
- **409s to expect.** Email already in use; username already in use; the user still owns open cases in queues they would lose (on an access change). A queue id that does not exist gives 400 "One or more selected queues are invalid." Other 400s: "Select at least one queue for view access." (agent with a selected scope and no view queues) and "Working access must be within view access."
- **502s to expect.** Invitation email could not be sent (user not created — safe to retry as-is); password-reset email could not be sent (previous link stays valid); bulk reset where every send failed.

> ⚠️ **Inconsistency in wording.** `DELETE /api/users/:id` is described as "delete" in the route and in the API doc, but it only deactivates (`status` becomes `inactive`); no user row is removed. The users table in the schema reviewed has no `deletedAt` column. The directory endpoint returns only `status = active` users (`listActiveUserDirectory`), which is what "non-deleted" means here. This is a naming gap, not a behaviour gap, but it is worth confirming (see file 32).

> ⚠️ **Edit form signs users out on every save.** The `updateUser` session-revocation condition tests whether the field is present, and the edit dialog always sends `roleType` and the queue fields. Result: every save of an employee's record revokes their refresh sessions and bumps `sessionVersion`. This is probably not the intended behaviour for name or gender changes. See file 32 for the status of this issue.

- **Not found in the code reviewed:** any audit log of who created, edited, or deactivated a user (the `createdByUserId` field records who created the account, but no change history for user edits was found in the users module); any way for an admin to see a user's active sessions; any "sign out everywhere" action; any self-service profile page for an employee to change their own name or password while signed in (password change is only via a reset link sent by a super admin; the frontend has no profile or change-password route).

## What to check — is this what you intended?

- [ ] Should admins be able to create other admins, or only agents? Today an admin can only create agents, and only a super admin can create an admin. Is that the hierarchy you want?
- [ ] Should the single-super-admin rule stay? Who holds that account, and what happens if they leave or are unavailable?
- [ ] Is `@assanpay.com`-only the right rule, or do you need accounts for people outside that domain (auditors, contractors, partners)?
- [ ] Agents see cases only in queues they can view, and work only in queues they can work. Is "view" without "work" a real need, or should view and work always go together?
- [ ] When someone leaves, is deactivation (keep the record, sign them out) enough, or do you ever need a user fully removed? Their cases and history still point at them today.
- [ ] Should employees be able to change their own password while signed in, instead of needing a super admin to email them a reset link?
- [ ] Saving the edit form currently signs the employee out everywhere, even when only the name changed. Should a save sign them out only when the role, status or queue access actually changes?
- [ ] Should an admin be able to deactivate an agent by editing the record (as the code allows now), or only through the bulk action? The table above lists both.

---
*Sources: `frontend/src/routes/_app.user-management.tsx`, `frontend/src/routes/_app.user-management.index.tsx`, `frontend/src/config/navigation.ts`, `frontend/src/features/users/users-table.tsx`, `frontend/src/features/users/users-columns.tsx`, `frontend/src/features/users/users-route-filters.ts`, `frontend/src/features/users/create-user-dialog.tsx`, `frontend/src/features/users/edit-user-dialog.tsx`, `frontend/src/features/users/user-form.tsx`, `frontend/src/features/users/user-role-icons.ts`, `frontend/src/schemas/users.schema.ts`, `frontend/src/apis/users.ts`, `backend/src/modules/users/users.routes.ts`, `backend/src/modules/users/users.service.ts`, `backend/src/modules/users/users.schemas.ts`, `backend/src/modules/auth/auth.schemas.ts`, `backend/src/middleware/rbac.ts`, `backend/src/modules/email/templates/user-password.tsx`, `backend/src/modules/cases/case-cursor.ts`, `frontend/src/features/users/users-table.tsx`, `backend/src/db/schema.ts`, `backend/src/modules/configuration/configuration.service.ts`. Related files: 02 (authentication), 23 (email).*
