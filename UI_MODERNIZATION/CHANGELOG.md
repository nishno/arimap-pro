# Change log

## 2026-10-15 — sonik g2.0.1.4 first preview

Added isolated Modern entry, calm visual system, version switches, responsive navigation, guest workspace, account screens, local fields/harvest/team workflows, basic reports and proposed plans. Added explicit Classic bridges for remaining modules. Existing database schemas, Classic business logic and authorization rules were not changed.

Added browser coverage for version switching, shared local data, role restrictions and mobile/tablet layout. No production user data was used in tests. See TESTING.md for verification and remaining limitations.

## 2026-10-18 — replace the partial local/Classic split

Changed `/modern` to run the original application with a scoped Modern visual layer, retaining all existing module screens. Added local bootstrap/session mapping and a server-backed document adapter with farm authorization, queries, polling, transforms and transactional batches. Disabled automatic cloud synchronization in local runtime. Added explicit private snapshot upload/download, integrity checks, local document restore with pre-restore recovery copy, and preserved SQLite identity/legacy tables. Added full application inventory/save/switch/reload browser coverage and document-store/recovery tests. Removed misleading dashboard sample readings/staff/schedules/anomalies in local mode. Production backup rules require deployment to the confirmed Firebase project/database; integrations still require their real providers.
