import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CameraIcon, XCircleIcon } from './Icons';
import { toast } from 'sonner';
import jsQR from 'jsqr';
import { 
    dispatchHardwareScan, 
    getActiveAdoptedScanner, 
    initGlobalHardwareScannerListener,
    playScannerBeep
} from '../utils/hardwareScannerBus';
import { 
    ScanLine, Bluetooth, Usb, Camera, Upload, CheckCircle2, 
    Sparkles, User, Package, Layers, FileText, ArrowDownRight, 
    ArrowUpRight, QrCode, RefreshCw, Check, Copy, Trash2, 
    History, AlertTriangle, ChevronDown, Clock, ShieldCheck, 
    UserCheck, CheckCheck, ListFilter, ArrowRight, CornerDownRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    parseUniversalScan, 
    ScannerCategory, 
    ParsedScanResult 
} from '../utils/universalScannerParser';
import { findMatchingEmployee } from '../utils/employeeMatching';
import type { Employee, InventoryItem } from '../types';
import { safeStorage } from '../services/storageService';

export type { ScannerCategory, ParsedScanResult };

export interface ScanSessionItem {
    id: string;
    code: string;
    type: 'worker' | 'harvest_box' | 'material' | 'document' | 'unknown';
    title: string;
    subtitle?: string;
    destination: string;
    timestamp: string;
    status: 'success' | 'warning';
    rawParsed?: ParsedScanResult;
}

