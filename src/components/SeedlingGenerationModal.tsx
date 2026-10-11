import React, { useState, useEffect } from 'react';
import { XIcon, PlusIcon, TrashIcon, SparklesIcon } from './Icons';
import { VarietyRule } from '../types';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

interface SeedlingGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (rules: VarietyRule[], spacing: number) => void;
    cropVarieties: string[];
    maxPlants: number;
    lineLength?: number;
    featureName: string;
    defaultSpacing?: number;
    onAddCropVariety?: (variety: string) => void;
}

const SeedlingGenerationModal: React.FC<SeedlingGenerationModalProps> = ({ 
    isOpen, 
    onClose, 
    onGenerate, 
    cropVarieties, 
    maxPlants, 
    lineLength,
    featureName, 
    defaultSpacing, 
    onAddCropVariety 
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [rules, setRules] = useState<VarietyRule[]>([]);
    const [spacing, setSpacing] = useState<number>(0.5);
    const [spacingInput, setSpacingInput] = useState<string>('0.5');

    // Calculate maximum plants dynamically if lineLength is provided, otherwise fall back to maxPlants
    const currentMaxPlants = lineLength ? Math.max(1, Math.floor(lineLength / spacing)) : maxPlants;

    useEffect(() => {
        if (isOpen) {
            const initialSpacing = defaultSpacing || 0.5;
            setSpacing(initialSpacing);
            setSpacingInput(initialSpacing.toString());
            
            const initialMax = lineLength ? Math.max(1, Math.floor(lineLength / initialSpacing)) : maxPlants;
            setRules([{ id: '1', variety: cropVarieties[0] || (isKa ? 'სტანდარტული' : 'Default'), from: 1, to: initialMax }]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSpacingChange = (valStr: string) => {
        setSpacingInput(valStr);

        const parsed = parseFloat(valStr);
        if (!isNaN(parsed) && parsed > 0.001) {
            setSpacing(parsed);
            
            // Recalculate dynamic max plants
            const nextMax = lineLength ? Math.max(1, Math.floor(lineLength / parsed)) : maxPlants;
            
            // Adjust rules sequentially to fit nextMax
            setRules(prevRules => {
                if (prevRules.length === 0) return prevRules;
                
                let currentFrom = 1;
                const adjusted = [];
                for (let i = 0; i < prevRules.length; i++) {
                    const rule = prevRules[i];
                    if (currentFrom > nextMax) {
                        break; 
                    }
                    
                    const ruleLength = Math.max(1, rule.to - rule.from + 1);
                    let ruleTo = currentFrom + ruleLength - 1;
                    
                    if (i === prevRules.length - 1 || ruleTo > nextMax) {
                        ruleTo = nextMax;
                    }
                    
                    adjusted.push({
                        ...rule,
                        from: currentFrom,
                        to: ruleTo
                    });
                    
                    currentFrom = ruleTo + 1;
                }
                
                if (adjusted.length === 0) {
                    return [{ id: '1', variety: cropVarieties[0] || (isKa ? 'სტანდარტული' : 'Default'), from: 1, to: nextMax }];
                }
                
                adjusted[adjusted.length - 1].to = nextMax;
                return adjusted;
            });
        }
    };

    const addRule = () => {
        const lastRule = rules[rules.length - 1];
        setRules([...rules, { 
            id: Date.now().toString(), 
            variety: cropVarieties[0] || (isKa ? 'სტანდარტული' : 'Default'), 
            from: lastRule ? lastRule.to + 1 : 1, 
            to: currentMaxPlants 
        }]);
    };

    const removeRule = (id: string) => {
        if (rules.length > 1) {
            setRules(rules.filter(r => r.id !== id));
        }
    };

    const updateRule = (id: string, field: keyof VarietyRule, value: any) => {
        setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20" onClick={e => e.stopPropagation()}>
                <div className="p-8 pb-4 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                            {isKa ? 'ნერგების ' : 'SEEDLING '}
                            <span className="text-blue-600">{isKa ? 'წესები' : 'RULES'}</span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-2">
                            {isKa ? `კონფიგურაცია ${currentMaxPlants} პოტენციურ ნერგზე` : `CONFIGURE ${currentMaxPlants} POTENTIAL PLANTS`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all border border-slate-100 cursor-pointer">
                        <XIcon className="h-5 w-5 text-slate-400" />
                    </button>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {rules.map((rule, index) => (
                            <div key={rule.id} className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 space-y-4 relative group">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                        {isKa ? `წესი #${index + 1}` : `Rule #${index + 1}`}
                                    </span>
                                    {rules.length > 1 && (
                                        <button onClick={() => removeRule(rule.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors cursor-pointer">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
                                            {isKa ? 'ჯიში' : 'Variety'}
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                list={`varieties-${rule.id}`}
                                                className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                                                value={rule.variety}
                                                onChange={e => updateRule(rule.id, 'variety', e.target.value)}
                                                placeholder={isKa ? "შეიყვანეთ ან აირჩიეთ ჯიში" : "TYPE OR SELECT VARIETY"}
                                            />
                                            <datalist id={`varieties-${rule.id}`}>
                                                {cropVarieties.map(v => <option key={v} value={v} />)}
                                            </datalist>
                                            <button 
                                                onClick={() => {
                                                    if (rule.variety && onAddCropVariety && !cropVarieties.includes(rule.variety)) {
                                                        onAddCropVariety(rule.variety);
                                                        toast.success(isKa ? `დამატებულია ჯიში: ${rule.variety}` : `Added variety: ${rule.variety}`);
                                                    }
                                                }}
                                                className="p-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-100 transition-all cursor-pointer"
                                                title={isKa ? "ჯიშის რეგისტრაცია" : "Register Variety"}
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
                                                {isKa ? 'დან #' : 'From #'}
                                            </label>
                                            <input 
                                                type="number" 
                                                className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-xs font-black text-center outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                                                value={rule.from}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    updateRule(rule.id, 'from', val === '' ? '' : parseInt(val));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
                                                {isKa ? 'მდე #' : 'To #'}
                                            </label>
                                            <input 
                                                type="number" 
                                                className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-xs font-black text-center outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                                                value={rule.to}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    updateRule(rule.id, 'to', val === '' ? '' : parseInt(val));
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100 space-y-2">
                        <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest block ml-1 font-medium">
                            {isKa ? 'ნერგებს შორის მანძილი (მ)' : 'Plant/Seed Spacing (m)'}
                        </label>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            className="w-full p-4 bg-white border border-blue-100 rounded-2xl text-sm font-black text-center outline-none focus:ring-4 focus:ring-blue-100 transition-all text-blue-600"
                            value={spacingInput}
                            onChange={e => handleSpacingChange(e.target.value)}
                            placeholder="e.g. 0.5"
                        />
                    </div>

                    <button 
                        onClick={addRule}
                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[1.5rem] text-slate-400 hover:border-blue-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <PlusIcon className="h-4 w-4" /> {isKa ? 'ჯიშის დიაპაზონის დამატება' : 'Add Variety Range'}
                    </button>
                </div>

                <div className="p-8 pt-0 flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-[1.5rem] transition-all cursor-pointer"
                    >
                        {isKa ? 'გაუქმება' : 'Cancel'}
                    </button>
                    <button 
                        onClick={() => {
                            if (spacing <= 0) {
                                toast.error(isKa ? "მანძილი უნდა აღემატებოდეს ნულს." : "Spacing must be greater than zero.");
                                return;
                            }
                            const hasEmpty = rules.some(r => (r.from as any) === '' || (r.to as any) === '' || isNaN(r.from) || isNaN(r.to));
                            if (hasEmpty) {
                                toast.error(isKa ? "გთხოვთ შეავსოთ ყველა დიაპაზონი სწორი ციფრებით." : "Please fill in all variety ranges with valid numbers.");
                                return;
                            }
                            onGenerate(rules, spacing);
                        }}
                        className="flex-[2] py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <SparklesIcon className="h-4 w-4" /> {isKa ? 'რიგის შევსება' : 'Populate Row'}
                    </button>
                </div>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>
        </div>
    );
};

export default SeedlingGenerationModal;
