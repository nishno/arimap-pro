import React, { useState, useRef, useEffect } from 'react';
import { AppMode, User } from '../types';
import { 
    UsersIcon, MapPinIcon, ArchiveBoxIcon, RectangleStackIcon, 
    BuildingStorefrontIcon, BanknotesIcon
} from './Icons';
import { ArrowRightIcon, ImageIcon as PhotoIcon, CheckCircle2 as CheckCircleIcon, Search, Trash2, Sparkles, Brain, ShoppingBag, Bot, WifiOff, Layers, Settings2, Activity, TrendingUp, Network, BookOpen, Download, MessageSquare, Wand2, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { db, doc, setDoc, getDoc, onSnapshot } from '../firebase';
import { getDefaultScreenshotForStep } from '../utils/defaultScreenshots';
import { AiModuleArchitectureAnalyzer } from './AiModuleArchitectureAnalyzer';
import { AiSopGenerator } from './Help/AiSopGenerator';
import { HelpAiAssistantChat } from './Help/HelpAiAssistantChat';

interface HelpAndGuideViewProps {
    onSetAppMode: (mode: AppMode) => void;
    onTriggerIdentityPopup?: () => void;
    currentUser?: User | null;
}

interface ProcessStep {
    id: string;
    titleKey: string;
    descriptionKey: string;
    icon: React.ReactNode;
    color: string;
    targetMode: AppMode;
    actionTextKey: string;
    detailsKeys: string[];
    category: string;
}

const PROCESS_STEPS: ProcessStep[] = [
    {
        id: 'profile-verification',
        titleKey: 'guide.step1.title',
        descriptionKey: 'guide.step1.desc',
        icon: <UsersIcon className="h-6 w-6" />,
        color: 'bg-indigo-50 text-indigo-600',
        targetMode: 'profile',
        actionTextKey: 'guide.step1.action',
        detailsKeys: ['guide.step1.detail1', 'guide.step1.detail2', 'guide.step1.detail3'],
        category: 'Getting Started'
    },
    {
        id: 'register-company',
        titleKey: 'guide.step2.title',
        descriptionKey: 'guide.step2.desc',
        icon: <BuildingStorefrontIcon className="h-6 w-6" />,
        color: 'bg-purple-50 text-purple-600',
        targetMode: 'founders',
        actionTextKey: 'guide.step2.action',
        detailsKeys: ['guide.step2.detail1', 'guide.step2.detail2', 'guide.step2.detail3'],
        category: 'Getting Started'
    },
    {
        id: 'draw-boundaries',
        titleKey: 'guide.step3.title',
        descriptionKey: 'guide.step3.desc',
        icon: <MapPinIcon className="h-6 w-6" />,
        color: 'bg-emerald-50 text-emerald-600',
        targetMode: 'dashboard',
        actionTextKey: 'guide.step3.action',
        detailsKeys: ['guide.step3.detail1', 'guide.step3.detail2', 'guide.step3.detail3', 'guide.step3.detail4', 'guide.step3.detail5'],
        category: 'Land & Map Planning'
    },
    {
        id: 'register-workers',
        titleKey: 'guide.step4.title',
        descriptionKey: 'guide.step4.desc',
        icon: <UsersIcon className="h-6 w-6" />,
        color: 'bg-blue-50 text-blue-600',
        targetMode: 'tools',
        actionTextKey: 'guide.step4.action',
        detailsKeys: ['guide.step4.detail1', 'guide.step4.detail2', 'guide.step4.detail3'],
        category: 'Team & HR'
    },
    {
        id: 'manage-stock',
        titleKey: 'guide.step5.title',
        descriptionKey: 'guide.step5.desc',
        icon: <ArchiveBoxIcon className="h-6 w-6" />,
        color: 'bg-amber-50 text-amber-600',
        targetMode: 'stock',
        actionTextKey: 'guide.step5.action',
        detailsKeys: ['guide.step5.detail1', 'guide.step5.detail2', 'guide.step5.detail3'],
        category: 'Warehouse & Stock'
    },
    {
        id: 'harvest-session',
        titleKey: 'guide.step6.title',
        descriptionKey: 'guide.step6.desc',
        icon: <RectangleStackIcon className="h-6 w-6" />,
        color: 'bg-indigo-50 text-indigo-600',
        targetMode: 'harvesting',
        actionTextKey: 'guide.step6.action',
        detailsKeys: ['guide.step6.detail1', 'guide.step6.detail2', 'guide.step6.detail3'],
        category: 'Harvest Operations'
    },
    {
        id: 'live-monitoring',
        titleKey: 'guide.step7.title',
        descriptionKey: 'guide.step7.desc',
        icon: <PhotoIcon className="h-6 w-6" />,
        color: 'bg-blue-50 text-blue-600',
        targetMode: 'harvesting',
        actionTextKey: 'guide.step7.action',
        detailsKeys: ['guide.step7.detail1', 'guide.step7.detail2', 'guide.step7.detail3'],
        category: 'Harvest Operations'
    },
    {
        id: 'weigh-station',
        titleKey: 'guide.step8.title',
        descriptionKey: 'guide.step8.desc',
        icon: <CheckCircleIcon className="h-6 w-6" />,
        color: 'bg-emerald-50 text-emerald-600',
        targetMode: 'harvesting',
        actionTextKey: 'guide.step8.action',
        detailsKeys: ['guide.step8.detail1', 'guide.step8.detail2', 'guide.step8.detail3'],
        category: 'Harvest Operations'
    },
    {
        id: 'storage-market',
        titleKey: 'guide.step9.title',
        descriptionKey: 'guide.step9.desc',
        icon: <BanknotesIcon className="h-6 w-6" />,
        color: 'bg-slate-50 text-slate-600',
        targetMode: 'marketplace',
        actionTextKey: 'guide.step9.action',
        detailsKeys: ['guide.step9.detail1', 'guide.step9.detail2', 'guide.step9.detail3'],
        category: 'Harvest Operations'
    },
    {
        id: 'purchase-orders',
        titleKey: 'guide.step10.title',
        descriptionKey: 'guide.step10.desc',
        icon: <ShoppingBag className="h-6 w-6" />,
        color: 'bg-orange-50 text-orange-600',
        targetMode: 'stock',
        actionTextKey: 'guide.step10.action',
        detailsKeys: ['guide.step10.detail1', 'guide.step10.detail2', 'guide.step10.detail3'],
        category: 'Warehouse & Stock'
    },
    {
        id: 'smart-sensors',
        titleKey: 'guide.step11.title',
        descriptionKey: 'guide.step11.desc',
        icon: <Activity className="h-6 w-6" />,
        color: 'bg-emerald-50 text-emerald-600',
        targetMode: 'agronomy',
        actionTextKey: 'guide.step11.action',
        detailsKeys: ['guide.step11.detail1', 'guide.step11.detail2', 'guide.step11.detail3'],
        category: 'Agronomy & Field Care'
    },
    {
        id: 'field-works',
        titleKey: 'guide.step12.title',
        descriptionKey: 'guide.step12.desc',
        icon: <Layers className="h-6 w-6" />,
        color: 'bg-teal-50 text-teal-600',
        targetMode: 'tasks',
        actionTextKey: 'guide.step12.action',
        detailsKeys: ['guide.step12.detail1', 'guide.step12.detail2', 'guide.step12.detail3'],
        category: 'Agronomy & Field Care'
    },
    {
        id: 'payroll-balance',
        titleKey: 'guide.step13.title',
        descriptionKey: 'guide.step13.desc',
        icon: <BanknotesIcon className="h-6 w-6" />,
        color: 'bg-rose-50 text-rose-600',
        targetMode: 'accounting',
        actionTextKey: 'guide.step13.action',
        detailsKeys: ['guide.step13.detail1', 'guide.step13.detail2', 'guide.step13.detail3'],
        category: 'Finance & Accounting'
    },
    {
        id: 'company-ledger',
        titleKey: 'guide.step14.title',
        descriptionKey: 'guide.step14.desc',
        icon: <TrendingUp className="h-6 w-6" />,
        color: 'bg-amber-50 text-amber-600',
        targetMode: 'accounting',
        actionTextKey: 'guide.step14.action',
        detailsKeys: ['guide.step14.detail1', 'guide.step14.detail2', 'guide.step14.detail3'],
        category: 'Finance & Accounting'
    },
    {
        id: 'ai-coordinator',
        titleKey: 'guide.step15.title',
        descriptionKey: 'guide.step15.desc',
        icon: <Bot className="h-6 w-6" />,
        color: 'bg-indigo-50 text-indigo-600',
        targetMode: 'ai',
        actionTextKey: 'guide.step15.action',
        detailsKeys: ['guide.step15.detail1', 'guide.step15.detail2', 'guide.step15.detail3'],
        category: 'AI & Sync Operations'
    },
    {
        id: 'offline-sync',
        titleKey: 'guide.step16.title',
        descriptionKey: 'guide.step16.desc',
        icon: <WifiOff className="h-6 w-6" />,
        color: 'bg-slate-50 text-slate-600',
        targetMode: 'system',
        actionTextKey: 'guide.step16.action',
        detailsKeys: ['guide.step16.detail1', 'guide.step16.detail2', 'guide.step16.detail3'],
        category: 'AI & Sync Operations'
    }
];

const StepMockup: React.FC<{ stepId: string; t: (key: any) => string }> = ({ stepId, t }) => {
    switch (stepId) {
        case 'profile-verification':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">IDENTITY REGISTRATION</span>
                        <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {t('profile.verified') || 'VERIFIED'}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                        <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center font-black text-xs text-white shadow-md flex-shrink-0">
                            GN
                        </div>
                        <div className="overflow-hidden">
                            <h4 className="text-xs font-black tracking-tight text-white truncate">Giorgi Nishnianidze</h4>
                            <p className="text-[9px] font-bold text-slate-400 truncate">giorgi.nishno@gmail.com</p>
                        </div>
                    </div>

                    <div className="space-y-1.5 my-2">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span>Identity Trust Match</span>
                            <span className="text-emerald-400 font-extrabold">100%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                    </div>

                    <div className="space-y-1 text-[8px] font-bold text-slate-400 border-t border-slate-800 pt-2">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                            <span>✓</span> <span>Legal Entity Status Synced</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                            <span>✓</span> <span>Biometric Face Verification</span>
                        </div>
                    </div>
                </div>
            );
            
        case 'register-company':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-purple-400">CROPS & VARIETIES</span>
                        <span className="bg-purple-500/20 text-purple-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-purple-500/20">
                            Active Registry
                        </span>
                    </div>

                    <div className="space-y-2 my-1">
                        <div className="p-2 bg-purple-950/30 border border-purple-800/20 rounded-xl">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black uppercase text-purple-200">🍇 {t('crop.Grape') || 'Grape'}</span>
                                <span className="text-[8px] px-1.5 bg-purple-500/10 text-purple-400 rounded">2 Varieties</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[7px] font-bold rounded">Saperavi</span>
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[7px] font-bold rounded">Rkatsiteli</span>
                            </div>
                        </div>

                        <div className="p-2 bg-amber-950/25 border border-amber-800/15 rounded-xl">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black uppercase text-amber-200">🌱 {t('crop.Hazelnut') || 'Hazelnut'}</span>
                                <span className="text-[8px] px-1.5 bg-amber-500/10 text-amber-400 rounded">1 Variety</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[7px] font-bold rounded">Anakliuri</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[8px] font-bold text-slate-400 border-t border-slate-800 pt-2 bg-slate-950/50 p-1.5 rounded-lg">
                        <div>
                            <span className="block text-slate-500 uppercase tracking-widest text-[6px]">PRIMARY REGION</span>
                            <span className="text-white font-black text-[9px]">Kakheti, Georgia</span>
                        </div>
                        <div>
                            <span className="block text-slate-500 uppercase tracking-widest text-[6px]">LAND AREA</span>
                            <span className="text-white font-black text-[9px]">84.5 HA</span>
                        </div>
                    </div>
                </div>
            );
            
        case 'draw-boundaries':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner relative overflow-hidden select-none">
                    <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center opacity-40">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="v-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                                    <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#252733" strokeWidth="0.5"/>
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#v-grid)" />
                            
                            <polygon points="40,30 220,15 190,85 60,105" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="1.5" />
                            <circle cx="40" cy="30" r="3" fill="#ffffff" stroke="#10b981" strokeWidth="1" />
                            <circle cx="220" cy="15" r="3" fill="#ffffff" stroke="#10b981" strokeWidth="1" />
                            <circle cx="190" cy="85" r="3" fill="#ffffff" stroke="#10b981" strokeWidth="1" />
                            <circle cx="60" cy="105" r="3" fill="#ffffff" stroke="#10b981" strokeWidth="1" />
                            
                            <line x1="60" y1="105" x2="40" y2="30" stroke="#10b981" strokeWidth="1.5" />
                            
                            <text x="105" y="65" fill="#a7f3d0" fontSize="8" fontWeight="bold" fontFamily="monospace">Saperavi Sector A</text>
                        </svg>
                    </div>

                    <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-emerald-400">GIS MAP PLANNER</span>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[8px] px-1.5 py-0.5 rounded-md font-black">
                            Active Area
                        </span>
                    </div>

                    <div className="relative z-10 w-fit ml-auto space-y-1 bg-slate-900/90 border border-slate-700/60 p-1 rounded-lg mt-1">
                        <div className="w-5 h-5 bg-emerald-500 rounded flex items-center justify-center text-white text-[10px] font-bold">☗</div>
                        <div className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center text-slate-400 text-[10px] font-bold">☍</div>
                        <div className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center text-slate-400 text-[10px] font-bold">📍</div>
                    </div>

                    <div className="relative z-10 bg-slate-900/95 border border-slate-800 p-2 rounded-xl mt-auto">
                        <div className="flex justify-between items-center text-[8px] font-bold text-slate-400">
                            <div>
                                <span className="block text-[6px] text-slate-500">BOUNDARIES SELECTED</span>
                                <span className="text-white text-[9px] font-black">54.2 HA • Kakheti Area</span>
                            </div>
                            <span className="text-emerald-400 font-extrabold text-[9px] bg-emerald-500/10 px-1.5 rounded">Closed Loop</span>
                        </div>
                    </div>
                </div>
            );
            
        case 'register-workers':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-blue-400">HR & CODES REGISTRIES</span>
                        <span className="bg-blue-500/20 text-blue-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-blue-500/20">
                            QR IDs Setup
                        </span>
                    </div>

                    <div className="space-y-1.5 my-1 flex-1 overflow-y-auto no-scrollbar">
                        <div className="flex items-center justify-between p-1.5 bg-slate-800/40 border border-slate-700/30 rounded-xl">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-black">LB</div>
                                <div className="leading-tight">
                                    <h5 className="text-[9px] font-bold text-white leading-none">Lado Beridze</h5>
                                    <p className="text-[7px] text-slate-400">Picker • Team Kakheti</p>
                                </div>
                            </div>
                            <span className="text-[8px] text-emerald-400 bg-emerald-500/10 px-1 rounded">Active</span>
                        </div>

                        <div className="flex items-center justify-between p-1.5 bg-slate-800/40 border border-slate-700/30 rounded-xl">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-black">EK</div>
                                <div className="leading-tight">
                                    <h5 className="text-[9px] font-bold text-white leading-none">Eter Kobakhidze</h5>
                                    <p className="text-[7px] text-slate-400">Supervisor • Core Team</p>
                                </div>
                            </div>
                            <span className="text-[8px] text-emerald-400 bg-emerald-500/10 px-1 rounded">Active</span>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-xl flex items-center gap-3 border border-slate-800 mt-1">
                        <div className="w-8 h-8 bg-white p-0.5 rounded flex-shrink-0 flex items-center justify-center">
                            <div className="grid grid-cols-4 gap-0.5 w-full h-full">
                                <div className="bg-black"></div><div className="bg-black"></div><div className="bg-white"></div><div className="bg-black"></div>
                                <div className="bg-white"></div><div className="bg-black"></div><div className="bg-black"></div><div className="bg-white"></div>
                                <div className="bg-black"></div><div className="bg-white"></div><div className="bg-black"></div><div className="bg-black"></div>
                                <div className="bg-black"></div><div className="bg-black"></div><div className="bg-white"></div><div className="bg-black"></div>
                            </div>
                        </div>
                        <div>
                            <span className="block text-[6px] text-slate-500">DIGITAL ID SYNC</span>
                            <span className="text-blue-300 font-bold block text-[8px]">Scan-ID Verified Code</span>
                            <span className="block text-[7px] text-slate-400">Linked to Weigh scale Lanes</span>
                        </div>
                    </div>
                </div>
            );
            
        case 'manage-stock':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-amber-500">WAREHOUSE OPERATIONS</span>
                        <span className="bg-amber-500/20 text-amber-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-amber-500/20">
                            Live Inventory
                        </span>
                    </div>

                    <div className="space-y-1.5 my-1 flex-1">
                        <div className="p-1.5 bg-slate-800/40 border border-slate-700/30 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-[9.5px] font-bold text-white block">Standard plastic crates</span>
                                <span className="text-[7px] text-amber-400">Harvest boxes • Std standard</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9.5px] font-black text-white block">4,000 Crates</span>
                                <span className="text-[6px] text-slate-400 block">Unit weight: 1.2 kg</span>
                            </div>
                        </div>

                        <div className="p-1.5 bg-slate-800/40 border border-slate-700/30 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-[9.5px] font-bold text-white block">NPK Organic Compound</span>
                                <span className="text-[7px] text-emerald-400">Soil enhancement</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9.5px] font-black text-white block">1,200 Kg</span>
                                <span className="text-[6px] text-slate-400 block">Section 5 Silo</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-xl mt-1.5 border border-slate-800">
                        <div className="flex justify-between items-center text-[7px] font-black text-slate-500 uppercase mb-1">
                            <span>Critical Capacity Monitor</span>
                            <span className="text-amber-400">Boxes #3 under minimum</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: '15%' }}></div>
                        </div>
                    </div>
                </div>
            );
            
        case 'harvest-session':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-indigo-400">HARVEST SCHEDULER</span>
                        <span className="bg-rose-500/20 text-rose-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-rose-500/20 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            RUNNING
                        </span>
                    </div>

                    <div className="my-1 text-center bg-slate-950 border border-slate-800 p-3 rounded-2xl">
                        <span className="block text-[6px] text-slate-500 uppercase tracking-widest">ACTIVE ELAPSED SESSION RUNTIMER</span>
                        <span className="text-[20px] font-black font-mono text-indigo-300 tracking-wider">04:12:35</span>
                        <span className="block text-[7px] text-slate-400 mt-0.5">Saperavi Harvest #12</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[8px] font-bold text-slate-400 pt-1">
                        <div className="p-1.5 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-500 uppercase tracking-widest text-[6px] block">ACTIVE TEAM</span>
                            <span className="text-white font-black text-[9px] block">22 Workers</span>
                        </div>
                        <div className="p-1.5 bg-slate-800/50 rounded-lg">
                            <span className="text-slate-500 uppercase tracking-widest text-[6px] block">TARGET PARCEL</span>
                            <span className="text-white font-black text-[9px] block">Sector B (Row 1-12)</span>
                        </div>
                    </div>
                </div>
            );
            
        case 'live-monitoring':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-blue-400">REALTIME MONITORING</span>
                        <span className="bg-blue-500/20 text-blue-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-blue-500/20">
                            Pulsing Streams
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 my-1">
                        <div className="bg-slate-950 p-1.5 border border-slate-800 rounded-lg text-center leading-tight">
                            <span className="block text-[6px] text-slate-500">YIELD</span>
                            <span className="text-emerald-400 font-black text-[9px]">28,700 GEL</span>
                        </div>
                        <div className="bg-slate-950 p-1.5 border border-slate-800 rounded-lg text-center leading-tight">
                            <span className="block text-[6px] text-slate-500">OPEX</span>
                            <span className="text-rose-400 font-black text-[9px]">2,612 GEL</span>
                        </div>
                        <div className="bg-slate-950 p-1.5 border border-slate-800 rounded-lg text-center leading-tight">
                            <span className="block text-[6px] text-slate-500">NET VALUE</span>
                            <span className="text-blue-400 font-black text-[9px]">26,087 GEL</span>
                        </div>
                    </div>

                    <div className="space-y-1 bg-slate-950 p-2 rounded-xl mt-1 border border-slate-800">
                        <div className="flex justify-between text-[6px] text-slate-500 font-bold uppercase">
                            <span>Picker Lane productivity (crates/hr)</span>
                            <span className="text-emerald-400">Peak flow</span>
                        </div>
                        <div className="h-8 flex items-end gap-1 pt-1">
                            <div className="w-full bg-indigo-500 rounded-t" style={{ height: '40%' }}></div>
                            <div className="w-full bg-indigo-500 rounded-t animate-pulse" style={{ height: '70%' }}></div>
                            <div className="w-full bg-indigo-400 rounded-t" style={{ height: '55%' }}></div>
                            <div className="w-full bg-indigo-500 rounded-t" style={{ height: '90%' }}></div>
                            <div className="w-full bg-emerald-500 rounded-t" style={{ height: '80%' }}></div>
                            <div className="w-full bg-emerald-400 rounded-t" style={{ height: '65%' }}></div>
                        </div>
                    </div>
                </div>
            );
            
        case 'weigh-station':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-emerald-400">WEIGH CONSOLE</span>
                        <span className="bg-emerald-500/15 text-emerald-400 text-[8px] px-2 py-0.5 rounded-md font-black border border-emerald-500/25 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            SCALE LOCK
                        </span>
                    </div>

                    <div className="my-1 text-center bg-black border border-emerald-950 p-2.5 rounded-2xl shadow-inner relative overflow-hidden">
                        <div className="absolute top-1 left-3 text-[6px] tracking-wide text-emerald-800 font-mono">GROSS LAN CONDUIT INTEGRATION</div>
                        <div className="text-[22px] font-black font-mono text-emerald-400 tracking-tight mt-1.5">24.12 KG</div>
                        <div className="text-[6px] text-emerald-600 font-mono tracking-widest uppercase mt-0.5">TARE: 1.25 KG • STABLE INDICATION</div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-xl mt-1.5 border border-slate-800 text-[7px] font-bold text-slate-400 space-y-1">
                        <div className="flex justify-between items-center text-slate-300">
                            <span>Lane active ID:</span>
                            <span className="text-white font-extrabold font-mono">ID: LB-2026-9A</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                            <span>Picker registered:</span>
                            <span className="text-emerald-400 font-extrabold block truncate">Lado Beridze (Team Guria)</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                            <span>Validation state:</span>
                            <span className="text-white font-extrabold bg-blue-500/25 text-blue-400 px-1.5 rounded">Ready to Sync</span>
                        </div>
                    </div>
                </div>
            );
            
        case 'storage-market':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">COLD STORAGE & TRADE</span>
                        <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-2 py-0.5 rounded-full font-black border border-emerald-500/20">
                            Settlement Desk
                        </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-800/30 flex items-center justify-center text-lg shadow-inner">🍇</div>
                        <div className="overflow-hidden">
                            <span className="text-[9px] font-black text-white block truncate">Saperavi Grape (Class-A)</span>
                            <span className="block text-[6.5px] text-indigo-400 font-bold uppercase truncate">Ready for cold storage / Sale</span>
                        </div>
                    </div>

                    <div className="space-y-1 my-1.5">
                        <div className="flex justify-between text-[7px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-0.5">
                            <span>Live marketplace offers</span>
                            <span>Highest bid</span>
                        </div>
                        <div className="flex justify-between text-[8px] font-bold text-slate-300">
                            <span>Tbilisi Winery Ltd</span>
                            <span className="text-emerald-400">2.65 GEL/kg</span>
                        </div>
                        <div className="flex justify-between text-[8px] font-bold text-slate-300">
                            <span>Kakheti Cabernet Cellars</span>
                            <span className="text-emerald-400 font-extrabold bg-emerald-500/15 px-1 rounded">2.80 GEL/kg [WON]</span>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-center">
                        <span className="text-[8px] text-slate-400 font-bold block">Sent to cold storage lane & published</span>
                    </div>
                </div>
            );

        case 'purchase-orders':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-orange-400">SUPPLIERS & PROCUREMENT</span>
                        <span className="bg-orange-500/10 text-orange-400 text-[8px] px-2 py-0.5 rounded-full font-black border border-orange-500/20">
                            Approved PO
                        </span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-white">PO-2026-88B</span>
                            <span className="text-[8px] px-1.5 bg-emerald-500/20 text-emerald-400 rounded">Delivered</span>
                        </div>
                        <div className="text-[8px] text-slate-400 leading-normal">
                            <span className="block font-black text-slate-200">Supplier: Agro-Chemicals Ltd</span>
                            <span className="block">Items: 40 Bags NPK Compound, 12L organic fungicides</span>
                            <span className="block font-bold text-orange-300 mt-1">Total: 4,200 GEL • Charged to stock</span>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 mt-1 text-center">
                        <span className="text-[8px] text-slate-400 font-bold block">Live Inventory levels auto-incremented</span>
                    </div>
                </div>
            );

        case 'smart-sensors':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-emerald-400">AGRONOMY IOT PRO</span>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[8px] px-2 py-0.5 rounded-full font-black animate-pulse">
                            ONLINE
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-1">
                        <div className="bg-slate-950 p-2 rounded-xl text-center border border-slate-800">
                            <span className="block text-[7px] text-slate-400 uppercase">Soil Moisture</span>
                            <span className="text-blue-400 font-black text-[13px]">42.5%</span>
                            <span className="block text-[6px] text-emerald-400 mt-0.5">Optimal</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl text-center border border-slate-800">
                            <span className="block text-[7px] text-slate-400 uppercase">Soil pH Value</span>
                            <span className="text-amber-400 font-black text-[13px]">6.4 pH</span>
                            <span className="block text-[6px] text-emerald-400 mt-0.5">Slight Acidic</span>
                        </div>
                    </div>

                    <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60 flex justify-between items-center text-[7.5px] text-slate-400 font-bold">
                        <span>Station #4 Sect B (Grape Rkatsiteli)</span>
                        <span className="text-emerald-400">Last sync 1m ago</span>
                    </div>
                </div>
            );

        case 'field-works':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-teal-400">PLANNER & FIELD TASKS</span>
                        <span className="bg-teal-500/10 text-teal-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-teal-500/20">
                            3 Assigned
                        </span>
                    </div>

                    <div className="space-y-1.5 my-1 flex-1 overflow-y-auto no-scrollbar">
                        <div className="flex justify-between items-center p-1.5 bg-slate-800/40 border border-slate-700/30 rounded-xl">
                            <div>
                                <h5 className="text-[9px] font-bold text-white leading-none">Sprayer Treatment</h5>
                                <span className="text-[7px] text-slate-400">Sector A1-A4 • Saperavi</span>
                            </div>
                            <span className="text-[7.5px] text-yellow-400 bg-yellow-500/10 px-1 rounded font-bold">Planned</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-slate-800/40 border border-slate-700/30 rounded-xl">
                            <div>
                                <h5 className="text-[9px] font-bold text-white leading-none">Nursery Drip Check</h5>
                                <span className="text-[7px] text-slate-400">Sector C • Hazelnut</span>
                            </div>
                            <span className="text-[7.5px] text-emerald-400 bg-emerald-500/10 px-1 rounded font-bold">Ready</span>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-center text-[7px] font-bold text-slate-400">
                        Scheduler triggers SMS reminders to target workers
                    </div>
                </div>
            );

        case 'payroll-balance':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-rose-400">HARVEST PAYROLL SLIP</span>
                        <span className="bg-rose-500/10 text-rose-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-rose-500/20">
                            Reconciled
                        </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-rose-950/40 space-y-1.5">
                        <div className="flex justify-between text-[8px] text-slate-400 border-b border-slate-800 pb-1">
                            <span>RECIPIENT NAME</span>
                            <span className="text-white">Lado Beridze (Picker)</span>
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-400">
                            <span>TOTAL NET HARVESTED</span>
                            <span className="text-white font-extrabold">245.50 kg</span>
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-400">
                            <span>PIECE-RATE INDEX</span>
                            <span className="text-white font-extrabold font-mono">0.45 GEL/kg</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-black text-rose-400 border-t border-slate-800 pt-1">
                            <span>TOTAL GROSS PAY</span>
                            <span>110.48 GEL</span>
                        </div>
                    </div>

                    <div className="text-[7px] text-center text-slate-500 uppercase tracking-widest font-bold mt-1">
                        Direct sync to company Ledger register
                    </div>
                </div>
            );

        case 'company-ledger':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-amber-500">LLC TRANSACTION LEDGER</span>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-emerald-500/20">
                            Verified Ledger
                        </span>
                    </div>

                    <div className="space-y-1 my-1">
                        <div className="flex justify-between items-center text-[8px] bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                            <span className="text-slate-400 font-bold">Dep. Partner Llc</span>
                            <span className="text-emerald-400 font-black">+14,500.00 GEL</span>
                        </div>
                        <div className="flex justify-between items-center text-[8px] bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                            <span className="text-slate-400 font-bold">Harvest piece-ratio pay</span>
                            <span className="text-rose-400 font-black">-1,120.50 GEL</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[8px] text-center mt-1">
                        <div className="bg-slate-950 p-1 rounded-md border border-slate-800 font-bold">
                            <span className="block text-[6px] text-slate-500">OPERATING BALANCE</span>
                            <span className="text-white font-black text-[9.5px]">54,120 GEL</span>
                        </div>
                        <div className="bg-slate-950 p-1 rounded-md border border-slate-800 font-bold">
                            <span className="block text-[6px] text-slate-500">GEL BANK DESK</span>
                            <span className="text-emerald-400 font-black text-[9.5px]">ACTIVE</span>
                        </div>
                    </div>
                </div>
            );

        case 'ai-coordinator':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase font-black tracking-widest text-indigo-400">AGRO AI ANALYSIS COORD</span>
                        <span className="bg-indigo-500/20 text-indigo-300 text-[8px] px-2 py-0.5 rounded-full font-black border border-indigo-500/20">
                            LLM Grounding
                        </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-2xl">
                        <div className="flex items-center gap-1.5 text-[7.5px] uppercase font-black text-indigo-300">
                            <Sparkles className="h-3 w-3 text-indigo-400 animate-pulse" /> Live Prompt Command
                        </div>
                        <p className="text-[8.5px] text-slate-300 italic leading-relaxed mt-1">
                            "Analyze Picker lane efficiency in Sector B Saperavi. Suggest standard crate tare variance index."
                        </p>
                    </div>

                    <div className="bg-indigo-950/20 text-indigo-300 p-2 rounded-xl border border-indigo-800/20 text-[8px] leading-snug">
                        💡 <strong>AI Reply:</strong> Lane 4 shows 12% speed increase. Standard tare is steady at 1.25 kg. Recommend digital scale lock mechanism.
                    </div>
                </div>
            );

        case 'offline-sync':
            return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 h-full flex flex-col justify-between font-sans border border-slate-800 shadow-inner select-none overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-rose-400">OFFLINE SYNC MODULE</span>
                        <span className="bg-amber-500/20 text-amber-300 text-[8px] px-1.5 py-0.5 rounded-md font-black border border-amber-500/20 animate-pulse">
                            OFFLINE SYNCING
                        </span>
                    </div>

                    <div className="my-1 text-center bg-slate-950/80 border border-slate-800 p-2 rounded-xl">
                        <span className="text-[7px] text-slate-400 uppercase tracking-wider block">IDEMPOTENT TRANSACTION BUFFER</span>
                        <span className="text-[12px] font-black font-mono text-amber-300">14 BATCH SLICES SAVED</span>
                        <span className="text-[6.5px] text-slate-400 block mt-0.5">Ready to transmit when internet reconnects</span>
                    </div>

                    <div className="flex items-center justify-between text-[7px] font-extrabold text-slate-400 uppercase border-t border-slate-800 pt-2">
                        <span className="text-emerald-400">✓ SQLite Cache: ENGAGED</span>
                        <span>TOKEN: IDMP-V2</span>
                    </div>
                </div>
            );
            
        default:
            return <div className="text-white text-xs text-center p-8 bg-slate-900">Custom Screen Setup</div>;
    }
};

