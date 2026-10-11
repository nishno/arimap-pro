import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { StockDocument, StockDocumentCategory, AreaPlantationFeature, InventoryItem, User } from '../../types';
import { 
    Folder, FileText, Image as ImageIcon, Upload, ScanLine, Trash2, 
    Download, Eye, Search, Plus, Filter, Tag, Check, Calendar, 
    X, AlertCircle, Sparkles, MapPin, Layers, FileCheck, ShieldCheck,
    Printer, FileSpreadsheet, ClipboardCheck, ArrowRightLeft, AlertTriangle
} from 'lucide-react';
import { safeStorage } from '../../services/storageService';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';
import QrScannerModal from '../QrScannerModal';

interface BureaucracySectionProps {
    sectors?: AreaPlantationFeature[];
    inventoryItems?: InventoryItem[];
    currentUser?: User | null;
}

const STORAGE_KEY = 'agrimap_stock_documents';

const INITIAL_DOCUMENTS: StockDocument[] = [
    {
        id: 'doc-form-1',
        title: 'Goods Receiving Inspection Form - Batch PO-492',
        category: 'forms',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        fileType: 'application/pdf',
        fileSize: '420 KB',
        date: '2026-08-14',
        notes: 'Quality inspection checklist for arriving organic potassium fertilizer. Temperature & bag seals verified.',
        tags: ['Inspection', 'Quality Control', 'Fertilizer', 'PO-492'],
        uploadedAt: 1723600000000
    },
    {
        id: 'doc-tmpl-1',
        title: 'Standard Sub-Stock Transfer Voucher (Form TRF-V1)',
        category: 'templates',
        fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
        fileType: 'application/pdf',
        fileSize: '310 KB',
        date: '2026-07-01',
        notes: 'Official printable template for inter-warehouse and field station transfers.',
        tags: ['Template', 'Transfer Voucher', 'Internal Logistics'],
        uploadedAt: 1719800000000
    },
    {
        id: 'doc-agr-1',
        title: 'Supplier Annual Supply Framework Agreement - EuroAgro LLC',
        category: 'agreements',
        fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
        fileType: 'application/pdf',
        fileSize: '1.2 MB',
        date: '2026-03-15',
        notes: 'Signed bilateral contract for guaranteed chemical inputs, packaging crates, and delivery terms.',
        tags: ['Contract', 'Supplier Agreement', 'EuroAgro', 'Bilateral'],
        uploadedAt: 1710500000000
    },
    {
        id: 'doc-img-1',
        title: 'Cargo Arrival & Plastic Crates Unloading Inspection Photo',
        category: 'images',
        fileUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
        fileType: 'image/jpeg',
        fileSize: '2.1 MB',
        date: '2026-07-10',
        notes: 'High-res verification photo of 5,000 harvest plastic crates delivered at Central Depot.',
        tags: ['Photo', 'Crates', 'Packaging', 'Unloading'],
        uploadedAt: 1720600000000
    },
    {
        id: 'doc-ana-1',
        title: 'Soil Nutrient & Heavy Metal Lab Analysis (EU Certified)',
        category: 'analysis',
        fileUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=600&q=80',
        fileType: 'application/pdf',
        fileSize: '890 KB',
        date: '2026-06-01',
        notes: 'Spectroscopy and chemical residue analysis for EU export compliance. pH 4.8 verified.',
        tags: ['Soil Test', 'EU Standard', 'Phytosanitary', 'Export'],
        uploadedAt: 1717200000000
    },
    {
        id: 'doc-inv-1',
        title: 'Euro Crate Batch 5000 Units Purchase Waybill RS.ge #88210',
        category: 'invoices',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        fileType: 'image/jpeg',
        fileSize: '512 KB',
        date: '2026-07-10',
        notes: 'Certified food-grade harvest plastic crates tax invoice and RS.ge delivery waybill.',
        tags: ['Packaging', 'Invoice', 'Waybill', 'RS.ge'],
        uploadedAt: 1720600000000
    }
];

