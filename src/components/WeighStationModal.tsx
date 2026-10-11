import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { HarvestEntry, Employee, InventoryItem, User, AreaPlantationFeature, HarvestEvent, AssignedPicker } from '../types';
import { XCircleIcon, QrCodeIcon, CameraIcon, SearchIcon, CheckIcon, BluetoothIcon, SaveIcon, FingerprintIcon, ChevronDown } from './Icons';
import jsQR from 'jsqr';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Scale, RotateCcw, PenTool, Keyboard, Eraser, QrCode, Camera, ShieldCheck, Settings, Eye, EyeOff, ArrowUp, ArrowDown, Sparkles, GripVertical, X, Pencil, Users, Check, Trash2, ListFilter, Plus, ScanLine, CheckCircle2, UserCheck, CornerDownRight, Clock, ArrowRight, Package, Calendar } from 'lucide-react';
import { getStoredActiveUser, ActiveUsersPresenceBar } from '../utils/userPresence';
import QrScannerModal from './QrScannerModal';
import { findMatchingEmployee } from '../utils/employeeMatching';
import { parseUniversalScan } from '../utils/universalScannerParser';
import { playScannerBeep, initGlobalHardwareScannerListener, parseBarcodePayload } from '../utils/hardwareScannerBus';

export interface AutoScanReceipt {
    id: string;
    rawCode: string;
    timestamp: string;
    worker?: Employee | null;
    workerName?: string;
    workerId?: string;
    workerBadge?: string;
    crateCode?: string;
    isHarvestBox?: boolean;
    autoSavedPrevious?: {
        workerName: string;
        netWeightKg: number;
        boxCount: number;
    } | null;
    eventName?: string;
    sectorName?: string;
    actionDescription?: string;
}

interface GroupWeighItem {
    id: string;
    employeeId: string;
    employeeName: string;
    crateCode?: string;
    variety: string;
    calculatedWeight: number;
}

interface LayoutBlock {
    id: string;
    labelEn: string;
    labelKa: string;
    visible: boolean;
    size?: 'sm' | 'md' | 'lg';
}

interface InteractiveBlockContextProps {
    draggedId: string | null;
    layoutBlocks: any[];
    isKa: boolean;
    setDraggedId: (id: string | null) => void;
    setResizingBlockId: (id: string | null) => void;
    setResizeStartX: (x: number) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    getBlockSizeClass: (size: 'sm' | 'md' | 'lg' | undefined) => string;
    setLayoutBlocks: React.Dispatch<React.SetStateAction<any[]>>;
    moveBlock: (index: number, direction: 'up' | 'down') => void;
    toggleBlockVisibility: (id: string) => void;
    toggleBlockSize: (id: string) => void;
    isCustomizerOpen: boolean;
}

const InteractiveBlockContext = React.createContext<InteractiveBlockContextProps | null>(null);

interface InteractiveBlockProps {
    block: any;
    children: React.ReactNode;
    className?: string;
}

const InteractiveBlock: React.FC<InteractiveBlockProps> = ({ block, children, className = "space-y-4" }) => {
    const ctx = React.useContext(InteractiveBlockContext);
    if (!ctx) return <>{children}</>;
    
    const {
        draggedId,
        layoutBlocks,
        isKa,
        setDraggedId,
        handleTouchMove,
        getBlockSizeClass,
        setLayoutBlocks,
        moveBlock,
        toggleBlockVisibility,
        toggleBlockSize,
        isCustomizerOpen
    } = ctx;
    
    const index = layoutBlocks.findIndex(b => b.id === block.id);
    const isDragged = draggedId === block.id;
    
    return (
        <div 
            style={{ order: index }}
            data-block-id={block.id}
            onPointerEnter={() => {
                if (draggedId && draggedId !== block.id) {
                    const fromIndex = layoutBlocks.findIndex(b => b.id === draggedId);
                    const toIndex = layoutBlocks.findIndex(b => b.id === block.id);
                    if (fromIndex !== -1 && toIndex !== -1) {
                        const updated = [...layoutBlocks];
                        const [moved] = updated.splice(fromIndex, 1);
                        updated.splice(toIndex, 0, moved);
                        setLayoutBlocks(updated);
                    }
                }
            }}
            className={`relative group/block transition-all duration-200 border-2 rounded-[2rem] ${
                isDragged 
                    ? 'opacity-30 border-dashed border-indigo-500 scale-[0.98] pointer-events-none' 
                    : 'border-transparent hover:border-indigo-200/50 hover:shadow-md'
            } ${getBlockSizeClass(block.size)} ${isCustomizerOpen ? 'border-indigo-200/50 bg-slate-50/20 shadow-inner p-3' : ''} ${className}`}
        >
            {/* Unified Header Controls Bar in flow - placed beautifully inside the card flow to prevent overlapping and clipping */}
            {isCustomizerOpen && (
                <div 
                    className="flex items-center justify-between gap-2 bg-indigo-50/60 p-2 rounded-2xl border border-indigo-100/50 mb-3"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-white px-2.5 py-1 rounded-xl border border-indigo-100/50 shadow-sm">
                        {isKa ? block.labelKa : block.labelEn}
                    </div>
                    
                    <div 
                        className="flex items-center gap-1 bg-slate-950/95 p-1 rounded-xl shadow-lg border border-white/10 text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Move Up Button */}
                        <button
                            type="button"
                            disabled={index === 0}
                            onClick={(e) => {
                                e.stopPropagation();
                                moveBlock(index, 'up');
                            }}
                            className="p-1 hover:bg-white/15 text-white/70 hover:text-white rounded disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer border-0 flex items-center justify-center transition-colors"
                            title={isKa ? "ზემოთ ატანა" : "Move up"}
                        >
                            <ArrowUp size={11} className="stroke-[2.5]" />
                        </button>

                        {/* Move Down Button */}
                        <button
                            type="button"
                            disabled={index === layoutBlocks.length - 1}
                            onClick={(e) => {
                                e.stopPropagation();
                                moveBlock(index, 'down');
                            }}
                            className="p-1 hover:bg-white/15 text-white/70 hover:text-white rounded disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer border-0 flex items-center justify-center transition-colors"
                            title={isKa ? "ქვემოთ ჩამოტანა" : "Move down"}
                        >
                            <ArrowDown size={11} className="stroke-[2.5]" />
                        </button>

                        {/* Size Toggle Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleBlockSize(block.id);
                            }}
                            className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white font-black text-[9px] uppercase rounded-md cursor-pointer border-0 flex items-center justify-center min-w-[28px] tracking-tight transition-colors"
                            title={isKa ? "ზომის შეცვლა" : "Toggle size (SM / MD / LG)"}
                        >
                            {block.size || 'lg'}
                        </button>

                        {/* Hide Block Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleBlockVisibility(block.id);
                            }}
                            className="p-1 hover:bg-rose-500/25 hover:text-rose-400 text-white/70 rounded cursor-pointer transition-colors border-0 flex items-center justify-center"
                            title={isKa ? "დამალვა" : "Hide field"}
                        >
                            <EyeOff size={11} className="stroke-[2.5]" />
                        </button>

                        {/* Drag Reorder Handle */}
                        <div 
                            className="p-1 hover:bg-white/15 text-white/70 hover:text-white rounded flex items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-colors"
                            onPointerDown={(e) => {
                                setDraggedId(block.id);
                                e.currentTarget.releasePointerCapture(e.pointerId);
                            }}
                            onTouchStart={() => setDraggedId(block.id)}
                            onTouchMove={handleTouchMove}
                            title={isKa ? "გადაადგილება" : "Drag to reorder"}
                        >
                            <GripVertical size={11} className="stroke-[2.5]" />
                        </div>
                    </div>
                </div>
            )}

            {children}
        </div>
    );
};

interface WorkerSearchBlockProps {
    employeeSearch: string;
    setEmployeeSearch: (val: string) => void;
    employeeId: string;
    setEmployeeId: (val: string) => void;
    pickers: Employee[];
    t: any;
    isKa: boolean;
    scannerType: string;
    setScannerType: (type: any) => void;
    processScanCode: (code: string) => void;
    videoRefCallback: (node: HTMLVideoElement | null) => void;
    isScanning: boolean;
    allEmployees?: Employee[];
    onSetEmployees?: (employees: Employee[]) => void;
    onSetHarvestEvents?: (events: HarvestEvent[]) => void;
    harvestEvents?: HarvestEvent[];
    eventId?: string;
    onOpenScannerModal?: () => void;
}

const WorkerSearchBlock: React.FC<WorkerSearchBlockProps> = React.memo(({
    employeeSearch,
    setEmployeeSearch,
    employeeId,
    setEmployeeId,
    pickers,
    t,
    isKa,
    scannerType,
    setScannerType,
    processScanCode,
    videoRefCallback,
    isScanning,
    allEmployees = [],
    onSetEmployees,
    onSetHarvestEvents,
    harvestEvents = [],
    eventId,
    onOpenScannerModal
}) => {
    const [localQuery, setLocalQuery] = useState(employeeSearch);
    const [showPickerList, setShowPickerList] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickRegisterName, setQuickRegisterName] = useState('');
    const [quickRegisterSurname, setQuickRegisterSurname] = useState('');
    const [quickRegisterCode, setQuickRegisterCode] = useState('');

    // Keep local query in sync if parent clears it (e.g., after save) or scanner sets it
    useEffect(() => {
        setLocalQuery(employeeSearch);
        if (employeeId) {
            setShowPickerList(false);
        }
    }, [employeeSearch, employeeId]);

    // Handle click outside to close dropdown list
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowPickerList(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter pickers locally to avoid triggering heavy parent renders
    const filteredPickers = useMemo(() => {
        const query = localQuery.toLowerCase().trim();
        if (!query) return pickers;

        const matching = pickers.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.idNumber && p.idNumber.toLowerCase().includes(query)) ||
            (p.barcode && p.barcode.toLowerCase().includes(query)) ||
            (p.employeeCodeOverride && p.employeeCodeOverride.toLowerCase().includes(query))
        );

        // Sort so exact code/barcode/ID matches and prefix matches appear first
        return matching.sort((a, b) => {
            const aBar = (a.barcode || '').toLowerCase();
            const bBar = (b.barcode || '').toLowerCase();
            const aNum = (a.idNumber || '').toLowerCase();
            const bNum = (b.idNumber || '').toLowerCase();
            const aCode = (a.employeeCodeOverride || '').toLowerCase();
            const bCode = (b.employeeCodeOverride || '').toLowerCase();
            const aId = (a.id || '').toLowerCase();
            const bId = (b.id || '').toLowerCase();

            const getScore = (p: typeof a, bar: string, num: string, code: string, idStr: string) => {
                if (bar === query || num === query || code === query || idStr === query) return 1;
                if (bar.startsWith(query) || num.startsWith(query) || code.startsWith(query) || idStr.startsWith(query)) return 2;
                if (p.name.toLowerCase().startsWith(query)) return 3;
                return 4;
            };

            const scoreA = getScore(a, aBar, aNum, aCode, aId);
            const scoreB = getScore(b, bBar, bNum, bCode, bId);
            return scoreA - scoreB;
        });
    }, [pickers, localQuery]);

    // Filter HR employees that match the search query but are not in this event yet
    const additionalHrWorkers = useMemo(() => {
        if (!allEmployees) return [];
        const query = localQuery.toLowerCase().trim();
        if (!query) return [];
        return allEmployees.filter(emp => {
            const matchesQuery = emp.name.toLowerCase().includes(query) ||
                (emp.idNumber && emp.idNumber.toLowerCase().includes(query)) ||
                (emp.barcode && emp.barcode.toLowerCase().includes(query)) ||
                (emp.employeeCodeOverride && emp.employeeCodeOverride.toLowerCase().includes(query));
            
            if (!matchesQuery) return false;
            const isAlreadyInEvent = pickers.some(p => p.id === emp.id);
            return !isAlreadyInEvent;
        });
    }, [allEmployees, pickers, localQuery]);

    const handleAddWorkerToEvent = useCallback((emp: Employee) => {
        if (!eventId || !harvestEvents || !onSetHarvestEvents) return;
        const currentEvent = harvestEvents.find(e => e.id === eventId);
        if (!currentEvent) return;

        const alreadyAssigned = currentEvent.assignedPickers?.some(ap => ap.employeeId === emp.id);
        if (alreadyAssigned) return;

        const newAssignedPicker: AssignedPicker = {
            employeeId: emp.id,
            paymentModel: emp.paymentType === 'hourly' ? 'hourly' : 'per_weight',
            rate: emp.paymentRate || 0.4,
        };

        const updatedEvent: HarvestEvent = {
            ...currentEvent,
            assignedPickers: [...(currentEvent.assignedPickers || []), newAssignedPicker],
        };

        onSetHarvestEvents(harvestEvents.map(e => e.id === eventId ? updatedEvent : e));
    }, [eventId, harvestEvents, onSetHarvestEvents]);

    const handleOpenQuickRegister = () => {
        const query = localQuery.trim();
        const isNumeric = /^\d+$/.test(query);
        
        if (query.includes(' ')) {
            const parts = query.split(' ');
            setQuickRegisterName(parts[0] || '');
            setQuickRegisterSurname(parts.slice(1).join(' ') || '');
            setQuickRegisterCode('');
        } else if (isNumeric) {
            setQuickRegisterName('');
            setQuickRegisterSurname('');
            setQuickRegisterCode(query);
        } else {
            setQuickRegisterName(query);
            setQuickRegisterSurname('');
            setQuickRegisterCode('');
        }
        setShowQuickRegister(true);
    };

    const handleQuickRegisterSubmit = () => {
        if (!quickRegisterName.trim() || !quickRegisterSurname.trim()) {
            toast.error(isKa ? "გთხოვთ შეავსოთ სავალდებულო ველები" : "Please fill in all required fields");
            return;
        }

        const newEmpId = `emp-${Date.now()}`;
        const fullName = `${quickRegisterName.trim()} ${quickRegisterSurname.trim()}`.trim();
        const cleanCode = quickRegisterCode.trim();

        const newEmployee: Employee = {
            id: newEmpId,
            name: fullName,
            idNumber: cleanCode,
            employeeType: 'Seasonal',
            email: '',
            phone: '',
            roleId: '6', // Standard picker role
            paymentType: 'per_weight',
            paymentRate: 0.4,
            accountType: 'Cash',
            barcode: cleanCode ? `BC-${cleanCode}` : `BC-${Date.now()}`,
            employeeCodeOverride: cleanCode || undefined,
            status: 'active',
            joinedAt: new Date().toISOString()
        };

        // 1. Add to HR database
        if (onSetEmployees && allEmployees) {
            onSetEmployees([...allEmployees, newEmployee]);
        }

        // 2. Add to Current Harvest Event
        if (eventId && harvestEvents && onSetHarvestEvents) {
            const currentEvent = harvestEvents.find(e => e.id === eventId);
            if (currentEvent) {
                const newAssignedPicker: AssignedPicker = {
                    employeeId: newEmpId,
                    paymentModel: 'per_weight',
                    rate: 0.4,
                };
                const updatedEvent: HarvestEvent = {
                    ...currentEvent,
                    assignedPickers: [...(currentEvent.assignedPickers || []), newAssignedPicker],
                };
                onSetHarvestEvents(harvestEvents.map(e => e.id === eventId ? updatedEvent : e));
            }
        }

        // 3. Select worker in Weigh Station
        setEmployeeId(newEmpId);
        setEmployeeSearch(fullName);
        setLocalQuery(fullName);
        setShowQuickRegister(false);
        setShowPickerList(false);
        toast.success(isKa ? `დარეგისტრირდა და დაემატა: ${fullName}` : `Registered & added worker: ${fullName}`);
    };

    // Debounce the parent state update so parent doesn't re-render on every keystroke
    const debouncedSetSearch = useMemo(() => {
        let timeoutId: NodeJS.Timeout;
        return (val: string) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setEmployeeSearch(val);
            }, 180);
        };
    }, [setEmployeeSearch]);

    const handleInputChange = (val: string) => {
        setLocalQuery(val);
        setShowPickerList(true);
        debouncedSetSearch(val);
    };

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <div className="relative group">
                {employeeId ? (
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none z-10">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-600 font-black text-xs">👤</span>
                    </div>
                ) : (
                    <SearchIcon className="h-4 w-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" />
                )}
                <input
                    type="text"
                    value={localQuery}
                    onChange={e => handleInputChange(e.target.value)}
                    onFocus={() => setShowPickerList(true)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const query = localQuery.trim();
                            if (query) {
                                setShowPickerList(false);
                                processScanCode(query);
                            } else if (employeeId) {
                                window.dispatchEvent(new CustomEvent('weigh-station-commit'));
                            } else {
                                toast.error(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? "გთხოვთ აირჩიოთ მუშა!" : "Please select a worker!");
                            }
                        }
                    }}
                    className={`w-full pl-12 pr-48 sm:pr-56 py-4 rounded-[1rem] outline-none font-bold transition-all text-sm text-left ${
                        employeeId 
                            ? 'bg-emerald-50/40 border-2 border-emerald-400 text-slate-900 shadow-xs' 
                            : 'bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white'
                    }`}
                    placeholder={t('weigh.search_name')}
                />
                {localQuery && (
                    <button
                        type="button"
                        onClick={() => {
                            setLocalQuery('');
                            setEmployeeSearch('');
                            setEmployeeId('');
                        }}
                        className="absolute right-44 sm:right-52 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
                        title={isKa ? "გასუფთავება" : "Clear"}
                    >
                        <X size={14} />
                    </button>
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {onOpenScannerModal && (
                        <button
                            type="button"
                            onClick={onOpenScannerModal}
                            className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all flex items-center gap-1.5 px-2.5 sm:px-3 border border-slate-700 shadow-sm cursor-pointer"
                            title={isKa ? "სკანერის ფანჯრის გახსნა (USB / კამერა / ტესტი)" : "Open Scanner Pop-up (USB / Camera / Test)"}
                        >
                            <ScanLine className="h-4 w-4 text-emerald-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
                                {isKa ? "სკანერი" : "Scanner"}
                            </span>
                        </button>
                    )}
                    <label 
                        className="p-2 bg-white text-slate-600 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer border border-slate-200"
                        title="Upload QR Photo"
                    >
                        <span className="text-[9px] font-bold px-1">+Photo</span>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={async e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    try {
                                        toast.loading("Scanning image QR...");
                                        const { processQrImageFile } = await import('../utils/qrFileScanner');
                                        const code = await processQrImageFile(file);
                                        toast.dismiss();
                                        processScanCode(code);
                                        toast.success("QR read from photo.");
                                    } catch (err: any) {
                                        toast.dismiss();
                                        toast.error(err.message || "Failed to read QR");
                                    }
                                }
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => setScannerType(scannerType === 'camera' ? 'manual' : 'camera')}
                        className={`p-2 rounded-xl transition-colors flex items-center gap-2 pr-4 border cursor-pointer ${
                            scannerType === 'camera' 
                                ? 'bg-emerald-600 text-white border-emerald-500' 
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100'
                        }`}
                    >
                        <CameraIcon className="h-4 w-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
                            {scannerType === 'camera' ? "Camera Active" : t('weigh.scan_qr')}
                        </span>
                    </button>
                </div>
            </div>

            {showPickerList && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-slate-100 rounded-[1.5rem] shadow-2xl z-[6000] max-h-96 overflow-y-auto"
                >
                    {/* Quick Register Persistent Button */}
                    <button
                        type="button"
                        onClick={handleOpenQuickRegister}
                        className="w-full text-left px-6 py-4 hover:bg-emerald-50 bg-emerald-50/20 border-b border-slate-100 transition-colors flex items-center justify-between group"
                    >
                        <div className="flex flex-col items-start">
                            <span className="font-extrabold text-emerald-600 text-xs uppercase tracking-wider">
                                {isKa ? "➕ ახალი მუშის სწრაფი რეგისტრაცია" : "➕ Quick Register & Add New Worker"}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                {localQuery ? (isKa ? `დაარეგისტრირე "${localQuery}" HR-ში` : `Register "${localQuery}" in HR`) : (isKa ? "დაარეგისტრირე ახალი თანამშრომელი" : "Register a brand new employee")}
                            </span>
                        </div>
                        <span className="text-emerald-500 group-hover:translate-x-1 transition-transform text-xs font-bold">➔</span>
                    </button>

                    {/* Section 1: Event Assigned Workers */}
                    <div className="px-6 py-2 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between">
                        <span>{isKa ? "ღონისძიების მუშები" : "Event Workers (Assigned)"}</span>
                        <span className="text-emerald-600 font-bold lowercase">{filteredPickers.length} {isKa ? "მოიძებნა" : "found"}</span>
                    </div>

                    {filteredPickers.length > 0 ? (
                        filteredPickers.slice(0, 15).map(w => (
                            <button
                                key={w.id}
                                type="button"
                                onClick={() => {
                                    setEmployeeId(w.id);
                                    setEmployeeSearch(w.name);
                                    setLocalQuery(w.name);
                                    setShowPickerList(false);
                                }}
                                className="w-full text-left px-6 py-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors group flex items-center justify-between"
                            >
                                <div className="flex flex-col items-start text-left">
                                    <div className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                                        👤 {w.name}
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Assigned to this event" />
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 group-hover:text-indigo-400">
                                        QR / BC: {w.barcode || 'N/A'} {w.employeeCodeOverride ? `| Code: ${w.employeeCodeOverride}` : ''}
                                    </div>
                                </div>
                                <span className="text-slate-300 group-hover:text-indigo-500 transition-colors text-xs font-bold">Select</span>
                            </button>
                        ))
                    ) : (
                        <div className="px-6 py-4 text-xs text-slate-400 italic font-semibold">
                            {isKa ? "ამ ღონისძიებაზე მუშა არ მოიძებნა" : "No assigned workers match the search query"}
                        </div>
                    )}

                    {/* Section 2: Other HR Employees (Registered but not in event) */}
                    {allEmployees && (
                        <>
                            <div className="px-6 py-2 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider border-t border-slate-100 flex justify-between">
                                <span>{isKa ? "სხვა თანამშრომლები (HR)" : "Other Employees (HR)"}</span>
                                <span className="text-indigo-600 font-bold lowercase">{additionalHrWorkers.length} {isKa ? "მოიძებნა" : "found"}</span>
                            </div>

                            {additionalHrWorkers.length > 0 ? (
                                additionalHrWorkers.slice(0, 10).map(w => (
                                    <div
                                        key={w.id}
                                        className="w-full px-6 py-3 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-indigo-50/20 transition-colors"
                                    >
                                        <div className="flex flex-col items-start text-left">
                                            <div className="font-bold text-slate-700 text-sm">👤 {w.name}</div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                {w.employeeCodeOverride || w.barcode || w.idNumber || 'No ID'}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddWorkerToEvent(w);
                                                setEmployeeId(w.id);
                                                setEmployeeSearch(w.name);
                                                setLocalQuery(w.name);
                                                setShowPickerList(false);
                                                toast.success(isKa ? `დაემატა ღონისძიებაში: ${w.name}` : `Added to Event: ${w.name}`);
                                            }}
                                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer border-0 shadow-sm"
                                        >
                                            {isKa ? "➕ დამატება" : "➕ Add to Event"}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="px-6 py-4 text-xs text-slate-400 italic font-semibold">
                                    {isKa ? "სხვა შესაბამისი მუშა HR-ში არ მოიძებნა" : "No other HR workers found matching search"}
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            )}

            <AnimatePresence>
                {showQuickRegister && (
                    <div className="fixed inset-0 bg-slate-950/80 z-[9000] flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden text-left"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg">
                                        {isKa ? "ახალი მუშის რეგისტრაცია" : "Quick Worker Registration"}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">
                                        {isKa ? "მუშა დაემატება HR-ში და მიმდინარე ღონისძიებაში" : "Worker will be registered in HR & added to this event"}
                                    </p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setShowQuickRegister(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                                        {isKa ? "სახელი" : "First Name"} <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="text"
                                        value={quickRegisterName}
                                        onChange={e => setQuickRegisterName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleQuickRegisterSubmit();
                                            }
                                        }}
                                        placeholder={isKa ? "მაგ. გიორგი" : "e.g. Giorgi"}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none font-bold text-sm text-slate-800"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                                        {isKa ? "გვარი" : "Last Name"} <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="text"
                                        value={quickRegisterSurname}
                                        onChange={e => setQuickRegisterSurname(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleQuickRegisterSubmit();
                                            }
                                        }}
                                        placeholder={isKa ? "მაგ. ნიშნიანიძე" : "e.g. Nishnianidze"}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none font-bold text-sm text-slate-800"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                                        {isKa ? "პირადი ნომერი / QR კოდი (არასავალდებულო)" : "ID Number / QR Badge (Optional)"}
                                    </label>
                                    <input 
                                        type="text"
                                        value={quickRegisterCode}
                                        onChange={e => setQuickRegisterCode(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleQuickRegisterSubmit();
                                            }
                                        }}
                                        placeholder={isKa ? "მაგ. 01024083726 ან 102" : "e.g. 01024083726 or 102"}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none font-bold text-sm text-slate-800 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setShowQuickRegister(false)}
                                    className="flex-1 py-3 border border-slate-200 text-slate-700 bg-white rounded-xl hover:bg-slate-100 font-bold text-sm transition-colors cursor-pointer"
                                >
                                    {isKa ? "გაუქმება" : "Cancel"}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleQuickRegisterSubmit}
                                    disabled={!quickRegisterName.trim() || !quickRegisterSurname.trim()}
                                    className="flex-1 py-3 text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-md shadow-emerald-500/10"
                                >
                                    {isKa ? "რეგისტრაცია & დამატება" : "Register & Add"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {scannerType === 'camera' && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mt-4 bg-slate-900 text-white rounded-[2rem] p-5 border border-slate-800 shadow-2xl overflow-hidden flex flex-col relative"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400">
                                {isKa ? 'ცოცხალი კამერა' : 'Live Camera QR Feed'}
                            </h3>
                            <p className="text-[8px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">
                                {isKa ? 'მიუშვირეთ QR კოდს' : 'Hold badge QR code inside the guidelines'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setScannerType('manual')}
                            className="text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                        >
                            {isKa ? 'გამორთვა' : 'Close'}
                        </button>
                    </div>

                    <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-800">
                        {isScanning ? (
                            <>
                                <video
                                    ref={videoRefCallback}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                {/* Scanning Overlay effect */}
                                <div className="absolute inset-0 border-[30px] border-black/40 pointer-events-none">
                                    <div className="absolute inset-0 border-2 border-emerald-500 rounded-xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500/50 animate-scan pointer-events-none shadow-[0_0_12px_3px_rgba(16,185,129,0.5)]"></div>
                                    </div>
                                </div>
                                {/* Center target crosshair */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-16 h-16 border-2 border-emerald-400/30 rounded-full animate-pulse flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 p-4">
                                <Camera className="w-8 h-8 animate-pulse text-indigo-400" />
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-center text-slate-400">
                                    {isKa ? 'კამერა ირთვება...' : 'Initializing Camera stream...'}
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => {
                                // Find any worker with a barcode to simulate scanning them
                                const match = pickers.find(p => p.barcode);
                                if (match) {
                                    processScanCode(match.barcode);
                                    toast.success(`Demo Scan: ${match.name}`);
                                } else {
                                    processScanCode('DEMO_PICKER_123');
                                    toast.success("Demo Picker Code Scanned!");
                                }
                            }}
                            className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white rounded-xl transition-all font-bold text-[9px] uppercase tracking-widest text-center border border-slate-700 active:scale-95 cursor-pointer"
                        >
                            {isKa ? 'დემო სკანირება' : 'Simulate Scan'}
                        </button>
                        <label className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-bold text-[9px] uppercase tracking-widest text-center border border-indigo-500 cursor-pointer active:scale-95">
                            {isKa ? 'ფოტოს ატვირთვა' : 'Upload Photo'}
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        try {
                                            toast.loading(isKa ? "სურათი მოწმდება..." : "Analyzing photo...");
                                            const { processQrImageFile } = await import('../utils/qrFileScanner');
                                            const code = await processQrImageFile(file);
                                            toast.dismiss();
                                            processScanCode(code);
                                            toast.success(isKa ? "QR კოდი წარმატებით წაიკითხა!" : "QR read successfully from photo!");
                                        } catch (err: any) {
                                            toast.dismiss();
                                            toast.error(err.message || (isKa ? "QR კოდის წაკითხვა ვერ მოხერხდა" : "Could not decode QR code from photo."));
                                        }
                                    }
                                }}
                            />
                        </label>
                    </div>
                </motion.div>
            )}
        </div>
    );
});

