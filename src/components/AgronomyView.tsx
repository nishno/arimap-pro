import React, { useState, useMemo, useEffect } from 'react';
import type { 
    User, NutritionPlan, PlanExecution, InventoryItem, 
    PlantationFeature, Employee, AreaPlantationFeature, 
    DashboardWidget, PlanExecutionElement 
} from '../types';
import { 
    PlusCircleIcon, BeakerIcon, PencilSquareIcon, 
    CalendarDaysIcon, ArrowUturnLeftIcon, XCircleIcon, 
    SparklesIcon, EyeIcon 
} from './Icons';
import { Leaf, FileText, Eye, History, Stethoscope, ScanLine, QrCode } from 'lucide-react';
import { AiAnalysisSuite } from './AiAnalysisSuite';
import NutritionPlanModal from './NutritionPlanModal';
import PlanExecutionModal from './PlanExecutionModal';
import ExecutionDetailModal from './Agronomy/ExecutionDetailModal';
import { useLanguage } from '../contexts/LanguageContext';
import StatCard from './Agronomy/StatCard';
import CalendarView from './Agronomy/CalendarView';
import ListView from './Agronomy/ListView';
import SystemFeedingTankMonitor from './Agronomy/SystemFeedingTankMonitor';
import { AgronomicClinicalLabModal } from '../new_engine/ui/AgronomicClinicalLabModal';
import QrScannerModal, { ScannerCategory, ParsedScanResult } from './QrScannerModal';
import MaterialQrGeneratorModal from './MaterialQrGeneratorModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { toast } from 'sonner';

interface AgronomyViewProps {
    currentUser: User | null;
    nutritionPlans: NutritionPlan[];
    onSetNutritionPlans: (plans: NutritionPlan[]) => void;
    planExecutions: PlanExecution[];
    onSetPlanExecutions: (executions: PlanExecution[]) => void;
    inventoryItems: InventoryItem[];
    plantationFeatures: PlantationFeature[];
    employees: Employee[];
    onAddToDashboard?: (widget: Omit<DashboardWidget, 'id' | 'order' | 'isVisible'>) => void;
    onDeletePlanExecution: (id: string) => void;
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    activeOrgId?: string;
    onAddTask?: (task: any) => void;
    initialTab?: 'tanks' | 'calendar' | 'list' | 'ai_diagnostics';
}

