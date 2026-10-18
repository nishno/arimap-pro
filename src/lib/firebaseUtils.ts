import { auth, db, doc, getDocFromServer, setDoc, testFirestoreConnection } from '../firebase';
import { PlantationFeature, User, Organization } from '../types';

export const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid || 'none',
            email: auth.currentUser?.email || 'none',
            emailVerified: auth.currentUser?.emailVerified || false,
            isAnonymous: auth.currentUser?.isAnonymous || false,
            tenantId: (auth.currentUser as any)?.tenantId || 'none',
            providerInfo: auth.currentUser?.providerData?.map(p => ({
                providerId: p.providerId,
                displayName: p.displayName || '',
                email: p.email || '',
                photoUrl: p.photoURL || ''
            })) || []
        },
        operationType,
        path
    };
    const errString = JSON.stringify(errInfo);
    
    // Ignore internal firestore noisy errors that don't need app crashes
    if (errInfo.error && (
        errInfo.error.includes('Target ID already exists') || 
        errInfo.error.includes('cancelled') ||
        errInfo.error.includes('INTERNAL ASSERTION FAILED') ||
        errInfo.error.includes('Unexpected state') ||
        errInfo.error.includes('da08') ||
        errInfo.error.includes('assertion')
    )) {
        console.warn('Firestore Internal Warning:', errInfo.error);
        return; // do not throw
    }
    
    console.error('Firestore Error: ', errString);
    
    const isOffline = errInfo.error?.toLowerCase().includes('offline') || 
                      errInfo.error?.toLowerCase().includes('unavailable') || 
                      errInfo.error?.toLowerCase().includes('network') ||
                      errInfo.error?.toLowerCase().includes('could not reach') ||
                      errInfo.error?.toLowerCase().includes('connection failed') ||
                      errInfo.error?.toLowerCase().includes('operation could not be completed');
    const isQuota = errInfo.error?.toLowerCase().includes('quota exceeded') ||
                    errInfo.error?.toLowerCase().includes('resource-exhausted') ||
                    errInfo.error?.toLowerCase().includes('resource_exhausted') ||
                    errInfo.error?.toLowerCase().includes('limit');

    if (isOffline || isQuota) {
        console.warn(`[Firestore Error Handled Gracefully] ${operationType} failed on path ${path} due to ${isQuota ? 'Quota Exceeded' : 'Offline/Network error'}. Skipping crash.`);
        if (isQuota) {
            window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
        }
        return; // do not throw
    }

    if (errInfo.error?.toLowerCase().includes('quota exceeded')) {
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
    }

    if (operationType === 'list') {
        // For onSnapshot listeners, throwing crashes the whole React app via unhandled exception.
        // We log it (above) but do not throw. 
        return;
    }

    throw new Error(errString);
};

export const sanitizeObject = (obj: any): any => {
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

export const sanitizeFeatureForFirestore = (feature: PlantationFeature): any => {
    const sanitizeFeatureItem = (item: any): any => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        
        // Handle Geometry: ensure nested point arrays are JSON stringified for Firestore
        if ('geometry' in copy) {
            let geom = copy.geometry;
            if (typeof geom === 'string') {
                try {
                    geom = JSON.parse(geom);
                } catch (e) {}
            }
            if (Array.isArray(geom)) {
                if (Array.isArray(geom[0])) {
                    // Array of coordinates [[lat, lng], ...]
                    const cleaned = geom.map((p: any) => {
                        const lat = typeof p[0] === 'string' ? parseFloat(p[0]) : p[0];
                        const lng = typeof p[1] === 'string' ? parseFloat(p[1]) : p[1];
                        return [lat, lng];
                    }).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
                    copy.geometry = JSON.stringify(cleaned);
                } else if (geom.length === 2 && typeof geom[0] !== 'object') {
                    // Single coordinate [lat, lng]
                    const lat = typeof geom[0] === 'string' ? parseFloat(geom[0]) : geom[0];
                    const lng = typeof geom[1] === 'string' ? parseFloat(geom[1]) : geom[1];
                    copy.geometry = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [0, 0];
                }
            }
        }

        if (Array.isArray(copy.bundledLines)) {
            copy.bundledLines = copy.bundledLines.map(sanitizeFeatureItem);
        }
        if (Array.isArray(copy.bundledSeedlings)) {
            copy.bundledSeedlings = copy.bundledSeedlings.map(sanitizeFeatureItem);
        }

        return copy;
    };

    return sanitizeObject(sanitizeFeatureItem(feature));
};

export const sanitizeOrganizationForFirestore = (org: Organization): any => {
    return sanitizeObject(org);
};

export const testFirebaseConnection = async (retries = 2) => {
    // Only run if we are actually online
    if (!navigator.onLine) {
        console.log("[Firebase] Navigator reports offline. Skipping connection test, assuming Offline Mode.");
        return;
    }

    try {
        const isHealthy = await testFirestoreConnection(5000);
        if (!isHealthy) {
            console.log("[Firebase] Lightweight connection check failed. Relying on Offline Mode.");
            return;
        }
    } catch (e) {
        console.warn("[Firebase] Lightweight connection check error:", e);
    }

    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[Firebase] Connection attempt ${i + 1}...`);
            // Force a network request
            await getDocFromServer(doc(db, '_connection_test_', 'check'));
            console.log("[Firebase] Connection successful.");
            return;
        } catch (error: any) {
            const isOffline = error?.message?.includes('offline') || error?.code === 'unavailable' || error?.message?.includes('network');
            const isQuota = error?.message?.includes('Quota exceeded');
            const isPermissionDenied = error?.code === 'permission-denied' || error?.message?.includes('permissions') || error?.message?.includes('Permission');
            
            console.warn(`[Firebase] Attempt ${i + 1} failed: ${error?.message}`);
            
            if (isPermissionDenied) {
                console.log("[Firebase] Connection successful (verified via server security response).");
                return; // Server reached successfully!
            }
            
            if (isOffline || isQuota) {
                console.log(`[Firebase] Switching to Offline/Cache Priority Mode (${isQuota ? 'Quota' : 'Network'}).`);
                return; // Early exit, we'll rely on local persistence
            }

            if (i === retries - 1) {
                console.warn("[Firebase] Could not reach server. Continuing in Offline Mode.");
            } else {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
};

/**
 * Generates a unique ID for users or companies.
 * Individual User: I + 5 random digits
 * Company User: C + 5 random digits
 * Organization: Comp + 5 random digits
 */
export const generateUniqueId = (type: 'global' | 'individual' | 'company' | 'worker' | 'organization', existingDigits?: string): string => {
    const prefixes = {
        'global': 'G',
        'individual': 'I',
        'company': 'C',
        'worker': 'W',
        'organization': 'Comp'
    };
    const prefix = prefixes[type];
    const digits = existingDigits || Math.floor(1000 + Math.random() * 9000).toString();
    return `${prefix}-${digits}`;
};
