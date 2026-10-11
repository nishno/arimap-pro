# AgriMap Pro - Complete System Architecture Map (`ARCH.md`)

This document presents a comprehensive, folder-by-folder and file-by-file architectural mapping of AgriMap Pro. It details the purpose of every file and explains the data flow pipelines connecting UI views, storage layers, and the `/new_engine` integration bus.

---

## 1. Directory Tree Overview

```
/
├── .env.example                          # Environment variable declaration template
├── .firebaserc                           # Firebase target project mapping
├── .gitignore                            # VCS ignore definitions
├── AGRIMAP_PRO_ARCHITECTURE_V18.md       # Architectural specification documentation v18
├── app/                                  # Mobile / native container build artifacts
├── bun.lock                              # Bun lockfile (alternative package runner)
├── diagnose-repair.ts                    # Diagnostic & system auto-repair script
├── extract_bundle_code.js                # Bundle extraction utility
├── firebase-applet-config.json           # Live Firebase client credentials config
├── firebase-blueprint.json              # Firestore collections & schema definition
├── firebase.json                         # Firebase hosting & Firestore deploy rules
├── firestore.rules                       # Firestore security rules
├── index.html                            # Application DOM container entry point
├── local-server-template.js              # Offline Express server configuration fallback
├── metadata.json                         # AI Studio app metadata & frame permissions
├── new_engine/                           # 🌟 Integrated System Architecture Engine
│   ├── ARCH.md                           # System architectural map (this file)
│   ├── AppEventEngine.ts                 # Central Pub/Sub Event Bus Engine
│   ├── CHANGELOG.md                      # Chronological modification log
│   ├── EXPLANATION.md                    # Technical performance & usage guide
│   ├── OutboxQueue.ts                    # Offline Delta Outbox Queue
│   ├── PresenceEngine.ts                 # Real-time collaborator presence tracking
│   ├── WorkerLogBridge.ts                # Main-thread client bridge to log worker
│   ├── index.ts                          # Unified module exports
│   ├── types.ts                          # Engine TypeScript interface declarations
│   ├── utils/
│   │   └── idbHelper.ts                  # High-performance IndexedDB helper
│   └── workers/
│       └── log.worker.ts                 # Web Worker off-thread logger & rehydrator
├── package-lock.json                     # NPM dependencies lockfile
├── package.json                          # Dependencies & NPM build scripts
├── script.js                             # Runtime bootstrapper helper
├── src/                                  # Primary React & TypeScript source code
│   ├── App.tsx                           # Main React application component & state hub
│   ├── SAFE_UPDATES.md                   # Safety guidelines & update logs
│   ├── components/                       # Specialized UI View modules and Modals
│   ├── config.ts                         # Global configuration constants
│   ├── contexts/                         # React context providers
│   ├── features/                         # Modular feature domains
│   ├── firebase.ts                       # Firebase initialization & auth configuration
│   ├── hooks/                            # Custom React state & lifecycle hooks
│   ├── index.css                         # Global Tailwind CSS stylesheet
│   ├── index.tsx                         # React DOM mount entry point
│   ├── lib/                              # Shared utility helpers
│   ├── services/                         # Storage, AI, geospatial & sync services
│   ├── translations.ts                   # Multi-language translation dictionary (ka/en)
│   ├── types.ts                          # Core application TypeScript interfaces
│   ├── utils/                            # Exporters, scanners & utility functions
│   └── vite-env.d.ts                     # Vite environment type declarations
├── tmp/                                  # Build temporary output cache
├── tsconfig.json                         # TypeScript compiler configuration
└── vite.config.ts                        # Vite bundler configuration
```

---

## 2. Comprehensive Root & Source File Map

