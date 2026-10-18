import {isLocalRuntime} from '../local/runtime';
import { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { onSnapshot, collection, query, where, limit, orderBy, doc, setDoc } from '../firebase';
import { 
    User, Organization, Membership, PlantationFeature, Layer, 
    InventoryItem, HarvestEvent, Account, Transaction, 
    WorkAssignment, Employee, Machinery, Project,
    HarvestEntry, Pallet, HarvestLog, OperationalLog, InventoryTransaction,
    EmployeeGroup, DailyLogEntry, NutritionPlan, PlanExecution,
    ForumPost, Listing, Bid, Review, Alert, PurchaseOrder, Supplier,
    Note, Checkpoint, SystemLog, SubscriptionRequest, Crop, StockTransaction, HarvestedProduce,
    isValidCoordinate
} from '../types';
import { handleFirestoreError } from '../lib/firebaseUtils';
import { safeStorage } from '../services/storageService';
import { USE_FIREBASE } from '../config';
import { toSafeLatLngTuple } from '../lib/leafletSafety';

const cleanGeometryLocal = (geometry: any): any => {
    if (geometry === null || geometry === undefined) return null;
    let parsed = geometry;
    if (typeof geometry === 'string') {
        try {
            parsed = JSON.parse(geometry);
        } catch (e) {
            return null;
        }
    }
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch (e) {
            return null;
        }
    }

    // Check if it is a single point [lat, lng]
    if (Array.isArray(parsed) && parsed.length === 2 && !Array.isArray(parsed[0]) && typeof parsed[0] !== 'object') {
        const pt = toSafeLatLngTuple(parsed);
        return pt ? pt : null;
    }

    if (Array.isArray(parsed)) {
        const cleaned: any[] = [];
        for (const item of parsed) {
            if (!item) continue;
            // Single point inside array
            const pt = toSafeLatLngTuple(item);
            if (pt) {
                cleaned.push(pt);
            } else if (Array.isArray(item)) {
                // Nested array (e.g. polygon ring or multi-polygon)
                const nestedPts: [number, number][] = [];
                for (const sub of item) {
                    const subPt = toSafeLatLngTuple(sub);
                    if (subPt) nestedPts.push(subPt);
                }
                if (nestedPts.length > 0) {
                    cleaned.push(nestedPts);
                }
            }
        }
        return cleaned.length > 0 ? cleaned : null;
    }

    if (typeof parsed === 'object' && parsed !== null) {
        const pt = toSafeLatLngTuple(parsed);
        return pt ? pt : null;
    }

    return null;
};

export const DEFAULT_COMPANIES: Organization[] = [
    {
        id: 'org-agroland',
        uniqueId: 'COMP-77121',
        name: 'AgroLand Georgia',
        legalName: 'AgroLand LLC',
        registrationNumber: 'REG-205123456',
        taxNumber: 'TAX-205123456',
        agricultureType: 'Blueberry',
        type: 'Farm' as any,
        country: 'Georgia',
        region: 'Kakheti',
        isDiscoverable: true,
        createdBy: 'system-seed',
        createdAt: new Date().toISOString(),
        status: 'active',
        trial_start_date: new Date().toISOString(),
        trialExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        isPaid: false,
        tier: 'Free',
        subscriptionStatus: 'Trial'
    },
    {
        id: 'org-geoberry',
        uniqueId: 'COMP-89102',
        name: 'GeoGeorgian Berries',
        legalName: 'Georgian Berries Group',
        registrationNumber: 'REG-206987654',
        taxNumber: 'TAX-206987654',
        agricultureType: 'Blueberry',
        type: 'Processor' as any,
        country: 'Georgia',
        region: 'Guria',
        isDiscoverable: true,
        createdBy: 'system-seed',
        createdAt: new Date().toISOString(),
        status: 'active',
        trial_start_date: new Date().toISOString(),
        trialExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        isPaid: false,
        tier: 'Free',
        subscriptionStatus: 'Trial'
    },
    {
        id: 'org-imereti',
        uniqueId: 'COMP-11029',
        name: 'Imereti Organic Fields',
        legalName: 'Imereti Agri LLC',
        registrationNumber: 'REG-212345678',
        taxNumber: 'TAX-212345678',
        agricultureType: 'Lemon',
        type: 'Cooperative' as any,
        country: 'Georgia',
        region: 'Imereti',
        isDiscoverable: true,
        createdBy: 'system-seed',
        createdAt: new Date().toISOString(),
        status: 'active',
        trial_start_date: new Date().toISOString(),
        trialExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        isPaid: false,
        tier: 'Free',
        subscriptionStatus: 'Trial'
    },
    {
        id: 'org-kartli',
        uniqueId: 'COMP-55423',
        name: 'Shida Kartli Orchards',
        legalName: 'Kartli Fruits JSC',
        registrationNumber: 'REG-209876543',
        taxNumber: 'TAX-209876543',
        agricultureType: 'General',
        type: 'Farm' as any,
        country: 'Georgia',
        region: 'Shida Kartli',
        isDiscoverable: true,
        createdBy: 'system-seed',
        createdAt: new Date().toISOString(),
        status: 'active',
        trial_start_date: new Date().toISOString(),
        trialExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        isPaid: false,
        tier: 'Free',
        subscriptionStatus: 'Trial'
    }
];

const sanitizeValueLocal = (val: any): any => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') return val;
    if (typeof val === 'object') {
        if (typeof val.toDate === 'function') {
            try { return val.toDate().toISOString(); } catch (e) { return new Date().toISOString(); }
        }
        if (typeof val.seconds === 'number' && (val.nanoseconds !== undefined || val.seconds !== undefined)) {
            return new Date(val.seconds * 1000).toISOString();
        }
        if (val._methodName !== undefined || val.bc !== undefined || val.type === 'increment') {
            if (val._methodName === 'increment' || val.type === 'increment') {
                const num = typeof val.operand === 'number' ? val.operand : (typeof val.value === 'number' ? val.value : 0);
                return isNaN(num) ? 0 : num;
            }
            if (val._methodName === 'serverTimestamp') return new Date().toISOString();
            if (val._methodName === 'deleteField') return undefined;
            return '';
        }
        if (Array.isArray(val)) return val.map(sanitizeValueLocal);
        const cleaned: Record<string, any> = {};
        for (const k of Object.keys(val)) {
            cleaned[k] = sanitizeValueLocal(val[k]);
        }
        return cleaned;
    }
    return val;
};

