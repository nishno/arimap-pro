import React, { useState, useMemo } from 'react';
import type { PlantationFeature, AreaPlantationFeature, LinePlantationFeature } from '../types';
import { extractSafePoints } from '../lib/leafletSafety';
import { getSphericalPolygonArea, calculateLineLength } from '../services/geospatialService';
import { 
    Grid, MapPin, Layers, Ruler, Sprout, ChevronRight, 
    Compass, ExternalLink, ShieldAlert, Sparkles, Filter 
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface FieldSummaryWidgetProps {
    features: PlantationFeature[];
    onNavigateMode?: (mode: string) => void;
    onSelectFeature?: (id: string | null) => void;
    isExpandedView?: boolean;
}

export const FieldSummaryWidget: React.FC<FieldSummaryWidgetProps> = ({
    features = [],
    onNavigateMode,
    onSelectFeature,
    isExpandedView = false
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'overview' | 'sectors' | 'trenches' | 'parcels'>('overview');

    // Categorize and compute geometry data accurately
    const analysis = useMemo(() => {
        // 1. Parcels / Boundaries
        const parcels = features.filter(f => 
            f.type === 'area' || f.type === 'boundary' || (f as any).type === 'polygon'
        ) as AreaPlantationFeature[];

        // 2. Sectors
        const sectors = features.filter(f => 
            f.type === 'sector' || (f as any).subType === 'sector' || (f as any).isSector
        ) as AreaPlantationFeature[];

        // 3. Trenches / Rows / Irrigation Lines
        const directTrenches = features.filter(f => 
            f.type === 'trench' || f.type === 'line' || (f as any).lineType === 'row' || (f as any).type === 'trench'
        ) as LinePlantationFeature[];

        // Also check bundledLines inside parcels and sectors
        const bundledTrenches: LinePlantationFeature[] = [];
        [...parcels, ...sectors].forEach(p => {
            if (Array.isArray(p.bundledLines)) {
                bundledTrenches.push(...p.bundledLines);
            }
        });

        const allTrenches = [...directTrenches, ...bundledTrenches];

        // Compute Areas
        const computeAreaM2 = (feat: AreaPlantationFeature): number => {
            if (Number.isFinite((feat as any).areaM2) && (feat as any).areaM2 > 0) {
                return (feat as any).areaM2;
            }
            if (Number.isFinite((feat as any).areaHa) && (feat as any).areaHa > 0) {
                return (feat as any).areaHa * 10000;
            }
            const pts = extractSafePoints(feat.geometry);
            if (pts.length >= 3) {
                return getSphericalPolygonArea(pts);
            }
            return 0;
        };

        // Compute Line Length
        const computeLengthM = (line: LinePlantationFeature): number => {
            if (Number.isFinite((line as any).lengthMeters) && (line as any).lengthMeters > 0) {
                return (line as any).lengthMeters;
            }
            if (Number.isFinite((line as any).length) && (line as any).length > 0) {
                return (line as any).length;
            }
            const pts = extractSafePoints(line.geometry);
            if (pts.length >= 2) {
                return calculateLineLength(pts);
            }
            return 0;
        };

        // Parcels breakdown
        const parcelsData = parcels.map((p, idx) => {
            const areaM2 = computeAreaM2(p);
            return {
                id: p.id || `parcel-${idx}`,
                name: p.name || `Field Parcel #${idx + 1}`,
                areaM2,
                areaHa: areaM2 / 10000,
                plantCount: (p as any).plantCount || 0,
                cropVariety: p.cropVariety
            };
        });

        // Sectors breakdown
        const sectorsData = sectors.map((s, idx) => {
            const areaM2 = computeAreaM2(s);
            // Count trenches belonging to this sector
            const sectorTrenches = allTrenches.filter(t => t.parentId === s.id);
            return {
                id: s.id || `sector-${idx}`,
                name: s.name || `Sector ${String.fromCharCode(65 + (idx % 26))}${Math.floor(idx / 26) + 1}`,
                areaM2,
                areaHa: areaM2 / 10000,
                trenchCount: sectorTrenches.length,
                plantCount: (s as any).plantCount || sectorTrenches.reduce((acc, t) => acc + ((t as any).calculatedPlantCount || (t.bundledSeedlings || []).length || 0), 0),
                cropVariety: s.cropVariety || (s as any).variety || 'Blueberry (Duke/Chandler)'
            };
        });

        // Trenches breakdown
        let totalTrenchMeters = 0;
        const trenchesData = allTrenches.map((t, idx) => {
            const lenM = computeLengthM(t);
            totalTrenchMeters += lenM;
            const seedlingsCount = (t.bundledSeedlings || []).length || (t as any).calculatedPlantCount || Math.round(lenM / (t.defaultPlantSpacing || 0.8));
            return {
                id: t.id || `trench-${idx}`,
                name: t.name || `Trench #${idx + 1}`,
                lengthMeters: lenM,
                spacing: t.defaultPlantSpacing || 0.8,
                seedlingsCount,
                parentId: t.parentId,
                cropVariety: (t as any).cropVariety || 'Duke'
            };
        });

        // Farm total area (avoid double-counting if sectors are inside parcels)
        let totalAreaM2 = parcelsData.reduce((acc, p) => acc + p.areaM2, 0);
        if (totalAreaM2 === 0 && sectorsData.length > 0) {
            totalAreaM2 = sectorsData.reduce((acc, s) => acc + s.areaM2, 0);
        }

        // If totalAreaM2 is still 0 but we have trench length, estimate area from trench rows
        if (totalAreaM2 === 0 && totalTrenchMeters > 0) {
            totalAreaM2 = totalTrenchMeters * 2.5; // typical 2.5m row spacing
        }

        // Total plants
        const totalPlants = Math.max(
            parcelsData.reduce((acc, p) => acc + p.plantCount, 0),
            sectorsData.reduce((acc, s) => acc + s.plantCount, 0),
            trenchesData.reduce((acc, t) => acc + t.seedlingsCount, 0)
        );

        // Varieties
        const varieties = new Set<string>();
        [...parcels, ...sectors].forEach(f => {
            if (Array.isArray(f.cropVariety)) f.cropVariety.forEach(v => varieties.add(v));
            else if (f.cropVariety) varieties.add(f.cropVariety);
        });
        trenchesData.forEach(t => {
            if (t.cropVariety) varieties.add(t.cropVariety);
        });

        return {
            totalAreaHa: totalAreaM2 / 10000,
            totalAreaM2,
            parcelsCount: parcels.length,
            sectorsCount: sectors.length,
            trenchesCount: allTrenches.length,
            totalTrenchMeters,
            totalPlants,
            varietyCount: Math.max(varieties.size, 1),
            parcelsData,
            sectorsData,
            trenchesData
        };
    }, [features]);

    return (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 h-full flex flex-col justify-between">
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {t('dash.widget.field_summary')}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {t('field_widget.gis_verified')}
                            </span>
                        </div>
                        <p className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                            {analysis.totalAreaHa > 0 ? `${analysis.totalAreaHa.toFixed(2)} ${t('field_widget.ha')}` : t('field_widget.configured_plantation')} • {analysis.totalPlants.toLocaleString()} {t('field_widget.plants')}
                        </p>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600">
                        <Grid size={20} />
                    </div>
                </div>

                {/* KPI Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                    <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">{t('field_widget.total_area')}</span>
                        <p className="text-lg font-black text-slate-800 mt-0.5">{analysis.totalAreaHa.toFixed(2)} <span className="text-xs font-bold text-slate-500">{t('field_widget.ha')}</span></p>
                        <span className="text-[8px] font-bold text-slate-400">{(analysis.totalAreaM2).toLocaleString()} {t('field_widget.sqm')}</span>
                    </div>

                    <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">{t('field_widget.sectors')}</span>
                        <p className="text-lg font-black text-emerald-700 mt-0.5">{analysis.sectorsCount || (analysis.parcelsCount ? `${analysis.parcelsCount} ${t('field_widget.zones')}` : `1 ${t('field_widget.sector_single')}`)}</p>
                        <span className="text-[8px] font-bold text-emerald-600">{t('field_widget.active_plots')}</span>
                    </div>

                    <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">{t('field_widget.trenches_rows')}</span>
                        <p className="text-lg font-black text-blue-700 mt-0.5">{analysis.trenchesCount}</p>
                        <span className="text-[8px] font-bold text-blue-600">{(analysis.totalTrenchMeters / 1000).toFixed(2)} {t('field_widget.km_total')}</span>
                    </div>

                    <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">{t('field_widget.total_plants')}</span>
                        <p className="text-lg font-black text-slate-800 mt-0.5">{analysis.totalPlants.toLocaleString()}</p>
                        <span className="text-[8px] font-bold text-purple-600">{analysis.varietyCount} {t('field_widget.varieties')}</span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'overview' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('field_widget.overview')}
                    </button>
                    <button
                        onClick={() => setActiveTab('sectors')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'sectors' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('field_widget.sectors')} ({analysis.sectorsData.length || analysis.sectorsCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('trenches')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'trenches' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('field_widget.trenches_rows')} ({analysis.trenchesCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('parcels')}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'parcels' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t('field_widget.parcels')} ({analysis.parcelsCount})
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="max-h-[220px] overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {/* Sectors Tab */}
                    {activeTab === 'sectors' && (
                        analysis.sectorsData.length > 0 ? (
                            analysis.sectorsData.map(sector => (
                                <div key={sector.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-xs font-black text-slate-800 truncate">{sector.name}</p>
                                        <p className="text-[9px] text-slate-500 font-medium truncate mt-0.5">
                                            {typeof sector.cropVariety === 'string' ? sector.cropVariety : Array.isArray(sector.cropVariety) ? sector.cropVariety.join(', ') : t('field_widget.mixed_varieties')}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs font-black text-emerald-700 block">{sector.areaHa > 0 ? `${sector.areaHa.toFixed(2)} ${t('field_widget.ha')}` : `${sector.areaM2.toLocaleString()} ${t('field_widget.sqm')}`}</span>
                                        <span className="text-[8px] font-bold text-slate-400">{sector.trenchCount} {t('field_widget.trenches_count')} • {sector.plantCount} {t('field_widget.plants')}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-500">{t('field_widget.no_sectors')}</p>
                                <p className="text-[9px] text-slate-400 mt-1">{t('field_widget.draw_sectors_hint')}</p>
                            </div>
                        )
                    )}

                    {/* Trenches Tab */}
                    {activeTab === 'trenches' && (
                        analysis.trenchesData.length > 0 ? (
                            analysis.trenchesData.slice(0, 20).map(trench => (
                                <div key={trench.id} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                                    <div className="min-w-0 pr-2">
                                        <span className="font-black text-slate-800 truncate block">{trench.name}</span>
                                        <span className="text-[8px] text-slate-400 font-medium">{t('field_widget.spacing')}: {trench.spacing}m • {trench.cropVariety}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-black text-blue-700 block">{trench.lengthMeters.toFixed(1)} m</span>
                                        <span className="text-[8px] font-bold text-slate-500">{trench.seedlingsCount} {t('field_widget.plants')}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-500">{t('field_widget.no_trenches')}</p>
                                <p className="text-[9px] text-slate-400 mt-1">{t('field_widget.use_trench_generator')}</p>
                            </div>
                        )
                    )}

                    {/* Parcels Tab */}
                    {activeTab === 'parcels' && (
                        analysis.parcelsData.length > 0 ? (
                            analysis.parcelsData.map(p => (
                                <div key={p.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-xs font-black text-slate-800 truncate">{p.name}</p>
                                        <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                            {t('field_widget.cadastral_boundary')}
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs font-black text-slate-800 block">{p.areaHa > 0 ? `${p.areaHa.toFixed(2)} ${t('field_widget.ha')}` : `${p.areaM2.toLocaleString()} ${t('field_widget.sqm')}`}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-500">{t('field_widget.no_parcels')}</p>
                            </div>
                        )
                    )}

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-2">
                            <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/80 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Compass size={16} className="text-emerald-600" />
                                    <div>
                                        <span className="text-xs font-black text-slate-800 block">{t('field_widget.cadastral_geometry')}</span>
                                        <span className="text-[9px] text-slate-500 font-medium">{t('field_widget.spherical_calc')}</span>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl">
                                    {t('field_widget.active')}
                                </span>
                            </div>

                            <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100/80 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Ruler size={16} className="text-blue-600" />
                                    <div>
                                        <span className="text-xs font-black text-slate-800 block">{t('field_widget.total_linear_infra')}</span>
                                        <span className="text-[9px] text-slate-500 font-medium">{t('field_widget.trench_rows_pathways')}</span>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-xl">
                                    {(analysis.totalTrenchMeters).toFixed(0)} m
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Operational Footer Actions */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-2">
                <button
                    onClick={() => {
                        if (onNavigateMode) onNavigateMode('design');
                        else window.dispatchEvent(new CustomEvent('agrimap_set_mode', { detail: 'design' }));
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shadow-emerald-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                    <span>{t('field_widget.open_gis_tool')}</span>
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
};
