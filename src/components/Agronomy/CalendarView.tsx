import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ArrowUturnLeftIcon } from '../Icons';
import { NutritionPlan, PlanExecution } from '../../types';

interface CalendarViewProps {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    planExecutions: PlanExecution[];
    nutritionPlans: NutritionPlan[];
    onAddLog: (dateStr: string) => void;
    onEditExec: (exec: PlanExecution) => void;
    onViewDetail?: (exec: PlanExecution) => void;
    onDeleteExecution: (id: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
    currentDate,
    setCurrentDate,
    planExecutions,
    nutritionPlans,
    onAddLog,
    onEditExec,
    onViewDetail,
    onDeleteExecution
}) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="p-2 bg-slate-50/50 border-r border-b"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = new Date(year, month, i).toISOString().split('T')[0];
        const daysExecutions = planExecutions.filter(e => new Date(e.date).toISOString().split('T')[0] === dateStr);
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        days.push(
            <div key={i} className={`min-h-[120px] p-3 border-r border-b bg-white relative hover:bg-slate-50 transition-colors group`}>
                <div className="flex justify-between items-start">
                    <span className={`text-xs font-black rounded-lg w-7 h-7 flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-500'}`}>{i}</span>
                    <button 
                        onClick={() => onAddLog(dateStr)}
                        className="opacity-0 group-hover:opacity-100 text-[9px] font-black uppercase text-indigo-600 bg-white border border-indigo-100 px-2 py-1 rounded-lg shadow-sm hover:bg-indigo-50 transition-all"
                    >
                        + ADD LOG
                    </button>
                </div>
                <div className="mt-2 space-y-1 overflow-y-auto max-h-[80px] no-scrollbar">
                    {daysExecutions.map(exec => {
                        const plan = nutritionPlans.find(p => p.id === exec.planId);
                        return (
                            <div 
                                key={exec.id} 
                                onClick={() => onViewDetail ? onViewDetail(exec) : onEditExec(exec)}
                                className={`text-[10px] font-bold p-1.5 rounded-lg border cursor-pointer truncate flex justify-between group/item transition-all ${
                                    exec.isReverted 
                                        ? 'bg-amber-50 border-amber-200 text-amber-800' 
                                        : 'bg-emerald-50 border-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                }`}
                            >
                                <span className="truncate flex-1 uppercase tracking-tighter">
                                    {exec.cycleFeedingNumber ? `#${exec.cycleFeedingNumber} ` : ''}
                                    {plan?.name || 'Treatment'}
                                </span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteExecution(exec.id); }} 
                                    className="text-red-400 hover:text-red-600 hidden group-hover/item:block ml-1"
                                    title="Revert Log"
                                >
                                    <ArrowUturnLeftIcon size={10} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <div className="flex items-center gap-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"><ChevronLeftIcon className="h-4 w-4 text-slate-600"/></button>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"><ChevronRightIcon className="h-4 w-4 text-slate-600"/></button>
                    </div>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 border border-slate-200 px-4 py-2 rounded-xl transition-all">Today</button>
            </div>
            <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="p-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 border-l border-t border-slate-100">
                {days}
            </div>
        </div>
    );
};

export default CalendarView;
