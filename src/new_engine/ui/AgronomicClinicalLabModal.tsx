import React, { useState, useEffect } from 'react';
import { appEngine } from '../AppEventEngine';
import { 
    AgronomistDiagnosis, 
    BtAuditResult, 
    DiseaseDiagnosisResult, 
    RootGodAiBenchmarkResult 
} from '../types';
import { 
    Activity, 
    Sparkles, 
    Search, 
    History, 
    FileText, 
    ShieldCheck, 
    AlertCircle, 
    X, 
    Loader2, 
    CheckCircle2, 
    Layers, 
    Camera, 
    Upload, 
    Eye, 
    Globe2 
} from 'lucide-react';
import { toast } from 'sonner';

interface AgronomicClinicalLabModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeOrgId: string | null;
    currentUser: any;
    isSystemAdmin?: boolean;
    isKa?: boolean;
}

export const AgronomicClinicalLabModal: React.FC<AgronomicClinicalLabModalProps> = ({
    isOpen,
    onClose,
    activeOrgId,
    currentUser,
    isSystemAdmin = false,
    isKa = false
}) => {
    const [activeTab, setActiveTab] = useState<'AUDIT' | 'DISEASE' | 'DOC_OCR' | 'GOD_AI'>('AUDIT');

    // Bt Audit State
    const [auditIngredient, setAuditIngredient] = useState('Bacillus thuringiensis');
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditResult, setAuditResult] = useState<BtAuditResult | null>(null);

    // Disease Analysis State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [diagnosing, setDiagnosing] = useState(false);
    const [diseaseResult, setDiseaseResult] = useState<DiseaseDiagnosisResult | null>(null);
    const [verificationNotes, setVerificationNotes] = useState('');
    const [committing, setCommitting] = useState(false);

    // Root God AI State
    const [godAiLoading, setGodAiLoading] = useState(false);
    const [godAiResult, setGodAiResult] = useState<RootGodAiBenchmarkResult | null>(null);

    useEffect(() => {
        if (isOpen && activeTab === 'AUDIT' && !auditResult) {
            runBtAudit();
        }
    }, [isOpen, activeTab]);

    if (!isOpen) return null;

    const runBtAudit = async (customIngredient?: string) => {
        setAuditLoading(true);
        try {
            const ingredient = customIngredient || auditIngredient;
            const res = await appEngine.request<any, BtAuditResult>('QUERY_BT_AUDIT', {
                organizationId: activeOrgId || 'org-local',
                activeIngredient: ingredient
            });
            setAuditResult(res);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to query treatment history.');
        } finally {
            setAuditLoading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setMimeType(file.type || 'image/jpeg');
        const reader = new FileReader();
        reader.onload = () => {
            setSelectedImage(reader.result as string);
            setDiseaseResult(null);
        };
        reader.readAsDataURL(file);
    };

    const runDiseaseDiagnosis = async () => {
        if (!selectedImage) {
            toast.error(isKa ? 'გთხოვთ ატვირთოთ ფოთლის ფოტო' : 'Please upload a plant leaf photo');
            return;
        }

        setDiagnosing(true);
        try {
            const base64Data = selectedImage.includes('base64,') 
                ? selectedImage.split('base64,')[1] 
                : selectedImage;

            const res = await appEngine.request<any, DiseaseDiagnosisResult>('REQUEST_DISEASE_DIAGNOSIS', {
                organizationId: activeOrgId || 'org-local',
                base64Image: base64Data,
                mimeType,
                language: isKa ? 'ka' : 'en'
            });

            setDiseaseResult(res);
        } catch (err: any) {
            toast.error(err?.message || 'Diagnostic failed');
        } finally {
            setDiagnosing(false);
        }
    };

    const commitToClinicalLedger = async () => {
        if (!diseaseResult) return;

        setCommitting(true);
        try {
            await appEngine.request('RECORD_CLINICAL_DIAGNOSIS', {
                organizationId: activeOrgId || 'org-local',
                diagnosisType: 'DISEASE_DETECTION',
                findings: {
                    diseaseOrCondition: diseaseResult.diseaseName,
                    confidence: diseaseResult.confidence,
                    severity: diseaseResult.severity,
                    description: diseaseResult.description,
                    activeIngredientsRecommended: diseaseResult.recommendedActiveIngredients,
                    treatmentPlan: diseaseResult.treatmentSuggestions.join('; ')
                },
                author: {
                    uid: currentUser?.id || 'uid-anon',
                    displayName: currentUser?.displayName || currentUser?.username || 'Agronomist',
                    role: currentUser?.role || 'Senior Agronomist'
                },
                verifiedByAgronomist: true,
                verificationNotes,
                imageUrl: selectedImage?.slice(0, 100) // snippet
            });

            toast.success(isKa ? 'დიაგნოზი ჩაიწერა კლინიკურ ისტორიაში!' : 'Diagnosis committed to Agronomic Clinical Ledger!');
            setDiseaseResult(null);
            setSelectedImage(null);
            setVerificationNotes('');
            runBtAudit(); // Refresh audit memory
        } catch (err: any) {
            toast.error(err?.message || 'Failed to commit record.');
        } finally {
            setCommitting(false);
        }
    };

    const runGodAiBenchmark = async () => {
        setGodAiLoading(true);
        try {
            const res = await appEngine.request<any, RootGodAiBenchmarkResult>('ROOT_GOD_AI_BENCHMARK', {
                isSystemAdmin: Boolean(isSystemAdmin)
            });
            setGodAiResult(res);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to query Root God AI.');
        } finally {
            setGodAiLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 rounded-2xl backdrop-blur-md">
                            <Activity className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-black text-lg uppercase tracking-tight">
                                    {isKa ? 'აგრონომიული კლინიკური ლაბორატორია' : 'Agronomic Clinical History & AI Lab'}
                                </h2>
                                <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                    {isKa ? 'ტენანტ-იზოლირებული' : 'Tenant-Isolated'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                                {isKa ? 'დიაგნოსტიკური ისტორია • Bt აუდიტი • God AI ანალიტიკა' : 'Clinical Diagnostic Ledger • Bt Audit Pipeline • God AI Intelligence'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white/80 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('AUDIT')}
                        className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                            activeTab === 'AUDIT'
                                ? 'bg-white text-emerald-800 border-emerald-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 border-transparent'
                        }`}
                    >
                        <History className="h-4 w-4" />
                        {isKa ? 'Bt ისტორიული მეხსიერება' : 'Bt Audit Memory'}
                    </button>

                    <button
                        onClick={() => setActiveTab('DISEASE')}
                        className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                            activeTab === 'DISEASE'
                                ? 'bg-white text-emerald-800 border-emerald-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 border-transparent'
                        }`}
                    >
                        <Camera className="h-4 w-4" />
                        {isKa ? 'ფოთლის დიაგნოსტიკა' : 'Vision Diagnostic Lab'}
                    </button>

                    {isSystemAdmin && (
                        <button
                            onClick={() => {
                                setActiveTab('GOD_AI');
                                if (!godAiResult) runGodAiBenchmark();
                            }}
                            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                                activeTab === 'GOD_AI'
                                    ? 'bg-white text-indigo-800 border-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 border-transparent'
                            }`}
                        >
                            <Globe2 className="h-4 w-4 text-indigo-600" />
                            {isKa ? 'Root "God AI" ანალიტიკა' : 'Root "God AI" Vault'}
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* TAB 1: BT AUDIT MEMORY PIPELINE */}
                    {activeTab === 'AUDIT' && (
                        <div className="space-y-5">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                                <div className="flex-1 w-full sm:w-auto">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                        {isKa ? 'აქტიური ნივთიერების ძიება' : 'Search Active Ingredient History'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={auditIngredient}
                                            onChange={(e) => setAuditIngredient(e.target.value)}
                                            placeholder="e.g. Bacillus thuringiensis, Copper sulfate..."
                                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                                    </div>
                                </div>
                                <button
                                    onClick={() => runBtAudit()}
                                    disabled={auditLoading}
                                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                    {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    {isKa ? 'აუდიტის გაშვება' : 'Query History'}
                                </button>
                            </div>

                            {/* Audit Summary Banner */}
                            {auditResult && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                                        <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-black text-xs text-emerald-950 uppercase tracking-wider">
                                                {isKa ? 'მიზეზ-შედეგობრივი ისტორიის დასკვნა' : 'Cause-and-Effect Historical Assessment'}
                                            </h4>
                                            <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                                                {auditResult.executiveSummary}
                                            </p>
                                            <div className="flex items-center gap-4 mt-3 text-[11px] font-bold text-emerald-800">
                                                <span>{isKa ? 'სულ შესხურება' : 'Total Interventions'}: {auditResult.totalApplications}</span>
                                                <span>•</span>
                                                <span>{isKa ? 'ვერიფიცირებული' : 'Verified'}: {auditResult.verifiedInterventions}</span>
                                                <span>•</span>
                                                <span>{isKa ? 'საშუალო აღდგენა' : 'Avg Recovery'}: {auditResult.averageRecoveryRatePercent}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Records Table */}
                                    <div className="space-y-2">
                                        <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider">
                                            {isKa ? 'კლინიკური ჩანაწერების რეესტრი' : 'Clinical History Ledger Records'}
                                        </h4>
                                        {auditResult.records.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                                                {isKa ? 'ჩანაწერები არ მოიძებნა ამ ნივთიერებისთვის.' : 'No recorded interventions found for this ingredient.'}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {auditResult.records.map((rec, i) => (
                                                    <div key={i} className="p-4 bg-white border border-slate-200 rounded-2xl text-xs space-y-2 shadow-sm">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-slate-900">{rec.activeIngredient}</span>
                                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                                    {rec.sectorName}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                                {rec.canopyRecoveryRate}% {isKa ? 'აღდგენა' : 'Canopy Recovery'}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1">
                                                            <div>
                                                                <span className="text-slate-400 block text-[9px] uppercase font-bold">{isKa ? 'დოზირება' : 'Dosage'}</span>
                                                                <span className="font-bold text-slate-800">{rec.dosageApplied}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 block text-[9px] uppercase font-bold">{isKa ? 'სიმპტომი' : 'Condition'}</span>
                                                                <span className="font-bold text-slate-800">{rec.reportedCondition}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 block text-[9px] uppercase font-bold">{isKa ? 'ავტორი / აგრონომი' : 'Author'}</span>
                                                                <span className="font-bold text-slate-800">{rec.authorName}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 block text-[9px] uppercase font-bold">{isKa ? 'თარიღი' : 'Date'}</span>
                                                                <span className="font-bold text-slate-800">{new Date(rec.date).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: VISION DIAGNOSTIC LAB */}
                    {activeTab === 'DISEASE' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Upload Box */}
                                <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                                    {selectedImage ? (
                                        <div className="space-y-3 w-full">
                                            <img 
                                                src={selectedImage} 
                                                alt="Leaf sample" 
                                                className="h-48 w-full object-cover rounded-xl border border-slate-200" 
                                            />
                                            <label className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer block">
                                                {isKa ? 'სხვა ფოტოს არჩევა' : 'Choose another photo'}
                                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                            </label>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer space-y-2">
                                            <Upload className="h-10 w-10 text-slate-400 mx-auto" />
                                            <p className="font-black text-xs text-slate-700 uppercase">
                                                {isKa ? 'დააჭირეთ ფოთლის ფოტოს ასატვირთად' : 'Click to Upload Plant Leaf Photo'}
                                            </p>
                                            <p className="text-[10px] text-slate-400">JPG, PNG, WebP</p>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                        </label>
                                    )}
                                </div>

                                {/* Action / Results */}
                                <div className="space-y-3">
                                    <button
                                        onClick={runDiseaseDiagnosis}
                                        disabled={!selectedImage || diagnosing}
                                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {diagnosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        {isKa ? 'კლინიკური დიაგნოსტიკის გაშვება' : 'Run Clinical Diagnosis'}
                                    </button>

                                    {diseaseResult && (
                                        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-black text-sm text-slate-900">{diseaseResult.diseaseName}</h4>
                                                <span className="text-[10px] font-black uppercase bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full">
                                                    {(diseaseResult.confidence * 100).toFixed(0)}% Match
                                                </span>
                                            </div>

                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                {diseaseResult.description}
                                            </p>

                                            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                                                <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest block">
                                                    {isKa ? 'რეკომენდებული აქტიური ნივთიერებები' : 'Recommended Active Ingredients'}
                                                </span>
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {diseaseResult.recommendedActiveIngredients.map((ing, idx) => (
                                                        <span key={idx} className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                                            {ing}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Verification and Commit */}
                                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                                <input
                                                    type="text"
                                                    value={verificationNotes}
                                                    onChange={(e) => setVerificationNotes(e.target.value)}
                                                    placeholder={isKa ? 'აგრონომის ვერიფიკაციის შენიშვნა...' : 'Agronomist verification note...'}
                                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                                                />
                                                <button
                                                    onClick={commitToClinicalLedger}
                                                    disabled={committing}
                                                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                                >
                                                    {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                                                    {isKa ? 'კლინიკურ ისტორიაში ჩაწერა' : 'Commit to Agronomic Ledger'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: ROOT GOD AI VAULT (SYSTEM ADMIN ONLY) */}
                    {activeTab === 'GOD_AI' && isSystemAdmin && (
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-start gap-3">
                                <Globe2 className="h-5 w-5 text-indigo-700 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-black text-xs text-indigo-950 uppercase tracking-wider">
                                        Root "God AI" Global Anonymized Intelligence Vault
                                    </h4>
                                    <p className="text-xs text-indigo-900 mt-1 leading-relaxed">
                                        Aggregates cross-tenant efficacy data with strict privacy preservation: company names, exact coordinates, and financials are completely stripped. Preserves crop variety, microclimate, and treatment recovery correlations.
                                    </p>
                                </div>
                            </div>

                            {godAiLoading && (
                                <div className="text-center py-10">
                                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
                                    <p className="text-xs font-bold text-slate-600 mt-2">Compiling global ML benchmark statistics...</p>
                                </div>
                            )}

                            {godAiResult && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {godAiResult.cropVarietyAggregates.map((item, idx) => (
                                            <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
                                                <h5 className="font-black text-xs text-slate-900 uppercase tracking-tight">{item.variety}</h5>
                                                
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Frequent Conditions</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.commonConditions.map((c, i) => (
                                                            <span key={i} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                                                {c.condition} ({c.prevalence})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-1 pt-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Top Effective Active Ingredients</span>
                                                    {item.topActiveIngredients.map((ing, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-700 font-medium">{ing.ingredient}</span>
                                                            <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                                                {ing.averageRecoveryPercent}% avg recovery ({ing.sampleCount} trials)
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                        <h5 className="font-black text-xs text-slate-700 uppercase tracking-wider">Platform-Wide Agronomic Insights</h5>
                                        <ul className="space-y-1.5 text-xs text-slate-600">
                                            {godAiResult.platformInsights.map((insight, idx) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="text-indigo-600 font-bold">•</span>
                                                    <span>{insight}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                    <p className="text-slate-400 font-medium text-[11px]">
                        {isKa ? 'ყველა მოთხოვნა იზოლირებულია ორგანიზაციის ID-ით' : 'All queries strictly scoped to organizationId'}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] cursor-pointer"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};
