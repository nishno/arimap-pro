# AgriMap Pro — full local application and Modern UI

[Code file guide: file purposes and documentation explained](CODE_FILE_GUIDE.md)

## Run the full application locally

Requires Node.js 24. Preserve `.local-data` when updating. For an existing farm, do **not** rerun initialization.

```powershell
npm ci --include=dev
npm run build
npm run local:start
```

Open `http://localhost:3100`, sign in with your local farm username/password, then choose **Open full application**. `/modern` and `/classic` use the original full module screens, the same local session, and shared SQLite document storage. For a brand-new server only, run `npm run local:init` once before starting it.

Cloud backup is an explicit owner action; production Firebase rules/configuration must be activated separately. External AI, map tiles, forecasts, Google services and RTSP media need their real providers. See [current setup and limits](UI_MODERNIZATION/LOCAL_RUNTIME.md).

## Source and guest demo

Based on the complete `agrimap-pro-v2.0.1.9 (1).zip`. No production deployment has been performed.

```sh
npm ci
npm run dev -- --port 3001
```

Explore sample fields, harvest entries and frost scenarios at the `/demo` path. This route does not import Firebase or production modules. Workspace links open `/start` to choose cloud registration or local installation.

- [Guest features, proposed plans and super-admin setup](docs/GUEST_SUBSCRIPTIONS_ADMIN.md)
- [Local farm server: installation, HTTPS, backups and migration plan](docs/LOCAL_SERVER.md)
- [Review, verification and handoff](docs/REVIEW_AND_HANDOFF.md)
- [Guria pilot: LoRaWAN sensors with LTE backhaul](docs/GURIA_PILOT.md)
- [Weather and camera integration](docs/WEATHER_AND_CAMERAS.md)

The latest application retains its existing camera matrix, with a secure HLS gateway contract. No real sensor or camera connection is configured. Weather-provider errors no longer produce fictional telemetry or crop recommendations. Revised Firestore rules must pass emulator/staging tests before deployment.

## Local server — first release

Requires Node.js 24. After `npm ci`, run:

```sh
npm run build
npm run local:init
npm run local:start
```

The local server defaults to local mode and supports fields, harvest records, owner-created worker accounts and database backup without Firebase. Full cloud-module migration, cloud backup/sync, camera gateway and device offline queues are not yet connected. Vercel can host the demo/cloud client, but the local server runs on your own computer. See the local server guide above before connecting LAN tablets.
