# Local farm server — updated runtime

**2026-10-18:** The full original application now uses authenticated local document storage on this server. `/modern` and `/classic` share the same local session and data. See [the current runtime guide](../UI_MODERNIZATION/LOCAL_RUNTIME.md) and [startup instructions](../UI_MODERNIZATION/README.md). The older quick field/harvest forms remain available in `/local` as account/compatibility controls. The historical first-stage description below is retained for context and no longer describes the full application runtime.

# Local farm server — first migration stage

This is a separate, working local workspace, not a full replacement for the Firebase application. Local mode currently supports owner/worker authentication, worker enable/disable and password reset, personal password changes, creating fields, recording harvests, viewing shared records, a data export, and consistent SQLite backup. It does not connect to Firebase, import production data, or automatically change data stores when connectivity fails.

The existing full cloud application remains at the root of the static/cloud deployment. The local server redirects its root to `/local`. `/demo` contains only sample data. `/start` offers cloud or local installation. Local mode deliberately does not load Firebase or the existing cloud application.

## Run on the server computer

Install Node.js 24 LTS. In the project folder:

```sh
npm ci
npm run build
npm run local:init
npm run local:start
```

Initialization asks for a farm name, IANA timezone (Asia/Tbilisi is suggested), owner username and a hidden password. There are no default credentials. Open `http://localhost:3100` on that computer. The first owner creates worker accounts inside local mode. Initialization refuses to overwrite an existing farm.

If your terminal makes the text prompts difficult to use, provide the non-secret values explicitly:

```sh
npm run local:init -- --farm-name "My Guria Farm" --timezone "Asia/Tbilisi" --owner-name "nishno" --username "nishno"
```

Only the hidden password and confirmation are then prompted. Do not supply passwords as command arguments. Empty interactive names now trigger an immediate retry instead of an error after password entry.

By default the server binds only to loopback. Data is stored under `.local-data/farm.sqlite`, with WAL durability and foreign keys. `LOCAL_DATA_DIR` can select a persistent absolute directory outside the installation folder. Keep the same directory when updating the application. It is ignored by Git.

## Connect farm tablets safely

Use a stable LAN address/DNS name and HTTPS. Ordinary HTTP on a LAN exposes passwords and sessions; the server therefore rejects non-loopback HTTP origins. Pick one of these configurations:

1. A trusted HTTPS reverse proxy on the farm computer (for example Caddy). Keep Node listening on `127.0.0.1:3100`, set `LOCAL_ORIGIN=https://farm.example.com`, and proxy that hostname to Node. The proxy must preserve the external Host header. Configure DNS and a trusted certificate for a domain you control. Restrict access with the firewall/VPN; do not open this service to the public internet for this pilot.
2. Native Node TLS: set `LOCAL_TLS_CERT` and `LOCAL_TLS_KEY` to trusted certificate/key paths, `LOCAL_ORIGIN` to the exact HTTPS origin including its port, and `LOCAL_HOST` to the specific LAN interface address. Install any private CA trust on tablets. Never bypass certificate verification.

`LOCAL_PORT` defaults to 3100. The configured origin must exactly match the address used by the browser. Behind a reverse proxy, a Node port and external HTTPS port may differ. Session cookies are HttpOnly, SameSite Strict, and Secure for HTTPS. Mutation requests require the configured Origin; arbitrary cross-origin requests are denied. Local users share one farm per server. Owner-only permissions are checked on the server, independently of client UI.

Wi-Fi devices must reach the server; installing it does not increase radio coverage. Internet outages do not affect local operations. If Wi-Fi or the server goes down, the UI reports the error and does not claim a successful save. Device-level offline queues are not implemented yet. Refresh retrieves changes made by other devices; realtime notifications are a future step.

## Back up and recover

The owner can download a JSON data export without password hashes or sessions. This preserves farm/user/record IDs for future imports but is **not** a complete account-recovery backup; JSON restore is not implemented.

