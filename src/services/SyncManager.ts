import { db, auth, getCloudDb, getCloudAuth, SyncLogEntry, updateSyncStatus, bulkUpdateSyncStatus, getDocFromServer, getDoc, increment } from '../firebase';
import { 
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    collection,
    writeBatch
} from '../firebase';
import { toast } from 'sonner';

/**
 * Resolves potential collisions on parent records (e.g., harvestEvents totals, inventoryItems stocks, drawn map features)
 * by querying current server state and calculating precise atomic increments or union arrays.
 */
async function applySmartCollisionMerge(
    syncDb: any, 
    colPath: string, 
    docId: string, 
    localItem: SyncLogEntry, 
    batch: any,
    allPendingItems?: SyncLogEntry[]
): Promise<boolean> {
    const docRef = doc(syncDb, colPath, docId);
    
    try {
        let serverDoc: any = null;
        try {
            serverDoc = await getDocFromServer(docRef);
        } catch (fetchErr) {
            console.warn(`[SyncManager] getDocFromServer failed for ${colPath}/${docId}, falling back to getDoc:`, fetchErr);
            try {
                serverDoc = await getDoc(docRef);
            } catch (fallbackErr) {
                console.warn(`[SyncManager] Cache fallback also failed for ${colPath}/${docId}:`, fallbackErr);
            }
        }

        if (!serverDoc || !serverDoc.exists()) {
            // Document doesn't exist on server yet - safe to do absolute set
            batch.set(docRef, localItem.data);
            return true;
        }

        const serverData = serverDoc.data() || {};

        if (colPath === 'harvestEvents') {
            // Sum up pending entries in this sync session to get the EXACT deltas
            const queue: SyncLogEntry[] = allPendingItems || JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
            const pendingEntriesForEvent = queue.filter(item => 
                item.path.startsWith('harvestEntries/') && 
                (allPendingItems ? true : (item.status === 'pending' || item.status === 'error')) &&
                item.data && String(item.data.harvestEventId) === String(docId)
            );

            const serverWeight = parseFloat(serverData.totalNetWeightKg) || 0;
            const hasZeroServerTotals = serverWeight === 0;

            // CRITICAL SYNC RESILIENCE FIX:
            // If there are no pending entries in the queue, or if the server has zero totals but the client has actual values,
            // we MUST write the client's absolute values directly to prevent wiping out data or staying at zero.
            if (pendingEntriesForEvent.length === 0 || (hasZeroServerTotals && (localItem.data.totalNetWeightKg || 0) > 0)) {
                batch.update(docRef, {
                    ...localItem.data,
                    isSyncRequired: false,
                    syncedAt: new Date().toISOString()
                });
                console.info(`[SyncManager] Synced harvestEvents/${docId} with absolute values (Pending items: ${pendingEntriesForEvent.length}, Server weight: ${serverWeight}kg).`);
                return true;
            }

            // Calculate precise increments and decrements (deletions) from pending entries
            let deltaWeight = 0;
            let deltaBoxes = 0;
            let deltaGross = 0;

            // Reconstruct variety tallies safely by combining lists
            const mergedYields = [...(serverData.yieldByVariety || [])];

            pendingEntriesForEvent.forEach(item => {
                const isDeleted = item.data.isDeleted === true || item.data.status === 'deleted';
                const weight = parseFloat(item.data.netWeightKg) || 0;
                const boxes = parseInt(item.data.boxCount) || 1;
                const gross = parseFloat(item.data.grossWeightKg ?? item.data.netWeightKg) || 0;

                if (isDeleted) {
                    deltaWeight -= weight;
                    deltaBoxes -= boxes;
                    deltaGross -= gross;

                    if (item.data.variety) {
                        const matchIdx = mergedYields.findIndex(y => y.variety === item.data.variety);
                        if (matchIdx > -1) {
                            mergedYields[matchIdx].weightKg -= weight;
                            if (mergedYields[matchIdx].weightKg < 0) {
                                mergedYields[matchIdx].weightKg = 0;
                            }
                        }
                    }
                } else {
                    deltaWeight += weight;
                    deltaBoxes += boxes;
                    deltaGross += gross;

                    if (item.data.variety) {
                        const matchIdx = mergedYields.findIndex(y => y.variety === item.data.variety);
                        if (matchIdx > -1) {
                            mergedYields[matchIdx].weightKg += weight;
                        } else {
                            mergedYields.push({ variety: item.data.variety, weightKg: weight });
                        }
                    }
                }
            });

            // Clean up variety list to filter out zero weight entries
            const finalYields = mergedYields.filter(y => y.weightKg > 0);

            // Safely omit absolute values from localItem.data so we don't overwrite the atomic increments!
            const { 
                totalNetWeightKg, 
                totalBoxes, 
                totalGrossWeightKg, 
                yieldByVariety, 
                isSyncRequired, 
                syncedAt, 
                ...remainingLocalData 
            } = localItem.data || {};

            // Perform server-side atomic updates so no concurrent tablet data is overwritten!
            batch.update(docRef, {
                ...remainingLocalData,
                totalNetWeightKg: increment(deltaWeight),
                totalBoxes: increment(deltaBoxes),
                totalGrossWeightKg: increment(deltaGross),
                yieldByVariety: finalYields,
                isSyncRequired: false,
                syncedAt: new Date().toISOString()
            });

            console.info(`[SyncManager] Merged harvestEvents/${docId} atomically: +${deltaWeight}kg, +${deltaBoxes} crates.`);
            return true;
        } 
        
        if (colPath === 'inventoryItems') {
            // For stock levels, avoid overwriting with stale client numbers
            // Calculate delta of stock change from localItem data
            const serverStock = parseFloat(serverData.currentStock) || 0;
            const localStock = parseFloat(localItem.data.currentStock) || 0;
            
            // Try to find the pre-edited cache value to compute exact offset, falling back to simple difference or 0
            const cacheStr = localStorage.getItem('fb_cache_inventoryItems');
            let originalCacheVal = localStock;
            if (cacheStr) {
                try {
                    const cacheArr = JSON.parse(cacheStr);
                    const matchedItem = cacheArr.find((i: any) => i.id === docId);
                    if (matchedItem) {
                        originalCacheVal = parseFloat(matchedItem.currentStock) || localStock;
                    }
                } catch (e) {}
            }
            
            const deltaOffset = localStock - originalCacheVal;
            
            // Safely omit currentStock and syncedAt from the metadata update to avoid overwriting!
            const { currentStock, syncedAt, ...remainingInventoryData } = localItem.data || {};

            if (deltaOffset !== 0) {
                batch.update(docRef, {
                    ...remainingInventoryData,
                    currentStock: increment(deltaOffset),
                    syncedAt: new Date().toISOString()
                });
                console.info(`[SyncManager] Merged inventoryItems/${docId} atomically: stock offset delta of ${deltaOffset}`);
            } else {
                // If no delta, just update metadata safely
                batch.update(docRef, {
                    ...remainingInventoryData,
                    syncedAt: new Date().toISOString()
                });
            }
            return true;
        }

        if (colPath === 'plantationFeatures') {
            // For map features drawn or modified, combine opex log arrays and details safely
            const mergedOpex = [...(serverData.historicalOpex || [])];
            (localItem.data.historicalOpex || []).forEach((item: any) => {
                if (!mergedOpex.some(o => o.id === item.id)) {
                    mergedOpex.push(item);
                }
            });

            batch.update(docRef, {
                ...localItem.data,
                historicalOpex: mergedOpex,
                syncedAt: new Date().toISOString()
            });
            console.info(`[SyncManager] Merged plantationFeatures/${docId} arrays safely.`);
            return true;
        }

        // Default: update other fields while maintaining ID
        batch.update(docRef, {
            ...localItem.data,
            syncedAt: new Date().toISOString()
        });
        return true;

    } catch (err) {
        console.warn(`[SyncManager] Could not perform transaction-merge, falling back to overwriting for ${colPath}/${docId}:`, err);
        // Fallback: batch write absolutely
        if (localItem.type === 'set') {
            batch.set(docRef, localItem.data);
        } else {
            batch.update(docRef, localItem.data);
        }
        return false;
    }
}

