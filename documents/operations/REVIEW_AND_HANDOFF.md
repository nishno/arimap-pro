# Review and handoff

Work is in `/workspace/agrimap-latest`, based on the full latest `agrimap-pro-v2.0.1.9 (1).zip`. The uploaded ZIP remains preserved. The earlier review build is in `/workspace/arimap-import`; the GitHub checkout `/workspace/arimap-pro` is unchanged. No commit, push, Firebase deployment or publication was performed.

The latest source contains 266 files under src, plus scripts, engines and local helpers. It includes an existing camera matrix, go2rtc adapter, weather lab and offline engines. Changes were applied to this version without copying the older App or replacing its map/harvest features wholesale.

## Implemented

- `/demo` (also `?demo=1`) loads a separate React application. Production App, Firebase and AI are not imported on that route. Sample changes are confined to `agrimap:demo:v1` in browser storage; reset touches no production keys.
- Interactive overview, keyboard-accessible sample field map, sample harvest recording, persistence/reset, temperature-based frost scenario, illustrative camera grid, mobile layout and registration links. Weather and camera placeholders are explicitly labelled. No live readings are simulated as actual data.
- `/?register=1` opens the existing registration form. Welcome-modal Guest Access now navigates to the isolated demo.
- Refreshed the latest mismatched npm lockfile, including declared 3D/export libraries. Removed automatic third-party SDK patching from postinstall and Vite transforms. Normal dependency installation now works.
- Fixed the latest DeviceControlPanel call to a missing move handler; type check passes. The earlier marker fix was already present in this newer source.
- Removed the hard-coded browser root-login bypass and browser-stored root-session restoration. Editable names, email domains and profile IDs no longer establish root access.
- Removed password changes from profile persistence and filtered password properties in shared sanitizers. Existing stored password fields require a controlled migration; no live documents were edited.
- AI client now calls a same-origin authenticated server endpoint and never receives a Gemini key. Until a real endpoint is configured, AI actions report that the service is unavailable; they no longer crash application initialization. The AI backend is not implemented in this change.
- The latest Firebase setup differs from the earlier ZIP; App Check enforcement and offline-sync behavior still need staging validation. No production credentials were supplied or changed.
- Tightened Firestore profile-role and membership rules, removed the broad overlapping wildcard and unrestricted nested write rule, and used trusted custom claims for global administrator access. Marketplace write ownership uses the actual sellerId/bidderId/authorId schema.
- Preserved the existing camera matrix and replaced its client-local gateway/credential defaults with a same-origin HLS adapter, independent feed errors and actual playback-derived status. Disabled automatic creation of 16 fictitious feeds. Live gateway/session integration is not connected.
- Added weather validation, freshness and scoped-summary utilities. Replaced the weather lab's invented current/historical readings and AI fallback advice with an explicit sensor-not-connected state and user-triggered, provenance-labelled Open-Meteo lookup. Provider failures produce an error instead of substitute data. No sensor ingest is connected.
- Replaced the local backup helper's CommonJS/ESM mismatch, unauthenticated arbitrary-folder writes, and permissive CORS with a loopback-only, token-authenticated helper and a server-selected backup directory. Its clients need updating to the authenticated protocol; no local sync was connected during this task.
- Preserved the latest bundled Tailwind and Leaflet styles; removed broad bootstrap error suppression and runtime CDN/import-map dependencies. PWA icons are local. New service-worker registration is disabled pending a cache migration review.

## Verification

Run from the project directory:

```sh
npm ci --cache /tmp/arimap-npm-cache --no-audit --no-fund
npm run lint
npm run build
node --experimental-strip-types --test tests/weather-data.mjs
npm run dev -- --host 127.0.0.1 --port 3001
# In another terminal, while the development server is running:
DEMO_BASE_URL=http://127.0.0.1:3001 node tests/demo-browser.cjs
```

The browser test uses `/usr/bin/chromium`; set CHROMIUM_PATH on other machines. It checks harvest persistence, weather interaction, reset, malformed demo-storage recovery, mobile width, signup link, and production-storage/request isolation. Hardware browser tests (`node tests/hardware-browser.cjs`) verify failed-provider honesty and independent unauthorized-camera states. The local backup test (`node --test tests/local-backup.mjs`) verifies authentication, path restriction and writes/deletes. The weather suite has four tests for input validation, stale readings, cross-tenant/station statistics and forecast-coordinate validation.

Firestore security tests are supplied but did not run: Google's emulator download at storage.googleapis.com was rejected by network policy. Do not describe these tests as passing. To run after access is enabled:

```sh
FIREBASE_EMULATORS_PATH=/tmp/agrimap-emulators XDG_CONFIG_HOME=/tmp/agrimap-config \
  npx firebase emulators:exec --only firestore --project demo-agrimap \
  --config firebase.emulator.json 'node tests/firestore-security.mjs'
```

## Deployment prerequisites and remaining issues

The modified rules need emulator validation and a staging migration before deployment. Grant global administrator rights through Firebase Admin SDK custom claims (`admin: true`), not editable profile roles or matching email domains. Restrict membership changes and invitation acceptance to a trusted server. Existing direct-client role/verification/organization provisioning may be denied by the new rules and needs a reviewed backend flow. Existing privileged users and memberships need auditing. Remove any old plaintext password fields from stored profiles through a controlled migration; rotate any reused hard-coded credentials.