For a consistent full backup, including authentication records:

```sh
npm run local:backup -- /absolute/path/to/new-backup.sqlite
```

Use a new destination each time. The SQLite backup API includes committed changes from the live WAL; do not simply copy a live database file. Schedule this command with your operating system and copy backups to another device. Backups contain private farm data and password hashes: encrypt off-site copies, restrict access, and test recovery.

To recover, stop the server completely, preserve the entire existing data directory as a rollback copy, and place the selected backup as `farm.sqlite` in a new empty data directory. Start the server using that directory via `LOCAL_DATA_DIR`. Never mix old `-wal`/`-shm` files with a restored backup. A restored backup may contain sessions that were active when it was made. Before restarting, run `npm run local:revoke-sessions` with the restored `LOCAL_DATA_DIR` to revoke them. If the owner has forgotten their password, the server administrator can stop the server, back up the database, then run `npm run local:recover-owner` in an interactive terminal. Recovery resets the existing owner password without changing farm/user IDs, and revokes every session. There is no remote recovery endpoint; protect operating-system access to the server.

## Identity and later cloud linking

Farm IDs and user IDs are UUIDs generated once and stored durably. Firebase UID is not the application identity. Do not create a second farm just to enable cloud backup, or link identities merely because email addresses match.

The next cloud integration must verify both an authenticated local owner and a verified Firebase ID token on a trusted backend. Store an explicit mapping between the existing farm/user IDs and the Firebase UID, with a uniqueness constraint and an auditable approval. Do not synchronize plaintext passwords, local password hashes, or local sessions to Firebase. Workers can remain local-only; cloud roles must be granted by an authorized owner/backend.

First add encrypted cloud snapshot backup with retention, verified upload/download and tested restoration. This is separate from bidirectional synchronization. No cloud backup endpoint or identity-linking endpoint is active in this release; Firebase credentials are not required for local mode.

## Migration plan and acceptance criteria

1. **Implemented now:** local server, SQLite storage, fixed identities, owner-created workers, password changes, console owner recovery and worker session revocation, field/harvest records, role checks, idempotent harvest submissions, consistent backup, isolated UI and installation choice.
2. **Before a farm-wide pilot:** automated encrypted backup and session revocation on restore, installation/service packaging, tablet HTTPS setup, actual LAN tests, updates and schema migration checks.
3. **Module migration:** introduce repository adapters for organizations, crop plans, inventory, costs and other existing Firebase-dependent modules. Migrate one module with representative real workflow checks at a time. Validate imports in staging and retain original IDs; never point demo records at production storage.
4. **Optional cloud backup/linking:** trusted token verification, ownership mapping, encryption/retention and restoration tests. Show local save and cloud backup status separately.
5. **Device offline and cloud sync:** per-user/farm queues, stable operation IDs, revisions, deletions, reconciliation, conflicts and authorization checks. Inventory/financial changes require transactions, not silent last-write-wins. Harvest requests already deduplicate identical retries on this local server, but there is no cross-server/device queue yet.
6. **Hardware:** private local RTSP-to-HLS/WebRTC gateway with authenticated per-farm playback; LoRaWAN sensor ingest with device identity and provenance. Remote access through VPN, particularly for LTE/CGNAT; no direct NVR port forwarding.

Vercel hosts the static demo and cloud client. It cannot host this persistent LAN server or SQLite database as a static deployment. The `/local` page on Vercel explains that a farm server is needed and cannot access a farm's private network automatically.

## Validation

`npm run test:local` checks durable IDs, authorization, duplicate retry rejection, consistent SQLite backup integrity, restart persistence, session revocation, HTTP origin boundaries and exported-data protection. `npm run lint` and `npm run build` validate the application. Browser workflow tests require Chromium and use isolated temporary databases, never your farm data. Test responses and loopback tests do not prove operation on your actual LAN or with an NVR.
