# AgriMap Pro System Integration Engine - EXPLANATION

## 1. Executive Overview & Architecture Rationale

### When and Why Was This Integration Engine Created?
The `/new_engine` infrastructure was architected on **July 26, 2026** to establish a high-performance, event-driven foundation for AgriMap Pro without causing regressions or modifying existing operational UI logic. Field agricultural software operates under extreme environmental constraints:
- Low-spec Android/Rugged field tablets with limited CPU cores and RAM (1-2 GB usable heap).
- Intermittent or non-existent cellular coverage in remote harvest fields.
- Rapid data ingestion during peak harvests (hundreds of crate weighings, QR scans, and scale readings per minute).
- Upcoming hardware stream integrations (GPS fleet trackers, RTSP IP cameras, Bluetooth weigh scales, soil moisture sensors, weather stations, and drone telemetry).

Directly executing heavy JSON serialization, IndexedDB disk writes, or real-time network handshakes on the main UI thread causes frame drops, input lag, frozen weigh station pop-ups, and eventual browser tab crashes due to RAM exhaustion.

---

## 2. Technical Component Breakdown & Performance Protection

### A. Central Event-Driven Integration Engine (`AppEventEngine.ts`)
* **Purpose**: Provides a decoupled publish/subscribe middleware bus for all system activities and hardware inputs.
* **RAM & CPU Protection**:
  * Decouples event emitters (e.g. WeighStation UI, QR scanner) from event consumers (logging workers, sync engine, analytics).
  * Uses non-blocking asynchronous event dispatch (`setTimeout(..., 0)` / microtasks) so callers return immediately (0ms blocking time).
  * Implements a bounded circular replay buffer (default max 200 items) to prevent memory leaks over multi-hour shift usage.
* **Developer Integration**:
  ```typescript
  import { AppEngine } from '/new_engine';

  // Emit an action without blocking UI rendering
  AppEngine.emitHarvestAction('ADD_ENTRY', 'harvest_123', {
    employeeId: 'emp_456',
    netWeightKg: 14.5,
    containerType: 'Crate',
  });

  // Subscribe to hardware sensor events
  const sub = AppEngine.subscribe('HARDWARE_EVENT', (event) => {
    console.log('Scale reading:', event.telemetry?.weightKg);
  });
  ```

---

### B. Off-Thread Web Worker Logging & Delta Restoration (`workers/log.worker.ts` & `WorkerLogBridge.ts`)
* **Purpose**: Offloads heavy data processing, immutable delta stream recording, tamper-proof checksum calculation, and state rehydration/undo computations to a background Web Worker thread.
* **RAM & CPU Protection**:
  * **Zero Main Thread Jitter**: File I/O, IndexedDB transaction locking, and JSON stringification run entirely inside `log.worker.ts` on a secondary CPU core.
  * **Checksum Chaining**: Computes `checksum = hash(previousChecksum + sequenceId + payload)` off-thread to ensure tamper-evident audit logs.
  * **State Rehydration**: Allows field supervisors to restore or undo harvest sessions to any exact point in time without re-rendering or reloading the page.
* **Developer Integration**:
  ```typescript
  import { WorkerLog } from '/new_engine';

  // Rehydrate state to a specific historical timestamp or seq ID
  const rehydrated = await WorkerLog.rehydrateHarvestState('harvest_123');
  console.log('Rehydrated entries:', rehydrated.currentState);

  // Perform an instant Undo
  const undoResult = await WorkerLog.undoLastDelta();
  ```

---

### C. Real-Time Ephemeral Presence Engine (`PresenceEngine.ts`)
* **Purpose**: Google Sheets-style multi-user active collaborator tracking for shared harvest sessions.
* **RAM & CPU Protection**:
  * **Throttled Heartbeats**: Heartbeat signals fire once every 15 seconds instead of continuous polling, conserving battery and field tablet cellular bandwidth.
  * **Zero Re-render Subscriptions**: Uses an external store subscription pattern (`subscribePresence`). UI components only re-render when presence changes, avoiding React component cascade re-renders.
* **Developer Integration**:
  ```typescript
  import { Presence } from '/new_engine';

  // Announce current user presence on a harvest session
  Presence.announcePresence('harvest_123', {
    userId: 'user_789',
    userName: 'Giorgi N.',
    role: 'Supervisor',
  });

  // Listen for live collaborator changes
  const { unsubscribe } = Presence.subscribePresence('harvest_123', (users) => {
    console.log('Active field collaborators:', users);
  });
  ```

---

### D. Offline Delta Outbox Queue (`OutboxQueue.ts`)
* **Purpose**: Guarantees zero data loss during offline field operation by queuing mutations in IndexedDB and broadcasting them sequentially upon network recovery.
* **RAM & CPU Protection**:
  * **Order-Preserved Sequential Sync**: Processes items one at a time (`pending` -> `syncing` -> `synced`) to avoid network request thundering herds.
  * **Exponential Backoff**: Prevents network battery drain on weak 3G signals by backing off retries (`1s`, `2s`, `4s`, `8s`, up to `10s`).
* **Developer Integration**:
  ```typescript
  import { Outbox } from '/new_engine';

  // Queue an offline mutation
  await Outbox.enqueue('HARVEST_ACTION', 'UPDATE_WEIGHT', {
    entryId: 'entry_999',
    netWeightKg: 18.2,
  }, 'harvest_123');

  // Monitor offline queue status
  Outbox.subscribeStatus(({ pendingCount, isOnline, isSyncing }) => {
    console.log(`Outbox: ${pendingCount} pending items | Online: ${isOnline}`);
  });
  ```

---

### E. Integrated Version Audit, Session Sharing & Payroll Export Modals
* **Components**:
  * `HarvestEventHistoryModal.tsx`: Visual audit trail modal that queries sequence-indexed delta streams from `WorkerLog.fetchDeltas()` and performs instant state restoration (`RESTORE_VERSION`).
  * `ShareHarvestEventModal.tsx`: Generates session share links, QR codes, and formatted summary cards for instant supervisor dispatch via Web Share API or messaging apps.
  * `ExportExcelModal.tsx`: Flexible multi-filter CSV/Excel export tool supporting Georgian UTF-8 BOM encoding, custom column pickers, worker role filters, payment model breakdowns, and net yield calculation.

---

## 3. Guarantees & Safety Boundaries
1. **Zero Regression**: No existing files in `/src/components` or `/src/services` were rewritten or removed.
2. **Backward Compatibility**: `WorkerLogBridge` automatically detects environment capabilities and falls back gracefully to async IndexedDB on browsers where Web Workers are restricted.
3. **Hardware Ready**: `AppEventEngine` topics are ready to accept real-time streams from Bluetooth scales, RTSP IP cameras, drone surveys, and soil moisture sensors.