const sanitizeCollection = <T extends Record<string, any>>(list: T[] | undefined | null): T[] => {
    if (!Array.isArray(list)) return [];
    return list.filter(item => {
        if (!item) return false;
        if (item.isDeleted === true || item.status === 'deleted') {
            return false;
        }
        return true;
    }).map(rawItem => {
        if (!rawItem || typeof rawItem !== 'object') return rawItem;
        const item = sanitizeValueLocal(rawItem);
        const copy = { ...item } as any;
        const stringFields = [
            'name', 'email', 'personalNumber', 'verificationStatus', 'country', 'status',
            'subscriptionType', 'activeRole', 'idNumber', 'roleId', 'barcode', 'joinedAt',
            'employeeType', 'legalName', 'registrationNumber', 'taxNumber', 'agricultureType',
            'type', 'region', 'body', 'authorId', 'authorName', 'recipientId', 'subject',
            'title', 'content', 'hubType', 'projectName', 'description', 'variety', 'syncStatus'
        ];
        stringFields.forEach(field => {
            if (copy[field] && typeof copy[field] === 'object') {
                const inner = copy[field];
                copy[field] = inner.name || inner.workName || inner.title || String(inner);
            }
            if (!(field in copy) || copy[field] === null || copy[field] === undefined) {
                copy[field] = '';
            }
        });

        const numericFields = [
            'totalBoxes', 'totalNetWeightKg', 'totalGrossWeightKg', 'totalVerifiedWeightKg',
            'totalEstimatedWeightKg', 'totalPickerCost', 'totalPackagingCost', 'totalPallets',
            'totalVehicleCost', 'totalPunets', 'physicalPunets', 'punetsPerBox', 'currentStock',
            'quantity', 'cost', 'unitCost', 'defaultBoxWeightKg'
        ];
        numericFields.forEach(numField => {
            if (numField in copy) {
                const val = copy[numField];
                if (typeof val === 'number') {
                    // valid number
                } else if (typeof val === 'string' && val.trim() !== '') {
                    const parsed = parseFloat(val);
                    copy[numField] = isNaN(parsed) ? 0 : parsed;
                } else if (typeof val === 'object' && val !== null) {
                    if (val._methodName === 'increment' || val.type === 'increment') {
                        const num = typeof val.operand === 'number' ? val.operand : (typeof val.value === 'number' ? val.value : 0);
                        copy[numField] = isNaN(num) ? 0 : num;
                    } else {
                        copy[numField] = 0;
                    }
                } else if (val === '' || val === null || val === undefined) {
                    copy[numField] = 0;
                }
            }
        });

        return copy as T;
    });
};

export function areCollectionsEqual(prev: any[], next: any[]): boolean {
    if (prev === next) return true;
    if (!prev || !next) return false;
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
        const a = prev[i];
        const b = next[i];
        if (a === b) continue;
        if (!a || !b) return false;
        if (a.id !== b.id) return false;
        if (a.updatedAt !== b.updatedAt) return false;
        if (a.currentStock !== b.currentStock) return false;
        if (a.quantity !== b.quantity) return false;
        if (a.status !== b.status) return false;
        if (a.netWeightKg !== b.netWeightKg) return false;
        if (JSON.stringify(a) !== JSON.stringify(b)) return false;
    }
    return true;
}

