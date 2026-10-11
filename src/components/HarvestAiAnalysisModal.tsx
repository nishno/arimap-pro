
import React, { useState, useMemo } from 'react';
import { X, Sparkles, TrendingUp, Calendar, Target, ListChecks, FileText, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeHarvestSeason } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import type { HarvestEvent } from '../types';

interface HarvestAiAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    harvestEvents: HarvestEvent[];
}

const renderSafeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        if (val._methodName || val.bc !== undefined) {
            return ''; // Hide raw Firestore FieldValue/commands from UI text rendering
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

const renderSafeDate = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'object') {
        if (typeof val.toDate === 'function') {
            return val.toDate().toLocaleDateString();
        }
        if (val.seconds !== undefined) {
            return new Date(val.seconds * 1000).toLocaleDateString();
        }
        if (val._methodName) {
            return ''; // Hide raw Firestore FieldValue
        }
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

const HarvestAiAnalysisModal: React.FC<HarvestAiAnalysisModalProps> = ({ isOpen, onClose, harvestEvents }) => {
    const { language } = useLanguage();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>(harvestEvents.map(e => e.id));
    const [showSelection, setShowSelection] = useState(true);

    const filteredEvents = useMemo(() => {
        return harvestEvents.filter(e => selectedIds.includes(e.id));
    }, [harvestEvents, selectedIds]);

    const handleRunAnalysis = async () => {
        if (filteredEvents.length === 0) {
            toast.error("No harvest data selected for analysis.");
            return;
        }

        setIsAnalyzing(true);
        setShowSelection(false);
        try {
            const analysis = await analyzeHarvestSeason(filteredEvents, language);
            setResult(analysis);
        } catch (error) {
            toast.error("AI Analysis failed. Please try again.");
            console.error(error);
            setShowSelection(true);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const selectYear = (year: number) => {
        const idsInYear = harvestEvents
            .filter(e => new Date(e.plannedStartDate).getFullYear() === year)
            .map(e => e.id);
        setSelectedIds(idsInYear);
    };

    const years = useMemo(() => {
        const y = new Set<number>();
        harvestEvents.forEach(e => y.add(new Date(e.plannedStartDate).getFullYear()));
        return Array.from(y).sort((a, b) => b - a);
    }, [harvestEvents]);

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
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Harvest Intelligence</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Season Analysis & Insights</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {showSelection && !isAnalyzing && (
                            <div className="p-8 space-y-8">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-slate-900 uppercase">Select Events for Analysis</h3>
                                    <p className="text-slate-500 text-sm font-medium">Choose all, specific years, or individual sessions to include in the AI report.</p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => setSelectedIds(harvestEvents.map(e => e.id))}
                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                                    >
                                        Select All
                                    </button>
                                    {years.map(year => (
                                        <button 
                                            key={year}
                                            onClick={() => selectYear(year)}
                                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                                        >
                                            Year {year}
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => setSelectedIds([])}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                                    >
                                        Clear
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {harvestEvents.map(event => {
                                        const isSelected = selectedIds.includes(event.id);
                                        return (
                                            <button
                                                key={event.id}
                                                onClick={() => toggleSelection(event.id)}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                                                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'
                                                }`}
                                            >
                                                <div>
                                                    <p className={`text-xs font-black uppercase ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>{renderSafeString(event.name)}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                        {renderSafeDate(event.plannedStartDate)} • {renderSafeNumber(event.totalNetWeightKg)}kg total
                                                     </p>
                                                </div>
                                                {isSelected ? <CheckCircle2 size={18} className="text-blue-500" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-100" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="pt-8 border-t border-slate-100 flex justify-center">
                                    <button
                                        onClick={handleRunAnalysis}
                                        disabled={selectedIds.length === 0}
                                        className="px-10 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 active:scale-95 transition-all shadow-2xl disabled:opacity-50"
                                    >
                                        <Sparkles size={24} />
                                        Analyze {selectedIds.length} Selected Events
                                    </button>
                                </div>
                            </div>
                        )}

                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-pulse">
                                <Loader2 size={64} className="text-blue-500 animate-spin" />
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 uppercase">Processing Season Data...</h3>
                                    <p className="text-slate-400 text-xs font-black tracking-widest uppercase">Consulting AI Knowledge Base</p>
                                </div>
                            </div>
                        )}

                        {result && !showSelection && !isAnalyzing && (
                            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <button 
                                    onClick={() => setShowSelection(true)}
                                    className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                >
                                    <ChevronRight size={14} className="rotate-180" /> Back to Selection
                                </button>
                                <div className="bg-blue-50/50 rounded-3xl p-8 border border-blue-100">
                                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <TrendingUp size={16} /> Executive Summary
                                    </h3>
                                    <p className="text-slate-800 text-lg font-medium leading-relaxed italic">"{result.summary}"</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Target size={14} /> Productivity Leadership
                                        </h4>
                                        <div className="flex items-center gap-4">
                                            <div className="p-4 bg-green-100 text-green-600 rounded-2xl">
                                                <Target size={32} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Most Productive Variety</p>
                                                <p className="text-2xl font-black text-slate-900 uppercase tracking-tight">{result.mostProductiveCrop}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Calendar size={14} /> Temporal Peaks
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {result.peakDays.map((day: string, i: number) => (
                                                <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                    {day}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <ListChecks size={16} /> Variety Performance Index
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {result.varietyPerformance.map((v: any, i: number) => (
                                            <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-black text-slate-900 uppercase">{v.variety}</h4>
                                                    <p className="text-xs font-medium text-slate-500 mt-1">{v.performance}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</p>
                                                    <p className="text-xl font-black text-blue-600">{Math.round(v.efficiency * 100)}%</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                            <Sparkles size={16} /> AI Recommendations
                                        </h3>
                                        <div className="space-y-3">
                                            {result.recommendations.map((rec: string, i: number) => (
                                                <div key={i} className="flex gap-3 text-sm font-medium text-slate-600">
                                                    <div className="min-w-[6px] h-[6px] bg-blue-500 rounded-full mt-[7px]" />
                                                    {rec}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                            <FileText size={16} /> Seasonal Notes
                                        </h3>
                                        <div className="bg-slate-50 p-4 rounded-2xl text-sm font-medium text-slate-600 border border-slate-100">
                                            {result.seasonalNotes}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                            Close Report
                        </button>
                        {result && (
                            <button
                                onClick={handleRunAnalysis}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                            >
                                <Sparkles size={14} /> Refresh Analysis
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default HarvestAiAnalysisModal;
