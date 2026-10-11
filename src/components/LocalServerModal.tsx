import React, { useState, useEffect } from 'react';
import { 
    XCircleIcon, 
    NetworkIcon, 
    SaveIcon, 
    LaptopIcon, 
    CheckIcon, 
    WifiIcon, 
    CloudIcon, 
    FolderIcon, 
    ClipboardDocumentIcon, 
    ChevronDownIcon, 
    ChevronUpIcon, 
    DocumentTextIcon 
} from './Icons';
import { LocalServerConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import NetworkDiscoveryTool from './NetworkDiscoveryTool';

interface LocalServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: LocalServerConfig;
    onSave: (config: LocalServerConfig) => void;
    onPushToCloud?: () => Promise<void>;
}

const TEMPLATE_CODE = `/**
 * Agrimap Private Local Server Node Template
 * 
 * This is a lightweight Node.js + Express server that runs on a local computer
 * on the plantation's WiFi network. It acts as an offline backup sink,
 * receiving synchronized weighings and saving them directly to JSON files
 * or local storage, avoiding browser sandboxing limits.
 * 
 * To run this server:
 * 1. Install Node.js (https://nodejs.org)
 * 2. In a terminal, run:
 *    npm install express cors body-parser
 * 3. Save this file as \`server.js\` and start it with:
 *    node server.js
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const DEFAULT_PORT = 3000;

// Enable CORS and parsing of JSON payloads
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// 1. Connection Ping and Folder Test endpoint
app.get('/api/sync/test', (req, res) => {
    const dataFolder = req.query.folder || '';
    console.log(\`🔌 Ping received. Data folder requested: "\${dataFolder}"\`);

    if (dataFolder) {
        try {
            // Check if folder exists or create it
            const resolvedPath = path.resolve(dataFolder);
            if (!fs.existsSync(resolvedPath)) {
                fs.mkdirSync(resolvedPath, { recursive: true });
                console.log(\`📁 Created backup directory: \${resolvedPath}\`);
            }
            return res.json({ 
                status: 'ok', 
                message: 'Local server is active and backup folder verified!',
                resolvedPath
            });
        } catch (err) {
            console.error(\`❌ Folder verification failed for "\${dataFolder}":\`, err.message);
            return res.status(400).json({ 
                status: 'error', 
                message: \`Failed to verify/create directory: \${err.message}\` 
            });
        }
    }

    res.json({ status: 'ok', message: 'Local server node is active and reachable.' });
});

// 2. Synchronization and Mirror Duplicate-Write endpoint
app.post('/api/sync', (req, res) => {
    const { path: dbPath, type, data, deviceId, dataFolder, timestamp } = req.body;
    
    if (!dbPath) {
        return res.status(400).json({ error: 'Missing sync path parameters' });
    }

    console.log(\`📥 Sync received: [\${type.toUpperCase()}] for "\${dbPath}" from Device: \${deviceId}\`);

    // Determine saving location: fallback to local './agrimap_backup' if none specified
    const storageDir = dataFolder ? path.resolve(dataFolder) : path.join(__dirname, 'agrimap_backup');
    
    try {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }

        // Sanitize path to form a valid filename e.g. "harvestEntries_hent-1234.json"
        const safeFileName = dbPath.replace(/\\//g, '_') + '.json';
        const fileFullPath = path.join(storageDir, safeFileName);

        if (type === 'delete') {
            if (fs.existsSync(fileFullPath)) {
                fs.unlinkSync(fileFullPath);
                console.log(\`🗑️ Deleted local file: \${fileFullPath}\`);
            }
        } else {
            // Write payload with timestamp and device meta information
            const payload = {
                synced_at_local: new Date().toISOString(),
                client_timestamp: timestamp,
                device_id: deviceId,
                collection_path: dbPath,
                operation: type,
                payload: data
            };

            fs.writeFileSync(fileFullPath, JSON.stringify(payload, null, 2), 'utf8');
            console.log(\`💾 Saved local mirror file: \${fileFullPath}\`);
        }

        res.json({ status: 'success', savedPath: fileFullPath });
    } catch (err) {
        console.error(\`❌ Sync Operation failed for "\${dbPath}":\`, err.message);
        res.status(500).json({ error: \`Disk writing failed: \${err.message}\` });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal server error occurred.' });
});

// Run server binding to all network interfaces on the machine
const startServer = () => {
    const port = process.env.PORT || DEFAULT_PORT;
    app.listen(port, '0.0.0.0', () => {
        console.log(\`================================================================\`);
        console.log(\`🍇 agrimap Private Local Node initialized                       \`);
        console.log(\`📡 Server running on http://localhost:\${port}                   \`);
        console.log(\`🌐 Accessible on local WiFi network at your computer's IP       \`);
        console.log(\`================================================================\`);
    });
};

startServer();`;

