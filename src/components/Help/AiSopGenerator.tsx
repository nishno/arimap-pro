import React, { useState } from 'react';
import { Sparkles, BookOpen, Download, Copy, Check, RefreshCw, ChevronDown, ChevronUp, FileText, CheckCircle2 } from 'lucide-react';
import { executeGeminiCall } from '../../services/geminiService';
import { toast } from 'sonner';

interface AiSopGeneratorProps {
    language?: string;
    onNavigateMode?: (mode: string) => void;
    currentUser?: any;
}

interface SopPreset {
    id: string;
    titleEn: string;
    titleKa: string;
    category: string;
    promptEn: string;
    promptKa: string;
}

const SOP_PRESETS: SopPreset[] = [
    {
        id: 'profile_onboarding',
        titleEn: 'User Profile Creation & KYC Verification Protocol',
        titleKa: 'პროფილის შექმნა და KYC ვერიფიკაციის რეგლამენტი',
        category: 'Identity',
        promptEn: 'Standard Operating Procedure for completing user profile registration, contact details, role assignments, uploading identity documents for KYC verification, and handover to company registration.',
        promptKa: 'სტანდარტული ოპერაციული პროცედურა (SOP) მომხმარებლის პროფილის რეგისტრაციის, საკონტაქტო მონაცემების, როლების მინიჭების, KYC დოკუმენტების ატვირთვისა და კომპანიის რეგისტრაციაზე გადასვლისთვის.'
    },
    {
        id: 'company_founders',
        titleEn: 'Agricultural Company & Co-Founders Registration SOP',
        titleKa: 'აგრო-კომპანიის და თანადამფუძნებლების რეგისტრაციის SOP',
        category: 'Enterprise',
        promptEn: 'Standard Operating Procedure for setting up an agricultural enterprise in Founders Hub, entering tax ID, selecting legal form, allocating founder equity percentages, and establishing enterprise permissions.',
        promptKa: 'სტანდარტული ოპერაციული პროცედურა Founders Hub-ში აგრო-საწარმოს შექმნის, საგადასახადო კოდის, იურიდიული ფორმის, დამფუძნებელთა წილებისა და უფლებამოსილებების გაწერისთვის.'
    },
    {
        id: 'gis_mapping',
        titleEn: 'Plantation GPS Boundary & Parcel Mapping SOP',
        titleKa: 'პლანტაციის GPS საზღვრებისა და მიწის ნაკვეთის მოხაზვის SOP',
        category: 'GIS & Mapping',
        promptEn: 'Standard Operating Procedure for locating plantation parcels on Google satellite maps, drawing boundary polygons, vertex editing, automated hectare calculation, seedling row layout, and irrigation zone marking.',
        promptKa: 'სტანდარტული ოპერაციული პროცედურა სატელიტურ რუკაზე მიწის ნაკვეთის მოძიების, საზღვრების პოლიგონის მოხაზვის, ჰექტრების ავტომატური კალკულაციის, ნერგების რიგებისა და სარწყავი ზონების დატანისთვის.'
    },
    {
        id: 'harvest_weigh_station',
        titleEn: 'Harvest Session & Scale Weigh Station Protocol',
        titleKa: 'მოსავლის აღების სესიისა და ელექტრონული სასწორის პროტოკოლი',
        category: 'Harvesting',
        promptEn: 'Standard Operating Procedure for launching a harvest event, setting up electronic scale weigh station, deducting tare box weights, scanning worker QR badges, recording net fruit weights, and assigning quality grades.',
        promptKa: 'სტანდარტული ოპერაციული პროცედურა მოსავლის ღონისძიების გახსნის, ელექტრონული სასწორის გამართვის, ტარის წონის ჩამოჭრის, მკრეფავის QR ბარათის სკანირების, წმინდა წონის დაფიქსირებისა და ხარისხის კატეგორიზაციისთვის.'
    },
    {
        id: 'warehouse_stock',
        titleEn: 'Warehouse Inventory Receiving & Auto-Deduction SOP',
        titleKa: 'საწყობში მარაგების მიღებისა და ავტო-ჩამოწერის SOP',
        category: 'Inventory',
        promptEn: 'Standard Operating Procedure for receiving packaging boxes, punets, and agrochemicals into stock, setting reorder thresholds, and executing automated stock deduction upon harvest crate recording.',
        promptKa: 'სტანდარტული ოპერაციული პროცედურა ყუთების, პუნეტების, სასუქებისა და ქიმიკატების საწყობში მიღების, მინიმალური ზღვრების დაწესებისა და მოსავლის აღებისას ტარის ავტომატური ჩამოწერისთვის.'
    },
    {
        id: 'personnel_attendance',
        titleEn: 'Workforce Onboarding, Piece-Rate & Daily Attendance SOP',
        titleKa: 'მუშახელის აღრიცხვის, გამომუშავებისა და ყოველდღიური დასწრების SOP',
        category: 'HR & Labor',
        promptEn: 'Standard Operating Procedure for onboarding seasonal pickers, setting piece-rate wages (per kg or per box), terminal clock-in via PIN or badge, and daily attendance verification.',
        promptKa: 'სტანდარტული ოპერაციული პროცედურა სეზონური მკრეფავების რეგისტრაციის, გამომუშავების ტარიფების (კგ-ზე ან ყუთზე) განსაზღვრის, PIN კოდით ტერმინალზე დაფიქსირებისა და ყოველდღიური ტაბელის შევსებისთვის.'
    }
];

