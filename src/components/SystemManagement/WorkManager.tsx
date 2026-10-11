import React, { useState, useMemo } from 'react';
import { PlusCircleIcon, ClipboardDocumentIcon, PencilSquareIcon, TrashIcon, MapPinIcon, CheckIcon } from '../Icons';
import WorkAssignmentModal from '../WorkAssignmentModal';
import WorkDetailsModal from '../WorkDetailsModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { WorkAssignment, Employee, AreaPlantationFeature, Machinery, InventoryItem, Permission, MaterialUsed } from '../../types';

interface ActionButtonsProps {
    onEdit?: (e: any) => void;
    onDelete?: (e: any) => void;
    onViewDetails?: (e: any) => void;
    onCopy?: (e: any) => void;
    onLogMap?: (e: any) => void;
    onFinish?: (e: any) => void;
    onAddRegistry?: (e: any) => void;
    onRemoveFromMap?: (e: any) => void;
    hasMapMarker?: boolean;
    isCompleted?: boolean;
    isKa?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
    onEdit, 
    onDelete, 
    onViewDetails, 
    onCopy, 
    onLogMap, 
    onFinish, 
    onAddRegistry,
    onRemoveFromMap,
    hasMapMarker,
    isCompleted,
    isKa
}) => (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {onAddRegistry && (
            <button
                type="button"
                onClick={(e) => onAddRegistry(e)}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all active:scale-95"
                title={isKa ? "რეესტრის დეტალები და ხელფასები" : "Add / Edit Registry Details & Payroll"}
            >
                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                <span>{isKa ? 'რეესტრი' : 'Registry'}</span>
            </button>
        )}
        {onFinish && (
            <button 
                type="button"
                onClick={(e) => onFinish(e)} 
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all border ${
                    isCompleted 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' 
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'
                }`}
                title={isCompleted ? (isKa ? "სტატუსი: დასრულებული" : "Completed") : (isKa ? "დაასრულე დავალება" : "Mark as Complete")}
            >
                <CheckIcon className="h-3.5 w-3.5" />
                <span>{isCompleted ? (isKa ? 'დასრულდა' : 'Done') : (isKa ? 'შესრულება' : 'Complete')}</span>
            </button>
        )}
        {hasMapMarker && onRemoveFromMap && (
            <button onClick={(e) => onRemoveFromMap(e)} className="p-1 text-amber-500 hover:text-amber-700 rounded hover:bg-amber-50" title={isKa ? "რუკიდან მოხსნა" : "Remove from map"}>
                <MapPinIcon className="h-3.5 w-3.5 text-amber-500" />
            </button>
        )}
        {onLogMap && !isCompleted && !hasMapMarker && (
            <button onClick={(e) => onLogMap(e)} className="p-1 text-slate-400 hover:text-orange-600 rounded hover:bg-slate-100" title={isKa ? "რუკაზე მონიშვნა" : "Log on Map"}>
                <MapPinIcon className="h-3.5 w-3.5" />
            </button>
        )}
        {onCopy && (
            <button onClick={(e) => onCopy(e)} className="p-1 text-slate-400 hover:text-purple-600 rounded hover:bg-slate-100" title={isKa ? "კოპირება" : "Copy"}>
                <PlusCircleIcon className="h-3.5 w-3.5" />
            </button>
        )}
        {onEdit && (
            <button onClick={(e) => onEdit(e)} className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100" title={isKa ? "რედაქტირება" : "Edit"}>
                <PencilSquareIcon className="h-3.5 w-3.5" />
            </button>
        )}
        {onDelete && (
            <button onClick={(e) => onDelete(e)} className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100" title={isKa ? "წაშლა" : "Delete"}>
                <TrashIcon className="h-3.5 w-3.5" />
            </button>
        )}
    </div>
);

interface WorkManagerProps {
    workAssignments: WorkAssignment[];
    onSetWorkAssignments: (assignments: WorkAssignment[]) => void;
    employees: Employee[];
    sectors: AreaPlantationFeature[];
    currentUserPermissions: Set<Permission>;
    onLogOnMapRequest: (assignment: WorkAssignment) => void;
    machinery: Machinery[];
    inventoryItems: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    notes: any[];
    checkpoints: any[];
    onSetEmployees?: (employees: Employee[]) => void;
    selectedWorkIds?: string[];
    onToggleSelectWork?: (id: string) => void;
    standingWorkId?: string | null;
    onSelectStandingWork?: (id: string) => void;
    onOpenRegistryModal?: (work: WorkAssignment) => void;
    dayFilter?: 'today' | 'past' | 'future' | 'choose' | 'all';
    onSetDayFilter?: (filter: 'today' | 'past' | 'future' | 'choose' | 'all') => void;
    startDate?: string;
    onSetStartDate?: (date: string) => void;
    endDate?: string;
    onSetEndDate?: (date: string) => void;
    onOpenAddModal?: () => void;
}

const WorkManager: React.FC<WorkManagerProps> = ({ 
    workAssignments, onSetWorkAssignments, employees, sectors, 
    currentUserPermissions, onLogOnMapRequest, machinery, inventoryItems, onSetInventoryItems,
    notes, checkpoints, onSetEmployees,
    selectedWorkIds, onToggleSelectWork, standingWorkId, onSelectStandingWork, onOpenRegistryModal,
    dayFilter: propDayFilter, onSetDayFilter,
    startDate: propStartDate, onSetStartDate,
    endDate: propEndDate, onSetEndDate,
    onOpenAddModal
}) => {
    const { t, language } = useLanguage();
    const isKa = language === 'ka';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWork, setEditingWork] = useState<WorkAssignment | null>(null);
    const [viewDetails, setViewDetails] = useState<WorkAssignment | null>(null);
    
    // Internal Day Filter state fallback
    const [internalDayFilter, setInternalDayFilter] = useState<'today' | 'past' | 'future' | 'choose' | 'all'>('all');
    const [internalStartDate, setInternalStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [internalEndDate, setInternalEndDate] = useState(new Date().toISOString().split('T')[0]);

    const activeDayFilter = propDayFilter !== undefined ? propDayFilter : internalDayFilter;
    const activeStartDate = propStartDate !== undefined ? propStartDate : internalStartDate;
    const activeEndDate = propEndDate !== undefined ? propEndDate : internalEndDate;

    const setDayFilter = (f: 'today' | 'past' | 'future' | 'choose' | 'all') => {
        if (onSetDayFilter) onSetDayFilter(f);
        else setInternalDayFilter(f);
    };

    const canEdit = currentUserPermissions.has('edit_work');

    const handleSave = (work: WorkAssignment) => {
        let newInventory = [...(inventoryItems || [])];
        let inventoryChanged = false;

        const updateInventoryWithDiff = (oldMats: MaterialUsed[] = [], newMats: MaterialUsed[] = []) => {
            // Re-add old materials
            oldMats.forEach(om => {
                const i = newInventory.findIndex(inv => inv.id === om.inventoryItemId);
                if (i !== -1) { newInventory[i].currentStock += om.quantity; inventoryChanged = true; }
            });
            // Deduct new materials
            newMats.forEach(nm => {
                const i = newInventory.findIndex(inv => inv.id === nm.inventoryItemId);
                if (i !== -1) { newInventory[i].currentStock -= nm.quantity; inventoryChanged = true; }
            });
        };

        if (editingWork) {
            updateInventoryWithDiff(editingWork.materialsUsed, work.materialsUsed);
            onSetWorkAssignments(workAssignments.map(w => w.id === work.id ? work : w));
        } else {
            updateInventoryWithDiff([], work.materialsUsed);
            onSetWorkAssignments([...workAssignments, work]);
            setDayFilter('all'); // Show everything when a new registry is added
        }

        if (inventoryChanged && onSetInventoryItems) {
            onSetInventoryItems(newInventory);
        }

        setIsModalOpen(false);
        setEditingWork(null);
    };

    const handleDelete = (id: string) => {
        const work = workAssignments.find(w => w.id === id);
        if (work && onSetInventoryItems) {
            let newInventory = [...(inventoryItems || [])];
            let inventoryChanged = false;
            (work.materialsUsed || []).forEach(om => {
                const i = newInventory.findIndex(inv => inv.id === om.inventoryItemId);
                if (i !== -1) { newInventory[i].currentStock += om.quantity; inventoryChanged = true; }
            });
            if (inventoryChanged) onSetInventoryItems(newInventory);
        }
        // Remove linked features on the map if any
        if (work) {
            const idsToDelete = [work.linkedFeatureId, ...(work.sectorIds || [])].filter(Boolean) as string[];
            if (idsToDelete.length > 0) {
                window.dispatchEvent(new CustomEvent('agrimap_delete_features', { detail: { ids: idsToDelete } }));
            }
        }
        onSetWorkAssignments(workAssignments.filter(w => w.id !== id));
    };

    const handleRemoveFromMap = (work: WorkAssignment) => {
        const idsToDelete = [work.linkedFeatureId, ...(work.sectorIds || [])].filter(Boolean) as string[];
        if (idsToDelete.length > 0) {
            window.dispatchEvent(new CustomEvent('agrimap_delete_features', { detail: { ids: idsToDelete } }));
        }
        onSetWorkAssignments(workAssignments.map(w => w.id === work.id ? { ...w, linkedFeatureId: undefined, sectorIds: [] } : w));
    };

    const handleCopy = (work: WorkAssignment) => {
        const newWork = {
            ...work,
            id: `work-${Date.now()}`,
            workName: `Copy of ${work.workName}`,
            status: 'planned' as const,
            employeeHours: [],
            totalLaborCost: work.totalLaborCost 
        };
        onSetWorkAssignments([...workAssignments, newWork]);
    };

    const handleFinish = (work: WorkAssignment) => {
        onSetWorkAssignments(workAssignments.map(w => w.id === work.id ? { ...w, status: w.status === 'completed' ? 'planned' : 'completed' } : w));
    };

    const filteredAssignments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const seenIds = new Set<string>();
        return (workAssignments || []).filter(w => {
            if (!w || !w.id) return false;
            // Prevent duplicate records with identical IDs
            if (seenIds.has(w.id)) return false;
            seenIds.add(w.id);

            // Include everything that comes from tasks, planner or remainder
            // The user wants all registry items to be visible.
            const isRelevant = w.source === 'tasks' || w.source === 'planner' || w.source === 'remainder' || !w.source;
            
            if (!isRelevant) return false;

            const d = new Date(w.date);
            d.setHours(0, 0, 0, 0);

            if (activeDayFilter === 'all') return true;
            if (activeDayFilter === 'today') {
                return d.getTime() === today.getTime();
            } else if (activeDayFilter === 'past') {
                return d.getTime() < today.getTime();
            } else if (activeDayFilter === 'future') {
                return d.getTime() > today.getTime();
            } else if (activeDayFilter === 'choose') {
                const start = new Date(activeStartDate);
                const end = new Date(activeEndDate);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            }
            return true;
        });
    }, [workAssignments, activeStartDate, activeEndDate, activeDayFilter]);

    const totalPlanned = filteredAssignments.length;
    const totalCost = filteredAssignments.reduce((acc, w) => acc + (w.totalLaborCost || 0), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                        <ClipboardDocumentIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-black italic text-slate-800 tracking-tight uppercase">REGISTRY ENTRIES</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mission Planning and Resource Audit</p>
                    </div>
                </div>
                {canEdit && (
                    <button 
                        onClick={() => { 
                            if (onOpenAddModal) onOpenAddModal();
                            else { setEditingWork(null); setIsModalOpen(true); }
                        }}
                        className="h-10 px-3.5 bg-[#3b36db] text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-200 hover:bg-[#2d28b8] transition-all"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Add Registry</span>
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {filteredAssignments.map((work, idx) => {
                    const isSelected = selectedWorkIds?.includes(work.id);
                    const isStanding = standingWorkId === work.id;
                    return (
                        <div 
                            key={`${work.id}-${idx}`} 
                            className={`group bg-white p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                                isStanding
                                ? 'border-indigo-600 shadow-md ring-2 ring-indigo-600/30 bg-indigo-50/20'
                                : isSelected
                                ? 'border-indigo-400 shadow-sm ring-1 ring-indigo-400/20'
                                : 'border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50'
                            }`}
                            onClick={() => {
                                onSelectStandingWork?.(work.id);
                            }}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    {/* Selection checkbox for aggregate calculations */}
                                    <input 
                                        type="checkbox"
                                        checked={isSelected || false}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            onSelectStandingWork?.(work.id);
                                            onToggleSelectWork?.(work.id);
                                        }}
                                        className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                                        title={isKa ? "მონიშნეთ ჯამური კალკულაციისთვის" : "Select for Aggregated Calculation"}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <h5 className="text-base font-black italic text-slate-800 tracking-tight group-hover:text-[#3b36db] transition-colors uppercase truncate">
                                            {typeof work.workName === 'string' ? work.workName : (work.workName as any)?.title || 'Untitled Mission'}
                                        </h5>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {new Date(work.date).toLocaleDateString()}
                                            </p>
                                            <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                work.status === 'completed' ? 'text-emerald-500' : 
                                                work.status === 'in-progress' ? 'text-blue-500' : 'text-slate-400'
                                            }`}>
                                                {work.status}
                                            </p>
                                            {(work.totalCost || work.totalLaborCost) ? (
                                                <>
                                                    <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                                        OPEX: £{(work.totalCost || (work.totalLaborCost || 0) + (work.totalMaterialCost || 0)).toFixed(0)}
                                                    </span>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <ActionButtons 
                                        onAddRegistry={() => {
                                            if (onOpenRegistryModal) {
                                                onOpenRegistryModal(work);
                                            } else {
                                                setViewDetails(work);
                                            }
                                        }}
                                        onFinish={canEdit ? (e: any) => { e.stopPropagation(); handleFinish(work); } : undefined}
                                        isCompleted={work.status === 'completed'}
                                        onEdit={canEdit ? (e: any) => { e.stopPropagation(); setEditingWork(work); setIsModalOpen(true); } : undefined} 
                                        onDelete={canEdit ? (e: any) => { e.stopPropagation(); handleDelete(work.id); } : undefined} 
                                        onCopy={canEdit ? (e: any) => { e.stopPropagation(); handleCopy(work); } : undefined}
                                        onLogMap={canEdit ? (e: any) => { e.stopPropagation(); onLogOnMapRequest(work); } : undefined}
                                        hasMapMarker={!!(work.linkedFeatureId || (work.sectorIds && work.sectorIds.length > 0))}
                                        onRemoveFromMap={canEdit ? (e: any) => { e.stopPropagation(); handleRemoveFromMap(work); } : undefined}
                                        isKa={isKa}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filteredAssignments.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No active missions found</p>
                    </div>
                )}
            </div>
            
            {isModalOpen && <WorkAssignmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} work={editingWork} employees={employees} sectors={sectors} machinery={machinery} inventoryItems={inventoryItems} notesList={notes} checkpoints={checkpoints} onSetEmployees={onSetEmployees} onSetInventoryItems={onSetInventoryItems} />}
            {viewDetails && (
                <WorkDetailsModal 
                    isOpen={!!viewDetails} 
                    onClose={() => setViewDetails(null)} 
                    work={viewDetails} 
                    employees={employees} 
                    inventoryItems={inventoryItems}
                    onSaveWork={(updatedWork) => {
                        handleSave(updatedWork);
                        setViewDetails(updatedWork);
                    }} 
                />
            )}
        </div>
    );
};

export default WorkManager;
