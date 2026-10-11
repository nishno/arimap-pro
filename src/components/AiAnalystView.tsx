
import React, { useState, useRef, useEffect, useCallback } from 'react';
import L from 'leaflet';
import type { 
    AnalysisResult, GroundingSource, SoilData, SoilAnalysisResult, 
    UploadedDocument, PlantDiseaseAnalysis, DashboardWidget, 
    AgroCultureAnalysis, SuitabilityItem, NutritionPlan, User, 
    Organization, PlantationFeature, Crop, InventoryItem,
    AnalysisModuleScope, AnalysisTriggerMode, AnalysisIntervalCadence, 
    AiAnomalyAlert, AiAnalysisReport, AiAnalysisScheduleConfig
} from '../types';
import { isValidCoordinate } from '../types';
import MapComponent from './MapComponent';
import { 
    SearchIcon, AlertTriangleIcon, BeakerIcon, ChartBarIcon, 
    ArrowsPointingInIcon, ArrowsPointingOutIcon, ClipboardDocumentIcon, 
    XCircleIcon, SparklesIcon, PlantIcon, ArrowUpTrayIcon, 
    MapPinIcon, PlusCircleIcon, CalendarDaysIcon, ClockIcon, 
    CheckIcon, ArrowPathIcon, BriefcaseIcon, BanknotesIcon, TractorIcon
} from './Icons';
import { Stethoscope } from 'lucide-react';
import AiAnalysisSuite from './AiAnalysisSuite';
import type { MapComponentProps } from './MapComponent';
import WidgetActionToolbar from './WidgetActionToolbar';
import { useLanguage } from '../contexts/LanguageContext';
import { generateAgroCultureAnalysis } from '../services/geminiService';
import { 
    detectCrossModuleAnomalies, runMultiModuleAiAnalysis, 
    getSavedAnalysisConfig, saveAnalysisConfig 
} from '../services/crossModuleAnalysisService';
import { toast } from 'sonner';
import ResizableDivider from './common/ResizableDivider';
import { safeStorage } from '../services/storageService';


interface AiAnalystViewProps {
  onSearch: (query: string) => void;
  loading: boolean;
  error: string | null;
  analysisResult: AnalysisResult | null;
  sources: GroundingSource[];
  onSoilSearch: (data: SoilData) => void;
  isSoilLoading: boolean;
  soilError: string | null;
  soilAnalysisResult: SoilAnalysisResult | null;
  mapProps: MapComponentProps;
  isMapFullScreen: boolean;
  onSetIsMapFullScreen: (isFull: boolean) => void;
  onAddToDashboard?: (widget: Omit<DashboardWidget, 'id' | 'order' | 'isVisible'>) => void;
  onSetNutritionPlans?: React.Dispatch<React.SetStateAction<NutritionPlan[]>>;
  allUsers?: User[];
  organizations?: Organization[];
  crops?: Crop[];
  forwardedPartnerData?: any;
  initialTab?: 'agro' | 'global' | 'market' | 'cross_module' | 'diagnostics';
  onTabChange?: (tab: 'agro' | 'global' | 'market' | 'cross_module' | 'diagnostics') => void;
  inventoryItems?: InventoryItem[];
  activeOrgId?: string;
  currentUser?: User | null;
  onAddTask?: (task: any) => void;
}


