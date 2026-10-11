import { getApps, initializeApp, getApp, FirebaseApp, setLogLevel } from 'firebase/app';

// Set Firebase SDK log level to error to avoid noisy internal stream assertion logs
try {
    setLogLevel('error');
} catch (e) {}
import { getAuth, Auth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { 
    initializeFirestore, 
    getFirestore,
    Firestore,
    persistentLocalCache,
    memoryLocalCache,
    persistentMultipleTabManager,
    doc as firebaseDoc,
    setDoc as firebaseSetDoc,
    updateDoc as firebaseUpdateDoc,
    deleteDoc as firebaseDeleteDoc,
    addDoc as firebaseAddDoc,
    getDoc as firebaseGetDoc,
    getDocFromServer as firebaseGetDocFromServer,
    getDocsFromServer as firebaseGetDocsFromServer,
    getDocs as firebaseGetDocs,
    onSnapshot as firebaseOnSnapshot,
    collection as firebaseCollection,
    query as firebaseQuery,
    where as firebaseWhere,
    disableNetwork as firebaseDisableNetwork,
    enableNetwork as firebaseEnableNetwork,
    writeBatch as firebaseWriteBatch,
    limit as firebaseLimit,
    orderBy as firebaseOrderBy,
    connectFirestoreEmulator,
    terminate as firebaseTerminate,
    clearIndexedDbPersistence as firebaseClearIndexedDbPersistence,
    increment as firebaseIncrement
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { USE_FIREBASE } from './config';
import { toast } from 'sonner';

/**
 * Request persistent storage to protect local caches from browser-initiated eviction
 * under low disk/memory conditions, or accidental automatic caches empty policies.
 */
export async function requestPersistentStorage(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.persist) {
        return false;
    }
    try {
        const isPersisted = await navigator.storage.persisted();
        if (isPersisted) {
            console.log('[PersistentStorage] Storage is already persisted and guarded from eviction.');
            return true;
        }
        
        const granted = await navigator.storage.persist();
        if (granted) {
            console.log('[PersistentStorage] Storage persistence granted successfully by OS.');
            return true;
        } else {
            console.warn('[PersistentStorage] OS declined storage persistence request. Standard storage limits apply.');
            return false;
        }
    } catch (err) {
        console.error('[PersistentStorage] Error requesting persistence:', err);
        return false;
    }
}

export const increment = (value: number): any => {
    if (USE_FIREBASE) return firebaseIncrement(value);
    return { type: 'increment', value };
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// Read config from env or fallback to firebase-applet-config.json
const envFirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasEnvConfig = !!(envFirebaseConfig.apiKey && envFirebaseConfig.projectId);

export const finalFirebaseConfig = hasEnvConfig 
    ? { 
        apiKey: envFirebaseConfig.apiKey,
        authDomain: envFirebaseConfig.authDomain,
        projectId: envFirebaseConfig.projectId,
        storageBucket: envFirebaseConfig.storageBucket,
        messagingSenderId: envFirebaseConfig.messagingSenderId,
        appId: envFirebaseConfig.appId,
        measurementId: envFirebaseConfig.measurementId || ""
      } 
    : firebaseConfig;

const isAiStudioProject = finalFirebaseConfig.projectId && finalFirebaseConfig.projectId.startsWith('gen-lang-client');
const firestoreDbId = (finalFirebaseConfig as any).firestoreDatabaseId || (
    (import.meta.env.DEV || isAiStudioProject) ? 'ai-studio-42204e0d-ec5c-4889-b8f7-38d7bcdb9a9d' : '(default)'
);

// Background Cloud instance for sync when in LAN mode
let cloudApp: FirebaseApp | null = null;
let cloudDb: Firestore | null = null;

if (USE_FIREBASE) {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('agrimap-firestore-bypass-persistence');
    }
    const apps = getApps();
    app = apps.find(a => a.name === '[DEFAULT]') || initializeApp(finalFirebaseConfig);
    
    // Enable persistent local IndexedDB cache with multi-tab support
    try {
        // Use a global to track if Firestore is already initialized on this specific App instance
        if (!(app as any)._db) {
            try {
                db = initializeFirestore(app, {
                    localCache: persistentLocalCache({
                        tabManager: persistentMultipleTabManager()
                    })
                }, firestoreDbId);
                console.log('[Firebase] Persistent local IndexedDB cache initialized successfully.');
            } catch (persError) {
                console.warn('[Firebase] persistentLocalCache initialization failed, falling back to memoryLocalCache:', persError);
                db = initializeFirestore(app, {
                    localCache: memoryLocalCache({})
                }, firestoreDbId);
            }
            (app as any)._db = db;
        } else {
            db = (app as any)._db;
        }
    } catch (e) {
        console.warn('[Firebase] Firestore init failed, falling back to getFirestore:', e);
        db = getFirestore(app, firestoreDbId);
    }

    // Always connect directly to the production Cloud Firebase services
    auth = getAuth(app);
} else {
    // Mock Firebase for local development
    app = {} as FirebaseApp;
    db = {
        type: 'firestore',
        _databaseId: { projectId: 'mock', database: 'mock' }
    } as any;
    auth = {
        currentUser: null,
        onAuthStateChanged: (cb: any) => {
            setTimeout(() => {
                const savedUser = localStorage.getItem('agri-planter-mock-user');
                if (savedUser) {
                    cb(JSON.parse(savedUser));
                } else {
                    cb(null);
                }
            }, 500);
            return () => {};
        },
        signOut: async () => {
            localStorage.removeItem('agri-planter-mock-user');
            return Promise.resolve();
        }
    } as any;
}

export const getCloudDb = () => {
  if (!USE_FIREBASE) return null;
  if (!cloudDb) {
    try {
      const apps = getApps();
      const existing = apps.find(a => a.name === 'cloud-sync');
      if (!existing) {
        cloudApp = initializeApp(finalFirebaseConfig, 'cloud-sync');
        cloudDb = initializeFirestore(cloudApp, {
          localCache: memoryLocalCache({})
        }, firestoreDbId);
        console.log('[Firebase] Lazy-initialized cloud sync database.');
      } else {
        cloudApp = existing;
        cloudDb = getFirestore(cloudApp, firestoreDbId);
      }
    } catch (e) {
      console.warn('[Firebase] Lazy cloud sync initialization failed:', e);
      try {
        if (cloudApp) {
          cloudDb = getFirestore(cloudApp, firestoreDbId);
        }
      } catch (e2) {}
    }
  }
  return cloudDb;
};

export const getCloudAuth = () => {
  if (!USE_FIREBASE) return null;
  if (!cloudApp) {
    getCloudDb();
  }
  return cloudApp ? getAuth(cloudApp) : null;
};

// Sync tracking logic
export interface SyncLogMetadata {
    userId?: string;
    userName?: string;
    userRole?: string;
    deviceFingerprint?: string;
    gpsMetadata?: { lat: number; lng: number } | null;
}

export interface SyncLogEntry {
    id: string;
    path: string;
    type: 'set' | 'update' | 'add' | 'delete';
    data: any;
    timestamp: string;
    status: 'pending' | 'local_synced' | 'cloud_synced' | 'error';
    errorMessage?: string;
    category?: 'harvest' | 'inventory' | 'employee' | 'map' | 'agronomy' | 'task' | 'accounting' | 'other';
    metadata?: SyncLogMetadata;
    organizationId?: string;
    idempotencyToken?: string;
}

// In-memory caches for localStorage to avoid redundant synchronous reads/writes
const localStorageInMemory: Record<string, string> = {};
const pendingWrites = new Set<string>();
let writeTimeout: any = null;

const getLocalStorageItem = (key: string): string | null => {
    if (key in localStorageInMemory) {
        return localStorageInMemory[key];
    }
    const val = localStorage.getItem(key);
    if (val !== null) {
        localStorageInMemory[key] = val;
    }
    return val;
};

const setLocalStorageItemDeferred = (key: string, value: string) => {
    localStorageInMemory[key] = value;
    pendingWrites.add(key);
    
    if (!writeTimeout) {
        writeTimeout = setTimeout(() => {
            pendingWrites.forEach(k => {
                try {
                    localStorage.setItem(k, localStorageInMemory[k]);
                } catch (e) {
                    console.warn(`[Deferred Storage] Failed to write key ${k}:`, e);
                }
            });
            pendingWrites.clear();
            writeTimeout = null;
        }, 50); // 50ms debounce
    }
};

let lastGpsCheckTime = 0;
let cachedGps: { lat: number; lng: number } | null = null;
let gpsDenied = false;

// Pre-check permissions to avoid repeated console violations and main-thread blocks inside the iframe
if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
    try {
        navigator.permissions.query({ name: 'geolocation' as any }).then((result) => {
            if (result.state === 'denied') {
                gpsDenied = true;
            }
            result.onchange = () => {
                if (result.state === 'denied') {
                    gpsDenied = true;
                } else if (result.state === 'granted') {
                    gpsDenied = false;
                }
            };
        }).catch(() => {
            gpsDenied = true;
        });
    } catch (e) {
        gpsDenied = true;
    }
}
if (typeof window !== 'undefined' && window.self !== window.top) {
    if (typeof document !== 'undefined' && 'featurePolicy' in document) {
        const fp = (document as any).featurePolicy;
        if (fp && typeof fp.allowsFeature === 'function' && !fp.allowsFeature('geolocation')) {
            gpsDenied = true;
        }
    }
}

