import {isLocalRuntime,localSession} from '../local/runtime';
import React, { useState } from 'react';
import type { User, Organization, Membership, OrganizationType, AgricultureType } from '../types';
import { XIcon, BuildingStorefrontIcon } from './Icons';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export interface CreateOrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User | null;
    onAddOrg?: (org: Organization, mem: Membership, selectedCrops?: any[]) => void;
    onSwitchOrg?: (orgId: string) => void;
    onUpdateUser?: (user: User) => void;
    onStartMapRegistration?: (data: { name: string; crops?: string[]; area?: number }) => void;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
    isOpen,
    onClose,
    user,
    onAddOrg,
    onSwitchOrg,
    onUpdateUser,
    onStartMapRegistration
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const effectiveUser: User = user || ({
        id: 'guest-planner',
        name: isKa ? 'ფერმერი / დამგეგმავი' : 'Field Planner',
        email: '',
        roles: ['Founder']
    } as unknown as User);

    const [cloudOrgId,setCloudOrgId]=useState(()=>`org-${crypto.randomUUID()}`);
    const [name, setName] = useState('');
    const [taxNumber, setTaxNumber] = useState('');
    const [type, setType] = useState<OrganizationType>('LTD');
    const [agricultureType, setAgricultureType] = useState<AgricultureType>('General');
    const [region, setRegion] = useState(effectiveUser.region || 'Kakheti');
    const [phone, setPhone] = useState(effectiveUser.phone || '');
    const [area, setArea] = useState('5');
    const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
    const [customCropInput, setCustomCropInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error(isKa ? "გთხოვთ შეიყვანოთ კომპანიის ოფიციალური სახელი." : "Please enter a legal company name.");
            return;
        }

        setIsSubmitting(true);
        try {
            const orgId = isLocalRuntime?localSession().farm.id:cloudOrgId;
            const newOrg: Organization = {
                id: orgId,
                uniqueId: `Comp-${Math.floor(1000 + Math.random() * 9000)}`,
                name: name.trim(),
                legalName: name.trim(),
                registrationNumber: taxNumber.trim(),
                taxNumber: taxNumber.trim(),
                type,
                agricultureType,
                region: region.trim(),
                areaHa: Number(area) || 0,
                phoneNumber: phone.trim() || effectiveUser.phone || '',
                email: effectiveUser.email || '',
                isDiscoverable: true,
                status: 'active',
                createdAt: new Date().toISOString(),
                createdBy: effectiveUser.id || 'owner',
                subscriptionStatus: 'Trial',
                trial_start_date: new Date().toISOString(),
                trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                isPaid: false,
                tier: 'Free',
                country: 'Georgia',
                crops: selectedCrops,
                plantationCrops: selectedCrops
            };

            const newMem: Membership = {
                id: `${effectiveUser.id || 'user'}_${orgId}`,
                userId: effectiveUser.id || 'owner',
                organizationId: orgId,
                role: 'Founder',
                status: 'active',
                joinedAt: new Date().toISOString(),
                permissionLevel: 'admin'
            };

            if (onAddOrg) {
                await onAddOrg(newOrg, newMem, selectedCrops);
            }

            if (onSwitchOrg) {
                onSwitchOrg(orgId);
            }

            if (onUpdateUser && user) {
                onUpdateUser({
                    ...user,
                    primaryGoal: 'MANAGE_COMPANY',
                    roles: (user.roles || []).includes('Founder') ? user.roles : [...(user.roles || []), 'Founder']
                });
            }

            setCloudOrgId(`org-${crypto.randomUUID()}`);
            toast.success(isKa ? `კომპანია "${newOrg.name}" წარმატებით დარეგისტრირდა!` : `Organization "${newOrg.name}" created successfully!`);
            onClose();
        } catch (err: any) {
            console.error("Create organization failed:", err);
            toast.error(isKa ? "რეგისტრაცია ვერ მოხერხდა: " + (err?.message || "შეცდომა") : "Failed to create organization: " + (err?.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <BuildingStorefrontIcon size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                {isKa ? 'კომპანიის რეგისტრაცია' : 'Register Organization'}
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {isKa ? 'აგრო საწარმოს პროფილი და რეგისტრაცია' : 'Establish your agricultural enterprise'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <XIcon className="h-6 w-6 text-slate-400"/>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5 flex-grow overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                {isKa ? 'კომპანიის ოფიციალური სახელი *' : 'Legal Company Name *'}
                            </label>
                            <input 
                                required
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder={isKa ? "მაგ. ალაზნის აგრო შპს" : "e.g. Alazani Agro LLC"} 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                {isKa ? 'საიდენტიფიკაციო კოდი / საგადასახადო ID' : 'Tax ID / Identification No.'}
                            </label>
                            <input 
                                value={taxNumber} 
                                onChange={e => setTaxNumber(e.target.value)} 
                                placeholder="e.g. 405123456" 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                {isKa ? 'სამართლებრივი ფორმა' : 'Legal Form / Structure'}
                            </label>
                            <select 
                                value={type} 
                                onChange={e => setType(e.target.value as OrganizationType)} 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="LTD">LTD (შპს)</option>
                                <option value="Cooperative">Cooperative (კოოპერატივი)</option>
                                <option value="Individual Entrepreneur">Individual Entrepreneur (ინდ. მეწარმე)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                {isKa ? 'ძირითადი სასოფლო-სამეურნეო პროფილი' : 'Primary Agricultural Profile'}
                            </label>
                            <select 
                                value={agricultureType} 
                                onChange={e => setAgricultureType(e.target.value as AgricultureType)} 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="General">{isKa ? 'ზოგადი მეურნეობა' : 'General Agriculture'}</option>
                                <option value="Vineyard">{isKa ? 'ვენახი და მევენახეობა' : 'Vineyard & Viticulture (ვენახი)'}</option>
                                <option value="Orchard">{isKa ? 'ხილის ბაღი / პლანტაცია' : 'Orchard & Fruits (ხილის ბაღი)'}</option>
                                <option value="Greenhouse">{isKa ? 'სასათბურე მეურნეობა' : 'Greenhouse Complex (სათბური)'}</option>
                                <option value="Livestock">{isKa ? 'მეცხოველეობა' : 'Livestock / Animal Farming (მეცხოველეობა)'}</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                {isKa ? 'რეგიონი' : 'Region'}
                            </label>
                            <input 
                                value={region} 
                                onChange={e => setRegion(e.target.value)} 
                                placeholder="e.g. Kakheti, Guria" 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                {isKa ? 'ფართობი (ჰექტარი)' : 'Land Area (Hectares)'}
                            </label>
                            <input 
                                type="number"
                                step="0.1"
                                value={area} 
                                onChange={e => setArea(e.target.value)} 
                                placeholder="e.g. 12.5" 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                {isKa ? 'საკონტაქტო ტელეფონი' : 'Official Phone'}
                            </label>
                            <input 
                                value={phone} 
                                onChange={e => setPhone(e.target.value)} 
                                placeholder="+995 5..." 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        </div>
                    </div>

                    {/* Multi-Crop Selection for Plantation */}
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">
                                    Plantation Crops (Multi-Select)
                                </label>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Choose one or multiple crops (e.g. Apple & Lemons, Blueberry & Strawberry). If you forget now, you can easily change or add crops anytime in the Map Planner under company!
                                </p>
                            </div>
                        </div>

                        {/* Selected chips */}
                        {selectedCrops.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 p-2.5 bg-white border border-emerald-200/80 rounded-xl">
                                {selectedCrops.map(c => (
                                    <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100/90 text-emerald-800 rounded-lg text-xs font-bold">
                                        🌱 {c}
                                        <button 
                                            type="button" 
                                            onClick={() => setSelectedCrops(prev => prev.filter(x => x !== c))}
                                            className="text-emerald-600 hover:text-red-500 cursor-pointer"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Quick toggle popular crops */}
                        <div className="flex flex-wrap gap-1.5">
                            {['Apple', 'Lemons', 'Blueberries', 'Strawberries', 'Peaches', 'Grapes', 'Hazelnuts', 'Walnuts', 'Cherries', 'Raspberries', 'Blackberries'].map(c => {
                                const isSelected = selectedCrops.includes(c);
                                return (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => {
                                            if (isSelected) {
                                                setSelectedCrops(prev => prev.filter(x => x !== c));
                                            } else {
                                                setSelectedCrops(prev => [...prev, c]);
                                            }
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        {isSelected ? '✓ ' : '+ '} {c}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom crop adder */}
                        <div className="flex gap-2">
                            <input 
                                value={customCropInput}
                                onChange={e => setCustomCropInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (customCropInput.trim() && !selectedCrops.includes(customCropInput.trim())) {
                                            setSelectedCrops(prev => [...prev, customCropInput.trim()]);
                                            setCustomCropInput('');
                                        }
                                    }
                                }}
                                placeholder="Add another crop (e.g. Mandarin, Plum, Almond)..."
                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    if (customCropInput.trim() && !selectedCrops.includes(customCropInput.trim())) {
                                        setSelectedCrops(prev => [...prev, customCropInput.trim()]);
                                        setCustomCropInput('');
                                    }
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-100">
                        {onStartMapRegistration ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!name.trim()) {
                                        toast.error(isKa ? "გთხოვთ შეიყვანოთ კომპანიის სახელი" : "Please enter company name");
                                        return;
                                    }
                                    onStartMapRegistration({
                                        name: name.trim(),
                                        crops: selectedCrops,
                                        area: Number(area) || undefined
                                    });
                                    onClose();
                                }}
                                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                title={isKa ? "საზღვრის მოხაზვა რუკაზე" : "Draw boundary on map"}
                            >
                                <span>{isKa ? '🗺️ საზღვრის მოხაზვა რუკაზე' : '🗺️ Draw on Map'}</span>
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-2">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                            >
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? (isKa ? 'რეგისტრაცია...' : 'Creating...') : (isKa ? 'კომპანიის რეგისტრაცია' : 'Register Enterprise')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateOrganizationModal;
