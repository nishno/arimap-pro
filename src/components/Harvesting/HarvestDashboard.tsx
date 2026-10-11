import React, { useState, useMemo, useEffect, useCallback } from 'react';
import L from 'leaflet';
import { Popup, Polygon } from 'react-leaflet';
import { ChevronLeftIcon, MapPinIcon, ArchiveBoxIcon, XIcon } from '../Icons';
import MapComponent from '../MapComponent';
import WeighStationModal from '../WeighStationModal';
import HarvestLogModal from '../HarvestLogModal';
import { DailyPaidHarvestCard, HarvestStatsGrid, calculateNetDurationHours, PickerStats, calculatePickerEarnings } from '../HarvestingStats';
import { OperationLogModal } from './OperationLogModal';
import jsQR from 'jsqr';
import { useLanguage } from '../../contexts/LanguageContext';
import { HarvestEvent, HarvestEntry, Pallet, PlantationFeature, AreaPlantationFeature, InventoryItem, Employee, EmployeeGroup, HarvestStatus, HarvestLog, YieldByVariety, PostHarvestAction, DashboardWidget, HarvestSaleDetails, ActiveDrawingTool, Machinery, LinePlantationFeature, Layer, Crop, HARVEST_METHODS, Account, Transaction, StockTransaction, User, Role, Permission, AssignedPicker } from '../../types';
import { isValidCoordinate } from '../../types';
import type { MapComponentProps } from '../MapComponent';
import { Fingerprint, QrCode, RefreshCcw, Boxes, Scale, Wifi, WifiOff, CloudUpload, HardDrive, MapPin, Database, ChevronDown, ListFilter, ShieldCheck, Play as PlayIcon, Share2, History, Users, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import QrScannerModal from '../QrScannerModal';
import { findMatchingEmployee } from '../../utils/employeeMatching';
import { getDetailedSyncQueue, SyncLogEntry, auth } from '../../firebase';
import { syncManager } from '../../services/SyncManager';
import { syncBroker } from '../../services/SyncBroker';
import { PresenceEngine } from '../../../new_engine/PresenceEngine';
import { PresenceUser } from '../../../new_engine/types';
import HarvestEventHistoryModal from './HarvestEventHistoryModal';
import ShareHarvestEventModal from './ShareHarvestEventModal';
import HarvestBoxQrModal from './HarvestBoxQrModal';
import OnlineUsersModal from './OnlineUsersModal';
import { LogisticsSummaryWidget } from './LogisticsSummaryWidget';
import { LogisticsTransportWidget } from './LogisticsTransportWidget';
import MachineryManager from '../SystemManagement/MachineryManager';
import { WorkerLog } from '../../../new_engine/WorkerLogBridge';
import { getStoredActiveUser } from '../../utils/userPresence';
import '../../lib/leafletSafety';
import { extractSafePoints } from '../../lib/leafletSafety';
import ResizableDivider from '../common/ResizableDivider';
import { safeStorage } from '../../services/storageService';

const parseSafeGeometry = (geom: any): [number, number][] => {
    return extractSafePoints(geom);
};

export const formatCleanWeight = (val: number): string => {
    if (typeof val !== 'number' || isNaN(val)) return '0';
    if (val >= 1000) {
        const kVal = val / 1000;
        if (val % 1000 === 0) {
            return kVal.toFixed(0) + 'k';
        } else if (val % 100 === 0) {
            return kVal.toFixed(1) + 'k';
        } else if (val % 10 === 0) {
            return kVal.toFixed(2) + 'k';
        }
        return kVal.toFixed(3) + 'k';
    }
    if (val % 1 === 0) {
        return val.toFixed(0);
    }
    return val.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d+?)0+$/, '$1');
};

export const renderSafeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        if (val._methodName || val.bc !== undefined) {
            return ''; // Hide raw Firestore FieldValue/commands from UI text rendering
        }
        try {
            return val.name || val.title || val.id || '';
        } catch (e) {
            return '';
        }
    }
    return String(val);
};

export const renderSafeNumber = (val: any): string => {
    if (val === null || val === undefined) return '0';
    if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? '0' : String(parsed);
    }
    if (typeof val === 'object') {
        if (val.type === 'increment' && typeof val.value === 'number') {
            return String(val.value);
        }
        if (val._methodName === 'increment' && typeof val.operand === 'number') {
            return String(val.operand);
        }
        for (const key of Object.keys(val)) {
            if (typeof val[key] === 'number') {
                return String(val[key]);
            }
        }
        return '0';
    }
    return '0';
};

export const safeNumericVal = (val: any, fallback: number = 0): number => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? fallback : parsed;
    }
    if (typeof val === 'object') {
        if (val.type === 'increment' && typeof val.value === 'number') return val.value;
        if (val._methodName === 'increment' && typeof val.operand === 'number') return val.operand;
        return fallback;
    }
    return fallback;
};

