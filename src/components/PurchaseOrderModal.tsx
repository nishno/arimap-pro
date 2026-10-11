import React, { useState, useRef, useEffect } from 'react';
import type { PurchaseOrder, Supplier, InventoryItem, PurchaseOrderItem, PurchaseDocumentAnalysis, PurchaseDocumentType } from '../types';
import { PURCHASE_DOCUMENT_TYPES } from '../types';
import { XCircleIcon, PlusIcon, TrashIcon, SparklesIcon, ArrowUpTrayIcon, DocumentTextIcon, ChevronRightIcon } from './Icons';
import { ScanLine, Barcode } from 'lucide-react';
import { analyzePurchaseDocument } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import QrScannerModal from './QrScannerModal';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { toast } from 'sonner';

interface PurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (order: PurchaseOrder) => void;
    suppliers: Supplier[];
    inventoryItems: InventoryItem[];
    order: PurchaseOrder | null;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const fileToBase64 = (dataUrl: string): string => {
    return dataUrl.split(',')[1];
};

const safeDateValue = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
        return d.toISOString().split('T')[0];
    } catch {
        return new Date().toISOString().split('T')[0];
    }
};

const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({ isOpen, onClose, onSave, suppliers: suppliersProp = [], inventoryItems: inventoryItemsProp = [], order }) => {
    const suppliers = suppliersProp || [];
    // Strictly filter out Produce / Harvest events so Purchase Orders only list purchasable stock items or new items
    const inventoryItems = (inventoryItemsProp || []).filter(i => i.category !== 'Produce' && !i.isPrivate);
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';

    const [formState, setFormState] = useState<Omit<PurchaseOrder, 'id'>>({
        supplierId: '',
        date: new Date().toISOString().split('T')[0],
        items: [{ inventoryItemId: '', quantity: 1, unitCost: 0, vat: 0, addToStock: true }],
        totalCost: 0,
        status: 'Draft',
        notes: '',
        documentUrl: '',
        documentAnalysis: null,
        documentType: 'Invoice from Company',
        supplierName: '',
    });

    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [documentDataUrl, setDocumentDataUrl] = useState<string | null>(null);
    const [shouldTranslate, setShouldTranslate] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanningItemIndex, setScanningItemIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (order) {
            setFormState({ ...order, items: order.items || [] });
            if (order.documentUrl) {
                setDocumentDataUrl(order.documentUrl);
            }
        }
    }, [order]);

    const resetAnalysisState = () => {
        setUploadedFile(null);
        setDocumentDataUrl(null);
        setAnalysisError(null);
        setIsAnalyzing(false);
        setFormState(p => ({ ...p, documentUrl: '', documentAnalysis: null }));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        resetAnalysisState();
        setUploadedFile(file);
        const dataUrl = await fileToDataUrl(file);
        setDocumentDataUrl(dataUrl);
    };

    const handleAnalyze = async () => {
        if (!documentDataUrl) return;

        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const base64Data = fileToBase64(documentDataUrl);
            const analysis = await analyzePurchaseDocument(base64Data, uploadedFile!.type, shouldTranslate);
            
            setFormState(prev => {
                const existingSupplier = suppliers.find(s => analysis.supplierName && s.name.toLowerCase().includes(analysis.supplierName.toLowerCase()));
                
                const newItems: PurchaseOrderItem[] = (analysis.lineItems || []).map(item => {
                    const existingItem = inventoryItems.find(inv => item.description && inv.name.toLowerCase().includes(item.description.toLowerCase()));
                    return {
                        inventoryItemId: existingItem?.id || 'new-item',
                        itemName: existingItem ? undefined : item.description,
                        description: existingItem ? existingItem.description : '',
                        quantity: item.quantity || 1,
                        unitCost: item.unitPrice || 0,
                        vat: item.vat || 0,
                        addToStock: true,
                    };
                });

                return {
                    ...prev,
                    documentAnalysis: analysis,
                    documentUrl: documentDataUrl,
                    supplierId: existingSupplier?.id || 'new-supplier',
                    supplierName: existingSupplier ? undefined : analysis.supplierName,
                    date: analysis.date || prev.date,
                    items: newItems.length > 0 ? newItems : prev.items,
                    status: 'Received',
                };
            });
            
            setUploadedFile(null);
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : (isKa ? 'ანალიზი ვერ შესრულდა.' : 'Analysis failed.'));
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const handleAttachOnly = () => {
        setFormState(prev => ({ ...prev, documentUrl: documentDataUrl || '' }));
        setUploadedFile(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: string | number | boolean) => {
        const newItems = [...formState.items];
        (newItems[index] as any)[field] = value;
        setFormState(prev => ({ ...prev, items: newItems }));
    };
    
    const handleItemNameChange = (index: number, name: string) => {
        const newItems = [...formState.items];
        const item = { ...newItems[index] };

        const existingItem = inventoryItems.find(i => i.name.toLowerCase() === name.toLowerCase());

        if (existingItem) {
            item.inventoryItemId = existingItem.id;
            item.itemName = undefined;
            item.unitCost = existingItem.unitCost;
            item.description = existingItem.description || '';
        } else {
            item.inventoryItemId = 'new-item';
            item.itemName = name;
            item.description = ''; // Clear description for new item
        }

        newItems[index] = item;
        setFormState(prev => ({ ...prev, items: newItems }));
    };

    const handleSupplierChange = (value: string) => {
        const selectedSupplier = suppliers.find(s => s.name === value);
        if (selectedSupplier) {
            setFormState(p => ({ ...p, supplierId: selectedSupplier.id, supplierName: undefined }));
        } else {
            setFormState(p => ({ ...p, supplierId: 'new-supplier', supplierName: value }));
        }
    };

    const addItem = () => {
        setFormState(prev => ({ ...prev, items: [...prev.items, { inventoryItemId: '', quantity: 1, unitCost: 0, vat: 0, addToStock: true }] }));
    };

    const removeItem = (index: number) => {
        setFormState(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    };

    useEffect(() => {
        const total = formState.items.reduce((sum, item) => {
            const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
            const vatAmount = itemTotal * ((Number(item.vat) || 0) / 100);
            return sum + itemTotal + vatAmount;
        }, 0);
        setFormState(prev => ({ ...prev, totalCost: total }));
    }, [formState.items]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: order?.id || `po-${Date.now()}`, ...formState });
        onClose();
    };

    if (!isOpen) return null;
    
    const currentSupplierName = formState.supplierName || suppliers.find(s => s.id === formState.supplierId)?.name || '';

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4 backdrop-blur-xs" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-black tracking-tight">
                            {order ? (isKa ? 'შესყიდვის შეკვეთის რედაქტირება' : 'Edit Purchase Order') : (isKa ? 'ახალი შესყიდვის შეკვეთა' : 'New Purchase Order')}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {isKa ? 'ინვოისის, ზედნადების ან შესყიდვის დოკუმენტის რეგისტრაცია' : 'Register invoice, supplier bill or purchase voucher'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 max-h-[72vh] overflow-y-auto">
                        <div className="md:col-span-2 space-y-4 border-r border-slate-200 pr-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
                                <SparklesIcon className="h-4 w-4 text-emerald-600"/> {isKa ? 'AI ინვოისისა და ჩეკის სკანერი' : 'AI Invoice & Receipt Scanner'}
                            </h3>
                            <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                            
                            {documentDataUrl && !uploadedFile ? (
                                <div className="space-y-2">
                                    <h4 className="font-bold text-xs text-slate-700">{isKa ? 'მიბმული დოკუმენტი:' : 'Attached Document:'}</h4>
                                    <img src={documentDataUrl} alt="Document preview" className="w-full rounded-xl border border-slate-200 shadow-sm max-h-48 object-contain bg-slate-50" />
                                    <button type="button" onClick={resetAnalysisState} className="text-xs text-red-500 font-bold hover:underline w-full mt-2 cursor-pointer">
                                        {isKa ? 'დოკუმენტის წაშლა' : 'Remove Document'}
                                    </button>
                                </div>
                            ) : !documentDataUrl ? (
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full p-5 border-2 border-dashed border-slate-300 rounded-2xl text-center hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer">
                                    <ArrowUpTrayIcon className="h-7 w-7 mx-auto text-slate-400" />
                                    <span className="mt-2 block font-black text-xs text-emerald-700">{isKa ? 'ატვირთეთ ინვოისი ან ქვითარი' : 'Upload Invoice or Receipt'}</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">PNG, JPG, PDF</span>
                                </button>
                            ) : null}

                            {documentDataUrl && uploadedFile && (
                                <div className="space-y-3">
                                    <img src={documentDataUrl} alt="Uploaded document preview" className="w-full rounded-xl border border-slate-200 shadow-sm max-h-48 object-contain bg-slate-50" />
                                    <div className="p-3 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={handleAnalyze} disabled={isAnalyzing} className="button-primary text-xs flex-1 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                                                <SparklesIcon className="h-3.5 w-3.5"/> {isAnalyzing ? (isKa ? 'მუშავდება...' : 'Analyzing...') : (isKa ? 'დოკუმენტის ანალიზი' : 'Analyze Document')}
                                            </button>
                                            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer">
                                                <input type="checkbox" checked={shouldTranslate} onChange={(e) => setShouldTranslate(e.target.checked)} className="rounded" />
                                                {isKa ? 'თარგმნა' : 'Translate'}
                                            </label>
                                        </div>
                                         <button type="button" onClick={handleAttachOnly} disabled={isAnalyzing} className="button-secondary text-xs w-full cursor-pointer">
                                            {isKa ? 'მხოლოდ დოკუმენტის მიბმა' : 'Attach Document Only'}
                                         </button>
                                         <button type="button" onClick={resetAnalysisState} className="text-[11px] text-red-500 font-bold hover:underline w-full text-center cursor-pointer">
                                            {isKa ? 'დოკუმენტის წაშლა' : 'Remove Document'}
                                         </button>
                                         {analysisError && <p className="text-[11px] text-red-600 font-bold text-center">{analysisError}</p>}
                                    </div>
                                </div>
                            )}

                            {formState.documentAnalysis && (
                                <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                                    <h4 className="font-black text-xs text-emerald-950 flex items-center gap-1">
                                        <SparklesIcon className="w-3.5 h-3.5 text-emerald-600" />
                                        {isKa ? 'ანალიზის შედეგი' : 'Analysis Results'}
                                    </h4>
                                    <p className="text-slate-700"><strong>{isKa ? 'მომწოდებელი:' : 'Supplier:'}</strong> {formState.documentAnalysis.supplierName || 'N/A'}</p>
                                    <p className="text-slate-700"><strong>{isKa ? 'თარიღი:' : 'Date:'}</strong> {formState.documentAnalysis.date || 'N/A'}</p>
                                    <p className="text-slate-700"><strong>{isKa ? 'ჯამი:' : 'Total:'}</strong> {formState.documentAnalysis.totalAmount || 'N/A'}</p>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-3 space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">{isKa ? 'დოკუმენტის ტიპი' : 'Document Type'}</label>
                                    <select name="documentType" value={formState.documentType} onChange={handleChange} className="input-field cursor-pointer">
                                        {(PURCHASE_DOCUMENT_TYPES || []).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">{isKa ? 'მომწოდებელი' : 'Supplier'} <span className="text-rose-500">*</span></label>
                                    <input list="suppliers-list" name="supplierName" value={currentSupplierName} onChange={(e) => handleSupplierChange(e.target.value)} className="input-field" placeholder={isKa ? "ჩაწერეთ ან აირჩიეთ მომწოდებელი" : "Type or select supplier"} required />
                                    <datalist id="suppliers-list">{(suppliers || []).map(s => <option key={s.id} value={s.name} />)}</datalist>
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">{isKa ? 'თარიღი' : 'Date'} <span className="text-rose-500">*</span></label>
                                    <input name="date" type="date" value={safeDateValue(formState.date)} onChange={handleChange} className="input-field" required />
                                </div>
                            </div>
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">{isKa ? 'სტატუსი' : 'Status'}</label>
                                <select name="status" value={formState.status} onChange={handleChange} className="input-field font-bold cursor-pointer">
                                    <option value="Draft">{isKa ? 'მონახაზი' : 'Draft'}</option>
                                    <option value="Pre-order">{isKa ? 'წინასწარი შეკვეთა' : 'Pre-order'}</option>
                                    <option value="Ordered">{isKa ? 'შეკვეთილი' : 'Ordered'}</option>
                                    <option value="Received">{isKa ? 'მიღებული (საწყობში ასახვა)' : 'Received (Adds to Stock)'}</option>
                                </select>
                            </div>

                            <div className="border-t border-slate-200 pt-3">
                                <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                    <div>
                                        <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs">
                                            {isKa ? 'შესყიდული ნივთები' : 'Purchased Line Items'}
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {isKa ? 'მონიშნული ნივთები პირდაპირ აისახება საწყობის ნაშთზე' : 'Checked items add directly to warehouse balance'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setScanningItemIndex(null);
                                            setIsScannerOpen(true);
                                        }}
                                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                                        title={isKa ? "მიღებული საქონლის ან მასალის შტრიხკოდის/QR-ის სკანირება" : "Scan item barcode or QR code on receipt"}
                                    >
                                        <ScanLine size={13} className="text-emerald-400" />
                                        <span>{isKa ? 'შტრიხკოდის / QR სკანირება' : 'Scan Item Barcode / QR'}</span>
                                    </button>
                                </div>
                                
                                <div className="space-y-2.5">
                                    {(formState.items || []).map((item, index) => (
                                        <div key={index} className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <div className="flex-grow min-w-[140px]">
                                                <label className="text-[10px] font-bold text-slate-600 block mb-1">{isKa ? 'ნივთი' : 'Item'} <span className="text-rose-500">*</span></label>
                                                <input
                                                    list="items-list"
                                                    value={item.itemName ?? inventoryItems.find(i => i.id === item.inventoryItemId)?.name ?? ''}
                                                    onChange={e => handleItemNameChange(index, e.target.value)}
                                                    className="input-field"
                                                    placeholder={isKa ? "ნივთის დასახელება" : "Item name"}
                                                    required
                                                />
                                            </div>
                                            <div className="w-28">
                                                <label className="text-[10px] font-bold text-slate-600 block mb-1">{isKa ? 'შტრიხკოდი / QR' : 'Barcode / QR'}</label>
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        value={item.barcode || ''} 
                                                        onChange={e => handleItemChange(index, 'barcode', e.target.value)} 
                                                        className="input-field pr-6 font-mono text-[10px]" 
                                                        placeholder="Code" 
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setScanningItemIndex(index);
                                                            setIsScannerOpen(true);
                                                        }}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 cursor-pointer p-0.5"
                                                        title="Scan Barcode"
                                                    >
                                                        <ScanLine size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-grow min-w-[110px]">
                                                <label className="text-[10px] font-bold text-slate-600 block mb-1">{isKa ? 'აღწერა' : 'Description'}</label>
                                                <input type="text" value={item.description || ''} onChange={e => handleItemChange(index, 'description', e.target.value)} className="input-field" placeholder={isKa ? "დამატებითი შენიშვნა" : "Optional notes"} />
                                            </div>
                                            <div className="w-20">
                                                <label className="text-[10px] font-bold text-slate-600 block mb-1">{isKa ? 'რაოდენობა' : 'Qty'}</label>
                                                <input type="number" step="any" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="input-field font-bold" />
                                            </div>
                                            <div className="w-24">
                                                <label className="text-[10px] font-bold text-slate-600 block mb-1">{isKa ? 'ფასი' : 'Cost'}</label>
                                                <input type="number" step="0.01" value={item.unitCost} onChange={e => handleItemChange(index, 'unitCost', parseFloat(e.target.value))} className="input-field font-bold text-emerald-700" />
                                            </div>
                                            <div className="w-16">
                                                <label className="text-[10px] font-bold text-slate-600 block mb-1">{isKa ? 'დღგ %' : 'VAT %'}</label>
                                                <input type="number" value={item.vat || ''} onChange={e => handleItemChange(index, 'vat', parseFloat(e.target.value))} className="input-field font-bold" placeholder="0" />
                                            </div>
                                            <div className="flex flex-col items-center justify-end h-full pt-1 px-1">
                                                <label className="text-[9px] font-black text-slate-500 uppercase">{isKa ? 'საწყობში' : 'To Stock'}</label>
                                                <input type="checkbox" checked={item.addToStock} onChange={e => handleItemChange(index, 'addToStock', e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                                            </div>
                                            <div className="flex items-center h-full">
                                                <button type="button" onClick={() => removeItem(index)} className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer">
                                                    <TrashIcon className="h-4 w-4"/>
                                                </button>
                                            </div>
                                            <datalist id="items-list">
                                                {(inventoryItems || []).map(i => <option key={i.id} value={i.name} />)}
                                            </datalist>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addItem} className="text-indigo-600 font-bold text-xs mt-2 hover:underline flex items-center gap-1 cursor-pointer">
                                    <PlusIcon className="w-3.5 h-3.5" /> {isKa ? '+ ნივთის დამატება' : 'Add Another Item'}
                                </button>
                            </div>
                            
                            <div className="p-3 bg-slate-900 text-white rounded-xl flex justify-between items-center mt-3">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{isKa ? 'ჯამური ღირებულება:' : 'Total Purchase Value:'}</span>
                                <span className="text-lg font-black text-emerald-400">{formatCurrency(formState.totalCost)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="button-secondary cursor-pointer">
                            {isKa ? 'გაუქმება' : 'Cancel'}
                        </button>
                        <button type="submit" className="button-primary cursor-pointer">
                            {isKa ? 'შესყიდვის შენახვა' : 'Save Purchase Order'}
                        </button>
                    </div>
                </form>
            </div>
            </div>

            {isScannerOpen && (
                <QrScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => {
                        setIsScannerOpen(false);
                        setScanningItemIndex(null);
                    }}
                    title={isKa ? "შესყიდვის შტრიხკოდის / QR სკანერი" : "Purchase Order Barcode / QR Scanner"}
                    description={isKa ? "დაასკანერეთ მიღებული საქონლის ან მასალის კოდი" : "Scan barcode on received goods, agro-inputs or materials"}
                    mockItems={inventoryItems}
                    onScan={(scannedCode, cat, parsedData) => {
                        const code = String(scannedCode).trim();
                        const parsed = parsedData || parseUniversalScan(code, [], inventoryItems, 'supplies', 'add');
                        setIsScannerOpen(false);

                        // If scanning for a specific existing row
                        if (scanningItemIndex !== null && scanningItemIndex >= 0 && scanningItemIndex < formState.items.length) {
                            const newItems = [...formState.items];
                            newItems[scanningItemIndex].barcode = code;
                            
                            // If name is empty and matched an inventory item
                            if (!newItems[scanningItemIndex].itemName && parsed.material?.item) {
                                newItems[scanningItemIndex].inventoryItemId = parsed.material.item.id;
                                newItems[scanningItemIndex].itemName = parsed.material.item.name;
                                newItems[scanningItemIndex].unitCost = parsed.material.item.unitCost;
                            }
                            setFormState(p => ({ ...p, items: newItems }));
                            toast.success(isKa ? `შტრიხკოდი #${scanningItemIndex + 1} ნივთზე მიება: ${code}` : `Attached barcode to item #${scanningItemIndex + 1}: ${code}`);
                            setScanningItemIndex(null);
                            return;
                        }

                        // Otherwise: append a new line item from scan
                        const matched = parsed.material?.item || inventoryItems.find(i => 
                            i.id === code || (i as any).sku === code || (i as any).barcode === code
                        );

                        if (matched) {
                            const newItem: PurchaseOrderItem = {
                                inventoryItemId: matched.id,
                                itemName: matched.name,
                                description: matched.description || '',
                                quantity: parsed.material?.quantity || 1,
                                unitCost: matched.unitCost || 0,
                                vat: 0,
                                addToStock: true,
                                barcode: code
                            };
                            setFormState(p => ({ ...p, items: [...p.items, newItem] }));
                            toast.success(isKa ? `დაემატა ნივთი: ${matched.name} (${code})` : `Added line item: ${matched.name} (${code})`);
                        } else {
                            const newItem: PurchaseOrderItem = {
                                inventoryItemId: 'new-item',
                                itemName: parsed.material?.materialName || `Item-${code.substring(0, 10)}`,
                                description: isKa ? 'მიღებულია შტრიხკოდით' : 'Received via barcode scan',
                                quantity: parsed.material?.quantity || 1,
                                unitCost: 0,
                                vat: 0,
                                addToStock: true,
                                barcode: code
                            };
                            setFormState(p => ({ ...p, items: [...p.items, newItem] }));
                            toast.success(isKa ? `ახალი ნივთი შტრიხკოდით: ${code}` : `Added new item with barcode: ${code}`);
                        }
                    }}
                />
            )}
            <style>{`
                .input-field { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.625rem; background-color: white; font-size: 0.75rem; font-weight: 600; outline: none; transition: all 0.2s; }
                .input-field:focus { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
                .button-primary { padding: 0.5rem 1.25rem; background-color: #059669; color: white; border-radius: 0.75rem; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; transition: all 0.2s; }
                .button-primary:hover { background-color: #047857; }
                .button-primary:disabled { background-color: #9ca3af; cursor: not-allowed; }
                .button-secondary { padding: 0.5rem 1.25rem; background-color: #e2e8f0; color: #334155; border-radius: 0.75rem; font-weight: 700; font-size: 0.75rem; transition: background-color 0.2s; }
                .button-secondary:hover { background-color: #cbd5e1; }
            `}</style>
        </>
    );
};

export default PurchaseOrderModal;
