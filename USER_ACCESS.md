# User access and workspaces

## What changed

Navigation now hides modules denied by the shared module policy on desktop and mobile. Direct module navigation uses the same policy. A worker's dashboard shows their personal work view instead of the company's operational dashboard. Previously cached permissions are no longer retained when permissions disappear or an account changes. Membership role/status updates now propagate even when record IDs stay the same, and deep-link normalization waits for membership loading.

Only an **active membership belonging to the signed-in user in the selected farm** contributes farm permissions. A membership in another farm, an invitation, or a suspended/pending membership does not grant access. Platform administration is separate and uses verified Firebase token claims; a profile label or URL cannot grant it.

| Context | Workspace |
| --- | --- |
| Worker / Employee / Daily Worker / Foreman | Personal work and recorded earnings, profile, AI, communicator, marketplace, help and personal settings. No company accounting, stock, map planner, harvest administration, system management, logs or Labs. |
| Founder / Co-Founder / farm Admin | Farm modules according to existing role permissions and subscription access; management Meet/Chat and AI console. |
| Accountant / Agronomist / Field Manager | Existing contextual module policy; no management Google/AI console unless also granted an active management membership. |
| Platform administrator / platform owner | Platform permissions verified through token claims. Global AI scope remains limited to platform administrators. |
| Guest | Existing public/demo access; no management tool console or personal earnings. |

The personal work view reads only the signed-in profile's `workRecords` whose `userId` matches that profile. It does not infer a worker's identity from their name or email. It shows recorded earnings, not proof of payment, and does not invent working hours, currency or payment status. Empty records are explicitly displayed as empty. This is not a new authoritative payroll ledger or an automatic linkage to historical employee records.

## URLs

Modern examples:

- `/modern/worker/my-work`
- `/modern/farms/<farm-id>/stock`
- `/modern/personal/profile`
- `/modern/admin/admin`

Classic uses the same paths under `/classic`. `/admin` is accepted as an entry alias and normalized to a workspace URL. Existing `/modern`, `/classic`, `/local`, cloud registration and sign-in entries still work. Refresh restores the module; unauthorized or mismatched-farm routes return to a permitted workspace. A farm ID in a URL does not switch accounts, select an unauthorized farm, or grant access. Select farms through the existing account controls.

## Toolbar behavior

The floating assistant's Meet/Chat and management console entries are hidden for ordinary users. The same restriction applies to the Google tabs in the communicator. Management hub open events are checked again, and an already open privileged panel closes when eligibility changes. Ordinary internal communication remains available.

The weather panel in Hardware & Devices has a reversible Show/Hide control. Its input and loaded results remain mounted while hidden. This branch does not contain the newer separately labelled Google/weather toolbar described in the request; apply the same policy to that version when its source is supplied.

## Security boundaries and remaining work

These changes implement navigation and component-entry restrictions; they are not a replacement for database rules. Existing LAN/API authorization remains in place, including denial of worker access to finance collections. No production Firebase rules or deployment were changed.

Before a production role rollout, review Firebase rules and subscriptions collection by collection. Several existing cloud collections grant reads to organization members more broadly than the new menus. LAN workers can still read certain shared field/harvest/work collections under the existing server policy. Hiding their modules does not revoke those API reads. Tightening those policies requires defining which assignments, operational records and employee identities each role legitimately needs, then testing the server and cloud rules together.

Also required for a full payroll product: trusted employer-issued personal records, canonical user-to-employee links, currency and working-hours fields, payment status, and field-level protection against editing one's own earnings. Existing profile work records may be self-editable and are not suitable as financial evidence.

## Implementation and verification

- `src/types.ts`: contextual access helpers and module policy.
- `src/access/routes.ts`: URL parsing and workspace paths; no authority derived from a URL.
- `src/App.tsx`: shared entry guards, scoped grants, role-change handling and URL synchronization.
- `src/components/{Sidebar,MobileNav}.tsx`: hidden denied modules.
- `src/components/MyWorkView.tsx`: personal work records.
- `src/components/{GlobalAssistantPanel,CommunicationHubPanel}.tsx`: privileged tool visibility.
- `src/components/SystemManagement/HardwareLabs/WeatherStationLab.tsx`: weather collapse.

Run `npm run test:access`, `npm run lint`, `npm run build`, then `npm run test:access:browser`. Browser tests use an isolated temporary LAN database and block external traffic; they do not test or modify production Firebase identities or records.

Verified for this change: production build, TypeScript check, role-policy/route tests, existing LAN document-store tests, and browser coverage of owner reloads, live role downgrade, weather hide/show, desktop/mobile worker navigation and direct finance API denial. No production cloud deployment or live Firebase-role test was performed.

## Explicit grants update — 2026-11-18

When an active membership has `allowedModules`, that exact optional-module list overrides the default role matrix, including an empty list. Profile/help/account controls remain. Granted workers can therefore enter assigned operational modules without receiving the other company modules. Persisted canonical membership grants, LAN access controls, updated cloud rules and rollout limits are documented in [MODULE_ACCESS.md](HARDWARE_MODULARIZATION/MODULE_ACCESS.md). The earlier worker-default table applies when no explicit list is present.

## Worker records and role recovery

The earnings view now reads linked employee harvest entries, individual accessible task logs and payroll ledger records. Legacy HR module grants and assigned company roles are read from the server when membership grants are absent. Explicit membership lists, including empty lists, retain precedence. See [worker records](HARDWARE_MODULARIZATION/WORKER_RECORDS.md).
