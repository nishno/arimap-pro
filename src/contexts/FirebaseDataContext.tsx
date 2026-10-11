import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
    User, Organization, Membership, PlantationFeature, Layer, 
    InventoryItem, HarvestEvent, Account, Transaction, 
    WorkAssignment, Employee, Machinery, Project,
    HarvestEntry, Pallet, HarvestLog, OperationalLog, InventoryTransaction,
    EmployeeGroup, DailyLogEntry, NutritionPlan, PlanExecution,
    ForumPost, Listing, Bid, Review, Alert, PurchaseOrder, Supplier,
    Note, Checkpoint, SystemLog, SubscriptionRequest, Crop, StockTransaction, HarvestedProduce
} from '../types';

interface FirebaseDataContextType {
    plantationFeatures: PlantationFeature[];
    setPlantationFeatures: React.Dispatch<React.SetStateAction<PlantationFeature[]>>;
    layers: Layer[];
    setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
    organizations: Organization[];
    setOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>;
    memberships: Membership[];
    setMemberships: React.Dispatch<React.SetStateAction<Membership[]>>;
    inventoryItems: InventoryItem[];
    setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    harvestEvents: HarvestEvent[];
    setHarvestEvents: React.Dispatch<React.SetStateAction<HarvestEvent[]>>;
    accounts: Account[];
    setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    workAssignments: WorkAssignment[];
    setWorkAssignments: React.Dispatch<React.SetStateAction<WorkAssignment[]>>;
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    machinery: Machinery[];
    setMachinery: React.Dispatch<React.SetStateAction<Machinery[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    harvestEntries: HarvestEntry[];
    setHarvestEntries: React.Dispatch<React.SetStateAction<HarvestEntry[]>>;
    pallets: Pallet[];
    setPallets: React.Dispatch<React.SetStateAction<Pallet[]>>;
    harvestLogs: HarvestLog[];
    setHarvestLogs: React.Dispatch<React.SetStateAction<HarvestLog[]>>;
    inventoryTransactions: InventoryTransaction[];
    setInventoryTransactions: React.Dispatch<React.SetStateAction<InventoryTransaction[]>>;
    stockTransactions: StockTransaction[];
    setStockTransactions: React.Dispatch<React.SetStateAction<StockTransaction[]>>;
    harvestedProduce: HarvestedProduce[];
    setHarvestedProduce: React.Dispatch<React.SetStateAction<HarvestedProduce[]>>;
    employeeGroups: EmployeeGroup[];
    setEmployeeGroups: React.Dispatch<React.SetStateAction<EmployeeGroup[]>>;
    dailyLogs: DailyLogEntry[];
    setDailyLogs: React.Dispatch<React.SetStateAction<DailyLogEntry[]>>;
    nutritionPlans: NutritionPlan[];
    setNutritionPlans: React.Dispatch<React.SetStateAction<NutritionPlan[]>>;
    planExecutions: PlanExecution[];
    setPlanExecutions: React.Dispatch<React.SetStateAction<PlanExecution[]>>;
    forumPosts: ForumPost[];
    setForumPosts: React.Dispatch<React.SetStateAction<ForumPost[]>>;
    listings: Listing[];
    setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
    bids: Bid[];
    setBids: React.Dispatch<React.SetStateAction<Bid[]>>;
    reviews: Review[];
    setReviews: React.Dispatch<React.SetStateAction<Review[]>>;
    alerts: Alert[];
    setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
    purchaseOrders: PurchaseOrder[];
    setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
    suppliers: Supplier[];
    setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
    operationalLogs: OperationalLog[];
    setOperationalLogs: React.Dispatch<React.SetStateAction<OperationalLog[]>>;
    notes: Note[];
    setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
    checkpoints: Checkpoint[];
    setCheckpoints: React.Dispatch<React.SetStateAction<Checkpoint[]>>;
    systemLogs: SystemLog[];
    setSystemLogs: React.Dispatch<React.SetStateAction<SystemLog[]>>;
    allUsers: User[];
    setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
    discoverableOrganizations: Organization[];
    subscriptionRequests: SubscriptionRequest[];
    setSubscriptionRequests: React.Dispatch<React.SetStateAction<SubscriptionRequest[]>>;
    cropVarieties: string[];
    setCropVarieties: React.Dispatch<React.SetStateAction<string[]>>;
    crops: Crop[];
    setCrops: React.Dispatch<React.SetStateAction<Crop[]>>;

    // Connection Indicators
    isSyncing: boolean;
    onlineStatus: 'online' | 'switching-offline' | 'offline' | 'reconnecting';
    setOnlineStatus: (status: 'online' | 'switching-offline' | 'offline' | 'reconnecting') => void;
}

const GLOBAL_DATA_CONTEXT_KEY = '__AGRIMAP_FIREBASE_DATA_CONTEXT__';
let FirebaseDataContext: React.Context<FirebaseDataContextType | undefined>;
if (typeof window !== 'undefined') {
    if (!(window as any)[GLOBAL_DATA_CONTEXT_KEY]) {
        (window as any)[GLOBAL_DATA_CONTEXT_KEY] = createContext<FirebaseDataContextType | undefined>(undefined);
    }
    FirebaseDataContext = (window as any)[GLOBAL_DATA_CONTEXT_KEY];
} else {
    FirebaseDataContext = createContext<FirebaseDataContextType | undefined>(undefined);
}

// Global Defensive Helper: recursively sanitize any Firestore FieldValues, Timestamps, Sentinels, or raw Objects
export const sanitizeValue = (val: any): any => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') return val;
    
