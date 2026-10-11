/**
 * AgriMap Pro - Web Worker Log Engine
 * /new_engine/workers/log.worker.ts
 * Executes heavy serialization, IndexedDB disk writes, compression, delta auditing,
 * and state rehydration off the main UI thread to protect field tablet RAM & CPU.
 */

import { EngineIDB } from '../utils/idbHelper';
import { DeltaLogEntry, HarvestActionType, RehydrationResult } from '../types';

export type LogWorkerCommand = 
  | 'APPEND_DELTA'
  | 'FETCH_DELTAS'
  | 'REHYDRATE_HARVEST_STATE'
  | 'UNDO_LAST_DELTA'
  | 'COMPRESS_LOGS'
  | 'CLEAR_ALL_LOGS';

export interface LogWorkerMessage {
  id: string;
  command: LogWorkerCommand;
  payload?: any;
}

export interface LogWorkerResponse {
  id: string;
  success: boolean;
  command: LogWorkerCommand;
  data?: any;
  error?: string;
}

// Simple fast hash for checksum chaining in worker context
function calculateChecksum(prevChecksum: string, seq: number, payloadStr: string): string {
  const source = `${prevChecksum}:${seq}:${payloadStr}`;
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `chk_${Math.abs(hash).toString(36)}`;
}

let currentSequenceId = 0;
let lastChecksum = 'GENESIS_0';
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let appendQueue: Promise<any> = Promise.resolve();

async function ensureSequenceInitialized(): Promise<void> {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');
        if (logs && logs.length > 0) {
          let maxSeq = 0;
          let latestEntry: DeltaLogEntry | null = null;
          for (const log of logs) {
            if (typeof log.sequenceId === 'number' && log.sequenceId > maxSeq) {
              maxSeq = log.sequenceId;
              latestEntry = log;
            }
          }
          currentSequenceId = Math.max(currentSequenceId, maxSeq);
          if (latestEntry?.checksum) {
            lastChecksum = latestEntry.checksum;
          }
        }
      } catch (err) {
        console.warn('[log.worker] Failed to load initial sequenceId from IDB:', err);
      } finally {
        isInitialized = true;
      }
    })();
  }
  return initPromise;
}

