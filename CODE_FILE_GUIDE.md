# Code file guide

Reviewed: **2026-10-29**. Scope: every tracked root-level JavaScript, TypeScript, Python and shell code file, plus the root entry/security/configuration files. The folder map below points to the main application code inside subfolders; it is not a per-file inventory of every nested component.

## What are the .md files for?

`.md` means **Markdown**: readable text with headings, links, lists and tables. GitHub and editors display it as formatted documentation. Editing a change log does not install a feature, change permissions or migrate a database. Application behavior comes from code/configuration and the running services. Some documentation may also be linked from help screens or used as reference material when the application explicitly loads it.

We keep separate documents because they answer different questions:

| Document | Purpose |
| --- | --- |
| [README.md](README.md) | Starting point: installation, startup commands and links to detailed guides. |
| [UI_MODERNIZATION/CHANGELOG.md](UI_MODERNIZATION/CHANGELOG.md) | Dated history of changes; earlier entries describe earlier states. |
| [UI_MODERNIZATION/DECISIONS.md](UI_MODERNIZATION/DECISIONS.md) | Reasons for design and implementation choices. |
| [UI_MODERNIZATION/DESIGN_SYSTEM.md](UI_MODERNIZATION/DESIGN_SYSTEM.md) | Shared UI colors, typography, spacing and component guidance. |
| [UI_MODERNIZATION/LOCAL_RUNTIME.md](UI_MODERNIZATION/LOCAL_RUNTIME.md) | How the local application runs and its boundaries. |
| [UI_MODERNIZATION/LOCALIZATION.md](UI_MODERNIZATION/LOCALIZATION.md) | Translation file responsibilities and maintenance. |
| [UI_MODERNIZATION/REGISTRATION_AND_DATA_AUTHORITY.md](UI_MODERNIZATION/REGISTRATION_AND_DATA_AUTHORITY.md) | Registration, data ownership, backup versus synchronization, risks and planned safeguards. |
| [UI_MODERNIZATION/TESTING.md](UI_MODERNIZATION/TESTING.md) | Test commands, recorded results and acceptance limits. A past passing result is not proof of every workflow. |
| [UI_MODERNIZATION/ROADMAP.md](UI_MODERNIZATION/ROADMAP.md) | Work still needed. Planned features are not automatically implemented features. |
| [UI_MODERNIZATION/README.md](UI_MODERNIZATION/README.md) | Index for the modernization documents. |
| [docs/LOCAL_SERVER.md](docs/LOCAL_SERVER.md) | Local installation, HTTPS/LAN, account and backup instructions. |
| [docs/](docs/) | Deployment/handoff and domain guides, including sensors, weather, cameras and the Guria pilot. |
| [new_engine/ARCH.md](new_engine/ARCH.md), [new_engine/EXPLANATION.md](new_engine/EXPLANATION.md), [new_engine/CHANGELOG.md](new_engine/CHANGELOG.md) | Engine-specific architecture, explanation and history; check actual imports and current code before relying on older claims. |
| [src/features/README.md](src/features/README.md) | Feature-area organization and guidance for updates. |
| [AGRIMAP_PRO_ARCHITECTURE_V18.md](AGRIMAP_PRO_ARCHITECTURE_V18.md) | Earlier broad architecture reference, not a guarantee that every described feature is currently complete. |
| [CODE_FILE_GUIDE.md](CODE_FILE_GUIDE.md) | This root-level code inventory and navigation guide. |

These files help you or a future developer understand what changed, why it changed, how to run it and what still needs work. Keep the relevant guide current when code changes; keep history in the change log.

## Root entry, security and configuration files

These files support the current project. Configuration changes can affect builds, deployment or access even though these files are not UI components.

