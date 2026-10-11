
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { HarvestEvent, AreaPlantationFeature, YieldByVariety, HarvestLog, PlantationFeature, LinePlantationFeature, YieldEntry } from '../types';
import { isValidCoordinate } from '../types';
import { XCircleIcon, PlusIcon, TrashIcon, TagIcon } from './Icons';
import { getSphericalPolygonArea } from '../services/geospatialService';
import L from 'leaflet';
import { useLanguage } from '../contexts/LanguageContext';
import '../lib/leafletSafety';
import { extractSafePoints } from '../lib/leafletSafety';

const parseSafeGeometry = (geom: any): [number, number][] => {
    return extractSafePoints(geom);
};

interface HarvestLogModalProps {
    event: HarvestEvent;
    geometry: [number, number][];
    date: string;
    sectors: AreaPlantationFeature[];
    onSave: (log: Omit<HarvestLog, 'id'>) => void;
    onClose: () => void;
    plantationFeatures: PlantationFeature[];
    varieties?: string[];
    initialData?: Partial<HarvestLog>;
}

const HarvestLogModal: React.FC<HarvestLogModalProps> = ({ event, geometry, date, sectors, onSave, onClose, plantationFeatures, varieties = [], initialData }) => {
    const { t, formatCurrency } = useLanguage();
    const [yields, setYields] = useState<YieldByVariety[]>(() => {
        if (initialData?.yieldByVariety && initialData.yieldByVariety.length > 0) return initialData.yieldByVariety;
        if (event.yieldByVariety && event.yieldByVariety.length > 0) return event.yieldByVariety;
        return [{ variety: '', weightKg: 0, boxCount: 0, boxWeight: event.defaultBoxWeightKg || 5.8 }];
    });
    const [trenchYields, setTrenchYields] = useState<Record<string, { weight: number, boxes: number }>>(() => {
        if (initialData?.detailedYieldEntries) {
            const map: Record<string, { weight: number, boxes: number }> = {};
            initialData.detailedYieldEntries.forEach(entry => {
                map[entry.featureId] = { weight: entry.weightKg, boxes: entry.boxCount || 0 };
            });
            return map;
        }
        return {};
    });
    const [notes, setNotes] = useState(initialData?.notes || '');
    const [isDetailedView, setIsDetailedView] = useState(initialData?.detailedYieldEntries && initialData.detailedYieldEntries.length > 0 ? true : false);
    const [manualTrenchSearch, setManualTrenchSearch] = useState('');
    const [trenchRanges, setTrenchRanges] = useState<{ id: string, sectorId: string, startTrenchId: string, endTrenchId: string }[]>([]);

    const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>(event.sectorIds || []);

    const allSectorsOfPlantation = useMemo(() => {
        return (plantationFeatures || []).filter(f => f.type === 'area' || f.type === 'sector') as AreaPlantationFeature[];
    }, [plantationFeatures]);

    const updatedEventSectors = useMemo(() => {
        return allSectorsOfPlantation.filter(s => selectedSectorIds.includes(s.id));
    }, [allSectorsOfPlantation, selectedSectorIds]);

    const totalWeight = useMemo(() => yields.reduce((sum, y) => sum + (y.weightKg || 0), 0), [yields]);
    const totalBoxes = useMemo(() => yields.reduce((sum, y) => sum + (y.boxCount || 0), 0), [yields]);

    const handleAddSector = (sectorId: string) => {
        if (!selectedSectorIds.includes(sectorId)) {
            setSelectedSectorIds(prev => [...prev, sectorId]);
            // Automatically add a trench range row for this sector to satisfy user logic
            setTrenchRanges(prev => [...prev, { id: `range-${Date.now()}-${Math.random()}`, sectorId, startTrenchId: '', endTrenchId: '' }]);
            
            const sectorTrenches = allPlantationTrenches.filter(t => t.parentId === sectorId);
            if (sectorTrenches.length > 0) {
                const newTrenchYields = { ...trenchYields };
                sectorTrenches.forEach(t => {
                    if (!newTrenchYields[t.id]) {
                        newTrenchYields[t.id] = { weight: 0, boxes: 0 };
                    }
                });
                setTrenchYields(newTrenchYields);
                toast.success(`Added ${sectorTrenches.length} trenches from sector`);
            }
        }
    };

    const toggleSector = (id: string) => {
        if (selectedSectorIds.includes(id)) {
            setSelectedSectorIds(prev => prev.filter(sid => sid !== id));
        } else {
            handleAddSector(id);
        }
    };

    const handleSelectAllSectors = () => {
        const allIds = allSectorsOfPlantation.map(s => s.id);
        allIds.forEach(id => {
            if (!selectedSectorIds.includes(id)) {
                handleAddSector(id);
            }
        });
    };

    const handleDeselectAllSectors = () => {
        setSelectedSectorIds([]);
    };

    const handleSelectAllTrenches = () => {
        const newTrenchYields = { ...trenchYields };
        allSectorTrenches.forEach(t => {
            if (!newTrenchYields[t.id]) {
                newTrenchYields[t.id] = { weight: 0, boxes: 0 };
            }
        });
        setTrenchYields(newTrenchYields);
        toast.info(`Selected all ${allSectorTrenches.length} trenches`);
    };
    
    // All available trenches in relevant sectors
    const allSectorTrenches = useMemo(() => {
        const validSectorIds = updatedEventSectors.map(s => s.id);
        return plantationFeatures.filter(f => 
            f.type === 'line' && (f as LinePlantationFeature).lineType === 'row' &&
            (validSectorIds.length === 0 || validSectorIds.includes((f as LinePlantationFeature).parentId || ''))
        ) as LinePlantationFeature[];
    }, [updatedEventSectors, plantationFeatures]);

    const basePlantationTrenches = useMemo(() => {
        return plantationFeatures.filter(f => f.type === 'line' && (f as LinePlantationFeature).lineType === 'row') as LinePlantationFeature[];
    }, [plantationFeatures]);

    const [customTrenches, setCustomTrenches] = useState<LinePlantationFeature[]>([]);

    const allPlantationTrenches = useMemo(() => {
        return [...basePlantationTrenches, ...customTrenches];
    }, [basePlantationTrenches, customTrenches]);
    
    const sectorNames = updatedEventSectors.map(s => s.name).join(', ');
    const availableVarieties = useMemo(() => {
        const allVarieties = new Set<string>();
        if (varieties && varieties.length > 0) varieties.forEach(v => allVarieties.add(v));
        if (event.varieties && event.varieties.length > 0) event.varieties.forEach(v => allVarieties.add(v));
        
        // Combine varieties from all sectors
        updatedEventSectors.forEach(s => {
            if (s.cropVariety) {
                if (Array.isArray(s.cropVariety)) {
                    s.cropVariety.forEach(v => allVarieties.add(v));
                } else if (typeof s.cropVariety === 'string') {
                    allVarieties.add(s.cropVariety);
                }
            }
        });
        
        if (allVarieties.size === 0) {
            // Check all plantation features if still empty
            plantationFeatures.forEach(f => {
                const fv = (f as any).cropVariety;
                if (fv) {
                    if (Array.isArray(fv)) fv.forEach(v => allVarieties.add(v));
                    else allVarieties.add(fv);
                }
            });
        }

        if (allVarieties.size === 0) allVarieties.add('Standard');
        return Array.from(allVarieties);
    }, [updatedEventSectors, event.varieties, varieties, plantationFeatures]);

    const areaHa = useMemo(() => {
        const validGeometry = parseSafeGeometry(geometry);
        if (validGeometry.length < 3) return 0;
        return getSphericalPolygonArea(validGeometry) / 10000;
    }, [geometry]);
    
    // Auto-detected trenches
    const detectedTrenches = useMemo(() => {
        const validLogGeometry = parseSafeGeometry(geometry);
        if (validLogGeometry.length < 3) return [];
        
        try {
            // High-performance Axis-Aligned Bounding Box calculation
            let logMinLat = Infinity, logMaxLat = -Infinity;
            let logMinLng = Infinity, logMaxLng = -Infinity;
            for (const p of validLogGeometry) {
                if (p[0] < logMinLat) logMinLat = p[0];
                if (p[0] > logMaxLat) logMaxLat = p[0];
                if (p[1] < logMinLng) logMinLng = p[1];
                if (p[1] > logMaxLng) logMaxLng = p[1];
            }

            return allPlantationTrenches.filter(trench => {
                const trenchGeometry = trench.geometry;
                if (!trenchGeometry) return false;
                const validTrenchPoints = parseSafeGeometry(trenchGeometry);
                if (validTrenchPoints.length < 2) return false;

                let trenchMinLat = Infinity, trenchMaxLat = -Infinity;
                let trenchMinLng = Infinity, trenchMaxLng = -Infinity;
                for (const p of validTrenchPoints) {
                    if (p[0] < trenchMinLat) trenchMinLat = p[0];
                    if (p[0] > trenchMaxLat) trenchMaxLat = p[0];
                    if (p[1] < trenchMinLng) trenchMinLng = p[1];
                    if (p[1] > trenchMaxLng) trenchMaxLng = p[1];
                }

                // Check for Axis-Aligned Bounding Box intersection (mathematically equivalent to Leaflet's intersects)
                return !(trenchMinLat > logMaxLat || trenchMaxLat < logMinLat || trenchMinLng > logMaxLng || trenchMaxLng < logMinLng);
            });
        } catch (e) {
            console.error("High performance trench intersection failed:", e);
            return [];
        }
    }, [geometry, allPlantationTrenches, plantationFeatures]);

    const toggleTrench = (trenchId: string) => {
        setTrenchYields(prev => {
            const next = { ...prev };
            if (next[trenchId]) {
                delete next[trenchId];
            } else {
                next[trenchId] = { weight: 0, boxes: 0 };
            }
            return next;
        });
    };

    // Current working list of trenches
    const activeTrenches = useMemo(() => {
        const weighedIds = Object.keys(trenchYields);
        const uniqueIds = new Set([...detectedTrenches.map(t => t.id), ...selectedSectorIds.flatMap(sid => allPlantationTrenches.filter(tr => tr.parentId === sid).map(tr => tr.id)), ...weighedIds]);
        return allPlantationTrenches.filter(t => uniqueIds.has(t.id));
    }, [detectedTrenches, trenchYields, allPlantationTrenches, selectedSectorIds]);

    const handleYieldChange = (index: number, field: keyof YieldByVariety, value: any) => {
        const newYields = [...yields];
        (newYields[index] as any)[field] = value;
        
        // Auto-calculate weight from boxes
        const boxes = parseFloat(String(newYields[index].boxCount || 0));
        const boxWeight = parseFloat(String(newYields[index].boxWeight || 5.8));
        
        if (field === 'boxCount' || field === 'boxWeight') {
            newYields[index].weightKg = boxes * boxWeight;
        }

        // Auto-fill total from trench sums if weight is 0
        if (field === 'variety' && value && (!newYields[index].weightKg || newYields[index].weightKg === 0)) {
            const totalForVariety = activeTrenches.reduce((sum, t) => {
                const parent = plantationFeatures.find(f => f.id === t.parentId) as AreaPlantationFeature;
                let trenchVariety = '';
                if (parent && parent.cropVariety) {
                    trenchVariety = Array.isArray(parent.cropVariety) ? parent.cropVariety[0] : parent.cropVariety;
                }
                if (trenchVariety === value) return sum + (trenchYields[t.id]?.weight || 0);
                return sum;
            }, 0);
            
            if (totalForVariety > 0) {
                newYields[index].weightKg = totalForVariety;
            }
        }
        
        setYields(newYields);
    };

    const addYieldRow = () => {
        setYields([...yields, { variety: '', weightKg: 0, boxCount: 0, boxWeight: event.defaultBoxWeightKg || 5.8 }]);
    };

    const removeYieldRow = (index: number) => {
        if (yields.length > 1) {
            setYields(yields.filter((_, i) => i !== index));
        } else {
            setYields([{ variety: '', weightKg: 0, boxCount: 0, boxWeight: event.defaultBoxWeightKg || 5.8 }]);
        }
    };

    const handleTrenchYieldChange = (id: string, weight: any, boxes?: number) => {
        setTrenchYields(prev => {
            const current = prev[id] || { weight: 0, boxes: 0 };
            const next = { 
                ...prev, 
                [id]: { 
                    weight: weight, 
                    boxes: boxes !== undefined ? boxes : (Number(weight) > 0 ? current.boxes : 0)
                } 
            };
            
            // Auto-calculate weight from boxes in trench if weight is not manually set differently?
            // For now, let's just sum them up.

            const trench = allPlantationTrenches.find(t => t.id === id);
            if (trench) {
                const parent = plantationFeatures.find(f => f.id === trench.parentId) as AreaPlantationFeature;
                let trenchVariety = '';
                if (parent && parent.cropVariety) {
                    trenchVariety = Array.isArray(parent.cropVariety) ? parent.cropVariety[0] : parent.cropVariety;
                }

                const totalForThisVariety = Object.entries(next).reduce((sum, [tid, res]) => {
                    const t = allPlantationTrenches.find(tr => tr.id === tid);
                    if (t) {
                        const p = plantationFeatures.find(f => f.id === t.parentId) as AreaPlantationFeature;
                        const v = p && p.cropVariety ? (Array.isArray(p.cropVariety) ? p.cropVariety[0] : p.cropVariety) : '';
                        if (v === trenchVariety || (!v && !trenchVariety)) return sum + res.weight;
                    }
                    return sum;
                }, 0);

                if (trenchVariety) {
                    setYields(prevYields => {
                        const existingIdx = prevYields.findIndex(y => y.variety === trenchVariety);
                        if (existingIdx > -1) {
                            const newYields = [...prevYields];
                            newYields[existingIdx].weightKg = totalForThisVariety;
                            return newYields;
                        } else if (prevYields.length === 1 && !prevYields[0].variety) {
                            return [{ variety: trenchVariety, weightKg: totalForThisVariety, boxCount: 0, boxWeight: event.defaultBoxWeightKg || 5.8 }];
                        } else if (weight > 0) {
                            return [...prevYields, { variety: trenchVariety, weightKg: totalForThisVariety, boxCount: 0, boxWeight: event.defaultBoxWeightKg || 5.8 }];
                        }
                        return prevYields;
                    });
                } else if (yields.length === 1) {
                    const totalTrenchWeight = Object.values(next).reduce((sum, res) => sum + res.weight, 0);
                    const newYields = [...yields];
                    newYields[0].weightKg = totalTrenchWeight;
                    setYields(newYields);
                }
            }
            
            return next;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validYields = yields.filter(y => y.variety && (y.weightKg > 0 || (y.boxCount || 0) > 0));
        if(validYields.length === 0) {
            toast.error("Please enter at least one valid yield entry.");
            return;
        }

        const detailedEntries: YieldEntry[] = Object.entries(trenchYields)
            .filter(([_, res]) => res.weight > 0 || res.boxes > 0)
            .map(([id, res]) => {
                const trench = allPlantationTrenches.find(t => t.id === id);
                return {
                    featureId: id,
                    featureName: trench?.name || 'Unknown Trench',
                    weightKg: res.weight,
                    boxCount: res.boxes,
                    boxWeight: event.defaultBoxWeightKg || 5.8,
                    variety: yields.find(y => {
                        const p = plantationFeatures.find(f => f.id === trench?.parentId) as AreaPlantationFeature;
                        const v = p && p.cropVariety ? (Array.isArray(p.cropVariety) ? p.cropVariety[0] : p.cropVariety) : '';
                        return v === y.variety;
                    })?.variety || yields[0]?.variety || 'Unknown'
                };
            });

        onSave({
            harvestEventId: event.id,
            date: new Date(date).toISOString(),
            geometry,
            areaHa,
            yieldByVariety: validYields,
            detailedYieldEntries: detailedEntries,
            notes,
            sectorIds: selectedSectorIds,
        });
    };

    const trenchSearchResults = manualTrenchSearch.length > 0 
        ? allPlantationTrenches.filter(t => 
            (t.name?.toLowerCase().includes(manualTrenchSearch.toLowerCase()) || 
             (plantationFeatures.find(f => f.id === t.parentId)?.name?.toLowerCase().includes(manualTrenchSearch.toLowerCase()))) 
            && !activeTrenches.find(at => at.id === t.id)
          ).slice(0, 5)
        : [];

    const varietySearchResults = manualTrenchSearch.length > 0
        ? availableVarieties.filter(v => v.toLowerCase().includes(manualTrenchSearch.toLowerCase()))
            .map(v => ({ id: `v-${v}`, name: v, type: 'variety' as const }))
            .slice(0, 3)
        : [];

    const handleAddVarietyTrenches = (variety: string) => {
        const trenchesToAdd = allPlantationTrenches.filter(t => {
            const parent = plantationFeatures.find(f => f.id === t.parentId) as AreaPlantationFeature;
            const v = parent && parent.cropVariety ? (Array.isArray(parent.cropVariety) ? parent.cropVariety[0] : parent.cropVariety) : '';
            return v === variety && !activeTrenches.find(at => at.id === t.id);
        });

        if (trenchesToAdd.length > 0) {
            const newTrenchYields = { ...trenchYields };
            trenchesToAdd.forEach(t => {
                newTrenchYields[t.id] = { weight: 0, boxes: 0 };
            });
            setTrenchYields(newTrenchYields);
            toast.success(`Added ${trenchesToAdd.length} trenches of ${variety}`);
        } else {
            toast.info(`All trenches of ${variety} are already added`);
        }
        setManualTrenchSearch('');
    };

    const addRangeRow = () => {
        setTrenchRanges([...trenchRanges, { id: `range-${Date.now()}-${Math.random()}`, sectorId: selectedSectorIds[0] || '', startTrenchId: '', endTrenchId: '' }]);
    };

    const removeRangeRow = (id: string) => {
        setTrenchRanges(prev => prev.filter(r => r.id !== id));
    };

    const updateRangeEntry = (id: string, field: string, value: string) => {
        setTrenchRanges(prev => prev.map(r => {
            if (r.id === id) {
                const next = { ...r, [field]: value };
                if (field === 'sectorId') {
                    next.startTrenchId = '';
                    next.endTrenchId = '';
                }
                return next;
            }
            return r;
        }));
    };

    const applyRangesToYields = () => {
        const newTrenchYields = { ...trenchYields };
        let addedCount = 0;
        const newlyCreatedTrenches: LinePlantationFeature[] = [];

        const getOrCreateTrenchByName = (sectorId: string, nameOrId: string, customList: LinePlantationFeature[]) => {
            const existing = [...basePlantationTrenches, ...customList, ...customTrenches].find(t => 
                t.parentId === sectorId && (t.id === nameOrId || t.name === nameOrId)
            );
            if (existing) return { trench: existing, isNew: false as const };

            const newT: LinePlantationFeature = {
                id: `custom-trench-${sectorId}-${nameOrId}`,
                parentId: sectorId,
                name: nameOrId,
                type: 'line',
                lineType: 'row',
                layerId: 'custom-layer',
                geometry: []
            };
            return { trench: newT, isNew: true as const };
        };

        trenchRanges.forEach(range => {
            if (!range.startTrenchId || !range.endTrenchId || !range.sectorId) return;

            const { trench: startTrench, isNew: isStartNew } = getOrCreateTrenchByName(range.sectorId, range.startTrenchId, newlyCreatedTrenches);
            if (isStartNew) newlyCreatedTrenches.push(startTrench);

            const { trench: endTrench, isNew: isEndNew } = getOrCreateTrenchByName(range.sectorId, range.endTrenchId, newlyCreatedTrenches);
            if (isEndNew) newlyCreatedTrenches.push(endTrench);

            const startVal = startTrench.name;
            const endVal = endTrench.name;
            const isStartNumeric = /^\d+$/.test(startVal);
            const isEndNumeric = /^\d+$/.test(endVal);

            if (isStartNumeric && isEndNumeric) {
                const sNum = parseInt(startVal, 10);
                const eNum = parseInt(endVal, 10);
                const min = Math.min(sNum, eNum);
                const max = Math.max(sNum, eNum);

                for (let i = min; i <= max; i++) {
                    const tName = `${i}`;
                    const { trench: t, isNew } = getOrCreateTrenchByName(range.sectorId, tName, newlyCreatedTrenches);
                    if (isNew) {
                        newlyCreatedTrenches.push(t);
                    }
                    if (!newTrenchYields[t.id]) {
                        newTrenchYields[t.id] = { weight: 0, boxes: 0 };
                        addedCount++;
                    }
                }
            } else {
                const sectorTrenches = [...basePlantationTrenches, ...newlyCreatedTrenches, ...customTrenches]
                    .filter(t => t.parentId === range.sectorId)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));

                const startIndex = sectorTrenches.findIndex(t => t.id === startTrench.id);
                const endIndex = sectorTrenches.findIndex(t => t.id === endTrench.id);

                if (startIndex !== -1 && endIndex !== -1) {
                    const [minIdx, maxIdx] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
                    const rangeTrenches = sectorTrenches.slice(minIdx, maxIdx + 1);

                    rangeTrenches.forEach(t => {
                        if (!newTrenchYields[t.id]) {
                            newTrenchYields[t.id] = { weight: 0, boxes: 0 };
                            addedCount++;
                        }
                    });
                } else {
                    if (!newTrenchYields[startTrench.id]) {
                        newTrenchYields[startTrench.id] = { weight: 0, boxes: 0 };
                        addedCount++;
                    }
                    if (!newTrenchYields[endTrench.id]) {
                        newTrenchYields[endTrench.id] = { weight: 0, boxes: 0 };
                        addedCount++;
                    }
                }
            }
        });

        if (newlyCreatedTrenches.length > 0) {
            setCustomTrenches(prev => [...prev, ...newlyCreatedTrenches]);
        }

        if (addedCount > 0) {
            setTrenchYields(newTrenchYields);
            toast.success(`Synchronized ${addedCount} new trenches from ranges.`);
            setTrenchRanges([]);
        } else {
            toast.info("No new trenches found in ranges.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[5000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Log Daily Harvest</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Automated Weight Calculation</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <XCircleIcon className="h-7 w-7 text-slate-300" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="p-6 space-y-6 overflow-y-auto">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Harvest Event</p>
                                    <p className="text-xs font-bold text-slate-800">{event.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Date</p>
                                    <p className="text-xs font-bold text-slate-800">{new Date(date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 pt-3 flex justify-between items-end">
                                <div>
                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Operational Area</p>
                                    <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                                        {sectorNames || 'ALL AREAS'}
                                    </p>
                                </div>
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black italic">{areaHa.toFixed(3)} HA</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Yield per Variety</h3>
                            <button 
                                type="button" 
                                onClick={() => setIsDetailedView(!isDetailedView)}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all ${isDetailedView ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {isDetailedView ? 'Hide Details' : 'Detailed View (Trenches)'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {yields.map((y, index) => (
                                <div key={index} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Crop Variety</label>
                                            <select 
                                                value={y.variety} 
                                                onChange={e => handleYieldChange(index, 'variety', e.target.value)} 
                                                className="w-full p-2.5 bg-slate-50 rounded-xl font-black text-xs outline-none border border-transparent focus:border-blue-400 transition-all uppercase"
                                            >
                                                <option value="">Select Variety</option>
                                                {availableVarieties.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                        <div className="ml-4">
                                            <button type="button" onClick={() => removeYieldRow(index)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                                <TrashIcon size={18}/>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="relative">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Boxes</label>
                                            <input 
                                                type="number" 
                                                placeholder="0"
                                                value={y.boxCount || ''} 
                                                onChange={e => handleYieldChange(index, 'boxCount', e.target.value === '' ? '' : parseInt(e.target.value) || 0)} 
                                                className="w-full p-2.5 bg-slate-50 rounded-xl font-black text-xs text-center border border-transparent focus:border-blue-400" 
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Weight/Box</label>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                value={y.boxWeight || 5.8} 
                                                onChange={e => handleYieldChange(index, 'boxWeight', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} 
                                                className="w-full p-2.5 bg-slate-50 rounded-xl font-black text-xs text-center border border-transparent focus:border-blue-400" 
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Net Weight</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    step="0.1" 
                                                    value={y.weightKg || ''} 
                                                    onChange={e => handleYieldChange(index, 'weightKg', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} 
                                                    className="w-full p-2.5 bg-green-50 text-green-700 rounded-xl font-black text-xs text-right pr-8 border border-green-100" 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-green-300 uppercase">KG</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={addYieldRow} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 hover:border-blue-200 hover:text-blue-500 transition-all bg-slate-50/30">
                                <PlusIcon className="h-4 w-4"/> Add Another Variety
                            </button>
                        </div>
                        
                        {isDetailedView && (
                            <div className="space-y-4 pt-6 border-t border-slate-100 animate-in slide-in-from-top duration-300">
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Trench Breakdown</p>
                                        <div className="relative flex-1 max-w-xs">
                                            <input 
                                                type="text" 
                                                placeholder="SEARCH BY TRENCH OR SECTOR NAME..." 
                                                value={manualTrenchSearch}
                                                onChange={e => setManualTrenchSearch(e.target.value)}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-bold uppercase tracking-wider outline-none focus:border-blue-400 shadow-inner"
                                            />
                                            {(trenchSearchResults.length > 0 || varietySearchResults.length > 0) && (
                                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white shadow-2xl rounded-2xl z-[1003] border border-slate-100 max-h-60 overflow-y-auto p-2">
                                                    {varietySearchResults.map(v => (
                                                        <button 
                                                            key={v.id} 
                                                            type="button"
                                                            onClick={() => handleAddVarietyTrenches(v.name)}
                                                            className="w-full p-3 text-[10px] font-black text-left hover:bg-amber-50 rounded-xl uppercase flex items-center gap-2 transition-colors border-b border-slate-50"
                                                        >
                                                            <TagIcon size={12} className="text-amber-500" />
                                                            <div className="flex flex-col">
                                                                <span>Add All: {v.name}</span>
                                                                <span className="text-[7px] text-amber-600/70 font-bold">Varietal Group</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {trenchSearchResults.map(t => (
                                                        <button 
                                                            key={t.id} 
                                                            type="button"
                                                            onClick={() => {
                                                                setTrenchYields(prev => ({ ...prev, [t.id]: { weight: 0, boxes: 0 } }));
                                                                setManualTrenchSearch('');
                                                            }}
                                                            className="w-full p-3 text-[10px] font-black text-left hover:bg-indigo-50 rounded-xl uppercase flex flex-col transition-colors border-b last:border-none border-slate-50"
                                                        >
                                                            <span>+ {t.name}</span>
                                                            <span className="text-[8px] text-slate-400 font-bold">{(plantationFeatures.find(f => f.id === t.parentId) as any)?.name || 'Unknown Sector'}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-end mb-1">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Select Sectors</p>
                                                    <span className="text-[8px] text-slate-300 font-bold uppercase tracking-tight">Active for this event</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={handleSelectAllSectors} 
                                                        className="px-2 py-1 bg-blue-50 text-[8px] font-black text-blue-600 uppercase tracking-widest rounded border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1"
                                                    >
                                                        <PlusIcon size={10} /> Add All Sectors
                                                    </button>
                                                    <span className="text-gray-300">|</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={handleDeselectAllSectors} 
                                                        className="px-2 py-1 bg-red-50 text-[8px] font-black text-red-600 uppercase tracking-widest rounded border border-red-100 hover:bg-red-100 transition-colors"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded-xl bg-white shadow-inner custom-scrollbar mt-2">
                                                {allSectorsOfPlantation.map(s => {
                                                    const isSelected = selectedSectorIds.includes(s.id);
                                                    return (
                                                        <div 
                                                            key={s.id} 
                                                            onClick={() => toggleSector(s.id)} 
                                                            className={`p-2 rounded border cursor-pointer flex items-center gap-2 text-[10px] transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-100 hover:bg-gray-100'}`}
                                                        >
                                                            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                            </div>
                                                            <span className={`truncate font-bold uppercase ${isSelected ? 'text-indigo-800' : 'text-slate-500'}`}>{s.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Dynamic Multi-Range Selector */}
                                        <fieldset className="p-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 mt-4 space-y-4">
                                            <legend className="px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Multi-Sector Trench Range Registry</legend>
                                            
                                            {trenchRanges.map((range) => (
                                                <div key={range.id} className="p-3 bg-white border border-slate-200 rounded-2xl space-y-3 relative group/range">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeRangeRow(range.id)}
                                                        className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/range:opacity-100 transition-opacity"
                                                    >
                                                        <TrashIcon size={12} />
                                                    </button>

                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Target Sector</label>
                                                        <select 
                                                            value={range.sectorId} 
                                                            onChange={e => updateRangeEntry(range.id, 'sectorId', e.target.value)}
                                                            className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            <option value="">Select Sector...</option>
                                                            {allSectorsOfPlantation.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                        </select>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Start Point</label>
                                                            <input 
                                                                type="text"
                                                                list={`start-trench-list-${range.id}`}
                                                                value={range.startTrenchId} 
                                                                onChange={e => updateRangeEntry(range.id, 'startTrenchId', e.target.value)}
                                                                disabled={!range.sectorId}
                                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-30"
                                                                placeholder="Type or select start..."
                                                            />
                                                            <datalist id={`start-trench-list-${range.id}`}>
                                                                {allPlantationTrenches.filter(t => t.parentId === range.sectorId).map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-black text-slate-400 uppercase ml-1">End Point</label>
                                                            <input 
                                                                type="text"
                                                                list={`end-trench-list-${range.id}`}
                                                                value={range.endTrenchId} 
                                                                onChange={e => updateRangeEntry(range.id, 'endTrenchId', e.target.value)}
                                                                disabled={!range.sectorId}
                                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-30"
                                                                placeholder="Type or select end..."
                                                            />
                                                            <datalist id={`end-trench-list-${range.id}`}>
                                                                {allPlantationTrenches.filter(t => t.parentId === range.sectorId).map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            <div className="flex gap-2">
                                                <button 
                                                    type="button"
                                                    onClick={addRangeRow}
                                                    className="flex-1 py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-slate-300 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <PlusIcon size={12} /> Add Trench Range
                                                </button>
                                                
                                                {trenchRanges.length > 0 && (
                                                    <button 
                                                        type="button"
                                                        onClick={applyRangesToYields}
                                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                                    >
                                                        Confirm & Sync Ranges
                                                    </button>
                                                )}
                                            </div>
                                        </fieldset>

                                        <div className="space-y-1 mt-4">
                                            <div className="flex justify-between items-end mb-1">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Select Individual Trenches</p>
                                                    <span className="text-[8px] text-slate-300 font-bold uppercase tracking-tight">Manual Multi-selection</span>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={handleSelectAllTrenches} 
                                                    className="px-3 py-1 bg-blue-50 text-[9px] font-black text-blue-600 uppercase tracking-widest rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm"
                                                >
                                                    Select All
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border p-2 rounded-xl bg-white shadow-inner custom-scrollbar mt-2">
                                                {allPlantationTrenches.filter(t => selectedSectorIds.length === 0 || selectedSectorIds.includes(t.parentId || '')).map(t => {
                                                    const isSelected = !!trenchYields[t.id];
                                                    return (
                                                        <div 
                                                            key={t.id} 
                                                            onClick={() => toggleTrench(t.id)} 
                                                            className={`p-2 rounded border cursor-pointer flex items-center gap-2 text-[9px] transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-100 hover:bg-gray-100'}`}
                                                        >
                                                            <div className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                                {isSelected && <div className="w-1 h-1 bg-white rounded-full" />}
                                                            </div>
                                                            <span className={`truncate font-black uppercase ${isSelected ? 'text-indigo-800' : 'text-slate-500'}`}>{t.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {activeTrenches.map(t => {
                                        const parent = plantationFeatures.find(f => f.id === t.parentId) as AreaPlantationFeature;
                                        const variety = parent && parent.cropVariety ? (Array.isArray(parent.cropVariety) ? parent.cropVariety[0] : parent.cropVariety) : '';
                                        const isDetected = detectedTrenches.some(dt => dt.id === t.id);
                                        
                                        return (
                                            <div key={t.id} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{t.name}</span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${isDetected ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-700'}`}>{isDetected ? 'detected' : 'manual'}</span>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">{variety || 'Unknown Variety'} • {parent?.name}</p>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const next = { ...trenchYields };
                                                            delete next[t.id];
                                                            setTrenchYields(next);
                                                        }}
                                                        className="text-slate-300 hover:text-red-500 p-2"
                                                    >
                                                        <XCircleIcon size={20} />
                                                    </button>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative">
                                                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1">BOXES</p>
                                                        <input 
                                                            type="number" 
                                                            value={trenchYields[t.id]?.boxes || ''}
                                                            onChange={e => {
                                                                const boxes = parseInt(e.target.value) || 0;
                                                                const weight = boxes * (event.defaultBoxWeightKg || 5.8);
                                                                handleTrenchYieldChange(t.id, weight, boxes);
                                                            }}
                                                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-center focus:border-blue-400"
                                                        />
                                                    </div>
                                                    <div className="relative">
                                                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1 text-right">WEIGHT (KG)</p>
                                                        <input 
                                                            type="number" 
                                                            step="0.1"
                                                            value={trenchYields[t.id]?.weight || ''}
                                                            onChange={e => handleTrenchYieldChange(t.id, e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                                            className="w-full p-2 text-right bg-white border border-slate-200 rounded-xl text-[10px] font-black focus:border-blue-400"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {activeTrenches.length === 0 && (
                                        <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-3xl border-dashed">
                                            <p className="text-slate-400 font-bold text-xs italic uppercase tracking-widest">No trenches identified</p>
                                            <p className="text-[9px] text-slate-300 font-bold uppercase mt-1">Search to add manual records</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Additional Notes</label>
                            <textarea 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                placeholder="WEATHER CONDITIONS, CREW NOTES, LOGISTICS DETAILS..."
                                className="w-full rounded-2xl p-4 bg-slate-50 border border-slate-100 text-xs font-medium focus:bg-white transition-all outline-none min-h-[100px] shadow-inner" 
                                rows={3}
                            ></textarea>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-b-3xl border-t border-slate-200 flex justify-end gap-3 items-center">
                        <div className="mr-auto grid grid-cols-2 gap-8">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Weight</p>
                                <p className="text-xl font-black text-slate-900">{totalWeight.toFixed(1)} <span className="text-xs">KG</span></p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Boxes</p>
                                <p className="text-xl font-black text-slate-900">{totalBoxes} <span className="text-xs">BXS</span></p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 active:scale-95 transition-all">
                            Save Harvest Log
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};

export default HarvestLogModal;