const AgronomyView: React.FC<AgronomyViewProps> = (props) => {
    const { 
        currentUser,
        nutritionPlans, onSetNutritionPlans, 
        planExecutions, onSetPlanExecutions, 
        inventoryItems, plantationFeatures, employees,
        onAddToDashboard,
        onDeletePlanExecution,
        onSetInventoryItems,
        activeOrgId,
        onAddTask,
        initialTab
    } = props;
    const { t } = useLanguage();

    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isExecModalOpen, setIsExecModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<NutritionPlan | null>(null);
    const [editingExec, setEditingExec] = useState<PlanExecution | null>(null);

    // Detailed Log View Modal state
    const [selectedDetailExec, setSelectedDetailExec] = useState<PlanExecution | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [viewMode, setViewMode] = useState<'tanks' | 'calendar' | 'list' | 'ai_diagnostics'>(initialTab || 'tanks');
    const [aiInitialTool, setAiInitialTool] = useState<'disease' | 'document' | 'agro_image' | 'history'>('disease');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isClinicalLabOpen, setIsClinicalLabOpen] = useState(false);
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isQrGenModalOpen, setIsQrGenModalOpen] = useState(false);
    const [scannerCategory, setScannerCategory] = useState<ScannerCategory>('supplies');
    const [scannerAction, setScannerAction] = useState<'charge' | 'add'>('charge');

    const handleAgroScan = (rawCode: string, targetCategory?: ScannerCategory, parsed?: ParsedScanResult) => {
        const scanData = parsed || parseUniversalScan(rawCode, employees, inventoryItems, targetCategory || 'supplies', scannerAction);
        const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

        // 1. Worker Identification
        if (scanData.detectedType === 'worker' || scanData.employee) {
            const emp = scanData.employee;
            toast.info(isKa ? `✓ აგრო-თანამშრომელი: ${emp?.name || rawCode}` : `✓ Agronomy Worker: ${emp?.name || rawCode}`);
            return;
        }

        // 2. Material / Chemical Scanned
        const mat = scanData.material;
        const item = mat?.item || inventoryItems.find(i => 
            i.id === (mat?.materialId || rawCode) ||
            (i as any).sku === (mat?.sku || rawCode) ||
            i.name.toLowerCase() === (mat?.materialName || rawCode).toLowerCase()
        );

        const qty = mat?.quantity || 1;
        const action = mat?.action || scannerAction;
        const unit = mat?.unit || item?.unitOfMeasure || 'კგ';
        const name = mat?.materialName || item?.name || rawCode;

        if (action === 'add') {
            if (item && onSetInventoryItems) {
                const newStock = Math.round(((item.currentStock || 0) + qty) * 100) / 100;
                onSetInventoryItems(inventoryItems.map(i => i.id === item.id ? { ...i, currentStock: newStock } : i));
                toast.success(isKa ? `✓ მიღებულია საწყობში: +${qty} ${unit} ${name}` : `✓ Ingested to stock: +${qty} ${unit} ${name}`);
            } else {
                toast.info(isKa ? `✓ სკანირებულია: ${name} (+${qty} ${unit})` : `✓ Scanned: ${name} (+${qty} ${unit})`);
            }
        } else {
            // Charge / Apply to treatment & record in Charged Execution List
            if (item && onSetInventoryItems) {
                const newStock = Math.max(0, Math.round(((item.currentStock || 0) - qty) * 100) / 100);
                onSetInventoryItems(inventoryItems.map(i => i.id === item.id ? { ...i, currentStock: newStock } : i));
            }

            const defaultSectorId = plantationFeatures.find(f => f.type === 'area' || f.type === 'sector')?.id || '';
            const newExecution: PlanExecution = {
                id: `exec-scan-${Date.now()}`,
                planId: nutritionPlans[0]?.id || 'direct-charge',
                date: new Date().toISOString(),
                sectorIds: defaultSectorId ? [defaultSectorId] : [],
                actualWaterLiters: 0,
                actualElements: [{
                    inventoryItemId: item?.id || mat?.materialId || `item-${Date.now()}`,
                    newItemName: name,
                    quantity: qty,
                    actualQuantity: qty,
                    unit: unit,
                    stockDeduction: qty
                }],
                notes: isKa ? `ჩამოწერილია QR სკანერით: ${name} (${qty} ${unit})` : `Charged via QR scan: ${name} (${qty} ${unit})`
            };

            if (onSetPlanExecutions) {
                onSetPlanExecutions([newExecution, ...(planExecutions || [])]);
            }

            toast.success(
                isKa 
                    ? `✓ ${name} (-${qty} ${unit}) ჩამოიწერა და დაემატა ჩამოწერილების რეესტრში!` 
                    : `✓ Charged ${name} (-${qty} ${unit}) and added to charged history list!`
            );
        }
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const agronomyMaterials = useMemo(() => 
        inventoryItems.filter(i => i.category === 'Fertilizers' || i.category === 'Pesticides'), 
    [inventoryItems]);

    const sectors = useMemo(() =>
        plantationFeatures.filter(f => f.type === 'area') as AreaPlantationFeature[],
    [plantationFeatures]);

    const handleSavePlan = (planData: NutritionPlan) => {
        if (editingPlan) {
            onSetNutritionPlans(nutritionPlans.map(p => p.id === planData.id ? planData : p));
        } else {
            onSetNutritionPlans([...nutritionPlans, { ...planData, id: `nutriplan-${Date.now()}` }]);
        }
        setIsPlanModalOpen(false);
        setEditingPlan(null);
    };

    const handleSaveExecution = (execData: PlanExecution) => {
        let newInventory = [...(inventoryItems || [])];
        let inventoryChanged = false;

        const updateInventoryWithDiff = (oldMats: PlanExecutionElement[] = [], newMats: PlanExecutionElement[] = []) => {
            // Re-add old materials
            oldMats.forEach(om => {
                const i = newInventory.findIndex(inv => inv.id === om.inventoryItemId || inv.name.toLowerCase() === (om.newItemName || '').toLowerCase());
                if (i !== -1) { 
                    newInventory[i].currentStock = Math.round((newInventory[i].currentStock + (om.stockDeduction ?? om.actualQuantity ?? om.quantity ?? 0)) * 100) / 100; 
                    inventoryChanged = true; 
                }
            });
            // Deduct new materials
            newMats.forEach(nm => {
                const i = newInventory.findIndex(inv => inv.id === nm.inventoryItemId || inv.name.toLowerCase() === (nm.newItemName || '').toLowerCase());
                if (i !== -1) { 
                    newInventory[i].currentStock = Math.max(0, Math.round((newInventory[i].currentStock - (nm.stockDeduction ?? nm.actualQuantity ?? nm.quantity ?? 0)) * 100) / 100); 
                    inventoryChanged = true; 
                }
            });
        };

        if (editingExec && editingExec.id) {
            updateInventoryWithDiff(editingExec.actualElements, execData.actualElements);
        } else {
            updateInventoryWithDiff([], execData.actualElements);
        }

        let newExecutions;
        if (editingExec && editingExec.id) {
            newExecutions = planExecutions.map(e => e.id === execData.id ? execData : e);
        } else {
            newExecutions = [...planExecutions, { ...execData, id: `nutriexec-${Date.now()}` }];
        }
        
        onSetPlanExecutions(newExecutions);
        if (inventoryChanged && onSetInventoryItems) {
            onSetInventoryItems(newInventory);
        }

        setIsExecModalOpen(false);
        setEditingExec(null);
    };

    // Save edited execution from Detailed Log Modal with Audit Record
    const handleSaveExecutionWithAudit = (updatedExecution: PlanExecution, editReason?: string) => {
        let newInventory = [...(inventoryItems || [])];
        let inventoryChanged = false;

        const oldExec = planExecutions.find(e => e.id === updatedExecution.id);
        if (oldExec) {
            // Re-add old materials
            oldExec.actualElements.forEach(om => {
                const i = newInventory.findIndex(inv => inv.id === om.inventoryItemId || inv.name.toLowerCase() === (om.newItemName || '').toLowerCase());
                if (i !== -1) {
                    newInventory[i].currentStock = Math.round((newInventory[i].currentStock + (om.stockDeduction ?? om.actualQuantity ?? om.quantity ?? 0)) * 100) / 100;
                    inventoryChanged = true;
                }
            });
            // Deduct new materials
            updatedExecution.actualElements.forEach(nm => {
                const i = newInventory.findIndex(inv => inv.id === nm.inventoryItemId || inv.name.toLowerCase() === (nm.newItemName || '').toLowerCase());
                if (i !== -1) {
                    newInventory[i].currentStock = Math.max(0, Math.round((newInventory[i].currentStock - (nm.stockDeduction ?? nm.actualQuantity ?? nm.quantity ?? 0)) * 100) / 100);
                    inventoryChanged = true;
                }
            });
        }

        const newExecutions = planExecutions.map(e => e.id === updatedExecution.id ? updatedExecution : e);
        onSetPlanExecutions(newExecutions);

        if (inventoryChanged && onSetInventoryItems) {
            onSetInventoryItems(newInventory);
        }

        setSelectedDetailExec(updatedExecution);
    };

    // Restore Fully: Return fertilizers to warehouse stock and mark execution as reverted
    const handleRestoreExecution = (id: string) => {
        const exec = planExecutions.find(e => e.id === id);
        if (!exec) return;

        let newInventory = [...(inventoryItems || [])];
        let inventoryChanged = false;

        exec.actualElements.forEach(om => {
            const i = newInventory.findIndex(inv => inv.id === om.inventoryItemId || inv.name.toLowerCase() === (om.newItemName || '').toLowerCase());
            if (i !== -1) {
                newInventory[i].currentStock = Math.round((newInventory[i].currentStock + (om.stockDeduction ?? om.actualQuantity ?? om.quantity ?? 0)) * 100) / 100;
                inventoryChanged = true;
            }
        });

        if (inventoryChanged && onSetInventoryItems) {
            onSetInventoryItems(newInventory);
        }

        const editorName = currentUser?.name || currentUser?.firstName || currentUser?.email?.split('@')[0] || 'Administrator';
        const updatedExecutions = planExecutions.map(e => e.id === id ? {
            ...e,
            isReverted: true,
            revertedAt: new Date().toISOString(),
            revertedBy: editorName
        } : e);

        onSetPlanExecutions(updatedExecutions);
    };

    const handleDeleteExecution = (id: string) => {
        if (onDeletePlanExecution) {
            if (confirm("Are you sure you want to revert this execution? This will return the used materials to stock and remove the record.")) {
                const exec = planExecutions.find(e => e.id === id);
                if (exec && onSetInventoryItems) {
                    let newInventory = [...(inventoryItems || [])];
                    let inventoryChanged = false;
                    exec.actualElements.forEach(om => {
                        const i = newInventory.findIndex(inv => inv.id === om.inventoryItemId || inv.name.toLowerCase() === (om.newItemName || '').toLowerCase());
                        if (i !== -1) { 
                            newInventory[i].currentStock = Math.round((newInventory[i].currentStock + (om.stockDeduction ?? om.actualQuantity ?? om.quantity ?? 0)) * 100) / 100; 
                            inventoryChanged = true; 
                        }
                    });
                    if (inventoryChanged) onSetInventoryItems(newInventory);
                }
                onDeletePlanExecution(id);
            }
        }
    };

    return (
        <main className="flex-1 bg-slate-50 flex flex-col md:flex-row overflow-hidden h-full relative">
            {/* Sidebar Toggle (Mobile) */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden absolute top-4 right-4 z-[1005] p-3 bg-white border border-slate-200 rounded-2xl shadow-xl text-indigo-600"
            >
                {isSidebarOpen ? <XCircleIcon size={20} /> : <BeakerIcon size={20} />}
            </button>

            {/* Sidebar */}
            {isSidebarOpen && (
                <div className="fixed inset-0 md:relative md:inset-auto z-[1004] md:z-[1001] w-full md:w-[350px] lg:w-[400px] flex-shrink-0 border-r overflow-hidden flex flex-col bg-white">
                    <div className="p-6 border-b bg-white flex-shrink-0">
                        <div className="flex flex-col mb-6">
                            <h1 className="text-2xl font-black italic text-slate-900 tracking-tighter uppercase">
                                AGRONOMY <span className="text-indigo-600 not-italic">INTEL</span> / აგრონომია
                            </h1>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                                Precision Nutrition & Treatment Registry / კვება & მორწყვა
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <StatCard 
                                title="RECIPES / რეცეპტები" 
                                value={nutritionPlans.length} 
                                color="text-indigo-600" 
                                onAddToDashboard={onAddToDashboard ? () => onAddToDashboard({
                                    title: 'Agronomy Recipes',
                                    type: 'custom_stat',
                                    content: { value: nutritionPlans.length, label: 'Recipes' }
                                }) : undefined}
                            />
                            <StatCard 
                                title="CYCLES / ციკლები" 
                                value={planExecutions.length} 
                                color="text-emerald-600" 
                                onAddToDashboard={onAddToDashboard ? () => onAddToDashboard({
                                    title: 'Agronomy Cycles',
                                    type: 'custom_stat',
                                    content: { value: planExecutions.length, label: 'Cycles' }
                                }) : undefined}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={() => { setViewMode('ai_diagnostics'); setAiInitialTool('disease'); }} 
                                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                                title="AI Plant Disease Diagnostics, Document Comparison & Vision Suite"
                            >
                                <Leaf size={16} /> AI დიაგნოსტიკა & კლინიკა
                            </button>
                            <button 
                                onClick={() => { setEditingPlan(null); setIsPlanModalOpen(true); }} 
                                disabled={currentUser?.isGuest}
                                className="w-full px-4 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                title={currentUser?.isGuest ? "Verification required" : "Recipe Registry"}
                            >
                                <PlusCircleIcon size={16} /> Recipe Registry / რეცეპტები
                            </button>
                            <button 
                                onClick={() => { setEditingExec(null); setIsExecModalOpen(true); }} 
                                disabled={currentUser?.isGuest}
                                className="w-full px-4 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                title={currentUser?.isGuest ? "Verification required" : "Log Treatment"}
                            >
                                <PlusCircleIcon size={16} /> Log Treatment / მორწყვის ჩაწერა
                            </button>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button 
                                    onClick={() => {
                                        setScannerCategory('supplies');
                                        setScannerAction('charge');
                                        setIsScanModalOpen(true);
                                    }}
                                    className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-2xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                    title="Scan Agro-input QR codes to deduct or receive"
                                >
                                    <ScanLine size={14} className="text-emerald-600" />
                                    <span>სკანერი</span>
                                </button>
                                <button 
                                    onClick={() => setIsQrGenModalOpen(true)}
                                    className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-2xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                    title="Generate Quantity-based QR Codes for Agro-inputs"
                                >
                                    <QrCode size={14} className="text-indigo-600" />
                                    <span>QR შექმნა</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6 space-y-8 no-scrollbar">
                        {/* Recipe Registry Section */}
                        <section>
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Recipe Registry / რეცეპტების სია</h2>
                            <div className="space-y-3">
                                {nutritionPlans.map(plan => (
                                    <div key={plan.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-200 hover:bg-white transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-black shadow-sm group-hover:text-indigo-600 transition-colors flex-shrink-0">
                                                <BeakerIcon size={20}/>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-800 uppercase tracking-tight text-[11px] truncate">{plan.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{plan.elements.length} components / კომპონენტი</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setEditingPlan(plan); setIsPlanModalOpen(true); }} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-lg hover:shadow-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer">
                                            <PencilSquareIcon size={16} />
                                        </button>
                                    </div>
                                ))}
                                {nutritionPlans.length === 0 && <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest py-4">No recipes. / რეცეპტები არ არის.</p>}
                            </div>
                        </section>

                        {/* Recent History Section */}
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Recent History / ბოლო ისტორია</h2>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Click to view log / ნახვა</span>
                            </div>
                            <div className="space-y-3">
                                {planExecutions.slice(0, 15).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exec => {
                                    const plan = nutritionPlans.find(p => p.id === exec.planId);
                                    return (
                                        <div 
                                            key={exec.id} 
                                            onClick={() => { setSelectedDetailExec(exec); setIsDetailModalOpen(true); }}
                                            className={`p-4 rounded-2xl border flex justify-between items-center group cursor-pointer transition-all ${
                                                exec.isReverted
                                                    ? 'bg-amber-50/60 border-amber-200 opacity-75'
                                                    : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-indigo-200 hover:shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-sm flex-shrink-0 ${
                                                    exec.isReverted
                                                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                                        : 'bg-white border border-slate-200 text-emerald-500'
                                                }`}>
                                                    <CalendarDaysIcon size={20}/>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="font-black text-slate-800 uppercase tracking-tight text-[11px] truncate">
                                                            {plan?.name || 'Treatment'}
                                                        </p>
                                                        {exec.cycleFeedingNumber && (
                                                            <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[8px] font-black">
                                                                #{exec.cycleFeedingNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {new Date(exec.date).toLocaleDateString()}
                                                        {exec.isReverted && ' • Reverted / გაუქმებული'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => { setSelectedDetailExec(exec); setIsDetailModalOpen(true); }} 
                                                    className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm cursor-pointer"
                                                    title="View Details"
                                                >
                                                    <EyeIcon size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteExecution(exec.id)} 
                                                    className="p-1.5 bg-white border border-slate-200 text-red-400 hover:text-red-600 rounded-lg shadow-sm cursor-pointer"
                                                    title="Revert & Delete"
                                                >
                                                    <ArrowUturnLeftIcon size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {planExecutions.length === 0 && <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest py-4">No logs recorded yet. / ჩანაწერი არ არის.</p>}
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden h-full">
                <div className="p-4 md:p-8 flex-grow overflow-y-auto no-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex flex-wrap justify-between items-center gap-3">
                            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-xs">
                                <button 
                                    onClick={() => setViewMode('tanks')} 
                                    className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                                        viewMode === 'tanks' 
                                            ? 'bg-white text-indigo-600 shadow-md border border-slate-200/60' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <SparklesIcon size={14}/> 🚜 System Feeding & Tanks / სისტემური კვება & ავზები
                                </button>
                                <button 
                                    onClick={() => setViewMode('calendar')} 
                                    className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                                        viewMode === 'calendar' 
                                            ? 'bg-white text-indigo-600 shadow-md border border-slate-200/60' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <CalendarDaysIcon size={14}/> Calendar / კალენდარი
                                </button>
                                <button 
                                    onClick={() => setViewMode('list')} 
                                    className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                                        viewMode === 'list' 
                                            ? 'bg-white text-indigo-600 shadow-md border border-slate-200/60' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <BeakerIcon size={14}/> List View / სიის ხედი
                                </button>
                                <button 
                                    onClick={() => setIsClinicalLabOpen(true)} 
                                    className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-white shadow-sm active:scale-95"
                                    title="Open Bt Audit & Clinical Lab Modal"
                                >
                                    <SparklesIcon size={14}/> 🔬 Clinical Lab & Bt Audit / კლინიკური ლაბი & Bt აუდიტი
                                </button>

                                {/* Divider */}
                                <div className="h-6 w-px bg-slate-300 mx-1 hidden lg:block" />

                                {/* AI Diagnostics & Clinic Tab */}
                                <button 
                                    onClick={() => {
                                        setViewMode('ai_diagnostics');
                                    }} 
                                    className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                                        viewMode === 'ai_diagnostics' 
                                            ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/20' 
                                            : 'bg-emerald-100/80 hover:bg-emerald-200 text-emerald-900 border border-emerald-300/80'
                                    }`}
                                    title="AI Clinical Diagnostic, Document & Vision Suite"
                                >
                                    <Stethoscope size={14} className={viewMode === 'ai_diagnostics' ? 'text-white' : 'text-emerald-700'} />
                                    <span>🔬 AI დიაგნოსტიკა & კლინიკა</span>
                                </button>

                                {/* 4 Direct AI Tool Action Buttons matching Agri-Assistant Header */}
                                <div className="flex items-center gap-1 pl-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAiInitialTool('disease');
                                            setViewMode('ai_diagnostics');
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                            viewMode === 'ai_diagnostics' && aiInitialTool === 'disease'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200'
                                        }`}
                                        title="AI მცენარეთა დაავადებების დიაგნოსტიკა (Plant Disease Diagnostic)"
                                    >
                                        <Leaf size={12} className={viewMode === 'ai_diagnostics' && aiInitialTool === 'disease' ? 'text-white' : 'text-emerald-600'} />
                                        <span>დიაგნოსტიკა</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAiInitialTool('document');
                                            setViewMode('ai_diagnostics');
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                            viewMode === 'ai_diagnostics' && aiInitialTool === 'document'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200'
                                        }`}
                                        title="დოკუმენტების შედარება & ლაბორატორიული ტრენდები (Document Comparison)"
                                    >
                                        <FileText size={12} className={viewMode === 'ai_diagnostics' && aiInitialTool === 'document' ? 'text-white' : 'text-blue-600'} />
                                        <span className="hidden sm:inline">დოკუმენტები</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAiInitialTool('agro_image');
                                            setViewMode('ai_diagnostics');
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                            viewMode === 'ai_diagnostics' && aiInitialTool === 'agro_image'
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                                : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
                                        }`}
                                        title="აგრო ხედვა & ნიადაგის/ფოთლის ინსპექცია (Agro Vision)"
                                    >
                                        <Eye size={12} className={viewMode === 'ai_diagnostics' && aiInitialTool === 'agro_image' ? 'text-white' : 'text-purple-600'} />
                                        <span className="hidden sm:inline">ხედვა</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAiInitialTool('history');
                                            setViewMode('ai_diagnostics');
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                            viewMode === 'ai_diagnostics' && aiInitialTool === 'history'
                                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                                : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-200'
                                        }`}
                                        title="კლინიკური სწავლება, არქივი & კოლეგების გამოცდილება (Clinical Learning & Archive)"
                                    >
                                        <History size={12} className={viewMode === 'ai_diagnostics' && aiInitialTool === 'history' ? 'text-white' : 'text-amber-600'} />
                                        <span className="hidden sm:inline">სწავლება & არქივი</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="animate-fade-in">
                            {viewMode === 'tanks' ? (
                                <SystemFeedingTankMonitor
                                    currentUser={currentUser}
                                    nutritionPlans={nutritionPlans}
                                    planExecutions={planExecutions}
                                    onSetPlanExecutions={onSetPlanExecutions}
                                    inventoryItems={inventoryItems}
                                    onSetInventoryItems={onSetInventoryItems}
                                    sectors={sectors}
                                    employees={employees}
                                    onOpenExecutionDetail={(exec) => {
                                        setSelectedDetailExec(exec);
                                        setIsDetailModalOpen(true);
                                    }}
                                />
                            ) : viewMode === 'calendar' ? (
                                <div className="overflow-x-auto no-scrollbar -mx-4 md:mx-0">
                                    <div className="min-w-[700px] p-4 md:p-0">
                                        <CalendarView 
                                            currentDate={currentDate}
                                            setCurrentDate={setCurrentDate}
                                            planExecutions={planExecutions}
                                            nutritionPlans={nutritionPlans}
                                            onAddLog={(dateStr) => { setEditingExec({ date: dateStr } as any); setIsExecModalOpen(true); }}
                                            onEditExec={(exec) => { setEditingExec(exec); setIsExecModalOpen(true); }}
                                            onViewDetail={(exec) => { setSelectedDetailExec(exec); setIsDetailModalOpen(true); }}
                                            onDeleteExecution={handleDeleteExecution}
                                        />
                                    </div>
                                </div>
                            ) : viewMode === 'ai_diagnostics' ? (
                                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-2 sm:p-5">
                                    <AiAnalysisSuite
                                        mode="full"
                                        initialTool={aiInitialTool}
                                        activeOrgId={activeOrgId || (currentUser as any)?.currentOrganizationId || (currentUser as any)?.organizationId || (plantationFeatures[0] as any)?.organizationId || null}
                                        currentUser={currentUser}
                                        onAddTask={onAddTask}
                                        onAddNutritionPlan={(plan) => {
                                            onSetNutritionPlans([plan, ...(nutritionPlans || [])]);
                                        }}
                                    />
                                </div>
                            ) : (
                                <ListView 
                                    planExecutions={planExecutions}
                                    nutritionPlans={nutritionPlans}
                                    employees={employees}
                                    onEditExec={(exec) => { setEditingExec(exec); setIsExecModalOpen(true); }}
                                    onViewDetail={(exec) => { setSelectedDetailExec(exec); setIsDetailModalOpen(true); }}
                                    onDeleteExecution={handleDeleteExecution}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recipe Registry Modal */}
            {isPlanModalOpen && (
                <NutritionPlanModal
                    isOpen={isPlanModalOpen}
                    onClose={() => setIsPlanModalOpen(false)}
                    onSave={handleSavePlan}
                    plan={editingPlan}
                    materials={agronomyMaterials}
                />
            )}

            {/* Standard Plan Execution Modal */}
            {isExecModalOpen && (
                <PlanExecutionModal
                    isOpen={isExecModalOpen}
                    onClose={() => setIsExecModalOpen(false)}
                    onSave={handleSaveExecution}
                    execution={editingExec}
                    plans={nutritionPlans}
                    sectors={sectors}
                    employees={employees}
                    inventoryItems={inventoryItems}
                />
            )}

            {/* Detailed Execution Log & Audit Trail Pop-up Modal */}
            {isDetailModalOpen && (
                <ExecutionDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        setSelectedDetailExec(null);
                    }}
                    execution={selectedDetailExec}
                    plans={nutritionPlans}
                    sectors={sectors}
                    employees={employees}
                    inventoryItems={inventoryItems}
                    currentUser={currentUser}
                    onSaveExecution={handleSaveExecutionWithAudit}
                    onRestoreExecution={handleRestoreExecution}
                    onDeleteExecution={handleDeleteExecution}
                />
            )}

            {/* Agronomic Clinical Lab & Historical Bt Audit Modal */}
            <AgronomicClinicalLabModal
                isOpen={isClinicalLabOpen}
                onClose={() => setIsClinicalLabOpen(false)}
                activeOrgId={(currentUser as any)?.currentOrganizationId || (currentUser as any)?.organizationId || (plantationFeatures[0] as any)?.organizationId || null}
                currentUser={currentUser}
                isSystemAdmin={Boolean((currentUser as any)?.isSystemAdmin || currentUser?.role === 'system_admin')}
                isKa={true}
            />
            
            {/* Agronomy Universal Scanner Modal */}
            {isScanModalOpen && (
                <QrScannerModal
                    isOpen={isScanModalOpen}
                    onClose={() => setIsScanModalOpen(false)}
                    onScan={handleAgroScan}
                    initialCategory={scannerCategory}
                    initialAction={scannerAction}
                    mockEmployees={employees}
                    inventoryItems={inventoryItems}
                    onOpenGenerator={() => setIsQrGenModalOpen(true)}
                    title="აგრონომიის QR / შტრიხკოდის სკანერი"
                    description="დაასკანერეთ სასუქების, პესტიციდების და აგრო-ინპუტების QR კოდები"
                />
            )}

            {/* Agro-Input QR Code Generator Modal */}
            {isQrGenModalOpen && (
                <MaterialQrGeneratorModal
                    isOpen={isQrGenModalOpen}
                    onClose={() => setIsQrGenModalOpen(false)}
                    inventoryItems={agronomyMaterials.length > 0 ? agronomyMaterials : inventoryItems}
                    defaultCategory="supplies"
                />
            )}
            
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </main>
    );
};

export default AgronomyView;