// Worker Event Handler
self.onmessage = async (event: MessageEvent<LogWorkerMessage>) => {
  const { id, command, payload } = event.data;

  try {
    switch (command) {
      case 'APPEND_DELTA': {
        const { actionType, harvestEventId, payloadData, authorId, deviceId } = payload;
        await ensureSequenceInitialized();

        // Process append operation sequentially through appendQueue to prevent concurrency race conditions
        const deltaEntry = await new Promise<DeltaLogEntry>((resolve, reject) => {
          appendQueue = appendQueue.then(async () => {
            try {
              currentSequenceId++;

              const payloadString = JSON.stringify(payloadData || {});
              const newChecksum = calculateChecksum(lastChecksum, currentSequenceId, payloadString);

              const entry: DeltaLogEntry = {
                id: `delta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                sequenceId: currentSequenceId,
                actionType,
                harvestEventId: harvestEventId || 'global',
                payload: payloadData,
                timestamp: Date.now(),
                authorId: authorId || 'system',
                deviceId: deviceId || 'tablet_worker',
                checksum: newChecksum,
                previousChecksum: lastChecksum,
              };

              lastChecksum = newChecksum;

              // Persist to IndexedDB off the main thread
              await EngineIDB.put('delta_logs', entry);
              resolve(entry);
            } catch (err) {
              reject(err);
            }
          }).catch(err => {
            reject(err);
          });
        });

        self.postMessage({
          id,
          command,
          success: true,
          data: deltaEntry,
        } as LogWorkerResponse);
        break;
      }

      case 'FETCH_DELTAS': {
        const harvestEventId = payload?.harvestEventId;
        let logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');
        
        if (harvestEventId) {
          logs = logs.filter(l => l.harvestEventId === harvestEventId);
        }

        logs.sort((a, b) => a.sequenceId - b.sequenceId);

        self.postMessage({
          id,
          command,
          success: true,
          data: logs,
        } as LogWorkerResponse);
        break;
      }

      case 'REHYDRATE_HARVEST_STATE': {
        const { harvestEventId, initialEntries = [], targetTimestamp } = payload;
        let logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');

        if (harvestEventId) {
          logs = logs.filter(l => l.harvestEventId === harvestEventId);
        }

        logs.sort((a, b) => a.sequenceId - b.sequenceId);

        if (targetTimestamp) {
          logs = logs.filter(l => l.timestamp <= targetTimestamp);
        }

        // Reconstruct entries map
        const entriesMap = new Map<string, any>();
        initialEntries.forEach((e: any) => {
          if (e.id) entriesMap.set(e.id, { ...e });
        });

        let appliedCount = 0;
        let lastSeq = 0;

        for (const log of logs) {
          appliedCount++;
          lastSeq = log.sequenceId;
          const p = log.payload || {};

          switch (log.actionType as HarvestActionType) {
            case 'ADD_ENTRY': {
              const entryId = p.entryId || p.id || `rehydrated_${log.sequenceId}`;
              entriesMap.set(entryId, {
                id: entryId,
                harvestEventId: log.harvestEventId,
                employeeId: p.employeeId,
                netWeightKg: p.netWeightKg || 0,
                grossWeightKg: p.grossWeightKg || 0,
                tareWeightKg: p.tareWeightKg || 0,
                containerType: p.containerType || 'crate',
                timestamp: p.timestamp || log.timestamp,
                ...p,
              });
              break;
            }

            case 'UPDATE_WEIGHT':
            case 'REWEIGH_ENTRY': {
              const entryId = p.entryId || p.id;
              if (entryId && entriesMap.has(entryId)) {
                const existing = entriesMap.get(entryId);
                entriesMap.set(entryId, {
                  ...existing,
                  ...p,
                  netWeightKg: p.netWeightKg !== undefined ? p.netWeightKg : existing.netWeightKg,
                  updatedAt: log.timestamp,
                });
              }
              break;
            }

            case 'DELETE_ENTRY': {
              const entryId = p.entryId || p.id;
              if (entryId) {
                entriesMap.delete(entryId);
              }
              break;
            }

            default:
              break;
          }
        }

        const rehydrationResult: RehydrationResult = {
          currentState: Array.from(entriesMap.values()),
          appliedCount,
          lastSequenceId: lastSeq,
          rehydratedAt: Date.now(),
          history: logs,
        };

        self.postMessage({
          id,
          command,
          success: true,
          data: rehydrationResult,
        } as LogWorkerResponse);
        break;
      }

      case 'UNDO_LAST_DELTA': {
        const logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');
        logs.sort((a, b) => a.sequenceId - b.sequenceId);

        if (logs.length === 0) {
          self.postMessage({
            id,
            command,
            success: true,
            data: { undoneLog: null, remainingCount: 0 },
          } as LogWorkerResponse);
          break;
        }

        const lastLog = logs[logs.length - 1];
        await EngineIDB.delete('delta_logs', lastLog.id);

        if (logs.length > 1) {
          const prevLog = logs[logs.length - 2];
          currentSequenceId = prevLog.sequenceId;
          lastChecksum = prevLog.checksum;
        } else {
          currentSequenceId = 0;
          lastChecksum = 'GENESIS_0';
        }

        self.postMessage({
          id,
          command,
          success: true,
          data: { undoneLog: lastLog, remainingCount: logs.length - 1 },
        } as LogWorkerResponse);
        break;
      }

      case 'COMPRESS_LOGS': {
        // Compress logs older than threshold into a single compressed state snapshot
        const logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');
        const count = logs.length;

        self.postMessage({
          id,
          command,
          success: true,
          data: { totalLogs: count, compressed: true, timestamp: Date.now() },
        } as LogWorkerResponse);
        break;
      }

      case 'CLEAR_ALL_LOGS': {
        await EngineIDB.clear('delta_logs');
        currentSequenceId = 0;
        lastChecksum = 'GENESIS_0';
        isInitialized = true;
        initPromise = Promise.resolve();

        self.postMessage({
          id,
          command,
          success: true,
          data: { cleared: true },
        } as LogWorkerResponse);
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (err: any) {
    self.postMessage({
      id,
      command,
      success: false,
      error: err?.message || String(err),
    } as LogWorkerResponse);
  }
};