// Internal components for HarvestDashboard
const HarvestLocalSyncPanel: React.FC<{
    event: HarvestEvent;
    onPushToCloud: () => void;
    onSyncToLAN: () => void;
    isLocalMode: boolean;
    isSimulationMode: boolean;
    onToggleSimulation: (enabled: boolean) => void;
    simulatedCount: number;
    onCommitSimulation: () => void;
}> = ({ event, onPushToCloud, onSyncToLAN, isLocalMode, isSimulationMode, onToggleSimulation, simulatedCount, onCommitSimulation }) => {
    const { t } = useLanguage();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showLog, setShowLog] = useState(false);
    const [syncQueue, setSyncQueue] = useState<SyncLogEntry[]>([]);

    useEffect(() => {
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        const updateQueue = () => setSyncQueue(getDetailedSyncQueue());
        
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        window.addEventListener('agrimap-sync-queue-updated', updateQueue);
        
        updateQueue();
        
        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
            window.removeEventListener('agrimap-sync-queue-updated', updateQueue);
        };
    }, []);

    const relevantLogs = syncQueue.filter(log => log.path.includes(event.id) || log.data?.harvestEventId === event.id);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-[20px] overflow-hidden shadow-xl transition-all duration-500">
            <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">{t('harvest.system_topology')}</p>
                            <p className="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                                {isOnline ? t('harvest.triple_layer_synced') : t('harvest.offline_vault')}
                                {isSimulationMode && (
                                    <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-[#f59e0b] text-[8px] font-black uppercase tracking-wider px-1.5 py-[0.5px] rounded-md">
                                        {t('harvest.sandbox')}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">{t('harvest.local_node')}</p>
                        <p className="text-xs font-black text-indigo-400">192.168.10.152</p>
                    </div>
                </div>

                {/* Simulation Sandbox Engine Section */}
                <div className="p-3 bg-slate-800/40 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`relative flex h-2 w-2 ${isSimulationMode ? 'text-amber-500' : 'text-slate-600'}`}>
                                {isSimulationMode && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isSimulationMode ? 'bg-amber-500' : 'bg-slate-600'}`}></span>
                            </span>
                             <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{t('harvest.simulation_sandbox')}</p>
                                <p className="text-[10px] font-bold text-slate-300">
                                    {isSimulationMode ? t('harvest.offline_sandbox_logging') : t('harvest.normal_live_logging')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => onToggleSimulation(!isSimulationMode)}
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-all duration-300 cursor-pointer ${
                                isSimulationMode ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                            }`}
                        >
                            <div className="bg-white w-4 h-4 rounded-full shadow-md transition-all"></div>
                        </button>
                    </div>
                    <p className="text-[8px] font-medium text-slate-500 leading-normal">
                        {isSimulationMode ? (
                            <span className="text-amber-500/90 font-bold flex flex-col gap-1">
                                <span>{t('harvest.deduplication_enabled_desc')}</span>
                                {isOnline && <span className="text-[7.5px] text-slate-400 uppercase tracking-wide">{t('harvest.online_sandbox_warning')}</span>}
                            </span>
                        ) : (
                            t('harvest.live_logging_desc')
                        )}
                    </p>

                    {/* Simulation Queue controls */}
                    {(isSimulationMode || simulatedCount > 0) && (
                        <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="font-extrabold text-amber-500 uppercase tracking-wider text-[8px]">{t('harvest.device_drafts_queue')}</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-extrabold text-[9px] border border-amber-500/20">
                                    {simulatedCount} {t('harvest.pending_status')}
                                </span>
                            </div>
                            {simulatedCount > 0 ? (
                                <button
                                    onClick={onCommitSimulation}
                                    className="w-full py-1.5 bg-amber-550 hover:bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                                    style={{ backgroundColor: '#f59e0b' }}
                                >
                                    <Database size={11} className="text-slate-950" />
                                    {t('harvest.commit_deduplicate')} ({simulatedCount})
                                </button>
                            ) : (
                                <p className="text-[8px] text-center text-slate-500 font-bold uppercase py-1">
                                    {t('harvest.no_simulated_entries')}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={onSyncToLAN}
                        className="group relative flex flex-col items-center justify-center p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all"
                    >
                        <HardDrive size={16} className="text-indigo-400 mb-1 transition-transform group-hover:scale-110" />
                        <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-white">{t('harvest.push_to_lan')}</span>
                    </button>
                    <button 
                        onClick={onPushToCloud}
                        disabled={!isOnline}
                        className="group relative flex flex-col items-center justify-center p-2.5 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 rounded-xl transition-all disabled:opacity-30 disabled:grayscale"
                    >
                        <CloudUpload size={16} className="text-indigo-400 group-hover:text-white mb-1 transition-transform group-hover:scale-110" />
                        <span className="text-[9px] font-black uppercase tracking-tighter text-indigo-400 group-hover:text-white">{t('harvest.cloud_sync')}</span>
                    </button>
                </div>

                <button 
                    onClick={() => setShowLog(!showLog)}
                    className="w-full py-1.5 flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
                >
                    <Database size={10} />
                    {t('harvest.view_detailed_sync_log')} ({relevantLogs.length})
                    <ChevronDown size={10} className={`transition-transform ${showLog ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {showLog && (
                <div className="border-t border-slate-800 bg-slate-950/50 max-h-48 overflow-y-auto scrollbar-hide">
                    <div className="p-4 space-y-2">
                        {relevantLogs.length === 0 ? (
                            <p className="text-[9px] text-center text-slate-600 font-bold uppercase py-4">{t('harvest.no_pending_ops')}</p>
                        ) : (
                            relevantLogs.slice().reverse().map(log => (
                                <div key={log.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-800/50">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                            log.status === 'cloud_synced' ? 'bg-emerald-500' : 
                                            log.status === 'local_synced' ? 'bg-indigo-500' : 'bg-amber-500 animate-pulse'
                                        }`} />
                                        <div>
                                            <p className="text-[9px] font-black text-white uppercase leading-none">{log.type} • {log.path.split('/').pop()}</p>
                                            <p className="text-[8px] font-bold text-slate-500 mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                    <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                            {log.status === 'pending' ? 'Tablet Memory' : log.status === 'local_synced' ? 'Office LAN' : 'Global Cloud'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            
            <div className="px-4 py-2 bg-slate-800/30 flex justify-between items-center text-[8px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                    <ShieldCheck size={10} className="text-emerald-500" />
                    Data Redundancy Active
                </span>
                <span className="uppercase tracking-widest">{renderSafeString(event.syncStatus) || 'Local Only'}</span>
            </div>
        </div>
    );
};
const DailyHarvestModal: React.FC<{
    isOpen: boolean;
    initialTab?: 'stats' | 'logistics';
    onClose: () => void;
    event: HarvestEvent;
    employees: Employee[];
    entries: HarvestEntry[];
    onSetHarvestEvents: (events: HarvestEvent[]) => void;
    harvestEvents: HarvestEvent[];
    onLogActivity?: (action: string, module: import('../../types').AppMode, status: 'success' | 'failure' | 'alert', report?: string) => Promise<void>;
    inventoryItems?: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    onSetEmployees?: (employees: Employee[]) => void;
    roles?: Role[];
    crops?: Crop[];
    cropVarieties?: string[];
    employeeGroups?: EmployeeGroup[];
    onSetEmployeeGroups?: (groups: EmployeeGroup[]) => void;
    allHarvestEntries?: HarvestEntry[];
    onSetHarvestEntries?: (entries: HarvestEntry[]) => void;
    machinery?: Machinery[];
    onSetMachinery?: (machinery: Machinery[]) => void;
    onOpenFleetManager?: () => void;
}> = ({ isOpen, initialTab = 'stats', onClose, event, employees, entries, onSetHarvestEvents, harvestEvents, onLogActivity, inventoryItems, onSetInventoryItems, onSetEmployees, roles, crops, cropVarieties, employeeGroups, onSetEmployeeGroups, allHarvestEntries, onSetHarvestEntries, machinery, onSetMachinery, onOpenFleetManager }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'stats' | 'statistics' | 'logistics' | 'management'>(initialTab as any || 'stats');
    const [isHarvestBoxQrOpen, setIsHarvestBoxQrOpen] = useState(false);

    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab as any);
        }
    }, [isOpen, initialTab]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-2 sm:p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-gray-50 w-full rounded-2xl sm:rounded-3xl shadow-2xl max-w-7xl h-[95vh] sm:h-[90vh] max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80" onClick={e => e.stopPropagation()}>
                <div className="p-3.5 sm:p-4 border-b flex justify-between items-center bg-white flex-shrink-0 shadow-xs">
                    <div className="flex items-center gap-4">
                        <h2 className="text-base sm:text-xl font-black text-gray-900 uppercase tracking-tight">{t('adv.title')}</h2>
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                            <button 
                                onClick={() => setActiveTab('stats')}
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                            >
                                Yield Control
                            </button>
                            <button 
                                onClick={() => setActiveTab('statistics')}
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'statistics' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                            >
                                <span>📊</span>
                                <span>Statistics & Audit Hub</span>
                            </button>
                            <button 
                                onClick={() => setActiveTab('logistics')}
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'logistics' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                            >
                                Logistics & Resources
                            </button>
                            <button 
                                onClick={() => setActiveTab('management')}
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'management' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                            >
                                <span>⚙️</span>
                                <span>Management & Other Tools</span>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsHarvestBoxQrOpen(true)}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                            title={t('language') === 'ka' ? "მოსავლის ყუთების QR კოდების გენერირება & ბეჭდვა" : "Generate & Print Harvest Box QR Codes"}
                        >
                            <QrCode size={14} className="text-emerald-400" />
                            <span>{t('language') === 'ka' ? 'ყუთების QR' : 'Box QRs'}</span>
                        </button>
                    </div>
                    <button onClick={onClose} className="p-2 min-w-[40px] min-h-[40px] hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center active:scale-95">
                        <XIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" />
                    </button>
                </div>
                <div className="flex-grow overflow-hidden min-h-0 flex flex-col">
                    {activeTab === 'stats' && (
                        <PickerStats 
                            viewMode="payroll"
                            onSwitchTab={(tab) => setActiveTab(tab as any)}
                            event={event} 
                            employees={employees} 
                            entries={entries} 
                            onSetHarvestEvents={onSetHarvestEvents} 
                            harvestEvents={harvestEvents} 
                            onLogActivity={onLogActivity}
                            inventoryItems={inventoryItems}
                            onSetInventoryItems={onSetInventoryItems}
                            onSetEmployees={onSetEmployees}
                            roles={roles}
                            crops={crops}
                            cropVarieties={cropVarieties}
                            employeeGroups={employeeGroups}
                            onSetEmployeeGroups={onSetEmployeeGroups}
                            allHarvestEntries={allHarvestEntries}
                            onSetHarvestEntries={onSetHarvestEntries}
                            machinery={machinery}
                        />
                    )}
                    {activeTab === 'statistics' && (
                        <PickerStats 
                            viewMode="statistics"
                            onSwitchTab={(tab) => setActiveTab(tab as any)}
                            event={event} 
                            employees={employees} 
                            entries={entries} 
                            onSetHarvestEvents={onSetHarvestEvents} 
                            harvestEvents={harvestEvents} 
                            onLogActivity={onLogActivity}
                            inventoryItems={inventoryItems}
                            onSetInventoryItems={onSetInventoryItems}
                            onSetEmployees={onSetEmployees}
                            roles={roles}
                            crops={crops}
                            cropVarieties={cropVarieties}
                            employeeGroups={employeeGroups}
                            onSetEmployeeGroups={onSetEmployeeGroups}
                            allHarvestEntries={allHarvestEntries}
                            onSetHarvestEntries={onSetHarvestEntries}
                            machinery={machinery}
                        />
                    )}
                    {activeTab === 'management' && (
                        <PickerStats 
                            viewMode="management"
                            onSwitchTab={(tab) => setActiveTab(tab as any)}
                            event={event} 
                            employees={employees} 
                            entries={entries} 
                            onSetHarvestEvents={onSetHarvestEvents} 
                            harvestEvents={harvestEvents} 
                            onLogActivity={onLogActivity}
                            inventoryItems={inventoryItems}
                            onSetInventoryItems={onSetInventoryItems}
                            onSetEmployees={onSetEmployees}
                            roles={roles}
                            crops={crops}
                            cropVarieties={cropVarieties}
                            employeeGroups={employeeGroups}
                            onSetEmployeeGroups={onSetEmployeeGroups}
                            allHarvestEntries={allHarvestEntries}
                            onSetHarvestEntries={onSetHarvestEntries}
                            machinery={machinery}
                        />
                    )}
                    {activeTab === 'logistics' && (
                        <div className="p-4 overflow-y-auto h-full">
                            <div className="max-w-4xl mx-auto">
                                <LogisticsTransportWidget 
                                    event={event} 
                                    harvestEvents={harvestEvents} 
                                    onSetHarvestEvents={onSetHarvestEvents} 
                                    machinery={machinery || []} 
                                    onSetMachinery={onSetMachinery}
                                    inventoryItems={inventoryItems || []} 
                                    onSetInventoryItems={onSetInventoryItems} 
                                    employees={employees} 
                                    onOpenFleetManager={onOpenFleetManager}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {isHarvestBoxQrOpen && (
                <HarvestBoxQrModal
                    isOpen={isHarvestBoxQrOpen}
                    onClose={() => setIsHarvestBoxQrOpen(false)}
                    harvestEvent={event}
                    employees={employees}
                />
            )}
        </div>
    );
};

const MaterialsPickerForm: React.FC<{
    inventoryItems: InventoryItem[];
    onAddMaterial: (itemId: string, qty: number, unitCost: number) => void;
    onClose: () => void;
}> = ({ inventoryItems, onAddMaterial, onClose }) => {
    const supplies = inventoryItems.filter(i => ['Packaging', 'Supplies', 'Fertilizers', 'Pesticides', 'Seeds', 'Other'].includes(i.category) || !i.category);
    const availableItems = supplies.length > 0 ? supplies : inventoryItems;
    
    const [selectedItemId, setSelectedItemId] = useState<string>(availableItems[0]?.id || '');
    const [quantity, setQuantity] = useState<number>(1);
    const [unitCost, setUnitCost] = useState<number>(availableItems[0]?.unitCost || 0);

    const selectedItem = availableItems.find(i => i.id === selectedItemId);

    const handleItemChange = (id: string) => {
        setSelectedItemId(id);
        const item = availableItems.find(i => i.id === id);
        if (item) {
            setUnitCost(item.unitCost || 0);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Material / Supply from Stock</label>
                <select
                    value={selectedItemId}
                    onChange={e => handleItemChange(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                >
                    {availableItems.map(item => (
                        <option key={item.id} value={item.id}>
                            {item.name} ({item.category}) — In Stock: {item.currentStock} {item.unitOfMeasure || 'pcs'} @ ${item.unitCost?.toFixed(2) || '0.00'}
                        </option>
                    ))}
                    {availableItems.length === 0 && (
                        <option value="">No stock items available</option>
                    )}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Quantity Used</label>
                    <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value) || 0)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Unit Cost ($)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitCost}
                        onChange={e => setUnitCost(Number(e.target.value) || 0)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                    />
                </div>
            </div>

            {selectedItem && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">Total Material Cost:</span>
                    <span className="font-black text-indigo-600 text-sm">${(quantity * unitCost).toFixed(2)}</span>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase hover:bg-slate-200">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (!selectedItemId) {
                            toast.error("Please select a material item.");
                            return;
                        }
                        onAddMaterial(selectedItemId, quantity, unitCost);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-indigo-700 shadow-sm"
                >
                    Add Material OPEX
                </button>
            </div>
        </div>
    );
};

const BoxScannerOverlay: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
    defaultBoxWeightKg?: number;
}> = ({ isOpen, onClose, onScan, defaultBoxWeightKg = 5.8 }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const animationFrameRef = React.useRef<number | null>(null);
    const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const lastQrScanAttemptRef = React.useRef<number>(0);

    const handleScanLoop = () => {
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
            animationFrameRef.current = requestAnimationFrame(handleScanLoop);
            return;
        }

        const now = Date.now();
        // Throttle QR decoding attempts to once per 200ms (5 FPS) instead of 60 FPS
        if (now - lastQrScanAttemptRef.current >= 200) {
            lastQrScanAttemptRef.current = now;

            const video = videoRef.current;
            if (!qrCanvasRef.current) {
                qrCanvasRef.current = document.createElement('canvas');
            }
            const canvas = qrCanvasRef.current;

            // Downscale to max 480px width/height to limit pixel processing area
            const maxDimension = 480;
            let scanWidth = video.videoWidth || 640;
            let scanHeight = video.videoHeight || 480;
            if (scanWidth > maxDimension) {
                const ratio = maxDimension / scanWidth;
                scanWidth = maxDimension;
                scanHeight = Math.round(video.videoHeight * ratio);
            }

            if (canvas.width !== scanWidth || canvas.height !== scanHeight) {
                canvas.width = scanWidth;
                canvas.height = scanHeight;
            }

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, scanWidth, scanHeight);
                const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    onScan(code.data);
                    return;
                }
            }
        }
        animationFrameRef.current = requestAnimationFrame(handleScanLoop);
    };

    React.useEffect(() => {
        if (isOpen) {
            const startCamera = async () => {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error("Secure Context Required: Browsers block camera access on insecure HTTP local connections. Access via HTTPS or localhost to enable, or adjust browser flags.");
                    }
                    let stream: MediaStream;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    } catch (envErr) {
                        console.warn("Environment camera not found or locked, falling back to default.", envErr);
                        stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    }
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(playErr => {
                            console.error("Video play failed inside startCamera:", playErr);
                        });
                        handleScanLoop();
                    }
                } catch (err) {
                    console.error("Camera access failed:", err);
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    toast.error("Camera Access Failed", {
                        description: errorMsg.includes("Secure Context") 
                            ? `${errorMsg} (Tip: In Chrome on your tablet, go to chrome://flags/#unsafely-treat-insecure-origin-as-secure, add "http://${window.location.hostname}:${window.location.port || '3000'}" and enable it to bypass this block!)`
                            : `${errorMsg}. Try opening in a new tab if you are in an iframe.`,
                        duration: 12000,
                    });
                    onClose();
                }
            };
            startCamera();
        } else {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        }
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black z-[4000] flex flex-col">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-4 border-orange-500 rounded-3xl animate-pulse" />
            </div>
            <div className="absolute top-8 left-0 right-0 flex justify-between px-6 items-center">
                <h3 className="text-white font-black uppercase tracking-tighter text-xl">Box Scanner Mode</h3>
                <button onClick={onClose} className="p-2 bg-white/20 rounded-full"><XIcon className="h-8 w-8 text-white"/></button>
            </div>
            <div className="absolute bottom-12 left-0 right-0 px-6 text-center flex flex-col items-center">
                <p className="text-white/60 font-medium text-sm mb-4">Position barcode within the frame</p>
                <div className="bg-white/10 backdrop-blur p-4 rounded-2xl border border-white/20 mb-4 text-center">
                     <p className="text-white text-xs font-bold uppercase tracking-widest">Automatic Weight: {defaultBoxWeightKg}kg per Box</p>
                </div>
                <label className="text-xs bg-black/50 text-white px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10 font-bold uppercase tracking-widest cursor-pointer hover:bg-black/70">
                    + Manual Photo
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            try {
                                const { processQrImageFile } = await import('../../utils/qrFileScanner');
                                const result = await processQrImageFile(file);
                                onScan(result);
                                toast.success("QR read from photo.");
                            } catch (err: any) {
                                toast.error(err.message || 'Failed to read QR');
                            }
                        }
                    }}/>
                </label>
            </div>
        </div>
    );
};const CloseHarvestModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    onConfirm: (data: { 
        action: PostHarvestAction, 
        saleDetails?: HarvestSaleDetails, 
        identifer?: string,
        actualFullBoxes?: number,
        emptyBoxesReturned?: number,
        packagingItemId?: string
    }) => void, 
    totalYield: number,
    entries?: HarvestEntry[],
    packagingItems?: InventoryItem[]
}> = ({ isOpen, onClose, onConfirm, totalYield, entries = [], packagingItems = [] }) => {
    const { formatCurrency, t } = useLanguage();
    const [action, setAction] = useState<PostHarvestAction>('MARKETPLACE');
    const [identifier, setIdentifier] = useState(`HARV-${Date.now().toString().slice(-6)}`);
    
    const safeTotalYield = typeof totalYield === 'number' && !isNaN(totalYield) ? totalYield : 0;
    
    const [saleDetails, setSaleDetails] = useState<HarvestSaleDetails>({
        buyerName: '', pricePerUnit: 1.5, totalValue: safeTotalYield * 1.5, soldQuantity: safeTotalYield, saleDate: new Date().toISOString().split('T')[0], saleMethod: 'personal', paymentMethod: 'cash', weightTicket: '', notes: ''
    });
    
    // Stats for sorting & supplies credit-back
    const totalBoxesReceived = React.useMemo(() => {
        if (!Array.isArray(entries)) return 0;
        return entries.reduce((sum, e) => {
            const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
            return sum + count;
        }, 0);
    }, [entries]);

    const incompleteBoxesCount = React.useMemo(() => {
        if (!Array.isArray(entries)) return 0;
        return entries.filter(e => e.isHalfBox).reduce((sum, e) => {
            const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
            return sum + count;
        }, 0);
    }, [entries]);

    const initialPackagingId = React.useMemo(() => {
        if (!Array.isArray(entries)) return packagingItems && packagingItems.length > 0 ? packagingItems[0].id : '';
        const found = entries.find(e => e.packagingItemId)?.packagingItemId;
        return found || (packagingItems && packagingItems.length > 0 ? packagingItems[0].id : '');
    }, [entries, packagingItems]);

    const [actualFullBoxes, setActualFullBoxes] = useState<number>(totalBoxesReceived);
    const [selectedPkgItemId, setSelectedPkgItemId] = useState<string>(initialPackagingId);

    React.useEffect(() => {
        setActualFullBoxes(totalBoxesReceived);
    }, [totalBoxesReceived]);

    React.useEffect(() => {
        if (initialPackagingId) {
            setSelectedPkgItemId(initialPackagingId);
        }
    }, [initialPackagingId]);

    const emptyBoxesReturned = Math.max(0, totalBoxesReceived - (isNaN(actualFullBoxes) ? 0 : actualFullBoxes));
    
    React.useEffect(() => {
        setSaleDetails(prev => {
            const price = isNaN(prev.pricePerUnit) ? 0 : prev.pricePerUnit;
            return {
                ...prev,
                soldQuantity: safeTotalYield,
                totalValue: safeTotalYield * price
            };
        });
    }, [safeTotalYield]);

    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        onConfirm({ 
            action, 
            saleDetails: action === 'DIRECT_SALE' ? saleDetails : undefined, 
            identifer: identifier,
            actualFullBoxes: isNaN(actualFullBoxes) ? 0 : actualFullBoxes,
            emptyBoxesReturned,
            packagingItemId: selectedPkgItemId
        }); 
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b bg-gray-50">
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Finalize Harvest Logic</h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Supply Chain Destination</label>
                        <select value={action} onChange={(e) => setAction(e.target.value as PostHarvestAction)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500">
                            <option value="MARKETPLACE">1. Marketplace (Add to Offer Stock)</option>
                            <option value="DIRECT_SALE">2. Direct Sale (Terminal Event)</option>
                            <option value="COLD_STORAGE">3. Cold Storage (Awaiting Transaction)</option>
                        </select>
                    </div>

                    {/* Sorting & Consolidation Panel */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                        <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Sorting & Consolidation</h4>
                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <p className="text-xs font-bold text-slate-600">
                                <span className="text-indigo-600 font-black">{totalBoxesReceived}</span> boxes received from the field, including <span className="text-amber-600 font-black">{incompleteBoxesCount}</span> incomplete boxes.
                            </p>
                        </div>
                        
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Actual Full Boxes Post-Sorting</label>
                            <input 
                                type="number" 
                                min="0" 
                                max={totalBoxesReceived}
                                value={isNaN(actualFullBoxes) ? '' : actualFullBoxes} 
                                onChange={e => {
                                    const val = parseInt(e.target.value, 10);
                                    setActualFullBoxes(isNaN(val) ? 0 : val);
                                }} 
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm" 
                            />
                        </div>

                        {emptyBoxesReturned > 0 && (
                            <div className="space-y-2 p-3 bg-semibold bg-emerald-50 border border-emerald-100 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Supplies Credit-Back</span>
                                    <span className="text-xs font-black text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">+{emptyBoxesReturned} empty boxes</span>
                                </div>
                                <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-tight">Empty boxes automatically credited back to inventory:</p>
                                <select 
                                    value={selectedPkgItemId} 
                                    onChange={e => setSelectedPkgItemId(e.target.value)}
                                    className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold outline-none"
                                >
                                    <option value="">-- Choose Supplies Item --</option>
                                    {packagingItems.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (Current: {p.currentStock || 0})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Tracking Identifier</label>
                        <input 
                            value={identifier} 
                            onChange={e => setIdentifier(e.target.value)}
                            placeholder="e.g. MKT-ID-2024"
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-black outline-none focus:border-indigo-500" 
                        />
                        <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">* Stamped as unique record identifier in vault archives.</p>
                    </div>
                    
                    {action === 'DIRECT_SALE' && (
                        <div className="space-y-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <h4 className="font-bold text-sm text-emerald-800 uppercase tracking-tight">Direct Sale Registry</h4>
                            <input 
                                placeholder="Buyer / Customer Name" 
                                value={saleDetails.buyerName} 
                                onChange={e => setSaleDetails({...saleDetails, buyerName: e.target.value})} 
                                className="w-full p-3 bg-white border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 font-bold" 
                                list="finish-buyer-suggestions"
                                required 
                            />
                            <datalist id="finish-buyer-suggestions">
                                <option value="Saved to Stock" />
                                <option value="Consignment" />
                                <option value="Transfer" />
                                <option value="Export" />
                                <option value="საწყობში შენახვა" />
                                <option value="კონსიგნაცია" />
                                <option value="გადაცემა" />
                                <option value="ექსპორტი" />
                            </datalist>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] font-bold text-emerald-600">Price / Unit</label><input type="number" value={isNaN(saleDetails.pricePerUnit) ? '' : saleDetails.pricePerUnit} onChange={e => setSaleDetails({...saleDetails, pricePerUnit: parseFloat(e.target.value)})} className="w-full p-3 bg-white border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 font-bold" required /></div>
                                <div><label className="text-[10px] font-bold text-emerald-600">Qty (KG)</label><input type="number" value={isNaN(saleDetails.soldQuantity) ? '' : saleDetails.soldQuantity} onChange={e => setSaleDetails({...saleDetails, soldQuantity: parseFloat(e.target.value)})} className="w-full p-3 bg-white border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 font-bold" required /></div>
                            </div>
                            <div className="text-right font-black text-lg text-emerald-900 border-t border-emerald-200 pt-2">Total Yield Value: {formatCurrency(saleDetails.totalValue)}</div>
                        </div>
                    )}

                    {action === 'MARKETPLACE' && (
                        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 italic">
                            <p className="text-[10px] font-bold text-indigo-700">Creates a payload entry in harvested_produce stamped with <b>{identifier}</b>. Synchronizes with Commercial Market module.</p>
                        </div>
                    )}

                    {action === 'COLD_STORAGE' && (
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 italic">
                            <p className="text-[10px] font-bold text-blue-700">Yield items moved to repository under 'Cold Storage' tag. Status set to 'Awaiting Transaction'.</p>
                        </div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs">Cancel</button>
                        <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">Confirm & Archive</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const YieldByVarietyWidget: React.FC<{ yields?: YieldByVariety[], totalWeight: number }> = ({ yields = [], totalWeight }) => {
    const { t } = useLanguage();
    return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">{t('harvest.yield_by_variety')}</h3>
        <div className="space-y-3">
            {yields.map(({ variety, weightKg }) => (
                <div key={variety}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-gray-600">{variety}</span>
                        <span className="text-gray-800">{weightKg.toFixed(1)} kg</span>
                    </div>
                    <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full" style={{ width: `${(weightKg / (totalWeight || 1)) * 100}%` }}></div>
                    </div>
                </div>
            ))}
        </div>
    </div>
    );
};
const OperationLogWidget: React.FC<{ 
    entries: HarvestEntry[], 
    employees: Employee[], 
    onDetailedViewClick: () => void,
    onUpdateEntry: (entryId: string, updates: Partial<HarvestEntry>) => void,
    onDeleteEntry: (entryId: string) => void
}> = ({ entries, employees, onDetailedViewClick, onUpdateEntry, onDeleteEntry }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ netWeightKg: number }>({ netWeightKg: 0 });

    const handleEditStart = (e: React.MouseEvent, entry: HarvestEntry) => {
        e.stopPropagation();
        setEditingId(entry.id);
        setEditData({ netWeightKg: entry.netWeightKg || 0 });
    };

    const handleEditSave = (e: React.MouseEvent, entryId: string) => {
        e.stopPropagation();
        onUpdateEntry(entryId, { netWeightKg: editData.netWeightKg });
        setEditingId(null);
    };

    const handleEditCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
    };

    const handleDelete = (e: React.MouseEvent, entryId: string) => {
        e.stopPropagation();
        setDeletingId(entryId);
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-700 text-sm uppercase">Operation Log</h3>
                <button 
                    onClick={onDetailedViewClick}
                    className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg transition-colors border border-blue-100"
                >
                    Detailed View
                </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {[...(entries || [])].sort((a, b) => {
                    const sA = a.scannedAt || '';
                    const sB = b.scannedAt || '';
                    if (sA < sB) return 1;
                    if (sA > sB) return -1;
                    return 0;
                }).map(entry => {
                    const picker = employees.find(e => e.id === entry.employeeId);
                    const isEditing = editingId === entry.id;
                    const isSim = entry.id.includes('-sim-') || (entry as any).isSimulated;

                    return (
                        <div 
                            key={entry.id} 
                            onClick={onDetailedViewClick}
                            className={`p-2 rounded-lg border flex flex-col gap-2 text-xs cursor-pointer transition-all ${
                                isSim 
                                ? 'bg-amber-50/40 hover:bg-amber-50 border-amber-300 border-dashed hover:border-amber-400' 
                                : 'bg-white hover:border-indigo-300 hover:shadow-md border-gray-100'
                            } ${!isEditing && 'active:scale-[0.98]'}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-[10px]">{(picker?.name && typeof picker.name === 'string') ? picker.name.charAt(0) : 'P'}</div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-bold text-gray-800">{picker?.name}</p>
                                            {isSim && (
                                                <span className="text-[8px] font-black text-amber-700 bg-amber-100 border border-amber-200/50 px-1 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                                                    <Scale size={8} /> Sim Draft
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-400">{new Date(entry.scannedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {isEditing ? (
                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="number" 
                                                autoFocus
                                                value={isNaN(editData.netWeightKg) ? '' : editData.netWeightKg}
                                                onChange={(e) => setEditData({ netWeightKg: parseFloat(e.target.value) })}
                                                className="w-16 text-right px-1 py-0.5 border border-indigo-300 rounded font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500/20"
                                            />
                                            <span className="text-gray-800 font-bold">kg</span>
                                        </div>
                                    ) : (
                                        <p className="font-bold text-gray-800">{entry.netWeightKg.toFixed(1)} kg</p>
                                    )}
                                    <p className="text-gray-400">{entry.variety}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100">
                                <div className="flex flex-row gap-1">
                                    {entry.sectorId && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded uppercase">Sec: {entry.sectorId.substring(0,6)}</span>}
                                    {entry.trenchId && <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded uppercase">Tr: {entry.trenchId.substring(0,6)}</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                    {isEditing ? (
                                        <>
                                            <button onClick={(e) => handleEditSave(e, entry.id)} className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-[10px] font-bold transition-colors">
                                                Save
                                            </button>
                                            <button onClick={handleEditCancel} className="px-2 py-1 bg-slate-100 text-slate-650 hover:bg-slate-200 rounded text-[10px] font-bold transition-colors">
                                                Cancel
                                            </button>
                                        </>
                                    ) : deletingId === entry.id ? (
                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                            <span className="text-[9px] font-bold text-slate-500 mr-1">Confirm?</span>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteEntry(entry.id);
                                                    setDeletingId(null);
                                                }} 
                                                className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 rounded text-[10px] font-bold transition-colors"
                                            >
                                                Yes
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeletingId(null);
                                                }} 
                                                className="px-2 py-1 bg-slate-100 text-slate-650 hover:bg-slate-200 rounded text-[10px] font-bold transition-colors"
                                            >
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={(e) => handleEditStart(e, entry)} className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold transition-colors">
                                                Edit
                                            </button>
                                            <button onClick={(e) => handleDelete(e, entry.id)} className="px-2 py-1 bg-red-50 text-red-505 hover:bg-red-100 rounded text-[10px] font-bold transition-colors">
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface HarvestDashboardProps {
    event: HarvestEvent;
    onBack: () => void;
    harvestEvents: HarvestEvent[];
    onSetHarvestEvents: (events: HarvestEvent[]) => void;
    harvestEntries: HarvestEntry[];
    onSetHarvestEntries: (entries: HarvestEntry[]) => void;
    plantationFeatures: PlantationFeature[];
    inventoryItems: InventoryItem[];
    employees: Employee[];
    harvestLogs: HarvestLog[];
    onSetHarvestLogs: (logs: HarvestLog[] | ((prev: HarvestLog[]) => HarvestLog[])) => void;
    onSetInventoryItems: (items: InventoryItem[]) => void;
    layers: Layer[];
    mapProps: Omit<MapComponentProps, 'children' | 'plantationFeatures' | 'layers'>;
    machinery: Machinery[];
    onSetMachinery?: (machinery: Machinery[]) => void;
    crops: Crop[];
    cropVarieties?: string[];
    hardwareDevices?: any[];
    accounts?: Account[];
    onSetAccounts?: (accounts: Account[]) => void;
    transactions?: Transaction[];
    onSetTransactions?: (txs: Transaction[]) => void;
    stockTransactions?: StockTransaction[];
    onSetStockTransactions?: (txs: StockTransaction[]) => void;
    onSetAppMode?: (mode: import('../../types').AppMode) => void;
    onLogActivity?: (action: string, module: import('../../types').AppMode, status: 'success' | 'failure' | 'alert', report?: string) => Promise<void>;
    currentUser?: User | null;
    onSetEmployees?: (employees: Employee[]) => void;
    roles?: Role[];
    employeeGroups?: EmployeeGroup[];
    onSetEmployeeGroups?: (groups: EmployeeGroup[]) => void;
}

const HarvestDashboard: React.FC<HarvestDashboardProps> = (props) => {
    const { event, plantationFeatures, harvestEntries, onSetHarvestEntries, inventoryItems, onSetInventoryItems, employees, harvestLogs, onSetHarvestLogs, harvestEvents, onBack, machinery, onSetMachinery, onSetHarvestEvents, transactions, onSetTransactions, onLogActivity, currentUser, onSetEmployees, roles, crops, cropVarieties, employeeGroups, onSetEmployeeGroups } = props;
    const { t, currency, formatCurrency } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    const isWeigher = useMemo(() => {
        if (!currentUser) return false;
        const userRoleStr = (currentUser.role || '').toLowerCase();
        const rolesList = (currentUser.roles || []).map(r => r.toLowerCase());
        return userRoleStr === 'weigher' || rolesList.includes('weigher') || rolesList.includes('worker') || rolesList.includes('guest') || rolesList.includes('daily worker');
    }, [currentUser]);

    const durationHours = calculateNetDurationHours(event);    
    const [isSimulationMode, setIsSimulationMode] = useState<boolean>(() => localStorage.getItem('harvest_simulation_mode') === 'true');
    const [simulatedEntries, setSimulatedEntries] = useState<HarvestEntry[]>(() => {
        const stored = localStorage.getItem('harvest_simulated_entries_' + event.id);
        return stored ? JSON.parse(stored) : [];
    });

    // Real-Time Presence & Collaboration Engine
    const [activeOnlineUsers, setActiveOnlineUsers] = useState<PresenceUser[]>([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isOnlineUsersModalOpen, setIsOnlineUsersModalOpen] = useState(false);
    const [isHarvestBoxQrOpen, setIsHarvestBoxQrOpen] = useState(false);

    useEffect(() => {
        if (!event?.id) return;
        const currentUserId = currentUser?.id || 'usr_' + Math.random().toString(36).substring(2, 6);
        const currentUserName = currentUser?.name || 'Manager';
        const currentUserRole = currentUser?.role || 'User';

        PresenceEngine.getInstance().announcePresence(event.id, {
            userId: currentUserId,
            userName: currentUserName,
            role: currentUserRole,
            activeView: 'HarvestDashboard'
        });

        const sub = PresenceEngine.getInstance().subscribePresence(event.id, (users) => {
            setActiveOnlineUsers(users);
        });

        return () => {
            sub.unsubscribe();
            PresenceEngine.getInstance().leavePresence(event.id, currentUserId);
        };
    }, [event?.id, currentUser]);

    useEffect(() => {
        localStorage.setItem('harvest_simulated_entries_' + event.id, JSON.stringify(simulatedEntries));
    }, [simulatedEntries, event.id]);

    const toggleSimulationMode = (enabled: boolean) => {
        setIsSimulationMode(enabled);
        localStorage.setItem('harvest_simulation_mode', String(enabled));
        if (enabled) {
            toast.success(t('toast.sim_active'), {
                description: t('toast.sim_active_desc')
            });
        } else {
            toast.info(t('toast.sim_inactive'), {
                description: t('toast.sim_inactive_desc')
            });
        }
    };

    const handleCommitSimulation = () => {
        if (simulatedEntries.length === 0) {
            toast.error(t('toast.no_commit'));
            return;
        }

        const timestampMinute = (scannedAtStr: string) => {
            return new Date(scannedAtStr).toISOString().substring(0, 16); 
        };

        const generateHash = (e: HarvestEntry) => {
            const timeMin = timestampMinute(e.scannedAt);
            const picker = e.employeeId || 'unknown';
            const weight = (e.netWeightKg || 0).toFixed(1);
            const trench = e.trenchId || 'notrench';
            return `hent-hash-${picker}-${trench}-${timeMin}-${weight}`.replace(/[^a-zA-Z0-9-]/g, '_');
        };

        const uniqueSimsMap = new Map<string, HarvestEntry>();
        let localDuplicatesFiltered = 0;

        simulatedEntries.forEach(entry => {
            const hash = generateHash(entry);
            if (uniqueSimsMap.has(hash)) {
                localDuplicatesFiltered++;
            } else {
                uniqueSimsMap.set(hash, {
                    ...entry,
                    id: hash
                });
            }
        });

        const uniqueSimulatedList = Array.from(uniqueSimsMap.values());
        const activeRealEventEntries = harvestEntries.filter(e => e.harvestEventId === event.id);
        const realEventHashes = new Set(activeRealEventEntries.map(e => {
            if (e.id.startsWith('hent-hash-')) return e.id;
            return generateHash(e);
        }));

        let cloudDuplicatesFiltered = 0;
        const finalEntriesToCommit: HarvestEntry[] = [];

        uniqueSimulatedList.forEach(entry => {
            if (realEventHashes.has(entry.id)) {
                cloudDuplicatesFiltered++;
            } else {
                finalEntriesToCommit.push(entry);
            }
        });

        const totalDuplicates = localDuplicatesFiltered + cloudDuplicatesFiltered;

        if (finalEntriesToCommit.length === 0) {
            toast.success(t('toast.zero_duplicates'), {
                description: t('toast.all_duplicates').replace('{count}', String(simulatedEntries.length))
            });
            setSimulatedEntries([]);
            return;
        }

        onSetHarvestEntries([...harvestEntries, ...finalEntriesToCommit]);

        const currentYields = event.yieldByVariety ? [...event.yieldByVariety] : [];
        let addedWeight = 0;
        let addedVerified = 0;
        let addedEstimated = 0;
        
        finalEntriesToCommit.forEach(newEntry => {
            addedWeight += newEntry.netWeightKg;
            addedVerified += newEntry.verifiedWeightKg || 0;
            addedEstimated += newEntry.estimatedWeightKg || 0;

            const varietyIndex = currentYields.findIndex(y => y.variety === newEntry.variety);
            if (varietyIndex > -1) {
                currentYields[varietyIndex].weightKg += newEntry.netWeightKg;
            } else if (newEntry.variety) {
                currentYields.push({ variety: newEntry.variety, weightKg: newEntry.netWeightKg });
            }
        });

        const updatedEvent: HarvestEvent = {
            ...event,
            totalNetWeightKg: (event.totalNetWeightKg || 0) + addedWeight,
            totalVerifiedWeightKg: (event.totalVerifiedWeightKg || 0) + addedVerified,
            totalEstimatedWeightKg: (event.totalEstimatedWeightKg || 0) + addedEstimated,
            totalBoxes: (event.totalBoxes || 0) + finalEntriesToCommit.length,
            yieldByVariety: currentYields,
            isSyncRequired: true,
            syncStatus: 'local_synced'
        };

        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));

        toast.success(t('toast.batch_success'), {
            description: t('toast.batch_success_desc')
                .replace('{count}', String(finalEntriesToCommit.length))
                .replace('{duplicates}', String(totalDuplicates))
        });

        if (onLogActivity) {
            onLogActivity(
                'Yield Batch Committed', 
                'harvesting', 
                'success', 
                `[Simulation Sync] Committed ${finalEntriesToCommit.length} entries for ${event.name}. Filtered ${totalDuplicates} duplicates.`
            );
        }

        setSimulatedEntries([]);
    };

    const eventEntries = useMemo(() => {
        const realEntries = harvestEntries.filter(e => e.harvestEventId === event.id);
        const simEntries = isSimulationMode 
            ? simulatedEntries.map(e => ({ ...e, isSimulated: true } as any as HarvestEntry))
            : [];
        return [...realEntries, ...simEntries];
    }, [harvestEntries, simulatedEntries, event.id, isSimulationMode]);

    const sectors = (plantationFeatures || []).filter(f => event.sectorIds?.includes(f.id) && (f.type === 'area' || f.type === 'sector')) as AreaPlantationFeature[];
    const sectorNames = sectors.map(s => s.name).join(', ');
    const eventLogs = useMemo(() => (harvestLogs || []).filter(l => l.harvestEventId === event.id), [harvestLogs, event.id]);

    const sendboxData = useMemo(() => {
        const workerMap = new Map<string, { name: string, boxes: number, lastScanned: string }>();
        const pickerLookup = new Map<string, string>();
        employees.forEach(p => {
            let strName = 'Worker';
            if (typeof p.name === 'string') strName = p.name;
            else if (p.name && typeof p.name === 'object') strName = (p.name as any).name || (p.name as any).displayName || (p.name as any).email || 'Worker';
            pickerLookup.set(p.id, strName);
        });
        
        eventEntries.forEach(entry => {
            let name = pickerLookup.get(entry.employeeId);
            if (!name) {
                const entryAny = entry as any;
                if (typeof entryAny.workerName === 'string') name = entryAny.workerName;
                else if (entryAny.workerName && typeof entryAny.workerName === 'object') name = entryAny.workerName.name || entryAny.workerName.displayName || 'Worker';
                else name = `Worker #${entry.employeeId || ''}`;
            }
            const current = workerMap.get(entry.employeeId) || { name, boxes: 0, lastScanned: entry.scannedAt || '' };
            current.boxes += entry.boxCount || 1;
            const entryScanned = entry.scannedAt || '';
            if (entryScanned > current.lastScanned) {
                current.lastScanned = entryScanned;
            }
            workerMap.set(entry.employeeId, current);
        });
        
        return Array.from(workerMap.values()).sort((a, b) => b.boxes - a.boxes);
    }, [eventEntries, employees]);

    const activeVarieties = useMemo(() => {
        const varietySet = new Set<string>();
        
        // 1. Get varieties from sectors
        sectors.forEach(s => {
            if (s.cropVariety) {
                if (Array.isArray(s.cropVariety)) {
                    s.cropVariety.forEach(v => varietySet.add(v));
                } else {
                    varietySet.add(s.cropVariety);
                }
            }
        });

        // 2. IMPORTANT: If sectors are empty or no varieties, get from specific crop types in the sectors
        sectors.forEach(s => {
            if (s.cropType) {
                const globalCrop = props.crops?.find(c => c.name.toLowerCase() === s.cropType?.toLowerCase());
                if (globalCrop && globalCrop.varieties) {
                    globalCrop.varieties.forEach(v => varietySet.add(v));
                }
            }
        });

        // 3. Fallback: If still nothing, or to browse all registered varieties, get all varieties from the crop database
        if (props.crops) {
            props.crops.forEach(c => {
                if (c.varieties) {
                    c.varieties.forEach(v => varietySet.add(v));
                }
            });
        }
        
        if (varietySet.size === 0) varietySet.add('Standard');
        
        return Array.from(varietySet);
    }, [sectors, props.crops]);

    const modalPickers = useMemo(() => {
        return event.assignedPickers.map(p => employees.find(e => e.id === p.employeeId)).filter(Boolean) as Employee[];
    }, [event.assignedPickers, employees]);

    const modalPackagingItems = useMemo(() => {
        return inventoryItems.filter(i => i.category === 'Packaging');
    }, [inventoryItems]);

    const modalAllSectors = useMemo(() => {
        return (plantationFeatures || []).filter(f => f.type === 'area' || f.type === 'sector') as AreaPlantationFeature[];
    }, [plantationFeatures]);

    const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [showDailyHarvestModal, setShowDailyHarvestModal] = useState(false);
    const [dailyHarvestModalTab, setDailyHarvestModalTab] = useState<'stats' | 'logistics'>('stats');
    const [isOperationLogOpen, setIsOperationLogOpen] = useState(false);
    const [selectedVarieties, setSelectedVarieties] = useState<string[]>(activeVarieties.slice(0, 1));
    const [visibleLogsDate, setVisibleLogsDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
    const [isAddingOpexItem, setIsAddingOpexItem] = useState(false);
    const [newOpexItemName, setNewOpexItemName] = useState("");
    const [newOpexItemCost, setNewOpexItemCost] = useState("");

    const [isFleetManagerOpen, setIsFleetManagerOpen] = useState(false);
    const [isMaterialsModalOpen, setIsMaterialsModalOpen] = useState(false);

    // Packaging & Punet OPEX Settings box state
    const [boxQtyInput, setBoxQtyInput] = useState<number | string>(event.totalBoxes || 0);
    const [punetQtyInput, setPunetQtyInput] = useState<number | string>(event.physicalPunets || ((event.totalBoxes || 0) * (event.punetsPerBox || 12)));
    const [punetsPerBoxInput, setPunetsPerBoxInput] = useState<number | string>(event.punetsPerBox || 12);

    useEffect(() => {
        setBoxQtyInput(event.totalBoxes || 0);
        setPunetQtyInput(event.physicalPunets || ((event.totalBoxes || 0) * (event.punetsPerBox || 12)));
        setPunetsPerBoxInput(event.punetsPerBox || 12);
    }, [event.totalBoxes, event.physicalPunets, event.punetsPerBox]);

    const handleSyncPackagingQuantities = () => {
        const boxes = Number(boxQtyInput) || 0;
        const punets = Number(punetQtyInput) || 0;
        const ppb = Number(punetsPerBoxInput) || 12;

        // Charge / Deduct used boxes and punets from stock inventory
        if (inventoryItems && onSetInventoryItems) {
            let updatedItems = [...inventoryItems];
            let chargedMsgs: string[] = [];

            const boxItem = updatedItems.find(i => i.category === 'Packaging' && i.name.toLowerCase().includes('box')) ||
                            updatedItems.find(i => i.name.toLowerCase().includes('box'));
            if (boxItem && boxes > 0) {
                updatedItems = updatedItems.map(i => i.id === boxItem.id ? { ...i, currentStock: Math.max(0, i.currentStock - boxes) } : i);
                chargedMsgs.push(`${boxes} boxes charged from stock (${boxItem.name})`);
            }

            const punetItem = updatedItems.find(i => i.category === 'Packaging' && i.name.toLowerCase().includes('punet')) ||
                             updatedItems.find(i => i.name.toLowerCase().includes('punet'));
            if (punetItem && punets > 0) {
                updatedItems = updatedItems.map(i => i.id === punetItem.id ? { ...i, currentStock: Math.max(0, i.currentStock - punets) } : i);
                chargedMsgs.push(`${punets} punets charged from stock (${punetItem.name})`);
            }

            if (chargedMsgs.length > 0) {
                onSetInventoryItems(updatedItems);
            }
        }

        const updatedEvent: HarvestEvent = {
            ...event,
            totalBoxes: boxes,
            physicalPunets: punets,
            totalPunets: punets,
            punetsPerBox: ppb,
            isSyncRequired: true,
            syncStatus: 'pending'
        };

        const updatedEvents = harvestEvents.map(e => e.id === event.id ? updatedEvent : e);
        onSetHarvestEvents(updatedEvents);

        if (onLogActivity) {
            onLogActivity('Synced Packaging Quantities', 'harvesting', 'success', `Box Qty: ${boxes}, Punet Qty: ${punets}, Punets/Box: ${ppb}`);
        }

        toast.success(`Synced Packaging & Charged Stock! Boxes: ${boxes}, Punets: ${punets}`);
    };

    const handleUpdateEntry = (entryId: string, updates: Partial<HarvestEntry>) => {
        if (entryId.includes('-sim-')) {
            setSimulatedEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...updates } : e));
            toast.success("Simulated sandbox entry updated.");
            return;
        }
        const entry = eventEntries.find(e => e.id === entryId);
        if (entry && onLogActivity && Object.keys(updates).length > 0) {
            const worker = employees.find(e => e.id === entry.employeeId);
            const userDisp = auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown User';
            const attrChanged = 'grossWeightKg' in updates ? 'gross kg' : Object.keys(updates).join(', ');
            const valChanged = 'grossWeightKg' in updates ? updates.grossWeightKg : Object.values(updates)[0];
            onLogActivity('Manual Adjustments Updated', 'harvesting', 'alert', `harvest event:${event.id} / Advanced Yield & Payroll Controls,worker ${worker?.name || 'Unknown'} ${attrChanged} changed to ${valChanged} - user:${userDisp}`);
        }
        
        const updatedGlobalEntries = harvestEntries.map(e => e.id === entryId ? { ...e, ...updates } : e);
        onSetHarvestEntries(updatedGlobalEntries);

        // Recalculate event properties reactively!
        const eventId = entry?.harvestEventId || event.id;
        const currentEventEntries = updatedGlobalEntries.filter(e => e.harvestEventId === eventId);
        
        // Recalculate variety-wise yields
        const varietyYields: Record<string, { weightKg: number; boxCount: number }> = {};
        let totalNet = 0;
        let totalBoxes = 0;
        
        currentEventEntries.forEach(e => {
            const v = e.variety || 'Unknown';
            if (!varietyYields[v]) {
                varietyYields[v] = { weightKg: 0, boxCount: 0 };
            }
            varietyYields[v].weightKg += e.netWeightKg || 0;
            varietyYields[v].boxCount += e.boxCount || 1;
            totalNet += e.netWeightKg || 0;
            totalBoxes += e.boxCount || 1;
        });
        
        const yieldByVariety = Object.entries(varietyYields).map(([variety, item]) => ({
            variety,
            weightKg: item.weightKg,
            boxCount: item.boxCount
        }));
        
        const uniqueVarieties = Object.keys(varietyYields);
        const targetEvent = harvestEvents.find(e => e.id === eventId) || event;
        
        const updatedEvent = {
            ...targetEvent,
            totalNetWeightKg: totalNet,
            totalBoxes: totalBoxes,
            yieldByVariety,
            varieties: uniqueVarieties,
            ...(targetEvent.status === 'completed' ? {
                finalNetYieldKg: totalNet,
                finalBoxesCount: totalBoxes
            } : {})
        };
        
        onSetHarvestEvents(harvestEvents.map(e => e.id === eventId ? updatedEvent : e));

        // Sync inventory items reactively if the event is completed!
        if (targetEvent.status === 'completed' && inventoryItems && onSetInventoryItems) {
            const otherInventoryItems = inventoryItems.filter(item => item.relatedHarvestId !== eventId);
            
            const varietyData: Record<string, { net: number; boxes: number }> = {};
            let totalVarietyWeight = 0;
            
            currentEventEntries.forEach(e => {
                const v = e.variety || 'Unknown';
                if (!varietyData[v]) {
                    varietyData[v] = { net: 0, boxes: 0 };
                }
                varietyData[v].net += e.netWeightKg || 0;
                varietyData[v].boxes += e.boxCount || 1;
                totalVarietyWeight += e.netWeightKg || 0;
            });
            
            if (totalVarietyWeight === 0) {
                varietyData['Unknown'] = { net: totalNet, boxes: totalBoxes };
                totalVarietyWeight = totalNet;
            }
            
            const recomputedInventoryItems: InventoryItem[] = Object.entries(varietyData).map(([variety, vInfo], index) => {
                const proportion = totalVarietyWeight > 0 ? vInfo.net / totalVarietyWeight : 1;
                const varietyYield = vInfo.net;
                const varietyBoxes = vInfo.boxes;
                const varietyCash = (targetEvent.saleDetails?.totalValue || 0) * proportion;
                
                return {
                    id: `inv-h-${eventId}-${variety}-${index}`,
                    name: `${updatedEvent.name} - ${updatedEvent.marketIdentifier || 'LOAD'} (${variety})`,
                    category: 'Produce',
                    currentStock: varietyYield,
                    unitOfMeasure: 'kg',
                    status: updatedEvent.postHarvestAction === 'COLD_STORAGE' ? 'Awaiting Transaction' : 'In Stock',
                    tags: updatedEvent.postHarvestAction === 'COLD_STORAGE' ? ['Cold Storage', 'Harvested'] : ['Harvested'],
                    relatedHarvestId: updatedEvent.id,
                    harvestIdentifier: updatedEvent.marketIdentifier,
                    unitCost: updatedEvent.saleDetails?.pricePerUnit || 0,
                    minStockThreshold: 0,
                    batch_id: `batch-${eventId}-${updatedEvent.marketIdentifier || '0'}-${variety}`,
                    date: updatedEvent.actualEndDate?.split('T')[0] || new Date().toISOString().split('T')[0],
                    rate: 1.0,
                    variety: variety,
                    varietyKg: varietyYield,
                    variety2Kg: 0,
                    depositLLC: 0,
                    physicalCash: varietyCash,
                    physicalBoxes: varietyBoxes,
                    depositedDeposit: false
                };
            });
            
            onSetInventoryItems([...otherInventoryItems, ...recomputedInventoryItems]);
        }
    };

    const handleDeleteEntry = useCallback((entryId: string) => {
        if (entryId.includes('-sim-')) {
            setSimulatedEntries(prev => prev.filter(e => e.id !== entryId));
            toast.success("Simulated sandbox entry deleted.");
            return;
        }
        const entry = eventEntries.find(e => e.id === entryId);
        if (entry && onLogActivity) {
            const worker = employees.find(e => e.id === entry.employeeId);
            const userDisp = auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown User';
            onLogActivity('Manual Adjustments Updated', 'harvesting', 'alert', `harvest event:${event.id} / Advanced Yield & Payroll Controls,worker ${worker?.name || 'Unknown'} yield entry fully deleted - user:${userDisp}`);
        }
        
        const updatedGlobalEntries = harvestEntries.filter(e => e.id !== entryId);
        onSetHarvestEntries(updatedGlobalEntries);

        // Recalculate event properties reactively!
        const eventId = entry?.harvestEventId || event.id;
        const currentEventEntries = updatedGlobalEntries.filter(e => e.harvestEventId === eventId);
        
        // Recalculate variety-wise yields
        const varietyYields: Record<string, { weightKg: number; boxCount: number }> = {};
        let totalNet = 0;
        let totalBoxes = 0;
        
        currentEventEntries.forEach(e => {
            const v = e.variety || 'Unknown';
            if (!varietyYields[v]) {
                varietyYields[v] = { weightKg: 0, boxCount: 0 };
            }
            varietyYields[v].weightKg += e.netWeightKg || 0;
            varietyYields[v].boxCount += e.boxCount || 1;
            totalNet += e.netWeightKg || 0;
            totalBoxes += e.boxCount || 1;
        });
        
        const yieldByVariety = Object.entries(varietyYields).map(([variety, item]) => ({
            variety,
            weightKg: item.weightKg,
            boxCount: item.boxCount
        }));
        
        const uniqueVarieties = Object.keys(varietyYields);
        const targetEvent = harvestEvents.find(e => e.id === eventId) || event;
        
        const updatedEvent = {
            ...targetEvent,
            totalNetWeightKg: totalNet,
            totalBoxes: totalBoxes,
            yieldByVariety,
            varieties: uniqueVarieties,
            ...(targetEvent.status === 'completed' ? {
                finalNetYieldKg: totalNet,
                finalBoxesCount: totalBoxes
            } : {})
        };
        
        onSetHarvestEvents(harvestEvents.map(e => e.id === eventId ? updatedEvent : e));

        // Sync inventory items reactively if the event is completed!
        if (targetEvent.status === 'completed' && inventoryItems && onSetInventoryItems) {
            const otherInventoryItems = inventoryItems.filter(item => item.relatedHarvestId !== eventId);
            
            const varietyData: Record<string, { net: number; boxes: number }> = {};
            let totalVarietyWeight = 0;
            
            currentEventEntries.forEach(e => {
                const v = e.variety || 'Unknown';
                if (!varietyData[v]) {
                    varietyData[v] = { net: 0, boxes: 0 };
                }
                varietyData[v].net += e.netWeightKg || 0;
                varietyData[v].boxes += e.boxCount || 1;
                totalVarietyWeight += e.netWeightKg || 0;
            });
            
            if (totalVarietyWeight === 0) {
                varietyData['Unknown'] = { net: totalNet, boxes: totalBoxes };
                totalVarietyWeight = totalNet;
            }
            
            const recomputedInventoryItems: InventoryItem[] = Object.entries(varietyData).map(([variety, vInfo], index) => {
                const proportion = totalVarietyWeight > 0 ? vInfo.net / totalVarietyWeight : 1;
                const varietyYield = vInfo.net;
                const varietyBoxes = vInfo.boxes;
                const varietyCash = (targetEvent.saleDetails?.totalValue || 0) * proportion;
                
                return {
                    id: `inv-h-${eventId}-${variety}-${index}`,
                    name: `${updatedEvent.name} - ${updatedEvent.marketIdentifier || 'LOAD'} (${variety})`,
                    category: 'Produce',
                    currentStock: varietyYield,
                    unitOfMeasure: 'kg',
                    status: updatedEvent.postHarvestAction === 'COLD_STORAGE' ? 'Awaiting Transaction' : 'In Stock',
                    tags: updatedEvent.postHarvestAction === 'COLD_STORAGE' ? ['Cold Storage', 'Harvested'] : ['Harvested'],
                    relatedHarvestId: updatedEvent.id,
                    harvestIdentifier: updatedEvent.marketIdentifier,
                    unitCost: updatedEvent.saleDetails?.pricePerUnit || 0,
                    minStockThreshold: 0,
                    batch_id: `batch-${eventId}-${updatedEvent.marketIdentifier || '0'}-${variety}`,
                    date: updatedEvent.actualEndDate?.split('T')[0] || new Date().toISOString().split('T')[0],
                    rate: 1.0,
                    variety: variety,
                    varietyKg: varietyYield,
                    variety2Kg: 0,
                    depositLLC: 0,
                    physicalCash: varietyCash,
                    physicalBoxes: varietyBoxes,
                    depositedDeposit: false
                };
            });
            
            onSetInventoryItems([...otherInventoryItems, ...recomputedInventoryItems]);
        }
    }, [eventEntries, employees, onLogActivity, event, harvestEntries, onSetHarvestEntries, harvestEvents, onSetHarvestEvents, inventoryItems, onSetInventoryItems]);

    const filteredEntries = useMemo(() => {
        if (selectedVarieties.length === 0) return eventEntries;
        return eventEntries.filter(e => selectedVarieties.includes(e.variety));
    }, [eventEntries, selectedVarieties]);

    const filteredTotals = useMemo(() => {
        let eventTotalTare = 0;
        let eventTotalBoxesForTare = 0;
        eventEntries.forEach(e => {
            const derivedTare = (e.grossWeightKg ?? e.netWeightKg ?? 0) - (e.netWeightKg || 0);
            eventTotalTare += e.tareWeightKg !== undefined ? e.tareWeightKg : Math.max(0, derivedTare);
            eventTotalBoxesForTare += e.boxCount || 1;
        });
        const eventTareWeightAverage = eventTotalBoxesForTare > 0 ? eventTotalTare / eventTotalBoxesForTare : 0;

        let totalWeight = 0;
        let totalBoxes = 0;
        let totalGrossWeight = 0;
        let manualAdditions = 0;
        
        const varietyYields: Record<string, number> = {};
        activeVarieties.forEach(v => {
            varietyYields[v] = 0;
        });

        filteredEntries.forEach(e => {
            varietyYields[e.variety] = (varietyYields[e.variety] || 0) + (e.netWeightKg || 0);
        });

        const pickerFinalWeights: Record<string, number> = {};
        const pickerFinalBoxes: Record<string, number> = {};
        const pickerFinalGrossWeights: Record<string, number> = {};
        
        // Fast Map grouping of eventEntries by employeeId: O(N)
        const entriesByEmployee = new Map<string, typeof eventEntries>();
        eventEntries.forEach(e => {
            if (e.employeeId) {
                let list = entriesByEmployee.get(e.employeeId);
                if (!list) {
                    list = [];
                    entriesByEmployee.set(e.employeeId, list);
                }
                list.push(e);
            }
        });

        (event.assignedPickers || []).forEach(picker => {
            const pickerEntries = entriesByEmployee.get(picker.employeeId) || [];
            const scannedWeight = pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
            const scannedBoxes = pickerEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
            const scannedGross = pickerEntries.reduce((sum, e) => sum + (e.grossWeightKg ?? ((e.netWeightKg || 0) + (e.boxCount || 1) * eventTareWeightAverage)), 0);
            
            pickerFinalWeights[picker.employeeId] = picker.manualNetWeight ?? scannedWeight;
            pickerFinalBoxes[picker.employeeId] = picker.manualBoxes ?? scannedBoxes;
            
            if (picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined) {
                pickerFinalGrossWeights[picker.employeeId] = pickerFinalWeights[picker.employeeId] + (pickerFinalBoxes[picker.employeeId] * eventTareWeightAverage);
            } else {
                pickerFinalGrossWeights[picker.employeeId] = scannedGross;
            }
        });
        
        // Fast Set lookup for assigned pickers: O(M)
        const assignedPickerIds = new Set((event.assignedPickers || []).map(p => p.employeeId));
        const unassignedEntries = eventEntries.filter(e => !assignedPickerIds.has(e.employeeId));
        const unassignedWeight = unassignedEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        const unassignedBoxes = unassignedEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
        const unassignedGrossWeight = unassignedEntries.reduce((sum, e) => sum + (e.grossWeightKg ?? ((e.netWeightKg || 0) + (e.boxCount || 1) * eventTareWeightAverage)), 0);

        const globalTotalWeight = Object.values(pickerFinalWeights).reduce((a, b) => a + b, 0) + unassignedWeight;
        const globalTotalBoxes = Object.values(pickerFinalBoxes).reduce((a, b) => a + b, 0) + unassignedBoxes;
        const globalTotalGrossWeight = Object.values(pickerFinalGrossWeights).reduce((a, b) => a + b, 0) + unassignedGrossWeight;
        
        const scannedGlobalWeight = eventEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        manualAdditions = globalTotalWeight - scannedGlobalWeight;

        if (selectedVarieties.length === activeVarieties.length) {
            totalWeight = globalTotalWeight;
            totalBoxes = globalTotalBoxes;
            totalGrossWeight = globalTotalGrossWeight;
        } else {
            totalWeight = filteredEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
            totalBoxes = filteredEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
            totalGrossWeight = filteredEntries.reduce((sum, e) => sum + (e.grossWeightKg ?? ((e.netWeightKg || 0) + (e.boxCount || 1) * eventTareWeightAverage)), 0);
            if (manualAdditions !== 0 && totalWeight > 0) {
                // Determine missing scale proportional to variety
                const factor = scannedGlobalWeight > 0 ? (globalTotalWeight / scannedGlobalWeight) : 1;
                totalWeight = totalWeight * factor;
                totalGrossWeight = totalGrossWeight * factor;
            }
        }
        
        const yieldByVariety = Object.entries(varietyYields)
            .map(([variety, weightKg]) => ({
                variety,
                weightKg
            }))
            .filter(y => y.weightKg > 0);

        if (manualAdditions !== 0 && selectedVarieties.length === activeVarieties.length) {
            yieldByVariety.push({ variety: 'Manual Adjustments', weightKg: manualAdditions });
        }

        return { totalWeight, totalBoxes, totalGrossWeight, yieldByVariety };
    }, [filteredEntries, activeVarieties, eventEntries, event.assignedPickers, selectedVarieties.length, event.defaultBoxWeightKg]);

    const calculatedPunetsFromEntries = useMemo(() => {
        let pnts = 0;
        (eventEntries || []).forEach(e => {
            if (!e) return;
            const pVal = e.punets ?? e.punetCount;
            if (pVal !== undefined) {
                pnts += pVal;
            } else if (e.isHalfBox) {
                pnts += Math.round((e.boxCount || 1) * (((event?.punetsPerBox || 12)) / 2));
            } else {
                pnts += Math.round((e.boxCount || 1) * (event?.punetsPerBox || 12));
            }
        });
        return pnts;
    }, [eventEntries, event?.punetsPerBox]);

    const filteredEventLogs = useMemo(() => {
        if (!visibleLogsDate) return eventLogs;
        const filtered = eventLogs.filter(l => {
            const logDate = l.date || (l as any).createdAt;
            if (!logDate) return false;
            return logDate.split('T')[0] === visibleLogsDate;
        });
        return filtered;
    }, [eventLogs, visibleLogsDate]);

    const toggleVariety = (v: string) => {
        setSelectedVarieties(prev => 
            prev.includes(v) 
                ? (prev.length > 1 ? prev.filter(item => item !== v) : prev) 
                : [...prev, v]
        );
    };
    const [editingLog, setEditingLog] = useState<HarvestLog | null>(null);
    const [isBoxScannerOpen, setIsBoxScannerOpen] = useState(false);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logPopup, setLogPopup] = useState<{ log: HarvestLog; latlng: L.LatLng; trenchCount: number; trenchIds: string[]; totalWeight: number; totalBoxes: number } | null>(null);
    const [activeDrawingTool, setActiveDrawingTool] = useState<ActiveDrawingTool>({ tool: null });
    const [drawnGeometry, setDrawnGeometry] = useState<[number, number][]>([]);

    const [searchFlyToBounds, setSearchFlyToBounds] = useState<L.LatLngBoundsExpression | null>(null);
    const [hasFlownToInitial, setHasFlownToInitial] = useState(false);
    
    const flyToBounds = useMemo(() => {
        if (searchFlyToBounds) return searchFlyToBounds;
        if (hasFlownToInitial) return null;
        
        const sectorGeometries = event.sectorIds
            .map(sid => plantationFeatures.find(f => f.id === sid))
            .filter((f): f is AreaPlantationFeature => {
                if (!f) return false;
                if (f.type !== 'area') return false;
                let geom = f.geometry;
                if (typeof geom === 'string') {
                    try { geom = JSON.parse(geom); } catch { return false; }
                }
                return Array.isArray(geom) && geom.length > 0;
            })
            .flatMap(f => {
                let geom = f.geometry;
                if (typeof geom === 'string') {
                    try { geom = JSON.parse(geom); } catch { return []; }
                }
                if (!Array.isArray(geom)) return [];
                return geom
                    .filter(isValidCoordinate)
                    .map(p => [
                        typeof p[0] === 'string' ? parseFloat(p[0]) : p[0],
                        typeof p[1] === 'string' ? parseFloat(p[1]) : p[1]
                    ] as [number, number]);
            });
            
        if (sectorGeometries.length > 0) {
            try {
                const bounds = L.latLngBounds(sectorGeometries as [number, number][]);
                if (bounds.isValid()) return bounds.pad(0.1);
            } catch (e) { console.error("Error creating bounds for flyToBounds in HarvestDashboard", e); }
        }
        return null;
    }, [event.sectorIds, plantationFeatures, searchFlyToBounds, hasFlownToInitial]);

    // Handle completion of fly-to
    const handleFlyToComplete = () => {
        if (searchFlyToBounds) {
            setSearchFlyToBounds(null);
        } else {
            setHasFlownToInitial(true);
        }
        props.mapProps.onSetFlyToBounds?.(null);
    };

    const handleHarvestLogClick = (log: HarvestLog, latlng: L.LatLng) => {
        if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;
        const validLogGeom = parseSafeGeometry(log.geometry);
        if (validLogGeom.length < 3) return;
        try {
            // High-performance Axis-Aligned Bounding Box calculation
            let logMinLat = Infinity, logMaxLat = -Infinity;
            let logMinLng = Infinity, logMaxLng = -Infinity;
            for (const p of validLogGeom) {
                if (p[0] < logMinLat) logMinLat = p[0];
                if (p[0] > logMaxLat) logMaxLat = p[0];
                if (p[1] < logMinLng) logMinLng = p[1];
                if (p[1] > logMaxLng) logMaxLng = p[1];
            }
        
            const trenchesInLog = (plantationFeatures || []).filter(f => {
                if (f.type !== 'line' || (f as LinePlantationFeature).lineType !== 'row') return false;
                
                const trenchGeom = (f as LinePlantationFeature).geometry;
                if (!trenchGeom) return false;
                const validTrenchGeom = parseSafeGeometry(trenchGeom);
                if (validTrenchGeom.length < 1) return false;
    
                return validTrenchGeom.some(point => {
                    const lat = point[0];
                    const lng = point[1];
                    // Check if point is inside Axis-Aligned Bounding Box (identical to logBounds.contains)
                    return lat >= logMinLat && lat <= logMaxLat && lng >= logMinLng && lng <= logMaxLng;
                });
            });
    
            const totalWeight = (log.yieldByVariety && log.yieldByVariety.length > 0)
                ? log.yieldByVariety.reduce((sum, y) => sum + (y.weightKg || 0), 0)
                : (log.detailedYieldEntries?.reduce((sum, d) => sum + (d.weightKg || 0), 0) || 0);
    
            const totalBoxes = (log.yieldByVariety && log.yieldByVariety.length > 0)
                ? log.yieldByVariety.reduce((sum, y) => sum + (y.boxCount || 0), 0)
                : (log.detailedYieldEntries?.reduce((sum, d) => sum + (d.boxCount || 0), 0) || 0);
        
            const sortedTrenches = [...trenchesInLog].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
        
            setLogPopup({ 
                log, 
                latlng, 
                trenchCount: sortedTrenches.length,
                trenchIds: sortedTrenches.map(t => t.id),
                totalWeight,
                totalBoxes
            });
        } catch (e) {
            console.error("Failed to compute harvest log details on click:", e);
        }
    };

    const handleAddEntry = useCallback((entryData: Omit<HarvestEntry, 'id'>) => {
        if (isSimulationMode) {
            const newSim: HarvestEntry = {
                ...entryData,
                id: `hent-sim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                estimatedWeightKg: entryData.estimatedWeightKg || entryData.netWeightKg,
                verifiedWeightKg: entryData.verifiedWeightKg || (event.protocol === 5 ? 0 : entryData.netWeightKg),
                isVerified: event.protocol !== 5 && !!entryData.verifiedWeightKg,
                gpsLocation: entryData.gpsLocation || undefined
            };
            setSimulatedEntries(prev => [...prev, newSim]);
            toast.success(t('toast.sim_logged'), {
                description: t('toast.sim_logged_desc').replace('{weight}', String(entryData.netWeightKg))
            });
            const worker = employees.find(e => e.id === entryData.employeeId);
            if (onLogActivity) onLogActivity('Simulated Yield Scanned', 'harvesting', 'success', `[Simulation] Scanned ${entryData.netWeightKg}kg for ${worker?.name || 'Worker'} in sandbox`);
            return;
        }

        const isBulk = event.protocol === 5;
        const defaultBoxWeight = event.defaultBoxWeightKg || 5.9;
        
        const activeUser = getStoredActiveUser();
        const rawScannedBy = entryData.scannedBy || (entryData as any).scannedByUserName || currentUser?.name || activeUser.name;
        let scannedUserName = 'Giorgi Nishnianidze';
        if (typeof rawScannedBy === 'string') {
            scannedUserName = rawScannedBy;
        } else if (rawScannedBy && typeof rawScannedBy === 'object') {
            scannedUserName = (rawScannedBy as any).name || (rawScannedBy as any).displayName || (rawScannedBy as any).email || 'Giorgi Nishnianidze';
        }

        const rawRole = (entryData as any).scannedByRole || currentUser?.role || activeUser.role;
        let scannedUserRole = 'Operator / AgriMap';
        if (typeof rawRole === 'string') {
            scannedUserRole = rawRole;
        } else if (rawRole && typeof rawRole === 'object') {
            scannedUserRole = (rawRole as any).name || (rawRole as any).title || 'Operator / AgriMap';
        }

        const newEntry: HarvestEntry = { 
            ...entryData, 
            id: `hent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            estimatedWeightKg: entryData.estimatedWeightKg || entryData.netWeightKg,
            verifiedWeightKg: entryData.verifiedWeightKg || (event.protocol === 5 ? 0 : entryData.netWeightKg),
            isVerified: event.protocol !== 5 && !!entryData.verifiedWeightKg,
            gpsLocation: entryData.gpsLocation || undefined,
            scannedBy: scannedUserName,
            scannedByRole: scannedUserRole,
            scannedAt: entryData.scannedAt || new Date().toISOString()
        };

        onSetHarvestEntries([...harvestEntries, newEntry]);
        
        const worker = employees.find(e => e.id === entryData.employeeId);
        if (onLogActivity) onLogActivity('Yield Scanned', 'harvesting', 'success', `Scanned ${entryData.netWeightKg}kg for ${worker?.name || 'Worker'} in ${event.name}`);

        WorkerLog.appendDelta(
            'WEIGHING_SCANNED',
            event.id,
            {
                entryId: newEntry.id,
                employeeId: newEntry.employeeId,
                workerName: worker?.name || `Worker #${newEntry.employeeId}`,
                netWeightKg: newEntry.netWeightKg,
                boxCount: newEntry.boxCount || 1,
                variety: newEntry.variety || (event as any).variety || 'Bluegold',
                scannedBy: scannedUserName,
                scannedByRole: scannedUserRole,
                scannedAt: newEntry.scannedAt
            },
            scannedUserName
        ).catch(err => console.error('Failed to append WorkerLog delta:', err));

        // Stock Deduction for Packaging
        if (entryData.packagingItemId) {
            const updatedItems = inventoryItems.map(item => {
                if (item.id === entryData.packagingItemId) {
                    return { ...item, currentStock: Math.max(0, item.currentStock - 1) };
                }
                return item;
            });
            onSetInventoryItems(updatedItems);
        }

        const currentYields = event.yieldByVariety ? [...event.yieldByVariety] : [];
        const varietyIndex = currentYields.findIndex(y => y.variety === newEntry.variety);
        if (varietyIndex > -1) {
            currentYields[varietyIndex].weightKg += newEntry.netWeightKg;
        } else if (newEntry.variety) {
            currentYields.push({ variety: newEntry.variety, weightKg: newEntry.netWeightKg });
        }
        
        const updatedEvent: HarvestEvent = { 
            ...event, 
            totalNetWeightKg: (event.totalNetWeightKg || 0) + newEntry.netWeightKg, 
            totalVerifiedWeightKg: (event.totalVerifiedWeightKg || 0) + (newEntry.verifiedWeightKg || 0),
            totalEstimatedWeightKg: (event.totalEstimatedWeightKg || 0) + (newEntry.estimatedWeightKg || 0),
            totalBoxes: (event.totalBoxes || 0) + 1, 
            yieldByVariety: currentYields,
            isSyncRequired: true
        };
        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));
    }, [isSimulationMode, event, employees, harvestEntries, onSetHarvestEntries, onLogActivity, inventoryItems, onSetInventoryItems, harvestEvents, onSetHarvestEvents, t]);

    const handleSyncToLAN = () => {
        toast.promise(new Promise(res => setTimeout(res, 1200)), {
            loading: 'Pushing records to Local Server (192.168.10.152)...',
            success: 'Seasonal records backed up to Guria Office Vault.',
            error: 'LAN Disconnected'
        });
        const updatedEvent: HarvestEvent = { ...event, syncStatus: 'local_synced', isSyncRequired: false };
        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));
    };

    const handlePushToCloud = async () => {
        const id = toast.loading('Syncing Local Vault to Global Firestore...');
        try {
            const success = await syncManager.pushAllToCloud();
            if (success) {
                const updatedEvent: HarvestEvent = { ...event, syncStatus: 'cloud_synced', isSyncRequired: false };
                onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));
                toast.success('Seasonal Records Secured in Global Cloud.', { id });
            } else {
                toast.error('Cloud Sync failed or nothing to sync.', { id });
            }
        } catch (error: any) {
            console.error("Cloud push failed:", error);
            toast.error(`Cloud Sync Failed: ${error?.message || error}`, { id });
        }
    };

    const handleSimulateSmartTap = () => {
        // Logic for Protocol 6: RFID/NFC
        if (!navigator.geolocation) {
            toast.error("GPS required for Smart RFID mode.");
            return;
        }

        toast.loading("Reading Smart Crate RFID...");
        
        navigator.geolocation.getCurrentPosition((pos) => {
            const entryData: Omit<HarvestEntry, 'id'> = {
                harvestEventId: event.id,
                employeeId: employees[0]?.id || 'unknown',
                scannedAt: new Date().toISOString(),
                grossWeightKg: 5.9,
                tareWeightKg: 0,
                netWeightKg: 5.9,
                estimatedWeightKg: 5.9,
                packagingItemId: '',
                variety: selectedVarieties[0] || 'Standard',
                gpsLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude }
            };
            handleAddEntry(entryData);
            toast.dismiss();
            toast.success(`Smart Tap: Sector Identified via GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        });
    };

    const [activePickerIdForScan, setActivePickerIdForScan] = useState<string | null>(null);

    const handleBoxScan = (scannedData: string) => {
        const normalized = String(scannedData).trim();
        // Find if this is a picker ID or a box ID using robust matching
        const picker = findMatchingEmployee(employees, normalized);
        
        if (picker) {
            // Auto-assign to harvest event if not already assigned
            const isAssigned = event.assignedPickers?.some(ap => ap.employeeId === picker.id);
            if (!isAssigned && onSetHarvestEvents) {
                const newAssigned: AssignedPicker = {
                    employeeId: picker.id,
                    paymentModel: picker.paymentType === 'hourly' ? 'hourly' : 'per_weight',
                    rate: picker.paymentRate || 0.4
                };
                const updatedEvt = {
                    ...event,
                    assignedPickers: [...(event.assignedPickers || []), newAssigned]
                };
                onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvt : e));
            }
            setActivePickerIdForScan(picker.id);
            toast.success(isKa ? `✓ მუშაკი გააქტიურდა: ${picker.name}. ახლა დაასკანერეთ ყუთები!` : `✓ Active picker set: ${picker.name}. Now scan crates/boxes!`);
            return;
        }

        // It is a Box QR / Barcode
        const boxWeight = event.defaultBoxWeightKg || 5.9;
        const variety = selectedVarieties[0] || 'Standard';
        const assignedPickerId = activePickerIdForScan || event.assignedPickers?.[0]?.employeeId || 'unknown';
        const matchedPicker = employees.find(e => e.id === assignedPickerId);
        const pickerName = matchedPicker?.name || 'Worker';

        const entryData: Omit<HarvestEntry, 'id'> = {
            harvestEventId: event.id,
            employeeId: assignedPickerId,
            scannedAt: new Date().toISOString(),
            grossWeightKg: boxWeight,
            tareWeightKg: 0,
            netWeightKg: boxWeight,
            estimatedWeightKg: boxWeight,
            packagingItemId: '',
            variety: variety,
            crateCode: normalized
        };

        handleAddEntry(entryData);
        // Keep modal open for continuous scanning of 10+ boxes
        toast.success(isKa ? `✓ ყუთი #${normalized} (${boxWeight} კგ) მიმაგრდა: ${pickerName}` : `✓ Box #${normalized} (${boxWeight}kg) logged for ${pickerName}`);
    };

    const handleToggleStatus = () => {
        const newStatus: HarvestStatus = event.status === 'active' ? 'paused' : 'active';
        const updatedEvent: HarvestEvent = { 
            ...event, 
            status: newStatus,
            actualStartDate: event.actualStartDate || new Date().toISOString(), 
            breaks: newStatus === 'paused' ? [...(event.breaks || []), { start: new Date().toISOString() }] : 
                    newStatus === 'active' && event.breaks && event.breaks.length > 0 && !event.breaks[event.breaks.length-1].end ? 
                    [...event.breaks.slice(0, -1), { ...event.breaks[event.breaks.length-1], end: new Date().toISOString() }] : (event.breaks || [])
        };
        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [panelWidth, setPanelWidth] = useState<number>(() => {
        const saved = safeStorage.getItem('harvest_monitoring_panel_width');
        const parsed = saved ? parseInt(saved, 10) : 450;
        return Number.isFinite(parsed) && parsed >= 280 ? parsed : 450;
    });

    const handleLogOnMap = () => {
        setActiveDrawingTool({ tool: 'area', context: { harvestEventId: event.id } });
        setIsSidebarOpen(false); // Hide dashboard to show map on mobile/tablet
        toast.info("Draw area on map to create geo-referenced harvest log.");
    };

    const handleFinishEvent = (finalizeData: { 
        action: PostHarvestAction, 
        saleDetails?: HarvestSaleDetails, 
        identifer?: string,
        actualFullBoxes?: number,
        emptyBoxesReturned?: number,
        packagingItemId?: string
    }) => {
        const { action, saleDetails, identifer: identifier, emptyBoxesReturned, packagingItemId } = finalizeData;
        
        // 1. Calculate and verify final yield including manual overrides
        let totalYield = 0;
        const pickerFinalWeights: Record<string, number> = {};
        (event.assignedPickers || []).forEach(picker => {
            const pickerEntries = eventEntries.filter(e => e.employeeId === picker.employeeId);
            pickerFinalWeights[picker.employeeId] = picker.manualNetWeight ?? pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        });
        const unassignedEntries = eventEntries.filter(e => !(event.assignedPickers || []).some(p => p.employeeId === e.employeeId));
        totalYield = Object.values(pickerFinalWeights).reduce((a, b) => a + b, 0) + unassignedEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        
        // 1b. Calculate Worker Costs, Vehicle Costs, and Materials/Packaging Costs first
        let totalWorkerCost = 0;
        let workerDetailedCosts = '';
        const startStr = event.actualStartDate || event.plannedStartDate;
        const eventDurationMs = new Date().getTime() - new Date(startStr).getTime();
        const durationHours = Math.max(0, eventDurationMs / (1000 * 60 * 60));

        (event.assignedPickers || []).forEach(picker => {
            const pickerEntries = eventEntries.filter(e => e.employeeId === picker.employeeId);
            const employee = employees.find(e => e.id === picker.employeeId);
            const finalWeight = picker.manualNetWeight ?? pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
            const finalHours = picker.manualHours ?? durationHours;
            
            let earnings = calculatePickerEarnings(picker, finalWeight, finalHours);
            
            totalWorkerCost += earnings;
            workerDetailedCosts += `${employee?.name || picker.employeeId}: ${earnings.toFixed(2)}; `;
        });

        // Calculate Vehicle Costs
        let totalVehCost = 0;
        (event.assignedVehicles || []).forEach(v => {
            if (v.isOwned) {
                const mach = (machinery || []).find(m => m.id === v.machineryId);
                const hourly = mach?.hourlyRate || 0;
                const fuel = mach?.fuelConsumption || 0;
                let fuelUnitCost = 0;
                if (mach?.fuelItemId) {
                    const fuelItem = (inventoryItems || []).find(i => i.id === mach.fuelItemId);
                    fuelUnitCost = fuelItem?.unitCost || 0;
                }
                totalVehCost += v.usageHours * (hourly + fuel * fuelUnitCost);
            } else {
                totalVehCost += v.hiredCost || 0;
            }
        });

        // Calculate Materials/Packaging Costs
        const totalMatCost = (event.materialsUsed || []).reduce((sum, mu) => {
            const item = (inventoryItems || []).find(i => i.id === mu.inventoryItemId);
            return sum + (mu.quantity * (item?.unitCost || 0));
        }, 0);

        // 2. Archiving Handshake: Move session to historical vault
        const updatedEvent: HarvestEvent = {
            ...event,
            status: 'completed',
            actualEndDate: new Date().toISOString(),
            finalNetYieldKg: totalYield,
            postHarvestAction: action,
            saleDetails: saleDetails,
            marketIdentifier: identifier || `HARV-${Date.now().toString().slice(-6)}`,
            totalPickerCost: totalWorkerCost,
            totalVehicleCost: totalVehCost,
            totalPackagingCost: totalMatCost
        };

        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));

        // 3. Root Level Inventory Migration (Supply Chain Payload)
        const varietyWeights: Record<string, { weightKg: number; boxCount: number }> = {};
        let totalWeighted = 0;
        
        eventEntries.forEach(e => {
            const v = e.variety || 'Unknown';
            if (!varietyWeights[v]) {
                varietyWeights[v] = { weightKg: 0, boxCount: 0 };
            }
            varietyWeights[v].weightKg += e.netWeightKg || 0;
            varietyWeights[v].boxCount += e.boxCount || 1;
            totalWeighted += e.netWeightKg || 0;
        });

        if (totalWeighted === 0) {
            const v = event.varieties?.[0] || 'Unknown';
            varietyWeights[v] = { weightKg: totalYield, boxCount: event.totalBoxes || 0 };
            totalWeighted = totalYield;
        }

        const recomputedInventoryItems: InventoryItem[] = Object.entries(varietyWeights).map(([variety, info], index) => {
            const proportion = totalWeighted > 0 ? info.weightKg / totalWeighted : 1;
            const varietyYield = totalYield * proportion;
            const varietyCash = (saleDetails?.totalValue || 0) * proportion;
            
            return {
                id: `inv-h-${event.id}-${variety}-${Date.now()}-${index}`,
                name: `${event.name} - ${identifier || 'LOAD'} (${variety})`,
                category: 'Produce',
                currentStock: varietyYield,
                unitOfMeasure: 'kg',
                status: action === 'COLD_STORAGE' ? 'Awaiting Transaction' : 'In Stock',
                tags: action === 'COLD_STORAGE' ? ['Cold Storage', 'Harvested'] : ['Harvested'],
                relatedHarvestId: event.id,
                harvestIdentifier: identifier,
                unitCost: saleDetails?.pricePerUnit || 0,
                minStockThreshold: 0,
                batch_id: `batch-${Date.now()}-${identifier || '0'}-${variety}`,
                date: new Date().toISOString().split('T')[0],
                rate: 1.0,
                variety: variety,
                varietyKg: varietyYield,
                variety2Kg: 0,
                depositLLC: 0,
                physicalCash: varietyCash,
                physicalBoxes: info.boxCount,
                depositedDeposit: false
            };
        });

        // If boxes are credited back, update their inventory stock
        let updatedInventoryItems = [...inventoryItems, ...recomputedInventoryItems];
        if (emptyBoxesReturned && emptyBoxesReturned > 0 && packagingItemId) {
            updatedInventoryItems = updatedInventoryItems.map(item => {
                if (item.id === packagingItemId) {
                    return {
                        ...item,
                        currentStock: (item.currentStock || 0) + emptyBoxesReturned
                    };
                }
                return item;
            });
            toast.info(`Consolidated and credited back ${emptyBoxesReturned} empty box(es) to inventory balance.`);
        }

        onSetInventoryItems(updatedInventoryItems);

        // 4. Middle Sync Broker transaction logging and coordination (checkpoint-based!)
        const brokerTx = syncBroker.createTransaction(
            'harvest', 
            'inventory', 
            'HarvestToStockTransfer', 
            { ...updatedEvent, totalNetWeightKg: totalYield },
            2 // 2 checkpoint steps
        );
        
        syncBroker.processHarvestToStockTransfer(
            brokerTx.id, 
            { ...updatedEvent, totalNetWeightKg: totalYield },
            onSetInventoryItems,
            inventoryItems
        ).catch(e => console.error('[SyncBroker] Error logging to broker:', e));
        
        // Ledger Transaction for Harvest
        if (props.onSetStockTransactions && props.stockTransactions) {
             const newStockTxs = recomputedInventoryItems.map((item, idx) => ({
                 id: `tx-stk-${Date.now()}-${idx}`,
                 organizationId: event.organizationId || '',
                 date: new Date().toISOString(),
                 itemId: item.id,
                 type: 'ADDITION' as const,
                 quantity: item.currentStock,
                 sourceModule: 'HARVEST' as const,
                 reason: `Harvest completion (${item.variety}): Session ${identifier || 'N/A'}`
             }));
             props.onSetStockTransactions([...props.stockTransactions, ...newStockTxs]);
        }


        if (onSetTransactions && transactions) {
            const newTransactions = [...transactions];

            // Add Payroll Expense as Accruals (Liability to 'acc-payroll')
            if (totalWorkerCost > 0) {
                (event.assignedPickers || []).forEach((picker, idx) => {
                    const pickerEntries = eventEntries.filter(e => e.employeeId === picker.employeeId);
                    const employee = employees.find(e => e.id === picker.employeeId);
                    const finalWeight = picker.manualNetWeight ?? pickerEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);
                    const finalHours = picker.manualHours ?? durationHours;
                    let pickerEarnings = calculatePickerEarnings(picker, finalWeight, finalHours);
                    
                    if (pickerEarnings > 0) {
                        newTransactions.push({
                            id: `tx-pay-accrual-${picker.employeeId}-${event.id}-${Date.now()}-${idx}`,
                            date: new Date().toISOString(),
                            description: `Harvest Accrual: ${employee?.name || picker.employeeId} - ${event.name}`,
                            amount: pickerEarnings,
                            transactionType: 'Journal Entry',
                            category: 'PAYROLL',
                            debitAccountId: 'acc-labor-expense',
                            creditAccountId: 'acc-payroll',
                            employeeId: picker.employeeId,
                            referenceId: event.id
                        });
                    }
                });
            }

            // Traceability Event Handshake for Direct Sale (Finance Module)
            if (action === 'DIRECT_SALE' && saleDetails) {
                newTransactions.push({
                    id: `tx-h-${Date.now()}`,
                    date: new Date().toISOString(),
                    description: `Direct Sale: ${event.name} (${identifier})`,
                    amount: saleDetails.totalValue,
                    transactionType: 'Incoming Payment',
                    category: 'Produce Sale',
                    debitAccountId: 'primary-revenue',
                    creditAccountId: 'cash-on-hand',
                    referenceId: event.id,
                    paymentMode: 'By Card'
                });
            }

            onSetTransactions(newTransactions);
        }

        setIsCloseModalOpen(false);
        toast.success(`Vault Handshake Successful: Session ${identifier} Archived.`);
        onBack();
    };

    const memoizedMap = useMemo(() => {
        return (
             <MapComponent 
                {...props.mapProps}
                flyToBounds={flyToBounds}
                onSetFlyToBounds={handleFlyToComplete}
                plantationFeatures={plantationFeatures}
                layers={props.layers}
                highlightedFeatureIds={logPopup ? [...(logPopup.trenchIds || []), ...(logPopup.log.sectorIds || [])] : event.sectorIds}
                showSearch={true}
                harvestLogs={filteredEventLogs}
                crops={props.crops}
                onHarvestLogClick={handleHarvestLogClick}
                activeDrawingTool={activeDrawingTool}
                onSetActiveDrawingTool={setActiveDrawingTool}
                onFeatureDrawn={(type, geom) => { 
                    if (type === 'area' && Array.isArray(geom) && Array.isArray(geom[0])) { 
                        setDrawnGeometry(geom as [number, number][]); 
                        setIsLogModalOpen(true); 
                        setActiveDrawingTool({ tool: null });
                    }
                }}
            >
                {activeDrawingTool.tool && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2200] pointer-events-auto flex flex-col items-center gap-2">
                        <div className="bg-white/95 backdrop-blur-xl border border-blue-500 shadow-2xl rounded-full px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top-4">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-blue-700">{t('harvest.click_map_points_to_draw')}</span>
                            <button 
                                onClick={() => {
                                    setActiveDrawingTool({ tool: null });
                                    setDrawnGeometry([]);
                                }} 
                                className="ml-2 p-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                            >
                                <XIcon size={14}/>
                            </button>
                        </div>
                    </div>
                )}
                {isLogModalOpen && drawnGeometry.filter(isValidCoordinate).length > 0 && (
                    <Polygon 
                        positions={drawnGeometry.filter(isValidCoordinate).map(p => [Number(p[0]), Number(p[1])])} 
                        pathOptions={{ color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 0.3, weight: 3, dashArray: '5, 10' }} 
                    />
                )}
                {logPopup && (
                    <Popup position={logPopup.latlng} eventHandlers={{ remove: () => setLogPopup(null) }} className="harvest-log-popup" autoPan={false}>
                        <div className="p-3">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><ArchiveBoxIcon className="h-4 w-4 text-orange-500" /> {t('harvest.log_detail')}</h3>
                                <button onClick={() => setLogPopup(null)} className="p-1 rounded-full hover:bg-slate-100"><XIcon className="h-3 w-3"/></button>
                            </div>
                            <div className="text-[11px] space-y-2">
                                <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Date:</span> <span className="font-bold text-slate-800">{new Date(logPopup.log.date).toLocaleDateString()}</span></div>
                                <div className="flex justify-between mb-1"><span className="font-bold text-slate-400 uppercase">Area:</span> <span className="font-bold text-slate-800">{logPopup.log.areaHa.toFixed(4)} ha</span></div>
                                
                                <div className="flex justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center">Row Range</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {plantationFeatures.find(f => f.id === logPopup.trenchIds?.[0])?.name || 'T-START'}
                                            </span>
                                            <div className="flex-1 h-[1px] bg-slate-300 w-4 relative">
                                                <div className="absolute -top-1 left-1.2 w-2 h-2 rounded-full border border-slate-300 bg-white flex items-center justify-center">
                                                    <span className="text-[6px] font-black">{logPopup.trenchCount}</span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {plantationFeatures.find(f => f.id === logPopup.trenchIds?.[logPopup.trenchIds.length - 1])?.name || 'T-END'}
                                            </span>
                                        </div>
                                        <p className="text-[7px] font-black text-indigo-500 uppercase tracking-tighter text-center mt-1">
                                            {logPopup.log.sectorIds?.length ? `Sectors: ${logPopup.log.sectorIds.map(sid => plantationFeatures.find(f => f.id === sid)?.name).join(', ')}` : 'No Sector Link'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-bold text-slate-400 uppercase">Total Weight:</span> <span className="font-black text-indigo-600 uppercase">{logPopup.totalWeight.toFixed(1)} KG</span></div>
                                <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Total Boxes:</span> <span className="font-black text-orange-600 uppercase">{logPopup.totalBoxes} BXS</span></div>
                                
                                <div className="pt-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Sector Management (EDD Active):</p>
                                    <div className="relative group/dd flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <select 
                                                onChange={(e) => {
                                                    const sId = e.target.value;
                                                    if (sId && !logPopup.log.sectorIds?.includes(sId)) {
                                                        const updatedLog = { ...logPopup.log, sectorIds: [...(logPopup.log.sectorIds || []), sId] };
                                                        setLogPopup({ ...logPopup, log: updatedLog });
                                                        toast.success(`Linked ${plantationFeatures.find(f => f.id === sId)?.name || 'Sector'}`);
                                                    }
                                                }}
                                                className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                                            >
                                                <option value="">Attach Sector...</option>
                                                {plantationFeatures
                                                    .filter(f => f.type === 'area' && !logPopup.log.sectorIds?.includes(f.id))
                                                    .map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} (Trench Link Available)</option>
                                                    ))
                                                }
                                            </select>
                                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {(logPopup.log.sectorIds || []).slice(0, 3).map(id => {
                                                const s = plantationFeatures.find(f => f.id === id);
                                                return (
                                                    <div key={id} className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-[8px] font-black text-white uppercase shadow-sm" title={s?.name}>
                                                        {s?.name?.substring(0, 1)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <p className="font-bold text-slate-400 uppercase mb-1">Yield Breakdown:</p>
                                    <div className="space-y-1 pl-2">
                                        {(logPopup.log.yieldByVariety || []).map((y, i) => (
                                            <div key={i} className="flex justify-between items-center">
                                                <span className="font-semibold text-slate-700">{y.variety}</span>
                                                <span className="font-bold text-slate-900">{y.weightKg.toFixed(1)} kg</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5 mt-2">
                                    <button 
                                        onClick={() => {
                                            setEditingLog(logPopup.log);
                                            setDrawnGeometry(logPopup.log.geometry);
                                            setIsLogModalOpen(true);
                                            setLogPopup(null);
                                        }}
                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-black uppercase text-[9px] tracking-widest shadow-md hover:bg-indigo-700 transition-all text-center"
                                    >
                                        Edit Detailed View
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to delete this harvest log?')) {
                                                onSetHarvestLogs(prev => prev.filter(l => l.id !== logPopup.log.id));
                                                setLogPopup(null);
                                            }
                                        }}
                                        className="w-full py-2 bg-red-600 text-white rounded-lg font-black uppercase text-[9px] tracking-widest shadow-md hover:bg-red-700 transition-all text-center"
                                    >
                                        Delete Log
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Popup>
                )}
             </MapComponent>
        );
    }, [
        props.mapProps,
        flyToBounds,
        plantationFeatures,
        props.layers,
        logPopup,
        event.sectorIds,
        filteredEventLogs,
        props.crops,
        activeDrawingTool,
        isLogModalOpen,
        drawnGeometry,
        t,
        onSetHarvestLogs
    ]);

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-slate-50 relative overflow-hidden">
            {/* Sidebar Toggle (Mobile) */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden absolute top-4 right-4 z-[2005] p-3 bg-white border border-slate-200 rounded-2xl shadow-xl text-slate-800"
            >
                {isSidebarOpen ? <XIcon size={20} /> : <ListFilter size={20} />}
            </button>

            <div 
                className={`fixed inset-0 md:relative md:inset-auto z-[2004] md:z-10 w-full flex-shrink-0 flex flex-col bg-white border-r border-slate-200 h-full ${!isSidebarOpen ? 'hidden md:flex' : 'flex'}`}
                style={{
                    width: typeof window !== 'undefined' && window.innerWidth > 768 ? `${panelWidth}px` : undefined,
                    maxWidth: '85vw'
                }}
            >
                <div className="p-4 border-b flex-shrink-0 flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                        <ChevronLeftIcon className="h-6 w-6 text-slate-800" />
                    </button>
                    <div className="flex-1">
                        <h2 className="text-lg font-black text-slate-800 tracking-tighter uppercase">{renderSafeString(event.name)}</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex flex-wrap items-center gap-2">
                            <span>{t('harvest.live_monitoring')}</span>
                            <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded font-mono text-[9px] tracking-tight">{renderSafeString(event.id).toUpperCase()}</span>
                            {/* Presence Badge */}
                            <button
                                type="button"
                                onClick={() => setIsOnlineUsersModalOpen(true)}
                                className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-300 transition-all cursor-pointer shadow-xs active:scale-95"
                                title={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ონლაინ გუნდის ნახვა' : 'View Online Team'}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                <Users size={12} /> {activeOnlineUsers.length > 0 ? activeOnlineUsers.length : 1} {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ონლაინ' : 'Online'}
                            </button>
                        </p>
                        {event.actualStartDate && (
                            <p className="text-[10px] text-slate-500 mt-1">
                                Started: {new Date(event.actualStartDate).toLocaleString()}
                                {event.actualEndDate && ` — Finished: ${new Date(event.actualEndDate).toLocaleString()}`}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            type="button" 
                            onClick={() => setIsShareModalOpen(true)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-colors cursor-pointer"
                            title="Share Session"
                        >
                            <Share2 size={13} />
                            <span className="hidden sm:inline">{t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'გაზიარება' : 'Share'}</span>
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsHistoryModalOpen(true)}
                            className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-colors cursor-pointer"
                            title="Audit History"
                        >
                            <History size={13} />
                            <span className="hidden sm:inline">{t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ისტორია' : 'History'}</span>
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsHarvestBoxQrOpen(true)}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
                            title={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? "მოსავლის ყუთების QR კოდების გენერირება & ბეჭდვა" : "Generate Box QR Codes"}
                        >
                            <QrCode size={13} className="text-emerald-400" />
                            <span className="hidden sm:inline">{t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ყუთების QR' : 'Box QRs'}</span>
                        </button>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${event.status === 'active' ? 'bg-blue-100 text-blue-700' : (event.status === 'completed' || event.status === 'partially_sold') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{renderSafeString(event.status).replace('_', ' ')}</div>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-5 space-y-4">
                    {isWeigher ? (
                        <div className="space-y-6">
                            {/* Massive Weighing Trigger Pin */}
                            <button
                                onClick={() => setIsWeighModalOpen(true)}
                                className="w-full py-8 px-6 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl flex flex-col items-center justify-center gap-3 hover:shadow-2xl active:scale-[0.98] transition-all border border-indigo-500/30"
                            >
                                <Scale size={42} className="text-white animate-pulse" />
                                <span className="text-center font-black tracking-widest leading-none">
                                    {t('harvest.open_weigh_station') || 'OPEN WEIGH STATION'}
                                </span>
                            </button>

                            {/* Info card */}
                            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-3xl space-y-3">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-indigo-600" /> Weigh Station Access
                                </h3>
                                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                                    You are currently authenticated as a <span className="font-black text-indigo-600 uppercase">Weigher</span>. 
                                    You have full clearance to operate the measurement scale and record contributions. For security and compliance, detailed financial or cumulative weight aggregate metrics are restricted on this terminal.
                                </p>
                            </div>

                            {/* Live Active Workers List - The Sendbox Display (but without weights, just counts) */}
                            {eventEntries && eventEntries.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                        Live Active Workers Board
                                    </h4>
                                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                                        {sendboxData.map((worker) => (
                                            <div 
                                                key={worker.name}
                                                className="bg-white border border-slate-100 p-3.5 rounded-2xl flex justify-between items-center shadow-sm"
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-slate-800">{worker.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                        Last recorded: {new Date(worker.lastScanned).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl font-black text-xs">
                                                    {worker.boxes} {worker.boxes === 1 ? 'Box' : 'Boxes'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="flex flex-col gap-3 mb-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('harvest.yield_visibility')}</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setSelectedVarieties(activeVarieties)}
                                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-blue-600 hover:bg-blue-50 uppercase transition-all"
                                    >
                                        {t('harvest.all')}
                                    </button>
                                    <button 
                                        onClick={() => setSelectedVarieties([])}
                                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-red-600 hover:bg-red-50 uppercase transition-all"
                                    >
                                        {t('harvest.none')}
                                    </button>
                                </div>
                            </div>
                            <select 
                                className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 uppercase tracking-widest transition-all"
                                value={selectedVarieties.length === 1 ? selectedVarieties[0] : ''}
                                onChange={(e) => {
                                    if (e.target.value) setSelectedVarieties([e.target.value]);
                                    else setSelectedVarieties(activeVarieties);
                                }}
                            >
                                <option value="">Select Specific Variety...</option>
                                {activeVarieties.map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                            {activeVarieties.map(v => {
                                const stats = filteredTotals.yieldByVariety.find(y => y.variety === v);
                                const weightKg = stats?.weightKg || 0;
                                const isSelected = selectedVarieties.includes(v);
                                return (
                                    <button 
                                        key={v}
                                        onClick={() => toggleVariety(v)}
                                        className={`p-3 rounded-xl border flex items-center justify-between transition-all group ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'bg-slate-100 border-slate-300 group-hover:border-indigo-400'}`}>
                                                {isSelected && <div className="w-2 h-2 bg-indigo-600 rounded-sm" />}
                                            </div>
                                            <span className="text-[10px] font-black uppercase truncate">{v}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{formatCleanWeight(weightKg)}kg</span>
                                            <span className={`text-[8px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{t('harvest.yield')}</span>
                                        </div>
                                    </button>
                                );
                            })}
                            {activeVarieties.length === 0 && (
                                <div className="col-span-full py-8 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-widest italic">No varieties detected in sector</p>
                                </div>
                            )}
                        </div>
                    </div>



                    <div className="grid grid-cols-1 gap-3">
                        {/* Only show Log on Map if not drawing, to avoid duplicate visual noise */}
                        {!activeDrawingTool.tool && (
                            <button 
                                onClick={handleLogOnMap}
                                className="flex items-center gap-4 p-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl bg-slate-900 text-white shadow-slate-100"
                            >
                                <div className="p-2 bg-white/10 rounded-xl"><MapPin size={24}/></div>
                                {t('harvest.log_map')}
                            </button>
                        )}
                        {activeDrawingTool.tool && (
                             <div className="flex items-center gap-4 p-5 rounded-[2rem] font-black text-xs uppercase tracking-widest bg-amber-500 text-white shadow-xl shadow-amber-100 animate-pulse">
                                <div className="p-2 bg-white/10 rounded-xl"><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>
                                {t('harvest.drawing_log_area')}
                             </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl flex flex-col items-center justify-center border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">{t('harvest.harvested_mass')}</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black">{formatCleanWeight(filteredTotals.totalWeight)}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase">KG</span>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl flex flex-col items-center justify-center border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">{t('harvest.total_containers')}</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl sm:text-3xl font-black">
                                    {safeNumericVal(filteredTotals?.totalBoxes, 0)}/{
                                        (safeNumericVal(event?.totalPunets) >= safeNumericVal(filteredTotals?.totalBoxes, 0) * 6 && safeNumericVal(event?.totalPunets) > 0)
                                            ? safeNumericVal(event?.totalPunets)
                                            : ((safeNumericVal(event?.physicalPunets) >= safeNumericVal(filteredTotals?.totalBoxes, 0) * 6 && safeNumericVal(event?.physicalPunets) > 0)
                                                ? safeNumericVal(event?.physicalPunets)
                                                : (calculatedPunetsFromEntries > 0 
                                                    ? calculatedPunetsFromEntries 
                                                    : (safeNumericVal(filteredTotals?.totalBoxes, 0) * safeNumericVal(event?.punetsPerBox, 12))))
                                    }
                                </span>
                                <span className="text-xs font-bold text-slate-400 uppercase">Bxs/Pnts</span>
                            </div>
                        </div>
                    </div>

                    <HarvestStatsGrid
                        event={{
                            ...event,
                            totalNetWeightKg: filteredTotals.totalWeight,
                            totalGrossWeightKg: filteredTotals.totalGrossWeight,
                            totalBoxes: filteredTotals.totalBoxes,
                            finalNetYieldKg: undefined // Force using totalNetWeightKg for live monitoring
                        }}
                        durationHours={durationHours}
                        entries={filteredEntries}
                        inventoryItems={inventoryItems}
                        machinery={machinery}
                        employees={employees}
                    />
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">{t('harvest.costs_filters')}</label>
                        
                        {/* 1. Daily Paid Harvest Card */}
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-indigo-800/50 space-y-2">
                            <div className="flex justify-between items-center">
                                <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-indigo-200">Daily Paid Harvest</h3>
                                <button 
                                    onClick={() => {
                                        setDailyHarvestModalTab('stats');
                                        setShowDailyHarvestModal(true);
                                    }}
                                    className="text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-3 py-1.5 rounded-lg transition-all uppercase border-2 border-emerald-300 shadow-lg animate-pulse flex items-center gap-1 cursor-pointer"
                                >
                                    Click for Detail / Adjust &rarr;
                                </button>
                            </div>
                            <div className="text-2xl font-black text-white tracking-tight">
                                {formatCurrency(event.totalPickerCost || 0)}
                            </div>
                            <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">
                                Total pay for hourly/daily/weight workers.
                            </p>
                        </div>
                        
                        {/* 2. Unified Buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <button
                                onClick={() => {
                                    setDailyHarvestModalTab('logistics');
                                    setShowDailyHarvestModal(true);
                                }}
                                className="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs group cursor-pointer"
                                title="Open Logistics & Resources Transport"
                            >
                                <span className="text-base group-hover:scale-110 transition-transform">🚜</span>
                                Vehicles +
                            </button>
                            <button
                                onClick={() => setIsMaterialsModalOpen(true)}
                                className="bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs group cursor-pointer"
                                title="Record materials from Stock Supplies"
                            >
                                <span className="text-base group-hover:scale-110 transition-transform">📦</span>
                                Materials +
                            </button>
                        </div>
                        
                        {/* 3. Packaging & Punet OPEX Settings Box */}
                        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm">🍓</span>
                                    <label className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                                        PACKAGING & PUNET OPEX SETTINGS
                                    </label>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBoxQtyInput(filteredTotals?.totalBoxes || 0);
                                            setPunetQtyInput((filteredTotals?.totalBoxes || 0) * (event.punetsPerBox || 12));
                                        }}
                                        className="text-[8px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 uppercase transition-colors"
                                        title={`Autofill from Scale Records (${filteredTotals?.totalBoxes || 0} boxes)`}
                                    >
                                        Scale Records ({filteredTotals?.totalBoxes || 0})
                                    </button>
                                    <button
                                        onClick={handleSyncPackagingQuantities}
                                        className="text-[9px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 uppercase transition-colors cursor-pointer"
                                    >
                                        SYNC TO STOCK
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">BOX QUANTITY</label>
                                    <input
                                        type="number"
                                        value={boxQtyInput === '' || isNaN(Number(boxQtyInput)) ? '' : boxQtyInput}
                                        onChange={e => setBoxQtyInput(e.target.value)}
                                        className="w-full p-1.5 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                                    />
                                    <span className="text-[8px] font-bold text-slate-400 block mt-0.5 truncate">
                                        Synced: {renderSafeNumber(event.totalBoxes) || renderSafeNumber(filteredTotals?.totalBoxes) || '0'}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">PUNET QUANTITY</label>
                                    <input
                                        type="number"
                                        value={punetQtyInput === '' || isNaN(Number(punetQtyInput)) ? '' : punetQtyInput}
                                        onChange={e => setPunetQtyInput(e.target.value)}
                                        className="w-full p-1.5 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                                    />
                                    <span className="text-[8px] font-bold text-slate-400 block mt-0.5 truncate">
                                        Synced: {renderSafeNumber(event.physicalPunets) || String((safeNumericVal(event.totalBoxes) || 0) * (safeNumericVal(event.punetsPerBox, 12)))}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">PUNETS / BOX</label>
                                    <input
                                        type="number"
                                        value={punetsPerBoxInput === '' || isNaN(Number(punetsPerBoxInput)) ? '' : punetsPerBoxInput}
                                        onChange={e => setPunetsPerBoxInput(e.target.value)}
                                        className="w-full p-1.5 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                                    />
                                    <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Def: 12</span>
                                </div>
                            </div>

                            <button
                                onClick={handleSyncPackagingQuantities}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
                            >
                                <span>⚡</span>
                                SYNC NEW QUANTITIES
                            </button>
                        </div>

                        
                        {/* Other custom items */}
                        <div className="border-t pt-2 border-slate-100">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t('harvest.other_costs')}</label>
                                <button 
                                    onClick={() => {
                                        setIsAddingOpexItem(!isAddingOpexItem);
                                    }}
                                    className="text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:underline text-right"
                                >
                                    {isAddingOpexItem ? (t('common.cancel') || 'Cancel') : t('harvest.add_item')}
                                </button>
                            </div>

                            {/* Inline input form if isAddingOpexItem is true */}
                            {isAddingOpexItem && (
                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2 mt-1 mb-2 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            placeholder={t('harvest.cost_name')}
                                            className="flex-1 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"
                                            value={newOpexItemName}
                                            onChange={(e) => setNewOpexItemName(e.target.value)}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder={t('harvest.cost_amount')}
                                            className="w-20 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"
                                            value={newOpexItemCost}
                                            onChange={(e) => setNewOpexItemCost(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button 
                                            onClick={() => {
                                                setIsAddingOpexItem(false);
                                                setNewOpexItemName("");
                                                setNewOpexItemCost("");
                                            }}
                                            className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                                        >
                                            {t('common.cancel') || 'Cancel'}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const cost = parseFloat(newOpexItemCost);
                                                if (newOpexItemName.trim() && !isNaN(cost) && cost >= 0) {
                                                    const currentItems = event.otherOpexItems || [];
                                                    const updatedItems = [...currentItems, { id: `item-${Date.now()}`, name: newOpexItemName.trim(), cost }];
                                                    const updatedEvent = { ...event, otherOpexItems: updatedItems };
                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                    setIsAddingOpexItem(false);
                                                    setNewOpexItemName("");
                                                    setNewOpexItemCost("");
                                                } else {
                                                    toast.error("Please enter a valid item name and amount.");
                                                }
                                            }}
                                            className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 rounded-lg transition-all shadow-md active:scale-95"
                                        >
                                            {t('common.save') || 'Save'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                {(event.otherOpexItems || []).map((item) => (
                                    <div key={item.id} className="flex justify-between items-center bg-white p-1.5 rounded-xl border border-slate-100 text-[10px]">
                                        <span className="font-bold text-slate-600">{renderSafeString(item.name)}</span>
                                        <div className="flex items-center gap-1.5 bg-white">
                                            <span className="font-black text-slate-800">
                                                {currency === 'GEL' ? `GEL ${safeNumericVal(item.cost).toFixed(2)}` : `$${safeNumericVal(item.cost).toFixed(2)}`}
                                            </span>
                                            <button 
                                                onClick={() => {
                                                    const updatedItems = (event.otherOpexItems || []).filter(i => i.id !== item.id);
                                                    const updatedEvent = { ...event, otherOpexItems: updatedItems };
                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                }}
                                                className="text-red-500 hover:text-red-700 font-extrabold text-xs"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <LogisticsTransportWidget 
                            event={event} 
                            harvestEvents={harvestEvents || []} 
                            onSetHarvestEvents={onSetHarvestEvents || (() => {})} 
                            machinery={machinery || []} 
                            onSetMachinery={onSetMachinery}
                            inventoryItems={inventoryItems || []} 
                            onSetInventoryItems={onSetInventoryItems} 
                            employees={employees || []}
                            isCollapsedSummary={true}
                            onOpenLogisticsModal={() => {
                                setDailyHarvestModalTab('logistics');
                                setShowDailyHarvestModal(true);
                            }}
                        />

                        {/* Date Filter also kept small at the bottom */}
                        <div className="pt-2 border-t border-slate-200">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('harvest.filter_logs_by_date')}</label>
                            <div className="flex gap-2">
                                <input 
                                    type="date" 
                                    className="flex-grow p-1.5 bg-white border border-slate-200 rounded font-bold text-[10px] outline-none"
                                    value={visibleLogsDate || ''}
                                    onChange={(e) => setVisibleLogsDate(e.target.value || null)}
                                />
                                {visibleLogsDate && (
                                    <button 
                                        onClick={() => setVisibleLogsDate(null)}
                                        className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                    >
                                        {t('harvest.clear')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>



                    <YieldByVarietyWidget yields={filteredTotals.yieldByVariety} totalWeight={filteredTotals.totalWeight} />
                    
                    {event.status !== 'completed' && event.status !== 'partially_sold' && (
                        <div className="flex gap-2">
                            {event.type === 'box_counting' || event.protocol === 5 || event.protocol === 6 ? (
                                <button 
                                    onClick={() => {
                                        setIsWeighModalOpen(true);
                                    }} 
                                    className="flex-1 py-4 sm:py-5 bg-orange-600 text-white rounded-2xl font-black text-lg sm:text-xl flex items-center justify-center gap-3 shadow-xl hover:bg-orange-700 transition-all cursor-pointer"
                                >
                                    <span className="p-2 sm:p-3 bg-white/20 rounded-xl">
                                        {event.protocol === 6 ? <Fingerprint size={24} /> : <ArchiveBoxIcon className="h-4 w-4"/>}
                                    </span>
                                    <span>{event.protocol === 6 ? t('harvest.identify_smart_crate') : (event.protocol === 5 ? t('harvest.count_bulk_batch') : t('harvest.scan_box_tick'))}</span>
                                </button>
                            ) : (
                                <button onClick={() => setIsWeighModalOpen(true)} className="flex-1 py-4 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-green-700 transition-all cursor-pointer">
                                    <Scale size={20} />
                                    <span>{event.protocol === 2 ? t('harvest.identify_weigh') : t('harvest.weigh_crate_add_entry')}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setIsBoxScannerOpen(true)}
                                className="px-4 py-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer shrink-0 border border-slate-700 group"
                                title={t('language') === 'ka' ? "სკანერის ფანჯრის გახსნა (USB / კამერა / QR)" : "Open Scanner Pop-up (USB / Camera / QR)"}
                            >
                                <ScanLine size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">{t('language') === 'ka' ? 'სკანერი' : 'Scanner'}</span>
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        {event.status !== 'completed' && event.status !== 'partially_sold' ? (
                            <>
                                <button 
                                    onClick={handleToggleStatus} 
                                    className={`py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${event.status === 'active' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                                >
                                    {event.status === 'active' ? t('harvest.pause_session') : t('harvest.resume_session')}
                                </button>
                                <button 
                                    onClick={() => setIsCloseModalOpen(true)} 
                                    className="py-3 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-100"
                                >
                                    {t('harvest.finish_job')}
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => {
                                    const activeUser = getStoredActiveUser();
                                    if (onSetHarvestEvents) {
                                        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? { ...e, status: 'active', actualEndDate: undefined } : e));
                                    }
                                    WorkerLog.appendDelta(
                                        'REACTIVATE_HARVEST_SEASON',
                                        event.id,
                                        {
                                            eventName: event.name,
                                            status: 'active',
                                            reactivatedBy: activeUser.name,
                                            reactivatedByRole: activeUser.role,
                                            timestamp: new Date().toISOString()
                                        },
                                        activeUser.name
                                    ).catch(err => console.error('Failed to log audit delta:', err));
                                    const isKaLang = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
                                    toast.success(isKaLang ? 'სეზონი წარმატებით განახლდა!' : 'Harvest session reactivated & unlocked!');
                                }} 
                                className="col-span-2 py-3 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-200 transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                <RefreshCcw size={16} /> {t('harvest.resume_session_unlock')}
                            </button>
                        )}
                    </div>

                    <div className="bg-indigo-600 rounded-2xl p-4 shadow-lg text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg">
                                {event.protocol === 1 ? <QrCode size={20} /> :
                                 event.protocol === 2 ? <Fingerprint size={20} /> :
                                 event.protocol === 3 ? <RefreshCcw size={20} /> :
                                 event.protocol === 4 ? <Boxes size={20} /> :
                                 event.protocol === 5 ? <Scale size={20} /> :
                                 <MapPin size={20} />}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">{t('harvest.active_protocol')}</p>
                                <p className="text-sm font-black uppercase tracking-tight">{HARVEST_METHODS.find(m => m.protocol === event.protocol)?.name || 'Standard'}</p>
                            </div>
                        </div>
                    </div>

                    <HarvestLocalSyncPanel 
                        event={event} 
                        onPushToCloud={handlePushToCloud} 
                        onSyncToLAN={handleSyncToLAN} 
                        isLocalMode={true} 
                        isSimulationMode={isSimulationMode}
                        onToggleSimulation={toggleSimulationMode}
                        simulatedCount={simulatedEntries.length}
                        onCommitSimulation={handleCommitSimulation}
                    />

                    <OperationLogWidget 
                        entries={filteredEntries}
                        employees={employees} 
                        onDetailedViewClick={() => setIsOperationLogOpen(true)}
                        onUpdateEntry={handleUpdateEntry}
                        onDeleteEntry={handleDeleteEntry}
                    />
                        </>
                    )}
                </div>
            </div>

            {/* Live Resizing Tool between Harvest Panel and Map */}
            {isSidebarOpen && (
                <ResizableDivider 
                    direction="horizontal"
                    currentSize={panelWidth}
                    onResize={(newWidth) => setPanelWidth(newWidth)}
                    minSize={280}
                    maxSize={typeof window !== 'undefined' ? Math.max(window.innerWidth - 300, 600) : 850}
                    storageKey="harvest_monitoring_panel_width"
                    isKa={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'}
                    className="hidden md:flex"
                />
            )}

            <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-200 h-full">
                 {memoizedMap}
                <div className="absolute top-4 left-4 z-[1000] bg-white/80 backdrop-blur p-2 rounded-lg shadow-md text-xs font-bold">
                    TARGET AREA: {sectorNames}
                </div>
            </div>

            {isWeighModalOpen && (
                <WeighStationModal 
                    isOpen={isWeighModalOpen} 
                    onClose={() => setIsWeighModalOpen(false)} 
                    onSave={handleAddEntry} 
                    eventId={event.id} 
                    protocol={event.protocol}
                    pickers={modalPickers} 
                    packagingItems={modalPackagingItems} 
                    varieties={activeVarieties}
                    defaultBoxWeightKg={event.defaultBoxWeightKg}
                    initialVariety={selectedVarieties[0]}
                    hardwareDevices={props.hardwareDevices}
                    entries={eventEntries}
                    currentUser={currentUser}
                    onDeleteEntry={handleDeleteEntry}
                    sectors={sectors}
                    allSectors={modalAllSectors}
                    allEmployees={employees}
                    onSetEmployees={onSetEmployees}
                    onSetHarvestEvents={onSetHarvestEvents}
                    harvestEvents={harvestEvents}
                />
            )}
            {isLogModalOpen && (
                <HarvestLogModal 
                    event={event} 
                    geometry={drawnGeometry} 
                    date={editingLog?.date || new Date().toISOString()} 
                    sectors={sectors} 
                    initialData={editingLog || undefined}
                    onSave={(log) => { 
                        if (editingLog) {
                            onSetHarvestLogs(prev => prev.map(l => l.id === editingLog.id ? { ...log, id: editingLog.id } as HarvestLog : l));
                        } else {
                            onSetHarvestLogs(prev => [...(prev || []), { ...log, id: `hlog-${Date.now()}` } as HarvestLog]); 
                        }
                        setIsLogModalOpen(false); 
                        setEditingLog(null);
                    }} 
                    onClose={() => {
                        setIsLogModalOpen(false);
                        setEditingLog(null);
                    }} 
                    plantationFeatures={plantationFeatures} 
                    varieties={activeVarieties}
                />
            )}
            {isOperationLogOpen && (
                <OperationLogModal
                    isOpen={isOperationLogOpen}
                    onClose={() => setIsOperationLogOpen(false)}
                    employees={employees}
                    entries={eventEntries}
                    onUpdateEntry={handleUpdateEntry}
                    onDeleteEntry={handleDeleteEntry}
                    varieties={activeVarieties}
                    onSetHarvestEntries={onSetHarvestEntries}
                    allHarvestEntries={harvestEntries}
                />
            )}
            {isCloseModalOpen && (
                <CloseHarvestModal
                    isOpen={isCloseModalOpen}
                    onClose={() => setIsCloseModalOpen(false)}
                    onConfirm={handleFinishEvent}
                    totalYield={event.totalNetWeightKg}
                    entries={eventEntries}
                    packagingItems={inventoryItems?.filter(i => i.category === 'Packaging' || i.category === 'Pallets')}
                />
            )}
            {showDailyHarvestModal && (
                <DailyHarvestModal 
                    isOpen={showDailyHarvestModal} 
                    initialTab={dailyHarvestModalTab}
                    onClose={() => setShowDailyHarvestModal(false)} 
                    event={event} 
                    employees={employees} 
                    entries={eventEntries} 
                    onSetHarvestEvents={onSetHarvestEvents} 
                    harvestEvents={harvestEvents} 
                    onLogActivity={onLogActivity} 
                    inventoryItems={inventoryItems} 
                    onSetInventoryItems={onSetInventoryItems} 
                    onSetEmployees={onSetEmployees} 
                    roles={roles} 
                    crops={crops} 
                    cropVarieties={cropVarieties} 
                    employeeGroups={employeeGroups} 
                    onSetEmployeeGroups={onSetEmployeeGroups} 
                    allHarvestEntries={harvestEntries} 
                    onSetHarvestEntries={onSetHarvestEntries} 
                    machinery={machinery} 
                    onSetMachinery={onSetMachinery}
                    onOpenFleetManager={() => setIsFleetManagerOpen(true)}
                />
            )}
            {isBoxScannerOpen && (
                <QrScannerModal 
                    isOpen={isBoxScannerOpen} 
                    onClose={() => setIsBoxScannerOpen(false)} 
                    onScan={handleBoxScan} 
                    title={t('language') === 'ka' ? "მოსავლის სკანერი (QR / შტრიხკოდი)" : "Harvest Box & Worker Scanner"}
                    description={t('language') === 'ka' ? "დაასკანერეთ მუშის ბარათი ან ყუთის შტრიხკოდი" : "Scan Worker ID Badge or Crate Barcode for instant registration"}
                    mockEmployees={employees}
                />
            )}
            {isHistoryModalOpen && (
                <HarvestEventHistoryModal 
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    event={event}
                    employees={employees}
                    entries={eventEntries}
                    onSetHarvestEntries={onSetHarvestEntries}
                    onLogActivity={onLogActivity}
                    onRestoreVersion={(restoredEvent) => {
                        onSetHarvestEvents(harvestEvents.map(e => e.id === restoredEvent.id ? restoredEvent : e));
                        setIsHistoryModalOpen(false);
                    }}
                />
            )}
            {isShareModalOpen && (
                <ShareHarvestEventModal 
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    event={event}
                    entries={eventEntries}
                />
            )}
            {isOnlineUsersModalOpen && (
                <OnlineUsersModal 
                    isOpen={isOnlineUsersModalOpen}
                    onClose={() => setIsOnlineUsersModalOpen(false)}
                    users={activeOnlineUsers}
                    eventName={event.name}
                    eventId={event.id}
                />
            )}
            {isMaterialsModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center p-4 backdrop-blur-xs" onClick={() => setIsMaterialsModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>📦</span> Used Materials & Supplies from Stock
                            </h3>
                            <button onClick={() => setIsMaterialsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <MaterialsPickerForm
                            inventoryItems={inventoryItems || []}
                            onAddMaterial={(selectedItemId, qty, unitCost) => {
                                const item = (inventoryItems || []).find(i => i.id === selectedItemId);
                                const itemName = item?.name || 'Used Material';
                                const totalCost = qty * unitCost;

                                const updatedOpex = [
                                    ...(event.otherOpexItems || []),
                                    { id: `mat-${Date.now()}`, name: `${itemName} (x${qty})`, cost: totalCost }
                                ];

                                const updatedEvent = { ...event, otherOpexItems: updatedOpex };
                                onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));

                                if (item && onSetInventoryItems && inventoryItems) {
                                    const updatedStock = inventoryItems.map(i => i.id === item.id ? { ...i, currentStock: Math.max(0, i.currentStock - qty) } : i);
                                    onSetInventoryItems(updatedStock);
                                }

                                toast.success(`Recorded material: ${itemName} (Qty: ${qty}, Cost: $${totalCost.toFixed(2)})`);
                                setIsMaterialsModalOpen(false);
                            }}
                            onClose={() => setIsMaterialsModalOpen(false)}
                        />
                    </div>
                </div>
            )}
            {isFleetManagerOpen && (
                <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center p-4 backdrop-blur-xs" onClick={() => setIsFleetManagerOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-5 border border-slate-200 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>🚜</span> Central Fleet & Machinery Master Form
                            </h3>
                            <button onClick={() => setIsFleetManagerOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <MachineryManager
                            machinery={machinery || []}
                            onSetMachinery={onSetMachinery || (() => {})}
                            currentUserPermissions={new Set<Permission>(['edit_machinery', 'edit_work', 'admin_access'])}
                            employees={employees || []}
                        />
                    </div>
                </div>
            )}
            {isHarvestBoxQrOpen && (
                <HarvestBoxQrModal
                    isOpen={isHarvestBoxQrOpen}
                    onClose={() => setIsHarvestBoxQrOpen(false)}
                    harvestEvent={event}
                    employees={employees}
                />
            )}
        </div>
    );
};

export default HarvestDashboard;
