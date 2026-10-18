import {isLocalRuntime} from './local/runtime';
import { usePlatformAdmin } from './hooks/usePlatformAdmin';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import L from 'leaflet';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { Dashboard } from './components/Dashboard';
import MarketplaceView from './components/MarketplaceView';
import HarvestingView from './components/HarvestingView';
import TasksAndWorksView from './components/TasksAndWorksView';
import PlannerAndRemainderView from './components/PlannerAndRemainderView';
import AiAnalystView from './components/AiAnalystView';
import DesignView from './components/DesignView';
import AgronomyView from './components/AgronomyView';
import StockView from './components/InventoryView';
import AccountingView from './components/AccountingView';
import FoundersView from './components/FoundersView';
import ToolsView from './components/ToolsView';
import PersonalizationView from './components/PersonalizationView';
import CommunicationHubPanel from './components/CommunicationHubPanel';
import AdminView from './components/AdminView';
import LogsView from './components/LogsView';
import ProfileView from './components/ProfileView'; 
import HelpAndGuideView from './components/HelpAndGuideView';
import LoginModal from './components/LoginModal';
import RegistrationModal from './components/RegistrationModal';
import WelcomeModal from './components/WelcomeModal';
import PostRegistrationChoiceModal from './components/PostRegistrationChoiceModal';
import LocalServerModal from './components/LocalServerModal';
import { SmartOfflineDisconnectModal, ReSyncNotificationPrompt } from './components/SmartOfflineDisconnectModal';
import TicketManager from './components/TicketManager';
import { generateAgriBusinessAnalysis, analyzePlantDisease, generateDocumentComparison, generateSoilAnalysis } from './services/geminiService';
import DataStateAuditor from './components/SystemManagement/DataStateAuditor';
import { SyncConflictModal } from './components/SystemManagement/SyncConflictModal';
import HardwareLabs from './components/SystemManagement/HardwareLabs';
import { HardwareTestingSandboxMap } from './components/SystemManagement/HardwareLabs/HardwareTestingSandboxMap';
import { FloatingLabsSwitcher } from './components/SystemManagement/FloatingLabsSwitcher';
import RootAdminView from './components/RootAdminView';
import { MapComponentProps } from './components/MapComponent';
import { safeStorage } from './services/storageService';
import { initGlobalHardwareScannerListener } from './utils/hardwareScannerBus';
import { checkModuleAccess, User, Organization, Membership, AppMode, SystemLog, InventoryItem, InventoryTransaction, HarvestEvent, HarvestEntry, Pallet, HarvestLog, Account, Transaction, Role, Employee, DailyLogEntry, WorkAssignment, Machinery, EmployeeGroup, ForumPost, Listing, Bid, Review, Alert, Project, ProjectData, PlantationFeature, Layer, AreaPlantationFeature, NutritionPlan, PlanExecution, DashboardWidget, ActiveDrawingTool, FeatureType, LinePlantationFeature, SeedlingPlantationFeature, VarietyRule, AiReport, SoilAnalysisResult, UploadedDocument, PlantDiseaseAnalysis, SoilData, AnalysisResult, GroundingSource, AssistantMessage, NotePlantationFeature, Permission, ALL_PERMISSIONS, Supplier, PurchaseOrder, OperationalLog, Note, UserRole, OrganizationTicket, WorkExperience, Crop, isValidCoordinate, LocalServerConfig, MaterialUsed, AssignedVehicle, StockTransaction, HarvestedProduce } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { Toaster, toast } from 'sonner';
import { 
    GoogleGenAI, 
    GenerateContentResponse,
    Type
} from "@google/genai";
import { db, auth, doc, getDocFromServer, onSnapshot, collection, query, where, setDoc, updateDoc, deleteDoc, addDoc, getDocs, writeBatch, enableNetwork, disableNetwork, getSyncQueueSize, clearSyncQueue, testFirestoreConnection, resetFirestorePersistence, setConnectionState, trackModification } from './firebase';
import { syncManager } from './services/SyncManager';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getMainPlantation, resolvePlantationCenter, CANONICAL_AGROBARI_CENTER } from './utils/plantationHelper';
import FieldManagerModal from './components/FieldManagerModal';
import SaveFieldModal from './components/SaveFieldModal';
import ErrorBoundary from './components/ErrorBoundary';
import MobileNav from './components/MobileNav';
import { NotificationHub } from './components/NotificationHub';
import { getSphericalPolygonArea, calculateStockDeduction, getFeatureGroupCenter, generateTrenches, generateSeedlingCoordinates, calculateLineLength, identifyFeaturesInPolygon } from './services/geospatialService';
import { useAuth } from './hooks/useAuth';
import { useFirebaseData } from './hooks/useFirebaseData';
import { FirebaseDataProvider, useFirebaseDataContext } from './contexts/FirebaseDataContext';
import { GlobalDataInterceptorProvider } from './contexts/GlobalDataInterceptorContext';
import { useAiAssistant } from './hooks/useAiAssistant';
import GlobalAssistantPanel from './components/GlobalAssistantPanel';
import { godAIKnowledgeEngine } from './new_engine/ai/GodAIKnowledgeEngine';
import { getSavedDashboardLayout, saveDashboardLayout } from './utils/dashboardLayoutStorage';
import FloatingCommunicationHub, { LiveMapShowcase } from './components/FloatingCommunicationHub';
import LiveMapShowcaseOverlay from './components/LiveMapShowcaseOverlay';
import { useProjectManagement } from './hooks/useProjectManagement';
import { handleFirestoreError, sanitizeFeatureForFirestore, sanitizeOrganizationForFirestore, testFirebaseConnection, sanitizeObject } from './lib/firebaseUtils';
import { AdvancedAnalytics } from './features/AdvancedAnalytics';
import { ThemeProvider } from './contexts/ThemeContext';
import ThemeColorStudio from './components/ThemeColorStudio';
import LetterColorStudio from './components/LetterColorStudio';
import GlobalSpotlightSearch from './components/GlobalSpotlightSearch';

import { USE_FIREBASE } from './config';
import { LockClosedIcon } from './components/Icons';
import { motion } from 'motion/react';

// Shadow localStorage globally in this file using safeStorage to prevent QuotaExceededError crashes
const localStorage = {
    getItem: (key: string): string | null => safeStorage.getItem(key),
    setItem: (key: string, value: string): void => { safeStorage.setItem(key, value); },
    removeItem: (key: string): void => { safeStorage.removeItem(key); },
    clear: (): void => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.clear();
            }
        } catch (e) {
            console.warn('[SafeStorage] clear failed', e);
        }
    }
};

const EnterpriseLock: React.FC<{ onSwitchToFounders: () => void }> = ({ onSwitchToFounders }) => (
    <div className="flex-1 bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 text-center shadow-2xl border border-slate-100 animate-slide-up">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                <LockClosedIcon className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-4">Enterprise <span className="text-amber-600">Locked</span></h2>
            <p className="text-slate-500 font-bold mb-8 leading-relaxed">This module requires an active Plantation Ticket. Please select or register a plantation in the Founders Vault.</p>
            <button 
                onClick={onSwitchToFounders}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
                Go to Founders Vault
            </button>
        </div>
    </div>
);

const VerificationBanner: React.FC<{ email: string; onResend: () => void; onRefresh: () => void }> = ({ email, onResend, onRefresh }) => {
    const [sent, setSent] = useState(false);
    
    return (
        <div className="bg-blue-600 text-white px-4 py-2 flex flex-col md:flex-row items-center justify-center gap-3 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Master Identity Unverified</span>
            </div>
            <p className="text-[10px] font-bold opacity-90 shadow-sm">
                Your email <span className="underline decoration-white/30">{email}</span> is not verified. Cloud writes may be restricted.
            </p>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => {
                        onResend();
                        setSent(true);
                        setTimeout(() => setSent(false), 30000); // 30s cooldown
                    }}
                    disabled={sent}
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sent ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-blue-50 shadow-lg'}`}
                >
                    {sent ? 'Link Sent!' : 'Resend Link'}
                </button>
                <button 
                    onClick={onRefresh}
                    className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all bg-blue-500 hover:bg-blue-400 border border-blue-400 shadow-sm"
                >
                    Check Status
                </button>
            </div>
        </div>
    );
};

const executeDecoupledPresenceUpdate = async (updateFn: () => Promise<void>) => {
    try {
        await Promise.resolve(updateFn());
    } catch (err: any) {
        const errMsg = String(err?.message || err).toLowerCase();
        const errCode = String(err?.code || '').toLowerCase();
        
        const isNetworkOr404 = 
            errCode.includes('not-found') ||
            errCode.includes('unavailable') ||
            errCode.includes('permission-denied') ||
            errMsg.includes('404') ||
            errMsg.includes('not found') ||
            errMsg.includes('not-found') ||
            errMsg.includes('network') ||
            errMsg.includes('offline') ||
            errMsg.includes('connection') ||
            errMsg.includes('unreachable') ||
            errMsg.includes('err_network_changed') ||
            errMsg.includes('network-changed') ||
            errMsg.includes('quota');
            
        if (isNetworkOr404) {
            console.info("[Presence Guard] Decoupled presence updater caught and absorbed connection/404/permission boundary state:", errMsg);
        } else {
            console.warn("[Presence Guard] Silent recovery from non-critical presence error:", errMsg);
        }
    }
};