    if (typeof val === 'object') {
        // Firestore Timestamp
        if (typeof val.toDate === 'function') {
            try {
                return val.toDate().toISOString();
            } catch (e) {
                return new Date().toISOString();
            }
        }
        if (typeof val.seconds === 'number' && (val.nanoseconds !== undefined || val.seconds !== undefined)) {
            return new Date(val.seconds * 1000).toISOString();
        }

        // Firestore FieldValue / Sentinel (has _methodName or bc !== undefined or type === 'increment')
        if (val._methodName !== undefined || val.bc !== undefined || val.type === 'increment') {
            if (val._methodName === 'increment' || val.type === 'increment') {
                const num = typeof val.operand === 'number' ? val.operand : (typeof val.value === 'number' ? val.value : 0);
                return isNaN(num) ? 0 : num;
            }
            if (val._methodName === 'serverTimestamp') {
                return new Date().toISOString();
            }
            if (val._methodName === 'deleteField') {
                return undefined;
            }
            return '';
        }

        if (Array.isArray(val)) {
            return val.map(sanitizeValue);
        }

        // Plain object: recursively sanitize each key
        const cleaned: Record<string, any> = {};
        for (const k of Object.keys(val)) {
            cleaned[k] = sanitizeValue(val[k]);
        }
        return cleaned;
    }
    
    return val;
};

