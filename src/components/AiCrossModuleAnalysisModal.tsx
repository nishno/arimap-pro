import React, { useState } from 'react';
import { 
    InventoryItem, StockTransaction, NutritionPlan, PlanExecution, 
    WorkAssignment, DailyLogEntry, HarvestEvent, Account, 
    AiAnomalyAlert, AiAnalysisReport, AiAnalysisScheduleConfig, 
    AnalysisModuleScope, AnalysisTriggerMode, AnalysisIntervalCadence 
} from '../types';
import { 
    XIcon, SparklesIcon, CalendarDaysIcon, CheckIcon, 
    AlertTriangleIcon, ArrowPathIcon, ChartBarIcon, 
    BeakerIcon, BriefcaseIcon, BanknotesIcon, TractorIcon, 
    ArrowTrendingUpIcon, ClockIcon, MagnifyingGlassIcon
} from './Icons';
import { 
    runMultiModuleAiAnalysis, saveAnalysisConfig 
} from '../services/crossModuleAnalysisService';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

interface AiCrossModuleAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: AnalysisTriggerMode;
    preselectedModule?: AnalysisModuleScope;
    inventoryItems: InventoryItem[];
    stockTransactions?: StockTransaction[];
    nutritionPlans: NutritionPlan[];
    planExecutions: PlanExecution[];
    workAssignments: WorkAssignment[];
    dailyLogs: DailyLogEntry[];
    harvestEvents?: HarvestEvent[];
    accounts?: Account[];
    config: AiAnalysisScheduleConfig;
    onUpdateConfig: (config: AiAnalysisScheduleConfig) => void;
    onAnalysisCompleted: (report: AiAnalysisReport) => void;
}

