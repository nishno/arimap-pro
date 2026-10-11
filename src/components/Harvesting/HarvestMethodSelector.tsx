
import React from 'react';
import { HARVEST_METHODS, HarvestMethod } from '../../types';
import * as Icons from 'lucide-react';

interface HarvestMethodSelectorProps {
    onSelect: (method: HarvestMethod) => void;
    onClose: () => void;
}

const HarvestMethodSelector: React.FC<HarvestMethodSelectorProps> = ({ onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                <div className="p-10 pb-6">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">მენეჯერის არჩევანის ჰაბი</h2>
                            <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-[10px]">აირჩიეთ მოსავლის აღების აქტიური პროტოკოლი ამ სესიისთვის</p>
                        </div>
                        <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all">
                            <Icons.X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {HARVEST_METHODS.map((method) => {
                            const IconComponent = (Icons as any)[method.icon] || Icons.HelpCircle;
                            return (
                                <button
                                    key={method.id}
                                    onClick={() => onSelect(method)}
                                    className="group relative p-6 bg-white border-2 border-slate-100 rounded-[32px] text-left hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-50 transition-all active:scale-[0.98] flex flex-col"
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                                        method.protocol === 1 ? 'bg-blue-50 text-blue-600' :
                                        method.protocol === 2 ? 'bg-indigo-50 text-indigo-600' :
                                        method.protocol === 3 ? 'bg-emerald-50 text-emerald-600' :
                                        method.protocol === 4 ? 'bg-amber-50 text-amber-600' :
                                        method.protocol === 5 ? 'bg-rose-50 text-rose-600' :
                                        method.protocol === 6 ? 'bg-violet-50 text-violet-600' :
                                        'bg-cyan-50 text-cyan-600'
                                    }`}>
                                        <IconComponent size={28} />
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2 leading-tight">{method.name}</h3>
                                        <p className="text-xs font-medium text-slate-500 leading-relaxed">{method.description}</p>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">პროტოკოლი {method.protocol}</span>
                                        <div className="p-2 rounded-full bg-slate-50 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <Icons.ChevronRight size={14} />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">სისტემა მზადაა • გურიის რეგიონალური ლოკალური ქსელი ჩართულია</span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-300 font-bold uppercase text-[9px] tracking-[0.2em]">
                        <span>სტანდარტული</span>
                        <span>•</span>
                        <span>ექსპერტი</span>
                        <span>•</span>
                        <span className="text-indigo-600 text-[10px]">მომავლის რეჟიმი</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HarvestMethodSelector;
