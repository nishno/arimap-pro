import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase';
import type { Crop, Organization } from '../types';
import { XIcon, PlusIcon, TrashIcon, CheckIcon, LeafIcon } from './Icons';
import { toast } from 'sonner';
import { handleFirestoreError } from '../lib/firebaseUtils';

export interface CropManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    crops: Crop[];
    organizationId: string;
    organization?: Organization | null;
    onUpdateOrganization?: (org: Organization) => void;
    initialTab?: 'crops' | 'plantation';
    isKa?: boolean;
}

export const POPULAR_PLANTATION_CROPS = [
    { en: 'Apple', ka: 'ვაშლი', icon: '🍎' },
    { en: 'Lemon', ka: 'ლიმონი', icon: '🍋' },
    { en: 'Blueberry', ka: 'მოცვი', icon: '🫐' },
    { en: 'Strawberry', ka: 'მარწყვი', icon: '🍓' },
    { en: 'Raspberry', ka: 'ჟოლო', icon: '🍇' },
    { en: 'Blackberry', ka: 'მაყვალი', icon: '🫐' },
    { en: 'Hazelnut', ka: 'თხილი', icon: '🌰' },
    { en: 'Peach', ka: 'ატამი', icon: '🍑' },
    { en: 'Grape', ka: 'ყურძენი', icon: '🍇' },
    { en: 'Walnut', ka: 'კაკალი', icon: '🥜' },
    { en: 'Almond', ka: 'ნუში', icon: '🌱' },
    { en: 'Citrus', ka: 'ციტრუსი', icon: '🍊' },
    { en: 'Cherry', ka: 'ბალი', icon: '🍒' },
    { en: 'Plum', ka: 'ქლიავი', icon: '🫐' },
];

export const formatPlantationCrops = (crops?: string[], isKa: boolean = false): string => {
    if (!crops || crops.length === 0) {
        return isKa ? 'პლანტაციის კულტურა: არჩეული არ არის' : 'Plantation Crops: Not Selected';
    }
    if (crops.length === 1) {
        return isKa ? `პლანტაცია: (${crops[0]})` : `Plantation of (${crops[0]})`;
    }
    if (crops.length === 2) {
        const joiner = isKa ? ' და ' : ' and ';
        return isKa ? `პლანტაცია: (${crops[0]}${joiner}${crops[1]})` : `Plantation of (${crops[0]}${joiner}${crops[1]})`;
    }
    const last = crops[crops.length - 1];
    const initial = crops.slice(0, crops.length - 1).join(', ');
    const joiner = isKa ? ' და ' : ' and ';
    return isKa ? `პლანტაცია: (${initial}${joiner}${last})` : `Plantation of (${initial}${joiner}${last})`;
};

