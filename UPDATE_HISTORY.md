# AgriMap Pro update history

Dates use Asia/Tbilisi. Each implementation update receives a dated entry here; detailed source-file responsibilities remain in CODE_FILE_GUIDE.md.

## Earlier updates recorded in the repository

- **2026-10-15 — sonik g2.0.1.4 first preview**: Added isolated Modern entry, calm visual system, version switches, responsive navigation, guest workspace, account screens, local fields/harvest/team workflows, basic reports and proposed plans. Added explicit Classic bridges for remaining modules. Existing database schemas, Classic business logic and authorization rules were not changed.

- **2026-10-18 — replace the partial local/Classic split**: Changed `/modern` to run the original application with a scoped Modern visual layer, retaining all existing module screens. Added local bootstrap/session mapping and a server-backed document adapter with farm authorization, queries, polling, transforms and transactional batches. Disabled automatic cloud synchronization in local runtime. Added explicit private snapshot upload/download, integrity checks, local document restore with pre-restore recovery copy, and preserved SQLite identity/legacy tables. Added full application inventory/save/switch/reload browser coverage and document-store/recovery tests. Removed misleading dashboard sample readings/staff/schedules/anomalies in local mode. Production backup rules require deployment to the confirmed Firebase project/database; integrations still require their real providers.

- **2026-10-19 — local company registration and shared translations**: Company registration now configures the existing local farm ID rather than creating a second workspace. Memberships and owner authority remain server-controlled. Stale browser organization selections cannot move a local session to a cloud organization. Added the previously missing dashboard company modal, preserved legal form/creation date, and replaced raw registration auth JSON with a user-facing error.

- **2026-10-19 — explicit registration entries and authority boundaries**: Added visible local account setup and Firebase signup/sign-in actions, with shared language controls on local/start/full-app and account modals. Local startup now also serves the Firebase application on a separate origin (default 3101), keeping its browser caches separate from the local farm (3100). Legacy cloud-registration links redirect to that entry. Local farm APIs are unavailable on the cloud origin.

- **2026-11-17 — contextual module navigation and toolbar controls**: Added a personal work/earnings view, hidden denied desktop/mobile modules, contextual active-membership checks, management-only Meet/Chat and AI console entries, workspace URLs and a reversible weather-panel hide control. Removed stale permission retention across account/role changes. Platform administration uses verified claims, not profile role labels.

- **2026-11-18 — persist explicitly assigned company modules**: Active membership allowlists now replace default worker navigation. HR grants persist through invitation activation, live snapshots and reload. Canonical IDs, changed-only acknowledged writes and legacy label normalization prevent grants from disappearing. See [module access](../HARDWARE_MODULARIZATION/MODULE_ACCESS.md).

## 2026-11-18 — personal workspace and company access

Published commit: 54fb1af. Added personal assignment projections, own employee-linked harvest/payroll records, CV/services/reviews, opt-in partner profiles and management-only company operations. Historical module checkboxes no longer elevate ordinary accounts. Assignment publication runs when an online manager opens the company. This update's replacement personal Dashboard and AI screen are superseded by the next entry.

## 2026-11-19 — familiar screens, company discovery and clinical workflow

### Navigation and roles

- Restored the existing Dashboard and AI Agro Analyst components rather than separate simplified replacements. Management retains its operational screens. Ordinary accounts see personal notices and public dashboard widgets; company operations, Market and company-wide AI analysis remain hidden.
- Moved CV/services/reviews access under My work & earnings, with Find partner & work linking to Communicator. Profile remains available for onboarding and service/organization choices.
- Newly registered users with no active company membership may open the existing Map Planner interface to find land and draw a preview. Its state/publish adapters are isolated from company storage. Save explicitly requires company registration; drafts are memory-only and should be redrawn after leaving the page. Workers already linked to companies do not gain company Planner access.
- Replaced the old success-only join-request message with persisted requests. Company managers review requests in Communicator announcements. Approval checks the pending request and existing membership/employee identity in a transaction; it cannot overwrite an existing membership. Local farms continue to use owner-managed local accounts.

### Communicator

- Removed Google Meet/Google Chat tabs; those integrations remain in the authorized toolbar.
- Added region filtering, map checkpoints with company/crop tooltips, and company-detail popups. Details use company-published area, crops/varieties and job information. A company without a valid published location is listed but has no invented map point.
- Added persisted job announcements: title, daily/permanent/seasonal/contract work, region, work description/conditions, posting date and company contact. Only company management can publish/close vacancies. Signed-in users can discover and contact companies. Personal direct messages remain private to participants/destination-company management.

### Gemini assistant and layout

- “Copilot” was an interface label, not a Microsoft AI provider. The app already called Gemini, but an invalid model name and absent backend caused failed requests to be replaced by canned answers. Chat now reports connection/quota failures honestly and includes recent conversation history in the real request.
- Added same-origin authenticated Gemini gateways to both bundled Node servers. The server chooses GEMINI_MODEL (default gemini-2.5-flash), limits request volume/output and keeps credentials out of the browser. Removed the misleading browser API-key entry form. AI requires internet and valid provider credentials.
- Assistant header actions wrap within the viewport; close stays reachable on mobile. Suggestions occupy a static, vertically stacked expandable section. Opening a diagnostics popup hides the assistant panel behind it; closing the popup restores its previous state.

### Agronomist conclusion and prescription