Full production Firebase login, registration writes, administrative workflows and data operations have not been validated. A signup form opening is not proof an account can be created successfully. A complete application audit cannot be claimed without staging access and validation of actual production workflows.

Additional existing limitations include temporary `URL.createObjectURL` marketplace uploads (not durable storage), some globally fetched collections, schemas with missing organization IDs, and public forum write rules that require a separately designed message/reply authorization model. The provided fixes address the demonstrated privilege-escalation paths; they do not certify every production permission or workflow.

The camera player is ready for integration, not proof of working live video. The gateway must authorize each playlist and segment, keep camera passwords private, use HTTPS and provide an authenticated session cookie. Weather hardware, LoRaWAN network server, authenticated ingest, forecast-service terms and backend, notification delivery and AI server integration remain to be set up.

Do not run the historical `patch_*`, `fix_*`, and reconstruction scripts automatically. They mutate source by string replacement and are not a substitute for reviewed code changes. The latest ZIP contains `scripts/patch-firestore.cjs`, but this script and the Vite plugin rewrite third-party Firebase/React internals. They are retained as source artifacts, removed from automatic execution, and are not needed for the validated demo.

Review draft installation/startup instructions and required network domains in environment settings, then publish the environment if you want to retain its prepared filesystem. Draft saving does not publish or deploy the app.

The plantation helper no longer renames organizations or rewrites cached geometry during reads. It preserves each selected organization and marks unconfigured fallbacks as non-real. Legacy Agrobari constants remain for viewport compatibility and are not a verified Guria boundary. Read [Guria pilot](GURIA_PILOT.md) for the site-specific hardware plan.

Final test outcomes: clean npm installation, type check, production build, demo browser tests, hardware browser tests, four weather-data tests and one local-backup test passed. The production-build demo was also exercised through Vite preview. The existing registration form opened without page errors; account creation and Firebase writes remain unverified. Firestore security tests were not run because the emulator download was blocked.

The latest production JavaScript remains large (the main production chunk is about 6 MB before gzip). The demo is lazy-loaded separately, but further module-by-module performance work is needed for the full app. Mixed fallback/sample code in other hardware labs and offline-sync recovery need a separate, staging-backed audit.


## Local-first migration update

The `demo-preview` branch now also includes a separate local farm server and interface. See [LOCAL_SERVER.md](LOCAL_SERVER.md) for startup, trusted HTTPS on a LAN, consistent backups, owner recovery, worker access management, stable identities, and the staged cloud-linking/migration plan. The server defaults to local mode; the existing Firebase application remains separate. Demo workspace links now lead to `/start`, which offers cloud registration or local installation.

Verified in isolated test data: local authentication/authorization, shared field/harvest records, identical retry deduplication, conflicting request rejection, restart persistence, backup integrity, password changes, disabled-worker session revocation and console owner recovery. The interactive initialization and actual CLI backup were also exercised. Local mode and the installation choice do not import Firebase. Full-module migration, local device offline queues, cloud identity linking/backup/sync, and an actual NVR media gateway are still pending. Actual farm LAN/mobile devices were not available for testing. Existing Firestore emulator validation remains blocked by the previously recorded emulator-download restriction; no rules were deployed.


## Guest, subscription and administrator update (2026-10-12)

See [GUEST_SUBSCRIPTIONS_ADMIN.md](GUEST_SUBSCRIPTIONS_ADMIN.md). The isolated guest demo now includes temporary map drawing/location, marketplace samples, example agronomy analysis, communication drafting, registration gates and proposed per-farm prices. The existing root panel now uses a verified Firebase admin token claim and has an owner-request/manual-review billing flow with immutable audit records. Client trial activation and browser-only global plan editing were removed; organization creation starts unpaid. Payment processing and full entitlement enforcement are not enabled.

The earlier emulator-download blocker is resolved in this environment by setting FIREBASE_EMULATORS_PATH=/tmp/arimap-firebase-emulators and XDG_CONFIG_HOME=/tmp/arimap-firebase-config. The emulator authorization suite now executes and passes. It exposed and led to fixes for circular self-membership admin authorization and read rules referencing a write-only request resource. These results supersede the earlier statement that emulator checks could not run. Rules have NOT been deployed; cloud registration, existing-data migration, manual grants, live guest AI/public data and actual platform-admin provisioning still need staging/provider verification.

User preferences confirmed: subscriptions are per farm; Georgia plus Georgian defaults to GEL through the existing header, with manual currency switching. Draft GEL tariffs are independent of USD prices. Two trusted platform levels are supported (owner/God mode and super-admin); owner-only grant/revoke backend/UI and old-token Firestore revocation checks have been added. Actual root account confirmation and usable Admin SDK credentials are still required, so no live grants or account changes were made.

Final verification also passed an end-to-end Auth + Firestore emulator run against the actual platform API handler: grant/revoke, denial for super-admin actors, protected owner accounts, confirmed super-admin login deletion, retained farm records and completed audit records. Guest map drafts now stay in isolated browser session storage until session end/reset; registration import into a real workspace remains explicit future work.
