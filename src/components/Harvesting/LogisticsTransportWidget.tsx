import React, { useState } from 'react';
import type { HarvestEvent, Employee, Machinery, InventoryItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { toast } from 'sonner';
import { PlusCircleIcon } from '../Icons';

interface LogisticsTransportWidgetProps {
    event: HarvestEvent;
    employees: Employee[];
    machinery: Machinery[];
    inventoryItems?: InventoryItem[];
    harvestEvents: HarvestEvent[];
    onSetHarvestEvents: (events: HarvestEvent[]) => void;
    onSetMachinery?: (machinery: Machinery[]) => void;
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    onOpenFleetManager?: () => void;
    isCollapsedSummary?: boolean;
    onOpenLogisticsModal?: () => void;
}

const LogisticsTransportWidget: React.FC<LogisticsTransportWidgetProps> = ({ event, employees, machinery, inventoryItems, harvestEvents, onSetHarvestEvents, onSetMachinery, onSetInventoryItems, onOpenFleetManager, isCollapsedSummary = false, onOpenLogisticsModal }) => {
    const { t, formatCurrency, language } = useLanguage();
    const isKa = language === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    const foremen = employees.filter(e => 
        e.role === "Foreman" || 
        e.roleId === "Foreman" || 
        (e.role && e.role.toLowerCase().includes("foreman")) || 
        (e.roleId && e.roleId.toLowerCase().includes("foreman"))
    );

    const [selectedForemanId, setSelectedForemanId] = useState<string>('');
    
    // Step 1: Vehicles
    const [vehicleCount, setVehicleCount] = useState<number>(1);
    const [selectVehiclesFromList, setSelectVehiclesFromList] = useState<boolean>(true);
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());

    // Vehicle Quick Registration State
    const [isRegisterVehicleOpen, setIsRegisterVehicleOpen] = useState<boolean>(false);
    const [newVehicleName, setNewVehicleName] = useState<string>('');
    const [newVehicleCapacity, setNewVehicleCapacity] = useState<number>(18);
    const [newVehicleRate, setNewVehicleRate] = useState<number>(50);
    const [newVehicleOwnership, setNewVehicleOwnership] = useState<'rented' | 'owned'>('rented');

    const handleRegisterVehicle = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVehicleName.trim()) {
            toast.error(isKa ? 'გთხოვთ შეიყვანოთ მანქანის დასახელება' : 'Please enter vehicle name');
            return;
        }

        const newId = `veh-${Date.now()}`;
        const newVehicle: Machinery = {
            id: newId,
            name: newVehicleName.trim(),
            type: 'Transport',
            status: 'operational',
            isOwned: newVehicleOwnership === 'owned',
            ownership: newVehicleOwnership,
            vehicleCategory: 'passenger',
            passengerCapacity: newVehicleCapacity,
            baseCostRate: newVehicleRate,
            hourlyRate: newVehicleRate
        };

        if (onSetMachinery) {
            onSetMachinery([...machinery, newVehicle]);
        }

        // Auto-select this newly registered vehicle
        const nextSet = new Set(selectedVehicleIds);
        nextSet.add(newId);
        setSelectedVehicleIds(nextSet);
        setVehicleCount(Math.max(vehicleCount, nextSet.size));

        toast.success(isKa ? 'ავტომობილი წარმატებით დარეგისტრირდა!' : 'Vehicle registered successfully!');
        setIsRegisterVehicleOpen(false);
        setNewVehicleName('');
        setNewVehicleCapacity(18);
        setNewVehicleRate(50);
    };
    
    // Step 2: Pickers
    const [actualPeopleBrought, setActualPeopleBrought] = useState<number>(0);
    const [selectPickersFromList, setSelectPickersFromList] = useState<boolean>(true);
    const [selectedPickerIds, setSelectedPickerIds] = useState<Set<string>>(new Set());

    // Step 3: Rate Model
    const [rateModel, setRateModel] = useState<'PER_PERSON' | 'PER_VEHICLE' | 'FLAT_DAILY' | 'CUSTOM'>('PER_VEHICLE');
    const [unitCost, setUnitCost] = useState<number>(50.00);

    // Edit existing record state
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

    const activeForeman = selectedForemanId === 'standalone_vehicle'
        ? { id: 'standalone_vehicle', name: 'Rented / Standalone Transport', role: 'Driver', idNumber: 'RENTAL', assignedVehicles: [], assignedPickers: [] }
        : foremen.find(f => f.id === selectedForemanId);
    
    // Calculate totals
    const calculatedTotalCost = rateModel === 'PER_PERSON' 
        ? actualPeopleBrought * unitCost 
        : rateModel === 'PER_VEHICLE' 
            ? vehicleCount * unitCost 
            : unitCost;

    const handleSelectForeman = (id: string) => {
        setSelectedForemanId(id);
        if (id === 'standalone_vehicle') {
            setRateModel('PER_VEHICLE');
            setUnitCost(50.00);
            setVehicleCount(1);
            setActualPeopleBrought(0);
            return;
        }
        const foreman = foremen.find(f => f.id === id);
        if (foreman) {
            // Auto-populate with their assigned crew and vehicles
            const assignedV = new Set(foreman.assignedVehicles || []);
            const assignedP = new Set(foreman.assignedPickers || []);
            setSelectedVehicleIds(assignedV);
            setSelectedPickerIds(assignedP);
            setVehicleCount(Math.max(1, assignedV.size));
            setActualPeopleBrought(assignedP.size);
        }
    };

    const handleEditRecord = (rec: any) => {
        setEditingRecordId(rec.id);
        setSelectedForemanId(rec.foremanId || 'standalone_vehicle');
        setVehicleCount(rec.vehicleCount || 1);
        setSelectVehiclesFromList(rec.selectVehiclesFromList ?? true);
        setSelectedVehicleIds(new Set(rec.selectedVehicleIds || []));
        setActualPeopleBrought(rec.actualPeopleBrought || 0);
        setSelectPickersFromList(rec.selectPickersFromList ?? true);
        setSelectedPickerIds(new Set(rec.selectedPickerIds || []));
        setRateModel(rec.rateModel || 'PER_VEHICLE');
        setUnitCost(rec.unitCost || 0);
    };

    const handleSaveLogistics = () => {
        if (!activeForeman) return;
        
        const logisticsRecord = {
            id: editingRecordId || `log-${Date.now()}`,
            foremanId: activeForeman.id,
            foremanName: activeForeman.name,
            vehicleCount,
            selectVehiclesFromList,
            selectedVehicleIds: Array.from(selectedVehicleIds),
            actualPeopleBrought,
            selectPickersFromList,
            selectedPickerIds: Array.from(selectedPickerIds),
            rateModel,
            unitCost,
            calculatedTotalCost,
            timestamp: new Date().toISOString()
        };

        let updatedRecords = event.logisticsRecords || [];
        if (editingRecordId) {
            updatedRecords = updatedRecords.map(r => r.id === editingRecordId ? logisticsRecord : r);
        } else {
            updatedRecords = [...updatedRecords, logisticsRecord];
        }

        const updatedEvent = {
            ...event,
            logisticsRecords: updatedRecords
        };

        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));
        setSelectedForemanId('');
        setEditingRecordId(null);
        toast.success(editingRecordId ? `Logistics updated for ${activeForeman.name}` : `Logistics saved for ${activeForeman.name}`);
    };

    const removeRecord = (recId: string) => {
        const updatedEvent = {
            ...event,
            logisticsRecords: (event.logisticsRecords || []).filter(r => r.id !== recId)
        };
        onSetHarvestEvents(harvestEvents.map(e => e.id === event.id ? updatedEvent : e));
    };

    const totalLogisticsCost = (event.logisticsRecords || []).reduce((sum: number, r: any) => sum + (r.calculatedTotalCost || 0), 0);

    // Collapsed summary mode for live monitoring window
    if (isCollapsedSummary) {
        return (
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-3 shadow-md">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🚜</span>
                        <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-indigo-200">
                            Foreman Logistics & Transport
                        </h3>
                    </div>
                    {onOpenLogisticsModal && (
                        <button 
                            onClick={onOpenLogisticsModal}
                            className="text-[9px] font-black text-emerald-300 hover:text-white bg-emerald-800/60 hover:bg-emerald-700/80 px-2.5 py-1 rounded-lg transition-colors uppercase border border-emerald-700/50 flex items-center gap-1 cursor-pointer"
                        >
                            Manage Details &rarr;
                        </button>
                    )}
                </div>
                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                    {formatCurrency(totalLogisticsCost)}
                </div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    {(event.logisticsRecords || []).length > 0 
                        ? `${(event.logisticsRecords || []).length} registered transport/foreman logs.` 
                        : 'No transport logs saved yet.'}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">Foreman Logistics & Transport</h3>
            
            {/* List Existing Records */}
            {(event.logisticsRecords || []).length > 0 && (
                <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                            {isKa ? 'რეგისტრირებული ლოგისტიკის ჩანაწერები' : 'Registered Transport & Foreman Logs'} ({ (event.logisticsRecords || []).length })
                        </h4>
                    </div>
                    {(event.logisticsRecords || []).map((rec: any) => (
                        <div key={rec.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-800 text-sm">{rec.foremanName}</span>
                                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                        {rec.rateModel}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                    🚗 {rec.vehicleCount} {isKa ? 'ტრანსპორტი' : 'Vehicles'} • 👥 {rec.actualPeopleBrought} {isKa ? 'მუშა' : 'Workers'} • Rate: ₾{(rec.unitCost || 0).toFixed(2)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                                <span className="font-black text-indigo-700 text-base">₾{(rec.calculatedTotalCost || 0).toFixed(2)}</span>
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        type="button"
                                        onClick={() => handleEditRecord(rec)} 
                                        className="px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                        title={isKa ? 'დეტალების ნახვა / რედაქტირება' : 'View details or edit this transport log'}
                                    >
                                        📝 {isKa ? 'დეტალები / ჩასწორება' : 'Details / Edit'}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm(isKa ? `ნამდვილად გსურთ ${rec.foremanName}-ის ლოგისტიკის ჩანაწერის წაშლა?` : `Are you sure you want to remove the transport log for ${rec.foremanName}?`)) {
                                                removeRecord(rec.id);
                                                if (editingRecordId === rec.id) {
                                                    setEditingRecordId(null);
                                                    setSelectedForemanId('');
                                                }
                                                toast.success(isKa ? 'ლოგისტიკის ჩანაწერი წაიშალა' : 'Transport record removed.');
                                            }
                                        }} 
                                        className="px-2.5 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                        title={isKa ? 'ჩანაწერის წაშლა' : 'Remove this transport log'}
                                    >
                                        🗑️ {isKa ? 'წაშლა' : 'Remove'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!selectedForemanId ? (
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Select Foreman to Log Arrival</label>
                    <select 
                        value={selectedForemanId} 
                        onChange={e => handleSelectForeman(e.target.value)}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-bold shadow-sm"
                    >
                        <option value="">-- Choose Foreman or Rented Transport --</option>
                        <option value="standalone_vehicle" className="font-bold text-indigo-700">🚜 RENTED / STANDALONE VEHICLE (No Foreman)</option>
                        {foremen.map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.idNumber})</option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="border border-indigo-100 rounded-xl overflow-hidden bg-indigo-50/10">
                    <div className="bg-indigo-600 text-white p-3 flex justify-between items-center">
                        <span className="font-black uppercase tracking-widest text-[10px]">Foreman Entry</span>
                        <span className="font-bold text-sm">{activeForeman?.name}</span>
                    </div>

                    <div className="p-4 space-y-6">
                        {/* 1. Vehicles */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-1 gap-2">
                                <h4 className="font-bold text-gray-700 text-xs">1. Vehicles / Transport Brought Today</h4>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button 
                                        type="button"
                                        onClick={() => setIsRegisterVehicleOpen(true)}
                                        className="text-[9px] font-black text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 transition-all uppercase flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                                        title="Register a new car or transport vehicle directly"
                                    >
                                        <PlusCircleIcon className="w-3 h-3 text-emerald-700" />
                                        {isKa ? '+ ახალი მანქანის რეგისტრაცია' : '+ Register New Car'}
                                    </button>
                                    {onOpenFleetManager && (
                                        <button 
                                            onClick={onOpenFleetManager}
                                            type="button"
                                            className="text-[9px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 transition-colors uppercase flex items-center gap-1"
                                            title="Modify capacity, rates, and ownership details in Fleet Master"
                                        >
                                            ✏️ Central Fleet Master &rarr;
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Number of Minibuses / Vehicles:</label>
                                <input type="number" value={vehicleCount} onChange={e => setVehicleCount(Number(e.target.value) || 0)} className="w-20 p-1 border rounded text-center text-xs font-bold" />
                            </div>
                            
                            <div className="flex gap-4 items-center">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Select Vehicles from List?</label>
                                <div className="flex gap-2">
                                    <label className="text-xs font-bold flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={selectVehiclesFromList} onChange={() => setSelectVehiclesFromList(true)} /> YES
                                    </label>
                                    <label className="text-xs font-bold flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={!selectVehiclesFromList} onChange={() => setSelectVehiclesFromList(false)} /> NO
                                    </label>
                                </div>
                            </div>
                            
                            {selectVehiclesFromList && (
                                <div className="ml-4 space-y-1 bg-white p-2 rounded border border-gray-100 max-h-36 overflow-y-auto">
                                    {machinery.filter(m => m.vehicleCategory === 'passenger' || m.type === 'Transport' || m.ownership === 'rented' || (m.ownership as any) === 'Rented' || (m.passengerCapacity && m.passengerCapacity > 0)).map(v => (
                                        <label key={v.id} className="flex items-center gap-2 text-[10px] font-bold text-gray-700 cursor-pointer hover:bg-slate-50 p-0.5 rounded">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedVehicleIds.has(v.id)}
                                                onChange={e => {
                                                    const next = new Set(selectedVehicleIds);
                                                    if (e.target.checked) next.add(v.id);
                                                    else next.delete(v.id);
                                                    setSelectedVehicleIds(next);
                                                }}
                                            />
                                            <span>{v.name}</span>
                                            <span className="text-[9px] font-normal text-slate-400">
                                                (Cap: {v.passengerCapacity || 18} | {v.ownership || 'Rented'})
                                            </span>
                                        </label>
                                    ))}
                                    {machinery.filter(m => m.vehicleCategory === 'passenger' || m.type === 'Transport' || m.ownership === 'rented' || (m.ownership as any) === 'Rented' || (m.passengerCapacity && m.passengerCapacity > 0)).length === 0 && (
                                        <div className="text-[10px] text-slate-400 italic p-1">
                                            {isKa ? 'ავტომობილები არ არის. დააჭირეთ "+ ახალი მანქანის რეგისტრაცია".' : 'No registered cars listed. Click "+ Register New Car" above.'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2. Pickers */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-gray-700 text-xs border-b border-gray-200 pb-1">2. Pickers / Workforce Brought Today</h4>
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Actual People Brought Today:</label>
                                <input type="number" value={actualPeopleBrought} onChange={e => setActualPeopleBrought(Number(e.target.value) || 0)} className="w-20 p-1 border rounded text-center text-xs font-bold" />
                            </div>

                            <div className="flex gap-4 items-center">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Select Pickers from List?</label>
                                <div className="flex gap-2">
                                    <label className="text-xs font-bold flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={selectPickersFromList} onChange={() => setSelectPickersFromList(true)} /> YES
                                    </label>
                                    <label className="text-xs font-bold flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={!selectPickersFromList} onChange={() => setSelectPickersFromList(false)} /> NO
                                    </label>
                                </div>
                            </div>
                            
                            {selectPickersFromList && (
                                <div className="ml-4 space-y-1 bg-white p-2 rounded border border-gray-100 max-h-40 overflow-y-auto">
                                    <div className="text-[10px] text-gray-400 mb-1 font-bold">Filtered to {activeForeman?.name}'s Crew</div>
                                    {employees.filter(e => activeForeman?.assignedPickers?.includes(e.id)).map(p => (
                                        <label key={p.id} className="flex items-center gap-2 text-[10px] font-bold text-gray-700 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedPickerIds.has(p.id)}
                                                onChange={e => {
                                                    const next = new Set(selectedPickerIds);
                                                    if (e.target.checked) next.add(p.id);
                                                    else next.delete(p.id);
                                                    setSelectedPickerIds(next);
                                                    setActualPeopleBrought(next.size);
                                                }}
                                            />
                                            {p.name}
                                        </label>
                                    ))}
                                    {employees.filter(e => activeForeman?.assignedPickers?.includes(e.id)).length === 0 && (
                                        <div className="text-[10px] text-gray-400 italic">No pickers assigned to this foreman.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 3. Logistics Financials */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-gray-700 text-xs border-b border-gray-200 pb-1">3. Logistics Financials & Rate Model</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Transport Rate Model</label>
                                    <select value={rateModel} onChange={e => setRateModel(e.target.value as any)} className="w-full p-2 mt-1 border rounded text-xs font-bold bg-white">
                                        <option value="PER_PERSON">By Person (PER PERSON)</option>
                                        <option value="PER_VEHICLE">By Car (PER VEHICLE)</option>
                                        <option value="FLAT_DAILY">Fixed Rate (FLAT DAILY)</option>
                                        <option value="CUSTOM">Custom Rate (CUSTOM)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Unit Cost (GEL)</label>
                                    <input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(Number(e.target.value) || 0)} className="w-full p-2 mt-1 border rounded text-xs font-bold" />
                                </div>
                            </div>
                            
                            <div className="bg-indigo-100 p-3 rounded-lg flex justify-between items-center border border-indigo-200 mt-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">Calculated Cost</span>
                                <span className="font-black text-lg text-indigo-700">₾{calculatedTotalCost.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <button onClick={() => setSelectedForemanId('')} className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold text-xs uppercase hover:bg-gray-300">Cancel</button>
                            <button onClick={handleSaveLogistics} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold text-xs uppercase hover:bg-indigo-700 shadow-md">Save Record</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Register Vehicle Modal */}
            {isRegisterVehicleOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
                        <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🚐</span>
                                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                                    {isKa ? 'ახალი ტრანსპორტის / მანქანის რეგისტრაცია' : 'Register New Transport / Car'}
                                </h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsRegisterVehicleOpen(false)}
                                className="text-white/80 hover:text-white font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleRegisterVehicle} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    {isKa ? 'მანქანის / მარშრუტკის დასახელება *' : 'Vehicle Name / Model *'}
                                </label>
                                <input 
                                    type="text"
                                    required
                                    value={newVehicleName}
                                    onChange={e => setNewVehicleName(e.target.value)}
                                    placeholder={isKa ? 'მაგ: Ford Transit (GE-777-AA)' : 'e.g. Mercedes Sprinter (AB-123-CD)'}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        {isKa ? 'ტევადობა (ადგილები)' : 'Capacity (Seats)'}
                                    </label>
                                    <input 
                                        type="number"
                                        min="1"
                                        value={newVehicleCapacity}
                                        onChange={e => setNewVehicleCapacity(Number(e.target.value) || 1)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        {isKa ? 'დღიური ტარიფი (₾)' : 'Daily Cost Rate (₾)'}
                                    </label>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        value={newVehicleRate}
                                        onChange={e => setNewVehicleRate(Number(e.target.value) || 0)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    {isKa ? 'კუთვნილება' : 'Ownership Status'}
                                </label>
                                <select 
                                    value={newVehicleOwnership}
                                    onChange={e => setNewVehicleOwnership(e.target.value as any)}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value="rented">{isKa ? 'დაქირავებული / კერძო (Rented)' : 'Rented / Private Transport'}</option>
                                    <option value="owned">{isKa ? 'საკუთარი ფლოტი (Owned)' : 'Company Owned Fleet'}</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsRegisterVehicleOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase transition-colors"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all active:scale-95 cursor-pointer"
                                >
                                    {isKa ? 'დამატება' : 'Add Vehicle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export { LogisticsTransportWidget };
