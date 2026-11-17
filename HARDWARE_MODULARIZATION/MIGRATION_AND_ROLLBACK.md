# Migration and rollback

This release adds SQLite staging tables (`terminal_operations`, `terminal_changes`, `terminal_reviews`) and an independent frontend. It does not alter existing harvest documents or remove the original station. Tables are created with IF NOT EXISTS; no existing farm reinitialization is needed. Never rerun local:init to update.

Server data is in the existing `.local-data/farm.sqlite` unless LOCAL_DATA_DIR overrides it. `npm run local:backup -- <new absolute backup path>` uses SQLite backup and includes the terminal tables. Existing JSON/cloud document snapshot exports do NOT include this new staging ledger. Unuploaded IndexedDB data is not included in a server backup. Cloud export/restore support for the ledger is a required follow-up.

Rollback: stop terminal captures, synchronize/export or preserve browser storage, make a consistent SQLite backup, then restore the prior app code. Do not delete staging tables or clear browser data. The old version ignores these new tables; retain them for recovery. No automatic forward/backward migration into harvestEntries exists.

Future cutover: reconcile historical records, map device/user identity, implement idempotent projections, test recovery, then enable per farm/event. Do not use both old/new writers for the same receipt cycle. Remove legacy hardware imports only after real-device parity and pilot acceptance.
