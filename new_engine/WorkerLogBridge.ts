/**
 * AgriMap Pro - Worker Log Bridge & Main Thread Client
 * /new_engine/WorkerLogBridge.ts
 * Bridges main UI thread to Web Worker for off-thread IndexedDB logging & delta rehydration.
 */

import { AppEngine } from './AppEventEngine';
import { DeltaLogEntry, RehydrationResult } from './types';
import { EngineIDB } from './utils/idbHelper';

export class LogEngine {
  private static instance: LogEngine;
  private worker: Worker | null = null;
  private pendingCallbacks: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private isWorkerSupported: boolean = false;

  private constructor() {
    this.initWorker();
    this.attachEventEngineListeners();
  }

  public static getInstance(): LogEngine {
    if (!LogEngine.instance) {
      LogEngine.instance = new LogEngine();
    }
    return LogEngine.instance;
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        // Instantiate inline blob worker or module worker safely
        this.worker = new Worker(
          new URL('./workers/log.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event) => {
          const { id, success, data, error } = event.data;
          if (this.pendingCallbacks.has(id)) {
            const { resolve, reject } = this.pendingCallbacks.get(id)!;
            this.pendingCallbacks.delete(id);
            if (success) {
              resolve(data);
            } else {
              reject(new Error(error || 'Worker operation failed'));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('[LogEngine] Web Worker error, switching to async fallback:', err);
          this.isWorkerSupported = false;
        };

        this.isWorkerSupported = true;
      } catch (e) {
        console.warn('[LogEngine] Worker instantiation failed, falling back to main-thread async storage:', e);
        this.isWorkerSupported = false;
      }
    } else {
      this.isWorkerSupported = false;
    }
  }

  private attachEventEngineListeners(): void {
    // Automatically log harvest actions sent through AppEventEngine
    AppEngine.subscribe('HARVEST_ACTION', (payload, topic) => {
      this.appendDelta(
        payload.metadata?.actionType || 'UPDATE_HARVEST',
        payload.harvestEventId,
        payload,
        payload.authorId || 'system'
      ).catch(err => console.error('[LogEngine] Auto-logging failed:', err));
    });
  }

  private sendWorkerCommand<T>(command: string, payload?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      if (this.isWorkerSupported && this.worker) {
        this.pendingCallbacks.set(id, { resolve, reject });
        this.worker.postMessage({ id, command, payload });
      } else {
        // Fallback execution on main thread using async IndexedDB
        this.executeFallbackCommand<T>(command, payload)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  private async executeFallbackCommand<T>(command: string, payload?: any): Promise<T> {
    if (command === 'APPEND_DELTA') {
      let maxSeq = 0;
      try {
        const logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');
        for (const l of logs) {
          if (typeof l.sequenceId === 'number' && l.sequenceId > maxSeq) {
            maxSeq = l.sequenceId;
          }
        }
      } catch (err) {
        maxSeq = 0;
      }

      const entry: DeltaLogEntry = {
        id: `delta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sequenceId: maxSeq + 1,
        actionType: payload.actionType,
        harvestEventId: payload.harvestEventId || 'global',
        payload: payload.payloadData,
        timestamp: Date.now(),
        authorId: payload.authorId || 'system',
        checksum: `fallback_${Date.now()}`,
      };
      await EngineIDB.put('delta_logs', entry);
      return entry as unknown as T;
    } else if (command === 'FETCH_DELTAS') {
      let logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');
      if (payload?.harvestEventId) {
        logs = logs.filter(l => l.harvestEventId === payload.harvestEventId);
      }
      return logs as unknown as T;
    } else if (command === 'REHYDRATE_HARVEST_STATE') {
      const logs = await EngineIDB.getAll<DeltaLogEntry>('delta_logs');
      return {
        currentState: payload.initialEntries || [],
        appliedCount: logs.length,
        lastSequenceId: logs.length,
        rehydratedAt: Date.now(),
        history: logs,
      } as unknown as T;
    } else if (command === 'CLEAR_ALL_LOGS') {
      await EngineIDB.clear('delta_logs');
      return { cleared: true } as unknown as T;
    }
    throw new Error(`Fallback for ${command} not implemented`);
  }

  /**
   * Append an immutable Delta Log Entry
   */
  public async appendDelta(
    actionType: string,
    harvestEventId: string,
    payloadData: any,
    authorId: string = 'system',
    deviceId?: string
  ): Promise<DeltaLogEntry> {
    return this.sendWorkerCommand<DeltaLogEntry>('APPEND_DELTA', {
      actionType,
      harvestEventId,
      payloadData,
      authorId,
      deviceId,
    });
  }

  /**
   * Fetch recorded Delta Logs for an event or globally
   */
  public async fetchDeltas(harvestEventId?: string): Promise<DeltaLogEntry[]> {
    return this.sendWorkerCommand<DeltaLogEntry[]>('FETCH_DELTAS', { harvestEventId });
  }

  /**
   * Rehydrate harvest entries state up to a target timestamp or last log
   */
  public async rehydrateHarvestState(
    harvestEventId: string,
    initialEntries: any[] = [],
    targetTimestamp?: number
  ): Promise<RehydrationResult> {
    return this.sendWorkerCommand<RehydrationResult>('REHYDRATE_HARVEST_STATE', {
      harvestEventId,
      initialEntries,
      targetTimestamp,
    });
  }

  /**
   * Undo last recorded action delta
   */
  public async undoLastDelta(): Promise<{ undoneLog: DeltaLogEntry | null; remainingCount: number }> {
    return this.sendWorkerCommand('UNDO_LAST_DELTA');
  }

  /**
   * Clear all delta logs
   */
  public async clearLogs(): Promise<{ cleared: boolean }> {
    return this.sendWorkerCommand('CLEAR_ALL_LOGS');
  }
}

// Singleton Export
export const WorkerLog = LogEngine.getInstance();