| File | Purpose and usage |
| --- | --- |
| [index.html](index.html) | Browser HTML entry containing the React mounting point and entry-module reference. |
| [package.json](package.json) | Dependencies, Node requirements and npm commands. This is where actual startup/test commands are defined. |
| [package-lock.json](package-lock.json) | Locked npm dependency versions used by npm ci. |
| [bun.lock](bun.lock) | Bun dependency lockfile retained from an earlier workflow; npm ci uses package-lock.json. |
| [vite.config.ts](vite.config.ts) | Vite build/development configuration; also listed in the code inventory below. |
| [tsconfig.json](tsconfig.json) | TypeScript compiler settings and application type-check scope. |
| [firestore.rules](firestore.rules) | Firebase database authorization rules. Local edits do not deploy them automatically; test and deploy deliberately. |
| [firebase.json](firebase.json) | Firebase Hosting output/SPA rewrites and Firestore rules-file selection. |
| [.firebaserc](.firebaserc) | Firebase project aliases used by the Firebase CLI. |
| [firebase.emulator.json](firebase.emulator.json) | Local Firebase Auth/Firestore emulator configuration for tests. |
| [firebase-applet-config.json](firebase-applet-config.json) | Bundled Firebase client/project configuration used when environment configuration does not override it. Not a service-account credential. |
| [firebase-blueprint.json](firebase-blueprint.json) | Descriptive entity/schema blueprint; it does not create SQL tables or enforce Firestore authorization. |
| [vercel.json](vercel.json) | Vercel build/output and SPA routing configuration. |
| [.env.example](.env.example) | Example environment-variable names/configuration. Real secrets belong in private environment settings, not documentation. |
| [.gitignore](.gitignore) | Files Git should exclude, including generated outputs, local databases and credentials. |
| [metadata.json](metadata.json) | App description and requested applet capabilities/permissions; not the database or npm command definition. |

## Root-level code inventory

**Most scripts below are historical development helpers, not application modules.** Their descriptions come from reading their current contents, not executing them. Their names alone are not reliable indicators of behavior. They are not part of the normal npm startup/build chain unless explicitly invoked or wired into it.

Behavior labels distinguish inspection, temporary extraction, source rewriting and actual Firebase data modification. Old regex/line-number patches may target a version that no longer exists. Do not batch-run them as an installer or a general repair command. Some `.js` helpers use CommonJS syntax despite the project's ES-module setting, so they may not run directly as written. None was run to prepare this guide.

