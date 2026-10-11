import React, { useState } from 'react';
import { PlusCircleIcon, WrenchScrewdriverIcon, TractorIcon, TrashIcon, XIcon as XMarkIcon } from '../Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { Machinery, Permission, Employee } from '../../types';

interface MachineryManagerProps {
    machinery: Machinery[];
    onSetMachinery: (machinery: Machinery[]) => void;
    currentUserPermissions: Set<Permission>;
    employees?: Employee[];
}

const MachineryManager: React.FC<MachineryManagerProps> = ({ machinery, onSetMachinery, currentUserPermissions, employees = [] }) => {
    const { t } = useLanguage();
    const canEdit = currentUserPermissions.has('edit_machinery');
    const [isAddMode, setIsAddMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const [name, setName] = useState('');
    const [ownership, setOwnership] = useState<'owned' | 'rented'>('owned');
    const [foremanId, setForemanId] = useState('');
    const [vehicleCategory, setVehicleCategory] = useState<'passenger' | 'cargo' | 'tractor' | 'inventar'>('passenger');
    
    // Category specific state
    const [passengerCapacity, setPassengerCapacity] = useState<number | ''>('');
    const [baseCostRate, setBaseCostRate] = useState<number | ''>('');
    const [cargoPurpose, setCargoPurpose] = useState('');
    const [payloadCapacity, setPayloadCapacity] = useState<number | ''>('');
    const [enginePower, setEnginePower] = useState('');
    const [toolCategory, setToolCategory] = useState('');

    const resetForm = () => {
        setName('');
        setOwnership('owned');
        setForemanId('');
        setVehicleCategory('passenger');
        setPassengerCapacity('');
        setBaseCostRate('');
        setCargoPurpose('');
        setPayloadCapacity('');
        setEnginePower('');
        setToolCategory('');
    };

    const handleAdd = () => {
        if (!name.trim()) return;
        
        const newMachinery: Machinery = {
            id: `mach-${Date.now()}`,
            name,
            type: vehicleCategory,
            status: 'operational',
            isOwned: ownership === 'owned',
            ownership,
            foremanId: foremanId || undefined,
            vehicleCategory,
            passengerCapacity: passengerCapacity ? Number(passengerCapacity) : undefined,
            baseCostRate: baseCostRate ? Number(baseCostRate) : undefined,
            cargoPurpose: cargoPurpose || undefined,
            payloadCapacity: payloadCapacity ? Number(payloadCapacity) : undefined,
            enginePower: enginePower || undefined,
            toolCategory: toolCategory || undefined,
        };

        if (editingId) {
            onSetMachinery(machinery.map(m => m.id === editingId ? { ...newMachinery, id: editingId } : m));
            setEditingId(null);
        } else {
            onSetMachinery([...machinery, newMachinery]);
        }
        resetForm();
        setIsAddMode(false);
    };

    const handleDelete = (id: string) => {
        onSetMachinery(machinery.filter(m => m.id !== id));
    };

    const toggleStatus = (m: Machinery) => {
        const statuses: Machinery['status'][] = ['operational', 'maintenance', 'out-of-service'];
        const nextStatus = statuses[(statuses.indexOf(m.status) + 1) % statuses.length];
        onSetMachinery(machinery.map(item => item.id === m.id ? { ...item, status: nextStatus } : item));
    };

    const getCategoryIcon = (category?: string) => {
        return <TractorIcon className="h-5 w-5" />;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                        <WrenchScrewdriverIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black italic text-slate-800 tracking-tight uppercase">Fleet & Machinery</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Central Vehicle Master Form</p>
                    </div>
                </div>
                {canEdit && (
                    <button 
                        onClick={() => {
                            if (!isAddMode) resetForm();
                            setIsAddMode(!isAddMode);
                        }}
                        className="h-12 px-4 bg-[#3b36db] text-white rounded-xl flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-[#2d28b8] transition-all"
                    >
                        {isAddMode ? <XMarkIcon className="h-5 w-5" /> : <PlusCircleIcon className="h-6 w-6" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{isAddMode ? 'Cancel' : 'Add Asset'}</span>
                    </button>
                )}
            </div>

            {isAddMode && (
                <div className="p-5 bg-white rounded-2xl border border-blue-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm mb-2 border-b pb-2">New Asset Details</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Asset Name / Plate</label>
                            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ford Transit XA-123" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                            <select value={vehicleCategory} onChange={e => setVehicleCategory(e.target.value as any)} className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white">
                                <option value="passenger">Passenger Transport (Bus/Van)</option>
                                <option value="cargo">Cargo Transport (Truck/Trailer)</option>
                                <option value="tractor">Tractor & Heavy Machinery</option>
                                <option value="inventar">Inventar / Light Field Equipment</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Ownership</label>
                            <select value={ownership} onChange={e => setOwnership(e.target.value as any)} className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white">
                                <option value="owned">Company Owned</option>
                                <option value="rented">Rented / Third-Party</option>
                            </select>
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Linked Foreman (Optional)</label>
                            <select value={foremanId} onChange={e => setForemanId(e.target.value)} className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white">
                                <option value="">None</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {vehicleCategory === 'passenger' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Max Seating Capacity</label>
                                    <input type="number" value={passengerCapacity} onChange={e => setPassengerCapacity(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 18" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Base Cost Rate (GEL)</label>
                                    <input type="number" value={baseCostRate} onChange={e => setBaseCostRate(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 50" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                                </div>
                            </div>
                        )}

                        {vehicleCategory === 'cargo' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Cargo Purpose</label>
                                    <input type="text" value={cargoPurpose} onChange={e => setCargoPurpose(e.target.value)} placeholder="e.g. Blueberry Crates, Fertilizer" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Payload Capacity (KG/L)</label>
                                    <input type="number" value={payloadCapacity} onChange={e => setPayloadCapacity(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 1500" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                                </div>
                            </div>
                        )}

                        {vehicleCategory === 'tractor' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Engine Power</label>
                                    <input type="text" value={enginePower} onChange={e => setEnginePower(e.target.value)} placeholder="e.g. 75 HP" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Hourly Rate (GEL)</label>
                                    <input type="number" value={baseCostRate} onChange={e => setBaseCostRate(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 40" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                                </div>
                            </div>
                        )}

                        {vehicleCategory === 'inventar' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Tool Category</label>
                                    <input type="text" value={toolCategory} onChange={e => setToolCategory(e.target.value)} placeholder="e.g. Sprayers, Harvesters" className="w-full p-2 border rounded-xl text-sm outline-none focus:border-blue-500"/>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <button onClick={handleAdd} className="bg-[#10b981] hover:bg-[#059669] transition-colors text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">
                            Save Asset
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {machinery.map(m => {
                    const linkedForeman = m.foremanId ? employees.find(e => e.id === m.foremanId) : null;
                    return (
                        <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center hover:border-blue-200 transition-all shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                                    m.status === 'operational' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
                                }`}>
                                    <TractorIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-black italic text-slate-800 uppercase text-sm">{m.name}</p>
                                    <div className="flex gap-2 items-center mt-1">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${m.ownership === 'owned' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {m.ownership || (m.isOwned ? 'owned' : 'rented')}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">• {m.vehicleCategory || m.type} •</span>
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${m.status === 'operational' ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {m.status}
                                        </span>
                                    </div>
                                    {linkedForeman && <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Foreman: {linkedForeman.name}</p>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                                <div className="text-[10px] text-slate-500 text-right">
                                    {m.passengerCapacity ? <div>Capacity: <b>{m.passengerCapacity}</b></div> : null}
                                    {m.payloadCapacity ? <div>Payload: <b>{m.payloadCapacity}KG</b></div> : null}
                                </div>
                                <div className="flex gap-2">
                                    {canEdit && <button onClick={() => toggleStatus(m)} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">Status</button>}
                                    {canEdit && <button onClick={() => { setName(m.name); setOwnership(m.ownership || (m.isOwned ? "owned" : "rented")); setForemanId(m.foremanId || ""); setVehicleCategory(m.vehicleCategory || "passenger" as any); setPassengerCapacity(m.passengerCapacity || ""); setBaseCostRate(m.baseCostRate || ""); setCargoPurpose(m.cargoPurpose || ""); setPayloadCapacity(m.payloadCapacity || ""); setEnginePower(m.enginePower || ""); setToolCategory(m.toolCategory || ""); setEditingId(m.id); setIsAddMode(true); }} className="text-blue-400 hover:text-blue-600 p-1" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.158 3.712 3.712 1.158-1.157a2.625 2.625 0 000-3.713zM19.569 6.685l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.57 6.685z" /></svg></button>}
                                    {canEdit && <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600 p-1"><TrashIcon className="h-4 w-4"/></button>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MachineryManager;
