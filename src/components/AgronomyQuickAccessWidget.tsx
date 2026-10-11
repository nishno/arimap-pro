import React from 'react';
import type { NutritionPlan, Crop, PlantationFeature } from '../types';
import { LeafIcon, PlusIcon, BeakerIcon } from './Icons';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface AgronomyQuickAccessWidgetProps {
    nutritionPlans?: NutritionPlan[];
    crops?: Crop[];
    plantationFeatures?: PlantationFeature[];
    onNavigateMode?: (mode: string) => void;
}

export const AgronomyQuickAccessWidget: React.FC<AgronomyQuickAccessWidgetProps> = ({
    nutritionPlans = [],
    crops = [],
    plantationFeatures = [],
    onNavigateMode
}) => {
    const { t } = useLanguage();
    const activePlans = nutritionPlans || [];

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between relative overflow-hidden">
            {/* Top Glow Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />

            <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                            <LeafIcon size={18} />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                {t('dash.widget.agronomy_quick')}
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                {t('agronomy_widget.subtitle')}
                            </p>
                        </div>
                    </div>

                    <span className="px-2.5 py-1 bg-emerald-100/70 text-emerald-800 rounded-xl text-[9px] font-black uppercase tracking-wider border border-emerald-200">
                        {t('agronomy_widget.plans_active', { count: String(activePlans.length) })}
                    </span>
                </div>

                {/* Quick Summary Metric Chips */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('agronomy_widget.programs')}</p>
                        <p className="text-lg font-black text-slate-800 mt-0.5">{activePlans.length}</p>
                    </div>
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('agronomy_widget.crops')}</p>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">{crops?.length || 0}</p>
                    </div>
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('agronomy_widget.parcels')}</p>
                        <p className="text-lg font-black text-slate-800 mt-0.5">{plantationFeatures?.length || 0}</p>
                    </div>
                </div>

                {/* List of Active Nutrition Plans */}
                <div className="space-y-2 mb-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {t('agronomy_widget.scheduled_recipes')}
                    </p>
                    {activePlans.slice(0, 3).map(plan => (
                        <div 
                            key={plan.id} 
                            onClick={() => onNavigateMode?.('agronomy')}
                            className="p-3 bg-emerald-50/30 hover:bg-emerald-50/70 border border-emerald-100/80 rounded-2xl flex items-center justify-between cursor-pointer transition-all group shadow-xs"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-emerald-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                                    <BeakerIcon size={12} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                                        {plan.name}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                        {plan.purpose || 'Fertigation'} • {plan.elements?.length || 0} {t('agronomy_widget.ingredients')}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                {plan.frequency && (
                                    <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-700 rounded-md text-[8px] font-black uppercase">
                                        {plan.frequency}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {activePlans.length === 0 && (
                        <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                            <LeafIcon className="h-8 w-8 mx-auto text-emerald-300 mb-1 opacity-40" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {t('agronomy_widget.no_programs')}
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5">
                                {t('agronomy_widget.create_first')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onNavigateMode?.('agronomy')}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-emerald-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <span>{t('agronomy_widget.open_hub')}</span>
                    <ArrowRight size={12} />
                </button>
            </div>
        </div>
    );
};
