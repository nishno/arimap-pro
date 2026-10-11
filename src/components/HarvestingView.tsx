
import React, { useState, useMemo } from 'react';
import type { User, HarvestEvent, HarvestEntry, Pallet, PlantationFeature, AreaPlantationFeature, InventoryItem, Employee, HarvestLog, Role, Account, Transaction, Layer, DashboardWidget, Machinery, EmployeeGroup, Crop, HarvestMethod, MaterialUsed } from '../types';
import { PlusCircleIcon, PencilSquareIcon, CalendarDaysIcon, TractorIcon, ShieldCheckIcon, ArchiveBoxIcon } from './Icons';
import HarvestEventModal from './HarvestEventModal';
import { useLanguage } from '../contexts/LanguageContext';
import type { MapComponentProps } from './MapComponent';
import HarvestDashboard from './Harvesting/HarvestDashboard';
import { Sparkles, Brain, FileUp, Trash, Copy, FileDiff, Share2, History, Users, Package, GripVertical, Palette, StickyNote, ArrowUpDown, Check, X, ChevronUp, ChevronDown, Box } from 'lucide-react';
import HarvestAiAnalysisModal from './HarvestAiAnalysisModal';
import HarvestFileAnalysisModal from './HarvestFileAnalysisModal';
import { HarvestReconciliationModal } from './HarvestReconciliationModal';
import HarvestMethodSelector from './Harvesting/HarvestMethodSelector';
import HarvestEventHistoryModal from './Harvesting/HarvestEventHistoryModal';
import ShareHarvestEventModal from './Harvesting/ShareHarvestEventModal';
import { PresenceEngine } from '../../new_engine/PresenceEngine';
import { calculateNetDurationHours, calculatePickerEarnings } from './HarvestingStats';
import { toast } from 'sonner';

interface HarvestingViewProps {
    currentUser: User | null;
    harvestEvents: HarvestEvent[];
    onSetHarvestEvents: (events: HarvestEvent[]) => void;
    harvestEntries: HarvestEntry[];
    onSetHarvestEntries: (entries: HarvestEntry[]) => void;
    pallets: Pallet[];
    onSetPallets: (pallets: Pallet[]) => void;
    plantationFeatures: PlantationFeature[];
    inventoryItems: InventoryItem[];
    employees: Employee[];
    onSetEmployees: (employees: Employee[]) => void;
    roles: Role[];
    harvestLogs: HarvestLog[];
    onSetHarvestLogs: (logs: HarvestLog[] | ((prev: HarvestLog[]) => HarvestLog[])) => void;
    onSetInventoryItems: (items: InventoryItem[]) => void;
    accounts: Account[];
    onSetAccounts: (accounts: Account[]) => void;
    transactions: Transaction[];
    onSetTransactions: (transactions: Transaction[]) => void;
    stockTransactions?: import('../types').StockTransaction[];
    onSetStockTransactions?: (txs: import('../types').StockTransaction[]) => void;
    layers: Layer[];
    onCreateListingFromHarvest?: (harvestEvent: HarvestEvent) => void;
    employeeGroups?: EmployeeGroup[];
    onSetEmployeeGroups?: (groups: EmployeeGroup[]) => void;
    onAddToDashboard?: (widget: Omit<DashboardWidget, 'id' | 'order' | 'isVisible'>) => void;
    mapProps: Omit<MapComponentProps, 'children' | 'plantationFeatures' | 'layers'>;
    machinery: Machinery[];
    crops: Crop[];
    cropVarieties?: string[];
    isManualOffline?: boolean;
    onToggleOffline?: (offline: boolean) => void;
    hardwareDevices?: any[];
    onSetAppMode?: (mode: import('../types').AppMode) => void;
    onLogActivity?: (action: string, module: import('../types').AppMode, status: 'success' | 'failure' | 'alert', report?: string) => Promise<void>;
}

