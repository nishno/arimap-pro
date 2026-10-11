import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Sparkles, 
    Briefcase, 
    Leaf, 
    Crown, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    TrendingUp, 
    ShieldCheck, 
    RefreshCw, 
    ChevronRight, 
    Lightbulb, 
    Layers, 
    BarChart3, 
    Wrench, 
    X,
    Minus,
    Maximize2,
    Minimize2,
    ArrowLeftRight,
    ArrowUpDown,
    Building2,
    Zap,
    BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { appEngine } from '../AppEventEngine';
import { 
    WorkTaskAnalysisResult, 
    OmniscientGodAIMatrix, 
    LearnedHeuristic, 
    AIAssistantMode 
} from '../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { safeStorage } from '../../services/storageService';

interface GodAIIntelligenceHubModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeOrgId?: string;
    activeOrgName?: string;
    currentUser: any;
    isSystemAdmin: boolean;
    workAssignments: any[];
    harvestEntries: any[];
    plantationFeatures: any[];
    employees: any[];
    machinery: any[];
    nutritionPlans: any[];
    notes: any[];
    organizations: any[];
    onNavigateToTasks?: () => void;
    currentAiMode: AIAssistantMode;
    onSetAiMode: (mode: AIAssistantMode) => void;
}

const renderSafeText = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
        return value.name || value.workName || value.title || value.taskType || value.issue || value.recommendationAction || '';
    }
    return String(value);
};

