import React, { useMemo, useState } from 'react';
import { StockViewProps } from './InventoryView';
import { useLanguage } from '../contexts/LanguageContext';
import { SearchIcon } from './Icons';
import { Calendar, Truck, User, Search, Edit, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import HarvestCommercialModal from './HarvestCommercialModal';
import type { InventoryItem } from '../types';

export const HarvestSalesList: React.FC<StockViewProps> = (props) => {
    const { formatCurrency, currency } = useLanguage();
    const { inventoryItems = [], accounts = [], harvestEvents = [], onSetInventoryItems } = props;
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    const salesList = useMemo(() => {
        return inventoryItems.filter(i => 
            i.category === 'Produce' && 
            (i.fulfillmentType === 'DIRECT_WHOLESALE' || i.fulfillmentType === 'PARTLY_SOLD' || i.status === 'SOLD' || i.status === 'PARTIALLY_SOLD')
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [inventoryItems]);

    const filteredList = useMemo(() => {
        if (!searchQuery) return salesList;
        const q = searchQuery.toLowerCase();
        return salesList.filter(i => 
            i.name.toLowerCase().includes(q) || 
            (i.buyer && i.buyer.toLowerCase().includes(q)) ||
            (i.sku && i.sku.toLowerCase().includes(q)) ||
            (i.variety && i.variety.toLowerCase().includes(q)) ||
            (i.varietiesBreakdown && i.varietiesBreakdown.some(v => v.variety.toLowerCase().includes(q)))
        );
    }, [salesList, searchQuery]);

    const handleSaveCommercial = (
        updatedItem: InventoryItem, 
        refrigeratorLot?: any, 
        paymentTx?: { amount: number; type: 'CASH' | 'LTD'; description: string; recipient?: string; accountId?: string }
    ) => {
        if (onSetInventoryItems) {
            onSetInventoryItems(inventoryItems.map(i => i.id === updatedItem.id ? updatedItem : i));
        }

        if (paymentTx && paymentTx.amount > 0 && props.onSetTransactions && props.transactions) {
            const newTx: any = {
                id: `TX-${Date.now()}`,
                organizationId: updatedItem.organizationId || 'org-1',
                transactionType: 'Incoming Payment',
                amount: paymentTx.amount,
                date: new Date().toISOString(),
                description: paymentTx.description,
                category: 'Sales',
                debitAccountId: paymentTx.accountId || 'cash-1',
                creditAccountId: 'revenue-account',
                paymentMode: paymentTx.type === 'CASH' ? 'Cash' : 'Bank Transfer',
                referenceId: updatedItem.id
            };
            props.onSetTransactions([...props.transactions, newTx]);

            // Update account balance
            if (props.onSetAccounts && props.accounts) {
                const updatedAccounts = props.accounts.map(acc => {
                    if (acc.id === newTx.debitAccountId) {
                        return { ...acc, balance: acc.balance + paymentTx.amount };
                    }
                    return acc;
                });
                props.onSetAccounts(updatedAccounts);
            }
        }

        setSelectedItem(null);
    };

    const handleUpdateVarietyInline = (itemId: string, varIndex: number, field: 'kg' | 'pricePerKg', val: number) => {
        if (!onSetInventoryItems) return;
        const updated = inventoryItems.map(item => {
            if (item.id !== itemId) return item;

            const existingBreakdown = item.varietiesBreakdown ? [...item.varietiesBreakdown] : [
                { variety: item.variety || 'Legacy', kg: item.soldKg || item.currentStock || 0, pricePerKg: item.unitCost || 10 }
            ];

            if (existingBreakdown[varIndex]) {
                existingBreakdown[varIndex] = {
                    ...existingBreakdown[varIndex],
                    [field]: val
                };
            }

            const newTotalSoldKg = existingBreakdown.reduce((sum, v) => sum + (v.kg || 0), 0);
            const newTotalRev = existingBreakdown.reduce((sum, v) => sum + ((v.kg || 0) * (v.pricePerKg || 0)), 0);
            const newAvgPrice = newTotalSoldKg > 0 ? newTotalRev / newTotalSoldKg : item.unitCost;

            return {
                ...item,
                varietiesBreakdown: existingBreakdown,
                soldKg: newTotalSoldKg,
                unitCost: newAvgPrice,
                netRevenue: newTotalRev - (item.harvestOpex || 0) - (item.materialsCost || 0)
            };
        });
        onSetInventoryItems(updated);
    };

    const handleRestoreToStorage = (item: InventoryItem) => {
        if (!onSetInventoryItems) return;
        const updated = inventoryItems.map(i => {
            if (i.id !== item.id) return i;
            return {
                ...i,
                status: 'IN_STORAGE',
                fulfillmentType: undefined,
                soldKg: 0,
                buyer: undefined,
                netRevenue: 0
            };
        });
        onSetInventoryItems(updated);
        toast.success(`Restored ${item.name} back to Produce Storage Ledger!`);
    };

    const getItemVarietiesBreakdown = (item: InventoryItem) => {
        if (item.varietiesBreakdown && item.varietiesBreakdown.length > 0) {
            return item.varietiesBreakdown;
        }
        // Fallback to harvest event or item properties
        const relatedEv = harvestEvents.find(e => e.id === item.relatedHarvestId);
        if (relatedEv && relatedEv.yieldByVariety && relatedEv.yieldByVariety.length > 0) {
            return relatedEv.yieldByVariety.map(y => ({
                variety: y.variety || 'Legacy',
                kg: y.netWeightKg ?? y.weightKg ?? item.soldKg ?? item.currentStock,
                pricePerKg: item.unitCost || 10
            }));
        }
        return [
            { variety: item.variety || 'Star', kg: item.soldKg || item.currentStock || 200, pricePerKg: item.unitCost || 10 }
        ];
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Harvest Sales Ledger</h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">Visible varieties, yield distribution, and net revenue settlements</p>
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder="Search sales by buyer, variety, or lot..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold w-full sm:w-64 outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase font-black text-[10px] tracking-wider bg-slate-50/50">
                            <th className="py-3 px-3">Sale Date</th>
                            <th className="py-3 px-3">Aging</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3">Varieties Breakdown (Edit Inline)</th>
                            <th className="py-3 px-3">Sold / Total</th>
                            <th className="py-3 px-3">Net Revenue</th>
                            <th className="py-3 px-3">Buyer</th>
                            <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredList.map(item => {
                            const dateObj = new Date(item.date);
                            const saleDate = isNaN(dateObj.getTime()) ? 'Unknown' : dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            const vList = getItemVarietiesBreakdown(item);
                            const isExpanded = expandedRowId === item.id;
                            
                            return (
                                <React.Fragment key={item.id}>
                                    <tr className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-3 font-bold text-slate-700">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                {saleDate}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                                                🕒 {item.daysInStorage || 0} Days
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase border ${
                                                item.fulfillmentType === 'DIRECT_WHOLESALE' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>
                                                {item.fulfillmentType?.replace('_', ' ') || item.status}
                                            </span>
                                        </td>

                                        {/* Visible Varieties Pills / Quick Edit trigger */}
                                        <td className="py-3 px-3">
                                            <div className="flex flex-wrap items-center gap-1.5 max-w-[320px]">
                                                {vList.map((v, idx) => (
                                                    <span 
                                                        key={idx}
                                                        onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 text-purple-900 rounded-md font-bold text-[10px] cursor-pointer transition-colors"
                                                        title="Click to edit varieties inline"
                                                    >
                                                        <span className="font-black text-purple-700">🍇 {v.variety}:</span>
                                                        <span className="font-extrabold">{v.kg}kg</span>
                                                        <span className="text-purple-600">@ {formatCurrency(v.pricePerKg)}</span>
                                                    </span>
                                                ))}
                                                <button
                                                    onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                                                    className="text-[9px] font-black text-sky-600 hover:text-sky-800 underline ml-1"
                                                >
                                                    {isExpanded ? 'Hide Edit' : 'Edit Varieties'}
                                                </button>
                                            </div>
                                        </td>

                                        <td className="py-3 px-3 font-black">
                                            <span className="text-emerald-700">{item.soldKg || 0}</span> / <span className="text-slate-500">{item.currentStock} kg</span>
                                        </td>
                                        <td className="py-3 px-3 font-black text-sky-700">
                                            {formatCurrency(item.netRevenue || ((item.soldKg || 0) * (item.unitCost || 0)))}
                                        </td>
                                        <td className="py-3 px-3 font-bold text-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="truncate max-w-[150px]">{item.buyer || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button 
                                                    onClick={() => handleRestoreToStorage(item)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                                                    title="Restore item back to Harvest Produce Storage Ledger"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" /> Restore Back
                                                </button>
                                                <button 
                                                    onClick={() => setSelectedItem(item)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Edit className="w-3.5 h-3.5" /> Edit / Settlement
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Inline Variety Editing Row */}
                                    {isExpanded && (
                                        <tr className="bg-purple-50/50 border-b border-purple-100">
                                            <td colSpan={8} className="p-4">
                                                <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-sm space-y-3">
                                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                        <span className="text-xs font-black uppercase text-purple-900 flex items-center gap-1.5">
                                                            🍇 Quick Inline Variety Quantities & Pricing for {item.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold">
                                                            Changes update total yield & net revenue live
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                        {vList.map((v, vIdx) => (
                                                            <div key={vIdx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                                                                <div className="font-black text-xs text-slate-800">
                                                                    {v.variety}
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase text-slate-400">Sold (KG)</label>
                                                                        <input 
                                                                            type="number" 
                                                                            step="any"
                                                                            value={v.kg}
                                                                            onChange={e => handleUpdateVarietyInline(item.id, vIdx, 'kg', Number(e.target.value))}
                                                                            className="w-full p-1.5 bg-white border border-slate-300 rounded font-black text-xs text-slate-900"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase text-slate-400">Price / KG</label>
                                                                        <input 
                                                                            type="number" 
                                                                            step="any"
                                                                            value={v.pricePerKg}
                                                                            onChange={e => handleUpdateVarietyInline(item.id, vIdx, 'pricePerKg', Number(e.target.value))}
                                                                            className="w-full p-1.5 bg-white border border-slate-300 rounded font-black text-xs text-emerald-700"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="text-right text-[10px] font-extrabold text-emerald-700 pt-0.5">
                                                                    Subtotal: {formatCurrency(v.kg * v.pricePerKg)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {filteredList.length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                                    No sales records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedItem && (
                <HarvestCommercialModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    item={selectedItem}
                    harvestEvents={harvestEvents}
                    accounts={accounts}
                    onSaveCommercial={handleSaveCommercial}
                />
            )}
        </div>
    );
};