const CropManagementModal: React.FC<CropManagementModalProps> = ({ 
    isOpen, 
    onClose, 
    crops, 
    organizationId,
    organization,
    onUpdateOrganization,
    initialTab = 'plantation',
    isKa = false
}) => {
    const [activeTab, setActiveTab] = useState<'plantation' | 'catalog'>(initialTab === 'crops' ? 'catalog' : 'plantation');
    
    // Plantation multi-crop selection state
    const [selectedPlantationCrops, setSelectedPlantationCrops] = useState<string[]>([]);
    const [customCropInput, setCustomCropInput] = useState('');
    const [isSavingPlantation, setIsSavingPlantation] = useState(false);

    // Catalog state
    const [isAdding, setIsAdding] = useState(false);
    const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
    const [newCropName, setNewCropName] = useState('');
    const [newVarieties, setNewVarieties] = useState<string[]>([]);
    const [currentVarietyInput, setCurrentVarietyInput] = useState('');

    useEffect(() => {
        if (organization) {
            const existing = organization.plantationCrops || organization.crops || [];
            setSelectedPlantationCrops(existing);
        }
    }, [organization]);

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab === 'crops' ? 'catalog' : 'plantation');
        }
    }, [initialTab]);

    if (!isOpen) return null;

    const toggleCropSelection = (cropName: string) => {
        const trimmed = cropName.trim();
        if (!trimmed) return;
        setSelectedPlantationCrops(prev => {
            const exists = prev.some(c => c.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
                return prev.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
            } else {
                return [...prev, trimmed];
            }
        });
    };

    const handleAddCustomPlantationCrop = () => {
        if (!customCropInput.trim()) return;
        const name = customCropInput.trim();
        toggleCropSelection(name);
        setCustomCropInput('');
    };

    const handleSavePlantationCrops = async () => {
        setIsSavingPlantation(true);
        try {
            if (organizationId) {
                await updateDoc(doc(db, 'organizations', organizationId), {
                    plantationCrops: selectedPlantationCrops,
                    crops: selectedPlantationCrops
                });
            }
            if (organization && onUpdateOrganization) {
                onUpdateOrganization({
                    ...organization,
                    plantationCrops: selectedPlantationCrops,
                    crops: selectedPlantationCrops
                });
            }
            toast.success(isKa 
                ? `პლანტაციის კულტურები განახლდა: ${formatPlantationCrops(selectedPlantationCrops, true)}`
                : `Plantation crops updated: ${formatPlantationCrops(selectedPlantationCrops, false)}`
            );
        } catch (error) {
            console.error("Error saving plantation crops:", error);
            if (organization && onUpdateOrganization) {
                onUpdateOrganization({
                    ...organization,
                    plantationCrops: selectedPlantationCrops,
                    crops: selectedPlantationCrops
                });
            }
            toast.success(isKa ? "პლანტაციის კულტურები განახლდა (ლოკალურად)" : "Plantation crops updated locally");
        } finally {
            setIsSavingPlantation(false);
        }
    };

    const handleSaveCrop = async () => {
        if (!newCropName.trim()) {
            toast.error("Crop name is required");
            return;
        }

        try {
            if (editingCrop) {
                await updateDoc(doc(db, 'crops', editingCrop.id), {
                    name: newCropName.trim(),
                    varieties: newVarieties
                });
                toast.success("Crop updated");
            } else {
                await addDoc(collection(db, 'crops'), {
                    name: newCropName.trim(),
                    varieties: newVarieties,
                    organizationId
                });
                toast.success("Crop added");
                // Also add to selected plantation crops if empty or desired
                if (selectedPlantationCrops.length === 0) {
                    setSelectedPlantationCrops([newCropName.trim()]);
                }
            }
            resetForm();
        } catch (error) {
            handleFirestoreError(error, 'write' as any, 'crops');
        }
    };

    const handleDeleteCrop = async (id: string) => {
        if (!window.confirm("Are you sure? This will remove this crop and its varieties from the system.")) return;
        try {
            await deleteDoc(doc(db, 'crops', id));
            toast.success("Crop deleted");
        } catch (error) {
            handleFirestoreError(error, 'delete' as any, `crops/${id}`);
        }
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingCrop(null);
        setNewCropName('');
        setNewVarieties([]);
        setCurrentVarietyInput('');
    };

    const addVariety = () => {
        if (currentVarietyInput.trim() && !newVarieties.includes(currentVarietyInput.trim())) {
            setNewVarieties([...newVarieties, currentVarietyInput.trim()]);
            setCurrentVarietyInput('');
        }
    };

    const removeVariety = (v: string) => {
        setNewVarieties(newVarieties.filter(item => item !== v));
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[5000] flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
                {/* Modal Header */}
                <div className="p-6 md:p-8 border-b flex justify-between items-center bg-slate-900 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
                            <LeafIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-xl md:text-2xl uppercase tracking-tight">
                                    {isKa ? 'კულტურები & ჯიშები' : 'Crops & Varieties'}
                                </h3>
                                {organization?.name && (
                                    <span className="hidden sm:inline px-2.5 py-0.5 bg-white/10 text-slate-300 text-[10px] font-bold rounded-lg border border-white/10 truncate max-w-[180px]">
                                        {organization.name}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {isKa ? 'პლანტაციის კულტურების არჩევა და ჯიშების მართვა' : 'Choose plantation crops & manage agro varieties'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-white">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Tabs Row */}
                <div className="flex border-b border-slate-100 bg-slate-50 px-6 pt-3 gap-2">
                    <button
                        onClick={() => setActiveTab('plantation')}
                        className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-wider rounded-t-2xl transition-all cursor-pointer ${
                            activeTab === 'plantation'
                                ? 'bg-white text-emerald-600 border-t-2 border-emerald-500 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        <LeafIcon className="w-4 h-4" />
                        <span>{isKa ? 'პლანტაციის კულტურები (მრავალჯერადი)' : 'Plantation Crops (Multi-Select)'}</span>
                        {selectedPlantationCrops.length > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">
                                {selectedPlantationCrops.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('catalog')}
                        className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-wider rounded-t-2xl transition-all cursor-pointer ${
                            activeTab === 'catalog'
                                ? 'bg-white text-blue-600 border-t-2 border-blue-500 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>{isKa ? 'კატალოგი და ჯიშები' : 'Catalog & Varieties'}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full">
                            {crops.length}
                        </span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {activeTab === 'plantation' ? (
                        <div className="space-y-6 animate-slide-up">
                            {/* Live Visibility Preview Banner */}
                            <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-slate-50 border-2 border-emerald-200/80 rounded-[2rem] shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                        {isKa ? 'ხილვადი სხვებისთვის რუკაზე და სისტემაში' : 'Visible for Others on Maps & Directory'}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                        {isKa ? 'ცოცხალი პრევიუ' : 'Live Preview'}
                                    </span>
                                </div>
                                <div className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                                    {formatPlantationCrops(selectedPlantationCrops, isKa)}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                    {isKa 
                                        ? 'ეს აღწერა გამოჩნდება რუკის დამგეგმავში, კომპანიის ბარათზე და პარტნიორებისთვის (მაგ.: პლანტაცია: (ვაშლი და ლიმონი) ან (მოცვი და მარწყვი)).'
                                        : 'This designation is displayed in the Map Planner under company info and on external directory cards (e.g. Plantation of (Apple and Lemons) or (Blueberry and Strawberry)).'}
                                </p>
                            </div>

                            {/* Currently Selected Badges */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {isKa ? 'არჩეული კულტურები' : 'Selected Crops'}: {selectedPlantationCrops.length}
                                    </label>
                                    {selectedPlantationCrops.length > 0 && (
                                        <button 
                                            onClick={() => setSelectedPlantationCrops([])} 
                                            className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider cursor-pointer"
                                        >
                                            {isKa ? 'გასუფთავება' : 'Clear All'}
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 min-h-[44px] p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                                    {selectedPlantationCrops.map(crop => (
                                        <span 
                                            key={crop} 
                                            className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-tight flex items-center gap-2 shadow-sm shadow-emerald-200 animate-in fade-in"
                                        >
                                            <span>{crop}</span>
                                            <button 
                                                onClick={() => toggleCropSelection(crop)} 
                                                className="p-0.5 hover:bg-emerald-700 rounded-full transition-colors cursor-pointer"
                                                title={isKa ? "წაშლა" : "Remove"}
                                            >
                                                <XIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                    {selectedPlantationCrops.length === 0 && (
                                        <span className="text-xs font-bold text-slate-400 italic py-1">
                                            {isKa ? 'არცერთი კულტურა არ არის არჩეული. აირჩიეთ ქვემოთ მოცემული სიიდან ან ჩაწერეთ ახალი.' : 'No crops selected. Pick from the list below or enter a custom one.'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Quick Add Custom Crop Input */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    {isKa ? 'ახალი კულტურის სწრაფი დამატება' : 'Add Custom Crop to Plantation'}
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={customCropInput}
                                        onChange={(e) => setCustomCropInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomPlantationCrop()}
                                        placeholder={isKa ? "ჩაწერეთ კულტურა (მაგ. ლიმონი, კივი, მანდარინი)..." : "Type crop name (e.g. Lemon, Kiwi, Pear)..."}
                                        className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-sm text-slate-800"
                                    />
                                    <button 
                                        onClick={handleAddCustomPlantationCrop}
                                        className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        <span>{isKa ? 'დამატება' : 'Add'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Popular Crops Grid */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                                    {isKa ? 'პოპულარული კულტურები (დააჭირეთ ასარჩევად / მოსახსნელად)' : 'Popular Agricultural Crops (Click to Toggle)'}
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                    {POPULAR_PLANTATION_CROPS.map(item => {
                                        const isSelected = selectedPlantationCrops.some(
                                            c => c.toLowerCase() === item.en.toLowerCase() || c.toLowerCase() === item.ka.toLowerCase()
                                        );
                                        const label = isKa ? item.ka : item.en;
                                        return (
                                            <button
                                                key={item.en}
                                                type="button"
                                                onClick={() => toggleCropSelection(label)}
                                                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm scale-[1.02]'
                                                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                                                    <div className="truncate">
                                                        <div className="font-black text-xs uppercase tracking-tight truncate">{label}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 truncate">{isKa ? item.en : item.ka}</div>
                                                    </div>
                                                </div>
                                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                                                    isSelected ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-transparent'
                                                }`}>
                                                    <CheckIcon className="w-3 h-3 stroke-[3]" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Organization's Registered Catalog Crops (if any) */}
                            {crops.length > 0 && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                                        {isKa ? 'თქვენს კატალოგში არსებული კულტურები' : 'Crops from Your Catalog'}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {crops.map(c => {
                                            const isSelected = selectedPlantationCrops.some(
                                                crop => crop.toLowerCase() === c.name.toLowerCase()
                                            );
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => toggleCropSelection(c.name)}
                                                    className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-tight flex items-center gap-2 cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                                    }`}
                                                >
                                                    <LeafIcon className="w-3.5 h-3.5" />
                                                    <span>{c.name}</span>
                                                    <span className="text-[9px] opacity-75 font-normal">({c.varieties?.length || 0} {isKa ? 'ჯიში' : 'varieties'})</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Action Save Bar */}
                            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleSavePlantationCrops}
                                    disabled={isSavingPlantation}
                                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <CheckIcon className="w-4 h-4" />
                                    <span>
                                        {isSavingPlantation 
                                            ? (isKa ? 'ინახება...' : 'Saving...') 
                                            : (isKa ? 'პლანტაციის კულტურების შენახვა' : 'Save Plantation Crops')}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('catalog')}
                                    className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>{isKa ? 'ჯიშების მართვა' : 'Manage Varieties'}</span>
                                </button>
                            </div>
                        </div>
                    ) : isAdding || editingCrop ? (
                        <div className="space-y-6 animate-slide-up">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Crop Name / კულტურის სახელი</label>
                                <input 
                                    type="text"
                                    value={newCropName}
                                    onChange={(e) => setNewCropName(e.target.value)}
                                    placeholder="e.g. Blueberry, Apple, Lemon / მაგ. მოცვი, ვაშლი, ლიმონი"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Varieties / ჯიშები</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={currentVarietyInput}
                                        onChange={(e) => setCurrentVarietyInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addVariety()}
                                        placeholder="Add variety name / ჯიშის სახელი (მაგ. Legacy, Bluecrop, Eureka)..."
                                        className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold"
                                    />
                                    <button 
                                        onClick={addVariety}
                                        className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all cursor-pointer"
                                    >
                                        <PlusIcon className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {newVarieties.map(v => (
                                        <div key={v} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-center gap-2 group">
                                            <span className="text-sm font-bold uppercase tracking-tight">{v}</span>
                                            <button onClick={() => removeVariety(v)} className="p-1 hover:bg-blue-100 rounded-full transition-colors cursor-pointer">
                                                <TrashIcon className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {newVarieties.length === 0 && (
                                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">No varieties added yet / ჯიშები ჯერ არ არის დამატებული.</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={handleSaveCrop}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all cursor-pointer"
                                >
                                    {editingCrop ? 'Update Crop / განახლება' : 'Save New Crop / შენახვა'}
                                </button>
                                <button 
                                    onClick={resetForm}
                                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                                >
                                    Cancel / გაუქმება
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Crops in Catalog / კატალოგში: {crops.length}</p>
                                    <p className="text-xs text-slate-500 font-medium">Add botanical crops and their varieties to use when mapping seedling trenches.</p>
                                </div>
                                <button 
                                    onClick={() => setIsAdding(true)}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200 active:scale-95 transition-all cursor-pointer"
                                >
                                    <PlusIcon className="h-4 w-4" /> Add Crop / კულტურის დამატება
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {crops.map(crop => {
                                    const isSelectedInPlantation = selectedPlantationCrops.some(
                                        c => c.toLowerCase() === crop.name.toLowerCase()
                                    );
                                    return (
                                        <div key={crop.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:border-blue-200 transition-all group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-3 rounded-2xl shadow-sm ${isSelectedInPlantation ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white text-blue-600'}`}>
                                                        <LeafIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-black text-lg text-slate-800 uppercase tracking-tighter">{crop.name}</h4>
                                                            {isSelectedInPlantation && (
                                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md">
                                                                    {isKa ? 'პლანტაციაშია' : 'In Plantation'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{crop.varieties?.length || 0} Varieties / ჯიში</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => {
                                                            setEditingCrop(crop);
                                                            setNewCropName(crop.name);
                                                            setNewVarieties(crop.varieties || []);
                                                        }}
                                                        className="p-2.5 bg-white text-slate-600 rounded-xl shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100 cursor-pointer"
                                                        title="Edit varieties"
                                                    >
                                                        <PlusIcon className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteCrop(crop.id)}
                                                        className="p-2.5 bg-white text-slate-600 rounded-xl shadow-sm hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100 cursor-pointer"
                                                        title="Delete crop"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {crop.varieties?.map(v => (
                                                    <span key={v} className="px-3 py-1 bg-white text-slate-600 text-[10px] font-bold rounded-lg border border-slate-100 uppercase tracking-tight shadow-2xs">{v}</span>
                                                ))}
                                                {(!crop.varieties || crop.varieties.length === 0) && (
                                                    <span className="text-[10px] text-slate-400 italic">No varieties specified. Click edit to add varieties.</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {crops.length === 0 && (
                                    <div className="text-center py-16 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                                        <LeafIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">No custom crops defined yet / კულტურები არ არის შეყვანილი</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 md:p-8 bg-slate-50 border-t flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest max-w-[320px]">
                        {isKa 
                            ? 'კულტურების და ჯიშების ცვლილებები მყისიერად აისახება რუკის დამგეგმავში და სისტემაში.' 
                            : 'Changes to plantation crops and varieties reflect instantly across Map Planner and team systems.'}
                    </p>
                    <button onClick={onClose} className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all cursor-pointer">
                        {isKa ? 'დახურვა' : 'Close / დახურვა'}
                    </button>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                @keyframes slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default CropManagementModal;
