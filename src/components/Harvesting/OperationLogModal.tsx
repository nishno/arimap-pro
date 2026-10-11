import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2, Check, XCircle, Trash2, Search, Download, FileSpreadsheet, GitFork } from 'lucide-react';
import { HarvestEntry, Employee } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface OperationLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    entries: HarvestEntry[];
    employees: Employee[];
    onUpdateEntry: (entryId: string, updates: Partial<HarvestEntry>) => void;
    onDeleteEntry: (entryId: string) => void;
    varieties?: string[];
    onSetHarvestEntries?: (entries: HarvestEntry[]) => void;
    allHarvestEntries?: HarvestEntry[];
}

export const OperationLogModal: React.FC<OperationLogModalProps> = ({ 
    isOpen, 
    onClose, 
    entries, 
    employees,
    onUpdateEntry,
    onDeleteEntry,
    varieties = [],
    onSetHarvestEntries,
    allHarvestEntries
}) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ netWeightKg: number; boxCount: number; variety: string }>({ netWeightKg: 0, boxCount: 1, variety: '' });

    // Splitting states
    const [splittingId, setSplittingId] = useState<string | null>(null);
    const [splitData, setSplitData] = useState({
        variety1: '',
        weight1: 0,
        boxes1: 0,
        variety2: '',
        weight2: 0,
        boxes2: 0
    });

    if (!isOpen) return null;

    const filteredEntries = entries
        .sort((a,b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
        .filter(entry => {
            const entryAny = entry as any;
            const empName = employees.find(e => e.id === entry.employeeId)?.name?.toLowerCase() || '';
            const recordedBy = (entryAny.scannedByUserName || entryAny.createdBy || entryAny.recordedBy || entryAny.scannedBy || '').toLowerCase();
            const search = searchTerm.toLowerCase();
            return empName.includes(search) || entry.variety?.toLowerCase().includes(search) || recordedBy.includes(search);
        });

    const handleEditStart = (entry: HarvestEntry) => {
        setEditingId(entry.id);
        setEditData({ 
            netWeightKg: entry.netWeightKg || 0, 
            boxCount: entry.boxCount || 1,
            variety: entry.variety || ''
        });
    };

    const handleEditSave = (entryId: string) => {
        onUpdateEntry(entryId, { 
            netWeightKg: editData.netWeightKg, 
            boxCount: editData.boxCount,
            variety: editData.variety 
        });
        setEditingId(null);
    };

    const handleSplitStart = (entry: HarvestEntry) => {
        setSplittingId(entry.id);
        const w1 = parseFloat((entry.netWeightKg / 2).toFixed(2));
        const w2 = parseFloat((entry.netWeightKg - w1).toFixed(2));
        const b1 = Math.floor(entry.boxCount / 2) || 1;
        const b2 = Math.max(1, entry.boxCount - b1);
        
        // Ensure we have fallback varieties
        const defaultV1 = entry.variety || (varieties[0] || 'Legacy');
        const defaultV2 = varieties.find(v => v !== defaultV1) || (varieties[0] || 'star');

        setSplitData({
            variety1: defaultV1,
            weight1: w1,
            boxes1: b1,
            variety2: defaultV2,
            weight2: w2,
            boxes2: b2
        });
    };

    const handleSplitConfirm = (originalEntry: HarvestEntry) => {
        if (!allHarvestEntries || !onSetHarvestEntries) {
            alert("Set harvest entries function not configured.");
            return;
        }

        if (splitData.weight1 <= 0 || splitData.weight2 <= 0) {
            alert("Both weights must be greater than zero.");
            return;
        }

        // Create two new entries
        const entry1: HarvestEntry = {
            ...originalEntry,
            id: `${originalEntry.id}-split-1-${Date.now()}`,
            netWeightKg: splitData.weight1,
            boxCount: splitData.boxes1,
            variety: splitData.variety1,
            grossWeightKg: originalEntry.grossWeightKg ? parseFloat((originalEntry.grossWeightKg * (splitData.weight1 / originalEntry.netWeightKg)).toFixed(2)) : parseFloat((splitData.weight1 + (splitData.boxes1 * 1.5)).toFixed(2)),
            tareWeightKg: originalEntry.tareWeightKg ? parseFloat((originalEntry.tareWeightKg * (splitData.weight1 / originalEntry.netWeightKg)).toFixed(2)) : parseFloat((splitData.boxes1 * 1.5).toFixed(2)),
        };

        const entry2: HarvestEntry = {
            ...originalEntry,
            id: `${originalEntry.id}-split-2-${Date.now()}`,
            netWeightKg: splitData.weight2,
            boxCount: splitData.boxes2,
            variety: splitData.variety2,
            grossWeightKg: originalEntry.grossWeightKg ? parseFloat((originalEntry.grossWeightKg * (splitData.weight2 / originalEntry.netWeightKg)).toFixed(2)) : parseFloat((splitData.weight2 + (splitData.boxes2 * 1.5)).toFixed(2)),
            tareWeightKg: originalEntry.tareWeightKg ? parseFloat((originalEntry.tareWeightKg * (splitData.weight2 / originalEntry.netWeightKg)).toFixed(2)) : parseFloat((splitData.boxes2 * 1.5).toFixed(2)),
        };

        // Remove the original entry and insert the two new ones
        const updatedList = allHarvestEntries.reduce((acc, curr) => {
            if (curr.id === originalEntry.id) {
                acc.push(entry1, entry2);
            } else {
                acc.push(curr);
            }
            return acc;
        }, [] as HarvestEntry[]);

        onSetHarvestEntries(updatedList);
        setSplittingId(null);
        
        // We will also invoke onUpdateEntry with a dummy value to trigger the parent's recalculation hook!
        onUpdateEntry(entry1.id, {});
    };

    const handleExportToExcel = () => {
        // Headers
        const headers = ["Date", "Time", "Worker ID", "Worker Name", "Recorded By (User)", "Variety", "Boxes", "Net Weight (KG)"];
        
        // Rows
        const rows = filteredEntries.map(entry => {
            const picker = employees.find(e => e.id === entry.employeeId);
            const entryAny = entry as any;
            let recordedByRaw = entryAny.scannedByUserName || entryAny.createdBy || entryAny.recordedBy || entryAny.scannedBy;
            let recordedBy = 'Giorgi Nishnianidze';
            if (typeof recordedByRaw === 'string') {
                recordedBy = recordedByRaw;
            } else if (recordedByRaw && typeof recordedByRaw === 'object') {
                recordedBy = recordedByRaw.name || recordedByRaw.displayName || recordedByRaw.email || 'Giorgi Nishnianidze';
            }
            const dateObj = new Date(entry.scannedAt);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return [
                dateStr,
                timeStr,
                entry.employeeId || '',
                picker?.name || 'Unknown',
                recordedBy,
                entry.variety || 'N/A',
                entry.boxCount || 1,
                (entry.netWeightKg || 0).toFixed(2)
            ];
        });

        // Combine into CSV string with UTF-8 BOM so Excel decodes Georgian/Unicode characters accurately
        const csvContent = "\uFEFF" + [headers, ...rows]
            .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        // Set up the blob download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `operation_log_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Operation Log Manager</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{filteredEntries.length} Total Entries</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportToExcel}
                            disabled={filteredEntries.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Export current selection to CSV (compatible with Excel)"
                        >
                            <FileSpreadsheet size={16} />
                            <span>Export to Excel</span>
                        </button>
                        <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0">
                            <X size={20} className="text-slate-600" />
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by worker name or variety..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-indigo-500 text-sm font-bold text-slate-700"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    <div className="w-full min-w-[700px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200">
                                    <th className="p-3 w-36">Date & Time</th>
                                    <th className="p-3 min-w-[140px]">Worker (Picker)</th>
                                    <th className="p-3 min-w-[140px]">Recorded By (User)</th>
                                    <th className="p-3 w-28">Variety</th>
                                    <th className="p-3 text-right w-20">Boxes</th>
                                    <th className="p-3 text-right w-28">Net (KG)</th>
                                    <th className="p-3 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEntries.map(entry => {
                                    const picker = employees.find(e => e.id === entry.employeeId);
                                    const entryAny = entry as any;
                                    let recordedByRaw = entryAny.scannedByUserName || entryAny.createdBy || entryAny.recordedBy || entryAny.scannedBy;
                                    let recordedBy = 'Giorgi Nishnianidze';
                                    if (typeof recordedByRaw === 'string') {
                                        recordedBy = recordedByRaw;
                                    } else if (recordedByRaw && typeof recordedByRaw === 'object') {
                                        recordedBy = recordedByRaw.name || recordedByRaw.displayName || recordedByRaw.email || 'Giorgi Nishnianidze';
                                    }
                                    const isEditing = editingId === entry.id;
                                    const isSplitting = splittingId === entry.id;

                                    const dateObj = new Date(entry.scannedAt);
                                    const dateFormatted = !isNaN(dateObj.getTime())
                                        ? `${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        : entry.scannedAt;

                                    return (
                                        <React.Fragment key={entry.id}>
                                            <tr className="bg-white hover:bg-slate-50 transition-colors group">
                                                <td className="p-3 text-xs font-bold text-slate-500 whitespace-nowrap">
                                                    {dateFormatted}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 text-[10px] uppercase flex-shrink-0">
                                                            {(picker?.name && typeof picker.name === 'string') ? picker.name.charAt(0) : '?'}
                                                        </div>
                                                        <span className="font-bold text-slate-800 text-xs truncate">{picker?.name || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md truncate">
                                                            👤 {recordedBy}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-xs font-bold text-slate-600 truncate">
                                                    {isEditing ? (
                                                        <select 
                                                            value={editData.variety}
                                                            onChange={(e) => setEditData({...editData, variety: e.target.value})}
                                                            className="w-full p-1 bg-white border border-indigo-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                                        >
                                                            <option value="">Select...</option>
                                                            {(varieties.length > 0 ? varieties : ['Legacy', 'star', 'Chandler', 'Lara', 'Howard']).map(v => (
                                                                <option key={v} value={v}>{v}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-700 font-extrabold text-[10px]">
                                                            🍇 {entry.variety || 'N/A'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {isEditing ? (
                                                        <input 
                                                            type="number" 
                                                            value={editData.boxCount}
                                                            onChange={(e) => setEditData({...editData, boxCount: parseFloat(e.target.value) || 0})}
                                                            className="w-16 text-right px-2 py-1 border border-indigo-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-800">{entry.boxCount || 1}</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {isEditing ? (
                                                        <input 
                                                            type="number" 
                                                            value={editData.netWeightKg}
                                                            onChange={(e) => setEditData({...editData, netWeightKg: parseFloat(e.target.value) || 0})}
                                                            className="w-20 text-right px-2 py-1 border border-indigo-300 rounded font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    ) : (
                                                        <span className="text-xs font-black text-emerald-600">{(entry.netWeightKg || 0).toFixed(2)}</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => handleEditSave(entry.id)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer" title="Save changes">
                                                                <Check size={14} />
                                                            </button>
                                                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer" title="Cancel">
                                                                <XCircle size={14} />
                                                            </button>
                                                        </div>
                                                    ) : deletingId === entry.id ? (
                                                        <div className="flex items-center justify-center gap-1 w-full animate-in fade-in duration-200">
                                                            <span className="text-[9px] font-black text-red-500 uppercase tracking-wider mr-1">Confirm?</span>
                                                            <button 
                                                                onClick={() => {
                                                                    onDeleteEntry(entry.id);
                                                                    setDeletingId(null);
                                                                }} 
                                                                className="px-1.5 py-0.5 bg-red-600 text-white hover:bg-red-700 text-[10px] font-bold rounded cursor-pointer"
                                                            >
                                                                Yes
                                                            </button>
                                                            <button 
                                                                onClick={() => setDeletingId(null)} 
                                                                className="px-1.5 py-0.5 bg-slate-200 text-slate-700 hover:bg-slate-300 text-[10px] font-bold rounded cursor-pointer"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleEditStart(entry)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer" title="Edit Variety & weight">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            {onSetHarvestEntries && allHarvestEntries && (
                                                                <button onClick={() => handleSplitStart(entry)} className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer" title="Split into 2 entries">
                                                                    <GitFork size={14} />
                                                                </button>
                                                            )}
                                                            <button 
                                                                onClick={() => setDeletingId(entry.id)}
                                                                className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {isSplitting && (
                                                <tr className="bg-indigo-50/30">
                                                    <td colSpan={6} className="p-4 border-t border-b border-indigo-100">
                                                        <div className="space-y-4 text-left p-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                                                    🥞 Split Harvest Entry (Total: {entry.netWeightKg.toFixed(2)} KG / {entry.boxCount} Boxes)
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase">Divide into two varieties or weights</span>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                                                {/* Part 1 */}
                                                                <div className="space-y-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                                                    <h4 className="text-xs font-black text-slate-700 uppercase">Part 1</h4>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <div>
                                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Variety</label>
                                                                            <select
                                                                                value={splitData.variety1}
                                                                                onChange={e => setSplitData({ ...splitData, variety1: e.target.value })}
                                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                            >
                                                                                {(varieties.length > 0 ? varieties : ['Legacy', 'star', 'Chandler', 'Lara', 'Howard']).map(v => (
                                                                                    <option key={v} value={v}>{v}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Weight (KG)</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={splitData.weight1}
                                                                                onChange={e => {
                                                                                    const val = parseFloat(e.target.value) || 0;
                                                                                    const remaining = parseFloat((entry.netWeightKg - val).toFixed(2));
                                                                                    setSplitData({
                                                                                        ...splitData,
                                                                                        weight1: val,
                                                                                        weight2: Math.max(0, remaining)
                                                                                    });
                                                                                }}
                                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Boxes</label>
                                                                            <input
                                                                                type="number"
                                                                                value={splitData.boxes1}
                                                                                onChange={e => {
                                                                                    const val = parseInt(e.target.value) || 0;
                                                                                    const remaining = Math.max(0, entry.boxCount - val);
                                                                                    setSplitData({
                                                                                        ...splitData,
                                                                                        boxes1: val,
                                                                                        boxes2: remaining
                                                                                    });
                                                                                }}
                                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Part 2 */}
                                                                <div className="space-y-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                                                    <h4 className="text-xs font-black text-slate-700 uppercase">Part 2</h4>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <div>
                                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Variety</label>
                                                                            <select
                                                                                value={splitData.variety2}
                                                                                onChange={e => setSplitData({ ...splitData, variety2: e.target.value })}
                                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                            >
                                                                                {(varieties.length > 0 ? varieties : ['Legacy', 'star', 'Chandler', 'Lara', 'Howard']).map(v => (
                                                                                    <option key={v} value={v}>{v}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Weight (KG)</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={splitData.weight2}
                                                                                onChange={e => {
                                                                                    const val = parseFloat(e.target.value) || 0;
                                                                                    const remaining = parseFloat((entry.netWeightKg - val).toFixed(2));
                                                                                    setSplitData({
                                                                                        ...splitData,
                                                                                        weight2: val,
                                                                                        weight1: Math.max(0, remaining)
                                                                                    });
                                                                                }}
                                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Boxes</label>
                                                                            <input
                                                                                type="number"
                                                                                value={splitData.boxes2}
                                                                                onChange={e => {
                                                                                    const val = parseInt(e.target.value) || 0;
                                                                                    const remaining = Math.max(0, entry.boxCount - val);
                                                                                    setSplitData({
                                                                                        ...splitData,
                                                                                        boxes2: val,
                                                                                        boxes1: Math.max(0, remaining)
                                                                                    });
                                                                                }}
                                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Split Action Buttons */}
                                                            <div className="flex justify-end gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSplittingId(null)}
                                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSplitConfirm(entry)}
                                                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                                                                >
                                                                    <span>Confirm Split</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filteredEntries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                                            No operation logs found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