const OptimizedWeightInput: React.FC<{
    weight: number | '';
    isReverseMode: boolean;
    operatingMode: 'weigh' | 'box' | 'group';
    defaultBoxWeightKg?: number;
    onChange: (val: number | '') => void;
    onSave: () => void;
    setStandardWeightPerBox: (val: number) => void;
    t: any;
}> = React.memo(({
    weight,
    isReverseMode,
    operatingMode,
    defaultBoxWeightKg,
    onChange,
    onSave,
    setStandardWeightPerBox,
    t
}) => {
    const [localVal, setLocalVal] = useState<string>(weight === '' ? '' : String(weight));

    // Update local val when parent's weight state updates (e.g., cleared, default filled, or scale updates)
    // ONLY update if structurally different, to avoid interrupting decimal entries or typing transitions
    useEffect(() => {
        const parsedLocal = localVal === '' ? '' : parseFloat(localVal);
        if (weight !== parsedLocal) {
            setLocalVal(weight === '' ? '' : String(weight));
        }
    }, [weight]);

    const onChangeRef = useRef(onChange);
    const setStandardWeightPerBoxRef = useRef(setStandardWeightPerBox);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        setStandardWeightPerBoxRef.current = setStandardWeightPerBox;
    }, [setStandardWeightPerBox]);

    const debouncedOnChange = useMemo(() => {
        let timeoutId: NodeJS.Timeout;
        return (val: number | '') => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                onChangeRef.current(val);
                if (operatingMode === 'box' && typeof val === 'number') {
                    setStandardWeightPerBoxRef.current(val);
                }
            }, 120);
        };
    }, [operatingMode]);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        setLocalVal(text);
        
        const parsed = text === '' ? '' : parseFloat(text);
        if (text === '' || !isNaN(parsed as number)) {
            debouncedOnChange(parsed);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const parsed = localVal === '' ? '' : parseFloat(localVal);
            onChangeRef.current(parsed);
            if (operatingMode === 'box' && typeof parsed === 'number') {
                setStandardWeightPerBoxRef.current(parsed);
            }
            onSave();
        }
    };

    return (
        <div className="flex items-center justify-center gap-3 w-full" onClick={e => e.stopPropagation()}>
            <input 
                type="number" 
                step="0.01" 
                value={localVal} 
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                className="w-48 py-2 text-7xl font-black text-center bg-transparent text-emerald-400 border-0 outline-none placeholder:text-slate-800 caret-white font-mono"
                placeholder={operatingMode === 'box' ? (defaultBoxWeightKg?.toString() || "0.00") : "0.00"}
                required 
                autoFocus
            />
            
            {/* Little Save Button inside layout */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    const parsed = localVal === '' ? '' : parseFloat(localVal);
                    onChange(parsed);
                    if (operatingMode === 'box' && typeof parsed === 'number') {
                        setStandardWeightPerBox(parsed);
                    }
                    onSave();
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer border-0"
                title={(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? "მონაცემის შენახვა" : "Save Entry"}
            >
                <SaveIcon className="h-6 w-6 stroke-[3]" />
            </button>
        </div>
    );
});

interface WeighStationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (entry: Omit<HarvestEntry, 'id'>) => void;
    eventId: string;
    pickers: Employee[];
    packagingItems: InventoryItem[];
    varieties: string[]; 
    defaultBoxWeightKg?: number;
    initialVariety?: string;
    hardwareDevices?: any[];
    protocol?: number;
    entries?: HarvestEntry[];
    currentUser?: User | null;
    onDeleteEntry?: (id: string) => void;
    sectors?: AreaPlantationFeature[];
    allSectors?: AreaPlantationFeature[];
    allEmployees?: Employee[];
    onSetEmployees?: (employees: Employee[]) => void;
    onSetHarvestEvents?: (events: HarvestEvent[]) => void;
    harvestEvents?: HarvestEvent[];
}

