import React, { useState, useMemo, useEffect } from 'react';
import type { WorkAssignment, Employee, AreaPlantationFeature, Machinery, InventoryItem, MaterialUsed, AssignedVehicle, Note, Checkpoint } from '../types';
import { TASK_TYPES } from '../types';
import { XCircleIcon, PlusIcon, TrashIcon, TractorIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { getTaskEligibleEmployees } from '../utils/employeeFilters';
import { ScanLine } from 'lucide-react';
import QrScannerModal from './QrScannerModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { findMatchingEmployee } from '../utils/employeeMatching';

interface WorkAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (work: WorkAssignment) => void;
    work: WorkAssignment | null;
    employees: Employee[];
    sectors: AreaPlantationFeature[];
    machinery: Machinery[];
    inventoryItems: InventoryItem[];
    notesList: Note[];
    checkpoints: Checkpoint[];
    onSetEmployees?: (employees: Employee[]) => void;
    onSetInventoryItems?: (items: InventoryItem[]) => void;
}

const WorkAssignmentModal: React.FC<WorkAssignmentModalProps> = ({ 
    isOpen, onClose, onSave, work, employees, sectors, machinery, 
    inventoryItems, notesList, checkpoints, onSetEmployees, onSetInventoryItems
}) => {
    const { t } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
    
    const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
    const [showAllWorkers, setShowAllWorkers] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const eligibleEmployees = useMemo(() => getTaskEligibleEmployees(employees), [employees]);
    const displayEmployees = useMemo(() => showAllWorkers ? employees : eligibleEmployees, [showAllWorkers, employees, eligibleEmployees]);
    
    const [formState, setFormState] = useState<Omit<WorkAssignment, 'id'>>({
        workName: work?.workName || '',
        date: work?.date ? new Date(work.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        status: work?.status || 'planned',
        taskType: work?.taskType || 'Other',
        assignedEmployeeIds: work?.assignedEmployeeIds || [],
        sectorIds: work?.sectorIds || [],
        assignedVehicles: work?.assignedVehicles || [],
        materialsUsed: work?.materialsUsed || [],
        notes: work?.notes || '',
        source: 'planner',
        employeeHours: work?.employeeHours || [],
        totalLaborCost: work?.totalLaborCost || 0,
        checkpointId: work?.checkpointId || '',
        linkedFeatureId: work?.linkedFeatureId || '',
    });

    const [manualHours, setManualHours] = useState<{[key: string]: number | string}>({});

    useEffect(() => {
        if (work) {
            setFormState({
                workName: work.workName,
                date: new Date(work.date).toISOString().split('T')[0],
                status: work.status,
                taskType: work.taskType,
                assignedEmployeeIds: work.assignedEmployeeIds,
                sectorIds: work.sectorIds,
                assignedVehicles: work.assignedVehicles || [],
                materialsUsed: work.materialsUsed || [],
                notes: work.notes || '',
                source: work.source || 'planner',
                employeeHours: work.employeeHours || [],
                totalLaborCost: work.totalLaborCost || 0,
            });

            if (work.employeeHours && work.employeeHours.length > 0) {
                const initialHours: {[key: string]: number} = {};
                work.employeeHours.forEach(eh => { initialHours[eh.employeeId] = eh.hours; });
                setManualHours(initialHours);
            } else {
                const initialHours: {[key: string]: number} = {};
                work.assignedEmployeeIds.forEach(id => initialHours[id] = 8);
                setManualHours(initialHours);
            }
        } else {
            setFormState({
                workName: '',
                date: new Date().toISOString().split('T')[0],
                status: 'planned',
                taskType: 'Other',
                assignedEmployeeIds: [],
                sectorIds: [],
                assignedVehicles: [],
                materialsUsed: [],
                notes: '',
                source: 'planner',
                employeeHours: [],
                totalLaborCost: 0,
                checkpointId: '',
                linkedFeatureId: '',
            });
            setManualHours({});
        }
    }, [work, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleMultiSelect = (field: 'assignedEmployeeIds' | 'sectorIds', value: string) => {
        setFormState(prev => {
            const current = (prev[field] as string[]) || [];
            const isSelected = current.includes(value);
            const newValues = isSelected ? current.filter(id => id !== value) : [...current, value];
            
            if (field === 'assignedEmployeeIds') {
                if (!isSelected) {
                    setManualHours(h => ({ ...h, [value]: 8 }));
                } else {
                    const { [value]: _, ...rest } = manualHours;
                    setManualHours(rest);
                }
            }
            
            return { ...prev, [field]: newValues };
        });
    };

    const handleAddVehicle = () => {
        const newVeh: AssignedVehicle = { 
            id: `veh-${Date.now()}`, 
            name: 'New Vehicle', 
            isOwned: true, 
            hiredCost: 0, 
            usageHours: 0 
        };
        setFormState(p => ({ ...p, assignedVehicles: [...(p.assignedVehicles || []), newVeh] }));
    };

    const handleVehicleChange = (index: number, field: keyof AssignedVehicle, value: any) => {
        const list = [...(formState.assignedVehicles || [])];
        if (field === 'machineryId') {
            const m = machinery.find(item => item.id === value);
            list[index] = { ...list[index], [field]: value, name: m?.name || 'Unknown' };
        } else {
            list[index] = { ...list[index], [field]: value };
        }
        setFormState(p => ({ ...p, assignedVehicles: list }));
    };

    const removeVehicle = (index: number) => {
        setFormState(prev => ({ ...prev, assignedVehicles: (prev.assignedVehicles || []).filter((_, i) => i !== index) }));
    };

    const handleAddMaterial = () => {
        setFormState(p => ({ ...p, materialsUsed: [...(p.materialsUsed || []), { inventoryItemId: '', quantity: 0 }] }));
    };

    const handleMaterialChange = (index: number, field: keyof MaterialUsed, value: string | number) => {
        const list = [...(formState.materialsUsed || [])];
        list[index] = { ...list[index], [field]: value };
        setFormState(p => ({ ...p, materialsUsed: list }));
    };

    const estimatedCost = useMemo(() => {
        let total = 0;
        
        // Labor Cost
        formState.assignedEmployeeIds.forEach(empId => {
            const emp = employees.find(e => e.id === empId);
            const hours = Number(manualHours[empId]) || 8;
            if (emp) {
                if (emp.paymentType === 'hourly') total += hours * emp.paymentRate;
                else if (emp.paymentType === 'daily') total += (hours / 8) * emp.paymentRate;
            }
        });
        
        // Vehicle/Machinery Cost
        (formState.assignedVehicles || []).forEach(v => {
            if (!v.isOwned) total += (v.usageHours || 0) * v.hiredCost;
        });
        
        // Material Cost
        (formState.materialsUsed || []).forEach(mu => {
            const item = inventoryItems.find(i => i.id === mu.inventoryItemId);
            if (item) {
                total += (mu.quantity || 0) * (item.unitCost || 0);
            }
        });
        
        return total;
    }, [formState.assignedEmployeeIds, manualHours, employees, formState.assignedVehicles, formState.materialsUsed, inventoryItems]);

    const handleScanResult = (result: string, category?: any, parsedData?: any) => {
        const code = result.trim();
        if (!code) return;
        const parsed = parsedData || parseUniversalScan(code, employees, inventoryItems, 'auto');
        setIsScannerOpen(false);

        // 1. Worker Identification
        if (parsed.detectedType === 'worker' || parsed.employee) {
            const emp = parsed.employee || findMatchingEmployee(employees, code) || employees.find(e => e.id === code || e.barcode === code || e.idNumber === code);
            if (emp) {
                setShowAllWorkers(true);
                if (formState.assignedEmployeeIds.includes(emp.id)) {
                    toast.info(isKa ? `${emp.name} უკვე დამატებულია` : `${emp.name} is already assigned`);
                } else {
                    setFormState(prev => ({
                        ...prev,
                        assignedEmployeeIds: [...prev.assignedEmployeeIds, emp.id]
                    }));
                    setManualHours(prev => ({ ...prev, [emp.id]: 8 }));
                    toast.success(isKa ? `✓ მუშაკი დაემატა: ${emp.name}` : `✓ Added worker: ${emp.name}`);
                }
                return;
            }
        }

        // 2. Harvest Box QR with mapped worker
        if (parsed.detectedType === 'harvest_box' && parsed.harvestBox?.pickerId) {
            const emp = findMatchingEmployee(employees, parsed.harvestBox.pickerId);
            if (emp) {
                if (!formState.assignedEmployeeIds.includes(emp.id)) {
                    setFormState(prev => ({
                        ...prev,
                        assignedEmployeeIds: [...prev.assignedEmployeeIds, emp.id]
                    }));
                    setManualHours(prev => ({ ...prev, [emp.id]: 8 }));
                    toast.success(isKa ? `✓ ყუთიდან დაემატა: ${emp.name}` : `✓ Added from box QR: ${emp.name}`);
                }
                return;
            }
        }

        // 3. Material Detection
        if (parsed.detectedType === 'material' || parsed.material) {
            const mat = parsed.material?.item || inventoryItems.find(i => 
                i.id === code || (i as any).sku === code || (i as any).barcode === code
            );
            if (mat) {
                const qty = parsed.material?.quantity || 1;
                const existingIndex = formState.materialsUsed.findIndex(m => m.inventoryItemId === mat.id);
                if (existingIndex >= 0) {
                    const list = [...formState.materialsUsed];
                    list[existingIndex].quantity = (Number(list[existingIndex].quantity) || 0) + qty;
                    setFormState(prev => ({ ...prev, materialsUsed: list }));
                    toast.success(isKa ? `✓ +${qty} ${mat.unitOfMeasure} ${mat.name}` : `✓ +${qty} ${mat.unitOfMeasure} ${mat.name}`);
                } else {
                    setFormState(prev => ({
                        ...prev,
                        materialsUsed: [...prev.materialsUsed, { inventoryItemId: mat.id, quantity: qty }]
                    }));
                    toast.success(isKa ? `✓ დაემატა მასალა: ${mat.name} (${qty} ${mat.unitOfMeasure})` : `✓ Added material: ${mat.name} (${qty} ${mat.unitOfMeasure})`);
                }
                return;
            }
        }

        toast.warning(isKa ? `კოდი ვერ მოიძებნა: ${code}` : `Unrecognized scan code: ${code}`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = formState.assignedEmployeeIds.map(id => ({ 
            employeeId: id, 
            hours: Number(manualHours[id]) || 8 
        }));

        // Deduct materials from stock if completed or assigned with onSetInventoryItems
        if (onSetInventoryItems && inventoryItems.length > 0 && formState.materialsUsed.length > 0) {
            let invChanged = false;
            const updatedInv = inventoryItems.map(item => {
                const used = formState.materialsUsed.find(m => m.inventoryItemId === item.id);
                if (used && used.quantity > 0) {
                    invChanged = true;
                    return { ...item, currentStock: Math.max(0, item.currentStock - Number(used.quantity)) };
                }
                return item;
            });
            if (invChanged) {
                onSetInventoryItems(updatedInv);
                toast.success(isKa ? "მასალები წარმატებით ჩამოიწერა საწყობიდან!" : "Materials deducted from warehouse stock!");
            }
        }

        onSave({ 
            id: work?.id || `work-${Date.now()}`, 
            ...formState, 
            employeeHours: payload, 
            totalLaborCost: estimatedCost 
        } as WorkAssignment);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-gray-800">{work ? 'Edit Work Assignment' : 'New Work Assignment'}</h2>
                        <button
                            type="button"
                            onClick={() => setIsScannerOpen(true)}
                            className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                            title={isKa ? "მუშაკის ან მასალის QR/შტრიხკოდის სკანირება" : "Scan Worker or Material QR Code"}
                        >
                            <ScanLine size={13} className="text-emerald-400" />
                            <span>{isKa ? 'QR სკანერი (მუშები / მასალები)' : 'Scan QR'}</span>
                        </button>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircleIcon className="h-6 w-6" /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto text-sm">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Task Name</label>
                                <input name="workName" value={formState.workName} onChange={handleChange} className="input-field mt-1" required placeholder="e.g., Fertilizing Sector A" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Type</label>
                                    <select name="taskType" value={formState.taskType} onChange={handleChange} className="input-field mt-1">
                                        {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Date</label>
                                    <input name="date" type="date" value={formState.date} onChange={handleChange} className="input-field mt-1" required />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700">Sectors / Areas</label>
                                <div className="border rounded-md p-2 h-32 overflow-y-auto bg-gray-50 mt-1">
                                    {sectors.filter(s => s.type === 'area' || s.type === 'sector').map(s => (
                                        <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={formState.sectorIds.includes(s.id)} 
                                                onChange={() => handleMultiSelect('sectorIds', s.id)} 
                                                className="rounded text-green-600"
                                            />
                                            <span className="text-gray-700">{s.name}</span>
                                        </label>
                                    ))}
                                    {sectors.length === 0 && <p className="text-xs text-gray-400 italic p-2">No sectors defined.</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Link Checkpoint</label>
                                    <select name="checkpointId" value={formState.checkpointId} onChange={handleChange} className="input-field mt-1 text-xs">
                                        <option value="">No Checkpoint</option>
                                        {checkpoints.map(cp => (
                                            <option key={cp.id} value={cp.id}>{cp.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Link Feature</label>
                                    <select name="linkedFeatureId" value={formState.linkedFeatureId} onChange={handleChange} className="input-field mt-1 text-xs">
                                        <option value="">No Feature</option>
                                        {sectors.filter(s => ['area', 'sector', 'note', 'checkpoint'].includes(s.type)).map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                                        Materials / Inventory
                                    </h4>
                                    <button type="button" onClick={handleAddMaterial} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                                        <PlusIcon className="h-3 w-3"/> Add Material
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {(formState.materialsUsed || []).map((mu, idx) => (
                                        <div key={idx} className="flex gap-2 items-start bg-gray-50 p-2 rounded-md border border-gray-100">
                                            <div className="flex-grow">
                                                <select 
                                                    value={mu.inventoryItemId} 
                                                    onChange={e => handleMaterialChange(idx, 'inventoryItemId', e.target.value)} 
                                                    className="input-field text-xs" 
                                                    required
                                                >
                                                    <option value="">Select Item</option>
                                                    {inventoryItems.map(i => (
                                                        <option key={i.id} value={i.id}>
                                                            {i.name} ({i.unitOfMeasure}) - ${i.unitCost}/unit
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-24">
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={mu.quantity} 
                                                    onChange={e => handleMaterialChange(idx, 'quantity', parseFloat(e.target.value) || 0)} 
                                                    className="input-field text-xs" 
                                                    placeholder="Qty" 
                                                    required 
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setFormState(p => ({...p, materialsUsed: p.materialsUsed?.filter((_, i) => i !== idx)}))} 
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                            >
                                                <TrashIcon className="h-4 w-4"/>
                                            </button>
                                        </div>
                                    ))}
                                    {(formState.materialsUsed || []).length === 0 && (
                                        <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-md border border-dashed text-center">
                                            No materials assigned to this task.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm font-medium text-gray-700">Assign Workforce</label>
                                    {employees.length > 0 && (
                                        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer font-bold select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={employees.length > 0 && selectedWorkers.size === employees.length}
                                                onChange={(ev) => {
                                                    if (ev.target.checked) {
                                                        setSelectedWorkers(new Set(employees.map(e => e.id)));
                                                    } else {
                                                        setSelectedWorkers(new Set());
                                                    }
                                                }}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                            />
                                            <span>Select All for Bulk Wage</span>
                                        </label>
                                    )}
                                </div>

                                {selectedWorkers.size > 0 && onSetEmployees && (
                                    <div className="mb-2 bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg flex flex-col gap-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-indigo-950">👥 {selectedWorkers.size} selected for wage change</span>
                                            <button 
                                                type="button" 
                                                onClick={() => setSelectedWorkers(new Set())} 
                                                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <select 
                                                id="work-bulk-payment-type" 
                                                className="p-1 text-xs border border-slate-200 rounded bg-white flex-grow font-bold text-slate-800"
                                                defaultValue="hourly"
                                            >
                                                <option value="hourly">Hourly</option>
                                                <option value="daily">Daily</option>
                                                <option value="salary">Salary</option>
                                            </select>
                                            <input 
                                                id="work-bulk-rate-input" 
                                                type="number" 
                                                step="0.01" 
                                                placeholder="Rate" 
                                                className="p-1 text-xs border border-slate-200 rounded w-16 bg-white font-bold"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const typeEl = document.getElementById('work-bulk-payment-type') as HTMLSelectElement;
                                                    const rateEl = document.getElementById('work-bulk-rate-input') as HTMLInputElement;
                                                    const newType = typeEl.value as any;
                                                    const newRate = parseFloat(rateEl.value);

                                                    const updatedEmployees = employees.map(emp => {
                                                        if (selectedWorkers.has(emp.id)) {
                                                            return {
                                                                ...emp,
                                                                paymentType: newType,
                                                                paymentRate: isNaN(newRate) ? emp.paymentRate : newRate
                                                            };
                                                        }
                                                        return emp;
                                                    });
                                                    onSetEmployees(updatedEmployees);
                                                    setSelectedWorkers(new Set());
                                                    if (rateEl) rateEl.value = '';
                                                    toast.success('Successfully updated employee wage methods & rates!');
                                                }}
                                                className="px-2 py-1 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-2 mb-1 px-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        {showAllWorkers ? `All Personnel (${displayEmployees.length})` : `Authorized Staff & Specialists (${displayEmployees.length})`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowAllWorkers(!showAllWorkers)}
                                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                        {showAllWorkers ? '⚡ Filter Daily Workers' : '👥 Show All HR'}
                                    </button>
                                </div>

                                <div className="border rounded-md p-2 h-48 overflow-y-auto bg-gray-50 mt-1">
                                    {displayEmployees.map(e => {
                                        const isSelected = formState.assignedEmployeeIds.includes(e.id);
                                        const curHours = manualHours[e.id] !== undefined ? manualHours[e.id] : 8;
                                        return (
                                            <div key={e.id} className={`flex items-center justify-between p-2 rounded-md mb-1 transition-colors ${isSelected ? 'bg-green-50 border border-green-100' : 'hover:bg-gray-100'}`}>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedWorkers.has(e.id)} 
                                                        onChange={() => {
                                                            const copy = new Set(selectedWorkers);
                                                            if (copy.has(e.id)) copy.delete(e.id);
                                                            else copy.add(e.id);
                                                            setSelectedWorkers(copy);
                                                        }} 
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer mr-1" 
                                                        title="Select for bulk edit"
                                                    />
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => handleMultiSelect('assignedEmployeeIds', e.id)} 
                                                        className="rounded text-green-600 focus:ring-green-500 h-3.5 w-3.5 cursor-pointer" 
                                                        title="Assign to task"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">{e.name} {e.role ? <span className="text-xs text-indigo-600 font-bold">({e.role})</span> : null}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{e.paymentType || 'hourly'} - ₾{e.paymentRate || 0}/{e.paymentType === 'hourly' ? 'hr' : 'day'}</p>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center gap-1 bg-white p-1 rounded border shadow-sm">
                                                        <input 
                                                            type="number" 
                                                            step="0.5" 
                                                            value={curHours} 
                                                            onChange={ev => setManualHours(prev => ({...prev, [e.id]: ev.target.value}))} 
                                                            className="w-12 p-1 text-xs text-center focus:outline-none font-bold" 
                                                        />
                                                        <span className="text-[10px] text-gray-400 font-bold pr-1">HRS</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {displayEmployees.length === 0 && <p className="text-xs text-gray-400 italic p-2">No authorized staff found.</p>}
                                </div>
                            </div>
                            
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                                        <TractorIcon className="h-4 w-4 text-gray-500" /> Machinery & Logistics
                                    </h4>
                                    <button type="button" onClick={handleAddVehicle} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                                        <PlusIcon className="h-4 w-4"/> Add Vehicle
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {(formState.assignedVehicles || []).map((v, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 border rounded-lg space-y-3 relative group">
                                            <div className="flex gap-2">
                                                <select 
                                                    value={v.machineryId || ''} 
                                                    onChange={e => handleVehicleChange(idx, 'machineryId', e.target.value)} 
                                                    className="input-field text-xs flex-grow"
                                                >
                                                    <option value="">Select Asset</option>
                                                    {machinery.map(m => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.name} ({m.type})
                                                        </option>
                                                    ))}
                                                </select>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeVehicle(idx)} 
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    <TrashIcon className="h-5 w-5"/>
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-4 items-center">
                                                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={v.isOwned} 
                                                        onChange={e => handleVehicleChange(idx, 'isOwned', e.target.checked)}
                                                        className="rounded text-blue-600"
                                                    /> 
                                                    Owned Asset
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Usage:</span>
                                                    <div className="flex items-center gap-1 bg-white border rounded px-2 py-1">
                                                        <input 
                                                            type="number" 
                                                            step="0.5" 
                                                            value={v.usageHours} 
                                                            onChange={e => handleVehicleChange(idx, 'usageHours', parseFloat(e.target.value) || 0)} 
                                                            className="w-10 text-xs focus:outline-none"
                                                        />
                                                        <span className="text-[10px] text-gray-400">h</span>
                                                    </div>
                                                </div>
                                                {!v.isOwned && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Hired Rate:</span>
                                                        <div className="flex items-center gap-1 bg-white border rounded px-2 py-1">
                                                            <span className="text-[10px] text-gray-400">$</span>
                                                            <input 
                                                                type="number" 
                                                                step="1" 
                                                                value={v.hiredCost} 
                                                                onChange={e => handleVehicleChange(idx, 'hiredCost', parseFloat(e.target.value) || 0)} 
                                                                className="w-12 text-xs focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {(formState.assignedVehicles || []).length === 0 && (
                                        <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-md border border-dashed text-center">
                                            No machinery assigned.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Link Checkpoint</label>
                                <select 
                                    name="checkpointId" 
                                    value={formState.checkpointId || ''} 
                                    onChange={handleChange}
                                    className="input-field mt-1"
                                >
                                    <option value="">No Checkpoint</option>
                                    {checkpoints.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">Link Note/Observation</label>
                                <select 
                                    name="linkedFeatureId" 
                                    value={formState.linkedFeatureId || ''} 
                                    onChange={handleChange}
                                    className="input-field mt-1"
                                >
                                    <option value="">No Linked Note</option>
                                    {notesList.map(n => (
                                        <option key={n.id} value={n.id}>{n.content.substring(0, 30) || 'Unnamed Note'}...</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Notes & Instructions</label>
                            <textarea 
                                name="notes" 
                                value={formState.notes} 
                                onChange={handleChange} 
                                className="input-field mt-1 min-h-[80px]" 
                                rows={3} 
                                placeholder="General observations, safety notices, specific instructions for the team..."
                            ></textarea>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-lg">
                        <div className="flex items-center gap-4">
                            <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
                                <p className="text-[10px] text-gray-400 font-bold uppercase leading-tight">Estimated Cost</p>
                                <p className="text-xl font-black text-slate-900">${estimatedCost.toFixed(2)}</p>
                            </div>
                            <div className="hidden sm:block text-[10px] text-gray-400 max-w-[150px]">
                                Includes labor, hired machinery, and material costs.
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-green-600 text-white rounded-lg font-bold uppercase tracking-wider shadow-md hover:bg-green-700 transition-all active:scale-95"
                            >
                                {work ? 'Update Assignment' : 'Save Assignment'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            </div>

            {isScannerOpen && (
                <QrScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    onScan={handleScanResult}
                    mockEmployees={employees}
                    inventoryItems={inventoryItems}
                    initialCategory="auto"
                    title={isKa ? "დავალების სკანერი (მუშები / მასალები)" : "Task Scanner (Workers / Materials)"}
                    description={isKa ? "დაასკანერეთ მუშაკის ID ბარათი ან მასალის QR/შტრიხკოდი" : "Scan employee ID card or material QR/barcode"}
                />
            )}

            <style>{`
                .input-field { 
                    width: 100%; 
                    padding: 0.625rem; 
                    border: 1px solid #e5e7eb; 
                    border-radius: 0.5rem; 
                    background-color: white; 
                    transition: all 0.2s;
                    outline: none;
                }
                .input-field:focus {
                    border-color: #10b981;
                    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
                }
            `}</style>
        </>
    );
};

export default WorkAssignmentModal;