export const trackModification = (path: string, type: 'set' | 'update' | 'add' | 'delete', data: any = null, initialStatus: SyncLogEntry['status'] = 'pending', explicitMetadata?: SyncLogMetadata, explicitOrgId?: string) => {
    try {
        // DUAL-WRITE / MIRROR COMPLIANCE:
        // Always mirror modifications to the private Local Server Node if configured.
        try {
            const savedLocalConfig = getLocalStorageItem('agrimap-local-config');
            if (savedLocalConfig) {
                const localConfig = JSON.parse(savedLocalConfig);
                if (localConfig && localConfig.isLocalMode && localConfig.serverIp) {
                    const devId = getLocalStorageItem('agrimap-device-id') || 'dev-unknown';
                    const host = localConfig.serverIp.trim();
                    const port = localConfig.serverPort || 3000;
                    const url = `http://${host}:${port}/api/sync`;
                    
                    fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            path,
                            type,
                            data,
                            deviceId: devId,
                            dataFolder: localConfig.dataFolder || '',
                            timestamp: new Date().toISOString()
                        })
                    }).catch(err => {
                        console.warn(`[Local Node Backup Alert] Node unreachable at ${url}:`, err);
                    });
                }
            }
        } catch (localNodeErr) {
            console.warn('[Local Node Backup Alert] Ignored mirror error:', localNodeErr);
        }

        // SECURITY/STABILITY: Never track guest user profile syncs. Guest is local-only.
        if (path === 'users/guest' || path.startsWith('users/guest/')) {
            return;
        }

        const syncQueueStr = getLocalStorageItem('agrimap-pending-sync');
        let syncQueue: SyncLogEntry[] = syncQueueStr ? JSON.parse(syncQueueStr) : [];
        
        // --- Deduplication Logic ---
        // If it's a specific document path (contains /), deduplicate pending updates.
        // If it's a collection path (no /) and 'add' type, we only deduplicate if data is exactly the same.
        const isDocPath = path.includes('/');
        const existingIndex = syncQueue.findIndex(item => {
            if (item.status !== 'pending') return false;
            if (isDocPath) return item.path === path;
            // For collection paths, only deduplicate if it's the same type AND data looks similar
            return item.path === path && item.type === type && JSON.stringify(item.data) === JSON.stringify(data);
        });
        
        // Infer category from path
        let category: SyncLogEntry['category'] = 'other';
        if (path.includes('harvest')) category = 'harvest';
        else if (path.includes('inventory') || path.includes('stock')) category = 'inventory';
        else if (path.includes('employees') || path.includes('users') || path.includes('dailyLogs') || path.includes('roles') || path.includes('attendance') || path.includes('workAssignments')) category = 'employee';
        else if (path.includes('map') || path.includes('plantations') || path.includes('trenches') || path.includes('plantationFeatures') || path.includes('layers')) category = 'map';
        else if (path.includes('agronomy') || path.includes('nutrition') || path.includes('protection')) category = 'agronomy';
        else if (path.includes('tasks') || path.includes('plans') || path.includes('machinery')) category = 'task';
        else if (path.includes('accounting') || path.includes('transactions') || path.includes('accounts')) category = 'accounting';

        // Gather Metadata
        const defaultOrgId = getLocalStorageItem('agri-planter-active-org') || undefined;
        let currentUser: any = null;
        try {
            currentUser = JSON.parse(getLocalStorageItem('agri-planter-session') || getLocalStorageItem('agri-planter-mock-user') || 'null');
        } catch(e) {}
        
        let deviceFingerprint = 'Unknown Device';
        if (typeof navigator !== 'undefined') {
            deviceFingerprint = `${navigator.platform || ''} ${navigator.userAgent || ''}`.trim();
        }

        const metadata: SyncLogMetadata = {
            userId: currentUser?.id,
            userName: currentUser?.name || currentUser?.email,
            userRole: currentUser?.role,
            deviceFingerprint,
            ...explicitMetadata
        };

        let deviceId = getLocalStorageItem('agrimap-device-id');
        if (!deviceId) {
            deviceId = 'uuid-' + Math.random().toString(36).substr(2, 9);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('agrimap-device-id', deviceId);
                localStorageInMemory['agrimap-device-id'] = deviceId;
            }
        }

        const newEntryTimestamp = new Date().toISOString();
        const rowId = data?.id || data?.harvestEventId || path.split('/')[1] || Math.random().toString(36).substr(2, 9);
        const derivedToken = `idem_${deviceId}_${newEntryTimestamp.replace(/[^a-zA-Z0-9]/g, '')}_${rowId}`.replace(/[^a-zA-Z0-9_]/g, '_');

        const newEntry: SyncLogEntry = {
            id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path,
            type,
            data,
            status: initialStatus,
            timestamp: newEntryTimestamp,
            category,
            metadata,
            organizationId: explicitOrgId || defaultOrgId,
            idempotencyToken: derivedToken
        };

        if (existingIndex !== -1) {
            // Update existing pending record and refresh its token to match latest state version
            const updatedTimestamp = new Date().toISOString();
            const updatedToken = `idem_${deviceId}_${updatedTimestamp.replace(/[^a-zA-Z0-9]/g, '')}_${rowId}`.replace(/[^a-zA-Z0-9_]/g, '_');
            syncQueue[existingIndex] = {
                ...syncQueue[existingIndex],
                type,
                data,
                timestamp: updatedTimestamp,
                category,
                status: initialStatus,
                metadata: { ...syncQueue[existingIndex].metadata, ...metadata },
                idempotencyToken: updatedToken
            };
        } else {
            // Add new record
            syncQueue.push(newEntry);
        }

        // Fire and forget GPS enrichment (throttled & optimized for iframe & offline speed)
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator && !gpsDenied) {
            if (cachedGps) {
                newEntry.metadata = newEntry.metadata || {};
                newEntry.metadata.gpsMetadata = cachedGps;
            }
            // Optimization: Avoid calling navigator.geolocation.getCurrentPosition inside database-level trackModification
            // because it runs inside an iframe where geolocation is blocked or restricted, which creates
            // console policy violations and slows down the main thread during high-frequency saves.
        }
        
        setLocalStorageItemDeferred('agrimap-pending-sync', JSON.stringify(syncQueue.slice(-2000))); // Increased limit for batch generation
        
        // Update local fb_cache storage so a page reload while offline keeps the changes
        try {
            const collectionName = path.split('/')[0];
            if (collectionName) {
                const cacheKey = `fb_cache_${collectionName}`;
                const cachedListStr = getLocalStorageItem(cacheKey);
                const cachedList = cachedListStr ? JSON.parse(cachedListStr) : [];
                if (Array.isArray(cachedList)) {
                    const docId = path.split('/')[1] || path;
                    const existingIdx = cachedList.findIndex((item: any) => item && (item.id === docId || item.id === path));
                    
                    if (type === 'delete') {
                        if (existingIdx !== -1) {
                            cachedList.splice(existingIdx, 1);
                        }
                    } else if (type === 'set' || type === 'update') {
                        const updatedItem = { ...data, id: docId };
                        if (existingIdx !== -1) {
                            cachedList[existingIdx] = { ...cachedList[existingIdx], ...updatedItem };
                        } else {
                            cachedList.push(updatedItem);
                        }
                    }
                    setLocalStorageItemDeferred(cacheKey, JSON.stringify(cachedList));
                    console.log(`[Offline Cache] Patched offline file cache ${cacheKey} with ${type} on ID: ${docId} (Deferred)`);
                }
            }
        } catch (cacheErr) {
            console.warn('[Offline Cache] Failed to patch list cache:', cacheErr);
        }

        window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
        
        if (initialStatus === 'pending') {
            console.log(`[SyncTracker] Queued ${type} on ${path} (${category})`);
        }
    } catch (e) {
        console.warn('Sync tracking failed', e);
    }
};

