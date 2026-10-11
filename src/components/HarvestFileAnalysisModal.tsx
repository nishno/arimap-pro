import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, FileUp, Sparkles, Loader2, User, Weight, Hash, Clock, CheckCircle2, AlertCircle, Pencil, ArrowRight, FileSpreadsheet, ExternalLink, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeHarvestDocument, analyzeHarvestSheetText } from '../services/geminiService';
import { ensureGoogleToken, readSpreadsheet, extractSpreadsheetId, createSpreadsheet } from '../services/googleSheetsService';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import type { HarvestEvent, AssignedPicker, AreaPlantationFeature, Employee } from '../types';

interface HarvestFileAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveEvent: (event: HarvestEvent) => void;
    sectors: AreaPlantationFeature[];
    employees: Employee[];
    onSetEmployees?: (employees: Employee[]) => void;
    harvestEvents?: HarvestEvent[];
    onSetHarvestEvents?: (events: HarvestEvent[]) => void;
}

const renderSafeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        if (val._methodName || val.bc !== undefined) {
            return ''; // Hide raw Firestore FieldValue/commands
        }
        try {
            return val.name || val.title || val.id || '';
        } catch (e) {
            return '';
        }
    }
    return String(val);
};

const renderSafeNumber = (val: any): string => {
    if (val === null || val === undefined) return '0';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? '0' : String(parsed);
    }
    if (typeof val === 'object') {
        if (val.type === 'increment' && typeof val.value === 'number') {
            return String(val.value);
        }
        for (const key of Object.keys(val)) {
            if (typeof val[key] === 'number') {
                return String(val[key]);
            }
        }
        return '0';
    }
    return '0';
};

