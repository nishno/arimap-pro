import React, { useState, useMemo, useEffect } from 'react';
import type { 
    InventoryItem, User, Employee, StockChargeReasonCategory, 
    StockTransaction, InventoryTransaction 
} from '../types';
import { 
    XCircleIcon, AlertTriangleIcon, BeakerIcon, 
    CalendarDaysIcon, CheckIcon, SparklesIcon,
    ShieldCheckIcon, TagIcon, BanknotesIcon
} from './Icons';
import { ScanLine } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getInventoryEligibleEmployees } from '../utils/employeeFilters';
import QrScannerModal from './QrScannerModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { toast } from 'sonner';

export interface DirectStockChargeData {
    itemId: string;
    item: InventoryItem;
    deductedStockAmount: number;
    inputMode: 'PACKAGES' | 'MASS_VOLUME';
    enteredQuantity: number;
    equivalentMassVolume?: number;
    equivalentPackages?: number;
    chargeCategory: StockChargeReasonCategory;
    categoryLabel: string;
    note: string;
    date: string;
    responsibleEmployeeId?: string;
    responsibleEmployeeName?: string;
    chargedByUserId?: string;
    chargedByUserName: string;
    unitPriceAtCharge: number;
    totalCostCharged: number;
    stockBeforeCharge: number;
    stockAfterCharge: number;
}

interface DirectStockChargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    preselectedItem?: InventoryItem | null;
    inventoryItems: InventoryItem[];
    employees?: Employee[];
    currentUser: User | null;
    onConfirmCharge: (data: DirectStockChargeData) => void;
}

const REASON_CATEGORIES: { key: StockChargeReasonCategory; label: string; labelGe: string; icon: string; desc: string; descGe: string; color: string }[] = [
    { 
        key: 'DAMAGED_OR_SPILLED', 
        label: 'Damaged / Spilled by Worker', 
        labelGe: 'მუშის მიერ დაზიანებული / დაღვრილი', 
        icon: '💥', 
        desc: 'Accidental spill, broken packaging, bag puncture during transit or handling.',
        descGe: 'შემთხვევითი დაღვრა, დაზიანებული შეფუთვა, გახვრეტილი ტომარა ტრანსპორტირებისას.',
        color: 'border-red-200 bg-red-50 text-red-700 hover:border-red-400'
    },
    { 
        key: 'UNLOGGED_TREATMENT_OR_FEEDING', 
        label: 'Unlogged Field Feeding / Treatment', 
        labelGe: 'გვიან დაფიქსირებული კვება / წამლობა', 
        icon: '🚜', 
        desc: 'Field treatment or fertigation performed earlier but not filled in the app on time.',
        descGe: 'მორწყვა, კვება ან წამლობა ჩატარდა, მაგრამ აპლიკაციაში დროულად არ დაფიქსირდა.',
        color: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400'
    },
    { 
        key: 'SOLD_DIRECTLY', 
        label: 'Sold / Offloaded to 3rd Party', 
        labelGe: 'პირდაპირი გაყიდვა / გასხვისება', 
        icon: '💰', 
        desc: 'Direct sale, peer transfer, or inventory liquidated to external party.',
        descGe: 'პირდაპირი გაყიდვა, კოლეგაზე გადაცემა ან საწყობიდან გასხვისება.',
        color: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400'
    },
    { 
        key: 'EXPIRED_OR_DEGRADED', 
        label: 'Expired / Degraded / Not Needed', 
        labelGe: 'ვადაგასული / უვარგისი / ზედმეტი', 
        icon: '⏳', 
        desc: 'Past expiration date, crystallized, spoiled, or no longer usable in recipe.',
        descGe: 'გაუვიდა ვადა, დაკრისტალდა, გაფუჭდა ან აღარ გამოიყენება რეცეპტში.',
        color: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400'
    },
    { 
        key: 'INVENTORY_AUDIT_ADJUSTMENT', 
        label: 'Stock Audit / Count Correction', 
        labelGe: 'ინვენტარიზაციის კორექტირება', 
        icon: '📋', 
        desc: 'Physical warehouse count discrepancy adjustment.',
        descGe: 'საწყობის ფიზიკური აღწერის შემდეგ გამოვლენილი სხვაობის გასწორება.',
        color: 'border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-400'
    },
    { 
        key: 'DONATION_OR_TRANSFER', 
        label: 'Donation / Internal Transfer', 
        labelGe: 'ჩუქება / შიდა გადატანა', 
        icon: '🤝', 
        desc: 'Material transferred to another branch or donated.',
        descGe: 'მასალის გადაცემა სხვა ფილიალში, ნაკვეთზე ან ჩუქება.',
        color: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400'
    },
    { 
        key: 'OTHER', 
        label: 'Other Direct Expense / Write-off', 
        labelGe: 'სხვა პირდაპირი ხარჯი / ჩამოწერა', 
        icon: '📝', 
        desc: 'Custom reason or miscellaneous operational consumption.',
        descGe: 'სხვა ოპერაციული ხარჯი ან ინდივიდუალური ჩამოწერა.',
        color: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400'
    }
];

