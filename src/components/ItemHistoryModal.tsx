import React, { useState, useMemo } from 'react';
import type { InventoryItem, InventoryTransaction, WorkAssignment, PurchaseOrder, StockTransaction } from '../types';
import { 
    XCircleIcon, 
    ArrowPathIcon,
    CheckIcon,
    AlertTriangleIcon,
    BanknotesIcon,
    BeakerIcon,
    ShieldCheckIcon
} from './Icons';
import { 
    Clock, 
    User, 
    RotateCcw, 
    History, 
    TrendingUp, 
    TrendingDown, 
    Search, 
    Filter,
    Calendar,
    Download,
    FileSpreadsheet,
    Layers,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
    ShieldCheck
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

interface ItemHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem;
    transactions: InventoryTransaction[];
    workAssignments: WorkAssignment[];
    purchaseOrders: PurchaseOrder[];
    stockTransactions?: StockTransaction[];
    onRestoreStockVersion?: (restoredStock: number, reason: string, revertedTxId?: string) => Promise<void> | void;
}

interface UnifiedTransactionEntry {
    id: string;
    date: string;
    type: 'in' | 'out' | 'adjustment' | 'refund';
    quantity: number;
    title: string;
    badge: string;
    badgeColor: string;
    author: string;
    responsiblePerson?: string;
    note?: string;
    chargeCategory?: string;
    stockBefore?: number;
    stockAfter?: number;
    totalCost?: number;
    unitPrice?: number;
    sourceModule?: string;
    rawStockTx?: StockTransaction;
    rawInvTx?: InventoryTransaction;
}

