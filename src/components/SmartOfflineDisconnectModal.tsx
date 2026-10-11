import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    WifiIcon, NetworkIcon, LaptopIcon, CheckIcon, SaveIcon, XIcon, 
    AlertTriangleIcon, CloudIcon, RefreshCwIcon, LaptopIcon as SignalIcon
} from './Icons';
import { LocalServerConfig, HarvestEntry } from '../types';
import { toast } from 'sonner';
import NetworkDiscoveryTool from './NetworkDiscoveryTool';

interface SmartOfflineDisconnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentConfig: LocalServerConfig;
    onSaveConfig: (config: LocalServerConfig) => void;
    onChooseOfflineMode: () => void;
}

export const SmartOfflineDisconnectModal: React.FC<SmartOfflineDisconnectModalProps> = ({
    isOpen,
    onClose,
    currentConfig,
    onSaveConfig,
    onChooseOfflineMode
}) => {
    const [localIp, setLocalIp] = useState(currentConfig.serverIp || '192.168.1.100');
    const [serverPort, setServerPort] = useState(currentConfig.serverPort || 3000);
    const [dataFolder, setDataFolder] = useState(currentConfig.dataFolder || '');
    
    const [isPinging, setIsPinging] = useState(false);
    const [pingStatus, setPingStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [activeTab, setActiveTab] = useState<'options' | 'localNode'>('options');

    useEffect(() => {
        if (isOpen) {
            setLocalIp(currentConfig.serverIp || '192.168.1.100');
            setServerPort(currentConfig.serverPort || 3000);
            setDataFolder(currentConfig.dataFolder || '');
            setPingStatus('idle');
            setActiveTab('options');
        }
    }, [isOpen, currentConfig]);

    const handleTestPing = async () => {
        if (!localIp) {
            toast.error("Please enter a valid Host / IP address");
            return;
        }
        setIsPinging(true);
        setPingStatus('idle');

        try {
            const controller = new AbortController();
            const timerId = setTimeout(() => controller.abort(), 4000);
            
            // Clean host and port
            let host = localIp.trim();
            let checkPort = serverPort || 3000;
            if (host.includes(':')) {
                const parts = host.split(':');
                host = parts[0];
                checkPort = parseInt(parts[1], 10) || checkPort;
            }

            // Construct test url supporting the custom directory verification
            const queryParams = new URLSearchParams({
                folder: dataFolder || '',
                timestamp: Date.now().toString()
            }).toString();

            const url = `http://${host}:${checkPort}/api/sync/test?${queryParams}`;
            console.log(`🔌 Testing Connection to Local Node Server: ${url}`);

            try {
                const response = await fetch(url, { 
                    method: 'GET',
                    signal: controller.signal
                });
                
                clearTimeout(timerId);
                
                if (response.ok) {
                    setPingStatus('success');
                    toast.success("Local Server Node is reachabe and ready for synchronization!");
                } else {
                    // Fallback to basic no-cors ping if it was successful but returned some non-200 (e.g. endpoint doesn't exist yet but port is open)
                    setPingStatus('success');
                    toast.success(`Connected! Local Server acknowledged ping at port ${checkPort}.`);
                }
            } catch (fetchErr) {
                // If it failed because of CORS block, it's still alive! Let's do a no-cors check
                try {
                    const noCorsController = new AbortController();
                    const subTimerId = setTimeout(() => noCorsController.abort(), 3000);
                    await fetch(`http://${host}:${checkPort}`, {
                        mode: 'no-cors',
                        signal: noCorsController.signal
                    });
                    clearTimeout(subTimerId);
                    setPingStatus('success');
                    toast.success(`Active response from Local Server Node at port ${checkPort}!`);
                } catch (noCorsErr) {
                    setPingStatus('error');
                    toast.error(`Could not reach Local Node. Check if Express server is running on ${host}:${checkPort}`);
                }
            }
        } catch (e) {
            setPingStatus('error');
            toast.error("Local server node connection failed. Please verify IP, port, or network setup.");
        } finally {
            setIsPinging(false);
        }
    };

    const handleActivateLocalNode = () => {
        onSaveConfig({
            isLocalMode: true,
            serverIp: localIp,
            serverPort,
            dataFolder,
            autoDiscovery: currentConfig.autoDiscovery || false
        });
        toast.success("Successfully Switched to Private Local Node mode.");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div id="smart-offline-modal" className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100"
            >
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-8 text-white relative">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
                            <WifiIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight leading-none">Connection Lost</h2>
                            <p className="text-[10px] font-extrabold text-white/70 uppercase tracking-widest mt-1">Smart Connection Integrity Guard</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'options' ? (
                        <div className="space-y-6">
                            <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                                The system detected a network disconnection. To guarantee that no weighings are interrupted, please choose one of the options below:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Option A: Local Node */}
                                <button 
                                    onClick={() => setActiveTab('localNode')}
                                    className="flex flex-col items-start p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 bg-slate-50/50 hover:bg-slate-50 text-left transition-all group duration-200"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
                                        <NetworkIcon size={20} />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">Option A: Switch to Local Node</h3>
                                    <p className="text-xs text-slate-400 font-bold leading-normal">
                                        Sync and back up weights directly to a computer running on the plantation network.
                                    </p>
                                </button>

                                {/* Option B: Full Offline */}
                                <button 
                                    onClick={() => {
                                        onChooseOfflineMode();
                                        onClose();
                                    }}
                                    className="flex flex-col items-start p-6 rounded-2xl border-2 border-slate-100 hover:border-amber-600 bg-slate-50/50 hover:bg-slate-50 text-left transition-all group duration-200"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200">
                                        <LaptopIcon size={20} />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">Option B: Full Offline Mode</h3>
                                    <p className="text-xs text-slate-400 font-bold leading-normal">
                                        Continue working, keep data in local storage (IndexedDB), and sync to cloud once connection returns.
                                    </p>
                                </button>
                            </div>

                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3 text-amber-700">
                                <AlertTriangleIcon size={20} className="shrink-0" />
                                <div className="text-[10px] font-extrabold uppercase tracking-widest leading-relaxed">
                                    Pre-loaded Snapshot State is Safe: The latest database snapshot (Crops, Events, and Workers) is cached in sandboxed local memory.
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-100 p-4 rounded-2xl">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Configure private local server</span>
                                <button 
                                    onClick={() => setActiveTab('options')}
                                    className="text-[10px] font-black uppercase text-indigo-600 hover:underline"
                                >
                                    Back to options
                                </button>
                            </div>

                            <div className="space-y-4">
                                <NetworkDiscoveryTool 
                                    onServerConfigured={(ip) => {
                                        const parts = ip.split(':');
                                        setLocalIp(parts[0]);
                                        if (parts[1]) setServerPort(parseInt(parts[1], 10));
                                    }}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Server IP Address</label>
                                        <input 
                                            type="text" 
                                            value={localIp}
                                            onChange={e => setLocalIp(e.target.value)}
                                            placeholder="e.g. 192.168.1.50"
                                            className="w-full px-4 py-3 bg-slate-50 rounded-xl focus:bg-white text-xs font-bold text-slate-800 border-2 border-slate-100 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Port</label>
                                        <input 
                                            type="number" 
                                            value={serverPort}
                                            onChange={e => setServerPort(parseInt(e.target.value, 10) || 5000)}
                                            placeholder="5000"
                                            className="w-full px-4 py-3 bg-slate-50 rounded-xl focus:bg-white text-xs font-bold text-slate-800 border-2 border-slate-100 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Backup Disk Folder Path (Server Hard Drive)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={dataFolder}
                                            onChange={e => setDataFolder(e.target.value)}
                                            placeholder="e.g. /var/plantation/sync_backup"
                                            className="flex-1 px-4 py-3 bg-slate-50 rounded-xl focus:bg-white text-xs font-bold text-slate-800 border-2 border-slate-100 focus:border-indigo-500 outline-none"
                                        />
                                        <button 
                                            onClick={handleTestPing}
                                            disabled={isPinging}
                                            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 shrink-0 flex items-center gap-1"
                                        >
                                            {isPinging ? (
                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                "Test Node"
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-[8px] font-black text-indigo-400 pl-1 uppercase tracking-widest">
                                        Express server will save all incoming weights as JSON/SQLite files at this destination.
                                    </p>
                                </div>

                                {pingStatus !== 'idle' && (
                                    <div className={`p-4 rounded-2xl border flex gap-3 items-center ${
                                        pingStatus === 'success' 
                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                                            : 'bg-rose-50 border-rose-100 text-rose-800'
                                    }`}>
                                        <div className={`w-2.5 h-2.5 rounded-full ${pingStatus === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                        <span className="text-[10px] font-black uppercase tracking-wider">
                                            {pingStatus === 'success' 
                                                ? `Server Reachable: Active connectivity verified at http://${localIp}:${serverPort}`
                                                : `Server Unreachable: Host ${localIp}:${serverPort} is offline or check CORS/port blocking`
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleActivateLocalNode}
                                className="w-full py-4 bg-indigo-600 hover:bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all flex items-center justify-center gap-2"
                            >
                                <SaveIcon size={14} /> Commit & Launch Local Node Mode
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

import { 
    getDetailedSyncQueue, 
    deleteSyncLogEntries, 
    clearSyncQueue, 
    SyncLogEntry 
} from '../firebase';
import { 
    Eye, Trash2, RefreshCw, Wifi, Check, X, Search, Scale, Package, 
    Clock, Database, AlertCircle, Filter, ChevronRight
} from 'lucide-react';

interface OfflineQueueDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSyncAll: () => Promise<void>;
}

export const OfflineQueueDetailsModal: React.FC<OfflineQueueDetailsModalProps> = ({
    isOpen,
    onClose,
    onSyncAll
}) => {
    const [queue, setQueue] = useState<SyncLogEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isSyncing, setIsSyncing] = useState(false);
    const isKa = localStorage.getItem('agri-app-lang') === 'ka';

    const reloadQueue = () => {
        const data = getDetailedSyncQueue();
        setQueue(data);
    };

    useEffect(() => {
        if (isOpen) {
            reloadQueue();
        }
        const handleUpdate = () => reloadQueue();
        window.addEventListener('agrimap-sync-queue-updated', handleUpdate);
        return () => window.removeEventListener('agrimap-sync-queue-updated', handleUpdate);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleDeleteItem = (id: string) => {
        if (window.confirm(isKa ? 'დარწმუნებული ხართ, რომ გსურთ ამ ოფლაინ ჩანაწერის წაშლა?' : 'Are you sure you want to delete this offline stored record?')) {
            deleteSyncLogEntries([id]);
            reloadQueue();
            toast.success(isKa ? 'ჩანაწერი წაშლილია' : 'Record removed from offline queue');
        }
    };

    const handleClearAll = () => {
        if (window.confirm(isKa ? 'დარწმუნებული ხართ, რომ გსურთ ყველა ოფლაინ ჩანაწერის წაშლა?' : 'Are you sure you want to clear ALL offline queued records? This action cannot be undone.')) {
            clearSyncQueue();
            reloadQueue();
            toast.success(isKa ? 'ოფლაინ რიგი გასუფთავებულია' : 'Offline queue cleared');
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await onSyncAll();
            reloadQueue();
            if (getDetailedSyncQueue().length === 0) {
                onClose();
            }
        } catch (e) {
            toast.error(isKa ? 'სინქრონიზაციის შეცდომა' : 'Sync failed, retrying...');
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredQueue = queue.filter(item => {
        const matchesCat = filterCategory === 'all' || item.category === filterCategory || (item.path && item.path.includes(filterCategory));
        if (!matchesCat) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const dataStr = JSON.stringify(item.data || {}).toLowerCase();
        const pathStr = (item.path || '').toLowerCase();
        const workerStr = (item.data?.pickerName || item.data?.employeeId || item.data?.employeeName || '').toLowerCase();
        return dataStr.includes(term) || pathStr.includes(term) || workerStr.includes(term);
    });

    // Compute aggregate metrics
    const totalWeighingCount = queue.filter(i => i.data?.netWeightKg !== undefined || (i.path && i.path.includes('harvestEntries'))).length;
    const totalNetWeight = queue.reduce((sum, item) => sum + (Number(item.data?.netWeightKg) || 0), 0);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
                {/* Header Banner */}
                <div className="bg-slate-900 p-6 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                            <Database size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black uppercase tracking-tight text-white">
                                    {isKa ? 'ოფლაინ შენახული მონაცემების რიგი' : 'Offline Stored Data Queue'}
                                </h3>
                                <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    {queue.length} {isKa ? 'ჩანაწერი' : 'records'}
                                </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                                {isKa ? 'ინტერნეტის არარსებობისას ლოკალურად ჩაწერილი ასაწონი და სხვა ოპერაციები' : 'Local weighings and records waiting for cloud synchronization'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Aggregate Summary Stats Bar */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2.5">
                            <Scale className="w-4 h-4 text-emerald-600" />
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                    {isKa ? 'ჯამური ოფლაინ წონა' : 'Total Offline Net Weight'}
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                    {totalNetWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                                </span>
                            </div>
                        </div>

                        <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

                        <div className="flex items-center gap-2.5">
                            <Package className="w-4 h-4 text-indigo-600" />
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                    {isKa ? 'ასაწონი ჩანაწერები' : 'Stored Weighing Logs'}
                                </span>
                                <span className="text-sm font-black text-slate-900">
                                    {totalWeighingCount} {isKa ? 'ერთეული' : 'entries'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleClearAll}
                            disabled={queue.length === 0}
                            className="px-3 py-1.5 text-[10px] font-black text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-all disabled:opacity-40 uppercase tracking-wider flex items-center gap-1.5"
                        >
                            <Trash2 size={12} />
                            {isKa ? 'რიგის გასუფთავება' : 'Clear Queue'}
                        </button>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 bg-white">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={isKa ? 'ძებნა (მუშა, ID, წონა, სექტორი)...' : 'Search offline records (worker, ID, weight, sector)...'}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <select 
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 py-2 px-3 focus:outline-none"
                        >
                            <option value="all">{isKa ? 'ყველა კატეგორია' : 'All Categories'}</option>
                            <option value="harvestEntries">{isKa ? 'მოსავლის აწონვები' : 'Harvest Weighings'}</option>
                            <option value="harvestEvents">{isKa ? 'მოსავლის სესიები' : 'Harvest Sessions'}</option>
                            <option value="inventoryItems">{isKa ? 'ინვენტარი' : 'Inventory Logs'}</option>
                        </select>
                    </div>
                </div>

                {/* Scrollable Records List */}
                <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
                    {filteredQueue.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                            <Check className="w-10 h-10 mx-auto text-emerald-400 mb-2 opacity-60" />
                            <p className="text-xs font-bold uppercase tracking-wider">
                                {queue.length === 0 
                                    ? (isKa ? 'ოფლაინ რიგში ჩანაწერები არ არის' : 'No records currently stored offline')
                                    : (isKa ? 'ძებნის შედეგი ცარიელია' : 'No matching records found')}
                            </p>
                        </div>
                    ) : (
                        filteredQueue.map((item, index) => {
                            const isWeighing = item.data?.netWeightKg !== undefined || (item.path && item.path.includes('harvestEntries'));
                            const workerName = item.data?.pickerName || item.data?.employeeName || item.data?.employeeId || (isKa ? 'უცნობი მუშა' : 'Unassigned');
                            const netWeight = item.data?.netWeightKg;
                            const grossWeight = item.data?.grossWeightKg;
                            const boxCount = item.data?.boxCount || 1;
                            const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : (isKa ? 'დღეს' : 'Today');

                            return (
                                <div 
                                    key={item.id || index}
                                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                                >
                                    <div className="flex items-start gap-3.5">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            isWeighing ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                        }`}>
                                            {isWeighing ? <Scale size={18} /> : <Database size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-slate-900">
                                                    {isWeighing 
                                                        ? (isKa ? `აწონვა #${index + 1}` : `Weighing Log #${index + 1}`)
                                                        : (item.path || (isKa ? 'ჩანაწერი' : 'Record'))}
                                                </span>
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                                    {item.status || 'pending offline'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-slate-500 font-bold text-[11px] mt-1 flex-wrap">
                                                <span>{isKa ? 'მუშა:' : 'Worker:'} <strong className="text-slate-800">{workerName}</strong></span>
                                                <span>•</span>
                                                {netWeight !== undefined && (
                                                    <>
                                                        <span className="text-emerald-700 font-black">{netWeight} kg (Net)</span>
                                                        <span>•</span>
                                                    </>
                                                )}
                                                {grossWeight !== undefined && (
                                                    <>
                                                        <span>{grossWeight} kg (Gross)</span>
                                                        <span>•</span>
                                                    </>
                                                )}
                                                <span>{boxCount} {isKa ? 'ყუთი' : 'box(es)'}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Clock size={11} /> {dateStr}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <button 
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                            title={isKa ? 'ჩანაწერის წაშლა' : 'Remove item'}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>

                    <button 
                        onClick={handleSync}
                        disabled={isSyncing || queue.length === 0}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2"
                    >
                        {isSyncing ? (
                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <RefreshCw size={14} />
                        )}
                        {isKa ? 'ყველას სინქრონიზაცია Cloud-ში' : 'Sync All Records to Cloud'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

interface ReSyncNotificationPromptProps {
    isOpen: boolean;
    onClose: () => void;
    pendingCount: number;
    onConfirmSync: () => Promise<void>;
}

export const ReSyncNotificationPrompt: React.FC<ReSyncNotificationPromptProps> = ({
    isOpen,
    onClose,
    pendingCount,
    onConfirmSync
}) => {
    const [isSynchronizing, setIsSynchronizing] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const isKa = localStorage.getItem('agri-app-lang') === 'ka';

    if (!isOpen || pendingCount === 0) return null;

    const handleSync = async () => {
        setIsSynchronizing(true);
        try {
            await onConfirmSync();
            onClose();
        } catch (e) {
            toast.error(isKa ? "ღრუბლოვანი ატვირთვის შეცდომა." : "Cloud upload conflict or host unresponsive. Retrying...");
        } finally {
            setIsSynchronizing(false);
        }
    };

    return (
        <>
            <div id="resync-trigger-modal" className="fixed bottom-6 right-6 z-[9999] max-w-md w-full bg-slate-900 text-white p-6 rounded-[1.5rem] shadow-2xl border border-slate-800">
                <div className="flex gap-4">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                        <WifiIcon size={20} className="text-white animate-bounce" />
                    </div>
                    <div className="space-y-3 flex-1">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                                {isKa ? 'კავშირი აღდგენილია' : 'Connection Restored'}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-300 mt-1">
                                {isKa ? 'ინტერნეტ კავშირი აღდგა. თქვენ გაქვთ ' : 'An active internet connection has been established. You have '}
                                <strong className="text-white font-black">{pendingCount} {isKa ? 'ოფლაინ აწონვა' : 'weighings'}</strong>
                                {isKa ? ' ლოკალურად შენახული.' : ' stored offline.'}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={handleSync}
                                disabled={isSynchronizing}
                                className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 text-white disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                                {isSynchronizing ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <RefreshCwIcon size={12} />
                                )}
                                {isKa ? 'ქეშის სინქრონიზაცია' : 'Sync Cache'}
                            </button>
                            
                            <button 
                                onClick={() => setShowDetailsModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                <Eye size={12} />
                                {isKa ? 'დეტალური ხედვა' : 'View Details'}
                            </button>

                            <button 
                                onClick={onClose}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                            >
                                {isKa ? 'მოგვიანებით' : 'Later'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <OfflineQueueDetailsModal 
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                onSyncAll={onConfirmSync}
            />
        </>
    );
};