export const BureaucracySection: React.FC<BureaucracySectionProps> = ({
    sectors = [],
    inventoryItems = [],
    currentUser
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [documents, setDocuments] = useState<StockDocument[]>(() => {
        try {
            const raw = safeStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error('Failed to load stock documents:', e);
        }
        return INITIAL_DOCUMENTS;
    });

    useEffect(() => {
        try {
            safeStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
        } catch (e) {
            console.error('Failed to save stock documents:', e);
        }
    }, [documents]);

    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');

    // Modals
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<StockDocument | null>(null);
    const [isTemplateGeneratorOpen, setIsTemplateGeneratorOpen] = useState(false);

    // Template Generator state
    const [selectedTemplateType, setSelectedTemplateType] = useState<'receiving_form' | 'transfer_voucher' | 'damage_report' | 'inventory_sheet'>('receiving_form');
    const [genSupplier, setGenSupplier] = useState('EuroAgro Supplies');
    const [genItem, setGenItem] = useState('');
    const [genQuantity, setGenQuantity] = useState('100');
    const [genInspector, setGenInspector] = useState(currentUser?.name || 'Lead Warehouse Inspector');
    const [genSourceLoc, setGenSourceLoc] = useState('Main Warehouse');
    const [genDestLoc, setGenDestLoc] = useState('North Field Storage');
    const [genNotes, setGenNotes] = useState('');

    // Upload form
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState<StockDocumentCategory>('forms');
    const [newNotes, setNewNotes] = useState('');
    const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [newSectorId, setNewSectorId] = useState('');
    const [newItemId, setNewItemId] = useState('');
    const [newTags, setNewTags] = useState('');
    const [newFileUrl, setNewFileUrl] = useState('');
    const [newFileType, setNewFileType] = useState('application/pdf');
    const [newFileSize, setNewFileSize] = useState('');

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUrl = evt.target?.result as string;
            setNewFileUrl(dataUrl);
            setNewFileType(file.type || 'application/pdf');
            const sizeKb = Math.round(file.size / 1024);
            setNewFileSize(sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`);
            if (!newTitle) {
                setNewTitle(file.name.replace(/\.[^/.]+$/, ''));
            }
            if (file.type.startsWith('image/')) {
                setNewCategory('images');
            } else {
                setNewCategory('invoices');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveDocument = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) {
            toast.error(isKa ? 'გთხოვთ მიუთითოთ დოკუმენტის სახელი' : 'Please provide document title');
            return;
        }

        const sector = sectors.find(s => s.id === newSectorId);
        const item = inventoryItems.find(i => i.id === newItemId);

        const newDoc: StockDocument = {
            id: `doc-${Date.now()}`,
            title: newTitle.trim(),
            category: newCategory,
            fileUrl: newFileUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
            fileType: newFileType,
            fileSize: newFileSize || '350 KB',
            date: newDate,
            notes: newNotes.trim(),
            tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [],
            linkedSectorId: sector?.id,
            linkedSectorName: sector?.name,
            linkedItemId: item?.id,
            linkedItemName: item?.name,
            uploadedAt: Date.now()
        };

        setDocuments(prev => [newDoc, ...prev]);
        toast.success(isKa ? 'დოკუმენტი წარმატებით დაემატა!' : 'Document saved successfully!');
        
        setNewTitle('');
        setNewNotes('');
        setNewFileUrl('');
        setNewTags('');
        setIsUploadModalOpen(false);
    };

    const handleGenerateTemplate = () => {
        let title = '';
        let category: StockDocumentCategory = 'forms';
        let notes = '';

        if (selectedTemplateType === 'receiving_form') {
            title = `Receiving Inspection Form - ${genSupplier} (${new Date().toLocaleDateString()})`;
            category = 'forms';
            notes = `Inspector: ${genInspector} | Supplier: ${genSupplier} | Item: ${genItem || 'All shipment items'} | Quantity: ${genQuantity} | Condition: Packaging intact, seals verified. ${genNotes}`;
        } else if (selectedTemplateType === 'transfer_voucher') {
            title = `Sub-Stock Transfer Voucher - [${genSourceLoc}] to [${genDestLoc}]`;
            category = 'templates';
            notes = `Dispatched by: ${genInspector} | Transferred: ${genQuantity} units of ${genItem || 'Materials'} | Route: ${genSourceLoc} -> ${genDestLoc}. ${genNotes}`;
        } else if (selectedTemplateType === 'damage_report') {
            title = `Stock Damage & Discrepancy Note - ${genItem || 'Supplies'}`;
            category = 'forms';
            notes = `Reporter: ${genInspector} | Affected Material: ${genItem} | Damaged Quantity: ${genQuantity} | Notes: ${genNotes || 'Inspection upon unloading indicated package puncture'}`;
        } else {
            title = `Physical Stock Audit Count Sheet - ${new Date().toLocaleDateString()}`;
            category = 'templates';
            notes = `Auditor: ${genInspector} | Location: ${genSourceLoc} | Verified against digital ledger records. ${genNotes}`;
        }

        const generatedDoc: StockDocument = {
            id: `doc-gen-${Date.now()}`,
            title,
            category,
            fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
            fileType: 'application/pdf',
            fileSize: '280 KB',
            date: new Date().toISOString().split('T')[0],
            notes,
            tags: ['Generated', category, selectedTemplateType],
            uploadedAt: Date.now()
        };

        setDocuments(prev => [generatedDoc, ...prev]);
        toast.success(
            isKa 
                ? 'დოკუმენტი წარმატებით გენერირებულია და დაცულია ბიუროკრატიის განყოფილებაში!' 
                : 'Document generated and saved to Bureaucracy archive!'
        );
        setIsTemplateGeneratorOpen(false);
        setPreviewDoc(generatedDoc);
    };

    const handleDeleteDocument = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(isKa ? 'დარწმუნებული ხართ, რომ გსურთ დოკუმენტის წაშლა?' : 'Are you sure you want to delete this document?')) {
            setDocuments(prev => prev.filter(d => d.id !== id));
            toast.info(isKa ? 'დოკუმენტი წაიშალა' : 'Document removed');
        }
    };

    const filteredDocs = useMemo(() => {
        return documents.filter(doc => {
            const matchesCat = activeCategory === 'all' || doc.category === activeCategory;
            const matchesSector = selectedSectorFilter === 'all' || doc.linkedSectorId === selectedSectorFilter;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                doc.title.toLowerCase().includes(q) ||
                (doc.notes && doc.notes.toLowerCase().includes(q)) ||
                (doc.linkedSectorName && doc.linkedSectorName.toLowerCase().includes(q)) ||
                (doc.tags && doc.tags.some(t => t.toLowerCase().includes(q)));
            return matchesCat && matchesSector && matchesSearch;
        });
    }, [documents, activeCategory, selectedSectorFilter, searchQuery]);

    // Categories definition
    const CATEGORIES = [
        { id: 'all', label: isKa ? 'ყველა დოკუმენტი' : 'All Bureaucracy', icon: Folder },
        { id: 'forms', label: isKa ? '📋 ფორმები & აქტები' : '📋 Forms & Checklists', icon: ClipboardCheck },
        { id: 'templates', label: isKa ? '📄 შაბლონები' : '📄 Templates', icon: FileText },
        { id: 'agreements', label: isKa ? '🤝 ხელშეკრულებები' : '🤝 Agreements & Contracts', icon: FileCheck },
        { id: 'images', label: isKa ? '📸 ფოტოები & სურათები' : '📸 Images & Photos', icon: ImageIcon },
        { id: 'analysis', label: isKa ? '🔬 ლაბორატორიული ანალიზები' : '🔬 Lab Analyses', icon: Sparkles },
        { id: 'invoices', label: isKa ? '🧾 ინვოისები & ზედნადებები' : '🧾 Invoices & Waybills', icon: FileSpreadsheet },
        { id: 'other', label: isKa ? '📁 სხვა დოკუმენტები' : '📁 Other', icon: Folder },
    ];

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                        <Folder size={26} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <span>{isKa ? 'ბიუროკრატია, ფორმები & დოკუმენტაცია' : 'Bureaucracy, Forms & Documentation'}</span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {documents.length} {isKa ? 'დოკუმენტი' : 'files'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isKa 
                                ? 'აქტები, შაბლონები, კონტრაქტები, ანალიზები, მიღება-ჩაბარების ფორმები და ფოტოები ერთ სივრცეში' 
                                : 'Inspection forms, legal templates, supplier agreements, lab analysis, and receipts'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => setIsTemplateGeneratorOpen(true)}
                        className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <Sparkles size={15} />
                        <span>{isKa ? 'ფორმის / შაბლონის გენერირება' : 'Generate Form / Template'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <ScanLine size={15} className="text-emerald-400" />
                        <span>{isKa ? 'სკანირება' : 'Scan'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs shadow-amber-100 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <Upload size={15} />
                        <span>{isKa ? 'ატვირთვა' : 'Upload File'}</span>
                    </button>
                </div>
            </div>

            {/* Category Filter Pills & Search */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {CATEGORIES.map(cat => {
                        const count = cat.id === 'all' 
                            ? documents.length 
                            : documents.filter(d => d.category === cat.id).length;
                        const IconComp = cat.icon;

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveCategory(cat.id)}
                                className={`py-2 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                                    activeCategory === cat.id
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                                }`}
                            >
                                <IconComp size={14} />
                                <span>{cat.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    activeCategory === cat.id ? 'bg-amber-800 text-amber-100' : 'bg-slate-200 text-slate-600'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
                    <div className="relative flex-1 w-full">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={isKa ? "ძიება სახელით, შინაარსით, ტეგით..." : "Search document name, tags, inspector, notes..."}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500 transition-all"
                        />
                    </div>

                    {sectors.length > 0 && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <MapPin size={15} className="text-slate-400 shrink-0" />
                            <select
                                value={selectedSectorFilter}
                                onChange={e => setSelectedSectorFilter(e.target.value)}
                                className="w-full sm:w-auto py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="all">{isKa ? 'ყველა ნაკვეთი' : 'All Plantation Plots'}</option>
                                {sectors.map(sec => (
                                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Documents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocs.map(doc => {
                    const isImg = doc.fileType.startsWith('image/');

                    return (
                        <div
                            key={doc.id}
                            onClick={() => setPreviewDoc(doc)}
                            className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                        >
                            <div>
                                {isImg ? (
                                    <div className="h-40 w-full rounded-2xl overflow-hidden mb-3 bg-slate-100 relative">
                                        <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                                            {doc.category}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="h-32 w-full rounded-2xl mb-3 bg-amber-50/50 border border-amber-100/60 flex flex-col items-center justify-center p-3 relative">
                                        <FileText size={36} className="text-amber-600 mb-1" />
                                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                                            {doc.category.toUpperCase()}
                                        </span>
                                        <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                                            {doc.fileSize || 'PDF'}
                                        </span>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {doc.date}
                                        </span>
                                        <span>{doc.fileSize}</span>
                                    </div>

                                    <h3 className="text-sm font-black text-slate-900 line-clamp-2 leading-snug">
                                        {doc.title}
                                    </h3>

                                    {doc.notes && (
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                            {doc.notes}
                                        </p>
                                    )}

                                    {doc.tags && doc.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {doc.tags.map((t, i) => (
                                                <span key={i} className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                    <Eye size={14} />
                                    <span>{isKa ? 'ნახვა' : 'Preview'}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                    <a
                                        href={doc.fileUrl}
                                        download={doc.title}
                                        onClick={e => e.stopPropagation()}
                                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                        title={isKa ? 'გადმოწერა' : 'Download'}
                                    >
                                        <Download size={14} />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                        title={isKa ? 'წაშლა' : 'Delete'}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredDocs.length === 0 && (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 text-slate-400 font-bold">
                    <Folder size={40} className="mx-auto text-slate-300 mb-2" />
                    <p>{isKa ? 'დოკუმენტები არ მოიძებნა' : 'No documents found matching criteria'}</p>
                </div>
            )}

            {/* Template Generator Modal */}
            {isTemplateGeneratorOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={() => setIsTemplateGeneratorOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <Sparkles className="w-5 h-5" />
                                <h3 className="text-base font-black">
                                    {isKa ? 'სასაწყობე ფორმისა და შაბლონის შექმნა' : 'Generate Warehouse Form / Template'}
                                </h3>
                            </div>
                            <button onClick={() => setIsTemplateGeneratorOpen(false)} className="text-white/80 hover:text-white p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1.5">
                                    {isKa ? 'აირჩიეთ ფორმის ტიპი' : 'Select Document Template'}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTemplateType('receiving_form')}
                                        className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all ${
                                            selectedTemplateType === 'receiving_form'
                                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        📋 {isKa ? 'მიღების ინსპექტირება' : 'Receiving Inspection'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTemplateType('transfer_voucher')}
                                        className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all ${
                                            selectedTemplateType === 'transfer_voucher'
                                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        📄 {isKa ? 'გადატანის ორდერი' : 'Transfer Voucher'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTemplateType('damage_report')}
                                        className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all ${
                                            selectedTemplateType === 'damage_report'
                                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        ⚠️ {isKa ? 'დაზიანების აქტი' : 'Damage Report'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTemplateType('inventory_sheet')}
                                        className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all ${
                                            selectedTemplateType === 'inventory_sheet'
                                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        📊 {isKa ? 'ინვენტარიზაციის უწყისი' : 'Stock Audit Sheet'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                        {isKa ? 'შემმოწმებელი / პასუხისმგებელი' : 'Inspector / Official'}
                                    </label>
                                    <input
                                        type="text"
                                        value={genInspector}
                                        onChange={(e) => setGenInspector(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-600"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                        {isKa ? 'მომწოდებელი / მხარე' : 'Party / Supplier'}
                                    </label>
                                    <input
                                        type="text"
                                        value={genSupplier}
                                        onChange={(e) => setGenSupplier(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-600"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                        {isKa ? 'სასაწყობე ნივთი' : 'Item Description'}
                                    </label>
                                    <input
                                        type="text"
                                        value={genItem}
                                        onChange={(e) => setGenItem(e.target.value)}
                                        placeholder={isKa ? 'მაგ. კალიუმის ნიტრატი 25კგ' : 'e.g. Potassium Nitrate 25kg'}
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-600"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                        {isKa ? 'რაოდენობა' : 'Quantity'}
                                    </label>
                                    <input
                                        type="text"
                                        value={genQuantity}
                                        onChange={(e) => setGenQuantity(e.target.value)}
                                        placeholder="100 bags"
                                        className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-600"
                                    />
                                </div>
                            </div>

                            {selectedTemplateType === 'transfer_voucher' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                            {isKa ? 'გამგზავნი ლოკაცია' : 'Source Location'}
                                        </label>
                                        <input
                                            type="text"
                                            value={genSourceLoc}
                                            onChange={(e) => setGenSourceLoc(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                            {isKa ? 'დანიშნულების ქვესაწყობი' : 'Destination Sub-Stock'}
                                        </label>
                                        <input
                                            type="text"
                                            value={genDestLoc}
                                            onChange={(e) => setGenDestLoc(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    {isKa ? 'შენიშვნები / დასკვნა' : 'Inspection Notes / Findings'}
                                </label>
                                <textarea
                                    value={genNotes}
                                    onChange={(e) => setGenNotes(e.target.value)}
                                    rows={2}
                                    placeholder={isKa ? 'მიუთითეთ ინსპექტირების დასკვნა ან აქტის დეტალები...' : 'Enter inspection details or condition...'}
                                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-600"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsTemplateGeneratorOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGenerateTemplate}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-emerald-200 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Sparkles size={14} />
                                    <span>{isKa ? 'გენერირება & შენახვა' : 'Generate & Archive'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[5000] flex items-center justify-center p-4" onClick={() => setIsUploadModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <Upload size={18} />
                                <h3 className="text-base font-black">
                                    {isKa ? 'დოკუმენტის ატვირთვა ბიუროკრატიაში' : 'Upload Document to Bureaucracy'}
                                </h3>
                            </div>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-white/80 hover:text-white p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDocument} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    {isKa ? 'დოკუმენტის დასახელება' : 'Document Title'} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder={isKa ? "მაგ. მიღება-ჩაბარების აქტი #42" : "e.g. Chemical Analysis Certificate 2026"}
                                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                        {isKa ? 'კატეგორია' : 'Category'}
                                    </label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value as StockDocumentCategory)}
                                        className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                    >
                                        <option value="forms">📋 {isKa ? 'ფორმები & აქტები' : 'Forms & Checklists'}</option>
                                        <option value="templates">📄 {isKa ? 'შაბლონები' : 'Templates'}</option>
                                        <option value="agreements">🤝 {isKa ? 'ხელშეკრულებები' : 'Agreements & Contracts'}</option>
                                        <option value="images">📸 {isKa ? 'ფოტოები & სურათები' : 'Images & Photos'}</option>
                                        <option value="analysis">🔬 {isKa ? 'ლაბორატორიული ანალიზები' : 'Lab Analyses'}</option>
                                        <option value="invoices">🧾 {isKa ? 'ინვოისები & ზედნადებები' : 'Invoices & Waybills'}</option>
                                        <option value="other">📁 {isKa ? 'სხვა' : 'Other'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                        {isKa ? 'თარიღი' : 'Date'}
                                    </label>
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={e => setNewDate(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-2.5 outline-none"
                                    />
                                </div>
                            </div>

                            {/* File Upload Box */}
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    {isKa ? 'ფაილი (სურათი, PDF, დოკუმენტი)' : 'File (Image, PDF, Scan)'}
                                </label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                />
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-2xl p-4 text-center cursor-pointer bg-amber-50/40 hover:bg-amber-50 transition-colors"
                                >
                                    <Upload size={24} className="mx-auto text-amber-600 mb-1" />
                                    <p className="text-xs font-bold text-slate-800">
                                        {newFileUrl ? (isKa ? 'ფაილი არჩეულია (დააჭირეთ შესაცვლელად)' : 'File selected (Click to change)') : (isKa ? 'დააჭირეთ ფაილის ასატვირთად' : 'Click to browse or drop file')}
                                    </p>
                                    {newFileSize && (
                                        <p className="text-[10px] text-slate-500 mt-0.5">{newFileSize}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    {isKa ? 'ტეგები (მძიმით გამოყოფილი)' : 'Tags (comma-separated)'}
                                </label>
                                <input
                                    type="text"
                                    value={newTags}
                                    onChange={e => setNewTags(e.target.value)}
                                    placeholder="Blueberry, Sector 4, Duke, Soil pH"
                                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    {isKa ? 'შენიშვნები' : 'Notes'}
                                </label>
                                <textarea
                                    value={newNotes}
                                    onChange={e => setNewNotes(e.target.value)}
                                    rows={2}
                                    placeholder={isKa ? 'დამატებითი დეტალები...' : 'Additional notes...'}
                                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-amber-200 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Check size={14} />
                                    <span>{isKa ? 'შენახვა' : 'Save Document'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Document Preview Modal */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs" onClick={() => setPreviewDoc(null)}>
                    <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-sm font-black tracking-tight">{previewDoc.title}</h3>
                                <p className="text-[10px] text-slate-400">{previewDoc.category} • {previewDoc.date}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Printer size={14} />
                                    <span>{isKa ? 'ბეჭდვა' : 'Print'}</span>
                                </button>
                                <a
                                    href={previewDoc.fileUrl}
                                    download={previewDoc.title}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Download size={14} />
                                    <span>{isKa ? 'გადმოწერა' : 'Download'}</span>
                                </a>
                                <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-xl text-slate-400 hover:text-white cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 min-h-[300px]">
                            {previewDoc.fileType.startsWith('image/') ? (
                                <img src={previewDoc.fileUrl} alt={previewDoc.title} className="max-h-[65vh] max-w-full rounded-xl object-contain mx-auto shadow-sm" />
                            ) : (
                                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto space-y-4">
                                    <div className="flex items-center justify-between border-b pb-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="text-amber-600" size={24} />
                                            <h4 className="text-base font-black text-slate-900">{previewDoc.title}</h4>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-slate-400">{previewDoc.date}</span>
                                    </div>
                                    <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-2">
                                        <div className="font-bold text-slate-700">
                                            {isKa ? 'დოკუმენტის შინაარსი & დეტალები:' : 'Document Metadata & Specifications:'}
                                        </div>
                                        <p className="text-slate-600 leading-relaxed font-medium">
                                            {previewDoc.notes || 'Official document record filed in plantation archive.'}
                                        </p>
                                    </div>
                                    {previewDoc.tags && previewDoc.tags.length > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <Tag size={12} />
                                            <span>{previewDoc.tags.join(', ')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Scanner Pop-up Modal */}
            {isScannerOpen && (
                <QrScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    title={isKa ? "დოკუმენტის & შტრიხკოდის სკანერი" : "Document & Barcode Scanner"}
                    description={isKa ? "დაასკანერეთ ინვოისის QR, ზედნადები ან გადაუღეთ ფოტო დოკუმენტს" : "Scan Invoice Barcode, Delivery Waybill or Capture Document"}
                    onScan={(scannedCode) => {
                        setIsScannerOpen(false);
                        setNewTitle(`Scanned Document - ${scannedCode.substring(0, 16)}`);
                        setNewNotes(`Captured via QR/Barcode Scan: ${scannedCode}`);
                        setNewCategory('invoices');
                        setIsUploadModalOpen(true);
                        toast.success(isKa ? `შტრიხკოდი წაკითხულია: ${scannedCode}` : `Barcode Scanned: ${scannedCode}`);
                    }}
                />
            )}
        </div>
    );
};
export default BureaucracySection;
