import React, { useState, useEffect, useMemo } from 'react';
import type { Layer, Crop, FeatureType, PlantationFeature } from '../types';
import { XIcon, TrashIcon } from './Icons';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export interface WalkPath {
    id: string;
    name: string;
    geometry: [number, number][];
    timestamp: string;
    selected?: boolean;
}

interface WalkTrackingPanelProps {
    isOpen: boolean;
    onClose: () => void;
    layers: Layer[];
    crops: Crop[];
    features?: PlantationFeature[];
    
    // GPS active tracking states
    isTracking: boolean;
    trackedPoints: [number, number][];
    onToggleTracking: (active: boolean) => void;
    onClearCurrentTrack: () => void;
    onSaveCurrentTrack: (name: string) => void;
    
    // Recorded walks list
    walkedPaths: WalkPath[];
    onUpdateWalkedPaths: (paths: WalkPath[]) => void;
    
    // Core conversion
    onRegisterFeature: (params: {
        name: string;
        type: FeatureType | 'boundary' | 'plant-sequence';
        geometry: [number, number][];
        layerId: string;
        color: string;
        cropType?: string;
        plantSpacing?: number;
    }) => void;

    onSetFlyToBounds: (bounds: [number, number][]) => void;
}

// Distance helper between two coordinates in meters
const getDistanceMeters = (p1: [number, number], p2: [number, number]): number => {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = p1[0] * Math.PI / 180;
    const phi2 = p2[0] * Math.PI / 180;
    const deltaPhi = (p2[0] - p1[0]) * Math.PI / 180;
    const deltaLambda = (p2[1] - p1[1]) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

// Calculate total polyline length
const calculatePathLength = (coords: [number, number][]): number => {
    let length = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        length += getDistanceMeters(coords[i], coords[i + 1]);
    }
    return length;
};