### Root Configuration & System Files
* **`index.html`**: Host DOM container rendering `#root`. Injects display fonts (Plus Jakarta Sans, Playfair Display) and meta viewports for tablet responsiveness.
* **`vite.config.ts`**: Vite configuration setting up `@tailwindcss/vite` styling plugins, path aliases, and build compilation parameters.
* **`package.json`**: Primary manifest defining app dependencies (`lucide-react`, `motion`, `recharts`, `firebase`, `xlsx`) and build scripts (`npm run dev`, `npm run build`, `npm run lint`).
* **`metadata.json`**: Controls app metadata, frame permissions (`camera`, `microphone`, `geolocation`), and platform capabilities (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`).
* **`firebase-applet-config.json` & `firebase.json`**: Configures Firebase project ID, Firestore database rules, and Cloud Run deployment configuration.
* **`firestore.rules`**: Production security rules enforcing user roles (`admin`, `supervisor`, `weigher`, `picker`) across Firestore collections (`harvestEvents`, `harvestEntries`, `employees`, `transactions`).

---

### `/src` Directory Breakdown

#### Core Application Hub
* **`src/App.tsx`**: Central application state root. Manages global state arrays (`harvestEvents`, `harvestEntries`, `employees`, `transactions`, `accounts`, `machinery`, `roles`), handles sidebar/tab navigation routing, and coordinates state persistance.
* **`src/types.ts`**: Complete domain model definition file. Contains types for `HarvestEvent`, `HarvestEntry`, `AssignedPicker`, `Employee`, `Transaction`, `WorkAssignment`, `Role`, `Permission`, `PaymentModel`, etc.
* **`src/translations.ts`**: Translation dictionary covering Georgian (`ka`) and English (`en`) for all modules (weigh station, stats, payroll, agronomy, inventory, tools).
* **`src/firebase.ts`**: Initializes Firebase App, Firestore, and Authentication instances with offline persistence enabled.

#### UI Components (`/src/components/`)
* **`HarvestingStats.tsx`**: Advanced Yield & Payroll Controls modal. Displays harvest entries, crate reconciliation, variety yield details, worker role assignment, bulk rate updates, and worker search filtering.
* **`WeighStationModal.tsx`**: Live digital weigh station interface. Handles real-time scale readings, gross/tare/net weight calculations, container type selection, barcode/QR scanning, and instant entry recording.
* **`HarvestEventModal.tsx`**: Modal for creating and configuring new harvest events, assigning pickers, setting payment models (`per_weight`, `hourly`), and setting supervisor oversight.
* **`WorkAssignmentModal.tsx`**: Task assignment panel for field workers, tractors, and equipment operators.
* **`AccountingView.tsx`**: Financial management, transaction ledger, wallet balances, payroll calculations, and field cost analysis.
* **`AgronomyView.tsx`**: Crop field mapping, soil health records, irrigation schedules, and fertilization planner.
* **`InventoryView.tsx`**: Stock management for fertilizers, harvest crates, fuel, machinery parts, and agricultural chemicals.
* **`ToolsView.tsx`**: Employee directory, worker ID card generation, barcode printing, role configuration, and field management tools.
* **`Dashboard.tsx`**: Overview dashboard presenting active harvest metrics, daily yield totals, top pickers, and field weather indicators.
* **`MapComponent.tsx`**: Interactive GIS map component rendering polygon field borders, harvest blocks, tractor routes, and GPS coordinates.

#### Core Services (`/src/services/`)
* **`storageService.ts`**: Client storage adapter providing localStorage and IndexedDB fallback for offline operational resilience.
* **`SyncManager.ts` & `SyncBroker.ts`**: Delta synchronization services handling network status changes and Firestore batch updates.
* **`geminiService.ts`**: AI integration service invoking Gemini models for harvest yield prediction, field disease diagnosis, and voice commands.
* **`geospatialService.ts` & `osrmService.ts`**: GIS calculations (area measurement, distance estimation, tractor routing).
* **`varietyRegistry.ts`**: Master registry of crop varieties (e.g. blueberries, raspberries, apples) and quality grades.

---

## 3. The `/new_engine` System Architecture & Data Pipelines

The `/new_engine` workspace establishes an isolated, high-throughput integration layer that connects UI controls, hardware sensors, and background persistence off the main thread.

```
+-----------------------------------------------------------------------------------+
|                                  UI COMPONENT LAYER                               |
|   [WeighStationModal]      [HarvestingStats]     [QR/Barcode Scanner]   [GPS/Sensors] |
+-----------------------------------------------------------------------------------+
                                         │
                        1. Emit Non-Blocking Event
                                         ▼
+-----------------------------------------------------------------------------------+
|                           /new_engine/AppEventEngine.ts                           |
|                         (Central Pub/Sub Event Bus Engine)                        |
+-----------------------------------------------------------------------------------+
        │                                 │                                 │
  2. Log Action                     3. Presence                        4. Outbox
        ▼                                 ▼                                 ▼
+-----------------------+     +-----------------------+     +-----------------------+
| /new_engine/          |     | /new_engine/          |     | /new_engine/          |
| WorkerLogBridge.ts    |     | PresenceEngine.ts     |     | OutboxQueue.ts        |
+-----------------------+     +-----------------------+     +-----------------------+
        │ (Off-thread)                    │ (15s Heartbeat)                 │ (Online Sync)
        ▼                                 ▼                                 ▼
+-----------------------+     +-----------------------+     +-----------------------+
| /new_engine/workers/  |     | Active Collaborators  |     | IndexedDB             |
| log.worker.ts         |     | Presence Channel      |     | ('offline_outbox')    |
+-----------------------+     +-----------------------+     +-----------------------+
        │ (IndexedDB)                                                       │
        ▼                                                                   ▼
+-----------------------+                                   +-----------------------+
| IndexedDB             |                                   | Firestore / Backend   |
| ('delta_logs')        |                                   | Remote Synchronization|
+-----------------------+                                   +-----------------------+
```

### Data Pipeline Walkthrough

1. **Event Emission Pipeline**:
   * A field worker weighs a crate in `WeighStationModal.tsx`.
   * The UI calls `AppEngine.emitHarvestAction('ADD_ENTRY', harvestEventId, payload)`.
   * `AppEventEngine` dispatches the event asynchronously to all subscribers without stalling the UI thread.

2. **Off-Thread Logging & Rehydration Pipeline**:
   * `WorkerLogBridge` receives the `HARVEST_ACTION` event from `AppEngine`.
   * It passes the payload to `log.worker.ts` via worker message.
   * Inside `log.worker.ts`, checksum chaining is computed, and the entry is stored in IndexedDB (`delta_logs`).
   * When requested, `log.worker.ts` can rehydrate the entire harvest session state or execute a instant undo.

3. **Real-Time Presence Pipeline**:
   * `PresenceEngine` registers active users on a harvest session.
   * Throttled heartbeats (every 15s) keep the presence session active.
   * UI components subscribe via `Presence.subscribePresence(harvestId, callback)` without causing top-level React component re-renders.

4. **Offline Delta Outbox Pipeline**:
   * When the device loses connection, mutations are passed to `Outbox.enqueue(...)`.
   * Actions are saved sequentially into IndexedDB (`offline_outbox`).
   * Upon network reconnection, `OutboxQueue` drains the queue sequentially, syncing updates to Firestore with exponential backoff retry policies.