export const updateSyncStatus = (syncId: string, status: SyncLogEntry['status'], errorMessage?: string) => {
    bulkUpdateSyncStatus([syncId], status, errorMessage);
};

export const bulkUpdateSyncStatus = (syncIds: string[], status: SyncLogEntry['status'], errorMessage?: string) => {
    try {
        const idSet = new Set(syncIds);
        const syncQueue: SyncLogEntry[] = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
        const updatedQueue = syncQueue.map(item => 
            idSet.has(item.id) ? { ...item, status, errorMessage } : item
        );
        const serialized = JSON.stringify(updatedQueue);
        localStorage.setItem('agrimap-pending-sync', serialized);
        localStorageInMemory['agrimap-pending-sync'] = serialized;
        window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
    } catch (e) {
        console.warn('Sync status update failed', e);
    }
};

export const getSyncQueueSize = () => {
    try {
        return JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]').length;
    } catch {
        return 0;
    }
};

export const getDetailedSyncQueue = (): SyncLogEntry[] => {
    try {
        return JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
    } catch {
        return [];
    }
};

export const clearSyncQueue = () => {
    localStorage.removeItem('agrimap-pending-sync');
    delete localStorageInMemory['agrimap-pending-sync'];
    window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
};

export const deleteSyncLogEntries = (ids: string[]) => {
    try {
        const syncQueue: SyncLogEntry[] = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
        const updatedQueue = syncQueue.filter(entry => !ids.includes(entry.id));
        const serialized = JSON.stringify(updatedQueue);
        localStorage.setItem('agrimap-pending-sync', serialized);
        localStorageInMemory['agrimap-pending-sync'] = serialized;
        window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
    } catch (e) {
        console.error("Failed to delete sync log entries:", e);
    }
};

