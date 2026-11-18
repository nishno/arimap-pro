# Persistent module grants — 2026-11-18

## Fixed behavior

An active company membership is the authority for optional navigation. Its `allowedModules` list replaces role defaults when present, including an explicit empty list. The same policy gates module rendering and direct URLs. Account profile, help, onboarding and personal settings remain available as account controls. Verified platform administration remains separate.

Historical employee labels are normalized: Planning → tasks, Harvest → harvesting, Store → stock, Admin → system (farm HR; never platform admin). Profile `visibleModules` cannot grant company permissions. Module grant IDs cannot include platform admin.

Membership IDs are canonical `userId_organizationId`. Saves update only changed rows, wait for server confirmation and report failures. Existing grants survive invitation activation. The membership listener observes content changes, not merely ID changes. A stale random-ID row cannot override a canonical suspended membership.

Company managers receive a scoped colleague-membership subscription so editing HR changes the persisted grants rather than just an employee display field. Deterministically linked old employee grants are migrated by an authenticated manager when that company is open. Unknown links are not guessed from names. New HR links preserve `userId` and `employeeId`.

Explicit optional grants also govern read/write checks in the covered Firestore company collections. Read-only membership cannot write them. An invited user can accept only an existing invited row, changing status/joinedAt and no grants. Ordinary employees cannot edit HR module assignments to trigger a privileged migration. Suspended memberships do not grant tenant access. Privileged organization admins still retain administrative authority; restricting their menu is not a security sandbox against that admin.

## Owner workflow

Cloud: open the company as an authorized manager, edit the employee's visible modules and save. If the legacy employee account has no reliable membership link, link/reinvite the account explicitly; do not use matching names as identity. The user's grant changes arrive through the live membership listener and persist across refresh.

LAN: Local accounts & records → Farm users → Worker module access. Select a worker; existing choices load. Save the complete desired module list. Saving none removes optional module access. Grants are persisted in `local_module_grants` and projected into server-authoritative memberships. Scoped collection access is checked on every API request, with owner-only sensitive writes retained. Granted Harvest users can use the staging weigh terminal; only owners review staging entries.

## Deployment

The app code and Firestore rules must be deployed to the intended project. These edits do not automatically change the production Firebase project. Test with the emulator first and deploy rules through the configured project-specific deployment process. Do not initialize an existing LAN farm again.

The rules retain compatibility for old memberships without `allowedModules`; their prior collection permissions are not globally migrated by this patch. Legacy HR records can include more fields than a minimal operational directory requires. A dedicated minimal worker directory and complete role/data-minimization migration remain necessary before claiming comprehensive production isolation.

SQLite backups include local module grants. JSON/cloud document snapshots do not constitute a full backup/restore of the local grants table.

## Validation

`test:access`: exact allowlists, empty list, read-only, invitation activation, snapshot persistence, wrong farm and stale legacy revocation.

`test:module-grants`: LAN persistence/restart, collection denial, no platform grant, delegated terminal submission, review denial and immediate revocation.

`test:module-grants:browser`: only Stock visible, stable after snapshots/reload, denied URL fallback, live replacement by Harvest and complete optional-module revocation.

`test:rules`: emulator invitation acceptance, immutable self-grants, explicit read/write permissions, HR grant self-escalation denial and suspended-user denial, plus existing security scenarios.
