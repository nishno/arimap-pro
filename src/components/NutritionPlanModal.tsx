import React, { useState, useMemo } from 'react';
import type { 
    NutritionPlan, PlanElement, InventoryItem, 
    RecipeTankConfig, RecipeTankIngredient 
} from '../types';
import { 
    XCircleIcon, PlusIcon, TrashIcon, 
    BeakerIcon, SparklesIcon 
} from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface NutritionPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (plan: NutritionPlan) => void;
    plan: NutritionPlan | null;
    materials: InventoryItem[];
}

const DEFAULT_RECIPE_TANKS_EN: RecipeTankConfig[] = [
    {
        tankKey: 'tank-a',
        tankName: 'Tank A (Ferti A)',
        tankType: 'fertilizer',
        capacityLiters: 1000,
        waterLiters: 1000,
        expectedFeedingsPerBatch: 1,
        ingredients: [
            { name: 'Potassium Sulphate', quantity: 23, unit: 'kg' },
            { name: 'Ammonium Sulphate', quantity: 23, unit: 'kg' },
            { name: 'Boron', quantity: 1, unit: 'L' },
            { name: 'Zinc', quantity: 0.9, unit: 'kg' }
        ]
    },
    {
        tankKey: 'tank-b',
        tankName: 'Tank B (Ferti B)',
        tankType: 'fertilizer',
        capacityLiters: 1000,
        waterLiters: 1000,
        expectedFeedingsPerBatch: 2,
        ingredients: [
            { name: 'Mono Potassium Phosphate', quantity: 12, unit: 'kg' },
            { name: 'Magnesium Sulphate', quantity: 13, unit: 'kg' }
        ]
    },
    {
        tankKey: 'mixer-a',
        tankName: 'Mixer A (EC Booster)',
        tankType: 'mixer',
        capacityLiters: 1000,
        waterLiters: 100,
        expectedFeedingsPerBatch: 3,
        ingredients: [
            { name: 'Amino Acid (EC 1.6)', quantity: 15, unit: 'L' }
        ]
    },
    {
        tankKey: 'mixer-b',
        tankName: 'Mixer B (pH Regulator)',
        tankType: 'acid',
        capacityLiters: 1000,
        waterLiters: 70,
        expectedFeedingsPerBatch: 1,
        ingredients: [
            { name: 'Sulphuric Acid (pH 4.8)', quantity: 10, unit: 'L' }
        ]
    }
];

const DEFAULT_RECIPE_TANKS_GE: RecipeTankConfig[] = [
    {
        tankKey: 'tank-a',
        tankName: 'ავზი A (სასუქი A)',
        tankType: 'fertilizer',
        capacityLiters: 1000,
        waterLiters: 1000,
        expectedFeedingsPerBatch: 1,
        ingredients: [
            { name: 'კალიუმის სულფატი', quantity: 23, unit: 'kg' },
            { name: 'ამონიუმის სულფატი', quantity: 23, unit: 'kg' },
            { name: 'ბორი', quantity: 1, unit: 'L' },
            { name: 'თუთია', quantity: 0.9, unit: 'kg' }
        ]
    },
    {
        tankKey: 'tank-b',
        tankName: 'ავზი B (სასუქი B)',
        tankType: 'fertilizer',
        capacityLiters: 1000,
        waterLiters: 1000,
        expectedFeedingsPerBatch: 2,
        ingredients: [
            { name: 'მონოკალიუმი', quantity: 12, unit: 'kg' },
            { name: 'მაგნიუმის სულფატი', quantity: 13, unit: 'kg' }
        ]
    },
    {
        tankKey: 'mixer-a',
        tankName: 'მიქსერი A (EC ბუსტერი)',
        tankType: 'mixer',
        capacityLiters: 1000,
        waterLiters: 100,
        expectedFeedingsPerBatch: 3,
        ingredients: [
            { name: 'ამინომჟავა (EC 1.6)', quantity: 15, unit: 'L' }
        ]
    },
    {
        tankKey: 'mixer-b',
        tankName: 'მიქსერი B (pH რეგულატორი)',
        tankType: 'acid',
        capacityLiters: 1000,
        waterLiters: 70,
        expectedFeedingsPerBatch: 1,
        ingredients: [
            { name: 'გოგირდმჟავა (pH 4.8)', quantity: 10, unit: 'L' }
        ]
    }
];

