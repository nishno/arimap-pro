import React, { useState, useMemo, useEffect } from 'react';
import type { InventoryItem, HarvestEvent, Account, RefrigeratorLot, Employee, Role } from '../types';
import { 
    XCircleIcon, CheckIcon, Banknote, Truck, Snowflake, User, Calendar, Layers, 
    ArrowRight, DollarSign, Package, ChevronRight, PlusCircle, Trash2, Sliders,
    ShieldCheck, Info, Sparkles, Building2, Wallet, Users, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

interface HarvestCommercialModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    harvestEvents?: HarvestEvent[];
    accounts?: Account[];
    employees?: Employee[];
    roles?: Role[];
    onSaveCommercial: (
        updatedItem: InventoryItem, 
        refrigeratorLot?: RefrigeratorLot, 
        paymentTx?: { amount: number; type: 'CASH' | 'LTD'; description: string; recipient?: string; accountId?: string }
    ) => void;
}

interface BuyerAllocation {
    id: string;
    name: string;
    variety: string;
    weightKg: number;
    pricePerKg: number;
}

interface VarietySaleDetail {
    variety: string;
    isSelected: boolean;
    availableKg: number;
    soldKg: number;
    pricePerKg: number;
}

// Pre-saved Founders & Managers for cash recipient dropdown
const KNOWN_STAFF_RECIPIENTS = [
    { name: 'Giorgi Nishnianidze', role: 'Founder & Owner' },
    { name: 'Alexander Beridze', role: 'Farm Manager' },
    { name: 'Nino Maisuradze', role: 'Lead Accountant' },
    { name: 'David Kapanadze', role: 'Harvest Supervisor' },
];

// Pre-saved default buyers memory
const INITIAL_BUYERS_MEMORY = [
    'Metro Supermarkets Georgia',
    'AgroHub LLC',
    'Fresh Fruit Wholesale',
    'Batumi Cold Logistics',
    'Export Partner Black Sea',
    'Local Retailer'
];