export const updateSyncLogEntry = (id: string, updates: Partial<SyncLogEntry>) => {
    try {
        const syncQueue: SyncLogEntry[] = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
        const updatedQueue = syncQueue.map(entry => entry.id === id ? { ...entry, ...updates } : entry);
        const serialized = JSON.stringify(updatedQueue);
        localStorage.setItem('agrimap-pending-sync', serialized);
        localStorageInMemory['agrimap-pending-sync'] = serialized;
        window.dispatchEvent(new CustomEvent('agrimap-sync-queue-updated'));
    } catch (e) {
        console.error("Failed to update sync log entry:", e);
    }
};

const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'number') {
        if (Number.isNaN(obj) || !Number.isFinite(obj)) return 0;
        return obj;
    }
    if (typeof obj !== 'object') return obj;
    
    // Handle Dates
    if (obj instanceof Date) {
        if (isNaN(obj.getTime())) return null;
        return obj.toISOString();
    }
    
    if (Array.isArray(obj)) {
        // Detect nested array (e.g. [[lat, lng], ...])
        // Firestore doesn't support nested arrays. We stringify them.
        if (obj.length > 0 && Array.isArray(obj[0])) {
            return JSON.stringify(obj);
        }
        return obj.map(sanitizeObject).filter(v => v !== undefined);
    }
    
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
        if (["password", "newPassword", "confirmPassword"].includes(key)) return;
        const value = obj[key];
        if (value !== undefined && typeof value !== 'function') {
            const sanitizedValue = sanitizeObject(value);
            if (sanitizedValue !== undefined) {
                sanitized[key] = sanitizedValue;
            }
        }
    });
    return sanitized;
};