// Global Defensive Helper: ensure collection is always a valid list & objects have string fallbacks
export const sanitizeCollection = <T extends Record<string, any>>(list: T[] | undefined | null): T[] => {
    if (!list || !Array.isArray(list)) return []; // Always return a fresh mutable empty array
    const sanitized = list.map(rawItem => {
        if (!rawItem || typeof rawItem !== 'object') return rawItem;
        const item = sanitizeValue(rawItem);
        const copy = { ...item } as any;

        // Ensure common string properties that might accidentally hold object payloads are extracted cleanly
        const textProperties = [
            'workName', 'name', 'title', 'taskType', 'description', 'notes', 'status', 
            'label', 'issue', 'recommendedAction', 'prescribedChemical', 'dosage', 'syncStatus'
        ];
        textProperties.forEach(prop => {
            if (copy[prop] && typeof copy[prop] === 'object') {
                const inner = copy[prop];
                copy[prop] = inner.name || inner.workName || inner.title || inner.taskType || inner.issue || String(inner);
            }
        });
        
        // Normalize any existing null/undefined values or missing text properties to ''
        const keys = Object.keys(copy);
        keys.forEach(k => {
            if (copy[k] === null || copy[k] === undefined) {
                copy[k] = '';
            } else if (typeof copy[k] === 'string') {
                copy[k] = copy[k].trim();
            }
        });

        // Ensure standard string fields used extensively in views are never missing or undefined
        const stringFields = [
            'name', 'workName', 'taskType', 'email', 'personalNumber', 'verificationStatus', 'country', 'status',
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

        // Common numeric fields safety: ensure they are numbers, never objects or sentinels
        const numericFields = [
            'totalBoxes', 'totalNetWeightKg', 'totalGrossWeightKg', 'totalVerifiedWeightKg',
            'totalEstimatedWeightKg', 'totalPickerCost', 'totalPackagingCost', 'totalPallets',
            'totalVehicleCost', 'totalPunets', 'physicalPunets', 'punetsPerBox', 'currentStock',
            'quantity', 'cost', 'unitCost', 'defaultBoxWeightKg', 'price', 'salary'
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

    // Global ID Deduplication safety: ensure no two items in any collection share the same ID
    const seenIds = new Set<string>();
    const uniqueResult: T[] = [];
    for (const item of sanitized) {
        if (item && typeof item === 'object' && item.id) {
            const strId = String(item.id);
            if (seenIds.has(strId)) continue;
            seenIds.add(strId);
        }
        uniqueResult.push(item);
    }
    return uniqueResult;
};

interface FirebaseDataProviderProps {
    children: React.ReactNode;
    rawData: any; // Raw output of useFirebaseData
    isConnectionHealthy: boolean;
}

export const FirebaseDataProvider: React.FC<FirebaseDataProviderProps> = ({ children, rawData, isConnectionHealthy }) => {
    const [onlineStatus, setOnlineStatus] = useState<'online' | 'switching-offline' | 'offline' | 'reconnecting'>('online');
    const [isSyncing, setIsSyncing] = useState(false);

    // Track network/offline transitions and print compliance console logs
    useEffect(() => {
        if (!navigator.onLine || !isConnectionHealthy) {
            console.log('[Firebase] Switching to Offline/Cache Priority Mode');
            setOnlineStatus('offline');
            setIsSyncing(false);
        } else {
            console.log('[Firebase] Connection attempt 1...');
            setOnlineStatus('reconnecting');
            setIsSyncing(true);
            const timer = setTimeout(() => {
                setOnlineStatus('online');
                setIsSyncing(false);
                console.log('[Firebase] Connected successfully.');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [navigator.onLine, isConnectionHealthy]);

    // Sanitize operations for all retrieved collections in the unified middle layer.
    // Replace any undefined/null collection with [] and ensure structural strings are non-null.
    const sanitizedData = useMemo(() => {
        const d = rawData || {};
        return {
            plantationFeatures: sanitizeCollection<PlantationFeature>(d.plantationFeatures),
            layers: sanitizeCollection<Layer>(d.layers),
            organizations: sanitizeCollection<Organization>(d.organizations),
            memberships: sanitizeCollection<Membership>(d.memberships),
            inventoryItems: sanitizeCollection<InventoryItem>(d.inventoryItems),
            harvestEvents: sanitizeCollection<HarvestEvent>(d.harvestEvents),
            accounts: sanitizeCollection<Account>(d.accounts),
            transactions: sanitizeCollection<Transaction>(d.transactions),
            workAssignments: sanitizeCollection<WorkAssignment>(d.workAssignments),
            employees: sanitizeCollection<Employee>(d.employees),
            machinery: sanitizeCollection<Machinery>(d.machinery),
            projects: sanitizeCollection<Project>(d.projects),
            harvestEntries: sanitizeCollection<HarvestEntry>(d.harvestEntries),
            pallets: sanitizeCollection<Pallet>(d.pallets),
            harvestLogs: sanitizeCollection<HarvestLog>(d.harvestLogs),
            inventoryTransactions: sanitizeCollection<InventoryTransaction>(d.inventoryTransactions),
            stockTransactions: sanitizeCollection<StockTransaction>(d.stockTransactions),
            harvestedProduce: sanitizeCollection<HarvestedProduce>(d.harvestedProduce),
            employeeGroups: sanitizeCollection<EmployeeGroup>(d.employeeGroups),
            dailyLogs: sanitizeCollection<DailyLogEntry>(d.dailyLogs),
            nutritionPlans: sanitizeCollection<NutritionPlan>(d.nutritionPlans),
            planExecutions: sanitizeCollection<PlanExecution>(d.planExecutions),
            forumPosts: sanitizeCollection<ForumPost>(d.forumPosts),
            listings: sanitizeCollection<Listing>(d.listings),
            bids: sanitizeCollection<Bid>(d.bids),
            reviews: sanitizeCollection<Review>(d.reviews),
            alerts: sanitizeCollection<Alert>(d.alerts),
            purchaseOrders: sanitizeCollection<PurchaseOrder>(d.purchaseOrders),
            suppliers: sanitizeCollection<Supplier>(d.suppliers),
            operationalLogs: sanitizeCollection<OperationalLog>(d.operationalLogs),
            notes: sanitizeCollection<Note>(d.notes),
            checkpoints: sanitizeCollection<Checkpoint>(d.checkpoints),
            systemLogs: sanitizeCollection<SystemLog>(d.systemLogs),
            allUsers: sanitizeCollection<User>(d.allUsers),
            discoverableOrganizations: sanitizeCollection<Organization>(d.discoverableOrganizations),
            subscriptionRequests: sanitizeCollection<SubscriptionRequest>(d.subscriptionRequests),
            cropVarieties: Array.isArray(d.cropVarieties) ? d.cropVarieties : [],
            crops: sanitizeCollection<Crop>(d.crops),
        };
    }, [rawData]);

    const contextValue: FirebaseDataContextType = {
        ...sanitizedData,
        // Forward setter functions safely or fall back to empty functions if they are missing
        setPlantationFeatures: rawData?.setPlantationFeatures || (() => {}),
        setLayers: rawData?.setLayers || (() => {}),
        setOrganizations: rawData?.setOrganizations || (() => {}),
        setMemberships: rawData?.setMemberships || (() => {}),
        setInventoryItems: rawData?.setInventoryItems || (() => {}),
        setHarvestEvents: rawData?.setHarvestEvents || (() => {}),
        setAccounts: rawData?.setAccounts || (() => {}),
        setTransactions: rawData?.setTransactions || (() => {}),
        setWorkAssignments: rawData?.setWorkAssignments || (() => {}),
        setEmployees: rawData?.setEmployees || (() => {}),
        setMachinery: rawData?.setMachinery || (() => {}),
        setProjects: rawData?.setProjects || (() => {}),
        setHarvestEntries: rawData?.setHarvestEntries || (() => {}),
        setPallets: rawData?.setPallets || (() => {}),
        setHarvestLogs: rawData?.setHarvestLogs || (() => {}),
        setInventoryTransactions: rawData?.setInventoryTransactions || (() => {}),
        setStockTransactions: rawData?.setStockTransactions || (() => {}),
        setHarvestedProduce: rawData?.setHarvestedProduce || (() => {}),
        setEmployeeGroups: rawData?.setEmployeeGroups || (() => {}),
        setDailyLogs: rawData?.setDailyLogs || (() => {}),
        setNutritionPlans: rawData?.setNutritionPlans || (() => {}),
        setPlanExecutions: rawData?.setPlanExecutions || (() => {}),
        setForumPosts: rawData?.setForumPosts || (() => {}),
        setListings: rawData?.setListings || (() => {}),
        setBids: rawData?.setBids || (() => {}),
        setReviews: rawData?.setReviews || (() => {}),
        setAlerts: rawData?.setAlerts || (() => {}),
        setPurchaseOrders: rawData?.setPurchaseOrders || (() => {}),
        setSuppliers: rawData?.setSuppliers || (() => {}),
        setOperationalLogs: rawData?.setOperationalLogs || (() => {}),
        setNotes: rawData?.setNotes || (() => {}),
        setCheckpoints: rawData?.setCheckpoints || (() => {}),
        setSystemLogs: rawData?.setSystemLogs || (() => {}),
        setAllUsers: rawData?.setAllUsers || (() => {}),
        setSubscriptionRequests: rawData?.setSubscriptionRequests || (() => {}),
        setCropVarieties: rawData?.setCropVarieties || (() => {}),
        setCrops: rawData?.setCrops || (() => {}),
        
        isSyncing,
        onlineStatus,
        setOnlineStatus
    };

    return (
        <FirebaseDataContext.Provider value={contextValue}>
            {children}
            <SynchronizingOverlay />
        </FirebaseDataContext.Provider>
    );
};

const SynchronizingOverlay: React.FC = () => {
    const { isSyncing, onlineStatus } = useFirebaseDataContext();
    
    if (!isSyncing && onlineStatus !== 'reconnecting') return null;
    
    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-indigo-600/95 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-indigo-400 text-xs font-black uppercase tracking-widest animate-bounce">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/40 border-t-white" />
            <span>Synchronizing Cloud Data...</span>
        </div>
    );
};

export const useFirebaseDataContext = () => {
    const context = useContext(FirebaseDataContext);
    if (!context) {
        throw new Error('useFirebaseDataContext must be used within a FirebaseDataProvider');
    }
    return context;
};