const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const AiAnalystView: React.FC<AiAnalystViewProps> = (props) => {
    const { t, language } = useLanguage();
    const { 
        onSearch, loading, error, analysisResult, sources = [],
        mapProps, isMapFullScreen, onSetIsMapFullScreen,
        onAddToDashboard, onSetNutritionPlans,
        allUsers = [], organizations = [], crops = [], forwardedPartnerData,
        initialTab, onTabChange
    } = props;

    const [activeTab, setActiveTab] = useState<'agro' | 'global' | 'market' | 'cross_module' | 'diagnostics'>(initialTab || 'agro');

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const handleTabChange = (tab: 'agro' | 'global' | 'market' | 'cross_module' | 'diagnostics') => {
        setActiveTab(tab);
        if (onTabChange) onTabChange(tab);
    };

    // Operational Cross-Module State
    const [crossConfig, setCrossConfig] = useState<AiAnalysisScheduleConfig>(getSavedAnalysisConfig());
    const [crossSelectedModules, setCrossSelectedModules] = useState<AnalysisModuleScope[]>(['stock', 'agronomy', 'tasks', 'harvest', 'accounting']);
    const [crossCadence, setCrossCadence] = useState<AnalysisIntervalCadence>('weekly');
    const [crossStartDate, setCrossStartDate] = useState('2026-05-14');
    const [crossEndDate, setCrossEndDate] = useState('2026-07-10');
    const [crossTarget, setCrossTarget] = useState('');
    const [crossReport, setCrossReport] = useState<AiAnalysisReport | null>(null);
    const [isCrossAnalyzing, setIsCrossAnalyzing] = useState(false);

    const isKa = language === 'ka';

    const handleExecuteCrossAnalysis = async (mode: AnalysisTriggerMode) => {
        setIsCrossAnalyzing(true);
        try {
            const report = await runMultiModuleAiAnalysis({
                triggerMode: mode,
                cadence: crossCadence,
                selectedModules: crossSelectedModules,
                dateRange: mode === 'interval' ? { startDate: crossStartDate, endDate: crossEndDate } : undefined,
                targetFilter: mode === 'on_demand' ? crossTarget : undefined,
                inventoryItems: props.inventoryItems || [],
                nutritionPlans: [],
                planExecutions: [],
                workAssignments: [],
                dailyLogs: [],
                language: isKa ? 'ka' : 'en'
            });
            setCrossReport(report);
            toast.success(isKa ? 'ოპერაციული AI ანალიზი დასრულდა' : 'Cross-Module AI Audit Complete');
        } catch (e) {
            toast.error(isKa ? 'ანალიზის შესრულება ვერ მოხერხდა' : 'Failed to execute cross-module analysis');
        } finally {
            setIsCrossAnalyzing(false);
        }
    };


    const [searchQuery, setSearchQuery] = useState('');
    const [regionSearch, setRegionSearch] = useState('');

    // Resizable Edge Handle state
    const [analystPanelWidth, setAnalystPanelWidth] = useState<number>(() => {
        const saved = safeStorage.getItem('ai_analyst_panel_width');
        const parsed = saved ? parseInt(saved, 10) : 480;
        return Number.isFinite(parsed) && parsed >= 280 ? parsed : 480;
    });
    const [regionalData, setRegionalData] = useState<{
        plantations: number;
        crops: { name: string, area: number }[];
        workers: { total: number, free: number };
        companies: Organization[];
    } | null>(null);

    useEffect(() => {
        if (forwardedPartnerData) {
            const targetTab = forwardedPartnerData.type === 'market' ? 'market' : 'global';
            handleTabChange(targetTab);
            if (forwardedPartnerData.type === 'market') {
                setSearchQuery("Provide comprehensive market intelligence and trade analytics for local and export corridors.");
            } else {
                setSearchQuery(`Analyze strategic partnership viability with ${forwardedPartnerData.name || 'identified entity'} in ${forwardedPartnerData.region || 'the target region'}. Crops: ${forwardedPartnerData.crops?.join(', ') || 'N/A'}.`);
            }
        }
    }, [forwardedPartnerData]);

    const handleRegionalSearch = () => {
        const query = regionSearch.toLowerCase();
        const regionOrgs = organizations.filter(o => o.region?.toLowerCase().includes(query) || o.name.toLowerCase().includes(query));
        const orgIds = regionOrgs.map(o => o.id);
        const regionCrops = crops.filter(c => orgIds.includes(c.organizationId));
        
        const cropSummary = regionCrops.reduce((acc, c) => {
            const existing = acc.find(a => a.name === c.name);
            if (existing) {
                existing.area += (c as any).plannedArea || 10;
            } else {
                acc.push({ name: c.name, area: (c as any).plannedArea || 10 });
            }
            return acc;
        }, [] as { name: string, area: number }[]);

        const regionWorkers = allUsers.filter(u => u.roles?.includes('worker') && (u.region?.toLowerCase().includes(query) || u.name.toLowerCase().includes(query)));

        setRegionalData({
            plantations: regionOrgs.length,
            crops: cropSummary,
            workers: {
                total: regionWorkers.length,
                free: regionWorkers.filter(w => (w as any).status === 'active' || (w as any).status === 'verified').length
            },
            companies: regionOrgs
        });

        // Combined analysis: Internal registry + Global AI
        onSearch(`Agricultural Market Analysis for ${regionSearch}:
        - Our registry shows ${regionOrgs.length} local companies and ${regionWorkers.length} available workers. 
        - Provide a cross-border price analysis and global trend report for this region. 
        - Synchronize with internal crops: ${cropSummary.map(c => c.name).join(', ')}.`);
    };

    const handleExportReport = () => {
        if (!regionalData) return;
        const report = [
            `Regional Intelligence Report: ${regionSearch}`,
            `Generated: ${new Date().toLocaleString()}`,
            '',
            `Plantations Registered: ${regionalData.plantations}`,
            `Global Workers Detected: ${regionalData.workers.total} (${regionalData.workers.free} Free)`,
            '',
            'Crop Distribution:',
            ...regionalData.crops.map(c => `- ${c.name}: ${c.area} ha`),
            '',
            'Registered Companies:',
            ...regionalData.companies.map(o => `- ${o.name} (${o.region})`)
        ].join('\n');

        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Market_Report_${regionSearch.replace(/\s+/g, '_')}.txt`;
        link.click();
    };
    
    // Agro-Intelligence State
    const [agroInput, setAgroInput] = useState<AgroCultureAnalysis>({
        analysisId: '',
        userId: 'current',
        locationGeo: { lat: props.mapProps.center[0], lng: props.mapProps.center[1] },
        pHLevel: 6.5,
        nitrogenLevel: 50,
        phosphorusLevel: 30,
        potassiumLevel: 40,
        targetCultureQuestion: '',
        timestamp: '',
        aiReport: null
    });
    const [isAgroAnalyzing, setIsAgroAnalyzing] = useState(false);
    const [isPickingLocation, setIsPickingLocation] = useState(false);
    const [latInput, setLatInput] = useState(Number.isFinite(agroInput.locationGeo.lat) ? agroInput.locationGeo.lat.toFixed(4) : '');
    const [lngInput, setLngInput] = useState(Number.isFinite(agroInput.locationGeo.lng) ? agroInput.locationGeo.lng.toFixed(4) : '');

    const handleCreatePlanFromAi = (crop: string) => {
        if (!onSetNutritionPlans) return;
        
        const newPlan: NutritionPlan = {
            id: `ai-plan-${Date.now()}`,
            name: `AI Recommended: ${crop}`,
            elements: [
                { inventoryItemId: 'nitrogen', newItemName: 'Nitrogen (N)', quantity: 50, unit: 'kg/ha' },
                { inventoryItemId: 'phosphorus', newItemName: 'Phosphorus (P)', quantity: 30, unit: 'kg/ha' },
                { inventoryItemId: 'potassium', newItemName: 'Potassium (K)', quantity: 40, unit: 'kg/ha' }
            ],
            purpose: 'Feeding',
            startDate: new Date().toISOString().split('T')[0],
            targetPH: agroInput.pHLevel
        };
        
        onSetNutritionPlans(prev => [...prev, newPlan]);
        alert(`Created nutrition plan for ${crop}! You can find it in the Nutrition section.`);
    };

    useEffect(() => {
        const currentLat = parseFloat(latInput);
        if (Number.isNaN(currentLat) || Math.abs(currentLat - agroInput.locationGeo.lat) > 1e-6) {
            setLatInput(Number.isFinite(agroInput.locationGeo.lat) ? agroInput.locationGeo.lat.toFixed(4) : '');
        }
        const currentLng = parseFloat(lngInput);
        if (Number.isNaN(currentLng) || Math.abs(currentLng - agroInput.locationGeo.lng) > 1e-6) {
            setLngInput(Number.isFinite(agroInput.locationGeo.lng) ? agroInput.locationGeo.lng.toFixed(4) : '');
        }
    }, [agroInput.locationGeo]);


    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const handleMapClick = (latlng: L.LatLng) => {
        console.log("Map clicked at:", latlng, "isPickingLocation:", isPickingLocation);
        if (isPickingLocation) {
            setAgroInput(prev => ({
                ...prev,
                locationGeo: { lat: latlng.lat, lng: latlng.lng }
            }));
            setIsPickingLocation(false);
        }
    };
    
    const handleCoordChange = (field: 'lat' | 'lng', value: string) => {
        if (field === 'lat') setLatInput(value);
        else setLngInput(value);
    };

    const handleCoordBlur = (field: 'lat' | 'lng', value: string) => {
        const numValue = parseFloat(value);
        if (!Number.isNaN(numValue)) {
            setAgroInput(prev => ({
                ...prev,
                locationGeo: {
                    ...prev.locationGeo,
                    [field]: numValue
                }
            }));
        } else {
            if (field === 'lat') setLatInput(Number.isFinite(agroInput.locationGeo.lat) ? agroInput.locationGeo.lat.toFixed(4) : '');
            else setLngInput(Number.isFinite(agroInput.locationGeo.lng) ? agroInput.locationGeo.lng.toFixed(4) : '');
        }
    };
    
    const handleFindOnMap = () => {
        const lat = parseFloat(latInput);
        const lng = parseFloat(lngInput);
        if (isValidCoordinate([lat, lng])) {
            setAgroInput(prev => ({ ...prev, locationGeo: { lat, lng } }));
            props.mapProps.onSetMapCenter([lat, lng]);
        } else {
            alert("Invalid coordinates entered.");
        }
    };

    const handleAgroAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAgroAnalyzing(true);
        
        const nearbyCultures: string[] = props.mapProps.plantationFeatures
            .filter(f => f.type === 'area' && (f as any).cropType)
            .map(f => (f as any).cropType as string);
        
        const uniqueCultures: string[] = Array.from(new Set(nearbyCultures));

        try {
            const report = await generateAgroCultureAnalysis(agroInput, uniqueCultures, language);
            setAgroInput(prev => ({
                ...prev,
                aiReport: report,
                timestamp: new Date().toISOString()
            }));
        } catch (e) {
            console.error(e);
            alert("Analysis failed.");
        } finally {
            setIsAgroAnalyzing(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); if (searchQuery.trim()) onSearch(searchQuery); };
    
    const TabButton = ({ id, label, icon }: { id: typeof activeTab, label: string, icon: React.ReactNode }) => (
        <button
            onClick={() => handleTabChange(id)}
            className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white border-b flex-shrink-0">
                <div className="flex">
                    <TabButton id="agro" label={t('ai.agro_intel')} icon={<BeakerIcon className="h-5 w-5" />} />
                    <TabButton id="diagnostics" label={isKa ? 'დიაგნოსტიკა & კლინიკა' : 'Diagnostics & Clinical Tools'} icon={<Stethoscope className="h-5 w-5 text-emerald-600" />} />
                    <TabButton id="cross_module" label={isKa ? 'ოპერაციული ანალიზი & განრიგი' : 'Operational Anomaly & Schedule'} icon={<ClockIcon className="h-5 w-5 text-emerald-600" />} />
                    <TabButton id="global" label={t('ai.global_intel')} icon={<SparklesIcon className="h-5 w-5" />} />
                    <TabButton id="market" label={t('ai.market_analysis')} icon={<ChartBarIcon className="h-5 w-5" />} />
                </div>
            </div>

            {activeTab === 'diagnostics' ? (
                <div className="flex-1 overflow-hidden h-full flex flex-col bg-slate-50">
                    <AiAnalysisSuite
                        mode="full"
                        activeOrgId={props.activeOrgId}
                        currentUser={props.currentUser}
                        onAddTask={props.onAddTask}
                        onAddNutritionPlan={props.onSetNutritionPlans ? (p) => props.onSetNutritionPlans(prev => [p, ...(prev || [])]) : undefined}
                    />
                </div>
            ) : (
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-gray-100">
                {/* Control Panel */}
                <div 
                    className={`w-full bg-white border-r flex-shrink-0 flex flex-col h-[50vh] md:h-full overflow-y-auto ${isMapFullScreen ? 'hidden' : ''}`}
                    style={{
                        width: typeof window !== 'undefined' && window.innerWidth > 768 ? `${analystPanelWidth}px` : undefined,
                        maxWidth: '85vw'
                    }}
                >
                    
                    {activeTab === 'cross_module' && (
                        <div className="p-6 space-y-6 animate-fade-in">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {isKa ? 'ოპერაციული AI აუდიტი & განრიგი' : 'Operational AI Audit & Scheduler'}
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        Auto-Sync
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                    {isKa ? 'მარაგების ავტო-ჩამოწერა, აგრონომია, სამუშაოები & ინტერვალები' : 'Continuous Anomaly Engine & Multi-Module Intervals'}
                                </p>

                                {/* Module Selector Box */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                                        {isKa ? '1. ანალიზის მოდულები (Multi-Module Scope):' : '1. Select Target Modules:'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {[
                                            { id: 'stock', label: isKa ? '📦 საწყობი & ავტო-ჩამოწერა' : '📦 Stock & Deductions' },
                                            { id: 'agronomy', label: isKa ? '🧪 აგრონომიული კვება' : '🧪 Agronomy Nutrition' },
                                            { id: 'tasks', label: isKa ? '🛠️ სამუშაოები & შრომა' : '🛠️ Tasks & Labor Skew' },
                                            { id: 'harvest', label: isKa ? '⚖️ ამწონი & საცივრე' : '⚖️ Weight & Cold Chain' },
                                            { id: 'accounting', label: isKa ? '💰 ფინანსები & OPEX' : '💰 Finance & OPEX' },
                                            { id: 'machinery', label: isKa ? '🚜 ტექნიკა & ფლოტი' : '🚜 Machinery & Fuel' }
                                        ].map(m => (
                                            <label key={m.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer text-[11px] font-bold text-slate-800">
                                                <input 
                                                    type="checkbox"
                                                    checked={crossSelectedModules.includes(m.id as AnalysisModuleScope)}
                                                    onChange={() => {
                                                        const id = m.id as AnalysisModuleScope;
                                                        setCrossSelectedModules(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]);
                                                    }}
                                                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="truncate">{m.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Cadence & Precision Date Range Box */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                                        {isKa ? '2. პერიოდულობა / დროის ინტერვალი:' : '2. Cadence & Custom Date Range:'}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['weekly', 'monthly', 'annual'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setCrossCadence(c as AnalysisIntervalCadence)}
                                                className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                    crossCadence === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 block mb-1">
                                                {isKa ? 'საწყისი (Start):' : 'Start Date:'}
                                            </span>
                                            <input 
                                                type="date"
                                                value={crossStartDate}
                                                onChange={e => setCrossStartDate(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 block mb-1">
                                                {isKa ? 'საბოლოო (End):' : 'End Date:'}
                                            </span>
                                            <input 
                                                type="date"
                                                value={crossEndDate}
                                                onChange={e => setCrossEndDate(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Target Search & Trigger */}
                                <div className="space-y-3">
                                    <input 
                                        type="text"
                                        placeholder={isKa ? "საძიებო ობიექტი (მაგ. Nails, მონოკალიუმი, ჭრა)..." : "Specific target item (e.g. Nails, MKP)..."}
                                        value={crossTarget}
                                        onChange={e => setCrossTarget(e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white outline-none"
                                    />
                                    
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleExecuteCrossAnalysis('scheduled')}
                                            disabled={isCrossAnalyzing}
                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            {isCrossAnalyzing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ClockIcon className="w-4 h-4" />}
                                            <span>{isKa ? 'პერიოდული აუდიტი' : 'Run Scheduled'}</span>
                                        </button>
                                        <button
                                            onClick={() => handleExecuteCrossAnalysis('interval')}
                                            disabled={isCrossAnalyzing}
                                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            {isCrossAnalyzing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CalendarDaysIcon className="w-4 h-4" />}
                                            <span>{isKa ? 'ინტერვალის ანალიზი' : 'Analyze Range'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Report Output Display */}
                                {crossReport && (
                                    <div className="mt-6 space-y-4 animate-slide-up">
                                        <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                                    Executive AI Summary
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(crossReport.createdAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-200 leading-relaxed">
                                                {crossReport.executiveSummary}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                {isKa ? 'გამოვლენილი ანომალიები:' : 'Detected Anomalies:'}
                                            </p>
                                            {crossReport.anomalies.map(anom => (
                                                <div key={anom.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold text-slate-900">{anom.title}</span>
                                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">
                                                            +{anom.variancePercentage}%
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600">{anom.description}</p>
                                                    <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg">
                                                        💡 {anom.actionRecommendation}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    
                    {activeTab === 'global' && (
                        <div className="p-6 space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">{t('ai.global_intel')}</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">{t('ai.regional_distribution')}</p>
                                
                                <div className="space-y-4">
                                    <form onSubmit={(e) => { e.preventDefault(); onSearch(searchQuery); }} className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Ask global AI about trends, prices..."
                                            className="w-full p-4 pr-12 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-sm"
                                        />
                                        <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                            <SearchIcon size={20} />
                                        </button>
                                    </form>
                                    
                                    <p className="text-[9px] text-slate-400 italic">This analysis uses global data sources independently of internal registries.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'market' && (
                        <div className="p-6 space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">{t('ai.market_analysis')}</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Internal Registry + Global AI Synthesis</p>
                                
                                <div className="relative mb-6">
                                    <input 
                                        type="text"
                                        placeholder="Search Region for Combined Analysis..."
                                        value={regionSearch}
                                        onChange={e => setRegionSearch(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                    />
                                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                                    <button 
                                        onClick={handleRegionalSearch}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                    >
                                        Analyze Hybrid
                                    </button>
                                </div>
                            </div>

                            {regionalData && (
                                <div className="space-y-6 animate-slide-up">
                                    {/* Hybrid Intelligence UI elements */}
                                    <div className="p-4 bg-indigo-900 text-white rounded-[2rem] border border-indigo-100 shadow-xl relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 opacity-10">
                                            <SparklesIcon size={80} />
                                        </div>
                                        <div className="flex justify-between items-end relative z-10">
                                            <div>
                                                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1">Internal Pulse</p>
                                                <div className="flex gap-4">
                                                    <div>
                                                        <p className="text-xl font-black">{regionalData.plantations}</p>
                                                        <p className="text-[8px] uppercase tracking-tighter opacity-70">Companies</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xl font-black">{regionalData.workers.total}</p>
                                                        <p className="text-[8px] uppercase tracking-tighter opacity-70">Workers</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1">AI Match</p>
                                                <p className="text-sm font-black text-emerald-400">HIGH DEMAND</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Crop Distribution */}
                                    <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
                                        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <PlantIcon size={12} /> Registry Context
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {regionalData.crops.slice(0, 5).map((c, i) => (
                                                <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600">
                                                    {c.name}: {c.area}ha
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI Chat-like Assistant Trigger */}
                                    <div className="border-t pt-6">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Deep Intelligence Query</p>
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            if (searchQuery.trim()) {
                                                let contextQuery = `[HYBRID ANALYSIS REQUEST]\nRegion: ${regionSearch}\nInternal Data: ${regionalData.plantations} companies, ${regionalData.workers.total} workers.\nLocal Crops: ${regionalData.crops.map(c => c.name).join(', ')}\n\nUser Question: ${searchQuery}`;
                                                onSearch(contextQuery);
                                            }
                                        }} className="relative">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Ask specifically about this hybrid context..."
                                                className="w-full p-4 pr-12 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-inner"
                                            />
                                            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800">
                                                <SearchIcon size={18} />
                                            </button>
                                        </form>
                                    </div>

                                    <button 
                                        onClick={handleExportReport}
                                        className="w-full py-4 bg-white border border-slate-200 text-slate-800 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ClipboardDocumentIcon size={14} /> Full Intel Export
                                    </button>
                                </div>
                            )}

                            {analysisResult && (
                                <div className="space-y-4 animate-slide-up bg-indigo-50/20 p-6 rounded-[2.5rem] border border-indigo-100/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                                            <SparklesIcon size={14} />
                                        </div>
                                        <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{t('ai.strategic_synthesis')}</span>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">{analysisResult.summary}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'agro' && (
                        <div className="p-6 space-y-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><SparklesIcon className="h-5 w-5 text-purple-600"/> {t('ai.agro_planner')}</h2>
                            <p className="text-xs text-gray-500">{t('ai.agro_planner_desc')}</p>
                            
                            <form onSubmit={handleAgroAnalyze} className="space-y-4 border p-4 rounded-lg bg-gray-50">
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Location Coordinates</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Latitude"
                                                value={latInput}
                                                onChange={e => handleCoordChange('lat', e.target.value)}
                                                onBlur={e => handleCoordBlur('lat', e.target.value)}
                                                className="w-full p-2 border rounded text-sm text-center"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Longitude"
                                                value={lngInput}
                                                onChange={e => handleCoordChange('lng', e.target.value)}
                                                onBlur={e => handleCoordBlur('lng', e.target.value)}
                                                className="w-full p-2 border rounded text-sm text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                console.log("Finding on map:", latInput, lngInput);
                                                handleFindOnMap();
                                            }}
                                            className="text-xs px-3 py-2 rounded-lg font-medium flex-grow bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <SearchIcon className="h-4 w-4" /> Find on Map
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                console.log("Toggling pick location. Current:", isPickingLocation);
                                                setIsPickingLocation(!isPickingLocation);
                                            }} 
                                            className={`text-xs px-3 py-2 rounded-lg font-medium flex-grow flex items-center justify-center gap-1 transition-colors ${isPickingLocation ? 'bg-blue-600 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                        >
                                            <MapPinIcon className="h-4 w-4"/> {isPickingLocation ? 'Picking...' : 'Pick from Map'}
                                        </button>
                                    </div>
                                </div>

                                {isPickingLocation && <p className="text-xs text-blue-600 font-medium text-center mt-2">Click on the map to set location.</p>}

                                <div className="grid grid-cols-4 gap-2">
                                    <div><label className="text-xs font-bold">pH</label><input type="number" step="0.1" value={Number.isNaN(agroInput.pHLevel) ? '' : agroInput.pHLevel} onChange={e => setAgroInput({...agroInput, pHLevel: e.target.value === '' ? NaN : parseFloat(e.target.value)})} className="w-full p-1 border rounded text-sm text-center" /></div>
                                    <div><label className="text-xs font-bold">N</label><input type="number" value={Number.isNaN(agroInput.nitrogenLevel) ? '' : agroInput.nitrogenLevel} onChange={e => setAgroInput({...agroInput, nitrogenLevel: e.target.value === '' ? NaN : parseFloat(e.target.value)})} className="w-full p-1 border rounded text-sm text-center" /></div>
                                    <div><label className="text-xs font-bold">P</label><input type="number" value={Number.isNaN(agroInput.phosphorusLevel) ? '' : agroInput.phosphorusLevel} onChange={e => setAgroInput({...agroInput, phosphorusLevel: e.target.value === '' ? NaN : parseFloat(e.target.value)})} className="w-full p-1 border rounded text-sm text-center" /></div>
                                    <div><label className="text-xs font-bold">K</label><input type="number" value={Number.isNaN(agroInput.potassiumLevel) ? '' : agroInput.potassiumLevel} onChange={e => setAgroInput({...agroInput, potassiumLevel: e.target.value === '' ? NaN : parseFloat(e.target.value)})} className="w-full p-1 border rounded text-sm text-center" /></div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-1">Your Question</label>
                                    <input 
                                        type="text" 
                                        value={agroInput.targetCultureQuestion} 
                                        onChange={e => setAgroInput({...agroInput, targetCultureQuestion: e.target.value})}
                                        className="w-full p-2 border rounded-md text-sm"
                                        placeholder="e.g. For which culture is this land good?"
                                        required
                                    />
                                </div>

                                <button type="submit" disabled={isAgroAnalyzing} className="w-full py-2 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 disabled:opacity-50 shadow-md">
                                    {isAgroAnalyzing ? 'Processing Intelligence...' : 'Run Analysis'}
                                </button>
                            </form>

                            {agroInput.aiReport && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="p-4 bg-white rounded-lg border border-purple-200 shadow-sm">
                                         <div className="flex justify-between items-center mb-4">
                                             <h4 className="font-bold text-purple-900 flex items-center gap-2"><ChartBarIcon className="h-4 w-4"/> {t('ai.suitability_ranking')}</h4>
                                             <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">AI Planner</span>
                                         </div>
                                         <div className="space-y-4">
                                             {agroInput.aiReport.suitabilityRanking?.map((item: any, i) => {
                                                 const isObject = typeof item === 'object' && item !== null;
                                                 const label = isObject ? (item as SuitabilityItem).crop : String(item);
                                                 const suitability = isObject ? (item as SuitabilityItem).suitability : null;
                                                 const reason = isObject ? (item as SuitabilityItem).reason : null;

                                                 return (
                                                     <div key={i} className="group p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-200">
                                                         <div className="flex justify-between items-start mb-1">
                                                             <div>
                                                                 <span className="text-sm font-bold text-slate-800">{label}</span>
                                                                 {suitability && (
                                                                     <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase">
                                                                         {suitability}
                                                                     </span>
                                                                 )}
                                                             </div>
                                                             <button 
                                                                 onClick={() => handleCreatePlanFromAi(label)}
                                                                 className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-all"
                                                             >
                                                                 <PlusCircleIcon className="h-3 w-3" /> Create Plan
                                                             </button>
                                                         </div>
                                                         {reason && <p className="text-xs text-slate-500 leading-relaxed">{reason}</p>}
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                     </div>
                                     <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
                                         <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                                             <SparklesIcon className="h-4 w-4 text-emerald-600" /> {t('ai.strategic_recommendation')}
                                         </h4>
                                         <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed italic">
                                             "{agroInput.aiReport.agroCultureRecommendation}"
                                         </p>
                                     </div>
                                     <div className="grid grid-cols-2 gap-3">
                                         <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                             <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('ai.climate_analysis')}</span>
                                             <p className="text-xs text-slate-600 leading-snug">{agroInput.aiReport.climateAnalysis || 'Optimal conditions detected for regional patterns.'}</p>
                                         </div>
                                         <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                             <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('ai.soil_summary')}</span>
                                             <p className="text-xs text-slate-600 leading-snug">{agroInput.aiReport.soilAnalysis || 'Chemical balance suitable for diverse agriculture.'}</p>
                                         </div>
                                     </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Resizable Divider between AI Analyst Panel and Map */}
                {!isMapFullScreen && (
                    <ResizableDivider 
                        direction="horizontal"
                        currentSize={analystPanelWidth}
                        onResize={(newWidth) => setAnalystPanelWidth(newWidth)}
                        minSize={280}
                        maxSize={typeof window !== 'undefined' ? Math.max(window.innerWidth - 300, 600) : 850}
                        storageKey="ai_analyst_panel_width"
                        isKa={isKa}
                        className="hidden md:flex"
                    />
                )}

                {/* Map View */}
                <div className={`flex-1 relative ${isMapFullScreen ? 'h-full' : 'h-[50vh] md:h-auto'}`}>
                    <MapComponent 
                        {...mapProps} 
                        showSearch={true}
                        onMapClick={handleMapClick}
                    >
                    </MapComponent>
                    <button 
                       onClick={() => onSetIsMapFullScreen(!isMapFullScreen)} 
                       className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition"
                    >
                        {isMapFullScreen ? <ArrowsPointingInIcon className="h-5 w-5 text-gray-700" /> : <ArrowsPointingOutIcon className="h-5 w-5 text-gray-700" />}
                    </button>
                    {isPickingLocation && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-bounce">
                            Click map to select location
                        </div>
                    )}
                </div>
            </div>
            )}
        </div>
    );
};

export default AiAnalystView;