const renderSafeDateObj = (val: any): Date => {
    if (!val) return new Date(0);
    if (typeof val === 'object') {
        if (typeof val.toDate === 'function') {
            return val.toDate();
        }
        if (val.seconds !== undefined) {
            return new Date(val.seconds * 1000);
        }
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

const renderSafeDate = (val: any): string => {
    return renderSafeDateObj(val).toLocaleDateString();
};

interface SearchableWorkerSelectProps {
    value: string;
    onChange: (val: string) => void;
    employees: Employee[];
}

const SearchableWorkerSelect: React.FC<SearchableWorkerSelectProps> = ({ value, onChange, employees }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedEmp = employees.find(emp => emp.id === value);

    const filteredEmployees = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return employees;
        return employees.filter(emp => {
            const nameMatch = (emp.name || '').toLowerCase().includes(q);
            const overrideMatch = (emp.employeeCodeOverride || '').toLowerCase().includes(q);
            const barcodeMatch = (emp.barcode || '').toLowerCase().includes(q);
            const idNumMatch = (emp.idNumber || '').toLowerCase().includes(q);
            return nameMatch || overrideMatch || barcodeMatch || idNumMatch;
        });
    }, [employees, searchQuery]);

    return (
        <div className="relative w-full md:w-64" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearchQuery('');
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-left flex items-center justify-between shadow-sm hover:border-slate-300 transition-all"
            >
                <span className="truncate">
                    {value === 'create_new' ? (
                        <span className="text-purple-600 font-extrabold">➕ Register as New Worker</span>
                    ) : selectedEmp ? (
                        <span className="text-slate-800">👤 {selectedEmp.name} {selectedEmp.employeeCodeOverride ? `(${selectedEmp.employeeCodeOverride})` : ''}</span>
                    ) : (
                        <span className="text-slate-400">Select Worker...</span>
                    )}
                </span>
                <span className="text-slate-400 text-[10px] ml-2">▼</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-full min-w-[260px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <input
                            type="text"
                            placeholder="🔍 Search name, QR or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('create_new');
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors hover:bg-purple-50 flex items-center gap-2 ${
                                value === 'create_new' ? 'bg-purple-50 text-purple-700' : 'text-slate-700'
                            }`}
                        >
                            ➕ Register as New Worker
                        </button>

                        <div className="border-t border-slate-100 my-1"></div>

                        <div className="px-4 py-1 text-[9px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50">
                            Merge with Existing Employee
                        </div>

                        {filteredEmployees.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                                No workers found
                            </div>
                        ) : (
                            filteredEmployees.map(emp => {
                                const isSelected = emp.id === value;
                                return (
                                    <button
                                        key={emp.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(emp.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-xs font-semibold transition-colors hover:bg-slate-50 flex flex-col ${
                                            isSelected ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700'
                                        }`}
                                    >
                                        <span className="truncate">👤 {emp.name}</span>
                                        {(emp.employeeCodeOverride || emp.barcode || emp.idNumber) && (
                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                Code: {emp.employeeCodeOverride || emp.barcode || emp.idNumber}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const HarvestFileAnalysisModal: React.FC<HarvestFileAnalysisModalProps> = ({ 
    isOpen, 
    onClose, 
    onSaveEvent, 
    sectors, 
    employees,
    onSetEmployees,
    harvestEvents,
    onSetHarvestEvents
}) => {
    const { language } = useLanguage();
    const [file, setFile] = useState<File | null>(null);
    const [sourceMode, setSourceMode] = useState<'upload' | 'google_sheet'>('upload');
    const [googleSheetUrl, setGoogleSheetUrl] = useState('');
    const [googleSheetRange, setGoogleSheetRange] = useState('A1:Z500');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExportingSheet, setIsExportingSheet] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [pickerMappings, setPickerMappings] = useState<Record<number, string>>({});
    const [saveMode, setSaveMode] = useState<'create' | 'merge'>('create');
    const [selectedMergeEventId, setSelectedMergeEventId] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sortedAvailableEvents = useMemo(() => {
        const availableEvents = (harvestEvents || []).filter(e => e.status !== 'deleted');
        return [...availableEvents].sort((a, b) => {
            const dateA = renderSafeDateObj(a.plannedStartDate);
            const dateB = renderSafeDateObj(b.plannedStartDate);
            return dateB.getTime() - dateA.getTime();
        });
    }, [harvestEvents]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleRunAnalysis = async () => {
        if (!file) return;

        setIsAnalyzing(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const analysis = await analyzeHarvestDocument(base64, file.type, language);
                setExtractedData(analysis);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast.error("File analysis failed. Please try a different file.");
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGoogleSheetAnalysis = async () => {
        if (!googleSheetUrl.trim()) {
            toast.error("Please enter a valid Google Sheet URL or ID");
            return;
        }

        setIsAnalyzing(true);
        try {
            const token = await ensureGoogleToken();
            const sheetId = extractSpreadsheetId(googleSheetUrl.trim());
            if (!sheetId) {
                throw new Error("Could not parse a valid Google Sheet ID from URL. Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit");
            }
            const range = googleSheetRange.trim() || 'A1:Z500';
            const sheetData = await readSpreadsheet(sheetId, range, token);
            if (!sheetData.values || sheetData.values.length === 0) {
                throw new Error("The selected Google Sheet or range returned no rows.");
            }

            // Convert spreadsheet tabular cells into a formatted text matrix for Gemini AI parsing
            const sheetText = sheetData.values
                .map((row: any[]) => row.map(cell => String(cell ?? '').trim()).join('\t'))
                .filter((r: string) => r.length > 0)
                .join('\n');

            const analysis = await analyzeHarvestSheetText(sheetText, language);
            setExtractedData(analysis);
            toast.success("Harvest data successfully analyzed and parsed from Google Sheet!");
        } catch (error: any) {
            console.error("Google Sheet harvest analysis error:", error);
            toast.error(error?.message || "Failed to analyze Google Sheet data.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleExportExtractedToGoogleSheets = async () => {
        if (!extractedData) return;
        setIsExportingSheet(true);
        try {
            const token = await ensureGoogleToken();
            const eventName = extractedData.eventName || `Harvest_${extractedData.date || new Date().toISOString().split('T')[0]}`;
            const pickers = extractedData.pickers || [];

            const totalKg = extractedData.totalWeightKg || pickers.reduce((s: number, p: any) => s + (Number(p.weightKg) || 0), 0);
            const totalBoxes = extractedData.totalBoxes || pickers.reduce((s: number, p: any) => s + (Number(p.boxes) || 0), 0);
            const totalPay = pickers.reduce((s: number, p: any) => s + (Number(p.totalPay) || 0), 0);

            const summaryHeaders = ['Metric / Parameter', 'Extracted Value', 'Unit', 'AI Analysis Notes'];
            const summaryRows: any[][] = [
                ['Event Title', eventName, 'Text', 'Parsed from sheet/document'],
                ['Harvest Date', extractedData.date || new Date().toISOString().split('T')[0], 'Date', 'Operational date'],
                ['Crop Variety', extractedData.variety || 'Mixed / Standard', 'Variety', 'Harvest berry variety'],
                ['Total Pickers Registered', pickers.length, 'Persons', 'Active workforce count'],
                ['Total Weight (KG)', Number(totalKg.toFixed(2)), 'KG', 'Combined clean net harvest'],
                ['Total Boxes Collected', totalBoxes, 'Boxes', 'Crates harvested'],
                ['Average Weight per Box', totalBoxes > 0 ? Number((totalKg / totalBoxes).toFixed(2)) : 0, 'KG / Box', 'Density metric'],
                ['Total Picker Compensation', Number(totalPay.toFixed(2)), 'GEL', 'Calculated wage liability']
            ];

            const workerHeaders = ['#', 'Worker Name / Code', 'Harvest Weight (KG)', 'Boxes', 'Hours Worked', 'Pay (GEL)', 'Variety'];
            const workerRows = pickers.map((p: any, idx: number) => [
                idx + 1,
                p.name || `Worker ${idx + 1}`,
                Number(p.weightKg) || 0,
                Number(p.boxes) || 0,
                Number(p.hoursWorked) || 0,
                Number(p.totalPay) || 0,
                p.variety || extractedData.variety || ''
            ]);

            const res = await createSpreadsheet(
                `Harvest_AI_Analysis_${eventName.replace(/[^\w\s-]/gi, '_')}`,
                [
                    {
                        title: 'Harvest_Summary_&_Stats',
                        headers: summaryHeaders,
                        rows: summaryRows
                    },
                    {
                        title: 'Workers_&_Yield',
                        headers: workerHeaders,
                        rows: workerRows
                    }
                ],
                token
            );

            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-bold">Harvest event data exported to Google Sheets!</span>
                    <a href={res.spreadsheetUrl} target="_blank" rel="noreferrer" className="text-emerald-700 dark:text-emerald-300 underline font-mono text-xs flex items-center gap-1">
                        <ExternalLink size={12} /> Open in Google Sheets
                    </a>
                </div>,
                { duration: 9000 }
            );
        } catch (e: any) {
            console.error("Export to Google Sheet failed:", e);
            toast.error(e?.message || "Failed to export harvest data to Google Sheets");
        } finally {
            setIsExportingSheet(false);
        }
    };

    const findEmployeeByName = (name: string): Employee | undefined => {
        if (!name) return undefined;
        const searchName = name.toLowerCase().trim();
        
        // 1. Match by exact or partial name
        const matchByName = employees.find(emp => {
            const fullName = emp.name.toLowerCase().trim();
            return fullName.includes(searchName) || searchName.includes(fullName);
        });
        if (matchByName) return matchByName;

        // 2. Match by employeeCodeOverride (e.g. "QR/N1", "N1", "12")
        const matchByOverride = employees.find(emp => {
            if (emp.employeeCodeOverride) {
                const code = emp.employeeCodeOverride.toLowerCase().trim();
                return code === searchName || code.includes(searchName) || searchName.includes(code);
            }
            return false;
        });
        if (matchByOverride) return matchByOverride;

        // 3. Match by barcode or idNumber
        const matchByBarcode = employees.find(emp => {
            if (emp.barcode) {
                const bc = emp.barcode.toLowerCase().trim();
                const strippedBc = bc.replace(/^bc-/, '');
                return bc === searchName || strippedBc === searchName || bc.includes(searchName) || searchName.includes(bc);
            }
            if (emp.idNumber) {
                const idNum = emp.idNumber.toLowerCase().trim();
                return idNum === searchName || idNum.includes(searchName) || searchName.includes(idNum);
            }
            return false;
        });
        if (matchByBarcode) return matchByBarcode;

        // 4. Fallback: match by numbers (e.g. if the name is a number, match with an employee code/ID/barcode numeric part)
        const isNumeric = /^\d+$/.test(searchName) || /^(qr\/|bc-|n-)\d+$/i.test(searchName);
        if (isNumeric) {
            const numericPart = searchName.replace(/\D/g, '');
            if (numericPart) {
                const matchByNumeric = employees.find(emp => {
                    const empOverrideNum = emp.employeeCodeOverride ? emp.employeeCodeOverride.replace(/\D/g, '') : '';
                    const empBarcodeNum = emp.barcode ? emp.barcode.replace(/\D/g, '') : '';
                    const empIdNum = emp.idNumber ? emp.idNumber.replace(/\D/g, '') : '';
                    const empNameNum = emp.name ? emp.name.replace(/\D/g, '') : '';

                    return (empOverrideNum === numericPart && empOverrideNum !== '') ||
                           (empBarcodeNum === numericPart && empBarcodeNum !== '') ||
                           (empIdNum === numericPart && empIdNum !== '') ||
                           (empNameNum === numericPart && empNameNum !== '');
                });
                if (matchByNumeric) return matchByNumeric;
            }
        }

        return undefined;
    };

    // Initialize mappings when extractedData loads
    useEffect(() => {
        if (extractedData && extractedData.pickers) {
            const initialMappings: Record<number, string> = {};
            (extractedData?.pickers || []).forEach((p: any, i: number) => {
                const match = findEmployeeByName(p.name);
                if (match) {
                    initialMappings[i] = match.id;
                } else {
                    initialMappings[i] = 'create_new'; // Default to creating a new HR record
                }
            });
            setPickerMappings(initialMappings);
        }
    }, [extractedData, employees]);

    const handleMappingChange = (index: number, value: string) => {
        setPickerMappings(prev => ({
            ...prev,
            [index]: value
        }));
    };

    const handleCreateEvent = () => {
        if (!extractedData) return;

        const newEmployeesToCreate: Employee[] = [];
        const finalAssignedPickers: AssignedPicker[] = [];

        // If merging, clone existing event's assigned pickers first
        let existingEvent: HarvestEvent | undefined = undefined;
        if (saveMode === 'merge' && selectedMergeEventId) {
            existingEvent = (harvestEvents || []).find(e => e.id === selectedMergeEventId);
            if (existingEvent) {
                finalAssignedPickers.push(...JSON.parse(JSON.stringify(existingEvent.assignedPickers || [])));
            }
        }

        (extractedData?.pickers || []).forEach((p: any, i: number) => {
            const mappedValue = pickerMappings[i];
            let targetEmployeeId = '';
            let paymentRate = 0;

            if (mappedValue === 'create_new') {
                // Dynamic generation of a new HR employee
                const newEmpId = `emp-auto-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;
                const isCode = /^(qr\/|bc-|\d+$|n-)/i.test(p.name);
                const empName = isCode ? `Worker ${p.name}` : p.name;
                const overrideCode = isCode ? p.name : undefined;

                const newEmp: Employee = {
                    id: newEmpId,
                    name: empName,
                    idNumber: `ID-AUTO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                    employeeType: 'Seasonal',
                    email: '',
                    phone: '',
                    roleId: '6', // Standard picker role
                    paymentType: p.hoursWorked ? 'hourly' : 'per_weight',
                    paymentRate: p.hoursWorked ? 6.2 : 0.4, // standard default rates
                    accountType: 'Cash',
                    barcode: `BC-${Date.now()}-${i}`,
                    employeeCodeOverride: overrideCode,
                    status: 'active',
                    joinedAt: new Date().toISOString()
                };
                newEmployeesToCreate.push(newEmp);
                targetEmployeeId = newEmpId;
                paymentRate = newEmp.paymentRate;
            } else {
                const matchedEmp = employees.find(emp => emp.id === mappedValue);
                targetEmployeeId = mappedValue;
                paymentRate = matchedEmp?.paymentRate || 0;
            }

            if (saveMode === 'merge' && existingEvent) {
                // If this picker is already assigned in the existing event, merge their weights/boxes/hours
                const existingPickerIndex = finalAssignedPickers.findIndex(ap => ap.employeeId === targetEmployeeId);
                if (existingPickerIndex !== -1) {
                    finalAssignedPickers[existingPickerIndex].manualNetWeight = (finalAssignedPickers[existingPickerIndex].manualNetWeight || 0) + (p.weightKg || 0);
                    finalAssignedPickers[existingPickerIndex].manualBoxes = (finalAssignedPickers[existingPickerIndex].manualBoxes || 0) + (p.boxes || 0);
                    finalAssignedPickers[existingPickerIndex].manualHours = (finalAssignedPickers[existingPickerIndex].manualHours || 0) + (p.hoursWorked || 0);
                } else {
                    finalAssignedPickers.push({
                        employeeId: targetEmployeeId,
                        paymentModel: p.hoursWorked ? 'hourly' : 'per_weight',
                        rate: paymentRate,
                        manualNetWeight: p.weightKg || 0,
                        manualBoxes: p.boxes || 0,
                        manualHours: p.hoursWorked || 0
                    });
                }
            } else {
                finalAssignedPickers.push({
                    employeeId: targetEmployeeId,
                    paymentModel: p.hoursWorked ? 'hourly' : 'per_weight',
                    rate: paymentRate,
                    manualNetWeight: p.weightKg || 0,
                    manualBoxes: p.boxes || 0,
                    manualHours: p.hoursWorked || 0
                });
            }
        });

        // Save newly generated seasonal employees to the HR database
        if (newEmployeesToCreate.length > 0 && onSetEmployees) {
            onSetEmployees([...employees, ...newEmployeesToCreate]);
            toast.success(`Registered ${newEmployeesToCreate.length} new worker(s) in HR database.`);
        }

        if (saveMode === 'merge' && existingEvent && onSetHarvestEvents) {
            // Merge into existing event
            const updatedEvent: HarvestEvent = {
                ...existingEvent,
                assignedPickers: finalAssignedPickers,
                totalBoxes: (existingEvent.totalBoxes || 0) + (extractedData.totalBoxes || 0),
                totalNetWeightKg: (existingEvent.totalNetWeightKg || 0) + (extractedData.totalWeightKg || 0),
            };

            // If variety doesn't exist, append it
            if (extractedData.variety) {
                const currentVarieties = existingEvent.varieties || [];
                if (!currentVarieties.includes(extractedData.variety)) {
                    updatedEvent.varieties = [...currentVarieties, extractedData.variety];
                }
            }

            onSetHarvestEvents((harvestEvents || []).map(e => e.id === existingEvent!.id ? updatedEvent : e));
            toast.success(`Harvest entries successfully appended to existing session.`);
            onClose();
        } else {
            // Create brand new event
            const newEvent: HarvestEvent = {
                id: `hev-${Date.now()}`,
                name: extractedData.eventName || `Harvest - ${new Date().toLocaleDateString()}`,
                sectorId: sectors[0]?.id || '',
                sectorIds: sectors[0] ? [sectors[0].id] : [],
                plannedStartDate: extractedData.date || new Date().toISOString(),
                status: 'completed',
                isAiGenerated: true, // Mark this event as AI-Generated for Post-Harvest Archive
                assignedPickers: finalAssignedPickers,
                assignedVehicles: [],
                materialsUsed: [],
                totalBoxes: extractedData.totalBoxes || 0,
                totalPickerCost: 0,
                totalNetWeightKg: extractedData.totalWeightKg || 0,
                totalPackagingCost: 0,
                totalPallets: 0,
                totalVehicleCost: 0,
                breaks: [],
                varieties: [extractedData.variety || (sectors[0]?.cropVariety ? (Array.isArray(sectors[0].cropVariety) ? sectors[0].cropVariety[0] : sectors[0].cropVariety) : '')].filter(Boolean) as string[]
            };

            onSaveEvent(newEvent);
            toast.success("Harvest session successfully created and logged to the Post-Harvest Analytical Archive.");
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20"
                >
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Harvest File Analysis</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Automatic Batch Entry & OCR</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        {!extractedData && !isAnalyzing && (
                            <div className="space-y-6">
                                {/* Source Selector Tabs */}
                                <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setSourceMode('upload')}
                                        className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                                            sourceMode === 'upload'
                                                ? 'bg-white text-purple-700 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <FileUp size={15} /> Upload File (Image / PDF)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSourceMode('google_sheet')}
                                        className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                                            sourceMode === 'google_sheet'
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <FileSpreadsheet size={15} /> Google Sheets Import
                                    </button>
                                </div>

                                {sourceMode === 'upload' ? (
                                    <>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer group"
                                        >
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                onChange={handleFileChange} 
                                                className="hidden" 
                                                accept="image/*,application/pdf"
                                            />
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-purple-500 transition-all">
                                                <FileUp size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 uppercase">Upload Harvest Sheet</h3>
                                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Drop Image or PDF here</p>
                                            </div>
                                            {file && (
                                                <div className="px-4 py-2 bg-white border border-slate-200 rounded-full flex items-center gap-2 text-xs font-black text-slate-600">
                                                    <CheckCircle2 size={14} className="text-green-500" />
                                                    {file.name}
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                                            <AlertCircle size={18} className="text-slate-400" />
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                AI will automatically extract worker names, quantities, and work hours from your document.
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleRunAnalysis}
                                            disabled={!file}
                                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                                        >
                                            <Sparkles size={20} />
                                            Analyze & Extract
                                        </button>
                                    </>
                                ) : (
                                    <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                                                <FileSpreadsheet size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-black text-slate-900 uppercase">Import Harvest Data from Google Sheet</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paste Spreadsheet link or ID to let Gemini AI parse rows</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                                                Google Spreadsheet URL or Sheet ID
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={googleSheetUrl}
                                                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                                                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 shadow-sm"
                                                />
                                                <LinkIcon size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                                                    Sheet Range / Tab
                                                </label>
                                                <input
                                                    type="text"
                                                    value={googleSheetRange}
                                                    onChange={(e) => setGoogleSheetRange(e.target.value)}
                                                    placeholder="A1:Z500 or Sheet1!A1:M200"
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <p className="text-[10px] text-slate-500 italic">
                                                    Reads raw rows and uses Gemini to identify worker codes, Georgian names, net kg, boxes & wages.
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleGoogleSheetAnalysis}
                                            disabled={!googleSheetUrl.trim()}
                                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all mt-4"
                                        >
                                            <Sparkles size={18} />
                                            Import from Google Sheet & Analyze with AI
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                                <Loader2 size={64} className="text-purple-500 animate-spin" />
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Extracting Harvest Data...</h3>
                                    <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase">Scanning for weights and totals</p>
                                </div>
                            </div>
                        )}

                        {extractedData && (
                            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Session Data</h3>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xl font-black text-slate-900 uppercase">{extractedData.eventName}</h4>
                                            <button onClick={() => setIsEditing(!isEditing)} className="p-1 px-2 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900">
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                        <p className="text-xs font-bold text-slate-500">{extractedData.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Extraction Confidence</div>
                                        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black">HIGH</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Net Yield</p>
                                        <div className="flex items-center gap-2">
                                            <Weight size={18} className="text-purple-500" />
                                            <p className="text-xl font-black text-slate-900">{extractedData.totalWeightKg} kg</p>
                                        </div>
                                    </div>
                                    {extractedData.variety && (
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Detected Variety</p>
                                            <p className="text-sm font-black text-slate-900 uppercase">{extractedData.variety}</p>
                                        </div>
                                    )}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Containers</p>
                                        <div className="flex items-center gap-2">
                                            <Hash size={18} className="text-purple-500" />
                                            <p className="text-xl font-black text-slate-900">{extractedData.totalBoxes} units</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4">
                                    <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest block mb-2">
                                        Target Destination
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSaveMode('create')}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                saveMode === 'create'
                                                    ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-500/10'
                                                    : 'bg-white/50 border-slate-200 hover:border-slate-300 text-slate-500'
                                            }`}
                                        >
                                            <div className="font-extrabold text-xs uppercase text-slate-900">🆕 Create New Event</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">Register a brand new harvest session</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSaveMode('merge');
                                                if (!selectedMergeEventId && sortedAvailableEvents.length > 0) {
                                                    setSelectedMergeEventId(sortedAvailableEvents[0].id);
                                                }
                                            }}
                                            disabled={sortedAvailableEvents.length === 0}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                saveMode === 'merge'
                                                    ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-500/10'
                                                    : 'bg-white/50 border-slate-200 hover:border-slate-300 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed'
                                            }`}
                                        >
                                            <div className="font-extrabold text-xs uppercase text-slate-900">➕ Append to Existing</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {sortedAvailableEvents.length === 0 
                                                    ? 'No existing events available' 
                                                    : 'Add paper entries to active/past event'}
                                            </div>
                                        </button>
                                    </div>

                                    {saveMode === 'merge' && sortedAvailableEvents.length > 0 && (
                                        <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">
                                                Select Harvest Event to Append
                                            </label>
                                            <select
                                                value={selectedMergeEventId}
                                                onChange={(e) => setSelectedMergeEventId(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                                            >
                                                {sortedAvailableEvents.map(evt => {
                                                    const evtName = renderSafeString(evt.name);
                                                    const pickerCount = evt.assignedPickers?.length || 0;
                                                    const dateStr = renderSafeDate(evt.plannedStartDate);
                                                    return (
                                                        <option key={evt.id} value={evt.id}>
                                                            🗓️ {evtName} ({dateStr}) — {renderSafeNumber(evt.totalNetWeightKg)}kg • {pickerCount} workers
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Worker Recognition & Merge controls</h3>
                                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase">Verify & Link HR Records</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {(extractedData?.pickers || []).map((p: any, i: number) => {
                                            const matchedEmp = findEmployeeByName(p.name);
                                            const currentMappedId = pickerMappings[i] || '';

                                            return (
                                                <div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${matchedEmp ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {matchedEmp ? <CheckCircle2 size={18} /> : <User size={18} />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-black text-slate-900 uppercase">{p.name}</p>
                                                                {matchedEmp && currentMappedId === matchedEmp.id && (
                                                                    <span className="px-1.5 py-0.5 bg-green-100 text-[#166534] text-[8px] font-black uppercase rounded tracking-widest leading-none">AUTO MATCH</span>
                                                                )}
                                                                {currentMappedId === 'create_new' && (
                                                                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[8px] font-black uppercase rounded tracking-widest leading-none">CREATE NEW HR</span>
                                                                )}
                                                                {currentMappedId !== 'create_new' && currentMappedId !== (matchedEmp?.id || '') && (
                                                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase rounded tracking-widest leading-none">MANUALLY MERGED</span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-4 mt-1">
                                                                {p.weightKg > 0 && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.weightKg} kg</span>}
                                                                {p.hoursWorked > 0 && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {p.hoursWorked}h</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0">
                                                        <ArrowRight size={14} className="text-slate-400 hidden md:block" />
                                                        <SearchableWorkerSelect
                                                            value={currentMappedId}
                                                            onChange={(val) => handleMappingChange(i, val)}
                                                            employees={employees || []}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                            Cancel
                        </button>
                        
                        <div className="flex items-center gap-2">
                            {extractedData && (
                                <button
                                    type="button"
                                    onClick={handleExportExtractedToGoogleSheets}
                                    disabled={isExportingSheet}
                                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95 transition-all"
                                >
                                    {isExportingSheet ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                                    {isExportingSheet ? 'Exporting...' : 'Export to Google Sheets'}
                                </button>
                            )}

                            {extractedData && (
                                <button
                                    onClick={handleCreateEvent}
                                    className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <CheckCircle2 size={16} />
                                    {saveMode === 'create' ? 'Create Harvest Session' : 'Merge & Append to Event'}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default HarvestFileAnalysisModal;