// Export mockable Firestore functions
export const doc = (db: any, collection: string, id: string): any => {
    if (USE_FIREBASE) return firebaseDoc(db, collection, id);
    return { id, path: `${collection}/${id}`, type: 'document' } as any;
};

const getInitialSyncStatus = (): SyncLogEntry['status'] => {
    try {
        const savedConfig = localStorage.getItem('agrimap-local-config');
        const isManualOffline = localStorage.getItem('agrimap-manual-offline') === 'true';
        if (isManualOffline) return 'pending';
        
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            if (config.isLocalMode && config.serverIp) {
                return 'pending'; // Needs to go to cloud eventually
            }
        }
    } catch (e) {}
    return 'cloud_synced';
};

const runWithOfflineFallback = async (operation: () => Promise<any>, path: string) => {
    try {
        return await operation();
    } catch (error: any) {
        const errorMsg = String(error?.message || error || '').toLowerCase();
        const isOffline = 
            !navigator.onLine || 
            errorMsg.includes('offline') || 
            errorMsg.includes('unavailable') || 
            errorMsg.includes('network-request-failed') ||
            errorMsg.includes('failed to get document from server');
            
        if (isOffline) {
            console.log(`[Offline Mode] Intercepted Firestore offline write for ${path}. Saved locally.`);
            return Promise.resolve(); // resolve successfully on the client
        }
        throw error;
    }
};

