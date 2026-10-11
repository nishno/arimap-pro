import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { StockDocument, AreaPlantationFeature, InventoryItem, User } from '../types';
import { 
    Folder, FileText, Image as ImageIcon, Upload, ScanLine, Trash2, 
    Download, Eye, Search, Plus, Filter, Tag, Check, Calendar, 
    X, AlertCircle, Sparkles, MapPin, Layers, FileCheck, ShieldCheck
} from 'lucide-react';
import { safeStorage } from '../services/storageService';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import QrScannerModal from './QrScannerModal';

interface StockDocumentsFolderProps {
    sectors?: AreaPlantationFeature[];
    inventoryItems?: InventoryItem[];
    currentUser?: User | null;
}

const STORAGE_KEY = 'agrimap_stock_documents';

const INITIAL_DOCUMENTS: StockDocument[] = [
    {
        id: 'doc-1',
        title: 'Sector 4 Blueberry Plot Spring Inspection',
        category: 'plantation_photos',
        fileUrl: 'https://images.unsplash.com/photo-1595231712325-9fdec671e2ef?auto=format&fit=crop&w=600&q=80',
        fileType: 'image/jpeg',
        fileSize: '1.8 MB',
        date: '2026-05-12',
        notes: 'Spring vegetative growth inspection on Duke variety in Sector 4.',
        tags: ['Sector 4', 'Inspection', 'Blueberry', 'Duke'],
        linkedSectorId: 'sector-4',
        linkedSectorName: 'Sector 4 (North Block)',
        uploadedAt: 1715500000000
    },
    {
        id: 'doc-2',
        title: 'Soil & Chemical Residue Lab Analysis Report',
        category: 'lab_reports',
        fileUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=600&q=80',
        fileType: 'application/pdf',
        fileSize: '740 KB',
        date: '2026-06-01',
        notes: 'Phytosanitary and soil pH certification for EU organic export compliance.',
        tags: ['Soil Test', 'EU Standard', 'Phytosanitary'],
        uploadedAt: 1717200000000
    },
    {
        id: 'doc-3',
        title: 'Euro Crate Batch 5000 Units Purchase Waybill',
        category: 'invoices',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        fileType: 'image/jpeg',
        fileSize: '512 KB',
        date: '2026-07-10',
        notes: 'Certified food-grade harvest plastic crates invoice and delivery voucher.',
        tags: ['Packaging', 'Invoice', 'Waybill'],
        uploadedAt: 1720600000000
    }
];

