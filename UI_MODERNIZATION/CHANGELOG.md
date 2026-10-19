# Change log

## 2026-10-15 — sonik g2.0.1.4 first preview

Added isolated Modern entry, calm visual system, version switches, responsive navigation, guest workspace, account screens, local fields/harvest/team workflows, basic reports and proposed plans. Added explicit Classic bridges for remaining modules. Existing database schemas, Classic business logic and authorization rules were not changed.

Added browser coverage for version switching, shared local data, role restrictions and mobile/tablet layout. No production user data was used in tests. See TESTING.md for verification and remaining limitations.

## 2026-10-18 — replace the partial local/Classic split

Changed `/modern` to run the original application with a scoped Modern visual layer, retaining all existing module screens. Added local bootstrap/session mapping and a server-backed document adapter with farm authorization, queries, polling, transforms and transactional batches. Disabled automatic cloud synchronization in local runtime. Added explicit private snapshot upload/download, integrity checks, local document restore with pre-restore recovery copy, and preserved SQLite identity/legacy tables. Added full application inventory/save/switch/reload browser coverage and document-store/recovery tests. Removed misleading dashboard sample readings/staff/schedules/anomalies in local mode. Production backup rules require deployment to the confirmed Firebase project/database; integrations still require their real providers.

## 2026-10-19 — local company registration and shared translations

Company registration now configures the existing local farm ID rather than creating a second workspace. Memberships and owner authority remain server-controlled. Stale browser organization selections cannot move a local session to a cloud organization. Added the previously missing dashboard company modal, preserved legal form/creation date, and replaced raw registration auth JSON with a user-facing error.

All application routes share one language provider. Added offline Georgian/English catalogues, reviewed core labels, missing keyed translations, and source-aware translation for legacy visible literals and notifications. Option values and user data remain unchanged. Fixed header controls overflowing left over the search area and map-tool stacking that blocked the registration menu. Added registration/language and translation regression tests. See LOCALIZATION.md for editing and limitations.

## 2026-10-19 — explicit registration entries and authority boundaries

Added visible local account setup and Firebase signup/sign-in actions, with shared language controls on local/start/full-app and account modals. Local startup now also serves the Firebase application on a separate origin (default 3101), keeping its browser caches separate from the local farm (3100). Legacy cloud-registration links redirect to that entry. Local farm APIs are unavailable on the cloud origin.

Firebase registration completes profiles transactionally without self-granted roles/billing, tolerates an auth-listener-created profile and supports retries. Company setup uses rule-compliant unpaid values, keeps its organization ID on failed retries, and avoids changing protected global roles. Added emulator and entry browser coverage. See REGISTRATION_AND_DATA_AUTHORITY.md for actual local account creation, backup versus live sync, current limitations and prioritized risks.