export const HarvestCommercialModal: React.FC<HarvestCommercialModalProps> = ({
    isOpen,
    onClose,
    item,
    harvestEvents = [],
    accounts = [],
    employees = [],
    roles = [],
    onSaveCommercial
}) => {
    const { formatCurrency, currency } = useLanguage();

    // Determine initial harvest event details
    const relatedEvent = useMemo(() => {
        if (!item) return null;
        return harvestEvents.find(e => e.id === item.relatedHarvestId);
    }, [item, harvestEvents]);

    // Available varieties from harvest event or item
    const availableVarietiesList = useMemo(() => {
        if (!relatedEvent) {
            return item?.variety ? [item.variety] : ['Legacy', 'Star', 'Duke', 'Bluecrop'];
        }
        const set = new Set<string>();
        if (relatedEvent.varieties && relatedEvent.varieties.length > 0) {
            relatedEvent.varieties.forEach(v => { if (v) set.add(v); });
        }
        if (relatedEvent.yieldByVariety && relatedEvent.yieldByVariety.length > 0) {
            relatedEvent.yieldByVariety.forEach(y => { if (y.variety) set.add(y.variety); });
        }
        if (relatedEvent.reweighRecords && relatedEvent.reweighRecords.length > 0) {
            relatedEvent.reweighRecords.forEach(r => { if (r.variety) set.add(r.variety); });
        }
        if (set.size === 0) set.add('Legacy');
        return Array.from(set);
    }, [relatedEvent, item]);

    const totalAvailableKg = item?.currentStock || relatedEvent?.finalNetYieldKg || 0;
    const defaultBoxes = item?.physicalBoxes ?? Math.floor(totalAvailableKg / 5);
    const defaultPunnets = item?.physicalPunnets ?? defaultBoxes * 8;

    // 1. Selling Date & Days in Storage State
    const initialHarvestDate = relatedEvent?.plannedStartDate?.split('T')[0] || relatedEvent?.actualStartDate?.split('T')[0] || (relatedEvent as any)?.date?.split('T')[0] || item?.date?.split('T')[0] || new Date().toISOString().split('T')[0];
    const [sellingDate, setSellingDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const daysInStorage = useMemo(() => {
        try {
            const hDate = new Date(initialHarvestDate);
            const sDate = new Date(sellingDate);
            const diffTime = sDate.getTime() - hDate.getTime();
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            return diffDays;
        } catch {
            return 0;
        }
    }, [initialHarvestDate, sellingDate]);

    // 2. Commercial Fulfillment Option state
    const [fulfillmentType, setFulfillmentType] = useState<'DIRECT_WHOLESALE' | 'PARTLY_SOLD' | 'REFRIGERATOR'>(
        item?.fulfillmentType || 'DIRECT_WHOLESALE'
    );

    // 3. Overall Sales State
    const [soldKg, setSoldKg] = useState<number>(
        item?.soldKg !== undefined ? item.soldKg : totalAvailableKg
    );
    const [overallPricePerKg, setOverallPricePerKg] = useState<number>(item?.unitCost || 10);

    // 4. Variety Pricing & Weight Allocations
    const [varietyDetails, setVarietyDetails] = useState<VarietySaleDetail[]>([]);

    useEffect(() => {
        if (availableVarietiesList.length > 0) {
            const equalShare = totalAvailableKg / availableVarietiesList.length;
            setVarietyDetails(availableVarietiesList.map((varName, idx) => {
                // Determine available Kg from related event if possible
                let available = equalShare;
                if (relatedEvent?.yieldByVariety) {
                    const found = relatedEvent.yieldByVariety.find(y => y.variety === varName);
                    if (found && (found.netWeightKg !== undefined || found.weightKg !== undefined)) {
                        available = found.netWeightKg ?? found.weightKg;
                    }
                } else if (relatedEvent?.reweighRecords) {
                     const records = relatedEvent.reweighRecords.filter(r => r.variety === varName);
                     if (records.length > 0) {
                         available = records.reduce((sum, r) => sum + r.weight, 0);
                     }
                }
                
                // Check if existing breakdown has data
                const existing = item?.varietiesBreakdown?.find(v => v.variety === varName);
                return {
                    variety: varName,
                    isSelected: true,
                    availableKg: available,
                    soldKg: existing ? existing.kg : (idx === 0 ? Math.min(soldKg, available) : Math.max(0, soldKg - available)),
                    pricePerKg: existing?.pricePerKg || (varName === 'Star' ? 10 : (varName === 'Legacy' ? 8 : overallPricePerKg))
                };
            }));
        }
    }, [availableVarietiesList, item, relatedEvent, soldKg]);

    const useMultiVarietyPricing = true;

    // Calculate total sold kg and total gross revenue from varieties breakdown
    const varietyCalculations = useMemo(() => {
        let totalKg = 0;
        let totalRev = 0;
        varietyDetails.forEach(v => {
            if (v.isSelected) {
                totalKg += v.soldKg;
                totalRev += v.soldKg * v.pricePerKg;
            }
        });
        const avgPrice = totalKg > 0 ? totalRev / totalKg : overallPricePerKg;
        return { totalKg, totalRev, avgPrice };
    }, [varietyDetails, overallPricePerKg]);

    // Effective actual sold kg and gross revenue
    const actualSoldKg = fulfillmentType === 'REFRIGERATOR' 
        ? 0 
        : (fulfillmentType === 'DIRECT_WHOLESALE' ? totalAvailableKg : Math.min(soldKg, totalAvailableKg));

    const grossRevenue = fulfillmentType === 'REFRIGERATOR' 
        ? 0 
        : (varietyCalculations.totalRev > 0 ? varietyCalculations.totalRev : actualSoldKg * overallPricePerKg);

    const remainderForRefrigerator = fulfillmentType === 'DIRECT_WHOLESALE' 
        ? 0 
        : (fulfillmentType === 'REFRIGERATOR' ? totalAvailableKg : Math.max(0, totalAvailableKg - actualSoldKg));

    // 5. Harvest OPEX
    const harvestOpex = useMemo(() => {
        if (item?.harvestOpex !== undefined) return item.harvestOpex;
        if (relatedEvent?.totalPickerCost !== undefined) return relatedEvent.totalPickerCost;
        if ((relatedEvent as any)?.totalLaborCost !== undefined) return (relatedEvent as any).totalLaborCost;
        return 150; // default estimated harvest OPEX
    }, [item, relatedEvent]);

    // 6. Logistics & Transport Section (Toggle YES/NO)
    const [needsTransport, setNeedsTransport] = useState<boolean>(item?.needsTransport ?? false);
    const [transportType, setTransportType] = useState<'BUYER' | 'OWNER'>(item?.transportType || 'BUYER');
    const [vehicleInfo, setVehicleInfo] = useState<string>(item?.vehicleInfo || 'Ford Transit #1');
    const [driverName, setDriverName] = useState<string>(item?.driverName || 'Gia Beridze');
    const [driverCost, setDriverCost] = useState<number>(item?.driverCost || 50);
    const [loadersNames, setLoadersNames] = useState<string>(item?.loadersNames || 'Malkhaz, Vakhtang');
    const [loadersCost, setLoadersCost] = useState<number>(item?.loadersCost || 80);
    const [materialsDescription, setMaterialsDescription] = useState<string>(item?.materialsDescription || 'Euro Pallets (2x), Straps, Wrap');
    const [materialsCost, setMaterialsCost] = useState<number>(item?.materialsCost || 35);

    const totalTransportAndLogisticsCost = needsTransport 
        ? ((transportType === 'OWNER' ? driverCost : 0) + loadersCost + materialsCost) 
        : 0;

    const totalAllExpenses = harvestOpex + totalTransportAndLogisticsCost;
    const netRevenue = grossRevenue - totalAllExpenses;

    // 7. Multi-Buyer & Buyer Memory State
    const [buyersMemory, setBuyersMemory] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('saved_harvest_buyers');
            if (saved) return JSON.parse(saved);
        } catch {}
        return INITIAL_BUYERS_MEMORY;
    });

    const [isMultiBuyerMode, setIsMultiBuyerMode] = useState<boolean>(false);
    const [singleBuyerName, setSingleBuyerName] = useState<string>(item?.buyer || '');
    const [buyerAllocations, setBuyerAllocations] = useState<BuyerAllocation[]>([
        { id: 'b1', name: item?.buyer || 'Metro Supermarkets', variety: availableVarietiesList[0] || 'Legacy', weightKg: Math.round(actualSoldKg * 0.6), pricePerKg: 10 },
        { id: 'b2', name: 'AgroHub LLC', variety: availableVarietiesList[1] || 'Star', weightKg: Math.round(actualSoldKg * 0.4), pricePerKg: 10 }
    ]);

    const handleAddBuyerRow = () => {
        setBuyerAllocations(prev => [
            ...prev,
            { id: `b-${Date.now()}`, name: '', variety: availableVarietiesList[0] || 'Legacy', weightKg: 100, pricePerKg: overallPricePerKg }
        ]);
    };

    const handleRemoveBuyerRow = (id: string) => {
        setBuyerAllocations(prev => prev.filter(b => b.id !== id));
    };

    // 8. Financial Settlement & Deposit State
    const [paymentType, setPaymentType] = useState<'CASH' | 'LTD'>(item?.paymentType || 'CASH');
    const [paymentMode, setPaymentMode] = useState<'HAND' | 'BANK'>(item?.paymentMode || 'HAND');
    const [cashRecipient, setCashRecipient] = useState<string>(item?.paymentRecipient || 'Giorgi Nishnianidze');
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(accounts[0]?.id || '');
    const [bankTransferRef, setBankTransferRef] = useState<string>(item?.bankTransferReference || 'INVOICE-2026-08');

    // Refrigerator Details
    const [arrivalDateTime, setArrivalDateTime] = useState<string>(
        item?.refrigeratorLot?.arrivalDateTime || new Date().toISOString().slice(0, 16)
    );
    const [arrivalDayPricePerKg, setArrivalDayPricePerKg] = useState<number>(
        item?.refrigeratorLot?.arrivalDayPricePerKg || overallPricePerKg || 10
    );
    const [palletsType, setPalletsType] = useState<'Euro' | 'Ordinary' | 'Standard' | 'Other'>(
        item?.refrigeratorLot?.palletsType || 'Euro'
    );
    const [palletsCount, setPalletsCount] = useState<number>(
        item?.refrigeratorLot?.palletsCount || Math.ceil(totalAvailableKg / 250)
    );
    const [roomPlacementNotes, setRoomPlacementNotes] = useState<string>(
        item?.refrigeratorLot?.roomPlacementNotes || 'Cold Storage #1 - Zone B'
    );

    // 9. Detailed Inspector Drawer Toggle
    const [showExploreDetailsDrawer, setShowExploreDetailsDrawer] = useState<boolean>(false);
    const [activeDetailTab, setActiveDetailTab] = useState<'VARIETIES' | 'BUYERS' | 'LOGISTICS' | 'FINANCE'>('VARIETIES');

    if (!isOpen || !item) return null;

    // Save transaction handler
    const handleConfirm = () => {
        if (fulfillmentType !== 'REFRIGERATOR' && actualSoldKg <= 0) {
            toast.error('Sold quantity must be greater than 0 KG.');
            return;
        }

        // Remember newly typed single buyer name
        if (singleBuyerName && !buyersMemory.includes(singleBuyerName)) {
            const updated = [singleBuyerName, ...buyersMemory];
            setBuyersMemory(updated);
            try { localStorage.setItem('saved_harvest_buyers', JSON.stringify(updated)); } catch {}
        }

        const finalBuyerString = isMultiBuyerMode 
            ? buyerAllocations.map(b => `${b.name} (${b.weightKg}kg ${b.variety})`).join(', ')
            : singleBuyerName;

        const varietiesBreakdownData = varietyDetails.filter(v => v.isSelected && v.soldKg > 0).map(v => ({
            variety: v.variety,
            kg: v.soldKg,
            boxes: Math.ceil(v.soldKg / 5),
            punnets: Math.ceil(v.soldKg / 5) * 8,
            pricePerKg: v.pricePerKg
        }));

        const updatedItem: InventoryItem = {
            ...item,
            fulfillmentType,
            soldKg: actualSoldKg,
            unitCost: varietyCalculations.avgPrice || overallPricePerKg,
            buyer: finalBuyerString,
            status: fulfillmentType === 'REFRIGERATOR' ? 'IN_REFRIGERATOR' : (remainderForRefrigerator > 0 ? 'PARTIALLY_SOLD' : 'SOLD'),
            needsTransport,
            transportType,
            vehicleInfo,
            driverName,
            driverCost,
            loadersCount: loadersNames.split(',').length,
            loadersNames,
            loadersCost,
            materialsCost,
            materialsDescription,
            daysInStorage,
            harvestOpex,
            netRevenue,
            paymentType,
            paymentMode,
            paymentRecipient: paymentType === 'CASH' ? cashRecipient : (accounts.find(a => a.id === selectedBankAccountId)?.name || 'LTD Bank Account'),
            bankTransferReference: bankTransferRef,
            varietiesBreakdown: varietiesBreakdownData,
            buyersList: isMultiBuyerMode ? buyerAllocations.map(b => ({
                id: b.id,
                name: b.name,
                variety: b.variety,
                weightKg: b.weightKg,
                pricePerKg: b.pricePerKg,
                totalAmount: b.weightKg * b.pricePerKg
            })) : undefined,
            physicalBoxes: defaultBoxes,
            physicalPunnets: defaultPunnets
        };

        let refLot: RefrigeratorLot | undefined = undefined;

        if (remainderForRefrigerator > 0) {
            const lotId = `REF-LOT-${Date.now().toString().slice(-4)}`;
            refLot = {
                id: item.refrigeratorLot?.id || `ref-${Date.now()}`,
                lotNumber: item.refrigeratorLot?.lotNumber || lotId,
                harvestEventId: item.relatedHarvestId,
                harvestEventName: relatedEvent ? String(relatedEvent.name || 'Harvest Event') : item.name,
                harvestDate: initialHarvestDate,
                arrivalDateTime,
                arrivalDayPricePerKg,
                totalNetKg: remainderForRefrigerator,
                remainingNetKg: remainderForRefrigerator,
                palletsType,
                palletsCount,
                boxesCount: Math.ceil(remainderForRefrigerator / 5),
                punnetsCount: Math.ceil(remainderForRefrigerator / 5) * 8,
                loadersType: 'OUR_TEAM',
                loaderCost: 0,
                roomPlacementNotes,
                status: 'IN_REFRIGERATOR',
                salesHistory: item.refrigeratorLot?.salesHistory || []
            };
            updatedItem.refrigeratorLot = refLot;
            updatedItem.coldStorageKg = remainderForRefrigerator;
            updatedItem.coldStoragePrice = arrivalDayPricePerKg;
            updatedItem.coldStorageLocation = roomPlacementNotes;
        }

        let paymentTx = undefined;
        if (grossRevenue > 0 && fulfillmentType !== 'REFRIGERATOR') {
            paymentTx = {
                amount: grossRevenue,
                type: paymentType,
                description: `Harvest Commercial Sale: ${item.name} (${actualSoldKg.toFixed(1)} KG @ $${varietyCalculations.avgPrice.toFixed(2)}/KG)`,
                recipient: paymentType === 'CASH' ? cashRecipient : (accounts.find(a => a.id === selectedBankAccountId)?.name || 'LTD Bank Account'),
                accountId: selectedBankAccountId
            };
        }

        onSaveCommercial(updatedItem, refLot, paymentTx);
        toast.success(`Commercial settlement confirmed for ${item.name}!`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[2005] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col relative">
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center shrink-0 border-b border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 font-mono text-[10px] uppercase font-black tracking-widest rounded-full border border-emerald-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-emerald-400" /> Commercial Sales & Settlement Engine
                            </span>
                            <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" /> Harvest Date: {initialHarvestDate}
                            </span>
                        </div>
                        <h2 className="text-lg md:text-xl font-black mt-1 text-slate-100 flex items-center gap-2">
                            {item.name}
                            {relatedEvent && <span className="text-xs text-slate-400 font-medium">({typeof relatedEvent.name === 'string' ? relatedEvent.name : 'Harvest Event'})</span>}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            type="button"
                            onClick={() => setShowExploreDetailsDrawer(!showExploreDetailsDrawer)} 
                            className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 border ${showExploreDetailsDrawer ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}
                        >
                            <Sliders className="w-4 h-4" />
                            {showExploreDetailsDrawer ? 'Hide Advanced Details' : '🔍 Explore Details Matrix'}
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Modal Main Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-xs">

                    {/* Top Metric & Days In Storage Summary Card */}
                    <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-md">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">

                            {/* Harvesting Date & Selling Date Picker */}
                            <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Selling Date</span>
                                <input 
                                    type="date" 
                                    value={sellingDate}
                                    onChange={e => setSellingDate(e.target.value)}
                                    className="bg-transparent text-white font-black text-xs outline-none mt-1 w-full"
                                />
                                <span className="text-[10px] font-bold text-amber-400 mt-1 block flex items-center gap-1">
                                    ⏳ {daysInStorage} {daysInStorage === 1 ? 'Day' : 'Days'} Storage
                                </span>
                            </div>

                            {/* Harvest Yield */}
                            <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Harvest Yield</span>
                                <span className="text-base sm:text-lg font-black text-emerald-400 mt-1 block">
                                    {totalAvailableKg.toFixed(1)} <span className="text-xs text-slate-400">KG</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">{defaultBoxes} Boxes / {defaultPunnets} Punnets</span>
                            </div>

                            {/* Gross Revenue */}
                            <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Gross Sales Rev.</span>
                                <span className="text-base sm:text-lg font-black text-sky-400 mt-1 block">
                                    {formatCurrency(grossRevenue)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                    @{varietyCalculations.avgPrice.toFixed(2)} {currency}/KG
                                </span>
                            </div>

                            {/* Total Deductions / OPEX */}
                            <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Total OPEX & Logistics</span>
                                <span className="text-base sm:text-lg font-black text-rose-400 mt-1 block">
                                    {formatCurrency(totalAllExpenses)}
                                </span>
                                <span className="text-[10px] text-slate-400">Harvest + Freight + Loaders</span>
                            </div>

                            {/* Net Revenue */}
                            <div className="bg-emerald-950/80 p-3 rounded-xl border border-emerald-500/40 col-span-2 sm:col-span-1">
                                <span className="block text-[9px] font-black uppercase text-emerald-300 tracking-wider">NET REVENUE</span>
                                <span className="text-base sm:text-lg font-black text-emerald-300 mt-1 block">
                                    {formatCurrency(netRevenue)}
                                </span>
                                <span className="text-[10px] text-emerald-400/80 font-extrabold">Net Profit Margin</span>
                            </div>
                        </div>
                    </div>

                    {/* Step 1: Selling Process Status Option (DIRECT_WHOLESALE vs PARTLY_SOLD vs REFRIGERATOR) */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
                            Status Option / Commercial Destination (სტატუსი და განთავსების ოპცია)
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setFulfillmentType('DIRECT_WHOLESALE');
                                    setSoldKg(totalAvailableKg);
                                }}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-1.5 ${fulfillmentType === 'DIRECT_WHOLESALE' ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Banknote className="w-4 h-4 text-emerald-600" /> Direct Wholesale
                                    </span>
                                    {fulfillmentType === 'DIRECT_WHOLESALE' && <CheckIcon className="w-5 h-5 text-emerald-600" />}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-normal">
                                    Sell 100% of harvest directly upon pick up. No cold storage required.
                                </p>
                                <span className="text-xs font-black text-emerald-700 block">
                                    {totalAvailableKg.toFixed(1)} KG Whole Sale
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setFulfillmentType('PARTLY_SOLD');
                                    setSoldKg(Math.round(totalAvailableKg * 0.6));
                                }}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-1.5 ${fulfillmentType === 'PARTLY_SOLD' ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-amber-600" /> Partly Sold + Refrigerator
                                    </span>
                                    {fulfillmentType === 'PARTLY_SOLD' && <CheckIcon className="w-5 h-5 text-amber-600" />}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-normal">
                                    Sell a split portion now, auto-transfer remainder to cold storage.
                                </p>
                                <span className="text-xs font-black text-amber-700 block">
                                    Split Sale Allocation
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setFulfillmentType('REFRIGERATOR');
                                    setSoldKg(0);
                                }}
                                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-1.5 ${fulfillmentType === 'REFRIGERATOR' ? 'bg-sky-50/90 border-sky-500 ring-2 ring-sky-500/20 text-sky-950 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Snowflake className="w-4 h-4 text-sky-600" /> 100% Refrigerator
                                    </span>
                                    {fulfillmentType === 'REFRIGERATOR' && <CheckIcon className="w-5 h-5 text-sky-600" />}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-normal">
                                    Store total yield in refrigerator cooling facility for future sales.
                                </p>
                                <span className="text-xs font-black text-sky-700 block">
                                    {totalAvailableKg.toFixed(1)} KG Stored
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Step 2: Main Sales Controls & Multi-Variety Matrix */}
                    {fulfillmentType !== 'REFRIGERATOR' && (
                        <div className="bg-emerald-50/40 p-4 md:p-5 rounded-2xl border border-emerald-200/80 space-y-4">
                            <div className="flex justify-between items-center border-b border-emerald-200/60 pb-3">
                                <h3 className="font-black text-xs uppercase tracking-wide text-emerald-900 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-600" /> Sales Quantities, Variety Prices & Buyers
                                </h3>
                                <span className="text-[10px] font-black text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                                    Gross Revenue: {formatCurrency(grossRevenue)}
                                </span>
                            </div>

                            {/* Main Input Row: Sold KG, Price per KG, Primary Buyer */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {fulfillmentType === 'PARTLY_SOLD' && (
                                    <div>
                                        <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                                            Sold Quantity (Net KG)
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            max={totalAvailableKg}
                                            value={soldKg}
                                            onChange={e => {
                                                const val = Number(e.target.value);
                                                setSoldKg(val);
                                                // Adjust first variety
                                                setVarietyDetails(prev => prev.map((v, i) => i === 0 ? { ...v, soldKg: Math.min(val, v.availableKg) } : v));
                                            }}
                                            className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <span className="text-[9px] text-amber-700 font-extrabold mt-1 block">
                                            🧊 Remainder to Refrigerator: <strong>{remainderForRefrigerator.toFixed(1)} KG</strong>
                                        </span>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                                        Default Price per KG ({currency})
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={overallPricePerKg}
                                        onChange={e => {
                                            const p = Number(e.target.value);
                                            setOverallPricePerKg(p);
                                            setVarietyDetails(prev => prev.map(v => ({ ...v, pricePerKg: p })));
                                        }}
                                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[10px] font-extrabold text-slate-600 uppercase">
                                            Buyer Name(s)
                                        </label>
                                        <button 
                                            type="button" 
                                            onClick={() => setIsMultiBuyerMode(!isMultiBuyerMode)}
                                            className="text-[9px] font-black text-emerald-700 hover:underline uppercase"
                                        >
                                            {isMultiBuyerMode ? 'Single Buyer' : '+ Multi-Buyer'}
                                        </button>
                                    </div>

                                    {!isMultiBuyerMode ? (
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Enter buyer or select from list..."
                                                list="buyer-suggestions-list"
                                                value={singleBuyerName}
                                                onChange={e => setSingleBuyerName(e.target.value)}
                                                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                            <datalist id="buyer-suggestions-list">
                                                {buyersMemory.map((b, idx) => (
                                                    <option key={idx} value={b} />
                                                ))}
                                            </datalist>
                                        </div>
                                    ) : (
                                        <div className="p-2 bg-white rounded-xl border border-slate-200 text-slate-700">
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {buyerAllocations.length} Buyers Configured ({buyerAllocations.reduce((a,b)=>a+b.weightKg,0)} KG)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Varieties Multi-Check & Individual Weight/Price Matrix */}
                            <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 space-y-3">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <span className="text-[10px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                                        🍇 Varieties Multi-Check & Individual Pricing Breakdown
                                    </span>
                                    <span className="text-[10px] font-extrabold text-slate-500">
                                        Selected: {varietyCalculations.totalKg.toFixed(1)} KG = {formatCurrency(varietyCalculations.totalRev)}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {varietyDetails.map((v, idx) => (
                                        <div key={v.variety} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-colors">
                                            <label className="flex items-center gap-2 min-w-[120px] cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={v.isSelected}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setVarietyDetails(prev => prev.map((item, i) => i === idx ? { ...item, isSelected: checked } : item));
                                                    }}
                                                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                                />
                                                <span className="font-extrabold text-xs text-slate-900">
                                                    {v.variety}
                                                </span>
                                            </label>

                                            {v.isSelected && (
                                                <div className="flex flex-1 items-center gap-2">
                                                    <div className="flex-1 min-w-[100px]">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Weight (KG)</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setVarietyDetails(prev => prev.map((item, i) => i === idx ? { ...item, soldKg: item.availableKg } : item));
                                                                }}
                                                                className="text-[8px] px-1.5 py-0.5 bg-sky-100 text-sky-600 hover:bg-sky-200 rounded font-bold uppercase transition-colors"
                                                            >
                                                                Sell Max
                                                            </button>
                                                        </div>
                                                        <input 
                                                            type="number" 
                                                            step="any" 
                                                            value={v.soldKg}
                                                            onChange={e => {
                                                                const val = Number(e.target.value);
                                                                setVarietyDetails(prev => prev.map((item, i) => i === idx ? { ...item, soldKg: val } : item));
                                                            }}
                                                            className="w-full p-1.5 bg-white border border-slate-200 rounded font-black text-slate-800 text-xs"
                                                        />
                                                        <div className="mt-1 text-[8px] font-semibold flex justify-between">
                                                            <span className="text-slate-400">Available: {v.availableKg.toFixed(1)} KG</span>
                                                            <span className={v.availableKg - v.soldKg < 0 ? 'text-red-500' : 'text-emerald-500'}>
                                                                Left: {Math.max(0, v.availableKg - v.soldKg).toFixed(1)} KG
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 min-w-[100px] self-start mt-[18px]">
                                                        <span className="text-[8px] font-bold text-slate-400 block uppercase mb-1">Price ({currency}/KG)</span>
                                                        <input 
                                                            type="number" 
                                                            step="any" 
                                                            value={v.pricePerKg}
                                                            onChange={e => {
                                                                const val = Number(e.target.value);
                                                                setVarietyDetails(prev => prev.map((item, i) => i === idx ? { ...item, pricePerKg: val } : item));
                                                            }}
                                                            className="w-full p-1.5 bg-white border border-slate-200 rounded font-black text-emerald-700 text-xs"
                                                        />
                                                    </div>

                                                    <div className="w-[90px] text-right self-start mt-[18px]">
                                                        <span className="text-[8px] font-bold text-slate-400 block uppercase mb-1">Subtotal</span>
                                                        <span className="font-black text-xs text-emerald-700">
                                                            {formatCurrency(v.soldKg * v.pricePerKg)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Logistics & Transport Section (Toggle YES/NO) */}
                    <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-slate-700" /> Transport & Logistics Costs (ტრანსპორტირება და მტვირთავები)
                            </label>

                            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-extrabold text-slate-500 px-2">Needs Transport?</span>
                                <button
                                    type="button"
                                    onClick={() => setNeedsTransport(false)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${!needsTransport ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    NO (Buyer Pickup)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNeedsTransport(true)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${needsTransport ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    YES (Owner Delivery)
                                </button>
                            </div>
                        </div>

                        {needsTransport && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 bg-white p-3 rounded-xl border border-slate-200">
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">CAR / Vehicle & Driver Cost</label>
                                    <div className="space-y-1">
                                        <input 
                                            type="text" 
                                            placeholder="Ford Transit #1 / Truck" 
                                            value={vehicleInfo} 
                                            onChange={e => setVehicleInfo(e.target.value)} 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" 
                                        />
                                        <div className="flex gap-1">
                                            <input 
                                                type="text" 
                                                placeholder="Driver Name" 
                                                value={driverName} 
                                                onChange={e => setDriverName(e.target.value)} 
                                                className="w-2/3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" 
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="Cost" 
                                                value={driverCost || ''} 
                                                onChange={e => setDriverCost(Number(e.target.value))} 
                                                className="w-1/3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-rose-600" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">WORKERS / Loaders Names & Wages</label>
                                    <div className="space-y-1">
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Malkhaz, Vakhtang" 
                                            value={loadersNames} 
                                            onChange={e => setLoadersNames(e.target.value)} 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" 
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Total Loaders Wage" 
                                            value={loadersCost || ''} 
                                            onChange={e => setLoadersCost(Number(e.target.value))} 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-rose-600" 
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">OTHER (Used Materials & Pallets)</label>
                                    <div className="space-y-1">
                                        <input 
                                            type="text" 
                                            placeholder="Pallets, straps, packaging..." 
                                            value={materialsDescription} 
                                            onChange={e => setMaterialsDescription(e.target.value)} 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" 
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Materials Cost" 
                                            value={materialsCost || ''} 
                                            onChange={e => setMaterialsCost(Number(e.target.value))} 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-rose-600" 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 4: Financial Deposit & Recipient Section (CASH vs LTD) */}
                    {fulfillmentType !== 'REFRIGERATOR' && (
                        <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200 space-y-3">
                            <label className="block text-[10px] font-black uppercase text-slate-600">
                                DEPOSIT & Payment Method (გადახდის დეპოზიტი და მიმღები)
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* CASH Option */}
                                <div className={`p-3.5 rounded-xl border transition-all ${paymentType === 'CASH' ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400/20' : 'bg-white border-slate-200'}`}>
                                    <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer mb-2">
                                        <input 
                                            type="radio" 
                                            name="paytype"
                                            checked={paymentType === 'CASH'} 
                                            onChange={() => setPaymentType('CASH')} 
                                            className="w-4 h-4 text-emerald-600"
                                        />
                                        💵 CASH Settlement
                                    </label>

                                    {paymentType === 'CASH' && (
                                        <div className="space-y-2 pl-6">
                                            <div className="flex gap-3 text-[10px] font-extrabold text-slate-600">
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input type="radio" checked={paymentMode === 'HAND'} onChange={() => setPaymentMode('HAND')} /> Paid on Hand
                                                </label>
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input type="radio" checked={paymentMode === 'BANK'} onChange={() => setPaymentMode('BANK')} /> Bank Deposit by Staff
                                                </label>
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Recipient Manager / Founder</label>
                                                <input
                                                    type="text"
                                                    list="founders-list"
                                                    value={cashRecipient}
                                                    onChange={e => setCashRecipient(e.target.value)}
                                                    placeholder="Select or type recipient name..."
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <datalist id="founders-list">
                                                    {employees.filter(emp => {
                                                        const empRole = roles.find(r => r.id === emp.roleId);
                                                        if (!empRole) return false;
                                                        const nameUpper = empRole.name.toUpperCase();
                                                        return nameUpper.includes('FOUNDER') || nameUpper.includes('OWNER') || nameUpper.includes('ADMIN') || nameUpper.includes('MANAGER') || empRole.permissions.includes('admin_access');
                                                    }).map((staff, i) => {
                                                        const empRole = roles.find(r => r.id === staff.roleId);
                                                        return <option key={i} value={staff.name}>{staff.name} ({empRole?.name})</option>;
                                                    })}
                                                    {KNOWN_STAFF_RECIPIENTS.map((staff, i) => (
                                                        <option key={`fallback-${i}`} value={staff.name}>{staff.name} ({staff.role})</option>
                                                    ))}
                                                </datalist>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* LTD Bank Account Option */}
                                <div className={`p-3.5 rounded-xl border transition-all ${paymentType === 'LTD' ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400/20' : 'bg-white border-slate-200'}`}>
                                    <label className="flex items-center gap-2 font-black text-xs text-slate-900 cursor-pointer mb-2">
                                        <input 
                                            type="radio" 
                                            name="paytype"
                                            checked={paymentType === 'LTD'} 
                                            onChange={() => setPaymentType('LTD')} 
                                            className="w-4 h-4 text-emerald-600"
                                        />
                                        🏦 LTD Bank Account Transfer
                                    </label>

                                    {paymentType === 'LTD' && (
                                        <div className="space-y-2 pl-6">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Company Bank Account</label>
                                                <select
                                                    value={selectedBankAccountId}
                                                    onChange={e => setSelectedBankAccountId(e.target.value)}
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                                                >
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                                                    ))}
                                                    <option value="bog-ltd">Bank of Georgia (GEL LLC)</option>
                                                    <option value="tbc-ltd">TBC Bank (GEL LLC)</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Transfer Reference / Details</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Invoice # or Payer Company..." 
                                                    value={bankTransferRef}
                                                    onChange={e => setBankTransferRef(e.target.value)}
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Refrigerator Lot Details (If REFRIGERATOR or PARTLY_SOLD) */}
                    {fulfillmentType !== 'DIRECT_WHOLESALE' && (
                        <div className="bg-sky-50/50 p-4 md:p-5 rounded-2xl border border-sky-200/80 space-y-3">
                            <h3 className="font-black text-xs uppercase tracking-wide text-sky-900 flex items-center gap-2">
                                <Snowflake className="w-4 h-4 text-sky-600" /> Refrigerator Cold Storage Transfer ({remainderForRefrigerator.toFixed(1)} KG)
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Arrival Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={arrivalDateTime}
                                        onChange={e => setArrivalDateTime(e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Day Price Benchmark ({currency}/KG)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={arrivalDayPricePerKg}
                                        onChange={e => setArrivalDayPricePerKg(Number(e.target.value))}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-black text-sky-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Room Placement & Bay</label>
                                    <input
                                        type="text"
                                        value={roomPlacementNotes}
                                        onChange={e => setRoomPlacementNotes(e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* SLIDE-OVER EXPLORE DETAILS DRAWER */}
                {showExploreDetailsDrawer && (
                    <div className="absolute inset-y-0 right-0 w-full sm:w-[450px] bg-slate-900 text-white z-[2010] shadow-2xl border-l border-slate-800 flex flex-col animate-slide-in">
                        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-amber-400" />
                                <h3 className="font-black text-sm text-white uppercase tracking-wider">Advanced Details Inspector</h3>
                            </div>
                            <button onClick={() => setShowExploreDetailsDrawer(false)} className="text-slate-400 hover:text-white">
                                <XCircleIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Inspector Navigation Tabs */}
                        <div className="flex border-b border-slate-800 bg-slate-900 p-1">
                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('VARIETIES')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeDetailTab === 'VARIETIES' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                            >
                                🍇 Varieties
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('BUYERS')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeDetailTab === 'BUYERS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                            >
                                👥 Multi-Buyer
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('LOGISTICS')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeDetailTab === 'LOGISTICS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                            >
                                🚚 Freight
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('FINANCE')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeDetailTab === 'FINANCE' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                            >
                                🏦 Ledger
                            </button>
                        </div>

                        {/* Inspector Tab Contents */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                            {activeDetailTab === 'VARIETIES' && (
                                <div className="space-y-3">
                                    <h4 className="font-black text-xs text-amber-400 uppercase">Variety Pricing Audit</h4>
                                    <p className="text-[10px] text-slate-400">
                                        Verify individual price points and weight allocation across harvested berry varieties.
                                    </p>
                                    <div className="space-y-2 pt-2">
                                        {varietyDetails.map(v => (
                                            <div key={v.variety} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                                                <div>
                                                    <span className="font-extrabold text-white text-xs">{v.variety}</span>
                                                    <span className="block text-[9px] text-slate-400">{v.soldKg.toFixed(1)} KG</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-emerald-400 text-xs">${v.pricePerKg}/KG</span>
                                                    <span className="block text-[9px] text-slate-400 font-bold">{formatCurrency(v.soldKg * v.pricePerKg)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'BUYERS' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-black text-xs text-amber-400 uppercase">Multi-Buyer Distribution</h4>
                                        <button onClick={handleAddBuyerRow} className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1">
                                            <PlusCircle className="w-3 h-3" /> Add Buyer
                                        </button>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        {buyerAllocations.map((buyer, idx) => (
                                            <div key={buyer.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-400">Buyer #{idx + 1}</span>
                                                    {buyerAllocations.length > 1 && (
                                                        <button onClick={() => handleRemoveBuyerRow(buyer.id)} className="text-rose-400 hover:text-rose-300">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <input 
                                                    type="text"
                                                    placeholder="Buyer Company Name..."
                                                    value={buyer.name}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setBuyerAllocations(prev => prev.map(b => b.id === buyer.id ? { ...b, name: val } : b));
                                                    }}
                                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white"
                                                />
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 font-bold block">Variety</span>
                                                        <select
                                                            value={buyer.variety}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setBuyerAllocations(prev => prev.map(b => b.id === buyer.id ? { ...b, variety: val } : b));
                                                            }}
                                                            className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-white"
                                                        >
                                                            {availableVarietiesList.map(v => (
                                                                <option key={v} value={v}>{v}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 font-bold block">Weight (KG)</span>
                                                        <input 
                                                            type="number"
                                                            value={buyer.weightKg}
                                                            onChange={e => {
                                                                const val = Number(e.target.value);
                                                                setBuyerAllocations(prev => prev.map(b => b.id === buyer.id ? { ...b, weightKg: val } : b));
                                                            }}
                                                            className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-white font-bold"
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 font-bold block">Price/KG</span>
                                                        <input 
                                                            type="number"
                                                            value={buyer.pricePerKg}
                                                            onChange={e => {
                                                                const val = Number(e.target.value);
                                                                setBuyerAllocations(prev => prev.map(b => b.id === buyer.id ? { ...b, pricePerKg: val } : b));
                                                            }}
                                                            className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-emerald-400 font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'LOGISTICS' && (
                                <div className="space-y-3">
                                    <h4 className="font-black text-xs text-amber-400 uppercase">Logistics & Loaders Detail</h4>
                                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-2">
                                        <div className="flex justify-between text-slate-300">
                                            <span>Driver & Freight:</span>
                                            <span className="font-black text-white">{driverName || 'None'} ({formatCurrency(driverCost)})</span>
                                        </div>
                                        <div className="flex justify-between text-slate-300">
                                            <span>Loaders Team:</span>
                                            <span className="font-black text-white">{loadersNames || 'None'} ({formatCurrency(loadersCost)})</span>
                                        </div>
                                        <div className="flex justify-between text-slate-300">
                                            <span>Materials & Pallets:</span>
                                            <span className="font-black text-white">{materialsDescription} ({formatCurrency(materialsCost)})</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'FINANCE' && (
                                <div className="space-y-3">
                                    <h4 className="font-black text-xs text-amber-400 uppercase">Financial P&L Statement</h4>
                                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-2 text-slate-300">
                                        <div className="flex justify-between">
                                            <span>Gross Revenue:</span>
                                            <span className="font-black text-emerald-400">{formatCurrency(grossRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between text-rose-400">
                                            <span>(-) Harvest OPEX:</span>
                                            <span className="font-bold">-{formatCurrency(harvestOpex)}</span>
                                        </div>
                                        <div className="flex justify-between text-rose-400">
                                            <span>(-) Logistics & Loaders:</span>
                                            <span className="font-bold">-{formatCurrency(totalTransportAndLogisticsCost)}</span>
                                        </div>
                                        <div className="border-t border-slate-700 pt-2 flex justify-between font-black text-sm text-white">
                                            <span>NET PROFIT:</span>
                                            <span className="text-emerald-400">{formatCurrency(netRevenue)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-[10px] text-slate-500 font-bold hidden sm:block">
                        Status: <span className="text-slate-900 font-black">{fulfillmentType}</span> | Net Revenue: <span className="text-emerald-700 font-black">{formatCurrency(netRevenue)}</span>
                    </div>

                    <div className="flex gap-3 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="px-7 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center gap-2"
                        >
                            <CheckIcon className="w-4 h-4 text-emerald-400" />
                            Confirm Commercial Settlement
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HarvestCommercialModal;
