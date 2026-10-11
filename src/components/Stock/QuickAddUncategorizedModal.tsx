import React, { useState } from 'react';
import type { InventoryItem, SubStock } from '../../types';
import { Plus, X, PackagePlus, AlertCircle, Check } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { toast } from 'sonner';

interface QuickAddUncategorizedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveItem: (item: InventoryItem) => void;
    subStocks: SubStock[];
}

export const QuickAddUncategorizedModal: React.FC<QuickAddUncategorizedModalProps> = ({
    isOpen,
    onClose,
    onSaveItem,
    subStocks
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [unitOfMeasure, setUnitOfMeasure] = useState('kg');
    const [unitCost, setUnitCost] = useState<number | ''>('');
    const [locationId, setLocationId] = useState('main');
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error(isKa ? 'გთხოვთ მიუთითოთ ნივთის დასახელება' : 'Please provide item name');
            return;
        }

        const chosenSub = subStocks.find(s => s.id === locationId);
        const locationName = locationId === 'main' 
            ? (isKa ? 'მთავარი საწყობი' : 'Main Warehouse')
            : chosenSub?.name || (isKa ? 'ქვესაწყობი' : 'Sub-Stock');

        const newItem: InventoryItem = {
            id: `item-uncat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: name.trim(),
            sku: sku.trim() || undefined,
            category: 'Uncategorized',
            description: notes.trim() || undefined,
            unitOfMeasure: unitOfMeasure || 'pcs',
            currentStock: quantity === '' ? 0 : Number(quantity),
            minStockThreshold: 5,
            unitCost: unitCost === '' ? 0 : Number(unitCost),
            location: locationName,
            subStockId: locationId === 'main' ? undefined : locationId,
            subStockName: locationId === 'main' ? undefined : chosenSub?.name,
            status: 'PENDING_CATEGORIZATION'
        };

        onSaveItem(newItem);
        toast.success(
            isKa 
                ? `ნივთი წარმატებით დაემატა უკატეგორიო ნივთების სიაში!` 
                : `Item added to Uncategorized Inbox!`
        );
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/20 text-white rounded-xl">
                            <PackagePlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight">
                                {isKa ? 'სწრაფი მიღება (უკატეგორიო ნივთი)' : 'Quick Drop (Uncategorized Item)'}
                            </h2>
                            <p className="text-xs text-amber-100">
                                {isKa ? 'დაამატეთ ნივთი დალაგებამდე — კატეგორიას მოგვიანებით მიანიჭებთ' : 'Add item before categorization — assign category later'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors cursor-pointer p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>
                            {isKa 
                                ? 'ეს ნივთი გამოჩნდება "უკატეგორიო ნივთების" სექციაში, სადაც შესაძლებელია 1 კლიკით შესაბამის კატეგორიაში გადანაწილება.'
                                : 'This item will be saved directly into "Uncategorized Items", allowing warehouse staff to review and categorize it with 1 click.'}
                        </span>
                    </div>

                    <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                            {isKa ? 'ნივთის დასახელება' : 'Item Name'} <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={isKa ? 'მაგ. პლასტმასის მილი 50მმ, უცნობი სასუქი, ხელთათმანები...' : 'e.g. Drip Tube 50mm, Box of Work Gloves, New Fertilizer...'}
                            className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                {isKa ? 'რაოდენობა' : 'Quantity'} <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder="0"
                                className="w-full bg-white border border-slate-200 text-xs font-black rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                {isKa ? 'საზომი ერთეული' : 'Unit'}
                            </label>
                            <input
                                list="quick-units"
                                value={unitOfMeasure}
                                onChange={(e) => setUnitOfMeasure(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <datalist id="quick-units">
                                <option value="kg">{isKa ? 'კგ' : 'kg'}</option>
                                <option value="pcs">{isKa ? 'ცალი' : 'pcs'}</option>
                                <option value="L">{isKa ? 'ლიტრი' : 'L'}</option>
                                <option value="bag">{isKa ? 'ტომარა' : 'bag'}</option>
                                <option value="box">{isKa ? 'ყუთი' : 'box'}</option>
                                <option value="meter">{isKa ? 'მეტრი' : 'meter'}</option>
                            </datalist>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                {isKa ? 'შენახვის ლოკაცია' : 'Initial Stock Location'}
                            </label>
                            <select
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                            >
                                <option value="main">{isKa ? 'მთავარი საწყობი' : 'Main Warehouse'}</option>
                                {subStocks.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                {isKa ? 'ერთეულის ფასი (სავარაუდო)' : 'Unit Cost (Optional)'}
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={unitCost}
                                onChange={(e) => setUnitCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder="0.00"
                                className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            {isKa ? 'შტრიხკოდი / SKU (თუ აქვს)' : 'Barcode / SKU (Optional)'}
                        </label>
                        <input
                            type="text"
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            placeholder={isKa ? 'სკანირებული კოდი ან არტიკული...' : 'Scan code or item code...'}
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            {isKa ? 'შენიშვნა' : 'Notes'}
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={isKa ? 'მაგ. მიიღო დათომ ჩრდილოეთის ბლოკისთვის' : 'e.g. Delivered by vendor without invoice yet'}
                            className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        >
                            {isKa ? 'გაუქმება' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-amber-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                            <Check className="w-4 h-4" />
                            <span>{isKa ? 'უკატეგორიოდ დამატება' : 'Drop into Inbox'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default QuickAddUncategorizedModal;
