# AgriMap Pro System Integration Engine - CHANGELOG

All changes, architectural updates, and new engine module files created under `/new_engine/` are recorded chronologically below.

#### Time: 08:20:00 UTC
- **File Name:** `/src/components/Harvesting/HarvestEventHistoryModal.tsx`
  - **Action:** Created
  - **Description:** Version Audit History & Rehydration Modal. Allows field managers to view sequence-numbered delta logs fetched from IndexedDB via `WorkerLog.fetchDeltas()` and execute zero-loss session state restoration (`RESTORE_VERSION`).

#### Time: 08:20:10 UTC
- **File Name:** `/src/components/Harvesting/ShareHarvestEventModal.tsx`
  - **Action:** Created
  - **Description:** Share Harvest Session Modal. Generates direct share links, session summary cards, and trigger native Web Share API / clipboard copy for WhatsApp/Telegram report sharing.

#### Time: 08:20:20 UTC
- **File Name:** `/src/components/Harvesting/ExportExcelModal.tsx`
  - **Action:** Created
  - **Description:** Flexible Payroll & Harvest Data Exporter Modal. Provides filtered Excel export by worker scope (All, >0 kg, 0 kg, Bonus, Corrected, Selected), role, payment model, weight range, and customized column checklists with UTF-8 BOM encoding for Georgian text support.

#### Time: 08:20:30 UTC
- **File Name:** UI Integration Updates
  - **Action:** Modified (`src/components/HarvestingView.tsx`, `src/components/Harvesting/HarvestDashboard.tsx`, `src/components/HarvestingStats.tsx`)
  - **Description:** Integrated `PresenceEngine` real-time collaboration badge, `HarvestEventHistoryModal`, `ShareHarvestEventModal`, and `ExportExcelModal` into the main harvest views and yield stats modals.

---

### Date: 2026-07-26

#### Time: 07:25:48 UTC
- **File Name:** `/new_engine/types.ts`
  - **Action:** Created
  - **Description:** Centralized TypeScript definitions for event bus topics, harvest action payloads, hardware sensor/stream telemetry (GPS, RTSP, Soil, Drone, Weather, Scale), immutable delta log entries, outbox queue items, presence users, and system telemetry metrics.

#### Time: 07:26:01 UTC
- **File Name:** `/new_engine/utils/idbHelper.ts`
  - **Action:** Created
  - **Description:** Zero-dependency IndexedDB wrapper (`EngineIDB`) providing high-throughput storage operations for `delta_logs`, `offline_outbox`, and `system_snapshots`. Fully compatible with both Main UI thread and Web Worker thread execution contexts.

#### Time: 07:26:14 UTC
- **File Name:** `/new_engine/AppEventEngine.ts`
  - **Action:** Created
  - **Description:** Publish/Subscribe event bus engine (`AppEventEngine` / `AppEngine`). Enables non-blocking, decoupled async event emissions for harvest actions, hardware telemetry streams, and system metrics. Features circular replay buffers, wildcard subscriptions, and middleware chain support.

#### Time: 07:26:30 UTC
- **File Name:** `/new_engine/workers/log.worker.ts`
  - **Action:** Created
  - **Description:** Dedicated Web Worker for off-main-thread log processing. Performs heavy serialization, tamper-proof checksum chaining (`checksum = hash(prevChecksum + seq + payload)`), disk persistence to IndexedDB, and state rehydration/undo computations off the UI thread.

#### Time: 07:26:43 UTC
- **File Name:** `/new_engine/WorkerLogBridge.ts`
  - **Action:** Created
  - **Description:** Main-thread client interface (`LogEngine` / `WorkerLog`). Bridges React components to `log.worker.ts` via Promise-based messaging, automatically subscribes to harvest event topics on `AppEngine`, and includes automatic fallback to async IndexedDB if Web Workers are restricted.

#### Time: 07:26:58 UTC
- **File Name:** `/new_engine/PresenceEngine.ts`
  - **Action:** Created
  - **Description:** Ephemeral real-time presence system (`PresenceEngine` / `Presence`). Manages active harvest session collaborators with 15-second throttled heartbeats and zero-re-render store subscriptions, preventing React render thrashing on low-power field tablets.

#### Time: 07:27:13 UTC
- **File Name:** `/new_engine/OutboxQueue.ts`
  - **Action:** Created
  - **Description:** Offline Delta Outbox Queue manager (`OutboxQueue` / `Outbox`). Persists offline actions sequentially into IndexedDB, monitors network connectivity status (`online`/`offline` events), and performs sequential order-preserved syncing with exponential backoff upon network reconnection.

#### Time: 07:27:21 UTC
- **File Name:** `/new_engine/index.ts`
  - **Action:** Created
  - **Description:** Central entry-point export file exposing all new integration engine modules (`AppEngine`, `WorkerLog`, `Presence`, `Outbox`, `EngineIDB`, and types) for effortless developer consumption.

#### Time: 07:27:35 UTC
- **File Name:** `/new_engine/CHANGELOG.md`
  - **Action:** Created
  - **Description:** Detailed record of all file creations and modifications within `/new_engine/`.

#### Time: 07:27:40 UTC
- **File Name:** `/new_engine/EXPLANATION.md`
  - **Action:** Created
  - **Description:** Comprehensive architectural explanation detailing system performance protection, non-blocking offloading, RAM preservation, and developer integration guidelines.

#### Time: 07:27:45 UTC
- **File Name:** `/new_engine/ARCH.md`
  - **Action:** Created
  - **Description:** Root-to-leaf directory and file architecture map explaining the function of every file in AgriMap Pro and the data pipeline connections between them.
