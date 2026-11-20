# Offline queue and conflict model

## Implemented

Native IndexedDB persists operations before any upload. Scope is server origin + farm ID + user ID. Each capture creates a UUID once; retries retain it. Delivery (pending/received) is separate from review status. Device capture time remains unchanged; server receipt time is separate. Failed submissions remain queued with their error.

Bootstrap identity is checked before synchronization. Every upload additionally binds actor ID to the authenticated user to prevent a changed session from submitting another account's pending work. Network sync is explicit via the Synchronize button. On delivery success, rows remain as history rather than being deleted.

Delta downloads upsert individual records, never replace a whole table. Cursor advances only after records persist. The client processes up to 20 pages per sync; additional backlog is fetched on a subsequent sync. Failed upload currently stops the batch; resolving a permanent validation failure is a follow-up task.

The in-memory form lock prevents overlapping capture/sync in one tab. Server idempotency protects repeated uploads from tabs/devices. Cross-tab capture ownership, shared device identity initialization and conflict UI need further hardening.

## Current offline boundary

After an authenticated bootstrap, an already open terminal can capture without a network. Data survives reload; authenticated access is currently required to display it again. Fully offline reload/login, PIN/biometric unlock, encrypted work packages, device provisioning, expiry/revocation and offline UI caching are NOT implemented. Do not represent a browser cache as Firebase authentication.

Browser storage can be erased/evicted. Request persistence, encrypted recovery/export, storage-capacity monitoring and device backup must be completed before real collection. Use the pilot on a trusted dedicated device, not as the sole harvest record.

## Required production behavior

Merge independent additions. Never silently overwrite concurrent corrections. Preserve void markers, actor/device, both clocks and every review. Closed-event or revoked-access work remains recoverable but cannot silently become approved. Two disconnected devices cannot detect each other's fresh captures until synchronization; use LAN coordination or work allocation to reduce risk.
