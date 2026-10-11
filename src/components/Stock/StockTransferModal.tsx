import React, { useState, useMemo } from 'react';
import type { InventoryItem, SubStock, StockTransaction } from '../../types';
import { ArrowRightLeft, Package, MapPin, Truck, Check, X, AlertCircle, FileText } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { toast } from 'sonner';

interface StockTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems: InventoryItem[];
    onSetInventoryItems: (items: InventoryItem[]) => void;
    subStocks: SubStock[];
    stockTransactions?: StockTransaction[];
    onSetStockTransactions?: (txs: StockTransaction[]) => void;
    preselectedItemId?: string;
    preselectedSourceId?: string;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
    isOpen,
    onClose,
    inventoryItems,
    onSetInventoryItems,
    subStocks,
    stockTransactions = [],
    onSetStockTransactions,
    preselectedItemId,
    preselectedSourceId = 'main'
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    // Source location: 'main' or a subStock id
    const [sourceLocationId, setSourceLocationId] = useState<string>(preselectedSourceId);
    // Destination location: 'main' or a subStock id
    const [destLocationId, setDestLocationId] = useState<string>('');
    const [selectedItemId, setSelectedItemId] = useState<string>(preselectedItemId || '');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [driverName, setDriverName] = useState<string>('');
    const [waybillNumber, setWaybillNumber] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Filter available items in the source location
    const availableItems = useMemo(() => {
        return inventoryItems.filter(item => {
            if (item.category === 'Produce' || item.isPrivate) return false;
            if (sourceLocationId === 'main') {
                return !item.subStockId && (item.currentStock || 0) > 0;
            } else {
                return item.subStockId === sourceLocationId && (item.currentStock || 0) > 0;
            }
        });
    }, [inventoryItems, sourceLocationId]);

    // Currently selected item
    const selectedItem = useMemo(() => {
        return inventoryItems.find(i => i.id === selectedItemId);
    }, [inventoryItems, selectedItemId]);

    // Destination options (exclude source)
    const destinationOptions = useMemo(() => {
        const options: { id: string; name: string; isMain?: boolean }[] = [];
        if (sourceLocationId !== 'main') {
            options.push({ id: 'main', name: isKa ? 'მთავარი ცენტრალური საწყობი' : 'Main Central Warehouse', isMain: true });
        }
        subStocks.forEach(s => {
            if (s.id !== sourceLocationId) {
                options.push({ id: s.id, name: `${s.name} (${s.code})` });
            }
        });
        return options;
    }, [subStocks, sourceLocationId, isKa]);

    const getSourceName = () => {
        if (sourceLocationId === 'main') return isKa ? 'მთავარი საწყობი' : 'Main Warehouse';
        const s = subStocks.find(sub => sub.id === sourceLocationId);
        return s ? `${s.name} (${s.code})` : (isKa ? 'ქვესაწყობი' : 'Sub-Stock');
    };

    const getDestName = () => {
        if (destLocationId === 'main') return isKa ? 'მთავარი საწყობი' : 'Main Warehouse';
        const s = subStocks.find(sub => sub.id === destLocationId);
        return s ? `${s.name} (${s.code})` : (isKa ? 'დანიშნულების საწყობი' : 'Destination Sub-Stock');
    };

    const handleTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) {
            toast.error(isKa ? 'გთხოვთ აირჩიოთ გადასატანი ნივთი' : 'Please select an item to transfer');
            return;
        }
        if (!destLocationId) {
            toast.error(isKa ? 'გთხოვთ აირჩიოთ დანიშნულების საწყობი' : 'Please select destination warehouse');
            return;
        }
        const transferQty = Number(quantity);
        if (!transferQty || transferQty <= 0) {
            toast.error(isKa ? 'გთხოვთ მიუთითოთ ვალიდური რაოდენობა' : 'Please enter a valid transfer quantity');
            return;
        }
        if (transferQty > (selectedItem.currentStock || 0)) {
            toast.error(
                isKa 
                    ? `მარაგზე მეტია! მაქსიმალური რაოდენობა: ${selectedItem.currentStock} ${selectedItem.unitOfMeasure}` 
                    : `Exceeds stock! Maximum available: ${selectedItem.currentStock} ${selectedItem.unitOfMeasure}`
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const destSubStock = subStocks.find(s => s.id === destLocationId);
            const sourceName = getSourceName();
            const destName = getDestName();

            // 1. Deduct from source item
            let updatedItems = inventoryItems.map(item => {
                if (item.id === selectedItem.id) {
                    return {
                        ...item,
                        currentStock: Math.max(0, (item.currentStock || 0) - transferQty)
                    };
                }
                return item;
            });

            // 2. Add or create item at destination
            let destItemIndex = -1;
            if (destLocationId === 'main') {
                destItemIndex = updatedItems.findIndex(i => 
                    !i.subStockId && 
                    (i.sku === selectedItem.sku || i.name.toLowerCase() === selectedItem.name.toLowerCase())
                );
            } else {
                destItemIndex = updatedItems.findIndex(i => 
                    i.subStockId === destLocationId && 
                    (i.sku === selectedItem.sku || i.name.toLowerCase() === selectedItem.name.toLowerCase())
                );
            }

            let destItemId = '';
            if (destItemIndex !== -1) {
                // Update existing item at destination
                const destItem = updatedItems[destItemIndex];
                destItemId = destItem.id;
                updatedItems[destItemIndex] = {
                    ...destItem,
                    currentStock: (destItem.currentStock || 0) + transferQty,
                    unitCost: selectedItem.unitCost || destItem.unitCost
                };
            } else {
                // Create copy at destination
                destItemId = `item-sub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                const newDestItem: InventoryItem = {
                    ...selectedItem,
                    id: destItemId,
                    currentStock: transferQty,
                    location: destLocationId === 'main' ? (isKa ? 'მთავარი საწყობი' : 'Main Warehouse') : destSubStock?.name || destName,
                    subStockId: destLocationId === 'main' ? undefined : destLocationId,
                    subStockName: destLocationId === 'main' ? undefined : destSubStock?.name
                };
                updatedItems.push(newDestItem);
            }

            onSetInventoryItems(updatedItems);

            // 3. Log stock transactions
            const now = new Date().toISOString();
            const txId1 = `tx-trf-out-${Date.now()}`;
            const txId2 = `tx-trf-in-${Date.now() + 1}`;
            const trfReason = `Internal Transfer: ${transferQty} ${selectedItem.unitOfMeasure} from [${sourceName}] to [${destName}]${driverName ? ` (Driver: ${driverName})` : ''}${waybillNumber ? ` (Waybill: ${waybillNumber})` : ''}${notes ? ` - ${notes}` : ''}`;

            const newTxs: StockTransaction[] = [
                {
                    id: txId1,
                    organizationId: selectedItem.organizationId || '',
                    date: now,
                    itemId: selectedItem.id,
                    type: 'DEDUCTION',
                    quantity: transferQty,
                    sourceModule: 'MANUAL',
                    reason: trfReason,
                    note: notes
                },
                {
                    id: txId2,
                    organizationId: selectedItem.organizationId || '',
                    date: now,
                    itemId: destItemId,
                    type: 'ADDITION',
                    quantity: transferQty,
                    sourceModule: 'MANUAL',
                    reason: trfReason,
                    note: notes
                }
            ];

            if (onSetStockTransactions) {
                onSetStockTransactions([...stockTransactions, ...newTxs]);
            }

            toast.success(
                isKa 
                    ? `გადატანა წარმატებით შესრულდა: ${transferQty} ${selectedItem.unitOfMeasure} გადატანილია [${destName}]-ში` 
                    : `Transferred successfully: ${transferQty} ${selectedItem.unitOfMeasure} moved to [${destName}]`
            );

            onClose();
        } catch (error) {
            console.error('Transfer failed:', error);
            toast.error(isKa ? 'გადატანის შეცდომა' : 'Transfer failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                            <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight">
                                {isKa ? 'საწყობთაშორისი გადატანა' : 'Inter-Stock Transfer'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                {isKa ? 'მარაგის გადაადგილება მთავარ საწყობსა და ქვესაწყობებს შორის' : 'Move inventory between Main Stock and Sub-Stocks'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleTransfer} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Source & Destination Route */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Source Location */}
                        <div>
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                {isKa ? 'საიდან (გამგზავნი საწყობი)' : 'From (Source Stock)'}
                            </label>
                            <select
                                value={sourceLocationId}
                                onChange={(e) => {
                                    setSourceLocationId(e.target.value);
                                    setSelectedItemId('');
                                    if (destLocationId === e.target.value) setDestLocationId('');
                                }}
                                className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                            >
                                <option value="main">{isKa ? 'მთავარი ცენტრალური საწყობი' : 'Main Central Warehouse'}</option>
                                {subStocks.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                ))}
                            </select>
                        </div>

                        {/* Destination Location */}
                        <div>
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                                {isKa ? 'სად (მიმღები საწყობი)' : 'To (Destination Stock)'}
                            </label>
                            <select
                                value={destLocationId}
                                onChange={(e) => setDestLocationId(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                                required
                            >
                                <option value="">{isKa ? '-- აირჩიეთ დანიშნულება --' : '-- Select Destination --'}</option>
                                {destinationOptions.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Item Selection */}
                    <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1.5 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-indigo-600" />
                            {isKa ? 'გადასატანი სასაწყობე ნივთი' : 'Select Item to Transfer'} <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                            required
                        >
                            <option value="">{isKa ? '-- აირჩიეთ ნივთი --' : '-- Select Item --'}</option>
                            {availableItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name} — {isKa ? 'ნაშთი:' : 'In Stock:'} {item.currentStock} {item.unitOfMeasure} ({item.category})
                                </option>
                            ))}
                        </select>
                        {availableItems.length === 0 && (
                            <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {isKa ? 'არჩეულ წყარო საწყობში ხელმისაწვდომი ნივთები არ მოიძებნა' : 'No available stock items found in selected source location'}
                            </p>
                        )}
                    </div>

                    {/* Quantity & Stock Context */}
                    {selectedItem && (
                        <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 block">
                                    {isKa ? 'ხელმისაწვდომი ნაშთი წყაროში:' : 'Available in Source:'}
                                </span>
                                <span className="text-sm font-black text-blue-900">
                                    {selectedItem.currentStock} {selectedItem.unitOfMeasure}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[11px] font-bold text-slate-500 block">
                                    {isKa ? 'ერთეულის ღირებულება:' : 'Unit Cost:'}
                                </span>
                                <span className="text-sm font-black text-slate-800">
                                    {formatCurrency(selectedItem.unitCost || 0)}
                                </span>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1.5">
                            {isKa ? 'გადასატანი რაოდენობა' : 'Transfer Quantity'} <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="any"
                                min="0.01"
                                max={selectedItem?.currentStock || undefined}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder={isKa ? 'მაგ. 50' : 'e.g. 50'}
                                className="w-full bg-white border border-slate-200 text-xs font-black rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                                required
                            />
                            {selectedItem && (
                                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                                    {selectedItem.unitOfMeasure}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Logistics & Tracking (Waybill, Driver) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                {isKa ? 'მძღოლი / პასუხისმგებელი პირი' : 'Driver / Transporter'}
                            </label>
                            <input
                                type="text"
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                                placeholder={isKa ? 'მაგ. გიორგი ბერიძე' : 'e.g. Alex Green'}
                                className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                {isKa ? 'ზედნადები / დოკუმენტის #' : 'Waybill / Document #'}
                            </label>
                            <input
                                type="text"
                                value={waybillNumber}
                                onChange={(e) => setWaybillNumber(e.target.value)}
                                placeholder={isKa ? 'მაგ. TRF-2026-04' : 'e.g. TRF-2026-04'}
                                className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            {isKa ? 'შენიშვნა / მიზეზი' : 'Transfer Notes / Purpose'}
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={isKa ? 'მაგ. სასუქის გადატანა ჩრდილოეთ ნაკვეთისთვის' : 'e.g. Urgent fertilizer restock for North Block'}
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        >
                            {isKa ? 'გაუქმება' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedItem || !destLocationId || !quantity}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                        >
                            <Check className="w-4 h-4" />
                            <span>{isKa ? 'გადატანის დადასტურება' : 'Confirm Transfer'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default StockTransferModal;