export const setDoc = async (docRef: any, data: any, options?: any): Promise<any> => {
    if (USE_FIREBASE) {
        trackModification(docRef.path, 'set', data, getInitialSyncStatus());
        return runWithOfflineFallback(() => firebaseSetDoc(docRef, sanitizeObject(data), options), docRef.path);
    }
    console.log(`Mock setDoc: ${docRef.path}`, data);
    return Promise.resolve();
};

export const updateDoc = async (docRef: any, data: any): Promise<any> => {
    if (USE_FIREBASE) {
        trackModification(docRef.path, 'update', data, getInitialSyncStatus());
        return runWithOfflineFallback(() => firebaseUpdateDoc(docRef, sanitizeObject(data)), docRef.path);
    }
    console.log(`Mock updateDoc: ${docRef.path}`, data);
    return Promise.resolve();
};

export const deleteDoc = async (docRef: any): Promise<any> => {
    if (USE_FIREBASE) {
        trackModification(docRef.path, 'delete', null, getInitialSyncStatus());
        return runWithOfflineFallback(() => firebaseDeleteDoc(docRef), docRef.path);
    }
    console.log(`Mock deleteDoc: ${docRef.path}`);
    return Promise.resolve();
};

export const addDoc = async (colRef: any, data: any): Promise<any> => {
    if (USE_FIREBASE) {
        try {
            const result = await firebaseAddDoc(colRef, sanitizeObject(data));
            trackModification(`${colRef.path}/${result.id}`, 'set', data, getInitialSyncStatus());
            return result;
        } catch (error: any) {
            const errorMsg = String(error?.message || error || '').toLowerCase();
            const isOffline = 
                !navigator.onLine || 
                errorMsg.includes('offline') || 
                errorMsg.includes('unavailable') || 
                errorMsg.includes('network-request-failed') ||
                errorMsg.includes('failed to get document from server');
                
            if (isOffline) {
                const fallbackId = `off-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                console.log(`[Offline Mode] Intercepted addDoc offline for ${colRef.path}. Generated local ID: ${fallbackId}`);
                
                const enrichedData = { ...data, id: fallbackId };
                trackModification(`${colRef.path}/${fallbackId}`, 'set', enrichedData, 'pending');
                
                return { id: fallbackId, path: `${colRef.path}/${fallbackId}` };
            }
            throw error;
        }
    }
    console.log(`Mock addDoc to ${colRef.path}`, data);
    return Promise.resolve({ id: `mock-id-${Date.now()}` });
};

export const getDoc = async (docRef: any): Promise<any> => {
    if (USE_FIREBASE) {
        try {
            return await firebaseGetDoc(docRef);
        } catch (error) {
            console.warn('[Firebase Firewalled Fetch] getDoc failed, auto-falling back to cached empty state:', error);
            if (typeof window !== 'undefined' && (window as any).__agrimapSetBackgroundSync) {
                (window as any).__agrimapSetBackgroundSync(true);
            }
            return { exists: () => false, data: () => null };
        }
    }
    return Promise.resolve({ exists: () => false, data: () => null });
};

export const getDocFromServer = async (docRef: any): Promise<any> => {
    if (USE_FIREBASE) {
        try {
            return await firebaseGetDocFromServer(docRef);
        } catch (error) {
            console.warn('[Firebase Firewalled Fetch] getDocFromServer failed, auto-falling back to cached empty state:', error);
            if (typeof window !== 'undefined' && (window as any).__agrimapSetBackgroundSync) {
                (window as any).__agrimapSetBackgroundSync(true);
            }
            return { exists: () => false, data: () => null };
        }
    }
    return Promise.resolve({ exists: () => false, data: () => null });
};

export const getDocsFromServer = async (q: any): Promise<any> => {
    if (USE_FIREBASE) {
        try {
            return await firebaseGetDocsFromServer(q);
        } catch (error) {
            console.warn('[Firebase Firewalled Fetch] getDocsFromServer failed, auto-falling back to cached empty state:', error);
            if (typeof window !== 'undefined' && (window as any).__agrimapSetBackgroundSync) {
                (window as any).__agrimapSetBackgroundSync(true);
            }
            return { empty: true, docs: [] };
        }
    }
    return Promise.resolve({ empty: true, docs: [] });
};

export const getDocs = async (q: any): Promise<any> => {
    if (USE_FIREBASE) {
        try {
            return await firebaseGetDocs(q);
        } catch (error) {
            console.warn('[Firebase Firewalled Fetch] getDocs failed, auto-falling back to cached empty state:', error);
            if (typeof window !== 'undefined' && (window as any).__agrimapSetBackgroundSync) {
                (window as any).__agrimapSetBackgroundSync(true);
            }
            return { empty: true, docs: [] };
        }
    }
    return Promise.resolve({ empty: true, docs: [] });
};

export const onSnapshot = (q: any, cb: any, errCb?: any): any => {
    if (USE_FIREBASE) {
        // Intercept snapshot stream
        const wrappedCb = (snapshot: any) => {
            try {
                const fromCache = snapshot?.metadata?.fromCache === true;
                if (typeof window !== 'undefined' && (window as any).__agrimapSetBackgroundSync) {
                    (window as any).__agrimapSetBackgroundSync(fromCache);
                }
                cb(snapshot);
            } catch (err: any) {
                console.error('[Firebase Snapshot Interceptor] Uncaught exception inside snapshot listener callback:', err);
            }
        };

        const wrappedErrCb = (error: any) => {
            const errStr = String(error?.message || error || '');
            if (
                errStr.includes('INTERNAL ASSERTION FAILED') || 
                errStr.includes('Unexpected state') || 
                errStr.includes('da08') || 
                errStr.includes('Target ID already exists') ||
                errStr.includes('Eu.get') ||
                errStr.includes('not iterable') ||
                errStr.includes('removeAndCleanupTarget')
            ) {
                console.warn('[Firebase Snapshot Interceptor] Handled internal Firestore assertion state error:', errStr);
                return;
            }
            console.warn('[Firebase Snapshot Interceptor] Caught background stream error:', error);
            if (typeof window !== 'undefined' && (window as any).__agrimapSetBackgroundSync) {
                (window as any).__agrimapSetBackgroundSync(true);
            }
            if (errCb) {
                try {
                    errCb(error);
                } catch (e) {
                    console.error('[Firebase Snapshot Interceptor] Error in error callback:', e);
                }
            }
        };

        try {
            const rawUnsub = firebaseOnSnapshot(q, wrappedCb, wrappedErrCb);
            let hasUnsubscribed = false;
            return () => {
                if (hasUnsubscribed) return;
                hasUnsubscribed = true;
                try {
                    if (typeof rawUnsub === 'function') {
                        rawUnsub();
                    }
                } catch (unsubErr: any) {
                    console.warn('[Firebase Snapshot Interceptor] Handled unlisten/teardown exception:', unsubErr);
                }
            };
        } catch (syncErr: any) {
            console.warn('[Firebase Snapshot Interceptor] Synchronous onSnapshot call error:', syncErr);
            return () => {};
        }
    }
    // Return empty snapshot immediately
    setTimeout(() => {
        try {
            cb({ docs: [] });
        } catch (e) {
            console.error('[Firebase Snapshot Interceptor] Error in mock snapshot callback:', e);
        }
    }, 0);
    return () => {};
};

export const collection = (db: any, path: string): any => {
    if (USE_FIREBASE) return firebaseCollection(db, path);
    return { path, type: 'collection' } as any;
};

export const query = (colRef: any, ...constraints: any[]): any => {
    if (USE_FIREBASE) return firebaseQuery(colRef, ...constraints);
    return { colRef, constraints } as any;
};

export const where = (field: string, op: string, value: any): any => {
    if (USE_FIREBASE) {
        // FORWARD RECOVERY: Prevent 'undefined' from crashing Firestore queries.
        // Convert undefined to null which is a valid Firestore value.
        const safeValue = value === undefined ? null : value;
        return firebaseWhere(field, op as any, safeValue);
    }
    return { field, op, value } as any;
};

export const limit = (n: number): any => {
    if (USE_FIREBASE) return firebaseLimit(n);
    return { type: 'limit', n } as any;
};

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): any => {
    if (USE_FIREBASE) return firebaseOrderBy(field, dir);
    return { type: 'orderBy', field, dir } as any;
};

export const enableNetwork = async (dbInstance: any): Promise<void> => {
    if (USE_FIREBASE && dbInstance) {
        try {
            return await firebaseEnableNetwork(dbInstance);
        } catch (e) {
            console.warn('[Firebase] enableNetwork warning caught:', e);
        }
    }
    return Promise.resolve();
};

export const disableNetwork = async (dbInstance: any): Promise<void> => {
    if (USE_FIREBASE && dbInstance) {
        try {
            return await firebaseDisableNetwork(dbInstance);
        } catch (e) {
            console.warn('[Firebase] disableNetwork warning caught:', e);
        }
    }
    return Promise.resolve();
};

export const writeBatch = (db: any): any => {
    if (USE_FIREBASE) {
        const batch = firebaseWriteBatch(db);
        return {
            set: (docRef: any, data: any, options?: any) => batch.set(docRef, sanitizeObject(data), options),
            update: (docRef: any, data: any) => batch.update(docRef, sanitizeObject(data)),
            delete: (docRef: any) => batch.delete(docRef),
            commit: () => runWithOfflineFallback(() => batch.commit(), 'batch-commit')
        };
    }
    return {
        set: () => {},
        update: () => {},
        delete: () => {},
        commit: async () => Promise.resolve()
    } as any;
};

let lastNetworkState: boolean | null = null;

export const setConnectionState = async (healthy: boolean): Promise<void> => {
    if (!USE_FIREBASE) return;
    const isManualOffline = typeof localStorage !== 'undefined' && localStorage.getItem('agrimap-manual-offline') === 'true';
    if (healthy && isManualOffline) {
        if (lastNetworkState !== false) {
            lastNetworkState = false;
            try {
                await firebaseDisableNetwork(db);
                console.log('[Firebase] Manual offline mode active: Firestore network disabled');
            } catch (e) {}
        }
        return;
    }
    if (lastNetworkState === healthy) return;
    lastNetworkState = healthy;
    try {
        if (healthy) {
            await firebaseEnableNetwork(db);
            console.log('[Firebase] Enabled network mode (Cloud Online)');
        } else {
            await firebaseDisableNetwork(db);
            console.log('[Firebase] Disabled network mode (Offline Cache Priority Mode)');
        }
    } catch (e) {
        console.warn('[Firebase] setConnectionState failed:', e);
    }
};

export const testFirestoreConnection = async (timeoutMs = 2500): Promise<boolean> => {
    if (!USE_FIREBASE) return true;
    
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return false;
    }

    if (typeof localStorage !== 'undefined' && localStorage.getItem('agrimap-manual-offline') === 'true') {
        return false;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Ping a reliable public endpoint to verify actual cloud/internet connectivity (not local server)
        await fetch('https://www.gstatic.com/generate_204', {
            method: 'GET',
            mode: 'no-cors',
            signal: controller.signal,
            cache: 'no-store'
        });

        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        return false;
    }
};

export const resetFirestorePersistence = async () => {
    if (!USE_FIREBASE) return;
    try {
        await firebaseTerminate(db);
        await firebaseClearIndexedDbPersistence(db);
        // Also clear our sync tracking if requested (maybe we should keep it?)
        // localStorage.removeItem('agrimap-pending-sync');
        window.location.reload();
    } catch (e) {
        console.error('Failed to reset persistence', e);
    }
};

export { db, auth };
export default app;

// Google Workspace / Chat / Meet / Sheets / Drive Auth Logic
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive'
];

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('[Firebase] A Google Sign-In is already in progress.');
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errCode = error?.code || '';
    const errMsg = error?.message || '';
    
    if (
      errCode === 'auth/popup-closed-by-user' ||
      errMsg.includes('popup-closed-by-user') ||
      errCode === 'auth/cancelled-popup-request' ||
      errMsg.includes('cancelled-popup-request')
    ) {
      console.info('[Firebase] Google Sign-In popup closed or cancelled by user.');
      toast.info("Google Sign-In was cancelled.");
      return null;
    }

    if (errCode === 'auth/popup-blocked' || errMsg.includes('popup-blocked') || errMsg.includes('popup blocked')) {
      console.warn('[Firebase] Google Sign-In popup was blocked by browser.');
      toast.error("Google Sign-In popup was blocked by your browser. Please enable popups in your browser settings or click the 'Open in New Tab' button to login.");
      return null;
    }

    console.error('Sign in error:', error);
    toast.error(`Sign in error: ${error?.message || 'Authentication failed'}`);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};