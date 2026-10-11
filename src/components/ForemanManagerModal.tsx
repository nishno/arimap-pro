import React, { useState } from 'react';
import { Employee, Machinery } from '../types';
import { XCircleIcon, UsersIcon, TractorIcon } from './Icons';

interface ForemanManagerModalProps {
    foreman: Employee;
    allEmployees: Employee[];
    allMachinery: Machinery[];
    onSave: (updatedForeman: Employee) => void;
    onClose: () => void;
}

const ForemanManagerModal: React.FC<ForemanManagerModalProps> = ({ foreman, allEmployees, allMachinery, onSave, onClose }) => {
    const [assignedPickers, setAssignedPickers] = useState<Set<string>>(new Set(foreman.assignedPickers || []));
    const [assignedVehicles, setAssignedVehicles] = useState<Set<string>>(new Set(foreman.assignedVehicles || []));

    const handleSave = () => {
        onSave({
            ...foreman,
            assignedPickers: Array.from(assignedPickers),
            assignedVehicles: Array.from(assignedVehicles)
        });
        onClose();
    };

    const togglePicker = (id: string) => {
        const next = new Set(assignedPickers);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setAssignedPickers(next);
    };

    const toggleVehicle = (id: string) => {
        const next = new Set(assignedVehicles);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setAssignedVehicles(next);
    };

    // Filter available pickers (excluding self, or strictly checking role "Picker")
    const availablePickers = allEmployees.filter(e => e.id !== foreman.id);
    const availableVehicles = allMachinery;

    return (
        <div className="fixed inset-0 bg-black/50 z-[6000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Foreman Command Center</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Crew & Fleet Assignment • {foreman.name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <XCircleIcon className="h-8 w-8" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow bg-white grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pickers Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <UsersIcon className="h-5 w-5 text-indigo-500" />
                            <h4 className="font-bold text-slate-700 uppercase text-sm tracking-widest">Assigned Crew ({assignedPickers.size})</h4>
                        </div>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                            {availablePickers.map(emp => (
                                <label key={emp.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${assignedPickers.has(emp.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={assignedPickers.has(emp.id)}
                                        onChange={() => togglePicker(emp.id)}
                                        className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{emp.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.employeeType} • {emp.idNumber}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Vehicles Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <TractorIcon className="h-5 w-5 text-amber-500" />
                            <h4 className="font-bold text-slate-700 uppercase text-sm tracking-widest">Assigned Vehicles ({assignedVehicles.size})</h4>
                        </div>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                            {availableVehicles.map(mach => (
                                <label key={mach.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${assignedVehicles.has(mach.id) ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={assignedVehicles.has(mach.id)}
                                        onChange={() => toggleVehicle(mach.id)}
                                        className="h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                                    />
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{mach.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{mach.vehicleCategory || mach.type} • {mach.ownership === 'owned' || mach.isOwned ? 'Owned' : 'Rented'}</p>
                                    </div>
                                </label>
                            ))}
                            {availableVehicles.length === 0 && (
                                <div className="text-center p-6 text-slate-400 text-sm font-medium">
                                    No machinery registered. Add vehicles in Fleet Manager.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 uppercase text-xs tracking-widest transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 uppercase text-xs tracking-widest transition-colors shadow-md shadow-indigo-200">Save Assignments</button>
                </div>
            </div>
        </div>
    );
};

export default ForemanManagerModal;
