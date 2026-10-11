import React, { useState } from 'react';
import type { User, Organization, WorkExperience } from '../types';
import { XIcon, PlusIcon, TrashIcon, PlusCircleIcon } from './Icons';

export interface OfferServiceModalProps {
    isOpen: boolean; 
    onClose: () => void; 
    user: User; 
    onUpdateUser: (u: User) => void; 
    organizations: Organization[];
    onUpdateOrg?: (org: Organization) => void;
}

export const OfferServiceModal: React.FC<OfferServiceModalProps> = ({ 
    isOpen, 
    onClose, 
    user, 
    onUpdateUser, 
    organizations = [], 
    onUpdateOrg 
}) => {
    const [services, setServices] = useState<string[]>(user.servicesOffered || []);
    const [customService, setCustomService] = useState('');
    const [experience, setExperience] = useState<WorkExperience[]>(user.cv?.experience || []);
    const [newExp, setNewExp] = useState({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false, description: '' });
    const [region, setRegion] = useState(user.region || '');
    const [availability, setAvailability] = useState(user.availability || 'Available');
    const [showOrgResults, setShowOrgResults] = useState(false);

    const defaultServices = ['Field Worker', 'Tractor Operator', 'Agronomist', 'Pruning Specialist', 'General Labor'];

    if (!isOpen) return null;

    const filteredOrgs = (organizations || []).filter(o => 
        newExp.company && o?.name && o.name.toLowerCase().includes(newExp.company.toLowerCase())
    ).slice(0, 5);
    
    const toggleService = (service: string) => {
        const sStr = String(service);
        if (services.includes(sStr)) setServices(services.filter(s => s !== sStr));
        else setServices([...services, sStr]);
    };

    const addCustomService = () => {
        const trimmed = customService.trim();
        if (trimmed && !services.includes(trimmed)) {
            setServices([...services, trimmed]);
            setCustomService('');
        }
    };

    const addExperience = () => {
        const companyName = newExp.company;
        if (!newExp.title || !companyName) return;
        setExperience([...experience, { 
            id: `exp-${Date.now()}`,
            title: String(newExp.title),
            company: String(companyName),
            startDate: String(newExp.startDate),
            endDate: String(newExp.endDate),
            location: String(newExp.location),
            isCompanyRole: newExp.isCompanyRole,
            description: String(newExp.description)
        }]);
        setNewExp({ title: '', company: '', startDate: '', endDate: '', location: '', isCompanyRole: false, description: '' });
        setShowOrgResults(false);
    };

    const handleSave = () => {
        onUpdateUser({ 
            ...user, 
            primaryGoal: 'OFFER_SERVICE', 
            servicesOffered: services,
            roles: (user.roles || []).includes('Independent') ? (user.roles || []) : [...(user.roles || []), 'Independent'],
            cv: { ...(user.cv || {}), experience },
            region: String(region),
            availability: availability as any
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Professional CV & Services</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Offer your agricultural services & find work</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <XIcon className="h-6 w-6 text-slate-400"/>
                    </button>
                </div>
                
                <div className="p-8 space-y-6 flex-grow overflow-y-auto custom-scrollbar">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">My Agricultural Services</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[...new Set([...defaultServices, ...services])].map(s => {
                                const sStr = String(s);
                                const isChecked = services.includes(sStr);
                                return (
                                    <label key={sStr} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${isChecked ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-indigo-100'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                            checked={isChecked} 
                                            onChange={() => toggleService(sStr)} 
                                        />
                                        <span className={`text-xs font-bold ${isChecked ? 'text-indigo-900' : 'text-slate-600'}`}>{sStr}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <div className="mt-4 flex gap-2">
                            <input 
                                value={customService} 
                                onChange={e => setCustomService(String(e.target.value))} 
                                placeholder="Add another specialization or skill..." 
                                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                onKeyDown={e => e.key === 'Enter' && addCustomService()}
                            />
                            <button 
                                onClick={addCustomService} 
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                            >
                                <PlusIcon size={14}/> Add Service
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chronological CV & Experience History</h4>
                        <div className="space-y-2 mb-4">
                            {experience.map(exp => (
                                <div key={exp.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{String(exp.title)}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{String(exp.company)} • {exp.location || 'No Location'}</p>
                                        <p className="text-[10px] text-slate-400">{String(exp.startDate)} - {exp.endDate ? String(exp.endDate) : 'Present'}</p>
                                        <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest mt-1">{exp.isCompanyRole ? 'Company Role' : 'Individual Role'}</p>
                                    </div>
                                    <button onClick={() => setExperience(experience.filter(e => e.id !== exp.id))} className="text-red-400 hover:text-red-600 p-2 transition-colors">
                                        <TrashIcon size={16}/>
                                    </button>
                                </div>
                            ))}
                            {experience.length === 0 && (
                                <p className="text-center py-4 text-xs font-bold text-slate-400 italic">No prior experience listed yet.</p>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-center">Add New CV Entry</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input 
                                    value={newExp.title} 
                                    onChange={e => setNewExp({...newExp, title: String(e.target.value)})} 
                                    placeholder="Title (e.g. Agronomist, Lead Harvester)" 
                                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                                />
                                <div className="relative">
                                    <input 
                                        value={newExp.company} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewExp({...newExp, company: val});
                                            setShowOrgResults(val.length > 0);
                                        }} 
                                        placeholder="Company / Farm / Enterprise" 
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                                    />
                                    {showOrgResults && (
                                        <div className="absolute z-[7000] w-full mt-1 bg-white border border-slate-100 shadow-2xl rounded-2xl max-h-48 overflow-y-auto">
                                            {filteredOrgs.map(o => (
                                                <button 
                                                    key={o.id} 
                                                    onClick={() => {
                                                        setNewExp({...newExp, company: o.name});
                                                        setShowOrgResults(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all border-b border-slate-50 last:border-0"
                                                >
                                                    {o.name}
                                                </button>
                                            ))}
                                            {filteredOrgs.length === 0 && (
                                                <div className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Manual entry will be saved</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input 
                                    value={newExp.location} 
                                    onChange={e => setNewExp({...newExp, location: String(e.target.value)})} 
                                    placeholder="Location (e.g. Kakheti, Georgia)" 
                                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                                />
                                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                    <button 
                                        type="button"
                                        onClick={() => setNewExp({...newExp, isCompanyRole: true})} 
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${newExp.isCompanyRole ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}
                                    >
                                        Company Role
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setNewExp({...newExp, isCompanyRole: false})} 
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!newExp.isCompanyRole ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}
                                    >
                                        Individual Role
                                    </button>
                                </div>
                            </div>
                            <textarea 
                                value={newExp.description} 
                                onChange={e => setNewExp({...newExp, description: String(e.target.value)})} 
                                placeholder="Key responsibilities, skills demonstrated, and achievements..." 
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[70px]"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={newExp.startDate} 
                                        onChange={e => setNewExp({...newExp, startDate: String(e.target.value)})} 
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                    <input 
                                        type="date" 
                                        value={newExp.endDate} 
                                        onChange={e => setNewExp({...newExp, endDate: String(e.target.value)})} 
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" 
                                    />
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={addExperience} 
                                className="w-full py-3 bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                            >
                                <PlusCircleIcon size={14}/> Add to CV History
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Primary Region</label>
                            <input 
                                value={region} 
                                onChange={e => setRegion(String(e.target.value))} 
                                placeholder="e.g. Kakheti, Georgia" 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Current Availability</label>
                            <select 
                                value={availability} 
                                onChange={e => setAvailability(e.target.value as any)} 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="Available">Available for Hire</option>
                                <option value="Looking for Job">Actively Looking for Job</option>
                                <option value="Unavailable">Currently Busy / Unavailable</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                        Save Profile & Services
                    </button>
                </div>
            </div>
        </div>
    );
};
