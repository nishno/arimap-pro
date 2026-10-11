import React from 'react';
import { CalendarDaysIcon, PencilSquareIcon, ArrowUturnLeftIcon, SparklesIcon } from '../Icons';
import { NutritionPlan, PlanExecution, Employee } from '../../types';

interface ListViewProps {
    planExecutions: PlanExecution[];
    nutritionPlans: NutritionPlan[];
    employees: Employee[];
    onEditExec: (exec: PlanExecution) => void;
    onViewDetail?: (exec: PlanExecution) => void;
    onDeleteExecution: (id: string) => void;
}

const ListView: React.FC<ListViewProps> = ({
    planExecutions,
    nutritionPlans,
    employees,
    onEditExec,
    onViewDetail,
    onDeleteExecution
}) => {
    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Fertigation & Treatment Logs</h2>
                        <p className="text-xs text-slate-400">Click any execution log to view detailed parameters, AC & pH measurements, stock deduction, and edit history.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {planExecutions.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exec => {
                        const plan = nutritionPlans.find(p => p.id === exec.planId);
                        const executor = employees.find(e => e.id === exec.executedByEmployeeId);
                        return (
                            <div 
                                key={exec.id} 
                                onClick={() => onViewDetail ? onViewDetail(exec) : onEditExec(exec)}
                                className={`p-5 rounded-[2rem] border flex justify-between items-center group cursor-pointer transition-all ${
                                    exec.isReverted
                                        ? 'bg-amber-50/50 border-amber-200 opacity-80'
                                        : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-sm flex-shrink-0 ${
                                        exec.isReverted 
                                            ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                                            : 'bg-white border border-slate-200 text-emerald-500'
                                    }`}>
                                        <CalendarDaysIcon size={24}/>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-black text-slate-800 uppercase tracking-tight text-sm truncate">
                                                {plan?.name || 'Treatment Execution'}
                                            </p>
                                            {exec.cycleFeedingNumber && (
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-black text-[9px] uppercase tracking-wider">
                                                    Feeding #{exec.cycleFeedingNumber}
                                                </span>
                                            )}
                                            {exec.isReverted && (
                                                <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-black text-[9px] uppercase tracking-wider">
                                                    Reverted
                                                </span>
                                            )}
                                            {exec.auditLogs && exec.auditLogs.length > 0 && (
                                                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-black text-[9px] uppercase tracking-wider">
                                                    Edited ({exec.auditLogs.length})
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            {new Date(exec.date).toLocaleDateString()} 
                                            {executor && ` • Operator: ${executor.name}`}
                                            {exec.actualWaterLiters ? ` • ${exec.actualWaterLiters} L Solution` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" onClick={e => e.stopPropagation()}>
                                    <button 
                                        onClick={() => onEditExec(exec)} 
                                        className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl hover:shadow-md transition-all"
                                        title="Edit Log"
                                    >
                                        <PencilSquareIcon size={18} />
                                    </button>
                                    <button 
                                        onClick={() => onDeleteExecution(exec.id)} 
                                        className="p-2.5 bg-white border border-slate-200 text-red-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all"
                                        title="Revert & Delete Log"
                                    >
                                        <ArrowUturnLeftIcon size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {planExecutions.length === 0 && <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest py-10">No treatments logged.</p>}
                </div>
            </div>
        </div>
    );
};

export default ListView;
