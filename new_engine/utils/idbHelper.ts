/**
 * AgriMap Pro - Engine IndexedDB Helper
 * /new_engine/utils/idbHelper.ts
 * High-performance, zero-dependency IndexedDB wrapper compatible with Main Thread & Web Workers.
 */

const DB_NAME = 'agrimap_engine_db';
const DB_VERSION = 2;

export interface IDBStores {
  delta_logs: 'delta_logs';
  offline_outbox: 'offline_outbox';
  system_snapshots: 'system_snapshots';
}

export class EngineIDB {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  public static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      // IndexedDB check in worker or window context
      const indexedDBImpl = 
        typeof indexedDB !== 'undefined' 
          ? indexedDB 
          : typeof self !== 'undefined' && self.indexedDB 
            ? self.indexedDB 
            : null;

      if (!indexedDBImpl) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = indexedDBImpl.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;

        // Store 1: Immutable Delta Logs
        if (!db.objectStoreNames.contains('delta_logs')) {
          const logStore = db.createObjectStore('delta_logs', { keyPath: 'id' });
          logStore.createIndex('sequenceId', 'sequenceId', { unique: false });
          logStore.createIndex('harvestEventId', 'harvestEventId', { unique: false });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        } else {
          // If upgrading from DB_VERSION 1 where sequenceId had { unique: true }, recreate without unique constraint
          const tx = request.transaction;
          if (tx) {
            try {
              const logStore = tx.objectStore('delta_logs');
              if (logStore.indexNames.contains('sequenceId')) {
                logStore.deleteIndex('sequenceId');
              }
              logStore.createIndex('sequenceId', 'sequenceId', { unique: false });
            } catch (err) {
              console.warn('[EngineIDB] Error re-indexing sequenceId on upgrade:', err);
            }
          }
        }

        // Store 2: Offline Outbox Queue
        if (!db.objectStoreNames.contains('offline_outbox')) {
          const outboxStore = db.createObjectStore('offline_outbox', { keyPath: 'id' });
          outboxStore.createIndex('status', 'status', { unique: false });
          outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store 3: System State Snapshots
        if (!db.objectStoreNames.contains('system_snapshots')) {
          db.createObjectStore('system_snapshots', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // Generic Put Item
  public static async put<T>(storeName: 'delta_logs' | 'offline_outbox' | 'system_snapshots', item: T): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Generic Get All Items
  public static async getAll<T>(storeName: 'delta_logs' | 'offline_outbox' | 'system_snapshots'): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  // Get Items by Index Range / Query
  public static async getByIndex<T>(
    storeName: 'delta_logs' | 'offline_outbox',
    indexName: string,
    query: IDBValidKey | IDBKeyRange
  ): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(query);
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  // Delete Item by Key
  public static async delete(storeName: 'delta_logs' | 'offline_outbox' | 'system_snapshots', key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Count items
  public static async count(storeName: 'delta_logs' | 'offline_outbox'): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Clear Store
  public static async clear(storeName: 'delta_logs' | 'offline_outbox' | 'system_snapshots'): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
