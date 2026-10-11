
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { 
  User, PlantationFeature, AreaPlantationFeature, NotePlantationFeature, 
  SeedlingPlantationFeature, WeatherData, AssistantMessage, DashboardWidget, 
  WorkAssignment, InventoryItem, HarvestEvent, NutritionPlan, Account, 
  DailyLogEntry, Listing, DashboardWidgetType, HarvestEntry, Crop, Employee,
  AiAnomalyAlert, AiAnalysisReport, AiAnalysisScheduleConfig, AnalysisModuleScope, AnalysisTriggerMode,
  Role, ForumPost
} from '../types';
import {
  LeafIcon, TractorIcon, WaterDropIcon, ArrowTrendingUpIcon,
  SunIcon, SearchIcon, RectangleGroupIcon,
  ArrowsPointingOutIcon, ArrowsPointingInIcon, CheckIcon, AlertTriangleIcon, XCircleIcon, CameraIcon, MapPinIcon, WindIcon, WrenchScrewdriverIcon, BeakerIcon, BanknotesIcon, BriefcaseIcon, ChevronUpIcon, ChevronDownIcon, XIcon, ChartBarIcon, SparklesIcon, CalendarDaysIcon, ArrowPathIcon, UsersIcon, ShoppingBagIcon, HeartIcon,
  GripVerticalIcon, MapIcon, BuildingStorefrontIcon, PencilSquareIcon, PlusIcon
} from './Icons';
import { Video, MessageSquare, Mic, Sparkles, ArrowRight } from 'lucide-react';
import { MapComponent, MapComponentProps } from './MapComponent';
import { getSphericalPolygonArea } from '../services/geospatialService';
import { useLanguage } from '../contexts/LanguageContext';
import { getDailyBriefing } from '../services/geminiService';
import CropManagementModal, { formatPlantationCrops } from './CropManagementModal';
import CreateOrganizationModal from './CreateOrganizationModal';
import DashboardAiStream from './DashboardAiStream';
import AiCrossModuleAnalysisModal from './AiCrossModuleAnalysisModal';
import { 
  detectCrossModuleAnomalies, getSavedAnalysisConfig, 
  getStoredAnalysisReports, runMultiModuleAiAnalysis 
} from '../services/crossModuleAnalysisService';
import { DashboardProfileManager } from './DashboardProfileManager';
import { ChooseYourGoalWidget } from './ChooseYourGoalWidget';
import { AgronomyQuickAccessWidget } from './AgronomyQuickAccessWidget';
import { TasksQuickAccessWidget } from './TasksQuickAccessWidget';
import { FloatingWidgetWindow } from './FloatingWidgetWindow';
import { FieldSummaryWidget } from './FieldSummaryWidget';
import { SeedlingSummaryWidget } from './SeedlingSummaryWidget';
import { HarvestPulseWidget } from './HarvestPulseWidget';
import { MarketFeedWidget } from './MarketFeedWidget';
import { StaffAttendanceWidget } from './StaffAttendanceWidget';
import { PlannerScheduleWidget } from './PlannerScheduleWidget';
import { HardwareLabsWidget } from './HardwareLabsWidget';
import { TeamHubsWidget } from './TeamHubsWidget';
import { IntercomPopUpModal } from './IntercomPopUpModal';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { getWidgetTitle } from '../lib/widgetLocalization';
import { getSavedDashboardLayout, saveDashboardLayout, DEFAULT_DASHBOARD_LAYOUT } from '../utils/dashboardLayoutStorage';
import { Maximize2, Cpu, Calendar, Grid, Sprout, ShoppingBag, Briefcase, Tractor, Users, ArrowUpToLine, ArrowUpDown, Move, ChevronUp, ChevronDown, Check, Compass, ExternalLink, Plane, Layers } from 'lucide-react';
import { safeStorage } from '../services/storageService';
import { MapCanvasContextMenu } from './MapCanvasContextMenu';
import { MapWorkTaskModal } from './MapWorkTaskModal';
import DroneSimulationModal from './DroneSimulationModal';
import { toast } from 'sonner';

export type DashboardMapPosition = 'top' | 'with_profile' | 'upper' | 'bottom' | 'floating';

interface DashboardProps extends Omit<MapComponentProps, 'onUpdateFeature' | 'activeDrawingTool' | 'onFeatureDrawn'> {
  currentUser?: User | null;
  onNavigateMode?: (mode: string) => void;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
  isMapFullScreen: boolean;
  onSetIsMapFullScreen: (isFull: boolean) => void;
  onUpdateFeature?: (feature: PlantationFeature) => void;
  onFeatureDrawn?: ((feature: PlantationFeature) => void) | ((type: any, geometry?: any) => void) | any;
  onDeleteFeature?: (ids: string[]) => void;
  onSaveWork?: (work: any) => void;
  onSaveTask?: (task: any) => void;
  onSaveNote?: (note: any) => void;
  plantationFeatures: PlantationFeature[];
  assistantMessages: AssistantMessage[];
  onSendCommand: (command: string) => void;
  isAssistantLoading: boolean;
  dashboardLayout: DashboardWidget[];
  onSetDashboardLayout: (layout: DashboardWidget[]) => void;
  workAssignments: WorkAssignment[];
  inventoryItems: InventoryItem[];
  harvestEvents: HarvestEvent[];
  nutritionPlans: NutritionPlan[];
  accounts: Account[];
  dailyLogs: DailyLogEntry[];
  onSetDailyLogs?: (logs: DailyLogEntry[]) => void;
  employees?: Employee[];
  listings: Listing[];
  harvestEntries: HarvestEntry[];
  users: User[];
  organizations: any[];
  discoverableOrganizations?: any[];
  memberships?: any[];
  onAddOrg?: (org: any, mem: any, selectedCrops?: any[]) => void;
  onSwitchOrg?: (orgId: string) => void;
  onUpdateUser?: (user: User) => void;
  crops: Crop[];
  activeOrgId: string | null;
  onOpenMeet?: () => void;
  onOpenChat?: () => void;
  onOpenIntercom?: () => void;
  forumPosts?: ForumPost[];
  onAddPost?: (post: Partial<ForumPost>) => void;
  onAddReply?: (postId: string, content: string) => void;
  onUpdatePost?: (postId: string, updates: Partial<ForumPost>) => void;
  allUsers?: User[];
  roles?: Role[];
  onSetMemberships?: (memberships: any[]) => void;
  onSetEmployees?: (employees: Employee[]) => void;
  onSetUsers?: (users: User[]) => void;
  onOpenNotes?: () => void;
  onOpenAssistant?: () => void;
  notes?: any[];
  alerts?: any[];
}

const WidgetManagerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    layout: DashboardWidget[];
    onUpdate: (layout: DashboardWidget[]) => void;
    userId?: string;
    mapPosition?: DashboardMapPosition;
    onUpdateMapPosition?: (pos: DashboardMapPosition) => void;
}> = ({ isOpen, onClose, layout, onUpdate, userId, mapPosition = 'upper', onUpdateMapPosition }) => {
    const { t, language } = useLanguage();
    const isKa = language === 'ka';
    const allKnownTypes: { type: DashboardWidgetType; label: string; defaultSpan: 1 | 2 | 3 }[] = [
        { type: 'choose_goal', label: t('dash.widget.choose_goal'), defaultSpan: 3 },
        { type: 'agronomy_quick', label: t('dash.widget.agronomy_quick'), defaultSpan: 1 },
        { type: 'tasks', label: t('dash.widget.tasks'), defaultSpan: 1 },
        { type: 'planner', label: t('dash.widget.planner'), defaultSpan: 2 },
        { type: 'hardware_labs', label: t('dash.widget.hardware_labs'), defaultSpan: 2 },
        { type: 'team_hubs', label: t('dash.widget.team_hubs'), defaultSpan: 2 },
        { type: 'field_summary', label: t('dash.widget.field_summary'), defaultSpan: 3 },
        { type: 'seedling_summary', label: t('dash.widget.seedling_summary'), defaultSpan: 3 },
        { type: 'harvest_pulse', label: t('dash.widget.harvest_pulse'), defaultSpan: 1 },
        { type: 'attendance', label: t('dash.widget.attendance'), defaultSpan: 1 },
        { type: 'market_feed', label: t('dash.widget.market_feed'), defaultSpan: 1 },
        { type: 'daily_news', label: t('dash.widget.daily_news'), defaultSpan: 1 },
        { type: 'guest_stats', label: t('dash.widget.guest_stats'), defaultSpan: 1 },
        { type: 'crops_summary', label: t('dash.widget.crops_summary'), defaultSpan: 1 },
    ];

    // Local working copy of layout for seamless reordering & sizing inside modal
    const [localLayout, setLocalLayout] = useState<DashboardWidget[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Merge layout with any missing types
            const existing = layout && layout.length > 0 ? [...layout] : [...DEFAULT_DASHBOARD_LAYOUT];
            allKnownTypes.forEach((t, idx) => {
                if (!existing.some(w => w.type === t.type)) {
                    existing.push({
                        id: `w_${t.type}`,
                        type: t.type,
                        title: t.label,
                        isVisible: false,
                        order: existing.length + idx,
                        colSpan: t.defaultSpan
                    });
                }
            });
            existing.sort((a, b) => a.order - b.order);
            setLocalLayout(existing);
        }
    }, [isOpen, layout]);

    if (!isOpen) return null;

    const toggleVisibility = (id: string) => {
        setLocalLayout(prev => prev.map(w => w.id === id ? { ...w, isVisible: !w.isVisible } : w));
    };

    const setColSpan = (id: string, span: 1 | 2 | 3) => {
        setLocalLayout(prev => prev.map(w => w.id === id ? { ...w, colSpan: span } : w));
    };

    const moveWidget = (index: number, direction: 'up' | 'down' | 'top') => {
        const copy = [...localLayout];
        if (direction === 'top') {
            if (index === 0) return;
            const [item] = copy.splice(index, 1);
            copy.unshift(item);
        } else if (direction === 'up') {
            if (index === 0) return;
            const [item] = copy.splice(index, 1);
            copy.splice(index - 1, 0, item);
        } else if (direction === 'down') {
            if (index === copy.length - 1) return;
            const [item] = copy.splice(index, 1);
            copy.splice(index + 1, 0, item);
        }
        const updated = copy.map((w, idx) => ({ ...w, order: idx }));
        setLocalLayout(updated);
    };

    const handleResetDefaults = () => {
        setLocalLayout([...DEFAULT_DASHBOARD_LAYOUT]);
    };

    const handleSaveAndApply = () => {
        const finalized = localLayout.map((w, idx) => ({ ...w, order: idx }));
        onUpdate(finalized);
        saveDashboardLayout(finalized, userId);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[4500] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-200 animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">{t('dash.layout.title')}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">{t('dash.layout.persistent')}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{t('dash.layout.desc')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-700 cursor-pointer">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Widget List */}
                <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/40">
                    {/* Interactive Map Position Control */}
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                <Compass className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                                        {isKa ? 'ინტერაქტიული რუკის განლაგება' : 'Interactive Map Position'}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                        {mapPosition === 'top' ? (isKa ? 'სულ ზემოთ' : 'Top') : mapPosition === 'upper' ? (isKa ? 'ზემოთ' : 'Upper') : (isKa ? 'ქვემოთ' : 'Bottom')}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                    {isKa ? 'აირჩიეთ სად გამოჩნდეს რუკა დაფაზე' : 'Choose where the map appears on the dashboard'}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200 shadow-2xs self-end sm:self-auto">
                            <button
                                type="button"
                                onClick={() => onUpdateMapPosition?.('top')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    mapPosition === 'top'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                🔝 {isKa ? 'სულ ზემოთ' : 'Top'}
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdateMapPosition?.('with_profile')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    mapPosition === 'with_profile'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                👤 {isKa ? 'პროფილის გვერდით' : 'With Profile'}
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdateMapPosition?.('upper')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    mapPosition === 'upper'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                ⬆️ {isKa ? 'ზემოთ' : 'Upper'}
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdateMapPosition?.('bottom')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    mapPosition === 'bottom'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                ⬇️ {isKa ? 'ქვემოთ' : 'Bottom'}
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdateMapPosition?.('floating')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    mapPosition === 'floating'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                🪟 {isKa ? 'მოძრავი ფანჯარა' : 'Floating'}
                            </button>
                        </div>
                    </div>

                    {localLayout.map((widget, idx) => {
                        const isVisible = widget.isVisible !== false;
                        const span = widget.colSpan ?? 1;
                        return (
                            <div 
                                key={widget.id} 
                                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 bg-white border rounded-2xl gap-3 transition-all ${isVisible ? 'border-slate-200 shadow-xs' : 'border-dashed border-slate-200 opacity-60'}`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate">{getWidgetTitle(widget.type, widget.title, t)}</h4>
                                        <span className="text-[10px] text-slate-400 font-medium capitalize">{widget.type.replace('_', ' ')}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                                    {/* Reorder controls */}
                                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-slate-600">
                                        <button
                                            type="button"
                                            onClick={() => moveWidget(idx, 'top')}
                                            disabled={idx === 0}
                                            title={t('dash.card.move_top')}
                                            className="px-2 py-1 hover:bg-white rounded-lg text-[10px] font-black disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-0.5 cursor-pointer text-indigo-600"
                                        >
                                            <ArrowUpToLine size={12} />
                                            <span>{t('dash.layout.top')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveWidget(idx, 'up')}
                                            disabled={idx === 0}
                                            title={t('dash.card.move_up')}
                                            className="p-1 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                        >
                                            <ChevronUpIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveWidget(idx, 'down')}
                                            disabled={idx === localLayout.length - 1}
                                            title={t('dash.card.move_down')}
                                            className="p-1 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                        >
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Width selector pills */}
                                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[10px] font-black text-slate-600">
                                        <button
                                            type="button"
                                            onClick={() => setColSpan(widget.id, 1)}
                                            className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${span === 1 ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'}`}
                                            title="1 Column Width"
                                        >
                                            1x
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setColSpan(widget.id, 2)}
                                            className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${span === 2 ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'}`}
                                            title="2 Columns Width"
                                        >
                                            2x
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setColSpan(widget.id, 3)}
                                            className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${span === 3 ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-slate-900'}`}
                                            title="3 Columns (Full Width)"
                                        >
                                            3x
                                        </button>
                                    </div>

                                    {/* Visibility Toggle button */}
                                    <button 
                                        type="button"
                                        onClick={() => toggleVisibility(widget.id)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${isVisible ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-500'}`}
                                    >
                                        {isVisible ? t('dash.layout.visible') : t('dash.layout.hidden')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button 
                        type="button"
                        onClick={handleResetDefaults}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                    >
                        {t('dash.layout.reset')}
                    </button>
                    <div className="flex items-center gap-2">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer"
                        >
                            {t('common.cancel')}
                        </button>
                        <button 
                            type="button"
                            onClick={handleSaveAndApply}
                            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer"
                        >
                            {t('dash.layout.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// All widgets imported from modular components

const DailyNewsWidget: React.FC = () => {
    const [news, setNews] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { t, language } = useLanguage();
    const fetchNews = async () => {
        setLoading(true);
        try {
            const content = await getDailyBriefing(language);
            setNews(content);
        } catch (e) { setNews(t('dash.news.failed')); } finally { setLoading(false); }
    };
    useEffect(() => { fetchNews(); }, [language]);
    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CalendarDaysIcon className="h-4 w-4 text-blue-600"/>
                    {t('dash.widget.daily_news')}
                </h3>
                <button onClick={fetchNews} disabled={loading} className={`p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all ${loading ? 'animate-spin' : ''}`}><ArrowPathIcon className="h-5 w-5" /></button>
            </div>
            <div className="flex-grow overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                {loading && !news ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4 py-12">
                        <SparklesIcon className="h-10 w-10 animate-pulse text-blue-400"/>
                        <p className="text-[10px] font-black uppercase tracking-widest">{t('dash.news.curating')}</p>
                    </div>
                ) : (
                    <div className="prose prose-slate max-w-none text-slate-600 whitespace-pre-wrap text-sm leading-relaxed font-medium">
                        {news || t('dash.news.none')}
                    </div>
                )}
            </div>
        </div>
    );
};

const GuestStatsWidget: React.FC<{ users: User[], organizations: any[] }> = ({ users, organizations }) => {
    const { t } = useLanguage();
    const stats = useMemo(() => {
        const roles = users.reduce((acc, u) => {
            const role = u.roles?.[0] || 'Guest';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalUsers: users.length,
            totalOrgs: organizations.length,
            roles
        };
    }, [users, organizations]);

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-indigo-600" />
                {t('dash.widget.guest_stats')}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-3xl font-black text-indigo-900 tracking-tighter">{stats.totalOrgs}</p>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{t('dash.stats.plantations')}</p>
                </div>
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-3xl font-black text-emerald-900 tracking-tighter">{stats.totalUsers}</p>
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{t('dash.stats.users')}</p>
                </div>
            </div>
            <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('dash.stats.roles')}</p>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.roles).map(([role, count]) => (
                        <div key={role} className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-600 uppercase">{role}</span>
                            <span className="text-[9px] font-black text-indigo-600 bg-white px-1.5 py-0.5 rounded-lg">{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = (props) => {
  const { isMapFullScreen, onSetIsMapFullScreen, dashboardLayout = [], onSetDashboardLayout, crops = [], activeOrgId } = props;
  const { t, language } = useLanguage();
  const isKa = language === 'ka';
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<DashboardWidget | null>(null);
  const [widgetColSpans, setWidgetColSpans] = useState<Record<string, number>>({});
  const [isIntercomPopUpOpen, setIsIntercomPopUpOpen] = useState(false);

  // Map Position State with safeStorage persistence - Default is moved UPPER WITH PROFILE TOOL!
  type MapPosition = DashboardMapPosition;
  const [mapPosition, setMapPosition] = useState<MapPosition>(() => {
    try {
      const saved = safeStorage.getItem('agrimap_dashboard_map_position');
      if (saved === 'top' || saved === 'with_profile' || saved === 'upper' || saved === 'bottom' || saved === 'floating') {
        return saved as MapPosition;
      }
    } catch (e) {
      console.warn('Error reading map position:', e);
    }
    return 'with_profile'; // Default is moved UPPER WITH PROFILE TOOL as requested!
  });

  const handleSetMapPosition = (pos: MapPosition) => {
    setMapPosition(pos);
    try {
      safeStorage.setItem('agrimap_dashboard_map_position', pos);
    } catch (e) {
      console.warn('Error saving map position:', e);
    }
  };

  const handleMoveMapStep = (direction: 'up' | 'down') => {
    const order: MapPosition[] = ['top', 'with_profile', 'upper', 'bottom'];
    const currentIndex = order.indexOf(mapPosition);
    if (currentIndex === -1) {
      handleSetMapPosition('with_profile');
      return;
    }
    if (direction === 'up' && currentIndex > 0) {
      handleSetMapPosition(order[currentIndex - 1]);
    } else if (direction === 'down' && currentIndex < order.length - 1) {
      handleSetMapPosition(order[currentIndex + 1]);
    }
  };

  const [isMapMoveMenuOpen, setIsMapMoveMenuOpen] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);

  const activeOrg = useMemo(() => {
    return props.organizations?.find(o => o.id === activeOrgId) || null;
  }, [props.organizations, activeOrgId]);

  // Movable Map Tools Dropdown (identical to Map Planner design)
  const [isDashboardMapToolsOpen, setIsDashboardMapToolsOpen] = useState(false);
  const [dashboardMapToolsPos, setDashboardMapToolsPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = safeStorage.getItem('agrimap_dash_map_tools_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
      }
    } catch (e) {}
    return null;
  });
  const dashboardMapToolsRef = useRef<HTMLDivElement>(null);
  const dashboardMapToolsDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

  useEffect(() => {
    if (!isDashboardMapToolsOpen) return;
    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (dashboardMapToolsRef.current && !dashboardMapToolsRef.current.contains(e.target as Node)) {
        setIsDashboardMapToolsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isDashboardMapToolsOpen]);

  const handleDashboardMapToolsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    const rect = dashboardMapToolsRef.current?.getBoundingClientRect();
    dashboardMapToolsDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect ? rect.left : 24,
      startTop: rect ? rect.top : (window.innerHeight - 80)
    };
  };

  const handleDashboardMapToolsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dashboardMapToolsDragRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - dashboardMapToolsDragRef.current.startX;
    const deltaY = e.clientY - dashboardMapToolsDragRef.current.startY;
    const newLeft = Math.max(10, Math.min(window.innerWidth - 240, dashboardMapToolsDragRef.current.startLeft + deltaX));
    const newTop = Math.max(10, Math.min(window.innerHeight - 70, dashboardMapToolsDragRef.current.startTop + deltaY));
    setDashboardMapToolsPos({ x: Math.round(newLeft), y: Math.round(newTop) });
  };

  const handleDashboardMapToolsPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dashboardMapToolsDragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
    dashboardMapToolsDragRef.current = null;
    setDashboardMapToolsPos(curr => {
      if (curr) safeStorage.setItem('agrimap_dash_map_tools_pos', JSON.stringify(curr));
      return curr;
    });
  };

  // Right-click context menu state on Dashboard map
  const [dashboardContextMenu, setDashboardContextMenu] = useState<{
    x: number;
    y: number;
    coords?: { lat: number; lng: number };
    feature?: PlantationFeature;
  } | null>(null);

  // Work, Task & Note creation modal state
  const [isWorkTaskModalOpen, setIsWorkTaskModalOpen] = useState(false);
  const [workTaskModalCoords, setWorkTaskModalCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [workTaskInitialMode, setWorkTaskInitialMode] = useState<'work' | 'task' | 'note'>('work');

  // Drone simulation modal state
  const [isDroneModalOpen, setIsDroneModalOpen] = useState(false);
  const [droneStartCoords, setDroneStartCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);

  useEffect(() => {
    const handleOpenIntercom = () => setIsIntercomPopUpOpen(true);
    window.addEventListener('agrimap_open_intercom', handleOpenIntercom);
    return () => window.removeEventListener('agrimap_open_intercom', handleOpenIntercom);
  }, []);

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'choose_goal': return <Users size={14} className="text-indigo-600" />;
      case 'agronomy_quick': return <Sprout size={14} className="text-emerald-600" />;
      case 'tasks': return <Briefcase size={14} className="text-amber-600" />;
      case 'planner': return <Calendar size={14} className="text-blue-600" />;
      case 'hardware_labs': return <Cpu size={14} className="text-purple-600" />;
      case 'team_hubs': return <Video size={14} className="text-cyan-600" />;
      case 'field_summary': return <Grid size={14} className="text-emerald-600" />;
      case 'seedling_summary':
      case 'seedling_health':
      case 'seedling_stats': return <Sprout size={14} className="text-teal-600" />;
      case 'harvest_pulse': return <Tractor size={14} className="text-orange-600" />;
      case 'attendance': return <Users size={14} className="text-indigo-600" />;
      case 'market_feed': return <ShoppingBag size={14} className="text-blue-600" />;
      default: return <Sparkles size={14} className="text-slate-400" />;
    }
  };

  // AI Stream & Anomaly Engine State
  const [aiConfig, setAiConfig] = useState<AiAnalysisScheduleConfig>(getSavedAnalysisConfig());
  const [latestReport, setLatestReport] = useState<AiAnalysisReport | null>(() => {
    const stored = getStoredAnalysisReports();
    return stored.length > 0 ? stored[0] : null;
  });
  const [anomalies, setAnomalies] = useState<AiAnomalyAlert[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalMode, setAiModalMode] = useState<AnalysisTriggerMode>('scheduled');
  const [aiModalModule, setAiModalModule] = useState<AnalysisModuleScope | undefined>(undefined);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Compute live anomalies on mount / when datasets update
  useEffect(() => {
    const detected = detectCrossModuleAnomalies({
      inventoryItems: props.inventoryItems,
      nutritionPlans: props.nutritionPlans,
      planExecutions: [],
      workAssignments: props.workAssignments,
      dailyLogs: props.dailyLogs,
      harvests: props.harvestEvents,
      accounts: props.accounts,
      language: language === 'ka' ? 'ka' : 'en'
    });
    setAnomalies(detected);
  }, [props.inventoryItems, props.nutritionPlans, props.workAssignments, props.dailyLogs, props.harvestEvents, props.accounts, language]);

  const handleOpenAiHub = (mode: AnalysisTriggerMode = 'scheduled', preselectedModule?: AnalysisModuleScope) => {
    setAiModalMode(mode);
    setAiModalModule(preselectedModule);
    setIsAiModalOpen(true);
  };

  const handleRefreshAnalysis = async () => {
    setIsAiLoading(true);
    try {
      const report = await runMultiModuleAiAnalysis({
        triggerMode: 'scheduled',
        cadence: aiConfig.cadence,
        selectedModules: aiConfig.selectedModules,
        inventoryItems: props.inventoryItems,
        nutritionPlans: props.nutritionPlans,
        planExecutions: [],
        workAssignments: props.workAssignments,
        dailyLogs: props.dailyLogs,
        harvests: props.harvestEvents,
        accounts: props.accounts,
        language: language === 'ka' ? 'ka' : 'en'
      });
      setLatestReport(report);
      setAnomalies(report.anomalies);
    } catch (e) {
      console.error("AI Analysis refresh error:", e);
    } finally {
      setIsAiLoading(false);
    }
  };


  const sortedWidgets = useMemo(() => {
      let layout = dashboardLayout && dashboardLayout.length > 0 ? [...dashboardLayout] : [...DEFAULT_DASHBOARD_LAYOUT];
      DEFAULT_DASHBOARD_LAYOUT.forEach(dw => {
          if (!layout.some(w => w.type === dw.type)) {
              layout.push(dw);
          }
      });
      return layout.filter(w => w.isVisible !== false).sort((a, b) => a.order - b.order);
  }, [dashboardLayout]);

  // Drag-and-drop state for dashboard widgets
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      setDraggedWidgetId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverWidgetId !== id) {
          setDragOverWidgetId(id);
      }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
      if (dragOverWidgetId === id) {
          setDragOverWidgetId(null);
      }
  };

  const handleDropOnWidget = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverWidgetId(null);
      const sourceId = draggedWidgetId || e.dataTransfer.getData('text/plain');
      setDraggedWidgetId(null);
      if (!sourceId || sourceId === targetId) return;

      const currentList = [...sortedWidgets];
      const sourceIdx = currentList.findIndex(w => w.id === sourceId);
      const targetIdx = currentList.findIndex(w => w.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return;

      const [item] = currentList.splice(sourceIdx, 1);
      currentList.splice(targetIdx, 0, item);

      // Re-map full layout preserving any hidden items
      const existingLayout = dashboardLayout && dashboardLayout.length > 0 ? [...dashboardLayout] : [...sortedWidgets];
      const updatedLayout = existingLayout.map(w => {
          const newIdx = currentList.findIndex(sw => sw.id === w.id);
          if (newIdx !== -1) {
              return { ...w, order: newIdx };
          }
          return w;
      }).sort((a, b) => a.order - b.order);

      if (onSetDashboardLayout) {
          onSetDashboardLayout(updatedLayout);
      }
      saveDashboardLayout(updatedLayout, props.currentUser?.id);
  };

  const handleMoveToTop = (id: string) => {
      const currentList = [...sortedWidgets];
      const idx = currentList.findIndex(w => w.id === id);
      if (idx <= 0) return;
      const [item] = currentList.splice(idx, 1);
      currentList.unshift(item);

      const existingLayout = dashboardLayout && dashboardLayout.length > 0 ? [...dashboardLayout] : [...sortedWidgets];
      const updatedLayout = existingLayout.map(w => {
          const newIdx = currentList.findIndex(sw => sw.id === w.id);
          if (newIdx !== -1) {
              return { ...w, order: newIdx };
          }
          return w;
      }).sort((a, b) => a.order - b.order);

      if (onSetDashboardLayout) {
          onSetDashboardLayout(updatedLayout);
      }
      saveDashboardLayout(updatedLayout, props.currentUser?.id);
  };

  const handleMoveStep = (id: string, direction: 'up' | 'down') => {
      const currentList = [...sortedWidgets];
      const idx = currentList.findIndex(w => w.id === id);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentList.length) return;

      const [item] = currentList.splice(idx, 1);
      currentList.splice(targetIdx, 0, item);

      const existingLayout = dashboardLayout && dashboardLayout.length > 0 ? [...dashboardLayout] : [...sortedWidgets];
      const updatedLayout = existingLayout.map(w => {
          const newIdx = currentList.findIndex(sw => sw.id === w.id);
          if (newIdx !== -1) {
              return { ...w, order: newIdx };
          }
          return w;
      }).sort((a, b) => a.order - b.order);

      if (onSetDashboardLayout) {
          onSetDashboardLayout(updatedLayout);
      }
      saveDashboardLayout(updatedLayout, props.currentUser?.id);
  };

  const handleToggleWidgetVisible = (id: string) => {
      const existingLayout = dashboardLayout && dashboardLayout.length > 0 ? [...dashboardLayout] : [...sortedWidgets];
      const updated = existingLayout.map(w => w.id === id ? { ...w, isVisible: !w.isVisible } : w);
      if (onSetDashboardLayout) {
          onSetDashboardLayout(updated);
      }
      saveDashboardLayout(updated, props.currentUser?.id);
  };

  const handleUpdateDimensions = (id: string, colSpan?: 1 | 2 | 3, heightPx?: number) => {
      const existingLayout = dashboardLayout && dashboardLayout.length > 0 ? [...dashboardLayout] : [...sortedWidgets];
      const updated = existingLayout.map(w => {
          if (w.id === id) {
              return {
                  ...w,
                  colSpan: colSpan !== undefined ? colSpan : w.colSpan,
                  heightPx: heightPx !== undefined ? heightPx : w.heightPx
              };
          }
          return w;
      });
      if (onSetDashboardLayout) {
          onSetDashboardLayout(updated);
      }
      saveDashboardLayout(updated, props.currentUser?.id);
  };

  const renderWidget = (widget: DashboardWidget) => {
      switch (widget.type) {
          case 'choose_goal': return (
              <ChooseYourGoalWidget
                  currentUser={props.currentUser}
                  organizations={props.organizations}
                  discoverableOrganizations={props.discoverableOrganizations}
                  memberships={props.memberships}
                  onUpdateUser={props.onUpdateUser}
                  onAddOrg={props.onAddOrg}
                  onSwitchOrg={props.onSwitchOrg}
                  onNavigateMode={props.onNavigateMode}
                  onOpenProfile={props.onOpenProfile}
              />
          );
          case 'agronomy_quick': return (
              <AgronomyQuickAccessWidget
                  nutritionPlans={props.nutritionPlans}
                  crops={props.crops}
                  plantationFeatures={props.plantationFeatures}
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'tasks': return (
              <TasksQuickAccessWidget
                  workAssignments={props.workAssignments}
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'planner': return (
              <PlannerScheduleWidget
                  workAssignments={props.workAssignments}
                  alerts={props.alerts}
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'hardware_labs': return (
              <HardwareLabsWidget
                  onNavigateMode={props.onNavigateMode}
                  organizationId={props.activeOrgId || undefined}
              />
          );
          case 'team_hubs': return (
              <TeamHubsWidget
                  employees={props.employees}
                  onOpenMeet={props.onOpenMeet}
                  onOpenIntercom={() => setIsIntercomPopUpOpen(true)}
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'field_summary': return (
              <FieldSummaryWidget 
                  features={props.plantationFeatures} 
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'seedling_summary':
          case 'seedling_health':
          case 'seedling_stats': return (
              <SeedlingSummaryWidget 
                  features={props.plantationFeatures} 
                  crops={props.crops}
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'harvest_pulse': return (
              <HarvestPulseWidget 
                  events={props.harvestEvents} 
                  harvestEntries={props.harvestEntries}
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'attendance': return (
              <StaffAttendanceWidget 
                  logs={props.dailyLogs} 
                  employees={props.employees} 
                  roles={props.roles}
                  workAssignments={props.workAssignments}
                  harvestEvents={props.harvestEvents}
                  harvestEntries={props.harvestEntries}
                  plantationFeatures={props.plantationFeatures}
                  onSetEmployees={props.onSetEmployees}
                  onSetDailyLogs={props.onSetDailyLogs} 
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'market_feed': return (
              <MarketFeedWidget 
                  listings={props.listings} 
                  onNavigateMode={props.onNavigateMode}
              />
          );
          case 'daily_news': return <DailyNewsWidget />;
          case 'guest_stats': return <GuestStatsWidget users={props.users} organizations={props.organizations} />;
          case 'crops_summary': return (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <LeafIcon className="h-4 w-4 text-emerald-600" />
                          {t('dash.widget.crops_summary')}
                      </h3>
                      <button 
                        onClick={() => setIsCropModalOpen(true)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all cursor-pointer"
                      >
                        {t('dash.crops.manage')}
                      </button>
                  </div>
                  <div className="space-y-3 overflow-y-auto flex-grow max-h-[250px] custom-scrollbar pr-2">
                      {crops.map(c => (
                          <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-sm font-black text-slate-800 uppercase mb-2">{c.name}</p>
                              <div className="flex flex-wrap gap-1.5">
                                  {c.varieties?.map(v => (
                                      <span key={v} className="px-2 py-1 bg-white text-slate-500 text-[8px] font-black rounded-lg border border-slate-100 uppercase">{v}</span>
                                  ))}
                              </div>
                          </div>
                      ))}
                      {crops.length === 0 && <p className="text-center py-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('dash.crops.empty')}</p>}
                  </div>
              </div>
          );
          default: return <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm text-slate-400 font-black uppercase text-[10px] tracking-widest text-center py-20">{widget.title || 'Widget'}</div>;
      }
  };

  const renderMapSection = () => (
    <div className={`w-full transition-all ${isMapFullScreen ? 'm-0 p-0' : 'my-4 md:my-6'}`}>
      <div className={`bg-white rounded-[2.5rem] shadow-sm p-1.5 md:p-2 border border-slate-100 transition-all relative ${isMapFullScreen ? 'fixed inset-0 z-[3000] rounded-none' : 'w-full h-[480px] md:h-[620px]'}`}>
        <div className="h-full w-full relative overflow-hidden rounded-[2rem]">
          <MapComponent
            {...props}
            onFeatureDrawn={props.onFeatureDrawn as any}
            onMapContextMenu={(screenPoint, coords) => {
              setDashboardContextMenu({ ...screenPoint, coords });
            }}
            onContextMenuFeature={(feature, screenPoint, coords) => {
              setDashboardContextMenu({ ...screenPoint, coords, feature });
            }}
            onDeleteFeature={(ids) => {
              if (props.onDeleteFeature) {
                props.onDeleteFeature(ids);
              } else {
                window.dispatchEvent(new CustomEvent('agrimap_delete_features', { detail: { ids } }));
              }
            }}
          />

          {/* Top-Right Clean Fullscreen Toggle Button */}
          <div className="absolute top-3.5 right-14 sm:right-16 z-[1050]">
            <button
              type="button"
              onClick={() => onSetIsMapFullScreen(!isMapFullScreen)}
              title={isMapFullScreen ? (isKa ? 'დახურვა' : 'Exit Fullscreen') : (isKa ? 'სრული ეკრანი' : 'Fullscreen')}
              className="p-2 bg-white/95 hover:bg-white text-slate-700 hover:text-indigo-600 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              {isMapFullScreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
            </button>
          </div>

          {/* Unified Movable Map Tools Dropdown (identical to Map Planner) */}
          <div
            ref={dashboardMapToolsRef}
            style={dashboardMapToolsPos ? {
              position: 'fixed',
              left: `${dashboardMapToolsPos.x}px`,
              top: `${dashboardMapToolsPos.y}px`,
              zIndex: 3100
            } : undefined}
            className={`${dashboardMapToolsPos ? '' : 'absolute bottom-4 left-4 sm:left-6 z-[1050]'} pointer-events-auto flex items-center gap-1.5`}
          >
            {/* Drag Handle */}
            <div
              onPointerDown={handleDashboardMapToolsPointerDown}
              onPointerMove={handleDashboardMapToolsPointerMove}
              onPointerUp={handleDashboardMapToolsPointerUp}
              className="bg-slate-900/90 border border-slate-700/80 p-2.5 rounded-2xl cursor-grab active:cursor-grabbing hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shadow-2xl backdrop-blur-md shrink-0 flex items-center justify-center select-none"
              title={isKa ? "გადაათრიეთ რუკის ხელსაწყოების პანელი ეკრანზე" : "Hold and drag to move Map Tools anywhere on screen"}
            >
              <GripVerticalIcon size={14} />
            </div>

            {/* Dropdown Menu Popup & Trigger */}
            <div className="relative">
              {isDashboardMapToolsOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-2xl p-2 flex flex-col gap-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800/80 mb-0.5">
                    <span>{isKa ? "რუკის ხელსაწყოები" : "Map Tools & Controls"}</span>
                    <span className="text-[8px] font-mono text-emerald-400">{isKa ? "სწრაფი მენიუ" : "Quick Menu"}</span>
                  </div>

                  {/* 1. Open in Map Planner */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDashboardMapToolsOpen(false);
                      if (props.onNavigateMode) props.onNavigateMode('design');
                      else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'design' }));
                    }}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-950/60 to-teal-950/60 hover:from-emerald-900/80 hover:to-teal-900/80 border border-emerald-500/30 text-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Compass className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'რუკის დამგეგმავში გახსნა' : 'Open in Map Planner'}</span>
                        <span className="text-[9px] text-emerald-400/90 font-medium">{isKa ? 'საკადასტრო ნაკვეთები & GPS' : 'Cadastre & Drawing Tools'}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400 opacity-70 group-hover:opacity-100 shrink-0" />
                  </button>

                  {/* 2. Plantation Crops Management */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCropModalOpen(true);
                      setIsDashboardMapToolsOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-emerald-500/20 bg-emerald-950/20"
                  >
                    <div className="flex items-center gap-2">
                      <LeafIcon size={15} className="text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'კულტურების მართვა' : 'Crops Management'}</span>
                        <span className="text-[9px] text-emerald-400 font-semibold truncate max-w-[150px]">
                          {formatPlantationCrops(activeOrg?.plantationCrops || activeOrg?.crops, isKa)}
                        </span>
                      </div>
                    </div>
                    <PencilSquareIcon className="w-3.5 h-3.5 text-emerald-400 opacity-60 group-hover:opacity-100 shrink-0" />
                  </button>

                  {/* 3. Company Registration */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOrgModalOpen(true);
                      setIsDashboardMapToolsOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-blue-500/20 bg-blue-950/20"
                  >
                    <div className="flex items-center gap-2">
                      <BuildingStorefrontIcon className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'კომპანიის რეგისტრაცია' : 'Company Registration'}</span>
                        <span className="text-[9px] text-blue-400 font-semibold truncate max-w-[150px]">
                          {activeOrg?.name || (isKa ? '+ რეგისტრაცია' : '+ Register')}
                        </span>
                      </div>
                    </div>
                    <PlusIcon size={13} className="text-blue-400 opacity-60 group-hover:opacity-100 shrink-0" />
                  </button>

                  {/* 4. Drone Mission Simulation */}
                  <button
                    type="button"
                    onClick={() => {
                      setDroneStartCoords(props.center ? { lat: props.center[0], lng: props.center[1] } : undefined);
                      setIsDroneModalOpen(true);
                      setIsDashboardMapToolsOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800/80 text-slate-200 transition-all text-left group cursor-pointer border border-indigo-500/20 bg-indigo-950/20"
                  >
                    <div className="flex items-center gap-2">
                      <Plane className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="leading-tight text-[11px] font-bold text-slate-100">{isKa ? 'დრონის სიმულაცია & ფრენა' : 'Drone Mission Simulation'}</span>
                        <span className="text-[9px] text-indigo-400 font-semibold truncate">{isKa ? '3D / 2D ავტონომიური მისია' : 'Autonomous drone flight'}</span>
                      </div>
                    </div>
                    <Sparkles size={13} className="text-indigo-400 opacity-60 group-hover:opacity-100 shrink-0" />
                  </button>

                  <div className="w-full h-[1px] bg-slate-800/80 my-0.5" />

                  {/* 5. Dashboard Map Position Selector */}
                  <div className="px-2 py-1 flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{isKa ? 'რუკის პოზიცია დაფაზე:' : 'Map Position on Dashboard:'}</span>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => { handleSetMapPosition('top'); setIsDashboardMapToolsOpen(false); }}
                        className={`px-2 py-1.5 rounded-lg font-bold text-left transition-colors cursor-pointer flex items-center justify-between ${mapPosition === 'top' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}`}
                      >
                        <span>{isKa ? '1. თავში' : '1. Top'}</span>
                        {mapPosition === 'top' && <Check size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleSetMapPosition('with_profile'); setIsDashboardMapToolsOpen(false); }}
                        className={`px-2 py-1.5 rounded-lg font-bold text-left transition-colors cursor-pointer flex items-center justify-between ${mapPosition === 'with_profile' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}`}
                      >
                        <span>{isKa ? '2. პროფილით' : '2. Profile'}</span>
                        {mapPosition === 'with_profile' && <Check size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleSetMapPosition('upper'); setIsDashboardMapToolsOpen(false); }}
                        className={`px-2 py-1.5 rounded-lg font-bold text-left transition-colors cursor-pointer flex items-center justify-between ${mapPosition === 'upper' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}`}
                      >
                        <span>{isKa ? '3. ზემოთ' : '3. Upper'}</span>
                        {mapPosition === 'upper' && <Check size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleSetMapPosition('bottom'); setIsDashboardMapToolsOpen(false); }}
                        className={`px-2 py-1.5 rounded-lg font-bold text-left transition-colors cursor-pointer flex items-center justify-between ${mapPosition === 'bottom' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}`}
                      >
                        <span>{isKa ? '4. ქვემოთ' : '4. Bottom'}</span>
                        {mapPosition === 'bottom' && <Check size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Trigger Pill Button */}
              <button
                type="button"
                onClick={() => setIsDashboardMapToolsOpen(!isDashboardMapToolsOpen)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl font-black text-xs shadow-2xl backdrop-blur-md transition-all cursor-pointer select-none border ${
                  isDashboardMapToolsOpen
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                    : 'bg-slate-900/90 hover:bg-slate-900 text-slate-200 hover:text-white border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <MapIcon size={14} className={isDashboardMapToolsOpen ? 'text-white' : 'text-emerald-400'} />
                <span className="uppercase tracking-wider">{isKa ? 'რუკის ხელსაწყოები' : 'Map Tools'}</span>
                <ChevronDownIcon size={14} className={`text-slate-400 transition-transform ${isDashboardMapToolsOpen ? 'rotate-180 text-white' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
    
  return (
      <main className={`flex-1 bg-slate-50 overflow-y-auto ${isMapFullScreen ? 'p-0' : 'p-4 md:p-8'} safe-area-bottom`}>
        <div className={isMapFullScreen ? "h-full w-full" : "max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-8"}>
          {isMapFullScreen ? (
            renderMapSection()
          ) : (
            <>
            <div className="flex justify-between items-end">
                <div className="h-40 md:h-52 w-full rounded-[2.5rem] bg-cover bg-center bg-no-repeat p-6 md:p-10 flex flex-col justify-center text-white relative shadow-2xl overflow-hidden group" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=2000')" }}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500"></div>
                    <div className="relative z-10">
                        <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase" style={{textShadow: '0 4px 12px rgba(0,0,0,0.5)'}}>{t('dash.title')}</h2>
                        <p className="mt-2 text-sm md:text-lg text-white/90 font-medium max-w-lg" style={{textShadow: '0 2px 6px rgba(0,0,0,0.5)'}}>{t('dash.subtitle')}</p>
                    </div>
                    <button onClick={() => setIsManageModalOpen(true)} className="absolute bottom-6 right-6 bg-white/20 hover:bg-white/40 backdrop-blur-xl border border-white/30 text-white px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl cursor-pointer">
                        <WrenchScrewdriverIcon className="h-4 w-4 mr-2 inline-block" /> {t('dash.layout.btn')}
                    </button>
                </div>
            </div>

            {/* TOP POSITION MAP */}
            {mapPosition === 'top' && renderMapSection()}

            {/* WITH PROFILE POSITION MAP (UPPER WITH PROFILE TOOL WIDGET!) */}
            {mapPosition === 'with_profile' && renderMapSection()}

            {/* Profile Management, Next-Step Guidance & System Operation Hub */}
            <DashboardProfileManager
                currentUser={props.currentUser}
                activeOrgId={props.activeOrgId}
                plantationFeatures={props.plantationFeatures}
                organizations={props.organizations}
                onNavigateMode={(mode) => {
                    if (props.onNavigateMode) {
                        props.onNavigateMode(mode);
                    } else if (mode === 'profile' && props.onOpenProfile) {
                        props.onOpenProfile();
                    } else if (mode === 'guide' && props.onOpenHelp) {
                        props.onOpenHelp();
                    } else {
                        window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: mode }));
                    }
                }}
                onOpenProfile={() => {
                    if (props.onOpenProfile) props.onOpenProfile();
                    else if (props.onNavigateMode) props.onNavigateMode('profile');
                    else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'profile' }));
                }}
                onOpenHelp={() => {
                    if (props.onOpenHelp) props.onOpenHelp();
                    else if (props.onNavigateMode) props.onNavigateMode('guide');
                    else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'guide' }));
                }}
            />

            {/* AI Autonomous Stream & Anomaly Engine Panel */}
            <DashboardAiStream
                anomalies={anomalies}
                latestReport={latestReport}
                config={aiConfig}
                onOpenAiHub={handleOpenAiHub}
                onRefreshAnalysis={handleRefreshAnalysis}
                isLoading={isAiLoading}
            />

            {/* UPPER POSITION MAP (MOVED UPPER ABOVE WIDGETS!) */}
            {mapPosition === 'upper' && renderMapSection()}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {sortedWidgets.map(widget => (
                    <DashboardWidgetCard
                        key={widget.id}
                        widget={widget}
                        onOpenWindow={(w) => setExpandedWidget(w)}
                        onUpdateDimensions={handleUpdateDimensions}
                        onMoveToTop={handleMoveToTop}
                        onMoveStep={handleMoveStep}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDropOnWidget}
                        isDragOver={dragOverWidgetId === widget.id}
                        isDragged={draggedWidgetId === widget.id}
                    >
                        {renderWidget(widget)}
                    </DashboardWidgetCard>
                ))}
            </div>

            {/* BOTTOM POSITION MAP */}
            {mapPosition === 'bottom' && renderMapSection()}
            </>
          )}
        </div>
        
        {/* Detached Movable Floating Map Window */}
        {mapPosition === 'floating' && !isMapFullScreen && (
          <FloatingWidgetWindow
            isOpen={mapPosition === 'floating'}
            onClose={() => handleSetMapPosition('with_profile')}
            title={isKa ? "რუკის სამუშაო სივრცე (მოძრავი)" : "Live Map Workspace (Floating)"}
            icon={<Compass className="w-4 h-4 text-emerald-600" />}
            badge={isKa ? "ცოცხალი რუკა" : "Live Map"}
            initialWidth={960}
            initialHeight={620}
          >
            <div className="h-full w-full p-2 relative">
              {renderMapSection()}
            </div>
          </FloatingWidgetWindow>
        )}

        {/* Floating, Draggable & Live-Resizable Window for expanded widget */}
        {expandedWidget && (
            <FloatingWidgetWindow
                isOpen={!!expandedWidget}
                onClose={() => setExpandedWidget(null)}
                title={getWidgetTitle(expandedWidget.type, expandedWidget.title, t)}
                icon={getWidgetIcon(expandedWidget.type)}
                badge={t('dash.window.live_widget')}
                initialWidth={920}
                initialHeight={620}
            >
                <div className="p-2 sm:p-4 h-full">
                    {renderWidget(expandedWidget)}
                </div>
            </FloatingWidgetWindow>
        )}

        {/* Right-click Context Menu on Dashboard Map */}
        {dashboardContextMenu && (
          <MapCanvasContextMenu
            position={dashboardContextMenu}
            coordinates={dashboardContextMenu.coords}
            onClose={() => setDashboardContextMenu(null)}
            onOpenCropModal={() => setIsCropModalOpen(true)}
            onOpenCompanyRegistration={() => {
              window.dispatchEvent(new CustomEvent('agrimap_open_company_registration'));
            }}
            onOpenMapPlanner={() => {
              if (props.onNavigateMode) props.onNavigateMode('design');
              else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'design' }));
            }}
            onAddWork={(coords) => {
              setWorkTaskModalCoords(coords);
              setWorkTaskInitialMode('work');
              setIsWorkTaskModalOpen(true);
            }}
            onAddTask={(coords) => {
              setWorkTaskModalCoords(coords);
              setWorkTaskInitialMode('task');
              setIsWorkTaskModalOpen(true);
            }}
            onAddNote={(coords) => {
              setWorkTaskModalCoords(coords);
              setWorkTaskInitialMode('note');
              setIsWorkTaskModalOpen(true);
            }}
            onOpenDroneSimulation={(coords) => {
              setDroneStartCoords(coords);
              setIsDroneModalOpen(true);
            }}
            onOpenAiAnalysis={() => {
              handleOpenAiHub('on_demand', 'plantation');
            }}
            activeOrgName={props.organizations?.find(o => o.id === props.activeOrgId)?.name}
          />
        )}

        {/* Map Work, Task & Note Creation Modal */}
        {isWorkTaskModalOpen && (
          <MapWorkTaskModal
            isOpen={isWorkTaskModalOpen}
            onClose={() => setIsWorkTaskModalOpen(false)}
            coordinates={workTaskModalCoords}
            initialMode={workTaskInitialMode}
            employees={props.employees || []}
            sectors={props.plantationFeatures?.filter(f => f.type === 'area') || []}
            crops={props.crops || []}
            onSaveWork={(work) => {
              if (props.onSaveWork) {
                props.onSaveWork(work);
              } else {
                window.dispatchEvent(new CustomEvent('agrimap_add_work_assignment', { detail: work }));
              }
              if (props.onFeatureDrawn && workTaskModalCoords && work.createMapMarker !== false) {
                props.onFeatureDrawn(
                  'checkpoint',
                  [workTaskModalCoords.lat, workTaskModalCoords.lng],
                  undefined,
                  {
                    id: work.linkedFeatureId || `work-marker-${Date.now()}`,
                    name: work.workName,
                    monitoringType: 'work',
                    taskType: work.taskType,
                    source: 'tasks',
                    status: 'pending',
                    priority: (work as any).priority || 'medium',
                    color: (work as any).color || '#f59e0b',
                    customColor: (work as any).color || '#f59e0b',
                    notes: work.notes || `${work.taskType} work assignment`,
                    organizationId: props.activeOrgId || 'personal',
                  }
                );
              }
              toast.success(isKa ? "სამუშაო დამატებულია და მონიშნულია რუკაზე!" : "Work assignment added & pinned to map!");
            }}
            onSaveTask={(task) => {
              if (props.onSaveTask) {
                props.onSaveTask(task);
              } else {
                window.dispatchEvent(new CustomEvent('agrimap_add_task', { detail: task }));
              }
              if (props.onFeatureDrawn && workTaskModalCoords && task.createMapMarker !== false) {
                props.onFeatureDrawn(
                  'checkpoint',
                  [workTaskModalCoords.lat, workTaskModalCoords.lng],
                  undefined,
                  {
                    id: task.linkedFeatureId || `task-marker-${Date.now()}`,
                    name: task.workName || task.title,
                    monitoringType: 'task',
                    source: 'planner',
                    status: 'pending',
                    priority: (task as any).priority || 'medium',
                    color: (task as any).color || '#f59e0b',
                    customColor: (task as any).color || '#f59e0b',
                    notes: task.notes || 'Planner task checkpoint',
                    organizationId: props.activeOrgId || 'personal',
                  }
                );
              }
              toast.success(isKa ? "დავალება დამატებულია დამგეგმავში და რუკაზე!" : "Task added to Planner & pinned to map!");
            }}
            onSaveNote={(note) => {
              if (props.onSaveNote) {
                props.onSaveNote(note);
              } else {
                window.dispatchEvent(new CustomEvent('agrimap_add_note', { detail: note }));
              }
              if (props.onFeatureDrawn && workTaskModalCoords && note.createMapMarker !== false) {
                props.onFeatureDrawn(
                  'note',
                  [workTaskModalCoords.lat, workTaskModalCoords.lng],
                  undefined,
                  {
                    id: note.linkedFeatureId || `note-marker-${Date.now()}`,
                    name: note.title,
                    monitoringType: 'note',
                    source: 'planner',
                    status: 'pending',
                    priority: (note as any).priority || 'medium',
                    color: (note as any).color || '#10b981',
                    customColor: (note as any).color || '#10b981',
                    notes: note.content,
                    organizationId: props.activeOrgId || 'personal',
                  }
                );
              }
              toast.success(isKa ? "შენიშვნა დამატებულია და დასმულია რუკაზე!" : "Field note created & pinned to map!");
            }}
            isKa={isKa}
          />
        )}

        {/* Drone Mission Simulation Modal on Dashboard */}
        {isDroneModalOpen && (
          <DroneSimulationModal
            isOpen={isDroneModalOpen}
            onClose={() => setIsDroneModalOpen(false)}
            plantationFeatures={props.plantationFeatures}
            activeMapCenter={droneStartCoords ? [droneStartCoords.lat, droneStartCoords.lng] : (props.center || [41.7151, 44.8271])}
          />
        )}

        <WidgetManagerModal 
            isOpen={isManageModalOpen} 
            onClose={() => setIsManageModalOpen(false)} 
            layout={dashboardLayout} 
            onUpdate={onSetDashboardLayout} 
            userId={props.currentUser?.id}
            mapPosition={mapPosition}
            onUpdateMapPosition={handleSetMapPosition}
        />

        {activeOrgId && (
            <CropManagementModal 
                isOpen={isCropModalOpen}
                onClose={() => setIsCropModalOpen(false)}
                crops={crops}
                organizationId={activeOrgId}
            />
        )}

        <AiCrossModuleAnalysisModal
            isOpen={isAiModalOpen}
            onClose={() => setIsAiModalOpen(false)}
            initialMode={aiModalMode}
            preselectedModule={aiModalModule}
            inventoryItems={props.inventoryItems}
            nutritionPlans={props.nutritionPlans}
            planExecutions={[]}
            workAssignments={props.workAssignments}
            dailyLogs={props.dailyLogs}
            harvestEvents={props.harvestEvents}
            accounts={props.accounts}
            config={aiConfig}
            onUpdateConfig={setAiConfig}
            onAnalysisCompleted={(report) => {
                setLatestReport(report);
                setAnomalies(report.anomalies);
            }}
        />

        <IntercomPopUpModal
            isOpen={isIntercomPopUpOpen}
            onClose={() => setIsIntercomPopUpOpen(false)}
            currentUser={props.currentUser || null}
            forumPosts={props.forumPosts || []}
            onAddPost={props.onAddPost || (() => {})}
            onAddReply={props.onAddReply}
            onUpdatePost={props.onUpdatePost || (() => {})}
            allUsers={props.allUsers || props.users || []}
            memberships={props.memberships || []}
            onSetMemberships={props.onSetMemberships}
            activeOrgId={props.activeOrgId}
            employees={props.employees}
            onSetEmployees={props.onSetEmployees}
            users={props.users || []}
            onSetUsers={props.onSetUsers}
            roles={props.roles || []}
            plantationFeatures={props.plantationFeatures}
            mapProps={props}
        />
        
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            .animate-slide-up { animation: slide-up 0.5s ease-out forwards; }
            @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </main>
  );
};

export default Dashboard;
