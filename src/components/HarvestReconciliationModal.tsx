import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, FileUp, Sparkles, Loader2, User, Weight, Hash, Clock, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, FileDiff, CheckSquare, Square, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeAndCompareHarvestDocument } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import type { HarvestEvent, AssignedPicker, Employee } from '../types';

interface HarvestReconciliationModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    onSetEmployees?: (employees: Employee[]) => void;
    harvestEvents: HarvestEvent[];
    onSetHarvestEvents: (events: HarvestEvent[]) => void;
    onLogActivity?: (action: string, module: any, status: any, report?: string) => any;
}

const renderSafeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        if (val._methodName || val.bc !== undefined) return '';
        try {
            return val.name || val.title || val.id || '';
        } catch (e) {
            return '';
        }
    }
    return String(val);
};

const renderSafeNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

const renderSafeDate = (val: any): string => {
    if (!val) return '';
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

export const HarvestReconciliationModal: React.FC<HarvestReconciliationModalProps> = ({
    isOpen,
    onClose,
    employees,
    onSetEmployees,
    harvestEvents,
    onSetHarvestEvents,
    onLogActivity
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [auditResult, setAuditResult] = useState<any>(null);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Active/Past completed sessions for dropdown list
    const availableEvents = useMemo(() => {
        return (harvestEvents || [])
            .filter(e => e.status !== 'deleted' && !e.isDeleted)
            .sort((a, b) => new Date(b.plannedStartDate).getTime() - new Date(a.plannedStartDate).getTime());
    }, [harvestEvents]);

    const selectedEvent = useMemo(() => {
        return availableEvents.find(e => e.id === selectedEventId);
    }, [availableEvents, selectedEventId]);

    // Set default selected event
    useEffect(() => {
        if (isOpen && availableEvents.length > 0 && !selectedEventId) {
            setSelectedEventId(availableEvents[0].id);
        }
    }, [isOpen, availableEvents, selectedEventId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleRunCompare = async () => {
        if (!selectedEvent) {
            toast.error(isKa ? "გთხოვთ აირჩიოთ მოსავლის აღების სესია" : "Please select a harvest session first.");
            return;
        }
        if (!file) {
            toast.error(isKa ? "გთხოვთ ატვირთოთ ფაილი" : "Please upload a paper sheet file.");
            return;
        }

        setIsAnalyzing(true);
        try {
            // Build event data package to feed Gemini comparison
            const eventDataPackage = {
                id: selectedEvent.id,
                name: selectedEvent.name,
                date: renderSafeDate(selectedEvent.plannedStartDate),
                totalWeightKg: renderSafeNumber(selectedEvent.totalNetWeightKg),
                totalBoxes: renderSafeNumber(selectedEvent.totalBoxes),
                pickers: (selectedEvent.assignedPickers || []).map(p => {
                    const emp = employees.find(e => e.id === p.employeeId);
                    return {
                        employeeId: p.employeeId,
                        name: emp ? emp.name : 'Unknown',
                        code: emp?.employeeCodeOverride || '',
                        weightKg: renderSafeNumber(p.manualNetWeight),
                        boxes: renderSafeNumber(p.manualBoxes),
                        hours: renderSafeNumber(p.manualHours)
                    };
                })
            };

            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const audit = await analyzeAndCompareHarvestDocument(base64, file.type, eventDataPackage, language);
                
                setAuditResult(audit);
                // Default all suggestions to true (checked)
                const initialSugs: Record<string, boolean> = {};
                (audit?.suggestions || []).forEach((s: any) => {
                    initialSugs[s.id] = true;
                });
                setSelectedSuggestions(initialSugs);
                toast.success(isKa ? "შედარება წარმატებით დასრულდა!" : "Discrepancy audit completed successfully!");
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast.error(isKa ? "ანალიზი ჩაიშალა. გთხოვთ სცადოთ სხვა ფაილი." : "Analysis failed. Please try again with another file.");
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleSuggestion = (id: string) => {
        setSelectedSuggestions(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleApplyReconciliation = () => {
        if (!selectedEvent || !auditResult) return;

        const newEmployeesToCreate: Employee[] = [];
        let updatedPickers = [...(selectedEvent.assignedPickers || [])];

        const activeSuggestions = (auditResult.suggestions || []).filter((s: any) => selectedSuggestions[s.id]);

        activeSuggestions.forEach((s: any) => {
            if (s.action === 'update_picker_weight') {
                // Find index
                const idx = updatedPickers.findIndex(p => p.employeeId === s.employeeId);
                if (idx !== -1) {
                    updatedPickers[idx] = {
                        ...updatedPickers[idx],
                        manualNetWeight: renderSafeNumber(s.suggestedWeight),
                        manualBoxes: s.suggestedBoxes !== undefined ? renderSafeNumber(s.suggestedBoxes) : updatedPickers[idx].manualBoxes,
                        manualHours: s.suggestedHours !== undefined ? renderSafeNumber(s.suggestedHours) : updatedPickers[idx].manualHours
                    };
                }
            } else if (s.action === 'add_picker') {
                // Check if employee exists by ID, name, or by numeric code/number
                let empId = s.employeeId;
                if (!empId) {
                    const cleanName = (s.pickerName || '').toLowerCase().trim();
                    const workerNum = (s.workerNumber || '').trim();
                    
                    const existingEmp = employees.find(e => {
                        if (e.name.toLowerCase().trim() === cleanName) return true;
                        if (workerNum && e.employeeCodeOverride === workerNum) return true;
                        if (workerNum && e.name.includes(workerNum)) return true;
                        return false;
                    });

                    if (existingEmp) {
                        empId = existingEmp.id;
                    } else {
                        // Create a new seasonal worker dynamically (like HarvestFileAnalysisModal)
                        const newEmpId = `emp-reconciled-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        const isCode = /^(qr\/|bc-|\d+$|n-)/i.test(s.pickerName);
                        const empName = isCode ? `Worker ${s.pickerName}` : s.pickerName;
                        const overrideCode = s.workerNumber || (isCode ? s.pickerName : undefined);

                        const newEmp: Employee = {
                            id: newEmpId,
                            name: empName,
                            idNumber: `ID-REC-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                            employeeType: 'Seasonal',
                            email: '',
                            phone: '',
                            roleId: '6', // Picker role
                            paymentType: s.suggestedHours ? 'hourly' : 'per_weight',
                            paymentRate: s.suggestedHours ? 6.2 : 0.4,
                            accountType: 'Cash',
                            barcode: `BC-REC-${Date.now()}`,
                            employeeCodeOverride: overrideCode,
                            status: 'active',
                            joinedAt: new Date().toISOString()
                        };
                        newEmployeesToCreate.push(newEmp);
                        empId = newEmpId;
                    }
                }

                // Push new picker
                const alreadyAssigned = updatedPickers.some(p => p.employeeId === empId);
                if (!alreadyAssigned) {
                    updatedPickers.push({
                        employeeId: empId,
                        paymentModel: s.suggestedHours ? 'hourly' : 'per_weight',
                        rate: s.suggestedHours ? 6.2 : 0.4,
                        manualNetWeight: renderSafeNumber(s.suggestedWeight),
                        manualBoxes: renderSafeNumber(s.suggestedBoxes),
                        manualHours: renderSafeNumber(s.suggestedHours)
                    });
                } else {
                    // Update instead
                    const idx = updatedPickers.findIndex(p => p.employeeId === empId);
                    if (idx !== -1) {
                        updatedPickers[idx] = {
                            ...updatedPickers[idx],
                            manualNetWeight: renderSafeNumber(s.suggestedWeight),
                            manualBoxes: renderSafeNumber(s.suggestedBoxes),
                            manualHours: renderSafeNumber(s.suggestedHours)
                        };
                    }
                }
            } else if (s.action === 'remove_picker') {
                if (s.employeeId) {
                    updatedPickers = updatedPickers.filter(p => p.employeeId !== s.employeeId);
                }
            }
        });

        // Save newly generated seasonal employees to the HR database
        if (newEmployeesToCreate.length > 0 && onSetEmployees) {
            onSetEmployees([...employees, ...newEmployeesToCreate]);
            toast.success(
                isKa 
                    ? `დარეგისტრირდა ${newEmployeesToCreate.length} ახალი სეზონური მუშა.` 
                    : `Registered ${newEmployeesToCreate.length} new seasonal worker(s) in HR database.`
            );
        }

        // Compute reconciled total weight and boxes based on individual picker entries
        const reconciledTotalWeight = updatedPickers.reduce((sum, p) => sum + (p.manualNetWeight || 0), 0);
        const reconciledTotalBoxes = updatedPickers.reduce((sum, p) => sum + (p.manualBoxes || 0), 0);

        // Update target event
        const reconciledEvent: HarvestEvent = {
            ...selectedEvent,
            assignedPickers: updatedPickers,
            totalNetWeightKg: parseFloat(reconciledTotalWeight.toFixed(2)),
            totalBoxes: reconciledTotalBoxes
        };

        onSetHarvestEvents(harvestEvents.map(e => e.id === selectedEvent.id ? reconciledEvent : e));
        
        if (onLogActivity) {
            onLogActivity(
                'Harvest Reconciled',
                'harvesting',
                'success',
                `Reconciled harvest session "${selectedEvent.name}" with paper audit. Updated weight to ${reconciledTotalWeight}kg.`
            );
        }

        toast.success(
            isKa 
                ? "მოსავლის მონაცემები წარმატებით შესწორდა ქაღალდის ჟურნალის შესაბამისად!" 
                : "Harvest records successfully reconciled and aligned with paper log!"
        );
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                <FileDiff size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                    {isKa ? 'ქაღალდის ჟურნალის შედარება' : 'AI Paper Reconciliation'}
                                </h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    {isKa ? 'მოსავლის შემოწმება & კორექტირება' : 'Harvest Audit & Corrective Alignment'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {!auditResult && !isAnalyzing && (
                            <div className="space-y-6">
                                {/* Session Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                        {isKa ? 'აირჩიეთ მოსავლის სესია' : 'Select Harvest Session to Audit'}
                                    </label>
                                    <select
                                        value={selectedEventId}
                                        onChange={(e) => {
                                            setSelectedEventId(e.target.value);
                                            setAuditResult(null);
                                        }}
                                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                                    >
                                        <option value="">{isKa ? 'აირჩიეთ სესია...' : 'Select a session...'}</option>
                                        {availableEvents.map(evt => (
                                            <option key={evt.id} value={evt.id}>
                                                🗓️ {renderSafeString(evt.name)} ({renderSafeDate(evt.plannedStartDate)}) — {renderSafeNumber(evt.totalNetWeightKg).toFixed(1)} kg ({renderSafeNumber(evt.totalBoxes)} boxes)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Drag-Drop Area */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer group"
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="image/*,application/pdf"
                                    />
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-500 transition-all">
                                        <FileUp size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 uppercase">
                                            {isKa ? 'ატვირთეთ ქაღალდის ჟურნალი' : 'Upload Physical Paper Log'}
                                        </h3>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                            {isKa ? 'ჩააგდეთ სურათი ან PDF აქ' : 'Drop Image or PDF here'}
                                        </p>
                                    </div>
                                    {file && (
                                        <div className="px-4 py-2 bg-white border border-slate-200 rounded-full flex items-center gap-2 text-xs font-black text-slate-600">
                                            <CheckCircle2 size={14} className="text-green-500" />
                                            {file.name}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                                    <Info size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide leading-relaxed">
                                        {isKa 
                                            ? "AI ავტომატურად გაანალიზებს ფურცელზე დაწერილ მონაცემებს, შეადარებს სისტემაში არსებულ ჩანაწერებს, აღმოაჩენს უზუსტობებს და შემოგთავაზებთ კორექტირებას, რათა მონაცემები სრულ თანხვედრაში იყოს." 
                                            : "AI will automatically analyze the handwritten paper totals, cross-reference them with system data, pinpoint mismatches per picker, and supply corrective suggestions to align your records."}
                                    </p>
                                </div>

                                <button
                                    onClick={handleRunCompare}
                                    disabled={!file || !selectedEventId}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                                >
                                    <Sparkles size={20} />
                                    {isKa ? 'ანალიზი & შედარება' : 'Analyze & Cross-Reference'}
                                </button>
                            </div>
                        )}

                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                                <Loader2 size={64} className="text-indigo-500 animate-spin" />
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                                        {isKa ? 'მიმდინარეობს აუდიტი...' : 'Performing Discrepancy Audit...'}
                                    </h3>
                                    <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase mt-1">
                                        {isKa ? 'ხდება ხელნაწერი ფაილის გაშიფვრა და შედარება' : 'Parsing handwritten table and cross-matching fields'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {auditResult && (
                            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                                {/* Summary banner */}
                                <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${
                                                auditResult.summary?.discrepancySeverity === 'HIGH' 
                                                    ? 'bg-red-100 text-red-700' 
                                                    : auditResult.summary?.discrepancySeverity === 'MEDIUM' 
                                                    ? 'bg-amber-100 text-amber-700' 
                                                    : 'bg-green-100 text-green-700'
                                            }`}>
                                                {isKa ? 'კონფლიქტის დონე' : 'Severity'}: {auditResult.summary?.discrepancySeverity}
                                            </span>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-2">
                                                {isKa ? 'აუდიტის დასკვნა' : 'AI Audit Verdict'}
                                            </h3>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setAuditResult(null);
                                                setFile(null);
                                            }} 
                                            className="text-xs font-black text-indigo-600 hover:underline uppercase tracking-widest flex items-center gap-1"
                                        >
                                            <RefreshCw size={12} /> {isKa ? 'ახალი ფაილი' : 'Upload New'}
                                        </button>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600 leading-relaxed italic">
                                        "{auditResult.summary?.generalVerdict}"
                                    </p>
                                </div>

                                {/* Comparison Table */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            {isKa ? 'მოსავლის ჯამური წონა (KG)' : 'Total Harvest Weight (KG)'}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">{isKa ? 'სისტემა' : 'System'}</p>
                                                <p className="text-lg font-black text-slate-700">{auditResult.summary?.systemTotalWeight} kg</p>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300" />
                                            <div>
                                                <p className="text-[10px] font-bold text-indigo-500">{isKa ? 'ქაღალდი' : 'Paper Sheet'}</p>
                                                <p className="text-lg font-black text-indigo-600">{auditResult.summary?.paperTotalWeight} kg</p>
                                            </div>
                                            <div className={`px-2 py-1 rounded-lg text-xs font-black ${
                                                renderSafeNumber(auditResult.summary?.differenceWeight) === 0 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {renderSafeNumber(auditResult.summary?.differenceWeight) > 0 ? '+' : ''}
                                                {auditResult.summary?.differenceWeight} kg
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            {isKa ? 'ყუთების ჯამური რაოდენობა' : 'Total Boxes (Containers)'}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400">{isKa ? 'სისტემა' : 'System'}</p>
                                                <p className="text-lg font-black text-slate-700">{auditResult.summary?.systemTotalBoxes} pcs</p>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300" />
                                            <div>
                                                <p className="text-[10px] font-bold text-indigo-500">{isKa ? 'ქაღალდი' : 'Paper Sheet'}</p>
                                                <p className="text-lg font-black text-indigo-600">{auditResult.summary?.paperTotalBoxes} pcs</p>
                                            </div>
                                            <div className={`px-2 py-1 rounded-lg text-xs font-black ${
                                                renderSafeNumber(auditResult.summary?.differenceBoxes) === 0 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {renderSafeNumber(auditResult.summary?.differenceBoxes) > 0 ? '+' : ''}
                                                {auditResult.summary?.differenceBoxes} pcs
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Discrepancy details */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                                        {isKa ? 'აღმოჩენილი უზუსტობები' : 'Detected Discrepancies'}
                                    </h4>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                        {auditResult.discrepancies?.length === 0 ? (
                                            <div className="p-4 text-center bg-green-50 text-green-700 rounded-2xl border border-green-100 text-xs font-bold">
                                                ✅ {isKa ? 'უზუსტობები არ არის აღმოჩენილი! მონაცემები ემთხვევა.' : 'No discrepancies found! Everything perfectly matches.'}
                                            </div>
                                        ) : (
                                            auditResult.discrepancies?.map((disc: any, i: number) => (
                                                <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-start gap-3 text-xs">
                                                    <div className={`p-1.5 rounded-xl mt-0.5 ${
                                                        disc.discrepancyType === 'missing_in_system' 
                                                            ? 'bg-red-100 text-red-600' 
                                                            : disc.discrepancyType === 'missing_on_paper' 
                                                            ? 'bg-amber-100 text-amber-600' 
                                                            : 'bg-orange-100 text-orange-600'
                                                    }`}>
                                                        <AlertCircle size={14} />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-black text-slate-800 uppercase">{disc.pickerName}</span>
                                                                {disc.workerNumber && (
                                                                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-slate-200/80 text-slate-700 rounded border border-slate-300">
                                                                        #{disc.workerNumber}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                                                disc.discrepancyType === 'missing_in_system' 
                                                                    ? 'bg-red-100 text-red-700' 
                                                                    : disc.discrepancyType === 'missing_on_paper' 
                                                                    ? 'bg-amber-100 text-amber-700' 
                                                                    : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                                {disc.discrepancyType === 'missing_in_system' 
                                                                    ? (isKa ? 'აკლია სისტემაში' : 'Missing in System') 
                                                                    : disc.discrepancyType === 'missing_on_paper' 
                                                                    ? (isKa ? 'აკლია ქაღალდზე' : 'Missing on Paper') 
                                                                    : (isKa ? 'წონის სხვაობა' : 'Weight Mismatch')}
                                                            </span>
                                                        </div>
                                                        <div className="text-slate-500 font-bold flex gap-4">
                                                            <span>{isKa ? 'სისტემა' : 'System'}: {disc.systemWeight || 0} kg</span>
                                                            <span>{isKa ? 'ქაღალდი' : 'Paper'}: {disc.paperWeight || 0} kg</span>
                                                            <span className="font-extrabold text-slate-700">
                                                                {isKa ? 'სხვაობა' : 'Diff'}: {disc.differenceWeight > 0 ? '+' : ''}{disc.differenceWeight} kg
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium">{disc.reason}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Corrective Actions Checklist */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                            {isKa ? 'შემოთავაზებული შესწორებები' : 'Recommended Corrective Actions'}
                                        </h4>
                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            {isKa ? 'სინქრონიზაციის გეგმა' : 'Auto Sync Plan'}
                                        </span>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {auditResult.suggestions?.map((sug: any) => {
                                            const isChecked = selectedSuggestions[sug.id] || false;
                                            return (
                                                <div 
                                                    key={sug.id}
                                                    onClick={() => toggleSuggestion(sug.id)}
                                                    className={`border rounded-2xl p-4 flex gap-3 items-start cursor-pointer transition-all select-none ${
                                                        isChecked 
                                                            ? 'border-indigo-500 bg-indigo-50/40 shadow-sm' 
                                                            : 'border-slate-100 bg-white hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="text-indigo-600 mt-0.5">
                                                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-black text-xs text-slate-900 uppercase">
                                                                    {sug.action === 'add_picker' 
                                                                        ? (isKa ? '➕ მუშის დამატება' : '➕ Add Missing Picker')
                                                                        : sug.action === 'remove_picker'
                                                                        ? (isKa ? '❌ მუშის ამოშლა' : '❌ Remove Picker')
                                                                        : (isKa ? '✏️ წონის განახლება' : '✏️ Update Weight')}
                                                                </span>
                                                                {sug.workerNumber && (
                                                                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                                                                        #{sug.workerNumber}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                                                                {sug.suggestedWeight ? `${sug.suggestedWeight} kg` : ''}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 font-semibold">{sug.description}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                            {isKa ? 'დახურვა' : 'Close'}
                        </button>
                        {auditResult && (
                            <button
                                onClick={handleApplyReconciliation}
                                disabled={!Object.values(selectedSuggestions).some(Boolean)}
                                className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                            >
                                <CheckCircle2 size={16} />
                                {isKa ? 'შესწორებების ასახვა (1-Click)' : 'Apply Selected Corrections'}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