const HelpAndGuideView: React.FC<HelpAndGuideViewProps> = ({ onSetAppMode, onTriggerIdentityPopup, currentUser }) => {
    const { t, language } = useLanguage();
    const isKa = language === 'ka';
    const isSopAdmin = currentUser?.email?.toLowerCase() === 'magrakvelidzesopio@gmail.com' ||
                       currentUser?.email?.toLowerCase() === 'admin@agrimap.io' ||
                       currentUser?.email?.toLowerCase() === 'nishno@agrimap.pro' ||
                       currentUser?.email?.toLowerCase() === 'giorgi.nishno@gmail.com' ||
                       (currentUser?.roles as string[] | undefined)?.includes('Admin') ||
                       ((currentUser?.roles as string[] | undefined)?.includes('ROOT_SUPER_ADMIN')) ||
                       (currentUser?.roles as string[] | undefined)?.includes('founder') ||
                       (currentUser?.roles as string[] | undefined)?.includes('Founder');

    const [stepImages, setStepImages] = useState<Record<string, string[]>>({});
    const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [activeViewMode, setActiveViewMode] = useState<'ai_architecture' | 'sop_timeline' | 'ai_chat'>('ai_architecture');
    
    // Extract unique categories
    const categories = ['All', ...Array.from(new Set(PROCESS_STEPS.map(s => s.category)))];

    // 1. Subscribe to official global screenshots stored in Firestore database
    useEffect(() => {
        try {
            const unsubscribe = onSnapshot(doc(db, 'systemSettings', 'guide_images'), (snapshot: any) => {
                if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
                    const data = snapshot.data();
                    if (data && data.images) {
                        setStepImages(prev => {
                            const merged = { ...prev };
                            Object.keys(data.images).forEach(key => {
                                if (Array.isArray(data.images[key])) {
                                    merged[key] = data.images[key];
                                }
                            });
                            return merged;
                        });
                    }
                }
            });
            return () => unsubscribe();
        } catch (err) {
            console.warn('[HelpAndGuide] Failed to subscribe to Firestore guide_images onSnapshot:', err);
        }
    }, []);

    // 2. Perform Migration & Auto-upload of pre-existing local screenshots to Firestore
    useEffect(() => {
        if (!isSopAdmin) return;
        const syncLocalToCloud = async () => {
            try {
                const saved = localStorage.getItem('agrimap-guide-images-v2') || localStorage.getItem('agrimap-guide-images');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const migrated: Record<string, string[]> = {};
                    Object.keys(parsed).forEach(key => {
                        const value = parsed[key];
                        if (Array.isArray(value)) {
                            migrated[key] = value;
                        } else if (typeof value === 'string') {
                            migrated[key] = [value];
                        }
                    });

                    // Retrieve current document to merge states cleanly
                    const docSnap = await getDoc(doc(db, 'systemSettings', 'guide_images'));
                    let cloudImages: Record<string, string[]> = {};
                    if (docSnap && typeof docSnap.exists === 'function' && docSnap.exists()) {
                        cloudImages = docSnap.data()?.images || {};
                    }

                    let hasNew = false;
                    const mergedImages = { ...cloudImages };
                    Object.keys(migrated).forEach(stepId => {
                        const localList = migrated[stepId];
                        const cloudList = mergedImages[stepId] || [];
                        const combined = [...cloudList];
                        localList.forEach(img => {
                            if (!combined.includes(img)) {
                                combined.push(img);
                                hasNew = true;
                            }
                        });
                        mergedImages[stepId] = combined;
                    });

                    if (hasNew || (docSnap && typeof docSnap.exists === 'function' && !docSnap.exists())) {
                        await setDoc(doc(db, 'systemSettings', 'guide_images'), {
                            images: mergedImages
                        });
                        console.log('[HelpAndGuide] Synced existing raw offline captures to global Firestore database successfully.');
                    }
                }
            } catch (err) {
                console.warn('[HelpAndGuide] Failed to sync local storage items to Firestore cloud:', err);
            }
        };

        syncLocalToCloud();
    }, [isSopAdmin]);

    // 3. Pre-populate any missing screenshots with high-fidelity default ones in Firestore
    useEffect(() => {
        if (!isSopAdmin) return;
        const prePopulateDefaultImages = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'systemSettings', 'guide_images'));
                let cloudImages: Record<string, string[]> = {};
                let docExists = false;

                if (docSnap && typeof docSnap.exists === 'function' && docSnap.exists()) {
                    cloudImages = docSnap.data()?.images || {};
                    docExists = true;
                }

                let updated = false;
                const merged = { ...cloudImages };

                PROCESS_STEPS.forEach(step => {
                    const stepList = merged[step.id] || [];
                    if (stepList.length === 0) {
                        const defaultImg = getDefaultScreenshotForStep(step.id);
                        merged[step.id] = [defaultImg];
                        updated = true;
                    }
                });

                if (updated || !docExists) {
                    await setDoc(doc(db, 'systemSettings', 'guide_images'), {
                        images: merged
                    });
                    console.log('[HelpAndGuide] Pre-populated missing guide steps with high-fidelity default screenshots successfully.');
                }
            } catch (err) {
                console.warn('[HelpAndGuide] Failed to pre-populate default guide images to Firestore:', err);
            }
        };

        // Give Firestore onSnapshot a brief split-second to load initial values before correcting gaps
        const timer = setTimeout(() => {
            prePopulateDefaultImages();
        }, 1200);

        return () => clearTimeout(timer);
    }, [isSopAdmin]);

    const handleImageUpload = (stepId: string, file: File) => {
        if (!isSopAdmin) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            const currentImages = stepImages[stepId] || [];
            const updatedList = [...currentImages, base64String];
            const newImages = { ...stepImages, [stepId]: updatedList };
            setStepImages(newImages);
            setActiveImageIndices(prev => ({ ...prev, [stepId]: updatedList.length - 1 }));

            // 1. Try to save globally to Firestore (which is the source of truth)
            try {
                await setDoc(doc(db, 'systemSettings', 'guide_images'), {
                    images: newImages
                });
                console.log('[HelpAndGuide] Saved guide images globally to Firestore successfully.');
            } catch (dbErr) {
                console.error("Failed to save guide images globally to Firestore:", dbErr);
            }

            // 2. Try to save to localStorage as an offline backup, but catch QuotaExceededError silently
            try {
                localStorage.setItem('agrimap-guide-images-v2', JSON.stringify(newImages));
            } catch (err) {
                console.warn("[HelpAndGuide] Local storage quota exceeded for guide images backup.");
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteImage = async (stepId: string, indexToRemove: number) => {
        if (!isSopAdmin) return;
        const currentImages = stepImages[stepId] || [];
        const filtered = currentImages.filter((_, idx) => idx !== indexToRemove);
        const newImages = { ...stepImages, [stepId]: filtered };
        setStepImages(newImages);
        
        const currentActive = activeImageIndices[stepId] || 0;
        let newActive = currentActive;
        if (currentActive >= filtered.length && filtered.length > 0) {
            newActive = filtered.length - 1;
        } else if (filtered.length === 0) {
            newActive = 0;
        }
        setActiveImageIndices(prev => ({ ...prev, [stepId]: newActive }));
        
        // 1. Try to save globally to Firestore (which is the source of truth)
        try {
            await setDoc(doc(db, 'systemSettings', 'guide_images'), {
                images: newImages
            });
            console.log('[HelpAndGuide] Updated deletion globally in Firestore successfully.');
        } catch (dbErr) {
            console.error("Failed to update deletion globally in Firestore:", dbErr);
        }

        // 2. Try to save to localStorage as an offline/local backup, but catch QuotaExceededError silently
        try {
            localStorage.setItem('agrimap-guide-images-v2', JSON.stringify(newImages));
        } catch (err) {
            console.warn("[HelpAndGuide] Local storage quota exceeded for guide images backup upon deletion.");
        }
    };

    const filteredSteps = PROCESS_STEPS.filter(step => {
        const matchesCategory = selectedCategory === 'All' || step.category === selectedCategory;
        const matchesSearch = t(step.titleKey).toLowerCase().includes(searchQuery.toLowerCase()) || 
                              t(step.descriptionKey).toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Master Mode Switcher Tabs */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100 rounded-2xl w-full lg:w-auto">
                        <button
                            onClick={() => setActiveViewMode('ai_architecture')}
                            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                activeViewMode === 'ai_architecture'
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <Brain className="w-4 h-4 text-emerald-400" />
                            <span>{isKa ? 'AI მოდულების არქიტექტურა & ექსპორტი' : 'AI Module Architecture & Downloads'}</span>
                        </button>

                        <button
                            onClick={() => setActiveViewMode('sop_timeline')}
                            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                activeViewMode === 'sop_timeline'
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <BookOpen className="w-4 h-4 text-indigo-400" />
                            <span>{isKa ? 'სტანდარტული SOP-ები & AI გენერატორი' : 'Standard SOPs & AI Generator'}</span>
                        </button>

                        <button
                            onClick={() => setActiveViewMode('ai_chat')}
                            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                activeViewMode === 'ai_chat'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                        >
                            <MessageSquare className="w-4 h-4 text-indigo-400" />
                            <span>{isKa ? 'AI ასისტენტი & ჩატი' : 'AI Guide Assistant & Chat'}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-600 border border-indigo-200">
                                AI
                            </span>
                        </button>
                    </div>

                    <div className="text-xs font-extrabold text-slate-400 flex items-center justify-between sm:justify-end gap-3 px-3">
                        <button
                            onClick={() => setActiveViewMode('ai_chat')}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{isKa ? 'კითხვა აპლიკაციაზე' : 'Ask System Question'}</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>AgriMap Pro 2.0.6 Enterprise</span>
                        </div>
                    </div>
                </div>

                {/* VIEW 1: AI ARCHITECTURE, INTERACTIVE TOPOLOGY & DOWNLOADABLE DECKS/GUIDES */}
                {activeViewMode === 'ai_architecture' && (
                    <AiModuleArchitectureAnalyzer 
                        onNavigateMode={(mode) => onSetAppMode(mode as AppMode)} 
                        currentUser={currentUser} 
                    />
                )}

                {/* VIEW 2: STANDARD 16-STEP OPERATIONAL SOP TIMELINE & AI SOP GENERATOR */}
                {activeViewMode === 'sop_timeline' && (
                    <div className="max-w-5xl mx-auto space-y-10">
                        {/* AI SOP & Operational Standard Generator */}
                        <AiSopGenerator 
                            language={language}
                            currentUser={currentUser}
                            onNavigateMode={(mode) => onSetAppMode(mode as AppMode)}
                        />

                        {/* Standard 16-Step Process Timeline Intro */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 leading-tight">
                                        {t('guide.main_title') || 'Standard Operating Procedures (16 Steps)'}
                                    </h1>
                                    <p className="text-slate-500 mt-2 font-medium text-sm sm:text-base leading-relaxed">
                                        {t('guide.subtitle') || 'Follow this sequential timeline to track your complete supply chain lifecycle.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveViewMode('ai_chat')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition-all shrink-0 cursor-pointer"
                                >
                                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                                    <span>{isKa ? 'გჭირდებათ დახმარება? გახსენით ჩატი' : 'Need Guidance? Open AI Chat'}</span>
                                </button>
                            </div>
                            
                            {/* Record Banner Alert Block */}
                            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 text-indigo-950 text-sm leading-relaxed shadow-xs">
                                <div className="flex gap-3">
                                    <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                                    <p className="font-semibold">{t('guide.record_banner')}</p>
                                </div>
                            </div>

                            <p className="text-slate-700 font-bold mt-6 text-xs sm:text-sm bg-slate-50 py-2.5 px-4 border border-slate-200 rounded-xl inline-block">
                                {t('guide.instructions_intro')}
                            </p>
                        </div>
                        
                        {/* Search & Filter Controls */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <div className="relative w-full sm:w-1/2">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                                <input 
                                    type="text" 
                                    placeholder={t('common.search') || 'Search modules & operations...'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700 text-sm"
                                />
                            </div>
                            
                            <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-12 relative">
                            <div className="absolute left-8 top-8 bottom-8 w-px bg-slate-200 z-0 hidden md:block"></div>

                            {filteredSteps.map((step, index) => {
                                const imagesList = stepImages[step.id] || [];
                                const activeIdx = activeImageIndices[step.id] || 0;

                                return (
                                    <div key={step.id} className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-12">
                                        <div className="hidden md:flex flex-col items-center">
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-white ${step.color}`}>
                                                {step.icon}
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative group transition-all hover:shadow-md">
                                            <div className="flex flex-col lg:flex-row gap-8">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center md:hidden ${step.color}`}>
                                                            {step.icon}
                                                        </div>
                                                        <h2 className="text-xl font-black text-slate-800">{t(step.titleKey)}</h2>
                                                    </div>
                                                    <p className="text-slate-600 font-medium mb-6">{t(step.descriptionKey)}</p>
                                                    
                                                    <ul className="space-y-3 mb-8">
                                                        {step.detailsKeys.map((detailKey, idx) => (
                                                            <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                                                                <CheckCircleIcon className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                                                                <span className="pt-0.5">{t(detailKey)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    
                                                    <button 
                                                        onClick={() => {
                                                            if (step.id === 'profile-verification') {
                                                                if (onTriggerIdentityPopup) {
                                                                    onTriggerIdentityPopup();
                                                                } else {
                                                                    onSetAppMode('profile');
                                                                }
                                                            } else {
                                                                onSetAppMode(step.targetMode);
                                                            }
                                                        }}
                                                        className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition"
                                                    >
                                                        {t(step.actionTextKey)}
                                                        <ArrowRightIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                
                                                <div className="w-full lg:w-72 flex-shrink-0">
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('guide.preview') || 'Interface Preview'}</h3>
                                                    
                                                    {imagesList.length > 0 ? (
                                                        <div className="space-y-3">
                                                            <div className="relative group/image rounded-2xl overflow-hidden border border-slate-100 shadow-inner bg-slate-100 aspect-[4/3]">
                                                                <img 
                                                                    src={imagesList[activeIdx]} 
                                                                    alt={`Screenshot`} 
                                                                    className="w-full h-full object-cover"
                                                                    referrerPolicy="no-referrer"
                                                                />
                                                                <div 
                                                                    className="absolute inset-0 bg-transparent hover:bg-black/10 flex items-center justify-center transition-all cursor-zoom-in group/zoom"
                                                                    onClick={() => setZoomedImage(imagesList[activeIdx])}
                                                                >
                                                                    <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover/zoom:opacity-100 transition-opacity flex items-center gap-1.5 shadow-md">
                                                                        <span>🔍</span> {t('guide.click_zoom') || 'Click to Zoom'}
                                                                    </span>
                                                                </div>
                                                                {isSopAdmin && (
                                                                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteImage(step.id, activeIdx)}
                                                                            className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-md"
                                                                            title="Delete this screenshot"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {isSopAdmin && (
                                                                    <label className="absolute inset-x-0 bottom-0 bg-slate-900/60 py-2 text-center opacity-0 group-hover/image:opacity-100 transition-opacity cursor-pointer">
                                                                        <span className="text-white text-[10px] font-bold">{t('guide.upload_another') || 'Upload Another Screenshot'}</span>
                                                                        <input 
                                                                            type="file" 
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            onChange={(e) => {
                                                                                if (e.target.files && e.target.files[0]) handleImageUpload(step.id, e.target.files[0]);
                                                                            }}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>

                                                            {/* Thumbnails list with a plus button */}
                                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                                {imagesList.map((img, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => setActiveImageIndices(prev => ({ ...prev, [step.id]: idx }))}
                                                                        className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition ${activeIdx === idx ? 'border-slate-800 shadow-sm' : 'border-slate-200 hover:border-slate-400'}`}
                                                                    >
                                                                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                                    </button>
                                                                ))}
                                                                {isSopAdmin && (
                                                                    <label className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition">
                                                                        <span className="text-slate-400 font-bold text-sm">+</span>
                                                                        <input 
                                                                            type="file" 
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            onChange={(e) => {
                                                                                if (e.target.files && e.target.files[0]) handleImageUpload(step.id, e.target.files[0]);
                                                                            }}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="relative group/image rounded-3xl overflow-hidden border border-slate-100 shadow-md bg-slate-900 aspect-[4/3] flex flex-col p-1.5">
                                                            <div className="flex-1 overflow-hidden">
                                                                <StepMockup stepId={step.id} t={t} />
                                                            </div>
                                                            {isSopAdmin && (
                                                                <label className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white mb-2">
                                                                        <PhotoIcon className="h-4 w-4" />
                                                                    </div>
                                                                    <span className="text-[10px] font-black tracking-widest uppercase text-white px-3 py-1 bg-white/10 rounded-lg border border-white/20 text-center">{t('guide.upload_img') || 'Upload Screenshot'}</span>
                                                                    <input 
                                                                        type="file" 
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            if (e.target.files && e.target.files[0]) handleImageUpload(step.id, e.target.files[0]);
                                                                        }}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {filteredSteps.length === 0 && (
                                <div className="text-center py-20 text-slate-500 font-medium">
                                    {t('guide.no_results') || 'No guide steps found.'}
                                </div>
                            )}

                            {/* Agro AI Analyst Log Control Guidance Card */}
                            <div className="mt-16 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[2rem] p-8 border border-slate-700/50 shadow-xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                                
                                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
                                    <div className="p-4 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                                        <Brain className="h-8 w-8 animate-pulse text-indigo-300" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-xl font-black text-white">Agro AI Log Control Guidance</h3>
                                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Sparkles className="h-3 w-3 inline text-indigo-400" /> ACTIVE
                                            </span>
                                        </div>
                                        <p className="text-slate-300 text-xs leading-relaxed mb-6">
                                            Our telemetry models actively analyze scale transactions, worker crate counts, varieties, and geofenced harvest sectors. In the event of network throttling or sync conflicts, the system uses idempotent transaction tokens to protect offline data logs. To view real-time performance indicators or verify your system's operational health, contact our engineering dispatch at <strong className="text-indigo-300">giorgi@agrimap.pro</strong> or <strong className="text-indigo-300">+995 595 12 47 47</strong>.
                                        </p>
                                        <div className="flex flex-wrap items-center gap-6 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                                DEDUPLICATION TOKEN: <span className="text-slate-200">AUTOMATICALLY RENEWED</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                CELLULAR GUARD LIMIT: <span className="text-slate-200">100 BATCH SLICES</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW 3: AI SYSTEM NAVIGATOR & CHAT ASSISTANT */}
                {activeViewMode === 'ai_chat' && (
                    <div className="max-w-5xl mx-auto">
                        <HelpAiAssistantChat 
                            currentUser={currentUser}
                            language={language}
                            onNavigateMode={(mode) => onSetAppMode(mode as AppMode)}
                        />
                    </div>
                )}
            </div>

            {/* Zoom Lightbox Modal */}
            {zoomedImage && (
                <div 
                    className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
                    onClick={() => setZoomedImage(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl flex flex-col bg-slate-900" onClick={(e) => e.stopPropagation()}>
                        <button 
                            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white text-lg font-bold transition"
                            onClick={() => setZoomedImage(null)}
                        >
                            ✕
                        </button>
                        <img 
                            src={zoomedImage} 
                            alt="Screenshot Full view" 
                            className="max-w-full max-h-[80vh] object-contain select-none"
                            referrerPolicy="no-referrer"
                        />
                        <div className="bg-slate-950/80 px-6 py-4 text-center text-xs text-slate-400 border-t border-white/5 flex justify-between items-center">
                            <span>SOP Interface Capture</span>
                            <span className="text-slate-500">Click anywhere outside or press ✕ to close</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpAndGuideView;
