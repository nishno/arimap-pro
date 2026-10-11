import React, { useState } from 'react';
import type { SubStock, InventoryItem } from '../../types';
import { 
    Warehouse, Plus, ArrowRightLeft, MapPin, User, Phone, 
    Trash2, Edit3, Check, X, ShieldCheck, Layers, ExternalLink, Box
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { toast } from 'sonner';

interface SubStocksManagerProps {
    subStocks: SubStock[];
    onSetSubStocks: (stocks: SubStock[]) => void;
    inventoryItems: InventoryItem[];
    onOpenTransfer: (preselectedSourceId?: string) => void;
    onFilterByLocation: (locationId: string) => void;
}

export const SubStocksManager: React.FC<SubStocksManagerProps> = ({
    subStocks,
    onSetSubStocks,
    inventoryItems,
    onOpenTransfer,
    onFilterByLocation
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingSubStock, setEditingSubStock] = useState<SubStock | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [locationDescription, setLocationDescription] = useState('');
    const [managerName, setManagerName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [notes, setNotes] = useState('');

    const openCreateModal = () => {
        setEditingSubStock(null);
        setName('');
        setCode(`SUB-0${subStocks.length + 1}`);
        setLocationDescription('');
        setManagerName('');
        setContactPhone('');
        setNotes('');
        setIsAddModalOpen(true);
    };

    const openEditModal = (sub: SubStock) => {
        setEditingSubStock(sub);
        setName(sub.name);
        setCode(sub.code);
        setLocationDescription(sub.locationDescription || '');
        setManagerName(sub.managerName || '');
        setContactPhone(sub.contactPhone || '');
        setNotes(sub.notes || '');
        setIsAddModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !code.trim()) {
            toast.error(isKa ? 'გთხოვთ შეავსოთ სახელი და კოდი' : 'Please fill name and code');
            return;
        }

        if (editingSubStock) {
            const updated = subStocks.map(s => s.id === editingSubStock.id ? {
                ...s,
                name: name.trim(),
                code: code.trim().toUpperCase(),
                locationDescription: locationDescription.trim() || undefined,
                managerName: managerName.trim() || undefined,
                contactPhone: contactPhone.trim() || undefined,
                notes: notes.trim() || undefined,
            } : s);
            onSetSubStocks(updated);
            toast.success(isKa ? 'ქვესაწყობი განახლებულია!' : 'Sub-stock updated!');
        } else {
            const newSub: SubStock = {
                id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                name: name.trim(),
                code: code.trim().toUpperCase(),
                locationDescription: locationDescription.trim() || undefined,
                managerName: managerName.trim() || undefined,
                contactPhone: contactPhone.trim() || undefined,
                notes: notes.trim() || undefined,
                connectedToMain: true,
                createdAt: new Date().toISOString()
            };
            onSetSubStocks([...subStocks, newSub]);
            toast.success(isKa ? 'ახალი ქვესაწყობი წარმატებით შეიქმნა!' : 'New sub-stock created!');
        }
        setIsAddModalOpen(false);
    };

    const handleDelete = (id: string, name: string) => {
        if (!window.confirm(isKa ? `დარწმუნებული ხართ, რომ გსურთ წაშალოთ "${name}"?` : `Are you sure you want to delete "${name}"?`)) {
            return;
        }
        onSetSubStocks(subStocks.filter(s => s.id !== id));
        toast.info(isKa ? 'ქვესაწყობი წაიშალა' : 'Sub-stock deleted');
    };

    // Calculate metrics for Main Stock
    const mainItems = inventoryItems.filter(i => !i.subStockId && i.category !== 'Produce' && !i.isPrivate);
    const mainValue = mainItems.reduce((sum, i) => sum + ((i.currentStock || 0) * (i.unitCost || 0)), 0);

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
                <div>
                    <h2 className="text-base font-black tracking-tight text-slate-800 flex items-center gap-2">
                        <Warehouse className="w-5 h-5 text-blue-600" />
                        <span>{isKa ? 'საწყობების & ლოკაციების ქსელი' : 'Warehouses & Sub-Stocks Network'}</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isKa 
                            ? 'მთავარი ცენტრალური საწყობი და ნაკვეთებთან დაკავშირებული ქვესაწყობები' 
                            : 'Central hub and field sub-stocks linked with inter-warehouse transfers'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenTransfer()}
                        className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer border border-blue-200"
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>{isKa ? 'გადატანა' : 'Transfer Stock'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>{isKa ? '+ ქვესაწყობის დამატება' : '+ Add Sub-Stock'}</span>
                    </button>
                </div>
            </div>

            {/* Warehouse Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 1. Main Central Warehouse (Anchor) */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-blue-500/30 text-blue-300 rounded-lg flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {isKa ? 'მთავარი ჰაბი' : 'Central Hub'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                                CODE: MAIN-01
                            </span>
                        </div>
                        <h3 className="text-lg font-black text-white">
                            {isKa ? 'მთავარი ცენტრალური საწყობი' : 'Main Central Warehouse'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-400" />
                            {isKa ? 'ცენტრალური ბაზა & ადმინისტრაცია' : 'Central Base & Operations'}
                        </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-700/60 grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                                {isKa ? 'ნივთების რაოდენობა' : 'Total Items'}
                            </span>
                            <span className="text-base font-black text-white">
                                {mainItems.length} {isKa ? 'პოზიცია' : 'SKUs'}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                                {isKa ? 'მარაგის ღირებულება' : 'Stock Value'}
                            </span>
                            <span className="text-base font-black text-emerald-400">
                                {formatCurrency(mainValue)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-5 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onFilterByLocation('main')}
                            className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Box className="w-3.5 h-3.5" />
                            <span>{isKa ? 'ნივთების ნახვა' : 'View Catalog'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenTransfer('main')}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors cursor-pointer"
                            title={isKa ? 'გადატანა ამ საწყობიდან' : 'Transfer from Main Stock'}
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 2. Sub-Stocks */}
                {subStocks.map(sub => {
                    const subItems = inventoryItems.filter(i => i.subStockId === sub.id && i.category !== 'Produce' && !i.isPrivate);
                    const subVal = subItems.reduce((sum, i) => sum + ((i.currentStock || 0) * (i.unitCost || 0)), 0);

                    return (
                        <div key={sub.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between hover:border-blue-200 transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                        {isKa ? 'დაკავშირებული' : 'Linked Sub-Stock'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[11px] font-bold text-slate-400">
                                            {sub.code}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(sub)}
                                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ml-1"
                                            title={isKa ? 'რედაქტირება' : 'Edit'}
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(sub.id, sub.name)}
                                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                            title={isKa ? 'წაშლა' : 'Delete'}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-base font-black text-slate-800">
                                    {sub.name}
                                </h3>
                                {sub.locationDescription && (
                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {sub.locationDescription}
                                    </p>
                                )}
                                {sub.managerName && (
                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{sub.managerName}</span>
                                        {sub.contactPhone && (
                                            <span className="text-slate-400">({sub.contactPhone})</span>
                                        )}
                                    </p>
                                )}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                                        {isKa ? 'ნივთები' : 'Items'}
                                    </span>
                                    <span className="text-base font-black text-slate-800">
                                        {subItems.length} {isKa ? 'პოზიცია' : 'SKUs'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                                        {isKa ? 'ღირებულება' : 'Stock Value'}
                                    </span>
                                    <span className="text-base font-black text-emerald-600">
                                        {formatCurrency(subVal)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-5 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => onFilterByLocation(sub.id)}
                                    className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Box className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{isKa ? 'ნივთების ნახვა' : 'View Catalog'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenTransfer(sub.id)}
                                    className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors cursor-pointer"
                                    title={isKa ? 'გადატანა ამ ქვესაწყობიდან' : 'Transfer from this Sub-Stock'}
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal for Add / Edit Sub-Stock */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <Warehouse className="w-5 h-5 text-blue-400" />
                                <h3 className="text-base font-black">
                                    {editingSubStock ? (isKa ? 'ქვესაწყობის რედაქტირება' : 'Edit Sub-Stock') : (isKa ? 'ახალი ქვესაწყობის შექმნა' : 'Create New Sub-Stock')}
                                </h3>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    {isKa ? 'ქვესაწყობის სახელი' : 'Sub-Stock Name'} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={isKa ? 'მაგ. ჩრდილოეთის ნაკვეთის საწყობი' : 'e.g. North Field Chemical Shed'}
                                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                        {isKa ? 'საიდენტიფიკაციო კოდი' : 'Identifier Code'} <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="SUB-01"
                                        className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 uppercase"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                        {isKa ? 'ტელეფონი' : 'Contact Phone'}
                                    </label>
                                    <input
                                        type="text"
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                        placeholder="+995..."
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    {isKa ? 'მდებარეობა / ნაკვეთი' : 'Physical Location / Sector'}
                                </label>
                                <input
                                    type="text"
                                    value={locationDescription}
                                    onChange={(e) => setLocationDescription(e.target.value)}
                                    placeholder={isKa ? 'მაგ. სექტორი 4, ჩრდილოეთის ჭიშკართან' : 'e.g. Sector 4, North Entrance Bunker'}
                                    className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    {isKa ? 'პასუხისმგებელი პირი / მენეჯერი' : 'Responsible Manager'}
                                </label>
                                <input
                                    type="text"
                                    value={managerName}
                                    onChange={(e) => setManagerName(e.target.value)}
                                    placeholder={isKa ? 'მაგ. გიორგი ბერიძე' : 'e.g. David Smith'}
                                    className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    {isKa ? 'შენიშვნები' : 'Notes / Storage Specifics'}
                                </label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={isKa ? 'მაგ. ვენტილირებადი სათავსო ქიმიკატებისთვის' : 'e.g. Ventilated lockable container for bio-stimulants'}
                                    className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-blue-200 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>{editingSubStock ? (isKa ? 'შენახვა' : 'Save') : (isKa ? 'შექმნა' : 'Create')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default SubStocksManager;
