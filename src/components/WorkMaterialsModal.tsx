import React, { useState } from 'react';
import type { WorkAssignment, InventoryItem, MaterialUsed } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { X, Plus, Trash2, Package, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface WorkMaterialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    work: WorkAssignment;
    inventoryItems: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    onSaveWork: (updatedWork: WorkAssignment) => void;
}

export const WorkMaterialsModal: React.FC<WorkMaterialsModalProps> = ({
    isOpen,
    onClose,
    work,
    inventoryItems = [],
    onSetInventoryItems,
    onSaveWork
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    // Filter categories: Packaging, Fertilizers, Pesticides, Supplies, Seeds, Other
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filteredInventory = inventoryItems.filter(item => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch = !searchQuery.trim() || 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    const [selectedItemId, setSelectedItemId] = useState<string>(filteredInventory[0]?.id || inventoryItems[0]?.id || '');
    const [quantity, setQuantity] = useState<number>(1);
    const [unitCost, setUnitCost] = useState<number>(
        filteredInventory[0]?.unitCost || inventoryItems[0]?.unitCost || 0
    );
    const [deductFromStock, setDeductFromStock] = useState<boolean>(true);

    if (!isOpen) return null;

    const materialsUsed = work.materialsUsed || [];

    const selectedItem = inventoryItems.find(i => i.id === selectedItemId);

    const handleItemChange = (id: string) => {
        setSelectedItemId(id);
        const item = inventoryItems.find(i => i.id === id);
        if (item) {
            setUnitCost(item.unitCost || 0);
        }
    };

    // Calculate total materials cost
    const totalMaterialsCost = materialsUsed.reduce((acc, m) => {
        const item = inventoryItems.find(i => i.id === m.inventoryItemId);
        const costPerUnit = m.unitCost !== undefined ? m.unitCost : (m.cost || item?.unitCost || 0);
        return acc + (m.quantity || 0) * costPerUnit;
    }, 0);

    const handleAddMaterial = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedItem) {
            toast.error(isKa ? "გთხოვთ აირჩიოთ მასალა" : "Please select a material");
            return;
        }

        if (quantity <= 0) {
            toast.error(isKa ? "რაოდენობა უნდა იყოს 0-ზე მეტი" : "Quantity must be greater than 0");
            return;
        }

        const newMaterial: MaterialUsed = {
            inventoryItemId: selectedItem.id,
            quantity: Number(quantity),
            unitCost: Number(unitCost),
            cost: Number(quantity) * Number(unitCost),
            unit: selectedItem.unitOfMeasure || 'pcs'
        };

        const updatedMaterials = [...materialsUsed, newMaterial];

        // Recalculate material total and full total cost
        const newTotalMatCost = updatedMaterials.reduce((acc, m) => {
            const inv = inventoryItems.find(i => i.id === m.inventoryItemId);
            const cost = m.unitCost !== undefined ? m.unitCost : (m.cost || inv?.unitCost || 0);
            return acc + (m.quantity || 0) * cost;
        }, 0);

        const vehicleCost = (work.assignedVehicles || []).reduce((acc, v) => {
            return acc + (v.isOwned ? 0 : (v.usageHours || 0) * (v.hiredCost || 0));
        }, 0);

        const laborCost = work.totalLaborCost || 0;

        const updatedWork: WorkAssignment = {
            ...work,
            materialsUsed: updatedMaterials,
            totalMaterialCost: newTotalMatCost,
            totalCost: laborCost + newTotalMatCost + vehicleCost,
            changeHistory: [
                ...(work.changeHistory || []),
                {
                    timestamp: new Date().toISOString(),
                    userName: 'System User',
                    action: 'Add Material',
                    details: `Recorded ${quantity} ${selectedItem.unitOfMeasure || ''} of ${selectedItem.name} ($${(quantity * unitCost).toFixed(2)})`
                }
            ]
        };

        onSaveWork(updatedWork);

        // Deduct from stock if enabled
        if (deductFromStock && onSetInventoryItems) {
            const updatedStock = inventoryItems.map(item => {
                if (item.id === selectedItem.id) {
                    return {
                        ...item,
                        currentStock: Math.max(0, (item.currentStock || 0) - quantity)
                    };
                }
                return item;
            });
            onSetInventoryItems(updatedStock);
        }

        toast.success(
            isKa 
                ? `მასალა "${selectedItem.name}" წარმატებით ჩამოიწერა!` 
                : `Material "${selectedItem.name}" recorded to registry!`
        );

        setQuantity(1);
    };

    const handleRemoveMaterial = (index: number) => {
        const itemToRemove = materialsUsed[index];
        const updatedMaterials = materialsUsed.filter((_, i) => i !== index);

        // Calculate new material cost
        const newTotalMatCost = updatedMaterials.reduce((acc, m) => {
            const inv = inventoryItems.find(i => i.id === m.inventoryItemId);
            const cost = m.unitCost !== undefined ? m.unitCost : (m.cost || inv?.unitCost || 0);
            return acc + (m.quantity || 0) * cost;
        }, 0);

        const vehicleCost = (work.assignedVehicles || []).reduce((acc, v) => {
            return acc + (v.isOwned ? 0 : (v.usageHours || 0) * (v.hiredCost || 0));
        }, 0);

        const laborCost = work.totalLaborCost || 0;

        const updatedWork: WorkAssignment = {
            ...work,
            materialsUsed: updatedMaterials,
            totalMaterialCost: newTotalMatCost,
            totalCost: laborCost + newTotalMatCost + vehicleCost,
            changeHistory: [
                ...(work.changeHistory || []),
                {
                    timestamp: new Date().toISOString(),
                    userName: 'System User',
                    action: 'Remove Material',
                    details: `Removed material line #${index + 1}`
                }
            ]
        };

        onSaveWork(updatedWork);

        // Optionally restore inventory stock
        if (itemToRemove && onSetInventoryItems) {
            const updatedStock = inventoryItems.map(item => {
                if (item.id === itemToRemove.inventoryItemId) {
                    return {
                        ...item,
                        currentStock: (item.currentStock || 0) + (itemToRemove.quantity || 0)
                    };
                }
                return item;
            });
            onSetInventoryItems(updatedStock);
        }

        toast.info(isKa ? "მასალა წაიშალა რეესტრიდან" : "Material removed from registry");
    };

    const taskTitle = typeof work.workName === 'string' ? work.workName : (work.workName as any)?.title || 'Work Task';

    return (
        <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[4500] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-amber-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-4 sm:p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                            📦
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-base sm:text-lg uppercase tracking-tight">
                                    {isKa ? 'მასალები & მარაგები' : 'Materials & Supplies'}
                                </h3>
                                <span className="bg-amber-400/25 border border-amber-300/40 text-amber-100 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                    {materialsUsed.length} {isKa ? 'სახეობა' : 'items'}
                                </span>
                            </div>
                            <p className="text-xs text-amber-100/90 font-medium truncate max-w-md">
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
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                {isKa ? 'გამოყენებული მასალები' : 'Recorded Materials'}
                            </p>
                            <p className="text-lg font-black text-slate-900 mt-0.5">
                                {materialsUsed.length} <span className="text-xs font-bold text-slate-400">{isKa ? 'პოზიცია' : 'items'}</span>
                            </p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
                            <p className="text-[9px] font-black uppercase text-amber-800 tracking-wider">
                                {isKa ? 'მასალების ჯამური ხარჯი' : 'Total Material OPEX'}
                            </p>
                            <p className="text-lg font-black text-amber-700 mt-0.5">
                                {formatCurrency(totalMaterialsCost)}
                            </p>
                        </div>
                    </div>

                    {/* Materials List */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Layers size={14} className="text-amber-600" />
                                <span>{isKa ? 'რეესტრზე ჩამოწერილი მასალები' : 'Materials Used in Registry'}</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-bold">
                                {materialsUsed.length} {isKa ? 'ჩანაწერი' : 'entries'}
                            </span>
                        </div>

                        {materialsUsed.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-400 space-y-1">
                                <p className="text-2xl">📦</p>
                                <p className="text-xs font-bold">
                                    {isKa ? 'ამ რეესტრზე მასალები ჯერ არ არის ჩამოწერილი' : 'No materials recorded for this registry yet'}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {isKa ? 'დაამატეთ ქვემოთ მოცემული ფორმიდან' : 'Record items from warehouse below'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {materialsUsed.map((m, idx) => {
                                    const inv = inventoryItems.find(i => i.id === m.inventoryItemId);
                                    const name = inv?.name || m.inventoryItemId;
                                    const category = inv?.category || 'General';
                                    const costPerUnit = m.unitCost !== undefined ? m.unitCost : (m.cost || inv?.unitCost || 0);
                                    const lineTotal = (m.quantity || 0) * costPerUnit;

                                    return (
                                        <div 
                                            key={idx}
                                            className="bg-white rounded-2xl border border-slate-200/90 p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-amber-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-lg flex-shrink-0">
                                                    📦
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-xs font-black text-slate-900 uppercase truncate">
                                                            {name}
                                                        </p>
                                                        <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                                            {category}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                                        {m.quantity} {m.unit || inv?.unitOfMeasure || 'pcs'} @ {formatCurrency(costPerUnit)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-amber-700 font-mono">
                                                        {formatCurrency(lineTotal)}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMaterial(idx)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                                    title={isKa ? 'წაშლა და მარაგში დაბრუნება' : 'Remove and return to stock'}
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

                    {/* Add Material Form */}
                    <div className="bg-white rounded-2xl border border-amber-200/90 p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-2">
                                <Plus size={15} className="text-amber-600" />
                                <span>{isKa ? 'საწყობიდან მასალის ჩამოწერა' : 'Record Material from Warehouse'}</span>
                            </h4>

                            {/* Category Filter */}
                            <div className="flex items-center gap-1 overflow-x-auto">
                                {['All', 'Packaging', 'Fertilizers', 'Pesticides', 'Supplies'].map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                                            selectedCategory === cat 
                                                ? 'bg-amber-600 text-white' 
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleAddMaterial} className="space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                    {isKa ? 'აირჩიეთ მასალა / ნედლეული საწყობიდან' : 'Select Material / Supply from Stock'}
                                </label>
                                <select
                                    value={selectedItemId}
                                    onChange={e => handleItemChange(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-amber-500"
                                >
                                    {filteredInventory.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({item.category}) — {isKa ? 'ნაშთი' : 'Stock'}: {item.currentStock} {item.unitOfMeasure || 'pcs'} @ ${item.unitCost?.toFixed(2) || '0.00'}
                                        </option>
                                    ))}
                                    {filteredInventory.length === 0 && (
                                        <option value="">{isKa ? 'მასალები ვერ მოიძებნა' : 'No materials in this category'}</option>
                                    )}
                                </select>
                            </div>

                            {/* Quantity and Unit Cost */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">
                                            {isKa ? 'გამოყენებული რაოდენობა' : 'Quantity Used'}
                                        </label>
                                        {selectedItem && (
                                            <span className={`text-[9.5px] font-bold ${
                                                quantity > selectedItem.currentStock ? 'text-rose-600' : 'text-slate-400'
                                            }`}>
                                                {isKa ? 'ნაშთი:' : 'Available:'} {selectedItem.currentStock} {selectedItem.unitOfMeasure || 'pcs'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            value={quantity}
                                            onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500"
                                        />
                                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                                            {selectedItem?.unitOfMeasure || 'pcs'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        {isKa ? 'ერთეულის ფასი ($)' : 'Unit Cost ($)'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={unitCost}
                                            onChange={e => setUnitCost(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500"
                                        />
                                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                                            $/unit
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Warning if exceeds current stock */}
                            {selectedItem && quantity > selectedItem.currentStock && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-[10.5px] font-bold">
                                    <AlertTriangle size={14} className="flex-shrink-0" />
                                    <span>
                                        {isKa 
                                            ? `გაფრთხილება: რაოდენობა (${quantity}) აჭარბებს საწყობის ნაშთს (${selectedItem.currentStock} ${selectedItem.unitOfMeasure || ''})` 
                                            : `Warning: Quantity (${quantity}) exceeds current warehouse stock (${selectedItem.currentStock} ${selectedItem.unitOfMeasure || ''})`
                                        }
                                    </span>
                                </div>
                            )}

                            {/* Deduct checkbox & Subtotal */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={deductFromStock}
                                        onChange={e => setDeductFromStock(e.target.checked)}
                                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                                    />
                                    <span>{isKa ? 'საწყობის ნაშთიდან ჩამოწერა (Stock Sync)' : 'Deduct from stock warehouse'}</span>
                                </label>
                                <span className="text-xs font-black text-amber-700 font-mono">
                                    Subtotal: {formatCurrency((Number(quantity) || 0) * (Number(unitCost) || 0))}
                                </span>
                            </div>

                            {/* Actions */}
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
                                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                >
                                    <Plus size={15} />
                                    <span>{isKa ? 'მასალის ჩამოწერა' : 'Add Material'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkMaterialsModal;