/**
 * Manages data synchronization between local storage (Offline), 
 * a Local Network Server, and Google Cloud Firestore.
 */
export const syncManager = {
    /**
     * Pushes all pending local operations to the cloud.
     * Works even when the app is currently pointing to a LAN server.
     */
    pushAllToCloud: async () => {
        const savedLocalConfig = localStorage.getItem('agrimap-local-config');
        let isLocalMode = false;
        try {
            if (savedLocalConfig) isLocalMode = JSON.parse(savedLocalConfig).isLocalMode;
        } catch (e) {}

        // Crucial: Use primary authenticated 'db' if we are not in local emulator mode.
        const syncDb = isLocalMode ? getCloudDb() : db;

        if (!syncDb) {
            toast.error("Database configuration missing.");
            return false;
        }

        const syncQueue: SyncLogEntry[] = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
        
        // AUTO-CLEANUP: Mark guest profile syncs as completed immediately. They should never have been queued for Cloud.
        const invalidSyncIds = syncQueue
            .filter(i => i.status === 'pending' && (i.path === 'users/guest' || i.path.startsWith('users/guest/')))
            .map(i => i.id);
            
        if (invalidSyncIds.length > 0) {
            bulkUpdateSyncStatus(invalidSyncIds, 'cloud_synced');
            console.log(`[SyncManager] Auto-resolved ${invalidSyncIds.length} invalid guest sync entries.`);
        }

        const pendingItems = syncQueue.filter(i => i.status === 'pending' && !(i.path === 'users/guest' || i.path.startsWith('users/guest/')));
        
        if (pendingItems.length === 0) {
            toast.info("No pending changes to sync.");
            return true;
        }

        const id = toast.loading(`Syncing ${pendingItems.length} operations with Atomic Collisons Shield...`);
        let successCount = 0;

        // Throttling helper delay
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            // Cellular Timeout Guard: Maximum 100 Firestore operations per batch transaction
            const batchSize = 100; 
            for (let i = 0; i < pendingItems.length; i += batchSize) {
                // If this is not the first chunk, apply the 200ms cellular band throttle delay
                if (i > 0) {
                    await sleep(200);
                }

                const chunk = pendingItems.slice(i, i + batchSize);
                const batch = writeBatch(syncDb);
                const chunkIds: string[] = [];

                for (const item of chunk) {
                    try {
                        const colPath = item.path.split('/')[0];
                        const docId = item.path.split('/')[1];
                        if (!colPath || !docId) continue;

                        // Idempotency token check
                        if (item.idempotencyToken) {
                            try {
                                const tokenRef = doc(syncDb, 'processedTokens', item.idempotencyToken);
                                let tokenSnap: any = null;
                                try {
                                    tokenSnap = await getDocFromServer(tokenRef);
                                } catch {
                                    tokenSnap = await getDoc(tokenRef).catch(() => null);
                                }
                                if (tokenSnap && tokenSnap.exists()) {
                                    console.warn(`[SyncManager] Token ${item.idempotencyToken} has already been processed on the cloud. Avoiding duplicate delta count.`);
                                    // Mark it as synced locally to clear it without re-applying the operation
                                    chunkIds.push(item.id);
                                    continue;
                                }
                                
                                // Record the token in this batch transaction so that both commit together
                                batch.set(tokenRef, {
                                    processedAt: new Date().toISOString(),
                                    path: item.path,
                                    type: item.type,
                                    organizationId: item.organizationId || ''
                                });
                            } catch (tokenErr) {
                                console.warn(`[SyncManager-Idempotence] Error querying processedToken ${item.idempotencyToken}, fallback to standard execution`, tokenErr);
                            }
                        }
                        
                        const docRef = doc(syncDb, colPath, docId);

                        switch (item.type) {
                            case 'set':
                            case 'update':
                                if (['harvestEvents', 'inventoryItems', 'plantationFeatures'].includes(colPath)) {
                                    // Use our multi-tablet collision proof merge engine!
                                    await applySmartCollisionMerge(syncDb, colPath, docId, item, batch, pendingItems);
                                } else {
                                    if (item.type === 'set') {
                                        batch.set(docRef, item.data);
                                    } else {
                                        batch.update(docRef, item.data);
                                    }
                                }
                                break;
                            case 'delete':
                                batch.delete(docRef);
                                break;
                        }
                        chunkIds.push(item.id);
                    } catch (err) {
                        console.error(`Readying batch failed for item ${item.id}:`, err);
                    }
                }

                if (chunkIds.length === 0) {
                    continue;
                }

                try {
                    await batch.commit();
                    // Update statuses after successful commit in one go
                    bulkUpdateSyncStatus(chunkIds, 'cloud_synced');
                    successCount += chunkIds.length;
                } catch (batchError: any) {
                    console.error("Batch commit failed:", batchError);
                    bulkUpdateSyncStatus(chunkIds, 'error', batchError?.message || "Batch failed");
                    toast.error(`Batch failed: ${batchError?.message}`, { id, duration: 4000 });
                }
            }

            if (successCount > 0) {
                toast.success(`Cloud Sync Complete: ${successCount} operations synchronized atomically.`, { id, duration: 4000 });
                return true;
            } else {
                toast.error("Cloud Sync: Could not complete synchronization with server. Please verify connection.", { id, duration: 4000 });
                return false;
            }
        } catch (error: any) {
            console.error("Cloud Sync Failed:", error);
            toast.error("Batch synchronization failed. Retrying in background...", { id, duration: 5000 });
            return false;
        }
    },

    /**
     * Active analyzer to identify structural or data conflicts.
     * Prevents headless background sync from executing on collision risks without explicit visual consent.
     */
    isConflictPresent: () => {
        const syncQueue: SyncLogEntry[] = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
        const activeItems = syncQueue.filter(i => {
            const isIgnoredPath = i.path === 'users/guest' || i.path.startsWith('users/guest/');
            return (i.status === 'pending' || i.status === 'error') && !isIgnoredPath;
        });

        // 1. Any existing operation in error status is a conflict requiring auditing
        if (activeItems.some(i => i.status === 'error')) {
            return true;
        }

        // 2. Edits to existing crucial shared enterprise objects (events and Stock balances)
        const conflictPaths = ['harvestEvents', 'inventoryItems'];
        const hasRisk = activeItems.some(item => {
            const col = item.path.split('/')[0];
            // creations (add / set on non-existing path is fine, but updates/sets to pre-existing rows represent conflict potentials)
            return conflictPaths.includes(col) && item.type !== 'add';
        });

        return hasRisk;
    },

    /**
     * Clears local cache.
     */
    clearLocalCache: () => {
        localStorage.removeItem('agrimap-pending-sync');
        return true;
    }
};