| File | Behavior | Explanation and purpose |
| --- | --- | --- |
| [add_costs_and_filters.cjs](add_costs_and_filters.cjs) | Inspect | Checks whether the packaging/OPEX insertion marker exists in HarvestDashboard. Despite its name, it does not add controls. |
| [add_jsx.cjs](add_jsx.cjs) | Rewrite source | Inserts assigned-vehicle and used-material controls into the harvest dashboard. |
| [add_states.cjs](add_states.cjs) | Rewrite source | Adds React state variables for adding vehicles and materials in the harvest dashboard. |
| [delete_produce_list.py](delete_produce_list.py) | Rewrite source | Removes a ProduceList component block from InventoryView; it does not delete produce records from the database. |
| [diagnose-repair.ts](diagnose-repair.ts) | Modify Firebase data | Targets a specific user and repairs Firestore membership/employee identity links and user organization/role context; can delete old membership documents. This is a targeted migration, not a routine health check. |
| [extract_bundle_code.js](extract_bundle_code.js) | Inspect | Searches a particular old compiled JavaScript bundle for UI identifiers and prints surrounding code. |
| [extract_dashboard.cjs](extract_dashboard.cjs) | Write scratch output | Extracts a dashboard fragment from a hardcoded old build bundle into a temporary decompiled JavaScript file. |
| [extract_hd.cjs](extract_hd.cjs) | Write scratch output | Another extractor for a harvest-dashboard fragment in an old bundle; writes temporary output. |
| [find_hd.cjs](find_hd.cjs) | Inspect | Finds HarvestDashboard text in an old compiled bundle and prints nearby code. |
| [find_hd2.cjs](find_hd2.cjs) | Inspect | Searches additional harvest-dashboard markers in an old compiled bundle. |
| [fix_app_offline_save.cjs](fix_app_offline_save.cjs) | Rewrite source | Replaces a cloud-save conditional in App; the replacement currently repeats the matched condition. It is not the current offline-save implementation. |
| [fix_app_sync.cjs](fix_app_sync.cjs) | Rewrite source | Patches App harvest, inventory and employee handlers to accept/use a syncToCloud flag. |
| [fix_divs.cjs](fix_divs.cjs) | Rewrite source | Repairs a specific JSX closing-tag arrangement in the harvest dashboard. |
| [fix_dummy.cjs](fix_dummy.cjs) | Rewrite source | Replaces some dashboard imports with placeholder components and redirects weighing/log imports. Placeholder-based historical repair, not a feature installer. |
| [fix_dupe.py](fix_dupe.py) | Inspect / unfinished | Looks for a duplicated assigned-vehicle UI block and prints its index; the current file does not write a repair. |
| [fix_final_ts.cjs](fix_final_ts.cjs) | Rewrite source | Adjusts dashboard types, inventory stock access, vehicle object fields and WorkerLog bridge calls. |
| [fix_final_types.cjs](fix_final_types.cjs) | Rewrite source | Changes dashboard import paths and placeholder component declarations to address earlier TypeScript problems. |
| [fix_harvest_dashboard.cjs](fix_harvest_dashboard.cjs) | Rewrite source | Changes dashboard box/punnet totals to prefer values stored on the harvest event. |
| [fix_harvesting_stats.cjs](fix_harvesting_stats.cjs) | Rewrite source | Patches HarvestingStats callback calls/signatures to propagate syncToCloud. |
| [fix_iife.cjs](fix_iife.cjs) | Rewrite source | Repairs a particular immediately invoked JSX expression in the harvest dashboard. |
| [fix_missing_states.cjs](fix_missing_states.cjs) | Rewrite source | Injects missing dashboard state/imports and several placeholder declarations. |
| [fix_packaging.cjs](fix_packaging.cjs) | Rewrite source | Changes packaging inputs and quantity synchronization to update event box and physical-punnet totals. |
| [fix_packaging_inputs.cjs](fix_packaging_inputs.cjs) | Rewrite source | Updates the packaging-input display/placeholder expressions in the harvest dashboard. |
| [fix_packaging_sync.cjs](fix_packaging_sync.cjs) | Rewrite source | Uses edited or saved packaging quantities when updating materials and event totals. |
| [fix_save_mock_data.cjs](fix_save_mock_data.cjs) | Rewrite source | Changes App saveMockData to choose Firebase cache or mock storage and use the storage service. |
| [fix_stats.js](fix_stats.js) | Rewrite source | Changes the machinery-cost calculation in HarvestingStats, including owned versus hired vehicle charges. |
| [fix_stats_import.cjs](fix_stats_import.cjs) | Rewrite source | Adjusts the harvest-dashboard import of statistics/cost helpers. |
| [fix_stats_sync.cjs](fix_stats_sync.cjs) | Rewrite source | Changes HarvestingStats event, inventory and employee updates to carry the synchronization flag. |
| [fix_syntax.cjs](fix_syntax.cjs) | Rewrite source | Repairs a specific syntax/JSX fragment in the harvest dashboard. |
| [fix_syntax.py](fix_syntax.py) | Rewrite source | Removes a duplicated closing-brace sequence in the harvest dashboard. |
| [fix_ui.py](fix_ui.py) | Rewrite source | Replaces the dashboard packaging/OPEX controls with a different stock-linked form block. |
| [fix_user_request.cjs](fix_user_request.cjs) | Rewrite source | Restores packaging/OPEX synchronization and changes vehicle/material selection and add-item behavior. |
| [fix_wrapper.cjs](fix_wrapper.cjs) | Rewrite source | Repairs the JSX wrapper around the dashboard total-container display. |
| [get_hd_chunk.cjs](get_hd_chunk.cjs) | Write scratch output | Extracts the boxes/punnets-related fragment of an old compiled bundle into a temporary file. |
| [get_local_sync.cjs](get_local_sync.cjs) | Inspect | Prints the local synchronization panel section of HarvestDashboard source. |
| [local-server-template.js](local-server-template.js) | Server template | Prototype backup/sync receiver exposing /api/sync and /api/sync/test. LocalServerModal refers to it as a downloadable/copyable template. It is separate from the current SQLite farm server under server/. |
| [patch.cjs](patch.cjs) | Rewrite source | Replaces a broken HarvestingStats block around scanned/manual weights and boxes. |
| [patch.js](patch.js) | Rewrite source | JavaScript counterpart of the HarvestingStats scanned/manual weight repair in patch.cjs. |
| [patch2.cjs](patch2.cjs) | Rewrite source | Regex-based worker-selection repair, moving picker controls toward multiple selected employees. |
| [patch_app_sync.cjs](patch_app_sync.cjs) | Rewrite source | Patches App setter/callback signatures involved in cloud synchronization. |
| [patch_bulk_delete.cjs](patch_bulk_delete.cjs) | Rewrite source | Adds the bulk-delete button for selected pickers in HarvestingStats; it edits UI source, not live records. |
| [patch_dashboard.cjs](patch_dashboard.cjs) | Rewrite source | Adds the total-OPEX helper import and changes harvested-inventory unit-cost calculation. |
| [patch_harvesting_stats.cjs](patch_harvesting_stats.cjs) | Rewrite source | Adds an Update All action and propagates synchronization choices through harvest/statistics save callbacks. |
| [patch_missing.sh](patch_missing.sh) | Rewrite source | Uses fixed sed line numbers to insert salary, vehicle, material and packaging-cost controls into the dashboard. |
| [patch_modal.sh](patch_modal.sh) | Rewrite source | Uses fixed sed line numbers to replace harvest-close and daily-harvest modal markup. |
| [patch_modal2.sh](patch_modal2.sh) | Rewrite source | Deletes specific dashboard lines as a follow-up modal-markup repair. |
| [patch_opex.cjs](patch_opex.cjs) | Rewrite source | Inserts calculateTotalOpex for labor, machinery, packaging and other harvest-event costs. |
| [patch_stats.sh](patch_stats.sh) | Rewrite source | Replaces the dashboard statistics-grid invocation using fixed source line numbers. |
| [patch_ui.cjs](patch_ui.cjs) | Rewrite source | Replaces the worker-search/selection UI block in HarvestingStats. |
| [patch_unitcost.cjs](patch_unitcost.cjs) | Rewrite source | Changes harvested-inventory unit cost to calculated production OPEX per weight instead of sale price. |
| [reconstruct_dashboard.cjs](reconstruct_dashboard.cjs) | Rewrite source | Rebuilds the start of HarvestDashboard and joins it to the remaining source tail; broad historical reconstruction. |
| [remove_opex.py](remove_opex.py) | Rewrite source | Removes an OPEX UI section from HarvestEventModal; not a database-deletion tool. |
| [replace.ts](replace.ts) | Rewrite source | Replaces the vehicle-assignment form in LogisticsTransportWidget. |
| [replace_date_filter.py](replace_date_filter.py) | Inspect / unfinished | Finds possible date-filter block boundaries in HarvestDashboard; the current file stops before writing a replacement. |
| [replace_form.js](replace_form.js) | Rewrite source | Another vehicle-assignment form replacement for LogisticsTransportWidget. |
| [replace_sync_btn.py](replace_sync_btn.py) | Rewrite source | Replaces the packaging synchronization button handler, including stock quantity adjustments. |
| [rewrite_block.py](rewrite_block.py) | Rewrite source | Rewrites HarvestingStats packaging/quantity-update controls and full/half-box logic. |
| [rm_dupes.py](rm_dupes.py) | Rewrite source | Removes a duplicated assigned-vehicle section in HarvestEventModal. |
| [script.js](script.js) | Inspect | Walks component source and reports files containing currency-related code/text. |
| [test-grep.sh](test-grep.sh) | Inspect | Searches for calculatePickerEarnings in HarvestingStats; a one-line source lookup, not a regression test. |
| [test_app.cjs](test_app.cjs) | Inspect | Prints App handler declarations for harvest-event, inventory and employee updates. |
| [test_jsx.cjs](test_jsx.cjs) | Syntax diagnostic | Attempts to parse HarvestDashboard using Babel presets. Does not exercise the application or prove workflow correctness. |
| [test_match.cjs](test_match.cjs) | Inspect | Checks whether displayTotalBoxes appears in dashboard source; its success message is a marker check, not a full test. |
| [test_tsc.cjs](test_tsc.cjs) | No-op placeholder | Contains only a comment. It does not run TypeScript. Use npm run lint for the actual type check. |
| [update_sync_ui.py](update_sync_ui.py) | Inspect / unfinished | Finds the packaging synchronization section and possible boundaries; the current file does not write changes. |
| [update_widget.js](update_widget.js) | Inspect / unfinished | Reads LogisticsTransportWidget and contains notes about replacing it; the current file does not write changes. |
| [vite.config.ts](vite.config.ts) | Build configuration | Configures Vite/React, source-aware UI translation, build chunks, development serving and PWA generation. |

