import React, { useState } from 'react';
import type { InventoryItem, SubStock } from '../types';
import { XCircleIcon } from './Icons';
import { QrCode, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import MaterialQrGeneratorModal from './MaterialQrGeneratorModal';

interface StockItemModalProps {
    item: InventoryItem | null;
    onSave: (item: InventoryItem) => void;
    onClose: () => void;
    subStocks?: SubStock[];
    customCategories?: string[];
    onAddCustomCategory?: (category: string) => void;
}

const StockItemModal: React.FC<StockItemModalProps> = ({ 
    item, 
    onSave, 
    onClose, 
    subStocks = [], 
    customCategories = [],
    onAddCustomCategory 
}) => {
    const { t, language } = useLanguage();
    const isKa = language === 'ka';

    const [isBatchQrOpen, setIsBatchQrOpen] = useState(false);
    const [machineryDetails, setMachineryDetails] = useState(item?.machineryDetails || { ownership: "owned", vehicleCategory: "passenger", passengerCapacity: undefined, cargoPurpose: "", payloadCapacity: undefined, enginePower: "", toolCategory: "", baseCostRate: undefined, foremanId: "" } as any);
    const [showNewCatInput, setShowNewCatInput] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [formState, setFormState] = useState<Omit<InventoryItem, 'id'>>({
        name: item?.name || '',
        sku: item?.sku || '',
        category: item?.category || 'Other',
        description: item?.description || '',
        unitOfMeasure: item?.unitOfMeasure || 'pcs',
        currentStock: item?.currentStock || 0,
        minStockThreshold: item?.minStockThreshold || 0,
        location: item?.location || '',
        subStockId: item?.subStockId || undefined,
        subStockName: item?.subStockName || undefined,
        unitCost: item?.unitCost || 0,
        supplierId: item?.supplierId || '',
        avgTareWeightKg: item?.avgTareWeightKg || undefined,
        packageContent: item?.packageContent || undefined,
        packageContentUnit: item?.packageContentUnit || undefined,
        seedInfo: item?.seedInfo || undefined,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let finalValue: any = value;
        if (type === 'number') {
            finalValue = value === '' ? '' : parseFloat(value);
        }
        setFormState(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Custom Validation Rule: Mandatory mass/vol for Chemicals
        if (['Fertilizers', 'Pesticides'].includes(formState.category)) {
            if (!formState.packageContent || !formState.packageContentUnit) {
                alert(isKa ? "აგროქიმიკატებისთვის 'რაოდენობა ერთეულში' და 'საზომი ერთეული' (მაგ. 25 კგ) სავალდებულოა რეცეპტის გამოთვლებისთვის." : "For agro-chemicals, 'Content per Unit' and 'Content Unit' (e.g., 25 kg) are mandatory for automated recipe calculations.");
                return;
            }
        }

        const payload: InventoryItem = {
            id: item?.id || '',
            ...formState,
            currentStock: (formState.currentStock as any) === '' ? 0 : Number(formState.currentStock),
            minStockThreshold: (formState.minStockThreshold as any) === '' ? 0 : Number(formState.minStockThreshold),
            unitCost: (formState.unitCost as any) === '' ? 0 : Number(formState.unitCost),
            packageContent: (formState.packageContent as any) === '' ? undefined : (formState.packageContent !== undefined ? Number(formState.packageContent) : undefined),
            avgTareWeightKg: (formState.avgTareWeightKg as any) === '' ? undefined : (formState.avgTareWeightKg !== undefined ? Number(formState.avgTareWeightKg) : undefined),
        } as InventoryItem;

        if (formState.category === 'Machinery') {
            payload.machineryDetails = {
                ownership: machineryDetails.ownership || 'owned',
                vehicleCategory: machineryDetails.vehicleCategory || 'passenger',
                passengerCapacity: machineryDetails.passengerCapacity ? Number(machineryDetails.passengerCapacity) : undefined,
                cargoPurpose: machineryDetails.cargoPurpose || '',
                payloadCapacity: machineryDetails.payloadCapacity ? Number(machineryDetails.payloadCapacity) : undefined,
                enginePower: machineryDetails.enginePower || '',
                baseCostRate: machineryDetails.baseCostRate ? Number(machineryDetails.baseCostRate) : undefined,
            };
        }

        onSave(payload);
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4 backdrop-blur-xs" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-base md:text-lg font-black tracking-tight">
                            {item ? (isKa ? 'სასაწყობე ნივთის რედაქტირება' : 'Edit Stock Item') : (isKa ? 'ახალი სასაწყობე ნივთის დამატება' : 'Add Stock Item')}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {isKa ? 'სასაწყობე ნივთის სპეციფიკაციები და შეფუთვის მოცულობა' : 'Warehouse inventory item specifications and unit capacity'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs max-h-[72vh] overflow-y-auto">
                        <div className="space-y-4">
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    {isKa ? 'დასახელება' : 'Item Name'} <span className="text-rose-500">*</span>
                                </label>
                                <input name="name" value={formState.name} onChange={handleChange} className="input-field" placeholder={isKa ? "მაგ. კალიუმის სულფატი..." : "e.g. Potassium Sulphate..."} required />
                            </div>
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    {isKa ? 'საარტიკულო კოდი / SKU' : 'SKU / Barcode'}
                                </label>
                                <input name="sku" value={formState.sku} onChange={handleChange} className="input-field" placeholder={isKa ? "მაგ. FERT-001" : "e.g. FERT-001"} />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-slate-700 block">
                                        {isKa ? 'კატეგორია' : 'Category'} <span className="text-rose-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewCatInput(!showNewCatInput)}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>{isKa ? '+ ახალი კატეგორია' : '+ New Category'}</span>
                                    </button>
                                </div>

                                {showNewCatInput && (
                                    <div className="flex items-center gap-1.5 mb-2 p-2 bg-blue-50 rounded-xl border border-blue-200">
                                        <input
                                            type="text"
                                            value={newCatName}
                                            onChange={(e) => setNewCatName(e.target.value)}
                                            placeholder={isKa ? 'შეიყვანეთ ახალი კატეგორია...' : 'Enter category name...'}
                                            className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (newCatName.trim()) {
                                                    const trimmed = newCatName.trim();
                                                    onAddCustomCategory?.(trimmed);
                                                    setFormState(prev => ({ ...prev, category: trimmed as any }));
                                                    setNewCatName('');
                                                    setShowNewCatInput(false);
                                                }
                                            }}
                                            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
                                        >
                                            {isKa ? 'დამატება' : 'Add'}
                                        </button>
                                    </div>
                                )}

                                <select name="category" value={formState.category} onChange={handleChange} className="input-field" required>
                                    <option value="Uncategorized">⚠️ {isKa ? 'უკატეგორიო ნივთები (დალაგებამდე)' : 'Uncategorized (Pending)'}</option>
                                    <optgroup label={isKa ? "🌱 აგროინპუტები" : "🌱 Agroinputs"}>
                                        <option value="Fertilizers">{isKa ? 'სასუქები' : 'Fertilizers'}</option>
                                        <option value="Pesticides">{isKa ? 'პესტიციდები' : 'Pesticides'}</option>
                                        <option value="Chemicals">{isKa ? 'ქიმიკატები' : 'Chemicals'}</option>
                                        <option value="Bio-stimulants">{isKa ? 'ბიოსტიმულატორები' : 'Bio-stimulants'}</option>
                                        <option value="Seeds">{isKa ? 'თესლები-ნერგები' : 'Seeds'}</option>
                                    </optgroup>
                                    <optgroup label={isKa ? "📦 მარაგები და მასალები" : "📦 Supplies & Materials"}>
                                        <option value="Packaging">{isKa ? 'შეფუთვა და ყუთები' : 'Packaging'}</option>
                                        <option value="Pallets">{isKa ? 'პალეტები' : 'Pallets'}</option>
                                        <option value="Fuel">{isKa ? 'საწვავი' : 'Fuel'}</option>
                                        <option value="Spare Parts">{isKa ? 'სათადარიგო ნაწილები' : 'Spare Parts'}</option>
                                        <option value="Construction">{isKa ? 'სამშენებლო მასალები' : 'Construction'}</option>
                                        <option value="Consumables">{isKa ? 'სახარჯი მასალები' : 'Consumables'}</option>
                                        <option value="Tools">{isKa ? 'ხელსაწყოები' : 'Tools'}</option>
                                        <option value="Other">{isKa ? 'სხვა (Other)' : 'Other'}</option>
                                    </optgroup>
                                    <optgroup label={isKa ? "🚜 ტექნიკა და აქტივები" : "🚜 Machinery & Assets"}>
                                        <option value="Machinery">{isKa ? 'ტექნიკა' : 'Machinery'}</option>
                                        <option value="Fixed Assets">{isKa ? 'ძირითადი აქტივები' : 'Fixed Assets'}</option>
                                    </optgroup>
                                    {customCategories.length > 0 && (
                                        <optgroup label={isKa ? "🏷️ მორგებული კატეგორიები" : "🏷️ Custom Categories"}>
                                            {customCategories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    {isKa ? 'საწყობის ლოკაცია' : 'Warehouse Location'}
                                </label>
                                {subStocks.length > 0 ? (
                                    <select
                                        value={formState.subStockId || (formState.location === 'main' ? 'main' : formState.location || 'main')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'main') {
                                                setFormState(prev => ({
                                                    ...prev,
                                                    subStockId: undefined,
                                                    subStockName: undefined,
                                                    location: isKa ? 'მთავარი საწყობი' : 'Main Warehouse'
                                                }));
                                            } else {
                                                const sub = subStocks.find(s => s.id === val);
                                                setFormState(prev => ({
                                                    ...prev,
                                                    subStockId: val,
                                                    subStockName: sub?.name,
                                                    location: sub?.name || val
                                                }));
                                            }
                                        }}
                                        className="input-field cursor-pointer"
                                    >
                                        <option value="main">{isKa ? 'მთავარი ცენტრალური საწყობი' : 'Main Central Warehouse'}</option>
                                        {subStocks.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input name="location" value={formState.location} onChange={handleChange} className="input-field" placeholder={isKa ? "მაგ. მთავარი საწყობი" : "e.g. Central Depot"} />
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    {isKa ? 'საზომი ერთეული' : 'Unit of Measure'} <span className="text-rose-500">*</span>
                                </label>
                                <input list="units-of-measure" name="unitOfMeasure" value={formState.unitOfMeasure} onChange={handleChange} className="input-field" placeholder={isKa ? "ტომარა, კგ, ლიტრი, ცალი..." : "bag, kg, L, pcs..."} required />
                                <datalist id="units-of-measure">
                                    <option value="bag">{isKa ? 'ტომარა' : 'bag'}</option>
                                    <option value="bottle">{isKa ? 'ბოთლი' : 'bottle'}</option>
                                    <option value="can">{isKa ? 'კანისტრა' : 'can'}</option>
                                    <option value="box">{isKa ? 'ყუთი' : 'box'}</option>
                                    <option value="kg">{isKa ? 'კგ' : 'kg'}</option>
                                    <option value="L">{isKa ? 'ლიტრი' : 'L'}</option>
                                    <option value="pcs">{isKa ? 'ცალი' : 'pcs'}</option>
                                    <option value="unit">{isKa ? 'ერთეული' : 'unit'}</option>
                                </datalist>
                            </div>
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    {isKa ? 'მიმდინარე ნაშთი' : 'Current Stock'} <span className="text-rose-500">*</span>
                                </label>
                                <input name="currentStock" type="number" step="any" value={formState.currentStock} onChange={handleChange} className="input-field font-black text-slate-900" required />
                            </div>
                            
                            {/* Calculation Display */}
                            {formState.packageContent && Number(formState.packageContent) > 0 && (
                                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in zoom-in duration-300">
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">
                                        {isKa ? 'მთლიანი გამოთვლილი მასა / მოცულობა' : 'Total Calculated Balance'}
                                    </p>
                                    <p className="text-lg font-black text-indigo-700 tracking-tight">
                                        {((Number(formState.currentStock) || 0) * Number(formState.packageContent)).toLocaleString()} {formState.packageContentUnit || ''}
                                    </p>
                                    <p className="text-[9px] font-bold text-indigo-400 uppercase italic">
                                        {isKa ? 'გამოთვლილია:' : 'Calculated:'} {formState.currentStock} {formState.unitOfMeasure} × {formState.packageContent} {formState.packageContentUnit}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    {isKa ? 'მინიმალური ზღვარი' : 'Min Stock Threshold'}
                                </label>
                                <input name="minStockThreshold" type="number" step="any" value={formState.minStockThreshold} onChange={handleChange} className="input-field" required />
                            </div>
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                    {isKa ? 'ერთეულის ფასი' : 'Unit Cost'} <span className="text-rose-500">*</span>
                                </label>
                                <input name="unitCost" type="number" step="0.01" value={formState.unitCost} onChange={handleChange} className="input-field font-black text-emerald-700" required />
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4 pt-2 border-t border-slate-100">
                            {['Fertilizers', 'Pesticides', 'Chemicals'].includes(formState.category) && (
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                                    <h4 className="font-black text-emerald-900 text-xs uppercase tracking-wide mb-1">
                                        {isKa ? 'შეფუთვის მოცულობა (სავალდებულო)' : 'Unit Capacity & Package Content (Mandatory)'}
                                    </h4>
                                    <p className="text-[10px] text-emerald-700 mb-3">
                                        {isKa ? 'გამოიყენება აგრონომების მიერ ავტომატური რეცეპტური ჩამოწერისთვის (მაგ. 1 ტომარა = 25 კგ).' : 'Used for automated recipe deductions by agronomists (e.g. 1 bag = 25 kg).'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="font-bold text-[11px] text-emerald-900 block mb-1">{isKa ? 'რაოდენობა ერთეულში' : 'Content per Unit'}</label>
                                            <input name="packageContent" type="number" step="0.01" value={formState.packageContent || ''} onChange={handleChange} className="input-field" placeholder={isKa ? "მაგ. 25" : "e.g. 25"} required />
                                        </div>
                                        <div>
                                            <label className="font-bold text-[11px] text-emerald-900 block mb-1">{isKa ? 'საზომი ერთეული' : 'Content Unit'}</label>
                                            <select name="packageContentUnit" value={formState.packageContentUnit || ''} onChange={handleChange} className="input-field" required>
                                                <option value="">{isKa ? 'აირჩიეთ...' : 'Select...'}</option>
                                                <option value="kg">{isKa ? 'კგ' : 'kg'}</option>
                                                <option value="g">{isKa ? 'გრამი' : 'g'}</option>
                                                <option value="L">{isKa ? 'ლიტრი' : 'L'}</option>
                                                <option value="mL">{isKa ? 'მლ' : 'mL'}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formState.category === 'Packaging' && (
                                 <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                                    <label className="font-bold text-blue-900 block mb-1">{isKa ? 'ტარის საშუალო წონა (კგ)' : 'Average Tare Weight (kg)'}</label>
                                    <input name="avgTareWeightKg" type="number" step="0.01" value={formState.avgTareWeightKg || ''} onChange={handleChange} className="input-field" placeholder={isKa ? "მაგ. 0.125 კგ ყუთისთვის" : "e.g., 0.125 for a crate"} />
                                    <p className="text-[10px] text-blue-700 mt-1">{isKa ? 'გამოიყენება ასაწონ პუნქტში სუფთა წონის ავტომატური გამოთვლისთვის.' : 'Used by Weigh Station for automated net weight calculations.'}</p>
                                </div>
                            )}

                             {formState.category === 'Pallets' && (
                                 <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                                    <label className="font-bold text-slate-800 block mb-1">{isKa ? 'პალეტის დეტალები' : 'Pallet Details'}</label>
                                    <textarea name="description" value={formState.description} onChange={handleChange} className="input-field" rows={2} placeholder={isKa ? "მაგ. ევრო სტანდარტი, 1200x800მმ..." : "e.g., EU Standard, 1200x800mm, 25kg capacity"}></textarea>
                                </div>
                            )}

                            {formState.category === "Machinery" && (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <h4 className="md:col-span-2 font-black text-amber-900 text-xs uppercase tracking-wide">
                                        {isKa ? 'ტექნიკისა და აქტივის პარამეტრები' : 'Asset Details & Specifications'}
                                    </h4>
                                    <div>
                                        <label className="font-bold text-[11px] text-amber-900 block mb-1">{isKa ? 'მფლობელობა' : 'Ownership'}</label>
                                        <select value={machineryDetails.ownership} onChange={e => setMachineryDetails({...machineryDetails, ownership: e.target.value})} className="input-field">
                                            <option value="owned">{isKa ? 'საკუთარი' : 'Owned'}</option>
                                            <option value="rented">{isKa ? 'ნაქირავები' : 'Rented'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="font-bold text-[11px] text-amber-900 block mb-1">{isKa ? 'კატეგორია' : 'Vehicle Category'}</label>
                                        <select value={machineryDetails.vehicleCategory} onChange={e => setMachineryDetails({...machineryDetails, vehicleCategory: e.target.value})} className="input-field">
                                            <option value="passenger">{isKa ? 'სამგზავრო' : 'Passenger'}</option>
                                            <option value="cargo">{isKa ? 'სატვირთო' : 'Cargo'}</option>
                                            <option value="tractor">{isKa ? 'ტრაქტორი და აგრეგატი' : 'Tractor & Implements'}</option>
                                            <option value="inventar">{isKa ? 'ინვენტარი' : 'Inventar'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="font-bold text-[11px] text-amber-900 block mb-1">{isKa ? 'მგზავრების რაოდენობა' : 'Passenger Capacity'}</label>
                                        <input type="number" value={machineryDetails.passengerCapacity || ""} onChange={e => setMachineryDetails({...machineryDetails, passengerCapacity: e.target.value})} className="input-field" placeholder={isKa ? "მაგ. 4" : "e.g. 4"} />
                                    </div>
                                    <div>
                                        <label className="font-bold text-[11px] text-amber-900 block mb-1">{isKa ? 'ტვირთამწეობა (კგ)' : 'Payload Capacity (KG)'}</label>
                                        <input type="number" value={machineryDetails.payloadCapacity || ""} onChange={e => setMachineryDetails({...machineryDetails, payloadCapacity: e.target.value})} className="input-field" placeholder={isKa ? "მაგ. 1500" : "e.g. 1500"} />
                                    </div>
                                    <div>
                                        <label className="font-bold text-[11px] text-amber-900 block mb-1">{isKa ? 'ძრავის სიმძლავრე' : 'Engine Power'}</label>
                                        <input type="text" value={machineryDetails.enginePower || ""} onChange={e => setMachineryDetails({...machineryDetails, enginePower: e.target.value})} className="input-field" placeholder={isKa ? "მაგ. 90 ცხ.ძ." : "e.g. 90 HP"} />
                                    </div>
                                    <div>
                                        <label className="font-bold text-[11px] text-amber-900 block mb-1">{isKa ? 'საბაზისო ტარიფი (₾/სთ)' : 'Base Cost Rate (GEL/hr)'}</label>
                                        <input type="number" value={machineryDetails.baseCostRate || ""} onChange={e => setMachineryDetails({...machineryDetails, baseCostRate: e.target.value})} className="input-field" placeholder={isKa ? "მაგ. 25" : "e.g. 25"} />
                                    </div>
                                </div>
                            )}
                            {formState.category === 'Seeds' && (
                                 <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                                    <label className="font-bold text-yellow-900 block mb-1">{isKa ? 'თესლის / ნერგის ინფორმაცია' : 'Seed/Seedling Info'}</label>
                                    <input name="seedInfo" value={formState.seedInfo || ''} onChange={handleChange} className="input-field" placeholder={isKa ? "მაგ. 2 ინჩიანი ქოთანი, 6 თვის, წარმომავლობა..." : "e.g., 2 inch pot, 6 months old, origin..."} />
                                </div>
                            )}
                            
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">{isKa ? 'დამატებითი აღწერა და შენიშვნები' : 'Description & Notes'}</label>
                                <textarea name="description" value={formState.description} onChange={handleChange} className="input-field" rows={2} placeholder={isKa ? "დამატებითი შენიშვნები ან მომწოდებლის დეტალები..." : "Optional notes or supplier details..."}></textarea>
                            </div>
                        </div>

                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex flex-wrap justify-between items-center gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsBatchQrOpen(true)} 
                            className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                            title={isKa ? "QR კოდების შექმნა პარტიების დაყოფითა და რაოდენობებით" : "Generate QR with Batch Split & Quantity Configuration"}
                        >
                            <QrCode size={15} />
                            <span>{isKa ? 'QR ეტიკეტების გენერირება (პარტია / რაოდენობა)' : 'Generate QR (Batch Split & Qty)'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer">
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md transition-all cursor-pointer">
                                {isKa ? 'შენახვა' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            </div>

            {isBatchQrOpen && (
                <MaterialQrGeneratorModal
                    isOpen={isBatchQrOpen}
                    onClose={() => setIsBatchQrOpen(false)}
                    inventoryItems={item ? [item] : []}
                    selectedItemId={item?.id}
                    defaultMaterialName={formState.name || ''}
                    defaultCategory={
                        ['Fertilizers', 'Pesticides', 'Chemicals', 'Bio-stimulants'].includes(formState.category) ? 'supplies' :
                        formState.category === 'Seeds' ? 'goods' :
                        formState.category === 'Machinery' ? 'assets' : 'supplies'
                    }
                    onBatchGenerated={(batches) => {
                        if (batches.length > 0 && !formState.sku) {
                            setFormState(p => ({ ...p, sku: batches[0].sku || batches[0].id }));
                        }
                    }}
                />
            )}
            <style>{`.input-field { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 0.75rem; background-color: #f8fafc; font-weight: 600; outline: none; transition: all 0.2s; } .input-field:focus { background-color: #ffffff; border-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }`}</style>
        </>
    );
};

export default StockItemModal;
