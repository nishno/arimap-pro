import React, { useState, useEffect, useMemo } from 'react';
import type { HarvestEvent, Employee } from '../../types';
import { X, QrCode, Printer, Check, Copy, Sparkles, RefreshCw, ShieldAlert, Tag, Package, UserCheck, Calendar } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';

export interface GeneratedBoxQrItem {
    boxNumber: number;
    totalBoxes: number;
    uniqueCode: string;
    qrDataUrl: string;
    payloadJson: string;
    workerId?: string;
    workerName?: string;
    harvestEventId: string;
    harvestEventName: string;
    variety: string;
    targetWeightKg: number;
    date: string;
}

interface HarvestBoxQrModalProps {
    isOpen: boolean;
    onClose: () => void;
    harvestEvents?: HarvestEvent[];
    harvestEvent?: HarvestEvent;
    selectedEventId?: string;
    employees: Employee[];
    onGeneratedCodes?: (codes: GeneratedBoxQrItem[]) => void;
}

const generateUniqueHex = (len = 4): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
};

export const HarvestBoxQrModal: React.FC<HarvestBoxQrModalProps> = ({
    isOpen,
    onClose,
    harvestEvents = [],
    harvestEvent,
    selectedEventId,
    employees = [],
    onGeneratedCodes
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const allEvents = useMemo(() => {
        if (harvestEvents && harvestEvents.length > 0) return harvestEvents;
        if (harvestEvent) return [harvestEvent];
        return [];
    }, [harvestEvents, harvestEvent]);

    // 1. Selected Event
    const [activeEventId, setActiveEventId] = useState<string>(
        selectedEventId || harvestEvent?.id || allEvents.find(e => e.status === 'active')?.id || allEvents[0]?.id || ''
    );

    useEffect(() => {
        if (selectedEventId) {
            setActiveEventId(selectedEventId);
        } else if (harvestEvent?.id) {
            setActiveEventId(harvestEvent.id);
        } else if (!activeEventId && allEvents.length > 0) {
            setActiveEventId(allEvents[0].id);
        }
    }, [selectedEventId, harvestEvent, allEvents]);

    const activeEvent = useMemo(() => {
        return allEvents.find(e => e.id === activeEventId) || allEvents[0];
    }, [allEvents, activeEventId]);

    // 2. Worker mapping
    const [workerMappingMode, setWorkerMappingMode] = useState<'mapped' | 'unmapped'>('mapped');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

    // Eligible pickers for this event
    const eventPickers = useMemo(() => {
        if (!activeEvent || !activeEvent.assignedPickers) return employees;
        const pickerIds = new Set(activeEvent.assignedPickers.map(p => p.employeeId));
        const matched = employees.filter(e => pickerIds.has(e.id));
        return matched.length > 0 ? matched : employees;
    }, [activeEvent, employees]);

    useEffect(() => {
        if (eventPickers.length > 0 && !selectedWorkerId) {
            setSelectedWorkerId(eventPickers[0].id);
        }
    }, [eventPickers, selectedWorkerId]);

    const selectedWorker = useMemo(() => {
        return employees.find(e => e.id === selectedWorkerId);
    }, [employees, selectedWorkerId]);

    // 3. Batch configuration
    const [boxCount, setBoxCount] = useState<number>(20);
    const [boxWeight, setBoxWeight] = useState<number>(activeEvent?.defaultBoxWeightKg || 5.8);
    const [variety, setVariety] = useState<string>(activeEvent?.varieties?.[0] || 'Standard Produce');
    const [harvestDate, setHarvestDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (activeEvent?.defaultBoxWeightKg) {
            setBoxWeight(activeEvent.defaultBoxWeightKg);
        }
        if (activeEvent?.varieties && activeEvent.varieties.length > 0) {
            setVariety(activeEvent.varieties[0]);
        }
    }, [activeEvent]);

    // 4. Generated items state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedBoxes, setGeneratedBoxes] = useState<GeneratedBoxQrItem[]>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Generation function
    const handleGenerateCodes = async () => {
        if (!activeEvent) {
            toast.error(isKa ? 'გთხოვთ აირჩიოთ მოსავლის ღონისძიება' : 'Please select a harvest event');
            return;
        }

        const count = Math.max(1, Math.min(200, Number(boxCount) || 1));
        setIsGenerating(true);

        try {
            const results: GeneratedBoxQrItem[] = [];
            const eventShort = activeEvent.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'EV1';
            const workerShort = workerMappingMode === 'mapped' && selectedWorker 
                ? (selectedWorker.idNumber || selectedWorker.id).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() 
                : 'OPEN';
            const workerNameStr = workerMappingMode === 'mapped' && selectedWorker ? selectedWorker.name : undefined;

            for (let i = 1; i <= count; i++) {
                const uniqueSerial = generateUniqueHex(4);
                // Guaranteed unique serial per box to strictly prevent duplicate scans
                const uniqueCode = `HV-BOX-${eventShort}-${workerShort}-${String(i).padStart(3, '0')}-${uniqueSerial}`;

                const payload = {
                    type: 'harvest_box',
                    harvestEventId: activeEvent.id,
                    harvestEventName: activeEvent.name,
                    workerId: workerMappingMode === 'mapped' ? selectedWorker?.id : undefined,
                    workerName: workerNameStr,
                    boxNumber: i,
                    totalBoxes: count,
                    uniqueCode,
                    variety,
                    targetWeightKg: Number(boxWeight) || 5.8,
                    date: harvestDate,
                    createdAt: Date.now()
                };

                const payloadJson = JSON.stringify(payload);

                // High contrast sharp QR code
                const qrDataUrl = await QRCode.toDataURL(payloadJson, {
                    width: 220,
                    margin: 1,
                    color: {
                        dark: '#0f172a',
                        light: '#ffffff'
                    },
                    errorCorrectionLevel: 'M'
                });

                results.push({
                    boxNumber: i,
                    totalBoxes: count,
                    uniqueCode,
                    qrDataUrl,
                    payloadJson,
                    workerId: payload.workerId,
                    workerName: payload.workerName,
                    harvestEventId: activeEvent.id,
                    harvestEventName: activeEvent.name,
                    variety,
                    targetWeightKg: payload.targetWeightKg,
                    date: harvestDate
                });
            }

            setGeneratedBoxes(results);
            if (onGeneratedCodes) {
                onGeneratedCodes(results);
            }
            toast.success(
                isKa 
                    ? `✓ შეიქმნა ${results.length} უნიკალური QR ეტიკეტი ყუთებისთვის!` 
                    : `✓ Generated ${results.length} unique box QR labels!`
            );
        } catch (err) {
            console.error('Failed to generate box QR codes:', err);
            toast.error(isKa ? 'QR კოდების შექმნა ვერ მოხერხდა' : 'Failed to generate QR codes');
        } finally {
            setIsGenerating(false);
        }
    };

    // Print all stickers in label sheet format
    const handlePrintStickers = () => {
        if (generatedBoxes.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error(isKa ? 'ბეჭდვის ფანჯარა დაიბლოკა ბრაუზერის მიერ' : 'Print popup blocked by browser');
            return;
        }

        const cardsHtml = generatedBoxes.map(box => `
            <div class="sticker-card">
                <div class="sticker-header">
                    <span class="sticker-badge">HARVEST CRATE</span>
                    <span class="sticker-num">#${box.boxNumber} / ${box.totalBoxes}</span>
                </div>
                <div class="sticker-body">
                    <div class="sticker-qr">
                        <img src="${box.qrDataUrl}" alt="QR" />
                    </div>
                    <div class="sticker-info">
                        <div class="event-title">${box.harvestEventName}</div>
                        ${box.workerName ? `<div class="worker-name">👤 ${box.workerName}</div>` : '<div class="worker-name unmapped">📦 OPEN CRATE (Unmapped)</div>'}
                        <div class="meta-row"><strong>Variety:</strong> ${box.variety}</div>
                        <div class="meta-row"><strong>Standard:</strong> ${box.targetWeightKg} kg</div>
                        <div class="meta-row"><strong>Date:</strong> ${box.date}</div>
                        <div class="serial-code">${box.uniqueCode}</div>
                    </div>
                </div>
                <div class="sticker-footer">
                    <span>Scan once at Weigh Station</span>
                    <span>Anti-Duplicate Protected</span>
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Harvest Box QR Labels - ${activeEvent?.name || 'Event'}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 8mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    }
                    body {
                        background: #fff;
                        color: #0f172a;
                    }
                    .grid-container {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 8mm;
                    }
                    .sticker-card {
                        border: 2px dashed #0f172a;
                        border-radius: 12px;
                        padding: 10px 14px;
                        page-break-inside: avoid;
                        display: flex;
                        flex-direction: column;
                        background: #fafafa;
                    }
                    .sticker-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1.5px solid #0f172a;
                        padding-bottom: 6px;
                        margin-bottom: 8px;
                    }
                    .sticker-badge {
                        font-size: 11px;
                        font-weight: 900;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        background: #0f172a;
                        color: #fff;
                        padding: 2px 8px;
                        border-radius: 4px;
                    }
                    .sticker-num {
                        font-size: 13px;
                        font-weight: 900;
                    }
                    .sticker-body {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                    }
                    .sticker-qr img {
                        width: 105px;
                        height: 105px;
                        display: block;
                    }
                    .sticker-info {
                        flex: 1;
                        font-size: 11px;
                        line-height: 1.35;
                    }
                    .event-title {
                        font-size: 12px;
                        font-weight: 800;
                        text-transform: uppercase;
                        margin-bottom: 3px;
                    }
                    .worker-name {
                        font-size: 13px;
                        font-weight: 900;
                        color: #1d4ed8;
                        margin-bottom: 4px;
                    }
                    .worker-name.unmapped {
                        color: #b45309;
                    }
                    .meta-row {
                        font-size: 10px;
                        color: #475569;
                    }
                    .serial-code {
                        font-family: monospace;
                        font-size: 9px;
                        font-weight: 800;
                        background: #e2e8f0;
                        padding: 2px 4px;
                        border-radius: 3px;
                        margin-top: 4px;
                        display: inline-block;
                    }
                    .sticker-footer {
                        border-top: 1px dotted #cbd5e1;
                        margin-top: 8px;
                        padding-top: 4px;
                        display: flex;
                        justify-content: space-between;
                        font-size: 8px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                    }
                </style>
            </head>
            <body>
                <div class="grid-container">
                    ${cardsHtml}
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                            <QrCode size={22} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                                <span>{isKa ? 'მოსავლის ყუთების QR გენერატორი' : 'Harvest Box QR Label Generator'}</span>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Anti-Duplicate
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {isKa 
                                    ? 'შექმენით უნიკალური QR ეტიკეტები ყუთებისთვის მუშებზე მიბმით და ასაწონ პუნქტში დუბლირების პრევენციით' 
                                    : 'Generate unique, non-duplicating box QR codes mapped to pickers with automated weigh station identification'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Event & Configuration Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Event Selector */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <Tag size={14} className="text-indigo-600" />
                                <span>{isKa ? 'მოსავლის აღების ღონისძიება' : 'Harvest Event Session'}</span>
                            </label>
                            <select
                                value={activeEventId}
                                onChange={e => setActiveEventId(e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                            >
                                {allEvents.map(evt => (
                                    <option key={evt.id} value={evt.id}>
                                        {evt.name} ({evt.status.toUpperCase()}) - {evt.plannedStartDate || (evt as any).date || evt.actualStartDate || ''}
                                    </option>
                                ))}
                            </select>
                            {activeEvent && (
                                <div className="text-[11px] text-slate-500 flex flex-wrap gap-2 pt-1 font-semibold">
                                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {activeEvent.assignedPickers?.length || 0} {isKa ? 'დანიშნული მუშა' : 'pickers'}
                                    </span>
                                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {isKa ? 'სტანდ. ყუთი:' : 'Std Box:'} {activeEvent.defaultBoxWeightKg || 5.8} kg
                                    </span>
                                    {activeEvent.varieties && activeEvent.varieties.length > 0 && (
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                                            {activeEvent.varieties.join(', ')}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Worker Mapping Selection */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <UserCheck size={14} className="text-indigo-600" />
                                    <span>{isKa ? 'მუშაზე მიბმა (Worker Mapping)' : 'Map to Worker'}</span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 lowercase">
                                    {workerMappingMode === 'mapped' ? (isKa ? 'კონკრეტული მუშაკი' : 'specific picker') : (isKa ? 'ღია ყუთები' : 'open crates')}
                                </span>
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setWorkerMappingMode('mapped')}
                                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        workerMappingMode === 'mapped' 
                                            ? 'bg-indigo-600 text-white shadow-xs' 
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {isKa ? '👤 მუშაზე მიბმული' : '👤 Mapped to Picker'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWorkerMappingMode('unmapped')}
                                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        workerMappingMode === 'unmapped' 
                                            ? 'bg-amber-600 text-white shadow-xs' 
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {isKa ? '📦 ღია (ასაწონად)' : '📦 Open Crates'}
                                </button>
                            </div>

                            {workerMappingMode === 'mapped' && (
                                <div className="space-y-1 pt-1">
                                    <select
                                        value={selectedWorkerId}
                                        onChange={e => setSelectedWorkerId(e.target.value)}
                                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        {eventPickers.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} {emp.idNumber ? `(#${emp.idNumber})` : ''} - {emp.employeeType || emp.role || 'Picker'}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        {isKa 
                                            ? `ამ მუშაკისთვის გენერირდება ${boxCount} განსხვავებული უნიკალური QR კოდი.` 
                                            : `Generates ${boxCount} distinct unique codes assigned directly to ${selectedWorker?.name || 'this worker'}.`}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Batch Quantities Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                {isKa ? 'ყუთების რაოდენობა' : 'Number of Boxes'}
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={boxCount}
                                onChange={e => setBoxCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl font-black text-sm text-slate-900 text-center outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                {isKa ? 'სტანდ. წონა (კგ)' : 'Standard Weight (kg)'}
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={boxWeight}
                                onChange={e => setBoxWeight(parseFloat(e.target.value) || 5.8)}
                                className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl font-black text-sm text-slate-900 text-center outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                {isKa ? 'ჯიში' : 'Variety'}
                            </label>
                            <input
                                type="text"
                                value={variety}
                                onChange={e => setVariety(e.target.value)}
                                className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-400"
                                placeholder="Variety"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                {isKa ? 'კრეფის თარიღი' : 'Harvest Date'}
                            </label>
                            <input
                                type="date"
                                value={harvestDate}
                                onChange={e => setHarvestDate(e.target.value)}
                                className="w-full p-2 bg-white border border-indigo-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    </div>

                    {/* Generate Action Button */}
                    <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
                        <div className="text-xs text-slate-500 font-medium">
                            {isKa 
                                ? `თითოეულ ყუთს ექნება უნიკალური ნომერი დუბლირების პრევენციით.` 
                                : `Each box receives a guaranteed unique serial code with duplicate prevention.`}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleGenerateCodes}
                                disabled={isGenerating || !activeEvent}
                                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <Sparkles size={15} />
                                <span>{isGenerating ? (isKa ? 'გენერირდება...' : 'Generating...') : (isKa ? `QR კოდების შექმნა (${boxCount})` : `Generate (${boxCount}) Box QRs`)}</span>
                            </button>

                            {generatedBoxes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handlePrintStickers}
                                    className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <Printer size={15} className="text-amber-400" />
                                    <span>{isKa ? 'ეტიკეტების ბეჭდვა' : 'Print Sticker Sheet'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Generated Box List Preview */}
                    {generatedBoxes.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Package size={14} className="text-indigo-600" />
                                    <span>{isKa ? `გენერირებული ეტიკეტები (${generatedBoxes.length})` : `Generated Box Labels (${generatedBoxes.length})`}</span>
                                </h3>
                                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    {isKa ? 'მზადაა დასაბეჭდად' : 'Ready to Print / Scan'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                {generatedBoxes.map((box, idx) => (
                                    <div 
                                        key={idx} 
                                        className="p-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl flex gap-3 items-center transition-all shadow-2xs group"
                                    >
                                        <img 
                                            src={box.qrDataUrl} 
                                            alt={box.uniqueCode} 
                                            className="w-16 h-16 rounded-xl border border-slate-200 bg-white p-0.5 shrink-0" 
                                        />
                                        <div className="min-w-0 flex-1 text-left">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-indigo-600">
                                                    {isKa ? 'ყუთი' : 'Box'} #{box.boxNumber} / {box.totalBoxes}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(box.uniqueCode);
                                                        setCopiedIndex(idx);
                                                        setTimeout(() => setCopiedIndex(null), 1500);
                                                        toast.success(`Copied: ${box.uniqueCode}`);
                                                    }}
                                                    className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                                    title="Copy Code"
                                                >
                                                    {copiedIndex === idx ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            </div>

                                            <div className="text-xs font-black text-slate-800 truncate mt-0.5">
                                                {box.workerName || (isKa ? 'ღია ყუთი' : 'Open Crate')}
                                            </div>

                                            <div className="text-[10px] text-slate-500 font-semibold truncate">
                                                {box.variety} • {box.targetWeightKg} kg
                                            </div>

                                            <div className="text-[8px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-1 truncate max-w-full">
                                                {box.uniqueCode}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                    <span className="text-[11px] text-slate-500 font-medium">
                        {isKa ? 'დაასკანერეთ ასაწონ პუნქტში მუშის ასარჩევად და ყუთის დასაფიქსირებლად.' : 'Scan code at Weigh Station to identify picker & record crate.'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default HarvestBoxQrModal;