export const GodAIIntelligenceHubModal: React.FC<GodAIIntelligenceHubModalProps> = ({
    isOpen,
    onClose,
    activeOrgId = '',
    activeOrgName = 'Current Farm',
    currentUser,
    isSystemAdmin,
    workAssignments = [],
    harvestEntries = [],
    plantationFeatures = [],
    employees = [],
    machinery = [],
    nutritionPlans = [],
    notes = [],
    organizations = [],
    onNavigateToTasks,
    currentAiMode,
    onSetAiMode
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [activeTab, setActiveTab] = useState<'pm' | 'agronomy' | 'heuristics' | 'god_ai'>('pm');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<WorkTaskAnalysisResult | null>(null);
    const [godAiMatrix, setGodAiMatrix] = useState<OmniscientGodAIMatrix | null>(null);
    const [heuristics, setHeuristics] = useState<LearnedHeuristic[]>([]);
    const [selectedDomain, setSelectedDomain] = useState<string>('all');
    const [isLearningCycleRunning, setIsLearningCycleRunning] = useState(false);

    // Live custom window dimensions
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [modalSize, setModalSize] = useState<{ width: number; height: number }>(() => {
        const stored = safeStorage.getItem('agrimap_console_modal_size');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Number.isFinite(parsed?.width) && Number.isFinite(parsed?.height)) {
                    return {
                        width: Math.max(360, Math.min(typeof window !== 'undefined' ? window.innerWidth - 20 : 1280, parsed.width)),
                        height: Math.max(420, Math.min(typeof window !== 'undefined' ? window.innerHeight - 20 : 920, parsed.height)),
                    };
                }
            } catch (e) {}
        }
        const defaultW = typeof window !== 'undefined' ? Math.min(1080, Math.max(360, window.innerWidth - 32)) : 1040;
        const defaultH = typeof window !== 'undefined' ? Math.min(840, Math.max(450, window.innerHeight - 40)) : 820;
        return { width: defaultW, height: defaultH };
    });

    const [isResizing, setIsResizing] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const resizeRef = useRef<{
        direction: string;
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    } | null>(null);

    // Resizing pointer event handlers
    const startResize = (e: React.PointerEvent<HTMLDivElement>, direction: string) => {
        if (isFullscreen) return;
        e.preventDefault();
        e.stopPropagation();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = modalRef.current?.getBoundingClientRect();
        const currentWidth = rect ? rect.width : modalSize.width;
        const currentHeight = rect ? rect.height : modalSize.height;

        setIsResizing(direction);
        resizeRef.current = {
            direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: currentWidth,
            startHeight: currentHeight
        };
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current || isFullscreen) return;
        e.preventDefault();
        const { direction, startX, startY, startWidth, startHeight } = resizeRef.current;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        const minW = Math.min(360, window.innerWidth - 16);
        const maxW = Math.min(1440, window.innerWidth - 16);
        const minH = Math.min(420, window.innerHeight - 16);
        const maxH = Math.min(1100, window.innerHeight - 16);

        if (direction.includes('right')) {
            newWidth = Math.max(minW, Math.min(maxW, startWidth + deltaX * 2));
        } else if (direction.includes('left')) {
            newWidth = Math.max(minW, Math.min(maxW, startWidth - deltaX * 2));
        }

        if (direction.includes('bottom')) {
            newHeight = Math.max(minH, Math.min(maxH, startHeight + deltaY * 2));
        } else if (direction.includes('top')) {
            newHeight = Math.max(minH, Math.min(maxH, startHeight - deltaY * 2));
        }

        setModalSize({
            width: Math.round(newWidth),
            height: Math.round(newHeight)
        });
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
        resizeRef.current = null;
        setIsResizing(null);
        safeStorage.setItem('agrimap_console_modal_size', JSON.stringify(modalSize));
    };

    // Fetch or compute analysis when modal opens or inputs change
    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            // 1. Works & Tasks Analysis via event bridge
            const taskAnalysis = await appEngine.request<any, WorkTaskAnalysisResult>('REQUEST_WORK_TASK_ANALYSIS', {
                organizationId: currentAiMode === 'god_ai' && isSystemAdmin ? 'ALL' : activeOrgId,
                isSystemAdmin,
                workAssignments,
                harvestEntries,
                plantationFeatures,
                employees,
                machinery,
                nutritionPlans,
                notes
            });
            setAnalysisResult(taskAnalysis);

            // 2. Query Learned Heuristics
            const learned = await appEngine.request<any, LearnedHeuristic[]>('GET_LEARNED_HEURISTICS', {});
            setHeuristics(learned || []);

            // 3. If Super Admin, fetch Omniscient Matrix
            if (isSystemAdmin) {
                const matrix = await appEngine.request<any, OmniscientGodAIMatrix>('SYNTHESIZE_OMNISCIENT_GOD_AI', {
                    isSystemAdmin: true,
                    organizations,
                    allWorkAssignments: workAssignments,
                    allHarvestEntries: harvestEntries,
                    allPlantationFeatures: plantationFeatures
                });
                setGodAiMatrix(matrix);
            }
        } catch (err: any) {
            console.warn('[GodAIIntelligenceHubModal] Analysis notice:', err);
            toast.error('Failed to load AI agronomic analytics: ' + (err?.message || 'Error'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            runAnalysis();
        }
    }, [isOpen, activeOrgId, currentAiMode, isSystemAdmin]);

    const handleTriggerLearningCycle = async () => {
        setIsLearningCycleRunning(true);
        try {
            const res = await appEngine.request<any, { newHeuristicsCount: number; updatedHeuristics: LearnedHeuristic[] }>('TRIGGER_DEEP_LEARNING_CYCLE', {
                organizations,
                workAssignments,
                harvestEntries,
                plantationFeatures,
                nutritionPlans
            });
            setHeuristics(res.updatedHeuristics || []);
            toast.success(isKa ? `ღრმა სწავლების ციკლი დასრულდა! სინთეზირებულია ${res.newHeuristicsCount} ახალი აგრონომიული წესი.` : `Deep Learning Cycle completed! Synthesized ${res.newHeuristicsCount} new agronomic rule(s).`);
        } catch (err: any) {
            toast.error((isKa ? 'სწავლების ციკლი ვერ შესრულდა: ' : 'Failed to run learning cycle: ') + (err?.message || 'Error'));
        } finally {
            setIsLearningCycleRunning(false);
        }
    };

    const filteredHeuristics = useMemo(() => {
        if (selectedDomain === 'all') return heuristics;
        return heuristics.filter(h => h.domain === selectedDomain);
    }, [heuristics, selectedDomain]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-1.5 sm:p-4 animate-in fade-in duration-200 select-none overflow-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div 
                ref={modalRef}
                style={!isFullscreen ? {
                    width: `${modalSize.width}px`,
                    height: `${modalSize.height}px`,
                    maxWidth: 'calc(100vw - 16px)',
                    maxHeight: 'calc(100vh - 16px)',
                } : undefined}
                className={`bg-slate-900 border border-slate-700/80 rounded-xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-100 relative transition-[box-shadow,border-color] duration-150 ${
                    isFullscreen ? 'w-full h-full rounded-none sm:rounded-none' : ''
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 shrink-0 gap-2 select-none">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
                            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-emerald-400" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-black tracking-tight text-white uppercase flex items-center gap-1.5 truncate">
                                    {isKa ? 'God AI ინტელექტი & აგრონომიის PM კონსოლი' : 'God AI Intelligence & PM Agronomy Console'}
                                </h2>
                                <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 font-bold">
                                    v3.8
                                </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-2 truncate">
                                <span className="truncate">{isKa ? 'მრავალწლიანი ევოლუციური აგრონომი & პროექტების მენეჯერი' : 'Multi-Year Evolutionary Agronomist & Project Manager'}</span>
                                {activeOrgName && (
                                    <>
                                        <span className="text-slate-600">•</span>
                                        <span className="text-emerald-400 font-semibold truncate">{activeOrgName}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                        {/* Mode Switcher Pill */}
                        <div className="hidden md:flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs mr-1">
                            <button
                                onClick={() => onSetAiMode('standard')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${currentAiMode === 'standard' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                {isKa ? 'სტანდარტული' : 'Standard'}
                            </button>
                            <button
                                onClick={() => onSetAiMode('expert')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${currentAiMode === 'expert' ? 'bg-emerald-700 text-white shadow' : 'text-slate-400 hover:text-emerald-300'}`}
                            >
                                <Leaf className="w-3 h-3" />
                                <span>{isKa ? 'ექსპერტი PM' : 'Expert Farm PM'}</span>
                            </button>
                            {isSystemAdmin && (
                                <button
                                    onClick={() => onSetAiMode('god_ai')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${currentAiMode === 'god_ai' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-amber-300'}`}
                                    title={isKa ? 'სუპერ ადმინი: ყველა რეგისტრირებული მეურნეობის სინთეზი' : 'Super Admin Exclusive: Synthesize all registered companies'}
                                >
                                    <Crown className="w-3 h-3 text-amber-300" />
                                    <span>{isKa ? 'Omniscient God AI' : 'Omniscient God AI'}</span>
                                </button>
                            )}
                        </div>

                        {/* Refresh Button */}
                        <button
                            onClick={runAnalysis}
                            disabled={isAnalyzing}
                            className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            title={isKa ? 'მონაცემების განახლება' : 'Refresh Analysis'}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-emerald-400' : ''}`} />
                        </button>

                        {/* Collapse (-) Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-400/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={isKa ? 'ჩაკეცვა (-)' : 'Collapse (-)'}
                        >
                            <Minus size={15} strokeWidth={2.5} />
                        </button>

                        {/* Fullscreen / Restore Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={isFullscreen ? (isKa ? 'სტანდარტული ზომა' : 'Exit Fullscreen') : (isKa ? 'მთელ ეკრანზე გაშლა' : 'Fullscreen')}
                        >
                            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>

                        {/* Close (X) Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/25 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/50 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={isKa ? 'დახურვა (X)' : 'Close (X)'}
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Mobile Mode Switcher Bar */}
                <div className="md:hidden px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
                    <span className="text-slate-400 text-[11px] font-bold">{isKa ? 'აქტიური ძრავი:' : 'Active Engine:'}</span>
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                        <button
                            onClick={() => onSetAiMode('standard')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentAiMode === 'standard' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                        >
                            {isKa ? 'სტანდარტული' : 'Standard'}
                        </button>
                        <button
                            onClick={() => onSetAiMode('expert')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentAiMode === 'expert' ? 'bg-emerald-700 text-white' : 'text-slate-400'}`}
                        >
                            {isKa ? 'ექსპერტი PM' : 'Expert PM'}
                        </button>
                        {isSystemAdmin && (
                            <button
                                onClick={() => onSetAiMode('god_ai')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentAiMode === 'god_ai' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                            >
                                God AI
                            </button>
                        )}
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-800 px-4 sm:px-6 bg-slate-950/70 overflow-x-auto no-scrollbar gap-2 sm:gap-4 shrink-0 min-h-[50px] items-stretch">
                    <button
                        onClick={() => setActiveTab('pm')}
                        className={`py-3 px-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeTab === 'pm' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <Briefcase className="w-4 h-4" />
                        <span>{isKa ? 'სამუშაოები & ამოცანები PM' : 'Works & Tasks PM'}</span>
                        {analysisResult?.criticalBottlenecks?.length ? (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-900/60 text-rose-300 border border-rose-700/50 text-[10px]">
                                {analysisResult.criticalBottlenecks.length}
                            </span>
                        ) : null}
                    </button>

                    <button
                        onClick={() => setActiveTab('agronomy')}
                        className={`py-3 px-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeTab === 'agronomy' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <Leaf className="w-4 h-4" />
                        <span>{isKa ? 'აგრონომია & მოსავლის სინერგია' : 'Agronomy & Harvest Synergy'}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('heuristics')}
                        className={`py-3 px-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeTab === 'heuristics' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <BookOpen className="w-4 h-4" />
                        <span>{isKa ? 'ნასწავლი ცოდნის გრაფი' : 'Learned Knowledge Graph'}</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                            {heuristics.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('god_ai')}
                        className={`py-3 px-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeTab === 'god_ai' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>{isKa ? 'უნივერსალური God AI (ყველა მეურნეობა)' : 'Universal God AI (All Orgs)'}</span>
                        {isSystemAdmin && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 text-[10px]">
                                {isKa ? 'სუპერ ადმინი' : 'Super Admin'}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {/* TAB 1: WORKS & TASKS PM */}
                    {activeTab === 'pm' && (
                        <div className="space-y-6">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-slate-400 text-xs">
                                        <span>{isKa ? 'სულ სამუშაოები' : 'Total Tasks / სამუშაოები'}</span>
                                        <Briefcase className="w-4 h-4 text-cyan-400" />
                                    </div>
                                    <div className="text-2xl font-black text-white">
                                        {analysisResult?.totalTasks || 0}
                                    </div>
                                    <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>{analysisResult?.overallCompletionRate || 0}% {isKa ? 'შესრულების სიჩქარე' : 'Completion Velocity'}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-slate-400 text-xs">
                                        <span>{isKa ? 'შრომის ნაყოფიერება' : 'Labor Productivity / ნაყოფიერება'}</span>
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div className="text-2xl font-black text-emerald-400">
                                        {analysisResult?.laborProductivityIndex || 85}/100
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        {isKa ? 'გათვლილი გეგმიურ საათებთან' : 'Calibrated vs planned hours'}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-slate-400 text-xs">
                                        <span>{isKa ? 'კრიტიკული შეფერხებები' : 'Critical Bottlenecks / შეფერხებები'}</span>
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className={`text-2xl font-black ${analysisResult?.criticalBottlenecks?.length ? 'text-rose-400' : 'text-slate-200'}`}>
                                        {analysisResult?.criticalBottlenecks?.length || 0}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        {isKa ? 'ვადაგადაცილებული ან უპერსონალო' : 'Overdue or unstaffed operations'}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-slate-400 text-xs">
                                        <span>{isKa ? 'ტექნიკის დატვირთვა' : 'Machinery Utilization / ტექნიკა'}</span>
                                        <Wrench className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <div className="text-2xl font-black text-indigo-300">
                                        {analysisResult?.machineryUtilizationSummary?.utilizationScore || 0}%
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        {analysisResult?.machineryUtilizationSummary?.activeUnits || 0} {isKa ? 'აქტიური მინდორში' : 'active in fields'}
                                    </div>
                                </div>
                            </div>

                            {/* Executive Summary */}
                            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{isKa ? 'AI პროექტ მენეჯერის დიაგნოზი' : 'AI Project Manager Diagnosis'}</span>
                                </h3>
                                <p className="text-sm text-slate-200 leading-relaxed font-sans">
                                    {analysisResult?.executiveSummary || (isKa ? 'მიმდინარე სამუშაოების ანალიზი...' : 'Analyzing current work assignments...')}
                                </p>
                            </div>

                            {/* Critical Bottlenecks Section */}
                            {analysisResult?.criticalBottlenecks && analysisResult.criticalBottlenecks.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span>{isKa ? 'შეფერხებები, რომლებიც მოითხოვს რეაგირებას' : 'Flagged Bottlenecks Requiring Action'} ({analysisResult.criticalBottlenecks.length})</span>
                                    </h3>
                                    <div className="space-y-2">
                                        {analysisResult.criticalBottlenecks.map((b, idx) => (
                                            <div key={idx} className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-xs sm:text-sm">{renderSafeText(b.workName)}</span>
                                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50 uppercase">
                                                            {renderSafeText(b.taskType)}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-amber-400 uppercase">
                                                            {isKa ? 'სიმძიმე:' : 'Severity:'} {renderSafeText(b.severity)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-rose-200">{renderSafeText(b.issue)}</p>
                                                    <p className="text-xs text-slate-400 font-medium">💡 {isKa ? 'რეკომენდაცია:' : 'Recommendation:'} {renderSafeText(b.recommendedAction)}</p>
                                                </div>
                                                {onNavigateToTasks && (
                                                    <button
                                                        onClick={() => {
                                                            onClose();
                                                            onNavigateToTasks();
                                                        }}
                                                        className="px-3 py-1.5 bg-rose-900/40 hover:bg-rose-800 text-rose-200 text-xs font-bold rounded-lg border border-rose-700/50 transition-colors whitespace-nowrap cursor-pointer"
                                                    >
                                                        {isKa ? 'ამოცანის გახსნა' : 'Open Task'}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Task Breakdown by Type */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-emerald-400" />
                                    <span>{isKa ? 'ოპერაციული შესრულება ამოცანის ტიპის მიხედვით' : 'Operational Delivery by Task Type'}</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.values(analysisResult?.taskMetricsByType || {}).map((metric, idx) => (
                                        <div key={idx} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-xs">{renderSafeText(metric.taskType)}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">({metric.count} {isKa ? 'ამოცანა' : 'tasks'})</span>
                                                </div>
                                                <span className={`text-xs font-black ${metric.completionRate >= 80 ? 'text-emerald-400' : metric.completionRate >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                                                    {metric.completionRate}% {isKa ? 'შესრულებული' : 'Done'}
                                                </span>
                                            </div>
                                            {/* Progress Bar */}
                                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-emerald-500 h-full rounded-full transition-all"
                                                    style={{ width: `${metric.completionRate}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                                <span>{isKa ? 'გეგმა' : 'Planned'}: {metric.totalPlannedHours}h | {isKa ? 'ფაქტი' : 'Actual'}: {metric.totalActualHours}h</span>
                                                <span>{isKa ? 'შრომა' : 'Labor'}: ₾{metric.totalLaborCost.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PM Recommendations */}
                            <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{isKa ? 'სტრატეგიული ამოცანების შესრულების გზამკვლევი' : 'Strategic Task Execution Guidelines'}</span>
                                </h3>
                                <ul className="space-y-1.5 text-xs text-slate-300">
                                    {analysisResult?.aiProjectManagerRecommendations?.map((rec, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="text-emerald-400 font-bold">•</span>
                                            <span>{renderSafeText(rec)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: AGRONOMY & HARVEST SYNERGY */}
                    {activeTab === 'agronomy' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>{isKa ? 'შეწამვლის დროულობის ინდექსი' : 'Spray Timeliness Score'}</span>
                                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div className="text-3xl font-black text-emerald-400">
                                        {analysisResult?.agronomicTaskSynergy?.sprayTimelinessScore || 90}%
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        {isKa ? 'პესტიციდებისა და ბიო-ფუნგიციდების ფანჯრის დაცვა' : 'Pesticide & bio-fungicide adherence window'}
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>{isKa ? 'მორწყვის თანმიმდევრულობა' : 'Irrigation Consistency'}</span>
                                        <Zap className="w-4 h-4 text-cyan-400" />
                                    </div>
                                    <div className="text-3xl font-black text-cyan-400">
                                        {analysisResult?.agronomicTaskSynergy?.irrigationConsistencyScore || 92}%
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        {isKa ? 'წვეთოვანი გრაფიკი და წნევის შენარჩუნება' : 'Drip schedule & pressure maintenance'}
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>{isKa ? 'მოსავლის აღების ტემპი' : 'Harvest Pacing Index'}</span>
                                        <BarChart3 className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="text-3xl font-black text-amber-400">
                                        {analysisResult?.agronomicTaskSynergy?.harvestPacingScore || 88}%
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        {isKa ? 'მკრეფავთა ნაკადი vs სასწორი' : 'Picker yield vs. weigh-station flow'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                    <Leaf className="w-4 h-4 text-emerald-400" />
                                    <span>{isKa ? 'საველე დაკვირვებები & ფენოლოგიური კორელაციები' : 'Field Observations & Phenological Correlations'}</span>
                                </h3>
                                <div className="space-y-2">
                                    {analysisResult?.agronomicTaskSynergy?.keyObservations?.map((obs, i) => (
                                        <div key={i} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 flex items-center gap-2.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                            <span>{renderSafeText(obs)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Practical Advice Section */}
                            <div className="p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-xl space-y-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                                    <Lightbulb className="w-4 h-4" />
                                    <span>{isKa ? 'ექსპერტ აგრონომთა რეკომენდაციები აქტიური სივრცისთვის' : 'Expert Agronomist Prescriptions for Active Workspace'}</span>
                                </h3>
                                <ul className="space-y-2 text-xs text-slate-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-cyan-400 font-bold">•</span>
                                        <span>
                                            <strong>{isKa ? 'ბიოლოგიური მავნებლების კონტროლი:' : 'Biological Pest Control:'}</strong>{' '}
                                            {isKa ? 'დაგეგმეთ Bacillus thuringiensis (Bt) დამუშავება გვიან ნაშუადღევს ან მოღრუბლულ ამინდში UV დაშლის თავიდან ასაცილებლად.' : 'Schedule Bacillus thuringiensis (Bt) treatments exclusively during late afternoons or overcast windows to prevent UV breakdown.'}
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-cyan-400 font-bold">•</span>
                                        <span>
                                            <strong>{isKa ? 'ნალექის შემდგომი დაცვა:' : 'Post-Precipitation Defense:'}</strong>{' '}
                                            {isKa ? 'შეამოწმეთ დაბლობი სადრენაჟო ზონები ძლიერი წვიმიდან 24 საათში ნიადაგის ტრაქტორისთვის მზადყოფნის შესამოწმებლად.' : 'Inspect low-lying drainage zones within 24 hours of heavy rainfall to verify soil saturation before tractor entry.'}
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-cyan-400 font-bold">•</span>
                                        <span>
                                            <strong>{isKa ? 'მოსავლის აღების დროულობა:' : 'Harvest Timing:'}</strong>{' '}
                                            {isKa ? 'უზრუნველყავით კენკრის ყუთების ჩაბარება ჩრდილში/სასწორზე დაკრეფიდან 45 წუთში ხარისხის შესანარჩუნებლად.' : 'Ensure field pickers deliver fresh berry crates to the shade/weigh station within 45 minutes of picking to preserve bloom.'}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: LEARNED KNOWLEDGE GRAPH */}
                    {activeTab === 'heuristics' && (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950/70 border border-slate-800 rounded-xl">
                                <div className="space-y-1">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4" />
                                        <span>{isKa ? 'ევოლუციური ცოდნის ბაზა' : 'Evolutionary Knowledge Graph'}</span>
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {isKa ? 'God AI უწყვეტად აანალიზებს აგრონომიულ გადაწყვეტილებებს, ამოცანების შესრულებასა და მოსავალს მრავალწლიანი გამოცდილების სინთეზისთვის.' : 'The God AI continuously mines agronomy designs, task completions, and harvest entries to synthesize durable expertise over the years.'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleTriggerLearningCycle}
                                    disabled={isLearningCycleRunning}
                                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isLearningCycleRunning ? 'animate-spin' : ''}`} />
                                    <span>{isKa ? 'ღრმა სწავლების ციკლის გაშვება' : 'Run Deep Learning Cycle'}</span>
                                </button>
                            </div>

                            {/* Domain Filter */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'all', en: 'All', ka: 'ყველა' },
                                    { id: 'agronomy', en: 'Agronomy', ka: 'აგრონომია' },
                                    { id: 'project_management', en: 'Project Management', ka: 'პროექტების მართვა' },
                                    { id: 'harvest_synergy', en: 'Harvest Synergy', ka: 'მოსავლის სინერგია' },
                                    { id: 'pathogen_control', en: 'Pathogen Control', ka: 'პათოგენების კონტროლი' }
                                ].map(domain => (
                                    <button
                                        key={domain.id}
                                        onClick={() => setSelectedDomain(domain.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${selectedDomain === domain.id ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
                                    >
                                        {isKa ? domain.ka : domain.en}
                                    </button>
                                ))}
                            </div>

                            {/* Heuristic Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredHeuristics.map((h) => (
                                    <div key={h.id} className="p-4 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl space-y-3 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase font-bold">
                                                    {h.domain.replace('_', ' ')}
                                                </span>
                                                <h4 className="text-sm font-bold text-white mt-1.5">{h.title}</h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-emerald-400 font-mono">
                                                    {h.confidenceScore}% {isKa ? 'სანდოობა' : 'Conf.'}
                                                </span>
                                                <p className="text-[10px] text-slate-500">
                                                    {h.evidenceSampleCount} {isKa ? 'მტკიცებულების ნიმუში' : 'evidence samples'}
                                                </p>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            {h.description}
                                        </p>

                                        <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-emerald-300 flex items-start gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                            <span><strong>{isKa ? 'ავტონომიური მოქმედება:' : 'Autonomous Action:'}</strong> {h.recommendationAction}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: UNIVERSAL GOD AI (ALL ORGS) */}
                    {activeTab === 'god_ai' && (
                        <div className="space-y-6">
                            {!isSystemAdmin ? (
                                <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4 max-w-lg mx-auto my-8">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-700/50 flex items-center justify-center text-amber-400 mx-auto">
                                        <Crown className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-black uppercase text-white">
                                            {isKa ? 'Super Admin ყოვლისმცოდნე AI რეჟიმი' : 'Super Admin Omniscient AI Mode'}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            {isKa ? 'ეს რეჟიმი აკონტროლებს და აერთიანებს სწავლების მონაცემებს აპლიკაციაში რეგისტრირებული ყველა კომპანიიდან. ხელმისაწვდომია ექსკლუზიურად სისტემის სუპერ-ადმინისტრატორებისთვის.' : 'This mode monitors and synthesizes learning data from all companies registered in the application. Available exclusively to System Super Administrators.'}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-slate-900 rounded-xl text-xs text-slate-300 border border-slate-800 text-left space-y-1">
                                        <p className="font-bold text-amber-400">{isKa ? 'შესაძლებლობები God AI რეჟიმში:' : 'Capabilities in God AI Mode:'}</p>
                                        <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                                            <li>{isKa ? 'ეკოსისტემის მასშტაბით მრავალფერმული შრომის ბენჩმარკინგი' : 'Ecosystem-wide multi-farm labor benchmarking'}</li>
                                            <li>{isKa ? 'საწარმოთაშორისი კულტურების მოსავლიანობის შედარებითი პროცენტები' : 'Cross-enterprise crop yield percentiles'}</li>
                                            <li>{isKa ? 'პათოგენების მაკრო მოწყვლადობის მრუდები' : 'Macro pathogen vulnerability curves'}</li>
                                            <li>{isKa ? 'გლობალური პროექტების მართვის ამოცანების შესრულების ანალიტიკა' : 'Global project management task execution analytics'}</li>
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Super Admin Omniscient Banner */}
                                    <div className="p-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-800/40 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-700/60 flex items-center justify-center text-amber-400">
                                                <Crown className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black uppercase text-amber-300">
                                                    {isKa ? 'ეკოსისტემის სრული მონიტორინგი გააქტიურებულია' : 'Omniscient Ecosystem Surveillance Active'}
                                                </h3>
                                                <p className="text-xs text-slate-400">
                                                    {isKa ? `მონაცემთა სინთეზი ${godAiMatrix?.totalOrganizationsMonitored || organizations.length} რეგისტრირებული საწარმოდან` : `Synthesizing data across ${godAiMatrix?.totalOrganizationsMonitored || organizations.length} registered enterprises`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-mono px-2.5 py-1 bg-amber-900/60 text-amber-200 border border-amber-700/50 rounded-lg font-bold">
                                            {isKa ? 'სისტემის სუპერ ადმინი' : 'System Super Admin'}
                                        </span>
                                    </div>

                                    {/* Macro Stats */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                            <span className="text-xs text-slate-400">{isKa ? 'რეგისტრირებული საწარმოები' : 'Registered Enterprises'}</span>
                                            <div className="text-2xl font-black text-amber-400">
                                                {godAiMatrix?.totalOrganizationsMonitored || organizations.length}
                                            </div>
                                            <span className="text-[10px] text-slate-500">{isKa ? 'ფერმერული ორგანიზაციები' : 'Multi-tenant farms'}</span>
                                        </div>

                                        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                            <span className="text-xs text-slate-400">{isKa ? 'გაანალიზებული სამუშაოები' : 'Total Tasks Analyzed'}</span>
                                            <div className="text-2xl font-black text-white">
                                                {godAiMatrix?.totalTasksAnalyzed || workAssignments.length}
                                            </div>
                                            <span className="text-[10px] text-slate-500">{isKa ? 'გლობალური დავალებები' : 'Global assignments'}</span>
                                        </div>

                                        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                            <span className="text-xs text-slate-400">{isKa ? 'აღრიცხული მოსავალი' : 'Harvest KG Tracked'}</span>
                                            <div className="text-2xl font-black text-emerald-400">
                                                {godAiMatrix?.totalHarvestKgAnalyzed?.toLocaleString() || 0} kg
                                            </div>
                                            <span className="text-[10px] text-slate-500">{isKa ? 'აგრეგირებული მოსავლიანობა' : 'Aggregated yield'}</span>
                                        </div>

                                        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                                            <span className="text-xs text-slate-400">{isKa ? 'კლინიკური ჩანაწერები' : 'Clinical Case Ledgers'}</span>
                                            <div className="text-2xl font-black text-cyan-400">
                                                {godAiMatrix?.totalClinicalCasesAnalyzed || 0}
                                            </div>
                                            <span className="text-[10px] text-slate-500">{isKa ? 'საწარმოთაშორისი მკურნალობა' : 'Cross-farm treatments'}</span>
                                        </div>
                                    </div>

                                    {/* Cross Company Labor Benchmarks */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                            <TrendingUp className="w-4 h-4 text-amber-400" />
                                            <span>{isKa ? 'ეკოსისტემის შრომის ბენჩმარკები (მედიანა vs ტოპ მეოთხედი)' : 'Ecosystem Labor Benchmarks (Median vs Top Quartile)'}</span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {godAiMatrix?.crossCompanyLaborBenchmarks?.map((bm, i) => (
                                                <div key={i} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-white text-xs">{renderSafeText(bm.taskType)}</span>
                                                        <span className="text-[10px] font-mono font-bold text-amber-400">
                                                            {isKa ? 'მედიანა:' : 'Median:'} {bm.medianHoursPerHa}h/ha
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-emerald-300 font-medium">
                                                        ⚡ {isKa ? 'ტოპ მეოთხედი:' : 'Top Quartile:'} {bm.topQuartileHoursPerHa}h/ha
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">
                                                        {renderSafeText(bm.industryBenchmarkComparison)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Macro Crop Yields */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                            <Leaf className="w-4 h-4 text-emerald-400" />
                                            <span>{isKa ? 'კულტურების საშუალო მოსავლიანობა საწარმოების მასშტაბით' : 'Multi-Enterprise Cultivar Yield Averages'}</span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {godAiMatrix?.crossCompanyCropYieldAverages?.map((cy, i) => (
                                                <div key={i} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-white text-xs">{renderSafeText(cy.cropOrVariety)}</span>
                                                        <span className="text-xs font-black text-emerald-400 font-mono">
                                                            {cy.averageKgPerHectare.toLocaleString()} kg/ha
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-300">
                                                        💡 {isKa ? 'საუკეთესო პრაქტიკა:' : 'Top Practice:'} {renderSafeText(cy.topPerformingPractice)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Super Admin Insights */}
                                    <div className="p-4 bg-slate-950/90 border border-amber-800/40 rounded-xl space-y-2">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                            <Lightbulb className="w-4 h-4" />
                                            <span>{isKa ? 'უნივერსალური სტრატეგიული პორტფოლიოს ინტელექტი' : 'Universal Strategic Portfolio Intelligence'}</span>
                                        </h3>
                                        <ul className="space-y-1.5 text-xs text-slate-300">
                                            {godAiMatrix?.systemAdminMacroInsights?.map((ins, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-amber-400 font-bold">•</span>
                                                    <span>{renderSafeText(ins)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{isKa ? 'ავტონომიური ევოლუციური ინტელექტის ძრავი ფუნქციონირებს' : 'Autonomous Evolutionary Intelligence Engine Operational'}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
                    >
                        {isKa ? 'კონსოლის დახურვა' : 'Close Console'}
                    </button>
                </div>

                {/* Live Resize Handles on Edges and Corners (Active when not Fullscreen) */}
                {!isFullscreen && (
                    <>
                        {/* Left Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'left')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-left absolute -left-2 top-4 bottom-4 w-5 cursor-ew-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ მარცხნივ/მარჯვნივ)" : "Live resize width (drag left/right)"}
                        >
                            <div className="w-1.5 h-full bg-emerald-500/0 group-hover/edge-left:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute left-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-left:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowLeftRight size={14} />
                            </div>
                        </div>

                        {/* Right Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'right')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-right absolute -right-2 top-4 bottom-4 w-5 cursor-ew-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ მარცხნივ/მარჯვნივ)" : "Live resize width (drag left/right)"}
                        >
                            <div className="w-1.5 h-full bg-emerald-500/0 group-hover/edge-right:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute right-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-right:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowLeftRight size={14} />
                            </div>
                        </div>

                        {/* Top Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'top')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-top absolute -top-2 left-4 right-4 h-5 cursor-ns-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ ზემოთ/ქვემოთ)" : "Live resize height (drag up/down)"}
                        >
                            <div className="h-1.5 w-full bg-emerald-500/0 group-hover/edge-top:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute top-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-top:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowUpDown size={14} />
                            </div>
                        </div>

                        {/* Bottom Edge Handle */}
                        <div
                            onPointerDown={(e) => startResize(e, 'bottom')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/edge-bottom absolute -bottom-2 left-4 right-4 h-5 cursor-ns-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "ზომის გაზრდა / შემცირება (გაჭიმეთ ზემოთ/ქვემოთ)" : "Live resize height (drag up/down)"}
                        >
                            <div className="h-1.5 w-full bg-emerald-500/0 group-hover/edge-bottom:bg-emerald-500/70 rounded-full transition-colors" />
                            <div className="absolute bottom-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xl border border-emerald-300 opacity-0 group-hover/edge-bottom:opacity-100 transition-opacity pointer-events-none flex items-center justify-center scale-90">
                                <ArrowUpDown size={14} />
                            </div>
                        </div>

                        {/* Corners */}
                        <div
                            onPointerDown={(e) => startResize(e, 'bottom-right')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-br absolute -bottom-2 -right-2 w-7 h-7 cursor-nwse-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-r-2 border-b-2 border-slate-400 group-hover/corner-br:border-emerald-500 rounded-br transition-colors" />
                        </div>
                        <div
                            onPointerDown={(e) => startResize(e, 'bottom-left')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-bl absolute -bottom-2 -left-2 w-7 h-7 cursor-nesw-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-l-2 border-b-2 border-slate-400 group-hover/corner-bl:border-emerald-500 rounded-bl transition-colors" />
                        </div>
                        <div
                            onPointerDown={(e) => startResize(e, 'top-right')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-tr absolute -top-2 -right-2 w-7 h-7 cursor-nesw-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-r-2 border-t-2 border-slate-400 group-hover/corner-tr:border-emerald-500 rounded-tr transition-colors" />
                        </div>
                        <div
                            onPointerDown={(e) => startResize(e, 'top-left')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            className="group/corner-tl absolute -top-2 -left-2 w-7 h-7 cursor-nwse-resize z-50 flex items-center justify-center select-none touch-none"
                            title={isKa ? "დიაგონალური ზომის შეცვლა" : "Diagonal resize"}
                        >
                            <div className="w-4 h-4 border-l-2 border-t-2 border-slate-400 group-hover/corner-tl:border-emerald-500 rounded-tl transition-colors" />
                        </div>

                        {/* Live Resizing Dimension Overlay Badge */}
                        {isResizing && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[6100] px-4 py-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-emerald-500 text-xs font-mono font-bold flex items-center gap-2.5 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                                <ArrowLeftRight size={14} className="text-emerald-400 animate-pulse" />
                                <span>{Math.round(modalSize.width)} × {Math.round(modalSize.height)} px</span>
                                <span className="text-[10px] text-emerald-300 font-sans font-medium">
                                    {isKa ? 'რეალურ დროში ზომა' : 'Live Size'}
                                </span>
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
};
