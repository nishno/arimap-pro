
/**
 * Safe localStorage + IndexedDB hybrid storage service.
 * Prevents QuotaExceededError from crashing the app, provides high-capacity (~250MB+) 
 * asynchronous IndexedDB persistence across page refreshes, and offers usage statistics.
 */

const DB_NAME = 'AgriMapOfflineDB';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

const inMemoryStorage = new Map<string, string>();
let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// Asynchronously write to IndexedDB in background
async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
  } catch (err) {
    console.warn(`[SafeStorage IDB] Set error for key "${key}":`, err);
  }
}

// Asynchronously read from IndexedDB
async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// Asynchronously remove from IndexedDB
async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
  } catch (err) {}
}

export const safeStorage = {
  /**
   * Initializes IndexedDB cache into RAM on startup so synchronous getItem calls
   * instantly access persisted IndexedDB data even if localStorage was full/cleared.
   */
  initIndexedDB: async (): Promise<void> => {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          inMemoryStorage.set(cursor.key as string, cursor.value as string);
          cursor.continue();
        }
      };
    } catch (e) {
      console.warn('[SafeStorage] IDB warm-up skipped:', e);
    }
  },

  setItem: (key: string, value: string): boolean => {
    inMemoryStorage.set(key, value);

    // Save to IndexedDB asynchronously for high-capacity persistence
    idbSet(key, value);

    // For highly transient UI states or large fb_cache payloads (>50KB), keep them in RAM + IndexedDB
    if (key.startsWith('expanded-node-') || (key.startsWith('fb_cache_') && value.length > 50000)) {
      return true;
    }

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // Catch quota errors quietly, already persisted to RAM + IndexedDB
      return true;
    }
  },

  getItem: (key: string): string | null => {
    if (key.startsWith('expanded-node-')) {
      const memVal = inMemoryStorage.get(key);
      return memVal !== undefined ? memVal : null;
    }

    try {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
      return inMemoryStorage.get(key) || null;
    } catch (e) {
      return inMemoryStorage.get(key) || null;
    }
  },

  getItemAsync: async (key: string): Promise<string | null> => {
    const syncVal = safeStorage.getItem(key);
    if (syncVal !== null) return syncVal;
    const idbVal = await idbGet(key);
    if (idbVal !== null) {
      inMemoryStorage.set(key, idbVal);
    }
    return idbVal;
  },

  setItemAsync: async (key: string, value: string): Promise<boolean> => {
    safeStorage.setItem(key, value);
    await idbSet(key, value);
    return true;
  },

  removeItem: (key: string) => {
    inMemoryStorage.delete(key);
    idbDelete(key);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Remove failed for key "${key}".`, e);
    }
  },

  getUsage: (): number => {
    let total = 0;
    try {
      for (let x in localStorage) {
        if (!localStorage.hasOwnProperty(x)) continue;
        total += ((localStorage[x].length + x.length) * 2);
      }
    } catch (e) {}
    // typical limit is 5MB for localStorage
    const limit = 5 * 1024 * 1024;
    return (total / limit) * 100;
  },

  clearMockData: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('mock_') || key.startsWith('agri-planter-')) {
          localStorage.removeItem(key);
          inMemoryStorage.delete(key);
          idbDelete(key);
        }
      });
      window.dispatchEvent(new Event('storage'));
      return true;
    } catch (e) {
      return false;
    }
  },

  safeParse: (json: string | null, defaultValue: any): any => {
    if (!json) return defaultValue;
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error("JSON Parse Error:", e, "Source:", json.substring(0, 100) + "...");
      return defaultValue;
    }
  }
};

// Initialize IDB on import
if (typeof window !== 'undefined') {
  safeStorage.initIndexedDB();
}

