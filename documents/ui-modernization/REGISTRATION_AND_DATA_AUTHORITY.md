# Registration, storage modes and risk plan — 2026-10-19

## Recommendation

Keep Firebase, device storage and LAN support, with **one authoritative writer per farm**. Do not automatically switch a disconnected cloud farm into an independent LAN database and later overwrite either copy. Keep the original working module screens and refactor storage/authentication behind them incrementally. The browser and backend smoke tests do not constitute a complete security audit of every historical workflow.

| Farm configuration | Authority | Device storage | Internet loss |
| --- | --- | --- | --- |
| Cloud-managed | Firebase Auth + Firestore | Firestore persistence/cache | Firebase SDK can queue supported writes; expose pending/rejected state and conflicts. This is not a LAN migration. |
| LAN-managed | Local SQL identity + SQLite farm documents | Cache of server data | Continue over the farm LAN if reachable. Rich module edits currently require server confirmation; a durable device outbox is not implemented. |
| Device disconnected from its authority | Existing cache | Temporary working copy | Never claim a failed save succeeded. No automatic backend replacement. A complete device-only product still requires a tested durable queue and recovery workflow. |

## Paths available now

`npm run local:start` starts two entries from the same build:

- Local farm: default port **3100**, `/local`. No Firebase login is required. Company registration configures this existing farm.
- Firebase application: default port **3101**, `/?register=1` or `/?login=1`. It uses the configured Firebase project and requires Internet. It does not connect the existing local farm to Firebase. Cloud HTTP routes cannot call local farm APIs.

Separate origins isolate localStorage, IndexedDB, service workers and Firebase browser login state. Browser cookies are not port-isolated: the local cookie is HttpOnly with `/api/local` scope; the cloud server rejects these API routes, and the local server checks origins for writes. Do not expose either server directly to the public Internet. LAN HTTP is rejected; configure trusted HTTPS/certificates and `LOCAL_ORIGIN`, `LOCAL_HOST`, `LOCAL_PORT`, and `CLOUD_PORT` together. The server advertises the cloud origin in `/api/local/status`. A busy cloud port causes startup to fail visibly rather than silently advertising another service.

Hosted cloud deployments can use their own HTTPS origin with the same build. Firebase settings, database ID, Auth providers, authorized domains for Google sign-in, and deployed rules must match that deployment. Live production registration is not established by an emulator test. No production rule deployment is part of this change.

### Local accounts

1. The person installing a new farm runs `npm run local:init` once on the server computer, choosing the farm and owner credentials. Browser entry buttons explain this trusted setup step.
2. An initialized server cannot create a second owner/farm through public signup. Its owner signs in and uses **Farm users → Add a worker**. Workers sign in using these local credentials.
3. Company details are entered after login, using Dashboard → Map Tools → Company Registration. The canonical farm ID stays unchanged.
4. Password recovery/owner changes use the documented server-side recovery command. Do not delete the database or rerun initialization to recover access.

Public local registration requests/invitations are a future feature requiring one-time invitation tokens, expiry, rate limits and owner approval; the new local registration button does not pretend to implement that service.

### Firebase accounts and companies

1. Firebase creates the Auth identity (UID). A Firestore transaction creates/completes `users/{uid}`. It permits only Free/unpaid baseline values and preserves protected roles/billing when an auth listener already created the profile.
2. Retrying profile creation reuses the authenticated account. It does not create another identity or grant a paid plan/admin role.
3. A company form keeps the same generated organization ID across failed submission retries. Company, Founder membership and module seed records commit atomically. Signup no longer writes self-granted trials or changes protected global user roles; company authority comes from the membership/creator relationship.
4. Joining another company requires its owner's invitation/approval. Signup does not create active staff records, write into that company's internal feed, or grant membership automatically.
5. Local SQL user IDs and Firebase UIDs are different identities. The same email is not proof that they should be linked. A local owner can authenticate a Firebase account for manual private backups without replacing their local login.

## Backup versus synchronization

Current local cloud backup is an explicit snapshot upload/download, with farm IDs and integrity checks. It is not an operational merge or automatic failover. Existing document restore validates farm identity and creates a recovery copy; identity recovery remains separate. Manual cloud and local registration create separate workspaces. Never register a second company merely to make a backup of the first.

For future account linking, require proof of both local owner access and Firebase authentication; persist an explicit local-user ↔ UID link and an immutable global farm UUID. A restored snapshot must keep entity/farm IDs. Reject linking to a different nonempty cloud farm without a reviewed migration plan.

## Prioritized risks and implementation order

| Priority | Risk | Present mitigation / next work |
| --- | --- | --- |
| Critical | Two active writers overwrite or duplicate the same farm | Keep one authority; no automatic Firebase/LAN failover or merging. Before live sync: immutable farm/entity UUIDs, explicit ownership transfer and sync pairing. |
| Critical | Browser role/billing flags grant authority | Server rules deny client privilege/paid grants. Signup payloads now comply. Audit all legacy root/admin paths; require trusted custom claims/admin service for elevated privileges. |
| High | Sample-derived values presented as live data | Some legacy dashboard widgets still contain sample/fallback metrics and generic briefing text. Audit these before production decisions; show unavailable/demo labels until actual records or calibrated devices supply the value. |
| High | Weak membership/verification assumptions | Existing `isVerified()` currently checks authentication rather than verified email. Audit pending/disabled membership handling and verification policy in staged rules before tightening and deploying. Do not claim email/KYC enforcement already exists. |
| High | Repeated incremental/financial operations | Quick harvest has request IDs; rich document batches are atomic but are not a complete idempotent operation protocol. Add operation UUID + durable server deduplication, request-payload binding, expected revision and operation receipts before automatic retries. |
| High | Offline edits disappear or conflict | Rich LAN edits currently fail visibly if server is unreachable. Build an IndexedDB outbox with pending/error/conflict states; test reconnect, revoked users, duplicate/out-of-order responses and browser restarts. |
| High | Incomplete Auth/profile registration | Auth and Firestore are separate services. Transactional profile completion preserves existing authority and supports retry. Do not automatically delete an Auth account on a transient profile error. |
| High | Backup restore overwrites newer work | Keep checksum/farm validation and pre-restore copies; add retention, encrypted off-machine copies and scheduled recovery drills. A backup is not a live editable replica. |
| Medium | Cache shows another backend's data | Separate browser origins for local/cloud entries; explicit local identity context. Namespace future device queues by authority, farm and user. Clear/reset only the intended workspace. |
| Medium | Slow registration on field connections | The original production module bundle is still large. Split lightweight auth/entry routes from maps, 3D and AI modules, and measure real tablet startup performance. Current build warnings remain. |
| Medium | Multiple overlapping sync implementations | Consolidate SyncManager/SyncBroker/legacy caches behind one repository adapter, module by module. Do not rewrite all working modules at once. |
| Medium | Cloud project or rule deployment differs from code | Test staging with actual project/database, enabled Auth provider and deployed rules. Emulator results cannot verify production configuration. |

### Live synchronization acceptance criteria (future, not enabled)

Use an append-only outbox with `(farmId, entityId, operationId, expectedRevision, actorId, payload)`; acknowledge only after a durable transaction. Store tombstones for deletion, use UTC timestamps with farm timezone for display, preserve unit/currency metadata, and avoid floating-point counters for financial ledgers. Conflicts require per-domain policies (especially payroll, harvest weights and stock). Add sync cursors, deduplication retention, owner-approved pairing, last successful backup/sync status, and restore tests before enabling automatic replication. Never resolve payroll/stock conflicts by silently taking the newest device timestamp.