const App: React.FC = () => {
    const { language, setRegion } = useLanguage();
    const lastValidPermissionsRef = React.useRef<Set<Permission>>(new Set<Permission>());
    const [appMode, setAppMode] = useState<AppMode>(() => {
        const saved = localStorage.getItem('agri-planter-mode');
        return (saved as AppMode) || 'dashboard';
    });
    const [labTab, setLabTab] = useState<'hardware' | 'devices_map' | 'theme' | 'letters' | 'analytics'>('hardware');
    const { 
        currentUser, 
        setCurrentUser, 
        isAuthReady, 
        handleUpdateUser, 
        handleLogout, 
        handleEmailLogin, 
        handleGoogleLogin, 
        handleResetPassword,
        handleSwitchOrg,
        handleSwitchRole,
        handleDeleteAccount,
        handleSendVerification,
        handleRefreshUser
    } = useAuth();

    const [isConnectionHealthy, setIsConnectionHealthy] = useState(true);
    const [localServerConfig, setLocalServerConfig] = useState<LocalServerConfig>(() => {
        return safeStorage.safeParse(localStorage.getItem('agrimap-local-config'), { isLocalMode: false, serverIp: '127.0.0.1', autoDiscovery: true });
    });
    const [isManualOffline, setIsManualOffline] = useState(() => {
        return localStorage.getItem('agrimap-manual-offline') === 'true';
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showSmartDisconnectModal, setShowSmartDisconnectModal] = useState(false);
    const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
    const [showReSyncPrompt, setShowReSyncPrompt] = useState(false);
    const [operationalTaskToLog, setOperationalTaskToLog] = useState<string | null>(null);

    useEffect(() => {
        initGlobalHardwareScannerListener();
        const handleOpenReg = () => setIsRegisterModalOpen(true);
        const handleOpenLogin = () => setIsLoginModalOpen(true);
        window.addEventListener('open-registration-modal', handleOpenReg);
        window.addEventListener('open-login-modal', handleOpenLogin);
        return () => {
            window.removeEventListener('open-registration-modal', handleOpenReg);
            window.removeEventListener('open-login-modal', handleOpenLogin);
        };
    }, []);

    // Force-close auth modals when user becomes non-guest
    useEffect(() => {
        if (currentUser && !currentUser.isGuest) {
            setIsLoginModalOpen(false);
            setIsRegisterModalOpen(false);
            setShowWelcomeModal(false);
        }
    }, [currentUser]);

    const platformClaims = usePlatformAdmin(currentUser?.id);
    const hasPlatformAdminClaim = platformClaims.isAdmin;
    const isSystemAdmin = Boolean(currentUser && !currentUser.isGuest && hasPlatformAdminClaim);
    const isRoot = isSystemAdmin;

    // Firebase Connection Test
    useEffect(() => {
        if (!USE_FIREBASE) return;
        const timer = setTimeout(() => {
            testFirebaseConnection();
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
        // Preference: Firestore session > LocalStorage
        return localStorage.getItem('agri-planter-active-org') || null;
    });

    const isEnterpriseMode = useMemo(() => {
        const enterpriseModes: AppMode[] = ['agronomy', 'design', 'harvesting', 'stock', 'tasks', 'tools', 'founders'];
        return enterpriseModes.includes(appMode) && Boolean(activeOrgId || isSystemAdmin || (currentUser && !currentUser.isGuest));
    }, [appMode, activeOrgId, isSystemAdmin, currentUser]);

    const [hardwareDevices, setHardwareDevices] = useState<any[]>(() => {
        return safeStorage.safeParse(localStorage.getItem('hardware_devices'), []);
    });

    const handleAddDevice = (device: any) => {
        setHardwareDevices(prev => {
            const exists = prev.find(d => d.id === device.id && d.organizationId === device.organizationId);
            let updated;
            if (exists) {
                updated = prev.filter(d => !(d.id === device.id && d.organizationId === device.organizationId));
            } else {
                updated = [...prev, device];
            }
            localStorage.setItem('hardware_devices', JSON.stringify(updated));
            return updated;
        });
    };

    useEffect(() => {
        const handleSwitchMode = (e: any) => {
            if (e.detail) setAppMode(e.detail);
        };
        window.addEventListener('agrimap-switch-mode', handleSwitchMode);
        return () => window.removeEventListener('agrimap-switch-mode', handleSwitchMode);
    }, []);

    const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

    useEffect(() => {
        if (!USE_FIREBASE) return;
        if (isManualOffline) {
            disableNetwork(db).catch(console.error);
        } else {
            enableNetwork(db).catch(console.error);
        }
    }, [isManualOffline]);

    const [isHeadlessSyncing, setIsHeadlessSyncing] = useState(false);

    const triggerHeadlessBackgroundSync = useCallback(async () => {
        if(isLocalRuntime)return;
        if (isHeadlessSyncing) return;
        setIsHeadlessSyncing(true);
        
        let currentDelay = 5000;
        const maxBackoff = 300000; // 5 mins
        
        const runSync = async () => {
            if (!navigator.onLine) {
                setIsHeadlessSyncing(false);
                return;
            }
            if (getSyncQueueSize() === 0) {
                setIsHeadlessSyncing(false);
                return;
            }
            if (syncManager.isConflictPresent()) {
                setIsSyncConflictModalOpen(true);
                setIsHeadlessSyncing(false);
                return;
            }
            
            console.info(`[Headless Sync] Triggering silent queue push with delay backoff ${currentDelay}ms...`);
            try {
                const success = await syncManager.pushAllToCloud();
                if (success) {
                    setIsHeadlessSyncing(false);
                    setIsManualOffline(false);
                    localStorage.setItem('agrimap-manual-offline', 'false');
                } else {
                    currentDelay = Math.min(currentDelay * 2, maxBackoff);
                    console.warn(`[Headless Sync] Sync failed/incomplete. Retrying in ${currentDelay}ms using exponential backoff...`);
                    setTimeout(runSync, currentDelay);
                }
            } catch (err) {
                currentDelay = Math.min(currentDelay * 2, maxBackoff);
                console.error(`[Headless Sync] Error during silent background sync. Backing off to ${currentDelay}ms:`, err);
                setTimeout(runSync, currentDelay);
            }
        };

        setTimeout(runSync, 1000);
    }, [isHeadlessSyncing]);

    const handleToggleOffline = useCallback(async () => {
        if(isLocalRuntime){toast.info('Local server mode is already active. Cloud backup is always manual.');return;}
        const nextState = !isManualOffline;
        setIsManualOffline(nextState);
        localStorage.setItem('agrimap-manual-offline', String(nextState));
        
        if (nextState) {
            await disableNetwork(db);
            toast.info("Offline Mode: Data sync paused.");
        } else {
            await enableNetwork(db);
            toast.success("Online Mode: Data sync resumed.");

            // LAN Mode persistence check
            if (localServerConfig.isLocalMode) {
                toast("Connected via LAN Server", {
                    description: "You are currently working on a local network node. Would you like to switch to Global Cloud mode?",
                    action: {
                        label: "Switch to Cloud",
                        onClick: () => {
                            const newConfig = { ...localServerConfig, isLocalMode: false };
                            setLocalServerConfig(newConfig);
                            localStorage.setItem('agrimap-local-config', JSON.stringify(newConfig));
                            toast.info("Switching to Cloud Mode. Reloading...", { duration: 2000 });
                            setTimeout(() => window.location.reload(), 1500);
                        }
                    }
                });
            }

            // Also try to push data if we just came online
            if (getSyncQueueSize() > 0) {
                if (syncManager.isConflictPresent()) {
                    setIsSyncConflictModalOpen(true);
                } else {
                    triggerHeadlessBackgroundSync();
                }
            }
        }
    }, [isManualOffline, localServerConfig, triggerHeadlessBackgroundSync]);

    const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const dirtyFeaturesRef = React.useRef<Map<string, PlantationFeature>>(new Map());
    const dirtyLayersRef = React.useRef<Map<string, Layer>>(new Map());

    const flushSyncQueue = useCallback(async () => {
        if (!USE_FIREBASE || (isManualOffline&&!isLocalRuntime)) return;
        
        const dirtyFeaturesMap = new Map(dirtyFeaturesRef.current);
        const dirtyLayersMap = new Map(dirtyLayersRef.current);
        
        if (dirtyFeaturesMap.size === 0 && dirtyLayersMap.size === 0) return true;
        
        dirtyFeaturesRef.current.clear();
        dirtyLayersRef.current.clear();
        
        try {
            const batch = writeBatch(db);
            const isLocalServerMode = localStorage.getItem('agrimap-local-config') ? JSON.parse(localStorage.getItem('agrimap-local-config')!).isLocalMode : false;
            const syncStatus = (isLocalServerMode || isManualOffline) ? 'pending' : 'cloud_synced';
            
            dirtyFeaturesMap.forEach((feature, id) => {
                const sanitized = sanitizeFeatureForFirestore(feature);
                trackModification(`plantationFeatures/${id}`, 'set', sanitized, syncStatus);
                batch.set(doc(db, 'plantationFeatures', id), sanitized);
            });
            
            dirtyLayersMap.forEach((layer, id) => {
                trackModification(`layers/${id}`, 'set', layer, syncStatus);
                batch.set(doc(db, 'layers', id), layer);
            });
            
            await batch.commit();
            if(isLocalRuntime)return true;
            console.log(`[BatchSync] Successfully committed ${dirtyFeaturesMap.size} features and ${dirtyLayersMap.size} layers as ${syncStatus}.`);
        } catch (error) {
            if(isLocalRuntime){dirtyFeaturesMap.forEach((value,key)=>{if(!dirtyFeaturesRef.current.has(key))dirtyFeaturesRef.current.set(key,value);});dirtyLayersMap.forEach((value,key)=>{if(!dirtyLayersRef.current.has(key))dirtyLayersRef.current.set(key,value);});return false;}
            console.error("Debounced sync failed:", error);
            handleFirestoreError(error, 'write', 'batch-sync');
        }
    }, [isManualOffline]);

    useEffect(()=>{if(!isLocalRuntime)return;(window as any).__AGRIMAP_FLUSH__=flushSyncQueue;return()=>{delete (window as any).__AGRIMAP_FLUSH__;};},[flushSyncQueue]);

    const handlePushToFirestore = useCallback(async () => {
        if (!USE_FIREBASE) return;
        try {
            // First flush any memory-dirty items that are waiting for debounce/manual triggers
            await flushSyncQueue();
            const success = await syncManager.pushAllToCloud();
            if (success) {
                setIsManualOffline(false);
                localStorage.setItem('agrimap-manual-offline', 'false');
                await enableNetwork(db);
            }
        } catch (error) {
            console.error("Push failed:", error);
            handleFirestoreError(error, 'write', 'network/push');
        }
    }, [flushSyncQueue]);

    useEffect(() => {
        const handleQuotaExceeded = () => setIsQuotaExceeded(true);
        window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
        return () => window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    }, []);

    const {
        plantationFeatures,
        setPlantationFeatures,
        layers,
        setLayers,
        organizations,
        setOrganizations,
        memberships,
        setMemberships,
        inventoryItems,
        setInventoryItems,
        harvestEvents,
        setHarvestEvents,
        accounts,
        setAccounts,
        transactions,
        setTransactions,
        workAssignments,
        setWorkAssignments,
        employees,
        setEmployees,
        machinery,
        setMachinery,
        projects,
        setProjects,
        harvestEntries,
        setHarvestEntries,
        pallets,
        setPallets,
        harvestLogs,
        setHarvestLogs,
        inventoryTransactions,
        setInventoryTransactions,
        stockTransactions,
        setStockTransactions,
        harvestedProduce,
        setHarvestedProduce,
        employeeGroups,
        setEmployeeGroups,
        dailyLogs,
        setDailyLogs,
        nutritionPlans,
        setNutritionPlans,
        planExecutions,
        setPlanExecutions,
        forumPosts,
        setForumPosts,
        listings,
        setListings,
        bids,
        setBids,
        reviews,
        setReviews,
        alerts,
        setAlerts,
        purchaseOrders,
        setPurchaseOrders,
        suppliers,
        setSuppliers,
        operationalLogs,
        setOperationalLogs,
        notes,
        setNotes,
        checkpoints,
        setCheckpoints,
        systemLogs,
        setSystemLogs,
        crops,
        setCrops,
        allUsers,
        setAllUsers,
        subscriptionRequests,
        setSubscriptionRequests,
        discoverableOrganizations,
        cropVarieties,
        setCropVarieties
    } = useFirebaseData(currentUser, isAuthReady, activeOrgId, isRoot, isConnectionHealthy);

    const [historyStack, setHistoryStack] = useState<PlantationFeature[][]>([]);
    const [redoStack, setRedoStack] = useState<PlantationFeature[][]>([]);

    const handleUndo = useCallback(() => {
        if (historyStack.length === 0) return;
        const previousState = historyStack[historyStack.length - 1];
        setRedoStack(prev => [plantationFeatures, ...prev]);
        setHistoryStack(prev => prev.slice(0, -1));
        
        // This is a complex operation with Firebase. 
        // For simplicity in this session, we update local state.
        // In a real app, you'd batch update the server.
        setPlantationFeatures(previousState);
        toast.info("Action undone locally");
    }, [historyStack, plantationFeatures]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[0];
        setHistoryStack(prev => [...prev, plantationFeatures]);
        setRedoStack(prev => prev.slice(1));
        setPlantationFeatures(nextState);
        toast.info("Action redone locally");
    }, [redoStack, plantationFeatures]);

    // Push to history when features change significantly
    // (Note: we should debounce or be careful with real-time updates)
    const pushToHistory = useCallback((newState: PlantationFeature[]) => {
        setHistoryStack(prev => {
            const last = prev[prev.length - 1];
            if (JSON.stringify(last) === JSON.stringify(newState)) return prev;
            return [...prev.slice(-19), plantationFeatures]; // Keep last 20
        });
        setRedoStack([]);
    }, [plantationFeatures]);

    // Floating Communication & Live Map Showcase States
    const [isCommunicationHubOpen, setIsCommunicationHubOpen] = useState<boolean>(false);
    const [communicationHubInitialTab, setCommunicationHubInitialTab] = useState<'MEET' | 'CHAT' | 'DIRECT'>('MEET');
    const [liveMapShowcases, setLiveMapShowcases] = useState<LiveMapShowcase[]>([]);
    const [isDrawingMapShowcase, setIsDrawingMapShowcase] = useState<boolean>(false);
    const [showcaseShapeType, setShowcaseShapeType] = useState<'polygon' | 'circle' | 'line' | 'point'>('polygon');
    const [inProgressShowcasePoints, setInProgressShowcasePoints] = useState<[number, number][]>([]);

    const handleOpenMeetHub = useCallback(() => {
        setCommunicationHubInitialTab('MEET');
        setIsCommunicationHubOpen(true);
    }, []);

    const handleOpenChatHub = useCallback(() => {
        setCommunicationHubInitialTab('CHAT');
        setIsCommunicationHubOpen(true);
    }, []);

    useEffect(() => {
        const onMeet = () => handleOpenMeetHub();
        const onChat = () => handleOpenChatHub();
        window.addEventListener('agrimap_open_meet', onMeet);
        window.addEventListener('agrimap_open_chat', onChat);
        return () => {
            window.removeEventListener('agrimap_open_meet', onMeet);
            window.removeEventListener('agrimap_open_chat', onChat);
        };
    }, [handleOpenMeetHub, handleOpenChatHub]);

    const handleStartMapDrawShowcase = useCallback((shape: 'polygon' | 'circle' | 'line' | 'point') => {
        setShowcaseShapeType(shape);
        setInProgressShowcasePoints([]);
        setIsDrawingMapShowcase(true);
        if (appMode !== 'design') {
            setAppMode('design');
        }
    }, [appMode]);

    const handleAddShowcase = useCallback((showcase: LiveMapShowcase) => {
        setLiveMapShowcases(prev => [showcase, ...prev]);
    }, []);

    const handleClearShowcases = useCallback(() => {
        setLiveMapShowcases([]);
    }, []);

    const handleShowcaseMapClick = useCallback((latlng: [number, number]) => {
        if (isDrawingMapShowcase) {
            if (showcaseShapeType === 'point') {
                setInProgressShowcasePoints([latlng]);
            } else {
                setInProgressShowcasePoints(prev => [...prev, latlng]);
            }
        }
    }, [isDrawingMapShowcase, showcaseShapeType]);

    // Sync activeOrgId with currentUser.currentOrgId and persistence
    useEffect(() => {
        if (!isAuthReady || !currentUser || currentUser.isGuest) {
            // Even if guest/not ready, try to recover activeOrgId from localStorage for better UX
            const savedOrgId = localStorage.getItem('agri-planter-active-org');
            if (savedOrgId && savedOrgId !== activeOrgId) {
                setActiveOrgId(savedOrgId);
            }
            return;
        }
        
        const serverOrgId = currentUser.currentOrgId;
        
        // Scenario 1: Server says change org
        if (serverOrgId !== undefined && serverOrgId !== activeOrgId) {
            // Prevent recursive update if 'ALL' is intended but server has null
            if (activeOrgId === 'ALL' && serverOrgId === null) return;
            // Root user special handling: prioritize local selection if server is null
            if (currentUser.id === 'root-system' && serverOrgId === null && activeOrgId) return;
            setActiveOrgId(serverOrgId);
        }
        
        // Scenario 2: Validate access
        if (memberships.length > 0) {
            if (activeOrgId && activeOrgId !== 'ALL') {
                const hasAccess = memberships.some(m => m.organizationId === activeOrgId);
                if (!hasAccess && !isSystemAdmin) {
                    setActiveOrgId(memberships[0].organizationId);
                }
            } else if (!activeOrgId) {
                setActiveOrgId(memberships[0].organizationId);
            }
        }
    }, [currentUser?.currentOrgId, isAuthReady, memberships.length, activeOrgId, isSystemAdmin, currentUser?.id]);

    useEffect(() => {
        if (activeOrgId !== undefined) {
            const orgVal = activeOrgId || 'personal';
            localStorage.setItem('agri-planter-active-org', activeOrgId || '');
            safeStorage.setItem('agri-planter-active-org', orgVal);
            localStorage.setItem('agrimap_active_org_id', orgVal);
            safeStorage.setItem('agrimap_active_org_id', orgVal);
        }
    }, [activeOrgId]);

    // Clear UI state on context switch or logout
    useEffect(() => {
        // IMPROVEMENT: Do not clear organization context just because we are a guest. 
        // Guests can still view discoverable/public organizations.
        // Only clear if auth is ready and there is NO user at all (truly logged out/cleared).
        if (isAuthReady && !currentUser) {
            setActiveOrgId(null);
            localStorage.removeItem('agri-planter-active-org');
        }
        setSelectedFeatureIds([]);
        setActiveDrawingTool({ tool: null });
        setHighlightedFeatureIds([]);
        setEditingGeometryId(null);
    }, [activeOrgId, currentUser?.id, isAuthReady]);

    const {
        assistantMessages,
        assistantMode,
        setAssistantMode,
        isAssistantLoading,
        isAiLoading,
        aiError,
        marketAnalysisResult,
        sources,
        soilAnalysisResult,
        uploadedDocuments,
        setUploadedDocuments,
        documentAnalysisResult,
        uploadedPlantImage,
        setUploadedPlantImage,
        plantDiseaseAnalysis,
        uploadedAgriImage,
        setUploadedAgriImage,
        agriImageAnalysis,
        handleSendCommand,
        handleMarketAnalysis,
        handleSoilAnalysis,
        handlePlantDiseaseAnalysis,
        handleAgriImageAnalysis,
        handleCompareDocuments
    } = useAiAssistant(language);

    // Automated Evolutionary God AI Learning Cycle (monitors works, tasks, harvest, features)
    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                godAIKnowledgeEngine.runDeepLearningCycle({
                    organizations: organizations || [],
                    workAssignments: workAssignments || [],
                    harvestEntries: harvestEntries || [],
                    plantationFeatures: currentOrgFeatures || plantationFeatures || [],
                    nutritionPlans: nutritionPlans || []
                });
            } catch (e) {
                console.error("Auto God AI learning cycle error:", e);
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [workAssignments?.length, harvestEntries?.length, organizations?.length]);

    const [syncDelay, setSyncDelay] = useState<number>(() => {
        const saved = localStorage.getItem('agrimap-sync-delay');
        return saved ? Number(saved) : 1500;
    });

    const handleSetSyncDelay = (delay: number) => {
        setSyncDelay(delay);
        localStorage.setItem('agrimap-sync-delay', String(delay));
        toast.success(`Background sync frequency updated to: ${delay >= 90000000 ? 'Manual Sync Only' : delay >= 60000 ? (delay / 60000) + 'm' : (delay / 1000) + 's'}`);
    };
    const [autoOpenProfileIdentity, setAutoOpenProfileIdentity] = useState(false);
    const [mapCenter, _setMapCenter] = useState<[number, number]>([41.9023, -72.3774]);
    const setMapCenter = useCallback((center: [number, number] | ((prev: [number, number]) => [number, number])) => {
        if (typeof center === 'function') {
            _setMapCenter(prev => {
                const res = center(prev);
                if (Array.isArray(res) && res.length === 2 && Number.isFinite(res[0]) && Number.isFinite(res[1]) && Math.abs(res[0]) <= 90 && Math.abs(res[1]) <= 180) {
                    if (prev && prev[0] === res[0] && prev[1] === res[1]) return prev;
                    return res;
                }
                return prev;
            });
        } else {
            if (Array.isArray(center) && center.length === 2 && Number.isFinite(center[0]) && Number.isFinite(center[1]) && Math.abs(center[0]) <= 90 && Math.abs(center[1]) <= 180) {
                _setMapCenter(prev => {
                    if (prev && prev[0] === center[0] && prev[1] === center[1]) return prev;
                    return center;
                });
            }
        }
    }, []);
    const [mapZoom, _setMapZoom] = useState(13);
    const setMapZoom = useCallback((zoom: number | ((prev: number) => number)) => {
        if (typeof zoom === 'function') {
            _setMapZoom(prev => {
                const res = zoom(prev);
                if (Number.isFinite(res)) return res;
                return prev;
            });
        } else {
            if (Number.isFinite(zoom)) _setMapZoom(zoom);
        }
    }, []);
    const [flyToBounds, _setFlyToBounds] = useState<any>(null);
    const setFlyToBounds = useCallback((bounds: any) => {
        if (!bounds) {
            _setFlyToBounds(prev => prev === null ? null : null);
            return;
        }
        let nextBounds: [number, number][] | null = null;
        if (bounds && typeof bounds.getSouthWest === 'function' && typeof bounds.getNorthEast === 'function') {
            try {
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();
                if (sw && ne && Number.isFinite(sw.lat) && Number.isFinite(sw.lng) && Number.isFinite(ne.lat) && Number.isFinite(ne.lng)) {
                    nextBounds = [[sw.lat, sw.lng], [ne.lat, ne.lng]];
                }
            } catch (e) {
                console.warn("Failed to extract LatLngBounds corners:", e);
            }
        } else if (Array.isArray(bounds)) {
            const valid = bounds.filter(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            if (valid.length > 0) {
                nextBounds = valid;
            }
        }
        if (nextBounds) {
            _setFlyToBounds(prev => {
                if (!prev) return nextBounds;
                if (prev.length !== nextBounds!.length) return nextBounds;
                const isIdentical = prev.every((p: any, i: number) => p[0] === nextBounds![i][0] && p[1] === nextBounds![i][1]);
                if (isIdentical) return prev;
                return nextBounds;
            });
        }
    }, []);
    const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
    const [editingGeometryId, setEditingGeometryId] = useState<string | null>(null);
    const [isNotificationHubOpen, setIsNotificationHubOpen] = useState(false);
    const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
    const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
    const [isLocalServerModalOpen, setIsLocalServerModalOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isTicketManagerOpen, setIsTicketManagerOpen] = useState(false);
    const [showPostRegChoice, setShowPostRegChoice] = useState(false);
    const [autoOpenHRModal, setAutoOpenHRModal] = useState(false);
    const [aiTab, setAiTab] = useState<'agro' | 'global' | 'market' | 'cross_module' | 'diagnostics'>('agro');
    const [forwardedPartnerData, setForwardedPartnerData] = useState<any>(null);
    const [lastRegisteredOrgName, setLastRegisteredOrgName] = useState('');
    const [isRegisteringOnMap, setIsRegisteringOnMap] = useState<boolean>(() => {
        return localStorage.getItem('agri-planter-is-registering') === 'true';
    });
    const [pendingOrgData, setPendingOrgData] = useState<any>(() => {
        return safeStorage.safeParse(localStorage.getItem('agri-planter-pending-org'), null);
    });
    const [tempBoundaryGeometry, setTempBoundaryGeometry] = useState<[number, number][] | null>(() => {
        return safeStorage.safeParse(localStorage.getItem('agri-planter-temp-boundary'), null);
    });

    // Global keyboard shortcut for Spotlight Search (Cmd+K / Ctrl+K / slash)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsSpotlightOpen(prev => !prev);
            } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
                e.preventDefault();
                setIsSpotlightOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        localStorage.setItem('agri-planter-is-registering', isRegisteringOnMap.toString());
    }, [isRegisteringOnMap]);

    useEffect(() => {
        if (pendingOrgData) {
            localStorage.setItem('agri-planter-pending-org', JSON.stringify(pendingOrgData));
        } else {
            localStorage.removeItem('agri-planter-pending-org');
        }
    }, [pendingOrgData]);

    useEffect(() => {
        if (tempBoundaryGeometry) {
            localStorage.setItem('agri-planter-temp-boundary', JSON.stringify(tempBoundaryGeometry));
        } else {
            localStorage.removeItem('agri-planter-temp-boundary');
        }
    }, [tempBoundaryGeometry]);
    const [isMapFullScreen, setIsMapFullScreen] = useState(false);
    const [highlightedFeatureIds, setHighlightedFeatureIds] = useState<string[]>([]);

    const [isDataStateAuditorOpen, setIsDataStateAuditorOpen] = useState(false);
    const [isSyncConflictModalOpen, setIsSyncConflictModalOpen] = useState(false);

    useEffect(() => {
        const handleFirebaseError = (event: PromiseRejectionEvent) => {
            const error = event.reason;
            const msg = error?.message || '';
            const code = error?.code || '';
            
            // Circuit Breaker: Quota Overflow Protection (swallow quietly without noisy toast errors)
            if (msg.includes('Quota exceeded') || msg.includes('resource-exhausted')) {
                console.warn('[Firebase] Quota Overflow Detected. Seamlessly continuing in local cache mode.');
                
                setIsQuotaExceeded(true);
                setIsManualOffline(true);
                localStorage.setItem('agrimap-manual-offline', 'true');
                setIsConnectionHealthy(false);
                
                // Automatically disable network attempts quietly to avoid SDK lockup
                disableNetwork(db).catch(console.error);

                return;
            }

            if (msg.includes('auth/network-request-failed') || 
                msg.includes('Could not reach Cloud Firestore backend') || 
                code === 'unknown' && msg.includes('Fetching auth token failed')) {
                
                console.warn('[Firebase] Caught background network error:', msg);
                setIsConnectionHealthy(false);
            }
        };

        window.addEventListener('unhandledrejection', handleFirebaseError);
        return () => window.removeEventListener('unhandledrejection', handleFirebaseError);
    }, []);

    useEffect(() => {
        const handleBrowserOnline = () => {
            setIsOnline(true);
            try {
                const syncQueue = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
                const pending = syncQueue.filter((item: any) => item.status === 'pending');
                if (pending.length > 0) {
                    setPendingOfflineCount(pending.length);
                    
                    if (syncManager.isConflictPresent()) {
                        setShowReSyncPrompt(true);
                    } else {
                        triggerHeadlessBackgroundSync();
                    }
                }
            } catch (e) {}
        };

        const handleBrowserOffline = async () => {
            setIsOnline(false);
            setIsConnectionHealthy(false);
            await setConnectionState(false);
            const isAlreadyOffline = localStorage.getItem('agrimap-manual-offline') === 'true';
            if (!isAlreadyOffline) {
                setShowSmartDisconnectModal(true);
            }
        };

        window.addEventListener('online', handleBrowserOnline);
        window.addEventListener('offline', handleBrowserOffline);

        // Initial offline check
        if (!navigator.onLine) {
            setConnectionState(false).catch(console.error);
            setShowSmartDisconnectModal(true);
        }

        return () => {
            window.removeEventListener('online', handleBrowserOnline);
            window.removeEventListener('offline', handleBrowserOffline);
        };
    }, [triggerHeadlessBackgroundSync]);

    useEffect(() => {
        if(isLocalRuntime)return;
        let failureCount = 0;
        const checkConnection = async () => {
            const healthy = await testFirestoreConnection();
            const isManualOffline = localStorage.getItem('agrimap-manual-offline') === 'true';
            
            // If it was unhealthy and now it's healthy, reset failure count
            if (healthy && !isConnectionHealthy) {
                if (!isManualOffline) {
                    toast.success("Connection Restored: System Online.");
                    // Re-enable network
                    await setConnectionState(true);
                }

                // Show re-sync trigger prompt if there are pending modifications in local storage
                try {
                    const syncQueue = JSON.parse(localStorage.getItem('agrimap-pending-sync') || '[]');
                    const pending = syncQueue.filter((item: any) => item.status === 'pending');
                    if (pending.length > 0) {
                        setPendingOfflineCount(pending.length);
                        setShowReSyncPrompt(true);
                    }
                } catch (e) {}
            } else if (!healthy && (isConnectionHealthy || USE_FIREBASE)) {
                // Instantly disable network listeners so Firestore stops firing Listen/channel RPC retries in the background
                await setConnectionState(false);
            }
            
            setIsConnectionHealthy(healthy);
            
            if (!healthy && USE_FIREBASE) {
                failureCount++;
                const savedConfig = localStorage.getItem('agrimap-local-config');
                let isLocal = false;
                try {
                    if (savedConfig) isLocal = JSON.parse(savedConfig).isLocalMode;
                } catch (e) {}

                // Trigger Smart Connection Disconnect Modal on network loss
                const isAlreadyOffline = localStorage.getItem('agrimap-manual-offline') === 'true';
                if (!isAlreadyOffline && failureCount >= 5) {
                    setShowSmartDisconnectModal(true);
                }

                if (isLocal && (failureCount >= 5 || !isConnectionHealthy)) {
                    toast.error("Unstable Connection: Local Node or Cloud Backend unreachable.", {
                        id: 'connection-error',
                        duration: 10000,
                        action: {
                            label: "Emergency Cloud Mode",
                            onClick: () => {
                                localStorage.setItem('agrimap-local-config', JSON.stringify({ isLocalMode: false, serverIp: '127.0.0.1', autoDiscovery: true }));
                                sessionStorage.setItem('agrimap-bypass-local-node', 'true');
                                window.location.reload();
                            }
                        }
                    });
                } else if (!isLocal && failureCount >= 6) {
                    toast.warning("Syncing disabled: Cloud backend unreachable. Offline changes will be queued.", {
                        id: 'sync-warning'
                    });
                }
            } else {
                failureCount = 0;
            }
        };

        checkConnection();
        const interval = setInterval(checkConnection, 15000); // Check every 15s for more responsiveness
        
        window.addEventListener('agrimap-sync-queue-updated', checkConnection);

        return () => {
            clearInterval(interval);
            window.removeEventListener('agrimap-sync-queue-updated', checkConnection);
        };
    }, [isConnectionHealthy]);

    const handleFullReset = async () => {
        if (!isRoot) {
            toast.error("NUCLEAR ERROR: Only Root Super Admins can execute a Total System Reset.");
            return;
        }

        if (!window.confirm("CRITICAL WARNING: You are about to execute a FULL SYSTEM RESET. This will wipe ALL data from the database, clear ALL local state, and Terminate all sessions. This action is IRREVERSIBLE. CONTINUE?")) return;
        
        try {
            await handleResetSystem();
            localStorage.clear();
            sessionStorage.clear();
            await signOut(auth);
            toast.success("TOTAL SYSTEM RESET COMPLETE. REDIRECTING...");
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            toast.error("Nuclear reset sequence failed. Manual override required.");
        }
    };

    const [selectedOperationalLog, setSelectedOperationalLog] = useState<OperationalLog | null>(null);
    const [selectedHarvestLog, setSelectedHarvestLog] = useState<HarvestLog | null>(null);

    // Design State
    const [activeDrawingTool, setActiveDrawingTool] = useState<ActiveDrawingTool>({ tool: null });

    // Handle Quota Exceeded Notifications gracefully without popups
    useEffect(() => {
        const handleQuotaExceeded = () => {
            console.warn('[Firebase] Quota exceeded. Smoothly running in local mode.');
            setIsQuotaExceeded(true);
            setIsManualOffline(true);
            localStorage.setItem('agrimap-manual-offline', 'true');
            disableNetwork(db).catch(console.error);
        };
        window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
        return () => window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    }, []);

    // Presence Heartbeat
    useEffect(() => {
        if (!auth.currentUser || !USE_FIREBASE || isManualOffline) return;
        
        const updatePresence = async () => {
            // Strict offline pre-flight check
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                try {
                    const localProfiles = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                    const uid = auth.currentUser?.uid;
                    if (uid) {
                        localProfiles[uid] = {
                            ...(localProfiles[uid] || {}),
                            id: uid,
                            lastActive: new Date().toISOString(),
                            lastSeen: new Date().toISOString()
                        };
                        localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(localProfiles));
                    }
                } catch (e) {
                    // Suppress local cache write errors
                }
                return;
            }

            await executeDecoupledPresenceUpdate(async () => {
                await setDoc(doc(db, 'users', auth.currentUser!.uid), {
                    lastSeen: new Date().toISOString(),
                    lastActive: new Date().toISOString()
                }, { merge: true });
            });
        };

        const interval = setInterval(updatePresence, 60000); // Every minute
        updatePresence();
        return () => clearInterval(interval);
    }, [currentUser?.id, isManualOffline]);

    // New Message Notifications
    useEffect(() => {
        if (!currentUser?.id || !forumPosts.length) return;
        
        const unreadDirectMessages = forumPosts.filter(p => 
            p.isDirectMessage && 
            p.recipientId === currentUser.id && 
            !p.isRead &&
            new Date(p.timestamp).getTime() > Date.now() - 60000 // Only alert for very recent ones
        );

        unreadDirectMessages.forEach(msg => {
            // Check if alert already exists to avoid duplicates
            setAlerts(prev => {
                const alreadyNotified = prev.some(a => a.id === `msg-${msg.id}`);
                if (alreadyNotified) return prev;

                toast.info(`Team Chat: New message from ${msg.authorName}`, {
                    action: {
                        label: 'View',
                        onClick: () => setAppMode('community')
                    }
                });

                return [{
                    id: `msg-${msg.id}`,
                    title: 'New Message',
                    content: `You have one unread message in team chat from ${msg.authorName}`,
                    type: 'info',
                    timestamp: new Date().toISOString(),
                    isRead: false
                }, ...prev];
            });
        });
    }, [forumPosts.length, currentUser?.id]);

    const {
        handleSaveProject,
        handleLoadProject,
        handleDeleteProject,
        handleExportProjects,
        handleImportProjects,
        handleShareProject,
        handleExportCurrentState,
        handleImportState
    } = useProjectManagement(
        currentUser,
        plantationFeatures,
        layers,
        workAssignments,
        harvestEvents,
        nutritionPlans,
        planExecutions,
        inventoryItems,
        employees,
        accounts,
        transactions,
        systemLogs,
        machinery,
        dailyLogs,
        employeeGroups,
        forumPosts,
        listings,
        bids,
        reviews,
        alerts,
        harvestEntries,
        pallets,
        harvestLogs,
        inventoryTransactions,
        mapCenter,
        mapZoom,
        activeOrgId,
        appMode,
        projects,
        setProjects,
        setPlantationFeatures,
        setLayers,
        setWorkAssignments,
        setHarvestEvents,
        setNutritionPlans,
        setPlanExecutions,
        setInventoryItems,
        setEmployees,
        setAccounts,
        setTransactions,
        setSystemLogs,
        setMachinery,
        setDailyLogs,
        setEmployeeGroups,
        setForumPosts,
        setListings,
        setBids,
        setReviews,
        setAlerts,
        setHarvestEntries,
        setPallets,
        setHarvestLogs,
        setInventoryTransactions,
        setMapCenter,
        setMapZoom,
        setActiveOrgId,
        setAppMode
    );
    const [roles, setRoles] = useState<Role[]>([
        { id: 'role-founder', name: 'Founder', permissions: Array.from(ALL_PERMISSIONS) },
        { id: 'role-admin', name: 'Admin', permissions: Array.from(ALL_PERMISSIONS).filter(p => p !== 'edit_roles') },
        { id: 'role-loader', name: 'Loader', permissions: ['edit_work'] as Permission[] },
        { id: 'role-weigher', name: 'Weigher', permissions: ['edit_work'] as Permission[] },
        { id: 'role-picker', name: 'Picker', permissions: ['edit_work'] as Permission[] },
        { id: 'role-foreman', name: 'Foreman', permissions: ['edit_work'] as Permission[] },
        { id: 'role-keeper', name: 'Keeper', permissions: ['edit_work'] as Permission[] },
        { id: 'role-driver', name: 'Driver', permissions: ['edit_work'] as Permission[] },
        { id: 'role-supervisor', name: 'Supervisor', permissions: Array.from(ALL_PERMISSIONS).filter(p => p !== 'edit_roles') },
        { id: 'role-fieldworker', name: 'Field Worker', permissions: ['edit_work'] as Permission[] },
        { id: 'role-security', name: 'Security', permissions: ['edit_work'] as Permission[] },
        { id: 'role-worker', name: 'worker', permissions: ['edit_work'] as Permission[] },
        { id: 'role-daily', name: 'Daily Worker', permissions: ['edit_work'] as Permission[] }
    ]);

    const [users, setUsers] = useState<User[]>([]);

    // Fetch users for Admin/Root or Organization Members for Team Hub
    useEffect(() => {
        if (!USE_FIREBASE) {
            // Mock users
            setUsers([
                { id: 'mock-1', name: 'Nishno Root', globalUniqueId: 'G-001', individualUniqueId: 'I-001', activeRole: 'individual', email: 'nishno@agrimap.pro', roles: ['ROOT_SUPER_ADMIN'], status: 'active', createdAt: new Date().toISOString(), verificationStatus: 'verified', kycStatus: 'approved', isProfileDiscoverable: true, aiQueryCount: 0, isPubliclyVisible: true },
                { id: 'mock-2', name: 'Agrimap Agent', globalUniqueId: 'G-002', individualUniqueId: 'I-002', activeRole: 'individual', email: 'agent@agrimap.io', roles: ['Agro-Agent'], status: 'active', createdAt: new Date().toISOString(), verificationStatus: 'verified', kycStatus: 'approved', isProfileDiscoverable: true, aiQueryCount: 0, isPubliclyVisible: true },
                { id: 'mock-3', name: 'Test User', globalUniqueId: 'G-003', individualUniqueId: 'I-003', activeRole: 'individual', email: 'test@agrimap.io', roles: ['Guest'], status: 'active', createdAt: new Date().toISOString(), verificationStatus: 'unverified', kycStatus: 'none', isProfileDiscoverable: true, aiQueryCount: 0, isPubliclyVisible: true }
            ]);
            return;
        }
        if (!auth.currentUser || !currentUser) return;
        
        // Load from fb_cache_users initially for instant load and offline resiliency
        const cachedUsersStr = isLocalRuntime?null:localStorage.getItem('fb_cache_users');
        if (cachedUsersStr) {
            try {
                const cachedUsers = JSON.parse(cachedUsersStr);
                if (Array.isArray(cachedUsers)) {
                    setUsers(cachedUsers);
                }
            } catch (e) {
                console.warn("[Users Cache] Failed to recover fb_cache_users from cache:", e);
            }
        }
        
        let q;
        if (isLocalRuntime || isSystemAdmin || isRoot) {
            // Root/Admins can see all users
            q = query(collection(db, 'users'));
        } else {
            // Regular users can see active users for search/collaboration/marketplace
            q = query(collection(db, 'users'), where('status', '==', 'active'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            
            // Strict primitive ID check (such as checking if user uid or properties change)
            // to ensure state modifications only occur if data properties actually change.
            setUsers((prevUsers = []) => {
                const prevIds = prevUsers.map(u => u.id || (u as any).uid).join(',');
                const nextIds = allUsers.map(u => u.id || (u as any).uid).join(',');
                if (prevIds === nextIds) {
                    const prevHash = JSON.stringify(prevUsers);
                    const nextHash = JSON.stringify(allUsers);
                    if (prevHash === nextHash) return prevUsers;
                }
                
                // Cache updated users list
                try {
                    localStorage.setItem('fb_cache_users', JSON.stringify(allUsers));
                } catch (cacheErr) {
                    console.warn("[Users Cache] Failed to update fb_cache_users:", cacheErr);
                }
                return allUsers;
            });
        }, (error: any) => {
            if (error && typeof error.message === 'string' && error.message.includes('Target ID already exists')) {
                console.warn("Failed to fetch users implicitly ignored:", error.message);
            } else {
                console.error("Failed to fetch users or failed to update user status:", error);
            }
        });
        
        return () => unsubscribe();
    }, [isSystemAdmin, activeOrgId, currentUser?.id]);
    
    // Dashboard Modular Layout State with User Persistence
    const [dashboardLayout, setDashboardLayout] = useState<DashboardWidget[]>(() => {
        return getSavedDashboardLayout(currentUser?.id);
    });

    // When currentUser changes (e.g. login, logout, switch account), reload and remember their personal layout
    useEffect(() => {
        const userLayout = getSavedDashboardLayout(currentUser?.id);
        setDashboardLayout(userLayout);
    }, [currentUser?.id]);

    const handleSetDashboardLayout = useCallback((newLayout: DashboardWidget[]) => {
        setDashboardLayout(newLayout);
        saveDashboardLayout(newLayout, currentUser?.id);
    }, [currentUser?.id]);

    // Agronomy Module State
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    const handleSelectFeature = (id: string | null, options?: { event?: MouseEvent | React.MouseEvent; fromPanel?: boolean }) => {
        if (!id) {
            setSelectedFeatureIds([]);
            return;
        }

        const isMulti = options?.event?.shiftKey || options?.event?.ctrlKey || options?.event?.metaKey;

        setSelectedFeatureIds(prev => {
            if (isMulti) {
                if (prev.includes(id)) return prev.filter(i => i !== id);
                return [...prev, id];
            }
            return [id];
        });
        
        // If selected from panel, fly to it
        if (options?.fromPanel) {
            const feature = findFeatureRecursive(plantationFeatures, id);
            if (feature) {
                let geometry = feature.geometry;
                if (typeof geometry === 'string') {
                    try { geometry = JSON.parse(geometry); } catch (e) { geometry = null; }
                }

                if (Array.isArray(geometry)) {
                    if (feature.type === 'area' || feature.type === 'sector' || feature.type === 'line' || feature.type === 'boundary') {
                        try {
                            // Basic validation for point arrays
                            if (geometry.length > 0 && Array.isArray(geometry[0])) {
                                // Filter out any invalid points, mapping them to actual primitive numbers
                                const validPoints = geometry
                                    .filter(p => 
                                        Array.isArray(p) && p.length === 2 && 
                                        Number.isFinite(typeof p[0] === 'string' ? parseFloat(p[0]) : p[0]) &&
                                        Number.isFinite(typeof p[1] === 'string' ? parseFloat(p[1]) : p[1])
                                    )
                                    .map(p => [
                                        typeof p[0] === 'string' ? parseFloat(p[0]) : p[0],
                                        typeof p[1] === 'string' ? parseFloat(p[1]) : p[1]
                                    ] as [number, number]);
                                
                                if (validPoints.length > 0) {
                                    const bounds = L.latLngBounds(validPoints);
                                    if (bounds.isValid()) {
                                        setFlyToBounds(validPoints);
                                        // Update map center and ZOOM to the center of bounds to prevent snapping back
                                        setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
                                        // Update zoom based on feature size
                                        const dist = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
                                        setMapZoom(dist > 1000 ? 14 : dist > 500 ? 16 : 18);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Fly to bounds failed:", e);
                        }
                    } else if (feature.type === 'seedling' || feature.type === 'note' || feature.type === 'checkpoint') {
                        const lat = (typeof geometry[0] === 'string' ? parseFloat(geometry[0]) : geometry[0]) as number;
                        const lng = (typeof geometry[1] === 'string' ? parseFloat(geometry[1]) : geometry[1]) as number;
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                            setMapCenter([lat, lng]);
                            setMapZoom(18);
                        }
                    }
                }
            }
        }
    };
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [searchedLocation, setSearchedLocation] = useState<any>(null);
    const [userPlaces, setUserPlaces] = useState<any[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    useEffect(() => {
        if (activeOrgId) localStorage.setItem('agri-planter-active-org', activeOrgId);
        else localStorage.removeItem('agri-planter-active-org');
    }, [activeOrgId]);

    useEffect(() => {
        localStorage.setItem('agri-planter-mode', appMode);
    }, [appMode]);

    useEffect(() => {
        if (USE_FIREBASE && !isLocalRuntime) {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    console.log("[App] Auth State Changed: USER_LOGGED_IN", {
                        uid: user.uid,
                        email: user.email,
                        emailVerified: user.emailVerified,
                        isAnonymous: user.isAnonymous
                    });
                } else {
                    console.log("[App] Auth State Changed: NO_USER");
                }
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        const resumeRegistration = async () => {
            if (currentUser && currentUser.id !== 'guest' && pendingOrgData && tempBoundaryGeometry) {
                console.log("[App] Resuming organization registration for:", pendingOrgData.name);
                
                const newOrg: Organization = {
                    id: `org-${Date.now()}`,
                    uniqueId: `Comp-${Math.floor(1000 + Math.random() * 9000)}`,
                    name: pendingOrgData.name,
                    legalName: pendingOrgData.name,
                    registrationNumber: '',
                    taxNumber: '',
                    type: pendingOrgData.type,
                    agricultureType: pendingOrgData.agricultureType,
                    isDiscoverable: pendingOrgData.isDiscoverable,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser.id,
                    subscriptionStatus: 'Unpaid',
                    trial_start_date: '',
                    trialExpiry: '',
                    isPaid: false,
                    tier: 'Free',
                    country: 'Georgia',
                    areaGeometry: tempBoundaryGeometry,
                    location: tempBoundaryGeometry[0]
                };

                const newMem: Membership = {
                    id: `${currentUser.id}_${newOrg.id}`,
                    userId: currentUser.id,
                    organizationId: newOrg.id,
                    role: pendingOrgData.role,
                    status: 'active',
                    joinedAt: new Date().toISOString(),
                    permissionLevel: 'admin'
                };

                await handleAddOrg(newOrg, newMem, pendingOrgData.selectedCrops);
                setPendingOrgData(null);
                setTempBoundaryGeometry(null);
                setAppMode('dashboard');
                toast.success(`Organization "${newOrg.name}" registered successfully!`);
            }
        };
        resumeRegistration();
    }, [currentUser, pendingOrgData, tempBoundaryGeometry]);

    const handleDocumentUpload = async (files: FileList) => {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                setUploadedDocuments(prev => [...prev, {
                    id: Math.random().toString(36).substr(2, 9),
                    fileName: file.name,
                    file,
                    content
                }]);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeDocument = (id: string) => {
        setUploadedDocuments(prev => prev.filter(d => d.id !== id));
    };

    // Modals
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(() => new URLSearchParams(window.location.search).get('register') === '1');
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    useEffect(()=>{if(isLocalRuntime&&isRegisterModalOpen){setIsRegisterModalOpen(false);toast.info('This farm is already initialized. Manage logins in Local accounts & records; edit the farm in Founders Vault.');}},[isRegisterModalOpen]);

    useEffect(() => {
        if (isAuthReady && currentUser?.id === 'guest') {
            const hasSeenWelcome = sessionStorage.getItem('agri-planter-welcome-seen');
            if (!hasSeenWelcome) {
                setShowWelcomeModal(true);
            }
        }
    }, [isAuthReady, currentUser]);

    // Persist session
    useEffect(() => {
        if (currentUser) localStorage.setItem('agri-planter-session', JSON.stringify(currentUser));
    }, [currentUser]);

    // Derived State
    const activeOrg = useMemo(() => organizations.find(o => o.id === activeOrgId), [organizations, activeOrgId]);
    useEffect(() => { if (activeOrg?.country) setRegion(['georgia','ge','საქართველო'].includes(activeOrg.country.toLowerCase()) ? 'Georgia' : 'Global'); }, [activeOrg?.id, activeOrg?.country]);

    useEffect(() => {
        if (appMode === 'onboarding') {
            setActiveDrawingTool({ tool: 'boundary', activeLayerId: null });
        }
        
        // Auto-fly to organization boundary when switching to Harvesting view
        if (appMode === 'harvesting' && activeOrg) {
             const boundary = currentOrgFeatures.find(f => f.type === 'boundary' || (f.type === 'area' && f.name?.toLowerCase().includes('boundary')));
             if (boundary) {
                 handleSelectFeature(boundary.id, { fromPanel: true });
             } else if (activeOrg.areaGeometry && activeOrg.areaGeometry.length > 2) {
                 const validPoints = (activeOrg.areaGeometry || [])
                     .filter(p => isValidCoordinate(p))
                     .map(p => [
                         typeof p[0] === 'string' ? parseFloat(p[0]) : p[0],
                         typeof p[1] === 'string' ? parseFloat(p[1]) : p[1]
                     ] as [number, number]);
                 if (validPoints.length > 2) {
                     setFlyToBounds(validPoints);
                     try {
                         const bounds = L.latLngBounds(validPoints as any);
                         if (bounds.isValid()) {
                             setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
                             setMapZoom(15);
                         }
                     } catch (e) {
                         console.warn("Invalid lat/lng in activeOrg.areaGeometry bounds calculation:", e);
                     }
                 }
             }
        }
    }, [appMode, activeOrg]);

    // Fly map to active profile's plantation location upon switching profile (company or personal use)
    useEffect(() => {
        if (!isAuthReady) return;
        const main = getMainPlantation(currentOrgFeatures, mapCenter || [41.9023, 44.5], activeOrgId);
        if (main && Array.isArray(main.center) && Number.isFinite(main.center[0]) && Number.isFinite(main.center[1])) {
            setMapCenter([main.center[0], main.center[1]]);
            setMapZoom(16);
        }
    }, [activeOrgId, isAuthReady]);

    // Global listener for flying map to chosen plantation location from any tool
    useEffect(() => {
        const handleFlyTo = (e: any) => {
            const { center, name } = e?.detail || {};
            if (Array.isArray(center) && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
                setMapCenter([center[0], center[1]]);
                setMapZoom(17);
                if (name) toast.success(`რუკა გადაფრინდა: ${name}`);
            }
        };
        window.addEventListener('agrimap:fly-to-location', handleFlyTo);
        return () => window.removeEventListener('agrimap:fly-to-location', handleFlyTo);
    }, []);

    // Handle committing tested hardware assets from LABS as a new layer in Map Planner
    useEffect(() => {
        const handleCommitLabsLayer = (e: any) => {
            const { layerName, features } = e?.detail || {};
            if (!layerName || !Array.isArray(features) || features.length === 0) return;

            const newLayerId = `layer-labs-${Date.now()}`;
            const newLayer: Layer = {
                id: newLayerId,
                name: layerName,
                isFolder: false,
                isVisible: true,
                organizationId: activeOrgId || undefined
            };

            // Associate features with this layer
            const enrichedFeatures = features.map((f: PlantationFeature, idx: number) => ({
                ...f,
                id: f.id || `labs-asset-${Date.now()}-${idx}`,
                layerId: newLayerId,
                organizationId: activeOrgId || undefined,
                isVisible: true
            }));

            // Add layer
            setLayers(prev => [...prev, newLayer]);
            // Add features
            setPlantationFeatures(prev => [...prev, ...enrichedFeatures]);

            // Save to local storage cache
            const currentCache = safeStorage.safeParse(localStorage.getItem('mock_plantationFeatures'), []);
            localStorage.setItem('mock_plantationFeatures', JSON.stringify([...currentCache, ...enrichedFeatures]));

            toast.success(`🚀 Layer "${layerName}" successfully deployed to Map Planner with ${enrichedFeatures.length} assets!`, {
                duration: 6000,
                action: {
                    label: 'Go to Map Planner',
                    onClick: () => setAppMode('design')
                }
            });
        };

        window.addEventListener('agrimap:commit_labs_layer', handleCommitLabsLayer);
        return () => window.removeEventListener('agrimap:commit_labs_layer', handleCommitLabsLayer);
    }, [activeOrgId]);

    const userMemberships = useMemo(() => {
        const filtered = memberships.filter(m => m.userId === currentUser?.id);
        return Array.from(new Map(filtered.map(m => [m.id, m])).values());
    }, [memberships, currentUser]);

    const userOrgIds = useMemo(() => userMemberships.map(m => m.organizationId), [userMemberships]);
    
    const organizationTickets = useMemo(() => {
        if (!currentUser) return [];
        // Filtering by membership is strictly required by the user even for admins
        const userMems = memberships.filter(m => m.userId === currentUser.id);
        
        return userMems.reduce((acc, m) => {
            const org = organizations.find(o => o.id === m.organizationId);
            if (!org) return acc;
            
            // Deduplicate by organizationId (one ticket per org)
            if (acc.some(t => t.organizationId === org.id)) return acc;

            acc.push({
                id: m.id,
                organizationId: org.id,
                name: org.name,
                role: m.role,
                status: org.status === 'active' ? 'Active' : 'Archived',
                years: org.createdAt ? `${new Date().getFullYear() - new Date(org.createdAt).getFullYear()} Years` : 'New',
                discoverable: org.isDiscoverable || false
            });
            return acc;
        }, [] as OrganizationTicket[]);
    }, [organizations, memberships, currentUser]);

    // Data Filtering for Active Workspace
    const currentOrgLayers = useMemo(() => {
        if (currentUser?.isGuest) {
            const discoverableOrgIds = organizations.filter(o => o.isDiscoverable).map(o => o.id);
            return layers.filter(l => l.organizationId && discoverableOrgIds.includes(l.organizationId) || l.id === 'root');
        }
        if (activeOrgId === 'ALL') {
             if (!isRoot) return [];
             return layers;
        }
        if (!activeOrgId) {
            return layers.filter(l => !l.organizationId || l.id === 'root');
        }
        // Security check: ensure user has access to this org
        if (!isRoot && !userOrgIds.includes(activeOrgId)) return [];
        
        return layers.filter(l => l.organizationId === activeOrgId || l.id === 'root');
    }, [layers, activeOrgId, organizations, isRoot, userOrgIds, currentUser]);

    const currentOrgFeatures = useMemo(() => {
        if (currentUser?.isGuest) {
            const discoverableOrgIds = new Set(organizations.filter(o => o.isDiscoverable).map(o => o.id));
            return plantationFeatures.filter(f => (f.organizationId && discoverableOrgIds.has(f.organizationId)) || f.createdBy === currentUser?.id || f.createdBy === 'guest');
        }

        const completedSectors = new Set<string>();
        workAssignments.forEach(w => {
            if (w.status === 'completed' && w.sectorIds) {
                w.sectorIds.forEach(id => completedSectors.add(id));
            }
        });

        // Return all features if workspace is ALL
        if (activeOrgId === 'ALL') {
            return plantationFeatures.filter(f => {
                const isFromPlanner = (f as any).source === 'planner';
                if (!isFromPlanner) return true;
                return !completedSectors.has(f.id);
            });
        }

        if (!activeOrgId) {
            return plantationFeatures.filter(f => !f.organizationId || f.organizationId === 'personal' || f.organizationId === null);
        }
        
        // Specific org filtering
        return plantationFeatures.filter(f => {
            if (f.organizationId !== activeOrgId) return false;
            
            // Filter out features linked to completed tasks from the planner
            const isFromPlanner = (f as any).source === 'planner';
            if (!isFromPlanner) return true;
            
            return !completedSectors.has(f.id);
        });
    }, [plantationFeatures, activeOrgId, currentUser, organizations, workAssignments]);

    const currentOperationalLogs = useMemo(() => {
        if (!activeOrgId && activeOrgId !== 'ALL') return [];
        if (activeOrgId === 'ALL') return operationalLogs || [];
        const currentFeatureIds = new Set(currentOrgFeatures.map(f => f.id));
        return (operationalLogs || []).filter(ol => {
            if (ol.organizationId && ol.organizationId === activeOrgId) return true;
            if (ol.sectorId && currentFeatureIds.has(ol.sectorId)) return true;
            if (!ol.organizationId && !ol.sectorId) return true;
            return false;
        });
    }, [operationalLogs, currentOrgFeatures, activeOrgId]);

    const currentHarvestLogs = useMemo(() => {
        if (!activeOrgId && activeOrgId !== 'ALL') return [];
        if (activeOrgId === 'ALL') return harvestLogs;
        const currentFeatureIds = new Set(currentOrgFeatures.map(f => f.id));
        return harvestLogs.filter(hl => hl.sectorId && currentFeatureIds.has(hl.sectorId));
    }, [harvestLogs, currentOrgFeatures, activeOrgId]);

    const activeHarvestEvents = useMemo(() => {
        return (harvestEvents || []).filter(e => !e.isDeleted && e.status !== 'deleted');
    }, [harvestEvents]);

    const currentHarvestEvents = useMemo(() => {
        if (!activeOrgId && activeOrgId !== 'ALL') return [];
        if (activeOrgId === 'ALL') return (harvestEvents || []).filter(e => !e.isDeleted && e.status !== 'deleted');
        const currentFeatureIds = new Set(currentOrgFeatures.map(f => f.id));
        return (harvestEvents || []).filter(he => {
            if (he.isDeleted || he.status === 'deleted') return false;
            if (he.sectorId && currentFeatureIds.has(he.sectorId)) return true;
            if (he.sectorIds && he.sectorIds.some(sid => currentFeatureIds.has(sid))) return true;
            return false;
        });
    }, [harvestEvents, currentOrgFeatures, activeOrgId]);

    const currentWorkAssignments = useMemo(() => {
        if (!activeOrgId && activeOrgId !== 'ALL') return [];
        if (activeOrgId === 'ALL') return workAssignments;
        const currentFeatureIds = new Set(currentOrgFeatures.map(f => f.id));
        return workAssignments.filter(wa => wa.sectorIds?.some(sid => currentFeatureIds.has(sid)));
    }, [workAssignments, currentOrgFeatures, activeOrgId]);

    const currentPlanExecutions = useMemo(() => {
        if (!activeOrgId && activeOrgId !== 'ALL') return [];
        if (activeOrgId === 'ALL') return planExecutions;
        const currentFeatureIds = new Set(currentOrgFeatures.map(f => f.id));
        return planExecutions.filter(pe => pe.sectorIds?.some(sid => currentFeatureIds.has(sid)));
    }, [planExecutions, currentOrgFeatures, activeOrgId]);

    // Fly to Org location on switch
    useEffect(() => {
        if (activeOrg) {
            if (activeOrg.areaGeometry && Array.isArray(activeOrg.areaGeometry) && activeOrg.areaGeometry.length > 2) {
                const validPoints = (activeOrg.areaGeometry || [])
                    .filter(p => isValidCoordinate(p))
                    .map(p => [
                        typeof p[0] === 'string' ? parseFloat(p[0]) : p[0],
                        typeof p[1] === 'string' ? parseFloat(p[1]) : p[1]
                    ] as [number, number]);
                if (validPoints.length > 2) {
                    setFlyToBounds(validPoints);
                } else if (activeOrg.location && isValidCoordinate(activeOrg.location)) {
                    setMapCenter(activeOrg.location);
                    setMapZoom(15);
                }
            } else if (activeOrg.location && isValidCoordinate(activeOrg.location)) {
                setMapCenter(activeOrg.location);
                setMapZoom(15);
            }
        } else if (activeOrgId === 'ALL' && organizations.length > 0) {
            // Optional: Fly to bounds of all orgs?
            const firstWithLoc = organizations.find(o => o.location && isValidCoordinate(o.location));
            if (firstWithLoc && firstWithLoc.location) {
                 setMapCenter(firstWithLoc.location);
                 setMapZoom(10); // Zoom out a bit
            }
        }
    }, [activeOrgId, activeOrg?.id, activeOrg?.location?.[0], activeOrg?.location?.[1], activeOrg?.areaGeometry?.length, organizations.length, setFlyToBounds, setMapCenter, setMapZoom]);

    // Auto-select 'ALL' workspace if user has organizations but none selected
    useEffect(() => {
        if (currentUser && !currentUser.isGuest && organizations.length > 0 && !activeOrgId) {
            setActiveOrgId('ALL');
        }
    }, [currentUser?.id, currentUser?.isGuest, organizations.length, activeOrgId]);

    // Auto-trigger boundary drawing in onboarding mode
    useEffect(() => {
        if (appMode === 'onboarding' && !activeDrawingTool.tool) {
            setActiveDrawingTool({ tool: 'boundary', color: '#16a34a' });
        }
    }, [appMode]);

    useEffect(() => {
        if (activeDrawingTool.tool && activeDrawingTool.tool !== 'measure') {
            toast.info(`DRAWING ${activeDrawingTool.tool.toUpperCase()}: Double-click to finish`, { 
                icon: '✏️',
                style: {
                    borderRadius: '1rem',
                    background: '#1e293b',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: '900',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase'
                }
            });
        }
    }, [activeDrawingTool.tool]);

    const handleDeleteOrganization = async (id: string, name: string, skipConfirm = false) => {
        if (!skipConfirm && !confirm(`NUCLEAR OPTION: Are you sure you want to PERMANENTLY DELETE organization "${name}" and ALL its data? This includes employees, crops, and map features. THIS CANNOT BE UNDONE.`)) return;
        
        try {
            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                const batch = writeBatch(db);
                
                // 1. Mark for deletion in cloud
                plantationFeatures.filter(f => f.organizationId === id).forEach(f => {
                    batch.delete(doc(db, 'plantationFeatures', f.id));
                });
                layers.filter(l => l.organizationId === id).forEach(l => {
                    batch.delete(doc(db, 'layers', l.id));
                });
                employees.filter(e => e.organizationId === id).forEach(e => {
                    batch.delete(doc(db, 'employees', e.id));
                });
                crops.filter(c => c.organizationId === id).forEach(c => {
                    batch.delete(doc(db, 'crops', c.id));
                });
                memberships.filter(m => m.organizationId === id).forEach(m => {
                    batch.delete(doc(db, 'memberships', m.id));
                });

                // Finally delete the organization itself
                batch.delete(doc(db, 'organizations', id));
                
                await batch.commit();
                toast.success(`Organization "${name}" and all associated data deleted.`);
            }

            // Always update local state
            setOrganizations(prev => prev.filter(o => o.id !== id));
            setPlantationFeatures(prev => prev.filter(f => f.organizationId !== id));
            setEmployees(prev => prev.filter(e => e.organizationId !== id));
            setMemberships(prev => prev.filter(m => m.organizationId !== id));
            
            if (activeOrgId === id) setActiveOrgId(null);
            logActivity("Delete Organization", 'profile', 'success', `Permanent deletion of ${name}.`);
        } catch (error) {
            handleFirestoreError(error, 'delete', `organizations/${id}`);
            toast.error("Deletion failed. Check your permissions.");
        }
    };

    const handleResetSystem = async () => {
        if (!isRoot) {
            toast.error("Only Root Super Admins can reset the system.");
            return;
        }

        try {
            if (USE_FIREBASE && auth.currentUser) {
                const batch = writeBatch(db);
                
                // Nuclear Wipe - clearing collections related to company data
                const collectionsToClear = [
                    'organizations', 'memberships', 'plantationFeatures', 'layers', 
                    'inventoryItems', 'harvestEvents', 'accounts', 'transactions', 
                    'workAssignments', 'employees', 'machinery', 'projects', 
                    'harvestEntries', 'pallets', 'harvestLogs', 'inventoryTransactions', 
                    'employeeGroups', 'dailyLogs', 'nutritionPlans', 'planExecutions', 
                    'forumPosts', 'listings', 'bids', 'reviews', 'alerts', 
                    'purchaseOrders', 'suppliers', 'operationalLogs', 'notes', 
                    'checkpoints', 'systemLogs', 'crops'
                ];

                for (const coll of collectionsToClear) {
                    const snap = await getDocs(collection(db, coll));
                    snap.docs.forEach(d => batch.delete(d.ref));
                }

                // Partially clear users? Maybe just non-root users
                const userSnap = await getDocs(collection(db, 'users'));
                userSnap.docs.forEach(d => {
                    const u = d.data() as User;
                    if (!u.roles?.includes('ROOT_SUPER_ADMIN')) {
                        batch.delete(d.ref);
                    } else {
                        // Reset root user's org info
                        batch.update(d.ref, { currentOrgId: null, isGuest: true, roles: ['Guest', 'ROOT_SUPER_ADMIN'] });
                    }
                });

                await batch.commit();
                toast.success("System wiped completely.");
                window.location.reload(); // Refresh to clear memory
            } else {
                localStorage.clear();
                toast.success("Local state wiped.");
                window.location.reload();
            }
        } catch (error) {
            console.error("Reset failed:", error);
            toast.error("Wipe failed. See console.");
        }
    };

    const currentUserPermissions = useMemo(() => {
        let perms = new Set<Permission>();

        if (currentUser?.roles?.includes('ROOT_SUPER_ADMIN')) {
            perms = new Set(ALL_PERMISSIONS);
        } else {
            const getPermissionsForRole = (roleName: string) => {
                if (!roleName) return new Set<Permission>();
                if (roleName === 'Founder') {
                    return new Set(ALL_PERMISSIONS);
                }
                const roleDef = roles.find(r => r?.name?.toLowerCase() === roleName?.toLowerCase());
                if (roleDef) {
                    return new Set(roleDef.permissions);
                }
                if (roleName === 'Admin' || roleName === 'Co-Founder') {
                    return new Set(ALL_PERMISSIONS);
                }
                return new Set<Permission>();
            };

            if (!activeOrg) {
                const merged = new Set<Permission>();
                memberships.forEach(m => {
                    if (m.userId === currentUser?.id) {
                        const permsForRole = getPermissionsForRole(m.role);
                        permsForRole.forEach(p => merged.add(p));
                    }
                });
                if (currentUser?.roles) {
                    currentUser.roles.forEach(r => {
                        const permsForRole = getPermissionsForRole(r);
                        permsForRole.forEach(p => merged.add(p));
                    });
                }
                perms = merged;
            } else {
                const merged = new Set<Permission>();
                const membership = memberships.find(m => m.organizationId === activeOrg.id && m.userId === currentUser?.id);
                if (membership) {
                    const permsForRole = getPermissionsForRole(membership.role);
                    permsForRole.forEach(p => merged.add(p));
                }

                if (currentUser?.roles) {
                    currentUser.roles.forEach(r => {
                        const permsForRole = getPermissionsForRole(r);
                        permsForRole.forEach(p => merged.add(p));
                    });
                }
                perms = merged;
            }
        }

        // Lock structural context to last valid non-empty permissions on erratic network states or auth timeouts
        if (perms.size > 0) {
            lastValidPermissionsRef.current = perms;
        } else if (lastValidPermissionsRef.current.size > 0 && (!isConnectionHealthy || !isAuthReady || currentUser?.isGuest)) {
            console.warn("[Permissions] Erratic network or auth timeout/guest state detected. Locking context to last valid permissions.");
            perms = lastValidPermissionsRef.current;
        }

        return perms;
    }, [currentUser, activeOrg, memberships, roles, isConnectionHealthy, isAuthReady]);

    const checkPermission = useCallback((module: AppMode) => {
        if (currentUser?.roles?.includes('ROOT_SUPER_ADMIN')) {
            return true;
        }

        const access = checkModuleAccess(currentUser, module, activeOrg, memberships);
        if (access === 'full') return true;

        // Custom permission overrides for module entry
        if (module === 'harvesting' && currentUserPermissions.has('access_harvesting')) return true;
        if (module === 'stock' && currentUserPermissions.has('access_stock')) return true;
        if (module === 'accounting' && currentUserPermissions.has('access_accounting')) return true;
        if (module === 'system' && currentUserPermissions.has('access_system')) return true;

        return access !== 'none';
    }, [currentUser, activeOrg, memberships, currentUserPermissions]);

    const logActivity = async (action: string, module: AppMode, status: 'success' | 'failure' | 'alert', report?: string): Promise<void> => {
        const userId = currentUser?.id || 'operator-user';
        const userName = currentUser?.name || currentUser?.email || 'Operator';
        const log: SystemLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            userId,
            userName,
            organizationId: activeOrgId || null,
            action,
            module,
            status,
            report
        };
        
        // Always set systemLogs in local state instantly so the UI update is real-time and fully responsive
        setSystemLogs(prev => [log, ...prev].slice(0, 100));
        
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system' && !currentUser?.isGuest) {
            // Highly frequent and repetitive barcode/RFID scans are already fully stored inside 'harvestEntries'.
            // Writing them to 'systemLogs' on every beep creates massive network and database write load.
            // We keep them in local state, but avoid bloated, redundant writes to the cloud Firestore.
            const isRepetitiveScan = action.includes('Yield Scanned') || action.includes('Scanned') || action.includes('RFID');
            if (!isRepetitiveScan) {
                setDoc(doc(db, 'systemLogs', log.id), log).catch(error => {
                    console.error('Failed to log activity to cloud:', error);
                });
            }
        } else {
            const savedLogs = safeStorage.safeParse(localStorage.getItem('mock_systemLogs'), []);
            localStorage.setItem('mock_systemLogs', JSON.stringify([log, ...savedLogs].slice(0, 100)));
        }
    };

    const handleDeleteLog = async (logId: string) => {
        if (USE_FIREBASE) {
            try {
                await deleteDoc(doc(db, 'systemLogs', logId));
            } catch (err) {
                console.error("Failed to delete log from Firestore", err);
            }
        }
        setSystemLogs(prev => prev.filter(l => l.id !== logId));
        const savedLogs = safeStorage.safeParse(localStorage.getItem('mock_systemLogs'), []);
        localStorage.setItem('mock_systemLogs', JSON.stringify(savedLogs.filter((l: any) => l.id !== logId)));
        toast.success("Log record wiped");
    };

    // --- Data Management Handlers ---
    
    // Duplicate handleFullReset removed (was here)

    const cleanFeatureGeometry = (geometry: any): any => {
        if (!Array.isArray(geometry)) return geometry;
        if (Array.isArray(geometry[0])) {
            return geometry.map((p: any) => {
                const lat = typeof p[0] === 'string' ? parseFloat(p[0]) : p[0];
                const lng = typeof p[1] === 'string' ? parseFloat(p[1]) : p[1];
                return [lat, lng];
            }).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
        } else if (typeof geometry[0] !== 'object' && geometry.length === 2) {
            const lat = typeof geometry[0] === 'string' ? parseFloat(geometry[0]) : geometry[0];
            const lng = typeof geometry[1] === 'string' ? parseFloat(geometry[1]) : geometry[1];
            return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [];
        }
        return geometry;
    };

    const [pendingSyncCount, setPendingSyncCount] = useState(getSyncQueueSize());

    useEffect(() => {
        const updateSyncCount = () => setPendingSyncCount(getSyncQueueSize());
        window.addEventListener('agrimap-sync-queue-updated', updateSyncCount);
        return () => window.removeEventListener('agrimap-sync-queue-updated', updateSyncCount);
    }, []);

    const handlePushToCloud = async () => {
        if (getSyncQueueSize() > 0) {
            setIsSyncConflictModalOpen(true);
        } else {
            toast.info("Sync queue is empty. All device logs are up to date.");
        }
    };

    const toggleOfflineMode = () => {
        const nextState = !isManualOffline;
        setIsManualOffline(nextState);
        localStorage.setItem('agrimap-manual-offline', nextState.toString());
        
        if (nextState) {
            toast.warning("Entering Offline Mode. Changes will be saved locally.");
            disableNetwork(db).catch(console.error);
        } else {
            toast.success("System Online. Syncing with data center...");
            enableNetwork(db).catch(console.error);
        }
    };

    const recursiveUpdateFeatureList = (features: PlantationFeature[], updated: PlantationFeature): PlantationFeature[] => {
        return features.map(f => {
            if (f.id === updated.id) {
                const preserved = { ...updated } as any;
                if ((f as any).bundledLines && !preserved.bundledLines) preserved.bundledLines = (f as any).bundledLines;
                if ((f as any).bundledSeedlings && !preserved.bundledSeedlings) preserved.bundledSeedlings = (f as any).bundledSeedlings;
                return preserved;
            }

            if (f.type === 'area' || f.type === 'sector' || f.type === 'boundary') {
                const area = f as AreaPlantationFeature;
                if (area.bundledLines) {
                    const nextBundles = recursiveUpdateFeatureList(area.bundledLines as any, updated);
                    // Check if anything actually changed to keep references stable
                    if (nextBundles !== area.bundledLines) {
                        return { ...area, bundledLines: nextBundles } as any;
                    }
                }
            }
            if (f.type === 'line' || f.type === 'trench' || f.type === 'irrigation_line') {
                const line = f as LinePlantationFeature;
                if (line.bundledSeedlings) {
                    const nextBundles = recursiveUpdateFeatureList(line.bundledSeedlings as any, updated);
                    if (nextBundles !== line.bundledSeedlings) {
                        return { ...line, bundledSeedlings: nextBundles } as any;
                    }
                }
            }
            return f;
        });
    };

    const handleUpdateFeature = async (feature: PlantationFeature) => {
        pushToHistory(plantationFeatures);
        
        const cleanedFeature = {
            ...feature,
            geometry: cleanFeatureGeometry(feature.geometry)
        };

        const nextFeatures = recursiveUpdateFeatureList(plantationFeatures, cleanedFeature);
        setPlantationFeatures(nextFeatures);
        localStorage.setItem('mock_plantationFeatures', JSON.stringify(nextFeatures));

        // Sync linked work assignments if priority/color/status changed
        setWorkAssignments(prev => (prev || []).map(w => {
            if (w.id === feature.id || w.linkedFeatureId === feature.id || (feature as any).linkedFeatureId === w.id) {
                return {
                    ...w,
                    status: (feature as any).status === 'completed' ? 'completed' : ((feature as any).status || w.status),
                    priority: (feature as any).priority || w.priority,
                    color: (feature as any).color || (feature as any).customColor || w.color
                };
            }
            return w;
        }));

        const result = findFeatureAndPath(nextFeatures, feature.id);
        const featureToSync = (result && result.path.length > 1) ? result.path[0] : cleanedFeature;
        
        dirtyFeaturesRef.current.set(featureToSync.id, featureToSync);

        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        if (syncDelay < 90000000) {
            syncTimeoutRef.current = setTimeout(flushSyncQueue, syncDelay);
        }
    };

    const flushLayerSyncQueue = async () => {
        // Now handled by flushSyncQueue
        flushSyncQueue();
    };

    const handleUpdateLayer = async (layer: Layer) => {
        setLayers(prev => prev.map(l => l.id === layer.id ? layer : l));

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            dirtyLayersRef.current.set(layer.id, layer);
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            if (syncDelay < 90000000) {
                syncTimeoutRef.current = setTimeout(flushSyncQueue, syncDelay);
            }
        } else {
            saveMockData('layers', [layer]);
        }
    };

    const handleAddLayer = async (name: string, isFolder: boolean) => {
        const orgId = activeOrgId;
        const newLayer: Layer = {
            id: `layer-${orgId || 'personal'}-${Date.now()}`,
            name: name.toUpperCase(),
            isFolder,
            isVisible: true,
            parentId: `layer-${orgId || 'personal'}`,
            organizationId: orgId,
            createdBy: currentUser?.id
        };
        
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await setDoc(doc(db, 'layers', newLayer.id), newLayer);
                toast.success(`${isFolder ? 'Folder' : 'Layer'} added successfully`);
            } catch (error) {
                handleFirestoreError(error, 'write', 'layers');
                toast.error("Failed to add layer");
            }
        } else {
            setLayers(prev => [...prev, newLayer]);
            saveMockData('layers', [newLayer]);
            toast.success(`${isFolder ? 'Folder' : 'Layer'} added successfully (Local)`);
        }
        
        // Set as active layer for drawing
        setActiveDrawingTool(prev => ({
            ...prev,
            activeLayerId: newLayer.id
        }));
        
        return newLayer;
    };

    const handleSendToBack = useCallback(async (id: string) => {
        const feature = plantationFeatures.find(f => f.id === id);
        if (!feature) return;

        // Find the current minimum zIndex
        const minZ = Math.min(...plantationFeatures.map(f => f.zIndex || 0), 0);
        const updatedFeature = { ...feature, zIndex: minZ - 1000 };

        handleUpdateFeature(updatedFeature);
        toast.info(`Sent ${feature.name} to back`);
    }, [plantationFeatures, handleUpdateFeature]);

    const handleBringToFront = useCallback(async (id: string) => {
        const feature = plantationFeatures.find(f => f.id === id);
        if (!feature) return;

        // Find the current maximum zIndex
        const maxZ = Math.max(...plantationFeatures.map(f => f.zIndex || 0), 0);
        const updatedFeature = { ...feature, zIndex: maxZ + 1000 };

        handleUpdateFeature(updatedFeature);
        toast.info(`Brought ${feature.name} to front`);
    }, [plantationFeatures, handleUpdateFeature]);

    const findFeatureRecursive = useCallback((features: PlantationFeature[], targetId: string): PlantationFeature | null => {
        for (const f of features) {
            if (f.id === targetId) return f;
            if ('bundledLines' in f && f.bundledLines) {
                const found = findFeatureRecursive(f.bundledLines as any, targetId);
                if (found) return found;
            }
            if ('bundledSeedlings' in f && f.bundledSeedlings) {
                const found = findFeatureRecursive(f.bundledSeedlings as any, targetId);
                if (found) return found;
            }
        }
        return null;
    }, []);

    const findFeatureAndPath = useCallback((features: PlantationFeature[], targetId: string, path: PlantationFeature[] = []): { feature: PlantationFeature, path: PlantationFeature[] } | null => {
        for (const f of features) {
            const currentPath = [...path, f];
            if (f.id === targetId) return { feature: f, path: currentPath };
            
            if ('bundledLines' in f && (f as any).bundledLines) {
                const found = findFeatureAndPath((f as any).bundledLines as PlantationFeature[], targetId, currentPath);
                if (found) return found;
            }
            
            if ('bundledSeedlings' in f && (f as any).bundledSeedlings) {
                const found = findFeatureAndPath((f as any).bundledSeedlings as PlantationFeature[], targetId, currentPath);
                if (found) return found;
            }
        }
        return null;
    }, []);

    const handleDeleteItems = async (ids: string[]) => {
        pushToHistory(plantationFeatures);
        
        // 1. Collect all features to delete (including recursive children via parentId)
        const allIdsToDelete = new Set<string>(ids);
        const collectChildren = (parentId: string) => {
            plantationFeatures.forEach(f => {
                if (f.parentId === parentId) {
                    allIdsToDelete.add(f.id);
                    collectChildren(f.id);
                }
            });
        };
        ids.forEach(collectChildren);

        // 2. Handle bundled features: remove from parents if parent itself is NOT being deleted
        let nextFeatures = [...plantationFeatures];
        
        const removeFromBundleRecursive = (features: PlantationFeature[]): PlantationFeature[] => {
            return features.filter(f => !allIdsToDelete.has(f.id)).map(f => {
                let updated = { ...f };
                let changed = false;
                
                if ('bundledLines' in updated && updated.bundledLines) {
                    const originalCount = updated.bundledLines.length;
                    const filtered = removeFromBundleRecursive(updated.bundledLines as any);
                    if (filtered.length !== originalCount) {
                        updated.bundledLines = filtered as any;
                        changed = true;
                    }
                }
                
                if ('bundledSeedlings' in updated && updated.bundledSeedlings) {
                    const originalCount = updated.bundledSeedlings.length;
                    const filtered = removeFromBundleRecursive(updated.bundledSeedlings as any);
                    if (filtered.length !== originalCount) {
                        updated.bundledSeedlings = filtered as any;
                        changed = true;
                    }
                }
                
                return updated;
            });
        };

        nextFeatures = removeFromBundleRecursive(nextFeatures);

        // Immediate optimistic UI update (0ms instant deletion - never wait or freeze)
        setPlantationFeatures(nextFeatures);
        setLayers(prev => prev.filter(l => !allIdsToDelete.has(l.id)));
        setSelectedFeatureIds(prev => prev.filter(id => !allIdsToDelete.has(id)));
        
        if (!USE_FIREBASE || currentUser?.id === 'root-system') {
            const savedFeatures = safeStorage.safeParse(localStorage.getItem('mock_plantationFeatures'), []);
            localStorage.setItem('mock_plantationFeatures', JSON.stringify(removeFromBundleRecursive(savedFeatures)));
        }
        
        toast.success(`Removed ${allIdsToDelete.size} asset${allIdsToDelete.size === 1 ? '' : 's'}`, {
            icon: '🗑️',
            style: { borderRadius: '1rem', background: '#1e293b', color: '#fff' }
        });

        // Non-blocking background persistence / cloud synchronization
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            (async () => {
                try {
                    // Identify top-level features being deleted
                    const topLevelIdsToDelete = plantationFeatures
                        .filter(f => allIdsToDelete.has(f.id))
                        .map(f => f.id);
                    
                    // Identify parents of bundled features that need updating
                    const parentsToUpdate = new Map<string, PlantationFeature>();
                    allIdsToDelete.forEach(id => {
                        const found = findFeatureAndPath(plantationFeatures, id);
                        if (found && found.path.length > 1) {
                            const topMostParent = found.path[0];
                            if (!allIdsToDelete.has(topMostParent.id)) {
                                 const updatedParent = nextFeatures.find(f => f.id === topMostParent.id);
                                 if (updatedParent) parentsToUpdate.set(updatedParent.id, updatedParent);
                            }
                        }
                    });

                    const syncStatus = localServerConfig.isLocalMode || isManualOffline ? 'pending' : 'cloud_synced';

                    // Execute in chunks to respect 500 operation limit
                    const batchOps: { type: 'delete' | 'set', ref: any, data?: any }[] = [];

                    topLevelIdsToDelete.forEach(id => {
                        batchOps.push({ type: 'delete', ref: doc(db, 'plantationFeatures', id) });
                        batchOps.push({ type: 'delete', ref: doc(db, 'layers', id) });
                    });

                    parentsToUpdate.forEach((updatedParent, parentId) => {
                        batchOps.push({ type: 'set', ref: doc(db, 'plantationFeatures', parentId), data: sanitizeFeatureForFirestore(updatedParent) });
                    });

                    if (syncStatus === 'cloud_synced') {
                        const BATCH_LIMIT = 450;
                        for (let i = 0; i < batchOps.length; i += BATCH_LIMIT) {
                            const batch = writeBatch(db);
                            const chunk = batchOps.slice(i, i + BATCH_LIMIT);
                            chunk.forEach(op => {
                                if (op.type === 'delete') batch.delete(op.ref);
                                else if (op.type === 'set') batch.set(op.ref, op.data);
                            });
                            await batch.commit();
                        }
                    }

                    // Track modifications for deduplication and local sync queue cleanup
                    topLevelIdsToDelete.forEach(id => {
                        trackModification(`plantationFeatures/${id}`, 'delete', null, syncStatus);
                        trackModification(`layers/${id}`, 'delete', null, syncStatus);
                    });

                    parentsToUpdate.forEach((updatedParent, parentId) => {
                        trackModification(`plantationFeatures/${parentId}`, 'set', sanitizeFeatureForFirestore(updatedParent), syncStatus);
                    });
                } catch (error) {
                    console.error("Non-blocking background delete error in Firestore:", error);
                }
            })();
        } 
    };

    useEffect(() => {
        const toggleOffline = (e: any) => {
            const requestedOffline = e.detail;
            setIsManualOffline(requestedOffline);
            localStorage.setItem('agrimap-manual-offline', String(requestedOffline));
            if (requestedOffline) {
                disableNetwork(db).catch(console.error);
                toast.warning("System transitioned to Offline Mode.");
            } else {
                enableNetwork(db).catch(console.error);
                toast.success("System transitioned to Cloud Mode.");
            }
        };

        const switchLocal = (e: any) => {
            const isLocal = e.detail;
            const newConfig = { ...localServerConfig, isLocalMode: isLocal };
            setLocalServerConfig(newConfig);
            localStorage.setItem('agrimap-local-config', JSON.stringify(newConfig));
            toast.info(`Switched to ${isLocal ? 'Local LAN Node' : 'Global Cloud'} Gateway. Refreshing...`);
            setTimeout(() => window.location.reload(), 1500);
        };

        const pushCloud = () => handlePushToFirestore();
        const fullReset = () => handleFullReset();
        const openAuditor = () => setIsDataStateAuditorOpen(true);

        window.addEventListener('agrimap-toggle-offline', toggleOffline);
        window.addEventListener('agrimap-switch-local', switchLocal);
        window.addEventListener('agrimap-push-cloud', pushCloud);
        window.addEventListener('agrimap-full-reset', fullReset);
        window.addEventListener('agrimap-open-auditor', openAuditor);

        return () => {
            window.removeEventListener('agrimap-toggle-offline', toggleOffline);
            window.removeEventListener('agrimap-switch-local', switchLocal);
            window.removeEventListener('agrimap-push-cloud', pushCloud);
            window.removeEventListener('agrimap-full-reset', fullReset);
            window.removeEventListener('agrimap-open-auditor', openAuditor);
        };
    }, [handlePushToFirestore, handleFullReset, localServerConfig]);

    const handleClearAllFeatures = async () => {
        if (!activeOrgId) return;
        if (!confirm("Are you sure you want to clear all map features for this organization? This cannot be undone.")) return;
        
        const syncStatus = localServerConfig.isLocalMode || isManualOffline ? 'pending' : 'cloud_synced';

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                if (syncStatus === 'cloud_synced') {
                    const batch = writeBatch(db);
                    currentOrgFeatures.forEach(f => {
                        batch.delete(doc(db, 'plantationFeatures', f.id));
                    });
                    // Also clear layers except root and the main org folder
                    const orgLayerId = `layer-${activeOrgId}`;
                    const boundaryLayerId = `boundary-layer-${activeOrgId}`;
                    layers.filter(l => l.organizationId === activeOrgId && l.id !== 'root' && l.id !== orgLayerId && l.id !== boundaryLayerId).forEach(l => {
                        batch.delete(doc(db, 'layers', l.id));
                    });
                    await batch.commit();
                }

                // Track modifications
                currentOrgFeatures.forEach(f => {
                    trackModification(`plantationFeatures/${f.id}`, 'delete', null, syncStatus);
                });
                const orgLayerId = `layer-${activeOrgId}`;
                const boundaryLayerId = `boundary-layer-${activeOrgId}`;
                layers.filter(l => l.organizationId === activeOrgId && l.id !== 'root' && l.id !== orgLayerId && l.id !== boundaryLayerId).forEach(l => {
                    trackModification(`layers/${l.id}`, 'delete', null, syncStatus);
                });

                toast.success("Map cleared successfully");
                logActivity("Map Cleared", 'design', 'success', `All features cleared for ${activeOrg?.name || 'organization'}.`);
            } catch (error) {
                handleFirestoreError(error, 'delete', 'plantationFeatures');
                toast.error("Failed to clear map");
            }
        } else {
            const idsToRemove = currentOrgFeatures.map(f => f.id);
            setPlantationFeatures(prev => prev.filter(f => !idsToRemove.includes(f.id)));
            toast.success("Map cleared successfully (Local)");
            if (!USE_FIREBASE || currentUser?.id === 'root-system') {
                const savedFeatures = safeStorage.safeParse(localStorage.getItem('mock_plantationFeatures'), []);
                localStorage.setItem('mock_plantationFeatures', JSON.stringify(savedFeatures.filter((f: any) => !idsToRemove.includes(f.id))));
            }
        }
    };

    const saveMockData = useCallback((key: string, items: any[]) => {
        const isFirebaseActive = USE_FIREBASE && currentUser?.id !== 'root-system';
        const storageKey = isFirebaseActive ? `fb_cache_${key}` : `mock_${key}`;
        
        let all = [];
        if (isFirebaseActive) {
            all = safeStorage.safeParse(safeStorage.getItem(storageKey), []);
        } else {
            all = safeStorage.safeParse(localStorage.getItem(storageKey), []);
        }

        const newAll = [...all];
        items.forEach(item => {
            const idx = newAll.findIndex(i => i.id === item.id);
            if (idx >= 0) newAll[idx] = item;
            else newAll.push(item);
        });

        if (isFirebaseActive) {
            safeStorage.setItemAsync(storageKey, JSON.stringify(newAll));
        } else {
            safeStorage.setItem(storageKey, JSON.stringify(newAll));
            try { localStorage.setItem(storageKey, JSON.stringify(newAll)); } catch (e) {}
        }
    }, [currentUser, USE_FIREBASE]);

    const handleFeatureDrawn = async (type: FeatureType | 'boundary' | any, geometry: any, clickPos?: any, metadata?: any) => {
        // If a full feature object was passed as the first argument, unpack it cleanly
        if (typeof type === 'object' && type !== null) {
            const featureObj = type as any;
            metadata = {
                id: featureObj.id,
                name: featureObj.name,
                notes: featureObj.notes,
                monitoringType: featureObj.monitoringType,
                taskType: featureObj.taskType,
                source: featureObj.source,
                status: featureObj.status,
                organizationId: featureObj.organizationId,
                layerId: featureObj.layerId,
                ...metadata
            };
            geometry = featureObj.geometry || geometry;
            type = featureObj.type || 'checkpoint';
        }

        console.log(`[App] handleFeatureDrawn: type=${type}, tool=${activeDrawingTool.tool}, isRegistering=${isRegisteringOnMap}, points=${geometry?.length}`);
        
        // Rigorous geometry validation
        if (!geometry) {
            setActiveDrawingTool({ tool: null });
            return;
        }

        const isValid = (g: any): boolean => {
            if (isValidCoordinate(g)) return true;
            if (Array.isArray(g) && g.length > 0) {
                if (isValidCoordinate(g[0])) return g.every(p => isValidCoordinate(p));
                return g.every(sub => isValid(sub));
            }
            return false;
        };

        if (!isValid(geometry)) {
            if (activeDrawingTool.tool) {
                console.warn("[App] handleFeatureDrawn received invalid geometry:", geometry);
                toast.error("Invalid geometry data. Mapping failed.");
            }
            setActiveDrawingTool({ tool: null });
            return;
        }

        const isGuest = currentUser?.isGuest || currentUser?.id === 'guest';

        if (isRegisteringOnMap && (type === 'area' || type === 'boundary')) {
            console.log("[App] Registration boundary drawn. Geometry points:", geometry.length);
            setIsRegisteringOnMap(false);
            setActiveDrawingTool({ tool: null });
            
            if (pendingOrgData && currentUser && !isGuest) {
                console.log("[App] User is logged in, proceeding with registration for:", pendingOrgData.name);
                const newOrg: Organization = {
                    id: `org-${Date.now()}`,
                    uniqueId: `Comp-${Math.floor(1000 + Math.random() * 9000)}`,
                    name: pendingOrgData.name,
                    legalName: pendingOrgData.name,
                    registrationNumber: '',
                    taxNumber: '',
                    type: pendingOrgData.type,
                    agricultureType: pendingOrgData.agricultureType,
                    isDiscoverable: pendingOrgData.isDiscoverable,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser.id,
                    subscriptionStatus: 'Unpaid',
                    trial_start_date: '',
                    trialExpiry: '',
                    isPaid: false,
                    tier: 'Free',
                    country: 'Georgia',
                    areaGeometry: geometry,
                    location: geometry[0]
                };

                const newMem: Membership = {
                    id: `${currentUser.id}_${newOrg.id}`,
                    userId: currentUser.id,
                    organizationId: newOrg.id,
                    role: pendingOrgData.role,
                    status: 'active',
                    joinedAt: new Date().toISOString(),
                    permissionLevel: 'admin'
                };

                try {
                    console.log("[App] Calling handleAddOrg from map draw...");
                    await handleAddOrg(newOrg, newMem, pendingOrgData.selectedCrops);
                    setLastRegisteredOrgName(newOrg.name);
                    setPendingOrgData(null);
                    setShowPostRegChoice(true); // Show the choice modal
                    toast.success(`Organization "${newOrg.name}" registered successfully!`);
                } catch (err) {
                    console.error("[App] handleAddOrg failed:", err);
                    toast.error("Failed to complete registration. Please try again.");
                }
            } else {
                console.log("[App] No pending org data or user is guest, saving boundary to temp state and opening modal");
                setTempBoundaryGeometry(geometry);
                setIsRegisterModalOpen(true);
            }
            return;
        }

        const orgId = activeOrgId || 'personal';
        
        // If we are in onboarding mode OR using the boundary tool, save as organization boundary
        if (activeDrawingTool.tool === 'boundary' || (appMode === 'onboarding' && type === 'area')) {
            console.log("[App] Saving organization boundary...");
            const orgToUpdate = activeOrg || organizations.find(o => o.id === activeOrgId);
            
            if (orgToUpdate) {
                try {
                    const updatedOrg = { ...orgToUpdate, areaGeometry: geometry, location: geometry[0] };
                    
                    if (USE_FIREBASE) {
                        const sanitizedOrg = { ...updatedOrg, areaGeometry: JSON.stringify(geometry) as any };
                        await setDoc(doc(db, 'organizations', updatedOrg.id), sanitizedOrg);
                    } else {
                        setOrganizations(prev => prev.map(o => o.id === updatedOrg.id ? updatedOrg : o));
                        const savedOrgs = safeStorage.safeParse(localStorage.getItem('mock_organizations'), []);
                        localStorage.setItem('mock_organizations', JSON.stringify(savedOrgs.map((o: any) => o.id === updatedOrg.id ? updatedOrg : o)));
                    }
                    
                    const boundaryLayerId = `boundary-layer-${orgId || 'personal'}`;
                    const boundaryLayer: Layer = {
                        id: boundaryLayerId,
                        name: 'BOUNDARIES',
                        isFolder: false,
                        isVisible: true,
                        parentId: 'root',
                        organizationId: activeOrgId,
                        createdBy: currentUser?.id
                    };
                    
                    if (USE_FIREBASE) {
                        await setDoc(doc(db, 'layers', boundaryLayerId), boundaryLayer);
                    } else {
                        setLayers(prev => [...prev.filter(l => l.id !== boundaryLayerId), boundaryLayer]);
                        const savedLayers = safeStorage.safeParse(localStorage.getItem('mock_layers'), []);
                        localStorage.setItem('mock_layers', JSON.stringify([...savedLayers.filter((l: any) => l.id !== boundaryLayerId), boundaryLayer]));
                    }

                    const boundaryFeature: AreaPlantationFeature = {
                        id: `boundary-${orgId || 'personal'}`,
                        name: `${orgToUpdate.name || 'Company'} Boundary`.toUpperCase(),
                        type: 'area',
                        layerId: boundaryLayerId,
                        geometry: geometry,
                        isVisible: true,
                        color: '#16a34a',
                        organizationId: activeOrgId,
                        createdBy: currentUser?.id
                    };
                    
                    const sanitizedBoundaryFeature = sanitizeFeatureForFirestore(boundaryFeature);
                    
                    if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                        await setDoc(doc(db, 'plantationFeatures', boundaryFeature.id), sanitizedBoundaryFeature);
                    } else {
                        setPlantationFeatures(prev => [...prev.filter(f => f.id !== boundaryFeature.id), boundaryFeature]);
                        if (!USE_FIREBASE || currentUser?.id === 'root-system') {
                            const savedFeatures = safeStorage.safeParse(localStorage.getItem('mock_plantationFeatures'), []);
                            localStorage.setItem('mock_plantationFeatures', JSON.stringify([...savedFeatures.filter((f: any) => f.id !== boundaryFeature.id), boundaryFeature]));
                        }
                    }
                    
                    if (appMode === 'onboarding') {
                        setLastRegisteredOrgName(orgToUpdate.name);
                        setShowPostRegChoice(true);
                    }
                    setAppMode('design');
                    setActiveDrawingTool({ tool: null });
                    toast.success("Organization boundary mapped successfully");
                    logActivity("Boundary Defined", 'profile', 'success', `Organization boundary mapped.`);
                } catch (error) {
                    handleFirestoreError(error, 'write', `organizations/${activeOrgId}`);
                    toast.error("Failed to save boundary");
                }
            } else {
                try {
                    const boundaryLayerId = `boundary-layer-${activeOrgId || 'personal'}`;
                    const boundaryLayer: Layer = {
                        id: boundaryLayerId,
                        name: 'BOUNDARIES',
                        isFolder: false,
                        isVisible: true,
                        parentId: 'root',
                        organizationId: activeOrgId,
                        createdBy: currentUser?.id
                    };
                    
                    const boundaryFeature: AreaPlantationFeature = {
                        id: `boundary-${activeOrgId || 'personal'}`,
                        name: `Company Boundary`.toUpperCase(),
                        type: 'area',
                        layerId: boundaryLayerId,
                        geometry: geometry,
                        isVisible: true,
                        color: '#16a34a',
                        organizationId: activeOrgId,
                        createdBy: currentUser?.id
                    };

                    if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                        await setDoc(doc(db, 'layers', boundaryLayerId), boundaryLayer);
                        await setDoc(doc(db, 'plantationFeatures', boundaryFeature.id), sanitizeFeatureForFirestore(boundaryFeature));
                    } else {
                        setLayers(prev => [...prev.filter(l => l.id !== boundaryLayerId), boundaryLayer]);
                        setPlantationFeatures(prev => [...prev.filter(f => f.id !== boundaryFeature.id), boundaryFeature]);
                        const savedLayers = safeStorage.safeParse(localStorage.getItem('mock_layers'), []);
                        localStorage.setItem('mock_layers', JSON.stringify([...savedLayers.filter((l: any) => l.id !== boundaryLayerId), boundaryLayer]));
                        const savedFeatures = safeStorage.safeParse(localStorage.getItem('mock_plantationFeatures'), []);
                        localStorage.setItem('mock_plantationFeatures', JSON.stringify([...savedFeatures.filter((f: any) => f.id !== boundaryFeature.id), boundaryFeature]));
                    }

                    if (appMode === 'onboarding') {
                        const org = organizations.find(o => o.id === activeOrgId);
                        if (org) setLastRegisteredOrgName(org.name);
                        setShowPostRegChoice(true);
                    }
                    setAppMode('design');
                    setActiveDrawingTool({ tool: null });
                    toast.success("Boundary saved");
                } catch (error) {
                    handleFirestoreError(error, 'write', 'plantationFeatures');
                    toast.error("Failed to save boundary");
                }
            }
            return;
        }
        
        if (operationalTaskToLog || activeDrawingTool.activeLayerId === 'operational-logs') {
            const safeGeom: [number, number][] = Array.isArray(geometry) ? geometry.map((p: any) => {
                const lat = typeof p[0] === 'string' ? parseFloat(p[0]) : p[0];
                const lng = typeof p[1] === 'string' ? parseFloat(p[1]) : p[1];
                return [lat, lng] as [number, number];
            }).filter((p): p is [number, number] => Number.isFinite(p[0]) && Number.isFinite(p[1])) : [];

            if (safeGeom.length >= 3) {
                const rawArea = getSphericalPolygonArea(safeGeom);
                const areaM2 = Math.round(rawArea);
                const areaHa = Number((rawArea / 10000).toFixed(4));
                const targetTask = workAssignments.find(w => w.id === operationalTaskToLog);
                const taskName = targetTask ? (typeof targetTask.workName === 'string' ? targetTask.workName : (targetTask.workName as any)?.title || 'Task') : 'Work Mission';
                
                const newOpLog: OperationalLog = {
                    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    organizationId: orgId,
                    workAssignmentId: targetTask?.id || operationalTaskToLog || '',
                    date: new Date().toISOString(),
                    geometry: safeGeom,
                    notes: `Logged area on map for ${taskName} (${areaM2.toLocaleString()} m², ${areaHa} ha)`,
                    areaHa,
                    measuredAreaM2: areaM2,
                    changeHistory: [{
                        id: `audit-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        userName: currentUser?.name || 'Administrator',
                        userEmail: currentUser?.email || '',
                        action: 'Log Area Recorded',
                        details: `Map zone logged: ${areaM2} m² (${areaHa} ha)`
                    }]
                };

                await handleSetOperationalLogs(prev => [...(prev || []), newOpLog]);

                if (targetTask) {
                    const updatedTask: WorkAssignment = {
                        ...targetTask,
                        measuredAreaM2: (targetTask.measuredAreaM2 || 0) + areaM2,
                        totalAreaCovered: (targetTask.totalAreaCovered || 0) + areaHa
                    };
                    handleSetWorkAssignments(workAssignments.map(w => w.id === updatedTask.id ? updatedTask : w));
                }

                setOperationalTaskToLog(null);
                setActiveDrawingTool({ tool: null });
                toast.success(`Operational area of ${areaHa} ha recorded for ${taskName}!`);
                return;
            }
        }

        let layerId = activeDrawingTool.activeLayerId;
        
        // If no layer selected, check if default boundary layer exists, if not create it
        if (!layerId) {
            const orgSuffix = activeOrgId || 'personal';
            layerId = `boundary-layer-${orgSuffix}`;
            if (!layers.some(l => l.id === layerId)) {
                const newLayer: Layer = {
                    id: layerId,
                    name: 'BOUNDARIES',
                    isFolder: false,
                    isVisible: true,
                    parentId: 'root',
                    organizationId: activeOrgId,
                    createdBy: currentUser?.id
                };
                try {
                    if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system' && !currentUser?.isGuest) {
                        await setDoc(doc(db, 'layers', layerId), newLayer);
                    } else {
                        setLayers(prev => [...prev, newLayer]);
                    }
                } catch (error) {
                    console.error("Failed to create default layer", error);
                }
            }
        }
        
        let featureName = `NEW ${type.toUpperCase()}`;
        
        if (type === 'seedling' && activeDrawingTool.context?.parentId) {
            const trench = plantationFeatures.find(f => f.id === activeDrawingTool.context?.parentId) as LinePlantationFeature;
            if (trench) {
                // Count existing seedlings in this trench to get the next index
                const existingCount = plantationFeatures.filter(f => f.type === 'seedling' && f.parentId === trench.id).length;
                featureName = `SEED ${existingCount + 1}`;
            }
        }
        
        let actualType = type;
        let monitoringType: any = undefined;
        
        if (type === 'checkpoint') {
            actualType = 'note';
            monitoringType = 'checkpoint';
        }

        let orgIdToSave = activeOrgId;
        if (orgIdToSave === 'ALL' && memberships.length > 0) {
            orgIdToSave = memberships[0].organizationId;
               if (type === 'sector' || (type === 'area' && activeDrawingTool.tool === 'area')) {
            const foundFeatures = identifyFeaturesInPolygon(geometry, plantationFeatures);
            const containedSeedlings = foundFeatures.filter(f => f.type === 'seedling');
            const seedlingCount = containedSeedlings.length;
            const containedTrenches = foundFeatures.filter(f => f.type === 'line' && (f as LinePlantationFeature).lineType === 'row');
            const trenchCount = containedTrenches.length;
            const varieties = Array.from(new Set(containedSeedlings.map(s => (s as any).cropVariety).filter(Boolean)));
            
            if (seedlingCount > 0 || trenchCount > 0) {
                toast.success(`Sector Area Registry:`, { 
                    description: `Identified ${seedlingCount} seedlings across ${trenchCount} trenches. Varieties: ${varieties.join(', ') || 'N/A'}`,
                    duration: 6000 
                });
                metadata = { 
                    ...metadata, 
                    calculatedPlantCount: seedlingCount,
                    calculatedLineCount: trenchCount,
                    cropVariety: varieties,
                    notes: `SPATIAL AUDIT: ${seedlingCount} plants identified on ${new Date().toLocaleDateString()}. Varieties: ${varieties.join(', ') || 'None'}.`
                };
            }
        }   }

        // Ensure geometry points are numeric to prevent NaN crashes
        let cleanGeometry = geometry;
        if (Array.isArray(geometry)) {
            if (Array.isArray(geometry[0])) {
                cleanGeometry = geometry.map((p: any) => [
                    typeof p[0] === 'string' ? parseFloat(p[0]) : p[0],
                    typeof p[1] === 'string' ? parseFloat(p[1]) : p[1]
                ]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
            } else if (typeof geometry[0] !== 'object') {
                const lat = typeof geometry[0] === 'string' ? parseFloat(geometry[0]) : geometry[0];
                const lng = typeof geometry[1] === 'string' ? parseFloat(geometry[1]) : geometry[1];
                cleanGeometry = (Number.isFinite(lat) && Number.isFinite(lng)) ? [lat, lng] : [];
            }
        }

        const featurePriority = metadata?.priority || 'medium';
        const featureColor = metadata?.color || metadata?.customColor || (
            featurePriority === 'urgent' ? '#dc2626' :
            featurePriority === 'high' ? '#ef4444' :
            featurePriority === 'low' ? '#64748b' :
            featurePriority === 'medium' && (type === 'checkpoint' || monitoringType) ? '#f59e0b' :
            activeDrawingTool.color || (type === 'checkpoint' ? '#f59e0b' : '#3b82f6')
        );

        const newFeature: PlantationFeature = {
            id: metadata?.id || `${type}-${Date.now()}`,
            name: metadata?.name || featureName.toUpperCase(),
            type: actualType as any,
            geometry: cleanGeometry as any,
            layerId,
            isVisible: true,
            color: featureColor,
            customColor: metadata?.color || metadata?.customColor || featureColor,
            priority: featurePriority,
            status: metadata?.status || 'pending',
            organizationId: orgIdToSave,
            createdBy: currentUser?.id,
            parentId: activeDrawingTool.context?.parentId,
            notes: (metadata as any)?.notes || '',
            ...(monitoringType ? { monitoringType } : {}),
            ...metadata
        } as PlantationFeature;

        // Hierarchy logic: if it's an area/line/note drawn inside the company boundary, set it as parent
        if (!newFeature.parentId && orgIdToSave) {
            const companyBoundary = plantationFeatures.find(f => f.id === `boundary-${orgIdToSave}`);
            if (companyBoundary && companyBoundary.id !== newFeature.id && (activeDrawingTool.tool as any) !== 'boundary') {
                newFeature.parentId = companyBoundary.id;
            }
        }

        // Sanitize geometry for Firestore (nested arrays are not supported)
        const sanitizedFeature = sanitizeFeatureForFirestore(newFeature);

        try {
            pushToHistory(plantationFeatures);
            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system' && !currentUser?.isGuest) {
                await setDoc(doc(db, 'plantationFeatures', newFeature.id), sanitizedFeature);
                // Also update local state for immediate feedback
                setPlantationFeatures(prev => [...prev.filter(f => f.id !== newFeature.id), newFeature]);
            } else {
                // In guest mode, mock mode or root-system, update local state directly so it's displayed
                setPlantationFeatures(prev => [...prev.filter(f => f.id !== newFeature.id), newFeature]);
                saveMockData('plantationFeatures', [newFeature]);
            }
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} saved`);
            logActivity(`Created ${type}`, 'design', 'success', `Drawn new ${type} on map.`);
            
            // If it's NOT a seedling, we might want to reset the tool. 
            // But for manual seeding, we keep it active.
            if (type !== 'seedling' && type !== 'checkpoint') {
                setActiveDrawingTool({ tool: null });
            }
            if (type !== 'seedling') {
                setSelectedFeatureIds([newFeature.id]);
            }
        } catch (error) {
            handleFirestoreError(error, 'write', 'plantationFeatures');
            toast.error("Failed to save feature");
        }
    };

    const handlePublishDraftFeatures = async (draftsToPublish: PlantationFeature[]) => {
        if (!draftsToPublish || draftsToPublish.length === 0) {
            toast.info("No draft items to publish.");
            return;
        }

        const toastId = toast.loading(`Publishing ${draftsToPublish.length} draft feature(s) to cloud...`);
        
        try {
            pushToHistory(plantationFeatures);
            
            const orgIdToSave = activeOrgId || currentUser?.currentOrgId;
            const cleanedFeatures: PlantationFeature[] = draftsToPublish.map((f, idx) => {
                const copy = { ...f } as any;
                if (copy.id.startsWith('draft-')) {
                    copy.id = `${copy.type || 'feature'}-${Date.now()}-${idx}`;
                }
                delete copy.isDraft;
                delete copy.isSimulated;
                copy.organizationId = orgIdToSave;
                copy.createdAt = copy.createdAt || new Date().toISOString();
                copy.updatedAt = new Date().toISOString();
                return copy as PlantationFeature;
            });

            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system' && !currentUser?.isGuest) {
                const batch = writeBatch(db);
                cleanedFeatures.forEach(feature => {
                    const sanitized = sanitizeFeatureForFirestore(feature);
                    const docRef = doc(db, 'plantationFeatures', feature.id);
                    batch.set(docRef, sanitized);
                });
                await batch.commit();
            } else {
                saveMockData('plantationFeatures', cleanedFeatures);
            }

            // Update local state: add features without draft flags
            setPlantationFeatures(prev => {
                const map = new Map(prev.map(f => [f.id, f]));
                cleanedFeatures.forEach(f => map.set(f.id, f));
                return Array.from(map.values());
            });

            // Clear draft storage
            localStorage.removeItem('agrimap_draft_features');

            toast.dismiss(toastId);
            toast.success("Document is synced to the cloud successfully!", {
                description: `Synced ${cleanedFeatures.length} feature(s) into the cloud database.`
            });
            logActivity("Publish Draft Features", "design", "success", `Committed and synced ${cleanedFeatures.length} draft items to cloud database.`);
        } catch (error) {
            console.error("Failed to publish draft features:", error);
            toast.dismiss(toastId);
            toast.error("Cloud synchronization error. Please check network connection.");
        }
    };

    const handleReparentFeature = async (featureId: string, newParentId: string | null) => {
        const result = findFeatureAndPath(plantationFeatures, featureId);
        
        let featureToMove: PlantationFeature | null = null;
        if (result) {
            featureToMove = { ...result.feature, parentId: newParentId || undefined } as PlantationFeature;
            
            // Auto-conversion logic: if a 'line' with type 'row' is moved into a 'sector' or 'area', convert it to a 'trench'
            if (newParentId && newParentId !== 'root') {
                const parentResult = findFeatureAndPath(plantationFeatures, newParentId);
                if (parentResult && (parentResult.feature.type === 'area' || parentResult.feature.type === 'sector')) {
                    if (featureToMove.type === 'line' && (featureToMove as any).lineType === 'row') {
                        (featureToMove as any).type = 'trench';
                        toast.success("Converted Production Row to Trench Asset");
                    }
                }
            }
        } else {
            const layer = layers.find(l => l.id === featureId);
            if (layer) {
                handleUpdateLayer({ ...layer, parentId: newParentId || undefined });
                return;
            }
        }

        if (!featureToMove) return;

        // Recursive removal
        const removeFromTree = (list: any[]): any[] => {
            return list.filter(f => f.id !== featureId).map(f => {
                const next = { ...f };
                if (next.bundledLines) next.bundledLines = removeFromTree(next.bundledLines);
                if (next.bundledSeedlings) next.bundledSeedlings = removeFromTree(next.bundledSeedlings);
                return next;
            });
        };

        // Recursive addition
        const addToParent = (list: any[]): any[] => {
            return list.map(f => {
                if (f.id === newParentId) {
                    const next = { ...f };
                    const isLine = featureToMove!.type === 'line' || featureToMove!.type === 'trench';
                    const isSeedling = featureToMove!.type === 'seedling';
                    
                    if (isLine) {
                        next.bundledLines = [...(next.bundledLines || []), featureToMove];
                    } else if (isSeedling) {
                        next.bundledSeedlings = [...(next.bundledSeedlings || []), featureToMove];
                    }
                    return next;
                }
                const res = { ...f };
                if (res.bundledLines) res.bundledLines = addToParent(res.bundledLines);
                if (res.bundledSeedlings) res.bundledSeedlings = addToParent(res.bundledSeedlings);
                return res;
            });
        };

        const listWithout = removeFromTree(plantationFeatures);
        const finalList = newParentId ? addToParent(listWithout) : [...listWithout, featureToMove];

        setPlantationFeatures(finalList);
        localStorage.setItem('mock_plantationFeatures', JSON.stringify(finalList));
        
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            // Full sync to handle the structural changes correctly
            handlePushToFirestore(); 
        }

        toast.success(`Moved ${featureToMove.name}`);
    };

    const handleRegisterCropVariety = async (variety: string) => {
        if (!variety) return;
        const upper = variety.toUpperCase();
        if (crops && crops.length > 0) {
            const firstCrop = crops[0];
            const updatedVarieties = Array.from(new Set([...(firstCrop.varieties || []), upper]));
            const updatedCrop = { ...firstCrop, varieties: updatedVarieties };
            
            setCrops(prev => prev.map(c => c.id === firstCrop.id ? updatedCrop : c));
            
            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                try {
                    await setDoc(doc(db, 'crops', firstCrop.id), updatedCrop);
                } catch (e) {
                    console.error("Failed to register variety:", e);
                }
            } else {
                const saved = safeStorage.safeParse(localStorage.getItem('mock_crops'), []);
                localStorage.setItem('mock_crops', JSON.stringify(saved.map((c: any) => c.id === firstCrop.id ? updatedCrop : c)));
            }
        }
    };

    const handleMoveFeature = async (featureId: string, deltaLat: number, deltaLng: number) => {
        if (isNaN(deltaLat) || isNaN(deltaLng) || !featureId) return;

        const feature = plantationFeatures.find(f => f.id === featureId);
        if (!feature) return;

        const parseGeom = (g: any) => {
            if (typeof g === 'string') { try { return JSON.parse(g); } catch (e) { return []; } }
            return g;
        };

        const pushNewGeom = (f: PlantationFeature, dLat: number, dLng: number) => {
            let geom = parseGeom(f.geometry);
            if (Array.isArray(geom) && Array.isArray(geom[0])) { // Polygon/Line
                return geom.map((p: any) => {
                    const lat = typeof p[0] === 'string' ? parseFloat(p[0]) : p[0];
                    const lng = typeof p[1] === 'string' ? parseFloat(p[1]) : p[1];
                    return [lat + dLat, lng + dLng];
                });
            } else if (Array.isArray(geom) && geom.length === 2 && typeof (typeof geom[0] === 'string' ? parseFloat(geom[0]) : geom[0]) === 'number') { // Point
                const lat = typeof geom[0] === 'string' ? parseFloat(geom[0]) : geom[0];
                const lng = typeof geom[1] === 'string' ? parseFloat(geom[1]) : geom[1];
                return [lat + dLat, lng + dLng];
            }
            return geom;
        };

        const batch: PlantationFeature[] = [];
        const collectRecursive = (id: string) => {
            const f = plantationFeatures.find(item => item.id === id);
            if (f) {
                const newGeom = pushNewGeom(f, deltaLat, deltaLng);
                // Validate new geometry
                if (Array.isArray(newGeom) && (isValidCoordinate(newGeom) || (Array.isArray(newGeom[0]) && isValidCoordinate(newGeom[0])))) {
                    batch.push({ ...f, geometry: newGeom as any });
                    plantationFeatures.filter(child => child.parentId === id).forEach(child => collectRecursive(child.id));
                }
            }
        };

        collectRecursive(featureId);
        if (batch.length === 0) return;

        // Check for new parent area after move
        const mainFeature = batch[0];
        const mainGeom = parseGeom(mainFeature.geometry);
        if (!Array.isArray(mainGeom) || mainGeom.length === 0) return;
        
        const latsForCenter = Array.isArray(mainGeom[0]) ? mainGeom.map((p: any) => p[0]) : [mainGeom[0]];
        const lngsForCenter = Array.isArray(mainGeom[0]) ? mainGeom.map((p: any) => p[1]) : [mainGeom[1]];
        
        const centerLat = (Math.min(...latsForCenter) + Math.max(...latsForCenter)) / 2;
        const centerLng = (Math.min(...lngsForCenter) + Math.max(...lngsForCenter)) / 2;
        
        const center = [centerLat, centerLng];
        if (isNaN(centerLat) || isNaN(centerLng)) return;

        const potentialParents = plantationFeatures.filter(f => (f.type === 'area' || f.type === 'boundary') && f.id !== featureId && !batch.some(b => b.id === f.id));
        const foundParent = potentialParents.find(p => {
            const pGeom = parseGeom(p.geometry);
            if (!Array.isArray(pGeom) || pGeom.length < 3) return false;
            const lats = pGeom.map((pt: any) => pt[0]);
            const lngs = pGeom.map((pt: any) => pt[1]);
            return center[0] >= Math.min(...lats) && center[0] <= Math.max(...lats) &&
                   center[1] >= Math.min(...lngs) && center[1] <= Math.max(...lngs);
        });

        if (foundParent && foundParent.id !== feature.parentId) {
            mainFeature.parentId = foundParent.id;
            toast.success(`Features dropped into ${foundParent.name}`, { 
                icon: '🎯',
                style: { borderRadius: '1rem', background: '#1e293b', color: '#fff' } 
            });
        }

        // Apply all updates
        const updatedFeatures = plantationFeatures.map(f => {
            const b = batch.find(item => item.id === f.id);
            return b ? b : f;
        });

        setPlantationFeatures(updatedFeatures);
        
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const fireBatch = writeBatch(db);
                batch.forEach(f => {
                    const docRef = doc(db, 'plantationFeatures', f.id);
                    fireBatch.set(docRef, sanitizeFeatureForFirestore(f), { merge: true });
                });
                await fireBatch.commit();
            } catch (e) {
                console.error("Batch move failed:", e);
            }
        }
        
        pushToHistory(updatedFeatures);
    };

    const handleAddOrg = async (org: Organization, mem: Membership, selectedCrops?: any[]) => {
        console.log("[App] handleAddOrg called for:", org.name);
        
        // Duplicate Tax Number Check
        if (org.taxNumber && organizations.some(o => o.taxNumber === org.taxNumber)) {
            toast.error(`A company with tax number ${org.taxNumber} already exists.`);
            return;
        }

        // Duplicate Phone Check
        if (org.phoneNumber && organizations.some(o => o.phoneNumber === org.phoneNumber)) {
            toast.error(`A company with phone number ${org.phoneNumber} already exists.`);
            return;
        }

        try {
            const finalOrg = { ...org };
            // Only use tempBoundaryGeometry if the org doesn't already have geometry
            if (tempBoundaryGeometry && (!finalOrg.areaGeometry || finalOrg.areaGeometry.length === 0)) {
                finalOrg.areaGeometry = tempBoundaryGeometry;
                if (!finalOrg.location && tempBoundaryGeometry.length > 0) {
                    finalOrg.location = tempBoundaryGeometry[0];
                }
            }

            const sanitizedOrg = { ...finalOrg };
            if (Array.isArray(sanitizedOrg.areaGeometry)) {
                sanitizedOrg.areaGeometry = JSON.stringify(sanitizedOrg.areaGeometry) as any;
            }

            // Define layers and features for the new organization
            const orgLayer: Layer = {
                id: `layer-${finalOrg.id}`,
                name: finalOrg.name.toUpperCase(),
                isFolder: true, 
                isVisible: true,
                parentId: 'root',
                organizationId: finalOrg.id,
                createdBy: currentUser?.id
            };
            
            const boundaryLayer: Layer = {
                id: `boundary-layer-${finalOrg.id}`,
                name: 'BOUNDARIES',
                isFolder: false,
                isVisible: true,
                parentId: orgLayer.id,
                organizationId: finalOrg.id,
                createdBy: currentUser?.id
            };

            let boundaryFeature: AreaPlantationFeature | null = null;
            if (finalOrg.areaGeometry && finalOrg.areaGeometry.length > 2) {
                boundaryFeature = {
                    id: `boundary-${finalOrg.id}`,
                    name: `${finalOrg.name} Boundary`.toUpperCase(),
                    type: 'area',
                    layerId: boundaryLayer.id,
                    geometry: finalOrg.areaGeometry,
                    isVisible: true,
                    color: '#16a34a',
                    organizationId: finalOrg.id,
                    createdBy: currentUser?.id,
                    zIndex: -1000
                };
            }

            // Create Crop entries if provided
            const newCrops: Crop[] = (selectedCrops || []).map(crop => {
                const name = typeof crop === 'string' ? crop : crop.name;
                const varieties = typeof crop === 'string' ? [] : (crop.varieties || []);
                return {
                    id: `crop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: name,
                    varieties: varieties,
                    organizationId: finalOrg.id
                };
            });

            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                console.log("Saving org to Firebase:", finalOrg.id);
                const batch = writeBatch(db);
                batch.set(doc(db, 'organizations', finalOrg.id), sanitizedOrg);
                batch.set(doc(db, 'memberships', mem.id), mem);
                batch.set(doc(db, 'layers', orgLayer.id), orgLayer);
                batch.set(doc(db, 'layers', boundaryLayer.id), boundaryLayer);
                
                if (boundaryFeature) {
                    batch.set(doc(db, 'plantationFeatures', boundaryFeature.id), boundaryFeature);
                }

                // Add crops
                newCrops.forEach(c => {
                    batch.set(doc(db, 'crops', c.id), c);
                });

                // Create Employee record for the founder/admin in the new organization
                if (currentUser) {
                    const newEmployee: Employee = {
                        id: `emp-${currentUser.id}-${finalOrg.id}`,
                        name: currentUser.name,
                        email: currentUser.email,
                        phone: currentUser.phone || '',
                        idNumber: currentUser.personalNumber || '',
                        roleId: mem.role, 
                        paymentType: 'salary',
                        paymentRate: 0,
                        barcode: `BC-${Date.now()}`,
                        employeeType: 'Permanent',
                        accountType: 'Bank Account',
                        status: 'active',
                        joinedAt: new Date().toISOString(),
                        organizationId: finalOrg.id
                    };
                    batch.set(doc(db, 'employees', newEmployee.id), newEmployee);
                    setEmployees(prev => [...prev, newEmployee]);

                    const newExperience: WorkExperience = {
                        id: `exp-${Date.now()}`,
                        title: mem.role,
                        company: finalOrg.name,
                        startDate: new Date().toISOString(),
                        endDate: '',
                        isCompanyRole: true,
                        organizationId: finalOrg.id,
                        isDiscoverable: finalOrg.isDiscoverable,
                        isPublic: true
                    };

                    const currentRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [];
                    const updatedUser = { 
                        ...currentUser, 
                        roles: [...currentRoles.filter(r => r !== 'Guest'), mem.role],
                        currentOrgId: finalOrg.id,
                        isGuest: false,
                        verificationStatus: 'verified' as const,
                        cv: {
                            ...currentUser.cv,
                            experience: [newExperience, ...(currentUser.cv?.experience || [])]
                        }
                    };
                    batch.set(doc(db, 'users', currentUser.id), updatedUser);
                    setCurrentUser(updatedUser);
                }

                if (boundaryFeature) {
                    batch.set(doc(db, 'plantationFeatures', boundaryFeature.id), sanitizeFeatureForFirestore(boundaryFeature));
                }

                await batch.commit();
                await handleSwitchOrg(finalOrg.id);
                
                // Update local state after successful batch commit
                setOrganizations(prev => [...prev, finalOrg]);
                setMemberships(prev => [...prev, mem]);
                setLayers(prev => [...prev, orgLayer, boundaryLayer]);
                if (boundaryFeature) {
                    setPlantationFeatures(prev => [...prev, boundaryFeature!]);
                }
            } else {
                // Mock mode or root-system local mode
                setOrganizations(prev => [...prev, finalOrg]);
                setMemberships(prev => [...prev, mem]);
                setLayers(prev => [...prev, orgLayer, boundaryLayer]);
                
                if (currentUser) {
                    const newEmployee: Employee = {
                        id: `emp-${currentUser.id}-${finalOrg.id}`,
                        name: currentUser.name,
                        email: currentUser.email,
                        phone: currentUser.phone || '',
                        idNumber: currentUser.personalNumber || '',
                        roleId: mem.role,
                        paymentType: 'salary',
                        paymentRate: 0,
                        barcode: `BC-${Date.now()}`,
                        employeeType: 'Permanent',
                        accountType: 'Bank Account',
                        status: 'active',
                        joinedAt: new Date().toISOString(),
                        organizationId: finalOrg.id
                    };
                    setEmployees(prev => [...prev, newEmployee]);
                    
                    const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
                    localStorage.setItem('mock_employees', JSON.stringify([...savedEmployees, newEmployee]));
                }

                if (boundaryFeature) {
                    setPlantationFeatures(prev => [...prev, boundaryFeature!]);
                }

                const savedOrgs = safeStorage.safeParse(localStorage.getItem('mock_organizations'), []);
                localStorage.setItem('mock_organizations', JSON.stringify([...savedOrgs, finalOrg]));
                const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                localStorage.setItem('mock_memberships', JSON.stringify([...savedMemberships, mem]));
                const savedLayers = safeStorage.safeParse(localStorage.getItem('mock_layers'), []);
                localStorage.setItem('mock_layers', JSON.stringify([...savedLayers, orgLayer, boundaryLayer]));
                
                if (boundaryFeature) {
                    const savedFeatures = safeStorage.safeParse(localStorage.getItem('mock_plantationFeatures'), []);
                    localStorage.setItem('mock_plantationFeatures', JSON.stringify([...savedFeatures, boundaryFeature]));
                }

                if (currentUser) {
                    const newExperience: WorkExperience = {
                        id: `exp-${Date.now()}`,
                        title: mem.role,
                        company: finalOrg.name,
                        startDate: new Date().toISOString(),
                        endDate: '',
                        isCompanyRole: true,
                        organizationId: finalOrg.id,
                        isDiscoverable: finalOrg.isDiscoverable,
                        isPublic: true
                    };

                    const currentRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [];
                    const updatedUser = { 
                        ...currentUser, 
                        roles: [...currentRoles.filter(r => r !== 'Guest'), mem.role],
                        currentOrgId: finalOrg.id,
                        isGuest: false,
                        verificationStatus: 'verified' as const,
                        cv: {
                            ...currentUser.cv,
                            experience: [newExperience, ...(currentUser.cv?.experience || [])]
                        }
                    };
                    setCurrentUser(updatedUser);
                    
                    // Save crops locally
                    setCrops(prev => [...prev, ...newCrops]);
                    const savedCrops = safeStorage.safeParse(localStorage.getItem('mock_crops'), []);
                    localStorage.setItem('mock_crops', JSON.stringify([...savedCrops, ...newCrops]));

                    await handleSwitchOrg(finalOrg.id);
                    if (currentUser.id === 'root-system') {
                        localStorage.setItem('agri-planter-session', JSON.stringify(updatedUser));
                    } else {
                        localStorage.setItem('agri-planter-mock-user', JSON.stringify(updatedUser));
                    }
                }
            }
            
            setTempBoundaryGeometry(null);
            setIsRegisteringOnMap(false);
            localStorage.removeItem('agri-planter-is-registering');
            localStorage.removeItem('agri-planter-pending-org');
            localStorage.removeItem('agri-planter-temp-boundary');

            setAppMode('profile'); 
            toast.success(`Company ${finalOrg.name} registered successfully!`);
            logActivity("Org Registered", 'admin', 'success', `Registered new organization: ${finalOrg.name}`);
        } catch (error) {
            handleFirestoreError(error, 'write', 'organizations/memberships/layers');
            toast.error("Registration failed");
        }
    };

    // --- Asset Generation Handlers ---

    const handleGenerateTrenches = async (params: { parentFeature: AreaPlantationFeature; distance: number; angle: number; plantSpacing: number; from: number; to: number; }) => {
        const { parentFeature, distance, angle, from, to } = params;
        
        // Ensure geometry is parsed before passing to Turf
        const featureGeom = typeof parentFeature.geometry === 'string' ? JSON.parse(parentFeature.geometry) : parentFeature.geometry;
        
        console.log(`[TrenchGen] Generating for ${parentFeature.name}`, { distance, angle, from, to });
        const trenchGeometries = generateTrenches(featureGeom, distance, angle);
        console.log(`[TrenchGen] Generated ${trenchGeometries.length} lines`);

        if (trenchGeometries.length === 0) {
            toast.error("Generation failed: No area found for trenches at this angle/spacing. Try adjusting the angle or starting pos.");
            return;
        }
        
        let targetOrgId = parentFeature.organizationId || activeOrgId || undefined;
        if (targetOrgId === 'ALL') targetOrgId = undefined;
        
        const newTrenches: LinePlantationFeature[] = trenchGeometries.slice(from - 1, to).map((geom, idx) => ({
            id: `trench-${Date.now()}-${idx}`,
            name: `${parentFeature.name} - TRENCH ${from + idx}`,
            type: 'line',
            lineType: 'row',
            geometry: geom,
            layerId: parentFeature.layerId || 'root',
            parentId: parentFeature.id,
            isVisible: true,
            color: '#f97316',
            calculatedPlantCount: Math.floor(calculateLineLength(geom) / params.plantSpacing),
            defaultPlantSpacing: params.plantSpacing,
            organizationId: targetOrgId,
            source: 'design'
        }));

        // Optimize: Bundle trenches into parent sector instead of separate docs
        const updatedParent: AreaPlantationFeature = {
            ...parentFeature,
            defaultPlantSpacing: params.plantSpacing,
            defaultTrenchSpacing: params.distance,
            defaultTrenchDirection: params.angle,
            bundledLines: [...(parentFeature.bundledLines || []), ...newTrenches]
        };

        handleUpdateFeature(updatedParent);
        toast.success(`Production Line Logic Registry: Generated ${newTrenches.length} bundled trenches for ${parentFeature.name}.`);
        logActivity("Trench Generation", 'design', 'success', `Generated ${newTrenches.length} bundled production lines for ${parentFeature.name}.`);
    };

    const handleGenerateSeedlings = async (trenchId: string, rules: VarietyRule[], spacing?: number) => {
        // Find the trench and its path (if bundled)
        const result = findFeatureAndPath(plantationFeatures, trenchId);
        
        if (!result) {
            toast.error("Trench not found.", { description: "The selected asset could not be located in the map registry." });
            return;
        }

        const trench = result.feature as LinePlantationFeature;
        let parentSector: AreaPlantationFeature | null = null;
        
        // Identify the parent sector if it exists in path
        for (let i = result.path.length - 2; i >= 0; i--) {
            if (result.path[i].type === 'sector' || result.path[i].type === 'area' || result.path[i].type === 'boundary') {
                parentSector = result.path[i] as AreaPlantationFeature;
                break;
            }
        }

        // Fallback for non-bundled trenches with parentId reference
        if (!parentSector && trench.parentId) {
            parentSector = findFeatureRecursive(plantationFeatures, trench.parentId) as AreaPlantationFeature;
        }

        // We technically don't REQUIRE a parent sector for generation logic, 
        // but we warn if it can't be associated for organizational reasons.
        if (!trench) {
            toast.error("Trench data is corrupted or missing.");
            return;
        }

        const parsedGeom = typeof trench.geometry === 'string' ? JSON.parse(trench.geometry) : trench.geometry;
        if (!Array.isArray(parsedGeom) || parsedGeom.length < 2) {
            toast.error("Invalid trench geometry.");
            return;
        }

        const plantSpacing = spacing !== undefined ? spacing : (trench.defaultPlantSpacing || 1.0);
        const seedlingCoords = generateSeedlingCoordinates(parsedGeom, plantSpacing);
        const targetOrgId = trench.organizationId || activeOrgId || null;

        const newSeedlings: SeedlingPlantationFeature[] = seedlingCoords.map((coord, idx) => {
            const rule = rules.find(r => (idx + 1) >= r.from && (idx + 1) <= r.to) || rules[0];
            const variety = rule?.variety || 'Standard';
            return {
                id: `seedling-${Date.now()}-${idx}`,
                name: `${variety.toUpperCase()} ${idx + 1}`,
                type: 'seedling',
                geometry: coord,
                condition: 'Good',
                cropVariety: variety,
                layerId: trench!.layerId || 'root',
                parentId: trench!.id,
                isVisible: true,
                organizationId: targetOrgId as any,
                createdBy: currentUser?.id || undefined
            };
        });

        // Update the feature state with new seedlings
        const updatedTrench: LinePlantationFeature = {
            ...trench,
            defaultPlantSpacing: plantSpacing,
            calculatedPlantCount: seedlingCoords.length,
            bundledSeedlings: [...(trench.bundledSeedlings || []), ...newSeedlings]
        };

        if (result.path.length > 1) {
            // It's bundled, update the top-most parent document
            const topMostParent = result.path[0];
            const updateBundledRecursive = (features: any[]): any[] => {
                return features.map(f => {
                    if (f.id === trenchId) return updatedTrench;
                    if (f.bundledLines) {
                        return { ...f, bundledLines: updateBundledRecursive(f.bundledLines) };
                    }
                    return f;
                });
            };
            
            const updatedTopParent = {
                ...topMostParent,
                bundledLines: updateBundledRecursive((topMostParent as any).bundledLines || [])
            } as PlantationFeature;
            handleUpdateFeature(updatedTopParent);
        } else {
            // It's a top-level feature
            handleUpdateFeature(updatedTrench);
        }

        toast.success(`Generated ${newSeedlings.length} plants for ${trench.name}`);
        logActivity("Seedling Generation", 'design', 'success', `Generated ${newSeedlings.length} seedlings for ${trench.name}`);
    };

    const handleGenerateIrrigation = async (params: { parentFeature: AreaPlantationFeature; distance: number; angle: number; dripperSpacing: number; litersPerDripper: number; }) => {
        const { parentFeature, distance, angle, dripperSpacing, litersPerDripper } = params;
        const parsedGeom = typeof parentFeature.geometry === 'string' ? JSON.parse(parentFeature.geometry) : parentFeature.geometry;
        const lineGeometries = generateTrenches(parsedGeom, distance, angle);
        
        const targetOrgId = parentFeature.organizationId || activeOrgId || undefined;

        const newIrrigationLines: LinePlantationFeature[] = lineGeometries.map((geom, idx) => ({
            id: `irrigation-${Date.now()}-${idx}`,
            name: `${parentFeature.name} - IRRIG ${idx + 1}`,
            type: 'line',
            lineType: 'irrigation',
            geometry: geom,
            layerId: parentFeature.layerId || 'root',
            parentId: parentFeature.id,
            isVisible: true,
            color: '#3b82f6',
            organizationId: targetOrgId
        }));

        // Optimize: Bundle irrigation lines into parent sector
        const updatedParent: AreaPlantationFeature = {
            ...parentFeature,
            bundledLines: [...(parentFeature.bundledLines || []), ...newIrrigationLines]
        };

        handleUpdateFeature(updatedParent);
        toast.success(`Generated ${newIrrigationLines.length} bundled irrigation lines for ${parentFeature.name}.`);
        logActivity("Irrigation Generation", 'design', 'success', `Generated ${newIrrigationLines.length} bundled irrigation lines for ${parentFeature.name}.`);
    };

    // --- Agronomy Handlers ---

    const handleSetWorkAssignments = async (assignments: WorkAssignment[]) => {
        if (!activeOrgId || !Array.isArray(assignments)) return;
        
        // Sync Stock
        const incomingIds = assignments.map(a => a.id).filter(Boolean);
        const oldMatch = workAssignments.filter(a => incomingIds.includes(a.id));
        updateInventoryFromUsage(oldMatch, assignments, 'TASKS');

        // Optimistically update React state and offline cache immediately
        setWorkAssignments(prev => {
            const newItems = [...prev];
            const itemsToSave: WorkAssignment[] = [];
            assignments.forEach(item => {
                const id = item.id || `work-${Date.now()}-${Math.random()}`;
                const newItem = { ...item, id, organizationId: activeOrgId || 'personal' };
                const idx = newItems.findIndex(i => i.id === id);
                if (idx >= 0) newItems[idx] = newItem;
                else newItems.push(newItem);
                itemsToSave.push(newItem);
            });
            // Ensure unique IDs in state
            const seen = new Set<string>();
            const uniqueItems = newItems.filter(item => {
                if (!item || !item.id) return false;
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
            saveMockData('workAssignments', itemsToSave);
            return uniqueItems;
        });

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                assignments.forEach(a => {
                    const id = a.id || `work-${Date.now()}-${Math.random()}`;
                    const data = { ...a, id, organizationId: activeOrgId };
                    trackModification(`workAssignments/${id}`, 'set', data);
                    batch.set(doc(db, 'workAssignments', id), data);
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for workAssignments, queued locally:", error);
                assignments.forEach(a => {
                    const id = a.id || `work-${Date.now()}-${Math.random()}`;
                    trackModification(`workAssignments/${id}`, 'set', { ...a, id, organizationId: activeOrgId });
                });
            }
        }
    };

    const handleSetAccounts = async (newAccounts: Account[]) => {
        if (!activeOrgId || !Array.isArray(newAccounts)) return;
        
        // Optimistically update React state and offline cache immediately
        setAccounts(prev => {
            const newItems = [...prev];
            const itemsToSave: Account[] = [];
            newAccounts.forEach(item => {
                const id = item.id || `acc-${Date.now()}-${Math.random()}`;
                const newItem = { ...item, id, organizationId: activeOrgId || 'personal' };
                const idx = newItems.findIndex(i => i.id === item.id);
                if (idx >= 0) newItems[idx] = newItem;
                else newItems.push(newItem);
                itemsToSave.push(newItem);
            });
            saveMockData('accounts', itemsToSave);
            return newItems;
        });

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newAccounts.forEach(a => {
                    const id = a.id || `acc-${Date.now()}-${Math.random()}`;
                    const data = { ...a, id, organizationId: activeOrgId };
                    trackModification(`accounts/${id}`, 'set', data);
                    batch.set(doc(db, 'accounts', id), data);
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for accounts, queued locally:", error);
                newAccounts.forEach(a => {
                    const id = a.id || `acc-${Date.now()}-${Math.random()}`;
                    trackModification(`accounts/${id}`, 'set', { ...a, id, organizationId: activeOrgId });
                });
            }
        }
    };

    const handleSetTransactions = async (newTxs: Transaction[]) => {
        if (!activeOrgId || !Array.isArray(newTxs)) return;
        
        // Optimistically update React state and offline cache immediately
        setTransactions(prev => {
            const newItems = [...prev];
            const itemsToSave: Transaction[] = [];
            newTxs.forEach(item => {
                const id = item.id || `tx-${Date.now()}-${Math.random()}`;
                const newItem = { ...item, id, organizationId: activeOrgId || 'personal' };
                const idx = newItems.findIndex(i => i.id === item.id);
                if (idx >= 0) newItems[idx] = newItem;
                else newItems.push(newItem);
                itemsToSave.push(newItem);
            });
            saveMockData('transactions', itemsToSave);
            return newItems;
        });

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newTxs.forEach(t => {
                    const id = t.id || `tx-${Date.now()}-${Math.random()}`;
                    const data = { ...t, id, organizationId: activeOrgId };
                    trackModification(`transactions/${id}`, 'set', data);
                    batch.set(doc(db, 'transactions', id), data);
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for transactions, queued locally:", error);
                newTxs.forEach(t => {
                    const id = t.id || `tx-${Date.now()}-${Math.random()}`;
                    trackModification(`transactions/${id}`, 'set', { ...t, id, organizationId: activeOrgId });
                });
            }
        }
    };

    const handleSetDailyLogs = async (logs: DailyLogEntry[]) => {
        if (!activeOrgId || !Array.isArray(logs)) return;
        
        // Match existing items by ID and by employeeId + date
        const existingMap = new Map((dailyLogs || []).map(item => [item.id, item]));
        const existingEmpDateMap = new Map((dailyLogs || []).map(item => [`${item.employeeId}_${item.date?.split('T')[0]}`, item]));
        
        const changedLogs: DailyLogEntry[] = [];
        const enrichedLogs = logs.map(item => {
            const dateKey = item.date?.split('T')[0] || item.date;
            const existingEmp = existingEmpDateMap.get(`${item.employeeId}_${dateKey}`);
            const id = item.id || existingEmp?.id || `dl-${item.employeeId}-${dateKey}`;
            const newItem = { ...item, id, organizationId: activeOrgId || 'personal' };
            const existing = existingMap.get(id) || existingEmp;
            if (!existing || existing.logType !== newItem.logType) {
                changedLogs.push(newItem);
            }
            return newItem;
        });

        // Optimistically update React state and offline cache immediately
        setDailyLogs(enrichedLogs);
        saveMockData('dailyLogs', enrichedLogs);

        // Only persist and queue changed or newly added daily attendance records
        if (changedLogs.length > 0 && USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            // Track modification once per changed item so offline queue is accurate
            changedLogs.forEach(l => {
                trackModification(`dailyLogs/${l.id}`, 'set', l);
            });

            try {
                const batch = writeBatch(db);
                changedLogs.slice(0, 450).forEach(l => {
                    batch.set(doc(db, 'dailyLogs', l.id), l);
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for dailyLogs, safely queued locally:", error);
            }
        }
    };

    const handleMarkAlertAsRead = async (alertId: string) => {
        if (!USE_FIREBASE) {
            setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isRead: true } : a));
            return;
        }
        try {
            await updateDoc(doc(db, 'alerts', alertId), { isRead: true });
        } catch (error) {
            handleFirestoreError(error, 'update' as any, `alerts/${alertId}`);
        }
    };

    const handleClearAllAlerts = async () => {
        if (!USE_FIREBASE) {
            setAlerts([]);
            return;
        }
        try {
            const batch = writeBatch(db);
            alerts.forEach(alert => {
                batch.delete(doc(db, 'alerts', alert.id));
            });
            await batch.commit();
            toast.success("Notifications cleared");
        } catch (error) {
            handleFirestoreError(error, 'delete' as any, 'alerts');
        }
    };

    const handleSetAlerts = async (newAlerts: Alert[]) => {
        if (!activeOrgId) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newAlerts.forEach(a => {
                    const id = a.id || `alert-${Date.now()}-${Math.random()}`;
                    batch.set(doc(db, 'alerts', id), { ...a, id, organizationId: activeOrgId });
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'alerts');
            }
        } else {
            setAlerts(prev => {
                const newItems = [...prev];
                const itemsToSave: Alert[] = [];
                newAlerts.forEach(item => {
                    const id = item.id || `alert-${Date.now()}-${Math.random()}`;
                    const newItem = { ...item, id, organizationId: activeOrgId || 'personal' };
                    const idx = newItems.findIndex(i => i.id === item.id);
                    if (idx >= 0) newItems[idx] = newItem;
                    else newItems.push(newItem);
                    itemsToSave.push(newItem);
                });
                saveMockData('alerts', itemsToSave);
                return newItems;
            });
        }
    };

    const handleSetPlanExecutions = async (newExecs: PlanExecution[]) => {
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newExecs.forEach(exec => {
                    const id = exec.id || `exec-${Date.now()}-${Math.random()}`;
                    batch.set(doc(db, 'planExecutions', id), sanitizeObject({ ...exec, id, organizationId: activeOrgId || 'personal' }));
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'planExecutions');
            }
        } else {
            setPlanExecutions(newExecs);
            saveMockData('planExecutions', newExecs);
        }
    };

    const handleDeletePlanExecution = async (id: string) => {
        const exec = planExecutions.find(e => e.id === id);
        if (!exec) return;

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await deleteDoc(doc(db, 'planExecutions', id));
            } catch (error) {
                handleFirestoreError(error, 'delete', `planExecutions/${id}`);
            }
        } else {
            setPlanExecutions(planExecutions.filter(e => e.id !== id));
            saveMockData('planExecutions', planExecutions.filter(e => e.id !== id));
        }
        logActivity("Execution Reverted", 'agronomy', 'alert', `Reverted treatment log. Stock restored.`);
    };

    const handleMarkPostAsRead = async (postId: string) => {
        if (!currentUser) return;
        const post = forumPosts.find(p => p.id === postId);
        if (!post) return;
        
        const readBy = post.readBy || [];
        if (readBy.includes(currentUser.id)) return;
        
        const updatedReadBy = [...readBy, currentUser.id];
        
        if (USE_FIREBASE && auth.currentUser && currentUser.id !== 'root-system') {
            try {
                await updateDoc(doc(db, 'forumPosts', postId), {
                    readBy: updatedReadBy,
                    isRead: true
                });
            } catch (error) {
                console.warn("Failed to mark post as read", error);
            }
        } else {
            setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, readBy: updatedReadBy, isRead: true } : p));
        }
    };

    const handleSaveListing = async (listing: Partial<Listing>, file: File | null) => {
        try {
            const id = listing.id || `listing-${Date.now()}`;
            const newListing: Listing = {
                ...listing,
                id,
                sellerId: currentUser?.id || 'anon',
                sellerName: currentUser?.name || 'Anon',
                organizationId: activeOrgId || 'personal',
                createdAt: listing.createdAt || new Date().toISOString()
            } as Listing;
            
            if (file) {
                newListing.mediaUrl = URL.createObjectURL(file);
            }

            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                await setDoc(doc(db, 'listings', id), sanitizeObject(newListing));
                
                // Create a global announcement for the listing
                const announcementId = `post-listing-${id}`;
                const announcement: ForumPost = {
                    id: announcementId,
                    title: `New Market Opportunity: ${newListing.title}`,
                    content: `A new listing for ${newListing.quantity} ${newListing.unit} of ${newListing.title} has been posted by ${newListing.sellerName}. Check it out in the Marketplace!`,
                    authorId: currentUser?.id || 'anon',
                    authorName: currentUser?.name || 'AgriMap System',
                    timestamp: new Date().toISOString(),
                    hubType: 'global',
                    channelId: 'general',
                    replies: []
                };
                await setDoc(doc(db, 'forumPosts', announcementId), announcement);

                toast.success("Listing saved and announced successfully");
                logActivity("Listing Created", 'marketplace', 'success', `Created listing: ${newListing.title}`);
            } else {
                setListings(prev => {
                    const updated = [...prev.filter(l => l.id !== id), newListing];
                    saveMockData('listings', [newListing]);
                    return updated;
                });

                const announcement: ForumPost = {
                    id: `post-listing-${id}`,
                    title: `New Market Opportunity: ${newListing.title}`,
                    content: `A new listing for ${newListing.quantity} ${newListing.unit} of ${newListing.title} has been posted. Check it out in the Marketplace!`,
                    authorId: currentUser?.id || 'anon',
                    authorName: currentUser?.name || 'AgriMap System',
                    timestamp: new Date().toISOString(),
                    hubType: 'global',
                    channelId: 'general',
                    replies: []
                };
                setForumPosts(prev => [announcement, ...prev]);

                toast.success("Listing saved successfully (Local)");
            }
        } catch (error) {
            handleFirestoreError(error, 'write', 'listings');
        }
    };

    const handleAddBid = async (listingId: string, amount: number) => {
        if (!activeOrgId) return;
        const id = `bid-${Date.now()}`;
        const newBid: Bid = {
            id,
            listingId,
            bidderId: currentUser?.id || 'anon',
            amount,
            timestamp: new Date().toISOString(),
            organizationId: activeOrgId
        } as any;

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await setDoc(doc(db, 'bids', id), sanitizeObject(newBid));
                
                // Update listing current price
                const listingRef = doc(db, 'listings', listingId);
                const listingSnap = await getDocFromServer(listingRef);
                if (listingSnap.exists()) {
                    const listingData = listingSnap.data() as Listing;
                    if (listingData.auctionDetails) {
                        await updateDoc(listingRef, {
                            'auctionDetails.currentPrice': amount,
                            'auctionDetails.highestBidderId': currentUser?.id
                        });
                    }
                }
                
                toast.success("Bid placed successfully");
                logActivity("Bid Placed", 'marketplace', 'success', `Placed bid of ${amount} on listing ${listingId}`);
            } catch (error) {
                handleFirestoreError(error, 'write', 'bids');
            }
        } else {
            setBids(prev => {
                const updated = [...prev, newBid];
                saveMockData('bids', [newBid]);
                return updated;
            });
            setListings(prev => {
                const updated = prev.map(l => l.id === listingId ? { 
                    ...l, 
                    auctionDetails: l.auctionDetails ? { ...l.auctionDetails, currentPrice: amount, highestBidderId: currentUser?.id || 'anon' } : undefined 
                } : l);
                saveMockData('listings', updated.filter(l => l.id === listingId));
                return updated;
            });
            toast.success("Bid placed successfully (Local)");
        }
    };

    const handleSetHarvestedProduce = async (produces: HarvestedProduce[]) => {
        if (!activeOrgId || !Array.isArray(produces)) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                produces.forEach(p => {
                    const id = p.id || `hp-${Date.now()}-${Math.random()}`;
                    const newP = { ...p, id, organizationId: activeOrgId };
                    batch.set(doc(db, 'harvestedProduce', id), newP);
                });
                await batch.commit();
                setHarvestedProduce(prev => [...prev, ...produces]);
            } catch (error) {
                handleFirestoreError(error, 'write', 'harvestedProduce');
            }
        } else {
            const itemsToSave: HarvestedProduce[] = produces.map(p => ({
                ...p,
                id: p.id || `hp-${Date.now()}-${Math.random()}`,
                organizationId: activeOrgId || 'personal'
            }));
            setHarvestedProduce(prev => [...prev, ...itemsToSave]);
            saveMockData('harvestedProduce', itemsToSave);
        }
    };

    const handleSetStockTransactions = async (txs: StockTransaction[]) => {
        if (!activeOrgId || !Array.isArray(txs)) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                txs.forEach(tx => {
                    const id = tx.id || `stx-${Date.now()}-${Math.random()}`;
                    const newTx = { ...tx, id, organizationId: activeOrgId };
                    batch.set(doc(db, 'stockTransactions', id), newTx);
                });
                await batch.commit();
                setStockTransactions(prev => [...prev, ...txs]);
            } catch (error) {
                handleFirestoreError(error, 'write', 'stockTransactions');
            }
        } else {
            const itemsToSave: StockTransaction[] = txs.map(tx => ({
                ...tx,
                id: tx.id || `stx-${Date.now()}-${Math.random()}`,
                organizationId: activeOrgId || 'personal'
            }));
            setStockTransactions(prev => [...prev, ...itemsToSave]);
            saveMockData('stockTransactions', itemsToSave);
        }
    };

    const handleSetInventoryTransactions = async (txs: InventoryTransaction[]) => {
        if (!activeOrgId || !Array.isArray(txs)) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                txs.forEach(tx => {
                    const id = tx.id || `tx-${Date.now()}-${Math.random()}`;
                    const newTx = { ...tx, id, organizationId: activeOrgId };
                    batch.set(doc(db, 'inventoryTransactions', id), newTx);
                });
                await batch.commit();
                setInventoryTransactions(prev => [...prev, ...txs]);
            } catch (error) {
                handleFirestoreError(error, 'write', 'inventoryTransactions');
            }
        } else {
            const itemsToSave: InventoryTransaction[] = txs.map(tx => ({
                ...tx,
                id: tx.id || `tx-${Date.now()}-${Math.random()}`,
                organizationId: activeOrgId || 'personal'
            }));
            setInventoryTransactions(prev => [...prev, ...itemsToSave]);
            saveMockData('inventoryTransactions', itemsToSave);
        }
    };

    const handleSetSuppliers = async (newSuppliers: Supplier[]) => {
        if (!activeOrgId) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newSuppliers.forEach(s => {
                    const id = s.id || `sup-${Date.now()}-${Math.random()}`;
                    const newSup = { ...s, id, organizationId: activeOrgId };
                    batch.set(doc(db, 'suppliers', id), newSup);
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'suppliers');
            }
        } else {
            const itemsToSave = newSuppliers.map(s => ({
                ...s,
                id: s.id || `sup-${Date.now()}-${Math.random()}`,
                organizationId: activeOrgId || 'personal'
            }));
            setSuppliers(itemsToSave);
            saveMockData('suppliers', itemsToSave);
        }
    };

    const handleSetPurchaseOrders = async (pos: PurchaseOrder[]) => {
        if (!activeOrgId) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                pos.forEach(po => {
                    const id = po.id || `po-${Date.now()}-${Math.random()}`;
                    const newPo = { ...po, id, organizationId: activeOrgId };
                    batch.set(doc(db, 'purchaseOrders', id), newPo);
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'purchaseOrders');
            }
        } else {
            const itemsToSave = pos.map(po => ({
                ...po,
                id: po.id || `po-${Date.now()}-${Math.random()}`,
                organizationId: activeOrgId || 'personal'
            }));
            setPurchaseOrders(itemsToSave);
            saveMockData('purchaseOrders', itemsToSave);
        }
    };

    const handleAddPost = async (post: Partial<ForumPost>) => {
        // Relax constraint: Global/Regional posts don't need activeOrgId. Internal posts should have it if possible.
        if (!activeOrgId && post.hubType === 'internal' && !post.isDirectMessage) {
            toast.error("Please select an organization to post in the Internal Hub.");
            return;
        }
        
        let id = post.id || `post-${Date.now()}`;
        if (post.isDirectMessage && post.recipientId && currentUser?.id) {
            const sortedIds = [currentUser.id, post.recipientId].sort();
            post.channelId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
        }

        const now = new Date().toISOString();
        const newPost: ForumPost = {
            hubType: post.hubType || 'internal',
            channelId: post.channelId || 'general',
            ...post,
            id,
            authorId: currentUser?.id || 'anon',
            authorName: currentUser?.name || 'Anon',
            timestamp: now,
            createdAt: now, // Add for compatibility
            organizationId: activeOrgId || 'personal',
            replies: [],
            readBy: [currentUser?.id || 'anon']
        } as ForumPost;

        // Keyword detection for Marketplace
        const isListing = post.hubType === 'global' && (post.content?.toLowerCase().includes('sell') || post.content?.toLowerCase().includes('price') || post.title?.toLowerCase().includes('sell'));
        if (isListing && currentUser?.id) {
            const listingId = `listing-${Date.now()}`;
            const newListing: Listing = {
                id: listingId,
                title: post.title || post.content?.substring(0, 50) || 'Market Listing',
                description: post.content || '',
                type: 'sale',
                quantity: 1,
                unit: 'item',
                pricePerUnit: 0,
                location: currentUser.location || [0, 0],
                createdAt: new Date().toISOString(),
                sellerId: currentUser.id,
                sellerName: currentUser.name,
                category: 'General',
                cropType: 'Other',
                status: 'Active' as any,
                organizationId: activeOrgId || 'personal'
            } as Listing;
            if (USE_FIREBASE) {
                setDoc(doc(db, 'listings', listingId), sanitizeObject(newListing)).catch(e => console.error("Listing creation failed", e));
            } else {
                setListings(prev => [newListing, ...prev]);
            }
        }

        // Auto-Alert for @mentions
        const mentions = post.content?.match(/@(\w+)/g);
        if (mentions) {
            mentions.forEach(mention => {
                const mentionedName = mention.substring(1);
                const mentionedUser = users.find(u => u.name === mentionedName || u.firstName === mentionedName);
                if (mentionedUser && mentionedUser.id !== currentUser?.id) {
                    handleSetAlerts([{
                        id: `mention-${Date.now()}-${Math.random()}`,
                        title: 'New Mention',
                        content: `${currentUser?.name} mentioned you in a post: "${post.content?.substring(0, 30)}..."`,
                        type: 'info',
                        timestamp: new Date().toISOString(),
                        metadata: { postId: id, type: 'mention' }
                    }]);
                }
            });
        }

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await setDoc(doc(db, 'forumPosts', id), sanitizeObject(newPost));
                if (!post.isDirectMessage || post.content?.length! > 30) {
                    toast.success("Post shared");
                }
            } catch (error) {
                handleFirestoreError(error, 'write', 'forumPosts');
            }
        } else {
            setForumPosts(prev => {
                const updated = [...prev.filter(p => p.id !== id), newPost];
                localStorage.setItem('mock_forumPosts', JSON.stringify(updated));
                return updated;
            });
            if (!post.isDirectMessage || post.content?.length! > 30) {
                toast.success("Post shared (Local)");
            }
        }
    };

    const handleAddReply = async (postId: string, content: string) => {
        const newReply = {
            id: `reply-${Date.now()}`,
            authorId: currentUser?.id || 'anon',
            authorName: currentUser?.name || 'Anon',
            content,
            timestamp: new Date().toISOString()
        };

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const postRef = doc(db, 'forumPosts', postId);
                const postSnap = await getDocFromServer(postRef);
                if (postSnap.exists()) {
                    const postData = postSnap.data() as ForumPost;
                    await updateDoc(postRef, {
                        replies: [...(postData.replies || []), newReply]
                    });
                }
            } catch (error) {
                handleFirestoreError(error, 'write', 'forumPosts');
            }
        } else {
            setForumPosts(prev => {
                const updated = prev.map(p => p.id === postId ? { ...p, replies: [...(p.replies || []), newReply] } : p);
                localStorage.setItem('mock_forumPosts', JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleUpdatePost = async (postId: string, updates: Partial<ForumPost>) => {
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const postRef = doc(db, 'forumPosts', postId);
                await updateDoc(postRef, updates);
            } catch (error) {
                handleFirestoreError(error, 'write', `forumPosts/${postId}`);
            }
        } else {
            setForumPosts(prev => {
                const updated = prev.map(p => p.id === postId ? { ...p, ...updates } : p);
                localStorage.setItem('mock_forumPosts', JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleAddTask = async (taskInput: string | any) => {
        const id = (taskInput && typeof taskInput === 'object' && taskInput.id) ? taskInput.id : `task-${Date.now()}`;
        let resolvedWorkName = 'New Task';
        let resolvedTaskType: any = 'Other';
        let resolvedStatus: any = 'planned';
        let resolvedSectorIds: string[] = [];
        let resolvedNotes = '';

        if (typeof taskInput === 'string') {
            resolvedWorkName = taskInput;
        } else if (taskInput && typeof taskInput === 'object') {
            resolvedWorkName = taskInput.name || taskInput.workName || taskInput.title || 'Agronomic Treatment';
            if (taskInput.taskType) resolvedTaskType = taskInput.taskType;
            if (taskInput.status) resolvedStatus = taskInput.status;
            if (taskInput.targetSector) resolvedSectorIds = [taskInput.targetSector];
            if (taskInput.sectorIds && Array.isArray(taskInput.sectorIds)) resolvedSectorIds = taskInput.sectorIds;
            resolvedNotes = [
                taskInput.prescribedChemical ? `Chemical: ${taskInput.prescribedChemical}` : '',
                taskInput.dosage ? `Dosage: ${taskInput.dosage}` : '',
                taskInput.nutritionNotes ? `Nutrition: ${taskInput.nutritionNotes}` : '',
                taskInput.preventiveGuidelines ? `Guidelines: ${taskInput.preventiveGuidelines}` : ''
            ].filter(Boolean).join(' | ');
        }

        const newTask: WorkAssignment = {
            id,
            workName: String(resolvedWorkName),
            status: resolvedStatus,
            taskType: resolvedTaskType,
            assignedEmployeeIds: [],
            employeeHours: [],
            sectorIds: resolvedSectorIds,
            date: new Date().toISOString(),
            source: 'tasks',
            organizationId: activeOrgId || 'personal',
            notes: resolvedNotes || undefined
        };

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await setDoc(doc(db, 'workAssignments', id), sanitizeObject(newTask));
                toast.success("Task added");
            } catch (error) {
                handleFirestoreError(error, 'write', 'workAssignments');
            }
        } else {
            setWorkAssignments(prev => [...prev, newTask]);
            saveMockData('workAssignments', [newTask]);
            toast.success("Task added (Local)");
        }
    };

    const handleSetOperationalLogs = async (logsOrUpdater: OperationalLog[] | ((prev: OperationalLog[]) => OperationalLog[])) => {
        const effectiveOrgId = activeOrgId || (currentUser as any)?.organizationId || 'personal';
        const currentList = operationalLogs || [];
        const resolvedLogs = typeof logsOrUpdater === 'function' ? logsOrUpdater(currentList) : logsOrUpdater;
        if (!Array.isArray(resolvedLogs)) return;

        // Sync Stock
        const incomingIds = resolvedLogs.map(l => l.id).filter(Boolean);
        const oldLogsMatch = currentList.filter(l => incomingIds.includes(l.id));
        updateInventoryFromUsage(oldLogsMatch, resolvedLogs, 'FLEET');

        setOperationalLogs(resolvedLogs);

        const itemsToSave: OperationalLog[] = resolvedLogs.map(log => ({
            ...log,
            id: log.id || `log-${Date.now()}-${Math.random()}`,
            organizationId: log.organizationId || effectiveOrgId
        }));

        saveMockData('operationalLogs', itemsToSave);
        try {
            localStorage.setItem('mock_operationalLogs', JSON.stringify(itemsToSave));
            safeStorage.setItem('fb_cache_operationalLogs', JSON.stringify(itemsToSave));
        } catch (e) {
            console.warn('[Storage] Could not cache operational logs:', e);
        }

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                itemsToSave.forEach(log => {
                    batch.set(doc(db, 'operationalLogs', log.id), sanitizeObject(log));
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'operationalLogs');
            }
        }
    };

    const handleSetEmployees = async (newEmployees: Employee[], syncToCloud = true) => {
        const deletedEmployees = (employees || []).filter(e => !newEmployees.some(n => n.id === e.id));
        setEmployees(newEmployees);

        saveMockData('employees', newEmployees);
        try {
            localStorage.setItem('fb_cache_employees', JSON.stringify(newEmployees));
        } catch (e) {
            console.warn("[Cache] Failed to write fb_cache_employees:", e);
        }

        if (syncToCloud && USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                deletedEmployees.forEach(e => {
                    trackModification(`employees/${e.id}`, 'delete');
                    batch.delete(doc(db, 'employees', e.id));
                });
                
                const existingEmployeesMap = new Map<string, Employee>();
                (employees || []).forEach(ex => {
                    if (ex.id) existingEmployeesMap.set(ex.id, ex);
                });

                const changedEmployees = newEmployees.filter(e => {
                    const existing = e.id ? existingEmployeesMap.get(e.id) : undefined;
                    return !existing || (existing !== e && JSON.stringify(existing) !== JSON.stringify(e));
                });

                changedEmployees.forEach(e => {
                    const id = e.id || `emp-${Date.now()}-${Math.random()}`;
                    const data = { 
                        ...e, 
                        id, 
                        organizationId: e.organizationId || activeOrgId || 'personal' 
                    };
                    trackModification(`employees/${id}`, 'set', data);
                    batch.set(doc(db, 'employees', id), sanitizeObject(data));

                    // If global user is requested but doesn't exist in 'users' collection,
                    // we should ensure it's provisioned (though usually ToolsView handles this, 
                    // this is a safety net).
                    if (e.isGlobalUser && e.email) {
                        // User creation happens in ToolsView via handleSaveEmployee due to password requirement.
                    }
                });
                await batch.commit();

                if (deletedEmployees.length > 0) {
                     logActivity("Employee Deleted", "profile", "alert", `Deleted employee profiles: ${deletedEmployees.map(e=>e.name || e.id).join(', ')}`);
                }
            } catch (error) {
                console.warn("Firestore write error for employees, queued locally:", error);
                newEmployees.forEach(e => {
                    const id = e.id || `emp-${Date.now()}-${Math.random()}`;
                    trackModification(`employees/${id}`, 'set', { ...e, id, organizationId: e.organizationId || activeOrgId || 'personal' });
                });
            }
        }
    };

    const handleSetRoles = async (newRoles: Role[]) => {
        setRoles(newRoles);
        saveMockData('roles', newRoles);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newRoles.forEach(r => {
                    const id = r.id || `role-${Date.now()}-${Math.random()}`;
                    const data = { ...r, id, organizationId: activeOrgId || 'personal' };
                    trackModification(`roles/${id}`, 'set', data);
                    batch.set(doc(db, 'roles', id), data);
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for roles, queued locally:", error);
                newRoles.forEach(r => {
                    const id = r.id || `role-${Date.now()}-${Math.random()}`;
                    trackModification(`roles/${id}`, 'set', { ...r, id, organizationId: activeOrgId || 'personal' });
                });
            }
        }
    };

    const handleSetEmployeeGroups = async (newGroups: EmployeeGroup[]) => {
        setEmployeeGroups(newGroups);
        saveMockData('employeeGroups', newGroups);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newGroups.forEach(g => {
                    const id = g.id || `group-${Date.now()}-${Math.random()}`;
                    batch.set(doc(db, 'employeeGroups', id), { ...g, id, organizationId: activeOrgId || 'personal' });
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for employeeGroups, queued locally:", error);
            }
        }
    };

    const handleSetUsers = async (newUsers: User[]) => {
        setAllUsers(newUsers);
        saveMockData('users', newUsers);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newUsers.forEach(u => {
                    const id = u.id || `user-${Date.now()}-${Math.random()}`;
                    batch.set(doc(db, 'users', id), { ...u, id });
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for users:", error);
            }
        }
    };

    const handleSetNutritionPlans = async (plans: NutritionPlan[]) => {
        setNutritionPlans(plans);
        saveMockData('nutritionPlans', plans);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                plans.forEach(p => {
                    const id = p.id || `plan-${Date.now()}-${Math.random()}`;
                    batch.set(doc(db, 'nutritionPlans', id), sanitizeObject({ ...p, id, organizationId: activeOrgId || 'personal' }));
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for nutritionPlans:", error);
            }
        }
    };

    const handleSetMachinery = async (newMachinery: Machinery[]) => {
        setMachinery(newMachinery);
        saveMockData('machinery', newMachinery);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newMachinery.forEach(m => {
                    const id = m.id || `mach-${Date.now()}-${Math.random()}`;
                    const data = { ...m, id, organizationId: activeOrgId || 'personal' };
                    trackModification(`machinery/${id}`, 'set', data);
                    batch.set(doc(db, 'machinery', id), data);
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for machinery, queued locally:", error);
                newMachinery.forEach(m => {
                    const id = m.id || `mach-${Date.now()}-${Math.random()}`;
                    trackModification(`machinery/${id}`, 'set', { ...m, id, organizationId: activeOrgId || 'personal' });
                });
            }
        }
    };

    const handleSetOrganizations = async (newOrgs: Organization[]) => {
        setOrganizations(newOrgs);
        saveMockData('organizations', newOrgs);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newOrgs.forEach(o => {
                    const id = o.id || `org-${Date.now()}-${Math.random()}`;
                    batch.set(doc(db, 'organizations', id), sanitizeOrganizationForFirestore(o));
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for organizations:", error);
            }
        }
    };

    const handleSetMemberships = async (newMemberships: Membership[]) => {
        setMemberships(newMemberships);
        saveMockData('memberships', newMemberships);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                newMemberships.forEach(m => {
                    const id = m.id || `mem-${Date.now()}-${Math.random()}`;
                    batch.set(doc(db, 'memberships', id), { ...m, id });
                });
                await batch.commit();
            } catch (error) {
                console.warn("Firestore write error for memberships:", error);
            }
        }
    };

    const handleSetInventoryItems = async (items: InventoryItem[], syncToCloud = true) => {
        if (!Array.isArray(items)) return;
        
        // Fast O(N) lookup for deleted items using a Set of new IDs
        const newItemIds = new Set(items.map(n => n.id));
        const deletedItems = (inventoryItems || []).filter(item => !newItemIds.has(item.id));
        setInventoryItems(items);
        saveMockData('inventoryItems', items);
        try {
            localStorage.setItem('fb_cache_inventoryItems', JSON.stringify(items));
        } catch (e) {
            console.warn("[Cache] Failed to write fb_cache_inventoryItems:", e);
        }

        if (syncToCloud && USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                deletedItems.forEach(item => {
                    trackModification(`inventoryItems/${item.id}`, 'delete');
                    batch.delete(doc(db, 'inventoryItems', item.id));
                });

                // Fast O(N) map of previous items for O(1) matching & O(1) reference equality check
                const prevMap = new Map((inventoryItems || []).map(p => [p.id, p]));
                const itemsToSync = items.filter(item => {
                    const prev = prevMap.get(item.id);
                    return !prev || prev !== item;
                });

                itemsToSync.forEach(item => {
                     const id = item.id || `inv-${Date.now()}-${Math.random()}`;
                     const data = { ...item, id, organizationId: item.organizationId || activeOrgId || 'ALL' };
                     trackModification(`inventoryItems/${id}`, 'set', data);
                     batch.set(doc(db, 'inventoryItems', id), data);
                });

                if (deletedItems.length > 0 || itemsToSync.length > 0) {
                    await batch.commit();
                }
            } catch (error) {
                console.warn("Firestore write error for inventoryItems, queued locally:", error);
                items.forEach(item => {
                    const id = item.id || `inv-${Date.now()}-${Math.random()}`;
                    trackModification(`inventoryItems/${id}`, 'set', { ...item, id, organizationId: item.organizationId || activeOrgId || 'ALL' });
                });
            }
        }
    };

    const chargeMaterialFromStock = async (item_id: string, amount: number, source_module: StockTransaction['sourceModule'], transaction_type: 'ADDITION' | 'DEDUCTION' | 'REFUND', reason?: string) => {
        if (!activeOrgId || !item_id || !amount) return;

        const tx: StockTransaction = {
            id: `stx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            organizationId: activeOrgId,
            itemId: item_id,
            date: new Date().toISOString(),
            type: transaction_type,
            quantity: amount,
            sourceModule: source_module,
            reason: reason || `${transaction_type} via Payload Delta Sync`
        };

        handleSetStockTransactions([tx]);
    };

    const updateInventoryFromUsage = (
        oldItems: { materialsUsed?: MaterialUsed[]; assignedVehicles?: AssignedVehicle[]; inventoryItemId?: string; inventoryQuantity?: number; sourceModule?: StockTransaction['sourceModule'] }[],
        newItems: { materialsUsed?: MaterialUsed[]; assignedVehicles?: AssignedVehicle[]; inventoryItemId?: string; inventoryQuantity?: number; sourceModule?: StockTransaction['sourceModule'] }[],
        source?: StockTransaction['sourceModule']
    ) => {
        const deltas: Record<string, number> = {};

        // Helper to add to deltas
        const addDelta = (id: string, qty: number) => {
            if (!id || !qty) return;
            deltas[id] = (deltas[id] || 0) + qty;
        };

        // 1. Revert OLD items (add back to stock)
        oldItems.forEach(item => {
            item.materialsUsed?.forEach(m => {
                addDelta(m.inventoryItemId, m.quantity);
                chargeMaterialFromStock(m.inventoryItemId, m.quantity, source || item.sourceModule || 'MANUAL', 'REFUND', 'Rollback Engine: Item Payload Deleted/Edited');
            });
            item.assignedVehicles?.forEach(v => {
                if (v.machineryId) {
                    const mach = machinery.find(m => m.id === v.machineryId);
                    if (mach?.fuelItemId && mach.fuelConsumption) {
                        const usage = v.usageHours * mach.fuelConsumption;
                        addDelta(mach.fuelItemId, usage);
                        chargeMaterialFromStock(mach.fuelItemId, usage, source || item.sourceModule || 'FLEET', 'REFUND', 'Rollback Engine: Fleet Log Payload Deleted/Edited');
                    }
                }
            });
            if (item.inventoryItemId && item.inventoryQuantity) {
                addDelta(item.inventoryItemId, item.inventoryQuantity);
                chargeMaterialFromStock(item.inventoryItemId, item.inventoryQuantity, source || item.sourceModule || 'MANUAL', 'REFUND', 'Rollback Engine: Primary Inventory Link Reverted');
            }
        });

        // 2. Apply NEW items (subtract from stock)
        newItems.forEach(item => {
            item.materialsUsed?.forEach(m => {
                addDelta(m.inventoryItemId, -m.quantity);
                chargeMaterialFromStock(m.inventoryItemId, m.quantity, source || item.sourceModule || 'MANUAL', 'DEDUCTION', 'Interceptor: Forward Ledger Delta Deduction');
            });
            item.assignedVehicles?.forEach(v => {
                if (v.machineryId) {
                    const mach = machinery.find(m => m.id === v.machineryId);
                    if (mach?.fuelItemId && mach.fuelConsumption && mach.isOwned) {
                        const usage = v.usageHours * mach.fuelConsumption;
                        addDelta(mach.fuelItemId, -usage);
                        chargeMaterialFromStock(mach.fuelItemId, usage, source || item.sourceModule || 'FLEET', 'DEDUCTION', 'Interceptor: Fleet Owned Vehicle Fuel Consumed');
                    }
                }
            });
            if (item.inventoryItemId && item.inventoryQuantity) {
                addDelta(item.inventoryItemId, -item.inventoryQuantity);
                chargeMaterialFromStock(item.inventoryItemId, item.inventoryQuantity, source || item.sourceModule || 'MANUAL', 'DEDUCTION', 'Interceptor: Primary Ledger Delta Deduction');
            }
        });

        // 3. Trigger bulk update if needed
        const changedIds = Object.keys(deltas).filter(id => Math.abs(deltas[id]) > 0.0001);
        if (changedIds.length > 0) {
            setInventoryItems(prev => prev.map(invItem => {
                const shift = deltas[invItem.id];
                if (shift) {
                    return { ...invItem, currentStock: Math.max(0, invItem.currentStock + shift) };
                }
                return invItem;
            }));
            
            // In production, we'd fire off a batch update to Firestore here
            const itemsToUpdate = inventoryItems
                .filter(i => changedIds.includes(i.id))
                .map(i => ({ ...i, currentStock: Math.max(0, i.currentStock + (deltas[i.id] || 0)) }));
            if (itemsToUpdate.length > 0) {
                handleSetInventoryItems(itemsToUpdate);
            }
        }
    };

    const handleSetHarvestEvents = async (events: HarvestEvent[], syncToCloud = true) => {
        if (!activeOrgId || !Array.isArray(events)) return;
        
        const currentList = harvestEvents || [];
        const currentEventsMap = new Map<string, HarvestEvent>();
        currentList.forEach(e => {
            if (e.id) currentEventsMap.set(e.id, e);
        });

        // Determine if input is a partial update (e.g. single updated event) or full replacement array
        const inputMap = new Map<string, HarvestEvent>();
        events.forEach(e => {
            if (e.id) inputMap.set(e.id, e);
        });

        const deletedEvents: HarvestEvent[] = [];

        // Check explicit deletions
        events.forEach(e => {
            if (e.id && (e.isDeleted || e.status === 'deleted')) {
                deletedEvents.push(e);
            }
        });

        // Only treat missing items from currentList as deleted if input is a full array (length > 1 or matches expected count)
        // and caller explicitly dropped an item. Avoid treating a single updated event array [updatedEvent] as deleting everything else!
        const isPartialSingleUpdate = events.length === 1 && currentList.length > 1 && !events[0].isDeleted && events[0].status !== 'deleted';

        if (!isPartialSingleUpdate) {
            currentList.forEach(e => {
                if (e.id && !inputMap.has(e.id) && !e.isDeleted && e.status !== 'deleted') {
                    deletedEvents.push({ ...e, isDeleted: true, status: 'deleted', deletedAt: new Date().toISOString() });
                }
            });
        }

        // Construct full merged events list
        const updatedFullList: HarvestEvent[] = [];
        currentList.forEach(e => {
            if (e.id) {
                if (inputMap.has(e.id)) {
                    updatedFullList.push({ ...inputMap.get(e.id)!, organizationId: activeOrgId || e.organizationId });
                } else {
                    updatedFullList.push({ ...e, organizationId: activeOrgId || e.organizationId });
                }
            }
        });
        events.forEach(e => {
            if (e.id && !currentEventsMap.has(e.id)) {
                updatedFullList.push({ ...e, organizationId: activeOrgId || e.organizationId });
            }
        });

        // Intercept completed events to archive them to HarvestedProduce
        const producesToArchive: HarvestedProduce[] = [];
        events.forEach(event => {
            const existing = currentEventsMap.get(event.id);
            if (existing?.status !== 'completed' && event.status === 'completed') {
                let commercialStatus: HarvestedProduce['commercial_status'] = 'WAITING_FOR_MARKET_SALE';
                if (event.postHarvestAction === 'MARKETPLACE' || event.postHarvestAction === 'CREATE_MARKET_OFFER') commercialStatus = 'WAITING_FOR_MARKET_SALE';
                if (event.postHarvestAction === 'DIRECT_SALE' || event.postHarvestAction === 'SOLD_EXTERNAL') commercialStatus = 'DIRECT_SALE';
                if (event.postHarvestAction === 'COLD_STORAGE' || event.postHarvestAction === 'INTERNAL_TRANSFER') commercialStatus = 'COLD_STORAGE';
                if (event.marketIdentifier && event.postHarvestAction === 'SOLD_EXTERNAL') commercialStatus = 'SOLD_VIA_MARKET';
                
                producesToArchive.push({
                    id: `hp-${Date.now()}-${event.id}`,
                    organizationId: activeOrgId,
                    session_id: event.id,
                    start_time: event.actualStartDate || event.plannedStartDate,
                    end_time: event.actualEndDate || new Date().toISOString(),
                    total_kg: event.finalNetYieldKg || event.totalNetWeightKg || 0,
                    worker_salary_total: event.totalPickerCost || 0,
                    stock_material_charge: event.totalPackagingCost || 0,
                    final_sale_price: event.saleDetails?.totalValue || null,
                    commercial_status: commercialStatus,
                    market_identifier: event.marketIdentifier,
                    crop: event.name
                });
            }
        });

        if (producesToArchive.length > 0) {
            handleSetHarvestedProduce(producesToArchive);
        }

        // Optimistically update local state to ensure smooth transitions
        setHarvestEvents(updatedFullList);
        saveMockData('harvestEvents', updatedFullList.map(e => ({...e, organizationId: activeOrgId || 'personal'})));
        try {
            localStorage.setItem('fb_cache_harvestEvents', JSON.stringify(updatedFullList));
        } catch (e) {
            console.warn("[Cache] Failed to write fb_cache_harvestEvents:", e);
        }

        if (syncToCloud && USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);

                deletedEvents.forEach(e => {
                    if (e.id) {
                        const tombstone = { ...e, isDeleted: true, status: 'deleted', deletedAt: new Date().toISOString() };
                        trackModification(`harvestEvents/${e.id}`, 'set', tombstone);
                        batch.set(doc(db, 'harvestEvents', e.id), sanitizeObject(tombstone));
                    }
                });

                // Save changed/updated events as single documents containing all adjustment parameters
                events.forEach(event => {
                    const id = event.id || `he-${Date.now()}-${Math.random()}`;
                    const data = { ...event, id, organizationId: activeOrgId };
                    trackModification(`harvestEvents/${id}`, 'set', data);
                    batch.set(doc(db, 'harvestEvents', id), sanitizeObject(data));
                });

                await batch.commit();

                if (deletedEvents.length > 0) {
                     logActivity("Session Deleted", "harvesting", "alert", `Deleted harvest session IDs: ${deletedEvents.map(e=>e.id).join(', ')}`);
                }
            } catch (error) {
                console.warn("Firestore write error for harvestEvents, queued locally:", error);
                events.forEach(event => {
                    const id = event.id || `he-${Date.now()}-${Math.random()}`;
                    trackModification(`harvestEvents/${id}`, 'set', { ...event, id, organizationId: activeOrgId });
                });
            }
        }
    };

    const harvestEntriesCacheTimerRef = React.useRef<any>(null);
    const saveHarvestEntriesCacheDebounced = useCallback((entries: HarvestEntry[]) => {
        if (harvestEntriesCacheTimerRef.current) {
            clearTimeout(harvestEntriesCacheTimerRef.current);
        }
        harvestEntriesCacheTimerRef.current = setTimeout(() => {
            try {
                localStorage.setItem('fb_cache_harvestEntries', JSON.stringify(entries));
            } catch (e) {
                console.warn("[Cache] Failed to write fb_cache_harvestEntries:", e);
            }
            harvestEntriesCacheTimerRef.current = null;
        }, 100);
    }, []);

    const handleSetHarvestEntries = async (entries: HarvestEntry[]) => {
        if (!activeOrgId || !Array.isArray(entries)) return;

        // CRITICAL BUG FIX & ENHANCEMENT:
        // Always set the state instantly in React and local storage cache so that weighed boxes
        // show up in the UI immediately, even if the system is completely offline.
        setHarvestEntries(entries);
        saveHarvestEntriesCacheDebounced(entries);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                
                const prevEntriesMap = new Map<string, HarvestEntry>();
                harvestEntries.forEach(e => {
                    if (e.id) prevEntriesMap.set(e.id, e);
                });

                const newEntriesMap = new Set<string>();
                entries.forEach(e => {
                    if (e.id) newEntriesMap.add(e.id);
                });
                
                const deletedEntries = harvestEntries.filter(e => e.id && !newEntriesMap.has(e.id));
                const changedEntries = entries.filter(e => {
                    const prev = e.id ? prevEntriesMap.get(e.id) : undefined;
                    return !prev || (prev !== e && JSON.stringify(prev) !== JSON.stringify(e));
                });

                if (changedEntries.length === 0 && deletedEntries.length === 0) return;

                deletedEntries.forEach(e => {
                    if (e.id) {
                        const tombstone = { ...e, isDeleted: true, status: 'deleted', deletedAt: new Date().toISOString() };
                        trackModification(`harvestEntries/${e.id}`, 'set', tombstone);
                        batch.set(doc(db, 'harvestEntries', e.id), sanitizeObject(tombstone));
                    }
                });

                const nowStr = new Date().toISOString();
                changedEntries.forEach(entry => {
                    const id = entry.id || `hentry-${Date.now()}-${Math.random()}`;
                    
                    // If syncing to the cloud, make sure syncedAt is set
                    const currentUserName = currentUser?.name || (currentUser as any)?.displayName || currentUser?.email || 'Giorgi Nishnianidze';
                    const updatedEntry = {
                        ...entry,
                        id,
                        organizationId: activeOrgId,
                        scannedByUserName: (entry as any).scannedByUserName || (entry as any).createdBy || (entry as any).scannedBy || currentUserName,
                        syncedAt: entry.syncedAt || nowStr,
                        updatedAt: nowStr
                    };
                    
                    trackModification(`harvestEntries/${id}`, 'set', updatedEntry);
                    batch.set(doc(db, 'harvestEntries', id), sanitizeObject(updatedEntry));
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'harvestEntries');
            }
        } else {
            setHarvestEntries(prev => {
                const newEntries = [...prev];
                const itemsToSave: HarvestEntry[] = [];
                entries.forEach(entry => {
                    const id = entry.id || `hentry-${Date.now()}-${Math.random()}`;
                    const newEntry = { ...entry, id, organizationId: activeOrgId || 'personal' };
                    const idx = newEntries.findIndex(e => e.id === entry.id);
                    if (idx >= 0) newEntries[idx] = newEntry;
                    else newEntries.push(newEntry);
                    itemsToSave.push(newEntry);
                });
                saveMockData('harvestEntries', itemsToSave);
                return newEntries;
            });
        }
    };

    const handleSetHarvestLogs = async (input: HarvestLog[] | ((prev: HarvestLog[]) => HarvestLog[])) => {
        if (!activeOrgId) return;
        
        let logs: HarvestLog[];
        if (typeof input === 'function') {
            logs = input(harvestLogs);
        } else {
            logs = input;
        }

        // Sync Stock
        const incomingIds = logs.map(l => l.id).filter(Boolean);
        const oldMatch = harvestLogs.filter(l => incomingIds.includes(l.id));
        updateInventoryFromUsage(oldMatch, logs, 'HARVEST');

        const fullLogs = logs.map(l => ({
            ...l,
            id: l.id || `hlog-${Date.now()}-${Math.random()}`,
            organizationId: activeOrgId || 'personal'
        }));

        setHarvestLogs(fullLogs);

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                fullLogs.forEach(log => {
                    trackModification(`harvestLogs/${log.id}`, 'set', log);
                    batch.set(doc(db, 'harvestLogs', log.id), sanitizeObject(log));
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'harvestLogs');
            }
        } else {
            saveMockData('harvestLogs', fullLogs);
        }
    };

    const handleSetPallets = async (pallets: Pallet[]) => {
        if (!activeOrgId || !Array.isArray(pallets)) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                const batch = writeBatch(db);
                pallets.forEach(p => {
                    const id = p.id || `pal-${Date.now()}-${Math.random()}`;
                    const data = { ...p, id, organizationId: activeOrgId };
                    trackModification(`pallets/${id}`, 'set', data);
                    batch.set(doc(db, 'pallets', id), data);
                });
                await batch.commit();
            } catch (error) {
                handleFirestoreError(error, 'write', 'pallets');
            }
        } else {
            setPallets(prev => {
                const newPallets = [...prev];
                pallets.forEach(pallet => {
                    const idx = newPallets.findIndex(p => p.id === pallet.id);
                    if (idx >= 0) newPallets[idx] = pallet;
                    else newPallets.push({ ...pallet, id: pallet.id || `pal-${Date.now()}-${Math.random()}` });
                });
                return newPallets;
            });
        }
    };

    const handleAddNote = async (
        content: string, 
        location?: { lat: number; lng: number }, 
        featureId?: string,
        moduleName?: string,
        tags?: string[],
        isVoiceNote?: boolean,
        language?: string
    ) => {
        if (!activeOrgId) return;
        const id = `note-${Date.now()}`;
        const formattedModuleName = moduleName || (appMode ? appMode.charAt(0).toUpperCase() + appMode.slice(1) : 'General');
        const newNote: Note = {
            id,
            content,
            timestamp: new Date().toISOString(),
            organizationId: activeOrgId,
            authorId: currentUser?.id || 'anon',
            authorName: currentUser?.name || 'Anon',
            location,
            featureId,
            moduleName: formattedModuleName,
            tags: tags || [],
            isVoiceNote: !!isVoiceNote,
            language: language || (localStorage.getItem('agri-app-lang') === 'ka' ? 'ka-GE' : 'en-US'),
            status: 'active'
        };

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                trackModification(`notes/${id}`, 'add', newNote);
                await setDoc(doc(db, 'notes', id), sanitizeObject(newNote));
                toast.success("Voice note added");
            } catch (error) {
                handleFirestoreError(error, 'write', 'notes');
            }
        } else {
            setNotes(prev => [...prev, newNote]);
            toast.success("Voice note added (Local)");
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!noteId) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                trackModification(`notes/${noteId}`, 'delete', null);
                await deleteDoc(doc(db, 'notes', noteId));
                toast.success("Note deleted");
            } catch (error) {
                handleFirestoreError(error, 'delete', 'notes');
            }
        } else {
            setNotes(prev => prev.filter(n => n.id !== noteId));
            toast.success("Note deleted");
        }
    };

    const handleDeleteMultipleNotes = async (noteIds: string[]) => {
        if (!noteIds || noteIds.length === 0) return;
        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                await Promise.all(noteIds.map(id => {
                    trackModification(`notes/${id}`, 'delete', null);
                    return deleteDoc(doc(db, 'notes', id));
                }));
                toast.success(`${noteIds.length} notes deleted`);
            } catch (error) {
                handleFirestoreError(error, 'delete', 'notes');
            }
        } else {
            const idSet = new Set(noteIds);
            setNotes(prev => prev.filter(n => !idSet.has(n.id)));
            toast.success(`${noteIds.length} notes deleted`);
        }
    };

    useEffect(() => {
        const handleVoiceNoteDeleteEvent = (e: any) => {
            if (e.detail?.ids && Array.isArray(e.detail.ids)) {
                handleDeleteMultipleNotes(e.detail.ids);
            } else if (e.detail?.id) {
                handleDeleteNote(e.detail.id);
            }
        };
        window.addEventListener('agrimap_delete_note', handleVoiceNoteDeleteEvent);
        return () => window.removeEventListener('agrimap_delete_note', handleVoiceNoteDeleteEvent);
    }, [handleDeleteNote, handleDeleteMultipleNotes]);

    // Handle Map & Context Menu events: Work assignments, Planner tasks, Field notes, and Feature deletions
    useEffect(() => {
        const handleAddWorkAssignmentEvent = async (e: any) => {
            const data = e.detail;
            if (!data) return;
            const id = data.id || `work-${Date.now()}`;
            const assignmentPriority = data.priority || 'medium';
            const assignmentColor = data.color || (assignmentPriority === 'urgent' ? '#dc2626' : assignmentPriority === 'high' ? '#ef4444' : '#f59e0b');
            const newAssignment: WorkAssignment = {
                id,
                workName: data.workName || data.name || 'Work Assignment',
                taskType: data.taskType || 'Other',
                date: data.date || new Date().toISOString().split('T')[0],
                assignedEmployeeIds: data.assignedEmployeeIds || [],
                employeeHours: [],
                plannedHours: data.plannedHours || 8,
                complexity: data.complexity || 'solo',
                status: data.status || 'planned',
                priority: assignmentPriority,
                color: assignmentColor,
                notes: data.notes || '',
                organizationId: activeOrgId || undefined,
                linkedFeatureId: data.linkedFeatureId,
                sectorIds: data.sectorIds || (data.linkedFeatureId ? [data.linkedFeatureId] : []),
                createdAt: new Date().toISOString()
            };

            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                try {
                    await setDoc(doc(db, 'workAssignments', id), sanitizeObject(newAssignment));
                } catch (err) {
                    console.warn("Could not save work assignment to Firestore:", err);
                }
            }
            setWorkAssignments(prev => [newAssignment, ...(prev || []).filter(w => w.id !== id)]);
            saveMockData('workAssignments', [newAssignment]);

            if (data.createMapMarker !== false && data.coordinates && !data.linkedFeatureId) {
                handleFeatureDrawn(
                    'checkpoint',
                    [data.coordinates.lat, data.coordinates.lng],
                    undefined,
                    {
                        id: `work-marker-${id}`,
                        name: newAssignment.workName,
                        monitoringType: 'work',
                        taskType: newAssignment.taskType,
                        source: 'tasks',
                        status: newAssignment.status,
                        priority: assignmentPriority,
                        color: assignmentColor,
                        customColor: assignmentColor,
                        notes: newAssignment.notes,
                        organizationId: activeOrgId || 'personal',
                        linkedFeatureId: id
                    }
                );
            }
        };

        const handleAddTaskEvent = async (e: any) => {
            const data = e.detail;
            if (!data) return;
            const id = data.id || `task-${Date.now()}`;
            const taskPriority = data.priority || 'medium';
            const taskColor = data.color || (taskPriority === 'urgent' ? '#dc2626' : taskPriority === 'high' ? '#ef4444' : '#f59e0b');
            const newTask: WorkAssignment = {
                id,
                workName: data.title || data.workName || 'Planner Task',
                taskType: data.taskType || 'Other',
                date: data.dueDate || data.date || new Date().toISOString().split('T')[0],
                assignedEmployeeIds: data.assignedEmployeeId ? [data.assignedEmployeeId] : (data.assignedEmployeeIds || []),
                employeeHours: [],
                plannedHours: 4,
                complexity: 'solo',
                status: 'planned',
                priority: taskPriority,
                color: taskColor,
                notes: data.notes || '',
                organizationId: activeOrgId || undefined,
                linkedFeatureId: data.linkedFeatureId,
                sectorIds: data.sectorIds || (data.linkedFeatureId ? [data.linkedFeatureId] : []),
                createdAt: new Date().toISOString()
            };

            if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                try {
                    await setDoc(doc(db, 'workAssignments', id), sanitizeObject(newTask));
                } catch (err) {
                    console.warn("Could not save task to Firestore:", err);
                }
            }
            setWorkAssignments(prev => [newTask, ...(prev || []).filter(w => w.id !== id)]);
            saveMockData('workAssignments', [newTask]);

            if (data.createMapMarker !== false && data.coordinates && !data.linkedFeatureId) {
                handleFeatureDrawn(
                    'checkpoint',
                    [data.coordinates.lat, data.coordinates.lng],
                    undefined,
                    {
                        id: `task-marker-${id}`,
                        name: newTask.workName,
                        monitoringType: 'task',
                        source: 'planner',
                        status: newTask.status,
                        priority: taskPriority,
                        color: taskColor,
                        customColor: taskColor,
                        notes: newTask.notes,
                        organizationId: activeOrgId || 'personal',
                        linkedFeatureId: id
                    }
                );
            }
        };

        const handleAddNoteEvent = async (e: any) => {
            const data = e.detail;
            if (!data) return;
            const noteContent = data.content || data.notes || data.title || '';
            const notePriority = data.priority || 'medium';
            const noteColor = data.color || '#10b981';
            if (handleAddNote) {
                await handleAddNote(
                    noteContent,
                    data.coordinates,
                    data.linkedFeatureId,
                    'Planner & Notes',
                    data.category ? [data.category] : ['Field Note']
                );
            }

            if (data.createMapMarker !== false && data.coordinates && !data.linkedFeatureId) {
                handleFeatureDrawn(
                    'note',
                    [data.coordinates.lat, data.coordinates.lng],
                    undefined,
                    {
                        id: `note-marker-${Date.now()}`,
                        name: data.title || 'Field Note',
                        monitoringType: 'note',
                        source: 'planner',
                        status: 'pending',
                        priority: notePriority,
                        color: noteColor,
                        customColor: noteColor,
                        notes: noteContent,
                        organizationId: activeOrgId || 'personal'
                    }
                );
            }
        };

        const handleDeleteFeaturesEvent = (e: any) => {
            const ids = e.detail?.ids;
            if (Array.isArray(ids) && ids.length > 0) {
                handleDeleteItems(ids);
            }
        };

        window.addEventListener('agrimap_add_work_assignment', handleAddWorkAssignmentEvent);
        window.addEventListener('agrimap_add_map_work', handleAddWorkAssignmentEvent);
        window.addEventListener('agrimap_add_task', handleAddTaskEvent);
        window.addEventListener('agrimap_add_map_task', handleAddTaskEvent);
        window.addEventListener('agrimap_add_note', handleAddNoteEvent);
        window.addEventListener('agrimap_add_map_note', handleAddNoteEvent);
        window.addEventListener('agrimap_delete_features', handleDeleteFeaturesEvent);

        return () => {
            window.removeEventListener('agrimap_add_work_assignment', handleAddWorkAssignmentEvent);
            window.removeEventListener('agrimap_add_map_work', handleAddWorkAssignmentEvent);
            window.removeEventListener('agrimap_add_task', handleAddTaskEvent);
            window.removeEventListener('agrimap_add_map_task', handleAddTaskEvent);
            window.removeEventListener('agrimap_add_note', handleAddNoteEvent);
            window.removeEventListener('agrimap_add_map_note', handleAddNoteEvent);
            window.removeEventListener('agrimap_delete_features', handleDeleteFeaturesEvent);
        };
    }, [activeOrgId, currentUser, handleDeleteItems, handleAddNote]);

    const handleAddReminder = async (content: string) => {
        if (!activeOrgId) return;
        const id = `alert-${Date.now()}`;
        const newAlert: Alert = {
            id,
            title: 'Reminder',
            content,
            type: 'info',
            timestamp: new Date().toISOString()
        };

        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
            try {
                trackModification(`alerts/${id}`, 'add', newAlert);
                await setDoc(doc(db, 'alerts', id), sanitizeObject(newAlert));
                toast.success("Reminder added");
            } catch (error) {
                handleFirestoreError(error, 'write', 'alerts');
            }
        } else {
            setAlerts(prev => [...prev, newAlert]);
            toast.success("Reminder added (Local)");
        }
    };

    const handleRegister = async (user: User, orgToJoin?: Organization | null) => {
        try {
            if (USE_FIREBASE && auth.currentUser && user.id !== 'root-system') {
                const batch = writeBatch(db);
                batch.set(doc(db, 'users', user.id), sanitizeObject(user));
                
                // If they chose to join an organization during registration
                if (orgToJoin) {
                    const membershipId = `${user.id}_${orgToJoin.id}`;
                    const newMembership: Membership = {
                        id: membershipId,
                        userId: user.id,
                        organizationId: orgToJoin.id,
                        role: 'Employee',
                        permissionLevel: 'write',
                        status: 'pending',
                        joinedAt: new Date().toISOString()
                    };
                    batch.set(doc(db, 'memberships', membershipId), sanitizeObject(newMembership));

                    // Add to HR (employees collection)
                    const newEmployee: Employee = {
                        id: `emp-${user.id}-${orgToJoin.id}`,
                        name: user.name,
                        email: user.email,
                        phone: user.phone || '',
                        idNumber: user.personalNumber || '',
                        roleId: 'Employee', // Default role
                        paymentType: 'hourly',
                        paymentRate: 0,
                        barcode: `BC-${Date.now()}`,
                        employeeType: 'Temporary',
                        accountType: 'Bank Account',
                        status: 'active',
                        joinedAt: new Date().toISOString(),
                        organizationId: orgToJoin.id
                    };
                    batch.set(doc(db, 'employees', newEmployee.id), newEmployee);

                    // Add an Alert for the organization owner
                    const alertId = `alert-join-${Date.now()}`;
                    batch.set(doc(db, 'alerts', alertId), {
                        id: alertId,
                        organizationId: orgToJoin.id,
                        title: 'New Join Request',
                        content: `${user.name} has registered and requested to join ${orgToJoin.name}.`,
                        type: 'info',
                        timestamp: new Date().toISOString(),
                        isRead: false,
                        metadata: { membershipId: membershipId, userId: user.id },
                        actions: [
                            { label: 'Approve', actionType: 'approve_join', actionData: { membershipId, userId: user.id } }
                        ]
                    });
                }

                // If a Founder/Admin is registering someone manually, link them to the active organization
                if (currentUser && (currentUser.roles?.includes('Founder') || currentUser.roles?.includes('Admin')) && activeOrgId && !orgToJoin) {
                    const membershipId = `${user.id}_${activeOrgId}`;
                    const newMembership: Membership = {
                        id: membershipId,
                        userId: user.id,
                        organizationId: activeOrgId,
                        role: user.roles?.[0] || 'Employee',
                        permissionLevel: user.roles?.[0] === 'Admin' ? 'admin' : 'write',
                        status: 'active',
                        joinedAt: new Date().toISOString()
                    };
                    batch.set(doc(db, 'memberships', membershipId), sanitizeObject(newMembership));
                }

                await batch.commit();
            } else {
                console.log("Mock registration or root-system: saving user doc locally", user);
                if (user.id === 'root-system') {
                    localStorage.setItem('agri-planter-session', JSON.stringify(user));
                }

                // If they chose to join an organization during registration
                if (orgToJoin) {
                    const membershipId = `${user.id}_${orgToJoin.id}`;
                    const newMembership: Membership = {
                        id: membershipId,
                        userId: user.id,
                        organizationId: orgToJoin.id,
                        role: 'Employee',
                        permissionLevel: 'write',
                        status: 'pending',
                        joinedAt: new Date().toISOString()
                    };

                    const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                    const filteredMems = savedMemberships.filter((m: any) => m.id !== membershipId);
                    const updatedMemberships = [...filteredMems, newMembership];
                    localStorage.setItem('mock_memberships', JSON.stringify(updatedMemberships));
                    setMemberships(updatedMemberships);

                    // Add to HR (employees collection)
                    const newEmployee: Employee = {
                        id: `emp-${user.id}-${orgToJoin.id}`,
                        name: user.name,
                        email: user.email,
                        phone: user.phone || '',
                        idNumber: user.personalNumber || '',
                        roleId: 'Employee',
                        paymentType: 'hourly',
                        paymentRate: 0,
                        barcode: `BC-${Date.now()}`,
                        employeeType: 'Temporary',
                        accountType: 'Bank Account',
                        status: 'active',
                        joinedAt: new Date().toISOString(),
                        organizationId: orgToJoin.id
                    };
                    const savedEmployees = safeStorage.safeParse(localStorage.getItem('mock_employees'), []);
                    const updatedEmployees = [...savedEmployees.filter((e: any) => e.id !== newEmployee.id), newEmployee];
                    localStorage.setItem('mock_employees', JSON.stringify(updatedEmployees));
                    if (setEmployees) {
                        setEmployees(updatedEmployees);
                    }

                    // Add an Alert for the organization owner
                    const alertId = `alert-join-${Date.now()}`;
                    const newAlert = {
                        id: alertId,
                        organizationId: orgToJoin.id,
                        title: 'New Join Request',
                        content: `${user.name} has registered and requested to join ${orgToJoin.name}.`,
                        type: 'info',
                        timestamp: new Date().toISOString(),
                        isRead: false,
                        createdBy: user.id,
                        metadata: { membershipId: membershipId, userId: user.id },
                        actions: [
                            { label: 'Approve', actionType: 'approve_join', actionData: { membershipId, userId: user.id } }
                        ]
                    };
                    const savedAlerts = safeStorage.safeParse(localStorage.getItem('mock_alerts'), []);
                    const updatedAlerts = [newAlert, ...savedAlerts.filter((a: any) => a.id !== alertId)];
                    localStorage.setItem('mock_alerts', JSON.stringify(updatedAlerts));
                    setAlerts(updatedAlerts);

                    // Add a ForumPost in organization general team chat
                    const newPost = {
                        id: `join-req-post-${Date.now()}`,
                        title: "Join Request",
                        content: `Hello, I'm ${user.name}. I've registered and sent a handshake request to join ${orgToJoin.name} as a professional partner.`,
                        authorId: user.id,
                        authorName: user.name,
                        timestamp: new Date().toISOString(),
                        hubType: 'internal' as any,
                        channelId: 'general',
                        isDirectMessage: false,
                        organizationId: orgToJoin.id,
                        replies: []
                    };
                    const savedPosts = safeStorage.safeParse(localStorage.getItem('mock_forumPosts'), []);
                    const updatedPosts = [newPost, ...savedPosts.filter((p: any) => p.id !== newPost.id)];
                    localStorage.setItem('mock_forumPosts', JSON.stringify(updatedPosts));
                    setForumPosts(updatedPosts);
                }

                if (currentUser && (currentUser.roles?.includes('Founder') || currentUser.roles?.includes('Admin')) && activeOrgId && !orgToJoin) {
                    const membershipId = `${user.id}_${activeOrgId}`;
                    const newMembership: Membership = {
                        id: membershipId,
                        userId: user.id,
                        organizationId: activeOrgId,
                        role: user.roles?.[0] || 'Employee',
                        permissionLevel: user.roles?.[0] === 'Admin' ? 'admin' : 'write',
                        status: 'active',
                        joinedAt: new Date().toISOString()
                    };
                    const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                    const filteredMems = savedMemberships.filter((m: any) => m.id !== membershipId);
                    const updatedMemberships = [...filteredMems, newMembership];
                    localStorage.setItem('mock_memberships', JSON.stringify(updatedMemberships));
                    setMemberships(updatedMemberships);
                }
            }

            setIsRegisterModalOpen(false);
            
            if (!currentUser || currentUser.id === 'guest' || currentUser.id === user.id) {
                setCurrentUser(user);
            }
        } catch (error) {
            handleFirestoreError(error, 'write', `users/${user.id}`);
        }
    };

    const handleUpdateOrg = async (updatedOrg: Organization) => {
        setOrganizations(prev => prev.map(o => o.id === updatedOrg.id ? updatedOrg : o));
        if (USE_FIREBASE) {
            try {
                const orgRef = doc(db, 'organizations', updatedOrg.id);
                const sanitizedOrg = sanitizeOrganizationForFirestore(updatedOrg);
                await setDoc(orgRef, sanitizedOrg, { merge: true });
            } catch (err) {
                console.error("Error updating organization in Firestore:", err);
            }
        } else {
            localStorage.setItem('agri-planter-organizations', JSON.stringify(organizations.map(o => o.id === updatedOrg.id ? updatedOrg : o)));
        }
    };

    const handlePostRegChoice = async (choice: 'hr' | 'add_new' | 'profile') => {
        if (!currentUser) return;
        
        setShowPostRegChoice(false);

        if (choice === 'hr') {
            setAppMode('tools'); // HR is the default tab in Tools
            setAutoOpenHRModal(false);
        } else if (choice === 'add_new') {
            setAppMode('tools');
            setAutoOpenHRModal(true);
        } else {
            setAppMode('profile');
            setAutoOpenHRModal(false);
        }
    };

    useEffect(() => {
        if (currentUser && currentUser.id !== 'guest' && !currentUser.isGuest) {
            const hasRole = currentUser.roles && currentUser.roles.length > 0;
            // Force newly registered users without a role to Profile
            if (!hasRole && appMode !== 'profile' && appMode !== 'onboarding' && appMode !== 'dashboard' && appMode !== 'design') {
                setAppMode('profile');
            }
        }
    }, [currentUser, appMode]);

    // --- Status Ticker (Real-time Online Status) ---
    useEffect(() => {
        if (!currentUser || !USE_FIREBASE || currentUser.id === 'root-system' || currentUser.isGuest) return;
        
        let consecutiveErrors = 0;
        let interval: any = null;

        const updateStatus = async () => {
            // Explicit authorization check
            if (!auth.currentUser || auth.currentUser.uid !== currentUser.id) {
                console.warn("[Status Ticker] Explicit authorization check failed. Skipping update.");
                return;
            }

            // Strict offline pre-flight check
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                console.info("[Status Ticker] Device is offline. Bypassing cloud write and using local cache priority mode.");
                try {
                    const localProfiles = JSON.parse(localStorage.getItem('agrimap-user-profiles-cache') || '{}');
                    if (currentUser?.id) {
                        localProfiles[currentUser.id] = {
                            ...(localProfiles[currentUser.id] || {}),
                            id: currentUser.id,
                            email: currentUser.email,
                            name: currentUser.name,
                            lastActive: new Date().toISOString()
                        };
                        localStorage.setItem('agrimap-user-profiles-cache', JSON.stringify(localProfiles));
                    }
                } catch (e) {
                    // Suppress local cache write errors
                }
                return;
            }

            await executeDecoupledPresenceUpdate(async () => {
                try {
                    await updateDoc(doc(db, 'users', currentUser.id), {
                        lastActive: new Date().toISOString()
                    });
                    consecutiveErrors = 0;
                } catch (err: any) {
                    consecutiveErrors++;
                    const errMsg = String(err?.message || err).toLowerCase();
                    if (errMsg.includes('permission-denied') || errMsg.includes('insufficient permissions')) {
                        console.warn("[Status Ticker] Permission-denied or Insufficient permissions detected. Preventing continuous cache cycling.");
                        // Stop further updates if we hit too many permission errors (erratic network / session expired / unauthorized state)
                        if (consecutiveErrors >= 3 && interval) {
                            clearInterval(interval);
                            console.warn("[Status Ticker] Pausing status ticker to prevent cyclic updates due to persistent permission errors.");
                        }
                    }
                    throw err; // Re-throw so that executeDecoupledPresenceUpdate can absorb and handle it
                }
            });
        };

        interval = setInterval(updateStatus, 120000); // Pulse every 2 mins
        updateStatus();
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentUser?.id, currentUser?.isGuest]);

    const notificationsCount = useMemo(() => {
        const unreadAlerts = alerts.filter(a => !a.isRead).length;
        const unreadDMs = forumPosts.filter(p => 
            p.isDirectMessage && 
            p.recipientId === currentUser?.id && 
            !p.isRead &&
            !(p.readBy || []).includes(currentUser?.id || '')
        ).length;
        
        // Count mentions in public forum
        const unreadMentions = forumPosts.filter(p => 
            !p.isDirectMessage && 
            p.content.includes(`@${currentUser?.name}`) && 
            !(p.readBy || []).includes(currentUser?.id || '')
        ).length;

        return unreadAlerts + unreadDMs + unreadMentions;
    }, [alerts, forumPosts, currentUser]);

    const handlePushOfflineData = async () => {
        if (!USE_FIREBASE || isManualOffline || !currentUser || currentUser.id === 'root-system') return;
        
        const collectionsToSync = [
            'plantationFeatures', 'layers', 'workAssignments', 'employees', 
            'inventoryItems', 'harvestEvents', 'harvestEntries', 'forumPosts', 
            'alerts', 'organizations', 'memberships'
        ];
        
        toast.promise(
            (async () => {
                for (const coll of collectionsToSync) {
                    const localData = localStorage.getItem(`agri-planter-${coll}`);
                    if (localData) {
                        const items = JSON.parse(localData);
                        if (Array.isArray(items)) {
                            const batch = writeBatch(db);
                            items.forEach(item => {
                                if (item.id) {
                                    batch.set(doc(db, coll, item.id), sanitizeObject(item));
                                }
                            });
                            await batch.commit();
                        }
                    }
                }
                logActivity("Manual Data Sync", 'system', 'success', "Offline data pushed to cloud.");
            })(),
            {
                loading: 'Synchronizing with cloud ledger...',
                success: 'Data synchronization complete',
                error: 'Synchronization failed. Check connection.'
            }
        );
    };

    const renderContent = () => {
        if (!isAuthReady) {
            const savedLocalConfig = localStorage.getItem('agrimap-local-config');
            let isLocal = false;
            try {
                if (savedLocalConfig) isLocal = JSON.parse(savedLocalConfig).isLocalMode;
            } catch (e) {}

            return (
                <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-screen">
                    <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
                        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Initializing Secure Session...</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Verifying identity and established encrypted channel.
                            </p>
                        </div>
                        
                        {isLocal && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 3 }}
                                className="mt-8 p-6 bg-white rounded-3xl border-2 border-slate-100 shadow-sm"
                            >
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Taking too long? Local Node might be unreachable.</p>
                                <button 
                                    onClick={() => {
                                        localStorage.setItem('agrimap-local-config', JSON.stringify({ isLocalMode: false, serverIp: '127.0.0.1', autoDiscovery: true }));
                                        window.location.reload();
                                    }}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                                >
                                    Force Switch to Cloud Mode
                                </button>
                            </motion.div>
                        )}
                    </div>
                </div>
            );
        }

        const access = checkModuleAccess(currentUser, appMode, activeOrg, memberships);
        
        // Bypass access check for registration on map
        const isBypass = isRegisteringOnMap && appMode === 'design';
        
        if (access === 'none' && !isBypass) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-10 text-center">
                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <LockClosedIcon className="h-10 w-10 text-slate-400" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Module <span className="text-indigo-600">Restricted</span></h2>
                    <p className="mt-2 text-slate-500 max-w-md font-medium uppercase text-[10px] tracking-widest leading-relaxed">
                        This section requires a verified account or active organization membership. {(currentUser?.roles?.length || 0) === 0 ? "Please complete your profile to continue." : "Manage your organizations in the Founders Vault."}
                    </p>
                    <div className="flex gap-4 mt-8">
                        {(currentUser?.roles?.length || 0) === 0 ? (
                            <button onClick={() => setAppMode('profile')} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Setup Profile</button>
                        ) : (
                            <button onClick={() => setIsRegisterModalOpen(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Register Company</button>
                        )}
                        <button onClick={() => setAppMode('dashboard')} className="px-8 py-3 bg-white text-indigo-600 border border-indigo-100 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">Return to Dashboard</button>
                    </div>
                </div>
            );
        }

        const mapProps: MapComponentProps = {
            center: mapCenter,
            zoom: mapZoom,
            plantationFeatures: currentOrgFeatures,
            layers: currentOrgLayers,
            onSelectFeature: handleSelectFeature,
            selectedFeatureIds,
            highlightedFeatureIds,
            flyToBounds,
            onSetFlyToBounds: setFlyToBounds,
            onSetMapCenter: setMapCenter,
            onSetMapZoom: setMapZoom,
            activeDrawingTool,
            onSetActiveDrawingTool: setActiveDrawingTool,
            onFeatureDrawn: handleFeatureDrawn,
            onUpdateFeature: handleUpdateFeature,
            onMoveFeature: handleMoveFeature,
            onEditGeometry: setEditingGeometryId,
            editingGeometryId,
            activeOrgId,
            externalUsers: currentUser?.isGuest ? users.filter(u => u.isPubliclyVisible) : users,
            externalOrganizations: currentUser?.isGuest ? organizations.filter(o => o.isDiscoverable) : organizations,
            operationalLogs: currentOperationalLogs,
            harvestLogs: currentHarvestLogs,
            onOperationalLogClick: (log, latlng) => {
                if (latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng)) {
                    setSelectedOperationalLog(log);
                    setMapCenter([latlng.lat, latlng.lng]);
                }
            },
            onHarvestLogClick: (log, latlng) => {
                if (latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng)) {
                    setSelectedHarvestLog(log);
                    setMapCenter([latlng.lat, latlng.lng]);
                }
            },
            onExternalUserMessage: (user) => {
                const sortedIds = [currentUser?.id, user.id].sort();
                const convoId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
                setSelectedConversationId(convoId);
                setAppMode('community');
            },
            onExternalOrganizationMessage: (org) => {
                const founder = users.find(u => u.id === org.createdBy);
                if (founder) {
                    const sortedIds = [currentUser?.id, founder.id].sort();
                    const convoId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
                    setSelectedConversationId(convoId);
                }
                setAppMode('community');
            },
            onUndo: handleUndo,
            onRedo: handleRedo,
            canUndo: historyStack.length > 0,
            canRedo: redoStack.length > 0,
            liveShowcases: liveMapShowcases,
            inProgressShowcasePoints: isDrawingMapShowcase ? inProgressShowcasePoints : [],
            onShowcaseMapClick: handleShowcaseMapClick,
            onMapClick: (latlng) => {
                if (isDrawingMapShowcase) {
                    handleShowcaseMapClick([latlng.lat, latlng.lng]);
                    return;
                }
                if (appMode === 'design' && activeDrawingTool.tool === 'checkpoint') {
                    handleFeatureDrawn('checkpoint', [latlng.lat, latlng.lng]);
                }
            }
        };

        switch (appMode) {
            case 'guide': 
                return (
                    <HelpAndGuideView 
                        currentUser={currentUser}
                        onSetAppMode={setAppMode} 
                        onTriggerIdentityPopup={() => {
                            setAppMode('profile');
                            setAutoOpenProfileIdentity(true);
                        }}
                    />
                );
            case 'profile': return (
                <ProfileView 
                    currentUser={currentUser!} 
                    onUpdateUser={handleUpdateUser}
                    onSwitchRole={handleSwitchRole}
                    onDeleteAccount={handleDeleteAccount}
                    onUpdateOrg={handleUpdateOrg}
                    users={users}
                    organizations={organizations} 
                    discoverableOrganizations={discoverableOrganizations}
                    memberships={userMemberships} 
                    onAddOrg={handleAddOrg} 
                    onSetAppMode={setAppMode} 
                    onOpenHomepage={() => setShowWelcomeModal(true)}
                    allEmployees={employees} 
                    reviews={reviews} 
                    currentOrganizationContext={activeOrgId || 'personal'}
                    onSetOrganizationContext={(ctx) => setActiveOrgId(ctx === 'personal' ? null : ctx)}
                    onExportBackup={handleExportCurrentState}
                    onAddPost={handleAddPost}
                    autoOpenIdentity={autoOpenProfileIdentity}
                    onClearAutoOpenIdentity={() => setAutoOpenProfileIdentity(false)}
                    onStartMapRegistration={(regData) => {
                        setPendingOrgData(regData);
                        setAppMode('design');
                        setActiveDrawingTool({ tool: 'boundary', color: '#16a34a' });
                        setIsRegisteringOnMap(true);
                    }}
                    onSetMapCenter={setMapCenter}
                    onSetMapZoom={setMapZoom}
                    onSelectFeature={handleSelectFeature}
                    plantationFeatures={plantationFeatures}
                    layers={layers}
                    isManualOffline={isManualOffline}
                    onToggleOffline={handleToggleOffline}
                    onPushToFirestore={handlePushToFirestore}
                />
            );
            case 'admin': return isSystemAdmin ? (
                <RootAdminView 
                    isPlatformOwner={platformClaims.isOwner}
                    currentUser={currentUser} 
                    organizations={organizations}
                    users={allUsers}
                    plantationFeatures={plantationFeatures}
                    onUpdateOrganization={async (o) => {
                        setOrganizations(organizations.map(org => org.id === o.id ? o : org));
                        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                            try {
                                const sanitized = sanitizeOrganizationForFirestore(o);
                                await setDoc(doc(db, 'organizations', o.id), sanitized);
                            } catch (error) {
                                handleFirestoreError(error, 'write', `organizations/${o.id}`);
                            }
                        }
                    }}
                    onDeleteOrganization={async (id) => {
                        if (!window.confirm("Nuclear Warning: Deleting this organization will permanently destroy all associated data (features, employees, financial records, etc.). This cannot be undone. Proceed?")) return;
                        
                        setOrganizations(organizations.filter(o => o.id !== id));
                        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                            try {
                                const batch = writeBatch(db);
                                
                                // Collections that strictly use organizationId
                                const collectionsToClear = [
                                    'memberships', 'plantationFeatures', 'layers', 
                                    'inventoryItems', 'harvestEvents', 'accounts', 'transactions', 
                                    'workAssignments', 'employees', 'machinery', 'projects', 
                                    'harvestEntries', 'pallets', 'harvestLogs', 'inventoryTransactions', 
                                    'employeeGroups', 'dailyLogs', 'nutritionPlans', 'planExecutions', 
                                    'forumPosts', 'listings', 'bids', 'reviews', 'alerts', 
                                    'purchaseOrders', 'suppliers', 'operationalLogs', 'notes', 
                                    'checkpoints', 'systemLogs', 'crops'
                                ];

                                for (const coll of collectionsToClear) {
                                    const q = query(collection(db, coll), where('organizationId', '==', id));
                                    const snap = await getDocs(q);
                                    
                                    // Delete in chunks
                                    const docs = snap.docs;
                                    const BATCH_LIMIT = 450;
                                    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
                                        const batch = writeBatch(db);
                                        docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
                                        await batch.commit();
                                    }
                                }

                                // Finally delete the organization itself
                                batch.delete(doc(db, 'organizations', id));

                                await batch.commit();
                                toast.success("Organization and all associated data deleted successfully.");
                            } catch (error) {
                                handleFirestoreError(error, 'delete', `organizations/${id}`);
                            }
                        }
                    }}
                    memberships={memberships}
                    onUpdateUser={async (u) => {
                        handleUpdateUser(u);
                        // Also update global users list for Root Admin
                        setUsers(prev => prev.map(user => user.id === u.id ? u : user));
                        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                            try {
                                await setDoc(doc(db, 'users', u.id), sanitizeObject(u));
                            } catch (error) {
                                handleFirestoreError(error, 'write', `users/${u.id}`);
                            }
                        }
                    }}
                    onDeleteFeature={handleDeleteItems}
                />
            ) : (
                <AdminView 
                    users={users} 
                    onUpdateUser={async (u) => {
                        setUsers(users.map(user => user.id === u.id ? u : user));
                        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                            try {
                                await setDoc(doc(db, 'users', u.id), sanitizeObject(u));
                                logActivity("User Updated", 'admin', 'success', `Updated user ${u.name}`);
                            } catch (error) {
                                handleFirestoreError(error, 'write', `users/${u.id}`);
                            }
                        }
                    }}
                    onDeleteUser={async (id) => {
                        setUsers(users.filter(u => u.id !== id));
                        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                            try {
                                await deleteDoc(doc(db, 'users', id));
                                logActivity("User Deleted", 'admin', 'alert', `Deleted user ID: ${id}`);
                            } catch (error) {
                                handleFirestoreError(error, 'delete', `users/${id}`);
                            }
                        }
                    }}
                    organizations={organizations}
                    onUpdateOrganization={async (o) => {
                        setOrganizations(organizations.map(org => org.id === o.id ? o : org));
                        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                            try {
                                const sanitized = sanitizeOrganizationForFirestore(o);
                                await setDoc(doc(db, 'organizations', o.id), sanitized);
                                logActivity("Org Updated", 'admin', 'success', `Updated org ${o.name}`);
                            } catch (error) {
                                handleFirestoreError(error, 'write', `organizations/${o.id}`);
                            }
                        }
                    }}
                    onDeleteOrganization={async (id) => {
                        if (!window.confirm("Nuclear Warning: Deleting this organization will permanently destroy all associated data (features, employees, financial records, etc.). This cannot be undone. Proceed?")) return;
                        setOrganizations(organizations.filter(o => o.id !== id));
                        if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {
                            try {
                                const collectionsToClear = [
                                    'memberships', 'plantationFeatures', 'layers', 
                                    'inventoryItems', 'harvestEvents', 'accounts', 'transactions', 
                                    'workAssignments', 'employees', 'machinery', 'projects', 
                                    'harvestEntries', 'pallets', 'harvestLogs', 'inventoryTransactions', 
                                    'employeeGroups', 'dailyLogs', 'nutritionPlans', 'planExecutions', 
                                    'forumPosts', 'listings', 'bids', 'reviews', 'alerts', 
                                    'purchaseOrders', 'suppliers', 'operationalLogs', 'notes', 
                                    'checkpoints', 'systemLogs', 'crops'
                                ];

                                for (const coll of collectionsToClear) {
                                    const q = query(collection(db, coll), where('organizationId', '==', id));
                                    const snap = await getDocs(q);
                                    
                                    // Delete in chunks
                                    const docs = snap.docs;
                                    const BATCH_LIMIT = 450;
                                    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
                                        const batch = writeBatch(db);
                                        docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
                                        await batch.commit();
                                    }
                                }

                                // Finally delete the organization itself
                                await deleteDoc(doc(db, 'organizations', id));
                                logActivity("Org Deleted", 'admin', 'alert', `Deleted org ID: ${id}`);
                                toast.success("Organization and all associated data deleted from cloud.");
                            } catch (error) {
                                handleFirestoreError(error, 'delete', `organizations/${id}`);
                            }
                        }
                    }}
                    memberships={memberships}
                    onResetPassword={handleResetPassword}
                />
            );
            case 'ai': return (
                <AiAnalystView 
                    onSearch={handleMarketAnalysis} 
                    loading={isAiLoading} 
                    error={aiError} 
                    analysisResult={marketAnalysisResult} 
                    sources={sources} 
                    onSoilSearch={handleSoilAnalysis} 
                    isSoilLoading={isAiLoading} 
                    soilError={aiError} 
                    soilAnalysisResult={soilAnalysisResult} 
                    initialTab={aiTab}
                    onTabChange={setAiTab}
                    mapProps={{
                        center: mapCenter, 
                        zoom: mapZoom, 
                        plantationFeatures: currentOrgFeatures, 
                        layers: currentOrgLayers, 
                        onSelectFeature: handleSelectFeature,
                        onSetActiveDrawingTool: setActiveDrawingTool,
                        onUpdateFeature: handleUpdateFeature,
                        onEditGeometry: setEditingGeometryId,
                        editingGeometryId,
                        flyToBounds: flyToBounds,
                        onSetMapCenter: setMapCenter,
                        onSetFlyToBounds: setFlyToBounds
                    }} 
                    isMapFullScreen={false} 
                    onSetIsMapFullScreen={() => {}} 
                    onSetNutritionPlans={setNutritionPlans}
                    allUsers={users}
                    organizations={organizations}
                    crops={crops}
                    forwardedPartnerData={forwardedPartnerData}
                    activeOrgId={activeOrgId}
                    currentUser={currentUser}
                    onAddTask={handleAddTask}
                />
            );
            case 'marketplace': return <MarketplaceView currentUser={currentUser} listings={listings || []} bids={bids || []} reviews={reviews || []} onSetReviews={setReviews} onSaveListing={handleSaveListing} onAddBid={handleAddBid} mapProps={mapProps} onSetRoute={() => {}} onSetFlyToBounds={setFlyToBounds} />;
            case 'harvesting': 
                if (!activeOrgId && !isSystemAdmin) return <EnterpriseLock onSwitchToFounders={() => setAppMode('founders')} />;
                return <HarvestingView 
                    currentUser={currentUser} 
                    harvestEvents={activeHarvestEvents} 
                    onSetHarvestEvents={handleSetHarvestEvents} 
                    harvestEntries={harvestEntries || []} 
                    onSetHarvestEntries={handleSetHarvestEntries} 
                    pallets={pallets || []} 
                    onSetPallets={handleSetPallets} 
                    plantationFeatures={currentOrgFeatures} 
                    inventoryItems={inventoryItems || []} 
                    onSetInventoryItems={handleSetInventoryItems} 
                    employees={employees || []} 
                    onSetEmployees={handleSetEmployees} 
                    roles={roles || []} 
                    harvestLogs={harvestLogs || []} 
                    onSetHarvestLogs={handleSetHarvestLogs} 
                    accounts={accounts || []} 
                    onSetAccounts={handleSetAccounts} 
                    transactions={transactions || []} 
                    onSetTransactions={handleSetTransactions} 
                    stockTransactions={stockTransactions || []}
                    onSetStockTransactions={handleSetStockTransactions}
                    layers={currentOrgLayers} 
                    mapProps={mapProps} 
                    machinery={machinery || []} 
                    crops={crops} 
                    cropVarieties={cropVarieties}
                    hardwareDevices={hardwareDevices.filter(d => d.organizationId === activeOrgId)}
                    isManualOffline={isManualOffline}
                    onToggleOffline={handleToggleOffline}
                    onSetAppMode={setAppMode}
                    employeeGroups={employeeGroups || []}
                    onLogActivity={logActivity}
                />;
            case 'accounting': 
                if (!activeOrgId && !isSystemAdmin) return <EnterpriseLock onSwitchToFounders={() => setAppMode('founders')} />;
                return <AccountingView harvestEvents={activeHarvestEvents} onSetHarvestEvents={handleSetHarvestEvents} workAssignments={workAssignments || []} onSetWorkAssignments={handleSetWorkAssignments} payrollRuns={[]} onSetPayrollRuns={() => {}} accounts={accounts || []} onSetAccounts={handleSetAccounts} transactions={transactions || []} onSetTransactions={handleSetTransactions} employees={employees || []} harvestEntries={harvestEntries || []} purchaseOrders={[]} suppliers={[]} inventoryItems={inventoryItems || []} machinery={machinery || []} />;
            case 'system': 
                if (!activeOrgId && !isSystemAdmin) return <EnterpriseLock onSwitchToFounders={() => setAppMode('founders')} />;
                return <TasksAndWorksView 
                    systemProps={{ 
                        employees: employees || [], 
                        onSetEmployees: handleSetEmployees, 
                        workAssignments: workAssignments || [], 
                        onSetWorkAssignments: handleSetWorkAssignments, 
                        machinery: machinery || [], 
                        onSetMachinery: handleSetMachinery, 
                        plantationFeatures: currentOrgFeatures, 
                        onSetHighlightedFeatureId: () => {}, 
                        operationalLogs: operationalLogs || [], 
                        onSetOperationalLogs: handleSetOperationalLogs, 
                        roles: roles || [], 
                        onSetRoles: handleSetRoles, 
                        dailyLogs: dailyLogs || [], 
                        onSetDailyLogs: handleSetDailyLogs, 
                        currentUserPermissions: currentUserPermissions, 
                        nutritionPlans: nutritionPlans, 
                        inventoryItems: inventoryItems || [], 
                        onSetInventoryItems: handleSetInventoryItems,
                        notes: notes || [], 
                        checkpoints: checkpoints || [] 
                    }} 
                    mapProps={mapProps} 
                    onLogOnMapRequest={(workId) => {
                        setAppMode('design');
                        setActiveDrawingTool({ tool: 'area', color: '#f97316', activeLayerId: 'operational-logs' });
                        setOperationalTaskToLog(workId);
                        toast.info("Draw area on map to log work", { duration: 5000 });
                    }} 
                    onPushOfflineData={handlePushToCloud}
                    isManualOffline={isManualOffline}
                    onToggleOffline={handleToggleOffline}
                    onResetSystem={handleFullReset}
                    onExportBackup={handleExportCurrentState}
                    onImportBackup={handleImportState}
                    onOpenDataAuditor={() => setIsDataStateAuditorOpen(true)}
                    syncDelay={syncDelay}
                    onSetSyncDelay={handleSetSyncDelay}
                    currentUser={currentUser}
                    activeOrgId={activeOrgId}
                />;
            case 'tasks': 
                if (!activeOrgId && !isSystemAdmin) return <EnterpriseLock onSwitchToFounders={() => setAppMode('founders')} />;
                return <PlannerAndRemainderView 
                workAssignments={workAssignments || []} 
                onSetWorkAssignments={handleSetWorkAssignments} 
                employees={employees || []} 
                alerts={alerts || []} 
                onSetAlerts={handleSetAlerts} 
                onUpdateFeature={handleUpdateFeature}
                onSelectFeature={handleSelectFeature} 
                onDeleteFeature={handleDeleteItems}
                activeDrawingTool={activeDrawingTool}
                onSetActiveDrawingTool={setActiveDrawingTool}
                onFeatureDrawn={handleFeatureDrawn}
                mapProps={mapProps} 
                onSetAppMode={setAppMode} 
                checkpoints={checkpoints || []}
                notes={notes || []}
                currentUser={currentUser}
            />;
            case 'community': return (
                <CommunicationHubPanel 
                    currentUser={currentUser}
                    forumPosts={forumPosts || []} 
                    onAddPost={handleAddPost} 
                    onAddReply={handleAddReply} 
                    plantationFeatures={currentOrgFeatures}
                    onSetFlyToBounds={setFlyToBounds}
                    onSetAppMode={setAppMode}
                    employees={employees || []}
                    mapProps={mapProps}
                    allUsers={users} 
                    organizations={discoverableOrganizations}
                    crops={crops}
                    initialConversationId={selectedConversationId}
                    onClearInitialConversation={() => setSelectedConversationId(null)}
                    onForwardToAnalyst={(data) => {
                        setForwardedPartnerData(data);
                        setAppMode('ai');
                    }}
                    isManualOffline={isManualOffline}
                    alerts={alerts}
                    setAlerts={setAlerts}
                    onSetAiTab={setAiTab}
                    onMarkPostAsRead={handleMarkPostAsRead}
                />
            );
            case 'stock': 
                if (!activeOrgId && !isSystemAdmin) return <EnterpriseLock onSwitchToFounders={() => setAppMode('founders')} />;
                return <StockView currentUser={currentUser} inventoryItems={inventoryItems || []} onSetInventoryItems={handleSetInventoryItems} inventoryTransactions={inventoryTransactions || []} onSetInventoryTransactions={handleSetInventoryTransactions} suppliers={suppliers || []} onSetSuppliers={handleSetSuppliers} purchaseOrders={purchaseOrders || []} onSetPurchaseOrders={handleSetPurchaseOrders} currentUserPermissions={currentUserPermissions} stockTransactions={stockTransactions || []} onSetStockTransactions={handleSetStockTransactions} harvestedProduce={harvestedProduce || []} accounts={accounts || []} onSetAccounts={handleSetAccounts} transactions={transactions || []} onSetTransactions={handleSetTransactions} harvestEvents={activeHarvestEvents} onSetHarvestEvents={handleSetHarvestEvents} plantationFeatures={plantationFeatures || []} employees={employees || []} onSetEmployees={handleSetEmployees} roles={roles || []} employeeGroups={employeeGroups || []} machinery={machinery || []} onSetMachinery={handleSetMachinery} harvestEntries={harvestEntries || []} crops={crops} cropVarieties={cropVarieties} />;
            case 'tools': return (
                <ToolsView 
                    roles={roles || []} 
                    onSetRoles={handleSetRoles} 
                    employees={employees || []} 
                    onSetEmployees={handleSetEmployees} 
                    currentUserPermissions={currentUserPermissions} 
                    employeeGroups={employeeGroups || []} 
                    onSetEmployeeGroups={handleSetEmployeeGroups} 
                    users={users} 
                    onSetUsers={handleSetUsers} 
                    activeOrgId={activeOrgId}
                    memberships={memberships}
                    onSetMemberships={handleSetMemberships}
                    isRoot={isRoot}
                    organizations={organizations}
                    onSetOrganizations={handleSetOrganizations}
                    onDeleteOrganization={handleDeleteOrganization}
                    onExportBackup={handleExportCurrentState} 
                    onImportBackup={handleImportState} 
                    onClearMap={handleClearAllFeatures}
                    onResetSystem={handleResetSystem}
                    // AI Tools
                    uploadedDocuments={uploadedDocuments}
                    onSetUploadedDocuments={setUploadedDocuments}
                    onDocumentAnalysis={handleCompareDocuments}
                    isDocAnalysisLoading={isAiLoading}
                    docAnalysisError={aiError}
                    documentAnalysisResult={documentAnalysisResult}
                    uploadedPlantImage={uploadedPlantImage}
                    onSetUploadedPlantImage={setUploadedPlantImage}
                    onPlantDiseaseAnalysis={handlePlantDiseaseAnalysis}
                    isDiseaseAnalysisLoading={isAiLoading}
                    diseaseAnalysisError={aiError}
                    plantDiseaseAnalysis={plantDiseaseAnalysis}
                    uploadedAgriImage={uploadedAgriImage}
                    onSetUploadedAgriImage={setUploadedAgriImage}
                    onAgriImageAnalysis={handleAgriImageAnalysis}
                    isAgriImageAnalysisLoading={isAiLoading}
                    agriImageAnalysisError={aiError}
                    agriImageAnalysis={agriImageAnalysis}
                    // Team Hub
                    currentUser={currentUser}
                    forumPosts={forumPosts || []}
                    onAddPost={handleAddPost}
                    onAddReply={handleAddReply}
                    onUpdatePost={handleUpdatePost}
                    plantationFeatures={currentOrgFeatures}
                    mapProps={mapProps}
                    allUsers={users}
                    subscriptionRequests={subscriptionRequests}
                    autoOpenHRModal={autoOpenHRModal}
                    workAssignments={workAssignments || []}
                    harvestEvents={activeHarvestEvents || []}
                    harvestEntries={harvestEntries || []}
                    dailyLogs={dailyLogs || []}
                    onSetDailyLogs={handleSetDailyLogs}
                />
            );
            case 'personalization': return <PersonalizationView onSetThemeSettings={() => {}} />;
            case 'logs': return (
                <LogsView 
                    logs={systemLogs} 
                    isManualOffline={isManualOffline}
                    onToggleOffline={handleToggleOffline}
                    onPushToCloud={handlePushToCloud}
                    onExportBackup={handleExportCurrentState}
                    onImportBackup={handleImportState}
                    onResetSystem={handleFullReset}
                    onOpenDataAuditor={() => setIsDataStateAuditorOpen(true)}
                    isSystemAdmin={isSystemAdmin}
                    onDeleteLog={handleDeleteLog}
                />
            );
            case 'founders': return <FoundersView 
                inventoryItems={inventoryItems || []} 
                onSetInventoryItems={setInventoryItems} 
                harvestEvents={activeHarvestEvents} 
                accounts={accounts || []} 
                onSetAccounts={setAccounts} 
                employees={employees || []} 
                machinery={machinery || []} 
                transactions={transactions || []} 
                onSetTransactions={setTransactions} 
                organizations={organizations}
                discoverableOrganizations={discoverableOrganizations}
                memberships={memberships}
                onAddOrg={handleAddOrg}
                onUpdateOrg={(updatedOrg) => {
                    setOrganizations(prev => prev.map(o => o.id === updatedOrg.id ? updatedOrg : o));
                    if (USE_FIREBASE && auth.currentUser) {
                        setDoc(doc(db, 'organizations', updatedOrg.id), updatedOrg, { merge: true }).catch(console.error);
                    }
                }}
                onDeleteOrganization={handleDeleteOrganization}
                onDeleteAccount={handleDeleteAccount}
                onPauseOrg={(orgId, isPaused) => {
                    const newStatus = isPaused ? 'paused' : 'active';
                    setOrganizations(prev => prev.map(o => {
                        if (o.id !== orgId) return o;
                        return { ...o, status: newStatus as any, isPaused };
                    }));
                    if (USE_FIREBASE && auth.currentUser) {
                        setDoc(doc(db, 'organizations', orgId), { status: newStatus, isPaused }, { merge: true }).catch(console.error);
                    }
                }}
                onResetPlantation={(orgId) => {
                    setPlantationFeatures(prev => prev.filter(f => f.organizationId !== orgId));
                    setHarvestEntries(prev => prev.filter(h => h.organizationId !== orgId));
                    if (USE_FIREBASE && auth.currentUser) {
                        plantationFeatures.filter(f => f.organizationId === orgId).forEach(f => {
                            deleteDoc(doc(db, 'plantationFeatures', f.id)).catch(console.error);
                        });
                    }
                    toast.success(language === 'ka' ? "პლანტაციის მონაცემები წარმატებით განულდა" : "Plantation data reset successfully");
                }}
                onUpdateMemberships={(newMems) => {
                    setMemberships(newMems);
                }}
                onSwitchOrg={handleSwitchOrg}
                onAddPost={handleAddPost}
                onStartMapRegistration={(regData) => {
                    setPendingOrgData(regData);
                    setAppMode('design');
                    setActiveDrawingTool({ tool: 'boundary', color: '#16a34a' });
                    setIsRegisteringOnMap(true);
                }}
                activeOrgId={activeOrgId}
                currentUser={currentUser!}
                allUsers={users}
                crops={crops}
            />;
            case 'onboarding':
            case 'design': return <DesignView 
                layers={currentOrgLayers} 
                plantationFeatures={currentOrgFeatures} 
                activeDrawingTool={activeDrawingTool} 
                onSetActiveDrawingTool={setActiveDrawingTool} 
                onFeatureDrawn={handleFeatureDrawn} 
                selectedFeatureIds={selectedFeatureIds} 
                onSelectFeature={handleSelectFeature} 
                onUpdateFeature={handleUpdateFeature} 
                onUpdateLayer={handleUpdateLayer} 
                onDeleteItems={handleDeleteItems} 
                mapProps={mapProps} 
                onSetFlyToBounds={setFlyToBounds} 
                onGenerateTrenches={handleGenerateTrenches} 
                onGenerateSeedlings={handleGenerateSeedlings} 
                onMoveFeature={handleMoveFeature} 
                onReparentFeature={handleReparentFeature} 
                crops={crops} 
                onAddCropVariety={handleRegisterCropVariety}
                onAddLayer={handleAddLayer} 
                onGenerateIrrigation={handleGenerateIrrigation} 
                onSendCommand={() => {}} 
                canUndo={historyStack.length > 0} 
                canRedo={redoStack.length > 0} 
                onUndo={handleUndo} 
                onRedo={handleRedo} 
                onImport={() => {}} 
                templates={[]} 
                onSetPlacingTemplate={() => {}} 
                appMode={appMode} 
                onClearMap={handleClearAllFeatures} 
                isGuest={currentUser?.isGuest} 
                onSendToBack={handleSendToBack} 
                onBringToFront={handleBringToFront} 
                isManualOffline={isManualOffline}
                onToggleOffline={handleToggleOffline}
                tempBoundaryGeometry={tempBoundaryGeometry}
                harvestLogs={harvestLogs}
                onPublishDraftFeatures={handlePublishDraftFeatures}
                onLogActivity={logActivity}
                onOpenMeet={handleOpenMeetHub}
                onOpenChat={handleOpenChatHub}
                onOpenNotes={() => window.dispatchEvent(new CustomEvent('agrimap_open_voice_notes'))}
                onOpenAssistant={() => window.dispatchEvent(new CustomEvent('agrimap_open_assistant'))}
                currentUser={currentUser}
                activeOrg={activeOrg}
                organizations={organizations}
                onUpdateOrganization={(updatedOrg) => setOrganizations(prev => prev.map(o => o.id === updatedOrg.id ? updatedOrg : o))}
                onAddOrg={handleAddOrg}
                onSwitchOrg={handleSwitchOrg}
                onUpdateUser={setCurrentUser}
                onStartMapRegistration={(regData) => {
                    setPendingOrgData(regData);
                    setActiveDrawingTool({ tool: 'boundary', color: '#16a34a' });
                    setIsRegisteringOnMap(true);
                    toast.info(language === 'ka' ? "მონიშნეთ კომპანიის მიწის ნაკვეთის საზღვარი რუკაზე" : "Draw company land boundary on the map");
                }}
            />;
            case 'agronomy': 
                if (!activeOrgId) return <EnterpriseLock onSwitchToFounders={() => setAppMode('founders')} />;
                return (
                    <AgronomyView 
                        currentUser={currentUser} 
                        nutritionPlans={nutritionPlans} 
                        onSetNutritionPlans={handleSetNutritionPlans} 
                        planExecutions={planExecutions} 
                        onSetPlanExecutions={handleSetPlanExecutions} 
                        inventoryItems={inventoryItems} 
                        plantationFeatures={currentOrgFeatures} 
                        employees={employees} 
                        onAddToDashboard={() => {}} 
                        onDeletePlanExecution={handleDeletePlanExecution} 
                        onSetInventoryItems={setInventoryItems}
                        activeOrgId={activeOrgId}
                        onAddTask={handleAddTask}
                    />
                );
            case 'labs':
                if (labTab === 'devices_map') {
                    return (
                        <main className="flex-1 relative w-full h-full overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-canvas, #090e17)', color: 'var(--text-main, #f1f5f9)' }}>
                            {/* Floating Top Labs Switcher Bar (Movable & Minimizable) */}
                            <FloatingLabsSwitcher 
                                labTab={labTab} 
                                onSelectLabTab={(tab: string) => setLabTab(tab as any)} 
                            />

                            <HardwareTestingSandboxMap 
                                plantationFeatures={currentOrgFeatures}
                                mapCenter={mapProps.center || [41.9023, 44.5]}
                                onSwitchTab={() => setLabTab('hardware')}
                            />
                        </main>
                    );
                }
                return (
                    <main className="flex-1 overflow-y-auto p-4 md:p-8 transition-colors" style={{ backgroundColor: 'var(--bg-canvas, #090e17)', color: 'var(--text-main, #f1f5f9)' }}>
                        <div className="max-w-7xl mx-auto space-y-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter">Experimental Labs</h1>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            v2.4 Labs
                                        </span>
                                    </div>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                                        Custom design themes, hardware peripheral device lists, low-level drivers, and next-generation engines.
                                    </p>
                                </div>

                                {/* Labs Tab Switcher */}
                                <div className="flex flex-wrap items-center p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner gap-1">
                                    <button
                                        onClick={() => setLabTab('devices_map')}
                                        data-active="false"
                                        className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all standing-light standing-beam cursor-pointer text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                                    >
                                        🗺️ Devices Map
                                    </button>
                                    <button
                                        onClick={() => setLabTab('hardware')}
                                        data-active={labTab === 'hardware' ? "true" : "false"}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all standing-light standing-beam cursor-pointer ${
                                            labTab === 'hardware'
                                                ? 'bg-blue-600 text-white shadow-md underglow-box-active active'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        🔌 Hardware & Devices
                                    </button>
                                    <button
                                        onClick={() => setLabTab('theme')}
                                        data-active={labTab === 'theme' ? "true" : "false"}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all standing-light standing-beam cursor-pointer ${
                                            labTab === 'theme'
                                                ? 'bg-emerald-600 text-white shadow-md underglow-box-active active'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        🎨 Theme & Colors Studio
                                    </button>
                                    <button
                                        onClick={() => setLabTab('letters')}
                                        data-active={labTab === 'letters' ? "true" : "false"}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all standing-light standing-beam flex items-center gap-1.5 cursor-pointer ${
                                            labTab === 'letters'
                                                ? 'bg-amber-500 text-slate-950 shadow-md underglow-box-active active font-black'
                                                : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                                        }`}
                                    >
                                        🔤 All Letters & Menubars Color
                                    </button>
                                    <button
                                        onClick={() => setLabTab('analytics')}
                                        data-active={labTab === 'analytics' ? "true" : "false"}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all standing-light standing-beam cursor-pointer ${
                                            labTab === 'analytics'
                                                ? 'bg-indigo-600 text-white shadow-md underglow-box-active active'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        🧠 Intelligence
                                    </button>
                                </div>
                            </div>
                            
                            {labTab === 'hardware' && (
                                <HardwareLabs 
                                    employees={employees || []} 
                                    organizationId={activeOrgId || undefined}
                                    onAddDevice={handleAddDevice}
                                    installedDevices={hardwareDevices.filter(d => d.organizationId === activeOrgId)}
                                    plantationFeatures={currentOrgFeatures}
                                    mapCenter={mapProps.center || [41.9023, 44.5]}
                                    fullScreenMap={false}
                                    initialTab="bluetooth"
                                    onOpenDevicesMap={() => setLabTab('devices_map')}
                                    onSelectLabTab={(tab: string) => setLabTab(tab as any)}
                                />
                            )}

                            {labTab === 'theme' && (
                                <ThemeColorStudio />
                            )}

                            {labTab === 'letters' && (
                                <LetterColorStudio />
                            )}

                            {labTab === 'analytics' && (
                                <div className="pt-2">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Advanced Intelligence Engine</h3>
                                    <AdvancedAnalytics />
                                </div>
                            )}
                        </div>
                    </main>
                );
            default: return (
                <Dashboard 
                    {...mapProps}
                    plantationFeatures={currentOrgFeatures} 
                    workAssignments={workAssignments || []} 
                    inventoryItems={inventoryItems || []} 
                    harvestEvents={activeHarvestEvents} 
                    accounts={accounts || []} 
                    dailyLogs={dailyLogs || []} 
                    onSetDailyLogs={handleSetDailyLogs}
                    employees={employees || []}
                    listings={listings || []} 
                    nutritionPlans={nutritionPlans || []}
                    dashboardLayout={dashboardLayout} 
                    onSetDashboardLayout={handleSetDashboardLayout} 
                    isMapFullScreen={isMapFullScreen} 
                    onSetIsMapFullScreen={setIsMapFullScreen} 
                    assistantMessages={assistantMessages} 
                    onSendCommand={(cmd) => handleSendCommand(cmd, { onAddTask: handleAddTask })} 
                    isAssistantLoading={isAssistantLoading} 
                    harvestEntries={harvestEntries || []}
                    users={users}
                    organizations={organizations}
                    discoverableOrganizations={discoverableOrganizations}
                    memberships={memberships}
                    onAddOrg={handleAddOrg}
                    onSwitchOrg={handleSwitchOrg}
                    onUpdateUser={handleUpdateUser}
                    crops={crops}
                    activeOrgId={activeOrgId}
                    onOpenMeet={handleOpenMeetHub}
                    onOpenChat={handleOpenChatHub}
                    forumPosts={forumPosts || []}
                    onAddPost={handleAddPost}
                    onAddReply={handleAddReply}
                    onUpdatePost={handleUpdatePost}
                    allUsers={users}
                    roles={roles || []}
                    onSetMemberships={handleSetMemberships}
                    onSetEmployees={handleSetEmployees}
                    onSetUsers={handleSetUsers}
                    onOpenAssistant={() => window.dispatchEvent(new CustomEvent('agrimap_open_assistant'))}
                    onOpenNotes={() => window.dispatchEvent(new CustomEvent('agrimap_open_voice_notes'))}
                    notes={notes || []}
                    currentUser={currentUser}
                    onNavigateMode={(mode) => setAppMode(mode as AppMode)}
                    onOpenProfile={() => setAppMode('profile')}
                    onOpenHelp={() => setAppMode('guide')}
                />
            );
        }
    };

    const rawFirebaseData = {
        plantationFeatures,
        setPlantationFeatures,
        layers,
        setLayers,
        organizations,
        setOrganizations,
        memberships,
        setMemberships,
        inventoryItems,
        setInventoryItems,
        harvestEvents,
        setHarvestEvents,
        accounts,
        setAccounts,
        transactions,
        setTransactions,
        workAssignments,
        setWorkAssignments,
        employees,
        setEmployees,
        machinery,
        setMachinery,
        projects,
        setProjects,
        harvestEntries,
        setHarvestEntries,
        pallets,
        setPallets,
        harvestLogs,
        setHarvestLogs,
        inventoryTransactions,
        setInventoryTransactions,
        stockTransactions,
        setStockTransactions,
        harvestedProduce,
        setHarvestedProduce,
        employeeGroups,
        setEmployeeGroups,
        dailyLogs,
        setDailyLogs,
        nutritionPlans,
        setNutritionPlans,
        planExecutions,
        setPlanExecutions,
        forumPosts,
        setForumPosts,
        listings,
        setListings,
        bids,
        setBids,
        reviews,
        setReviews,
        alerts,
        setAlerts,
        purchaseOrders,
        setPurchaseOrders,
        suppliers,
        setSuppliers,
        operationalLogs,
        setOperationalLogs,
        notes,
        setNotes,
        checkpoints,
        setCheckpoints,
        systemLogs,
        setSystemLogs,
        allUsers,
        setAllUsers,
        discoverableOrganizations,
        subscriptionRequests,
        setSubscriptionRequests,
        cropVarieties,
        setCropVarieties,
        crops,
        setCrops
    };

    return (
        <GlobalDataInterceptorProvider>
        <FirebaseDataProvider rawData={rawFirebaseData} isConnectionHealthy={isConnectionHealthy}>
            <div className="flex h-[100dvh] w-screen overflow-hidden font-inter transition-colors duration-200" style={{ backgroundColor: 'var(--bg-canvas, #f3f4f6)', color: 'var(--text-primary, #0f172a)' }}>
            <Sidebar 
                appMode={appMode} 
                onSetAppMode={setAppMode} 
                checkPermission={checkPermission} 
                currentUser={currentUser} 
                activeOrg={activeOrg || null}
                memberships={memberships}
                isConnectionHealthy={isConnectionHealthy}
                onOpenHomepage={() => setShowWelcomeModal(true)}
            />
            <div className="flex flex-col flex-1 min-w-0 relative pb-20 lg:pb-0">
                <Header 
                    currentUser={currentUser} 
                    onRegister={() => setIsRegisterModalOpen(true)} 
                    onLogin={() => setIsLoginModalOpen(true)} 
                    onLogout={handleLogout} 
                    onOpenProjects={() => setIsProjectManagerOpen(true)} 
                    onSaveProject={() => setIsSaveModalOpen(true)} 
                    onOpenProfile={() => setAppMode('profile')}
                    activeOrgName={activeOrgId === 'ALL' ? 'All Tickets' : (activeOrg?.name || 'Personal Account')}
                    onOpenTicketManager={() => setIsTicketManagerOpen(true)}
                    currentUserRole={memberships.find(m => m.organizationId === activeOrgId)?.role}
                    onOpenNotifications={() => setIsNotificationHubOpen(true)}
                    notificationsCount={alerts.filter(a => !a.isRead).length}
                    isManualOffline={isManualOffline}
                    onToggleOffline={handleToggleOffline}
                    isCloudQuotaExceeded={isQuotaExceeded}
                    onOpenLocalServerConfig={() => setIsLocalServerModalOpen(true)}
                    localServerConfig={localServerConfig}
                    onPushToCloud={handlePushToCloud}
                    pendingSyncCount={pendingSyncCount}
                    onOpenDataAuditor={() => setIsDataStateAuditorOpen(true)}
                    onOpenHomepage={() => setShowWelcomeModal(true)}
                    onOpenHelp={() => setAppMode('guide')}
                    onOpenChat={handleOpenChatHub}
                    onOpenMeet={handleOpenMeetHub}
                    onOpenAssistant={() => window.dispatchEvent(new CustomEvent('agrimap_open_assistant'))}
                    onOpenNotes={() => window.dispatchEvent(new CustomEvent('agrimap_open_voice_notes'))}
                    notesCount={notes?.length || 0}
                    onOpenThemeStudio={() => {
                        setAppMode('labs');
                        setLabTab('theme');
                    }}
                    onOpenGlobalSearch={() => setIsSpotlightOpen(true)}
                />
                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                    <Toaster position="top-right" richColors />
                    {currentUser && !currentUser.isGuest && currentUser.verificationStatus === 'unverified' && (
                        <VerificationBanner email={currentUser.email} onResend={handleSendVerification} onRefresh={handleRefreshUser} />
                    )}
                    <ErrorBoundary key={appMode} fallbackTitle="Module View Error">
                        {renderContent()}
                    </ErrorBoundary>
                </div>
                <MobileNav 
                    appMode={appMode} 
                    onSetAppMode={setAppMode} 
                    checkPermission={(mode) => checkModuleAccess(currentUser, mode, activeOrg, memberships) !== 'none'} 
                />

                <div className="pointer-events-none z-[8500]">
                    <div className="pointer-events-auto">
                        <GlobalAssistantPanel 
                            messages={assistantMessages}
                            onSendCommand={(cmd) => handleSendCommand(cmd, {
                                onAddTask: handleAddTask,
                                onAddNote: handleAddNote,
                                onAddReminder: handleAddReminder,
                                harvestEntries: harvestEntries || [],
                                workAssignments: workAssignments || [],
                                inventoryItems: inventoryItems || [],
                                notes: notes || [],
                                setAppMode: setAppMode,
                                activeOrgId: activeOrgId,
                                activeOrgName: activeOrg?.name,
                                isSystemAdmin: isSystemAdmin,
                                currentUser: currentUser,
                                organizations: organizations || [],
                                plantationFeatures: currentOrgFeatures || plantationFeatures || [],
                                employees: employees || [],
                                machinery: machinery || [],
                                nutritionPlans: nutritionPlans || [],
                                assistantMode: assistantMode
                            })}
                            isLoading={isAssistantLoading}
                            activeModuleName={appMode ? appMode.charAt(0).toUpperCase() + appMode.slice(1) : 'Dashboard'}
                            notes={notes || []}
                            onAddNote={handleAddNote}
                            onDeleteNote={handleDeleteNote}
                            onDeleteMultipleNotes={handleDeleteMultipleNotes}
                            activeOrgId={activeOrgId}
                            activeOrgName={activeOrg?.name}
                            currentUser={currentUser}
                            onOpenChat={handleOpenChatHub}
                            onOpenMeet={handleOpenMeetHub}
                            currentAiMode={assistantMode}
                            onSetAiMode={setAssistantMode}
                            organizations={organizations || []}
                            workAssignments={workAssignments || []}
                            harvestEntries={harvestEntries || []}
                            plantationFeatures={currentOrgFeatures || plantationFeatures || []}
                            employees={employees || []}
                            machinery={machinery || []}
                            nutritionPlans={nutritionPlans || []}
                            onNavigateToTasks={() => setAppMode('tasks' as any)}
                            onAddTask={handleAddTask}
                            onAddNutritionPlan={(plan) => setNutritionPlans(prev => [plan, ...(prev || [])])}
                        />
                    </div>
                </div>

                {/* Floating Collaborative Communication & Video Hub */}
                <FloatingCommunicationHub
                    isOpen={isCommunicationHubOpen}
                    onClose={() => setIsCommunicationHubOpen(false)}
                    currentUser={currentUser}
                    initialTab={communicationHubInitialTab}
                    employees={employees}
                    organizations={organizations}
                    allUsers={allUsers}
                    plantationFeatures={currentOrgFeatures}
                    activeMapCenter={mapCenter}
                    onStartMapDrawShowcase={handleStartMapDrawShowcase}
                    activeShowcases={liveMapShowcases}
                    onAddShowcase={handleAddShowcase}
                    onClearShowcases={handleClearShowcases}
                />

                {/* Live Interactive Map Drawing Showcase Overlay */}
                <LiveMapShowcaseOverlay 
                    isActive={isDrawingMapShowcase}
                    shapeType={showcaseShapeType}
                    drawnPoints={inProgressShowcasePoints}
                    onSetShapeType={setShowcaseShapeType}
                    onClose={() => {
                        setIsDrawingMapShowcase(false);
                        setInProgressShowcasePoints([]);
                    }}
                    onUndoPoint={() => {
                        setInProgressShowcasePoints(prev => prev.slice(0, -1));
                    }}
                    onClearPoints={() => {
                        setInProgressShowcasePoints([]);
                    }}
                    onAddShowcase={(newShowcase) => {
                        handleAddShowcase(newShowcase);
                        setIsDrawingMapShowcase(false);
                        setInProgressShowcasePoints([]);
                    }}
                    currentUser={currentUser}
                    onOpenCommunicationHub={() => setIsCommunicationHubOpen(true)}
                />
                
                {currentUser?.status === 'blocked' && (
                    <div className="absolute inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
                        <div className="max-w-md bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 animate-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
                                <span className="text-5xl">🚫</span>
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4">Account Blocked</h2>
                            <p className="text-slate-500 font-medium leading-relaxed mb-8">
                                Your access to AgriMap Pro has been frozen by the system administrator. 
                                Please contact our support team or your organization admin to resolve this.
                            </p>
                            <button 
                                onClick={handleLogout}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            <NotificationHub 
                isOpen={isNotificationHubOpen}
                onClose={() => setIsNotificationHubOpen(false)}
                alerts={alerts}
                onClearAll={handleClearAllAlerts}
                onMarkAsRead={handleMarkAlertAsRead}
                onAlertClick={async (alert) => {
                    handleMarkAlertAsRead(alert.id);
                    setIsNotificationHubOpen(false);
                    
                    if (alert.metadata?._clickedAction?.actionType === 'approve_join') {
                        const { membershipId } = alert.metadata._clickedAction.actionData;
                        if (USE_FIREBASE) {
                            try {
                                await updateDoc(doc(db, 'memberships', membershipId), { status: 'active' });
                                toast.success("Partner Request Approved!");
                            } catch (e) {
                                console.error(e);
                                toast.error("Failed to approve partner.");
                            }
                        } else {
                            try {
                                const savedMemberships = safeStorage.safeParse(localStorage.getItem('mock_memberships'), []);
                                const updatedMemberships = savedMemberships.map((m: any) => m.id === membershipId ? { ...m, status: 'active' } : m);
                                localStorage.setItem('mock_memberships', JSON.stringify(updatedMemberships));
                                setMemberships(updatedMemberships);
                                
                                const approvedMem = savedMemberships.find((m: any) => m.id === membershipId);
                                if (approvedMem) {
                                    const targetOrgId = approvedMem.organizationId;
                                    const welcomePost = {
                                        id: `welcome-post-${Date.now()}`,
                                        title: "Welcome aboard!",
                                        content: `Excited to announce that we are now fully connected as professional team members! Handshake status is live.`,
                                        authorId: 'founder',
                                        authorName: 'Organization Founder',
                                        timestamp: new Date().toISOString(),
                                        hubType: 'internal' as any,
                                        channelId: 'general',
                                        isDirectMessage: false,
                                        organizationId: targetOrgId,
                                        replies: []
                                    };
                                    const savedPosts = safeStorage.safeParse(localStorage.getItem('mock_forumPosts'), []);
                                    const updatedPosts = [welcomePost, ...savedPosts];
                                    localStorage.setItem('mock_forumPosts', JSON.stringify(updatedPosts));
                                    setForumPosts(updatedPosts);
                                }
                                toast.success("Partner Request Approved offline!");
                            } catch (err) {
                                console.error(err);
                                toast.error("Failed to approve partner offline.");
                            }
                        }
                    } else if (alert.content?.includes('@') || alert.content?.includes('#')) {
                        setAppMode('community');
                    } else if (alert.title?.toLowerCase().includes('partner') || alert.title?.toLowerCase().includes('analy')) {
                        setAppMode('ai');
                    } else if (alert.title?.toLowerCase().includes('harvest')) {
                        setAppMode('harvesting');
                    } else if (alert.title?.toLowerCase().includes('inventory') || alert.title?.toLowerCase().includes('stock')) {
                        setAppMode('stock');
                    }
                }}
                currentUser={currentUser}
            />
            <DataStateAuditor 
                isOpen={isDataStateAuditorOpen} 
                onClose={() => setIsDataStateAuditorOpen(false)} 
                inventoryItems={inventoryItems}
                onSetInventoryItems={setInventoryItems}
            />
            <SyncConflictModal 
                isOpen={isSyncConflictModalOpen} 
                onClose={() => setIsSyncConflictModalOpen(false)} 
                onPushToCloud={handlePushToFirestore} 
                onOpenDetailedAuditor={() => {
                    setIsSyncConflictModalOpen(false);
                    setIsDataStateAuditorOpen(true);
                }}
            />
            <LoginModal 
                isOpen={isLoginModalOpen} 
                onClose={() => setIsLoginModalOpen(false)} 
                onLogin={setCurrentUser} 
                onGoogleLogin={handleGoogleLogin}
                onEmailLogin={handleEmailLogin}
                onResetPassword={handleResetPassword}
            />
            <RegistrationModal 
                isOpen={isRegisterModalOpen} 
                onClose={() => setIsRegisterModalOpen(false)} 
                onRegister={handleRegister} 
                onGoogleLogin={handleGoogleLogin}
                onAddPost={handleAddPost}
                organizations={discoverableOrganizations}
                currentUser={currentUser}
                onAddOrg={handleAddOrg}
            />
            <WelcomeModal 
                isOpen={showWelcomeModal} 
                onClose={() => {
                    setShowWelcomeModal(false);
                    sessionStorage.setItem('agri-planter-welcome-seen', 'true');
                    setAppMode('dashboard');
                }} 
                onRegister={() => {
                    setShowWelcomeModal(false);
                    setIsRegisterModalOpen(true);
                }}
                onExplore={() => window.location.assign('/demo')}
                onLogin={handleEmailLogin}
            />
            
            <TicketManager 
                isOpen={isTicketManagerOpen}
                onClose={() => setIsTicketManagerOpen(false)}
                tickets={organizationTickets}
                activeOrgId={activeOrgId}
                onSelectTicket={(id) => {
                    const ticket = organizationTickets.find(t => t.id === id);
                    if (ticket) {
                        handleSwitchOrg(ticket.organizationId);
                    }
                    setIsTicketManagerOpen(false);
                }}
            />
            <PostRegistrationChoiceModal 
                isOpen={showPostRegChoice}
                onChoice={handlePostRegChoice}
                orgName={lastRegisteredOrgName}
            />
            <SaveFieldModal 
                isOpen={isSaveModalOpen} 
                onClose={() => setIsSaveModalOpen(false)} 
                onSave={handleSaveProject} 
            />
            <LocalServerModal 
                isOpen={isLocalServerModalOpen}
                onClose={() => setIsLocalServerModalOpen(false)}
                config={localServerConfig}
                onSave={(newConfig) => {
                    setLocalServerConfig(newConfig);
                    localStorage.setItem('agrimap-local-config', JSON.stringify(newConfig));
                    toast.success("Local Server Node Initialized");
                }}
                onPushToCloud={handlePushToCloud}
            />
            <SmartOfflineDisconnectModal 
                isOpen={showSmartDisconnectModal}
                onClose={() => setShowSmartDisconnectModal(false)}
                currentConfig={localServerConfig}
                onSaveConfig={(newConfig) => {
                    setLocalServerConfig(newConfig);
                    localStorage.setItem('agrimap-local-config', JSON.stringify(newConfig));
                    setIsManualOffline(true);
                    localStorage.setItem('agrimap-manual-offline', 'true');
                }}
                onChooseOfflineMode={() => {
                    setIsManualOffline(true);
                    localStorage.setItem('agrimap-manual-offline', 'true');
                }}
            />
            <ReSyncNotificationPrompt 
                isOpen={showReSyncPrompt}
                onClose={() => setShowReSyncPrompt(false)}
                pendingCount={pendingOfflineCount}
                onConfirmSync={async () => {
                    try {
                        toast.loading("Uploading offline data...", { id: 'sync-prog' });
                        await syncManager.pushAllToCloud();
                        toast.success("Offline cache fully synchronized!", { id: 'sync-prog' });
                        setShowReSyncPrompt(false);
                        setPendingOfflineCount(0);
                    } catch (err) {
                        toast.error("Upload failed.", { id: 'sync-prog' });
                        throw err;
                    }
                }}
            />
            <GlobalSpotlightSearch 
                isOpen={isSpotlightOpen}
                onClose={() => setIsSpotlightOpen(false)}
                appMode={appMode}
                onSetAppMode={setAppMode}
                currentUser={currentUser}
                plantationFeatures={plantationFeatures}
                employees={employees}
                workAssignments={workAssignments}
                inventoryItems={inventoryItems}
                harvestEntries={harvestEntries}
                organizations={organizations}
                allUsers={allUsers}
                machinery={machinery}
                notes={notes}
                onOpenTicketManager={() => setIsTicketManagerOpen(true)}
                onOpenProfile={() => setAppMode('profile')}
                onOpenNotifications={() => setIsNotificationHubOpen(true)}
                onOpenSaveProject={() => setIsSaveModalOpen(true)}
                onOpenProjects={() => setIsProjectManagerOpen(true)}
                onOpenHelp={() => setAppMode('guide')}
                onOpenChat={handleOpenChatHub}
                onOpenMeet={handleOpenMeetHub}
                onOpenLocalServerConfig={() => setIsLocalServerModalOpen(true)}
                onOpenThemeStudio={() => {
                    setAppMode('labs');
                    setLabTab('theme');
                }}
                onToggleOffline={handleToggleOffline}
                isManualOffline={isManualOffline}
                onPushToCloud={handlePushToFirestore}
                pendingSyncCount={pendingSyncCount}
                onOpenDataAuditor={() => setIsDataStateAuditorOpen(true)}
                onOpenHomepage={() => setShowWelcomeModal(true)}
                onSetMapCenter={(center) => setMapCenter(center)}
                onSetMapZoom={(zoom) => setMapZoom(zoom)}
                onSelectFeatureId={(id) => {
                    setSelectedFeatureIds([id]);
                    setHighlightedFeatureIds([id]);
                }}
                onOpenVoiceNotes={() => {
                    setAppMode('tools');
                }}
                onStartMapDrawShowcase={handleStartMapDrawShowcase}
            />
            <FieldManagerModal 
                isOpen={isProjectManagerOpen} 
                onClose={() => setIsProjectManagerOpen(false)} 
                projects={projects} 
                onLoad={(project) => handleLoadProject(project.id)} 
                onDelete={handleDeleteProject} 
                onImport={handleImportProjects} 
                onExport={handleExportProjects} 
                onShare={(project) => handleShareProject(project.id)} 
            />
        </div>
        </FirebaseDataProvider>
        </GlobalDataInterceptorProvider>
    );
};

const AppRoot: React.FC = () => {
    return (
        <ThemeProvider>
            <App />
        </ThemeProvider>
    );
};

export default AppRoot;