export const StockDocumentsFolder: React.FC<StockDocumentsFolderProps> = ({
    sectors = [],
    inventoryItems = [],
    currentUser
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    // State for documents
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

    // Save on changes
    useEffect(() => {
        try {
            safeStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
        } catch (e) {
            console.error('Failed to save stock documents:', e);
        }
    }, [documents]);

    // Active category filter
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');

    // Upload & Add Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<StockDocument | null>(null);

    // New Document Form
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState<StockDocument['category']>('plantation_photos');
    const [newNotes, setNewNotes] = useState('');
    const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [newSectorId, setNewSectorId] = useState('');
    const [newItemId, setNewItemId] = useState('');
    const [newTags, setNewTags] = useState('');
    const [newFileUrl, setNewFileUrl] = useState('');
    const [newFileType, setNewFileType] = useState('image/jpeg');
    const [newFileSize, setNewFileSize] = useState('');

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Handle File Drop / Select
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUrl = evt.target?.result as string;
            setNewFileUrl(dataUrl);
            setNewFileType(file.type || 'image/jpeg');
            const sizeKb = Math.round(file.size / 1024);
            setNewFileSize(sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`);
            if (!newTitle) {
                setNewTitle(file.name.replace(/\.[^/.]+$/, ''));
            }
            if (file.type.startsWith('image/')) {
                setNewCategory('plantation_photos');
            } else {
                setNewCategory('invoices');
            }
        };
        reader.readAsDataURL(file);
    };

    // Save New Document
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
            fileUrl: newFileUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
            fileType: newFileType,
            fileSize: newFileSize || '250 KB',
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
        toast.success(isKa ? 'დოკუმენტი / ფოტო წარმატებით დაემატა!' : 'Document / Photo saved successfully!');
        
        // Reset form
        setNewTitle('');
        setNewNotes('');
        setNewFileUrl('');
        setNewTags('');
        setIsUploadModalOpen(false);
    };

    // Delete Document
    const handleDeleteDocument = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(isKa ? 'დარწმუნებული ხართ, რომ გსურთ დოკუმენტის წაშლა?' : 'Are you sure you want to delete this document?')) {
            setDocuments(prev => prev.filter(d => d.id !== id));
            toast.info(isKa ? 'დოკუმენტი წაიშალა' : 'Document removed');
        }
    };

    // Filtered documents
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

    // Categories list
    const CATEGORIES = [
        { id: 'all', label: isKa ? 'ყველა დოკუმენტი' : 'All Documents', icon: Folder },
        { id: 'plantation_photos', label: isKa ? '📷 პლანტაციის ფოტოები' : '📷 Plantation Photos', icon: ImageIcon },
        { id: 'invoices', label: isKa ? '📄 ინვოისები & ზედნადებები' : '📄 Invoices & Bills', icon: FileText },
        { id: 'lab_reports', label: isKa ? '🧪 ლაბორატორიული ანალიზები' : '🧪 Lab Reports', icon: Sparkles },
        { id: 'certificates', label: isKa ? '🛡️ სერთიფიკატები' : '🛡️ Certificates', icon: ShieldCheck },
        { id: 'contracts', label: isKa ? '📑 ხელშეკრულებები' : '📑 Contracts', icon: FileCheck },
    ];

    return (
        <div className="space-y-6">
            
            {/* Top Banner & Actions */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                        <Folder size={26} />
                    </div>
                    <div>
                        <h2 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <span>{isKa ? 'დოკუმენტების და პლანტაციის მედია საქაღალდე' : 'Stock Documents & Plantation Media Vault'}</span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {documents.length} {isKa ? 'ფაილი' : 'files'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isKa 
                                ? 'სასაწყობე ზედნადებების, ინვოისების, ლაბორატორიული ანალიზებისა და პლანტაციის ნაკვეთების ფოტოების ციფრული არქივი' 
                                : 'Digital archive for warehouse invoices, waybills, lab soil reports, phytosanitary permits, and plot photo inspections'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <ScanLine size={15} className="text-emerald-400" />
                        <span>{isKa ? 'დოკუმენტის სკანირება' : 'Scan Document'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm shadow-amber-100 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <Upload size={15} />
                        <span>{isKa ? 'ატვირთვა / იმპორტი' : 'Import / Upload'}</span>
                    </button>
                </div>
            </div>

            {/* Category Pills & Search Toolbar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                
                {/* Categories Tabs */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {CATEGORIES.map(cat => {
                        const count = cat.id === 'all' 
                            ? documents.length 
                            : documents.filter(d => d.category === cat.id).length;
                        const IconComponent = cat.icon;

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveCategory(cat.id)}
                                className={`py-2 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                                    activeCategory === cat.id
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                                }`}
                            >
                                <IconComponent size={14} />
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

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
                    <div className="relative flex-1 w-full">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={isKa ? "ძიება სახელით, შენიშვნით, ტეგით..." : "Search document title, notes, plot, tags..."}
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
            {filteredDocs.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Folder size={32} />
                    </div>
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                        {isKa ? 'დოკუმენტები არ მოიძებნა' : 'No Documents Found'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        {isKa 
                            ? 'ატვირთეთ პლანტაციის ფოტოები, ზედნადებები ან დაასკანერეთ დოკუმენტები' 
                            : 'Upload plantation plot photos, waybills, invoices or scan barcodes on documents'}
                    </p>
                    <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="mt-4 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>{isKa ? 'ფაილის დამატება' : 'Add First Document'}</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDocs.map(doc => {
                        const isImage = doc.fileType.startsWith('image/');

                        return (
                            <div
                                key={doc.id}
                                onClick={() => setPreviewDoc(doc)}
                                className="bg-white rounded-2xl border border-slate-200/80 hover:border-amber-400 hover:shadow-md transition-all overflow-hidden flex flex-col group cursor-pointer"
                            >
                                {/* Media / Thumbnail Preview */}
                                <div className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                    {isImage ? (
                                        <img 
                                            src={doc.fileUrl} 
                                            alt={doc.title} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                                            <FileText size={48} className="text-amber-500 mb-1" />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                {doc.fileType.includes('pdf') ? 'PDF DOCUMENT' : 'DOCUMENT FILE'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Category Badge overlay */}
                                    <div className="absolute top-2 left-2">
                                        <span className="bg-slate-900/85 backdrop-blur-xs text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider shadow-xs">
                                            {doc.category.replace('_', ' ')}
                                        </span>
                                    </div>

                                    {/* Action Buttons overlay */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                                            className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                                            title="Delete"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>

                                    {doc.fileSize && (
                                        <div className="absolute bottom-2 right-2 bg-slate-900/70 backdrop-blur-xs text-slate-200 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                                            {doc.fileSize}
                                        </div>
                                    )}
                                </div>

                                {/* Content Details */}
                                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-900 line-clamp-1 group-hover:text-amber-600 transition-colors">
                                            {doc.title}
                                        </h4>
                                        {doc.notes && (
                                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 font-medium">
                                                {doc.notes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10px]">
                                        {doc.linkedSectorName && (
                                            <div className="flex items-center gap-1 text-slate-600 font-bold truncate">
                                                <MapPin size={11} className="text-emerald-600 shrink-0" />
                                                <span className="truncate">{doc.linkedSectorName}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center text-slate-400 font-semibold">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} />
                                                <span>{doc.date}</span>
                                            </span>
                                            <span className="text-amber-600 font-black flex items-center gap-1 group-hover:underline">
                                                <Eye size={11} />
                                                <span>{isKa ? 'ნახვა' : 'Preview'}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload / Import Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs" onClick={() => setIsUploadModalOpen(false)}>
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200" onClick={e => e.stopPropagation()}>
                        
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <Upload size={20} className="text-amber-400" />
                                <h3 className="text-base font-black tracking-tight">
                                    {isKa ? 'დოკუმენტის ან ფოტოს ატვირთვა' : 'Upload Document or Plantation Photo'}
                                </h3>
                            </div>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDocument} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                            
                            {/* Drop / File Selector */}
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                />

                                {newFileUrl ? (
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {newFileType.startsWith('image/') ? (
                                                <img src={newFileUrl} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                                            ) : (
                                                <FileText size={32} className="text-amber-600 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <span className="font-bold text-slate-800 block truncate">{newTitle || 'Selected File'}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{newFileSize} • {newFileType}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="py-1.5 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase hover:bg-slate-100 cursor-pointer"
                                        >
                                            {isKa ? 'შეცვლა' : 'Change'}
                                        </button>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 text-center bg-slate-50 hover:bg-amber-50/40 transition-all cursor-pointer"
                                    >
                                        <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                                        <p className="font-black text-slate-700 uppercase tracking-wider">
                                            {isKa ? 'დააწკაპუნეთ ან გადმოიტანეთ ფაილი' : 'Click to Upload or Drag & Drop'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WebP, PDF (max 15MB)</p>
                                    </div>
                                )}
                            </div>

                            {/* Title */}
                            <div>
                                <label className="font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'დოკუმენტის / ფოტოს სათაური' : 'Document Title'} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder={isKa ? "მაგ. ნაკვეთი 4 გაზაფხულის ინსპექცია..." : "e.g. Sector 4 Spring Inspection Photo..."}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none focus:bg-white focus:border-amber-500"
                                    required
                                />
                            </div>

                            {/* Category & Date */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-black uppercase tracking-wider text-slate-600 block mb-1">
                                        {isKa ? 'კატეგორია' : 'Category'}
                                    </label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value as any)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none cursor-pointer"
                                    >
                                        <option value="plantation_photos">{isKa ? '📷 პლანტაციის ფოტო' : '📷 Plantation Photo'}</option>
                                        <option value="invoices">{isKa ? '📄 ინვოისი / ზედნადები' : '📄 Invoice / Bill'}</option>
                                        <option value="lab_reports">{isKa ? '🧪 ლაბორატორიული ანალიზი' : '🧪 Lab Report'}</option>
                                        <option value="certificates">{isKa ? '🛡️ ხარისხის სერთიფიკატი' : '🛡️ Certificate'}</option>
                                        <option value="contracts">{isKa ? '📑 ხელშეკრულება' : '📑 Contract'}</option>
                                        <option value="other">{isKa ? 'სხვა' : 'Other'}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase tracking-wider text-slate-600 block mb-1">
                                        {isKa ? 'თარიღი' : 'Date'}
                                    </label>
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={e => setNewDate(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Sector / Plot linkage */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-black uppercase tracking-wider text-slate-600 block mb-1">
                                        {isKa ? 'მიბმული ნაკვეთი / სექტორი' : 'Linked Sector / Plot'}
                                    </label>
                                    <select
                                        value={newSectorId}
                                        onChange={e => setNewSectorId(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none cursor-pointer"
                                    >
                                        <option value="">{isKa ? 'არ არის მიბმული' : 'None (General)'}</option>
                                        {sectors.map(sec => (
                                            <option key={sec.id} value={sec.id}>{sec.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase tracking-wider text-slate-600 block mb-1">
                                        {isKa ? 'სასაწყობე ნივთი (არასავალდებულო)' : 'Linked Stock Item'}
                                    </label>
                                    <select
                                        value={newItemId}
                                        onChange={e => setNewItemId(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none cursor-pointer"
                                    >
                                        <option value="">{isKa ? 'არ არის მიბმული' : 'None'}</option>
                                        {inventoryItems.map(item => (
                                            <option key={item.id} value={item.id}>{item.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'ტეგები (მძიმით გამოყოფილი)' : 'Tags (comma separated)'}
                                </label>
                                <input
                                    type="text"
                                    value={newTags}
                                    onChange={e => setNewTags(e.target.value)}
                                    placeholder="Sector 4, Inspection, Blueberry, Organic"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'შენიშვნა / აღწერა' : 'Notes / Description'}
                                </label>
                                <textarea
                                    value={newNotes}
                                    onChange={e => setNewNotes(e.target.value)}
                                    rows={2}
                                    placeholder={isKa ? "დამატებითი ინფორმაცია, დასკვნა ან დეტალები..." : "Add observation notes or details..."}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                                >
                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="py-2.5 px-5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl font-black uppercase tracking-wider shadow-sm cursor-pointer"
                                >
                                    {isKa ? 'შენახვა' : 'Save Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Document Preview Modal */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
                    <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-sm font-black tracking-tight">{previewDoc.title}</h3>
                                <p className="text-[10px] text-slate-400">{previewDoc.category} • {previewDoc.date}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDoc.fileUrl}
                                    download={previewDoc.title}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                                >
                                    <Download size={14} />
                                    <span>{isKa ? 'გადმოწერა' : 'Download'}</span>
                                </a>
                                <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-xl text-slate-400 hover:text-white cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 bg-slate-50 flex items-center justify-center min-h-[300px]">
                            {previewDoc.fileType.startsWith('image/') ? (
                                <img src={previewDoc.fileUrl} alt={previewDoc.title} className="max-h-[65vh] max-w-full rounded-xl object-contain shadow-sm" />
                            ) : (
                                <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md">
                                    <FileText size={56} className="text-amber-500 mx-auto mb-3" />
                                    <h4 className="text-sm font-black text-slate-800 mb-1">{previewDoc.title}</h4>
                                    <p className="text-xs text-slate-500 mb-4">{previewDoc.notes || 'Document file ready to download or view.'}</p>
                                    <a
                                        href={previewDoc.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-sm"
                                    >
                                        <Download size={14} />
                                        <span>{isKa ? 'ფაილის გახსნა / ჩამოტვირთვა' : 'Open / Download File'}</span>
                                    </a>
                                </div>
                            )}
                        </div>

                        {previewDoc.notes && (
                            <div className="p-4 bg-white border-t border-slate-100 shrink-0 text-xs">
                                <span className="font-black text-slate-700 uppercase tracking-wider text-[10px] block mb-0.5">
                                    {isKa ? 'შენიშვნა:' : 'Notes:'}
                                </span>
                                <p className="text-slate-600 font-medium">{previewDoc.notes}</p>
                            </div>
                        )}
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

export default StockDocumentsFolder;