const NutritionPlanModal: React.FC<NutritionPlanModalProps> = ({ isOpen, onClose, onSave, plan, materials }) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const defaultTanks = isKa ? DEFAULT_RECIPE_TANKS_GE : DEFAULT_RECIPE_TANKS_EN;

    const [recipeMethod, setRecipeMethod] = useState<'standard' | 'system_feeding_tanks'>(
        plan?.recipeType || (plan?.tankConfigs && plan.tankConfigs.length > 0 ? 'system_feeding_tanks' : 'system_feeding_tanks')
    );

    const [formState, setFormState] = useState<Omit<NutritionPlan, 'id'>>({
        name: plan?.name || '',
        elements: plan?.elements.length ? plan.elements : [{ inventoryItemId: '', quantity: 0, unit: 'kg/1000L' }],
        purpose: plan?.purpose || 'Feeding',
        startDate: plan?.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : undefined,
        endDate: plan?.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : undefined,
        frequency: plan?.frequency || (isKa ? 'სტანდარტული კვების ციკლი' : 'Standard Feeding Cycle'),
        targetWaterLiters: plan?.targetWaterLiters || 1000,
        targetEC: plan?.targetEC !== undefined ? plan.targetEC : 1.6,
        targetPH: plan?.targetPH !== undefined ? plan.targetPH : 4.8,
        recipeType: plan?.recipeType || 'system_feeding_tanks',
        tankConfigs: plan?.tankConfigs && plan.tankConfigs.length > 0 ? plan.tankConfigs : defaultTanks
    });

    const [activeTanks, setActiveTanks] = useState<RecipeTankConfig[]>(
        plan?.tankConfigs && plan.tankConfigs.length > 0 ? plan.tankConfigs : defaultTanks
    );

    const availableMaterials = useMemo(() => {
        if (formState.purpose === 'Treatment') {
            return materials.filter(m => m.category === 'Pesticides' || m.category === 'Fertilizers');
        }
        return materials.filter(m => m.category === 'Fertilizers' || m.category === 'Pesticides' || !m.category);
    }, [materials, formState.purpose]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || undefined : value }));
    };

    // Standard elements handling
    const handleElementChange = (index: number, field: keyof PlanElement, value: string | number | undefined) => {
        const newElements = [...formState.elements];
        (newElements[index] as any)[field] = value;

        if (field === 'inventoryItemId' && value !== 'new-item') {
            const item = materials.find(m => m.id === value);
            newElements[index].newItemName = item?.name;
        }

        setFormState(prev => ({ ...prev, elements: newElements }));
    };

    const addElement = () => {
        setFormState(prev => ({ ...prev, elements: [...prev.elements, { inventoryItemId: '', quantity: 0, unit: 'kg/1000L' }] }));
    };

    const removeElement = (index: number) => {
        setFormState(prev => ({ ...prev, elements: prev.elements.filter((_, i) => i !== index) }));
    };

    // Multi-Tank Management Handlers
    const handleTankFieldChange = (tankIndex: number, field: keyof RecipeTankConfig, value: any) => {
        setActiveTanks(prev => {
            const updated = [...prev];
            updated[tankIndex] = { ...updated[tankIndex], [field]: value };
            return updated;
        });
    };

    const handleAddTank = () => {
        const newTank: RecipeTankConfig = {
            tankKey: `tank-custom-${Date.now()}`,
            tankName: isKa ? `ავზი ${String.fromCharCode(65 + activeTanks.length)}` : `Tank ${String.fromCharCode(65 + activeTanks.length)}`,
            tankType: 'fertilizer',
            capacityLiters: 1000,
            waterLiters: 1000,
            expectedFeedingsPerBatch: 1,
            ingredients: [
                { name: '', quantity: 10, unit: 'kg' }
            ]
        };
        setActiveTanks(prev => [...prev, newTank]);
    };

    const handleDeleteTank = (tankIndex: number) => {
        if (activeTanks.length <= 1) {
            alert(isKa ? 'რეცეპტში მინიმუმ ერთი ავზი უნდა იყოს.' : 'Recipe must have at least one tank.');
            return;
        }
        setActiveTanks(prev => prev.filter((_, i) => i !== tankIndex));
    };

    const handleAddTankIngredient = (tankIndex: number) => {
        setActiveTanks(prev => {
            const updated = [...prev];
            updated[tankIndex] = {
                ...updated[tankIndex],
                ingredients: [...updated[tankIndex].ingredients, { name: '', quantity: 1, unit: 'kg' }]
            };
            return updated;
        });
    };

    const handleUpdateTankIngredient = (tankIndex: number, ingIndex: number, field: keyof RecipeTankIngredient, value: any) => {
        setActiveTanks(prev => {
            const updated = [...prev];
            const ingredients = [...updated[tankIndex].ingredients];
            
            if (field === 'inventoryItemId') {
                const item = materials.find(m => m.id === value);
                ingredients[ingIndex] = {
                    ...ingredients[ingIndex],
                    inventoryItemId: value,
                    name: item ? item.name : ingredients[ingIndex].name
                };
            } else {
                ingredients[ingIndex] = {
                    ...ingredients[ingIndex],
                    [field]: value
                };
            }

            updated[tankIndex] = { ...updated[tankIndex], ingredients };
            return updated;
        });
    };

    const handleRemoveTankIngredient = (tankIndex: number, ingIndex: number) => {
        setActiveTanks(prev => {
            const updated = [...prev];
            const ingredients = updated[tankIndex].ingredients.filter((_, i) => i !== ingIndex);
            updated[tankIndex] = { ...updated[tankIndex], ingredients };
            return updated;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let finalElements: PlanElement[] = formState.elements;
        if (recipeMethod === 'system_feeding_tanks') {
            finalElements = activeTanks.flatMap(tank => 
                tank.ingredients.map(ing => {
                    const matched = materials.find(m => m.id === ing.inventoryItemId || m.name.toLowerCase() === ing.name.toLowerCase());
                    return {
                        inventoryItemId: matched?.id || ing.inventoryItemId || 'new-item',
                        newItemName: ing.name,
                        quantity: ing.quantity,
                        unit: (ing.unit === 'kg' ? 'kg/1000L' : ing.unit === 'L' ? 'L/1000L' : 'g/1000L') as any,
                        stockDeduction: ing.quantity
                    };
                })
            );
        }

        onSave({
            id: plan?.id || `plan-${Date.now()}`,
            ...formState,
            recipeType: recipeMethod,
            tankConfigs: recipeMethod === 'system_feeding_tanks' ? activeTanks : undefined,
            elements: finalElements
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[5000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 text-[10px] font-black uppercase tracking-widest">
                                {isKa ? 'აგრონომიული რეცეპტი' : 'Agronomy Purpose & Recipe'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-black uppercase tracking-widest">
                                {isKa ? 'ავზების მართვა' : 'Multi-Tank Precision'}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black mt-1 tracking-tight">
                            {plan ? (isKa ? 'კვების გეგმის (რეცეპტის) რედაქტირება' : 'Edit Nutrition Purpose') : (isKa ? 'ახალი კვების გეგმის (რეცეპტის) შექმნა' : 'Create New Nutrition Purpose')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar text-sm">
                        
                        {/* Recipe Method Selector */}
                        <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={() => setRecipeMethod('system_feeding_tanks')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                    recipeMethod === 'system_feeding_tanks'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <SparklesIcon className="w-4 h-4" /> 🚜 {isKa ? 'ავზების მიხედვით (A+B+Mix)' : 'System Feeding & Tanks (A+B+Mix)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecipeMethod('standard')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                    recipeMethod === 'standard'
                                        ? 'bg-slate-800 text-white shadow-lg'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <BeakerIcon className="w-4 h-4" /> 📋 {isKa ? 'მარტივი პირდაპირი სია' : 'Standard Direct Recipe'}
                            </button>
                        </div>

                        {/* Top Metadata Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="sm:col-span-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'რეცეპტის სახელი' : 'Purpose Name'} <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    name="name" 
                                    value={formState.name} 
                                    onChange={handleChange} 
                                    placeholder={isKa ? "მაგ. მოსავლის შემდგომი კვება #01" : "e.g. Post-Harvest Blueberry Nutrition #01"} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                                    required 
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'დანიშნულება' : 'Category / Purpose'}
                                </label>
                                <select 
                                    name="purpose" 
                                    value={formState.purpose} 
                                    onChange={handleChange} 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                                >
                                    <option value="Feeding">{isKa ? 'კვება (სასუქი)' : 'Feeding'}</option>
                                    <option value="Treatment">{isKa ? 'წამლობა (დაცვა)' : 'Treatment'}</option>
                                    <option value="Irrigation">{isKa ? 'მორწყვა' : 'Irrigation'}</option>
                                    <option value="Other">{isKa ? 'სხვა' : 'Other'}</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    {isKa ? 'სამიზნე წყალი (ლიტრი)' : 'Target Water (Liters)'}
                                </label>
                                <input 
                                    name="targetWaterLiters" 
                                    type="number" 
                                    value={formState.targetWaterLiters || ''} 
                                    onChange={handleChange} 
                                    placeholder="1000"
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                                />
                            </div>
                        </div>

                        {/* Agronomic Target Quality Parameters (EC & pH) */}
                        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-indigo-900 block mb-1">
                                    {isKa ? 'სამიზნე EC (ელექტროგამტარობა)' : 'Target EC'}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        name="targetEC" 
                                        type="number" 
                                        step="0.05" 
                                        value={formState.targetEC !== undefined ? formState.targetEC : ''} 
                                        onChange={handleChange} 
                                        placeholder="1.6"
                                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-black text-indigo-900" 
                                    />
                                    <span className="text-xs font-bold text-indigo-600">mS/cm</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-indigo-900 block mb-1">
                                    {isKa ? 'სამიზნე pH (მჟავიანობა)' : 'Target pH'}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        name="targetPH" 
                                        type="number" 
                                        step="0.05" 
                                        value={formState.targetPH !== undefined ? formState.targetPH : ''} 
                                        onChange={handleChange} 
                                        placeholder="4.8"
                                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-black text-indigo-900" 
                                    />
                                    <span className="text-xs font-bold text-indigo-600">pH</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-indigo-900 block mb-1">
                                    {isKa ? 'სიხშირე' : 'Frequency'}
                                </label>
                                <input 
                                    name="frequency" 
                                    type="text" 
                                    value={formState.frequency || ''} 
                                    onChange={handleChange} 
                                    placeholder={isKa ? "მაგ. კვირაში 2-ჯერ" : "e.g. 2 times per week"} 
                                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-medium text-indigo-900" 
                                />
                            </div>
                        </div>

                        {/* MULTI-TANK CONFIGURATION MODE */}
                        {recipeMethod === 'system_feeding_tanks' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                            <BeakerIcon className="w-5 h-5 text-indigo-600" />
                                            {isKa ? 'ავზების კონფიგურაცია და კვებების კალიბრაცია' : 'Multi-Tank Dissolving Scheme & Feedings Calibration'}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            {isKa 
                                                ? 'განსაზღვრეთ თითოეულ ავზში გახსნის პროპორცია 1000ლ წყალზე და რამდენი კვებისთვისაა გათვლილი 1 პარტია.'
                                                : 'Define the dissolving ratio per 1000L water in each tank and specify how many feedings 1 batch covers.'}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddTank}
                                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                        <PlusIcon className="w-4 h-4" /> {isKa ? '+ ავზის დამატება' : '+ Add Tank'}
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {activeTanks.map((tank, tankIdx) => {
                                        return (
                                            <div 
                                                key={tank.tankKey || tankIdx} 
                                                className="bg-white border-2 border-slate-200 hover:border-indigo-200 rounded-3xl p-5 shadow-sm space-y-4 transition-all"
                                            >
                                                {/* Tank Header Row */}
                                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                                    <div className="flex flex-wrap items-center gap-2 flex-1">
                                                        <input
                                                            type="text"
                                                            value={tank.tankName}
                                                            onChange={e => handleTankFieldChange(tankIdx, 'tankName', e.target.value)}
                                                            className="text-sm font-black text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 w-60"
                                                            placeholder={isKa ? "ავზის სახელი" : "Tank Name"}
                                                        />
                                                        <select
                                                            value={tank.tankType}
                                                            onChange={e => handleTankFieldChange(tankIdx, 'tankType', e.target.value)}
                                                            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-700 cursor-pointer"
                                                        >
                                                            <option value="fertilizer">{isKa ? 'სასუქის ავზი' : 'Fertilizer Tank'}</option>
                                                            <option value="mixer">{isKa ? 'EC ბუსტერი / მიქსერი' : 'EC Booster / Mixer'}</option>
                                                            <option value="acid">{isKa ? 'pH მჟავის ავზი' : 'pH Acid Tank'}</option>
                                                            <option value="custom">{isKa ? 'ინდივიდუალური / სხვა' : 'Custom Injection'}</option>
                                                        </select>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {/* Capacity & Water Volume */}
                                                        <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 text-xs">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">{isKa ? 'წყალი:' : 'Water:'}</span>
                                                            <input
                                                                type="number"
                                                                value={tank.waterLiters}
                                                                onChange={e => handleTankFieldChange(tankIdx, 'waterLiters', parseFloat(e.target.value) || 0)}
                                                                className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-0.5 font-black text-slate-800 text-center"
                                                            />
                                                            <span className="font-bold text-slate-600">{isKa ? 'ლ' : 'L'}</span>
                                                        </div>

                                                        {/* Feedings Calibration */}
                                                        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                                                            <span className="text-[10px] font-black uppercase text-emerald-700">{isKa ? 'კვება:' : 'Feedings:'}</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="20"
                                                                step="0.5"
                                                                value={tank.expectedFeedingsPerBatch || 1}
                                                                onChange={e => handleTankFieldChange(tankIdx, 'expectedFeedingsPerBatch', parseFloat(e.target.value) || 1)}
                                                                className="w-14 bg-white border border-emerald-300 rounded-lg px-1.5 py-0.5 font-black text-emerald-800 text-center"
                                                            />
                                                            <span className="font-black text-[10px] uppercase text-emerald-700">{isKa ? 'ჯერ' : 'Runs'}</span>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteTank(tankIdx)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                                            title={isKa ? "ავზის წაშლა" : "Delete Tank"}
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Tank Ingredients Table */}
                                                <div className="space-y-2">
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 grid grid-cols-12 gap-2 px-2">
                                                        <span className="col-span-6">{isKa ? 'სასუქი / პრეპარატი' : 'Fertilizer / Chemical Input'}</span>
                                                        <span className="col-span-3 text-center">{isKa ? 'რაოდენობა' : 'Batch Quantity'}</span>
                                                        <span className="col-span-2 text-center">{isKa ? 'ერთეული' : 'Unit'}</span>
                                                        <span className="col-span-1"></span>
                                                    </div>

                                                    {tank.ingredients.map((ing, ingIdx) => (
                                                        <div key={ingIdx} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-2xl border border-slate-100">
                                                            <div className="col-span-6">
                                                                <input
                                                                    type="text"
                                                                    list={`materials-list-${tankIdx}-${ingIdx}`}
                                                                    value={ing.name}
                                                                    onChange={e => handleUpdateTankIngredient(tankIdx, ingIdx, 'name', e.target.value)}
                                                                    placeholder={isKa ? "მაგ. კალიუმის სულფატი" : "e.g. Potassium Sulphate"}
                                                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                                    required
                                                                />
                                                                <datalist id={`materials-list-${tankIdx}-${ingIdx}`}>
                                                                    {availableMaterials.map(m => (
                                                                        <option key={m.id} value={m.name}>
                                                                            {m.name} ({m.category || 'Fertilizer'})
                                                                        </option>
                                                                    ))}
                                                                </datalist>
                                                            </div>

                                                            <div className="col-span-3">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={ing.quantity}
                                                                    onChange={e => handleUpdateTankIngredient(tankIdx, ingIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 text-center"
                                                                    required
                                                                />
                                                            </div>

                                                            <div className="col-span-2">
                                                                <select
                                                                    value={ing.unit}
                                                                    onChange={e => handleUpdateTankIngredient(tankIdx, ingIdx, 'unit', e.target.value)}
                                                                    className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-700 text-center cursor-pointer"
                                                                >
                                                                    <option value="kg">{isKa ? 'კგ' : 'kg'}</option>
                                                                    <option value="L">{isKa ? 'ლ' : 'L'}</option>
                                                                    <option value="g">{isKa ? 'გ' : 'g'}</option>
                                                                    <option value="mL">{isKa ? 'მლ' : 'mL'}</option>
                                                                </select>
                                                            </div>

                                                            <div className="col-span-1 flex justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveTankIngredient(tankIdx, ingIdx)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddTankIngredient(tankIdx)}
                                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1 px-2 cursor-pointer"
                                                    >
                                                        <PlusIcon className="w-3.5 h-3.5" /> {isKa ? `+ ინგრედიენტის დამატება (${tank.tankName})` : `Add Ingredient to ${tank.tankName}`}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* STANDARD DIRECT RECIPE MODE */}
                        {recipeMethod === 'standard' && (
                            <div className="border-t pt-4">
                                <h3 className="font-bold text-slate-800 mb-2">{isKa ? 'რეცეპტის ინგრედიენტები (პირდაპირი სია)' : 'Recipe Ingredients (Direct List)'}</h3>
                                <div className="space-y-2">
                                    {formState.elements.map((el, index) => (
                                        <div key={index} className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                                            <div className="grid grid-cols-12 gap-2 items-end">
                                                <div className="col-span-5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500">{isKa ? 'სასუქი / პრეპარატი' : 'Material'}</label>
                                                    <select 
                                                        value={el.inventoryItemId} 
                                                        onChange={e => handleElementChange(index, 'inventoryItemId', e.target.value)} 
                                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer" 
                                                        required
                                                    >
                                                        <option value="">{isKa ? 'აირჩიეთ სასუქი' : 'Select Item'}</option>
                                                        {availableMaterials.map(f => (
                                                            <option key={f.id} value={f.id}>{f.name} ({f.category})</option>
                                                        ))}
                                                        <option value="new-item">-- {isKa ? '+ ახალი მასალის დამატება' : 'Add Custom / New Item'} --</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500">{isKa ? 'დოზა' : 'Dose'}</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={el.quantity} 
                                                        onChange={e => handleElementChange(index, 'quantity', parseFloat(e.target.value) || 0)} 
                                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-center" 
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="text-[10px] font-black uppercase text-slate-500">{isKa ? 'ერთეული / ბაზა' : 'Unit / Basis'}</label>
                                                    <select 
                                                        value={el.unit} 
                                                        onChange={e => handleElementChange(index, 'unit', e.target.value)} 
                                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer"
                                                    >
                                                        <option value="kg/1000L">{isKa ? 'კგ / 1000ლ წყალზე' : 'kg/1000L Water'}</option>
                                                        <option value="L/1000L">{isKa ? 'ლ / 1000ლ წყალზე' : 'L/1000L Water'}</option>
                                                        <option value="g/1000L">{isKa ? 'გ / 1000ლ წყალზე' : 'g/1000L Water'}</option>
                                                        <option value="kg/ha">{isKa ? 'კგ / ჰა' : 'kg/ha'}</option>
                                                        <option value="L/ha">{isKa ? 'ლ / ჰა' : 'L/ha'}</option>
                                                        <option value="kg">{isKa ? 'კგ (სულ)' : 'kg (Total)'}</option>
                                                        <option value="L">{isKa ? 'ლ (სულ)' : 'L (Total)'}</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeElement(index)} 
                                                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-xl transition-all cursor-pointer"
                                                    >
                                                        <TrashIcon className="h-4 w-4"/>
                                                    </button>
                                                </div>
                                            </div>
                                            {el.inventoryItemId === 'new-item' && (
                                                <div className="mt-1">
                                                    <label className="text-[10px] font-bold text-slate-600">{isKa ? 'ახალი მასალის სახელი' : 'New Item Name'}</label>
                                                    <input 
                                                        type="text" 
                                                        value={el.newItemName || ''} 
                                                        onChange={e => handleElementChange(index, 'newItemName', e.target.value)} 
                                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold" 
                                                        placeholder={isKa ? "შეიყვანეთ დასახელება..." : "Enter material name..."} 
                                                        required 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    type="button" 
                                    onClick={addElement} 
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2 cursor-pointer"
                                >
                                    <PlusIcon className="h-4 w-4"/> {isKa ? '+ ინგრედიენტის დამატება' : 'Add Ingredient'}
                                </button>
                            </div>
                        )}

                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                            {isKa ? 'გაუქმება' : 'Cancel'}
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            {plan ? (isKa ? 'შენახვა' : 'Save Changes') : (isKa ? 'რეცეპტის შექმნა' : 'Create Purpose')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NutritionPlanModal;
