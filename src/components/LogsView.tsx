
import React, { useState } from 'react';
import { SystemLog } from '../types';
import { DocumentTextIcon, CheckIcon, AlertTriangleIcon, XIcon, ClockIcon, ServerStackIcon, CloudIcon, ShieldCheckIcon, RefreshCwIcon, TrashIcon, LaptopIcon as Monitor } from './Icons';
import { toast } from 'sonner';
import { SYSTEM_VERSION_HISTORY } from '../utils/version';

interface LogsViewProps {
    logs: SystemLog[];
    isManualOffline?: boolean;
    onToggleOffline?: (offline: boolean) => void;
    onPushToCloud?: () => Promise<void>;
    onExportBackup?: () => void;
    onImportBackup?: (data: any) => void;
    onResetSystem?: () => void;
    onOpenDataAuditor?: () => void;
    isSystemAdmin?: boolean;
    onDeleteLog?: (logId: string) => void;
}

const LogsView: React.FC<LogsViewProps> = ({ 
    logs, 
    isManualOffline, 
    onToggleOffline, 
    onPushToCloud, 
    onExportBackup, 
    onImportBackup, 
    onResetSystem,
    onOpenDataAuditor,
    isSystemAdmin,
    onDeleteLog
}) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedModule, setSelectedModule] = useState<string>('all');
    const [showAiAnalysis, setShowAiAnalysis] = useState(false);
    const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (!isSystemAdmin) return;
        const interval = setInterval(() => {
            const currentLogs = (window as any).__CONSOLE_LOGS__ || [];
            if (currentLogs.length !== consoleLogs.length) {
                setConsoleLogs([...currentLogs]);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isSystemAdmin, consoleLogs.length]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                onImportBackup?.(data);
            } catch (err) {
                toast.error("Invalid backup file format.");
            }
        };
        reader.readAsText(file);
    };

    const normalizedLogs = React.useMemo(() => logs.map(l => ({ ...l, module: l.module === 'marketplace' ? 'harvesting' : l.module })), [logs]);
    const modules = [...new Set(['all', 'harvesting', ...normalizedLogs.map(l => l.module)])];
    
    const filteredLogs = React.useMemo(() => {
        return normalizedLogs.filter(log => {
            const matchesModule = selectedModule === 'all' || log.module === selectedModule;
            const searchTerm = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || 
                log.action.toLowerCase().includes(searchTerm) || 
                (log.report && log.report.toLowerCase().includes(searchTerm));
            return matchesModule && matchesSearch;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [logs, selectedModule, searchQuery]);

    const runAiAnalysis = () => {
        setShowAiAnalysis(true);
        setAiAnalysisResult(null);
        setTimeout(() => {
            if (filteredLogs.length === 0) {
                setAiAnalysisResult("No logs available in the current filter for analysis.");
                return;
            }
            const issueCount = filteredLogs.filter(l => l.status !== 'success').length;
            const uniqueUsers = new Set(filteredLogs.map(l => l.userId)).size;
            
            let analysis = `**AI Log Analysis Report**\n\n`;
            analysis += `Analyzed ${filteredLogs.length} logs from the ${selectedModule === 'all' ? 'entire system' : selectedModule + ' module'}.\n`;
            analysis += `- **Total Issues Detected:** ${issueCount}\n`;
            analysis += `- **Unique Users Involved:** ${uniqueUsers}\n\n`;
            
            if (selectedModule === 'harvesting') {
                const manualAdjustments = filteredLogs.filter(l => l.action === 'Manual Adjustments Updated');
                if (manualAdjustments.length > 0) {
                    analysis += `**Harvesting Insights:** Detected ${manualAdjustments.length} manual adjustments to harvest statistics. Please verify these changes were authorized.\n`;
                } else {
                    analysis += `**Harvesting Insights:** No manual tampering or unusual weight adjustments detected in this module recently.\n`;
                }
            }
            setAiAnalysisResult(analysis);
        }, 1500);
    };

    return (
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-8">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".json"
            />
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">SYSTEM <span className="text-indigo-600">LOGS</span></h1>
                        <p className="text-sm font-bold text-slate-400 mt-1">Audit trail of all organization activity and automation triggers.</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {/* Data State Auditor temporarily disabled */}
                    </div>
                </div>

                {/* System Management Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-500" />
                        
                        <div className="relative z-10">
                            <h3 className="text-lg font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                                <ShieldCheckIcon size={24} className="text-indigo-400" /> Core Systems Orchestration
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => onToggleOffline?.(!isManualOffline)}
                                    className={`p-6 rounded-3xl border-2 transition-all flex flex-col gap-2 ${isManualOffline ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <ServerStackIcon size={20} />
                                        <div className={`w-3 h-3 rounded-full ${isManualOffline ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse'}`} />
                                    </div>
                                    <span className="font-black uppercase tracking-widest text-xs">{isManualOffline ? 'LAN Mode (Offline)' : 'Cloud Mode (Online)'}</span>
                                    <p className="text-[10px] font-bold opacity-60 uppercase">Toggle network architecture</p>
                                </button>

                                <button 
                                    disabled={isSyncing || isManualOffline}
                                    onClick={async () => {
                                        setIsSyncing(true);
                                        await onPushToCloud?.();
                                        setIsSyncing(false);
                                    }}
                                    className="p-6 rounded-3xl bg-white/5 border-2 border-white/10 hover:bg-white/10 transition-all flex flex-col gap-2 group"
                                >
                                    <div className="flex items-center justify-between text-indigo-400">
                                        <CloudIcon size={20} className={isSyncing ? 'animate-spin' : 'group-hover:animate-bounce'} />
                                        {isSyncing && <span className="text-[8px] font-black uppercase">Syncing...</span>}
                                    </div>
                                    <span className="font-black uppercase tracking-widest text-xs">Push to Cloud</span>
                                    <p className="text-[10px] font-bold opacity-40 uppercase">Manual Firestore synchronization</p>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 shadow-sm flex flex-col gap-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Disaster Recovery</h3>
                        
                        <button 
                            onClick={onExportBackup}
                            className="w-full py-4 px-6 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                            <ServerStackIcon size={16} /> System Backup
                        </button>
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-4 px-6 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCwIcon size={16} /> System Restore
                        </button>

                        <div className="mt-auto pt-4 border-t border-slate-100">
                            <button 
                                onClick={onResetSystem}
                                className="w-full py-4 px-6 rounded-2xl bg-red-50 text-red-600 font-black uppercase tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <TrashIcon size={16} /> Full System Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* System Version Traceability Logs */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        <DocumentTextIcon size={18} className="text-indigo-600" /> System Version Traceability Logs
                    </h3>
                    <div className="space-y-6">
                        {SYSTEM_VERSION_HISTORY.map((vh, idx) => (
                            <div key={idx} className="border-l-4 border-indigo-500 pl-4 py-1">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-800 text-sm">{vh.version}</span>
                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded-lg tracking-widest">{vh.code}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">{vh.date}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-600 mb-2">{vh.description}</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    {vh.changes.map((change, cIdx) => (
                                        <li key={cIdx} className="text-xs text-slate-500 font-medium">{change}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden mb-6">
                    <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-wrap gap-2">
                            {modules.map(mod => (
                                <button
                                    key={mod}
                                    onClick={() => setSelectedModule(mod)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedModule === mod ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                                >
                                    {mod === 'harvesting' ? 'HARVEST LOGS' : mod === 'marketplace' ? 'HARVEST LOGS' : mod}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <input 
                                type="text"
                                placeholder="Search logs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button 
                                onClick={runAiAnalysis}
                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-100 transition-all whitespace-nowrap"
                            >
                                AI Analysis
                            </button>
                        </div>
                    </div>
                    {showAiAnalysis && (
                        <div className="p-6 bg-indigo-50 border-b border-indigo-100">
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-800 mb-2">AI Assistant Analysis</h4>
                            {aiAnalysisResult ? (
                                <div className="text-sm text-indigo-900 font-medium whitespace-pre-wrap">{aiAnalysisResult}</div>
                            ) : (
                                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs"><CloudIcon className="animate-spin" size={16}/> Analyzing records...</div>
                            )}
                        </div>
                    )}
                    <div className="divide-y divide-slate-100">
                        {filteredLogs.map(log => (
                            <div key={log.id} className="p-6 flex items-start gap-6 hover:bg-slate-50 transition-colors group">
                                <div className={`p-3 rounded-2xl flex-shrink-0 ${
                                    log.status === 'success' ? 'bg-green-50 text-green-600' :
                                    log.status === 'alert' ? 'bg-amber-50 text-amber-600' :
                                    'bg-red-50 text-red-600'
                                }`}>
                                    {log.status === 'success' ? <CheckIcon size={24}/> : <AlertTriangleIcon size={24}/>}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-black text-slate-800 uppercase tracking-tight truncate pr-4">{log.action}</h4>
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <ClockIcon size={12}/>
                                            <span className="text-[10px] font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium">{log.report || 'No detailed report available for this transaction.'}</p>
                                    <div className="mt-3 flex gap-2">
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-lg tracking-widest">{log.module}</span>
                                        {log.userName && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-lg tracking-widest">USER: {log.userName}</span>}
                                        {log.organizationId && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded-lg tracking-widest">TENANT: {log.organizationId.slice(-4)}</span>}
                                    </div>
                                </div>
                                {isSystemAdmin && onDeleteLog && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteLog(log.id); }}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Log"
                                    >
                                        <TrashIcon size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {filteredLogs.length === 0 && (
                            <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest">
                                <DocumentTextIcon size={48} className="mx-auto opacity-20 mb-4" />
                                No system records found.
                            </div>
                        )}
                    </div>
                </div>

                {isSystemAdmin && (
                    <div className="bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-700 overflow-hidden font-mono text-xs text-green-400 mb-6">
                        <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">LOW-LEVEL SYSTEM LOGS</span>
                        </div>
                        <div className="p-4 flex flex-col gap-2 max-h-96 overflow-y-auto">
                            {consoleLogs.map(cl => (
                                <div key={cl.id} className="flex items-start gap-4 pb-2 border-b border-slate-800/50">
                                    <span className="opacity-50 flex-shrink-0">{new Date(cl.timestamp).toLocaleTimeString()}</span>
                                    <span className={`font-black uppercase tracking-widest flex-shrink-0 ${
                                        cl.level === 'Error' ? 'text-red-500' :
                                        cl.level === 'Warning' ? 'text-amber-500' :
                                        cl.level === 'Debug' ? 'text-blue-400' : 'text-slate-400'
                                    }`}>[{cl.level}]</span>
                                    <span className="break-all">{cl.message}</span>
                                </div>
                            ))}
                            {consoleLogs.length === 0 && (
                                <div className="text-slate-600 opacity-50 py-10 text-center">LISTENING FOR SYSTEM EVENTS...</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
};

export default LogsView;
