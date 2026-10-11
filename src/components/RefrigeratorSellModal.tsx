import React, { useState } from 'react';
import type { RefrigeratorLot, RefrigeratorSaleRecord, Account } from '../types';
import { XCircleIcon, CheckIcon, Banknote, Truck, Snowflake, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

interface RefrigeratorSellModalProps {
    isOpen: boolean;
    onClose: () => void;
    lot: RefrigeratorLot | null;
    accounts?: Account[];
    onConfirmSell: (
        lotId: string, 
        saleRecord: RefrigeratorSaleRecord, 
        paymentTx?: { amount: number; type: 'CASH' | 'LTD'; description: string; recipient?: string; accountId?: string }
    ) => void;
}

export const RefrigeratorSellModal: React.FC<RefrigeratorSellModalProps> = ({
    isOpen,
    onClose,
    lot,
    accounts = [],
    onConfirmSell
}) => {
    const { formatCurrency, currency, language } = useLanguage();
    const isKa = language === 'ka';

    if (!isOpen || !lot) return null;

    const availableKg = lot.remainingNetKg;
    const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [soldKg, setSoldKg] = useState<number>(availableKg);
    const [pricePerKg, setPricePerKg] = useState<number>(lot.arrivalDayPricePerKg || 10);
    const [buyerName, setBuyerName] = useState<string>('');

    // Logistics
    const [transportType, setTransportType] = useState<'BUYER' | 'OWNER'>('BUYER');
    const [vehicleInfo, setVehicleInfo] = useState<string>('');
    const [driverName, setDriverName] = useState<string>('');
    const [driverCost, setDriverCost] = useState<number>(0);
    const [loadersCount, setLoadersCount] = useState<number>(0);
    const [loadersNames, setLoadersNames] = useState<string>('');
    const [loadersCost, setLoadersCost] = useState<number>(0);

    // Payment
    const [paymentType, setPaymentType] = useState<'CASH' | 'LTD'>('CASH');
    const [paymentMode, setPaymentMode] = useState<'HAND' | 'BANK'>('HAND');
    const [paymentRecipient, setPaymentRecipient] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const grossRevenue = soldKg * pricePerKg;

    const handleExecute = () => {
        if (soldKg <= 0) {
            toast.error(isKa ? 'გასაყიდი წმინდა წონა უნდა იყოს 0-ზე მეტი.' : 'Sold net weight must be greater than 0 KG.');
            return;
        }
        if (soldKg > availableKg) {
            toast.error(isKa ? `არ შეგიძლიათ გაყიდოთ არსებულ ნაშთზე (${availableKg.toFixed(1)} კგ) მეტი.` : `Cannot sell more than available refrigerator stock (${availableKg.toFixed(1)} KG).`);
            return;
        }

        const saleRecord: RefrigeratorSaleRecord = {
            saleId: `SALE-${Date.now().toString().slice(-4)}`,
            saleDate: saleDate || new Date().toISOString().split('T')[0],
            soldNetKg: soldKg,
            pricePerKg,
            totalRevenue: grossRevenue,
            buyerName: buyerName || (isKa ? 'პირდაპირი კლიენტი' : 'Direct Client'),
            transportType,
            vehicleInfo,
            driverName,
            driverCost: transportType === 'OWNER' ? driverCost : 0,
            loadersCount,
            loadersNames,
            loadersCost,
            paymentType,
            paymentMode,
            paymentRecipient,
            notes
        };

        let paymentTx = undefined;
        if (grossRevenue > 0) {
            paymentTx = {
                amount: grossRevenue,
                type: paymentType,
                description: `Cold Storage Refrigerator Sale [${lot.lotNumber}]: ${soldKg} KG @ $${pricePerKg}/KG`,
                recipient: paymentRecipient || buyerName || (isKa ? 'მაცივრიდან მყიდველი' : 'Refrigerator Buyer')
            };
        }

        onConfirmSell(lot.id, saleRecord, paymentTx);
        toast.success(isKa ? `წარმატებით გაიყიდა ${soldKg} კგ (პარტია #${lot.lotNumber})!` : `Successfully sold ${soldKg} KG from Refrigerator Lot ${lot.lotNumber}!`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[2010] flex items-center justify-center p-3 md:p-6 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col">
                
                {/* Header */}
                <div className="bg-sky-950 text-white p-5 px-6 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-sky-500/20 text-sky-300 font-mono text-[10px] uppercase font-black tracking-widest rounded-full border border-sky-500/30">
                                {isKa ? 'მაცივრის რეალიზაცია' : 'Cold Storage Sale'}
                            </span>
                            <span className="text-xs text-sky-200 font-bold font-mono">
                                #{lot.lotNumber}
                            </span>
                        </div>
                        <h2 className="text-lg font-black mt-1 text-slate-100 flex items-center gap-2">
                            {lot.harvestEventName || (isKa ? 'მაცივრის ნაშთი' : 'Refrigerator Stock')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 text-slate-800 text-xs overflow-y-auto max-h-[75vh]">
                    
                    {/* Lot Info Badge */}
                    <div className="bg-sky-50 p-3.5 rounded-2xl border border-sky-100 flex flex-wrap justify-between items-center gap-3">
                        <div>
                            <span className="block text-[9px] font-black uppercase text-sky-800">{isKa ? 'ნაშთი მაცივარში' : 'Available Storage Stock'}</span>
                            <span className="text-base font-black text-sky-950">{availableKg.toFixed(1)} <span className="text-xs text-slate-500">{isKa ? 'კგ' : 'KG'}</span></span>
                        </div>
                        <div>
                            <span className="block text-[9px] font-black uppercase text-sky-800">{isKa ? 'შემოსვლის ფასი' : 'Arrival Benchmark'}</span>
                            <span className="text-base font-black text-emerald-700">{formatCurrency(lot.arrivalDayPricePerKg)} / {isKa ? 'კგ' : 'KG'}</span>
                        </div>
                        <div>
                            <span className="block text-[9px] font-black uppercase text-sky-800">{isKa ? 'მდებარეობა' : 'Placement'}</span>
                            <span className="text-xs font-extrabold text-slate-700">{lot.roomPlacementNotes || (isKa ? 'საცივრე ოთახი' : 'Cold Room')}</span>
                        </div>
                    </div>

                    {/* Sales Parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{isKa ? 'თარიღი' : 'Sale Date'}</label>
                            <input
                                type="date"
                                value={saleDate}
                                onChange={e => setSaleDate(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{isKa ? 'გასაყიდი წონა (კგ)' : 'Quantity to Sell (KG)'}</label>
                            <input
                                type="number"
                                step="any"
                                max={availableKg}
                                value={soldKg}
                                onChange={e => setSoldKg(Number(e.target.value))}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{isKa ? `გასაყიდი ფასი / კგ (${currency})` : `Selling Price / KG (${currency})`}</label>
                            <input
                                type="number"
                                step="any"
                                value={pricePerKg}
                                onChange={e => setPricePerKg(Number(e.target.value))}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{isKa ? 'მყიდველი' : 'Buyer Name'}</label>
                            <input
                                type="text"
                                placeholder={isKa ? "მყიდველის სახელი..." : "Buyer / Client name..."}
                                value={buyerName}
                                onChange={e => setBuyerName(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>

                    {/* Total Revenue Box */}
                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 flex justify-between items-center font-extrabold text-xs">
                        <span className="text-emerald-900">{isKa ? 'ჯამური თანხა:' : 'Total Invoice Amount:'}</span>
                        <span className="text-lg font-black text-emerald-700">{formatCurrency(grossRevenue)}</span>
                    </div>

                    {/* Transport Option */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="block text-[10px] font-black uppercase text-slate-500">{isKa ? 'ტრანსპორტირება' : 'Transport Arrangement'}</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setTransportType('BUYER')}
                                className={`flex-1 py-2 rounded-xl font-black text-[11px] uppercase transition-all cursor-pointer ${transportType === 'BUYER' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                🚛 {isKa ? 'მყიდველის ტრანსპორტი' : 'Buyer Collects'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setTransportType('OWNER')}
                                className={`flex-1 py-2 rounded-xl font-black text-[11px] uppercase transition-all cursor-pointer ${transportType === 'OWNER' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                🚙 {isKa ? 'ჩვენი ტრანსპორტი' : 'Owner Transport'}
                            </button>
                        </div>

                        {transportType === 'OWNER' && (
                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                <input type="text" placeholder={isKa ? "მანქანის ნომერი" : "Car / Transit #"} value={vehicleInfo} onChange={e => setVehicleInfo(e.target.value)} className="p-2 bg-white rounded-lg font-bold text-xs" />
                                <input type="text" placeholder={isKa ? "მძღოლის სახელი" : "Driver Name"} value={driverName} onChange={e => setDriverName(e.target.value)} className="p-2 bg-white rounded-lg font-bold text-xs" />
                                <input type="number" placeholder={isKa ? "მძღოლის ხარჯი" : "Driver Cost"} value={driverCost || ''} onChange={e => setDriverCost(Number(e.target.value))} className="p-2 bg-white rounded-lg font-bold text-xs" />
                                <input type="number" placeholder={isKa ? "მტვირთავების ხარჯი" : "Loaders Cost"} value={loadersCost || ''} onChange={e => setLoadersCost(Number(e.target.value))} className="p-2 bg-white rounded-lg font-bold text-xs" />
                            </div>
                        )}
                    </div>

                    {/* Payment Options */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="block text-[10px] font-black uppercase text-slate-500">{isKa ? 'ანგარიშსწორება' : 'Payment Account'}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className={`p-2.5 rounded-xl border cursor-pointer font-extrabold text-center transition-all ${paymentType === 'CASH' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                                <input type="radio" checked={paymentType === 'CASH'} onChange={() => setPaymentType('CASH')} className="sr-only" />
                                💵 {isKa ? 'ნაღდი ანგარიშსწორება' : 'Cash Payment'}
                            </label>
                            <label className={`p-2.5 rounded-xl border cursor-pointer font-extrabold text-center transition-all ${paymentType === 'LTD' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                                <input type="radio" checked={paymentType === 'LTD'} onChange={() => setPaymentType('LTD')} className="sr-only" />
                                🏦 {isKa ? 'უნაღდო (შპს საბანკო ანგარიში)' : 'LTD Bank Settlement'}
                            </label>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 px-6 bg-slate-50 border-t border-slate-200/80 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer"
                    >
                        {isKa ? 'გაუქმება' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={handleExecute}
                        className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                        <CheckIcon className="w-4 h-4" />
                        {isKa ? 'გაყიდვის დადასტურება' : 'Execute Refrigerator Sale'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default RefrigeratorSellModal;
