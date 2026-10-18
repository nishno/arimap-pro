import {isLocalRuntime} from '../local/runtime';
import React, { useState } from 'react';
import type { WorkAssignment, Alert } from '../types';
import { Calendar, Clock, AlertTriangle, CheckCircle2, ChevronRight, Plus, Droplet, Sparkles, Filter } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface PlannerScheduleWidgetProps {
    workAssignments?: WorkAssignment[];
    alerts?: Alert[];
    onNavigateMode?: (mode: string) => void;
    onAddAlert?: (alert: any) => void;
}

export const PlannerScheduleWidget: React.FC<PlannerScheduleWidgetProps> = ({
    workAssignments = [],
    alerts = [],
    onNavigateMode
}) => {
    const { t } = useLanguage();
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'milestones' | 'irrigation' | 'sprays'>('all');

    // Milestones and plans derived from work assignments and alerts
    const scheduledItems = [
        ...(!isLocalRuntime?[
        {
            id: 'plan-1',
            title: 'Foliar Nutrient Spray (Calcium & Boron)',
            category: 'sprays',
            date: 'Tomorrow, 07:30 AM',
            priority: 'High',
            status: 'Scheduled',
            parcels: 'Sector B1, Trench 1-14',
            notes: 'Apply before temperature reaches 24°C'
        },
        {
            id: 'plan-2',
            title: 'Drip Line Flushing & Acidification',
            category: 'irrigation',
            date: 'May 28, 2026',
            priority: 'Medium',
            status: 'Planned',
            parcels: 'Sector A3, East Zone',
            notes: 'Check pressure emitters at terminal lines'
        },
        {
            id: 'plan-3',
            title: 'Trench Soil Aeration & Weeding Pass',
            category: 'milestones',
            date: 'June 02, 2026',
            priority: 'Normal',
            status: 'Planned',
            parcels: 'Sectors C1 - C4',
            notes: 'Contractor crew 6 workers assigned'
        },
        ]:[]),
        ...workAssignments.slice(0, 3).map((w, idx) => ({
            id: `task-${w.id || idx}`,
            title: w.workName || w.taskType || 'Scheduled Agro Operation',
            category: 'milestones',
            date: w.date || 'Upcoming',
            priority: 'Normal',
            status: w.status === 'completed' ? 'Done' : 'Active',
            parcels: (w as any).sectorName || 'Designated Parcels',
            notes: w.notes || `${(w.assignedEmployeeIds || []).length} personnel assigned`
        }))
    ];

    const filteredItems = scheduledItems.filter(item => {
        if (selectedCategory === 'all') return true;
        return item.category === selectedCategory;
    });

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between">
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dash.widget.planner')}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200">
                                {t('planner_widget.calendar_sync')}
                            </span>
                        </div>
                        <p className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                            {t('planner_widget.operations_count', { count: String(filteredItems.length) })}
                        </p>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-purple-600">
                        <Calendar size={20} />
                    </div>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            selectedCategory === 'all'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('planner_widget.all')} ({scheduledItems.length})
                    </button>
                    <button
                        onClick={() => setSelectedCategory('sprays')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            selectedCategory === 'sprays'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('planner_widget.sprays')}
                    </button>
                    <button
                        onClick={() => setSelectedCategory('irrigation')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            selectedCategory === 'irrigation'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('planner_widget.irrigation')}
                    </button>
                    <button
                        onClick={() => setSelectedCategory('milestones')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            selectedCategory === 'milestones'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('planner_widget.milestones')}
                    </button>
                </div>

                {/* Operations Schedule List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {filteredItems.map(item => (
                        <div 
                            key={item.id}
                            className="p-3 bg-slate-50/90 hover:bg-purple-50/40 rounded-2xl border border-slate-100 hover:border-purple-200 transition-all group"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100/80 text-purple-700">
                                            {item.category}
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-400 flex items-center gap-0.5">
                                            <Clock size={10} />
                                            {item.date}
                                        </span>
                                    </div>
                                    <p className="text-xs font-black text-slate-800 truncate group-hover:text-purple-900 transition-colors">
                                        {item.title}
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-medium truncate mt-0.5">
                                        {item.parcels} • {item.notes}
                                    </p>
                                </div>

                                <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                                    item.priority === 'High' 
                                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                        : 'bg-slate-200/70 text-slate-600'
                                }`}>
                                    {item.priority}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Operational footer button */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-2">
                <button
                    onClick={() => {
                        if (onNavigateMode) onNavigateMode('system');
                        else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'system' }));
                    }}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-purple-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <span>{t('planner_widget.open_calendar')}</span>
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
};
