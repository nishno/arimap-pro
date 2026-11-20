# sonik g2.0.1.4 — full application, two interfaces

Updated 2026-10-18. `/modern` now opens the **original full application**, with the Modern visual layer. `/classic` opens the same components and the same authenticated farm records using Classic styling. Switching no longer opens a separate small demo or changes the data provider. The earlier limited Modern sample remains at `/modern-preview`; the public isolated demo remains at `/demo`.

## Run on your farm computer

Requires Node 24. In the extracted `demo-preview` folder:

```powershell
npm ci --include=dev
npm run build
npm run local:start
```

Open `http://localhost:3100`. Sign in using the **local username/password created by `local:init`**, then choose **Open full application**. Run `local:init` only once for a new farm. Existing installations must retain `.local-data` and their backups. Stop the running server before updating application source. Do not copy an old `dist` directory over a newly built one.

The local server, not Firebase, now supplies authentication and the original modules' document reads, queries, subscriptions, writes and batches. The SQLite database adds a `documents` table without deleting existing accounts, fields or harvests. The older quick field/harvest tables remain accessible in **Local accounts & records**; they are separate from the full application's richer harvest events and mapped geometries. Historical cloud farm data is not automatically imported or merged.

## Backup and recovery

The farm owner's top bar has **Cloud backup**. This requires an existing Firebase account, internet, and deployed private snapshot rules in the configured project/database. Upload is explicit: no automatic background Firebase synchronization occurs in local runtime. The snapshot is separate from operational cloud collections and excludes passwords and login sessions. The panel can download and verify the latest completed snapshot for this farm.

See [LOCAL_RUNTIME.md](LOCAL_RUNTIME.md) for deployment, restores, role boundaries and external dependencies. See [TESTING.md](TESTING.md) for executed checks. Startup instructions saved in cloud environment settings are separate from deploying this app or Firebase rules.

Language file responsibilities and maintenance: [LOCALIZATION.md](LOCALIZATION.md).

Registration, storage authority and risk plan: [REGISTRATION_AND_DATA_AUTHORITY.md](REGISTRATION_AND_DATA_AUTHORITY.md).