## Other root text/reference files

| File | Purpose |
| --- | --- |
| [block.txt](block.txt) | Saved JSX/source fragment for a worker-selection UI block; not a standalone application entry. |
| [item list.txt](<item list.txt>) | Existing application feature/control registry. ProfileView includes a view/download action for this registry; it describes UI items rather than source-file ownership. |
| [item_list.txt](item_list.txt) | Alias/reference copy of the application item registry. |

## Where the main application code actually lives

| Location | Purpose / starting files |
| --- | --- |
| [src/index.tsx](src/index.tsx) | Browser route selection and local-session bootstrap before loading the full application. |
| [src/ProductionApp.tsx](src/ProductionApp.tsx), [src/App.tsx](src/App.tsx) | Full application wrapper, module coordination, shared state and workflows. |
| [src/components/](src/components/) | Working UI screens, forms, dialogs and module components; harvest-specific screens are under Harvesting/. |
| [src/local/](src/local/) | Local/start entry screens, shared account/language controls, local document adapter, runtime wrapper and manual cloud backup controls. |
| [src/cloud/registration.ts](src/cloud/registration.ts) | Transactional Firebase profile completion that preserves protected roles/billing. |
| [src/hooks/useAuth.ts](src/hooks/useAuth.ts) | Authentication lifecycle and user/organization context. |
| [src/hooks/useFirebaseData.ts](src/hooks/useFirebaseData.ts) | Application collection subscriptions and data state, using the configured Firebase/local adapter. |
| [src/firebase.ts](src/firebase.ts) | Firebase configuration/SDK integration and local document-operation routing. |
| [src/contexts/](src/contexts/) | Shared language, theme and data contexts. |
| [src/translations.ts](src/translations.ts), [src/i18n/](src/i18n/), [src/contexts/LanguageContext.tsx](src/contexts/LanguageContext.tsx) | Main keyed translations, offline literal catalogues/reviewed terms and active language/currency state. |
| [src/services/](src/services/) | Storage, integration, synchronization and AI/service helpers. |
| [src/new_engine/](src/new_engine/), [new_engine/](new_engine/) | Engine/event/logging/outbox-related code. Both directories exist; follow imports rather than assuming one is obsolete. |
| [src/demo/](src/demo/) | Guest demo screens and isolated sample workflows. |
| [src/modern/](src/modern/) | Retained isolated Modern preview code; the full /modern application is routed through ProductionApp, not this partial preview alone. |
| [src/features/](src/features/) | Feature-area code and update guidance. |
| [server/local-server.mjs](server/local-server.mjs) | Actual local farm HTTP/API server and paired local/cloud startup. This is what npm run local:start invokes. |
| [server/cloud-server.mjs](server/cloud-server.mjs) | Separate-origin static Firebase application host; does not expose local farm APIs. |
| [server/farm-store.mjs](server/farm-store.mjs), [server/documents.mjs](server/documents.mjs) | SQLite accounts/farm records and authorized rich-module document storage. |
| [server/init.mjs](server/init.mjs), [server/recover.mjs](server/recover.mjs) | Trusted initial owner/farm setup and account/session recovery. Initialization is for a new farm, not routine updates. |
| [server/backup.mjs](server/backup.mjs), [server/restore-documents.mjs](server/restore-documents.mjs) | Local backup and validated document restore tooling. |
| [server/platform-admin.mjs](server/platform-admin.mjs), [server/platform-management.mjs](server/platform-management.mjs) | Trusted platform administration and management implementation. |
| [api/platform/admins.js](api/platform/admins.js) | Deployment-side platform-admin API entry. Requires the appropriate server configuration/credentials. |
| [scripts/](scripts/) | Developer tooling, including UI-text translation transformation, catalogue audit/generation and a Firestore patch helper. Inspect each tool before using it. |
| [tests/](tests/) | Current browser, backend, registration, localization and emulator regression suites. Run through the relevant package.json commands. |
| [app/applet/](app/applet/) | Additional source-moving/replacement utilities retained in the repository; not the main browser entry. |
| [public/](public/) | Static assets copied/served by the frontend build. |
| dist/ | Generated production output from npm run build; change source and rebuild rather than editing generated bundles. |
| .local-data/ | Private runtime farm database directory, excluded from Git. Not a code folder. Preserve it when updating. |
| node_modules/, tmp/ | Installed dependencies and ignored scratch/test outputs; not canonical application source. |

## Which files should I change for a task?

- **UI/layout:** start in src/components/ and the relevant local/Modern style files, not an old root patch script.
- **Translations:** use src/translations.ts and src/i18n/; see the localization guide above.
- **Registration/login:** inspect src/hooks/useAuth.ts, src/cloud/registration.ts, account modals and src/local/ entry controls.
- **Local records/permissions:** inspect server/farm-store.mjs, server/documents.mjs and src/local/documentAdapter.ts.
- **Cloud access rules:** edit/test firestore.rules; deployment is a separate action.
- **How to run/check the app:** read README.md and package.json. Standard entry commands include npm run dev, npm run build and npm run local:start. Old root files named test_* are not substitutes for the current tests/ suites.

## Keeping this guide accurate

Add or update a row when a tracked root code file is added, renamed or removed. Update the folder map when ownership or entry points change. Read actual code and npm wiring when a description and behavior disagree. Historical file presence does not prove that a tool is safe, still functional, or needed by the running application.
