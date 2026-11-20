# Verification

- `npm run test:terminal`: isolated SQLite ledger; 20 + 15 device contributions, identical retry, payload mismatch, invalid actor/farm, worker denial, invalid weights, duplicate links/revisions, stale review, closed/unknown event, audit, restart durability and zero legacy projections.
- `npm run lint`: TypeScript.
- `npm run build`: independent Core and terminal entries.
- `npm run test:terminal:browser`: headless Chromium with temporary LAN farm. Confirms lightweight terminal network dependencies, offline capture, red suspect row, IndexedDB persistence after online reload, sync/retry, review audit, mobile fit, owner Core modal and worker/anonymous denial.
- `npm run test:local` and `npm run test:local:documents`: existing LAN regression checks.

Tests never modify a real farm or production Firebase project. Browser tests block external traffic. Run browser tests after building. /usr/bin/chromium is used by default; override CHROMIUM_PATH if needed.

Not yet validated: fully offline reload/unlock, different delegated operators, physical scale/scanner/printer, cloud auth handshake, Firebase production rules, browser storage eviction/recovery, authoritative inventory/payroll effects or actual field performance.
