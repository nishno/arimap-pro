import React, { useState } from 'react';
import type { WorkAssignment, Machinery, AssignedVehicle, Employee } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { X, Plus, Trash2, Truck, DollarSign, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

interface WorkVehiclesModalProps {
    isOpen: boolean;
    onClose: () => void;
    work: WorkAssignment;
    machinery: Machinery[];
    onSetMachinery?: (machinery: Machinery[]) => void;
    onSaveWork: (updatedWork: WorkAssignment) => void;
    employees?: Employee[];
}

export const WorkVehiclesModal: React.FC<WorkVehiclesModalProps> = ({
    isOpen,
    onClose,
    work,
    machinery = [],
    onSetMachinery,
    onSaveWork,
    employees = []
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    const [mode, setMode] = useState<'fleet' | 'custom'>('fleet');
    
    // Existing machinery selection
    const [selectedMachineryId, setSelectedMachineryId] = useState<string>(machinery[0]?.id || '');
    
    // Custom / Quick registration
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<'passenger' | 'cargo' | 'tractor' | 'inventar'>('tractor');
    
    // Common vehicle assignment settings
    const [isOwned, setIsOwned] = useState<boolean>(true);
    const [usageHours, setUsageHours] = useState<number>(work.plannedTime || 8);
    const [hiredCost, setHiredCost] = useState<number>(0);
    const [driverId, setDriverId] = useState<string>('');

    if (!isOpen) return null;

    const assignedVehicles = work.assignedVehicles || [];

    // Calculate current totals
    const totalVehicleOpex = assignedVehicles.reduce((acc, v) => {
        if (!v.isOwned) {
            return acc + (v.usageHours || 0) * (v.hiredCost || 0);
        }
        return acc;
    }, 0);

    const totalHours = assignedVehicles.reduce((acc, v) => acc + (v.usageHours || 0), 0);

    const handleMachinerySelectChange = (mId: string) => {
        setSelectedMachineryId(mId);
        const mach = machinery.find(m => m.id === mId);
        if (mach) {
            setIsOwned(mach.isOwned ?? true);
            setHiredCost(mach.hourlyRate || mach.baseCostRate || 0);
        }
    };

    const handleAddVehicle = (e: React.FormEvent) => {
        e.preventDefault();

        let vehicleName = '';
        let machId: string | undefined = undefined;

        if (mode === 'fleet') {
            const mach = machinery.find(m => m.id === selectedMachineryId);
            if (!mach && machinery.length > 0) {
                toast.error(isKa ? "გთხოვთ აირჩიოთ ტექნიკა" : "Please select machinery");
                return;
            }
            vehicleName = mach?.name || (isKa ? "ტექნიკა" : "Machinery Asset");
            machId = mach?.id;
        } else {
            if (!customName.trim()) {
                toast.error(isKa ? "გთხოვთ შეიყვანოთ მანქანის სახელი" : "Please enter vehicle name");
                return;
            }
            vehicleName = customName.trim();
            machId = `quick-mach-${Date.now()}`;

            // Also register into central machinery fleet if onSetMachinery provided
            if (onSetMachinery) {
                const newMachItem: Machinery = {
                    id: machId,
                    name: vehicleName,
                    type: customCategory === 'tractor' ? 'Tractor' : customCategory === 'passenger' ? 'Transport' : 'Equipment',
                    status: 'operational',
                    isOwned,
                    ownership: isOwned ? 'owned' : 'rented',
                    vehicleCategory: customCategory,
                    hourlyRate: hiredCost,
                    baseCostRate: hiredCost
                };
                onSetMachinery([...machinery, newMachItem]);
            }
        }

        const driver = employees.find(emp => emp.id === driverId);

        const newAssignedVeh: AssignedVehicle = {
            id: `v-assign-${Date.now()}`,
            name: vehicleName,
            machineryId: machId,
            isOwned,
            hiredCost: isOwned ? 0 : hiredCost,
            usageHours: Number(usageHours) || 0,
            vehicleType: mode === 'custom' ? (customCategory === 'passenger' ? 'passenger' : customCategory === 'cargo' ? 'cargo' : 'other') : 'other',
            foremanId: driverId || undefined,
            foremanName: driver ? driver.name : undefined
        };

        const updatedVehicles = [...assignedVehicles, newAssignedVeh];
        
        // Recalculate full total cost for work assignment
        const newVehicleCost = updatedVehicles.reduce((acc, v) => acc + (v.isOwned ? 0 : (v.usageHours || 0) * (v.hiredCost || 0)), 0);
        const materialCost = work.totalMaterialCost || 0;
        const laborCost = work.totalLaborCost || 0;

        const updatedWork: WorkAssignment = {
            ...work,
            assignedVehicles: updatedVehicles,
            totalCost: laborCost + materialCost + newVehicleCost,
            changeHistory: [
                ...(work.changeHistory || []),
                {
                    timestamp: new Date().toISOString(),
                    userName: 'System User',
                    action: 'Add Vehicle',
                    details: `Added vehicle ${vehicleName} (${usageHours} hrs, rate: $${hiredCost})`
                }
            ]
        };

        onSaveWork(updatedWork);
        toast.success(isKa ? `ავტომობილი "${vehicleName}" მიება რეესტრს` : `Vehicle "${vehicleName}" assigned to registry`);

        // Reset inputs
        setCustomName('');
        setUsageHours(work.plannedTime || 8);
    };

    const handleRemoveVehicle = (vehicleId: string) => {
        const removed = assignedVehicles.find(v => v.id === vehicleId);
        const updatedVehicles = assignedVehicles.filter(v => v.id !== vehicleId);
        const newVehicleCost = updatedVehicles.reduce((acc, v) => acc + (v.isOwned ? 0 : (v.usageHours || 0) * (v.hiredCost || 0)), 0);
        const materialCost = work.totalMaterialCost || 0;
        const laborCost = work.totalLaborCost || 0;

        const updatedWork: WorkAssignment = {
            ...work,
            assignedVehicles: updatedVehicles,
            totalCost: laborCost + materialCost + newVehicleCost,
            changeHistory: [
                ...(work.changeHistory || []),
                {
                    timestamp: new Date().toISOString(),
                    userName: 'System User',
                    action: 'Remove Vehicle',
                    details: `Removed vehicle ${removed?.name || vehicleId}`
                }
            ]
        };

        onSaveWork(updatedWork);
        toast.info(isKa ? "ავტომობილი წაიშალა რეესტრიდან" : "Vehicle removed from registry");
    };

    const taskTitle = typeof work.workName === 'string' ? work.workName : (work.workName as any)?.title || 'Work Task';

    return (
        <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[4500] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-emerald-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 sm:p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                            🚜
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-base sm:text-lg uppercase tracking-tight">
                                    {isKa ? 'ავტომობილები & ტექნიკა' : 'Vehicles & Machinery'}
                                </h3>
                                <span className="bg-emerald-400/25 border border-emerald-300/40 text-emerald-100 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                    {assignedVehicles.length} {isKa ? 'ერთეული' : 'units'}
                                </span>
                            </div>
                            <p className="text-xs text-emerald-100/90 font-medium truncate max-w-md">
                                {taskTitle} • {new Date(work.date).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
                    {/* Summary Totals Banner */}
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                {isKa ? 'ტექნიკის რაოდენობა' : 'Total Vehicles'}
                            </p>
                            <p className="text-lg font-black text-slate-900 mt-0.5">
                                {assignedVehicles.length}
                            </p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                {isKa ? 'ჯამური საათები' : 'Total Hours'}
                            </p>
                            <p className="text-lg font-black text-teal-700 mt-0.5">
                                {totalHours.toFixed(1)} <span className="text-xs font-bold text-slate-400">h</span>
                            </p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
                            <p className="text-[9px] font-black uppercase text-emerald-800 tracking-wider">
                                {isKa ? 'დაქირავების ხარჯი' : 'Vehicle OPEX'}
                            </p>
                            <p className="text-lg font-black text-emerald-700 mt-0.5">
                                {formatCurrency(totalVehicleOpex)}
                            </p>
                        </div>
                    </div>

                    {/* Assigned Vehicles List */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Truck size={14} className="text-emerald-600" />
                                <span>{isKa ? 'მიბმული ავტომობილები / ტექნიკა' : 'Assigned Vehicles & Machinery'}</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-bold">
                                {assignedVehicles.length} {isKa ? 'ჩანაწერი' : 'records'}
                            </span>
                        </div>

                        {assignedVehicles.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-400 space-y-1">
                                <p className="text-2xl">🚜</p>
                                <p className="text-xs font-bold">
                                    {isKa ? 'ამ რეესტრზე ტექნიკა ჯერ არ არის მიბმული' : 'No machinery or vehicles assigned to this registry yet'}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {isKa ? 'დაამატეთ ქვემოთ მოცემული ფორმიდან' : 'Add one using the form below'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assignedVehicles.map((v, idx) => {
                                    const cost = v.isOwned ? 0 : (v.usageHours || 0) * (v.hiredCost || 0);
                                    return (
                                        <div 
                                            key={v.id || idx}
                                            className="bg-white rounded-2xl border border-slate-200/90 p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-emerald-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                                                    v.isOwned ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                    🚜
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-xs font-black text-slate-900 uppercase truncate">
                                                            {v.name}
                                                        </p>
                                                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                            v.isOwned 
                                                                ? 'bg-emerald-100 text-emerald-800' 
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {v.isOwned ? (isKa ? 'საკუთარი' : 'Owned Asset') : (isKa ? 'დაქირავებული' : 'Rented')}
                                                        </span>
                                                        {v.foremanName && (
                                                            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                                                👤 {v.foremanName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                                        {v.usageHours || 0} {isKa ? 'სთ' : 'hrs'} {!v.isOwned && `@ ${formatCurrency(v.hiredCost || 0)}/hr`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-slate-900">
                                                        {v.isOwned ? (
                                                            <span className="text-emerald-700 font-bold">{isKa ? 'საკუთარი ($0)' : 'Owned ($0)'}</span>
                                                        ) : (
                                                            formatCurrency(cost)
                                                        )}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveVehicle(v.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                                    title={isKa ? 'წაშლა' : 'Remove'}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Add Vehicle Form */}
                    <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                                <Plus size={15} className="text-emerald-600" />
                                <span>{isKa ? 'ახალი ტექნიკის მიბმა' : 'Assign New Vehicle / Machinery'}</span>
                            </h4>

                            {/* Mode toggle */}
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[10px] font-black uppercase">
                                <button
                                    type="button"
                                    onClick={() => setMode('fleet')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        mode === 'fleet' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'
                                    }`}
                                >
                                    {isKa ? 'ავტოპარკი' : 'Fleet List'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('custom')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        mode === 'custom' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'
                                    }`}
                                >
                                    {isKa ? 'სწრაფი დამატება' : 'Quick Register'}
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleAddVehicle} className="space-y-3.5">
                            {mode === 'fleet' ? (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        {isKa ? 'აირჩიეთ ტექნიკა ავტოპარკიდან' : 'Select Machinery from Fleet'}
                                    </label>
                                    <select
                                        value={selectedMachineryId}
                                        onChange={e => handleMachinerySelectChange(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-emerald-500"
                                    >
                                        {machinery.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.type}) — {m.isOwned ? (isKa ? 'საკუთარი' : 'Owned') : (isKa ? 'დაქირავებული' : 'Rented')} @ ${m.hourlyRate || m.baseCostRate || 0}/hr
                                            </option>
                                        ))}
                                        {machinery.length === 0 && (
                                            <option value="">{isKa ? 'ტექნიკა ვერ მოიძებნა - გამოიყენეთ სწრაფი დამატება' : 'No machinery in fleet - use Quick Register'}</option>
                                        )}
                                    </select>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                            {isKa ? 'მანქანის / ტექნიკის სახელი' : 'Vehicle / Machinery Name'}
                                        </label>
                                        <input
                                            type="text"
                                            value={customName}
                                            onChange={e => setCustomName(e.target.value)}
                                            placeholder={isKa ? "მაგ. Ford Transit, MTZ-82, Sprinter" : "e.g. Ford Transit, MTZ-82, Sprinter"}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                            {isKa ? 'კატეგორია' : 'Category'}
                                        </label>
                                        <select
                                            value={customCategory}
                                            onChange={e => setCustomCategory(e.target.value as any)}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-emerald-500"
                                        >
                                            <option value="tractor">{isKa ? 'ტრაქტორი / მძიმე ტექნიკა' : 'Tractor / Heavy'}</option>
                                            <option value="passenger">{isKa ? 'სამგზავრო / მიკროავტობუსი' : 'Passenger / Minibus'}</option>
                                            <option value="cargo">{isKa ? 'სატვირთო / პიკაპი' : 'Cargo / Truck'}</option>
                                            <option value="inventar">{isKa ? 'მისაბმელი / ინვენტარი' : 'Trailer / Implement'}</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Hours, Cost & Driver */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        {isKa ? 'სამუშაო საათები' : 'Usage Hours'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="0.5"
                                            value={usageHours}
                                            onChange={e => setUsageHours(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-emerald-500"
                                        />
                                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                                            {isKa ? 'სთ' : 'hrs'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        {isKa ? 'საათობრივი ტარიფი ($)' : 'Hourly Cost Rate ($)'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            disabled={isOwned}
                                            value={isOwned ? 0 : hiredCost}
                                            onChange={e => setHiredCost(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:border-emerald-500"
                                        />
                                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                                            $/hr
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        {isKa ? 'მძღოლი / პასუხისმგებელი' : 'Driver / Operator'}
                                    </label>
                                    <select
                                        value={driverId}
                                        onChange={e => setDriverId(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">{isKa ? '-- არჩევითი --' : '-- Optional --'}</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} ({emp.role || 'Worker'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Owned Asset toggle */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={isOwned}
                                        onChange={e => setIsOwned(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                    />
                                    <span>{isKa ? 'საკუთარი ტექნიკა (ხარჯი არ ითვლება OPEX-ში)' : 'Owned Asset ($0 additional hired cost)'}</span>
                                </label>
                                {!isOwned && (
                                    <span className="text-xs font-black text-emerald-700 font-mono">
                                        Subtotal: {formatCurrency((Number(usageHours) || 0) * (Number(hiredCost) || 0))}
                                    </span>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                                >
                                    {isKa ? 'დახურვა' : 'Close'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                >
                                    <Plus size={15} />
                                    <span>{isKa ? 'ავტომობილის მიბმა' : 'Assign Vehicle'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkVehiclesModal;
