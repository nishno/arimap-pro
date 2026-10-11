import React, { useState, useEffect, useMemo } from 'react';
import { appEngine } from '../AppEventEngine';
import { SpatialAnalysisResult } from '../types';
import { PlantationFeature } from '../../types';
import { 
    Compass, 
    Layers, 
    AlertTriangle, 
    CheckCircle2, 
    TrendingUp, 
    Sparkles, 
    X, 
    Loader2, 
    MapPin, 
    Sprout, 
    ShieldCheck, 
    RefreshCw 
} from 'lucide-react';

interface SpatialAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeOrgId: string | null;
    features: PlantationFeature[];
    activeSectorId?: string;
    isKa?: boolean;
}

export const SpatialAnalysisModal: React.FC<SpatialAnalysisModalProps> = ({
    isOpen,
    onClose,
    activeOrgId,
    features,
    activeSectorId,
    isKa = false
}) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SpatialAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedSectorId, setSelectedSectorId] = useState<string>(activeSectorId || 'ALL');

    useEffect(() => {
        if (activeSectorId) {
            setSelectedSectorId(activeSectorId);
        }
    }, [activeSectorId]);

    const areaFeatures = useMemo(() => {
        return features.filter(f => f.type === 'area' || f.type === 'sector' || f.type === 'boundary');
    }, [features]);

    if (!isOpen) return null;

    const runAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await appEngine.request<any, SpatialAnalysisResult>('REQUEST_SPATIAL_ANALYSIS', {
                orgId: activeOrgId || 'org-local',
                features,
                targetSectorId: selectedSectorId === 'ALL' ? undefined : selectedSectorId
            }, 25000);
            setResult(data);
        } catch (err: any) {
            setError(err?.message || (isKa ? 'სივრცითი ანალიზის დროს მოხდა შეცდომა.' : 'Spatial analysis timed out or encountered an error.'));
        } finally {
            setLoading(false);
        }
    };

    const currentSelectedArea = areaFeatures.find(a => a.id === selectedSectorId);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 font-sans">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                            <Sparkles className="h-6 w-6 text-emerald-300" />
                        </div>
                        <div>
                            <h2 className="font-black text-lg uppercase tracking-tight">
                                {isKa ? 'AI სივრცითი და აგრონომიული ანალიზატორი' : 'AI Spatial & Agronomic Analyzer'}
                            </h2>
                            <p className="text-xs text-emerald-200 font-medium">
                                {isKa ? 'დეკომპოზირებული Worker ძრავი • Turf.js გეო-გათვლები' : 'Decoupled Worker Engine • Off-Thread Turf.js Processing'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white/80 hover:text-white"
                        title={isKa ? 'დახურვა' : 'Close'}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Target Area Selector Bar */}
                <div className="px-6 py-3 bg-slate-100/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                        <MapPin className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span className="font-extrabold text-slate-700 whitespace-nowrap uppercase tracking-wider text-[11px]">
                            {isKa ? 'გასაანალიზებელი არეალი / ნაკვეთი:' : 'Analysis Target Area / Plot:'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-[240px]">
                        <select
                            value={selectedSectorId}
                            onChange={(e) => {
                                setSelectedSectorId(e.target.value);
                                setResult(null);
                            }}
                            className="w-full bg-white border border-slate-300 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none shadow-sm cursor-pointer"
                        >
                            <option value="ALL">
                                {isKa ? '🌐 მთლიანი პლანტაცია (ყველა ნაკვეთი)' : '🌐 Entire Plantation (All Areas)'}
                            </option>
                            {areaFeatures.map(a => (
                                <option key={a.id} value={a.id}>
                                    📍 {a.name || (isKa ? 'უსახელო ნაკვეთი' : 'Unnamed Area')}
                                </option>
                            ))}
                        </select>
                    </div>
                    {currentSelectedArea && (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-lg text-[10px] font-black uppercase">
                            {isKa ? 'მონიშნულია ნაკვეთი' : 'Selected Area'}
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {!result && !loading && (
                        <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <Compass className="h-12 w-12 text-emerald-600 mx-auto mb-3 animate-pulse" />
                            <h3 className="font-black text-slate-800 text-base uppercase">
                                {isKa ? 'მზადაა სივრცითი აუდიტისთვის' : 'Ready for Spatial Diagnostic Audit'}
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                                {isKa 
                                    ? 'გაანალიზებს არჩეული ნაკვეთის საზღვრებს, აზიმუტს, რიგების ოპტიმალურ მიმართულებას, ნერგების ტევადობას ან არსებულ ნერგებს (ჯანმრთელი/საეჭვო/ხმელი) და ამოიცნობს შესავსებ ადგილებს.' 
                                    : 'Analyzes selected field boundaries, azimuth orientation, optimal trench direction, or planted seedling health status and identifies missing infill positions.'
                                }
                            </p>
                            <button
                                onClick={runAnalysis}
                                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
                            >
                                <Sparkles className="h-4 w-4" />
                                {isKa ? 'ანალიზის გაშვება' : 'Execute Spatial Analysis'}
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center py-16 space-y-3">
                            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto" />
                            <p className="font-bold text-sm text-slate-700">
                                {isKa ? 'Web Worker ამუშავებს გეო-მონაცემებს...' : 'Computing spatial geometry in background worker...'}
                            </p>
                            <p className="text-xs text-slate-400">
                                {isKa ? 'UI ძაფი არ იტვირთება, 60 FPS შენარჩუნებულია.' : 'Main thread remains responsive at 60 FPS.'}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {result && !loading && (
                        <div className="space-y-6">
                            {/* Mode Badge & Timing */}
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        result.mode === 'EMPTY_LAND' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {result.mode === 'EMPTY_LAND' 
                                            ? (isKa ? 'ცარიელი მიწის დაგეგმარება' : 'Empty Land Layout Planning') 
                                            : (isKa ? 'დარგული პლანტაციის აუდიტი' : 'Populated Plantation Audit')
                                        }
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                        {isKa ? `დამუშავდა ${result.processingTimeMs} ms-ში` : `Processed in ${result.processingTimeMs} ms`}
                                    </span>
                                </div>
                                <button
                                    onClick={runAnalysis}
                                    className="p-2 text-slate-600 hover:text-emerald-700 rounded-lg hover:bg-slate-200 transition-colors text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    {isKa ? 'განახლება' : 'Re-run'}
                                </button>
                            </div>

                            {/* EMPTY LAND VIEW */}
                            {result.mode === 'EMPTY_LAND' && result.emptyLand && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                {isKa ? 'ფართობი' : 'Total Area'}
                                            </span>
                                            <span className="text-xl font-black text-slate-900">
                                                {result.emptyLand.areaHectares} <span className="text-xs text-slate-500 font-bold">ha</span>
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                                ({result.emptyLand.areaSquareMeters.toLocaleString()} m²)
                                            </span>
                                        </div>

                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                {isKa ? 'რეკომენდებული აზიმოტი' : 'Optimal Azimuth'}
                                            </span>
                                            <span className="text-xl font-black text-emerald-700">
                                                {result.emptyLand.recommendedAzimuthDegrees}°
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                                                {result.emptyLand.dominantDirection}
                                            </span>
                                        </div>

                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                {isKa ? 'სავარაუდო რიგები' : 'Estimated Trenches'}
                                            </span>
                                            <span className="text-xl font-black text-slate-900">
                                                ~{result.emptyLand.estimatedTrenchCount}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                                @{result.emptyLand.recommendedTrenchSpacingMeters}m spacing
                                            </span>
                                        </div>

                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                {isKa ? 'ნერგების ტევადობა' : 'Seedling Capacity'}
                                            </span>
                                            <span className="text-xl font-black text-indigo-700">
                                                ~{result.emptyLand.estimatedSeedlingCapacity.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                                @{result.emptyLand.recommendedPlantSpacingMeters}m spacing
                                            </span>
                                        </div>
                                    </div>

                                    {/* Recommendations List */}
                                    <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                                        <h4 className="font-black text-xs text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-emerald-700" />
                                            {isKa ? 'აგრონომიული დაგეგმარების დასკვნა' : 'Agronomic Layout Recommendations'}
                                        </h4>
                                        <ul className="space-y-1.5 text-xs text-emerald-950">
                                            {result.emptyLand.recommendations.map((rec, idx) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="text-emerald-600 font-bold">•</span>
                                                    <span>{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* POPULATED PLANTATION VIEW */}
                            {result.mode === 'POPULATED_PLANTATION' && result.populatedLand && (
                                <div className="space-y-5">
                                    {/* High level stats */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                {isKa ? 'სულ ნერგი' : 'Total Seedlings'}
                                            </span>
                                            <span className="text-2xl font-black text-slate-900">
                                                {result.populatedLand.totalSeedlings.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                                {result.populatedLand.totalTrenches} {isKa ? 'რიგი' : 'trenches'}
                                            </span>
                                        </div>

                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">
                                                {isKa ? 'ჯანმრთელი' : 'Good / Healthy'}
                                            </span>
                                            <span className="text-2xl font-black text-emerald-700">
                                                {result.populatedLand.healthPercentage}%
                                            </span>
                                            <span className="text-[10px] text-emerald-600/80 block mt-0.5">
                                                {result.populatedLand.conditionBreakdown.good.toLocaleString()} {isKa ? 'ძირი' : 'plants'}
                                            </span>
                                        </div>

                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
                                                {isKa ? 'საეჭვო სიმპტომი' : 'Suspicious'}
                                            </span>
                                            <span className="text-2xl font-black text-amber-700">
                                                {result.populatedLand.suspiciousPercentage}%
                                            </span>
                                            <span className="text-[10px] text-amber-600/80 block mt-0.5">
                                                {result.populatedLand.conditionBreakdown.suspicious.toLocaleString()} {isKa ? 'ძირი' : 'plants'}
                                            </span>
                                        </div>

                                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-1">
                                                {isKa ? 'ხმელი / შესაცვლელი' : 'Dried / Replace'}
                                            </span>
                                            <span className="text-2xl font-black text-rose-700">
                                                {result.populatedLand.driedPercentage}%
                                            </span>
                                            <span className="text-[10px] text-rose-600/80 block mt-0.5">
                                                {result.populatedLand.conditionBreakdown.dried.toLocaleString()} {isKa ? 'ძირი' : 'plants'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* AI Insight */}
                                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl">
                                        <h4 className="font-black text-xs text-blue-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-blue-600" />
                                            {isKa ? 'ხელოვნური ინტელექტის აგრონომიული შეფასება' : 'AI Agronomic Field Vigor Assessment'}
                                        </h4>
                                        <p className="text-xs text-blue-950 font-medium leading-relaxed">
                                            {result.populatedLand.aiAgronomicInsight}
                                        </p>
                                    </div>

                                    {/* Variety Breakdown */}
                                    {Object.keys(result.populatedLand.varietyBreakdown).length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider">
                                                {isKa ? 'ჯიშობრივი განაწილება და სტატუსი' : 'Variety Breakdown & Status'}
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                {Object.entries(result.populatedLand.varietyBreakdown).map(([varName, stats]) => (
                                                    <div key={varName} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                                                        <div>
                                                            <span className="font-bold text-slate-800 block">{varName}</span>
                                                            <span className="text-[10px] text-slate-500 font-medium">
                                                                {isKa ? 'სულ' : 'Total'}: {stats.total}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] font-bold">
                                                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                                                ✓ {stats.good}
                                                            </span>
                                                            {stats.suspicious > 0 && (
                                                                <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                                                    ⚠ {stats.suspicious}
                                                                </span>
                                                            )}
                                                            {stats.dried > 0 && (
                                                                <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                                                                    ✕ {stats.dried}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Infill recommendations */}
                                    {result.populatedLand.infillRecommendations.length > 0 && (
                                        <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
                                            <h4 className="font-black text-xs text-amber-900 uppercase tracking-wider flex items-center gap-2">
                                                <Sprout className="h-4 w-4 text-amber-700" />
                                                {isKa ? 'შესავსები ადგილების გეო-იდენტიფიკაცია' : 'Targeted Trench Infill Recommendations'}
                                            </h4>
                                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                                                {result.populatedLand.infillRecommendations.map((infill, i) => (
                                                    <div key={i} className="p-2.5 bg-white border border-amber-200/70 rounded-xl text-xs flex items-center justify-between">
                                                        <div>
                                                            <span className="font-black text-slate-800">{infill.trenchName}</span>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">{infill.reason}</p>
                                                        </div>
                                                        <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                                                            +{infill.suggestedInfillCount} {isKa ? 'ძირი' : 'infill'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                    <p className="text-slate-400 font-medium text-[11px]">
                        {isKa ? 'მონაცემები იკითხება მეხსიერებიდან • რუკის კომპონენტი ხელშეუხებელია' : 'Read-only memory bridge • Map drawing engine untouched'}
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
