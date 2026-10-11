import React from 'react';
import type { WorkAssignment } from '../types';
import { BriefcaseIcon, CheckIcon, ClockIcon } from './Icons';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface TasksQuickAccessWidgetProps {
    workAssignments?: WorkAssignment[];
    onNavigateMode?: (mode: string) => void;
}

export const TasksQuickAccessWidget: React.FC<TasksQuickAccessWidgetProps> = ({
    workAssignments = [],
    onNavigateMode
}) => {
    const { t } = useLanguage();
    const tasks = workAssignments || [];
    const plannedTasks = tasks.filter(w => w.status === 'planned');
    const inProgressTasks = tasks.filter(w => w.status === 'in-progress' || w.status === 'active');
    const completedTasks = tasks.filter(w => w.status === 'completed');

    const upcomingTasks = tasks
        .filter(w => w.status !== 'completed')
        .slice(0, 4);

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between relative overflow-hidden">
            {/* Top Glow Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />

            <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                            <BriefcaseIcon size={18} />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                {t('dash.widget.tasks')}
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                {t('tasks_widget.subtitle')}
                            </p>
                        </div>
                    </div>

                    <span className="px-2.5 py-1 bg-indigo-100/70 text-indigo-800 rounded-xl text-[9px] font-black uppercase tracking-wider border border-indigo-200">
                        {t('tasks_widget.active_count', { count: String(plannedTasks.length + inProgressTasks.length) })}
                    </span>
                </div>

                {/* Status Counters */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('tasks_widget.planned')}</p>
                        <p className="text-lg font-black text-amber-600 mt-0.5">{plannedTasks.length}</p>
                    </div>
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('tasks_widget.in_progress')}</p>
                        <p className="text-lg font-black text-indigo-600 mt-0.5">{inProgressTasks.length}</p>
                    </div>
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('tasks_widget.done')}</p>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">{completedTasks.length}</p>
                    </div>
                </div>

                {/* Upcoming Tasks List */}
                <div className="space-y-2 mb-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {t('tasks_widget.upcoming')}
                    </p>
                    {upcomingTasks.map(task => {
                        const displayName = typeof task.workName === 'string' 
                            ? task.workName 
                            : ((task.workName as any)?.name || (task.workName as any)?.title || 'Task');

                        const isProgress = task.status === 'in-progress';
                        return (
                            <div 
                                key={task.id} 
                                onClick={() => onNavigateMode?.('tasks')}
                                className="p-3 bg-indigo-50/30 hover:bg-indigo-50/70 border border-indigo-100/80 rounded-2xl flex items-center justify-between cursor-pointer transition-all group shadow-xs"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <div className={`p-1.5 rounded-lg text-white group-hover:scale-105 transition-transform ${isProgress ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                                        <ClockIcon size={12} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                                            {displayName}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                            {task.taskType || 'General Work'} • {task.assignedEmployeeIds?.length || 0} {t('tasks_widget.workers')}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <span className="text-[9px] font-black text-indigo-500 uppercase">
                                        {task.date ? new Date(task.date).toLocaleDateString() : t('tasks_widget.scheduled')}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {upcomingTasks.length === 0 && (
                        <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                            <CheckIcon className="h-8 w-8 mx-auto text-emerald-500 mb-1 opacity-40" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {t('tasks_widget.all_completed')}
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5">
                                {t('tasks_widget.plan_next')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Action Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onNavigateMode?.('tasks')}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <span>{t('tasks_widget.open_planner')}</span>
                    <ArrowRight size={12} />
                </button>
            </div>
        </div>
    );
};