interface QrScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (result: string, category?: ScannerCategory, parsed?: ParsedScanResult) => void;
    title?: string;
    description?: string;
    mockEmployees?: Array<Employee | any>;
    inventoryItems?: Array<InventoryItem | any>;
    mockItems?: Array<InventoryItem | any>;
    initialCategory?: ScannerCategory;
    initialAction?: 'add' | 'charge';
    onOpenGenerator?: () => void;
    destinationLabel?: string;
    defaultContinuous?: boolean;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({ 
    isOpen, 
    onClose, 
    onScan, 
    title, 
    description,
    mockEmployees = [],
    inventoryItems = [],
    mockItems = [],
    initialCategory = 'auto',
    initialAction = 'charge',
    onOpenGenerator,
    destinationLabel,
    defaultContinuous = true
}) => {
    const effectiveInventory = (inventoryItems && inventoryItems.length > 0) ? inventoryItems : mockItems;
    const { t } = useLanguage();
    const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

    const modalTitle = title || (isKa ? "უნივერსალური QR / შტრიხკოდის სკანერი" : "Universal QR & Barcode Scanner");
    const modalDesc = description || (isKa ? "თანამშრომლები, ყუთები, აგრო-ინპუტები, აქტივები და დოკუმენტები" : "Workers, harvest boxes, agro-inputs, assets & documents");

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const requestRef = useRef<number | null>(null);
    const lastScanThrottleRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });

    const [isScanning, setIsScanning] = useState(false);
    const [scanMode, setScanMode] = useState<'camera' | 'hardware'>('camera');
    const [manualCode, setManualCode] = useState('');
    const [activeScanner, setActiveScanner] = useState<any>(null);
    const [category, setCategory] = useState<ScannerCategory>(initialCategory);
    const [stockAction, setStockAction] = useState<'charge' | 'add'>(initialAction);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

    // Continuous Scan Mode (defaults to true so multiple items can be scanned without closing)
    const [isContinuous, setIsContinuous] = useState<boolean>(() => {
        const saved = safeStorage.getItem('agrimap_scanner_continuous_mode');
        return saved !== null ? saved === 'true' : defaultContinuous;
    });

    // Active picker memory (especially useful for harvest box scanning)
    const [activePickerId, setActivePickerId] = useState<string | null>(null);

    // Live Scan Result and Session History
    const [lastScanItem, setLastScanItem] = useState<ScanSessionItem | null>(null);
    const [sessionHistory, setSessionHistory] = useState<ScanSessionItem[]>([]);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);

    // Save continuous preference
    const handleToggleContinuous = (val: boolean) => {
        setIsContinuous(val);
        safeStorage.setItem('agrimap_scanner_continuous_mode', String(val));
    };

    useEffect(() => {
        if (isOpen) {
            setCategory(initialCategory);
            setStockAction(initialAction);
            setLastScanItem(null);
            setSessionHistory([]);
            lastScanThrottleRef.current = { code: '', timestamp: 0 };
        } else {
            stopCamera();
        }
    }, [isOpen, initialCategory, initialAction]);

    // Derive where the scan was mapped based on category, detected type, and context
    const deriveDestinationText = useCallback((parsed: ParsedScanResult, matchedEmp?: Employee | null): string => {
        if (destinationLabel) return destinationLabel;

        const titleLower = (title || '').toLowerCase();
        const isHarvestContext = titleLower.includes('harvest') || titleLower.includes('მოსავალ') || category === 'harvest_box';
        const isStockContext = titleLower.includes('stock') || titleLower.includes('საწყობ') || titleLower.includes('inventory') || ['supplies', 'goods', 'assets'].includes(category);
        const isTaskContext = titleLower.includes('task') || titleLower.includes('work') || titleLower.includes('დავალებ') || titleLower.includes('რეესტრ');
        const isWeighContext = titleLower.includes('weigh') || titleLower.includes('სასწორ');
        const isAgroContext = titleLower.includes('agronomy') || titleLower.includes('აგრონომ');

        if (parsed.detectedType === 'worker' || matchedEmp) {
            const empName = matchedEmp?.name || parsed.employee?.name || 'Worker';
            if (isHarvestContext || isWeighContext) {
                return isKa 
                    ? `✓ არჩეულია აქტიურ ამკრებად: ${empName} (ყუთები მიემაგრება მას)`
                    : `✓ Set as Active Picker: ${empName} (Subsequent boxes mapped here)`;
            }
            if (isTaskContext) {
                return isKa 
                    ? `✓ დაემატა სამუშაო დავალების რეესტრში: ${empName}`
                    : `✓ Added to task assignment roster: ${empName}`;
            }
            return isKa 
                ? `✓ თანამშრომელი იდენტიფიცირებულია: ${empName}`
                : `✓ Worker identified: ${empName}`;
        }

        if (parsed.detectedType === 'harvest_box') {
            const activeEmp = mockEmployees.find(e => e.id === activePickerId);
            if (activeEmp) {
                return isKa 
                    ? `✓ მიმაგრდა ამკრებზე: ${activeEmp.name} (მოსავლის აღრიცხვა)`
                    : `✓ Mapped to Picker: ${activeEmp.name} (Harvest tally +1)`;
            }
            return isKa 
                ? `✓ რეგისტრირებულია მიმდინარე მოსავლის სესიაში`
                : `✓ Registered in active harvest tally`;
        }

        if (parsed.detectedType === 'material') {
            const matName = parsed.material?.materialName || 'Material';
            const qty = parsed.material?.quantity || 1;
            const unit = parsed.material?.unit || 'unit';
            if (stockAction === 'add') {
                return isKa 
                    ? `✓ მიღებულია საწყობში (+${qty} ${unit} ${matName})`
                    : `✓ Ingested to stock (+${qty} ${unit} ${matName})`;
            }
            if (isAgroContext) {
                return isKa 
                    ? `✓ ჩამოიწერა საწყობიდან და ჩაიწერა კვების/მორწყვის გეგმაში`
                    : `✓ Deducted from stock & recorded in agronomy plan`;
            }
            return isKa 
                ? `✓ ჩამოწერილია საწყობიდან (-${qty} ${unit} ${matName})`
                : `✓ Deducted / Charged from inventory (-${qty} ${unit} ${matName})`;
        }

        if (parsed.detectedType === 'document') {
            return isKa ? `✓ დოკუმენტი მიბმულია აღრიცხვაზე` : `✓ Document linked to registry`;
        }

        return isKa ? `✓ კოდი წარმატებით დამუშავდა და გადაეცა მოდულს` : `✓ Code dispatched to active module`;
    }, [destinationLabel, title, category, stockAction, isKa, activePickerId, mockEmployees]);

    // Handle incoming scan execution
    const handleExecutionOfScan = useCallback((rawCode: string) => {
        const code = String(rawCode).trim();
        if (!code) return;

        const now = Date.now();
        // Cooldown throttle: Ignore the EXACT same barcode within 1200ms
        // (Allows scanning different codes immediately, but prevents 60fps duplicate triggers on identical video frame)
        if (code === lastScanThrottleRef.current.code && (now - lastScanThrottleRef.current.timestamp) < 1200) {
            return;
        }
        lastScanThrottleRef.current = { code, timestamp: now };

        // Play authentic POS scanner chime
        playScannerBeep('success');

        // Parse through Universal Parser
        const parsed = parseUniversalScan(code, mockEmployees, effectiveInventory, category, stockAction);

        // Check if an employee matched
        const matchedEmp = parsed.employee || findMatchingEmployee(mockEmployees, code);
        if (matchedEmp) {
            setActivePickerId(matchedEmp.id);
        }

        const isSuccess = parsed.detectedType !== 'unknown' || Boolean(matchedEmp);
        const destination = deriveDestinationText(parsed, matchedEmp);

        let titleStr = parsed.summary;
        let subtitleStr = `Code: ${code}`;

        if (matchedEmp) {
            titleStr = `Worker: ${matchedEmp.name}`;
            subtitleStr = `ID / Badge: ${matchedEmp.idNumber || matchedEmp.barcode || matchedEmp.id} • ${matchedEmp.employeeType || 'Field Staff'}`;
        } else if (parsed.detectedType === 'harvest_box') {
            const activeEmp = mockEmployees.find(e => e.id === activePickerId);
            titleStr = parsed.harvestBox?.crateCode ? `Box #${parsed.harvestBox.crateCode}` : `Crate #${code}`;
            subtitleStr = activeEmp ? `Credited to: ${activeEmp.name} • Weight: ${parsed.harvestBox?.weight || 5.9}kg` : `Weight: ${parsed.harvestBox?.weight || 5.9}kg`;
        } else if (parsed.detectedType === 'material') {
            titleStr = parsed.material?.materialName || 'Agro-input / Material';
            subtitleStr = `SKU: ${parsed.material?.sku || code} • Qty: ${parsed.material?.quantity || 1} ${parsed.material?.unit || 'unit'}`;
        }

        const sessionItem: ScanSessionItem = {
            id: `scan-${now}-${Math.random().toString(36).substr(2, 4)}`,
            code,
            type: parsed.detectedType,
            title: titleStr,
            subtitle: subtitleStr,
            destination,
            timestamp: new Date().toLocaleTimeString(),
            status: isSuccess ? 'success' : 'warning',
            rawParsed: parsed
        };

        // Update live status and history
        setLastScanItem(sessionItem);
        setSessionHistory(prev => [sessionItem, ...prev]);

        // Global hardware bus audit record
        try {
            const history = JSON.parse(safeStorage.getItem('agrimap_scan_audit_log') || '[]');
            const auditEntry = {
                id: sessionItem.id,
                code: sessionItem.code,
                title: sessionItem.title,
                destination: sessionItem.destination,
                timestamp: now,
                date: new Date().toISOString()
            };
            safeStorage.setItem('agrimap_scan_audit_log', JSON.stringify([auditEntry, ...history.slice(0, 99)]));
        } catch (_) {}

        // Execute parent callback
        try {
            onScan(code, category, parsed);
        } catch (err) {
            console.error("Error in onScan handler:", err);
        }

        // If continuous mode is disabled (single-scan mode), close the modal
        if (!isContinuous) {
            stopCamera();
            onClose();
        }
    }, [category, stockAction, mockEmployees, effectiveInventory, onScan, onClose, isContinuous, deriveDestinationText, activePickerId]);

    // Hardware Scanner Listener (runs constantly when modal is open in ANY mode)
    useEffect(() => {
        if (isOpen) {
            initGlobalHardwareScannerListener();
            const adopted = getActiveAdoptedScanner();
            setActiveScanner(adopted);

            const handleHwScan = (e: any) => {
                const code = e.detail?.code;
                if (code) {
                    handleExecutionOfScan(code);
                }
            };

            window.addEventListener('agrimap:hardware_scan', handleHwScan);
            return () => {
                window.removeEventListener('agrimap:hardware_scan', handleHwScan);
            };
        }
    }, [isOpen, handleExecutionOfScan]);

    // Camera Lifecycle
    useEffect(() => {
        if (isOpen && scanMode === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [isOpen, scanMode, facingMode]);

    const startCamera = async () => {
        try {
            setIsScanning(true);
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast.warning("Camera API not available. Switching to USB/Bluetooth scanner mode.");
                setScanMode('hardware');
                return;
            }

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: { ideal: facingMode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
            } catch (err) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                videoRef.current.setAttribute('muted', 'true');
                videoRef.current.muted = true;
                videoRef.current.playsInline = true;
                
                try {
                    await videoRef.current.play();
                    startDecodingLoop();
                } catch (playErr) {
                    console.error("Video play error:", playErr);
                }
            }
        } catch (err) {
            console.warn("Camera could not be opened:", err);
            setIsScanning(false);
            setScanMode('hardware');
        }
    };

    const startDecodingLoop = () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanFrame = () => {
            if (!streamRef.current || video.paused || video.ended) {
                return;
            }
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    try {
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "attemptBoth",
                        });
                        if (code && code.data) {
                            handleExecutionOfScan(code.data);
                        }
                    } catch (e) {
                        console.error("Frame decoding error:", e);
                    }
                }
            }
            requestRef.current = requestAnimationFrame(scanFrame);
        };

        requestRef.current = requestAnimationFrame(scanFrame);
    };

    const stopCamera = () => {
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsScanning(false);
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) {
            handleExecutionOfScan(manualCode.trim());
            setManualCode('');
        }
    };

    const handleCopyHistory = () => {
        if (sessionHistory.length === 0) return;
        const text = sessionHistory.map(s => `[${s.timestamp}] ${s.code} - ${s.title} -> ${s.destination}`).join('\n');
        navigator.clipboard.writeText(text);
        toast.success(isKa ? "სკანირების ისტორია დაკოპირებულია" : "Scan log copied to clipboard");
    };

    const handleClearHistory = () => {
        setSessionHistory([]);
        setLastScanItem(null);
        toast.info(isKa ? "ისტორია გასუფთავდა" : "Session log cleared");
    };

    if (!isOpen) return null;

    const activePicker = mockEmployees.find(e => e.id === activePickerId);

    return (
        <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-2 sm:p-4"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div 
                className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-fade-in text-white max-h-[94vh]"
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/80">
                    <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight truncate">
                                {modalTitle}
                            </h2>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5 truncate">
                            {modalDesc}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Done & Close button if items scanned */}
                        {sessionHistory.length > 0 && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
                            >
                                <Check size={14} />
                                <span>{isKa ? `დასრულება (${sessionHistory.length})` : `Done (${sessionHistory.length})`}</span>
                            </button>
                        )}

                        <button 
                            onClick={onClose} 
                            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white shrink-0 cursor-pointer"
                        >
                            <XCircleIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Continuous Scan Mode & Active Picker Bar */}
                <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {/* Continuous Scan Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isContinuous}
                            onChange={(e) => handleToggleContinuous(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                                {isKa ? "უწყვეტი / სერიული სკანირება" : "Continuous / Rapid Scan Mode"}
                            </span>
                            <span className="text-[8px] text-slate-400">
                                {isContinuous 
                                    ? (isKa ? "არ დაიხურება – შეგიძლიათ დაასკანეროთ 10+ ყუთი ან მუშაკი" : "Stays open – scan multiple boxes/items in a row")
                                    : (isKa ? "დაიხურება 1 სკანირების შემდეგ" : "Closes after 1 scan")}
                            </span>
                        </div>
                    </label>

                    {/* Active Harvest Picker Badge */}
                    {activePicker ? (
                        <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-800/80 px-2.5 py-1 rounded-xl text-[9px] font-bold text-blue-300">
                            <UserCheck size={12} className="text-blue-400" />
                            <span>{isKa ? "ამკრეფი:" : "Active Picker:"} <strong className="text-white">{activePicker.name}</strong></span>
                            <button
                                type="button"
                                onClick={() => setActivePickerId(null)}
                                className="ml-1 text-slate-400 hover:text-white"
                                title="Clear active picker"
                            >
                                ×
                            </button>
                        </div>
                    ) : mockEmployees.length > 0 && category === 'harvest_box' && (
                        <div className="text-[9px] text-amber-400 font-mono flex items-center gap-1">
                            <span>💡 {isKa ? "დაასკანერეთ მუშის ბარათი, შემდეგ ყუთები" : "Scan worker card first, then crates"}</span>
                        </div>
                    )}
                </div>

                {/* Target Category Selector */}
                <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-800 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                            <Layers size={11} className="text-emerald-400" />
                            {isKa ? "სამიზნე კატეგორია:" : "Category Target:"}
                        </span>

                        {/* Stock Action Selector (Charge vs Add) for materials */}
                        {['supplies', 'goods', 'assets', 'material', 'auto'].includes(category) && (
                            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[8px] font-black uppercase">
                                <button
                                    type="button"
                                    onClick={() => setStockAction('charge')}
                                    className={`px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-all ${
                                        stockAction === 'charge' 
                                            ? 'bg-rose-600 text-white' 
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="Charge / Deduct Material"
                                >
                                    <ArrowDownRight size={10} />
                                    <span>{isKa ? "ხარჯვა" : "Charge"}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStockAction('add')}
                                    className={`px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-all ${
                                        stockAction === 'add' 
                                            ? 'bg-emerald-600 text-white' 
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="Receive / Add to Stock"
                                >
                                    <ArrowUpRight size={10} />
                                    <span>{isKa ? "მიღება" : "Receive"}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[8px] font-black uppercase tracking-wider">
                        <button
                            type="button"
                            onClick={() => setCategory('auto')}
                            className={`py-1.5 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                                category === 'auto'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Sparkles size={11} />
                            <span>Auto</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCategory('worker')}
                            className={`py-1.5 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                                category === 'worker'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <User size={11} />
                            <span>Worker</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCategory('harvest_box')}
                            className={`py-1.5 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                                category === 'harvest_box'
                                    ? 'bg-orange-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Package size={11} />
                            <span>Box</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCategory('supplies')}
                            className={`py-1.5 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                                category === 'supplies'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Package size={11} />
                            <span>Supplies</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCategory('goods')}
                            className={`py-1.5 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                                category === 'goods'
                                    ? 'bg-emerald-700 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Sparkles size={11} />
                            <span>Goods</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCategory('assets')}
                            className={`py-1.5 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                                category === 'assets'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Layers size={11} />
                            <span>Assets</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCategory('document')}
                            className={`py-1.5 px-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                                category === 'document'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <FileText size={11} />
                            <span>Doc</span>
                        </button>
                    </div>
                </div>

                {/* Mode Selector Tabs (Camera vs USB Hardware) */}
                <div className="px-4 pt-2.5 pb-2 flex gap-2 border-b border-slate-800 bg-slate-950/40">
                    <button
                        type="button"
                        onClick={() => setScanMode('camera')}
                        className={`flex-1 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            scanMode === 'camera'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <Camera size={13} />
                        <span>Camera QR Scanner</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setScanMode('hardware')}
                        className={`flex-1 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            scanMode === 'hardware'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <Usb size={13} />
                        <span>USB / Handheld Barcode Gun</span>
                    </button>
                </div>

                {/* Body Area */}
                <div className="overflow-y-auto flex-1 flex flex-col">
                    
                    {/* Camera Mode View */}
                    {scanMode === 'camera' && (
                        <div className="relative aspect-[4/3] sm:aspect-[16/9] bg-black overflow-hidden flex items-center justify-center shrink-0">
                            {isScanning ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 border-[28px] sm:border-[35px] border-black/40 pointer-events-none">
                                        <div className="absolute inset-0 border-2 border-emerald-400 rounded-2xl relative overflow-hidden shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 animate-pulse pointer-events-none shadow-[0_0_12px_3px_rgba(52,211,153,0.8)]"></div>
                                        </div>
                                    </div>
                                    
                                    {/* Camera Switch button */}
                                    <button
                                        type="button"
                                        onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                                        className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-xl text-white backdrop-blur-md transition-all cursor-pointer z-10"
                                        title="Switch Camera"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </>
                            ) : (
                                <div className="p-8 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                                    <CameraIcon className="w-12 h-12 text-slate-500 animate-pulse" />
                                    <p className="text-xs font-bold uppercase tracking-wider">
                                        {isKa ? "კამერა ინიციალიზდება..." : "Initializing camera..."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setScanMode('hardware')}
                                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                                    >
                                        {isKa ? "გადართვა USB სკანერზე" : "Switch to USB / Keyboard"}
                                    </button>
                                </div>
                            )}

                            {/* Camera Overlay Status Pill */}
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-emerald-400 text-[9px] font-black uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                    {isKa ? "კამერა მზადაა (მიმართეთ QR-ს)" : "Aim at QR/Barcode"}
                                </span>

                                <label className="bg-slate-900/90 hover:bg-slate-800 text-white font-black py-1.5 px-3 rounded-xl shadow-lg transition-all text-[9px] tracking-widest uppercase border border-white/10 cursor-pointer flex items-center gap-1.5 backdrop-blur-md">
                                    <Upload size={11} />
                                    <span>{isKa ? "ფოტოს ატვირთვა" : "Upload QR"}</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment" 
                                        className="hidden" 
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                try {
                                                    const { processQrImageFile } = await import('../utils/qrFileScanner');
                                                    const result = await processQrImageFile(file);
                                                    toast.success(isKa ? "QR კოდი წარმატებით ამოიცნო ფოტოდან" : "QR read successfully from image");
                                                    handleExecutionOfScan(result);
                                                } catch (err: any) {
                                                    toast.error(err.message || 'Failed to read QR code');
                                                }
                                            }
                                        }} 
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Hardware Scanner Mode View */}
                    {scanMode === 'hardware' && (
                        <div className="p-5 space-y-3">
                            <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-850 rounded-2xl border border-slate-700/60 text-center relative overflow-hidden">
                                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2 shadow-inner">
                                    <ScanLine size={24} className="animate-pulse" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                    {activeScanner?.name || "USB / Bluetooth Handheld Barcode Gun Ready"}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 max-w-md mx-auto">
                                    {isKa 
                                        ? "დააჭირეთ სკანერის ღილაკს. შტრიხკოდი ავტომატურად დაიჭერა და დაემატება სისტემაში." 
                                        : "Pull trigger on your handheld scanner. Barcode will ingest and map instantly."}
                                </p>
                                
                                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                        HID Keyboard Wedge Driver Active
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-wider">
                                        <ShieldCheck size={11} />
                                        Background Scanning Supported
                                    </div>
                                </div>
                            </div>

                            {/* Pro Tip on Background Barcode Guns */}
                            <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-[10px] text-indigo-300 flex items-start gap-2">
                                <span className="text-base shrink-0">💡</span>
                                <div>
                                    <strong className="text-white block uppercase tracking-wider mb-0.5">
                                        {isKa ? "რჩევა: სკანირება ფანჯრის გახსნის გარეშეც მუშაობს!" : "Pro Tip: Barcode guns work in the background!"}
                                    </strong>
                                    <span>
                                        {isKa 
                                            ? "USB და Bluetooth სკანერით მუშაობისას არ არის სავალდებულო ამ ფანჯრის გახსნა. შეგიძლიათ პირდაპირ საველე ეკრანზე დაასკანეროთ ყუთები და მუშები!"
                                            : "With a physical barcode gun, you don't even need to open this modal! You can scan workers, crates, and materials from anywhere in the app directly."}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LIVE STATUS BANNER: WHAT WAS SCANNED & WHERE IT WAS MAPPED */}
                    {lastScanItem ? (
                        <div className="mx-4 my-2 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 shadow-lg animate-fade-in flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    <span>{isKa ? "ბოლო სკანირების სტატუსი: დამატებულია & მიბმულია" : "Latest Scan: Processed & Mapped"}</span>
                                </div>
                                <span className="text-[9px] font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded-md">
                                    {lastScanItem.timestamp}
                                </span>
                            </div>

                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-black text-white flex items-center gap-2">
                                        {lastScanItem.type === 'worker' && <User size={15} className="text-blue-400 shrink-0" />}
                                        {lastScanItem.type === 'harvest_box' && <Package size={15} className="text-orange-400 shrink-0" />}
                                        {lastScanItem.type === 'material' && <Layers size={15} className="text-emerald-400 shrink-0" />}
                                        {lastScanItem.type === 'document' && <FileText size={15} className="text-purple-400 shrink-0" />}
                                        <span className="truncate">{lastScanItem.title}</span>
                                    </div>
                                    {lastScanItem.subtitle && (
                                        <p className="text-[10px] font-mono text-slate-300 mt-0.5">
                                            {lastScanItem.subtitle}
                                        </p>
                                    )}
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold shrink-0">
                                    {lastScanItem.code}
                                </span>
                            </div>

                            {/* Destination & Action Taken */}
                            <div className="mt-1 pt-1.5 border-t border-emerald-500/20 flex items-center gap-1.5 text-[10px] text-emerald-300 font-bold">
                                <CornerDownRight size={12} className="shrink-0 text-emerald-400" />
                                <span className="truncate">{lastScanItem.destination}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mx-4 my-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-[10px] text-slate-400 flex items-center justify-center gap-2 font-mono">
                            <Clock size={12} className="text-slate-500" />
                            <span>{isKa ? "დაასკანერეთ შტრიხკოდი სტატუსის და მიმართულების სანახავად" : "Scan any barcode/QR to view live mapping status here"}</span>
                        </div>
                    )}

                    {/* LIVE AUDIT LOG & RECENT SCANS ACCORDION */}
                    {sessionHistory.length > 0 && (
                        <div className="mx-4 mb-2 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                            <div 
                                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                                className="px-3.5 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <History size={13} className="text-blue-400" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                                        {isKa ? `ამ სესიაში დასკანერებული (${sessionHistory.length})` : `Session Scan Log (${sessionHistory.length} items)`}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyHistory();
                                        }}
                                        className="p-1 hover:text-white text-slate-400 transition-colors"
                                        title="Copy scan log"
                                    >
                                        <Copy size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearHistory();
                                        }}
                                        className="p-1 hover:text-rose-400 text-slate-400 transition-colors"
                                        title="Clear session history"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            {/* Expanded List of Session Scans */}
                            {isHistoryExpanded && (
                                <div className="max-h-40 overflow-y-auto divide-y divide-slate-850 p-2 space-y-1">
                                    {sessionHistory.map((item, idx) => (
                                        <div key={item.id} className="py-1.5 px-2 rounded-lg bg-slate-900/60 flex items-center justify-between gap-2 text-[9px]">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-slate-500 font-mono">#{sessionHistory.length - idx}</span>
                                                <span className="text-slate-400 font-mono">[{item.timestamp}]</span>
                                                <span className="font-bold text-white truncate">{item.title}</span>
                                                <span className="text-emerald-400 truncate">→ {item.destination}</span>
                                            </div>
                                            <span className="font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-[8px] shrink-0">
                                                {item.code}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual Ingest Barcode Input (Always available in both modes) */}
                    <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-2 mt-auto">
                        <form onSubmit={handleManualSubmit} className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                                {isKa ? "შტრიხკოდის / QR კოდის ტექსტური ველი (ან ხელით შეყვანა)" : "Scanner Ingest / Manual Code Input"}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                    placeholder={isKa ? "ჩაწერეთ ან დაასკანერეთ კოდი (მაგ: EMP-123, BOX-01, MAT-10)..." : "Type or scan code (e.g. EMP-123, BOX-01, MAT-10)..."}
                                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!manualCode.trim()}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                                >
                                    {isKa ? "მიღება" : "Ingest"}
                                </button>
                            </div>
                        </form>

                        {/* Quick Test Badges (Demo Workers & Boxes) */}
                        {mockEmployees.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-800/60">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                    {isKa ? "სწრაფი ტესტი (თანამშრომლები):" : "Quick Test (Workers):"}
                                </span>
                                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                    {mockEmployees.slice(0, 6).map(emp => {
                                        const code = emp.barcode || emp.idNumber || emp.id;
                                        return (
                                            <button
                                                key={emp.id}
                                                type="button"
                                                onClick={() => handleExecutionOfScan(code)}
                                                className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border ${
                                                    activePickerId === emp.id 
                                                        ? 'bg-blue-600 border-blue-400 text-white' 
                                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                                }`}
                                            >
                                                <User size={9} className="text-blue-400" />
                                                <span>{emp.name} ({code})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls & Generator link */}
                <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
                    {onOpenGenerator ? (
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                onOpenGenerator();
                            }}
                            className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        >
                            <QrCode size={12} />
                            <span>{isKa ? "აგრო-ინპუტების QR გენერატორი" : "Generate Material QR Codes"}</span>
                        </button>
                    ) : <div />}

                    <div className="flex items-center gap-2">
                        {sessionHistory.length > 0 && (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {isKa ? `${sessionHistory.length} დამატებულია` : `${sessionHistory.length} added`}
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                        >
                            {sessionHistory.length > 0 ? (isKa ? "დასრულება და დახურვა" : "Finish & Close") : (isKa ? "დახურვა" : "Close")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QrScannerModal;
