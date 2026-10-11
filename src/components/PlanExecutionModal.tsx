import React, { useState, useEffect, useMemo } from 'react';
import type { PlanExecution, NutritionPlan, AreaPlantationFeature, Employee, PlanExecutionElement, InventoryItem } from '../types';
import { XCircleIcon, BeakerIcon, AlertTriangleIcon, ChartBarIcon } from './Icons';
import { getSphericalPolygonArea } from '../services/geospatialService';
import { useLanguage } from '../contexts/LanguageContext';
import { getAgronomyEligibleEmployees } from '../utils/employeeFilters';
import { ScanLine } from 'lucide-react';
import QrScannerModal from './QrScannerModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { findMatchingEmployee } from '../utils/employeeMatching';
import { toast } from 'sonner';

interface PlanExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (execution: PlanExecution) => void;
    execution: PlanExecution | null;
    plans: NutritionPlan[];
    sectors: AreaPlantationFeature[];
    employees: Employee[];
    inventoryItems: InventoryItem[];
}

const PlanExecutionModal: React.FC<PlanExecutionModalProps> = ({ isOpen, onClose, onSave, execution, plans, sectors, employees, inventoryItems }) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [formState, setFormState] = useState<Omit<PlanExecution, 'id'>>({
        planId: execution?.planId || '',
        date: execution?.date ? new Date(execution.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        sectorIds: execution?.sectorIds || [],
        executedByEmployeeId: execution?.executedByEmployeeId || undefined,
        actualElements: execution?.actualElements || [],
        actualWaterLiters: execution?.actualWaterLiters || 0,
        notes: execution?.notes || '',
    });

    const handleScanResult = (result: string, category?: any, parsedData?: any) => {
        const code = result.trim();
        if (!code) return;
        const parsed = parsedData || parseUniversalScan(code, employees, inventoryItems, 'supplies', 'charge');
        setIsScannerOpen(false);

        // 1. Material detected
        if (parsed.detectedType === 'material' || parsed.material) {
            const mat = parsed.material?.item || inventoryItems.find(i => 
                i.id === code || (i as any).sku === code || (i as any).barcode === code
            );
            if (mat) {
                const qty = parsed.material?.quantity || 1;
                const existingIdx = (formState.actualElements || []).findIndex(el => el.inventoryItemId === mat.id);
                if (existingIdx >= 0) {
                    const list = [...formState.actualElements];
                    const currentActual = list[existingIdx].actualQuantity !== undefined ? list[existingIdx].actualQuantity! : list[existingIdx].quantity;
                    list[existingIdx] = {
                        ...list[existingIdx],
                        actualQuantity: currentActual + qty
                    };
                    setFormState(prev => ({ ...prev, actualElements: list }));
                    toast.success(isKa ? `✓ დოზა გაიზარდა: +${qty} (${mat.name})` : `✓ Added dose: +${qty} (${mat.name})`);
                } else {
                    const defaultUnit = (mat.unitOfMeasure === 'L' || mat.unitOfMeasure === 'liter' || mat.unitOfMeasure === 'litre') ? 'L/ha' : 'kg/ha';
                    const newEl: PlanExecutionElement = {
                        inventoryItemId: mat.id,
                        newItemName: mat.name,
                        quantity: qty,
                        actualQuantity: qty,
                        unit: defaultUnit
                    };
                    setFormState(prev => ({ ...prev, actualElements: [...(prev.actualElements || []), newEl] }));
                    toast.success(isKa ? `✓ დაემატა აგრო-ინპუტი: ${mat.name}` : `✓ Added agro-input: ${mat.name}`);
                }
                return;
            }
        }

        // 2. Personnel / Agronomist detected
        if (parsed.detectedType === 'worker' || parsed.employee) {
            const emp = parsed.employee || findMatchingEmployee(employees, code);
            if (emp) {
                setFormState(prev => ({ ...prev, executedByEmployeeId: emp.id }));
                toast.success(isKa ? `✓ შემსრულებელი: ${emp.name}` : `✓ Agronomist: ${emp.name}`);
                return;
            }
        }

        toast.warning(isKa ? `კოდი ვერ მოიძებნა: ${code}` : `Unrecognized scan code: ${code}`);
    };

    useEffect(() => {
        if (formState.planId && !execution) {
            const selectedPlan = plans.find(p => p.id === formState.planId);
            if (selectedPlan) {
                setFormState(prev => ({
                    ...prev,
                    actualElements: (selectedPlan.elements || []).map(el => ({ 
                        ...el, 
                        actualQuantity: el.quantity,
                        actualEC: selectedPlan.targetEC,
                        actualPH: selectedPlan.targetPH,
                     })),
                    actualWaterLiters: selectedPlan.targetWaterLiters || 0,
                }));
            }
        }
    }, [formState.planId, execution, plans]);

    const eligibleEmployees = useMemo(() => getAgronomyEligibleEmployees(employees), [employees]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.currentTarget;
        setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };
    
    const toggleSector = (id: string) => {
        setFormState(prev => {
            const current = prev.sectorIds || [];
            const newIds = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
            return { ...prev, sectorIds: newIds };
        });
    };

    const handleElementChange = (index: number, field: keyof PlanExecutionElement, value: string | number | undefined) => {
        const newElements = [...formState.actualElements];
        (newElements[index] as any)[field] = value;
        setFormState(prev => ({ ...prev, actualElements: newElements }));
    };

    const totalAreaHa = useMemo(() => {
        return formState.sectorIds.reduce((totalArea, sectorId) => {
            const sector = sectors.find(f => f.id === sectorId);
            if (sector && sector.geometry) {
                try {
                    return totalArea + (getSphericalPolygonArea(sector.geometry) / 10000);
                } catch (e) { return totalArea; }
            }
            return totalArea;
        }, 0);
    }, [formState.sectorIds, sectors]);

    const waterUsedTons = (formState.actualWaterLiters || 0) / 1000;

    const calculationData = useMemo(() => {
        return (formState.actualElements || []).map(el => {
            const material = inventoryItems.find(i => i.id === el.inventoryItemId);
            const rate = el.actualQuantity || 0;
            const unit = el.unit || 'kg/ha';
            
            let totalConsumption = 0; 
            let basis = '';

            if (unit.includes('/ha')) {
                totalConsumption = rate * totalAreaHa;
                basis = isKa ? `ფართობი (${totalAreaHa.toFixed(2)} ჰა)` : `Area (${totalAreaHa.toFixed(2)} ha)`;
            } else if (unit.includes('/1000L') || unit.includes('/ton')) {
                totalConsumption = rate * waterUsedTons;
                basis = isKa ? `წყალი (${waterUsedTons.toFixed(2)} ტონა)` : `Water (${waterUsedTons.toFixed(2)} tons)`;
            } else {
                totalConsumption = rate;
                basis = isKa ? 'ფიქსირებული ჯამი' : 'Fixed Total';
            }
            
            // Normalize Total to Standard Units (kg / L)
            let consumptionInBase = totalConsumption;
            const lowerUnit = unit.toLowerCase();
            if (lowerUnit.startsWith('g') || lowerUnit.startsWith('ml')) consumptionInBase /= 1000;
            else if (lowerUnit.startsWith('mg')) consumptionInBase /= 1000000;

            let stockDeduction = consumptionInBase;
            let stockUnit = material?.unitOfMeasure || (isKa ? 'ერთეული' : 'unit');
            let warning = null;

            const isContainer = (material?.packageContent && material.packageContent > 0) || ['bag', 'bags', 'box', 'boxes', 'sack', 'sacks', 'bottle', 'bottles', 'can', 'drum', 'drums', 'pallet', 'unit', 'pcs', 'pkg', 'pkgs', 'package', 'packages'].includes(stockUnit.toLowerCase());

            if (isContainer && material?.packageContent && material.packageContent > 0) {
                let contentSize = material.packageContent;
                const contentUnit = (material.packageContentUnit || 'kg').toLowerCase();
                if (contentUnit === 'g' || contentUnit === 'ml') contentSize /= 1000;
                else if (contentUnit === 'mg') contentSize /= 1000000;
                
                stockDeduction = consumptionInBase / contentSize;
            } else if (isContainer) {
                warning = isKa ? "შეფუთვის ზომა მითითებული არაა. ჩამოიწერება 1:1" : "Unit Size not set. Deducting 1:1";
                stockDeduction = totalConsumption; 
            } else {
                if (stockUnit.toLowerCase() === 'g' || stockUnit.toLowerCase() === 'ml') stockDeduction = consumptionInBase * 1000;
                else if (stockUnit.toLowerCase() === 'mg') stockDeduction = consumptionInBase * 1000000;
                else stockDeduction = consumptionInBase;
            }

            const currentStock = material?.currentStock || 0;
            const remainingStock = currentStock - stockDeduction;
            const isInsufficient = remainingStock < 0;
            const estimatedCost = stockDeduction * (material?.unitCost || 0);

            return {
                name: material?.name || el.newItemName || (isKa ? 'უცნობი მასალა' : 'Unknown'),
                stock: material ? `${material.currentStock.toFixed(2)} ${material.unitOfMeasure}` : 'N/A',
                dose: `${rate} ${unit}`,
                basis,
                totalConsumptionDisplay: `${totalConsumption.toFixed(2)} ${unit.split('/')[0]}`,
                stockDeductionDisplay: `${stockDeduction.toFixed(2)} ${stockUnit}`,
                stockDeduction,
                remainingStockDisplay: material ? `${remainingStock.toFixed(2)} ${stockUnit}` : 'N/A',
                isInsufficient,
                warning,
                estimatedCost
            };
        });
    }, [formState.actualElements, inventoryItems, totalAreaHa, waterUsedTons, isKa]);

    const totalEstimatedCost = calculationData.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalElements = formState.actualElements.map((el, i) => ({
            ...el,
            stockDeduction: calculationData[i]?.stockDeduction || el.actualQuantity || el.quantity || 0
        }));
        onSave({ id: execution?.id || '', ...formState, actualElements: finalElements });
    };

    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-gray-100 z-[5000] flex flex-col overflow-hidden">
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-2xl text-emerald-700">
                        <BeakerIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                            {execution 
                                ? (isKa ? 'შესრულების ჟურნალის რედაქტირება' : 'Edit Execution Log') 
                                : (isKa ? 'გეგმის შესრულების აღრიცხვა' : 'Log Plan Execution')}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            {isKa 
                                ? 'ფაქტობრივი გამოყენების აღრიცხვა და საწყობიდან ავტომატური ჩამოწერა' 
                                : 'Record actual usage for automated inventory deduction'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                        title={isKa ? "აგრო-ინპუტის QR / შტრიხკოდის სკანირება" : "Scan Agro-Input QR / Barcode"}
                    >
                        <ScanLine className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{isKa ? 'QR სკანერი' : 'Scan QR'}</span>
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors cursor-pointer">
                        <XCircleIcon className="h-8 w-8 md:h-6 md:w-6" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row min-h-0">
                <form id="execution-form" onSubmit={handleSubmit} className="flex-shrink-0 md:flex-1 md:overflow-y-auto p-6 md:p-8 space-y-8 bg-white md:mr-1 min-h-0">
                    <section>
                        <h3 className="text-sm font-black text-slate-900 mb-4 pb-2 border-b uppercase tracking-wider">
                            {isKa ? '1. კონფიგურაცია' : '1. Configuration'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isKa ? 'აირჩიეთ რეცეპტი (გეგმა)' : 'Select Recipe (Plan)'} <span className="text-rose-500">*</span>
                                </label>
                                <select name="planId" value={formState.planId} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer" required>
                                    <option value="">-- {isKa ? 'აირჩიეთ რეცეპტი' : 'Select Recipe'} --</option>
                                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isKa ? 'თარიღი' : 'Date'} <span className="text-rose-500">*</span>
                                </label>
                                <input name="date" type="date" value={formState.date} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none" required />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isKa ? 'დამუშავებული სექტორები' : 'Sectors Applied'} <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border border-slate-200 p-3 rounded-xl bg-slate-50 max-h-40 overflow-y-auto">
                                    {sectors.map(s => (
                                         <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                                            <input 
                                                type="checkbox" 
                                                checked={formState.sectorIds.includes(s.id)} 
                                                onChange={() => toggleSector(s.id)} 
                                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                            />
                                            <span className="text-xs font-bold text-slate-800">{s.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-indigo-600 mt-1.5 font-bold italic">
                                    {isKa ? `ჯამური ფართობი: ${totalAreaHa.toFixed(2)} ჰა` : `Total Calculated Area: ${totalAreaHa.toFixed(2)} ha`}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isKa ? 'გამოყენებული წყალი (ლიტრი)' : 'Total Water Used (Liters)'}
                                </label>
                                <div className="relative">
                                    <input name="actualWaterLiters" type="number" value={formState.actualWaterLiters} onChange={handleChange} className="w-full p-2.5 pl-4 pr-16 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono font-bold" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">{isKa ? 'ლ' : 'Liters'}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center justify-between mb-4 pb-2 border-b">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                {isKa ? '2. დოზები და ინგრედიენტები' : '2. Doses & Ingredients'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsScannerOpen(true)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                title={isKa ? "აგრო-ინპუტის QR / შტრიხკოდის სკანირება" : "Scan Agro-Input QR / Barcode"}
                            >
                                <ScanLine className="h-3.5 w-3.5 text-emerald-400" />
                                <span>{isKa ? 'Scan Agro-Input QR / შტრიხკოდი' : 'Scan Agro-Input QR'}</span>
                            </button>
                        </div>
                        <div className="space-y-4">
                            {(formState.actualElements || []).map((el, index) => {
                                const material = inventoryItems.find(i => i.id === el.inventoryItemId);
                                return (
                                    <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center gap-4">
                                        <div className="flex-1 w-full">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isKa ? 'სასუქი / პრეპარატი' : 'Material'}</label>
                                            <div className="font-black text-slate-900 text-sm">{material?.name || el.newItemName}</div>
                                            <div className="text-xs text-slate-500 font-semibold">{material?.category}</div>
                                        </div>
                                        <div className="w-full md:w-36">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isKa ? 'ფაქტობრივი დოზა' : 'Actual Dose'}</label>
                                            <input type="number" step="0.01" value={el.actualQuantity} onChange={e => handleElementChange(index, 'actualQuantity', parseFloat(e.currentTarget.value) || 0)} className="w-full p-2 border border-slate-300 rounded-xl font-black text-center text-xs bg-white focus:ring-2 focus:ring-emerald-500" />
                                        </div>
                                        <div className="w-full md:w-44">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isKa ? 'ერთეული / ბაზა' : 'Unit / Basis'}</label>
                                            <div className="p-2 bg-slate-200/80 rounded-xl text-xs text-slate-700 font-mono font-bold text-center">{el.unit}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-sm font-black text-slate-900 mb-4 pb-2 border-b uppercase tracking-wider">
                            {isKa ? '3. ოპერაციის დეტალები' : '3. Operation Details'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isKa ? 'შემსრულებელი (აგრონომი / პერსონალი)' : 'Executed By'}
                                </label>
                                <select name="executedByEmployeeId" value={formState.executedByEmployeeId || ''} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-800 cursor-pointer">
                                    <option value="">{isKa ? 'აირჩიეთ პერსონალი' : 'Select Agronomist / Manager'}</option>
                                    {eligibleEmployees.map(e => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} {e.role ? `(${e.role})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isKa ? 'შენიშვნები' : 'Operational Notes'}
                                </label>
                                <textarea name="notes" value={formState.notes} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium" rows={2} placeholder={isKa ? "დაკვირვებები ან შენიშვნები..." : "Any deviations or observations..."}></textarea>
                            </div>
                        </div>
                    </section>
                </form>

                <div className="w-full md:w-[420px] bg-slate-900 text-white p-6 md:p-8 flex flex-col shadow-2xl flex-shrink-0 min-h-0">
                    <div className="flex items-center gap-2 mb-1">
                         <ChartBarIcon className="h-5 w-5 text-emerald-400" />
                         <h3 className="text-lg font-black text-emerald-400">{isKa ? 'ჩამოწერის წინასწარი გადახედვა' : 'Consumption Preview'}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-6 font-medium">
                        {isKa ? 'საწყობის ცვლილება რეალურ დროში ფართობისა და დოზის მიხედვით.' : 'Real-time inventory deduction based on area and dosing.'}
                    </p>

                    <div className="space-y-4 md:flex-1 md:overflow-y-auto pr-2 md:custom-scrollbar mb-6 md:mb-0">
                        {calculationData.map((item, idx) => (
                            <div key={idx} className={`bg-slate-800/90 p-4 rounded-2xl border ${item.isInsufficient ? 'border-rose-500 bg-rose-950/30' : 'border-slate-700'} relative transition-all`}>
                                {item.isInsufficient && (
                                    <div className="absolute top-2 right-2 text-rose-300 text-[9px] font-black uppercase flex items-center gap-1 bg-rose-900/80 px-2 py-0.5 rounded-lg">
                                        <AlertTriangleIcon className="h-3 w-3" /> {isKa ? 'არასაკმარისი ნაშთი' : 'Insufficient Stock'}
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 pr-16">
                                        <span className="font-black text-sm block truncate text-white">{item.name}</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">{isKa ? 'ნაშთი:' : 'Stock:'} {item.stock}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs mb-3 border-t border-slate-700 pt-2">
                                    <div>
                                        <div className="text-slate-400 text-[9px] uppercase font-black tracking-wider">{isKa ? 'საჭირო რაოდენობა' : 'Required'}</div>
                                        <div className="font-mono text-indigo-400 font-bold">{item.totalConsumptionDisplay}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-slate-400 text-[9px] uppercase font-black tracking-wider">{isKa ? 'ჩამოწერა' : 'Impact'}</div>
                                        <div className="font-mono text-emerald-400 font-bold">-{item.stockDeductionDisplay}</div>
                                    </div>
                                </div>
                                <div className="border-t border-slate-700 pt-2.5 flex justify-between items-center">
                                    <span className={`font-bold text-xs ${item.isInsufficient ? 'text-rose-400' : 'text-slate-300'}`}>
                                        {isKa ? 'დარჩება:' : 'Remaining:'} {item.remainingStockDisplay}
                                    </span>
                                    <span className="text-amber-400 font-black text-sm">{formatCurrency(item.estimatedCost)}</span>
                                </div>
                                {item.warning && <p className="text-[10px] text-amber-400 mt-2 italic font-semibold">* {item.warning}</p>}
                            </div>
                        ))}
                        {calculationData.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                                <BeakerIcon className="h-10 w-10 mb-2 opacity-30" />
                                <p className="text-xs font-bold">{isKa ? 'აირჩიეთ რეცეპტი მონაცემების სანახავად' : 'Select a recipe to view impact'}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-700 flex flex-col gap-4">
                        <div className="flex justify-between items-center text-lg font-black text-amber-400">
                            <span className="uppercase text-xs tracking-wider">{isKa ? 'ჯამური ღირებულება' : 'TOTAL COST'}</span>
                            <span>{formatCurrency(totalEstimatedCost)}</span>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-wider cursor-pointer">
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button type="submit" form="execution-form" className="flex-[2] py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all font-black shadow-xl shadow-emerald-950/40 text-xs uppercase tracking-wider cursor-pointer">
                                {isKa ? 'შესრულების დადასტურება' : 'Confirm Log'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isScannerOpen && (
                <QrScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    onScan={handleScanResult}
                    mockEmployees={employees}
                    inventoryItems={inventoryItems}
                    initialCategory="supplies"
                    title={isKa ? "აგრო-ინპუტების სკანერი (სასუქები, პრეპარატები)" : "Agro-Input Scanner (Fertilizers, Chemicals)"}
                    description={isKa ? "დაასკანირეთ აგრო-ინპუტის შეფუთვის QR ან შტრიხკოდი" : "Scan agro-input container QR or barcode to log dosage"}
                />
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
            `}</style>
        </div>
    );
};

export default PlanExecutionModal;
