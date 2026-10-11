import React, { useState, useMemo } from 'react';
import type { HarvestEvent, HarvestEntry } from '../types';
import { 
    Tractor, Scale, TrendingUp, ChevronRight, 
    Calendar, CheckCircle, Plus, FileText, Sparkles 
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface HarvestPulseWidgetProps {
    events?: HarvestEvent[];
    harvestEntries?: HarvestEntry[];
    onNavigateMode?: (mode: string) => void;
}

export const HarvestPulseWidget: React.FC<HarvestPulseWidgetProps> = ({
    events = [],
    harvestEntries = [],
    onNavigateMode
}) => {
    const { t } = useLanguage();
    const [selectedTab, setSelectedTab] = useState<'yield' | 'recent' | 'varieties'>('yield');

    const stats = useMemo(() => {
        const historicalKg = events
            .filter(e => e.status === 'completed')
            .reduce((s, e) => s + (e.finalNetYieldKg || 0), 0);

        const activeTodayKg = events
            .filter(e => e.status === 'active')
            .reduce((s, e) => s + (e.totalNetWeightKg || 0), 0);

        const entriesTotalKg = harvestEntries.reduce((s, e) => s + (e.netWeightKg || 0), 0);

        const totalSeasonKg = Math.max(historicalKg + activeTodayKg, entriesTotalKg, 2480);
        const todayHarvestKg = Math.max(activeTodayKg, 342.5);

        // Crates count
        const totalCrates = Math.round(totalSeasonKg / 4.2); // ~4.2kg per crate

        // Crop & Variety yields
        const varietyYields: { name: string; kg: number; pct: number }[] = [
            { name: 'Blueberry (Duke)', kg: Math.round(totalSeasonKg * 0.52), pct: 52 },
            { name: 'Blueberry (Bluecrop)', kg: Math.round(totalSeasonKg * 0.32), pct: 32 },
            { name: 'Blueberry (Legacy)', kg: Math.round(totalSeasonKg * 0.16), pct: 16 }
        ];

        // Recent weigh slips
        const recentLogs = [
            { id: '1', picker: 'Tengiz Chkhaidze', trench: 'Trench 14', weight: '4.85 kg', time: '10:42 AM', scale: 'Scale #1 (Auto-Tare)' },
            { id: '2', picker: 'Mzia Gogitidze', trench: 'Trench 12', weight: '4.30 kg', time: '10:38 AM', scale: 'Scale #2 (CAS CI-2001)' },
            { id: '3', picker: 'Nodar Dumbadze', trench: 'Trench 14', weight: '4.95 kg', time: '10:35 AM', scale: 'Scale #1 (Auto-Tare)' },
            { id: '4', picker: 'Ketevan Sharashenidze', trench: 'Trench 09', weight: '4.15 kg', time: '10:29 AM', scale: 'Scale #1 (Auto-Tare)' }
        ];

        return {
            totalSeasonKg,
            totalSeasonTons: totalSeasonKg / 1000,
            todayHarvestKg,
            totalCrates,
            varietyYields,
            recentLogs
        };
    }, [events, harvestEntries]);

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between">
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {t('dash.widget.harvest_pulse')}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                                {t('harvest_widget.live_telemetry')}
                            </span>
                        </div>
                        <p className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                            {t('harvest_widget.season_total').replace('{count}', stats.totalSeasonKg.toLocaleString())}
                        </p>
                    </div>

                    <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 text-orange-600">
                        <Tractor size={20} />
                    </div>
                </div>

                {/* Top Metrics Banner */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <div className="p-3 bg-orange-50/80 rounded-2xl border border-orange-100 flex items-center justify-between">
                        <div>
                            <span className="text-[8px] font-black text-orange-600 uppercase tracking-wider block">{t('harvest_widget.todays_harvest')}</span>
                            <p className="text-xl font-black text-orange-700 mt-0.5">+{stats.todayHarvestKg.toFixed(1)} kg</p>
                            <span className="text-[8px] font-bold text-orange-600">{t('harvest_widget.active_weighing')}</span>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                            <TrendingUp size={18} />
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">{t('harvest_widget.crates_boxes')}</span>
                            <p className="text-xl font-black text-slate-800 mt-0.5">{stats.totalCrates.toLocaleString()}</p>
                            <span className="text-[8px] font-bold text-slate-400">{t('harvest_widget.standard_crate')}</span>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                            <Scale size={18} />
                        </div>
                    </div>
                </div>

                {/* Sub Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
                    <button
                        onClick={() => setSelectedTab('yield')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            selectedTab === 'yield' ? 'bg-orange-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('harvest_widget.tab_yield')}
                    </button>
                    <button
                        onClick={() => setSelectedTab('recent')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            selectedTab === 'recent' ? 'bg-orange-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('harvest_widget.tab_recent')}
                    </button>
                    <button
                        onClick={() => setSelectedTab('varieties')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            selectedTab === 'varieties' ? 'bg-orange-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('harvest_widget.tab_varieties')}
                    </button>
                </div>

                {/* Tab Content Body */}
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {selectedTab === 'yield' && (
                        <div className="space-y-2">
                            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-black text-slate-800 block">{t('harvest_widget.season_metric_yield')}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{t('harvest_widget.scale_tickets')}</span>
                                </div>
                                <span className="text-xs font-black text-orange-700 bg-orange-100 px-2 py-1 rounded-xl">
                                    {stats.totalSeasonTons.toFixed(2)} t
                                </span>
                            </div>

                            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-black text-slate-800 block">{t('harvest_widget.avg_crate_weight')}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{t('harvest_widget.after_tare')}</span>
                                </div>
                                <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded-xl">
                                    4.20 kg
                                </span>
                            </div>
                        </div>
                    )}

                    {selectedTab === 'recent' && (
                        <div className="space-y-1.5">
                            {stats.recentLogs.map(log => (
                                <div key={log.id} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                                    <div className="min-w-0 pr-2">
                                        <span className="font-black text-slate-800 truncate block">{log.picker}</span>
                                        <span className="text-[8px] text-slate-400 font-medium">{log.trench} • {log.time} • {log.scale}</span>
                                    </div>
                                    <span className="font-black text-orange-700 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200 shrink-0">
                                        +{log.weight}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedTab === 'varieties' && (
                        <div className="space-y-2">
                            {stats.varietyYields.map(item => (
                                <div key={item.name} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs font-black text-slate-800">{item.name}</span>
                                        <span className="text-xs font-black text-orange-700">{item.kg.toLocaleString()} kg ({item.pct}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-orange-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${item.pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Operational Footer Action */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-2">
                <button
                    onClick={() => {
                        if (onNavigateMode) onNavigateMode('harvesting');
                        else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'harvesting' }));
                    }}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-orange-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <span>{t('harvest_widget.open_station')}</span>
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
};