const AVAILABLE_MODULES: { id: AnalysisModuleScope; labelKa: string; labelEn: string; icon: any; color: string }[] = [
    { id: 'stock', labelKa: 'საწყობი & ავტო-ჩამოწერა', labelEn: 'Stock & Auto-Deductions', icon: ChartBarIcon, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    { id: 'agronomy', labelKa: 'აგრონომია & კვების მონიტორინგი', labelEn: 'Agronomy & Nutrition Regimen', icon: BeakerIcon, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
    { id: 'tasks', labelKa: 'სამუშაოები & შრომითი რესურსები', labelEn: 'Tasks, Operations & Labor', icon: BriefcaseIcon, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
    { id: 'harvest', labelKa: 'ამწონი სადგური & საცივრე', labelEn: 'Weight Station & Cold Chain', icon: SparklesIcon, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    { id: 'accounting', labelKa: 'ფინანსები & OPEX ხარჯები', labelEn: 'Finance & OPEX Allocations', icon: BanknotesIcon, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    { id: 'machinery', labelKa: 'ტექნიკა & საწვავის ხარჯი', labelEn: 'Machinery & Fuel Fleet', icon: TractorIcon, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' }
];

export const AiCrossModuleAnalysisModal: React.FC<AiCrossModuleAnalysisModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'scheduled',
    preselectedModule,
    inventoryItems,
    stockTransactions,
    nutritionPlans,
    planExecutions,
    workAssignments,
    dailyLogs,
    harvestEvents,
    accounts,
    config,
    onUpdateConfig,
    onAnalysisCompleted
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [activeTab, setActiveTab] = useState<AnalysisTriggerMode>(initialMode);

    const [selectedModules, setSelectedModules] = useState<AnalysisModuleScope[]>(
        preselectedModule ? [preselectedModule] : config.selectedModules || ['stock', 'agronomy', 'tasks', 'harvest']
    );
    const [cadence, setCadence] = useState<AnalysisIntervalCadence>(config.cadence || 'weekly');
    const [startDate, setStartDate] = useState(config.dateRange?.startDate || '2026-05-14');
    const [endDate, setEndDate] = useState(config.dateRange?.endDate || '2026-07-10');
    const [targetFilter, setTargetFilter] = useState('');
    const [autoDisplay, setAutoDisplay] = useState(config.autoDisplayOnDashboard ?? true);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentReport, setCurrentReport] = useState<AiAnalysisReport | null>(null);

    if (!isOpen) return null;

    const toggleModule = (id: AnalysisModuleScope) => {
        setSelectedModules(prev => 
            prev.includes(id) 
                ? (prev.length > 1 ? prev.filter(m => m !== id) : prev) 
                : [...prev, id]
        );
    };

    const selectAllModules = () => {
        setSelectedModules(AVAILABLE_MODULES.map(m => m.id));
    };

    const handleSaveSchedule = () => {
        const updatedConfig: AiAnalysisScheduleConfig = {
            ...config,
            isEnabled: true,
            cadence,
            selectedModules,
            autoDisplayOnDashboard: autoDisplay,
            dateRange: { startDate, endDate },
            nextRunAt: new Date(Date.now() + 3600 * 1000 * 24 * (cadence === 'weekly' ? 7 : cadence === 'monthly' ? 30 : 365)).toISOString()
        };
        onUpdateConfig(updatedConfig);
        saveAnalysisConfig(updatedConfig);
        toast.success(isKa ? 'AI ანალიზის გრაფიკი შენახულია' : 'AI Analysis Schedule Configured & Active');
    };

    const handleRunAnalysis = async (mode: AnalysisTriggerMode) => {
        setIsAnalyzing(true);
        try {
            const report = await runMultiModuleAiAnalysis({
                triggerMode: mode,
                cadence,
                selectedModules,
                dateRange: mode === 'interval' ? { startDate, endDate } : undefined,
                targetFilter: mode === 'on_demand' ? targetFilter : undefined,
                inventoryItems,
                stockTransactions,
                nutritionPlans,
                planExecutions,
                workAssignments,
                dailyLogs,
                harvests: harvestEvents,
                accounts,
                language: isKa ? 'KA' : 'EN'
            });

            setCurrentReport(report);
            onAnalysisCompleted(report);
            toast.success(isKa ? 'AI ანალიზი წარმატებით დასრულდა' : 'Multi-Module AI Analysis Generated');
        } catch (error) {
            console.error("AI Analysis failed:", error);
            toast.error(isKa ? 'ანალიზის შესრულება ვერ მოხერხდა' : 'Failed to execute AI analysis');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
            <div className="bg-slate-900 text-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-700/80 overflow-hidden relative">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-800 bg-slate-950/90 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <SparklesIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                                {isKa ? 'AI ოპერაციული ანალიზატორი & ანომალიების ცენტრი' : 'AI Cross-Module Operational Analyzer & Anomaly Hub'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                {isKa 
                                    ? 'მარაგების ავტო-ჩამოწერა, აგრონომიული კვება, სამუშაოების დისბალანსი და ინტერვალური გრაფიკი'
                                    : 'Real-time stock deduction, agronomy nutrition audits, workforce ratio balance & custom intervals'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Mode Selector */}
                <div className="px-6 sm:px-8 pt-4 pb-2 border-b border-slate-800 bg-slate-900/50 flex flex-wrap gap-2 shrink-0">
                    <button
                        onClick={() => setActiveTab('scheduled')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'scheduled'
                                ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-102'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <ClockIcon className="w-4 h-4" />
                        <span>{isKa ? '1. პერიოდული განრიგი (Scheduled)' : '1. Scheduled Routine'}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('interval')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'interval'
                                ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-102'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <CalendarDaysIcon className="w-4 h-4" />
                        <span>{isKa ? '2. დროის ინტერვალი (Custom Date Range)' : '2. Custom Interval Range'}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('on_demand')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'on_demand'
                                ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-102'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span>{isKa ? '3. ექსპრეს-დიაგნოსტიკა (On-Demand)' : '3. On-Demand Target Audit'}</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    
                    {/* Section 1: Module Selection Grid */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                                    {isKa ? 'ანალიზის მოდულების შერჩევა (Module Scope Selection)' : 'Target Module Selection Grid'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {isKa ? 'მონიშნეთ მოდულები, რომელთა მონაცემებიც უნდა გაანალიზდეს ერთიან ნაკადში:' : 'Select which data domains to audit and correlate together:'}
                                </p>
                            </div>
                            <button
                                onClick={selectAllModules}
                                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
                            >
                                {isKa ? 'ყველას მონიშვნა' : 'Select All'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                            {AVAILABLE_MODULES.map(mod => {
                                const isSelected = selectedModules.includes(mod.id);
                                const Icon = mod.icon;
                                return (
                                    <div
                                        key={mod.id}
                                        onClick={() => toggleModule(mod.id)}
                                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                                            isSelected 
                                                ? 'bg-slate-800/90 border-emerald-500 shadow-md shadow-emerald-500/10' 
                                                : 'bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-90'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl border ${mod.color}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-200">
                                                {isKa ? mod.labelKa : mod.labelEn}
                                            </span>
                                        </div>
                                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border ${
                                            isSelected ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-700'
                                        }`}>
                                            {isSelected && <CheckIcon className="w-3.5 h-3.5" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 2: Mode-Specific Configuration Controls */}
                    {activeTab === 'scheduled' && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                                {isKa ? 'ავტომატური პერიოდულობის პარამეტრები' : 'Periodic Cadence & Automation'}
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'weekly', labelKa: 'ყოველ კვირას (Weekly)', labelEn: 'Weekly' },
                                    { id: 'monthly', labelKa: 'ყოველ თვეს (Monthly)', labelEn: 'Monthly' },
                                    { id: 'annual', labelKa: 'წლიური (Annual)', labelEn: 'Annual' }
                                ].map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setCadence(c.id as AnalysisIntervalCadence)}
                                        className={`py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all ${
                                            cadence === c.id 
                                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {isKa ? c.labelKa : c.labelEn}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={autoDisplay}
                                        onChange={(e) => setAutoDisplay(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs font-bold text-slate-300">
                                        {isKa ? 'შედეგების ავტომატურად გამოტანა მთავარ Dashboard-ზე' : 'Automatically display fresh analysis answers on Dashboard overview'}
                                    </span>
                                </label>

                                <button
                                    onClick={handleSaveSchedule}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md"
                                >
                                    {isKa ? 'განრიგის შენახვა' : 'Save Schedule'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'interval' && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                                {isKa ? 'ზუსტი დროითი ინტერვალის შერჩევა (მაგ. 14 მაისი - 10 ივლისი)' : 'Precision Date Range (e.g., May 14 to July 10)'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5">
                                        {isKa ? 'საწყისი თარიღი (Start Date):' : 'Start Date:'}
                                    </label>
                                    <input 
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5">
                                        {isKa ? 'საბოლოო თარიღი (End Date):' : 'End Date:'}
                                    </label>
                                    <input 
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-indigo-300">
                                ℹ️ {isKa 
                                    ? `შერჩეულია პერიოდი ${startDate}-დან ${endDate}-მდე. აგრონომიულ კვებაში გაანალიზდება ყველა მიწოდებული სასუქი, დოზირება და ფაქტობრივი ხარჯი.` 
                                    : `Selected range: ${startDate} to ${endDate}. Will perform deep comparison between planned nutritional protocols and actual applied dosages.`}
                            </p>
                        </div>
                    )}

                    {activeTab === 'on_demand' && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                                {isKa ? 'კონკრეტული პოზიციების მონიშვნა (Specific Target Diagnostics)' : 'Target Specific Items or Anomaly Queries'}
                            </h3>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                                    {isKa ? 'საძიებო ობიექტი ან საკვანძო სიტყვა (მაგ. ლურსმანი, მონოკალიუმი, ჭრა/დარგვა):' : 'Filter by item name (e.g. Nails, Monopotassium, Pruning/Planting):'}
                                </label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        value={targetFilter}
                                        onChange={(e) => setTargetFilter(e.target.value)}
                                        placeholder={isKa ? 'ჩაწერეთ საგანი (მაგ. Nails, მონოკალიუმის ფოსფატი)...' : 'e.g. Nails in Stock, Monopotassium Phosphate...'}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                    />
                                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {[
                                    'Nails (ლურსმანი)',
                                    'მონოკალიუმი (MKP)',
                                    'ჭრა vs დარგვა (9x Ratio)',
                                    'სასუქების ავტო-ჩამოწერა'
                                ].map(quick => (
                                    <button
                                        key={quick}
                                        type="button"
                                        onClick={() => setTargetFilter(quick)}
                                        className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-indigo-300 border border-slate-700"
                                    >
                                        + {quick}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Trigger Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={() => handleRunAnalysis(activeTab)}
                            disabled={isAnalyzing}
                            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <>
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    <span>{isKa ? 'AI ანალიზი მუშავდება...' : 'Synthesizing Operational Data...'}</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-4 h-4" />
                                    <span>
                                        {activeTab === 'scheduled' 
                                            ? (isKa ? 'ანალიზის გაშვება & განრიგის დაწყება' : 'Execute & Sync Schedule') 
                                            : activeTab === 'interval' 
                                            ? (isKa ? `ინტერვალის გაანალიზება (${startDate} - ${endDate})` : `Analyze Range (${startDate} - ${endDate})`) 
                                            : (isKa ? 'ექსპრეს-დიაგნოსტიკის ჩატარება' : 'Run Instant Diagnostic')}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Analysis Results Display */}
                    {currentReport && (
                        <div className="space-y-4 pt-4 border-t border-slate-800 animate-fade-in">
                            <div className="bg-slate-950/90 border border-emerald-500/30 rounded-3xl p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                                        <CheckIcon className="w-4 h-4" />
                                        {isKa ? 'AI ანალიტიკური ანგარიში' : 'AI Multi-Module Diagnostic Report'}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                        {new Date(currentReport.createdAt).toLocaleTimeString()}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-slate-200 leading-relaxed bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                                    {currentReport.executiveSummary}
                                </p>
                            </div>

                            {/* Anomalies Highlight Cards */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                                    {isKa ? 'გამოვლენილი ოპერაციული ანომალიები:' : 'Detected Operational Anomalies & Actions:'}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {currentReport.anomalies.map(anomaly => (
                                        <div key={anomaly.id} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-400" />
                                                    {anomaly.title}
                                                </span>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                                    +{anomaly.variancePercentage}% {isKa ? 'გადახრა' : 'Variance'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                {anomaly.description}
                                            </p>
                                            <div className="bg-slate-900 p-2.5 rounded-xl text-[11px] text-emerald-300 border border-slate-800">
                                                <strong>{isKa ? 'რეკომენდაცია: ' : 'Recommended Action: '}</strong>
                                                {anomaly.actionRecommendation}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 sm:px-8 py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        {isKa ? 'ავტომატური სინქრონიზაცია მარაგებსა და დავალებებს შორის აქტიურია' : 'Continuous real-time stock deduction active'}
                    </span>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AiCrossModuleAnalysisModal;