const LocalServerModal: React.FC<LocalServerModalProps> = ({ isOpen, onClose, config, onSave, onPushToCloud }) => {
    const [localIp, setLocalIp] = useState(config.serverIp || '127.0.0.1');
    const [serverPort, setServerPort] = useState(config.serverPort || 3000);
    const [isLocalMode, setIsLocalMode] = useState(config.isLocalMode);
    const [firestorePort, setFirestorePort] = useState(config.firestorePort || 8080);
    const [authPort, setAuthPort] = useState(config.authPort || 9099);
    const [autoDiscovery, setAutoDiscovery] = useState(config.autoDiscovery);
    const [dataFolder, setDataFolder] = useState(config.dataFolder || '');
    
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const [isPinging, setIsPinging] = useState(false);
    const [pingStatus, setPingStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSyncingLocal, setIsSyncingLocal] = useState(false);
    const [showTemplate, setShowTemplate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLocalIp(config.serverIp || '127.0.0.1');
            setServerPort(config.serverPort || 3000);
            setIsLocalMode(config.isLocalMode);
            setAutoDiscovery(config.autoDiscovery);
            setFirestorePort(config.firestorePort || 8080);
            setAuthPort(config.authPort || 9099);
            setDataFolder(config.dataFolder || '');
            setPingStatus('idle');
        }
    }, [isOpen, config]);

    const handlePing = async () => {
        setIsPinging(true);
        setPingStatus('idle');
        try {
            const controller = new AbortController();
            const timerId = setTimeout(() => controller.abort(), 4000);
            
            let host = localIp.trim();
            let checkPort = serverPort || 3000;
            if (host.includes(':')) {
                const parts = host.split(':');
                host = parts[0];
                const parsedPort = parseInt(parts[1], 10);
                if (!isNaN(parsedPort)) {
                    checkPort = parsedPort;
                }
            }

            const queryParams = new URLSearchParams({
                folder: dataFolder || '',
                timestamp: Date.now().toString()
            }).toString();

            const url = `http://${host}:${checkPort}/api/sync/test?${queryParams}`;
            console.log(`🔌 Pinging Local Server Node at: ${url}`);

            const response = await fetch(url, { 
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timerId);
            
            if (response.ok) {
                const resData = await response.json();
                setPingStatus('success');
                if (resData.resolvedPath) {
                    toast.success(`Success! Connected to Node. Active Backup Folder: ${resData.resolvedPath}`);
                } else {
                    toast.success(`Connection Established! Local Server Node at ${host}:${checkPort} is Active.`);
                }
            } else {
                // If ping succeeds but returns weird/non-json, it is still active
                setPingStatus('success');
                toast.success(`Active response from Local Server Node at ${host}:${checkPort}.`);
            }
        } catch (e) {
            // Support no-cors ping fallback for cross-origin LAN edge cases
            try {
                const noCorsController = new AbortController();
                const subTimerId = setTimeout(() => noCorsController.abort(), 2000);
                
                let host = localIp.trim();
                let checkPort = serverPort || 3000;
                if (host.includes(':')) {
                    const parts = host.split(':');
                    host = parts[0];
                    const parsedPort = parseInt(parts[1], 10);
                    if (!isNaN(parsedPort)) checkPort = parsedPort;
                }
                
                await fetch(`http://${host}:${checkPort}`, {
                    mode: 'no-cors',
                    signal: noCorsController.signal
                });
                clearTimeout(subTimerId);
                setPingStatus('success');
                toast.success(`Active Response (LAN Handshake OK) from local node server at port ${checkPort}.`);
            } catch (err) {
                setPingStatus('error');
                toast.error(`Local Node Connection Failed: Host ${localIp}:${serverPort} is offline or unreachable.`);
            }
        } finally {
            setIsPinging(false);
        }
    };

    const handleSync = async () => {
        if (!onPushToCloud) return;
        setIsSyncing(true);
        try {
            await onPushToCloud();
            toast.success("Cloud Synchronizer Complete!");
        } catch (e) {
            toast.error("Sync Error: Cloud Unavailable");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSyncToLocalNode = async () => {
        setIsSyncingLocal(true);
        try {
            const syncQueueString = localStorage.getItem('agrimap-pending-sync') || '[]';
            const syncQueue = JSON.parse(syncQueueString);
            const pendingItems = syncQueue.filter((i: any) => i.status === 'pending');
            
            if (pendingItems.length === 0) {
                toast.info("No un-synced offline modifications queued.");
                return;
            }

            let host = localIp.trim();
            let checkPort = serverPort || 3000;
            if (host.includes(':')) {
                const parts = host.split(':');
                host = parts[0];
                const parsedPort = parseInt(parts[1], 10);
                if (!isNaN(parsedPort)) {
                    checkPort = parsedPort;
                }
            }

            const url = `http://${host}:${checkPort}/api/sync`;
            const devId = localStorage.getItem('agrimap-device-id') || 'dev-unknown';
            
            let successCount = 0;
            
            for (const item of pendingItems) {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            path: item.path,
                            type: item.type,
                            data: item.data,
                            deviceId: devId,
                            dataFolder: dataFolder || '',
                            timestamp: item.timestamp || new Date().toISOString()
                        })
                    });
                    
                    if (response.ok) {
                        successCount++;
                    }
                } catch (err) {
                    console.error("Local sync single item error:", err);
                }
            }
            
            if (successCount > 0) {
                // Update local storage status to 'local_synced' so browser doesn't prompt again.
                try {
                    const { bulkUpdateSyncStatus } = await import('../firebase');
                    const chunkIds = pendingItems.map((i: any) => i.id);
                    bulkUpdateSyncStatus(chunkIds, 'local_synced');
                } catch (e) {
                    console.error("Failed to update local sync status", e);
                }
                
                toast.success(`Success! Saved ${successCount}/${pendingItems.length} records to local backup directory.`);
            } else {
                toast.error("Mirrored local backup node failed. Check server connection & data write folder.");
            }
        } catch (e) {
            console.error("Local Server sync failed", e);
            toast.error("An error occurred during manual local sync.");
        } finally {
            setIsSyncingLocal(false);
        }
    };

    const handleCopyTemplate = () => {
        navigator.clipboard.writeText(TEMPLATE_CODE);
        toast.success("Express Node JS Setup Code copied!");
    };

    const handleSave = () => {
        onSave({
            isLocalMode,
            serverIp: localIp,
            serverPort,
            firestorePort,
            authPort,
            autoDiscovery,
            dataFolder
        });
        setSaveStatus('Config Updated');
        setTimeout(() => {
            setSaveStatus(null);
            onClose();
            window.location.reload(); 
        }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[6000] flex items-center justify-center p-4 md:p-6" onClick={onClose}>
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-8 border-b flex justify-between items-center bg-indigo-600 text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                            <NetworkIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight leading-none">Local Server Node</h2>
                            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Private LAN Infrastructure</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-2xl transition-colors">
                        <XCircleIcon className="h-8 w-8 text-white/30" />
                    </button>
                </div>

                {/* Main Scroll Content */}
                <div className="p-8 space-y-8 overflow-y-auto flex-1 max-h-[60vh] pr-4">
                    <div className="space-y-4">
                        {/* Activate Mode Checkbox */}
                        <label className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 cursor-pointer hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${isLocalMode ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <LaptopIcon size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Activate Local Mode</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Redirect all traffic to LAN server</p>
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={isLocalMode} 
                                onChange={e => setIsLocalMode(e.target.checked)}
                                className="w-6 h-6 rounded-lg text-indigo-600 border-2 border-slate-200 focus:ring-indigo-500"
                            />
                        </label>

                        {/* Local Network Discovery & Health Test Tool */}
                        <NetworkDiscoveryTool 
                            onServerConfigured={(ip) => {
                                const parts = ip.split(':');
                                setLocalIp(parts[0]);
                                if (parts[1]) setServerPort(parseInt(parts[1], 10));
                                setIsLocalMode(true);
                            }}
                        />

                        <AnimatePresence>
                            {isLocalMode && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div className="p-6 bg-indigo-50 rounded-3xl border-2 border-indigo-100 space-y-4">
                                        {/* IP Address Field with Test Button */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Server IP Address / Host</label>
                                                <div className="flex items-center gap-1.5">
                                                    {pingStatus === 'success' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                                                    {pingStatus === 'error' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                                                    <span className={`text-[8px] font-black uppercase ${pingStatus === 'success' ? 'text-emerald-600' : pingStatus === 'error' ? 'text-red-600' : 'text-slate-400'}`}>
                                                        {pingStatus === 'success' ? 'Verified' : pingStatus === 'error' ? 'Failed' : 'Ready'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="relative group">
                                                <input 
                                                    type="text" 
                                                    value={localIp} 
                                                    onChange={e => setLocalIp(e.target.value)}
                                                    className="w-full px-5 py-4 bg-white border-2 border-indigo-100 rounded-2xl focus:border-indigo-500 outline-none font-bold text-sm tracking-widest text-indigo-900 pr-14"
                                                    placeholder="e.g. 192.168.1.100"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={handlePing}
                                                    disabled={isPinging}
                                                    title="Test LAN Server Connection Node"
                                                    className="absolute right-2 top-2 bottom-2 px-3 bg-indigo-600 text-white rounded-xl hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center justify-center"
                                                >
                                                    {isPinging ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <WifiIcon size={16} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Dynamic Backup Folder Field */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Target Backup Save Folder</label>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">LAN Destination Directory</span>
                                            </div>
                                            <div className="relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400">
                                                    <FolderIcon size={16} />
                                                </div>
                                                <input 
                                                    type="text" 
                                                    value={dataFolder} 
                                                    onChange={e => setDataFolder(e.target.value)}
                                                    className="w-full pl-11 pr-5 py-4 bg-white border-2 border-indigo-100 rounded-2xl focus:border-indigo-500 outline-none font-bold text-sm text-indigo-900"
                                                    placeholder="e.g. ./plantations_backup or /var/data"
                                                />
                                            </div>
                                        </div>

                                        {/* Port Details */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] px-1">Server Port</label>
                                                <input 
                                                    type="number" 
                                                    value={serverPort} 
                                                    onChange={e => setServerPort(parseInt(e.target.value, 10) || 3000)}
                                                    className="w-full px-5 py-4 bg-white border-2 border-indigo-100 rounded-2xl focus:border-indigo-500 outline-none font-bold text-sm text-indigo-950"
                                                    placeholder="3000"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] px-1">Firestore Port</label>
                                                <input 
                                                    type="number" 
                                                    value={firestorePort} 
                                                    onChange={e => setFirestorePort(parseInt(e.target.value, 10) || 8080)}
                                                    className="w-full px-5 py-4 bg-white border-2 border-indigo-100 rounded-2xl focus:border-indigo-500 outline-none font-bold text-sm text-indigo-950"
                                                    placeholder="8080"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] px-1">Auth Port</label>
                                                <input 
                                                    type="number" 
                                                    value={authPort} 
                                                    onChange={e => setAuthPort(parseInt(e.target.value, 10) || 9099)}
                                                    className="w-full px-5 py-4 bg-white border-2 border-indigo-100 rounded-2xl focus:border-indigo-500 outline-none font-bold text-sm text-indigo-950"
                                                    placeholder="9099"
                                                />
                                            </div>
                                        </div>

                                        {/* Node Status Badge */}
                                        <div className="flex items-center gap-3 px-2 py-1">
                                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping" />
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Connected: Port {serverPort} • Firestore {firestorePort} • Auth {authPort}</p>
                                        </div>

                                        {/* Action Sync Buttons in Grid */}
                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            <button 
                                                type="button"
                                                onClick={handleSyncToLocalNode}
                                                disabled={isSyncingLocal}
                                                className="py-4 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                            >
                                                {isSyncingLocal ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <LaptopIcon size={16} />
                                                )}
                                                Sync to LAN Node
                                            </button>

                                            <button 
                                                type="button"
                                                onClick={handleSync}
                                                disabled={isSyncing}
                                                className="py-4 bg-white border-2 border-indigo-100 rounded-2xl text-indigo-600 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                            >
                                                {isSyncing ? (
                                                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <CloudIcon size={16} />
                                                )}
                                                Force Cloud Sync
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expandable Server Code Setup Template */}
                                    <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 space-y-3">
                                        <button 
                                            type="button"
                                            onClick={() => setShowTemplate(!showTemplate)}
                                            className="w-full flex items-center justify-between text-left focus:outline-none"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                                    <DocumentTextIcon size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-700 uppercase tracking-tight">LAN Server Setup Template</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Copy self-contained Express server code</p>
                                                </div>
                                            </div>
                                            <div className="text-slate-400">
                                                {showTemplate ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {showTemplate && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="space-y-3 pt-3 border-t border-slate-100 overflow-hidden"
                                                >
                                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                                        Deploy this lightweight Node.js + Express setup onto any plantation central desktop or local operator laptop to sink weighings cleanly to regular JSON directories instantly, bypassing any browser sandbox boundaries.
                                                    </p>
                                                    <div className="relative group">
                                                        <pre className="max-h-40 overflow-y-auto bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-[9px] leading-relaxed select-all">
                                                            {TEMPLATE_CODE}
                                                        </pre>
                                                        <button
                                                            type="button"
                                                            onClick={handleCopyTemplate}
                                                            className="absolute top-2 right-2 px-3 py-1.5 bg-indigo-600 hover:bg-slate-950 text-white font-bold text-[9px] uppercase tracking-widest rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                                                        >
                                                            <ClipboardDocumentIcon size={11} />
                                                            Copy Code
                                                        </button>
                                                    </div>
                                                    <div className="p-3 bg-indigo-50/50 rounded-xl text-[9px] font-semibold text-indigo-700 leading-relaxed space-y-1">
                                                        <p>👉 <strong>File location:</strong> You can find this pre-authored template in your workspace root as <code className="font-mono bg-indigo-100/50 px-1 rounded font-black">/local-server-template.js</code>.</p>
                                                        <p>👉 <strong>Execution:</strong> run <code className="font-mono bg-indigo-100/50 px-1 rounded font-black">npm install express cors body-parser</code>, then launch with <code className="font-mono bg-indigo-100/50 px-1 rounded font-black">node server.js</code>.</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Auto Discover Checkbox */}
                                    <label className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 cursor-pointer text-xs">
                                        <span className="font-bold text-slate-500 uppercase tracking-widest">Auto-Discover on LAN</span>
                                        <input 
                                            type="checkbox" 
                                            checked={autoDiscovery} 
                                            onChange={e => setAutoDiscovery(e.target.checked)}
                                            className="w-5 h-5 rounded-lg text-slate-400 border-2 border-slate-200"
                                        />
                                    </label>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 shrink-0">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-relaxed">
                            ⚠️ Note: Reverting or switching modes will trigger an application reload to ensure clean database connection hooks. Ensure all local data is cached before switching.
                        </p>
                    </div>
                </div>

                {/* Footer Save Button */}
                <div className="p-8 border-t bg-slate-50 shrink-0">
                    <button 
                        type="button"
                        onClick={handleSave}
                        className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        {saveStatus ? (
                            <>
                                <CheckIcon size={16} /> {saveStatus}
                            </>
                        ) : (
                            <>
                                <SaveIcon size={16} /> Save Node Configuration
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default LocalServerModal;
