# Architecture and source inventory

## Existing implementation

- `src/components/WeighStationModal.tsx`: 4,721 lines at the starting revision; statically imports jsQR, scanner helpers, camera and Bluetooth/HID UI. Includes animation-frame scan loops, a debounce and a crate duplicate check. Existing safety logic must be preserved and mapped, not assumed absent.
- `src/components/Harvesting/HarvestDashboard.tsx`: 3,504 lines; imports and opens the existing weigh station.
- `src/components/SystemManagement/HardwareLabs/HardwareTestingSandboxMap.tsx`: 4,709 lines; hardware map/sandbox responsibilities remain to be inventoried in detail.
- Actual domain collections: `harvestEvents`, `harvestEntries`, `employees`, `inventoryItems`, `stockTransactions`.
- `server/terminal.mjs` is the existing CLI hidden-password reader. It is NOT the weighing service. New service: `server/weigh-terminal.mjs`.

These are source measurements, not CPU benchmarks. No live scale/printer/camera was connected.

## First independent entry

`terminal/index.html` → `src/terminal/main.tsx` + `storage.ts` + `terminal.css`. Vite builds this independently alongside Core. It imports React, not ProductionApp, Firebase, mapping or 3D modules. The terminal-specific JS was approximately 11 KB uncompressed at the first build, plus the shared React vendor chunk. Future builds may differ.

Core still imports the old weigh station. This first pilot does not yet reduce the existing Core bundle; legacy removal waits for parity.

LAN Core opens the same-origin terminal in a modal iframe or a separate tab. The existing HttpOnly LAN cookie authenticates API requests. No credential is placed in a URL. External-origin launch and token exchange are not implemented yet.

## Target applications

Core manages domain records and reports. Vision handles video; IoT handles ingestion and tracking; Drone handles 3D/mission integration; Weigh handles operational hardware loops. A server API owns business effects. Cloud-only users need no PC, but their physical devices may still require a gateway.

A farm has one configured authority. LAN/Cloud backup and multi-authority synchronization must not be conflated. No silent backend switching.
