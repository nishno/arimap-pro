import React, { useState, useMemo } from 'react';
import type { InventoryItem, StockTransaction, InventoryTransaction, PurchaseOrder } from '../types';
import { XCircleIcon, SparklesIcon, ArrowsRightLeftIcon, CheckIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface MergeItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems: InventoryItem[];
    onSetInventoryItems: (items: InventoryItem[]) => void;
    stockTransactions?: StockTransaction[];
    onSetStockTransactions?: (txs: StockTransaction[]) => void;
    inventoryTransactions?: InventoryTransaction[];
    onSetInventoryTransactions?: (txs: InventoryTransaction[]) => void;
    purchaseOrders?: PurchaseOrder[];
    onSetPurchaseOrders?: (orders: PurchaseOrder[]) => void;
}

export const MergeItemsModal: React.FC<MergeItemsModalProps> = ({
    isOpen,
    onClose,
    inventoryItems = [],
    onSetInventoryItems,
    stockTransactions = [],
    onSetStockTransactions,
    inventoryTransactions = [],
    onSetInventoryTransactions,
    purchaseOrders = [],
    onSetPurchaseOrders
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const purchasableItems = useMemo(() => {
        return inventoryItems.filter(i => i.category !== 'Produce' && !i.isPrivate);
    }, [inventoryItems]);

    const [targetMasterItemId, setTargetMasterItemId] = useState<string>('');
    const [selectedSourceItemIds, setSelectedSourceItemIds] = useState<string[]>([]);
    const [searchFilter, setSearchFilter] = useState('');
    const [customMasterName, setCustomMasterName] = useState('');

    const targetMasterItem = useMemo(() => {
        return purchasableItems.find(i => i.id === targetMasterItemId);
    }, [purchasableItems, targetMasterItemId]);

    const sourceItems = useMemo(() => {
        return purchasableItems.filter(i => selectedSourceItemIds.includes(i.id));
    }, [purchasableItems, selectedSourceItemIds]);

    // Calculate total consolidated stock
    const consolidationPreview = useMemo(() => {
        if (!targetMasterItem) return null;

        // Base stock of target item
        const targetMass = targetMasterItem.packageContent 
            ? targetMasterItem.currentStock * targetMasterItem.packageContent 
            : targetMasterItem.currentStock;

        // Mass of source items
        let sourceTotalMass = 0;
        sourceItems.forEach(item => {
            const mass = item.packageContent ? item.currentStock * item.packageContent : item.currentStock;
            sourceTotalMass += mass;
        });

        const totalConsolidatedMass = targetMass + sourceTotalMass;

        // Weighted unit cost calculation
        let totalVal = targetMasterItem.currentStock * targetMasterItem.unitCost;
        sourceItems.forEach(item => {
            totalVal += item.currentStock * item.unitCost;
        });

        const totalItemsCount = targetMasterItem.currentStock + sourceItems.reduce((acc, i) => acc + i.currentStock, 0);
        const weightedUnitCost = totalItemsCount > 0 ? (totalVal / totalItemsCount) : targetMasterItem.unitCost;

        return {
            targetMass,
            sourceTotalMass,
            totalConsolidatedMass,
            weightedUnitCost: Math.round(weightedUnitCost * 100) / 100
        };
    }, [targetMasterItem, sourceItems]);

    if (!isOpen) return null;

    const handleToggleSourceItem = (id: string) => {
        if (id === targetMasterItemId) return;
        setSelectedSourceItemIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleConfirmMerge = () => {
        if (!targetMasterItem || selectedSourceItemIds.length === 0) return;

        const finalName = customMasterName.trim() || targetMasterItem.name;
        const newStock = consolidationPreview?.totalConsolidatedMass ?? targetMasterItem.currentStock;
        const newCost = consolidationPreview?.weightedUnitCost ?? targetMasterItem.unitCost;

        // 1. Update Target Item in inventory
        const updatedInventory = inventoryItems
            .filter(item => !selectedSourceItemIds.includes(item.id)) // Remove merged source items
            .map(item => {
                if (item.id === targetMasterItemId) {
                    return {
                        ...item,
                        name: finalName,
                        currentStock: newStock,
                        unitCost: newCost
                    };
                }
                return item;
            });

        onSetInventoryItems(updatedInventory);

        // 2. Re-link stock transactions
        if (stockTransactions && onSetStockTransactions) {
            const updatedStockTxs = stockTransactions.map(tx => {
                if (selectedSourceItemIds.includes(tx.itemId)) {
                    return { ...tx, itemId: targetMasterItemId, reason: `[Merged Item Record] ${tx.reason || ''}` };
                }
                return tx;
            });
            onSetStockTransactions(updatedStockTxs);
        }

        // 3. Re-link inventory transactions
        if (inventoryTransactions && onSetInventoryTransactions) {
            const updatedInvTxs = inventoryTransactions.map(tx => {
                if (selectedSourceItemIds.includes(tx.itemId)) {
                    return { ...tx, itemId: targetMasterItemId };
                }
                return tx;
            });
            onSetInventoryTransactions(updatedInvTxs);
        }

        // 4. Re-link purchase orders
        if (purchaseOrders && onSetPurchaseOrders) {
            const updatedPOs = purchaseOrders.map(po => ({
                ...po,
                items: (po.items || []).map(item => {
                    if (selectedSourceItemIds.includes(item.inventoryItemId)) {
                        return { ...item, inventoryItemId: targetMasterItemId };
                    }
                    return item;
                })
            }));
            onSetPurchaseOrders(updatedPOs);
        }

        alert(isKa 
            ? `წარმატებით გაერთიანდა ${selectedSourceItemIds.length} ნივთი "${finalName}"-ში.\nახალი გაერთიანებული ნაშთი: ${newStock} ${targetMasterItem.unitOfMeasure || 'კგ'}`
            : `Successfully merged ${selectedSourceItemIds.length} item(s) into "${finalName}".\nNew consolidated warehouse balance: ${newStock} ${targetMasterItem.unitOfMeasure || 'kg'}`
        );
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[5000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Modal Header */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <ArrowsRightLeftIcon className="h-6 w-6 text-indigo-400" />
                            <h2 className="text-xl font-black tracking-tight">
                                {isKa ? 'ნივთების გაერთიანება და კონსოლიდაცია' : 'Merge & Consolidate Stock Items'}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            {isKa 
                                ? 'დუბლირებული ნივთების გაერთიანება ერთ ძირითად სასაწყობე ნივთში ზუსტი აგრონომიული ჩამოწერისთვის.' 
                                : 'Combine duplicate items into a single master warehouse item for accurate agronomist deductions.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                        <XCircleIcon className="h-7 w-7" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-grow text-slate-800">
                    
                    {/* Step 1: Select Target Master Item */}
                    <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-3">
                        <label className="text-xs font-black uppercase tracking-wider text-indigo-900 block">
                            {isKa ? '1. აირჩიეთ ძირითადი ნივთი:' : '1. Select Target Master Item:'}
                        </label>
                        <select
                            value={targetMasterItemId}
                            onChange={e => {
                                setTargetMasterItemId(e.target.value);
                                setSelectedSourceItemIds(prev => prev.filter(id => id !== e.target.value));
                                const found = purchasableItems.find(i => i.id === e.target.value);
                                if (found) setCustomMasterName(found.name);
                            }}
                            className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm cursor-pointer"
                        >
                            <option value="">-- {isKa ? 'აირჩიეთ ძირითადი ნივთი' : 'Choose Master Item'} --</option>
                            {purchasableItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name} ({item.category}) — {isKa ? 'ნაშთი:' : 'Current Balance:'} {item.packageContent ? item.currentStock * item.packageContent : item.currentStock} {item.packageContentUnit || item.unitOfMeasure}
                                </option>
                            ))}
                        </select>

                        {targetMasterItem && (
                            <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                <span className="text-xs font-bold text-slate-700">{isKa ? 'ძირითადი ნივთის დასახელება:' : 'Master Item Display Name:'}</span>
                                <input
                                    type="text"
                                    value={customMasterName}
                                    onChange={e => setCustomMasterName(e.target.value)}
                                    placeholder={isKa ? "ძირითადი დასახელება (მაგ. კალიუმის ნიტრატი)" : "Master Name (e.g. Potassium Nitrate)"}
                                    className="w-full sm:flex-grow bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800"
                                />
                            </div>
                        )}
                    </div>

                    {/* Step 2: Select Items to Merge into Master */}
                    {targetMasterItemId && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                                    {isKa 
                                        ? `2. მონიშნეთ გასაერთიანებელი ნივთები ("${targetMasterItem?.name}"):` 
                                        : `2. Select Duplicate Items to Merge into "${targetMasterItem?.name}":`}
                                </label>
                                <input
                                    type="text"
                                    value={searchFilter}
                                    onChange={e => setSearchFilter(e.target.value)}
                                    placeholder={isKa ? "ნივთების გაფილტვრა..." : "Filter items..."}
                                    className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-xs font-bold rounded-xl outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                                {purchasableItems
                                    .filter(i => i.id !== targetMasterItemId)
                                    .filter(i => !searchFilter || i.name.toLowerCase().includes(searchFilter.toLowerCase()))
                                    .map(item => {
                                        const isSelected = selectedSourceItemIds.includes(item.id);
                                        const itemMass = item.packageContent ? item.currentStock * item.packageContent : item.currentStock;

                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => handleToggleSourceItem(item.id)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                                    isSelected 
                                                        ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300' 
                                                        : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                                                        isSelected ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                                                    }`}>
                                                        {isSelected && <CheckIcon className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">{item.name}</div>
                                                        <div className="text-[10px] text-slate-500">{item.category} • {item.unitCost} GEL</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-black text-indigo-600">+ {itemMass} {item.packageContentUnit || item.unitOfMeasure}</div>
                                                    <div className="text-[9px] text-slate-400">{item.currentStock} {item.unitOfMeasure}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Consolidation Summary Preview */}
                    {consolidationPreview && selectedSourceItemIds.length > 0 && (
                        <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                                <SparklesIcon className="w-4 h-4" /> 
                                {isKa ? 'გაერთიანებული ნაშთის გადახედვა' : 'Consolidated Balance Preview'}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-slate-800 rounded-xl">
                                    <div className="text-[10px] text-slate-400 uppercase font-extrabold">{isKa ? 'ძირითადი ნაშთი' : 'Original Master Balance'}</div>
                                    <div className="text-lg font-black text-white">{consolidationPreview.targetMass} {targetMasterItem?.packageContentUnit || targetMasterItem?.unitOfMeasure}</div>
                                </div>
                                <div className="p-3 bg-slate-800 rounded-xl">
                                    <div className="text-[10px] text-emerald-400 uppercase font-extrabold">{isKa ? '+ დასამატებელი მასა' : '+ Merged Items Mass'}</div>
                                    <div className="text-lg font-black text-emerald-400">+ {consolidationPreview.sourceTotalMass} {targetMasterItem?.packageContentUnit || targetMasterItem?.unitOfMeasure}</div>
                                </div>
                                <div className="p-3 bg-emerald-900/50 border border-emerald-500 rounded-xl">
                                    <div className="text-[10px] text-emerald-300 uppercase font-extrabold">{isKa ? 'ახალი ჯამური ნაშთი' : 'New Total Balance'}</div>
                                    <div className="text-xl font-black text-emerald-300">{consolidationPreview.totalConsolidatedMass} {targetMasterItem?.packageContentUnit || targetMasterItem?.unitOfMeasure}</div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center italic font-medium">
                                {isKa 
                                    ? `* აგრონომიულ რეცეპტებში გამოჩნდება გაერთიანებული ნივთი "${customMasterName || targetMasterItem?.name}" ${consolidationPreview.totalConsolidatedMass} ${targetMasterItem?.packageContentUnit || targetMasterItem?.unitOfMeasure} ნაშთით.`
                                    : `* Agronomists will now see a single master item "${customMasterName || targetMasterItem?.name}" with ${consolidationPreview.totalConsolidatedMass} ${targetMasterItem?.packageContentUnit || targetMasterItem?.unitOfMeasure} in stock.`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                        {isKa ? 'გაუქმება' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmMerge}
                        disabled={!targetMasterItem || selectedSourceItemIds.length === 0}
                        className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all cursor-pointer"
                    >
                        {isKa ? 'გაერთიანების დადასტურება' : 'Confirm Merge & Consolidate Stock'}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default MergeItemsModal;