export const DirectStockChargeModal: React.FC<DirectStockChargeModalProps> = ({
    isOpen,
    onClose,
    preselectedItem,
    inventoryItems = [],
    employees = [],
    currentUser,
    onConfirmCharge
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    // Selected item state
    const [selectedItemId, setSelectedItemId] = useState<string>(preselectedItem?.id || (inventoryItems[0]?.id || ''));
    const [searchQuery, setSearchQuery] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [inputMode, setInputMode] = useState<'PACKAGES' | 'MASS_VOLUME'>('PACKAGES');
    const [enteredQty, setEnteredQty] = useState<number | ''>(1);
    const [selectedCategory, setSelectedCategory] = useState<StockChargeReasonCategory>('DAMAGED_OR_SPILLED');
    const [detailedNote, setDetailedNote] = useState('');
    const [chargeDate, setChargeDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
    const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<string>('');

    useEffect(() => {
        if (preselectedItem?.id) {
            setSelectedItemId(preselectedItem.id);
        } else if (inventoryItems.length > 0 && !selectedItemId) {
            setSelectedItemId(inventoryItems[0].id);
        }
    }, [preselectedItem, inventoryItems, selectedItemId]);

    const selectedItem = useMemo(() => {
        return inventoryItems.find(i => i.id === selectedItemId) || preselectedItem || inventoryItems[0];
    }, [inventoryItems, selectedItemId, preselectedItem]);

    const hasPackageContent = useMemo(() => {
        return !!(selectedItem?.packageContent && Number(selectedItem.packageContent) > 0);
    }, [selectedItem]);

    useEffect(() => {
        if (!hasPackageContent) {
            setInputMode('PACKAGES');
        }
    }, [hasPackageContent]);

    const filteredItemList = useMemo(() => {
        if (!searchQuery.trim()) return inventoryItems;
        const q = searchQuery.toLowerCase();
        return inventoryItems.filter(i => 
            i.name.toLowerCase().includes(q) || 
            (i.sku && i.sku.toLowerCase().includes(q)) ||
            i.category.toLowerCase().includes(q)
        );
    }, [inventoryItems, searchQuery]);

    const eligibleEmployees = useMemo(() => {
        return getInventoryEligibleEmployees(employees);
    }, [employees]);

    const qty = typeof enteredQty === 'number' ? enteredQty : 0;
    const pkgSize = Number(selectedItem?.packageContent) || 1;

    const deductedStockAmount = useMemo(() => {
        if (inputMode === 'MASS_VOLUME' && hasPackageContent) {
            return Number((qty / pkgSize).toFixed(4));
        }
        return qty;
    }, [qty, inputMode, hasPackageContent, pkgSize]);

    const equivalentMassVolume = useMemo(() => {
        if (!hasPackageContent) return undefined;
        if (inputMode === 'PACKAGES') {
            return Number((qty * pkgSize).toFixed(2));
        }
        return qty;
    }, [qty, inputMode, hasPackageContent, pkgSize]);

    const equivalentPackages = useMemo(() => {
        if (!hasPackageContent) return undefined;
        if (inputMode === 'MASS_VOLUME') {
            return Number((qty / pkgSize).toFixed(2));
        }
        return qty;
    }, [qty, inputMode, hasPackageContent, pkgSize]);

    const unitPrice = selectedItem?.unitCost || 0;
    const totalCostCharged = useMemo(() => {
        return Number((deductedStockAmount * unitPrice).toFixed(2));
    }, [deductedStockAmount, unitPrice]);

    const stockBefore = selectedItem?.currentStock || 0;
    const stockAfter = useMemo(() => {
        return Number((stockBefore - deductedStockAmount).toFixed(4));
    }, [stockBefore, deductedStockAmount]);

    const isExceedingStock = stockAfter < 0;

    if (!isOpen) return null;

    const currentUserName = (currentUser as any)?.displayName || currentUser?.name || (isKa ? 'ადმინისტრატორი' : 'Admin');
    const responsibleEmp = employees.find(e => e.id === responsibleEmployeeId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) {
            alert(isKa ? "გთხოვთ აირჩიოთ ნივთი." : "Please select an item to charge.");
            return;
        }

        if (qty <= 0) {
            alert(isKa ? "გთხოვთ შეიყვანოთ 0-ზე მეტი რაოდენობა." : "Please enter a valid positive quantity to charge.");
            return;
        }

        if (!detailedNote.trim()) {
            alert(isKa ? "გთხოვთ მიუთითოთ ჩამოწერის მიზეზის განმარტება აუდიტისთვის." : "Please write a mandatory explanation note for the audit ledger.");
            return;
        }

        const categoryObj = REASON_CATEGORIES.find(c => c.key === selectedCategory);

        const chargePayload: DirectStockChargeData = {
            itemId: selectedItem.id,
            item: selectedItem,
            deductedStockAmount,
            inputMode,
            enteredQuantity: qty,
            equivalentMassVolume,
            equivalentPackages,
            chargeCategory: selectedCategory,
            categoryLabel: isKa ? (categoryObj?.labelGe || 'პირდაპირი ჩამოწერა') : (categoryObj?.label || 'Direct Charge'),
            note: detailedNote.trim(),
            date: new Date(chargeDate).toISOString(),
            responsibleEmployeeId: responsibleEmployeeId || undefined,
            responsibleEmployeeName: responsibleEmp?.name || undefined,
            chargedByUserId: currentUser?.id || undefined,
            chargedByUserName: currentUserName,
            unitPriceAtCharge: unitPrice,
            totalCostCharged,
            stockBeforeCharge: stockBefore,
            stockAfterCharge: stockAfter
        };

        onConfirmCharge(chargePayload);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/75 z-[6000] flex items-center justify-center p-3 md:p-6 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-scale-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="p-6 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white flex justify-between items-start flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                <SparklesIcon className="w-3.5 h-3.5" />
                                {isKa ? 'პირდაპირი ჩამოწერა საწყობიდან' : 'DIRECT STOCK WRITE-OFF & CHARGE'}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black mt-2 tracking-tight">
                            {isKa ? 'ნივთის ჩამოწერა საწყობიდან' : 'Charge Item Directly From Stock'}
                        </h2>
                        <p className="text-xs text-rose-200/90 mt-1 max-w-xl leading-relaxed">
                            {isKa 
                                ? 'ჩამოწერეთ დაზიანებული სასუქი, გაყიდვები, ვადაგასული ან გვიან დაფიქსირებული კვება/წამლობა მკაცრი აუდიტის ჩანაწერით.'
                                : 'Spend or write off items directly for damaged fertilizer bags, external sales, expired goods, or unlogged field feedings/treatments with mandatory audit logging.'
                            }
                        </p>
                    </div>

                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer">
                        <XCircleIcon className="w-7 h-7" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800 text-xs">
                    
                    {/* Item Selector & Info Card */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <BeakerIcon className="w-4 h-4 text-rose-600" />
                                {isKa ? '1. აირჩიეთ ჩამოსაწერი ნივთი' : '1. Select Stock Item to Charge'}
                            </label>
                            {selectedItem && (
                                <span className="text-[10px] font-bold text-slate-500">
                                    SKU: <strong className="text-slate-800">{selectedItem.sku || 'N/A'}</strong> • {isKa ? 'კატეგორია:' : 'Category:'} <strong className="text-slate-800">{selectedItem.category}</strong>
                                </span>
                            )}
                        </div>

                        {/* Search / Select Dropdown */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="flex-1">
                                <select
                                    value={selectedItemId}
                                    onChange={e => {
                                        setSelectedItemId(e.target.value);
                                        setEnteredQty(1);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all cursor-pointer shadow-sm"
                                    required
                                >
                                    {filteredItemList.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({item.currentStock} {item.unitOfMeasure} {isKa ? 'ხელმისაწვდომია' : 'available'}) — {formatCurrency(item.unitCost)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full sm:w-48">
                                <input
                                    type="text"
                                    placeholder={isKa ? "ნივთების გაფილტვრა..." : "Filter items..."}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3 py-3 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsScannerOpen(true)}
                                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm"
                                title={isKa ? "მასალის / აგროინპუტის QR სკანირება ჩამოსაწერად" : "Scan Material QR Code to charge"}
                            >
                                <ScanLine size={16} className="text-emerald-400" />
                                <span>{isKa ? 'QR სკანირება' : 'Scan QR'}</span>
                            </button>
                        </div>

                        {/* Item Current Details Card */}
                        {selectedItem && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-500 block">{isKa ? 'მიმდინარე ნაშთი' : 'Available in Stock'}</span>
                                    <strong className="text-sm font-black text-slate-900">
                                        {selectedItem.currentStock} {selectedItem.unitOfMeasure}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-500 block">{isKa ? 'შეფუთვის მოცულობა' : 'Package Size'}</span>
                                    <strong className="text-sm font-black text-indigo-600">
                                        {selectedItem.packageContent ? `${selectedItem.packageContent} ${selectedItem.packageContentUnit || selectedItem.unitOfMeasure}` : '1.0 Unit'}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-500 block">{isKa ? 'ერთეულის ფასი' : 'Unit Cost'}</span>
                                    <strong className="text-sm font-black text-emerald-600">
                                        {formatCurrency(selectedItem.unitCost)}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-500 block">{isKa ? 'ლოკაცია' : 'Location'}</span>
                                    <strong className="text-xs font-bold text-slate-700 truncate block mt-0.5">
                                        {selectedItem.location || (isKa ? 'მთავარი საწყობი' : 'Central Depot')}
                                    </strong>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quantity & Unit Input Section */}
                    <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                                    <TagIcon className="w-4 h-4 text-rose-600" />
                                    {isKa ? '2. ჩამოსაწერი რაოდენობა და ერთეული' : '2. Quantity to Charge'}
                                </label>
                                <p className="text-[10px] text-slate-500 font-medium">
                                    {isKa 
                                        ? `მიუთითეთ რაოდენობა ${selectedItem?.unitOfMeasure || 'ერთეულებში'} ${hasPackageContent ? `ან პირდაპირ სუფთა წონით/მოცულობით (${selectedItem?.packageContentUnit || 'კგ/ლ'})` : ''}.`
                                        : `Specify quantity in ${selectedItem?.unitOfMeasure || 'units'} ${hasPackageContent ? `or directly in total ${selectedItem?.packageContentUnit || 'kg/L'}` : ''}.`
                                    }
                                </p>
                            </div>

                            {/* Dual mode toggle if item has package mass/vol */}
                            {hasPackageContent && (
                                <div className="flex bg-white rounded-xl p-1 border border-slate-300 shadow-sm self-start sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('PACKAGES')}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            inputMode === 'PACKAGES' 
                                                ? 'bg-rose-600 text-white shadow-sm' 
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        {isKa ? `შეფუთვებით (${selectedItem?.unitOfMeasure || 'ტომარა'})` : `In ${selectedItem?.unitOfMeasure || 'Packages'}`}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('MASS_VOLUME')}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            inputMode === 'MASS_VOLUME' 
                                                ? 'bg-rose-600 text-white shadow-sm' 
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        {isKa ? `მასით (${selectedItem?.packageContentUnit || 'კგ / ლ'})` : `In ${selectedItem?.packageContentUnit || 'KG / L'}`}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Numeric Input & Conversion Display */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <div className="sm:col-span-2 relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={enteredQty}
                                    onChange={e => setEnteredQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 text-lg font-black text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                                    placeholder={isKa ? "შეიყვანეთ რაოდენობა..." : "Enter quantity..."}
                                    required
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs uppercase">
                                    {inputMode === 'PACKAGES' ? (selectedItem?.unitOfMeasure || (isKa ? 'ერთეული' : 'Units')) : (selectedItem?.packageContentUnit || (isKa ? 'კგ/ლ' : 'kg/L'))}
                                </span>
                            </div>

                            {/* Live Conversion preview */}
                            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase block">{isKa ? 'ჩამოწერილი ღირებულება' : 'Total Deducted Value'}</span>
                                <div className="text-sm font-black text-rose-600 mt-0.5">
                                    {formatCurrency(totalCostCharged)}
                                </div>
                            </div>
                        </div>

                        {/* Stock Balance Live Preview Bar */}
                        <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-2 ${
                            isExceedingStock 
                                ? 'bg-red-100 border-red-300 text-red-900' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        }`}>
                            <div className="flex items-center gap-2">
                                {isExceedingStock ? (
                                    <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                                ) : (
                                    <CheckIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                )}
                                <div>
                                    <div className="font-black text-xs">
                                        {isKa ? 'ნაშთი:' : 'Stock Before:'} <strong>{stockBefore} {selectedItem?.unitOfMeasure}</strong> ➔ {isKa ? 'ჩამოწერა:' : 'Deducting:'} <strong>-{deductedStockAmount} {selectedItem?.unitOfMeasure}</strong>
                                        {hasPackageContent && ` (${equivalentMassVolume} ${selectedItem?.packageContentUnit})`}
                                    </div>
                                    <div className="text-[10px] opacity-80 font-bold">
                                        {isKa ? 'დარჩენილი ნაშთი:' : 'Resulting Balance:'} <strong>{stockAfter} {selectedItem?.unitOfMeasure}</strong>
                                    </div>
                                </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider self-start sm:self-auto ${
                                isExceedingStock ? 'bg-red-200 text-red-900' : 'bg-emerald-200 text-emerald-900'
                            }`}>
                                {isExceedingStock ? (isKa ? '⚠️ აჭარბებს ნაშთს' : '⚠️ Exceeds In-Stock') : (isKa ? '✓ ხელმისაწვდომია' : '✓ In-Stock Available')}
                            </span>
                        </div>
                    </div>

                    {/* Reason Category Selection (Grid of Quick Pills) */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <AlertTriangleIcon className="w-4 h-4 text-amber-600" />
                            {isKa ? '3. ჩამოწერის მიზეზი და კატეგორია' : '3. Why are you charging this item?'}
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {REASON_CATEGORIES.map(cat => {
                                const isSelected = selectedCategory === cat.key;
                                return (
                                    <div
                                        key={cat.key}
                                        onClick={() => setSelectedCategory(cat.key)}
                                        className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/80 shadow-sm' 
                                                : cat.color
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{cat.icon}</span>
                                            <div className="min-w-0">
                                                <div className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                                                    {isKa ? cat.labelGe : cat.label}
                                                    {isSelected && <span className="text-rose-600 font-black text-[10px]">✓</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1 pl-7 leading-tight font-medium">
                                            {isKa ? cat.descGe : cat.desc}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Operational Context: Date, Responsible Operator & Detailed Note */}
                    <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Date & Time of Occurrence */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'ოპერაციის თარიღი და დრო:' : 'Date & Time of Operation:'}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={chargeDate}
                                    onChange={e => setChargeDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                    required
                                />
                                <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
                                    {isKa ? '* დასაშვებია წარსული თარიღის მითითება.' : '* Backdating allowed for past unlogged treatments or earlier damages.'}
                                </span>
                            </div>

                            {/* Responsible Worker / Operator */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'პასუხისმგებელი მუშა / ოპერატორი:' : 'Responsible Worker / Operator:'}
                                </label>
                                <select
                                    value={responsibleEmployeeId}
                                    onChange={e => setResponsibleEmployeeId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                                >
                                    <option value="">-- {isKa ? `ავტორიზებული მომხმარებელი (${currentUserName})` : `Assigned to Logged User (${currentUserName})`} --</option>
                                    {eligibleEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.role || emp.employeeType})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Mandatory Note / Explanation */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                    <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-600" />
                                    {isKa ? 'სავალდებულო განმარტება / აუდიტის ჩანაწერი:' : 'Mandatory Explanation Note:'} <span className="text-rose-600">*</span>
                                </label>
                                <span className="text-[9px] text-slate-400 font-bold">{isKa ? 'აუდიტისთვის სავალდებულოა' : 'Required for audit log'}</span>
                            </div>
                            <textarea
                                value={detailedNote}
                                onChange={e => setDetailedNote(e.target.value)}
                                rows={3}
                                required
                                placeholder={isKa ? "მაგ. 2 ტომარა დაზიანდა ტრაქტორზე დატვირთვისას; ან 50 კგ კალიუმის ნიტრატი ჩაიყარა მიქსერში სამშაბათს..." : "E.g., 2 bags damaged by worker Giorgi during loading on tractor; or 50kg Potassium Nitrate added to mixing tank on Tuesday without app sync..."}
                                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 font-medium text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Audit Stamp Info */}
                        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between text-indigo-950 text-[11px]">
                            <div className="flex items-center gap-2">
                                <ShieldCheckIcon className="w-4 h-4 text-indigo-600" />
                                <span>
                                    {isKa ? 'აუდიტის შტამპი:' : 'Audit Stamp:'} {isKa ? 'ჩაწერილია' : 'Recorded by'} <strong>{currentUserName}</strong> {isKa ? '-ს მიერ' : ''} ({new Date().toLocaleDateString()})
                                </span>
                            </div>
                            <span className="font-black text-[10px] uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-lg">
                                {isKa ? 'უცვლელი ჩანაწერი' : 'Immutable Log'}
                            </span>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
                        >
                            {isKa ? 'გაუქმება' : 'Cancel'}
                        </button>

                        <button
                            type="submit"
                            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-rose-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <CheckIcon className="w-4 h-4" />
                            {isKa ? 'ჩამოწერის დადასტურება & შენახვა' : 'Confirm Direct Stock Charge & Log Audit'}
                        </button>
                    </div>
                </form>
            </div>

            {isScannerOpen && (
                <QrScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    title={isKa ? "მასალის QR სკანერი (საწყობიდან ჩამოწერა)" : "Material QR Scanner (Direct Stock Charge)"}
                    description={isKa ? "დაასკანერეთ მასალის, სასუქის ან აგრო-ინპუტის QR კოდი" : "Scan material, fertilizer or agro-input batch QR code"}
                    mockItems={inventoryItems}
                    onScan={(scannedResult) => {
                        const parsed = parseUniversalScan(scannedResult, employees, inventoryItems, 'supplies', 'charge');
                        setIsScannerOpen(false);

                        if (parsed.material && parsed.material.materialId) {
                            const matched = inventoryItems.find(i => 
                                i.id === parsed.material?.materialId || 
                                (i.sku && i.sku === parsed.material?.sku) ||
                                (i.name && parsed.material?.materialName && i.name.toLowerCase() === parsed.material.materialName.toLowerCase())
                            );

                            if (matched) {
                                setSelectedItemId(matched.id);
                                if (parsed.material.quantity && parsed.material.quantity > 0) {
                                    setEnteredQty(parsed.material.quantity);
                                }
                                setDetailedNote(isKa ? `ჩამოწერილია QR სკანირებით (${parsed.material.batchId || 'პარტია'})` : `Charged via QR scan (${parsed.material.batchId || 'batch'})`);
                                toast.success(isKa ? `არჩეულია: ${matched.name}` : `Selected: ${matched.name}`);
                                return;
                            }
                        }

                        // Try direct lookup
                        const directMatch = inventoryItems.find(i => 
                            i.id === scannedResult || 
                            i.sku === scannedResult || 
                            (i.name && scannedResult.toLowerCase().includes(i.name.toLowerCase()))
                        );

                        if (directMatch) {
                            setSelectedItemId(directMatch.id);
                            toast.success(isKa ? `არჩეულია: ${directMatch.name}` : `Selected: ${directMatch.name}`);
                        } else {
                            toast.warning(isKa ? `ნივთი ვერ მოიძებნა: ${scannedResult}` : `Item not found for code: ${scannedResult}`);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default DirectStockChargeModal;