export const WalkTrackingPanel: React.FC<WalkTrackingPanelProps> = ({
    isOpen,
    onClose,
    layers,
    crops,
    features = [],
    isTracking,
    trackedPoints,
    onToggleTracking,
    onClearCurrentTrack,
    onSaveCurrentTrack,
    walkedPaths,
    onUpdateWalkedPaths,
    onRegisterFeature,
    onSetFlyToBounds
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [newWalkName, setNewWalkName] = useState('');
    const [splitMeters, setSplitMeters] = useState('50');
    const [plantSpacing, setPlantSpacing] = useState('2.0');
    
    // Registration form states
    const [registeringPathId, setRegisteringPathId] = useState<string | null>(null);
    const [regName, setRegName] = useState('');
    const [regType, setRegType] = useState<FeatureType | 'boundary' | 'plant-sequence'>('line');
    const [regLayerId, setRegLayerId] = useState('');
    const [regColor, setRegColor] = useState('#22c55e');
    const [regCrop, setRegCrop] = useState('');

    // Pre-populate standard registration parameters
    useEffect(() => {
        if (registeringPathId) {
            const found = walkedPaths.find(p => p.id === registeringPathId);
            if (found) {
                setRegName(found.name);
            }
        }
        if (layers.length > 0 && !regLayerId) {
            setRegLayerId(layers[0].id);
        }
    }, [registeringPathId, walkedPaths, layers]);

    const activeTrackLength = useMemo(() => {
        return calculatePathLength(trackedPoints);
    }, [trackedPoints]);

    const selectionCount = useMemo(() => {
        return walkedPaths.filter(p => p.selected).length;
    }, [walkedPaths]);

    if (!isOpen) return null;

    // Save tracking walk
    const handleStopAndSave = () => {
        if (trackedPoints.length < 2) {
            toast.error("Track must contain at least 2 coordinate points to be saved.");
            return;
        }
        const title = newWalkName.trim() || `Walk ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        onSaveCurrentTrack(title);
        setNewWalkName('');
        toast.success(`Walk path "${title}" has been successfully recorded!`);
    };

    // Toggle track selection
    const handleToggleSelectPath = (id: string) => {
        onUpdateWalkedPaths(walkedPaths.map(p => 
            p.id === id ? { ...p, selected: !p.selected } : p
        ));
    };

    const handleSelectAllPaths = () => {
        const allSelected = walkedPaths.every(p => p.selected);
        onUpdateWalkedPaths(walkedPaths.map(p => ({ ...p, selected: !allSelected })));
    };

    // Center map on a saved path bounds
    const handleCenterOnPath = (path: WalkPath) => {
        if (!path.geometry || path.geometry.length === 0) return;
        const lats = path.geometry.map(c => typeof c[0] === 'string' ? parseFloat(c[0]) : c[0]).filter(Number.isFinite);
        const lons = path.geometry.map(c => typeof c[1] === 'string' ? parseFloat(c[1]) : c[1]).filter(Number.isFinite);
        if (lats.length === 0 || lons.length === 0) return;
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        onSetFlyToBounds([
            [minLat - 0.001, minLon - 0.001],
            [maxLat + 0.001, maxLon + 0.001]
        ]);
        toast.info(`Centered on ${path.name}`);
    };

    // Merge logic
    const handleMergeWalks = () => {
        const selected = walkedPaths.filter(p => p.selected);
        if (selected.length < 2) {
            toast.warning("Select 2 or more walked paths to merge them.");
            return;
        }

        // Concatenate points of selected tracks end-to-end (connecting the closest ends dynamically or in list order)
        let mergedGeometry: [number, number][] = [];
        selected.forEach(p => {
            if (mergedGeometry.length === 0) {
                mergedGeometry = [...p.geometry];
            } else {
                // Smooth connecting: append points directly
                mergedGeometry = [...mergedGeometry, ...p.geometry];
            }
        });

        const mergedName = `Merged (${selected.map(s => s.name).join(' + ')})`.substring(0, 50) + '...';
        const newMerged: WalkPath = {
            id: `walk-${Date.now()}`,
            name: mergedName,
            geometry: mergedGeometry,
            timestamp: new Date().toISOString(),
            selected: true
        };

        const selectedIds = selected.map(s => s.id);
        const remaining = walkedPaths.filter(p => !selectedIds.includes(p.id));
        onUpdateWalkedPaths([newMerged, ...remaining]);
        toast.success(`Successfully merged ${selected.length} paths into single line!`);
    };

    // Split logic - Split in Half
    const handleSplitInHalf = (id: string) => {
        const path = walkedPaths.find(p => p.id === id);
        if (!path || path.geometry.length < 4) {
            toast.error("Path must have at least 4 coordinates to be divided.");
            return;
        }

        const mid = Math.floor(path.geometry.length / 2);
        const geom1 = path.geometry.slice(0, mid + 1);
        const geom2 = path.geometry.slice(mid);

        const path1: WalkPath = {
            id: `walk-${Date.now()}-1`,
            name: `${path.name} Part A`,
            geometry: geom1,
            timestamp: path.timestamp
        };
        const path2: WalkPath = {
            id: `walk-${Date.now()}-2`,
            name: `${path.name} Part B`,
            geometry: geom2,
            timestamp: path.timestamp
        };

        const remaining = walkedPaths.filter(p => p.id !== id);
        onUpdateWalkedPaths([path1, path2, ...remaining]);
        toast.success(`Split "${path.name}" evenly into Part A and Part B!`);
    };

    // Slicing polyline into equal distance segment chunks (e.g. split into 50m pieces)
    const handleSliceIntoSegments = (id: string) => {
        const path = walkedPaths.find(p => p.id === id);
        if (!path) return;

        const maxLen = parseFloat(splitMeters);
        if (isNaN(maxLen) || maxLen <= 5) {
            toast.error("Please enter a valid segment length greater than 5 meters.");
            return;
        }

        const coords = path.geometry;
        if (coords.length < 2) return;

        const segments: [number, number][][] = [];
        let currentSeg: [number, number][] = [coords[0]];
        let currentSegLen = 0;

        for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const dist = getDistanceMeters(p1, p2);

            if (currentSegLen + dist <= maxLen) {
                currentSeg.push(p2);
                currentSegLen += dist;
            } else {
                // Interpolate exact cut coordinate
                const ratio = (maxLen - currentSegLen) / dist;
                const cutLat = p1[0] + (p2[0] - p1[0]) * ratio;
                const cutLng = p1[1] + (p2[1] - p1[1]) * ratio;
                const cutPoint: [number, number] = [cutLat, cutLng];

                currentSeg.push(cutPoint);
                segments.push(currentSeg);

                // Start next segment with the cut point
                currentSeg = [cutPoint, p2];
                currentSegLen = getDistanceMeters(cutPoint, p2);
            }
        }
        if (currentSeg.length > 1) {
            segments.push(currentSeg);
        }

        if (segments.length <= 1) {
            toast.info("The path is shorter than the split spacing limit; no cuts were made.");
            return;
        }

        const newPaths: WalkPath[] = segments.map((seg, idx) => ({
            id: `walk-${Date.now()}-${idx}`,
            name: `${path.name} Chk ${idx + 1}`,
            geometry: seg,
            timestamp: path.timestamp
        }));

        const remaining = walkedPaths.filter(p => p.id !== id);
        onUpdateWalkedPaths([...newPaths, ...remaining]);
        toast.success(`Segmented "${path.name}" into ${newPaths.length} distinct segment lines!`);
    };

    // Shave/Trim start or end points
    const handleTrimPath = (id: string, side: 'start' | 'end') => {
        const path = walkedPaths.find(p => p.id === id);
        if (!path) return;
        if (path.geometry.length <= 3) {
            toast.error("Cannot trim further, minimum 3 coordinates required.");
            return;
        }

        const trimmedGeometry = side === 'start' 
            ? path.geometry.slice(2) // remove first 2 points
            : path.geometry.slice(0, -2); // remove last 2 points

        onUpdateWalkedPaths(walkedPaths.map(p => 
            p.id === id ? { ...p, geometry: trimmedGeometry } : p
        ));
        toast.success(`Removed noisy coordinate jitter from the ${side} of "${path.name}"`);
    };

    // Delete walked paths
    const handleDeleteSelectedWalks = () => {
        const selected = walkedPaths.filter(p => p.selected);
        if (selected.length === 0) return;
        const selectedIds = selected.map(p => p.id);
        onUpdateWalkedPaths(walkedPaths.filter(p => !selectedIds.includes(p.id)));
        toast.success(`Deleted ${selected.length} recorded paths`);
    };

    // Register convert form submit
    const handleRegisterConfirm = () => {
        const path = walkedPaths.find(p => p.id === registeringPathId);
        if (!path) return;

        if (!regName.trim()) {
            toast.error("Please provide a name for this field asset.");
            return;
        }

        let finalGeom = [...path.geometry];
        // If registering as a Polygon type (sector, area, boundary etc), auto-close the geometry loop
        if (regType === 'sector' || regType === 'area' || (regType as any) === 'boundary') {
            const first = finalGeom[0];
            const last = finalGeom[finalGeom.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                finalGeom.push([first[0], first[1]]);
            }
        }

        onRegisterFeature({
            name: regName,
            type: regType,
            geometry: finalGeom,
            layerId: regLayerId,
            color: regColor,
            cropType: regCrop || undefined,
            plantSpacing: parseFloat(plantSpacing) || 2.0
        });

        // Delete from temporary tracker walked paths once converted to official asset
        onUpdateWalkedPaths(walkedPaths.filter(p => p.id !== registeringPathId));
        setRegisteringPathId(null);
    };

    return (
        <div 
            className="fixed bottom-28 md:bottom-12 right-1/2 md:right-12 translate-x-1/2 md:translate-x-0 z-[4500] w-[92%] sm:w-full sm:max-w-md overflow-hidden bg-slate-950/90 backdrop-blur-md border border-slate-800 text-white rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.5)] transition-all duration-300 font-sans pointer-events-auto flex flex-col max-h-[80vh]"
            id="gps-walk-tracker-floating-panel"
        >
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-slate-900/60 flex justify-between items-center bg-slate-900/40">
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isTracking ? 'bg-emerald-500 animate-ping' : 'bg-slate-500'}`} />
                    <div>
                        <span className="text-[9px] font-black text-[#818cf8] uppercase tracking-widest leading-none block">
                            {isKa ? "საველე ოპერაციები" : "Field Operations"}
                        </span>
                        <h2 className="text-sm font-extrabold text-slate-100 italic">
                            {isKa ? "GPS საველე ტრეკერი & რუკა" : "GPS Step Walk & Map"}
                        </h2>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer">
                    <XIcon className="h-4 w-4" />
                </button>
            </div>

            {/* Scrollable Workspace */}
            <div className="flex-1 p-5 space-y-5 overflow-y-auto custom-scrollbar text-xs">
                {/* 1. CURRENT GPS WALK CONTROLLER */}
                <div className="bg-slate-900/50 hover:bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 space-y-3 transition-colors">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            {isKa ? "სესიის ტრეკინგის მართვა" : "Session Tracking Controls"}
                        </span>
                        {isTracking && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-black rounded-lg text-[9px] border border-emerald-500/20 uppercase animate-pulse">
                                {isKa ? "GPS აქტიურია ცოცხლად" : "GPS Streaming Live"}
                            </span>
                        )}
                    </div>

                    {/* Stats Display */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-900">
                        <div className="text-center">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 block">
                                {isKa ? "გავლილი მანძილი" : "Total distance Walked"}
                            </span>
                            <span className="text-sm font-black text-slate-200 font-mono">
                                {activeTrackLength.toFixed(1)}m
                            </span>
                        </div>
                        <div className="text-center border-l border-slate-800/50">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 block">
                                {isKa ? "გეოგრაფიული წერტილები" : "Geographic Points"}
                            </span>
                            <span className="text-sm font-black text-slate-200 font-mono">
                                {trackedPoints.length} {isKa ? "კოორდ." : "coords"}
                            </span>
                        </div>
                    </div>

                    {/* Controls Actions Row */}
                    <div className="flex flex-wrap gap-2.5">
                        {!isTracking ? (
                            <div className="w-full">
                                <button
                                    onClick={() => onToggleTracking(true)}
                                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 font-extrabold text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer text-center text-xs"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {isKa ? "GPS ტრეკინგის დაწყება" : "Start Real GPS Walk"}
                                </button>
                            </div>
                        ) : (
                            <div className="w-full space-y-3">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onToggleTracking(false)}
                                        className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 font-black text-white rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {isKa ? "პაუზა" : "Pause Record"}
                                    </button>
                                    <button
                                        onClick={onClearCurrentTrack}
                                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer text-center font-bold"
                                        title={isKa ? "მიმდინარე წერტილების გასუფთავება" : "Clear all recorded walk points in current tracker"}
                                    >
                                        {isKa ? "განულება" : "Reset"}
                                    </button>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder={isKa ? "სახელი (მაგ. რიგი 5 გარე)" : "Name your walk (e.g. Row 5 Outer)"}
                                        className="flex-1 py-2 px-3 bg-slate-950 text-xs text-white border border-slate-800 rounded-xl focus:border-indigo-500 outline-none font-bold"
                                        value={newWalkName}
                                        onChange={e => setNewWalkName(e.target.value)}
                                    />
                                    <button
                                        onClick={handleStopAndSave}
                                        disabled={trackedPoints.length < 2}
                                        className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-xl transition-all shadow-md cursor-pointer text-center shrink-0 flex items-center gap-1"
                                    >
                                        💾 {isKa ? "შენახვა" : "Save Path"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. SAVED WALKS DATABASE LIST */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            {isKa ? `ჩაწერილი მარშრუტები (${walkedPaths.length})` : `Recorded Walks List (${walkedPaths.length})`}
                        </span>
                        {walkedPaths.length > 0 && (
                            <button
                                onClick={handleSelectAllPaths}
                                className="text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer"
                            >
                                {walkedPaths.every(p => p.selected) ? (isKa ? 'მონიშვნის მოხსნა' : 'Deselect All') : (isKa ? 'ყველას მონიშვნა' : 'Select All')}
                            </button>
                        )}
                    </div>

                    {walkedPaths.length === 0 ? (
                        <div className="p-6 bg-slate-900/20 rounded-2xl border border-slate-800/40 text-center text-slate-500 leading-relaxed text-[11px] font-mono select-none">
                            {isKa ? "ჩაწერილი მარშრუტები არ არის. ჩართეთ GPS პირველი მარშრუტის ჩასაწერად!" : "No walked paths recorded yet. Start real GPS tracking to record your first field walk!"}
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto shadow-inner pr-1 custom-scrollbar">
                            {walkedPaths.map(path => (
                                <div 
                                    key={path.id}
                                    className={`flex items-center justify-between p-3 rounded-2xl transition-all border ${
                                        path.selected 
                                            ? 'bg-indigo-950/30 border-indigo-500/40' 
                                            : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700/60'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                                        <input
                                            type="checkbox"
                                            checked={!!path.selected}
                                            onChange={() => handleToggleSelectPath(path.id)}
                                            className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                                        />
                                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleCenterOnPath(path)}>
                                            <div className="font-extrabold text-slate-200 truncate capitalize text-[11px] hover:text-indigo-300">
                                                {path.name}
                                            </div>
                                            <div className="text-[9px] font-semibold text-slate-500 font-mono flex items-center gap-3">
                                                <span>{calculatePathLength(path.geometry).toFixed(0)}m {isKa ? "სიგრძე" : "length"}</span>
                                                <span>•</span>
                                                <span>{path.geometry.length} {isKa ? "წერტილი" : "points"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline Actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => setRegisteringPathId(path.id)}
                                            className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer"
                                            title={isKa ? "ობიექტის რეგისტრაცია პლანტაციის რუკაზე" : "Register this walked path into plantation boundary or sector"}
                                        >
                                            {isKa ? "რეგისტრაცია" : "Register Asset"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                onUpdateWalkedPaths(walkedPaths.filter(p => p.id !== path.id));
                                                toast.success(isKa ? `წაიშალა მარშრუტი "${path.name}"` : `Removed walk path "${path.name}"`);
                                            }}
                                            className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                            title={isKa ? "წაშლა" : "Delete"}
                                        >
                                            <TrashIcon size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. MULTI-PATH & SINGLE-PATH ADVANCED GEOMETRY MANIPULATIONS */}
                {walkedPaths.length > 0 && (
                    <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 space-y-4">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            {isKa ? "სივრცითი რედაქტირების ოპერაციები" : "Spatial Editing Operations"}
                        </span>
                        
                        {/* Multi-Selection Join/Merge */}
                        {selectionCount >= 2 ? (
                            <div className="space-y-1.5">
                                <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">
                                    {isKa ? "მრავალი მარშრუტის გაერთიანება" : "Multi-Walk Merge Operations"}
                                </div>
                                <button
                                    onClick={handleMergeWalks}
                                    className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer text-center"
                                >
                                    🔗 {isKa ? `გაერთიანდეს ${selectionCount} მონიშნული მარშრუტი` : `Merge ${selectionCount} Selected Walks End-to-End`}
                                </button>
                                <p className="text-[9px] text-slate-500 leading-tight">
                                    {isKa ? "აერთიანებს რამდენიმე ტრეკს ერთ უწყვეტ პოლიხაზად." : "Joins multiple tracks into a single continuous polyline asset."}
                                </p>
                            </div>
                        ) : selectionCount === 1 ? (
                            (() => {
                                const activeSel = walkedPaths.find(p => p.selected)!;
                                return (
                                    <div className="space-y-3.5 divide-y divide-slate-800/60 pt-1">
                                        {/* Trim Actions for noisy GPS */}
                                        <div className="space-y-1.5">
                                            <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">
                                                {isKa ? "GPS რხევების ჩამოჭრა" : "Trimming Jitter Noise"}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <button
                                                    onClick={() => handleTrimPath(activeSel.id, 'start')}
                                                    className="py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer text-center text-[10px]"
                                                >
                                                    ✂️ {isKa ? "დასაწყისის ჩამოჭრა" : "Shave Walk Start"}
                                                </button>
                                                <button
                                                    onClick={() => handleTrimPath(activeSel.id, 'end')}
                                                    className="py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer text-center text-[10px]"
                                                >
                                                    ✂️ {isKa ? "ბოლოს ჩამოჭრა" : "Shave Walk End"}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Dividing Separating Lines (Separate Roads, Trenches, Sectors) */}
                                        <div className="space-y-2 pt-2.5">
                                            <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">
                                                {isKa ? "ხაზის სეგმენტებად დაყოფა" : "Separate & Split Line segments"}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleSplitInHalf(activeSel.id)}
                                                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer text-center text-[10px]"
                                                >
                                                    ⚖️ {isKa ? "შუაზე გაჭრა" : "Cut Exactly in Half"}
                                                </button>
                                            </div>

                                            {/* Slicing by segment limit */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[9px] text-slate-500 font-extrabold uppercase">
                                                    <span>{isKa ? "დაყოფის მაქსიმალური სიგრძე:" : "Divide into parts of:"}</span>
                                                    <span className="text-slate-400">{splitMeters} {isKa ? "მეტრი" : "meters max"}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="number"
                                                            className="w-full py-1.5 px-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none rounded-xl text-center font-mono font-bold text-white text-[10px]"
                                                            value={splitMeters}
                                                            onChange={e => setSplitMeters(e.target.value)}
                                                        />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold font-mono">
                                                            {isKa ? "მ" : "meters"}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleSliceIntoSegments(activeSel.id)}
                                                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition-all cursor-pointer text-center text-[10px]"
                                                    >
                                                        {isKa ? "სეგმენტებად დაჭრა" : "Slices segment chunk"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="p-2 bg-slate-900/10 rounded-xl text-center text-slate-500 leading-tight text-[10px] font-mono">
                                {isKa ? "მონიშნეთ ტრეკები ზემოთ მოწინავე გაერთიანების, გაყოფისა და სტილისთვის." : "Select checked tracks above to trigger advanced merging, splitting, and styling."}
                            </div>
                        )}

                        {/* Global clear/delete block */}
                        {selectionCount > 0 && (
                            <button
                                onClick={handleDeleteSelectedWalks}
                                className="w-full py-1.5 bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-900/30 text-[10px] font-extrabold rounded-xl transition-all cursor-pointer text-center uppercase tracking-wider"
                            >
                                {isKa ? `${selectionCount} მონიშნულის წაშლა` : `Remove ${selectionCount} Checked Walks`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 4. CONVERT REGISTRATION FORM PANEL (CONDITIONAL OVERLAY OVER WORKING DIRECTORY) */}
            {registeringPathId && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-[2600] p-6 flex flex-col justify-between font-sans">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <h3 className="font-extrabold text-slate-100 text-sm">
                                    {isKa ? "ობიექტის რეგისტრაცია საველე რუკაზე" : "Register Asset to Field Map"}
                                </h3>
                            </div>
                            <button onClick={() => setRegisteringPathId(null)} className="p-1 hover:bg-slate-950 text-slate-400 hover:text-white rounded-lg cursor-pointer">
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Fields */}
                        <div className="space-y-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                    {isKa ? "ობიექტის სახელი" : "Asset Display Name"}
                                </label>
                                <input
                                    type="text"
                                    className="w-full p-2.5 bg-slate-900 border border-slate-800 outline-none text-white font-extrabold rounded-xl focus:border-emerald-500"
                                    value={regName}
                                    placeholder={isKa ? "უნიკალური სახელი (მაგ. რიგი 15 სექტორი)" : "Enter unique name (e.g. Row 15 sector)"}
                                    onChange={e => setRegName(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                        {isKa ? "ობიექტის ტიპი" : "Feature Type"}
                                    </label>
                                    <select
                                        className="w-full p-2.5 bg-slate-900 border border-slate-800 outline-none text-slate-200 font-semibold rounded-xl text-xs focus:ring-0 focus:ring-offset-0"
                                        value={regType}
                                        onChange={e => setRegType(e.target.value as any)}
                                    >
                                        <option value="line">{isKa ? "ხაზი (გზა/ბილიკი)" : "Line (Road/Path)"}</option>
                                        <option value="trench">{isKa ? "თხრილის ობიექტი" : "Trench Feature"}</option>
                                        <option value="irrigation_line">{isKa ? "სარწყავი მაგისტრალი" : "Irrigation Header Line"}</option>
                                        <option value="sector">{isKa ? "საველე სექტორი (შეკრული)" : "Field Sector (Closed Area)"}</option>
                                        <option value="area">{isKa ? "ფართობის პოლიგონი" : "Area Polygon (Region)"}</option>
                                        <option value="boundary">{isKa ? "საზღვარი (ნაკვეთის კიდე)" : "Boundary (Property Edge)"}</option>
                                        <option value="plant-sequence">{isKa ? "🌱 ნერგების მიმდევრობა" : "🌱 Plant/Seedling Sequence"}</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                                        {isKa ? "სამიზნე შრე" : "Target Folder Layer"}
                                    </label>
                                    <select
                                        className="w-full p-2.5 bg-slate-900 border border-slate-800 outline-none text-slate-200 font-semibold rounded-xl text-xs focus:ring-0 focus:ring-offset-0"
                                        value={regLayerId}
                                        onChange={e => setRegLayerId(e.target.value)}
                                    >
                                        {layers.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {regType === 'plant-sequence' && (
                                <div className="space-y-1.5 animate-in fade-in duration-200">
                                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                                        {isKa ? "ნერგებს შორის მანძილი (მეტრი)" : "Plant Spacing (Meters)"}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0.1"
                                            className="w-full p-2.5 bg-slate-900 border border-slate-800 outline-none text-white font-mono font-bold rounded-xl focus:border-indigo-500"
                                            value={plantSpacing}
                                            onChange={e => setPlantSpacing(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                                            {isKa ? "მ" : "meters"}
                                        </span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 leading-tight">
                                        {isKa ? "ავტომატურად ანთავსებს ნერგებს რეალური GPS კოორდინატებით მითითებული ინტერვალით." : "Positions separate seedlings with live GPS coordinates at standard intervals mapped sequentially along walking lines."}
                                    </p>
                                </div>
                            )}

                            {(regType === 'sector' || regType === 'area' || regType === 'plant-sequence') && crops.length > 0 && (
                                <div className="space-y-1.5 animate-in fade-in duration-200">
                                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                                        {isKa ? "კულტურის ტიპი" : "Associated Crop Type"}
                                    </label>
                                    <select
                                        className="w-full p-2.5 bg-slate-900 border border-slate-800 outline-none text-slate-200 font-semibold rounded-xl text-xs"
                                        value={regCrop}
                                        onChange={e => setRegCrop(e.target.value)}
                                    >
                                        <option value="">{isKa ? "-- აირჩიეთ კულტურა --" : "-- Select Crop --"}</option>
                                        {crops.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                                    {isKa ? "ფერის არჩევა" : "Palette Color Designation"}
                                </label>
                                <div className="flex items-center gap-2">
                                    {['#22c55e', '#ef4444', '#0ea5e9', '#eab308', '#a855f7', '#f97316', '#64748b'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setRegColor(c)}
                                            style={{ backgroundColor: c }}
                                            className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${regColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        className="w-7 h-7 bg-transparent border-0 outline-none cursor-pointer"
                                        value={regColor}
                                        onChange={e => setRegColor(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800/80 text-[10.5px] text-slate-400 leading-snug">
                            💡 {regType === 'sector' || regType === 'area' ? (
                                <span className="font-semibold text-amber-500">
                                    {isKa ? "ავტომატური შეკვრა! პირველი და ბოლო წერტილი შეიკვრება სექტორის ზონის ფორმირებისთვის ფართობის ჰექტრებით." : "Auto-Closing active sequence! The first and last coordinate points will be closed automatically to form a bounding sector area with calculated surface hectares."}
                                </span>
                            ) : (
                                <span>
                                    {isKa ? "ობიექტი დაიტანება როგორც პოლიხაზი. იდეალურია თხრილების, სარწყავი მილებისა და საველე გზებისთვის." : "The asset will be plotted directly as a polyline layer. Perfect for modeling trench spans, irrigation pipelines, field roads, and access paths."}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setRegisteringPathId(null)}
                            className="flex-1 py-3 bg-slate-900 hover:bg-slate-805 text-slate-300 font-extrabold rounded-xl transition-all cursor-pointer border border-slate-800 text-center"
                        >
                            {isKa ? "უკან" : "Back To Walks"}
                        </button>
                        <button
                            onClick={handleRegisterConfirm}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-all shadow-lg shadow-emerald-500/15 cursor-pointer text-center"
                        >
                            {isKa ? "რეგისტრაციის დადასტურება" : "Confirm Asset Registration"}
                        </button>
                    </div>
                </div>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default WalkTrackingPanel;
