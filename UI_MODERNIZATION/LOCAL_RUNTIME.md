# Local runtime and operational boundaries

## Architecture

The trusted farm HTTP server marks its HTML as local before loading the application. The entry retrieves `/api/local/me` before importing the original application. A missing/expired session goes to local sign-in, never a fabricated guest profile. Both Classic and Modern share that bootstrap, the local session cookie, current farm and SQLite document table.

`src/firebase.ts` routes document operations to the local adapter in this runtime. Firestore-compatible document snapshots, where/order/limit queries, polling subscriptions, set/update/delete, increments and transactional batches are implemented against authenticated server endpoints. Server commits determine success; failures show an unconfirmed-save banner. The switch waits for pending document writes and flushes deferred map edits. Cloud/browser caches and pending cloud queues are not used to hydrate local farm collections.

The farm identity and owner are generated from trusted server initialization. Local owners receive the application Founder role, not a Firebase platform owner claim. Workers retain restricted reads and the existing quick harvest-entry endpoint; rich document editing is owner-only in this release. Account creation, disabling and password recovery remain in local account controls. Local subscription fields cannot create paid cloud entitlements. One server hosts one farm workspace, with multiple plantation/map features within it.

Modern now reuses the original components to retain workflows. Its calm styling is a scoped visual layer rather than a completed per-module component rewrite. External-service screens remain available, but their actual services must be configured. This is not a claim that every historical script or integration is production-ready.

## Explicit Firebase snapshots

The panel starts a separate, memory-only Firebase Auth session **only after an explicit upload/download action**. It signs out and disposes of the session afterward. No Firebase Admin credential belongs on the farm computer or in Vite source.

Paths: `localBackups/{firebaseUid}/snapshots/{snapshotId}` and its `chunks` subcollection. Rules restrict access to that authenticated Firebase UID. Upload writes chunks then a complete manifest; incomplete uploads are not offered as completed backups. Download checks chunk order/count, format, farm ID and SHA-256. Snapshots are capped at 64 MB; use SQLite backups for larger installations.

The public Firebase config currently points to a Google AI Studio project with a named Firestore database. Backup uses the existing database selection; `VITE_FIRESTORE_DATABASE_ID` overrides it. Production rules must be deployed to that exact database, not an unrelated default database. No production rules, accounts or data were changed in this task. Firebase aliases in `.firebaserc` refer to several different projects: confirm the intended project/database before deployment.

## Recovery

Keep a full database backup on another device:

```powershell
npm run local:backup -- "C:\farm-backups\farm-2026-10-18.sqlite"
```

A full SQLite backup contains accounts and sensitive password hashes; protect it as private data. Stop the farm server before replacing its database during recovery.

Cloud JSON snapshots exclude credentials. To restore **full-application documents to the same farm**, first stop the server, download the verified JSON, inspect its `farm.id`, then run:

```powershell
npm run local:restore-documents -- --file "C:\farm-backups\downloaded.json" --confirm-farm "EXACT-FARM-ID-FROM-THE-FILE"
```

The command requires that the existing local server and backup farm IDs match, creates a pre-restore SQLite recovery copy, then replaces the document set transactionally. Existing local login identities and legacy quick field/harvest tables are retained. It does not silently adopt another farm or overwrite account credentials. For disaster recovery of accounts and legacy records use the full SQLite backup.

## External dependencies and remaining work

- Satellite/base map tiles, geocoding, AI providers, online marketplace networks, Google Chat/Meet/Sheets and weather forecasts need internet and their configured provider accounts/keys. Local storage does not supply these services.
- Browser cameras do not play RTSP directly. NVR multi-view still needs a local RTSP-to-HLS/WebRTC gateway; no gateway was installed here.
- Actual sensors/gateways must be installed and connected. Local dashboard sample sensor readings, sample staff, sample schedules and fabricated anomaly examples are removed in local mode.
- Rich worker editing roles, automatic offline device queues, conflict-aware simultaneous editing and data import from existing Firebase plantations need additional implementation and validation. Keep the server reachable on the farm LAN for writes.
- LAN access requires the documented trusted HTTPS setup. The default server listens only on the host computer. Do not expose it through router port forwarding.