export const AiSopGenerator: React.FC<AiSopGeneratorProps> = ({ language = 'en', onNavigateMode }) => {
    const isKa = language === 'ka';
    const [selectedPresetId, setSelectedPresetId] = useState<string>(SOP_PRESETS[0].id);
    const [customQuery, setCustomQuery] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [generatedSop, setGeneratedSop] = useState<string | null>(null);
    const [copied, setCopied] = useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    const handleGenerateSop = async () => {
        setIsGenerating(true);
        try {
            const selectedPreset = SOP_PRESETS.find(p => p.id === selectedPresetId);
            const promptTopic = customQuery.trim() 
                ? customQuery.trim() 
                : (isKa ? selectedPreset?.promptKa : selectedPreset?.promptEn);

            const prompt = `You are the Principal Agricultural Operations Architect and Quality Systems Director for AgriMap Pro (an enterprise agricultural operations platform).

Generate an authentic, professional, comprehensive Standard Operating Procedure (SOP) based on this requirement:
Topic: "${promptTopic}"
Target Language: ${isKa ? 'Georgian (ქართული)' : 'English'}

The SOP must follow this exact rigorous ISO/GAP structure with Markdown formatting:
# [SOP Code & Title, e.g. SOP-AMP-001: Title]
**Document ID:** SOP-AMP-${Math.floor(100 + Math.random() * 900)}
**Department:** Enterprise Agricultural Operations
**Version:** 2.4 | **Effective Date:** Immediate

## 1. Objective & Scope
(Clear statement of what this procedure achieves and what operations/users it governs)

## 2. Responsible Roles & Permissions
(Specific platform roles e.g. Farm Manager, Agronomist, Weigh Station Operator, Root Administrator)

## 3. Prerequisites & System Setup
(Exact hardware, software, user permissions, and master data needed before execution)

## 4. Step-by-Step Procedural Execution
(Detailed chronological steps with exact button names, screen titles, and input fields in AgriMap Pro:
- Step 1: Initial Navigation & Screen Setup
- Step 2: Input Verification & Validation
- Step 3: Execution & Recording
- Step 4: Submission & Status Verification)

## 5. Quality Control, Tolerances & Validation Rules
(Acceptable boundaries, tare deductions, weight variance limits, error checking)

## 6. Offline Field Resilience & Troubleshooting
(Instructions for when field internet is down, local caching, reconciliation on reconnect)

## 7. Next Recommended Action & System Handover
(What the user or supervisor must do immediately following the completion of this SOP)

Write with high technical authority, clarity, and precision. Include actionable guidance.`;

            const response = await executeGeminiCall({
                contents: prompt
            });

            if (response && response.text) {
                setGeneratedSop(response.text);
                setIsExpanded(true);
                toast.success(isKa ? 'SOP წარმატებით დაგენერირდა!' : 'SOP successfully generated with AI!');
            } else {
                throw new Error('Empty response from AI engine');
            }
        } catch (error) {
            console.error('Failed to generate SOP:', error);
            toast.error(isKa ? 'SOP-ის გენერაცია ვერ მოხერხდა. სცადეთ ხელახლა.' : 'Failed to generate SOP. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!generatedSop) return;
        navigator.clipboard.writeText(generatedSop);
        setCopied(true);
        toast.success(isKa ? 'SOP კოპირებულია გაცვლის ბუფერში' : 'SOP copied to clipboard');
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownload = () => {
        if (!generatedSop) return;
        const blob = new Blob([generatedSop], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AgriMap_Pro_SOP_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(isKa ? 'SOP დოკუმენტი (.md) ჩამოიტვირთა' : 'SOP document (.md) downloaded');
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-white border border-indigo-900/60 shadow-xl mb-10 relative overflow-hidden">
            {/* Ambient Background Accents */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-indigo-800/60">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-950 text-white shrink-0">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                                    {isKa ? 'AI სტანდარტების & SOP გენერატორი' : 'AI Standard & SOP Generator'}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    AI Powered
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                                {isKa 
                                    ? 'დააგენერირეთ ოფიციალური სტანდარტული ოპერაციული პროცედურები და სახელმძღვანელოები სისტემის ნებისმიერი მოდულისთვის' 
                                    : 'Generate verified Standard Operating Procedures (SOPs), operational directives, and workflow manuals with Gemini AI'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Preset Chips */}
                <div className="mt-6">
                    <label className="text-[11px] font-black uppercase tracking-wider text-indigo-300 block mb-2.5">
                        {isKa ? 'აირჩიეთ ოპერაციული დომენი ან წინასწარ გამზადებული შაბლონი:' : 'Select an Operational Domain or Pre-built Preset:'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {SOP_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                    setSelectedPresetId(preset.id);
                                    setCustomQuery('');
                                }}
                                className={`p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                                    selectedPresetId === preset.id && !customQuery
                                        ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-md'
                                        : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 font-mono">
                                        {preset.category}
                                    </span>
                                    {selectedPresetId === preset.id && !customQuery && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                                    )}
                                </div>
                                <h4 className="text-xs font-bold leading-tight">
                                    {isKa ? preset.titleKa : preset.titleEn}
                                </h4>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Query Input */}
                <div className="mt-4">
                    <label className="text-[11px] font-black uppercase tracking-wider text-indigo-300 block mb-2">
                        {isKa ? 'ან ჩაწერეთ კონკრეტული ოპერაცია / მოთხოვნა:' : 'Or Enter a Custom Operation / Specific Workflow Topic:'}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={customQuery}
                            onChange={(e) => setCustomQuery(e.target.value)}
                            placeholder={isKa ? 'მაგ: როგორ დავაკალიბროთ Bluetooth სასწორი და დავბეჭდოთ QR ტეგები...' : 'e.g., Calibrate bluetooth scales, print barcode labels, and audit fruit quality...'}
                            className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 font-medium"
                        />
                        <button
                            type="button"
                            onClick={handleGenerateSop}
                            disabled={isGenerating}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50 active:scale-95 cursor-pointer shrink-0"
                        >
                            {isGenerating ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>{isKa ? 'მუშავდება...' : 'Architecting SOP...'}</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>{isKa ? 'SOP-ის გენერირება' : 'Generate Standard SOP'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* GENERATED SOP VIEWER */}
                {generatedSop && (
                    <div className="mt-6 pt-6 border-t border-indigo-800/60 animate-fadeIn">
                        <div className="flex items-center justify-between gap-3 mb-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                    {isKa ? 'დაგენერირებული ოფიციალური SOP' : 'Generated Official SOP Directive'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    title={isKa ? 'კოპირება' : 'Copy'}
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copied ? (isKa ? 'კოპირებულია' : 'Copied') : (isKa ? 'კოპირება' : 'Copy')}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    title={isKa ? 'ჩამოტვირთვა (.md)' : 'Download Markdown'}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>{isKa ? 'ჩამოტვირთვა' : 'Download .md'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all cursor-pointer"
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-6 max-h-[500px] overflow-y-auto custom-scrollbar font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-indigo-700 selection:text-white">
                                {generatedSop}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
