import React, { useState, useMemo } from 'react';
import type { 
    PurchaseOrder, Supplier, InventoryItem, StockTransaction, 
    Transaction, SubStock, Permission 
} from '../../types';
import { 
    ShoppingBag, Plus, Search, Filter, CheckCircle2, Clock, 
    Truck, RotateCcw, AlertTriangle, ArrowDownRight, ArrowUpRight, 
    ArrowRightLeft, FileText, Building2, Calendar, DollarSign, 
    ExternalLink, ChevronRight, Eye, Check, X, ShieldAlert, Sparkles
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { toast } from 'sonner';
import PurchaseOrderModal from '../PurchaseOrderModal';

interface OrdersSectionProps {
    purchaseOrders: PurchaseOrder[];
    onSetPurchaseOrders: (orders: PurchaseOrder[]) => void;
    suppliers: Supplier[];
    onSetSuppliers: (suppliers: Supplier[]) => void;
    inventoryItems: InventoryItem[];
    onSetInventoryItems: (items: InventoryItem[]) => void;
    stockTransactions?: StockTransaction[];
    onSetStockTransactions?: (txs: StockTransaction[]) => void;
    subStocks: SubStock[];
    currentUserPermissions?: Set<Permission>;
}

export const OrdersSection: React.FC<OrdersSectionProps> = ({
    purchaseOrders = [],
    onSetPurchaseOrders,
    suppliers = [],
    onSetSuppliers,
    inventoryItems = [],
    onSetInventoryItems,
    stockTransactions = [],
    onSetStockTransactions,
    subStocks = []
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    // View mode: 'orders' | 'ledger' | 'suppliers'
    const [viewMode, setViewMode] = useState<'orders' | 'ledger' | 'suppliers'>('orders');
    // Order status filter: 'all' | 'Pre-order' | 'Ordered' | 'Received' | 'Returned'
    const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'Pre-order' | 'Ordered' | 'Received' | 'Returned'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [ledgerFilterType, setLedgerFilterType] = useState<'all' | 'BOUGHT' | 'SOLD' | 'RETURNED' | 'TRANSFER'>('all');

    // Modals
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
    
    // Quick Receive into Stock Modal
    const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
    const [receiveDestStockId, setReceiveDestStockId] = useState<string>('main');

    // Return Order Modal
    const [returningOrder, setReturningOrder] = useState<PurchaseOrder | null>(null);
    const [returnReason, setReturnReason] = useState<string>('');

    // Supplier Add/Edit Modal
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supName, setSupName] = useState('');
    const [supContact, setSupContact] = useState('');
    const [supEmail, setSupEmail] = useState('');
    const [supPhone, setSupPhone] = useState('');
    const [supTaxId, setSupTaxId] = useState('');

    // Metrics
    const metrics = useMemo(() => {
        let preordersVal = 0;
        let preordersCount = 0;
        let orderedVal = 0;
        let orderedCount = 0;
        let receivedVal = 0;
        let receivedCount = 0;
        let returnedVal = 0;
        let returnedCount = 0;

        purchaseOrders.forEach(o => {
            const cost = o.totalCost || 0;
            if (o.status === 'Pre-order') {
                preordersVal += cost;
                preordersCount++;
            } else if (o.status === 'Ordered') {
                orderedVal += cost;
                orderedCount++;
            } else if (o.status === 'Received') {
                receivedVal += cost;
                receivedCount++;
            } else if (o.status === 'Returned') {
                returnedVal += cost;
                returnedCount++;
            }
        });

        return {
            preordersVal, preordersCount,
            orderedVal, orderedCount,
            receivedVal, receivedCount,
            returnedVal, returnedCount,
            totalOrders: purchaseOrders.length
        };
    }, [purchaseOrders]);

    // Filtered orders
    const filteredOrders = useMemo(() => {
        return purchaseOrders.filter(order => {
            if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const sup = suppliers.find(s => s.id === order.supplierId);
                const supMatch = sup?.name.toLowerCase().includes(q) || false;
                const noteMatch = order.notes?.toLowerCase().includes(q) || false;
                const idMatch = order.id.toLowerCase().includes(q);
                const itemMatch = order.items.some(i => i.itemName?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
                return supMatch || noteMatch || idMatch || itemMatch;
            }
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [purchaseOrders, orderStatusFilter, searchQuery, suppliers]);

    // Complete Bought, Sold & Returned Ledger
    const comprehensiveLedger = useMemo(() => {
        const events: Array<{
            id: string;
            date: string;
            type: 'BOUGHT' | 'SOLD' | 'RETURNED' | 'TRANSFER';
            itemName: string;
            quantity: number;
            unit: string;
            unitCost?: number;
            totalAmount?: number;
            sourceOrParty: string;
            destination?: string;
            reason?: string;
            referenceId?: string;
        }> = [];

        // 1. Inward Purchases from PurchaseOrders (Received)
        purchaseOrders.forEach(po => {
            const supName = suppliers.find(s => s.id === po.supplierId)?.name || 'Supplier';
            if (po.status === 'Received') {
                po.items.forEach((item, idx) => {
                    const inv = inventoryItems.find(i => i.id === item.inventoryItemId);
                    events.push({
                        id: `ledger-po-${po.id}-${idx}`,
                        date: po.date,
                        type: 'BOUGHT',
                        itemName: item.itemName || inv?.name || 'Supply Item',
                        quantity: item.quantity,
                        unit: inv?.unitOfMeasure || 'pcs',
                        unitCost: item.unitCost,
                        totalAmount: item.quantity * item.unitCost,
                        sourceOrParty: supName,
                        destination: po.targetSubStockName || 'Main Warehouse',
                        reason: `P.O. Received: ${po.id}`,
                        referenceId: po.id
                    });
                });
            } else if (po.status === 'Returned') {
                po.items.forEach((item, idx) => {
                    const inv = inventoryItems.find(i => i.id === item.inventoryItemId);
                    events.push({
                        id: `ledger-ret-${po.id}-${idx}`,
                        date: po.date,
                        type: 'RETURNED',
                        itemName: item.itemName || inv?.name || 'Supply Item',
                        quantity: item.quantity,
                        unit: inv?.unitOfMeasure || 'pcs',
                        unitCost: item.unitCost,
                        totalAmount: item.quantity * item.unitCost,
                        sourceOrParty: supName,
                        reason: po.returnReason || `Returned to Supplier`,
                        referenceId: po.id
                    });
                });
            }
        });

        // 2. Stock Transactions (ADDITIONS, DEDUCTIONS, TRANSFERS)
        stockTransactions.forEach(tx => {
            const inv = inventoryItems.find(i => i.id === tx.itemId);
            const itemName = inv?.name || 'Stock Material';
            const unit = inv?.unitOfMeasure || 'unit';
            const reason = tx.reason || '';

            if (reason.toLowerCase().includes('transfer')) {
                events.push({
                    id: tx.id,
                    date: tx.date,
                    type: 'TRANSFER',
                    itemName,
                    quantity: tx.quantity,
                    unit,
                    unitCost: inv?.unitCost,
                    totalAmount: (inv?.unitCost || 0) * tx.quantity,
                    sourceOrParty: 'Internal Logistics',
                    reason: tx.reason,
                    referenceId: tx.referenceId
                });
            } else if (tx.type === 'DEDUCTION' && tx.sourceModule === 'HARVEST') {
                events.push({
                    id: tx.id,
                    date: tx.date,
                    type: 'SOLD',
                    itemName,
                    quantity: tx.quantity,
                    unit,
                    unitCost: inv?.unitCost,
                    totalAmount: (inv?.unitCost || 0) * tx.quantity,
                    sourceOrParty: 'Commercial Harvest Sale',
                    reason: tx.reason,
                    referenceId: tx.referenceId
                });
            } else if (tx.type === 'REFUND' || reason.toLowerCase().includes('return')) {
                events.push({
                    id: tx.id,
                    date: tx.date,
                    type: 'RETURNED',
                    itemName,
                    quantity: tx.quantity,
                    unit,
                    unitCost: inv?.unitCost,
                    totalAmount: (inv?.unitCost || 0) * tx.quantity,
                    sourceOrParty: tx.chargedByUserName || 'Stock Adjustment',
                    reason: tx.reason,
                    referenceId: tx.referenceId
                });
            }
        });

        return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [purchaseOrders, suppliers, inventoryItems, stockTransactions]);

    const filteredLedger = useMemo(() => {
        return comprehensiveLedger.filter(ev => {
            if (ledgerFilterType !== 'all' && ev.type !== ledgerFilterType) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    ev.itemName.toLowerCase().includes(q) ||
                    ev.sourceOrParty.toLowerCase().includes(q) ||
                    ev.reason?.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [comprehensiveLedger, ledgerFilterType, searchQuery]);

    // Handle Order save
    const handleSaveOrder = (order: PurchaseOrder) => {
        const isExisting = purchaseOrders.some(o => o.id === order.id);
        let updated: PurchaseOrder[];
        if (isExisting) {
            updated = purchaseOrders.map(o => o.id === order.id ? order : o);
        } else {
            updated = [order, ...purchaseOrders];
        }
        onSetPurchaseOrders(updated);
        setIsOrderModalOpen(false);
    };

    // Promote Pre-order to Ordered
    const handlePromoteToOrdered = (order: PurchaseOrder) => {
        const updated = purchaseOrders.map(o => o.id === order.id ? { ...o, status: 'Ordered' as const } : o);
        onSetPurchaseOrders(updated);
        toast.success(isKa ? 'შეკვეთა გადავიდა "შეკვეთილის" (გზაში) სტატუსში' : 'Pre-order promoted to Ordered (In Transit)');
    };

    // Receive into stock
    const handleConfirmReceive = () => {
        if (!receivingOrder) return;
        const targetSub = subStocks.find(s => s.id === receiveDestStockId);
        const destinationName = receiveDestStockId === 'main' 
            ? (isKa ? 'მთავარი საწყობი' : 'Main Warehouse') 
            : targetSub?.name || 'Sub-Stock';

        let updatedItems = [...inventoryItems];
        const newTxs: StockTransaction[] = [];
        const now = new Date().toISOString();

        receivingOrder.items.forEach(orderItem => {
            if (!orderItem.addToStock) return;
            const qty = Number(orderItem.quantity) || 0;
            if (qty <= 0) return;

            // Find matching item in that destination
            let destIndex = -1;
            if (receiveDestStockId === 'main') {
                destIndex = updatedItems.findIndex(i => 
                    !i.subStockId && 
                    (i.id === orderItem.inventoryItemId || (orderItem.itemName && i.name.toLowerCase() === orderItem.itemName.toLowerCase()))
                );
            } else {
                destIndex = updatedItems.findIndex(i => 
                    i.subStockId === receiveDestStockId && 
                    (i.id === orderItem.inventoryItemId || (orderItem.itemName && i.name.toLowerCase() === orderItem.itemName.toLowerCase()))
                );
            }

            let itemId = '';
            if (destIndex !== -1) {
                const current = updatedItems[destIndex];
                itemId = current.id;
                updatedItems[destIndex] = {
                    ...current,
                    currentStock: (current.currentStock || 0) + qty,
                    unitCost: orderItem.unitCost || current.unitCost
                };
            } else {
                itemId = `item-rcv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                const newItem: InventoryItem = {
                    id: itemId,
                    name: orderItem.itemName || 'Received Item',
                    sku: orderItem.barcode,
                    category: (orderItem.category as any) || 'Other',
                    unitOfMeasure: 'pcs',
                    currentStock: qty,
                    minStockThreshold: 5,
                    unitCost: orderItem.unitCost || 0,
                    location: destinationName,
                    subStockId: receiveDestStockId === 'main' ? undefined : receiveDestStockId,
                    subStockName: receiveDestStockId === 'main' ? undefined : targetSub?.name
                };
                updatedItems.push(newItem);
            }

            newTxs.push({
                id: `tx-recv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                organizationId: '',
                date: now,
                itemId,
                type: 'ADDITION',
                quantity: qty,
                sourceModule: 'MANUAL',
                reason: `Received Purchase Order: ${receivingOrder.id} into [${destinationName}]`
            });
        });

        onSetInventoryItems(updatedItems);
        if (newTxs.length > 0 && onSetStockTransactions) {
            onSetStockTransactions([...stockTransactions, ...newTxs]);
        }

        // Update PO status to Received
        const updatedPOs = purchaseOrders.map(o => o.id === receivingOrder.id ? {
            ...o,
            status: 'Received' as const,
            targetSubStockId: receiveDestStockId === 'main' ? undefined : receiveDestStockId,
            targetSubStockName: destinationName
        } : o);
        onSetPurchaseOrders(updatedPOs);

        toast.success(
            isKa 
                ? `შეკვეთა წარმატებით მიღებულია და დაემატა [${destinationName}]-ის მარაგში!` 
                : `Order received and added to [${destinationName}] inventory!`
        );
        setReceivingOrder(null);
    };

    // Return Order to Supplier
    const handleConfirmReturn = () => {
        if (!returningOrder) return;
        const updatedPOs = purchaseOrders.map(o => o.id === returningOrder.id ? {
            ...o,
            status: 'Returned' as const,
            returnReason: returnReason.trim() || 'Returned to supplier'
        } : o);
        onSetPurchaseOrders(updatedPOs);

        // If it was already received, deduct from stock
        if (returningOrder.status === 'Received') {
            let updatedItems = [...inventoryItems];
            const newTxs: StockTransaction[] = [];
            const now = new Date().toISOString();

            returningOrder.items.forEach(item => {
                const qty = item.quantity || 0;
                const idx = updatedItems.findIndex(i => i.id === item.inventoryItemId || (item.itemName && i.name.toLowerCase() === item.itemName.toLowerCase()));
                if (idx !== -1) {
                    const it = updatedItems[idx];
                    updatedItems[idx] = {
                        ...it,
                        currentStock: Math.max(0, (it.currentStock || 0) - qty)
                    };
                    newTxs.push({
                        id: `tx-ret-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        organizationId: '',
                        date: now,
                        itemId: it.id,
                        type: 'DEDUCTION',
                        quantity: qty,
                        sourceModule: 'MANUAL',
                        reason: `Returned Order ${returningOrder.id}: ${returnReason}`
                    });
                }
            });
            onSetInventoryItems(updatedItems);
            if (newTxs.length > 0 && onSetStockTransactions) {
                onSetStockTransactions([...stockTransactions, ...newTxs]);
            }
        }

        toast.info(isKa ? 'შეკვეთა მონიშნულია დაბრუნებულად' : 'Order marked as returned');
        setReturningOrder(null);
        setReturnReason('');
    };

    // Supplier save
    const handleSaveSupplier = (e: React.FormEvent) => {
        e.preventDefault();
        if (!supName.trim()) {
            toast.error(isKa ? 'შეიყვანეთ მომწოდებლის სახელი' : 'Enter supplier name');
            return;
        }

        if (editingSupplier) {
            const updated = suppliers.map(s => s.id === editingSupplier.id ? {
                ...s,
                name: supName.trim(),
                contactPerson: supContact.trim() || undefined,
                email: supEmail.trim() || undefined,
                phone: supPhone.trim() || undefined,
                taxId: supTaxId.trim() || undefined
            } : s);
            onSetSuppliers(updated);
            toast.success(isKa ? 'მომწოდებელი განახლებულია!' : 'Supplier updated!');
        } else {
            const newSup: Supplier = {
                id: `sup-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                name: supName.trim(),
                contactPerson: supContact.trim() || undefined,
                email: supEmail.trim() || undefined,
                phone: supPhone.trim() || undefined,
                taxId: supTaxId.trim() || undefined
            };
            onSetSuppliers([...suppliers, newSup]);
            toast.success(isKa ? 'მომწოდებელი დამატებულია!' : 'Supplier added!');
        }
        setIsSupplierModalOpen(false);
    };

    return (
        <div className="space-y-6">
            {/* Top Operational Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isKa ? 'წინასწარი შეკვეთები' : 'Pre-Orders'}
                        </span>
                        <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-3">
                        <div className="text-xl font-black text-slate-800">
                            {formatCurrency(metrics.preordersVal)}
                        </div>
                        <div className="text-xs text-amber-600 font-bold mt-0.5">
                            {metrics.preordersCount} {isKa ? 'აქტიური წინასწარი ჯავშანი' : 'Active Pre-orders'}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isKa ? 'შეკვეთილი (გზაში)' : 'Ordered (In Transit)'}
                        </span>
                        <Truck className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="mt-3">
                        <div className="text-xl font-black text-blue-900">
                            {formatCurrency(metrics.orderedVal)}
                        </div>
                        <div className="text-xs text-blue-600 font-bold mt-0.5">
                            {metrics.orderedCount} {isKa ? 'მიწოდების მოლოდინში' : 'Awaiting Delivery'}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isKa ? 'მიღებული მარაგში' : 'Received into Stock'}
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-3">
                        <div className="text-xl font-black text-emerald-600">
                            {formatCurrency(metrics.receivedVal)}
                        </div>
                        <div className="text-xs text-emerald-600 font-bold mt-0.5">
                            {metrics.receivedCount} {isKa ? 'საწყობში მიღებული' : 'Fulfilled into Stock'}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isKa ? 'დაბრუნებული' : 'Returns & Credits'}
                        </span>
                        <RotateCcw className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="mt-3">
                        <div className="text-xl font-black text-rose-600">
                            {formatCurrency(metrics.returnedVal)}
                        </div>
                        <div className="text-xs text-slate-500 font-bold mt-0.5">
                            {metrics.returnedCount} {isKa ? 'დაბრუნებული პარტია' : 'Returned Batches'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation & Action Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* View mode toggle */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit">
                    <button
                        type="button"
                        onClick={() => setViewMode('orders')}
                        className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                            viewMode === 'orders' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        <span>{isKa ? 'შეკვეთები & შესყიდვები' : 'Orders & Purchases'}</span>
                        <span className="text-[10px] text-slate-400 font-bold">({purchaseOrders.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode('ledger')}
                        className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                            viewMode === 'ledger' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                        <span>{isKa ? 'ყიდვა / გაყიდვა / დაბრუნება' : 'Bought / Sold / Returned'}</span>
                        <span className="text-[10px] text-slate-400 font-bold">({comprehensiveLedger.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode('suppliers')}
                        className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                            viewMode === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Building2 className="w-4 h-4 text-amber-600" />
                        <span>{isKa ? 'მომწოდებლები' : 'Suppliers'}</span>
                        <span className="text-[10px] text-slate-400 font-bold">({suppliers.length})</span>
                    </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2.5">
                    {/* Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={isKa ? 'ძიება შეკვეთებში, მომწოდებელში...' : 'Search orders, items, suppliers...'}
                            className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl pl-9 pr-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-600 w-56 lg:w-64"
                        />
                    </div>

                    {viewMode === 'suppliers' ? (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingSupplier(null);
                                setSupName('');
                                setSupContact('');
                                setSupEmail('');
                                setSupPhone('');
                                setSupTaxId('');
                                setIsSupplierModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            <span>{isKa ? '+ მომწოდებელი' : '+ New Supplier'}</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingOrder(null);
                                setIsOrderModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            <span>{isKa ? '+ ახალი შეკვეთა / ჯავშანი' : '+ New Order / Pre-order'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* View 1: Orders by Status */}
            {viewMode === 'orders' && (
                <div className="space-y-4">
                    {/* Status Filter Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            type="button"
                            onClick={() => setOrderStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                orderStatusFilter === 'all' 
                                    ? 'bg-slate-900 text-white' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {isKa ? 'ყველა შეკვეთა' : 'All Orders'} ({purchaseOrders.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderStatusFilter('Pre-order')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                orderStatusFilter === 'Pre-order' 
                                    ? 'bg-amber-600 text-white' 
                                    : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{isKa ? 'წინასწარი შეკვეთები (Pre-orders)' : 'Pre-orders'}</span>
                            <span>({metrics.preordersCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderStatusFilter('Ordered')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                orderStatusFilter === 'Ordered' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-white border border-slate-200 text-blue-700 hover:bg-blue-50'
                            }`}
                        >
                            <Truck className="w-3.5 h-3.5" />
                            <span>{isKa ? 'შეკვეთილი (გზაში)' : 'Ordered (In Transit)'}</span>
                            <span>({metrics.orderedCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderStatusFilter('Received')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                orderStatusFilter === 'Received' 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isKa ? 'მიღებული საწყობში' : 'Received into Stock'}</span>
                            <span>({metrics.receivedCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderStatusFilter('Returned')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                orderStatusFilter === 'Returned' 
                                    ? 'bg-rose-600 text-white' 
                                    : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
                            }`}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isKa ? 'დაბრუნებული' : 'Returned'}</span>
                            <span>({metrics.returnedCount})</span>
                        </button>
                    </div>

                    {/* Orders Table */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-xs">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="px-5 py-4 text-left">{isKa ? 'თარიღი / ID' : 'Date / Order ID'}</th>
                                        <th className="px-5 py-4 text-left">{isKa ? 'მომწოდებელი' : 'Supplier'}</th>
                                        <th className="px-5 py-4 text-left">{isKa ? 'ნივთების შემადგენლობა' : 'Items & Quantity'}</th>
                                        <th className="px-5 py-4 text-left">{isKa ? 'დანიშნულების საწყობი' : 'Warehouse Target'}</th>
                                        <th className="px-5 py-4 text-right">{isKa ? 'თანხა' : 'Total Amount'}</th>
                                        <th className="px-5 py-4 text-center">{isKa ? 'სტატუსი' : 'Status'}</th>
                                        <th className="px-5 py-4 text-right">{isKa ? 'მოქმედებები' : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                                    {filteredOrders.map(order => {
                                        const sup = suppliers.find(s => s.id === order.supplierId);
                                        const itemsSummary = order.items.map(i => `${i.quantity}x ${i.itemName || 'Item'}`).join(', ');

                                        return (
                                            <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="font-black text-slate-800">
                                                        {new Date(order.date).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        {order.id}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-slate-900">
                                                        {sup?.name || isKa ? 'უცნობი მომწოდებელი' : 'Unknown Supplier'}
                                                    </div>
                                                    {sup?.phone && (
                                                        <div className="text-[10px] text-slate-400">
                                                            {sup.phone}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 max-w-xs">
                                                    <div className="truncate text-slate-800 font-semibold" title={itemsSummary}>
                                                        {itemsSummary || (isKa ? 'ნივთები არ არის' : 'No items')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {order.items.length} {isKa ? 'პოზიცია' : 'items'}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-semibold text-slate-600">
                                                        {order.targetSubStockName || (isKa ? 'მთავარი საწყობი' : 'Main Warehouse')}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <span className="font-black text-slate-900 text-sm">
                                                        {formatCurrency(order.totalCost || 0)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    {order.status === 'Pre-order' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {isKa ? 'წინასწარი ჯავშანი' : 'Pre-order'}
                                                        </span>
                                                    )}
                                                    {order.status === 'Ordered' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                                                            <Truck className="w-3 h-3" />
                                                            {isKa ? 'შეკვეთილი (გზაში)' : 'Ordered'}
                                                        </span>
                                                    )}
                                                    {order.status === 'Received' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {isKa ? 'მიღებული მარაგში' : 'Received'}
                                                        </span>
                                                    )}
                                                    {order.status === 'Returned' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                                            <RotateCcw className="w-3 h-3" />
                                                            {isKa ? 'დაბრუნებული' : 'Returned'}
                                                        </span>
                                                    )}
                                                    {order.status === 'Draft' && (
                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-slate-100 text-slate-600 inline-flex items-center gap-1">
                                                            {isKa ? 'დრაფტი' : 'Draft'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Promotion from Pre-order to Ordered */}
                                                        {order.status === 'Pre-order' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePromoteToOrdered(order)}
                                                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                                title={isKa ? 'შეკვეთის გაფორმება & გაგზავნა' : 'Place order with supplier'}
                                                            >
                                                                <Truck className="w-3 h-3" />
                                                                <span>{isKa ? 'შეკვეთა' : 'Order'}</span>
                                                            </button>
                                                        )}

                                                        {/* Receive into stock */}
                                                        {order.status === 'Ordered' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setReceivingOrder(order);
                                                                    setReceiveDestStockId('main');
                                                                }}
                                                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                                title={isKa ? 'მიღება და მარაგში შეტანა' : 'Receive into Stock'}
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                <span>{isKa ? 'მიღება' : 'Receive'}</span>
                                                            </button>
                                                        )}

                                                        {/* Return button */}
                                                        {(order.status === 'Ordered' || order.status === 'Received') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setReturningOrder(order);
                                                                    setReturnReason('');
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                                title={isKa ? 'მომწოდებელთან დაბრუნება' : 'Return to supplier'}
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Edit / Inspect */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingOrder(order);
                                                                setIsOrderModalOpen(true);
                                                            }}
                                                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                                            title={isKa ? 'შეკვეთის დეტალები' : 'Order Details'}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filteredOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                                <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                                <p className="font-bold">
                                                    {isKa ? 'შეკვეთები არ მოიძებნა' : 'No orders found matching filters'}
                                                </p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* View 2: Complete Bought, Sold & Returned Ledger */}
            {viewMode === 'ledger' && (
                <div className="space-y-4">
                    {/* Filter types */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            type="button"
                            onClick={() => setLedgerFilterType('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                ledgerFilterType === 'all' 
                                    ? 'bg-slate-900 text-white' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {isKa ? 'ყველა ტრანზაქცია' : 'All Transactions'} ({comprehensiveLedger.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setLedgerFilterType('BOUGHT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                ledgerFilterType === 'BOUGHT' 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                        >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            <span>{isKa ? 'შესყიდული / მიღებული' : 'Bought / Received'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setLedgerFilterType('SOLD')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                ledgerFilterType === 'SOLD' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-white border border-slate-200 text-blue-700 hover:bg-blue-50'
                            }`}
                        >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>{isKa ? 'გაყიდული / გაცემული' : 'Sold / Dispatched'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setLedgerFilterType('RETURNED')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                ledgerFilterType === 'RETURNED' 
                                    ? 'bg-rose-600 text-white' 
                                    : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
                            }`}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isKa ? 'დაბრუნებული' : 'Returned / Refunded'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setLedgerFilterType('TRANSFER')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                ledgerFilterType === 'TRANSFER' 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50'
                            }`}
                        >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>{isKa ? 'შიდა გადატანა' : 'Stock Transfer'}</span>
                        </button>
                    </div>

                    {/* Ledger List */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-xs">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="px-5 py-4 text-left">{isKa ? 'თარიღი' : 'Date'}</th>
                                        <th className="px-5 py-4 text-left">{isKa ? 'ოპერაცია' : 'Operation'}</th>
                                        <th className="px-5 py-4 text-left">{isKa ? 'სასაწყობე ნივთი' : 'Item Description'}</th>
                                        <th className="px-5 py-4 text-right">{isKa ? 'რაოდენობა' : 'Quantity'}</th>
                                        <th className="px-5 py-4 text-right">{isKa ? 'ფასი / ჯამი' : 'Cost & Value'}</th>
                                        <th className="px-5 py-4 text-left">{isKa ? 'კონტრაგენტი / ლოკაცია' : 'Party / Location'}</th>
                                        <th className="px-5 py-4 text-left">{isKa ? 'საფუძველი / მიზეზი' : 'Reference / Reason'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                                    {filteredLedger.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                                {new Date(item.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {item.type === 'BOUGHT' && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        {isKa ? 'შესყიდვა' : 'BOUGHT'}
                                                    </span>
                                                )}
                                                {item.type === 'SOLD' && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                                        {isKa ? 'გაყიდვა' : 'SOLD'}
                                                    </span>
                                                )}
                                                {item.type === 'RETURNED' && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                                        {isKa ? 'დაბრუნება' : 'RETURNED'}
                                                    </span>
                                                )}
                                                {item.type === 'TRANSFER' && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        {isKa ? 'გადატანა' : 'TRANSFER'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 font-bold text-slate-900">
                                                {item.itemName}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right font-black text-slate-800">
                                                {item.type === 'BOUGHT' ? '+' : item.type === 'SOLD' ? '-' : ''}
                                                {item.quantity} {item.unit}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                {item.totalAmount ? (
                                                    <span className="font-bold text-slate-900">
                                                        {formatCurrency(item.totalAmount)}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="font-semibold text-slate-800">
                                                    {item.sourceOrParty}
                                                </div>
                                                {item.destination && (
                                                    <div className="text-[10px] text-slate-400">
                                                        ↳ {item.destination}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 max-w-xs truncate text-slate-500 text-[11px]" title={item.reason}>
                                                {item.reason || '—'}
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredLedger.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                                                {isKa ? 'ტრანზაქციები არ მოიძებნა' : 'No transactions recorded'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* View 3: Suppliers Directory */}
            {viewMode === 'suppliers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suppliers.map(sup => {
                        const supOrders = purchaseOrders.filter(o => o.supplierId === sup.id);
                        const supTotalSpend = supOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);

                        return (
                            <div key={sup.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <Building2 className="w-5 h-5 text-amber-600" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingSupplier(sup);
                                                setSupName(sup.name);
                                                setSupContact(sup.contactPerson || '');
                                                setSupEmail(sup.email || '');
                                                setSupPhone(sup.phone || '');
                                                setSupTaxId(sup.taxId || '');
                                                setIsSupplierModalOpen(true);
                                            }}
                                            className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                                        >
                                            {isKa ? 'რედაქტირება' : 'Edit'}
                                        </button>
                                    </div>
                                    <h3 className="text-base font-black text-slate-900">
                                        {sup.name}
                                    </h3>
                                    {sup.taxId && (
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {isKa ? 'საიდენტიფიკაციო:' : 'Tax ID:'} {sup.taxId}
                                        </p>
                                    )}
                                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                                        {sup.contactPerson && (
                                            <p>👤 {sup.contactPerson}</p>
                                        )}
                                        {sup.phone && (
                                            <p>📞 {sup.phone}</p>
                                        )}
                                        {sup.email && (
                                            <p>✉️ {sup.email}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                            {isKa ? 'შეკვეთები' : 'Orders'}
                                        </span>
                                        <span className="font-black text-slate-800">
                                            {supOrders.length}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                            {isKa ? 'ჯამური შესყიდვები' : 'Total Spent'}
                                        </span>
                                        <span className="font-black text-emerald-600">
                                            {formatCurrency(supTotalSpend)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick Receive Modal (Destination Picker) */}
            {receivingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={() => setReceivingOrder(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                                <h3 className="text-base font-black">
                                    {isKa ? 'მარაგში მიღების დადასტურება' : 'Receive Order into Stock'}
                                </h3>
                            </div>
                            <button onClick={() => setReceivingOrder(null)} className="text-white/80 hover:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-600">
                                {isKa 
                                    ? `შეკვეთის #${receivingOrder.id} მიღებისას ნივთები ავტომატურად დაემატება არჩეული საწყობის ნაშთში.` 
                                    : `Items from Order #${receivingOrder.id} will be credited to selected warehouse inventory.`}
                            </p>

                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                                <span className="font-bold text-slate-500 block mb-1">
                                    {isKa ? 'მიმღები ნივთები:' : 'Items to Receive:'}
                                </span>
                                <ul className="space-y-1">
                                    {receivingOrder.items.map((i, idx) => (
                                        <li key={idx} className="font-black text-slate-800 flex justify-between">
                                            <span>{i.itemName || 'Item'}</span>
                                            <span>{i.quantity} pcs @ {formatCurrency(i.unitCost || 0)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1.5">
                                    {isKa ? 'მიმღები საწყობი / ქვესაწყობი' : 'Destination Warehouse / Sub-Stock'} <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={receiveDestStockId}
                                    onChange={(e) => setReceiveDestStockId(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
                                >
                                    <option value="main">{isKa ? 'მთავარი ცენტრალური საწყობი' : 'Main Central Warehouse'}</option>
                                    {subStocks.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setReceivingOrder(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmReceive}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-emerald-200 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>{isKa ? 'დადასტურება & მიღება' : 'Confirm & Intake'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Return Order Modal */}
            {returningOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={() => setReturningOrder(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <RotateCcw className="w-5 h-5 text-white" />
                                <h3 className="text-base font-black">
                                    {isKa ? 'შეკვეთის დაბრუნება მომწოდებელთან' : 'Return Order to Supplier'}
                                </h3>
                            </div>
                            <button onClick={() => setReturningOrder(null)} className="text-white/80 hover:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-600">
                                {isKa 
                                    ? `დაბრუნების შემთხვევაში შეკვეთის სტატუსი გახდება "დაბრუნებული", ხოლო მიღებული ნივთები ჩამოიჭრება მარაგებიდან.` 
                                    : `This will mark Order #${returningOrder.id} as Returned and deduct received quantities from stock.`}
                            </p>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1.5">
                                    {isKa ? 'დაბრუნების მიზეზი' : 'Reason for Return'} <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                    placeholder={isKa ? 'მაგ. დაზიანებული შეფუთვა, ვადაგასული, არასწორი პარტია...' : 'e.g. Damaged packaging, expired batch, wrong item sent...'}
                                    rows={3}
                                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 text-slate-900 outline-none focus:ring-2 focus:ring-rose-500"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setReturningOrder(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmReturn}
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-rose-200 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    <span>{isKa ? 'დაბრუნების გაფორმება' : 'Execute Return'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Supplier Modal */}
            {isSupplierModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={() => setIsSupplierModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <Building2 className="w-5 h-5 text-amber-400" />
                                <h3 className="text-base font-black">
                                    {editingSupplier ? (isKa ? 'მომწოდებლის რედაქტირება' : 'Edit Supplier') : (isKa ? 'ახალი მომწოდებელი' : 'New Supplier')}
                                </h3>
                            </div>
                            <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    {isKa ? 'კომპანიის / მომწოდებლის სახელი' : 'Company Name'} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={supName}
                                    onChange={(e) => setSupName(e.target.value)}
                                    placeholder={isKa ? 'მაგ. შპს აგრო-იმპექსი' : 'e.g. EuroAgro Supplies Ltd'}
                                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        {isKa ? 'საკონტაქტო პირი' : 'Contact Person'}
                                    </label>
                                    <input
                                        type="text"
                                        value={supContact}
                                        onChange={(e) => setSupContact(e.target.value)}
                                        placeholder={isKa ? 'სახელი, გვარი' : 'Full name'}
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        {isKa ? 'საიდენტიფიკაციო #' : 'Tax ID'}
                                    </label>
                                    <input
                                        type="text"
                                        value={supTaxId}
                                        onChange={(e) => setSupTaxId(e.target.value)}
                                        placeholder="4040..."
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        {isKa ? 'ტელეფონი' : 'Phone'}
                                    </label>
                                    <input
                                        type="text"
                                        value={supPhone}
                                        onChange={(e) => setSupPhone(e.target.value)}
                                        placeholder="+995..."
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        {isKa ? 'ელ-ფოსტა' : 'Email'}
                                    </label>
                                    <input
                                        type="email"
                                        value={supEmail}
                                        onChange={(e) => setSupEmail(e.target.value)}
                                        placeholder="info@..."
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsSupplierModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-amber-200 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>{editingSupplier ? (isKa ? 'განახლება' : 'Update') : (isKa ? 'დამატება' : 'Save')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PurchaseOrderModal */}
            {isOrderModalOpen && (
                <PurchaseOrderModal
                    isOpen={isOrderModalOpen}
                    onClose={() => setIsOrderModalOpen(false)}
                    onSave={handleSaveOrder}
                    order={editingOrder}
                    suppliers={suppliers}
                    inventoryItems={inventoryItems}
                />
            )}
        </div>
    );
};
export default OrdersSection;
