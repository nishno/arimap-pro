# Verification

Use Node 24, Java 21 for Firebase emulators, and Chromium (`/usr/bin/chromium` in this cloud environment; override with `CHROMIUM_PATH`).

- `npm run lint`: TypeScript check.
- `npm run build`: production build, including separate Modern JS/CSS chunks.
- `npm run test:modern`: built application browser flow against a temporary local farm server. Guest isolation; cloud account screen layout; local sign-in through existing UI; version switching; field/harvest/worker saves; retry after a committed harvest response is lost; retained data on return; worker restrictions; tablet/mobile overflow.
- `npm run test:modern:cloud`: actual browser registration/sign-in through local Auth/Firestore emulators, free unprivileged profile creation, sign-out and unchanged existing profile. Uses a demo project, local development Vite and no production credentials.
- `npm run test:local` and `npm run test:local:browser`: existing server and local interface regressions.

Cloud cache prefix used here: `FIREBASE_EMULATORS_PATH=/tmp/arimap-firebase-emulators XDG_CONFIG_HOME=/tmp/arimap-firebase-config`.

Screenshots are generated under ignored `tmp/screenshots/modern-*.png`. They are local review outputs, not required runtime files.

## Limits

Cloud account registration/sign-in is tested with emulators, not production. There is no claim that all Classic modules have Modern equivalents. Full translation, cloud session restoration, farm membership adapters, production deployment, paid entitlement enforcement and real-device field testing remain pending. The large Classic bundle still produces existing build-size warnings; changing its architecture is outside this first parallel-interface release.

## Verified in this release — 2026-10-15

Passed: TypeScript, production build, Modern local browser flow (including committed-save response loss and retry), Modern cloud browser emulator flow, existing local browser regression, all 3 local server test cases, and the existing isolated demo browser suite. Desktop, 820px tablet and 390px mobile screenshots were reviewed. Build warnings remain for Classic's large bundle and old Browserslist data; the build succeeds.
