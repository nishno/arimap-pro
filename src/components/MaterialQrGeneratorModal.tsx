import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { 
    XCircleIcon 
} from './Icons';
import { 
    QrCode, Printer, Layers, Package, Sparkles, Plus, 
    Trash2, Copy, CheckCircle2, Download, AlertCircle, 
    ArrowRight, Tag, Scale, Calendar, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import type { InventoryItem } from '../types';

export interface MaterialQrGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems?: InventoryItem[];
    selectedItemId?: string;
    defaultCategory?: 'supplies' | 'goods' | 'assets' | 'document';
    defaultMaterialName?: string;
    onBatchGenerated?: (batches: GeneratedQrBatchItem[]) => void;
}

export interface GeneratedQrBatchItem {
    id: string;
    batchNumber: string;
    materialId: string;
    materialName: string;
    sku: string;
    category: 'assets' | 'supplies' | 'goods' | 'document';
    quantity: number;
    unit: string;
    date: string;
    qrDataString: string;
    qrDataUrl?: string;
}

export const MaterialQrGeneratorModal: React.FC<MaterialQrGeneratorModalProps> = ({
    isOpen,
    onClose,
    inventoryItems = [],
    selectedItemId: initialSelectedItemId,
    defaultCategory = 'supplies',
    defaultMaterialName = '',
    onBatchGenerated
}) => {
    const { t } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    // Form states
    const [selectedItemId, setSelectedItemId] = useState<string>(initialSelectedItemId || '');
    const [customMaterialName, setCustomMaterialName] = useState<string>(defaultMaterialName);
    const [sku, setSku] = useState<string>('');
    const [category, setCategory] = useState<'assets' | 'supplies' | 'goods' | 'document'>(defaultCategory);
    const [unit, setUnit] = useState<string>('kg');
    const [notes, setNotes] = useState<string>('');

    // Quantity & Split Mode
    // mode: 'split_total' (e.g. 100kg total into 20kg batches = 5 codes) vs 'fixed_count' (5 labels of 20kg each)
    const [splitMode, setSplitMode] = useState<'split_total' | 'fixed_count'>('split_total');
    const [totalQuantity, setTotalQuantity] = useState<number>(100);
    const [batchSize, setBatchSize] = useState<number>(20);
    const [codeCount, setCodeCount] = useState<number>(5);

    // Generated QR cards state
    const [generatedList, setGeneratedList] = useState<GeneratedQrBatchItem[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if (initialSelectedItemId) {
            setSelectedItemId(initialSelectedItemId);
        }
    }, [initialSelectedItemId]);

    // Auto-fill when inventory item selected
    useEffect(() => {
        if (selectedItemId) {
            const item = inventoryItems.find(i => i.id === selectedItemId);
            if (item) {
                setCustomMaterialName(item.name);
                setSku((item as any).sku || (item as any).barcode || item.id);
                setUnit((item as any).unit || 'kg');
                
                const rawCat = ((item as any).category || '').toLowerCase();
                if (rawCat.includes('asset') || rawCat.includes('tool') || rawCat.includes('machin')) {
                    setCategory('assets');
                } else if (rawCat.includes('good') || rawCat.includes('harvest') || rawCat.includes('product')) {
                    setCategory('goods');
                } else if (rawCat.includes('doc')) {
                    setCategory('document');
                } else {
                    setCategory('supplies');
                }
            }
        }
    }, [selectedItemId, inventoryItems]);

    // Calculate batches summary
    const calculatedBatches = useMemo(() => {
        const batches: Array<{ qty: number; batchIndex: number }> = [];
        if (splitMode === 'split_total') {
            const total = Math.max(0.01, Number(totalQuantity) || 0);
            const size = Math.max(0.01, Number(batchSize) || 1);
            let remaining = total;
            let index = 1;
            while (remaining > 0) {
                const cur = Math.min(remaining, size);
                batches.push({ qty: Number(cur.toFixed(2)), batchIndex: index });
                remaining = Number((remaining - cur).toFixed(4));
                index++;
                if (index > 200) break; // safety limit
            }
        } else {
            const count = Math.min(100, Math.max(1, Math.floor(Number(codeCount) || 1)));
            const size = Math.max(0.01, Number(batchSize) || 1);
            for (let i = 1; i <= count; i++) {
                batches.push({ qty: size, batchIndex: i });
            }
        }
        return batches;
    }, [splitMode, totalQuantity, batchSize, codeCount]);

    // Generate QR codes
    const handleGenerate = async () => {
        const materialName = customMaterialName.trim() || 'Agro Material';
        if (!materialName) {
            toast.error(isKa ? "მიუთითეთ მასალის დასახელება" : "Please specify material name");
            return;
        }

        setIsGenerating(true);
        const dateStr = new Date().toISOString().split('T')[0];
        const timeKey = Date.now().toString().slice(-6);
        const prefix = category.substring(0, 3).toUpperCase();
        
        try {
            const results: GeneratedQrBatchItem[] = [];

            for (let i = 0; i < calculatedBatches.length; i++) {
                const b = calculatedBatches[i];
                const batchId = `${prefix}-${timeKey}-${String(i + 1).padStart(2, '0')}`;
                const qrId = `AGRI-${batchId}`;

                // Standard structured JSON payload
                const payload = {
                    type: 'material',
                    id: selectedItemId || qrId,
                    sku: sku.trim() || qrId,
                    name: materialName,
                    category,
                    batchId,
                    quantity: b.qty,
                    unit,
                    date: dateStr,
                    notes: notes.trim() || undefined
                };

                const qrDataString = JSON.stringify(payload);
                const qrDataUrl = await QRCode.toDataURL(qrDataString, {
                    width: 320,
                    margin: 1,
                    color: {
                        dark: '#0f172a',
                        light: '#ffffff'
                    }
                });

                results.push({
                    id: qrId,
                    batchNumber: batchId,
                    materialId: selectedItemId || qrId,
                    materialName,
                    sku: sku.trim() || qrId,
                    category,
                    quantity: b.qty,
                    unit,
                    date: dateStr,
                    qrDataString,
                    qrDataUrl
                });
            }

            setGeneratedList(results);
            if (onBatchGenerated) {
                onBatchGenerated(results);
            }
            toast.success(
                isKa 
                    ? `✓ შეიქმნა ${results.length} QR კოდი (${materialName})` 
                    : `✓ Generated ${results.length} QR codes for ${materialName}`
            );
        } catch (err: any) {
            console.error("QR Generation error:", err);
            toast.error(err.message || "Failed to generate QR codes");
        } finally {
            setIsGenerating(false);
        }
    };

    // Print all QR codes in thermal label / sticker layout
    const handlePrint = () => {
        if (generatedList.length === 0) return;

        const printWindow = window.open('', '_blank', 'width=900,height=750');
        if (!printWindow) {
            alert("Please allow popups to print QR labels.");
            return;
        }

        const labelsHtml = generatedList.map(item => `
            <div class="label-card">
                <div class="label-header">
                    <span class="label-brand">AGRIMAP PRO</span>
                    <span class="label-cat ${item.category}">${item.category.toUpperCase()}</span>
                </div>
                <div class="label-body">
                    <img src="${item.qrDataUrl}" class="qr-img" alt="QR" />
                    <div class="label-info">
                        <div class="material-name">${item.materialName}</div>
                        <div class="material-qty">${item.quantity} ${item.unit}</div>
                        <div class="batch-no">Batch: ${item.batchNumber}</div>
                        ${item.sku ? `<div class="sku-no">SKU: ${item.sku}</div>` : ''}
                        <div class="date-str">Date: ${item.date}</div>
                    </div>
                </div>
                <div class="label-footer">
                    Scan with Agrimap to Auto-Charge or Receive
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print QR Labels - ${customMaterialName}</title>
                <style>
                    @page {
                        size: auto;
                        margin: 8mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    }
                    body {
                        background: #fff;
                        color: #0f172a;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 12px;
                        padding: 8px;
                    }
                    .label-card {
                        width: 3.3in;
                        height: 2.1in;
                        border: 1.5px dashed #cbd5e1;
                        border-radius: 8px;
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-inside: avoid;
                        background: #fff;
                    }
                    .label-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid #f1f5f9;
                        padding-bottom: 4px;
                    }
                    .label-brand {
                        font-size: 8px;
                        font-weight: 900;
                        letter-spacing: 1px;
                        color: #059669;
                    }
                    .label-cat {
                        font-size: 7px;
                        font-weight: 800;
                        padding: 2px 6px;
                        border-radius: 4px;
                        letter-spacing: 0.5px;
                    }
                    .label-cat.supplies { background: #fef3c7; color: #b45309; }
                    .label-cat.goods { background: #dcfce7; color: #15803d; }
                    .label-cat.assets { background: #e0e7ff; color: #4338ca; }
                    .label-cat.document { background: #f3e8ff; color: #7e22ce; }
                    .label-body {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin-top: 4px;
                    }
                    .qr-img {
                        width: 90px;
                        height: 90px;
                        flex-shrink: 0;
                    }
                    .label-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }
                    .material-name {
                        font-size: 13px;
                        font-weight: 900;
                        line-height: 1.2;
                        color: #0f172a;
                    }
                    .material-qty {
                        font-size: 16px;
                        font-weight: 900;
                        color: #2563eb;
                        margin-top: 2px;
                    }
                    .batch-no, .sku-no, .date-str {
                        font-size: 8px;
                        font-weight: 600;
                        color: #64748b;
                        font-family: monospace;
                    }
                    .label-footer {
                        border-top: 1px solid #f1f5f9;
                        padding-top: 4px;
                        font-size: 7px;
                        font-weight: 700;
                        text-align: center;
                        color: #94a3b8;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                </style>
            </head>
            <body>
                ${labelsHtml}
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 250);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div 
                className="bg-white border border-slate-200 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* Modal Header */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/40">
                            <QrCode size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black uppercase tracking-tight">
                                    {isKa ? "აგრო-ინპუტების & მასალების QR გენერატორი" : "Agro-Input & Material QR Generator"}
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Batch Split
                                </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                                {isKa 
                                    ? "შექმენით QR კოდები სასუქებზე, ქიმიკატებზე, მოსავალზე ან ტარაზე ზუსტი რაოდენობითა და კატეგორიით" 
                                    : "Generate QR codes for fertilizers, agrochemicals, produce, or assets with precise batch splitting"}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all cursor-pointer"
                    >
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Main Content Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Top Row: Material Selection & Category */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Select from Inventory */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                                {isKa ? "საწყობის მასალა (სურვილისამებრ)" : "Stock Item (Optional)"}
                            </label>
                            <select
                                value={selectedItemId}
                                onChange={(e) => setSelectedItemId(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                            >
                                <option value="">{isKa ? "-- აირჩიეთ საწყობიდან ან ჩაწერეთ ქვემოთ --" : "-- Select from inventory or type below --"}</option>
                                {inventoryItems.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} ({item.currentStock || 0} {(item as any).unit || 'kg'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Material Name */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center justify-between">
                                <span>{isKa ? "მასალის დასახელება" : "Material / Agro-input Name"}</span>
                                <span className="text-rose-500 font-bold">*</span>
                            </label>
                            <input
                                type="text"
                                value={customMaterialName}
                                onChange={(e) => setCustomMaterialName(e.target.value)}
                                placeholder={isKa ? "მაგ: კალიუმის ნიტრატი 100კგ, NPK 15-15-15" : "e.g. Potassium Nitrate 100kg, NPK 15-15-15"}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                            />
                        </div>

                        {/* Category Selector */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                                {isKa ? "სკანირების & საწყობის კატეგორია" : "Storage & Scan Category"}
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setCategory('supplies')}
                                    className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        category === 'supplies'
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Package size={11} />
                                    <span>Supplies</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCategory('goods')}
                                    className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        category === 'goods'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Sparkles size={11} />
                                    <span>Goods</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCategory('assets')}
                                    className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        category === 'assets'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Layers size={11} />
                                    <span>Assets</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCategory('document')}
                                    className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        category === 'document'
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <FileText size={11} />
                                    <span>Document</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Middle Row: Batch Split & Quantity Mode */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Scale size={14} className="text-emerald-600" />
                                    <span>{isKa ? "რაოდენობისა & პარტიის დაყოფის კონფიგურაცია" : "Batch Split & Quantity Configuration"}</span>
                                </h3>
                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                                    {isKa 
                                        ? "მაგალითი: გაქვთ 100 კგ კალიუმი, დაყავით 20 კგ-იან ერთეულებად -> ავტომატურად შეიქმნება 5 QR კოდი" 
                                        : "Example: 100kg Potassium split into 20kg units -> automatically generates 5 unique QR codes"}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSplitMode('split_total')}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        splitMode === 'split_total'
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {isKa ? "მთლიანი წონის დაყოფა" : "Split Total Weight"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSplitMode('fixed_count')}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        splitMode === 'fixed_count'
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {isKa ? "ფიქსირებული რაოდენობა" : "Fixed Label Count"}
                                </button>
                            </div>
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            {splitMode === 'split_total' ? (
                                <>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                            {isKa ? "მთლიანი რაოდენობა" : "Total Quantity"}
                                        </label>
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="any"
                                            value={totalQuantity}
                                            onChange={(e) => setTotalQuantity(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                            {isKa ? "1 QR-ის წონა / მოცულობა" : "Quantity Per QR"}
                                        </label>
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="any"
                                            value={batchSize}
                                            onChange={(e) => setBatchSize(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                            {isKa ? "QR კოდების რაოდენობა" : "Number of QR Codes"}
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={codeCount}
                                            onChange={(e) => setCodeCount(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                            {isKa ? "რაოდენობა თითო QR-ზე" : "Quantity Per QR"}
                                        </label>
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="any"
                                            value={batchSize}
                                            onChange={(e) => setBatchSize(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                    {isKa ? "ერთეული" : "Unit"}
                                </label>
                                <select
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                >
                                    <option value="kg">kg (კილოგრამი)</option>
                                    <option value="g">g (გრამი)</option>
                                    <option value="L">L (ლიტრი)</option>
                                    <option value="mL">mL (მილილიტრი)</option>
                                    <option value="pcs">pcs (ცალი)</option>
                                    <option value="bag">bag (ტომარა)</option>
                                    <option value="box">box (ყუთი)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                    {isKa ? "SKU / კოდი" : "SKU / Code"}
                                </label>
                                <input
                                    type="text"
                                    value={sku}
                                    onChange={(e) => setSku(e.target.value)}
                                    placeholder="e.g. POT-100"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                />
                            </div>
                        </div>

                        {/* Summary badge */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-slate-700 uppercase">
                                    {isKa ? "შედეგი:" : "Calculation Result:"}
                                </span>
                                <span className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-black">
                                    {calculatedBatches.length} {isKa ? "QR კოდი" : "QR Codes"} • {calculatedBatches.reduce((a, b) => a + b.qty, 0).toFixed(1)} {unit} {isKa ? "სულ" : "Total"}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                <Sparkles size={14} />
                                <span>{isGenerating ? (isKa ? "გენერირდება..." : "Generating...") : (isKa ? "QR კოდების შექმნა" : "Generate QR Codes")}</span>
                            </button>
                        </div>
                    </div>

                    {/* Generated QR Codes List & Print Section */}
                    {generatedList.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <span>{isKa ? "გენერირებული QR კოდები & ეტიკეტები" : "Generated QR Codes & Labels"}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                                            {generatedList.length}
                                        </span>
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-500">
                                        {isKa 
                                            ? "თითოეული QR კოდი შეიცავს მასალის, კატეგორიის და ზუსტი წონის სტრუქტურირებულ მონაცემებს" 
                                            : "Each QR code contains structured data for automated scanning and stock deduction"}
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handlePrint}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <Printer size={14} />
                                        <span>{isKa ? "ყველას დაბეჭდვა" : "Print All Labels"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Grid of Preview Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-1">
                                {generatedList.map((item, idx) => (
                                    <div 
                                        key={item.id}
                                        className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative group"
                                    >
                                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                                                AGRIMAP #{idx + 1}
                                            </span>
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                item.category === 'supplies' ? 'bg-amber-100 text-amber-700' :
                                                item.category === 'goods' ? 'bg-emerald-100 text-emerald-700' :
                                                item.category === 'assets' ? 'bg-indigo-100 text-indigo-700' :
                                                'bg-purple-100 text-purple-700'
                                            }`}>
                                                {item.category}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {item.qrDataUrl && (
                                                <img 
                                                    src={item.qrDataUrl} 
                                                    alt="QR Code" 
                                                    className="w-20 h-20 rounded-lg border border-slate-100 shadow-2xs shrink-0" 
                                                />
                                            )}
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <div className="text-xs font-black text-slate-800 truncate" title={item.materialName}>
                                                    {item.materialName}
                                                </div>
                                                <div className="text-base font-black text-blue-600">
                                                    {item.quantity} {item.unit}
                                                </div>
                                                <div className="text-[9px] font-mono text-slate-500 font-bold truncate">
                                                    Batch: {item.batchNumber}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px]">
                                            <span className="text-slate-400 font-mono">{item.date}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(item.qrDataString);
                                                    setCopiedId(item.id);
                                                    setTimeout(() => setCopiedId(null), 1500);
                                                    toast.success("Payload copied to clipboard");
                                                }}
                                                className="text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1 cursor-pointer"
                                            >
                                                <Copy size={11} />
                                                <span>{copiedId === item.id ? "Copied!" : "Copy JSON"}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-500">
                        {isKa 
                            ? "დაბეჭდილი ეტიკეტების დასკანერება შესაძლებელია ნებისმიერი მოდულიდან: საწყობი, აგრონომია, სამუშაოები" 
                            : "Printed labels can be scanned from Stock, Agronomy, Weigh Station or Tasks to auto-charge or receive"}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                        {isKa ? "დახურვა" : "Close"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialQrGeneratorModal;