- Retained severity and target sector. Added explicit AI-generated-plan and manual/combined editor sections, conclusion/comment, Save, Save & add to Agronomy and Archive.
- Recipe rows use explicit material, quantity and unit. No default chemicals, dosages or fabricated recovery percentages are inserted. AI suggestions require agronomist review. Saving a prescription does not execute treatment or deduct inventory.
- Management dispatch writes the reviewed recipe to nutritionPlans using a stable clinical-record-based ID. Retrying updates that plan rather than creating duplicates. Missing sector/material quantities block dispatch. Ordinary users can save personal advice but cannot dispatch company operations.
- All successful AI analyses, generated plans and manual/combined saves are archived as AI-generated, Agronomist-created or Combined, with dates. Archive lists show summaries; selecting opens details and edit/reuse/delete controls. Delete uses a tombstone to prevent reimport of a removed legacy record.
- Archive data is stored in clinicalRecords, scoped to the user and/or authorized company. Existing real company diagnoses and author-matched local clinical records are imported; unowned seeded examples are excluded. Original legacy local storage is retained. Imported entries remain historical records, not newly verified diagnoses.

### Update and configuration

1. Stop the existing process, pull demo-preview, run npm ci --include=dev, npm run build and npm run local:start. Do not rerun local:init for an existing farm or clear unsynced browser storage.
2. Copy .env.server.example to .env.server. Put GEMINI_API_KEY there and optionally GEMINI_MODEL. npm run local:start loads this ignored server file. Never prefix secrets with VITE_. Restart after changing server settings.
3. The Firebase UI server additionally needs trusted Application Default Credentials for its actual Firebase project to verify user tokens. Use server-only GOOGLE_APPLICATION_CREDENTIALS or deployment identity; never upload credentials to the repository. Local sessions use their existing protected server cookie.
4. Deploy the updated Firestore rules to the application's actual project AND database before using clinicalRecords, jobAnnouncements and joinRequests in Firebase mode. npm run firebase:target reports the configured identifiers. No production Firebase rules, credentials or hosting were deployed by this code update.
5. An externally hosted frontend needs an authenticated same-origin route for VITE_AI_ENDPOINT (default /api/ai); the repository's Node gateway is not automatically deployed by Firebase Hosting or Vercel static hosting.

### Verification

Meaningful checks cover role/draft boundaries, personal record isolation, published-job authority, join-request authority, Gemini prompt/config/rate behavior, reviewed plan persistence/retries, company details/map discovery, archive behavior and mobile assistant controls. Provider calls are mocked or deliberately unconfigured in tests; a live paid Gemini call still requires the operator's credentials. See the final update report for executed checks.

### Regression fixes found during verification

The planner preview now starts with a valid empty drawing tool and its own draft layer, instead of crashing on a null tool. Preview activity logging cannot overwrite company logs. Leaflet zoom teardown disarms its delayed transition callback before removing a map pane, preventing errors during rapid module switching or resizing. Goal/service changes await real saves and never assign global roles.

### Executed verification — 2026-11-19

- TypeScript check and production/PWA build.
- 20 Node test cases for role access, local API/document boundaries, personal records, terminal replay safety, assignment projections, Gemini gateway handling and community/archive restrictions.
- Firestore emulator rules suite, including a real client join-approval transaction creating canonical membership and employee records, private clinical reads, public job reads and denial of unauthorized publishing/approval.
- Browser checks: desktop/mobile role navigation; legacy-grant restrictions; own earnings and CV/services/reviews persistence; job publishing and region/map/company discovery; recipe dispatch without duplicate plans; AI/manual/combined archive creation, edit, reuse and delete; honest missing-Gemini configuration errors; mobile assistant controls and popup isolation.
- Isolated original-planner preview rendering, shared-draft isolation, registration prompt and absence of company writes.
- Visual inspection of desktop clinical editor and mobile diagnostics screenshots using test data. Live paid Gemini requests and production Firebase deployment were not performed.

## 2026-11-19 — reference-style Announcements, earnings and prescriptions

Analyzed agrimap_new at commit 19d4bbd and adapted its unified feed and restrained card-based styling. Added Announcements & Plantations as the primary Communicator tab, with synchronized feed/map search and region, work/service, contract and crop filters. Companies, published vacancies and opt-in service profiles share one discovery view. Details/contact/map actions reuse existing authorized workflows. Missing map coordinates remain explicitly unavailable.

Rebuilt My work & earnings around four summary cards, currency-separated balances, Activities/Harvest/Payroll tabs and the existing expandable CV/service tools. Restyled clinical diagnosis and prescription screens with the same spacing, typography, card surfaces and action hierarchy. Earnings calculations, account links, clinical archive persistence and company permissions remain unchanged.

Detailed analysis, reference source and adaptation boundaries: UI_MODERNIZATION/REFERENCE_STYLE_2026-11-19.md. No database migration or production deployment is part of this update.

## 2026-11-19 — illustrated user guide and daily SOPs

Added an English user guide covering registration and account modes, profile/verification/services/agro-agent onboarding boundaries, company/crops/varieties, Map Planner, workers/teams, inventory/purchases, harvest setup/live weighing/finalization, scheduler/tasks/works, agronomy and AI prescriptions, sensor configuration, ledger review, Communicator and personal earnings. Added ten daily SOPs, role/mode guidance and troubleshooting. Screenshots use fictional training records in an isolated temporary farm; no production user, financial, device or cloud data was changed.

Included browsable HTML, a printable PDF and screenshot provenance. Explicitly documented current limits: the standalone terminal is staging-only, universal offline merge is not complete, legacy verification is not legal KYC, and weather/soil/provider screens are not proof of live hardware or AI connections. Documentation and screenshot/build tooling only; application workflows and authorization rules were not modified.
