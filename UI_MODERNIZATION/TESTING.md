# Verification — 2026-10-19

Use Node 24, Java 21 for Firebase emulators, and Chromium (`/usr/bin/chromium` here, or `CHROMIUM_PATH`).

| Command | Coverage |
| --- | --- |
| `npm run lint` | Whole-application TypeScript check |
| `npm run build` | Production module bundle and PWA build |
| `npm run test:i18n` | Georgian/English dictionaries, missing keys, placeholder parity, source-transform syntax, preserved option values and user names |
| `npm run test:registration` | Actual dashboard company form, canonical farm ID, legal metadata, no virtual membership writes, stale context, language switching with filled inputs and reload |
| `npm run test:demo` | Guest workflows, registration gates, language/currency controls and isolation from production services |
| `npm run test:modern` | Authenticated full application, inventory entered through original Stock form, SQLite commit, Classic/Modern switch, reload, navigation to harvest/tasks/accounts/agronomy/map, backup panel, tablet/mobile overflow, no automatic Firebase traffic |
| `npm run test:local` | Existing farm identities, passwords, worker revocation, role/HTTP/origin boundaries, exports and persistence |
| `npm run test:local:documents` | Rich module records, atomic rollback, increment/nested update, queries, role restrictions, protected identities, restart persistence, safe document restore and wrong-farm denial |
| `npm run test:local:browser` | Existing local control/account interface regression |
| `npm run test:backup:cloud` | Actual Auth/Firestore emulators: private upload/download, Unicode, complete manifest, checksum rejection, other-account isolation and absence of operational cloud writes |
| `npm run test:rules` | Existing authorization regression against Firestore emulator |
| `npm run test:modern:cloud` | Retained sample-preview account screen against local Firebase emulators |

Emulator prefix used here: `FIREBASE_EMULATORS_PATH=/tmp/arimap-firebase-emulators XDG_CONFIG_HOME=/tmp/arimap-firebase-config`.

The full browser flow uses port3196; local control browser3199; HTTP boundary3198; emulators8080/9099; cloud test Vite3004. Run emulator suites sequentially. Screenshots are ignored under `tmp/screenshots/full-modern-*.png`.

## Acceptance limits

The full original module screens are available under both interfaces. Module navigation is a smoke check, not a claim that every historical action has been tested end to end. Inventory save/switch/reload has direct browser and server evidence; other collection persistence/authorization has backend coverage. Real plantation data, live providers, deployed Firebase rules, actual cameras/scales/sensors and real tablets were not used in this environment.

Production Firebase CLI readiness check failed with `Failed to authenticate, have you run firebase login?`; no production deployment occurred. Backup paths/rules were tested using only demo emulators. Existing large-bundle and Browserslist warnings remain.

## Executed outcomes

Passed: production build and TypeScript; full application browser inventory/save/switch/reload/navigation checks at desktop, 820px and 390px; all 3 existing local server test cases; document storage/authorization/restart/restore test; existing local account browser regression; actual Firebase emulator upload/download/integrity checks; existing authorization suite. A parallel test-port collision was corrected by assigning full UI tests port3196, then the affected tests passed. No tests used live farm data or production Firebase credentials.

Translation coverage is automated for application-defined labels; specialist wording is machine-assisted. Provider content and user-entered records keep their original language. See LOCALIZATION.md.

## Registration/localization regression results — 2026-10-19

Passed `test:i18n` (3 checks), `test:local:documents`, `test:local` (3 checks), `test:demo`, `test:modern`, and `test:registration`. The registration flow uses an intentionally stale organization selection, saves company details to the original farm, switches language with entered text intact, reloads into the real map module, and switches back through the actual header control. Production build and application TypeScript checks were also run. Browser storage-persistence refusal in the disposable Chromium profile is informational. No production farm database was opened or modified.
