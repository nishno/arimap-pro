import React, { useState } from 'react';
import type { InventoryItem, RefrigeratorLot, HarvestEvent } from '../types';
import { Snowflake, Calendar, DollarSign, Layers, Users, Truck, X, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

interface SendToRefrigeratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem;
    harvestEvents?: HarvestEvent[];
    onConfirmTransfer: (
        item: InventoryItem, 
        refrigeratorLot: RefrigeratorLot
    ) => void;
}

export const SendToRefrigeratorModal: React.FC<SendToRefrigeratorModalProps> = ({
    isOpen,
    onClose,
    item,
    harvestEvents = [],
    onConfirmTransfer
}) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    const relatedEvent = harvestEvents.find(e => e.id === item.relatedHarvestId);
    const initialKg = item.currentStock || item.coldStorageKg || 200;

    // Form states
    const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [pricePerKg, setPricePerKg] = useState<number>(item.coldStoragePrice || item.unitCost || 10);
    const [quantityKg, setQuantityKg] = useState<number>(initialKg);
    const [palletsType, setPalletsType] = useState<'Euro' | 'Standard' | 'Other'>('Euro');
    const [palletsCount, setPalletsCount] = useState<number>(Math.ceil(initialKg / 250));
    const [boxesCount, setBoxesCount] = useState<number>(item.physicalBoxes || Math.ceil(initialKg / 5));
    const [punnetsCount, setPunnetsCount] = useState<number>(item.physicalPunnets || Math.ceil(initialKg / 5) * 8);
    
    // Room Placement & Side
    const [selectedRoom, setSelectedRoom] = useState<string>('Cold Room #1 (Main Cooler)');
    const [roomZone, setRoomZone] = useState<'North Wall' | 'South Wall' | 'East Wall' | 'West Wall' | 'Center Isle'>('North Wall');
    const [rackNote, setRackNote] = useState<string>('Rack A - Row 1');

    // Loaders & Staff
    const [loadersType, setLoadersType] = useState<'OUR_TEAM' | 'REFRIGERATOR_SERVICE' | 'MIXED'>('OUR_TEAM');
    const [loaderNames, setLoaderNames] = useState<string>('Davit, Giorgi');
    const [loaderCost, setLoaderCost] = useState<number>(0);
    const [targetTemperature, setTargetTemperature] = useState<number>(2.0);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (quantityKg <= 0) {
            toast.error(isKa ? 'გთხოვთ მიუთითოთ ვალიდური წონა.' : 'Please enter a valid weight quantity for cold storage.');
            return;
        }

        const lotId = `REF-LOT-${Date.now().toString().slice(-4)}`;
        const fullPlacement = `${selectedRoom} - ${roomZone} (${rackNote})`;

        const refLot: RefrigeratorLot = {
            id: `ref-${Date.now()}`,
            lotNumber: lotId,
            harvestEventId: item.relatedHarvestId,
            harvestEventName: relatedEvent ? String(relatedEvent.name || (isKa ? 'მოსავლის აღება' : 'Harvest Event')) : item.name,
            harvestDate: item.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            arrivalDateTime: `${transferDate}T09:00:00`,
            arrivalDayPricePerKg: pricePerKg,
            totalNetKg: quantityKg,
            remainingNetKg: quantityKg,
            palletsType,
            palletsCount,
            boxesCount,
            punnetsCount,
            loadersType,
            loaderCount: loaderNames ? loaderNames.split(',').length : 1,
            loaderNames,
            loaderCost,
            roomPlacementNotes: fullPlacement,
            status: 'IN_REFRIGERATOR',
            salesHistory: []
        };

        const updatedItem: InventoryItem = {
            ...item,
            status: 'IN_REFRIGERATOR',
            fulfillmentType: 'REFRIGERATOR',
            coldStorageKg: quantityKg,
            coldStoragePrice: pricePerKg,
            coldStorageLocation: fullPlacement,
            refrigeratorLot: refLot
        };

        onConfirmTransfer(updatedItem, refLot);
        toast.success(isKa ? `წარმატებით გადავიდა ${quantityKg} კგ (${item.name}) ${fullPlacement}-ში!` : `Successfully transferred ${quantityKg} KG of ${item.name} to ${fullPlacement}!`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[2030] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-6 my-auto max-h-[92vh] flex flex-col justify-between">
                
                {/* Modal Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-2xl">
                            <Snowflake className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100">
                                {isKa ? 'სამაცივრე მარშრუტიზაცია' : 'Cold Storage Routing'}
                            </span>
                            <h3 className="font-black text-lg text-slate-900 mt-1">
                                {isKa ? `${item.name} - მაცივარში გადატანა` : `Send ${item.name} to Refrigerator`}
                            </h3>
                            <p className="text-xs text-slate-400 font-bold">
                                {isKa ? 'პარტიის ID:' : 'Batch ID:'} {item.batch_id || item.sku || 'N/A'} • {isKa ? 'ხელმისაწვდომი:' : 'Available:'} {initialKg} {isKa ? 'კგ' : 'KG'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="space-y-5 overflow-y-auto pr-1 text-xs font-bold text-slate-700">
                    
                    {/* Transfer Date & Storage Valuation */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-cyan-600" /> {isKa ? 'გადატანის თარიღი' : 'Transfer Date'}
                            </label>
                            <input 
                                type="date"
                                value={transferDate}
                                onChange={e => setTransferDate(e.target.value)}
                                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                                <DollarSign className="w-3 h-3 text-emerald-600" /> {isKa ? 'ფასი / კგ' : 'Valuation Price / KG'}
                            </label>
                            <input 
                                type="number"
                                step="any"
                                value={pricePerKg}
                                onChange={e => setPricePerKg(Number(e.target.value))}
                                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                                {isKa ? 'შესანახი წონა (კგ)' : 'Storage Weight (KG)'}
                            </label>
                            <input 
                                type="number"
                                step="any"
                                value={quantityKg}
                                onChange={e => setQuantityKg(Number(e.target.value))}
                                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Room & Placement Location */}
                    <div className="space-y-3 bg-cyan-50/40 p-4 rounded-2xl border border-cyan-100">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-cyan-900 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-cyan-700" /> {isKa ? 'მაცივრის ოთახი და ზონა' : 'Cold Room Location & Side Placement'}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">{isKa ? 'მაცივრის ოთახი' : 'Cold Room'}</label>
                                <select
                                    value={selectedRoom}
                                    onChange={e => setSelectedRoom(e.target.value)}
                                    className="w-full p-2 bg-white border border-cyan-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                                >
                                    <option value="Cold Room #1 (Main Cooler)">{isKa ? 'საცივრე #1 (მთავარი მაცივარი)' : 'Cold Room #1 (Main Cooler)'}</option>
                                    <option value="Cold Room #2 (Deep Freeze)">{isKa ? 'საცივრე #2 (ღრმა გაყინვა)' : 'Cold Room #2 (Deep Freeze)'}</option>
                                    <option value="Cold Room #3 (Staging Area)">{isKa ? 'საცივრე #3 (დროებითი შენახვა)' : 'Cold Room #3 (Staging Area)'}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">{isKa ? 'კედელი / ზონა' : 'Room Side / Wall Zone'}</label>
                                <select
                                    value={roomZone}
                                    onChange={e => setRoomZone(e.target.value as any)}
                                    className="w-full p-2 bg-white border border-cyan-200 rounded-xl font-black text-cyan-900 cursor-pointer"
                                >
                                    <option value="North Wall">🧱 {isKa ? 'ჩრდილოეთის კედელი' : 'North Wall'}</option>
                                    <option value="South Wall">🧱 {isKa ? 'სამხრეთის კედელი' : 'South Wall'}</option>
                                    <option value="East Wall">🧱 {isKa ? 'აღმოსავლეთის კედელი' : 'East Wall'}</option>
                                    <option value="West Wall">🧱 {isKa ? 'დასავლეთის კედელი' : 'West Wall'}</option>
                                    <option value="Center Isle">📦 {isKa ? 'ცენტრალური გასასვლელი' : 'Center Isle'}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">{isKa ? 'თარო / რიგი' : 'Rack / Bay Note'}</label>
                                <input 
                                    type="text"
                                    value={rackNote}
                                    onChange={e => setRackNote(e.target.value)}
                                    placeholder={isKa ? "მაგ. თარო B, რიგი 2" : "e.g. Rack B, Shelf 2"}
                                    className="w-full p-2 bg-white border border-cyan-200 rounded-xl font-bold text-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pallets & Packaging */}
                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-500" /> {isKa ? 'პალეტები და შეფუთვა' : 'Pallets & Packaging Details'}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">{isKa ? 'პალეტის ტიპი' : 'Pallet Type'}</label>
                                <select
                                    value={palletsType}
                                    onChange={e => setPalletsType(e.target.value as any)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold cursor-pointer"
                                >
                                    <option value="Euro">Euro (80x120cm)</option>
                                    <option value="Standard">Standard (100x120cm)</option>
                                    <option value="Other">{isKa ? 'სხვა / ინდივიდუალური' : 'Custom / Other'}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">{isKa ? 'პალეტები' : 'Pallets'}</label>
                                <input 
                                    type="number"
                                    value={palletsCount}
                                    onChange={e => setPalletsCount(Number(e.target.value))}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">{isKa ? 'ყუთები' : 'Boxes'}</label>
                                <input 
                                    type="number"
                                    value={boxesCount}
                                    onChange={e => setBoxesCount(Number(e.target.value))}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">{isKa ? 'პანეტები' : 'Punnets'}</label>
                                <input 
                                    type="number"
                                    value={punnetsCount}
                                    onChange={e => setPunnetsCount(Number(e.target.value))}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Loaders & Equipment */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                                <Users className="w-3 h-3" /> {isKa ? 'მტვირთავები' : 'Loaders Type'}
                            </label>
                            <select
                                value={loadersType}
                                onChange={e => setLoadersType(e.target.value as any)}
                                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold cursor-pointer"
                            >
                                <option value="OUR_TEAM">{isKa ? 'ჩვენი გუნდი' : 'Our Staff'}</option>
                                <option value="REFRIGERATOR_SERVICE">{isKa ? 'მაცივრის სერვისი' : 'Cooler Service'}</option>
                                <option value="MIXED">{isKa ? 'შერეული' : 'Mixed Team'}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">{isKa ? 'მტვირთავების სახელები' : 'Loaders Names'}</label>
                            <input 
                                type="text"
                                value={loaderNames}
                                onChange={e => setLoaderNames(e.target.value)}
                                placeholder={isKa ? "მტვირთავების სახელები" : "Names of staff"}
                                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">{isKa ? 'სამიზნე ტემპერატურა (°C)' : 'Target Temp (°C)'}</label>
                            <input 
                                type="number"
                                step="0.5"
                                value={targetTemperature}
                                onChange={e => setTargetTemperature(Number(e.target.value))}
                                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-cyan-700"
                            />
                        </div>
                    </div>

                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-100 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                        {isKa ? 'გაუქმება' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <Snowflake className="w-4 h-4" /> {isKa ? 'მაცივარში გადატანის დადასტურება' : 'Confirm & Transfer to Refrigerator'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SendToRefrigeratorModal;