const HarvestingView: React.FC<HarvestingViewProps> = (props) => {
    const { t, formatCurrency } = useLanguage();
    const { 
        currentUser, harvestEvents, onSetHarvestEvents, plantationFeatures, 
        employees, inventoryItems, onSetInventoryItems, employeeGroups, 
        machinery, isManualOffline, onToggleOffline 
    } = props;
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isMethodSelectorOpen, setIsMethodSelectorOpen] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<HarvestMethod | null>(null);
    const [editingEvent, setEditingEvent] = useState<HarvestEvent | null>(null);
    const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
    const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
    const [isFileAnalysisOpen, setIsFileAnalysisOpen] = useState(false);
    const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
    const [historyModalEvent, setHistoryModalEvent] = useState<HarvestEvent | null>(null);
    const [shareModalEvent, setShareModalEvent] = useState<HarvestEvent | null>(null);

    // New state for options, note, color, move and sort
    const [sortOption, setSortOption] = useState<'manual' | 'date_desc' | 'date_asc' | 'weight_desc' | 'name_asc'>('manual');
    const [colorPickerEventId, setColorPickerEventId] = useState<string | null>(null);
    const [noteModalEvent, setNoteModalEvent] = useState<HarvestEvent | null>(null);
    const [noteInputText, setNoteInputText] = useState<string>('');
    const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    const sortEventsList = (eventsList: HarvestEvent[]) => {
        const list = [...eventsList];
        if (sortOption === 'date_desc') {
            return list.sort((a, b) => new Date(b.plannedStartDate).getTime() - new Date(a.plannedStartDate).getTime());
        }
        if (sortOption === 'date_asc') {
            return list.sort((a, b) => new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime());
        }
        if (sortOption === 'weight_desc') {
            return list.sort((a, b) => (b.totalNetWeightKg || 0) - (a.totalNetWeightKg || 0));
        }
        if (sortOption === 'name_asc') {
            return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        }
        return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    };

    const activeEvents = useMemo(() => {
        const filtered = (harvestEvents || []).filter(e => e.status !== 'completed' && e.status !== 'partially_sold' && e.status !== 'deleted');
        return sortEventsList(filtered);
    }, [harvestEvents, sortOption]);

    const historicalEvents = useMemo(() => {
        const filtered = (harvestEvents || []).filter(e => e.status === 'completed' || e.status === 'partially_sold');
        return sortEventsList(filtered);
    }, [harvestEvents, sortOption]);

    const handleSetEventColor = (eventId: string, color: 'white' | 'yellow' | 'green' | 'red') => {
        const updated = harvestEvents.map(e => e.id === eventId ? { ...e, customColor: color } : e);
        onSetHarvestEvents(updated);
        setColorPickerEventId(null);
        toast.success(isKa ? 'სესიის სტატუსის ფერი განახლდა' : `Session color set to ${color}`);
    };

    const handleSaveEventNote = () => {
        if (!noteModalEvent) return;
        const updated = harvestEvents.map(e => e.id === noteModalEvent.id ? { ...e, customNote: noteInputText.trim() || undefined } : e);
        onSetHarvestEvents(updated);
        setNoteModalEvent(null);
        setNoteInputText('');
        toast.success(isKa ? 'შენიშვნა შენახულია' : 'Session note saved successfully');
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedEventId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedEventId || draggedEventId === targetId) return;

        const currentList = viewMode === 'active' ? activeEvents : historicalEvents;
        const draggedIdx = currentList.findIndex(e => e.id === draggedEventId);
        const targetIdx = currentList.findIndex(e => e.id === targetId);
        if (draggedIdx === -1 || targetIdx === -1) return;

        const reorderedList = [...currentList];
        const [removed] = reorderedList.splice(draggedIdx, 1);
        reorderedList.splice(targetIdx, 0, removed);

        const updatedMap = new Map<string, number>();
        reorderedList.forEach((item, index) => {
            updatedMap.set(item.id, index + 1);
        });

        const newAllEvents = harvestEvents.map(e => {
            if (updatedMap.has(e.id)) {
                return { ...e, sortOrder: updatedMap.get(e.id) };
            }
            return e;
        });

        onSetHarvestEvents(newAllEvents);
        setSortOption('manual');
        setDraggedEventId(null);
        toast.success(isKa ? 'სესიების მიმდევრობა შეიცვალა' : 'Session order reordered');
    };

    const handleMoveEvent = (eventId: string, direction: 'up' | 'down', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const currentList = viewMode === 'active' ? activeEvents : historicalEvents;
        const idx = currentList.findIndex(item => item.id === eventId);
        if (idx === -1) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= currentList.length) return;

        const reordered = [...currentList];
        const [moved] = reordered.splice(idx, 1);
        reordered.splice(targetIdx, 0, moved);

        const sortMap = new Map<string, number>();
        reordered.forEach((item, index) => {
            sortMap.set(item.id, index + 1);
        });

        const updatedAll = harvestEvents.map(item => {
            if (sortMap.has(item.id)) {
                return { ...item, sortOrder: sortMap.get(item.id) };
            }
            return item;
        });

        onSetHarvestEvents(updatedAll);
        setSortOption('manual');
        toast.success(isKa ? 'სესია გადაადგილდა' : 'Session moved');
    };

    const handleSelectEvent = (id: string) => {
        setSelectedEventId(id);
    };

    const handleMethodSelect = (method: HarvestMethod) => {
        setSelectedMethod(method);
        setIsMethodSelectorOpen(false);
        setEditingEvent(null);
        setIsEventModalOpen(true);
    };

    const handleSaveEvent = (eventData: HarvestEvent) => {
        let newInventory = [...(props.inventoryItems || [])];
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

        if (editingEvent) {
            updateInventoryWithDiff(editingEvent.materialsUsed, eventData.materialsUsed);
            onSetHarvestEvents(harvestEvents.map(e => e.id === eventData.id ? eventData : e));
            if (props.onLogActivity) props.onLogActivity('Event Updated', 'harvesting', 'success', `Updated harvest event: ${eventData.name}`);
        }
        else {
            const newEvent: HarvestEvent = { 
                ...eventData, 
                id: `hev-${Date.now()}`,
                methodId: selectedMethod?.id || eventData.methodId,
                protocol: selectedMethod?.protocol || eventData.protocol
            };
            updateInventoryWithDiff([], newEvent.materialsUsed);
            onSetHarvestEvents([...harvestEvents, newEvent]);
            if (props.onLogActivity) props.onLogActivity('Event Created', 'harvesting', 'success', `user:${currentUser?.name || 'Unknown'} added harvest event:${newEvent.id} named "${newEvent.name}"`);
        }

        if (inventoryChanged && props.onSetInventoryItems) {
            props.onSetInventoryItems(newInventory);
        }

        setIsEventModalOpen(false);
        setEditingEvent(null);
        setSelectedMethod(null);
    };
    
    const handleCopyEvent = (event: HarvestEvent) => {
        const newEvent: HarvestEvent = {
            ...event,
            id: `hev-${Date.now()}`,
            name: `${event.name} (Copy)`,
            status: 'planned',
            actualStartDate: undefined,
            actualEndDate: undefined,
            finalNetYieldKg: undefined,
            boxScans: [],
            breaks: [],
            totalBoxes: 0,
            totalPickerCost: 0,
            totalNetWeightKg: 0,
            totalGrossWeightKg: 0,
            totalVerifiedWeightKg: 0,
            totalEstimatedWeightKg: 0,
            totalPackagingCost: 0,
            totalPallets: 0,
            totalVehicleCost: 0,
            yieldByVariety: [],
            assignedPickers: (event.assignedPickers || []).map(p => ({
                ...p,
                manualHours: undefined,
                manualBoxes: undefined,
                manualNetWeight: undefined,
                manualDays: undefined
            })),
            materialsUsed: event.materialsUsed.map(m => ({...m, quantity: 0}))
        };
        onSetHarvestEvents([...harvestEvents, newEvent]);
        if (props.onLogActivity) props.onLogActivity('Event Copied', 'harvesting', 'success', `user:${currentUser?.name || 'Unknown'} copied harvest event:${event.id} to new event:${newEvent.id} named "${newEvent.name}"`);
    };

    const [eventIdToDelete, setEventIdToDelete] = useState<string | null>(null);

    const handleDeleteEvent = (eventId: string) => {
        setEventIdToDelete(eventId);
    };

    const confirmDeleteEvent = () => {
        if (eventIdToDelete) {
            const ev = harvestEvents.find(e => e.id === eventIdToDelete);
            
            // Soft delete event
            onSetHarvestEvents(harvestEvents.map(e => e.id === eventIdToDelete ? { ...e, status: 'deleted', isDeleted: true, deletedAt: new Date().toISOString() } : e));
            
            if (ev && props.onLogActivity) {
                 props.onLogActivity('Event Sent to Trash', 'harvesting', 'alert', `user:${currentUser?.name || 'Unknown'} archived harvest event:${ev.id} named "${ev.name}". Records remain intact for audit.`);
            }
            setEventIdToDelete(null);
        }
    };
    
    const selectedEvents = (harvestEvents || []).filter(e => selectedEventIds.has(e.id));

    const getEventTotalBoxes = (ev: HarvestEvent, entries: HarvestEntry[] = []): number => {
        if (ev.status === 'completed' || ev.status === 'partially_sold' || ev.finalNetYieldKg !== undefined) {
            if (ev.totalBoxes !== undefined && ev.totalBoxes > 0) return ev.totalBoxes;
            if ((ev as any).finalBoxesCount !== undefined && (ev as any).finalBoxesCount > 0) return (ev as any).finalBoxesCount;
        }

        const entriesForEvent = entries.filter(e => String(e.harvestEventId) === String(ev.id));
        let boxes = 0;

        if (ev.assignedPickers && ev.assignedPickers.length > 0) {
            ev.assignedPickers.forEach(picker => {
                const pickerEntries = entriesForEvent.filter(e => String(e.employeeId) === String(picker.employeeId));
                const scannedBoxes = pickerEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
                const pickerBoxes = picker.manualBoxes ?? scannedBoxes;
                boxes += pickerBoxes;
            });
            const unassignedEntries = entriesForEvent.filter(e => !(ev.assignedPickers || []).some(p => String(p.employeeId) === String(e.employeeId)));
            boxes += unassignedEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
        } else {
            boxes = entriesForEvent.reduce((sum, e) => sum + (e.boxCount || 1), 0);
        }

        if (boxes === 0 && (ev.totalBoxes || 0) > 0) {
            return ev.totalBoxes;
        }

        return boxes;
    };

    const getEventTotalPunnets = (ev: HarvestEvent, entries: HarvestEntry[] = []): number => {
        if (ev.totalPunets !== undefined && ev.totalPunets > 0) return ev.totalPunets;
        if (ev.physicalPunets !== undefined && ev.physicalPunets > 0) return ev.physicalPunets;

        const entriesForEvent = entries.filter(e => String(e.harvestEventId) === String(ev.id));
        let explicitPunets = 0;
        let hasExplicitPunets = false;

        if (entriesForEvent.length > 0) {
            entriesForEvent.forEach(e => {
                const pun = e.punets ?? e.punetCount;
                if (pun !== undefined && pun > 0) {
                    explicitPunets += pun;
                    hasExplicitPunets = true;
                }
            });
        }

        if (hasExplicitPunets && explicitPunets > 0) {
            return explicitPunets;
        }

        const boxes = getEventTotalBoxes(ev, entries);
        const pPerBox = ev.punetsPerBox || 12;
        return Math.round(boxes * pPerBox);
    };

    const aggregatorStats = useMemo(() => {
        let combinedVolume = 0;
        let totalBoxes = 0;
        let totalOpex = 0;
        let usedMaterialsPrice = 0;
        let grossRevenue = 0;
        let paidOpex = 0;
        let paidSalary = 0;
        let salaryLeft = 0;
        const buyersSet = new Set<string>();

        selectedEvents.forEach(ev => {
            // 1. Volume
            let eventNetWeight = 0;
            if (ev.status === 'completed' || ev.status === 'partially_sold' || ev.finalNetYieldKg !== undefined) {
                eventNetWeight = ev.finalNetYieldKg || ev.totalNetWeightKg || 0;
            } else {
                const entriesForEvent = props.harvestEntries.filter(e => e.harvestEventId === ev.id);
                (ev.assignedPickers || []).forEach(picker => {
                    const pickerEntries = entriesForEvent.filter(e => e.employeeId === picker.employeeId);
                    const scannedWeight = pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
                    eventNetWeight += picker.manualNetWeight ?? scannedWeight;
                });
                const unassignedEntries = entriesForEvent.filter(e => !(ev.assignedPickers || []).some(p => p.employeeId === e.employeeId));
                eventNetWeight += unassignedEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
            }
            combinedVolume += eventNetWeight;

            // 1b. Boxes
            totalBoxes += getEventTotalBoxes(ev, props.harvestEntries);

            // 2. Materials
            const materialsCost = (ev.materialsUsed || []).reduce((sum, mu) => {
                const item = (props.inventoryItems || []).find(i => i.id === mu.inventoryItemId);
                return sum + (mu.quantity * (item?.unitCost || 0));
            }, 0);
            usedMaterialsPrice += materialsCost;

            // 3. Labor and Opex
            const durationHours = calculateNetDurationHours(ev);
            let laborCost = 0;
            let paidLabor = 0;

            if (ev.manualOpex !== undefined && ev.manualOpex > 0) {
                laborCost = ev.manualOpex;
                const relatedTxns = (props.transactions || []).filter(t => t.referenceId === ev.id);
                const paidByTxns = relatedTxns.filter(t => t.transactionType === 'Outgoing Payment').reduce((s, t) => s + t.amount, 0);
                paidLabor = paidByTxns > 0 ? Math.min(laborCost, paidByTxns) : laborCost;
            } else {
                (ev.assignedPickers || []).forEach(picker => {
                    const pickerEntries = (props.harvestEntries || []).filter(e => String(e.harvestEventId) === String(ev.id) && String(e.employeeId) === String(picker.employeeId));
                    const weight = picker.manualNetWeight ?? pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
                    const effectiveHours = picker.manualHours ?? durationHours;
                    const pickerEarnings = calculatePickerEarnings(picker, weight, effectiveHours);
                    
                    laborCost += pickerEarnings;

                    const empTransactions = (props.transactions || []).filter(t => t.employeeId === picker.employeeId);
                    const accrued = empTransactions.filter(t => t.creditAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                    const paid = empTransactions.filter(t => t.debitAccountId === 'acc-payroll').reduce((s, t) => s + t.amount, 0);
                    const ratio = accrued > 0 ? Math.min(1, paid / accrued) : 1.0;

                    paidLabor += pickerEarnings * ratio;
                });
            }

            const machineCost = ev.manualVehicleCost !== undefined && ev.manualVehicleCost > 0 
                ? ev.manualVehicleCost 
                : (ev.assignedVehicles || []).reduce((acc, v) => {
                    const machineDetails = (machinery || []).find(m => m.id === v.machineryId);
                    const rate = v.isOwned ? (machineDetails?.hourlyRate || 0) : (v.hiredCost || 0);
                    return acc + ((v.usageHours || 0) * rate);
                }, 0);

            const otherCosts = ev.otherOpexItems?.reduce((s, x) => s + (x.cost || 0), 0) || 0;

            const totalEvOpex = laborCost + machineCost + otherCosts;
            const totalEvPaidOpex = paidLabor + machineCost + otherCosts;

            totalOpex += totalEvOpex;
            paidOpex += totalEvPaidOpex;
            paidSalary += paidLabor;
            salaryLeft += (laborCost - paidLabor);

            // 4. Gross Revenue
            let evRevenue = 0;
            if (ev.saleDetails?.totalValue) {
                evRevenue = ev.saleDetails.totalValue;
                if (ev.saleDetails.buyerName) {
                    buyersSet.add(ev.saleDetails.buyerName);
                }
            } else {
                // Find in inventory / sales
                const relatedItems = (props.inventoryItems || []).filter(i => i.relatedHarvestId === ev.id);
                const invRevenue = relatedItems.reduce((sum, item) => {
                    const rate = item.rate || 1;
                    const itemVal = (item.currentStock || 0) * (item.unitCost || 0) * rate;
                    const physicalCash = item.physicalCash || 0;
                    const depositLLC = item.depositLLC || 0;
                    const itemRevenue = (physicalCash + depositLLC) || itemVal || 0;
                    if (item.buyer) {
                        buyersSet.add(item.buyer);
                    }
                    return sum + itemRevenue;
                }, 0);
                evRevenue = invRevenue;
            }
            grossRevenue += evRevenue;
        });

        const netRevenue = grossRevenue - totalOpex - usedMaterialsPrice;
        const averagePrice = combinedVolume > 0 ? (grossRevenue / combinedVolume) : 0;
        const buyerInfo = buyersSet.size > 0 ? Array.from(buyersSet).join(', ') : '—';

        return {
            combinedVolume,
            totalBoxes,
            totalOpex,
            usedMaterialsPrice,
            grossRevenue,
            netRevenue,
            buyerInfo,
            averagePrice,
            paidOpex,
            paidSalary,
            salaryLeft
        };
    }, [selectedEvents, props.harvestEntries, props.inventoryItems, props.transactions, machinery]);

    const activeEvent = selectedEventId ? (harvestEvents || []).find(e => e.id === selectedEventId) : null;

    const handleBulkDelete = () => {
        const isKa = localStorage.getItem('agri-app-lang') === 'ka';
        const confirmMessage = isKa 
            ? `ნამდვილად გსურთ მონიშნული ${selectedEventIds.size} სესიის წაშლა?` 
            : `Are you sure you want to delete the selected ${selectedEventIds.size} sessions?`;
        if (window.confirm(confirmMessage)) {
            const updatedEvents = harvestEvents.map(e => {
                if (selectedEventIds.has(e.id)) {
                    return { ...e, status: 'deleted' as const, isDeleted: true, deletedAt: new Date().toISOString() };
                }
                return e;
            });
            onSetHarvestEvents(updatedEvents);
            if (props.onLogActivity) {
                props.onLogActivity('Bulk Events Sent to Trash', 'harvesting', 'alert', `user:${currentUser?.name || 'Unknown'} archived ${selectedEventIds.size} harvest events in bulk.`);
            }
            setSelectedEventIds(new Set());
            toast.success(isKa ? 'სესიები წარმატებით წაიშალა' : 'Selected sessions deleted successfully.');
        }
    };

    const eventsToShow = viewMode === 'active' ? activeEvents : historicalEvents;

    return (
        <React.Fragment>
            {activeEvent ? (
                <HarvestDashboard 
                    event={activeEvent} 
                    onBack={() => setSelectedEventId(null)} 
                    {...props} 
                    crops={props.crops} 
                    cropVarieties={props.cropVarieties} 
                    hardwareDevices={props.hardwareDevices} 
                />
            ) : (
                <main className="flex-1 bg-white overflow-y-auto p-4 md:p-8 safe-area-bottom">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{t('hv.title')}</h1>
                                <p className="text-sm font-bold text-slate-400">{t('hv.subtitle')}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => onToggleOffline?.(!isManualOffline)}
                                    className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 border-2 ${isManualOffline ? 'bg-orange-500 text-white border-orange-400' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                                >
                                    <ShieldCheckIcon size={16} /> {isManualOffline ? t('hv.work_offline') : t('hv.cloud_mode')}
                                </button>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => setIsAiAnalysisOpen(true)} 
                                className="flex-1 sm:flex-none px-5 py-3 bg-white border-2 border-blue-100 text-blue-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:border-blue-300 hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                                title="AI Harvest Analysis"
                            >
                                <Brain size={16}/> {t('hv.ai_analysis')}
                            </button>
                            <button 
                                onClick={() => setIsFileAnalysisOpen(true)} 
                                className="flex-1 sm:flex-none px-5 py-3 bg-white border-2 border-purple-100 text-purple-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:border-purple-300 hover:bg-purple-50 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                                title="AI File Analysis"
                            >
                                <FileUp size={16}/> {t('hv.ai_file')}
                            </button>
                            <button 
                                onClick={() => setIsReconciliationOpen(true)} 
                                className="flex-1 sm:flex-none px-5 py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                                title="AI Paper Reconciliation"
                            >
                                <FileDiff size={16}/> {localStorage.getItem('agri-app-lang') === 'ka' ? 'AI ქაღალდის შედარება' : 'AI Paper Compare'}
                            </button>
                        </div>
                        <button 
                            onClick={() => setIsMethodSelectorOpen(true)} 
                            disabled={currentUser?.isGuest}
                            className="flex-1 sm:flex-none px-6 py-3 bg-slate-900 text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={currentUser?.isGuest ? "Verification required" : "Start New Session"}
                        >
                            <PlusCircleIcon className="h-5 w-5"/> {t('hv.start_session')}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-full w-full sm:w-auto min-w-[300px]">
                        <button onClick={() => setViewMode('active')} className={`flex-1 py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${viewMode === 'active' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
                            {t('hv.active_ops')} ({activeEvents.length})
                        </button>
                        <button onClick={() => setViewMode('history')} className={`flex-1 py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${viewMode === 'history' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
                            {t('hv.historical_data')} ({historicalEvents.length})
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-slate-200 shadow-2xs">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {isKa ? 'სორტირება:' : 'Sort:'}
                        </span>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            <option value="manual">{isKa ? 'ხელით (Drag & Drop)' : 'Manual Order (Drag & Drop)'}</option>
                            <option value="date_desc">{isKa ? 'თარიღი (ახალი -> ძველი)' : 'Date (Newest First)'}</option>
                            <option value="date_asc">{isKa ? 'თარიღი (ძველი -> ახალი)' : 'Date (Oldest First)'}</option>
                            <option value="weight_desc">{isKa ? 'წონა (მაღალი -> დაბალი)' : 'Yield Weight (Highest First)'}</option>
                            <option value="name_asc">{isKa ? 'სახელი (A-Z)' : 'Name (A-Z)'}</option>
                        </select>
                    </div>
                </div>

                {selectedEventIds.size > 0 && (
                    <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex flex-col gap-6 sticky top-4 z-10 shadow-2xl animate-fadeIn">
                        <div className="flex flex-wrap gap-x-8 gap-y-4 items-center">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'ჯამური მოცულობა' : 'Combined Volume'}
                                </p>
                                <p className="text-xl font-black text-emerald-400">{aggregatorStats.combinedVolume.toLocaleString(undefined, {maximumFractionDigits:1})} kg</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'ჯამური OPEX' : 'Total Opex'}
                                </p>
                                <p className="text-xl font-black text-red-400">{formatCurrency(aggregatorStats.totalOpex)}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'გამოყენებული მასალები' : 'Used Materials Price'}
                                </p>
                                <p className="text-xl font-black text-yellow-500">{formatCurrency(aggregatorStats.usedMaterialsPrice)}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'სრული შემოსავალი' : 'Gross Revenue'}
                                </p>
                                <p className="text-xl font-black text-blue-400">{formatCurrency(aggregatorStats.grossRevenue)}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-teal-300">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'წმინდა შემოსავალი' : 'Net Revenue'}
                                </p>
                                <p className="text-xl font-black text-teal-400">{formatCurrency(aggregatorStats.netRevenue)}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'საშუალო ფასი' : 'Average Price'}
                                </p>
                                <p className="text-xl font-black text-indigo-400">{formatCurrency(aggregatorStats.averagePrice)}/kg</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'გამოყენებული ყუთები' : 'Used Boxes'}
                                </p>
                                <p className="text-xl font-black text-amber-400 flex items-center gap-1.5">
                                    <Package className="h-5 w-5 text-amber-400 shrink-0" />
                                    <span>{aggregatorStats.totalBoxes.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase">bxs</span>
                                </p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-300">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'გადახდილი OPEX' : 'Paid Opex'}
                                </p>
                                <p className="text-xl font-black text-rose-400">{formatCurrency(aggregatorStats.paidOpex)}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'გადახდილი ხელფასი' : 'Paid Salary'}
                                </p>
                                <p className="text-xl font-black text-cyan-400">{formatCurrency(aggregatorStats.paidSalary)}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'დარჩენილი ხელფასი' : 'Salary Left'}
                                </p>
                                <p className={`text-xl font-black ${aggregatorStats.salaryLeft > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {formatCurrency(aggregatorStats.salaryLeft)}
                                </p>
                            </div>
                            <div className="h-8 w-px bg-slate-800 hidden sm:block border-l border-slate-700 pl-6 max-w-[200px]"></div>
                            <div className="max-w-[200px]">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'მყიდველი' : 'Buyer Info'}
                                </p>
                                <p className="text-sm font-bold text-slate-200 truncate mt-1" title={aggregatorStats.buyerInfo}>{aggregatorStats.buyerInfo}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-between items-center border-t border-slate-800 pt-4">
                            <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                                <span>
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? `მონიშნულია ${selectedEventIds.size} სესია` : `${selectedEventIds.size} sessions selected`}
                                </span>
                                <span className="text-slate-600">•</span>
                                <span className="text-amber-300 font-black flex items-center gap-1 bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                                    <Package className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                    <span>{aggregatorStats.totalBoxes.toLocaleString()}</span>
                                    <span className="text-[10px] text-amber-200/80 uppercase">{localStorage.getItem('agri-app-lang') === 'ka' ? 'ყუთი' : 'Boxes'}</span>
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setSelectedEventIds(new Set())} 
                                    className="text-[10px] font-black uppercase px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
                                >
                                    {localStorage.getItem('agri-app-lang') === 'ka' ? 'გასუფთავება' : 'Clear Selection'}
                                </button>
                                <button 
                                    onClick={handleBulkDelete} 
                                    className="text-[10px] font-black uppercase px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shadow-lg shadow-red-900/40"
                                >
                                    <Trash size={12}/> {localStorage.getItem('agri-app-lang') === 'ka' ? 'მონიშნულის წაშლა' : 'Delete Selected'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {eventsToShow.map(event => {
                        const assignedPickersDetails = (event.assignedPickers || [])
                            .map(p => employees.find(e => e.id === p.employeeId))
                            .filter(Boolean) as Employee[];
                        const visiblePickers = assignedPickersDetails.slice(0, 3);
                        const remainingCount = assignedPickersDetails.length - visiblePickers.length;

                        // Dynamically calculate net/gross if not finalized, to match dashboard EXACTLY
                        let dynamicTotalWeight = 0;
                        let dynamicGrossWeight = 0;
                        const dynamicTotalBoxes = getEventTotalBoxes(event, props.harvestEntries);
                        const dynamicTotalPunnets = getEventTotalPunnets(event, props.harvestEntries);
                        
                        if (event.status === 'completed' || event.status === 'partially_sold' || event.finalNetYieldKg !== undefined) {
                            dynamicTotalWeight = event.finalNetYieldKg || event.totalNetWeightKg || 0;
                            dynamicGrossWeight = event.totalGrossWeightKg || 0;
                        } else {
                            const entriesForEvent = props.harvestEntries.filter(e => e.harvestEventId === event.id);
                            
                            let totalTare = 0;
                            let totalBoxesForTare = 0;
                            entriesForEvent.forEach(e => {
                                const derivedTare = (e.grossWeightKg ?? e.netWeightKg ?? 0) - (e.netWeightKg || 0);
                                totalTare += e.tareWeightKg !== undefined ? e.tareWeightKg : Math.max(0, derivedTare);
                                totalBoxesForTare += e.boxCount || 1;
                            });
                            const eventTareWeightAverage = totalBoxesForTare > 0 ? totalTare / totalBoxesForTare : 0;
                            
                            (event.assignedPickers || []).forEach(picker => {
                                const pickerEntries = entriesForEvent.filter(e => e.employeeId === picker.employeeId);
                                const scannedWeight = pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
                                const scannedBoxes = pickerEntries.reduce((sum, e) => sum + (e.boxCount || 1), 0);
                                const scannedGross = pickerEntries.reduce((sum, e) => sum + (e.grossWeightKg ?? ((e.netWeightKg || 0) + (e.boxCount || 1) * eventTareWeightAverage)), 0);
                                
                                const pickerNetWeight = picker.manualNetWeight ?? scannedWeight;
                                const pickerBoxes = picker.manualBoxes ?? scannedBoxes;
                                
                                dynamicTotalWeight += pickerNetWeight;
                                if (picker.manualNetWeight !== undefined || picker.manualBoxes !== undefined) {
                                    dynamicGrossWeight += pickerNetWeight + (pickerBoxes * eventTareWeightAverage);
                                } else {
                                    dynamicGrossWeight += scannedGross;
                                }
                            });
                            
                            const unassignedEntries = entriesForEvent.filter(e => !(event.assignedPickers || []).some(p => p.employeeId === e.employeeId));
                            dynamicTotalWeight += unassignedEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
                            dynamicGrossWeight += unassignedEntries.reduce((sum, e) => sum + (e.grossWeightKg ?? ((e.netWeightKg || 0) + (e.boxCount || 1) * eventTareWeightAverage)), 0);
                        }

                        const relatedItems = (inventoryItems || []).filter(i => i.relatedHarvestId === event.id);
                        const hasSales = relatedItems.some(i => i.status === 'SOLD');
                        const remainingStockWeight = relatedItems.filter(i => i.status !== 'SOLD' && i.status !== 'COLD_STORAGE_RETURNED').reduce((sum, i) => sum + (i.currentStock || 0), 0);

                        const isSelected = selectedEventIds.has(event.id);
                        
                        const getCardStyle = (color?: string, isSel?: boolean) => {
                            if (isSel) {
                                if (color === 'yellow') return 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/80 shadow-md';
                                if (color === 'green') return 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/80 shadow-md';
                                if (color === 'red' || color === 'orange') return 'ring-2 ring-red-500 border-red-400 bg-red-50/80 shadow-md';
                                return 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/10 shadow-md';
                            }
                            if (color === 'yellow') return 'bg-amber-50/50 border-amber-300 hover:shadow-lg hover:border-amber-400 shadow-xs';
                            if (color === 'green') return 'bg-emerald-50/50 border-emerald-300 hover:shadow-lg hover:border-emerald-400 shadow-xs';
                            if (color === 'red' || color === 'orange') return 'bg-red-50/50 border-red-300 hover:shadow-lg hover:border-red-400 shadow-xs';
                            return 'bg-white border-slate-100 hover:shadow-lg hover:border-blue-200 shadow-xs';
                        };

                        return (
                            <div key={event.id} className={`relative rounded-xl border transition-all cursor-pointer group ${getCardStyle(event.customColor, isSelected)}`}>
                                {/* Left Action Toolbar: Checkbox, Move Handle, Color Palette, Note Button */}
                                <div className="absolute top-3 left-3 z-20 flex flex-col items-center gap-1.5 p-1 bg-white/95 backdrop-blur-xs rounded-xl shadow-sm border border-slate-200/80 transition-all">
                                    {/* Selection Checkbox */}
                                    <div 
                                        className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const next = new Set(selectedEventIds);
                                            if (next.has(event.id)) {
                                                next.delete(event.id);
                                            } else {
                                                next.add(event.id);
                                            }
                                            setSelectedEventIds(next);
                                        }}
                                        title={isSelected ? "Deselect Event" : "Select Event"}
                                    >
                                        <input 
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}} 
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 block"
                                        />
                                    </div>

                                    {/* Move Drag Handle Button (⠿) */}
                                    <div
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, event.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, event.id)}
                                        className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-grab active:cursor-grabbing transition-colors flex flex-col items-center group/grip relative"
                                        title="Move (Drag & Drop or click arrows)"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <GripVertical className="w-4 h-4" />
                                        <div className="hidden group-hover/grip:flex flex-col gap-0.5 absolute -right-6 top-0 bg-white shadow-md border border-slate-200 rounded p-0.5 z-30">
                                            <button 
                                                onClick={(e) => handleMoveEvent(event.id, 'up', e)}
                                                className="p-0.5 hover:bg-slate-100 text-slate-600 rounded" 
                                                title="Move Up"
                                            >
                                                <ChevronUp className="w-3 h-3"/>
                                            </button>
                                            <button 
                                                onClick={(e) => handleMoveEvent(event.id, 'down', e)}
                                                className="p-0.5 hover:bg-slate-100 text-slate-600 rounded" 
                                                title="Move Down"
                                            >
                                                <ChevronDown className="w-3 h-3"/>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Color Re-coding Button (🎨) */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setColorPickerEventId(colorPickerEventId === event.id ? null : event.id);
                                            }}
                                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                                event.customColor && event.customColor !== 'white'
                                                    ? 'text-amber-600 bg-amber-100/80 hover:bg-amber-200 font-bold'
                                                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                            }`}
                                            title="Color Re-coding (White, Yellow, Green, Red)"
                                        >
                                            <Palette className="w-4 h-4" />
                                        </button>
                                        {/* Color Picker Dropdown Popover */}
                                        {colorPickerEventId === event.id && (
                                            <div 
                                                className="absolute left-full top-0 ml-2 z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-2 flex flex-col gap-1 w-36 animate-fadeIn"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="text-[9px] font-black uppercase text-slate-400 px-1 mb-1">
                                                    {isKa ? 'სტატუსის ფერი' : 'Status Color'}
                                                </div>
                                                <button
                                                    onClick={() => handleSetEventColor(event.id, 'white')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!event.customColor || event.customColor === 'white' ? 'bg-slate-100 border border-slate-300' : 'hover:bg-slate-50'}`}
                                                >
                                                    <span className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shadow-2xs"></span>
                                                    <span>White</span>
                                                </button>
                                                <button
                                                    onClick={() => handleSetEventColor(event.id, 'yellow')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${event.customColor === 'yellow' ? 'bg-amber-100 border border-amber-300' : 'hover:bg-amber-50'}`}
                                                >
                                                    <span className="w-3.5 h-3.5 rounded-full bg-amber-300 border border-amber-400 shadow-2xs"></span>
                                                    <span className="text-amber-900">Yellow</span>
                                                </button>
                                                <button
                                                    onClick={() => handleSetEventColor(event.id, 'green')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${event.customColor === 'green' ? 'bg-emerald-100 border border-emerald-300' : 'hover:bg-emerald-50'}`}
                                                >
                                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-emerald-500 shadow-2xs"></span>
                                                    <span className="text-emerald-900">Green</span>
                                                </button>
                                                <button
                                                    onClick={() => handleSetEventColor(event.id, 'red')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${event.customColor === 'red' || event.customColor === 'orange' ? 'bg-red-100 border border-red-300' : 'hover:bg-red-50'}`}
                                                >
                                                    <span className="w-3.5 h-3.5 rounded-full bg-red-500 border border-red-600 shadow-2xs"></span>
                                                    <span className="text-red-900">Red</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Note Button (📝) */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNoteModalEvent(event);
                                            setNoteInputText(event.customNote || '');
                                        }}
                                        className={`p-1 rounded-lg relative transition-colors cursor-pointer ${
                                            event.customNote
                                                ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold'
                                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                        title={event.customNote ? `Note: ${event.customNote}` : "Add Session Note"}
                                    >
                                        <StickyNote className="w-4 h-4" />
                                        {event.customNote && (
                                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white shadow-xs"></span>
                                        )}
                                    </button>
                                </div>

                                <div className="p-6 pl-14" onClick={() => handleSelectEvent(event.id)}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 rounded-xl bg-blue-100 text-blue-600"><TractorIcon className="h-6 w-6" /></div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('hv.collector')}</div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="text-lg font-black text-slate-800">{dynamicTotalWeight.toLocaleString(undefined, {maximumFractionDigits:1})} kg <span className="text-[10px] text-slate-400">NET</span></div>
                                                <div className="text-xs font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded uppercase">{dynamicGrossWeight.toLocaleString(undefined, {maximumFractionDigits:1})} kg <span className="text-[9px] opacity-70">GROSS</span></div>
                                                <div className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 flex items-center gap-1 uppercase">
                                                    <Package className="h-3 w-3 text-amber-600" />
                                                    <span>{dynamicTotalBoxes.toLocaleString()}</span>
                                                    <span className="text-[9px] text-amber-600/80">{localStorage.getItem('agri-app-lang') === 'ka' ? 'ყუთი' : 'BOXES'}</span>
                                                </div>
                                                {relatedItems.length > 0 && (
                                                    <div className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 uppercase mt-0.5 tracking-tighter">
                                                        Unsold Left: {remainingStockWeight.toLocaleString(undefined, {maximumFractionDigits:1})} kg
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-bold text-slate-900 truncate pr-2">{typeof event.name === 'object' && event.name ? ((event.name as any).name || (event.name as any).id || '[Object]') : String(event.name || '')}</h3>
                                            <span className="text-[8px] font-mono font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0">{event.id}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            <p className="text-xs text-slate-500 font-semibold uppercase">{event.sectorIds.length} {t('hv.targeted_area')}</p>
                                            <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded shadow-2xs" title={localStorage.getItem('agri-app-lang') === 'ka' ? 'პუნეტების სულ რაოდენობა' : 'Total Punnets'}>
                                                <Box className="h-3 w-3 text-emerald-600" />
                                                <span>{dynamicTotalPunnets.toLocaleString()} {localStorage.getItem('agri-app-lang') === 'ka' ? 'პუნეტი' : 'Punnets'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-semibold">
                                            <CalendarDaysIcon className="h-4 w-4"/>
                                            <span>{t('hv.starts')} {new Date(event.plannedStartDate).toLocaleDateString()}</span>
                                        </div>

                                        {/* Session Note Display on Card */}
                                        {event.customNote && (
                                            <div 
                                                className="mt-3 p-2.5 bg-indigo-50/90 border border-indigo-200/80 rounded-xl text-xs text-indigo-950 flex items-start gap-2 shadow-2xs cursor-pointer hover:bg-indigo-100/80 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setNoteModalEvent(event);
                                                    setNoteInputText(event.customNote || '');
                                                }}
                                            >
                                                <StickyNote className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                                <div className="flex-1 font-medium text-[11px] leading-snug line-clamp-2">
                                                    <span className="font-bold text-indigo-700 block uppercase tracking-wider text-[9px] mb-0.5">
                                                        {isKa ? 'ჩანაწერი:' : 'Session Note:'}
                                                    </span>
                                                    "{event.customNote}"
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
                                     <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${event.status === 'active' ? 'bg-blue-100 text-blue-700' : (event.status === 'completed' || event.status === 'partially_sold') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {event.status.replace('_', ' ')}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex -space-x-2">
                                            {visiblePickers.map(p => (
                                                <div key={p.id} title={p.name} className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white">{(p?.name && typeof p.name === 'string') ? p.name.charAt(0) : 'P'}</div>
                                            ))}
                                            {remainingCount > 0 && (
                                                <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white">+{remainingCount}</div>
                                            )}
                                        </div>
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShareModalEvent(event);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors cursor-pointer"
                                            title="Share Session"
                                        >
                                            <Share2 className="h-4 w-4"/>
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setHistoryModalEvent(event);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors cursor-pointer"
                                            title="Version Audit History"
                                        >
                                            <History className="h-4 w-4"/>
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopyEvent(event);
                                            }}
                                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                            title="Copy Session"
                                        >
                                            <Copy className="h-5 w-5"/>
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingEvent(event);
                                                setIsEventModalOpen(true);
                                            }}
                                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                            title="Edit Session"
                                        >
                                            <PencilSquareIcon className="h-5 w-5"/>
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteEvent(event.id);
                                            }}
                                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            title="Delete Session"
                                        >
                                            <Trash className="h-5 w-5"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isEventModalOpen && <HarvestEventModal event={editingEvent} onSave={handleSaveEvent} onClose={() => setIsEventModalOpen(false)} sectors={(plantationFeatures || []).filter(f => f.type === 'area') as AreaPlantationFeature[]} plantationFeatures={plantationFeatures} employees={employees} onSetEmployees={props.onSetEmployees} roles={props.roles} inventoryItems={inventoryItems} employeeGroups={employeeGroups} onSetEmployeeGroups={props.onSetEmployeeGroups} />}
            
            {isMethodSelectorOpen && (
                <HarvestMethodSelector 
                    onSelect={handleMethodSelect} 
                    onClose={() => setIsMethodSelectorOpen(false)} 
                />
            )}

            <HarvestAiAnalysisModal 
                isOpen={isAiAnalysisOpen} 
                onClose={() => setIsAiAnalysisOpen(false)} 
                harvestEvents={harvestEvents} 
            />

            <HarvestFileAnalysisModal 
                isOpen={isFileAnalysisOpen} 
                onClose={() => setIsFileAnalysisOpen(false)} 
                onSaveEvent={handleSaveEvent}
                sectors={(plantationFeatures || []).filter(f => f.type === 'area') as AreaPlantationFeature[]}
                employees={employees || []}
                onSetEmployees={props.onSetEmployees}
                harvestEvents={harvestEvents}
                onSetHarvestEvents={onSetHarvestEvents}
            />

            <HarvestReconciliationModal 
                isOpen={isReconciliationOpen}
                onClose={() => setIsReconciliationOpen(false)}
                employees={employees || []}
                onSetEmployees={props.onSetEmployees}
                harvestEvents={harvestEvents}
                onSetHarvestEvents={onSetHarvestEvents}
                onLogActivity={props.onLogActivity}
            />

            {historyModalEvent && (
                <HarvestEventHistoryModal 
                    isOpen={!!historyModalEvent}
                    onClose={() => setHistoryModalEvent(null)}
                    event={historyModalEvent}
                    entries={props.harvestEntries.filter(e => e.harvestEventId === historyModalEvent.id)}
                    employees={props.employees}
                    onSetHarvestEntries={props.onSetHarvestEntries}
                    onLogActivity={props.onLogActivity}
                    onRestoreVersion={(restoredEvent) => {
                        onSetHarvestEvents(harvestEvents.map(e => e.id === restoredEvent.id ? restoredEvent : e));
                        setHistoryModalEvent(null);
                    }}
                />
            )}

            {shareModalEvent && (
                <ShareHarvestEventModal 
                    isOpen={!!shareModalEvent}
                    onClose={() => setShareModalEvent(null)}
                    event={shareModalEvent}
                    entries={props.harvestEntries.filter(e => e.harvestEventId === shareModalEvent.id)}
                />
            )}

            {noteModalEvent && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white max-w-lg w-full rounded-[2rem] shadow-2xl p-6 border border-slate-100 animate-fadeIn">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <StickyNote className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">
                                        {isKa ? 'სესიის შენიშვნის ჩანაწერი' : 'Session Note Record'}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        ID: <span className="font-mono text-slate-700">{noteModalEvent.id}</span> — {typeof noteModalEvent.name === 'object' ? (noteModalEvent.name as any).name : String(noteModalEvent.name || '')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setNoteModalEvent(null);
                                    setNoteInputText('');
                                }}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="my-5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                {isKa ? 'ტექსტური შენიშვნა / კომენტარი' : 'Text Note / Comment'}
                            </label>
                            <textarea
                                value={noteInputText}
                                onChange={(e) => setNoteInputText(e.target.value)}
                                rows={4}
                                placeholder={isKa ? 'შეიყვანეთ შენიშვნა მოსავლის აღების სესიისთვის...' : 'Enter note for this harvest session...'}
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all resize-none"
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setNoteModalEvent(null);
                                    setNoteInputText('');
                                }}
                                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEventNote}
                                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <Check className="w-4 h-4" />
                                {isKa ? 'შენახვა' : 'Save Note'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {eventIdToDelete && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl p-6 border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                            <ArchiveBoxIcon className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Delete Session</h3>
                        <p className="text-xs font-bold text-slate-500 mb-6">
                            Are you sure you want to delete this session?
                            <br/><br/>
                            <span className="text-[10px] text-left block text-slate-400">
                                What will be deleted:
                                <br />• The session metadata
                                <br />• All associated log entries
                                <br />• Financial tracking links
                                <br />• Local supply chain syncs
                            </span>
                        </p>
                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={() => setEventIdToDelete(null)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDeleteEvent}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-200 hover:bg-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </main>
            )}
        </React.Fragment>
    );
};

export default HarvestingView;