const ItemHistoryModal: React.FC<ItemHistoryModalProps> = ({ 
    isOpen, 
    onClose, 
    item, 
    transactions = [], 
    workAssignments = [], 
    purchaseOrders = [],
    stockTransactions = [],
    onRestoreStockVersion
}) => {
    const { language, formatCurrency } = useLanguage();
    const isKa = language === 'ka';

    const [searchFilter, setSearchFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'in' | 'out' | 'adjustment'>('all');
    const [selectedTxToRevert, setSelectedTxToRevert] = useState<UnifiedTransactionEntry | null>(null);
    const [revertReason, setRevertReason] = useState('');
    const [isReverting, setIsReverting] = useState(false);

    // Merge and deduplicate InventoryTransaction and StockTransaction into a rich unified audit log
    const unifiedLogs = useMemo(() => {
        const list: UnifiedTransactionEntry[] = [];
        const seenIds = new Set<string>();

        // 1. Map StockTransactions (has deep direct charge metadata)
        const relevantStockTxs = stockTransactions.filter(st => st.itemId === item.id);
        relevantStockTxs.forEach(st => {
            seenIds.add(st.id);
            if (st.referenceId) seenIds.add(st.referenceId);

            let type: 'in' | 'out' | 'adjustment' | 'refund' = 'out';
            let badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
            let badge = isKa ? 'ჩამოწერა' : 'Stock Charge';

            if (st.type === 'ADDITION') {
                type = 'in';
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                badge = isKa ? 'შემოსავალი' : 'Addition';
            } else if (st.type === 'REFUND') {
                type = 'refund';
                badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                badge = isKa ? 'დაბრუნება / აღდგენა' : 'Reverted / Refund';
            } else if (st.chargeCategory === 'INVENTORY_AUDIT_ADJUSTMENT') {
                type = 'adjustment';
                badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
                badge = isKa ? 'ინვენტარიზაცია' : 'Audit Adjustment';
            }

            const categoryLabels: Record<string, string> = {
                'DAMAGED_OR_SPILLED': isKa ? 'დაზიანებული / დაღვრილი' : 'Damaged / Spilled',
                'UNLOGGED_TREATMENT_OR_FEEDING': isKa ? 'გვიან დაფიქსირებული კვება/წამლობა' : 'Unlogged Feeding/Treatment',
                'SOLD_DIRECTLY': isKa ? 'პირდაპირი გაყიდვა' : 'Direct Sale',
                'EXPIRED_OR_DEGRADED': isKa ? 'ვადაგასული / უვარგისი' : 'Expired / Degraded',
                'INVENTORY_AUDIT_ADJUSTMENT': isKa ? 'საწყობის აღწერის გასწორება' : 'Stock Audit Adjustment',
                'DONATION_OR_TRANSFER': isKa ? 'ჩუქება / შიდა გადატანა' : 'Donation / Transfer',
                'OTHER': isKa ? 'სხვა მიზეზი' : 'Other'
            };

            const title = st.reason || (st.chargeCategory ? categoryLabels[st.chargeCategory] || st.chargeCategory : (isKa ? 'მარაგის მოძრაობა' : 'Stock Movement'));

            list.push({
                id: st.id,
                date: st.date,
                type,
                quantity: st.quantity,
                title,
                badge,
                badgeColor,
                author: st.chargedByUserName || (isKa ? 'სისტემა' : 'System'),
                responsiblePerson: st.responsibleEmployeeName,
                note: st.note,
                chargeCategory: st.chargeCategory,
                stockBefore: st.stockBeforeCharge,
                stockAfter: st.stockAfterCharge,
                totalCost: st.totalCostCharged,
                unitPrice: st.unitPriceAtCharge,
                sourceModule: st.sourceModule,
                rawStockTx: st
            });
        });

        // 2. Map standard InventoryTransactions not already covered
        const relevantInvTxs = transactions.filter(t => t.itemId === item.id && !seenIds.has(t.id));
        relevantInvTxs.forEach(it => {
            let title = it.reason || (isKa ? 'ტრანზაქცია' : 'Transaction');
            let badge = it.type.toUpperCase();
            let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';

            if (it.relatedPurchaseId) {
                const po = purchaseOrders.find(p => p.id === it.relatedPurchaseId);
                title = isKa ? `შესყიდვის ორდერი #${String(po?.id || '').slice(-6)}` : `Purchase Order #${String(po?.id || '').slice(-6)}`;
                badge = isKa ? 'შესყიდვა' : 'Purchase';
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            } else if (it.relatedWorkAssignmentId) {
                const wa = workAssignments.find(w => w.id === it.relatedWorkAssignmentId);
                title = isKa ? `სამუშაო: ${wa?.workName || 'მინდვრის დავალება'}` : `Work: ${wa?.workName || 'Field Task'}`;
                badge = isKa ? 'მინდვრის სამუშაო' : 'Field Work';
                badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
            } else if (it.type === 'in') {
                badge = isKa ? 'შემოსავალი' : 'IN';
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            } else if (it.type === 'out') {
                badge = isKa ? 'გასავალი' : 'OUT';
                badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
            } else {
                badge = isKa ? 'კორექტირება' : 'ADJUST';
                badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
            }

            list.push({
                id: it.id,
                date: it.date,
                type: it.type,
                quantity: it.quantity,
                title,
                badge,
                badgeColor,
                author: it.chargedByUserName || (isKa ? 'სისტემა' : 'System'),
                note: it.note,
                chargeCategory: it.chargeCategory,
                totalCost: it.totalCost,
                rawInvTx: it
            });
        });

        // Sort chronological descending (latest first)
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [item.id, transactions, stockTransactions, purchaseOrders, workAssignments, isKa]);

    // Summary stats
    const totalIn = useMemo(() => unifiedLogs.filter(t => t.type === 'in' || t.type === 'refund').reduce((s, t) => s + t.quantity, 0), [unifiedLogs]);
    const totalOut = useMemo(() => unifiedLogs.filter(t => t.type === 'out').reduce((s, t) => s + t.quantity, 0), [unifiedLogs]);
    const totalAdjustment = useMemo(() => unifiedLogs.filter(t => t.type === 'adjustment').reduce((s, t) => s + t.quantity, 0), [unifiedLogs]);

    const filteredLogs = useMemo(() => {
        return unifiedLogs.filter(log => {
            const matchesCategory = categoryFilter === 'all' || 
                (categoryFilter === 'in' && (log.type === 'in' || log.type === 'refund')) ||
                (categoryFilter === 'out' && log.type === 'out') ||
                (categoryFilter === 'adjustment' && log.type === 'adjustment');

            const query = searchFilter.toLowerCase();
            const matchesSearch = !query || 
                log.title.toLowerCase().includes(query) ||
                log.author.toLowerCase().includes(query) ||
                (log.responsiblePerson && log.responsiblePerson.toLowerCase().includes(query)) ||
                (log.note && log.note.toLowerCase().includes(query)) ||
                (log.chargeCategory && log.chargeCategory.toLowerCase().includes(query));

            return matchesCategory && matchesSearch;
        });
    }, [unifiedLogs, categoryFilter, searchFilter]);

    if (!isOpen) return null;

    const handleConfirmRevert = async () => {
        if (!selectedTxToRevert || !onRestoreStockVersion) return;
        
        setIsReverting(true);
        try {
            // If the transaction was an OUT / DEDUCTION, restoring it means adding back that quantity!
            let projectedStock = item.currentStock;
            if (selectedTxToRevert.type === 'out') {
                projectedStock = item.currentStock + selectedTxToRevert.quantity;
            } else if (selectedTxToRevert.type === 'in') {
                projectedStock = Math.max(0, item.currentStock - selectedTxToRevert.quantity);
            } else if (selectedTxToRevert.stockBefore !== undefined) {
                projectedStock = selectedTxToRevert.stockBefore;
            }

            const reasonNote = revertReason.trim() 
                ? revertReason 
                : (isKa 
                    ? `ტრანზაქციის #${selectedTxToRevert.id.slice(-6)} გაუქმება და ნაშთის აღდგენა (${selectedTxToRevert.title})`
                    : `Reverted transaction #${selectedTxToRevert.id.slice(-6)} (${selectedTxToRevert.title})`);

            await onRestoreStockVersion(projectedStock, reasonNote, selectedTxToRevert.id);
            toast.success(isKa ? `ნაშთი წარმატებით აღდგა: ${projectedStock} ${item.unitOfMeasure}` : `Stock successfully restored to ${projectedStock} ${item.unitOfMeasure}`);
            setSelectedTxToRevert(null);
            setRevertReason('');
        } catch (err: any) {
            console.error(err);
            toast.error(isKa ? "ნაშთის აღდგენა ვერ მოხერხდა" : "Failed to restore stock version");
        } finally {
            setIsReverting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-600/20">
                            <History className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    {item.category} • {item.unitOfMeasure}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    ID: {item.id}
                                </span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                                {isKa ? `მოძრაობის სრული ისტორია & ვერსიები: ${item.name}` : `Full Audit Trail & Version Ledger: ${item.name}`}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-all cursor-pointer">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Stat Cards */}
                <div className="p-6 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100/80">
                        <div className="flex items-center justify-between text-blue-600 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider">{isKa ? 'სულ შესყიდული/შემოსული' : 'TOTAL INFLOW'}</span>
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-black text-blue-950">+{totalIn.toLocaleString()} <span className="text-xs font-bold text-blue-700">{item.unitOfMeasure}</span></p>
                    </div>

                    <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-100/80">
                        <div className="flex items-center justify-between text-rose-600 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider">{isKa ? 'სულ გახარჯული/ჩამოწერილი' : 'TOTAL OUTFLOW'}</span>
                            <TrendingDown className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-black text-rose-950">-{totalOut.toLocaleString()} <span className="text-xs font-bold text-rose-700">{item.unitOfMeasure}</span></p>
                    </div>

                    <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-100/80">
                        <div className="flex items-center justify-between text-purple-600 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider">{isKa ? 'ინვენტარიზაცია/სხვაობა' : 'AUDIT ADJUSTMENTS'}</span>
                            <Layers className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-black text-purple-950">{totalAdjustment > 0 ? `+${totalAdjustment}` : totalAdjustment} <span className="text-xs font-bold text-purple-700">{item.unitOfMeasure}</span></p>
                    </div>

                    <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 shadow-sm">
                        <div className="flex items-center justify-between text-emerald-600 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider">{isKa ? 'მიმდინარე ნაშთი საწყობში' : 'LIVE CURRENT STOCK'}</span>
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="text-2xl font-black text-emerald-950">{item.currentStock.toLocaleString()} <span className="text-sm font-bold text-emerald-700">{item.unitOfMeasure}</span></p>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <input 
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            placeholder={isKa ? "ძიება ავტორის, მიზეზის ან შენიშვნის მიხედვით..." : "Search by user, reason, category or note..."}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setCategoryFilter('all')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${categoryFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {isKa ? 'ყველა' : 'All'} ({unifiedLogs.length})
                        </button>
                        <button 
                            onClick={() => setCategoryFilter('out')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${categoryFilter === 'out' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-rose-700'}`}
                        >
                            {isKa ? 'გასავალი / ჩამოწერა' : 'Outflow'}
                        </button>
                        <button 
                            onClick={() => setCategoryFilter('in')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${categoryFilter === 'in' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-700'}`}
                        >
                            {isKa ? 'შემოსავალი' : 'Inflow'}
                        </button>
                        <button 
                            onClick={() => setCategoryFilter('adjustment')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${categoryFilter === 'adjustment' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-purple-700'}`}
                        >
                            {isKa ? 'კორექტირება' : 'Adjust'}
                        </button>
                    </div>
                </div>

                {/* Audit Timeline Table */}
                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50/60 text-[9px] font-black text-slate-400 uppercase tracking-widest text-left sticky top-0 backdrop-blur-sm z-10">
                            <tr>
                                <th className="px-4 py-3">{isKa ? 'თარიღი & დრო' : 'Date & Time'}</th>
                                <th className="px-4 py-3">{isKa ? 'მოქმედება & კატეგორია' : 'Action & Category'}</th>
                                <th className="px-4 py-3 text-right">{isKa ? 'სხვაობა (Delta)' : 'Quantity Delta'}</th>
                                <th className="px-4 py-3">{isKa ? 'ვინ გაატარა & პასუხისმგებელი' : 'Logged By & Staff'}</th>
                                <th className="px-4 py-3 text-center">{isKa ? 'ნაშთის დინამიკა' : 'Balance Dynamics'}</th>
                                <th className="px-4 py-3 text-right">{isKa ? 'ვერსიის მართვა' : 'Version Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredLogs.map(log => {
                                const isOut = log.type === 'out';
                                const isIn = log.type === 'in' || log.type === 'refund';
                                return (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                                        
                                        {/* Date */}
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                <div>
                                                    <span className="font-extrabold text-slate-800 block">{new Date(log.date).toLocaleDateString()}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">{new Date(log.date).toLocaleTimeString()}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Details */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex flex-col gap-1 max-w-sm">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${log.badgeColor}`}>
                                                        {log.badge}
                                                    </span>
                                                    <span className="font-extrabold text-slate-900">{log.title}</span>
                                                </div>
                                                {log.note && (
                                                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                                        "{log.note}"
                                                    </p>
                                                )}
                                                {log.totalCost && log.totalCost > 0 ? (
                                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                        <BanknotesIcon className="h-3 w-3 text-slate-400" />
                                                        {formatCurrency(log.totalCost)} {log.unitPrice ? `(@ ${formatCurrency(log.unitPrice)}/${item.unitOfMeasure})` : ''}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>

                                        {/* Quantity */}
                                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                            <div className="inline-flex items-center gap-1">
                                                {isOut ? (
                                                    <span className="p-1 rounded-md bg-rose-50 text-rose-600"><ArrowDownRight size={14} /></span>
                                                ) : (
                                                    <span className="p-1 rounded-md bg-emerald-50 text-emerald-600"><ArrowUpRight size={14} /></span>
                                                )}
                                                <span className={`text-sm font-black ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {isOut ? '-' : '+'}{log.quantity.toLocaleString()} {item.unitOfMeasure}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Author */}
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                                    <User className="h-3 w-3 text-indigo-500" />
                                                    {log.author}
                                                </span>
                                                {log.responsiblePerson && (
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {isKa ? 'პასუხისმგებელი: ' : 'Staff: '}{log.responsiblePerson}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Dynamics */}
                                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                            {log.stockBefore !== undefined && log.stockAfter !== undefined ? (
                                                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100/80 rounded-full font-mono text-[10px]">
                                                    <span className="text-slate-500 font-bold">{log.stockBefore}</span>
                                                    <span className="text-slate-400">→</span>
                                                    <span className="text-slate-900 font-black">{log.stockAfter} {item.unitOfMeasure}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">—</span>
                                            )}
                                        </td>

                                        {/* Restore / Rollback Action */}
                                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                            {onRestoreStockVersion && log.type !== 'refund' ? (
                                                <button
                                                    onClick={() => setSelectedTxToRevert(log)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ml-auto border border-slate-200 hover:border-indigo-300 shadow-sm"
                                                    title={isKa ? "ამ ჩანაწერის გაუქმება და ნაშთის აღდგენა" : "Revert this operation and restore inventory"}
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    {isKa ? 'აღდგენა' : 'Revert / Restore'}
                                                </button>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{isKa ? 'დაფიქსირებულია' : 'Archived'}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                                        {isKa ? 'ტრანზაქციები ვერ მოიძებნა არჩეული ფილტრით.' : 'No transactions found matching your criteria.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3">
                    <div className="text-[11px] text-slate-500 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {isKa 
                            ? `სულ დაფიქსირებულია ${unifiedLogs.length} ოპერაცია. ყველა ცვლილება დაცულია უნიკალური იდენტიფიკატორით.` 
                            : `Total ${unifiedLogs.length} verified operations. Every transaction is auditable and version-safe.`}
                    </div>

                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer shadow-md"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>

            {/* Revert & Restore Confirmation Modal */}
            {selectedTxToRevert && (
                <div className="fixed inset-0 bg-slate-950/85 z-[6000] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setSelectedTxToRevert(null)}>
                    <div className="bg-white rounded-[28px] p-6 max-w-lg w-full shadow-2xl border border-indigo-100 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
                                <RotateCcw className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    {isKa ? "ოპერაციის გაუქმება & ნაშთის აღდგენა" : "Revert Operation & Restore Stock"}
                                </h3>
                                <p className="text-xs text-slate-500 font-bold">
                                    {isKa ? "ვერსიის უკან დაბრუნების პროტოკოლი" : "Safe Rollback Transaction Protocol"}
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-bold">{isKa ? "საქონელი:" : "Item:"}</span>
                                <span className="font-extrabold text-slate-900">{item.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-bold">{isKa ? "ოპერაცია:" : "Target Op:"}</span>
                                <span className="font-extrabold text-slate-900">{selectedTxToRevert.title} ({selectedTxToRevert.badge})</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-bold">{isKa ? "გატარებული რაოდენობა:" : "Charged Quantity:"}</span>
                                <span className="font-black text-rose-600">-{selectedTxToRevert.quantity} {item.unitOfMeasure}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-bold">{isKa ? "ავტორი:" : "Logged By:"}</span>
                                <span className="font-bold text-slate-700">{selectedTxToRevert.author} ({new Date(selectedTxToRevert.date).toLocaleDateString()})</span>
                            </div>

                            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black">
                                <span className="text-indigo-950">{isKa ? "ახალი აღდგენილი ნაშთი:" : "Projected Restored Stock:"}</span>
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                                    {selectedTxToRevert.type === 'out' 
                                        ? (item.currentStock + selectedTxToRevert.quantity) 
                                        : Math.max(0, item.currentStock - selectedTxToRevert.quantity)} {item.unitOfMeasure}
                                </span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                {isKa ? "აღდგენის მიზეზი / კომენტარი (სურვილისამებრ):" : "Rollback Reason / Note (Optional):"}
                            </label>
                            <input 
                                value={revertReason}
                                onChange={e => setRevertReason(e.target.value)}
                                placeholder={isKa ? "მაგ. შეცდომით ჩამოიწერა, უკან დაბრუნდა..." : "e.g., Accidental charge, material returned..."}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setSelectedTxToRevert(null)}
                                disabled={isReverting}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-black text-xs uppercase tracking-wider transition-all"
                            >
                                {isKa ? "გაუქმება" : "Cancel"}
                            </button>
                            <button
                                onClick={handleConfirmRevert}
                                disabled={isReverting}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
                            >
                                <RotateCcw className="h-4 w-4" />
                                {isReverting ? (isKa ? "აღდგენა..." : "Restoring...") : (isKa ? "დადასტურება & აღდგენა" : "Confirm & Restore")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItemHistoryModal;
