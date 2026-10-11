import React, { useState } from 'react';
import { 
    AiAnomalyAlert, AiAnalysisReport, AiAnalysisScheduleConfig, 
    AnalysisModuleScope 
} from '../types';
import { 
    SparklesIcon, AlertTriangleIcon, ArrowTrendingUpIcon, 
    CheckIcon, CalendarDaysIcon, BeakerIcon, 
    BriefcaseIcon, ChevronDownIcon, ChevronUpIcon, 
    ArrowPathIcon, WrenchScrewdriverIcon, ChartBarIcon
} from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardAiStreamProps {
    anomalies: AiAnomalyAlert[];
    latestReport: AiAnalysisReport | null;
    config: AiAnalysisScheduleConfig;
    onOpenAiHub: (initialMode?: 'scheduled' | 'interval' | 'on_demand', preselectedModule?: AnalysisModuleScope) => void;
    onRefreshAnalysis: () => void;
    isLoading?: boolean;
}

export const DashboardAiStream: React.FC<DashboardAiStreamProps> = ({
    anomalies = [],
    latestReport,
    config,
    onOpenAiHub,
    onRefreshAnalysis,
    isLoading = false
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [isExpanded, setIsExpanded] = useState(true);


    const activeAnomalies = anomalies.slice(0, 3);

    const getModuleIcon = (module: AnalysisModuleScope) => {
        switch (module) {
            case 'stock': return <ChartBarIcon className="w-4 h-4 text-amber-400" />;
            case 'agronomy': return <BeakerIcon className="w-4 h-4 text-purple-400" />;
            case 'tasks': return <BriefcaseIcon className="w-4 h-4 text-sky-400" />;
            default: return <SparklesIcon className="w-4 h-4 text-emerald-400" />;
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical':
                return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
            case 'high':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
            default:
                return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
        }
    };

    return (
        <div 
            className="border rounded-[2rem] p-5 sm:p-6 shadow-2xl text-white backdrop-blur-xl relative overflow-hidden transition-all duration-300"
            style={{
                backgroundColor: 'var(--bg-surface, #0f172a)',
                borderColor: 'var(--border-color, #1e293b)'
            }}
        >
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header / Stream Bar */}
            <div 
                className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 relative z-10"
                style={{ borderColor: 'var(--border-color, #1e293b)' }}
            >
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                        <SparklesIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                                {isKa ? 'AI ოპერაციული ნაკადი & ანომალიების მონიტორი' : 'AI Autonomous Stream & Operational Anomaly Engine'}
                            </h3>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                {isKa ? 'ავტო-ჩამოწერა აქტიურია' : 'Stock Auto-Deduct Synced'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {isKa 
                                ? `განრიგი: ${config.cadence === 'weekly' ? 'ყოველკვირეული' : config.cadence === 'monthly' ? 'ყოველთვიური' : 'პერიოდული'} ანალიზი | მარაგები, აგრონომია, სამუშაოები & მოსავალი`
                                : `Cadence: ${config.cadence.toUpperCase()} automated audit across Stock, Agronomy, Labor Tasks & Weight Station`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onRefreshAnalysis}
                        disabled={isLoading}
                        className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 disabled:opacity-50"
                        style={{
                            backgroundColor: 'var(--bg-subsurface, #070c18)',
                            borderColor: 'var(--border-color, #1e293b)'
                        }}
                        title={isKa ? 'ანალიზის განახლება' : 'Refresh AI Analysis'}
                    >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{isKa ? 'განახლება' : 'Scan Now'}</span>
                    </button>

                    <button
                        onClick={() => onOpenAiHub('scheduled')}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                        <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
                        <span>{isKa ? 'AI კონფიგურატორი' : 'AI Analysis Hub'}</span>
                    </button>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors border"
                        style={{
                            backgroundColor: 'var(--bg-subsurface, #070c18)',
                            borderColor: 'var(--border-color, #1e293b)'
                        }}
                        aria-label="Toggle Panel"
                    >
                        {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="mt-4 space-y-4 relative z-10 animate-fade-in">
                    {/* Anomaly Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {activeAnomalies.map((anomaly) => (
                            <div 
                                key={anomaly.id}
                                className="border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between group hover:border-emerald-500/50"
                                style={{
                                    backgroundColor: 'var(--bg-subsurface, #070c18)',
                                    borderColor: 'var(--border-color, #1e293b)'
                                }}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                                            {getModuleIcon(anomaly.module)}
                                            <span className="capitalize">{anomaly.module}</span>
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${getSeverityBadge(anomaly.severity)}`}>
                                            {anomaly.severity}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                                        {anomaly.title}
                                    </h4>
                                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                                        {anomaly.description}
                                    </p>
                                </div>

                                <div 
                                    className="mt-3 pt-3 border-t flex items-center justify-between text-[11px]"
                                    style={{ borderColor: 'var(--border-color, #1e293b)' }}
                                >
                                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                                        <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
                                        <span>+{anomaly.variancePercentage}% {isKa ? 'გადახრა' : 'Variance'}</span>
                                    </div>
                                    <button
                                        onClick={() => onOpenAiHub('on_demand', anomaly.module)}
                                        className="text-xs font-black text-indigo-400 hover:text-indigo-300 hover:underline"
                                    >
                                        {isKa ? 'დიაგნოსტიკა →' : 'Diagnose →'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Executive Summary & Fast Actions Footer */}
                    {latestReport && (
                        <div 
                            className="border rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                            style={{
                                backgroundColor: 'var(--bg-subsurface, #070c18)',
                                borderColor: 'var(--border-color, #1e293b)'
                            }}
                        >
                            <div className="flex items-start gap-2.5 text-slate-300">
                                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                                    <CheckIcon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="font-bold text-white mr-1.5">
                                        {isKa ? 'უახლესი AI დასკვნა:' : 'Executive AI Audit Summary:'}
                                    </span>
                                    <span className="text-slate-300 leading-relaxed">
                                        {latestReport.executiveSummary}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                    onClick={() => onOpenAiHub('interval')}
                                    className="px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-[11px] font-bold border transition-colors flex items-center gap-1"
                                    style={{
                                        backgroundColor: 'var(--bg-canvas, #090d16)',
                                        borderColor: 'var(--border-color, #1e293b)'
                                    }}
                                >
                                    <CalendarDaysIcon className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>{isKa ? 'ინტერვალის შერჩევა' : 'Custom Date Range'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DashboardAiStream;
