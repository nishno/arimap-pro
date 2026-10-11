import React, { useMemo, useState } from 'react';
import { StockViewProps } from './InventoryView';
import { useLanguage } from '../contexts/LanguageContext';
import { Calendar, User, Search, Snowflake, DollarSign, Eye, X, RotateCcw, Download, Plus, Trash2, Brain, Sparkles, Filter, Scale, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import HarvestCommercialModal from './HarvestCommercialModal';
import SendToRefrigeratorModal from './SendToRefrigeratorModal';
import SelectedSalesAnalyticsModal from './SelectedSalesAnalyticsModal';
import StockItemModal from './StockItemModal';
import { exportToExcel } from '../utils/excelExporter';
import type { InventoryItem, RefrigeratorLot } from '../types';

export const HarvestProduceList: React.FC<StockViewProps> = (props) => {
    const { formatCurrency, currency } = useLanguage();
    const { inventoryItems = [], accounts = [], harvestEvents = [], employees = [], roles = [], onSetInventoryItems } = props;
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVariety, setSelectedVariety] = useState<string>('ALL');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [inspectingItem, setInspectingItem] = useState<InventoryItem | null>(null);
    const [refrigeratorModalItem, setRefrigeratorModalItem] = useState<InventoryItem | null>(null);
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const produceList = useMemo(() => {
        return inventoryItems.filter(i => 
            i.category === 'Produce' && !i.isPrivate && i.status !== 'COLD_STORAGE_RETURNED'
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [inventoryItems]);

    // Extract all unique varieties across produce items
    const availableVarieties = useMemo(() => {
        const set = new Set<string>();
        produceList.forEach(item => {
            if (item.variety) set.add(item.variety);
            if (item.varietiesBreakdown) {
                item.varietiesBreakdown.forEach(v => {
                    if (v.variety) set.add(v.variety);
                });
            }
        });
        return Array.from(set).sort();
    }, [produceList]);

    const filteredList = useMemo(() => {
        return produceList.filter(i => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesSearch = 
                    i.name.toLowerCase().includes(q) || 
                    (i.buyer && i.buyer.toLowerCase().includes(q)) ||
                    (i.sku && i.sku.toLowerCase().includes(q)) ||
                    (i.variety && i.variety.toLowerCase().includes(q)) ||
                    (i.varietiesBreakdown && i.varietiesBreakdown.some(v => v.variety.toLowerCase().includes(q)));
                if (!matchesSearch) return false;
            }

            if (selectedVariety !== 'ALL') {
                const matchesVar = 
                    (i.variety && i.variety.toLowerCase() === selectedVariety.toLowerCase()) ||
                    (i.varietiesBreakdown && i.varietiesBreakdown.some(v => v.variety.toLowerCase() === selectedVariety.toLowerCase()));
                if (!matchesVar) return false;
            }

            return true;
        });
    }, [produceList, searchQuery, selectedVariety]);

    // Calculate total sold quantity for top stat badge
    const totalSoldQuantityKg = useMemo(() => {
        return filteredList.reduce((sum, item) => sum + (item.soldKg || item.currentStock || 0), 0);
    }, [filteredList]);

    // Selection handlers
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredList.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredList.map(i => i.id));
        }
    };

    const toggleSelectRow = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    // Calculate metrics for selected (or all filtered) items for bottom dark summary card
    const targetItemsForSummary = useMemo(() => {
        if (selectedIds.length > 0) {
            return produceList.filter(i => selectedIds.includes(i.id));
        }
        return filteredList;
    }, [selectedIds, produceList, filteredList]);

    const summaryMetrics = useMemo(() => {
        let combinedVolume = 0;
        let totalOpex = 0;
        let usedMaterials = 0;
        let grossRevenue = 0;
        let paidOpex = 0;
        let paidSalary = 0;

        const buyersSet = new Set<string>();

        targetItemsForSummary.forEach(item => {
            const vol = item.soldKg || item.currentStock || 0;
            combinedVolume += vol;

            const relatedEv = harvestEvents.find(e => e.id === item.relatedHarvestId);
            const opex = item.harvestOpex || ((relatedEv?.totalPickerCost || 0) + (relatedEv?.totalVehicleCost || 0) + (relatedEv?.manualOpex || 0));
            totalOpex += opex;

            const mat = item.materialsCost || relatedEv?.totalPackagingCost || 0;
            usedMaterials += mat;

            let rev = 0;
            if (item.varietiesBreakdown && item.varietiesBreakdown.length > 0) {
                rev = item.varietiesBreakdown.reduce((sum, v) => sum + ((v.kg || 0) * (v.pricePerKg || item.unitCost || 10)), 0);
            } else {
                rev = vol * (item.unitCost || 10);
            }
            grossRevenue += rev;

            if (item.buyer) buyersSet.add(item.buyer);

            // Paid details calculation
            const pOpex = item.paidOpex !== undefined ? item.paidOpex : (opex * 0.7);
            paidOpex += pOpex;

            const pSal = item.paidSalary !== undefined ? item.paidSalary : (relatedEv?.totalPickerCost ? relatedEv.totalPickerCost * 0.8 : 0);
            paidSalary += pSal;
        });

        const netRevenue = grossRevenue - totalOpex - usedMaterials;
        const avgPrice = combinedVolume > 0 ? grossRevenue / combinedVolume : 0;
        const salaryLeft = Math.max(0, totalOpex - paidSalary);
        const buyerInfo = Array.from(buyersSet).join(', ') || 'N/A';

        return {
            combinedVolume,
            totalOpex,
            usedMaterials,
            grossRevenue,
            netRevenue,
            buyerInfo,
            avgPrice,
            paidOpex,
            paidSalary,
            salaryLeft
        };
    }, [targetItemsForSummary, harvestEvents]);

    // Handle Excel Export
    const handleExportExcel = () => {
        if (targetItemsForSummary.length === 0) {
            toast.error('No items available to export.');
            return;
        }

        const dataToExport = targetItemsForSummary.map(item => {
            const relatedEv = harvestEvents.find(e => e.id === item.relatedHarvestId);
            const opex = item.harvestOpex || ((relatedEv?.totalPickerCost || 0) + (relatedEv?.totalVehicleCost || 0) + (relatedEv?.manualOpex || 0));
            const mat = item.materialsCost || 0;
            const vol = item.soldKg || item.currentStock || 0;
            const unitPrice = item.unitCost || 10;
            const gross = vol * unitPrice;
            const net = gross - opex - mat;

            return {
                'Date / თარიღი': item.date ? item.date.split('T')[0] : 'N/A',
                'Batch / პარტია': item.batch_id || item.sku || 'N/A',
                'Produce Name / დასახელება': item.name,
                'Cultivar Variety / ჯიში': item.variety || 'Mixed',
                'Weight (KG) / წონა (კგ)': Number(vol.toFixed(2)),
                'Unit Price / ფასი': Number(unitPrice.toFixed(2)),
                'Gross Revenue / ბრუნვა': Number(gross.toFixed(2)),
                'Opex Labor/Vehicles / საოპერაციო ხარჯი': Number(opex.toFixed(2)),
                'Packaging Materials / მასალები': Number(mat.toFixed(2)),
                'Net Revenue / წმინდა მოგება': Number(net.toFixed(2)),
                'Buyer / მყიდველი': item.buyer || 'N/A',
                'Status / სტატუსი': item.status || 'IN_STORAGE'
            };
        });

        exportToExcel(dataToExport, `Harvest_Produce_Ledger_${new Date().toISOString().split('T')[0]}`, 'Produce_Data');
        toast.success(`Exported ${dataToExport.length} harvest produce records to Excel!`);
    };

    // Handle Delete Selected
    const handleDeleteSelected = () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected record(s)?`)) return;

        if (onSetInventoryItems) {
            onSetInventoryItems(inventoryItems.filter(i => !selectedIds.includes(i.id)));
        }
        setSelectedIds([]);
        toast.success(`Deleted ${selectedIds.length} produce record(s) successfully.`);
    };

    // Handle Add New Produce Record
    const handleSaveNewRecord = (newItem: InventoryItem) => {
        const created: InventoryItem = {
            ...newItem,
            id: `prod-${Date.now()}`,
            category: 'Produce',
            date: newItem.date || new Date().toISOString(),
            currentStock: newItem.currentStock || 0,
            status: 'IN_STORAGE'
        };
        if (onSetInventoryItems) {
            onSetInventoryItems([created, ...inventoryItems]);
        }
        setIsAddModalOpen(false);
        toast.success(`Added new harvest produce record: ${created.name}`);
    };

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

    const getItemVarietiesBreakdown = (item: InventoryItem) => {
        if (item.varietiesBreakdown && item.varietiesBreakdown.length > 0) {
            return item.varietiesBreakdown;
        }
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

    const handleSendToRefrigerator = (item: InventoryItem) => {
        setRefrigeratorModalItem(item);
    };

    const handleConfirmTransferToRef = (updatedItem: InventoryItem, refLot: RefrigeratorLot) => {
        if (onSetInventoryItems) {
            onSetInventoryItems(inventoryItems.map(i => i.id === updatedItem.id ? updatedItem : i));
        }
        setRefrigeratorModalItem(null);
    };

    const handleRestoreBack = (item: InventoryItem) => {
        if (!onSetInventoryItems) return;
        const updated = inventoryItems.map(i => {
            if (i.id !== item.id) return i;
            return {
                ...i,
                status: 'IN_STORAGE',
                fulfillmentType: undefined,
                soldKg: 0,
                buyer: undefined,
                coldStorageKg: 0,
                refrigeratorLot: undefined,
                netRevenue: 0
            };
        });
        onSetInventoryItems(updated);
        toast.success(`Restored ${item.name} back to Produce Storage Ledger!`);
    };

    const formatWeight = (val?: number) => {
        if (val === undefined || val === null || isNaN(val)) return '0';
        return Number(val.toFixed(2)).toLocaleString();
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-6 shadow-sm relative">
            
            {/* TOP BAR: Filter & Manage Harvest Batch Sales and Reweight Statistics */}
            <div className="space-y-3">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Filter & Manage Harvest Batch Sales and Reweight Statistics
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    {/* Left: Sold Quantity Stat Badge */}
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200/80 px-3.5 py-2 rounded-xl">
                        <Scale className="w-4 h-4 text-emerald-600" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-emerald-700 leading-none">Sold Quantity</span>
                            <span className="text-sm font-black text-emerald-950 mt-0.5">
                                ⚖️ {formatWeight(totalSoldQuantityKg)} KG
                            </span>
                        </div>
                    </div>

                    {/* Center: Variety Filter Dropdown */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-xs font-black text-slate-700 flex items-center gap-1 whitespace-nowrap">
                            🍇 VARIETIES:
                        </span>
                        <select
                            value={selectedVariety}
                            onChange={e => setSelectedVariety(e.target.value)}
                            className="bg-transparent text-xs font-black text-slate-900 outline-none cursor-pointer pr-2"
                        >
                            <option value="ALL">All Varieties</option>
                            {availableVarieties.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Right: Action Buttons (Search, Export Excel, Add Record) */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                placeholder="Search produce, variety..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold w-44 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>

                        <button
                            onClick={handleExportExcel}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Export Excel
                        </button>

                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                        >
                            <Plus className="w-4 h-4" /> Add Record
                        </button>
                    </div>
                </div>
            </div>

            {/* TOP ANALYTICS & SUMMARY BAR (DISPLAYED ONLY AFTER SELECTION) */}
            {selectedIds.length > 0 && (
                <div className="bg-[#0B132B] text-white p-5 rounded-3xl shadow-xl border border-slate-800 animate-in fade-in duration-200">
                    <div className="flex flex-col space-y-4">
                        
                        {/* Row 1: Primary Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 border-b border-slate-800 pb-3">
                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Combined Volume</span>
                                <span className="text-lg font-black text-emerald-400 block mt-0.5">
                                    {summaryMetrics.combinedVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                                </span>
                            </div>

                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Total OPEX</span>
                                <span className="text-base font-black text-red-400 block mt-0.5">
                                    {formatCurrency(summaryMetrics.totalOpex)}
                                </span>
                            </div>

                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Used Materials Price</span>
                                <span className="text-base font-black text-amber-400 block mt-0.5">
                                    {formatCurrency(summaryMetrics.usedMaterials)}
                                </span>
                            </div>

                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Gross Revenue</span>
                                <span className="text-lg font-black text-sky-400 block mt-0.5">
                                    {formatCurrency(summaryMetrics.grossRevenue)}
                                </span>
                            </div>

                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Net Revenue</span>
                                <span className="text-base font-black text-emerald-400 block mt-0.5">
                                    {formatCurrency(summaryMetrics.netRevenue)}
                                </span>
                            </div>

                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Buyer Info</span>
                                <span className="text-xs font-bold text-slate-200 block mt-1 truncate max-w-[110px]" title={summaryMetrics.buyerInfo}>
                                    {summaryMetrics.buyerInfo}
                                </span>
                            </div>

                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Average Price</span>
                                <span className="text-base font-black text-indigo-300 block mt-0.5">
                                    {formatCurrency(summaryMetrics.avgPrice)}/kg
                                </span>
                            </div>

                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Paid OPEX</span>
                                <span className="text-base font-black text-rose-400 block mt-0.5">
                                    {formatCurrency(summaryMetrics.paidOpex)}
                                </span>
                            </div>
                        </div>

                        {/* Row 2: Secondary Salary Metrics & Action Controls */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Paid Salary</span>
                                    <span className="text-sm font-black text-sky-300">
                                        {formatCurrency(summaryMetrics.paidSalary)}
                                    </span>
                                </div>

                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Salary Left</span>
                                    <span className="text-sm font-black text-amber-400">
                                        {formatCurrency(summaryMetrics.salaryLeft)}
                                    </span>
                                </div>

                                <span className="px-2.5 py-1 bg-sky-500/20 text-sky-300 text-[10px] font-black uppercase rounded-full border border-sky-500/30">
                                    {selectedIds.length} Selected
                                </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => setIsAnalyticsModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                                >
                                    <Brain className="w-4 h-4 text-emerald-200" />
                                    Selected Data & AI Analysis
                                </button>

                                <button
                                    onClick={() => {
                                        if (targetItemsForSummary.length > 0) {
                                            setSelectedItem(targetItemsForSummary[0]);
                                        } else {
                                            toast.error('Select items to sell.');
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                                >
                                    <DollarSign className="w-4 h-4" />
                                    Sell Selected
                                </button>

                                <button
                                    onClick={handleDeleteSelected}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>

                                <button
                                    onClick={() => setSelectedIds([])}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                                    title="Clear Selection"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Produce Records Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase font-black text-[10px] tracking-wider bg-slate-50/50">
                            <th className="py-3 px-3 w-8">
                                <input 
                                    type="checkbox"
                                    checked={selectedIds.length === filteredList.length && filteredList.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                                />
                            </th>
                            <th className="py-3 px-3">Date & Batch</th>
                            <th className="py-3 px-3">Yield Details & Varieties</th>
                            <th className="py-3 px-3">Cost & OPEX</th>
                            <th className="py-3 px-3">Total Volume</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3 text-right">Route Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredList.map(item => {
                            const dateObj = new Date(item.date);
                            const eventDate = isNaN(dateObj.getTime()) ? 'Unknown' : dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            const vList = getItemVarietiesBreakdown(item);
                            const isExpanded = expandedRowId === item.id;
                            const isChecked = selectedIds.includes(item.id);
                            
                            const relatedEv = harvestEvents.find(e => e.id === item.relatedHarvestId);
                            const totalOpex = item.harvestOpex || ((relatedEv?.totalPickerCost || 0) + (relatedEv?.totalVehicleCost || 0) + (relatedEv?.manualOpex || 0));
                            const totalMat = item.materialsCost || 0;
                            
                            return (
                                <React.Fragment key={item.id}>
                                    <tr className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-sky-50/40' : ''}`}>
                                        <td className="py-3 px-3">
                                            <input 
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleSelectRow(item.id)}
                                                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="py-3 px-3 font-bold text-slate-700">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                {eventDate} ({item.variety || 'star'})
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">Batch: {item.batch_id || item.sku || 'N/A'}</div>
                                        </td>
                                        
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
                                                        <span className="font-extrabold">{formatWeight(v.kg)}kg</span>
                                                    </span>
                                                ))}
                                                <button
                                                    onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                                                    className="text-[9px] font-black text-sky-600 hover:text-sky-800 underline ml-1"
                                                >
                                                    {isExpanded ? 'Hide Details' : 'View Full Breakdown'}
                                                </button>
                                            </div>
                                        </td>

                                        <td className="py-3 px-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 rounded w-max">
                                                    OPEX: {formatCurrency(totalOpex)}
                                                </span>
                                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded w-max">
                                                    Mat: {formatCurrency(totalMat)}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-3 px-3 font-black text-slate-800">
                                            {formatWeight(item.currentStock)} kg
                                            <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                {item.physicalBoxes || relatedEv?.reweighTotalBoxes || Math.floor(item.currentStock / 5.3)} Crates
                                            </div>
                                        </td>
                                        
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase border ${
                                                item.status === 'SOLD' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                    : item.status === 'COLD_STORAGE'
                                                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                            }`}>
                                                {item.status?.replace('_', ' ') || 'IN STORAGE'}
                                            </span>
                                        </td>

                                        <td className="py-3 px-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {(item.status === 'SOLD' || item.status === 'PARTIALLY_SOLD' || item.status === 'IN_REFRIGERATOR' || item.status === 'COLD_STORAGE') && (
                                                    <button 
                                                        onClick={() => handleRestoreBack(item)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                                                        title="Restore item back to active Produce Storage Ledger"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5 text-amber-700" /> Restore
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => setInspectingItem(item)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-200/80 rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                                                    title="Explore detailed view"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-purple-700" /> Explore
                                                </button>
                                                <button 
                                                    onClick={() => setSelectedItem(item)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                                                >
                                                    <DollarSign className="w-3.5 h-3.5" /> Sell
                                                </button>
                                                <button 
                                                    onClick={() => handleSendToRefrigerator(item)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Snowflake className="w-3.5 h-3.5" /> Refrig
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Inline Variety Editing Row */}
                                    {isExpanded && (
                                        <tr className="bg-purple-50/50 border-b border-purple-100">
                                            <td colSpan={7} className="p-4">
                                                <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-sm space-y-3">
                                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                        <span className="text-xs font-black uppercase text-purple-900 flex items-center gap-1.5">
                                                            🍇 Harvest Produce Breakdown for {item.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold">
                                                            Detailed Yield
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                        {vList.map((v, vIdx) => (
                                                            <div key={vIdx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                                                                <div className="font-black text-xs text-slate-800">
                                                                    {v.variety}
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase text-slate-400">Total Yield (KG)</label>
                                                                        <input 
                                                                            type="number" 
                                                                            step="any"
                                                                            value={v.kg}
                                                                            onChange={e => handleUpdateVarietyInline(item.id, vIdx, 'kg', Number(e.target.value))}
                                                                            className="w-full p-1.5 bg-white border border-slate-300 rounded font-black text-xs text-slate-900"
                                                                        />
                                                                    </div>
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
                                <td colSpan={7} className="py-8 text-center text-slate-500 font-bold">
                                    No harvest produce records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Commercial Sale Modal */}
            {selectedItem && (
                <HarvestCommercialModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    item={selectedItem}
                    harvestEvents={harvestEvents}
                    accounts={accounts}
                    employees={employees}
                    roles={roles}
                    onSaveCommercial={handleSaveCommercial}
                />
            )}

            {/* Refrigerator Transfer Modal */}
            {refrigeratorModalItem && (
                <SendToRefrigeratorModal
                    isOpen={!!refrigeratorModalItem}
                    onClose={() => setRefrigeratorModalItem(null)}
                    item={refrigeratorModalItem}
                    harvestEvents={harvestEvents}
                    onConfirmTransfer={handleConfirmTransferToRef}
                />
            )}

            {/* AI Analysis Modal */}
            {isAnalyticsModalOpen && (
                <SelectedSalesAnalyticsModal
                    isOpen={isAnalyticsModalOpen}
                    onClose={() => setIsAnalyticsModalOpen(false)}
                    items={targetItemsForSummary}
                    harvestEvents={harvestEvents}
                />
            )}

            {/* Add Record Modal */}
            {isAddModalOpen && (
                <StockItemModal
                    item={null}
                    onClose={() => setIsAddModalOpen(false)}
                    onSave={handleSaveNewRecord}
                />
            )}

            {/* Detailed View / Inspector Modal */}
            {inspectingItem && (() => {
                const relatedEv = harvestEvents.find(e => e.id === inspectingItem.relatedHarvestId);
                const totalOpex = inspectingItem.harvestOpex || ((relatedEv?.totalPickerCost || 0) + (relatedEv?.totalVehicleCost || 0) + (relatedEv?.manualOpex || 0));
                const totalMat = inspectingItem.materialsCost || 0;
                const vBreakdown = getItemVarietiesBreakdown(inspectingItem);

                return (
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2005] flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setInspectingItem(null)}
                    >
                        <div 
                            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-6 overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                                        📋 Harvest Produce Inspector
                                    </span>
                                    <h3 className="font-black text-xl text-slate-900 mt-2">{inspectingItem.name}</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                                        Batch: {inspectingItem.batch_id || inspectingItem.sku || 'N/A'} • Event ID: {inspectingItem.relatedHarvestId || 'Manual Entry'}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setInspectingItem(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Summary Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                    <span className="block text-[9px] font-black uppercase text-slate-400">Total Weight</span>
                                    <span className="text-base font-black text-slate-900">{formatWeight(inspectingItem.currentStock)} KG</span>
                                </div>
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                    <span className="block text-[9px] font-black uppercase text-slate-400">Crates / Boxes</span>
                                    <span className="text-base font-black text-slate-700">
                                        {inspectingItem.physicalBoxes || relatedEv?.reweighTotalBoxes || Math.floor(inspectingItem.currentStock / 5.3)} Crates
                                    </span>
                                </div>
                                <div className="p-3 bg-red-50/60 border border-red-100 rounded-2xl space-y-1">
                                    <span className="block text-[9px] font-black uppercase text-red-500">Harvest OPEX</span>
                                    <span className="text-base font-black text-red-700">{formatCurrency(totalOpex)}</span>
                                </div>
                                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-1">
                                    <span className="block text-[9px] font-black uppercase text-amber-600">Materials Cost</span>
                                    <span className="text-base font-black text-amber-800">{formatCurrency(totalMat)}</span>
                                </div>
                            </div>

                            {/* Varieties Detailed Breakdown */}
                            <div className="space-y-2">
                                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    🍇 Varieties Breakdown
                                </h4>
                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                                            <tr>
                                                <th className="p-2.5">Variety</th>
                                                <th className="p-2.5">Net Weight (KG)</th>
                                                <th className="p-2.5">Crates / Boxes</th>
                                                <th className="p-2.5">Unit Price / KG</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold">
                                            {vBreakdown.map((v, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="p-2.5 font-black text-purple-900">{v.variety}</td>
                                                    <td className="p-2.5 font-black text-slate-800">{formatWeight(v.kg)} KG</td>
                                                    <td className="p-2.5 text-slate-600">{Math.ceil(v.kg / 5.3)}</td>
                                                    <td className="p-2.5 text-emerald-700 font-black">{formatCurrency(v.pricePerKg || inspectingItem.unitCost || 10)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap sm:flex-nowrap gap-3 pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => {
                                        const target = inspectingItem;
                                        setInspectingItem(null);
                                        setSelectedItem(target);
                                    }}
                                    className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                                >
                                    🚀 Send to Sales Window
                                </button>
                                <button
                                    onClick={() => {
                                        const target = inspectingItem;
                                        setInspectingItem(null);
                                        handleSendToRefrigerator(target);
                                    }}
                                    className="flex-1 py-3 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                                >
                                    🧊 Send to Refrigerator
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