export const useFirebaseData = (
    currentUser: User | null, 
    isAuthReady: boolean, 
    activeOrgId: string | null, 
    isSystemAdmin: boolean = false, 
    isConnectionHealthy: boolean = true
) => {
    const [plantationFeatures, setPlantationFeatures] = useState<PlantationFeature[]>([]);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [memberships, setMemberships] = useState<Membership[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [harvestEvents, setHarvestEvents] = useState<HarvestEvent[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [workAssignments, setWorkAssignments] = useState<WorkAssignment[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [machinery, setMachinery] = useState<Machinery[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [harvestEntries, setHarvestEntries] = useState<HarvestEntry[]>([]);
    const [pallets, setPallets] = useState<Pallet[]>([]);
    const [harvestLogs, setHarvestLogs] = useState<HarvestLog[]>([]);
    const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
    const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
    const [harvestedProduce, setHarvestedProduce] = useState<HarvestedProduce[]>([]);
    const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>([]);
    const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
    const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>([]);
    const [planExecutions, setPlanExecutions] = useState<PlanExecution[]>([]);
    const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
    const [listings, setListings] = useState<Listing[]>([]);
    const [bids, setBids] = useState<Bid[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [operationalLogs, setOperationalLogs] = useState<OperationalLog[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

    const [discoverableOrganizations, setDiscoverableOrganizations] = useState<Organization[]>([]);
    const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionRequest[]>([]);
    const [cropVarieties, setCropVarieties] = useState<string[]>([]);
    const [crops, setCrops] = useState<Crop[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    const membershipIdsHash = memberships.map(m => m.id).sort().join(',');

    const mergePendingLocalSyncs = (colName: string, cloudList: any[]): any[] => {
        if(isLocalRuntime)return cloudList;
        try {
            const queueStr = localStorage.getItem('agrimap-pending-sync');
            if (!queueStr) return cloudList;
            const queue: any[] = JSON.parse(queueStr);
            const pendingForCol = queue.filter(item => 
                (item.status === 'pending' || item.status === 'error') && 
                (
                    (item.path && (item.path.startsWith(`${colName}/`) || item.path === colName)) ||
                    (item.category && item.category === colName)
                )
            );
            
            if (pendingForCol.length === 0) return cloudList;
            
            const mergedList = [...cloudList];
            
            pendingForCol.forEach(item => {
                const parts = item.path ? item.path.split('/') : [];
                const docId = parts[1] || item.data?.id || item.id;
                if (!docId) return;
                
                if (item.type === 'delete') {
                    const index = mergedList.findIndex(e => e.id === docId);
                    if (index !== -1) {
                        mergedList.splice(index, 1);
                    }
                } else if (item.type === 'set' || item.type === 'update' || item.type === 'add') {
                    const index = mergedList.findIndex(e => e.id === docId);
                    const rawMerged = { 
                        ...(item.data || {}), 
                        id: docId,
                        isPendingSync: true
                    };
                    const mergedData = sanitizeValueLocal(rawMerged);
                    if (index !== -1) {
                        mergedList[index] = { ...mergedList[index], ...mergedData };
                    } else {
                        mergedList.push(mergedData);
                    }
                }
            });
            
            return mergedList;
        } catch (e) {
            console.warn("Failed to merge pending syncs:", e);
            return cloudList;
        }
    };

    const cacheTimerMap = useRef<Map<string, any>>(new Map());

    const saveToCache = (key: string, data: any[]) => {
        if(isLocalRuntime)return;
        if (cacheTimerMap.current.has(key)) {
            clearTimeout(cacheTimerMap.current.get(key));
        }
        const timer = setTimeout(() => {
            try {
                // Defensive guard: do not wipe local cache with an empty array if cached data exists
                if (Array.isArray(data) && data.length === 0) {
                    const existingStr = safeStorage.getItem(`${isLocalRuntime?'local_'+((window as any).__AGRIMAP_LOCAL_SESSION__?.farm.id||'')+'_':''}fb_cache_${key}`);
                    if (existingStr) {
                        try {
                            const existing = JSON.parse(existingStr);
                            if (Array.isArray(existing) && existing.length > 0) {
                                return;
                            }
                        } catch (e) {}
                    }
                }
                safeStorage.setItem(`fb_cache_${key}`, JSON.stringify(data));
            } catch (e) {
                console.warn(`Failed to save ${key} to cache:`, e);
            }
            cacheTimerMap.current.delete(key);
        }, 1000);
        cacheTimerMap.current.set(key, timer);
    };

    useEffect(() => {
        if(isLocalRuntime)return;
        // Initial recovery from cache to ensure UI is not blank if over quota or offline
        const recoveryMap: { [key: string]: React.Dispatch<React.SetStateAction<any[]>> } = {
            'plantationFeatures': setPlantationFeatures,
            'layers': setLayers,
            'organizations': setOrganizations,
            'memberships': setMemberships,
            'inventoryItems': setInventoryItems,
            'harvestEvents': setHarvestEvents,
            'workAssignments': setWorkAssignments,
            'employees': setEmployees,
            'machinery': setMachinery,
            'projects': setProjects,
            'harvestLogs': setHarvestLogs,
            'operationalLogs': setOperationalLogs,
            'accounts': setAccounts,
            'transactions': setTransactions,
            'crops': setCrops,
            'listings': setListings,
            'bids': setBids,
            'reviews': setReviews,
            'notes': setNotes,
            'checkpoints': setCheckpoints,
            'purchaseOrders': setPurchaseOrders,
            'suppliers': setSuppliers,
            'employeeGroups': setEmployeeGroups,
            'dailyLogs': setDailyLogs,
            'nutritionPlans': setNutritionPlans,
            'planExecutions': setPlanExecutions,
            'harvestEntries': setHarvestEntries,
            'pallets': setPallets,
            'discoverableOrganizations': setDiscoverableOrganizations
        };

        Object.entries(recoveryMap).forEach(([key, setter]) => {
            try {
                const cached = safeStorage.getItem(`${isLocalRuntime?'local_'+((window as any).__AGRIMAP_LOCAL_SESSION__?.farm.id||'')+'_':''}fb_cache_${key}`);
                let listToSet: any[] = [];
                if (cached) {
                    const data = JSON.parse(cached);
                    if (Array.isArray(data)) listToSet = mergePendingLocalSyncs(key, data);
                } else {
                    const localUnsynced = mergePendingLocalSyncs(key, []);
                    if (localUnsynced.length > 0) listToSet = localUnsynced;
                }

                // Sanitize geometry if applicable!
                if (listToSet.length > 0 && ['plantationFeatures', 'notes', 'checkpoints', 'harvestLogs', 'operationalLogs'].includes(key)) {
                    listToSet = listToSet.map(item => {
                        if (item && 'geometry' in item) {
                            return { ...item, geometry: cleanGeometryLocal(item.geometry) };
                        }
                        return item;
                    }).filter(item => {
                        if (item && 'geometry' in item) {
                            return item.geometry !== null;
                        }
                        return true;
                    });
                }

                setter(listToSet);
            } catch (e) {
                console.warn(`Failed to recover ${key} from cache:`, e);
            }
        });
    }, []);

    useEffect(() => {
        if (!USE_FIREBASE || currentUser?.id === 'root-system') {
            const savedOrgs = safeStorage.safeParse(localStorage.getItem('mock_organizations'), []);
            const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
            const savedUsers = safeStorage.safeParse(localStorage.getItem('mock_users'), []);
            const savedCrops = safeStorage.safeParse(localStorage.getItem('mock_crops'), []);
            
            // Filter organizations and memberships for non-admins in mock mode
            if (!isSystemAdmin) {
                const userMems = savedMemberships.filter((m: any) => m.userId === currentUser?.id);
                // Deduplicate by id
                const uniqueMems = Array.from(new Map(userMems.map((m: any) => [m.id, m])).values()) as Membership[];
                const userOrgIds = uniqueMems.map((m: any) => m.organizationId);
                setMemberships(uniqueMems);
                setOrganizations(savedOrgs.filter((o: any) => userOrgIds.includes(o.id)));
                setCrops(savedCrops.filter((c: any) => userOrgIds.includes(c.organizationId)));
                setAllUsers([]);
            } else {
                setOrganizations(savedOrgs);
                const uniqueAllMems = Array.from(new Map(savedMemberships.map((m: any) => [m.id, m])).values()) as Membership[];
                setMemberships(uniqueAllMems);
                setCrops(savedCrops);
                setAllUsers(savedUsers.length > 0 ? savedUsers : [
                    { id: 'mock-root', name: 'Nishno Root', globalUniqueId: 'G-001', individualUniqueId: 'I-001', activeRole: 'individual', email: 'nishno@agrimap.pro', roles: ['ROOT_SUPER_ADMIN'], status: 'active', createdAt: new Date().toISOString(), verificationStatus: 'verified', country: 'Georgia', subscriptionType: 'Enterprise', aiQueryCount: 0, isProfileDiscoverable: true },
                    { id: 'mock-user', name: 'Test User', globalUniqueId: 'G-002', individualUniqueId: 'I-002', activeRole: 'individual', email: 'test@example.com', roles: ['Guest'], status: 'active', createdAt: new Date().toISOString(), verificationStatus: 'unverified', country: 'Georgia', subscriptionType: 'Free', aiQueryCount: 0, isProfileDiscoverable: true }
                ]);
            }
            return;
        }

        if (!isAuthReady || !currentUser || currentUser.isGuest || !auth.currentUser) {
            // Optimization: If we have cached data, don't clear it immediately to prevent jumpy UI
            // Only clear if auth is ready and we confirmed the user is truly a guest or signed out
            if (isAuthReady) {
                setOrganizations([]);
                setMemberships([]);
                setPlantationFeatures([]);
                setLayers([]);
                setInventoryItems([]);
                setHarvestEvents([]);
                setAccounts([]);
                setTransactions([]);
                setWorkAssignments([]);
                setEmployees([]);
                setMachinery([]);
                setProjects([]);
                setHarvestEntries([]);
                setPallets([]);
                setHarvestLogs([]);
                setInventoryTransactions([]);
                setEmployeeGroups([]);
                setDailyLogs([]);
                setNutritionPlans([]);
                setPlanExecutions([]);
                setForumPosts([]);
                setListings([]);
                setBids([]);
                setReviews([]);
                setAlerts([]);
                setPurchaseOrders([]);
                setSuppliers([]);
                setOperationalLogs([]);
                setNotes([]);
                setCheckpoints([]);
                setSystemLogs([]);
                setCropVarieties([]);
            }
            return;
        }

        // 1. Memberships (to know which orgs the user belongs to)
        const membershipsQuery = isSystemAdmin 
            ? query(collection(db, 'memberships'))
            : query(collection(db, 'memberships'), where('userId', '==', currentUser.id));
        
        const unsubscribeMemberships = onSnapshot(membershipsQuery, (snapshot) => {
            const mems = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as Membership));
            // Deduplicate memberships by id
            const uniqueMems = Array.from(new Map(mems.map(m => [m.id, m])).values()) as Membership[];
            
            // Only update if IDs have changed to prevent downstream listener cycles
            setMemberships(prev => {
                const prevIds = prev.map(m => m.id).sort().join(',');
                const nextIds = uniqueMems.map(m => m.id).sort().join(',');
                if (prevIds === nextIds) return prev;
                saveToCache('memberships', uniqueMems);
                return uniqueMems;
            });
        }, (error) => {
            const msg = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                handleFirestoreError(error, 'list', 'memberships');
            }
        });

        // 1.1 Discoverable Professional Users (For everyone to see on map)
        const publicUsersQuery = query(
            collection(db, 'users'), 
            where('isProfileDiscoverable', '==', true)
        );
        const unsubscribePublicUsers = onSnapshot(publicUsersQuery, (snapshot) => {
            const users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            setAllUsers(users);
        }, (error) => {
             const msg = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                handleFirestoreError(error, 'list', 'users_discoverable');
            }
        });

        // 2. User Projects (Saved across logins)
        const projectsQuery = query(
            collection(db, 'projects'), 
            where('userId', '==', currentUser.id)
        );
        const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
            const ps = snapshot.docs.map(doc => {
                const data = doc.data() as Project;
                if (data.data) {
                    if (data.data.plantationFeatures) {
                        data.data.plantationFeatures = data.data.plantationFeatures.map(f => {
                            if (typeof f.geometry === 'string') {
                                try { f.geometry = JSON.parse(f.geometry); } catch (e) {}
                            }
                            return f;
                        });
                    }
                    if (data.data.harvestLogs) {
                        data.data.harvestLogs = data.data.harvestLogs.map(l => {
                            if (typeof l.geometry === 'string') {
                                try { l.geometry = JSON.parse(l.geometry); } catch (e) {}
                            }
                            return l;
                        });
                    }
                    if (data.data.operationalLogs) {
                        data.data.operationalLogs = data.data.operationalLogs.map(l => {
                            if (typeof l.geometry === 'string') {
                                try { l.geometry = JSON.parse(l.geometry); } catch (e) {}
                            }
                            return l;
                        });
                    }
                }
                return { ...data, id: doc.id } as Project;
            });
            setProjects(ps);
        }, (error) => {
            const msg = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                handleFirestoreError(error, 'list', 'projects');
            }
        });

        // 3. All Users (for Root Admin - Full Scan)
        let unsubscribeAdminUsers = () => {};
        if (isSystemAdmin) {
            const adminUsersQuery = query(collection(db, 'users'));
            unsubscribeAdminUsers = onSnapshot(adminUsersQuery, (snapshot) => {
                // We keep setAllUsers for public profiles, but admins might need non-discoverable ones too
                const adminAllUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
                setAllUsers(prev => {
                    const map = new Map(prev.map(u => [u.id, u]));
                    adminAllUsers.forEach(u => map.set(u.id, u));
                    return Array.from(map.values());
                });
            }, (error) => {
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', 'users');
                }
            });

            const subReqUnsub = onSnapshot(collection(db, 'subscriptionRequests'), (snapshot) => {
                setSubscriptionRequests(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubscriptionRequest)));
            }, (error) => {
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', 'subscriptionRequests');
                }
            });

            const originalUnsubscribeAdminUsers = unsubscribeAdminUsers;
            unsubscribeAdminUsers = () => {
                originalUnsubscribeAdminUsers();
                subReqUnsub();
            };
        }

        return () => {
            unsubscribeMemberships();
            unsubscribeProjects();
            unsubscribePublicUsers();
            unsubscribeAdminUsers();
        };
    }, [currentUser, isAuthReady]);

    const userOrgIds = useMemo(() => {
        return Array.from(new Set(memberships.map(m => m.organizationId))).sort();
    }, [memberships]);

    const userOrgIdsHash = useMemo(() => {
        return userOrgIds.join(',');
    }, [userOrgIds]);

    useEffect(() => {
        if (!USE_FIREBASE || currentUser?.id === 'root-system') return;
        if (!isAuthReady || !currentUser || currentUser.isGuest || !auth.currentUser) return;

        // 3. Derive user organizations from discoverableOrganizations (preventing duplicate onSnapshot assertion failures)
        if (isSystemAdmin) {
            setOrganizations(discoverableOrganizations);
            saveToCache('organizations', discoverableOrganizations);
        } else {
            const myOrgs = discoverableOrganizations.filter(o => userOrgIds.includes(o.id));
            setOrganizations(myOrgs);
            saveToCache('organizations', myOrgs);
        }
    }, [discoverableOrganizations, userOrgIdsHash, isSystemAdmin, isAuthReady, currentUser, USE_FIREBASE]);

    useEffect(() => {
        if (currentUser?.id === 'root-system') return;
        if (!isAuthReady) return;

        if (!USE_FIREBASE) {
            // Mock mode: Filter from local storage
            const mockOrgsStr = localStorage.getItem('mock_organizations') || '[]';
            try {
                const orgs: Organization[] = JSON.parse(mockOrgsStr);
                setDiscoverableOrganizations(orgs);
            } catch (e) {
                setDiscoverableOrganizations([]);
            }
            return;
        }

        // 4. Discoverable Organizations (for Communication/Partners module & Registration Search)
        const discoverableQuery = collection(db, 'organizations');
        const unsubscribeDiscoverable = onSnapshot(discoverableQuery, (snapshot) => {
            const orgs = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                if (typeof data.areaGeometry === 'string') {
                    try { data.areaGeometry = JSON.parse(data.areaGeometry); } catch (e) {}
                }
                return { ...data, id: doc.id } as Organization;
            });
            
            if (orgs.length === 0) {
                console.log("[useFirebaseData] organizations empty in Cloud. Launching auto-seed with default companies...");
                setDiscoverableOrganizations(isLocalRuntime?[]:DEFAULT_COMPANIES);
                saveToCache('discoverableOrganizations', DEFAULT_COMPANIES);
                
                // Seed them in the background
                DEFAULT_COMPANIES.forEach((c) => {
                    setDoc(doc(db, 'organizations', c.id), c).catch(e => {
                        console.warn("[useFirebaseData] Failed to seed default organization doc", c.id, e);
                    });
                });
            } else {
                setDiscoverableOrganizations(orgs);
                saveToCache('discoverableOrganizations', orgs);
            }
        }, (error) => {
            const msg = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                handleFirestoreError(error, 'list', 'organizations_discoverable');
            }
            // Fallback to cache or fallback list so search fields are populated even with restriction/error
            try {
                const cached = localStorage.getItem('fb_cache_discoverableOrganizations');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setDiscoverableOrganizations(parsed);
                        return;
                    }
                }
            } catch (e) {}
            setDiscoverableOrganizations(isLocalRuntime?[]:DEFAULT_COMPANIES);
        });

        return () => unsubscribeDiscoverable();
    }, [currentUser, isAuthReady]);

    useEffect(() => {
        // Reset company-specific data immediately when activeOrgId changes to ensure isolation
        setInventoryItems([]);
        setHarvestEvents([]);
        setAccounts([]);
        setTransactions([]);
        setWorkAssignments([]);
        setEmployees([]);
        setMachinery([]);
        setPlantationFeatures([]);
        setLayers([{ id: 'root', name: 'ROOT', isFolder: true, isVisible: true }]);
        setHarvestEntries([]);
        setPallets([]);
        setHarvestLogs([]);
        setInventoryTransactions([]);
        setEmployeeGroups([]);
        setDailyLogs([]);
        setNutritionPlans([]);
        setPlanExecutions([]);
        setForumPosts([]);
        setListings([]);
        setBids([]);
        setReviews([]);
        setAlerts([]);
        setPurchaseOrders([]);
        setSuppliers([]);
        setOperationalLogs([]);
        setNotes([]);
        setCheckpoints([]);
        setSystemLogs([]);

        if (!isAuthReady || !currentUser || currentUser.isGuest) return;

        const hydrateFromCache = (key: string, setter: (data: any[]) => void, transform?: (data: any) => any) => {
            if(isLocalRuntime)return;
            let all = safeStorage.safeParse(safeStorage.getItem(`${isLocalRuntime?'local_'+((window as any).__AGRIMAP_LOCAL_SESSION__?.farm.id||'')+'_':''}fb_cache_${key}`), []);
            if (!Array.isArray(all) || all.length === 0) {
                all = safeStorage.safeParse(localStorage.getItem(`mock_${key}`), []);
            }
            let filtered = Array.isArray(all) ? all.filter((item: any) => {
                if (activeOrgId === 'ALL' && isSystemAdmin) return true;
                if (activeOrgId === 'ALL') {
                    const userOrgIds = memberships.map(m => m.organizationId);
                    return userOrgIds.includes(item.organizationId);
                }
                const itemOrgId = item.organizationId || null;
                const activeId = activeOrgId || null;
                return itemOrgId === activeId || !itemOrgId;
            }) : [];

            if (['plantationFeatures', 'notes', 'checkpoints', 'harvestLogs', 'operationalLogs'].includes(key)) {
                filtered = filtered.map(item => {
                    const parsed = transform ? transform(item) : item;
                    if (parsed && 'geometry' in parsed) {
                        parsed.geometry = cleanGeometryLocal(parsed.geometry);
                    }
                    return parsed;
                }).filter(item => {
                    if (item && 'geometry' in item) {
                        return item.geometry !== null;
                    }
                    return true;
                });
                const merged = mergePendingLocalSyncs(key, filtered);
                setter(merged);
            } else {
                const transformed = transform ? filtered.map(transform) : filtered;
                const merged = mergePendingLocalSyncs(key, transformed);
                setter(merged);
            }
        };

        hydrateFromCache('inventoryItems', setInventoryItems);
        hydrateFromCache('harvestEvents', setHarvestEvents);
        hydrateFromCache('accounts', setAccounts);
        hydrateFromCache('transactions', setTransactions);
        hydrateFromCache('workAssignments', setWorkAssignments);
        hydrateFromCache('employees', setEmployees);
        hydrateFromCache('employeeGroups', setEmployeeGroups);
        hydrateFromCache('machinery', setMachinery);
        hydrateFromCache('plantationFeatures', setPlantationFeatures, (data) => {
            if (typeof data.geometry === 'string') {
                try { data.geometry = JSON.parse(data.geometry); } catch (e) {}
            }
            return data;
        });
        hydrateFromCache('layers', (data) => setLayers(prev => [...prev.filter(l => l.id === 'root'), ...data]));
        hydrateFromCache('harvestEntries', setHarvestEntries);
        hydrateFromCache('pallets', setPallets);
        hydrateFromCache('harvestLogs', setHarvestLogs);
        hydrateFromCache('inventoryTransactions', setInventoryTransactions);
        hydrateFromCache('stockTransactions', setStockTransactions);
        hydrateFromCache('harvestedProduce', setHarvestedProduce);
        hydrateFromCache('dailyLogs', setDailyLogs);
        hydrateFromCache('nutritionPlans', setNutritionPlans);
        hydrateFromCache('planExecutions', setPlanExecutions);
        hydrateFromCache('forumPosts', setForumPosts);
        hydrateFromCache('listings', setListings);
        hydrateFromCache('bids', setBids);
        hydrateFromCache('reviews', setReviews);
        hydrateFromCache('alerts', setAlerts);
        hydrateFromCache('purchaseOrders', setPurchaseOrders);
        hydrateFromCache('suppliers', setSuppliers);
        hydrateFromCache('operationalLogs', setOperationalLogs);
        hydrateFromCache('notes', setNotes);
        hydrateFromCache('checkpoints', setCheckpoints);
        hydrateFromCache('systemLogs', setSystemLogs);

        if (!USE_FIREBASE || currentUser?.id === 'root-system') {
            return;
        }

        if (!auth.currentUser) return;

        // Chunked setup for stability
        const unsubscribes: (() => void)[] = [];
        const userOrgIds = memberships.map(m => m.organizationId);

        const orgFilter = (activeOrgId === 'ALL' && isSystemAdmin)
            ? null 
            : activeOrgId === 'ALL' 
                ? where('organizationId', 'in', userOrgIds.length > 0 ? userOrgIds.slice(0, 10) : ['none']) 
                : where('organizationId', '==', activeOrgId);

        const setupListener = (colName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, transform?: (doc: any) => any, bypassOrgFilter: boolean = false) => {
            const q = (orgFilter && !bypassOrgFilter)
                ? query(collection(db, colName), orgFilter) 
                : query(collection(db, colName));
            
            const parseItemGeometries = (item: any): any => {
                if (!item || typeof item !== 'object') return item;
                const docData = { ...item };
                
                if ('geometry' in docData) {
                    docData.geometry = cleanGeometryLocal(docData.geometry);
                }

                // Recurse into bundled items
                if (docData.bundledLines && Array.isArray(docData.bundledLines)) {
                    docData.bundledLines = docData.bundledLines.map(parseItemGeometries);
                }
                if (docData.bundledSeedlings && Array.isArray(docData.bundledSeedlings)) {
                    docData.bundledSeedlings = docData.bundledSeedlings.map(parseItemGeometries);
                }

                return docData;
            };

            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => {
                    const rawData = { ...doc.data(), id: doc.id };
                    const parsedData = parseItemGeometries(rawData);
                    return transform ? transform(parsedData) : parsedData;
                }).filter(item => {
                    if (item && 'geometry' in item) {
                        return item.geometry !== null;
                    }
                    return true;
                });
                
                if(isLocalRuntime){setter(prev=>areCollectionsEqual(prev,data)?prev:data);return;}
                if (data.length > 0) {
                    saveToCache(`live_${colName}`, data);
                    saveToCache(colName, data);
                    setter(prev => areCollectionsEqual(prev, data) ? prev : data);
                } else {
                    const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                    let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                    if (activeOrgId && activeOrgId !== 'ALL') {
                        fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                    }
                    const merged = mergePendingLocalSyncs(colName, fallback);
                    if (merged.length > 0) {
                        setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                    }
                }
            }, (error) => {
                console.warn(`Firestore listener error on ${colName}, falling back to cache:`, error);
                const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                if (activeOrgId && activeOrgId !== 'ALL') {
                    fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                }
                const merged = mergePendingLocalSyncs(colName, fallback);
                if (merged.length > 0) {
                    setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                }
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', colName);
                }
            });
            unsubscribes.push(unsub);
        };

        const setupLogListener = (colName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, limitCount: number = 20) => {
            const filter = orgFilter;
            const q = filter 
                ? query(collection(db, colName), filter, limit(limitCount)) 
                : query(collection(db, colName), limit(limitCount));
            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                setter(data);
                saveToCache(colName, data);
            }, (error) => {
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', colName);
                }
            });
            unsubscribes.push(unsub);
        };

        // GROUP 1: Map Core Data
        setupListener('plantationFeatures', setPlantationFeatures);
        setupListener('layers', setLayers);
        // Logs removed to prevent crashes
        // setupLogListener('operationalLogs', setOperationalLogs, 50);
        // setupLogListener('harvestLogs', setHarvestLogs, 50);
        setupListener('notes', setNotes);
        setupListener('checkpoints', setCheckpoints);

        // Fetch users for admin/HR visibility
        if (isSystemAdmin || activeOrgId) {
            const usersQ = isSystemAdmin && activeOrgId === 'ALL'
                ? query(collection(db, 'users'))
                : query(collection(db, 'users'), where('organizationId', '==', activeOrgId));
            
            const unsubUsers = onSnapshot(usersQ, (snapshot) => {
                setAllUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
            }, (error) => {
                console.warn("Failed to sync users - check security rules:", error);
            });
            unsubscribes.push(unsubUsers);
        }

        return () => unsubscribes.forEach(u => u());
    }, [currentUser?.id, isAuthReady, activeOrgId, userOrgIdsHash, isSystemAdmin]);

    useEffect(() => {
        if (!USE_FIREBASE || currentUser?.id === 'root-system' || !isAuthReady || !currentUser || currentUser.isGuest || !auth.currentUser) return;

        const unsubscribes: (() => void)[] = [];
        const userOrgIds = memberships.map(m => m.organizationId);
        const orgFilter = (activeOrgId === 'ALL' && isSystemAdmin)
            ? null 
            : activeOrgId === 'ALL' 
                ? where('organizationId', 'in', userOrgIds.length > 0 ? userOrgIds.slice(0, 10) : ['none']) 
                : where('organizationId', '==', activeOrgId);

        const setupListener = (colName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
            const q = orgFilter ? query(collection(db, colName), orgFilter) : query(collection(db, colName));
            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                if(isLocalRuntime){setter(prev=>areCollectionsEqual(prev,data)?prev:data);return;}
                if (data.length > 0) {
                    const merged = mergePendingLocalSyncs(colName, data);
                    setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                    saveToCache(colName, merged);
                } else {
                    const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                    let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                    if (activeOrgId && activeOrgId !== 'ALL') {
                        fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                    }
                    const merged = mergePendingLocalSyncs(colName, fallback);
                    if (merged.length > 0) {
                        setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                    }
                }
            }, (error) => {
                console.warn(`Firestore listener error on ${colName}, falling back to cache:`, error);
                const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                if (activeOrgId && activeOrgId !== 'ALL') {
                    fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                }
                const merged = mergePendingLocalSyncs(colName, fallback);
                if (merged.length > 0) {
                    setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                }
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', colName);
                }
            });
            unsubscribes.push(unsub);
        };

        // GROUP 2: Operational Data
        setupListener('inventoryItems', setInventoryItems);
        setupListener('harvestEvents', setHarvestEvents);
        setupListener('accounts', setAccounts);
        setupListener('transactions', setTransactions);
        setupListener('workAssignments', setWorkAssignments);
        setupListener('employees', setEmployees);
        setupListener('machinery', setMachinery);
        setupListener('crops', setCrops);

        return () => unsubscribes.forEach(u => u());
    }, [currentUser?.id, isAuthReady, activeOrgId, userOrgIdsHash, isSystemAdmin]);

    useEffect(() => {
        if (!USE_FIREBASE || currentUser?.id === 'root-system' || !isAuthReady || !currentUser || currentUser.isGuest || !auth.currentUser) return;

        const unsubscribes: (() => void)[] = [];
        const userOrgIds = memberships.map(m => m.organizationId);
        const orgFilter = (activeOrgId === 'ALL' && isSystemAdmin)
            ? null 
            : activeOrgId === 'ALL' 
                ? where('organizationId', 'in', userOrgIds.length > 0 ? userOrgIds.slice(0, 10) : ['none']) 
                : where('organizationId', '==', activeOrgId);

        const setupListener = (colName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, useFilter: boolean = true) => {
            const filter = useFilter ? orgFilter : null;
            const q = filter ? query(collection(db, colName), filter) : query(collection(db, colName));
            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                if(isLocalRuntime){setter(prev=>areCollectionsEqual(prev,data)?prev:data);return;}
                if (data.length > 0) {
                    const merged = mergePendingLocalSyncs(colName, data);
                    setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                    saveToCache(colName, merged);
                } else {
                    const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                    let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                    if (activeOrgId && activeOrgId !== 'ALL') {
                        fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                    }
                    const merged = mergePendingLocalSyncs(colName, fallback);
                    if (merged.length > 0) {
                        setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                    }
                }
            }, (error) => {
                console.warn(`Firestore listener error on ${colName}, falling back to cache:`, error);
                const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                if (activeOrgId && activeOrgId !== 'ALL') {
                    fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                }
                const merged = mergePendingLocalSyncs(colName, fallback);
                if (merged.length > 0) {
                    setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                }
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', colName);
                }
            });
            unsubscribes.push(unsub);
        };

        const setupLogListener = (colName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, limitCount: number = 20) => {
            const filter = orgFilter;
            const q = filter 
                ? query(collection(db, colName), filter, limit(limitCount)) 
                : query(collection(db, colName), limit(limitCount));
            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                if(isLocalRuntime){setter(prev=>areCollectionsEqual(prev,data)?prev:data);return;}
                if (data.length > 0) {
                    const merged = mergePendingLocalSyncs(colName, data);
                    setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                    saveToCache(colName, merged);
                } else {
                    const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                    let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                    if (activeOrgId && activeOrgId !== 'ALL') {
                        fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                    }
                    const merged = mergePendingLocalSyncs(colName, fallback);
                    if (merged.length > 0) {
                        setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                    }
                }
            }, (error) => {
                console.warn(`Firestore listener error on log ${colName}, falling back to cache:`, error);
                const cached = safeStorage.safeParse(safeStorage.getItem(`fb_cache_${colName}`), []);
                let fallback = Array.isArray(cached) && cached.length > 0 ? cached : safeStorage.safeParse(localStorage.getItem(`mock_${colName}`), []);
                if (activeOrgId && activeOrgId !== 'ALL') {
                    fallback = fallback.filter((i: any) => (i.organizationId || 'personal') === activeOrgId || !i.organizationId);
                }
                const merged = mergePendingLocalSyncs(colName, fallback);
                if (merged.length > 0) {
                    setter(prev => areCollectionsEqual(prev, merged) ? prev : merged);
                }
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', colName);
                }
            });
            unsubscribes.push(unsub);
        };

        // GROUP 3: Agri-Science & Planning
        setupListener('harvestEntries', setHarvestEntries);
        setupListener('pallets', setPallets);
        setupListener('inventoryTransactions', setInventoryTransactions);
        setupListener('stockTransactions', setStockTransactions);
        setupListener('harvestedProduce', setHarvestedProduce);
        setupListener('employeeGroups', setEmployeeGroups);
        // setupLogListener('dailyLogs', setDailyLogs, 50);
        setupListener('nutritionPlans', setNutritionPlans);
        setupListener('planExecutions', setPlanExecutions);

        return () => unsubscribes.forEach(u => u());
    }, [currentUser?.id, isAuthReady, activeOrgId, userOrgIdsHash, isSystemAdmin]);

    useEffect(() => {
        if (!USE_FIREBASE || currentUser?.id === 'root-system' || !isAuthReady || !currentUser || currentUser.isGuest || !auth.currentUser) return;

        const unsubscribes: (() => void)[] = [];
        
        // GROUP 4: Social & Hub
        const userOrgIds = memberships.map(m => m.organizationId);
        
        // 5. Global & Direct Communication (Unbound from activeOrgId)
        const chatChannelsQuery = query(
            collection(db, 'forumPosts'), 
            orderBy('timestamp', 'desc')
        );
        const unsubscribeGlobalChats = onSnapshot(chatChannelsQuery, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ForumPost));
            setForumPosts(prev => {
                const map = new Map(prev.map(p => [p.id, p]));
                posts.forEach(p => {
                    const isDM = p.isDirectMessage;
                    const hubType = p.hubType || 'regional';
                    const isMyDM = isDM && (p.authorId === currentUser.id || p.recipientId === currentUser.id);
                    const isInternalForMyOrg = hubType === 'internal' && (userOrgIds.includes(p.organizationId || '') || p.organizationId === 'personal' && p.authorId === currentUser.id);
                    const isPublicHub = hubType === 'global' || hubType === 'regional';
                    if (isMyDM || isInternalForMyOrg || isPublicHub) map.set(p.id, p);
                });
                return Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
        }, (error) => {
            const msg = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                handleFirestoreError(error, 'list', 'forumPosts');
            }
        });

        const personalAlertsQuery = query(collection(db, 'alerts'), where('recipientId', '==', currentUser.id));
        const unsubscribePersonalAlerts = onSnapshot(personalAlertsQuery, (snapshot) => {
            const personalAlerts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Alert));
            setAlerts(prev => {
                const map = new Map(prev.map(a => [a.id, a]));
                personalAlerts.forEach(a => map.set(a.id, a));
                return Array.from(map.values());
            });
        }, (error) => {
            const msg = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                handleFirestoreError(error, 'list', 'alerts_personal');
            }
        });

        const orgFilter = (activeOrgId === 'ALL' && isSystemAdmin)
            ? null 
            : activeOrgId === 'ALL' 
                ? where('organizationId', 'in', userOrgIds.length > 0 ? userOrgIds.slice(0, 10) : ['none']) 
                : where('organizationId', '==', activeOrgId);

        const setupListener = (colName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, useFilter: boolean = true) => {
            const filter = useFilter ? orgFilter : null;
            const q = filter ? query(collection(db, colName), filter) : query(collection(db, colName));
            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                setter(data);
                saveToCache(colName, data);
            }, (error) => {
                const msg = String(error instanceof Error ? error.message : error).toLowerCase();
                if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                    handleFirestoreError(error, 'list', colName);
                }
            });
            unsubscribes.push(unsub);
        };

        setupListener('listings', setListings, false);
        setupListener('bids', setBids, false);
        setupListener('reviews', setReviews, false);
        setupListener('alerts', setAlerts);
        setupListener('purchaseOrders', setPurchaseOrders);
        setupListener('suppliers', setSuppliers);
        
        unsubscribes.push(unsubscribeGlobalChats);
        unsubscribes.push(unsubscribePersonalAlerts);

        const qVarieties = orgFilter 
            ? query(collection(db, 'cropVarieties'), orgFilter) 
            : query(collection(db, 'cropVarieties'));
        const unsubVarieties = onSnapshot(qVarieties, (snapshot) => {
            const names = snapshot.docs.map(doc => doc.data().name as string);
            setCropVarieties(prev => {
                const prevStr = prev.sort().join(',');
                const nextStr = names.sort().join(',');
                if (prevStr === nextStr) return prev;
                return names;
            });
            saveToCache('cropVarieties', names);
        }, (error) => {
            const msg = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!msg.includes('permission-denied') && !msg.includes('insufficient permissions')) {
                handleFirestoreError(error, 'list', 'cropVarieties');
            }
        });
        unsubscribes.push(unsubVarieties);

        return () => unsubscribes.forEach(u => u());
    }, [currentUser?.id, isAuthReady, activeOrgId, userOrgIdsHash, isSystemAdmin]);

    return {
        plantationFeatures: sanitizeCollection(plantationFeatures),
        setPlantationFeatures,
        layers: sanitizeCollection(layers),
        setLayers,
        organizations: sanitizeCollection(organizations),
        setOrganizations,
        memberships: sanitizeCollection(memberships),
        setMemberships,
        inventoryItems: sanitizeCollection(inventoryItems),
        setInventoryItems,
        harvestEvents: sanitizeCollection(harvestEvents),
        setHarvestEvents,
        accounts: sanitizeCollection(accounts),
        setAccounts,
        transactions: sanitizeCollection(transactions),
        setTransactions,
        workAssignments: sanitizeCollection(workAssignments),
        setWorkAssignments,
        employees: sanitizeCollection(employees),
        setEmployees,
        machinery: sanitizeCollection(machinery),
        setMachinery,
        projects: sanitizeCollection(projects),
        setProjects,
        harvestEntries: sanitizeCollection(harvestEntries),
        setHarvestEntries,
        pallets: sanitizeCollection(pallets),
        setPallets,
        harvestLogs: sanitizeCollection(harvestLogs),
        setHarvestLogs,
        inventoryTransactions: sanitizeCollection(inventoryTransactions),
        setInventoryTransactions,
        stockTransactions: sanitizeCollection(stockTransactions),
        setStockTransactions,
        harvestedProduce: sanitizeCollection(harvestedProduce),
        setHarvestedProduce,
        employeeGroups: sanitizeCollection(employeeGroups),
        setEmployeeGroups,
        dailyLogs: sanitizeCollection(dailyLogs),
        setDailyLogs,
        nutritionPlans: sanitizeCollection(nutritionPlans),
        setNutritionPlans,
        planExecutions: sanitizeCollection(planExecutions),
        setPlanExecutions,
        forumPosts: sanitizeCollection(forumPosts),
        setForumPosts,
        listings: sanitizeCollection(listings),
        setListings,
        bids: sanitizeCollection(bids),
        setBids,
        reviews: sanitizeCollection(reviews),
        setReviews,
        alerts: sanitizeCollection(alerts),
        setAlerts,
        purchaseOrders: sanitizeCollection(purchaseOrders),
        setPurchaseOrders,
        suppliers: sanitizeCollection(suppliers),
        setSuppliers,
        operationalLogs: sanitizeCollection(operationalLogs),
        setOperationalLogs,
        notes: sanitizeCollection(notes),
        setNotes,
        checkpoints: sanitizeCollection(checkpoints),
        setCheckpoints,
        systemLogs: sanitizeCollection(systemLogs),
        setSystemLogs,
        allUsers: sanitizeCollection(allUsers),
        setAllUsers,
        discoverableOrganizations: sanitizeCollection(discoverableOrganizations),
        subscriptionRequests: sanitizeCollection(subscriptionRequests),
        setSubscriptionRequests,
        cropVarieties: Array.isArray(cropVarieties) ? cropVarieties : [],
        setCropVarieties,
        crops: sanitizeCollection(crops),
        setCrops
    };
};