const WeighStationModal: React.FC<WeighStationModalProps> = React.memo(({ 
    isOpen, onClose, onSave, eventId, pickers, packagingItems, varieties, 
    defaultBoxWeightKg, initialVariety, hardwareDevices = [], protocol,
    entries = [], currentUser = null, onDeleteEntry, sectors = [], allSectors = [],
    allEmployees = [], onSetEmployees, onSetHarvestEvents, harvestEvents = []
}) => {
    const { t } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    const isWeigher = useMemo(() => {
        if (!currentUser) return false;
        const userRoleStr = (currentUser.role || '').toLowerCase();
        const rolesList = (currentUser.roles || []).map(r => r.toLowerCase());
        return userRoleStr === 'weigher' || rolesList.includes('weigher') || rolesList.includes('worker') || rolesList.includes('guest') || rolesList.includes('daily worker');
    }, [currentUser]);

    const formatCleanWeight = useCallback((val: number): string => {
        if (typeof val !== 'number' || isNaN(val)) return '0';
        if (val >= 1000) {
            const kVal = val / 1000;
            if (val % 1000 === 0) {
                return kVal.toFixed(0) + 'k';
            } else if (val % 100 === 0) {
                return kVal.toFixed(1) + 'k';
            } else if (val % 10 === 0) {
                return kVal.toFixed(2) + 'k';
            }
            return kVal.toFixed(3) + 'k';
        }
        if (val % 1 === 0) {
            return val.toFixed(0);
        }
        return val.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d+?)0+$/, '$1');
    }, []);

    const totalEventNetWeight = useMemo(() => {
        return entries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
    }, [entries]);

    const totalEventGrossWeight = useMemo(() => {
        return entries.reduce((sum, e) => sum + (e.grossWeightKg || 0), 0);
    }, [entries]);

    const sendboxData = useMemo(() => {
        const workerMap = new Map<string, { 
            employeeId: string; 
            employeeName: string; 
            totalNetWeight: number; 
            totalGrossWeight: number;
            totalBoxes: number; 
            lastScannedAt: string; 
            lastEntryId: string;
            workerEntries: (HarvestEntry & { employeeName: string })[];
        }>();
        
        // Fast Map index of pickers
        const pickerLookup = new Map<string, string>();
        pickers.forEach(p => pickerLookup.set(p.id, p.name));
        if (allEmployees && allEmployees.length > 0) {
            allEmployees.forEach(p => { if (!pickerLookup.has(p.id)) pickerLookup.set(p.id, p.name); });
        }

        entries.forEach(entry => {
            const employeeName = pickerLookup.get(entry.employeeId) || (entry as any).employeeName || (isKa ? 'უცნობი მუშა' : 'Unknown Worker');
            const entryWithWorker = { ...entry, employeeName };
            const scannedTime = entry.scannedAt || '';

            const current = workerMap.get(entry.employeeId) || { 
                employeeId: entry.employeeId, 
                employeeName, 
                totalNetWeight: 0, 
                totalGrossWeight: 0,
                totalBoxes: 0, 
                lastScannedAt: scannedTime, 
                lastEntryId: entry.id,
                workerEntries: [] 
            };

            current.totalNetWeight += (entry.netWeightKg || 0);
            current.totalGrossWeight += (entry.grossWeightKg || 0);
            current.totalBoxes += (entry.boxCount || 1);
            current.workerEntries.push(entryWithWorker);

            if (scannedTime >= current.lastScannedAt) {
                current.lastScannedAt = scannedTime;
                current.lastEntryId = entry.id;
            }

            workerMap.set(entry.employeeId, current);
        });

        // Sort worker entries latest first
        workerMap.forEach(group => {
            group.workerEntries.sort((a, b) => (b.scannedAt || '').localeCompare(a.scannedAt || ''));
        });
        
        return Array.from(workerMap.values()).sort((a, b) => (b.lastScannedAt || '').localeCompare(a.lastScannedAt || ''));
    }, [entries, pickers, allEmployees, isKa]);

    // Sendbox Grouped vs Flat View & Drilldown Modal states
    const [sendboxViewMode, setSendboxViewMode] = useState<'grouped' | 'flat'>('grouped');
    const [drilldownWorkerId, setDrilldownWorkerId] = useState<string | null>(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [editNetWeight, setEditNetWeight] = useState<string>('');
    const [editGrossWeight, setEditGrossWeight] = useState<string>('');
    const [editBoxCount, setEditBoxCount] = useState<string>('1');
    const [editVariety, setEditVariety] = useState<string>('');

    const [employeeSearch, setEmployeeSearch] = useState('');
    const [employeeId, setEmployeeId] = useState<string>('');
    const [clearWorkerAfterSave, setClearWorkerAfterSave] = useState(false);
    const [packagingItemId, setPackagingItemId] = useState<string>('');
    const [grossWeightKg, setGrossWeightKg] = useState<number | ''>('');
    const [isReverseMode, setIsReverseMode] = useState<boolean>(() => {
        const ev = harvestEvents?.find(e => e.id === eventId);
        return ev?.isReverseMode ?? false;
    });
    const [directNetWeightKg, setDirectNetWeightKg] = useState<number | ''>('');
    const lastWeightRef = useRef<number | ''>('');
    const [ticketId, setTicketId] = useState<string>('');
    const [manualBoxCount, setManualBoxCount] = useState<number | '' | null>(null);
    const [selectedVariety, setSelectedVariety] = useState<string>(initialVariety || (varieties && varieties.length === 1 ? varieties[0] : ''));
    const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);
    const [isInventoryExpanded, setIsInventoryExpanded] = useState<boolean>(false);
    const [isHalfBox, setIsHalfBox] = useState<boolean>(false);
    const [isWithPunets, setIsWithPunets] = useState<boolean>(true);
    const [halfBoxPunets, setHalfBoxPunets] = useState<number>(6);

    // New entry state for worker drilldown modal
    const [isAddingNewEntryInDrilldown, setIsAddingNewEntryInDrilldown] = useState<boolean>(false);
    const [drilldownReverseMode, setDrilldownReverseMode] = useState<boolean>(false);
    const [newEntryNet, setNewEntryNet] = useState<string>('');
    const [newEntryGross, setNewEntryGross] = useState<string>('');
    const [newEntryBoxes, setNewEntryBoxes] = useState<string>('1');

    // Sector Selection States
    const [selectedSectorId, setSelectedSectorId] = useState<string>(() => {
        return sectors && sectors.length > 0 ? sectors[0].id : '';
    });
    const [isSectorPopupOpen, setIsSectorPopupOpen] = useState<boolean>(false);
    const [sectorSearchQuery, setSectorSearchQuery] = useState<string>('');

    useEffect(() => {
        if (isOpen && sectors && sectors.length > 0 && !selectedSectorId) {
            setSelectedSectorId(sectors[0].id);
        }
    }, [isOpen]);

    const [operatingMode, setOperatingMode] = useState<'weigh' | 'box' | 'group'>('weigh');
    const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
    
    const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>(() => {
        const saved = localStorage.getItem('weigh-station-layout-v1');
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as LayoutBlock[];
                const defaultIds = ['mode_settings', 'inventory_section', 'scanner_method', 'variety_package', 'worker_search', 'input_selector_tab', 'weight_workspace', 'live_sendbox', 'field_sector'];
                const parsedIds = parsed.map(b => b.id);
                
                const missing: LayoutBlock[] = [
                    { id: 'mode_settings', labelEn: 'Mode Switches & Settings', labelKa: 'რეჟიმები და პარამეტრები', visible: true, size: 'md' as const },
                    { id: 'inventory_section', labelEn: 'Inventory / RFID Link', labelKa: 'ინვენტარი / RFID კავშირი', visible: true, size: 'md' as const },
                    { id: 'scanner_method', labelEn: 'Scanning & Input Method', labelKa: 'სკანირების და შეყვანის მეთოდი', visible: true, size: 'md' as const },
                    { id: 'variety_package', labelEn: 'Variety & Package Fields', labelKa: 'ჯიშის და შეფუთვის ველები', visible: true, size: 'md' as const },
                    { id: 'worker_search', labelEn: 'Worker Search & Badge QR', labelKa: 'მუშის ძებნა და QR კოდი', visible: true, size: 'lg' as const },
                    { id: 'input_selector_tab', labelEn: 'Keyboard/Pen Method Selector', labelKa: 'შეყვანის რეჟიმის სელექტორი', visible: true, size: 'lg' as const },
                    { id: 'weight_workspace', labelEn: 'Live Weigh Stream & Drawing Board', labelKa: 'გადაწონვის და ხატვის დაფა', visible: true, size: 'lg' as const },
                    { id: 'live_sendbox', labelEn: 'Live Sendbox (Recent Scans)', labelKa: 'ბოლო გატარებები (Live)', visible: true, size: 'lg' as const },
                    { id: 'field_sector', labelEn: 'Field Sector Selection', labelKa: 'სექტორის/უბნის არჩევა', visible: true, size: 'md' as const },
                ].filter(b => !parsedIds.includes(b.id));

                const active = parsed.filter(b => defaultIds.includes(b.id));
                return [...active, ...missing].map(b => ({ ...b, size: b.size || 'lg' }));
            } catch (e) {
                // fall through
            }
        }
        return [
            { id: 'mode_settings', labelEn: 'Mode Switches & Settings', labelKa: 'რეჟიმები და პარამეტრები', visible: true, size: 'md' as const },
            { id: 'inventory_section', labelEn: 'Inventory / RFID Link', labelKa: 'ინვენტარი / RFID კავშირი', visible: true, size: 'md' as const },
            { id: 'scanner_method', labelEn: 'Scanning & Input Method', labelKa: 'სკანირების და შეყვანის მეთოდი', visible: true, size: 'md' as const },
            { id: 'variety_package', labelEn: 'Variety & Package Fields', labelKa: 'ჯიშის და შეფუთვის ველები', visible: true, size: 'md' as const },
            { id: 'worker_search', labelEn: 'Worker Search & Badge QR', labelKa: 'მუშის ძებნა და QR კოდი', visible: true, size: 'lg' as const },
            { id: 'input_selector_tab', labelEn: 'Keyboard/Pen Method Selector', labelKa: 'შეყვანის რეჟიმის სელექტორი', visible: true, size: 'lg' as const },
            { id: 'weight_workspace', labelEn: 'Live Weigh Stream & Drawing Board', labelKa: 'გადაწონვის და ხატვის დაფა', visible: true, size: 'lg' as const },
            { id: 'live_sendbox', labelEn: 'Live Sendbox (Recent Scans)', labelKa: 'ბოლო გატარებები (Live)', visible: true, size: 'lg' as const },
            { id: 'field_sector', labelEn: 'Field Sector Selection', labelKa: 'სექტორის/უბნის არჩევა', visible: true, size: 'md' as const },
        ];
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem('weigh-station-layout-v1', JSON.stringify(layoutBlocks));
        }, 1000);
        return () => clearTimeout(timer);
    }, [layoutBlocks]);

    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
    const [resizeStartX, setResizeStartX] = useState<number>(0);

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!draggedId) return;
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!element) return;
        
        const blockEl = element.closest('[data-block-id]');
        if (blockEl) {
            const targetId = blockEl.getAttribute('data-block-id');
            if (targetId && targetId !== draggedId) {
                const fromIndex = layoutBlocks.findIndex(b => b.id === draggedId);
                const toIndex = layoutBlocks.findIndex(b => b.id === targetId);
                if (fromIndex !== -1 && toIndex !== -1) {
                    const updated = [...layoutBlocks];
                    const [moved] = updated.splice(fromIndex, 1);
                    updated.splice(toIndex, 0, moved);
                    setLayoutBlocks(updated);
                }
            }
        }
    };

    useEffect(() => {
        if (!resizingBlockId) return;

        const handlePointerMove = (e: PointerEvent) => {
            const block = layoutBlocks.find(b => b.id === resizingBlockId);
            if (!block) return;

            const deltaX = e.clientX - resizeStartX;
            const currentSize = block.size || 'lg';
            
            let nextSize: 'sm' | 'md' | 'lg' = currentSize;
            if (currentSize === 'sm') {
                if (deltaX > 120) {
                    nextSize = 'lg';
                } else if (deltaX > 40) {
                    nextSize = 'md';
                }
            } else if (currentSize === 'md') {
                if (deltaX > 80) {
                    nextSize = 'lg';
                } else if (deltaX < -40) {
                    nextSize = 'sm';
                }
            } else if (currentSize === 'lg') {
                if (deltaX < -120) {
                    nextSize = 'sm';
                } else if (deltaX < -40) {
                    nextSize = 'md';
                }
            }

            if (nextSize !== currentSize) {
                setLayoutBlocks(prev => prev.map(b => b.id === resizingBlockId ? { ...b, size: nextSize } : b));
                setResizeStartX(e.clientX);
            }
        };

        const handlePointerUp = () => {
            setResizingBlockId(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [resizingBlockId, resizeStartX, layoutBlocks]);

    useEffect(() => {
        if (!draggedId) return;

        const handlePointerUp = () => {
            setDraggedId(null);
        };

        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [draggedId]);



    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= layoutBlocks.length) return;
        const updated = [...layoutBlocks];
        const temp = updated[index];
        updated[index] = updated[nextIndex];
        updated[nextIndex] = temp;
        setLayoutBlocks(updated);
        toast.success(
            (t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka')
                ? 'განყოფილების პოზიცია შეიცვალა'
                : 'Section reordered successfully'
        );
    };

    const toggleBlockVisibility = (id: string) => {
        setLayoutBlocks(prev => prev.map(block => {
            if (block.id === id) {
                const nextVisibility = !block.visible;
                const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
                const name = isKa ? block.labelKa : block.labelEn;
                const statusStr = nextVisibility 
                    ? (isKa ? 'გამოჩნდა' : 'is now visible') 
                    : (isKa ? 'დაიმალა' : 'is now hidden');
                toast.success(`${name} ${statusStr}`);
                return { ...block, visible: nextVisibility };
            }
            return block;
        }));
    };

    const toggleBlockSize = (id: string) => {
        setLayoutBlocks(prev => prev.map(block => {
            if (block.id === id) {
                const sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
                const currentIdx = sizes.indexOf(block.size || 'lg');
                const nextSize = sizes[(currentIdx + 1) % sizes.length];
                const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
                const name = isKa ? block.labelKa : block.labelEn;
                const sizeLabel = nextSize === 'sm' ? (isKa ? 'მცირე (1/3)' : 'Small (1/3)') : nextSize === 'md' ? (isKa ? 'საშუალო (1/2)' : 'Medium (1/2)') : (isKa ? 'დიდი (სრული)' : 'Large (Full)');
                toast.success(`${name}: ${sizeLabel}`);
                return { ...block, size: nextSize };
            }
            return block;
        }));
    };

    const resetLayout = () => {
        setLayoutBlocks([
            { id: 'mode_settings', labelEn: 'Mode Switches & Settings', labelKa: 'რეჟიმები და პარამეტრები', visible: true, size: 'md' },
            { id: 'inventory_section', labelEn: 'Inventory / RFID Link', labelKa: 'ინვენტარი / RFID კავშირი', visible: true, size: 'md' },
            { id: 'scanner_method', labelEn: 'Scanning & Input Method', labelKa: 'სკანირების და შეყვანის მეთოდი', visible: true, size: 'md' },
            { id: 'variety_package', labelEn: 'Variety & Package Fields', labelKa: 'ჯიშის და შეფუთვის ველები', visible: true, size: 'md' },
            { id: 'worker_search', labelEn: 'Worker Search & Badge QR', labelKa: 'მუშის ძებნა და QR კოდი', visible: true, size: 'lg' },
            { id: 'input_selector_tab', labelEn: 'Keyboard/Pen Method Selector', labelKa: 'შეყვანის რეჟიმის სელექტორი', visible: true, size: 'lg' },
            { id: 'weight_workspace', labelEn: 'Live Weigh Stream & Drawing Board', labelKa: 'გადაწონვის და ხატვის დაფა', visible: true, size: 'lg' },
            { id: 'live_sendbox', labelEn: 'Live Sendbox (Recent Scans)', labelKa: 'ბოლო გატარებები (Live)', visible: true, size: 'lg' },
        ]);
        toast.success(
            (t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka')
                ? 'განლაგება აღდგა საწყისზე'
                : 'Layout reset to defaults'
        );
    };

    const getBlockSizeClass = (size: 'sm' | 'md' | 'lg' | undefined) => {
        if (size === 'sm') return 'col-span-1 md:col-span-2 lg:col-span-2';
        if (size === 'md') return 'col-span-1 md:col-span-3 lg:col-span-3';
        return 'col-span-1 md:col-span-6 lg:col-span-6';
    };

    const [scannerType, setScannerType] = useState<'manual' | 'hardware' | 'camera'>(() => {
        return (localStorage.getItem('weigh-scanner-type') as 'manual' | 'hardware' | 'camera') || 'manual';
    });
    const [boxQuantity, setBoxQuantity] = useState<number | ''>(1);
    const [standardWeightPerBox, setStandardWeightPerBox] = useState<number | string>(defaultBoxWeightKg || 0);

    const [groupItems, setGroupItems] = useState<GroupWeighItem[]>([]);
    const [groupActualWeight, setGroupActualWeight] = useState<string>('');
    const [groupStandardBoxWeight, setGroupStandardBoxWeight] = useState<number | string>(defaultBoxWeightKg || 10.00);

    const lastScanRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });
    const kbTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastQrScanAttemptRef = useRef<number>(0);
    const scanCycleRef = useRef<number>(0);

    const [crateCode, setCrateCode] = useState<string>('');


    const playChime = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        } catch (e) {
            console.warn("Failed to play audio chime", e);
        }
    };

    const playBuzzer = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(140, audioCtx.currentTime);
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(143, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);
            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + 0.6);
            osc2.stop(audioCtx.currentTime + 0.6);
        } catch (e) {
            console.warn("Failed to play buzzer", e);
        }
    };

    const handleClose = useCallback(() => {
        stopScanner();
        onClose();
    }, [onClose]);




    // Format Relative Scanned Times
    const getRelativeTimeStr = useCallback((scannedAtStr: string) => {
        const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
        try {
            const diffMs = Date.now() - new Date(scannedAtStr).getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) {
                return isKa ? "ახლახან" : "Just now";
            }
            return isKa ? `${diffMins} წუთის წინ` : `${diffMins}m ago`;
        } catch (e) {
            return '';
        }
    }, [t]);

    const formatScannedTime = useCallback((isoStr: string) => {
        try {
            const d = new Date(isoStr);
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch (e) {
            return '';
        }
    }, []);

    // Get historical records inside event sorted latest first (optimized O(1) rendering)
    const lastIndividualEntries = useMemo(() => {
        if (!entries || entries.length === 0) return [];
        
        // 1. Sort the raw array first (very lightweight, no nested loops or Date object allocations)
        const sortedRaw = [...entries].sort((a, b) => {
            const sA = a.scannedAt || '';
            const sB = b.scannedAt || '';
            if (sA < sB) return 1;
            if (sA > sB) return -1;
            return 0;
        });

        // 2. Slice to the latest 25 entries (only what's ever displayed on screen)
        const slicedRaw = sortedRaw.slice(0, 25);

        // 3. Perform O(1) Map lookups for picker names
        const pickerLookup = new Map<string, string>();
        pickers.forEach(p => {
            pickerLookup.set(p.id, p.name);
        });

        return slicedRaw.map(entry => {
            const name = pickerLookup.get(entry.employeeId) || 'Unknown';
            return {
                ...entry,
                employeeName: name,
            };
        });
    }, [entries, pickers]);

    // Sync if prop changes
    useEffect(() => {
        if (defaultBoxWeightKg !== undefined) {
             setStandardWeightPerBox(defaultBoxWeightKg);
        }
    }, [defaultBoxWeightKg]);
    const [qrScannerConnected, setQrScannerConnected] = useState(hardwareDevices.some(d => d.type === 'scanner' && d.status === 'online'));
    const [weightScaleConnected, setWeightScaleConnected] = useState(hardwareDevices.some(d => d.type === 'scale' && d.status === 'online'));
    const [availableDevices, setAvailableDevices] = useState<any[]>([]); // To show list from Labs

    // Sync with initialVariety if provided
    useEffect(() => {
        if (initialVariety) {
            setSelectedVariety(initialVariety);
        }
    }, [initialVariety]);

    // Sync operatingMode based on event protocol
    useEffect(() => {
        if (isOpen) {
            if (protocol === 8 || protocol === 2) {
                setOperatingMode('group');
            } else if (protocol === 3) {
                setOperatingMode('box');
            } else {
                setOperatingMode('weigh');
            }
        }
    }, [isOpen, protocol]);

    const prevVariety = useRef<string>(selectedVariety);

    const tareWeight = useMemo(() => {
        const item = packagingItems.find(p => p.id === packagingItemId);
        return item?.avgTareWeightKg || 0;
    }, [packagingItemId, packagingItems]);

    // Auto-fill weight logic
    useEffect(() => {
        const isVarietyChanged = prevVariety.current !== selectedVariety;
        
        if (selectedVariety && defaultBoxWeightKg) {
            const currentDefault = (defaultBoxWeightKg + tareWeight);
            // Auto-fill if empty OR if the variety actually changed (to pick up new default)
            if (grossWeightKg === '' || isVarietyChanged) {
                setGrossWeightKg(currentDefault);
                if (isVarietyChanged) {
                    setStabilityCounter(0); // Reset stability on variety change
                }
            }
        }
        prevVariety.current = selectedVariety;
    }, [selectedVariety, defaultBoxWeightKg, tareWeight]);
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
    const [stabilityCounter, setStabilityCounter] = useState(0);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const isScanningRef = useRef(false);
    const scanBuffer = useRef<string>('');
    const scannedQRCodesRef = useRef<Set<string>>(new Set());
    const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
    const [activeScanReceipt, setActiveScanReceipt] = useState<AutoScanReceipt | null>(null);
    const [isScanReceiptOpen, setIsScanReceiptOpen] = useState(false);
    const isScanReceiptOpenRef = useRef(false);
    useEffect(() => {
        isScanReceiptOpenRef.current = isScanReceiptOpen;
    }, [isScanReceiptOpen]);
    const autoCloseReceiptTimerRef = useRef<NodeJS.Timeout | null>(null);

    // References to triggerSave and current weigh state for auto-saving previous entry upon scan
    const triggerSaveRef = useRef<() => void>(() => {});
    const currentWeighStateRef = useRef({
        employeeId: '',
        employeeSearch: '',
        grossWeightKg: '' as number | '',
        directNetWeightKg: '' as number | '',
        isReverseMode: false,
        operatingMode: 'weigh',
        boxQuantity: 1 as number | '',
        defaultBoxWeightKg: 0,
        netWeight: 0,
        calculatedBoxCount: 1,
        tareWeight: 0.4
    });

    const handleAddWorkerToEvent = useCallback((emp: Employee) => {
        if (!eventId || !harvestEvents || !onSetHarvestEvents) return;
        const currentEvent = harvestEvents.find(e => e.id === eventId);
        if (!currentEvent) return;

        const alreadyAssigned = currentEvent.assignedPickers?.some(ap => ap.employeeId === emp.id);
        if (alreadyAssigned) return;

        const newAssignedPicker: AssignedPicker = {
            employeeId: emp.id,
            paymentModel: emp.paymentType === 'hourly' ? 'hourly' : 'per_weight',
            rate: emp.paymentRate || 0.4,
        };

        const updatedEvent: HarvestEvent = {
            ...currentEvent,
            assignedPickers: [...(currentEvent.assignedPickers || []), newAssignedPicker],
        };

        onSetHarvestEvents(harvestEvents.map(e => e.id === eventId ? updatedEvent : e));
    }, [eventId, harvestEvents, onSetHarvestEvents]);

    const processScanCode = useCallback((code: string) => {
        if (!code || typeof code !== 'string') return;
        const normalizedCode = code.trim();
        const upperCode = normalizedCode.toUpperCase();

        const now = Date.now();
        // Precision Cooldown Window (Debounce Check - 600ms prevents bounce while allowing rapid next scan)
        if (normalizedCode === lastScanRef.current.code && (now - lastScanRef.current.timestamp) < 600) {
            console.log("Duplicate scan debounced:", normalizedCode);
            return;
        }
        lastScanRef.current = { code: normalizedCode, timestamp: now };

        // 1. Auto-save last entry if previous worker had weight entered / registered on scale
        let autoSavedPrevious: AutoScanReceipt['autoSavedPrevious'] = null;
        const {
            employeeId: prevEmpId,
            employeeSearch: prevEmpSearch,
            grossWeightKg: prevGross,
            directNetWeightKg: prevDirectNet,
            isReverseMode: prevReverse,
            operatingMode: prevMode,
            boxQuantity: prevQty,
            defaultBoxWeightKg: prevDefaultBox,
            netWeight: prevNet,
            calculatedBoxCount: prevBoxCount,
            tareWeight: prevTare
        } = currentWeighStateRef.current;

        if (prevEmpId) {
            const qty = prevQty === '' ? 1 : prevQty;
            const finalNet = prevMode === 'box'
                ? ((typeof prevGross === 'number' ? prevGross : (prevDefaultBox || 0)) * qty)
                : (prevReverse
                    ? (typeof prevDirectNet === 'number' ? prevDirectNet : 0)
                    : prevNet
                  );

            if (typeof finalNet === 'number' && finalNet > 0) {
                const prevWorker = (pickers || []).find(p => p.id === prevEmpId) || (allEmployees || []).find(e => e.id === prevEmpId);
                autoSavedPrevious = {
                    workerName: prevWorker?.name || prevEmpSearch || 'Worker',
                    netWeightKg: finalNet,
                    boxCount: typeof prevBoxCount === 'number' ? prevBoxCount : 1
                };
                try {
                    triggerSaveRef.current();
                    toast.success(
                        isKa 
                            ? `💾 წინა ჩანაწერი შენახულია: ${autoSavedPrevious.workerName} (${finalNet.toFixed(2)} კგ)`
                            : `💾 Last entry saved: ${autoSavedPrevious.workerName} (${finalNet.toFixed(2)} kg)`
                    );
                } catch (err) {
                    console.error('Auto-save last entry error:', err);
                }
            }
        }

        const universalParsed = parseUniversalScan(normalizedCode, allEmployees, [], 'auto');

        // Check if harvest box QR is scanned
        const isHarvestBox = universalParsed.detectedType === 'harvest_box' && Boolean(universalParsed.harvestBox);
        const boxCode = isHarvestBox 
            ? (universalParsed.harvestBox!.uniqueCode || universalParsed.harvestBox!.crateCode || normalizedCode).toUpperCase()
            : upperCode;

        // Duplicate QR scan check (for QR codes/crates/RFIDs - excluding worker cards)
        const isWorkerCode = !isHarvestBox && Boolean(universalParsed.detectedType === 'worker' || universalParsed.employee || findMatchingEmployee(pickers, normalizedCode) || findMatchingEmployee(allEmployees, normalizedCode));
        
        if (!isWorkerCode && (scannedQRCodesRef.current.has(boxCode) || (entries || []).some(e => e.crateCode?.toUpperCase() === boxCode || e.ticketId?.toUpperCase() === boxCode))) {
            toast.warning(isKa ? `⚠️ QR კოდი უკვე დასკანერებულია! (${boxCode})` : `⚠️ QR Code already scanned! (${boxCode})`, {
                description: isKa ? 'მითითებული ყუთის კოდი უკვე დარეგისტრირებულია ბაზაში (დუბლიკატი დაბლოკილია).' : 'This crate QR code is already registered in database (duplicate prevented).'
            });
            return;
        }

        // Mapped worker from harvest box QR
        const mappedWorker = isHarvestBox
            ? (universalParsed.employee || (universalParsed.harvestBox?.pickerId
                ? (findMatchingEmployee(pickers, universalParsed.harvestBox.pickerId) || findMatchingEmployee(allEmployees, universalParsed.harvestBox.pickerId))
                : null))
            : null;

        // Determine target worker from mapping, parsed result, or fuzzy search
        const { cleanCode } = parseBarcodePayload(normalizedCode);
        let targetWorker: Employee | undefined = mappedWorker || universalParsed.employee;
        if (!targetWorker) {
            targetWorker = findMatchingEmployee(pickers, normalizedCode) || 
                           findMatchingEmployee(allEmployees, normalizedCode) ||
                           findMatchingEmployee(pickers, cleanCode) || 
                           findMatchingEmployee(allEmployees, cleanCode);
        }
        if (!targetWorker && normalizedCode.startsWith('PRE_BIND_')) {
            const bindId = normalizedCode.replace('PRE_BIND_', '');
            targetWorker = findMatchingEmployee(pickers, bindId) || findMatchingEmployee(allEmployees, bindId);
        }

        // If employee is found, ensure registered in allEmployees & event, and drop into search field!
        if (targetWorker) {
            if (onSetEmployees && allEmployees && !allEmployees.some(e => e.id === targetWorker!.id)) {
                onSetEmployees([...allEmployees, targetWorker!]);
            }
            handleAddWorkerToEvent(targetWorker);
            setEmployeeId(targetWorker.id);
            setEmployeeSearch(targetWorker.name);
        }

        if (operatingMode === 'group') {
            if (targetWorker && !isHarvestBox) {
                // Try to assign worker name to the first slot that has no picker assigned
                setGroupItems(prev => {
                    const idx = prev.findIndex(item => !item.employeeId);
                    if (idx !== -1) {
                        const copy = [...prev];
                        copy[idx] = {
                            ...copy[idx],
                            employeeId: targetWorker!.id,
                            employeeName: targetWorker!.name
                        };
                        return copy;
                    }
                    return [
                        ...prev,
                        {
                            id: Math.random().toString(),
                            employeeId: targetWorker!.id,
                            employeeName: targetWorker!.name,
                            crateCode: '',
                            variety: selectedVariety || varieties?.[0] || '',
                            calculatedWeight: Number(groupStandardBoxWeight) || 0
                        }
                    ];
                });
            } else if (isHarvestBox) {
                setGroupItems(prev => {
                    const idx = prev.findIndex(item => !item.crateCode);
                    if (idx !== -1) {
                        const copy = [...prev];
                        copy[idx] = { 
                            ...copy[idx], 
                            crateCode: boxCode,
                            ...(targetWorker ? { employeeId: targetWorker.id, employeeName: targetWorker.name } : {}),
                            ...(universalParsed.harvestBox?.weight ? { calculatedWeight: universalParsed.harvestBox.weight } : {})
                        };
                        return copy;
                    }
                    return [
                        ...prev,
                        {
                            id: Math.random().toString(),
                            employeeId: targetWorker ? targetWorker.id : '',
                            employeeName: targetWorker ? targetWorker.name : '',
                            crateCode: boxCode,
                            variety: selectedVariety || varieties?.[0] || '',
                            calculatedWeight: universalParsed.harvestBox?.weight || Number(groupStandardBoxWeight) || 0
                        }
                    ];
                });
                scannedQRCodesRef.current.add(boxCode);
            } else {
                setGroupItems(prev => {
                    const idx = prev.findIndex(item => !item.crateCode);
                    if (idx !== -1) {
                        const copy = [...prev];
                        copy[idx] = { ...copy[idx], crateCode: code };
                        return copy;
                    }
                    return [
                        ...prev,
                        {
                            id: Math.random().toString(),
                            employeeId: '',
                            employeeName: '',
                            crateCode: code,
                            variety: selectedVariety || varieties?.[0] || '',
                            calculatedWeight: Number(groupStandardBoxWeight) || 0
                        }
                    ];
                });
                scannedQRCodesRef.current.add(upperCode);
            }
        } else {
            // --- Single Weigh Mode ---
            if (isHarvestBox) {
                setCrateCode(boxCode);
                scannedQRCodesRef.current.add(boxCode);
                if (universalParsed.harvestBox?.weight && universalParsed.harvestBox.weight > 0) {
                    if (isReverseMode) {
                        setDirectNetWeightKg(universalParsed.harvestBox.weight);
                    } else {
                        setGrossWeightKg(universalParsed.harvestBox.weight);
                    }
                    setStabilityCounter(2);
                }
            } else if (!targetWorker) {
                // Unrecognized code captured as crate code
                setCrateCode(normalizedCode);
                scannedQRCodesRef.current.add(upperCode);
            }
        }

        // Construct Receipt Data for the automatic pop-up window
        const currentEvent = (harvestEvents || []).find(e => e.id === eventId);
        const currentSector = (sectors || []).find(s => s.id === selectedSectorId);
        const evName = universalParsed.harvestBox?.harvestEventName || currentEvent?.name || (isKa ? 'ივლისის მოსავალი' : 'July Harvesting');
        const badge = targetWorker?.barcode || targetWorker?.idNumber || targetWorker?.employeeCodeOverride || (targetWorker?.id ? targetWorker.id.replace(/^emp-/i, '') : '122');
        const role = (targetWorker as any)?.roleId || targetWorker?.employeeType || 'picker';

        const receipt: AutoScanReceipt = {
            id: `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            rawCode: normalizedCode,
            timestamp: new Date().toLocaleTimeString(),
            worker: targetWorker || null,
            workerName: targetWorker?.name || (isHarvestBox ? (universalParsed.harvestBox?.pickerName || (isKa ? 'დაუკავშირებელი ყუთი' : 'Unmapped Box')) : normalizedCode),
            workerId: targetWorker?.id || '',
            workerBadge: badge,
            crateCode: isHarvestBox || !targetWorker ? boxCode : undefined,
            isHarvestBox: isHarvestBox,
            autoSavedPrevious: autoSavedPrevious,
            eventName: evName,
            sectorName: currentSector?.name,
            actionDescription: targetWorker
                ? (isKa ? `ჩასმულია ძებნის ველში & არჩეულია: ${targetWorker.name}` : `Dropped into search field & selected: ${targetWorker.name}`)
                : (isKa ? `დარეგისტრირდა ყუთი: ${boxCode}` : `Registered crate: ${boxCode}`)
        };

        playScannerBeep('success');

        // Automatically open pop-up window; if old one is already open, close old and open new!
        if (autoCloseReceiptTimerRef.current) {
            clearTimeout(autoCloseReceiptTimerRef.current);
        }

        if (isScanReceiptOpen) {
            setIsScanReceiptOpen(false);
            setTimeout(() => {
                setActiveScanReceipt(receipt);
                setIsScanReceiptOpen(true);
            }, 120);
        } else {
            setActiveScanReceipt(receipt);
            setIsScanReceiptOpen(true);
        }

        // Auto-close countdown (4.5 seconds)
        autoCloseReceiptTimerRef.current = setTimeout(() => {
            setIsScanReceiptOpen(false);
        }, 4500);

        if (targetWorker) {
            toast.success(
                isKa 
                    ? `✓ სკანირებულია: ${targetWorker.name} (${badge} ${role})` 
                    : `✓ Scanned: ${targetWorker.name} (${badge} ${role})`
            );
        } else if (isHarvestBox) {
            toast.success(isKa ? `✓ ყუთი დარეგისტრირდა: ${boxCode}` : `✓ Crate Registered: ${boxCode}`);
        } else {
            toast.success(`Crate / Tag: ${normalizedCode}`);
        }
    }, [pickers, allEmployees, onSetEmployees, handleAddWorkerToEvent, onSave, operatingMode, groupItems, groupStandardBoxWeight, selectedVariety, varieties, t, isKa, isReverseMode, directNetWeightKg, grossWeightKg, entries, eventId, harvestEvents, sectors, selectedSectorId, isScanReceiptOpen]);

    const calculatedBoxCount = useMemo(() => {
        if (operatingMode === 'box') {
            return boxQuantity === '' ? 1 : boxQuantity;
        }
        if (manualBoxCount !== null && manualBoxCount !== '') {
            return manualBoxCount;
        }
        if (isReverseMode && Number(standardWeightPerBox) > 0) {
            const net = typeof directNetWeightKg === 'number' ? directNetWeightKg : 0;
            if (net > 0) {
                let count = Math.round(net / Number(standardWeightPerBox));
                if (count === 0) count = 1;
                return count || 1;
            }
        }
        if (operatingMode === 'weigh' && Number(standardWeightPerBox) > 0) {
             const gross = typeof grossWeightKg === 'number' ? grossWeightKg : 0;
             const individualBoxGross = Number(standardWeightPerBox) + tareWeight;
             if (individualBoxGross > 0 && gross > 0) {
                 let count = Math.round(gross / individualBoxGross);
                 if (count === 0) count = 1;
                 return count || 1;
             }
        }
        return 1;
    }, [operatingMode, isReverseMode, boxQuantity, grossWeightKg, directNetWeightKg, standardWeightPerBox, tareWeight, manualBoxCount]);

    const handleWeightChange = useCallback((val: number | '') => {
        setManualBoxCount(null);
        if (isReverseMode) {
            setDirectNetWeightKg(val);
        } else {
            setGrossWeightKg(val);
        }
    }, [isReverseMode]);

    const netWeight = useMemo(() => {
        if (operatingMode === 'box') {
            const unitWeight = typeof grossWeightKg === 'number' ? grossWeightKg : (defaultBoxWeightKg || 0);
            const qty = boxQuantity === '' ? 1 : boxQuantity;
            return unitWeight * qty;
        }
        if (isReverseMode) {
            return typeof directNetWeightKg === 'number' ? directNetWeightKg : 0;
        }
        const gross = typeof grossWeightKg === 'number' ? grossWeightKg : 0;
        return Math.max(0, gross - (tareWeight * calculatedBoxCount));
    }, [grossWeightKg, directNetWeightKg, tareWeight, operatingMode, boxQuantity, defaultBoxWeightKg, calculatedBoxCount, isReverseMode]);

    useEffect(() => {
        currentWeighStateRef.current = {
            employeeId,
            employeeSearch,
            grossWeightKg,
            directNetWeightKg,
            isReverseMode,
            operatingMode,
            boxQuantity,
            defaultBoxWeightKg,
            netWeight,
            calculatedBoxCount,
            tareWeight
        };
    }, [employeeId, employeeSearch, grossWeightKg, directNetWeightKg, isReverseMode, operatingMode, boxQuantity, defaultBoxWeightKg, netWeight, calculatedBoxCount, tareWeight]);

    // Internal save handler
    const triggerSave = useCallback(() => {
        if (!employeeId) {
            toast.error(
                t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                    ? "გთხოვთ ჯერ აირჩიოთ მუშა!"
                    : "Please select a worker first!"
            );
            return;
        }
        
        const qty = boxQuantity === '' ? 1 : boxQuantity;
        const finalNetWeight = operatingMode === 'box'
            ? ((typeof grossWeightKg === 'number' ? grossWeightKg : (defaultBoxWeightKg || 0)) * qty)
            : (isReverseMode
                ? (typeof directNetWeightKg === 'number' ? directNetWeightKg : 0)
                : netWeight
              );

        const finalGrossWeight = operatingMode === 'box' 
            ? ((typeof grossWeightKg === 'number' ? grossWeightKg : (Number(standardWeightPerBox) || 0)) + tareWeight) * qty
            : (isReverseMode 
                ? (finalNetWeight + (tareWeight * calculatedBoxCount))
                : (typeof grossWeightKg === 'number' ? grossWeightKg : 0)
              );

        if (typeof finalNetWeight !== 'number' || finalNetWeight <= 0 || finalGrossWeight <= 0) {
            toast.error(
                t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                    ? "გთხოვთ მიუთითოთ ვალიდური წონა (0-ზე მეტი)!"
                    : "Please enter a valid weight (greater than 0)!"
            );
            return;
        }
        
        const storedDevId = localStorage.getItem('agrimap-device-id') || (() => {
            const newId = `dev-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`;
            localStorage.setItem('agrimap-device-id', newId);
            return newId;
        })();
        const nowStr = new Date().toISOString();
        const localConfigSaved = localStorage.getItem('agrimap-local-config');
        let isLocalNodeActive = false;
        try { if (localConfigSaved) isLocalNodeActive = JSON.parse(localConfigSaved).isLocalMode; } catch(e){}
        const isOfflineForSync = localStorage.getItem('agrimap-manual-offline') === 'true' || isLocalNodeActive || !navigator.onLine;

        const calculatedPunetCount = isWithPunets 
            ? (isHalfBox ? halfBoxPunets : (calculatedBoxCount * 12)) 
            : 0;

        const activeUser = getStoredActiveUser();

        const targetEntry: Omit<HarvestEntry, 'id'> = {
            harvestEventId: eventId,
            employeeId,
            scannedAt: nowStr,
            grossWeightKg: finalGrossWeight,
            tareWeightKg: tareWeight * calculatedBoxCount,
            netWeightKg: finalNetWeight,
            packagingItemId: packagingItemId || '',
            ticketId,
            variety: selectedVariety,
            boxCount: calculatedBoxCount,
            isHalfBox: isHalfBox,
            punetCount: calculatedPunetCount,
            hasPunets: isWithPunets,
            deviceId: storedDevId,
            offlineTimestamp: nowStr,
            syncedAt: isOfflineForSync ? undefined : nowStr,
            crateCode: crateCode || undefined,
            sectorId: selectedSectorId || undefined,
            scannedBy: activeUser.name,
            createdBy: activeUser.name,
            scannedByUserName: activeUser.name
        } as any;

        onSave(targetEntry);

        // Auto-assign worker to current event if not already assigned
        if (eventId && harvestEvents && onSetHarvestEvents && employeeId) {
            const currentEvent = harvestEvents.find(e => e.id === eventId);
            if (currentEvent && !currentEvent.assignedPickers?.some(ap => ap.employeeId === employeeId)) {
                const emp = allEmployees.find(e => e.id === employeeId);
                const empRoleName = emp?.roleId || 'Picker';
                const newAssignedPicker: AssignedPicker = {
                    employeeId: employeeId,
                    paymentModel: emp?.paymentType === 'hourly' ? 'hourly' : 'per_weight',
                    rate: emp?.paymentRate || 0.4,
                    assignedRole: empRoleName
                };
                const updatedEvent: HarvestEvent = {
                    ...currentEvent,
                    assignedPickers: [...(currentEvent.assignedPickers || []), newAssignedPicker]
                };
                onSetHarvestEvents(harvestEvents.map(e => e.id === eventId ? updatedEvent : e));
            }
        }
        
        setLastSavedMessage(`Saved ${finalNetWeight.toFixed(2)}kg`);
        setTimeout(() => setLastSavedMessage(null), 1500);
        
        setManualBoxCount(null);
        
        if (operatingMode === 'weigh') {
            if (isReverseMode) {
                setDirectNetWeightKg('');
            } else {
                setGrossWeightKg('');
            }
        }
        
        if (clearWorkerAfterSave) {
            setEmployeeId('');
            setEmployeeSearch('');
        }
        
        setTicketId('');
        setIsHalfBox(false);
        setStabilityCounter(0);
        setCrateCode('');
    }, [employeeId, packagingItemId, grossWeightKg, directNetWeightKg, isReverseMode, eventId, netWeight, tareWeight, ticketId, selectedVariety, onSave, operatingMode, boxQuantity, standardWeightPerBox, defaultBoxWeightKg, clearWorkerAfterSave, calculatedBoxCount, isHalfBox, crateCode, manualBoxCount]);

    triggerSaveRef.current = triggerSave;

    const updateGroupItem = useCallback((id: string, updates: Partial<GroupWeighItem>) => {
        setGroupItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, ...updates };
                if (updates.employeeId) {
                    const matched = pickers.find(p => p.id === updates.employeeId);
                    if (matched) {
                        updated.employeeName = matched.name;
                    }
                }
                return updated;
            }
            return item;
        }));
    }, [pickers]);

    const removeGroupItem = useCallback((id: string) => {
        setGroupItems(prev => prev.filter(item => item.id !== id));
        toast.info("Item removed from group batch.");
    }, []);

    const commitGroupWeighing = useCallback(() => {
        if (groupItems.length === 0) {
            toast.error(
                t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                    ? "გთხოვთ ჯერ დაასკანეროთ ან დაამატოთ ყუთები!"
                    : "Please scan or add at least one box!"
            );
            return;
        }

        // Validate all have assigned pickers
        const missingPickers = groupItems.some(item => !item.employeeId);
        if (missingPickers) {
            toast.error(
                t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                    ? "ყველა ყუთს უნდა ჰყავდეს არჩეული მუშა!"
                    : "Please make sure all boxes have an assigned worker!"
            );
            return;
        }

        const nowStr = new Date().toISOString();
        const localConfigSaved = localStorage.getItem('agrimap-local-node-config');
        let isLocalNodeActive = false;
        try { if (localConfigSaved) isLocalNodeActive = JSON.parse(localConfigSaved).isLocalMode; } catch(e){}
        const isOfflineForSync = localStorage.getItem('agrimap-manual-offline') === 'true' || isLocalNodeActive || !navigator.onLine;

        // Proportional distribution calculations
        const totalActualWeight = parseFloat(groupActualWeight) || 0;
        const totalBoxes = groupItems.length;
        const distributedWeight = totalActualWeight > 0 ? (totalActualWeight / totalBoxes) : (Number(groupStandardBoxWeight) || 0);

        let savedCount = 0;
        groupItems.forEach(item => {
            if (!item.employeeId) return;

            const activeUser = getStoredActiveUser();
            const targetEntry: Omit<HarvestEntry, 'id'> = {
                harvestEventId: eventId,
                employeeId: item.employeeId,
                packagingItemId: packagingItemId || '',
                scannedAt: nowStr,
                grossWeightKg: distributedWeight + (tareWeight || 0.00),
                netWeightKg: distributedWeight,
                tareWeightKg: tareWeight || 0.00,
                ticketId: ticketId || '',
                variety: item.variety || selectedVariety || varieties?.[0] || '',
                boxCount: 1,
                isHalfBox: false,
                deviceId: localStorage.getItem('agrimap-device-id') || 'weigh-station-group',
                offlineTimestamp: nowStr,
                syncedAt: isOfflineForSync ? undefined : nowStr,
                crateCode: item.crateCode || undefined,
                scannedBy: activeUser.name,
                createdBy: activeUser.name,
                scannedByUserName: activeUser.name
            } as any;
            onSave(targetEntry);
            savedCount++;
        });

        if (savedCount > 0) {
            toast.success(
                t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka'
                    ? `წარმატებით შეინახა ${savedCount} ყუთი ჯგუფურად!`
                    : `Successfully saved ${savedCount} boxes in group!`
            );
            setGroupItems([]);
            setGroupActualWeight('');
        }
    }, [groupItems, groupActualWeight, groupStandardBoxWeight, tareWeight, eventId, ticketId, selectedVariety, varieties, onSave, t, packagingItemId]);

    const lastTapRef = useRef<number>(0);
    const handleWeightDisplayClick = () => {
        const now = Date.now();
        if (now - lastTapRef.current < 350) { // Fast, touch-friendly double-tap within 350ms
            const activeWeightEntered = isReverseMode ? directNetWeightKg : grossWeightKg;
            if (employeeId && (typeof activeWeightEntered === 'number' || operatingMode === 'box')) {
                triggerSave();
            } else {
                toast.error("Please ensure worker and weight are entered first.");
            }
        }
        lastTapRef.current = now;
    };

    // Auto-save logic (Stability Check)
    useEffect(() => {
        const activeWeight = isReverseMode ? directNetWeightKg : grossWeightKg;
        if (!isAutoSaveEnabled || typeof activeWeight !== 'number' || activeWeight <= 0 || !employeeId) {
            setStabilityCounter(0);
            return;
        }

        if (activeWeight === lastWeightRef.current && activeWeight > 0) {
            const timer = setTimeout(() => {
                setStabilityCounter(prev => prev + 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            lastWeightRef.current = activeWeight;
            setStabilityCounter(0);
        }
    }, [grossWeightKg, directNetWeightKg, isReverseMode, isAutoSaveEnabled, employeeId]);

    useEffect(() => {
        if (stabilityCounter >= 2) { // 2 seconds of stability
            triggerSave();
        }
    }, [stabilityCounter, triggerSave]);

    useEffect(() => {
        const handleCommit = () => {
            if (operatingMode === 'group') {
                commitGroupWeighing();
            } else {
                triggerSave();
            }
        };
        window.addEventListener('weigh-station-commit', handleCommit);
        return () => window.removeEventListener('weigh-station-commit', handleCommit);
    }, [operatingMode, commitGroupWeighing, triggerSave]);

    // Bluetooth / HID Scanner & Global Enter Keyboard Listener
    useEffect(() => {
        initGlobalHardwareScannerListener();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape' && isScanReceiptOpenRef.current) {
                if (autoCloseReceiptTimerRef.current) clearTimeout(autoCloseReceiptTimerRef.current);
                setIsScanReceiptOpen(false);
                return;
            }
            
            if (e.key === 'Enter') {
                const code = scanBuffer.current.trim();
                scanBuffer.current = '';
                if (kbTimeoutRef.current) clearTimeout(kbTimeoutRef.current);
                if (code) {
                    processScanCode(code);
                    return;
                }

                if (isSectorPopupOpen) {
                    return;
                }

                // If user is inside an input/textarea (other than weight input) that has text, process on Enter
                const target = e.target as HTMLElement;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                    const input = target as HTMLInputElement;
                    const val = input.value?.trim();
                    if (val && !input.classList.contains('weight-main-input')) {
                        processScanCode(val);
                        return;
                    }
                    if (!input.classList.contains('weight-main-input') && input.type !== 'number') {
                        return;
                    }
                }

                // Pressing Enter key saves the weight entry or commits group weighing
                e.preventDefault();
                if (operatingMode === 'group') {
                    commitGroupWeighing();
                } else {
                    triggerSave();
                }
            } else if (e.key.length === 1 && !isScanning) {
                // Buffer printable keys regardless of manual/hardware tab selection
                const target = e.target as HTMLElement;
                if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) {
                    scanBuffer.current += e.key;
                }
            }
            
            if (kbTimeoutRef.current) {
                clearTimeout(kbTimeoutRef.current);
            }
            kbTimeoutRef.current = setTimeout(() => {
                scanBuffer.current = '';
            }, 600);
        };

        const handleHardwareScan = (e: any) => {
            // Prioritize raw code so unstripped full JSON payloads and strings remain intact
            const code = e.detail?.raw || e.detail?.code;
            if (code) {
                processScanCode(code);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('agrimap:hardware_scan', handleHardwareScan);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('agrimap:hardware_scan', handleHardwareScan);
            if (kbTimeoutRef.current) {
                clearTimeout(kbTimeoutRef.current);
            }
        };
    }, [isOpen, isScanning, scannerType, processScanCode, isSectorPopupOpen, operatingMode, commitGroupWeighing, triggerSave]);

    const stopScanner = () => {
        isScanningRef.current = false;
        setIsScanning(false);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameRef.current) {
            clearTimeout(animationFrameRef.current as any);
            cancelAnimationFrame(animationFrameRef.current as any);
            animationFrameRef.current = null;
        }
    };

    const scanStateRef = useRef({ operatingMode, protocol, pickers, groupItems, processScanCode });
    useEffect(() => {
        scanStateRef.current = { operatingMode, protocol, pickers, groupItems, processScanCode };
    }, [operatingMode, protocol, pickers, groupItems, processScanCode]);

    const handleScanLoop = useCallback(() => {
        if (!streamRef.current || !isScanningRef.current) {
            return;
        }
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(handleScanLoop);
            return;
        }

        const now = Date.now();
        // 60ms interval (approx 16 FPS decoding rate) for hyper-responsive real-time feedback
        if (now - lastQrScanAttemptRef.current >= 60) {
            lastQrScanAttemptRef.current = now;

            const video = videoRef.current;
            if (!qrCanvasRef.current) {
                qrCanvasRef.current = document.createElement('canvas');
            }
            const canvas = qrCanvasRef.current;

            // Downscale to 320px width to decrease pixel count 4x and make decoding ~1.5ms on low-end tablets
            const targetWidth = 320;
            const videoW = video.videoWidth || 640;
            const videoH = video.videoHeight || 480;
            const ratio = targetWidth / videoW;
            const scanWidth = targetWidth;
            const scanHeight = Math.round(videoH * ratio);

            if (canvas.width !== scanWidth || canvas.height !== scanHeight) {
                canvas.width = scanWidth;
                canvas.height = scanHeight;
            }

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, scanWidth, scanHeight);
                
                const foundCodes: string[] = [];
                try {
                    const imgData = ctx.getImageData(0, 0, scanWidth, scanHeight);
                    const res = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
                    if (res?.data) {
                        foundCodes.push(res.data);
                    }
                } catch (e) {
                    // ignore errors
                }

                if (foundCodes.length > 0) {
                    const { operatingMode: currentMode, protocol: currentProtocol, pickers: currentPickers, groupItems: currentGroupItems, processScanCode: currentProcessScanCode } = scanStateRef.current;
                    foundCodes.forEach(c => {
                        // Check if already scanned to avoid rescanning in group mode
                        const picker = currentPickers.find(p => p.id === c || p.barcode === c || p.idNumber === c || (p.employeeCodeOverride && p.employeeCodeOverride === c));
                        const isAlreadyScanned = picker && currentGroupItems.some(item => item.employeeId === picker.id);
                        
                        if (!isAlreadyScanned) {
                            currentProcessScanCode(c);
                        }
                    });

                    // If we are in standard single-scan modes, we stop the scanner
                    if (currentMode !== 'group' && currentProtocol !== 8) {
                        stopScanner();
                        return;
                    }
                }
            }
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(handleScanLoop);
    }, []);

    const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as any).current = node;
        if (node && streamRef.current) {
            node.srcObject = streamRef.current;
            node.onloadedmetadata = () => {
                node.play().then(() => {
                    if (animationFrameRef.current) {
                        cancelAnimationFrame(animationFrameRef.current);
                    }
                    animationFrameRef.current = requestAnimationFrame(handleScanLoop);
                }).catch(err => {
                    console.error("Video play failed on callback ref:", err);
                });
            };
        }
    }, [handleScanLoop]);

    const startScanner = async () => {
        try {
            isScanningRef.current = true;
            setIsScanning(true);
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Secure Context Required: Browsers block camera access on insecure HTTP local connections. Access via HTTPS or localhost to enable, or adjust browser flags.");
            }
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            } catch (envErr) {
                console.warn("Environment camera not found or locked, falling back to default.", envErr);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current!.play().then(() => {
                        if (animationFrameRef.current) {
                            cancelAnimationFrame(animationFrameRef.current);
                        }
                        animationFrameRef.current = requestAnimationFrame(handleScanLoop);
                    }).catch(err => {
                        console.error("Video play failed inside startScanner:", err);
                    });
                };
            }
        } catch (err) {
            console.error("Camera access failed:", err);
            isScanningRef.current = false;
            setIsScanning(false);
            const errorMsg = err instanceof Error ? err.message : String(err);
            toast.error("Camera Access Failed", {
                description: errorMsg.includes("Secure Context") 
                    ? `${errorMsg} (Tip: In Chrome on your tablet, go to chrome://flags/#unsafely-treat-insecure-origin-as-secure, add "http://${window.location.hostname}:${window.location.port || '3000'}" and enable it to bypass this block!)`
                    : `${errorMsg}. If you are in an iframe, try opening the app in a new tab.`,
                duration: 12000,
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            localStorage.setItem('weigh-scanner-type', scannerType);
            if (scannerType === 'camera') {
                startScanner();
            } else {
                stopScanner();
            }
        } else {
            stopScanner();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, scannerType]);

    if (!isOpen) return null;

    return (
        <InteractiveBlockContext.Provider value={{
            draggedId,
            layoutBlocks,
            isKa,
            setDraggedId,
            setResizingBlockId,
            setResizeStartX,
            handleTouchMove,
            getBlockSizeClass,
            setLayoutBlocks,
            moveBlock,
            toggleBlockVisibility,
            toggleBlockSize,
            isCustomizerOpen
        }}>
            <div className="fixed inset-0 bg-slate-900/80 z-[5000] flex items-center justify-center p-0 sm:p-4 md:p-6" onClick={handleClose}>
            <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="bg-white w-full max-w-[95vw] sm:max-w-5xl lg:max-w-7xl rounded-none sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] max-h-screen text-slate-800" 
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 sm:p-8 border-b flex justify-between items-center bg-slate-900 text-white flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                            <BluetoothIcon className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight leading-none">{t('weigh.title')}</h2>
                            <p className="text-[9px] sm:text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">{t('weigh.smart_sync')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            type="button"
                            onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
                            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer border ${
                                isCustomizerOpen 
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-lg' 
                                    : 'bg-white/10 hover:bg-white/20 text-indigo-300 border-white/10'
                            }`}
                            title="Customize Layout & Fields"
                        >
                            <Settings className={`w-4 h-4 ${isCustomizerOpen ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline text-[9px] font-black uppercase">
                                {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'განლაგება' : 'Layout'}
                            </span>
                        </button>
                        <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-2xl transition-colors">
                            <XCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white/30" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-5 sm:space-y-6">
                    {eventId && (
                        <ActiveUsersPresenceBar harvestId={eventId} activeViewName="Weigh Station" defaultCollapsed={true} />
                    )}

                    <AnimatePresence>
                        {lastSavedMessage && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs"
                            >
                                <CheckIcon className="h-5 w-5" /> {lastSavedMessage}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Layout Customizer Panel */}
                    <AnimatePresence>
                        {isCustomizerOpen && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mb-4"
                            >
                                <div className="bg-gradient-to-br from-indigo-50/50 to-slate-50/50 border-2 border-indigo-100 rounded-[2rem] p-4 sm:p-6 space-y-4 shadow-sm text-slate-800">
                                    <div className="flex justify-between items-center border-b border-indigo-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                                                <Settings size={14} className="animate-spin-slow" />
                                            </div>
                                            <div>
                                                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'განლაგების მართვის პანელი' : 'Weigh Station Layout Manager'}
                                                </h3>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'შეცვალეთ ან დამალეთ ველები თქვენი ტაბლეტის ეკრანის მიხედვით' : 'Reorder or hide widgets to customize your tablet view'}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={resetLayout}
                                            className="px-2.5 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[8px] font-black uppercase rounded-lg tracking-widest transition-all cursor-pointer border-0"
                                        >
                                            {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'საწყისი' : 'Reset Defaults'}
                                        </button>
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {layoutBlocks.map((block, index) => {
                                            const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
                                            const label = isKa ? block.labelKa : block.labelEn;
                                            return (
                                                <div 
                                                    key={block.id} 
                                                    className={`flex items-center justify-between p-2 px-3 rounded-xl border text-xs transition-all ${
                                                        block.visible 
                                                            ? 'bg-white border-slate-200 shadow-sm' 
                                                            : 'bg-slate-50 border-slate-100 opacity-60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-mono text-slate-400 font-bold w-4">
                                                            {index + 1}.
                                                        </span>
                                                        <span className="font-bold text-[10px] sm:text-xs text-slate-700 uppercase tracking-wide">
                                                            {label}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        {/* Toggle Size */}
                                                        {block.visible && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleBlockSize(block.id)}
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[9px] uppercase rounded-lg cursor-pointer border-0 flex items-center justify-center min-w-[32px] tracking-tight"
                                                                title="Change box size (SM / MD / LG)"
                                                            >
                                                                {block.size || 'lg'}
                                                            </button>
                                                        )}

                                                        {/* Move Up */}
                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => moveBlock(index, 'up')}
                                                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded disabled:opacity-30 disabled:hover:bg-slate-100 cursor-pointer border-0 flex items-center justify-center"
                                                            title="Move up"
                                                        >
                                                            <ArrowUp size={12} className="stroke-[2.5]" />
                                                        </button>

                                                        {/* Move Down */}
                                                        <button
                                                            type="button"
                                                            disabled={index === layoutBlocks.length - 1}
                                                            onClick={() => moveBlock(index, 'down')}
                                                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded disabled:opacity-30 disabled:hover:bg-slate-100 cursor-pointer border-0 flex items-center justify-center"
                                                            title="Move down"
                                                        >
                                                            <ArrowDown size={12} className="stroke-[2.5]" />
                                                        </button>

                                                        {/* Toggle visibility */}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleBlockVisibility(block.id)}
                                                            className={`p-1 rounded cursor-pointer transition-all border-0 flex items-center justify-center ${
                                                                block.visible 
                                                                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                                                    : 'bg-rose-50 text-rose-400 hover:bg-rose-100'
                                                            }`}
                                                            title={block.visible ? "Hide field" : "Show field"}
                                                        >
                                                            {block.visible ? (
                                                                <Eye size={12} className="stroke-[2.5]" />
                                                             ) : (
                                                                <EyeOff size={12} className="stroke-[2.5]" />
                                                             )}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Dynamic Customizable Layout Workspace */}
                    <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 gap-6 items-start">
                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'mode_settings');
                            if (!block || !block.visible) return null;
                            return (
                                <InteractiveBlock block={block}>
                                    {/* Mode Switches & Settings */}
                                    <div className="space-y-4 bg-slate-50 p-4 rounded-[2rem] border border-slate-100 h-full">
                                        <div className="flex bg-slate-200 p-1.5 rounded-2xl relative">
                                            <button 
                                                onClick={() => setOperatingMode('weigh')}
                                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${operatingMode === 'weigh' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                            >
                                                {t('weigh.mode_weigh')}
                                            </button>
                                            <button 
                                                onClick={() => setOperatingMode('box')}
                                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${operatingMode === 'box' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                            >
                                                {t('weigh.mode_box')}
                                            </button>
                                            <button 
                                                onClick={() => setOperatingMode('group')}
                                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${operatingMode === 'group' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                            >
                                                {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ჯგუფური გადაწონვა' : 'Group/Pallet'}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between px-2 gap-2 flex-wrap">
                                             <div className="flex items-center gap-2">
                                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t('weigh.standard_box')}</label>
                                                 <div className="relative">
                                                     <input 
                                                         type="number"
                                                         step="0.01"
                                                         value={standardWeightPerBox}
                                                         onChange={e => setStandardWeightPerBox(e.target.value === '' ? '' : e.target.value)}
                                                         onKeyDown={e => {
                                                             if (e.key === 'Enter') {
                                                                 e.preventDefault();
                                                                 e.stopPropagation();
                                                                 triggerSave();
                                                             }
                                                         }}
                                                         className="w-16 pl-2 pr-6 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                     />
                                                     <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">KG</span>
                                                 </div>
                                             </div>
 
                                             {/* Half Box Toggle & Punets Quantity */}
                                             <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none pl-1">{t('weigh.half_box') || 'Half Box'}</label>
                                                 <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const next = !isHalfBox;
                                                        setIsHalfBox(next);
                                                        if (next) setHalfBoxPunets(6);
                                                        else setHalfBoxPunets(12);
                                                    }}
                                                    className={`w-10 h-5 rounded-full transition-all relative ${isHalfBox ? 'bg-amber-500 font-bold border border-amber-600' : 'bg-slate-300'}`}
                                                 >
                                                    <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transition-all ${isHalfBox ? 'left-6' : 'left-0.5'}`} />
                                                 </button>
                                                 {isHalfBox && (
                                                     <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200">
                                                         <span className="text-[9px] font-black text-amber-800 uppercase">{isKa ? 'პუნეტი:' : 'Punets:'}</span>
                                                         <input 
                                                             type="number"
                                                             min="1"
                                                             max="24"
                                                             value={halfBoxPunets}
                                                             onChange={e => setHalfBoxPunets(Math.max(1, parseInt(e.target.value) || 0))}
                                                             className="w-12 px-1 py-0.5 bg-white border border-amber-300 text-amber-900 rounded font-black text-xs text-center outline-none focus:ring-1 focus:ring-amber-500"
                                                         />
                                                     </div>
                                                 )}
                                             </div>

                                             {/* With Punets Toggle in Settings */}
                                             <div className="flex items-center gap-1.5 bg-slate-50 p-1 px-2 rounded-xl border border-slate-200">
                                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{isKa ? 'პუნეტები (12/ყუთი)' : 'Punets (12/box)'}</label>
                                                 <button 
                                                    type="button"
                                                    onClick={() => setIsWithPunets(!isWithPunets)}
                                                    className={`w-10 h-5 rounded-full transition-all relative ${isWithPunets ? 'bg-amber-500' : 'bg-slate-300'}`}
                                                 >
                                                    <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transition-all ${isWithPunets ? 'left-6' : 'left-0.5'}`} />
                                                 </button>
                                             </div>
 
                                             <div className="flex items-center justify-end gap-1.5 pr-1 border-slate-100">
                                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t('weigh.auto_save')}</label>
                                                 <button 
                                                    onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                                                    className={`w-10 h-5 rounded-full transition-all relative ${isAutoSaveEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                 >
                                                    <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transition-all ${isAutoSaveEnabled ? 'left-6' : 'left-0.5'}`} />
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                </InteractiveBlock>
                            );
                        })()}

                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'inventory_section');
                            if (!block || !block.visible) return null;
                            return (
                                <InteractiveBlock block={block}>
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsInventoryExpanded(!isInventoryExpanded)}
                                            className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl cursor-pointer hover:bg-indigo-100 transition-all font-black text-xs text-indigo-600 uppercase tracking-widest shadow-sm border-0"
                                        >
                                            <span>{t(isInventoryExpanded ? 'weigh.collapse_inventory' : 'weigh.expand_inventory')}</span>
                                            <div className={`transition-transform duration-300 ${isInventoryExpanded ? 'rotate-180' : ''}`}>
                                                <ChevronDown className="h-4 w-4 stroke-[3]" />
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {isInventoryExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="space-y-5 pt-1 pb-2">
                                                        {(packagingItemId === '6' || packagingItemId === '4' || packagingItemId === '1') && (
                                                            <div className="space-y-3">
                                                                <div 
                                                                    className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 p-4 sm:p-6 rounded-[2rem] flex items-center justify-between group hover:from-blue-600 hover:to-indigo-700 transition-all cursor-pointer shadow-lg hover:shadow-blue-200 active:scale-[0.98]"
                                                                    onClick={() => {
                                                                        toast.loading(t('weigh.simulating') || 'Simulating RFID Link...');
                                                                        setTimeout(() => {
                                                                            toast.dismiss();
                                                                            if (selectedVariety && packagingItemId) {
                                                                                toast.success("SMART READ SUCCESS: ID 0x4F2A-B9", {
                                                                                    description: "Asset bound to GPS Telemetry and Worker ID.",
                                                                                    icon: "📡"
                                                                                });
                                                                                if (employeeSearch === '') {
                                                                                    const randomPicker = pickers[Math.floor(Math.random() * pickers.length)];
                                                                                    if (randomPicker) {
                                                                                        setEmployeeId(randomPicker.id);
                                                                                        setEmployeeSearch(randomPicker.name);
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                toast.error("MISSING METADATA", {
                                                                                    description: "Please select variety and package specs before NFC bind."
                                                                                });
                                                                            }
                                                                        }, 1200);
                                                                    }}
                                                                >
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white group-hover:bg-white/20 rounded-2xl flex items-center justify-center text-blue-600 group-hover:text-white shadow-sm transition-all group-hover:rotate-6">
                                                                            <FingerprintIcon className="h-6 w-6" />
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-400 group-hover:text-blue-100 mb-1">
                                                                                {t('weigh.rfid_link') || 'RFID / NFC LINK'}
                                                                            </p>
                                                                            <p className="text-lg sm:text-xl font-black text-blue-900 group-hover:text-white leading-tight">
                                                                                {t('weigh.tap_scan') || 'Tap Smart Probe'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-2">
                                                                        <div className="relative">
                                                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-blue-200 group-hover:border-white/40 flex items-center justify-center">
                                                                                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 group-hover:bg-white rounded-full animate-ping" />
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[8px] sm:text-[10px] font-black text-blue-300 group-hover:text-blue-100 uppercase tracking-widest whitespace-nowrap">
                                                                            {t('weigh.awaiting_probe') || 'Awaiting Probe'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex flex-col gap-3 px-2 py-1">
                                                            <div className="flex flex-wrap items-center gap-4">
                                                                <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-orange-50 border border-orange-100">
                                                                    <div className={`w-2 h-2 rounded-full ${qrScannerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-400'}`} />
                                                                    <span className={`text-[8px] font-black uppercase tracking-widest ${qrScannerConnected ? 'text-slate-500' : 'text-yellow-600'}`}>
                                                                        {t(qrScannerConnected ? 'weigh.scanner_connected' : 'weigh.scanner_disconnected')}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-orange-50 border border-orange-100">
                                                                    <div className={`w-2 h-2 rounded-full ${weightScaleConnected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-400'}`} />
                                                                    <span className={`text-[8px] font-black uppercase tracking-widest ${weightScaleConnected ? 'text-slate-500' : 'text-yellow-600'}`}>
                                                                        {t(weightScaleConnected ? 'weigh.weight_connected' : 'weigh.weight_disconnected')}
                                                                    </span>
                                                                </div>
                                                                
                                                                {(!qrScannerConnected || !weightScaleConnected) && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest animate-pulse">
                                                                            {t('weigh.manual_mode') || 'Manual Mode (No HID)'}
                                                                        </span>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                onClose();
                                                                                window.dispatchEvent(new CustomEvent("agrimap-switch-mode", { detail: "labs" }));
                                                                            }}
                                                                            className="text-[9px] font-black text-blue-600 underline uppercase tracking-widest hover:text-blue-700 transition-colors animate-pulse whitespace-nowrap bg-transparent border-0 cursor-pointer"
                                                                        >
                                                                            {t('weigh.install_labs') || 'Install Labs Link'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                
                                                                {hardwareDevices.length > 0 && (!qrScannerConnected || !weightScaleConnected) && (
                                                                    <div className="flex items-center gap-2 ml-auto">
                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                                            {t('weigh.available')}
                                                                        </span>
                                                                        <select 
                                                                            className="bg-white border border-slate-200 rounded text-[8px] font-black uppercase p-1 min-w-[100px]"
                                                                            onChange={(e) => {
                                                                                const dev = hardwareDevices.find(d => d.id === e.target.value);
                                                                                if (dev) {
                                                                                    if (dev.type === 'scanner') setQrScannerConnected(true);
                                                                                    if (dev.type === 'scale') setWeightScaleConnected(true);
                                                                                    toast.success(`Attached to ${dev.name}`);
                                                                                }
                                                                            }}
                                                                            value=""
                                                                        >
                                                                            <option value="">{t('weigh.choose_device')}</option>
                                                                            {hardwareDevices
                                                                                .filter(d => (!qrScannerConnected && d.type === 'scanner') || (!weightScaleConnected && d.type === 'scale'))
                                                                                .map(d => (
                                                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                                                ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </InteractiveBlock>
                            );
                        })()}

                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'scanner_method');
                            if (!block || !block.visible) return null;
                            return (
                                <InteractiveBlock block={block}>
                                    <div className="bg-slate-50 border border-slate-150 p-4 sm:p-5 rounded-[2rem] space-y-4 shadow-sm h-full">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                            <div className="text-left">
                                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                                                    {isKa ? 'სკანირების / შეყვანის მეთოდი' : 'Scanning & Input Method'}
                                                </h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                                    {isKa ? 'შეცვალეთ CPU დატვირთვის შესამცირებლად' : 'Configure method to control CPU/Memory usage'}
                                                </p>
                                            </div>
                                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[8px] font-black uppercase tracking-widest self-start sm:self-center">
                                                {scannerType === 'camera' ? "Camera On" : "Offline Engine"}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setScannerType('manual')}
                                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all cursor-pointer text-center gap-1.5 ${
                                                    scannerType === 'manual'
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <Keyboard className={`w-5 h-5 ${scannerType === 'manual' ? 'text-white' : 'text-slate-400'}`} />
                                                <span className="text-[9px] font-black uppercase tracking-wider">
                                                    {isKa ? 'მექანიკური' : 'Manual'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setScannerType('hardware')}
                                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all cursor-pointer text-center gap-1.5 ${
                                                    scannerType === 'hardware'
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <QrCodeIcon className={`w-5 h-5 ${scannerType === 'hardware' ? 'text-white' : 'text-slate-400'}`} />
                                                <span className="text-[9px] font-black uppercase tracking-wider">
                                                    {isKa ? 'QR სკანერი' : 'QR Scanner'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setScannerType('camera')}
                                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all cursor-pointer text-center gap-1.5 ${
                                                    scannerType === 'camera'
                                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                                                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <CameraIcon className={`w-5 h-5 ${scannerType === 'camera' ? 'text-white' : 'text-slate-400'}`} />
                                                <span className="text-[9px] font-black uppercase tracking-wider">
                                                    {isKa ? 'კამერა' : 'QR Camera'}
                                                </span>
                                            </button>
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {scannerType === 'manual' && (
                                                <motion.div
                                                    key="manual-alert"
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex items-start gap-2.5 text-left"
                                                >
                                                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-xl shrink-0">
                                                        <Keyboard className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-slate-700 text-[10px] uppercase tracking-wider">
                                                            {isKa ? 'მექანიკური შეყვანა ჩართულია' : 'Manual Entry Active'}
                                                        </h5>
                                                        <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5 leading-normal">
                                                            {isKa ? 'კამერა გამორთულია. იდეალურია ძველი მოწყობილობებისთვის CPU-ის დასაზოგად.' : 'Camera streams disabled. 0% CPU overhead. Ideal for low-end tablets and phones.'}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                            {scannerType === 'hardware' && (
                                                <motion.div
                                                    key="hardware-alert"
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-xl shrink-0 relative">
                                                            <QrCodeIcon className="w-3.5 h-3.5" />
                                                            <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                                                        </div>
                                                        <div>
                                                            <h5 className="font-black text-slate-700 text-[10px] uppercase tracking-wider">
                                                                {isKa ? 'ფიზიკური QR სკანერი აქტიურია' : 'External Hardware Scanner Listening'}
                                                            </h5>
                                                            <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5 leading-normal">
                                                                {isKa ? 'დააკავშირეთ ფიზიკური სკანერი USB/Bluetooth-ით. ის ავტომატურად ჩაწერს QR-ს.' : 'Connect a physical scanner via USB/Bluetooth. Keyboard wedge is fully supported.'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (activeScanReceipt) {
                                                                setIsScanReceiptOpen(true);
                                                            } else {
                                                                const currentEvent = (harvestEvents || []).find(e => e.id === eventId);
                                                                const currentSector = (sectors || []).find(s => s.id === selectedSectorId);
                                                                const activeEmp = (pickers || []).find(p => p.id === employeeId) || (allEmployees || []).find(e => e.id === employeeId);
                                                                const readyReceipt: AutoScanReceipt = {
                                                                    id: `manual-${Date.now()}`,
                                                                    rawCode: activeEmp?.barcode || activeEmp?.idNumber || 'SCAN-READY',
                                                                    timestamp: new Date().toLocaleTimeString(),
                                                                    worker: activeEmp || null,
                                                                    workerName: activeEmp?.name || (isKa ? 'მზადაა სკანირებისთვის' : 'Ready for Scan'),
                                                                    workerId: activeEmp?.id || '',
                                                                    workerBadge: activeEmp?.barcode || activeEmp?.idNumber || '122',
                                                                    crateCode: crateCode || undefined,
                                                                    eventName: currentEvent?.name || (isKa ? 'ივლისის მოსავალი' : 'July Harvesting'),
                                                                    sectorName: currentSector?.name,
                                                                    actionDescription: isKa ? 'Bluetooth / USB სკანერი აქტიურია' : 'Bluetooth / USB Scanner Active'
                                                                };
                                                                setActiveScanReceipt(readyReceipt);
                                                                setIsScanReceiptOpen(true);
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                                                    >
                                                        <ScanLine size={13} />
                                                        <span>{isKa ? 'სკანერის ფანჯარა' : 'Scanner Pop-up'}</span>
                                                    </button>
                                                </motion.div>
                                            )}
                                            {scannerType === 'camera' && (
                                                <motion.div
                                                    key="camera-alert"
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 flex items-start gap-2.5 text-left"
                                                >
                                                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-xl shrink-0 relative">
                                                        <Camera className="w-3.5 h-3.5" />
                                                        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-slate-700 text-[10px] uppercase tracking-wider">
                                                            {isKa ? 'კამერით სკანირება აქტიურია' : 'Camera QR Scanner Active'}
                                                        </h5>
                                                        <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5 leading-normal">
                                                            {isKa ? 'ცოცხალი კამერა ჩართულია. მიუახლოეთ QR კოდი.' : 'Live stream is running. Hold any badge or box QR code inside the target guidelines above.'}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </InteractiveBlock>
                            );
                        })()}

                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'variety_package');
                            if (!block || !block.visible) return null;
                            return (
                                <InteractiveBlock block={block}>
                                    <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm h-full justify-center">
                                        <div className="flex items-center gap-2 pr-4 pl-2 shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={clearWorkerAfterSave}
                                                onChange={e => setClearWorkerAfterSave(e.target.checked)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            <label 
                                                className="text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer leading-tight max-w-[100px] text-left"
                                                onClick={() => setClearWorkerAfterSave(!clearWorkerAfterSave)}
                                            >
                                                {t('weigh.clear_after_save_label')}
                                            </label>
                                        </div>

                                        <div className="flex-1 relative">
                                            <select
                                                value={selectedVariety}
                                                onChange={e => setSelectedVariety(e.target.value)}
                                                className="w-full appearance-none px-4 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-[1rem] font-black text-[10px] sm:text-xs uppercase tracking-widest outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer text-slate-700 text-left"
                                            >
                                                <option value="">{t('weigh.variety')}</option>
                                                {varieties.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </div>
                                        </div>

                                        <div className="flex-1 relative">
                                            <select
                                                value={packagingItemId}
                                                onChange={e => setPackagingItemId(e.target.value)}
                                                className="w-full appearance-none px-4 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-[1rem] font-black text-[10px] sm:text-xs uppercase tracking-widest outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer text-slate-700 text-left"
                                            >
                                                <option value="">{t('weigh.package')}</option>
                                                {packagingItems.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </div>
                                        </div>

                                        <div 
                                            onClick={() => setIsWithPunets(!isWithPunets)}
                                            className={`flex items-center gap-2 px-3 py-2 border rounded-[1rem] shrink-0 cursor-pointer transition-all select-none ${isWithPunets ? 'bg-amber-500 text-white border-amber-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isWithPunets}
                                                onChange={() => {}}
                                                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                                                🍓 {isKa ? 'პუნეტებით (12/ყუთი)' : 'With Punets (12/box)'}
                                            </span>
                                        </div>
                                    </div>
                                </InteractiveBlock>
                            );
                        })()}

                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'field_sector');
                            if (!block || !block.visible) return null;
                            return (
                                <InteractiveBlock block={block}>
                                    <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm h-full justify-center items-center">
                                        <div className="flex items-center gap-2 pr-4 pl-2 shrink-0">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">
                                                {isKa ? 'უბანი / სექტორი' : 'Field Sector'}
                                            </span>
                                        </div>
                                        <div className="flex-1 w-full relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsSectorPopupOpen(true)}
                                                className="w-full appearance-none px-4 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-[1rem] font-bold text-xs uppercase outline-none hover:border-indigo-500 hover:bg-white transition-all cursor-pointer text-slate-700 text-left flex justify-between items-center"
                                            >
                                                <span className="truncate">
                                                    {selectedSectorId 
                                                        ? ((sectors || []).find(s => s.id === selectedSectorId)?.name || (allSectors || []).find(s => s.id === selectedSectorId)?.name || `Sector ${selectedSectorId}`)
                                                        : (isKa ? 'აირჩიეთ სექტორი (მაგ. R9)' : 'Select Sector (e.g. R9)')}
                                                </span>
                                                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                                            </button>
                                        </div>
                                    </div>
                                </InteractiveBlock>
                            );
                        })()}

                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'worker_search');
                            if (!block || !block.visible) return null;
                            return (
                                <InteractiveBlock block={block}>
                                    <WorkerSearchBlock
                                        employeeSearch={employeeSearch}
                                        setEmployeeSearch={setEmployeeSearch}
                                        employeeId={employeeId}
                                        setEmployeeId={setEmployeeId}
                                        pickers={pickers}
                                        t={t}
                                        isKa={isKa}
                                        scannerType={scannerType}
                                        setScannerType={setScannerType}
                                        processScanCode={processScanCode}
                                        videoRefCallback={videoRefCallback}
                                        isScanning={isScanning}
                                        allEmployees={allEmployees}
                                        onSetEmployees={onSetEmployees}
                                        onSetHarvestEvents={onSetHarvestEvents}
                                        harvestEvents={harvestEvents}
                                        eventId={eventId}
                                        onOpenScannerModal={() => {
                                            if (activeScanReceipt) {
                                                setIsScanReceiptOpen(true);
                                            } else {
                                                const currentEvent = (harvestEvents || []).find(e => e.id === eventId);
                                                const currentSector = (sectors || []).find(s => s.id === selectedSectorId);
                                                const activeEmp = (pickers || []).find(p => p.id === employeeId) || (allEmployees || []).find(e => e.id === employeeId);
                                                const readyReceipt: AutoScanReceipt = {
                                                    id: `manual-${Date.now()}`,
                                                    rawCode: activeEmp?.barcode || activeEmp?.idNumber || 'SCAN-READY',
                                                    timestamp: new Date().toLocaleTimeString(),
                                                    worker: activeEmp || null,
                                                    workerName: activeEmp?.name || (isKa ? 'მზადაა სკანირებისთვის' : 'Ready for Scan'),
                                                    workerId: activeEmp?.id || '',
                                                    workerBadge: activeEmp?.barcode || activeEmp?.idNumber || '122',
                                                    crateCode: crateCode || undefined,
                                                    eventName: currentEvent?.name || (isKa ? 'ივლისის მოსავალი' : 'July Harvesting'),
                                                    sectorName: currentSector?.name,
                                                    actionDescription: isKa ? 'Bluetooth / USB სკანერი აქტიურია' : 'Bluetooth / USB Scanner Active'
                                                };
                                                setActiveScanReceipt(readyReceipt);
                                                setIsScanReceiptOpen(true);
                                            }
                                        }}
                                    />
                                </InteractiveBlock>
                            );
                        })()}

                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'input_selector_tab');
                            if (!block || !block.visible) return null;
                            return null; // Handwriting was removed, so we only have keyboard input now
                        })()}

                        {(() => {
                            const block = layoutBlocks.find(b => b.id === 'weight_workspace');
                            if (!block || !block.visible) return null;
                            return (
                                <InteractiveBlock block={block}>
                                    <div className="space-y-4">
                                        {operatingMode === 'group' ? (
                                            <div id="pallet-group-weighing-container" className="space-y-6">
                                                <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white border-4 border-slate-800 shadow-2xl relative">
                                                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                                                        <Sparkles className="text-indigo-400 animate-pulse w-3 h-3" />
                                                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">
                                                            {isKa ? 'ჯგუფური გადაწონვა' : 'Group / Pallet Palette Mode'}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                                        <div className="space-y-2 text-left">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                                {isKa ? 'რეალური საერთო წონა (KG) - scale reading' : 'Actual Total Bulk Scale Weight (KG)'}
                                                            </label>
                                                            <div className="relative">
                                                                <input
                                                                    id="group-actual-bulk-weight"
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={groupActualWeight}
                                                                    onChange={e => setGroupActualWeight(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            commitGroupWeighing();
                                                                        }
                                                                    }}
                                                                    placeholder="0.00"
                                                                    className="w-full bg-slate-950 text-emerald-400 text-4xl font-black rounded-2xl border-2 border-slate-800 p-4 focus:border-indigo-500 focus:bg-slate-950 outline-none transition-all placeholder:text-slate-800 font-mono"
                                                                />
                                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500 font-sans">KG</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2 text-left">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                                {isKa ? 'საშუალო ყუთის წონა (KG)' : 'Estimated Standard Weight Per Crate (KG)'}
                                                            </label>
                                                            <div className="relative">
                                                                <input
                                                                    id="group-standard-box-weight"
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={groupStandardBoxWeight}
                                                                    onChange={e => setGroupStandardBoxWeight(e.target.value === '' ? '' : e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            commitGroupWeighing();
                                                                        }
                                                                    }}
                                                                    placeholder="10.00"
                                                                    className="w-full bg-slate-950 text-amber-500 text-4xl font-black rounded-2xl border-2 border-slate-800 p-4 focus:border-indigo-500 focus:bg-slate-950 outline-none transition-all placeholder:text-slate-800 font-mono"
                                                                />
                                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500 font-sans">KG</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(() => {
                                                        const totalBoxes = groupItems.length;
                                                        const expectedWeight = totalBoxes * (Number(groupStandardBoxWeight) || 0);
                                                        const actualVal = parseFloat(groupActualWeight) || 0;
                                                        const diff = actualVal > 0 ? (actualVal - expectedWeight) : 0;
                                                        const diffPct = expectedWeight > 0 ? (diff / expectedWeight * 100) : 0;
                                                        const distributedCrate = totalBoxes > 0 ? (actualVal > 0 ? actualVal / totalBoxes : (Number(groupStandardBoxWeight) || 0)) : 0;
                                                        return (
                                                            <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-4 text-left">
                                                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                        {isKa ? 'საერთო ყუთი' : 'Total Boxes'}
                                                                    </span>
                                                                    <span className="text-xl font-black text-white">
                                                                        {totalBoxes} <span className="text-xs text-slate-500 font-bold uppercase font-sans">bx</span>
                                                                    </span>
                                                                </div>

                                                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                        {isKa ? 'თეორიული წონა' : 'Expected Weight'}
                                                                    </span>
                                                                    <span className="text-xl font-black text-indigo-300 font-mono">
                                                                        {expectedWeight.toFixed(2)} <span className="text-xs text-indigo-500/70 font-bold uppercase font-sans">kg</span>
                                                                    </span>
                                                                </div>

                                                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                        {isKa ? 'განსხვავება' : 'Difference'}
                                                                    </span>
                                                                    {actualVal > 0 ? (
                                                                        <span className={`text-sm font-black font-mono ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                            {diff > 0 ? '+' : ''}{diff.toFixed(2)} kg ({diffPct.toFixed(1)}%)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-sm font-black text-slate-500">N/A</span>
                                                                    )}
                                                                </div>

                                                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                        {isKa ? 'თითოზე გადანაწილებული' : 'Distributed Crate'}
                                                                    </span>
                                                                    <span className="text-xl font-black text-emerald-400 font-mono">
                                                                        {distributedCrate.toFixed(2)} <span className="text-xs text-emerald-600/70 font-bold uppercase font-sans">kg</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            

                                        {/* Scanned Playlist Register Container */}
                                        <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 shadow-sm space-y-4">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="space-y-1 text-left">
                                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                                        <span>📦</span> {isKa ? 'ჯგუფური გადაწონვის სია' : 'ACTIVE PALLET BATCH LIST'}
                                                    </h3>
                                                    <p className="text-[10px] text-slate-400 font-bold leading-normal">
                                                        {isKa ? 'დაასკანერეთ მუშის ან კრატის QR კოდები, რათა დაემატოს სიაში' : 'Scan worker or crate QR barcodes to register slots'}
                                                    </p>
                                                </div>

                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setGroupItems(prev => [
                                                                ...prev,
                                                                {
                                                                    id: Math.random().toString(),
                                                                    employeeId: '',
                                                                    employeeName: '',
                                                                    crateCode: '',
                                                                    variety: selectedVariety || varieties?.[0] || '',
                                                                    calculatedWeight: Number(groupStandardBoxWeight) || 0
                                                                }
                                                            ]);
                                                            toast.success("Manual slot added to group.");
                                                        }}
                                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer text-center"
                                                    >
                                                        + {isKa ? 'ყუთის ჩამატება' : 'Add Box'}
                                                    </button>
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setGroupItems([]);
                                                            setGroupActualWeight('');
                                                            toast.success("Pallet list cleared.");
                                                        }}
                                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer text-center"
                                                    >
                                                        {isKa ? 'გასუფთავება' : 'Clear List'}
                                                    </button>
                                                </div>
                                            </div>

                                            {groupItems.length === 0 ? (
                                                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                                                    <span className="text-3xl block">📡</span>
                                                    <p className="text-xs text-slate-400 font-black uppercase tracking-widest animate-pulse leading-relaxed">
                                                        {isKa ? 'მზადყოფნა: დაასკანერეთ ყუთები კამერით / HID წამკითხველით!' : 'Ready: Scan several crates together!'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                                    {groupItems.map((item, index) => (
                                                        <motion.div 
                                                            key={item.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className={`p-4 rounded-2xl border-2 flex flex-col md:flex-row items-center gap-4 transition-all ${
                                                                !item.employeeId 
                                                                    ? 'bg-amber-50/70 border-amber-300' 
                                                                    : 'bg-slate-50/60 border-slate-100 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            {/* Index Sphere */}
                                                            <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                                                {index + 1}
                                                            </span>

                                                            {/* Worker dropdown selection */}
                                                            <div className="flex-1 w-full space-y-1 text-left">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                                                                    {isKa ? 'მუშა და გვარი' : 'Worker Name & Surname'}
                                                                </span>
                                                                <select 
                                                                    value={item.employeeId} 
                                                                    onChange={(e) => updateGroupItem(item.id, { employeeId: e.target.value })}
                                                                    className="bg-white border border-slate-200 text-xs font-bold p-2.5 rounded-xl text-slate-800 outline-none w-full uppercase cursor-pointer"
                                                                >
                                                                    <option value="">-- {isKa ? "აირჩიეთ მუშა" : "Select Worker"} --</option>
                                                                    {pickers.map(p => (
                                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Crate code identifier */}
                                                            <div className="w-full md:w-44 space-y-1 text-left">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                                                                    {isKa ? 'კრატის QR კოდი' : 'Crate QR / Serial'}
                                                                </span>
                                                                <input 
                                                                    type="text" 
                                                                    value={item.crateCode || ''} 
                                                                    onChange={(e) => updateGroupItem(item.id, { crateCode: e.target.value })}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            commitGroupWeighing();
                                                                        }
                                                                    }}
                                                                    placeholder={isKa ? "სკანირება / ჩაწერა" : "Code QR String"}
                                                                    className="bg-white border border-slate-200 text-xs font-mono font-bold p-2 px-3 rounded-xl text-slate-800 outline-none w-full"
                                                                />
                                                            </div>

                                                            {/* Variety Selector */}
                                                            <div className="w-full md:w-36 space-y-1 text-left">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                                                                    {isKa ? 'ჯიში' : 'Variety'}
                                                                </span>
                                                                <select 
                                                                    value={item.variety} 
                                                                    onChange={(e) => updateGroupItem(item.id, { variety: e.target.value })}
                                                                    className="bg-white border border-slate-200 text-xs font-bold p-2.5 rounded-xl text-slate-700 outline-none w-full cursor-pointer"
                                                                >
                                                                    {varieties.map(v => (
                                                                        <option key={v} value={v}>{v}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Proportional allocated weight display */}
                                                            <div className="text-center md:text-right shrink-0 md:w-24">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                                                                    {isKa ? 'წონა' : 'Distributed'}
                                                                </span>
                                                                <span className="text-xs font-black font-mono text-indigo-600 block">
                                                                    {(() => {
                                                                        const totalBoxes = groupItems.length;
                                                                        const totalActualWeight = parseFloat(groupActualWeight) || 0;
                                                                        const distributed = totalActualWeight > 0 ? (totalActualWeight / totalBoxes) : (Number(groupStandardBoxWeight) || 0);
                                                                        return `${distributed.toFixed(2)} kg`;
                                                                    })()}
                                                                </span>
                                                            </div>

                                                            {/* Delete slot */}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeGroupItem(item.id)}
                                                                className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors rounded-xl md:mt-4 shrink-0 cursor-pointer border-0"
                                                                title={isKa ? "წაშლა" : "Delete Item"}
                                                            >
                                                                <XCircleIcon className="h-5 w-5" />
                                                            </button>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Bottom Commit Pallet Row */}
                                            {groupItems.length > 0 && (
                                                <div className="pt-4 border-t border-slate-100 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={commitGroupWeighing}
                                                        className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg hover:shadow-emerald-500/10 active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-0"
                                                    >
                                                        <CheckIcon className="h-4 w-4 stroke-[3]" />
                                                        {isKa ? 'ჯგუფური გატარება / დადასტურება' : 'Commit Group & Record Pallet'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        className="bg-slate-900 rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-8 text-center border-4 border-slate-800 overflow-hidden relative shadow-2xl group active:scale-[0.99] transition-all"
                                    >
                                        <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
                                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                                <BluetoothIcon size={12} className="text-emerald-400 animate-pulse" />
                                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none">{t('weigh.stream_ready')}</span>
                                            </div>
                                            <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-center gap-1">⏎ {t('weigh.save_enter')}</div>
                                        </div>

                                        {operatingMode === 'box' ? (
                                            <div className="absolute top-4 right-4 flex flex-col items-end gap-1 z-10" onClick={e => e.stopPropagation()}>
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('weigh.box_count')}</label>
                                                <input 
                                                    type="number"
                                                    value={boxQuantity}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setBoxQuantity(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            triggerSave();
                                                        }
                                                    }}
                                                    className="w-16 bg-white/10 border border-white/20 rounded-lg text-white text-xs font-black text-center py-1 outline-none focus:border-blue-500 font-mono"
                                                />
                                            </div>
                                        ) : (
                                            operatingMode === 'weigh' && calculatedBoxCount > 0 && (
                                                <div className="absolute top-4 right-4 flex flex-col items-end gap-1 z-10" onClick={e => e.stopPropagation()}>
                                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t('weigh.est_boxes')}</label>
                                                    <div className="relative flex items-center">
                                                        <input 
                                                            type="number"
                                                            value={manualBoxCount !== null ? manualBoxCount : calculatedBoxCount}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (val === '') {
                                                                    setManualBoxCount('');
                                                                } else {
                                                                    const parsed = parseInt(val);
                                                                    setManualBoxCount(isNaN(parsed) ? null : Math.max(1, parsed));
                                                                }
                                                            }}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    triggerSave();
                                                                }
                                                            }}
                                                            className={`w-20 bg-white/10 text-emerald-400 text-xs font-black text-center py-1.5 outline-none font-mono pr-6 transition-all rounded-lg border ${
                                                                manualBoxCount !== null 
                                                                    ? 'border-amber-500 bg-amber-500/10' 
                                                                    : 'border-white/10 hover:border-emerald-500/40 focus:border-emerald-500/60'
                                                            }`}
                                                            min="1"
                                                        />
                                                        <span className={`absolute right-2 text-[9px] font-bold uppercase pointer-events-none ${
                                                            manualBoxCount !== null ? 'text-amber-500' : 'text-emerald-500/60'
                                                        }`}>bx</span>
                                                    </div>
                                                </div>
                                            )
                                        )}

                                        <div className="flex flex-col items-center mt-6">
                                            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-2">
                                                {operatingMode === 'box' 
                                                    ? t('weigh.weight_per_box') 
                                                    : (isReverseMode ? t('weigh.net_direct_scale') : t('weigh.gross_scale'))}
                                            </label>

                                            <OptimizedWeightInput
                                                weight={isReverseMode ? directNetWeightKg : grossWeightKg}
                                                isReverseMode={isReverseMode}
                                                operatingMode={operatingMode}
                                                defaultBoxWeightKg={defaultBoxWeightKg}
                                                onChange={handleWeightChange}
                                                onSave={triggerSave}
                                                setStandardWeightPerBox={setStandardWeightPerBox}
                                                t={t}
                                            />
                                        </div>

                                        {/* Stability counter at the bottom of weight box */}
                                        <div className="flex flex-col sm:flex-row justify-between items-center mt-5 px-4 pt-4 border-t border-white/5 gap-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-3">
                                                {operatingMode === 'weigh' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsReverseMode(!isReverseMode);
                                                            toast.info(!isReverseMode ? "Switched to Direct Net Weight Input Mode" : "Switched to Gross Weight Input Mode");
                                                        }}
                                                        className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                                            isReverseMode 
                                                                ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600' 
                                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-705'
                                                        }`}
                                                    >
                                                        <Scale size={10} className="stroke-[3]" />
                                                        {isReverseMode ? t('weigh.mode_reverse_active') : t('weigh.mode_standard')}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{t('weigh.stability_trace')}</span>
                                                <div className="flex gap-1">
                                                    {[...Array(3)].map((_, i) => (
                                                        <div key={i} className={`w-6 h-1 rounded-full transition-all duration-500 ${stabilityCounter > i ? 'bg-emerald-500 animate-pulse' : 'bg-slate-800'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </InteractiveBlock>
                    );
                })()}

                    {/* Live Sendbox: Placed directly below the Gross Scale Value Card as drawn in the screenshot! */}
                    {(() => {
                        const block = layoutBlocks.find(b => b.id === 'live_sendbox');
                        if (!block || !block.visible) return null;
                        if (!entries || entries.length === 0) return null;
                        return (
                            <InteractiveBlock block={block}>
                                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-3xl border border-slate-850 text-white shadow-xl space-y-3 w-full">
                                    <div className="flex flex-wrap justify-between items-center gap-2 px-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 
                                                {(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? 'ბოლო გატარებები (Live)' : 'Live Sendbox (Recent Scans)'}
                                            </h3>
                                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                                {(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? `${entries.length} სულ • ${sendboxData.length} მუშა` : `${entries.length} total • ${sendboxData.length} workers`}
                                            </span>
                                        </div>

                                        {/* View Mode Toggle: Grouped vs Flat */}
                                        <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-white/10">
                                            <button 
                                                onClick={() => setSendboxViewMode('grouped')}
                                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                                    sendboxViewMode === 'grouped' 
                                                        ? 'bg-indigo-600 text-white shadow-md' 
                                                        : 'bg-transparent text-white/50 hover:text-white'
                                                }`}
                                            >
                                                <Users size={11} /> {(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? 'ჯგუფური' : 'Grouped'}
                                            </button>
                                            <button 
                                                onClick={() => setSendboxViewMode('flat')}
                                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                                    sendboxViewMode === 'flat' 
                                                        ? 'bg-indigo-600 text-white shadow-md' 
                                                        : 'bg-transparent text-white/50 hover:text-white'
                                                }`}
                                            >
                                                <ListFilter size={11} /> {(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? 'ყველა' : 'All Scans'}
                                            </button>
                                        </div>
                                    </div>

                                    {sendboxViewMode === 'grouped' ? (
                                        /* Grouped Summary Cards per Worker */
                                        <div className="flex gap-2.5 overflow-x-auto pb-1.5 snap-x scrollbar-none scroll-smooth">
                                            {sendboxData.map((worker) => (
                                                <motion.div 
                                                    key={worker.employeeId}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex-shrink-0 bg-slate-850 border border-slate-800/80 hover:border-slate-700/80 p-3.5 rounded-2xl min-w-[200px] max-w-[240px] snap-center flex flex-col justify-between shadow-lg relative group transition-all"
                                                >
                                                    <div className="flex justify-between items-start gap-1">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm border border-white/20">
                                                                {worker.employeeName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black truncate text-slate-100">{worker.employeeName}</p>
                                                                <p className="text-[8px] text-indigo-300/80 font-bold tracking-wider uppercase mt-0.5">
                                                                    {getRelativeTimeStr(worker.lastScannedAt)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Small Pencil SVG Edit Button (✏️) to Explore and Correct Entries */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDrilldownWorkerId(worker.employeeId);
                                                            }}
                                                            title={(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? "ჩანაწერების ნახვა და შესწორება (✏️)" : "Explore & edit worker entries (✏️)"}
                                                            className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex-shrink-0"
                                                        >
                                                            <Pencil size={12} className="stroke-[2.5]" />
                                                        </button>
                                                    </div>

                                                    {/* Total Sum Weight & Total Box Count */}
                                                    <div className="flex justify-between items-baseline mt-3 pt-2 border-t border-white/10">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                                {(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? 'სულ ყუთი' : 'Total Boxes'}
                                                            </span>
                                                            <span className="text-xs font-black text-indigo-300 font-mono">
                                                                {worker.totalBoxes} <span className="text-[9px] uppercase">{(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? 'ყუთი' : 'Boxes'}</span>
                                                            </span>
                                                        </div>
                                                        {!isWeigher && (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-widest">
                                                                    {(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? 'ჯამური წონა' : 'Total Sum'}
                                                                </span>
                                                                <span className="text-base font-black text-emerald-400 font-mono">
                                                                    {worker.totalNetWeight.toFixed(1)}<span className="text-[9px]">kg</span>
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        /* Flat Stream of Scans */
                                        <div className="flex gap-2.5 overflow-x-auto pb-1.5 snap-x scrollbar-none scroll-smooth">
                                            {lastIndividualEntries.slice(0, 15).map((entry, idx) => (
                                                <motion.div 
                                                    key={entry.id || idx}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex-shrink-0 bg-slate-850 border border-thin border-slate-800/60 p-3 rounded-2xl min-w-[150px] snap-center flex flex-col justify-between"
                                                >
                                                    <div className="flex justify-between items-start gap-1">
                                                        <div>
                                                            <p className="text-xs font-black truncate text-slate-100">{entry.employeeName}</p>
                                                            <p className="text-[8px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">{getRelativeTimeStr(entry.scannedAt)}</p>
                                                        </div>
                                                        {onDeleteEntry && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDeleteEntry(entry.id);
                                                                    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';
                                                                    const msg = isKa 
                                                                        ? `${entry.employeeName}-ის ჩანაწერი წარმატებით გაუქმდა` 
                                                                        : `Reverted entry of ${entry.employeeName}`;
                                                                    toast.success(msg);
                                                                }}
                                                                title={t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? "ჩანაწერის წაშლა" : "Revert last entry"}
                                                                className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all flex items-center justify-center -mr-1 -mt-1 cursor-pointer"
                                                            >
                                                                <RotateCcw size={11} className="stroke-[3]" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-baseline mt-2.5 pt-2 border-t border-white/5">
                                                        <span className="text-[9px] font-black text-indigo-300 uppercase tracking-tight">
                                                            {entry.boxCount} {(t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? 'ყუთი' : (entry.boxCount === 1 ? 'Box' : 'Boxes')}
                                                        </span>
                                                        {!isWeigher && (
                                                            <span className="text-sm font-black text-emerald-400 font-mono">
                                                                {(entry.netWeightKg || 0).toFixed(1)}<span className="text-[9px]">kg</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </InteractiveBlock>
                        );
                    })()}

                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-2">
                        {isReverseMode && operatingMode === 'weigh' ? (
                            <>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{t('weigh.calculated_gross')}</p>
                                    <p className="text-2xl font-black text-emerald-700 leading-none">
                                        {formatCleanWeight(netWeight + (tareWeight * calculatedBoxCount))} <span className="text-[10px] text-emerald-600/80">kg</span>
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">
                                        Net {formatCleanWeight(netWeight)} + (Tare {formatCleanWeight(tareWeight)} × {calculatedBoxCount})
                                    </p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{t('weigh.net_entered')}</p>
                                    <p className="text-3xl font-black text-indigo-600 leading-none">{formatCleanWeight(netWeight)} <span className="text-xs">kg</span></p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('weigh.tare_box')}</p>
                                    <p className="text-lg font-black text-slate-700">{formatCleanWeight(tareWeight)} <span className="text-[10px]">kg</span></p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{t('weigh.net_realtime')}</p>
                                    <p className="text-3xl font-black text-indigo-600 leading-none">{formatCleanWeight(netWeight)} <span className="text-xs">kg</span></p>
                                </div>
                            </>
                        )}
                        
                        {/* Event Accumulated Totals - HIDDEN FOR WEIGHER LIMITS */}
                        <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3 mt-1.5">
                            <div className="space-y-0.5">
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ჯამური ნეტო წონა' : 'EVENT NET TOTAL'}
                                </p>
                                {isWeigher ? (
                                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                                        🔒 {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'დაფარულია' : 'Hidden'}
                                    </span>
                                ) : (
                                    <p className="text-xl font-black text-slate-800">{formatCleanWeight(totalEventNetWeight)} <span className="text-[10px] text-slate-400">kg</span></p>
                                )}
                            </div>
                            <div className="text-right space-y-0.5">
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                                    {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'ჯამური ბრუტო წონა' : 'EVENT GROSS TOTAL'}
                                </p>
                                {isWeigher ? (
                                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                                        🔒 {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'დაფარულია' : 'Hidden'}
                                    </span>
                                ) : (
                                    <p className="text-xl font-black text-slate-800">{formatCleanWeight(totalEventGrossWeight)} <span className="text-[10px] text-slate-400">kg</span></p>
                                )}
                            </div>
                        </div>
                    </div>
 
                    <div className="flex gap-4 pt-4">
                        <button 
                            onClick={triggerSave}
                            disabled={!employeeId || (operatingMode !== 'box' && (isReverseMode ? (typeof directNetWeightKg !== 'number' || directNetWeightKg <= 0) : (typeof grossWeightKg !== 'number' || grossWeightKg <= 0)))}
                            className="flex-1 py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                        >
                            {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'შენახვა / ჩაწერა' : 'ENTER / SAVE WEIGHT'}
                        </button>
                        <button 
                            onClick={handleClose} 
                            className="px-8 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                        >
                            {t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka' ? 'დასრულება' : 'Finish'}
                        </button>
                    </div>
                </div>
            </motion.div>



            {/* Small Sector / Field selection pop-up modal */}
            <AnimatePresence>
                {isSectorPopupOpen && (
                    <div className="fixed inset-0 bg-slate-950/80 z-[9999] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-sm border border-slate-100 flex flex-col max-h-[80vh] text-slate-800"
                        >
                            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                <h3 className="font-black text-sm uppercase tracking-wider text-slate-950">
                                    {isKa ? 'უბნის / სექტორის არჩევა' : 'Select Field Sector'}
                                </h3>
                                <button 
                                    onClick={() => setIsSectorPopupOpen(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                                >
                                    <XCircleIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="my-3 relative">
                                <SearchIcon className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={sectorSearchQuery}
                                    onChange={e => setSectorSearchQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const matchActive = (sectors || []).filter(s => s.name.toLowerCase().includes(sectorSearchQuery.toLowerCase()))[0];
                                            const matchAll = (allSectors || []).filter(s => s.name.toLowerCase().includes(sectorSearchQuery.toLowerCase()))[0];
                                            const match = matchActive || matchAll;
                                            if (match) {
                                                setSelectedSectorId(match.id);
                                                setIsSectorPopupOpen(false);
                                                setSectorSearchQuery('');
                                                toast.success(isKa ? `არჩეულია უბანი: ${match.name}` : `Selected field: ${match.name}`);
                                            }
                                        }
                                    }}
                                    placeholder={isKa ? 'მოძებნეთ უბანი (მაგ. R9)...' : 'Search sector (e.g. R9)...'}
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none font-bold transition-all"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
                                {/* Prioritized Active Event Sectors */}
                                {sectors && sectors.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-indigo-500 px-2 mb-1">
                                            {isKa ? 'აქტიური უბნები' : 'Active Event Sectors'}
                                        </div>
                                        <div className="space-y-1">
                                            {sectors
                                                .filter(s => s.name.toLowerCase().includes(sectorSearchQuery.toLowerCase()))
                                                .map(s => (
                                                    <button
                                                        key={`active-${s.id}`}
                                                        onClick={() => {
                                                            setSelectedSectorId(s.id);
                                                            setIsSectorPopupOpen(false);
                                                            setSectorSearchQuery('');
                                                            toast.success(isKa ? `არჩეულია უბანი: ${s.name}` : `Selected field: ${s.name}`);
                                                        }}
                                                        className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex justify-between items-center ${
                                                            selectedSectorId === s.id 
                                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                                                : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
                                                        }`}
                                                    >
                                                        <span>{s.name}</span>
                                                        <span className="text-[8px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                                            {isKa ? 'აქტიური' : 'Active'}
                                                        </span>
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* All Other Sectors */}
                                <div className="space-y-1">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2 mb-1">
                                        {isKa ? 'ყველა უბანი' : 'All Plantation Sectors'}
                                    </div>
                                    <div className="space-y-1">
                                        {((allSectors || []).filter(s => !sectors?.some(as => as.id === s.id)))
                                            .filter(s => s.name.toLowerCase().includes(sectorSearchQuery.toLowerCase()))
                                            .map(s => (
                                                <button
                                                    key={`all-${s.id}`}
                                                    onClick={() => {
                                                        setSelectedSectorId(s.id);
                                                        setIsSectorPopupOpen(false);
                                                        setSectorSearchQuery('');
                                                        toast.success(isKa ? `არჩეულია უბანი: ${s.name}` : `Selected field: ${s.name}`);
                                                    }}
                                                    className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex justify-between items-center ${
                                                        selectedSectorId === s.id 
                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                                            : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
                                                    }`}
                                                >
                                                    <span>{s.name}</span>
                                                </button>
                                            ))
                                        }
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Worker Drilldown & Crate Correction Modal */}
            <AnimatePresence>
                {drilldownWorkerId && (() => {
                    const workerGroup = sendboxData.find(w => w.employeeId === drilldownWorkerId);
                    if (!workerGroup) return null;

                    return (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2500] flex items-center justify-center p-3 sm:p-4"
                            onClick={() => {
                                setDrilldownWorkerId(null);
                                setEditingEntryId(null);
                            }}
                        >
                            <motion.div 
                                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
                            >
                                {/* Modal Header */}
                                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex justify-between items-center gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-base flex items-center justify-center shadow-md border border-white/20 flex-shrink-0">
                                            {workerGroup.employeeName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-white truncate">{workerGroup.employeeName}</h3>
                                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                                    <Pencil size={10} /> {isKa ? 'შესწორება' : 'Corrections'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                {isKa ? `ბოლო სკანირება: ${getRelativeTimeStr(workerGroup.lastScannedAt)}` : `Last scan: ${getRelativeTimeStr(workerGroup.lastScannedAt)}`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Summary Badges */}
                                    <div className="flex items-center gap-2">
                                        <div className="hidden sm:flex items-center gap-2 bg-slate-950/60 p-2 px-3 rounded-2xl border border-white/10">
                                            <div className="text-right">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">{isKa ? 'სულ წონა' : 'Total Weight'}</p>
                                                <p className="text-sm font-black text-emerald-400 font-mono">{workerGroup.totalNetWeight.toFixed(2)} kg</p>
                                            </div>
                                            <div className="h-6 w-px bg-white/10 mx-1" />
                                            <div className="text-right">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">{isKa ? 'სულ ყუთი' : 'Total Boxes'}</p>
                                                <p className="text-sm font-black text-indigo-300 font-mono">{workerGroup.totalBoxes}</p>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                setDrilldownWorkerId(null);
                                                setEditingEntryId(null);
                                            }}
                                            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Entry List Body */}
                                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                                    <div className="flex justify-between items-center text-xs text-slate-400 font-bold px-1 gap-2">
                                        <span>{isKa ? `ჩანაწერების სია (${workerGroup.workerEntries.length})` : `Logged Crates (${workerGroup.workerEntries.length})`}</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAddingNewEntryInDrilldown(!isAddingNewEntryInDrilldown);
                                                    const std = Number(standardWeightPerBox) || 5;
                                                    setNewEntryNet(std.toString());
                                                    setNewEntryGross((std + tareWeight).toString());
                                                    setNewEntryBoxes('1');
                                                }}
                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-1 shadow-md cursor-pointer transition-all active:scale-95"
                                            >
                                                <Plus size={12} /> {isKa ? 'დამატება' : 'Add Entry'}
                                            </button>
                                            <span className="text-[10px] text-amber-400 uppercase tracking-wider hidden sm:inline">{isKa ? 'შესასწორებლად დააჭირეთ ფანქარს ✏️' : 'Tap ✏️ to correct entry'}</span>
                                        </div>
                                    </div>

                                    {/* Inline Add New Entry Form */}
                                    {isAddingNewEntryInDrilldown && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-slate-950 border-2 border-emerald-500 p-4 rounded-2xl space-y-3 shadow-xl my-2"
                                        >
                                            <div className="flex justify-between items-center border-b border-white/10 pb-2 flex-wrap gap-2">
                                                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                                                    <Plus size={14} /> {isKa ? 'ახალი ჩანაწერის დამატება' : 'Add New Entry'} ({workerGroup.employeeName})
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDrilldownReverseMode(!drilldownReverseMode)}
                                                        className={`px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                                            drilldownReverseMode 
                                                                ? 'bg-amber-500 border-amber-400 text-white shadow-md' 
                                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        <Scale size={10} />
                                                        {drilldownReverseMode ? (isKa ? 'რევერსის რეჟიმი: ნეტი' : 'Reverse Mode: Net') : (isKa ? 'სტანდარტული: ბრუტო' : 'Standard: Gross')}
                                                    </button>
                                                    <button onClick={() => setIsAddingNewEntryInDrilldown(false)} className="text-slate-400 hover:text-white">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                                        {isKa ? 'წმინდა წონა (Net KG)' : 'Net Weight (KG)'}
                                                    </label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        value={newEntryNet}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setNewEntryNet(val);
                                                            const n = parseFloat(val);
                                                            if (!isNaN(n)) {
                                                                setNewEntryGross((n + tareWeight * (parseInt(newEntryBoxes) || 1)).toFixed(2));
                                                            }
                                                        }}
                                                        className="w-full bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-black text-sm p-2 rounded-xl outline-none focus:border-emerald-500"
                                                        placeholder="e.g. 5.0"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                                        {isKa ? 'სრული წონა (Gross KG)' : 'Gross Weight (KG)'}
                                                    </label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        value={newEntryGross}
                                                        onChange={e => setNewEntryGross(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 text-blue-400 font-mono font-black text-sm p-2 rounded-xl outline-none focus:border-emerald-500"
                                                        placeholder="e.g. 5.65"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                                        {isKa ? 'ყუთების რაოდენობა' : 'Box Count'}
                                                    </label>
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={newEntryBoxes}
                                                        onChange={e => {
                                                            const b = e.target.value;
                                                            setNewEntryBoxes(b);
                                                            const bNum = parseInt(b) || 1;
                                                            const netNum = parseFloat(newEntryNet);
                                                            if (!isNaN(netNum)) {
                                                                setNewEntryGross((netNum + tareWeight * bNum).toFixed(2));
                                                            }
                                                        }}
                                                        className="w-full bg-slate-900 border border-slate-700 text-indigo-300 font-mono font-black text-sm p-2 rounded-xl outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                                                <button 
                                                    onClick={() => setIsAddingNewEntryInDrilldown(false)}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                                >
                                                    {isKa ? 'გაუქმება' : 'Cancel'}
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const nNet = parseFloat(newEntryNet);
                                                        if (isNaN(nNet) || nNet <= 0) {
                                                            toast.error(isKa ? "მიუთითეთ ვალიდური წონა!" : "Please enter a valid weight!");
                                                            return;
                                                        }
                                                        const nBoxes = parseInt(newEntryBoxes) || 1;
                                                        const nGross = parseFloat(newEntryGross) || (nNet + tareWeight * nBoxes);

                                                        const activeUser = getStoredActiveUser();
                                                        const newEntryData: Omit<HarvestEntry, 'id'> = {
                                                            harvestEventId: eventId,
                                                            employeeId: workerGroup.employeeId,
                                                            scannedAt: new Date().toISOString(),
                                                            netWeightKg: nNet,
                                                            grossWeightKg: nGross,
                                                            tareWeightKg: tareWeight,
                                                            boxCount: nBoxes,
                                                            variety: selectedVariety || (varieties && varieties.length > 0 ? varieties[0] : ''),
                                                            sectorId: selectedSectorId,
                                                            ticketId: ticketId || `T-${Date.now().toString().slice(-6)}`,
                                                            packagingItemId: packagingItemId || '',
                                                            scannedBy: activeUser.name,
                                                            scannedByRole: activeUser.role,
                                                            scannedByUserName: activeUser.name
                                                        };

                                                        onSave(newEntryData);
                                                        setIsAddingNewEntryInDrilldown(false);
                                                        toast.success(isKa ? "ახალი ჩანაწერი წარმატებით დაემატა!" : "New crate entry successfully added!");
                                                    }}
                                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer"
                                                >
                                                    <Check size={14} /> {isKa ? 'ჩანაწერის შენახვა' : 'Save Entry'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {workerGroup.workerEntries.map((entry, index) => {
                                        const isEditing = editingEntryId === entry.id;

                                        if (isEditing) {
                                            return (
                                                <motion.div 
                                                    key={entry.id}
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="bg-slate-950 border-2 border-amber-500/80 p-4 rounded-2xl space-y-3 shadow-xl"
                                                >
                                                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                                        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                                                            <Pencil size={12} /> {isKa ? `ჩანაწერი #${workerGroup.workerEntries.length - index}` : `Edit Entry #${workerGroup.workerEntries.length - index}`}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{formatScannedTime(entry.scannedAt)}</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                                                {isKa ? 'წმინდა წონა (Net KG)' : 'Net Weight (KG)'}
                                                            </label>
                                                            <input 
                                                                type="number" 
                                                                step="0.01"
                                                                value={editNetWeight}
                                                                onChange={e => setEditNetWeight(e.target.value)}
                                                                className="w-full bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-black text-sm p-2 rounded-xl outline-none focus:border-amber-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                                                {isKa ? 'სრული წონა (Gross KG)' : 'Gross Weight (KG)'}
                                                            </label>
                                                            <input 
                                                                type="number" 
                                                                step="0.01"
                                                                value={editGrossWeight}
                                                                onChange={e => setEditGrossWeight(e.target.value)}
                                                                className="w-full bg-slate-900 border border-slate-700 text-blue-400 font-mono font-black text-sm p-2 rounded-xl outline-none focus:border-amber-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                                                {isKa ? 'ყუთების რაოდენობა' : 'Box Count'}
                                                            </label>
                                                            <input 
                                                                type="number" 
                                                                min="1"
                                                                value={editBoxCount}
                                                                onChange={e => setEditBoxCount(e.target.value)}
                                                                className="w-full bg-slate-900 border border-slate-700 text-indigo-300 font-mono font-black text-sm p-2 rounded-xl outline-none focus:border-amber-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                                                        <button 
                                                            onClick={() => setEditingEntryId(null)}
                                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                                        >
                                                            {isKa ? 'გაუქმება' : 'Cancel'}
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                const nNet = parseFloat(editNetWeight);
                                                                if (isNaN(nNet) || nNet <= 0) {
                                                                    toast.error(isKa ? "მიუთითეთ ვალიდური წონა!" : "Please enter valid net weight!");
                                                                    return;
                                                                }
                                                                const nGross = parseFloat(editGrossWeight) || (nNet + (entry.tareWeightKg || 0));
                                                                const nBoxes = parseInt(editBoxCount) || 1;

                                                                if (onDeleteEntry) {
                                                                    onDeleteEntry(entry.id);
                                                                }

                                                                const activeUser = getStoredActiveUser();
                                                                const updatedData: Omit<HarvestEntry, 'id'> = {
                                                                    harvestEventId: entry.harvestEventId || eventId,
                                                                    employeeId: entry.employeeId,
                                                                    scannedAt: entry.scannedAt || new Date().toISOString(),
                                                                    netWeightKg: nNet,
                                                                    grossWeightKg: nGross,
                                                                    tareWeightKg: entry.tareWeightKg || 0,
                                                                    boxCount: nBoxes,
                                                                    variety: editVariety || entry.variety,
                                                                    sectorId: entry.sectorId,
                                                                    crateCode: entry.crateCode,
                                                                    ticketId: entry.ticketId,
                                                                    packagingItemId: entry.packagingItemId || packagingItemId || '',
                                                                    scannedBy: activeUser.name,
                                                                    scannedByRole: activeUser.role,
                                                                    scannedByUserName: activeUser.name
                                                                };

                                                                onSave(updatedData);
                                                                setEditingEntryId(null);
                                                                toast.success(isKa ? "ჩანაწერი განახლდა და ჯამი გადაითვალა!" : "Entry updated & totals recalculated!");
                                                            }}
                                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer"
                                                        >
                                                            <Check size={14} /> {isKa ? 'შენახვა' : 'Save Changes'}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            );
                                        }

                                        return (
                                            <div 
                                                key={entry.id}
                                                className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/90 transition-all"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-slate-400 flex-shrink-0">
                                                        #{workerGroup.workerEntries.length - index}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-xs font-black text-slate-200 font-mono">
                                                                {entry.crateCode ? `CRATE: ${entry.crateCode}` : (entry.ticketId ? `TICKET: ${entry.ticketId}` : `ENTRY #${entry.id.slice(-6)}`)}
                                                            </span>
                                                            {entry.variety && (
                                                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md text-[9px] font-bold">
                                                                    {entry.variety}
                                                                </span>
                                                            )}
                                                            <span className="px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-700 rounded-md text-[9px] font-bold font-mono">
                                                                {entry.boxCount || 1} {isKa ? 'ყუთი' : 'Box'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                            {formatScannedTime(entry.scannedAt)} ({getRelativeTimeStr(entry.scannedAt)})
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Weight & Action buttons */}
                                                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                                    <div className="text-left sm:text-right">
                                                        <p className="text-base font-black text-emerald-400 font-mono leading-none">
                                                            {(entry.netWeightKg || 0).toFixed(2)} <span className="text-[10px]">kg</span>
                                                        </p>
                                                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                            Gross: {(entry.grossWeightKg || 0).toFixed(2)}kg • Tare: {(entry.tareWeightKg || 0).toFixed(2)}kg
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        {/* Edit Entry Button */}
                                                        <button
                                                            onClick={() => {
                                                                setEditingEntryId(entry.id);
                                                                setEditNetWeight(String(entry.netWeightKg || ''));
                                                                setEditGrossWeight(String(entry.grossWeightKg || ''));
                                                                setEditBoxCount(String(entry.boxCount || 1));
                                                                setEditVariety(entry.variety || '');
                                                            }}
                                                            title={isKa ? "ჩანაწერის შესწორება" : "Edit entry weight/boxes"}
                                                            className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl transition-all border border-amber-500/30 flex items-center justify-center cursor-pointer shadow-sm"
                                                        >
                                                            <Pencil size={13} className="stroke-[2.5]" />
                                                        </button>

                                                        {/* Delete / Void Button */}
                                                        {onDeleteEntry && (
                                                            <button
                                                                onClick={() => {
                                                                    onDeleteEntry(entry.id);
                                                                    toast.success(isKa ? "ჩანაწერი წაიშალა და ჯამი განახლდა!" : "Entry deleted & total updated!");
                                                                }}
                                                                title={isKa ? "ჩანაწერის წაშლა" : "Delete crate entry"}
                                                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all border border-rose-500/30 flex items-center justify-center cursor-pointer shadow-sm"
                                                            >
                                                                <RotateCcw size={13} className="stroke-[2.5]" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>

            {isScannerModalOpen && (
                <QrScannerModal
                    isOpen={isScannerModalOpen}
                    onClose={() => setIsScannerModalOpen(false)}
                    title={isKa ? "მოსავლის აღების QR / შტრიხკოდის სკანერი" : "Harvest Weigh Station Scanner"}
                    description={isKa ? "დაასკანერეთ მუშის ბარათი, ყუთის QR ან ტარის კოდი" : "Scan Worker ID Badge, Crate Barcode or Container Tag"}
                    mockEmployees={pickers.length > 0 ? pickers : allEmployees}
                    onScan={(scannedCode) => {
                        setIsScannerModalOpen(false);
                        processScanCode(scannedCode);
                    }}
                />
            )}

            {/* Hardware / Barcode Gun Auto-Scan Receipt Pop-up Window */}
            <AnimatePresence>
                {isScanReceiptOpen && activeScanReceipt && (
                    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md">
                        {/* Backdrop Click Dismiss */}
                        <div 
                            className="absolute inset-0 cursor-pointer" 
                            onClick={() => {
                                if (autoCloseReceiptTimerRef.current) clearTimeout(autoCloseReceiptTimerRef.current);
                                setIsScanReceiptOpen(false);
                            }}
                        />

                        <motion.div
                            key={activeScanReceipt.id}
                            initial={{ opacity: 0, scale: 0.92, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 16 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="relative w-full max-w-xl bg-white border-2 border-emerald-500 rounded-3xl shadow-[0_25px_60px_-15px_rgba(16,185,129,0.35)] overflow-hidden z-10 text-slate-900"
                        >
                            {/* Top Device Status Bar */}
                            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 relative">
                                        <ScanLine size={18} className="animate-pulse" />
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black tracking-wider uppercase text-emerald-400">
                                                {isKa ? 'სკანირება წარმატებულია' : 'QR Scan Recognized & Mapped'}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-800">
                                                USB/BT SCANNER
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            {isKa ? 'Bluetooth / USB შტრიხკოდის წამკითხველი' : 'Hardware POS Barcode Reader Gun'} • {activeScanReceipt.timestamp}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (autoCloseReceiptTimerRef.current) clearTimeout(autoCloseReceiptTimerRef.current);
                                        setIsScanReceiptOpen(false);
                                    }}
                                    className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                    title={isKa ? 'დახურვა (ESC)' : 'Close (ESC)'}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Primary Recognized Banner */}
                            <div className="bg-emerald-50/95 border-b border-emerald-200/90 px-6 py-4">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1.5">
                                    <CheckCircle2 size={15} className="text-emerald-600" />
                                    <span>{isKa ? 'ამოცნობილი ჩანაწერი & მიბმა' : 'Recognized Item & Event Mapping'}</span>
                                </div>
                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                                    {isKa ? (
                                        <>
                                            სკანირებულია: <span className="text-emerald-700 underline decoration-emerald-400 underline-offset-4">{activeScanReceipt.workerName}</span> {activeScanReceipt.workerBadge && <span className="font-mono bg-emerald-200/70 px-1.5 py-0.5 rounded text-emerald-950 text-sm font-bold">{activeScanReceipt.workerBadge}</span>} <span className="text-slate-600 text-sm font-semibold">{activeScanReceipt.worker?.employeeType || 'picker'}</span>, ღონისძიება: <span className="text-indigo-700">{activeScanReceipt.eventName}</span>
                                        </>
                                    ) : (
                                        <>
                                            Scanned: <span className="text-emerald-700 underline decoration-emerald-400 underline-offset-4">{activeScanReceipt.workerName}</span> {activeScanReceipt.workerBadge && <span className="font-mono bg-emerald-200/70 px-1.5 py-0.5 rounded text-emerald-950 text-sm font-bold">{activeScanReceipt.workerBadge}</span>} <span className="text-slate-600 text-sm font-semibold">{activeScanReceipt.worker?.employeeType || 'picker'}</span>, harvest event: <span className="text-indigo-700">{activeScanReceipt.eventName}</span>
                                        </>
                                    )}
                                </h3>
                            </div>

                            {/* Details Grid */}
                            <div className="p-5 sm:p-6 space-y-3.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Worker Card */}
                                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-base shrink-0 border border-indigo-200">
                                            {activeScanReceipt.workerName ? activeScanReceipt.workerName.charAt(0).toUpperCase() : '👤'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                {isKa ? 'მუშაკი (ძებნის ველში)' : 'Worker (In Search Field)'}
                                            </div>
                                            <div className="font-black text-slate-900 text-sm truncate">
                                                {activeScanReceipt.workerName}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <span className="text-[10px] font-mono font-bold bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded">
                                                    ID #{activeScanReceipt.workerBadge || activeScanReceipt.workerId}
                                                </span>
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                                                    ✓ {isKa ? 'ჩასმულია' : 'Dropped in field'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Harvest Event */}
                                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200">
                                            <Calendar size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                {isKa ? 'მოსავლის ღონისძიება' : 'Harvest Event'}
                                            </div>
                                            <div className="font-black text-slate-900 text-sm truncate">
                                                {activeScanReceipt.eventName}
                                            </div>
                                            <div className="text-[10px] font-bold text-purple-700 mt-1">
                                                {activeScanReceipt.sectorName ? `📍 ${activeScanReceipt.sectorName}` : '🌾 Active Field Session'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Crate / QR Code */}
                                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                                            <Package size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                {isKa ? 'ყუთის QR / შტრიხკოდი' : 'Crate / Barcode Tag'}
                                            </div>
                                            <div className="font-mono font-black text-slate-900 text-sm truncate">
                                                {activeScanReceipt.crateCode || activeScanReceipt.rawCode}
                                            </div>
                                            <div className="text-[10px] font-semibold text-slate-500 mt-1">
                                                {activeScanReceipt.isHarvestBox 
                                                    ? (isKa ? '📦 ყუთი მიბმულია მუშაკზე' : '📦 Crate mapped to worker') 
                                                    : (isKa ? '🪪 მუშაკის ბარათი' : '🪪 Worker badge tag')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scale & Weigh Status */}
                                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                                            <Scale size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                {isKa ? 'სასწორის სტატუსი' : 'Weigh Station Status'}
                                            </div>
                                            <div className="font-bold text-slate-900 text-sm">
                                                {isKa ? 'მზადაა ასაწონად' : 'Ready to Weigh Box'}
                                            </div>
                                            <div className="text-[10px] font-semibold text-emerald-700 mt-1">
                                                {isKa ? 'დაამატეთ ყუთის წმინდა წონა (Net)' : 'Add net weight to crate'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Auto-saved previous entry notification */}
                                {activeScanReceipt.autoSavedPrevious && (
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                                        <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0">
                                            <SaveIcon className="w-4 h-4" />
                                        </div>
                                        <div className="text-xs text-emerald-950 font-bold">
                                            <span className="font-black text-emerald-800">
                                                {isKa ? '💾 წინა ჩანაწერი ავტომატურად შენახულია:' : '💾 Last entry auto-saved:'}
                                            </span>{' '}
                                            {activeScanReceipt.autoSavedPrevious.workerName} •{' '}
                                            <span className="font-mono underline">
                                                {activeScanReceipt.autoSavedPrevious.netWeightKg.toFixed(2)} kg
                                            </span>{' '}
                                            ({activeScanReceipt.autoSavedPrevious.boxCount} {isKa ? 'ყუთი' : 'box'})
                                        </div>
                                    </div>
                                )}

                                {/* Auto-closing progress countdown bar */}
                                <div className="bg-slate-100 rounded-xl p-2.5 text-center">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} className="text-slate-500" />
                                            {isKa ? 'ავტომატური დახურვა 4 წამში' : 'Auto-closing in 4s'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-semibold">
                                            {isKa ? 'შემდეგი QR-ის სკანირება ავტომატურად დახურავს და გახსნის ახალს' : 'Next QR scan will auto-close & open new'}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: '100%' }}
                                            animate={{ width: '0%' }}
                                            transition={{ duration: 4.5, ease: 'linear' }}
                                            className="h-full bg-emerald-500 rounded-full"
                                        />
                                    </div>
                                </div>

                                {/* Quick-test & Manual Scan Bar */}
                                <div className="pt-1 flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder={isKa ? "ტესტი ან შტრიხკოდი (მაგ: 122 ან მახარაძე მელანო 122 picker)..." : "Test or barcode (e.g. 122 or Makharadze Melano 122)..."}
                                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = (e.target as HTMLInputElement).value.trim();
                                                if (val) {
                                                    processScanCode(val);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            processScanCode("scaned მახარაძე მელანო 122 picker, harvest event july harvesting");
                                        }}
                                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[10px] font-bold uppercase transition-colors shrink-0 cursor-pointer"
                                        title={isKa ? "მახარაძე მელანო 122-ის ტესტირება" : "Test Melano Makharadze 122"}
                                    >
                                        🧪 Test 122
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons Footer */}
                            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (autoCloseReceiptTimerRef.current) clearTimeout(autoCloseReceiptTimerRef.current);
                                        setIsScanReceiptOpen(false);
                                        setIsScannerModalOpen(true);
                                    }}
                                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                    <Camera size={14} className="text-slate-500" />
                                    <span>{isKa ? 'კამერით სკანირება' : 'Camera Scanner'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (autoCloseReceiptTimerRef.current) clearTimeout(autoCloseReceiptTimerRef.current);
                                        setIsScanReceiptOpen(false);
                                    }}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                                >
                                    <Check size={14} />
                                    <span>{isKa ? 'გასაგებია / დახურვა (ESC)' : 'OK / Close (ESC)'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style>{`
                .modern-select { width: 100%; padding: 1.1rem; background-color: #f8fafc; border: 2px solid #f1f5f9; border-radius: 1.25rem; font-weight: 800; outline: none; transition: all 0.2s; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; appearance: none; cursor: pointer; }
                .modern-select:focus { border-color: #6366f1; background-color: white; }
            `}</style>
        </div>
        </InteractiveBlockContext.Provider>
    );
});

export default WeighStationModal;
