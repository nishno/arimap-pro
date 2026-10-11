import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, Mountain, Layers, Sliders, Check, AlertTriangle, ShieldCheck, 
    Compass, MapPin, Eye, ArrowUp, ArrowDown, RotateCcw, Plus, 
    Trash2, Copy, Sparkles, Navigation, Info, Plane, Camera,
    Maximize2, ChevronRight, Activity, Crosshair
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Polygon, Marker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'sonner';
import { 
    type CustomTerrainSlope, 
    calculateSlopeFalloff, 
    calculateSlopeElevationOffset, 
    getElevationAtCoords,
    setActiveSlopesCache,
    adjustDroneFlightPathAGL
} from '../utils/demTerrainViewshed';
import { safeStorage } from '../services/storageService';
import type { PlantationFeature } from '../types';
import type { DroneFlightMission } from './DroneFlightPathPlanner';
import type { PlantationCamera } from './SystemManagement/HardwareLabs/CameraNvrLab';

interface TerrainSlopeSculptorModalProps {
    isOpen: boolean;
    onClose: () => void;
    mapCenter?: [number, number];
    plantationFeatures?: PlantationFeature[];
    activeDroneMission?: DroneFlightMission | null;
    onUpdateDroneMission?: (mission: DroneFlightMission) => void;
    cameras?: PlantationCamera[];
    onSlopeUpdated?: (slopes: CustomTerrainSlope[]) => void;
    isKa?: boolean;
}

// Draggable Peak Pin Icon for Leaflet
const createPeakPinIcon = (isExcavation: boolean, peakHeightM: number) => {
    const bgColor = isExcavation ? '#ef4444' : '#10b981';
    const borderColor = '#ffffff';
    const arrow = isExcavation ? '▼' : '▲';
    const sign = peakHeightM > 0 ? `+${peakHeightM}m` : `${peakHeightM}m`;

    return L.divIcon({
        className: 'peak-pin-marker',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: grab;">
                <div style="
                    background: ${bgColor}; color: white; font-weight: 900; font-size: 10px; font-family: monospace;
                    padding: 3px 8px; border-radius: 9999px; border: 2px solid ${borderColor};
                    box-shadow: 0 4px 14px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 4px; white-space: nowrap;
                ">
                    <span>${arrow}</span>
                    <span>${sign}</span>
                </div>
                <div style="
                    width: 0; height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 8px solid ${bgColor};
                    margin-top: -1px;
                "></div>
                <div style="width: 8px; height: 8px; background: white; border: 2px solid ${bgColor}; border-radius: 50%; margin-top: 1px;"></div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });
};

// Map click and drag handler
const MapPeakSelector: React.FC<{
    onSelectCoords: (lat: number, lng: number) => void;
}> = ({ onSelectCoords }) => {
    const cbRef = useRef(onSelectCoords);
    cbRef.current = onSelectCoords;
    useMapEvents({
        click(e) {
            cbRef.current(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
};

const TerrainSlopeSculptorModalContent: React.FC<TerrainSlopeSculptorModalProps> = ({
    onClose,
    mapCenter = [41.9023, 44.5],
    plantationFeatures = [],
    activeDroneMission = null,
    onUpdateDroneMission,
    cameras = [],
    onSlopeUpdated,
    isKa = false
}) => {
    const baseLat = mapCenter[0] || 41.9023;
    const baseLng = mapCenter[1] || 44.5;

    // Load saved slopes from storage
    const [slopes, setSlopes] = useState<CustomTerrainSlope[]>(() => {
        try {
            const raw = safeStorage.getItem('agrimap_custom_terrain_slopes');
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        // Default sample slope (South-West gentle orchard knoll)
        return [
            {
                id: 'slope-initial-1',
                name: 'Main Terrace Hill Ridge',
                centerLat: baseLat + 0.0006,
                centerLng: baseLng + 0.0008,
                peakHeightM: 18,
                radiusM: 75,
                slopeType: 'cosine',
                sourceType: 'custom_point',
                enabled: true
            }
        ];
    });

    const [activeSlopeId, setActiveSlopeId] = useState<string>(slopes[0]?.id || 'slope-initial-1');

    // Currently active editing slope
    const activeSlope = useMemo(() => {
        return slopes.find(s => s.id === activeSlopeId) || slopes[0] || {
            id: 'temp',
            name: 'New Custom Slope',
            centerLat: baseLat,
            centerLng: baseLng,
            peakHeightM: 15,
            radiusM: 60,
            slopeType: 'cosine' as const,
            sourceType: 'standing_location' as const,
            enabled: true
        };
    }, [slopes, activeSlopeId, baseLat, baseLng]);

    // Update active slope in list
    const updateActiveSlope = (patch: Partial<CustomTerrainSlope>) => {
        setSlopes(prev => {
            const next = prev.map(s => s.id === activeSlope.id ? { ...s, ...patch } : s);
            safeStorage.setItem('agrimap_custom_terrain_slopes', JSON.stringify(next));
            setActiveSlopesCache(next);
            onSlopeUpdated?.(next);
            window.dispatchEvent(new CustomEvent('agrimap:terrain_slope_updated', { detail: next }));
            return next;
        });
    };

    // Synchronize global cache on mount and update with ref to avoid parent re-render loops
    const onSlopeUpdatedRef = useRef(onSlopeUpdated);
    onSlopeUpdatedRef.current = onSlopeUpdated;

    useEffect(() => {
        setActiveSlopesCache(slopes);
        onSlopeUpdatedRef.current?.(slopes);
    }, [slopes]);

    // Available polygon features from plantation
    const availablePolygons = useMemo(() => {
        return plantationFeatures.filter(f => f.type === 'area' || f.type === 'sector' || f.type === 'boundary');
    }, [plantationFeatures]);

    // Handlers for Add / Remove Slope (Convexity / Concavity)
    const handleSetConvex = () => {
        const currentAbs = Math.abs(activeSlope.peakHeightM) || 12;
        updateActiveSlope({ peakHeightM: currentAbs });
    };

    const handleSetConcave = () => {
        const currentAbs = Math.abs(activeSlope.peakHeightM) || 12;
        updateActiveSlope({ peakHeightM: -currentAbs });
    };

    // Handlers for sources: Standing Location, Plantation Polygon, Drawn Sector
    const handleSelectSource = (type: CustomTerrainSlope['sourceType'], polygonFeature?: PlantationFeature) => {
        if (type === 'standing_location') {
            updateActiveSlope({
                sourceType: 'standing_location',
                sourceName: isKa ? 'ჩემი მდებარეობა (ცენტრი)' : 'Current Position (Center)',
                centerLat: baseLat,
                centerLng: baseLng,
                polygonCoords: undefined
            });
            toast.success(isKa ? "სამიზნე არეალი განისაზღვრა მიმდინარე მდებარეობით" : "Target set to current position");
        } else if (type === 'plantation_polygon') {
            // Find overall plantation or largest polygon
            const poly = availablePolygons[0];
            const coords = (Array.isArray(poly?.geometry) ? poly.geometry : []) as [number, number][];
            if (coords.length >= 3) {
                // Centroid
                const cLat = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
                const cLng = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
                updateActiveSlope({
                    sourceType: 'plantation_polygon',
                    sourceName: poly?.name || 'Plantation Perimeter',
                    centerLat: cLat,
                    centerLng: cLng,
                    slopeType: 'plateau',
                    polygonCoords: coords,
                    radiusM: Math.max(activeSlope.radiusM, 50)
                });
                toast.success(isKa ? "პლანტაციის პოლიგონი ჩაიტვირთა 3D რელიეფისთვის" : "Plantation boundary loaded for 3D area");
            } else {
                toast.warning(isKa ? "პლანტაციის პოლიგონი ჯერ არ არის დახაზული" : "No plantation polygon available");
            }
        } else if (type === 'drawn_sector' && polygonFeature) {
            const coords = (Array.isArray(polygonFeature.geometry) ? polygonFeature.geometry : []) as [number, number][];
            if (coords.length >= 3) {
                const cLat = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
                const cLng = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
                updateActiveSlope({
                    sourceType: 'drawn_sector',
                    sourceName: polygonFeature.name || 'Drawn Sector',
                    centerLat: cLat,
                    centerLng: cLng,
                    slopeType: 'plateau',
                    polygonCoords: coords,
                    radiusM: Math.max(activeSlope.radiusM, 40)
                });
                toast.success(isKa ? `სექტორი "${polygonFeature.name}" ჩაიტვირთა 3D რელიეფისთვის` : `Sector "${polygonFeature.name}" loaded for 3D area`);
            }
        }
    };

    // Add new slope
    const handleAddNewSlope = () => {
        const count = slopes.length + 1;
        const newSlope: CustomTerrainSlope = {
            id: `slope-${Date.now()}-${count}`,
            name: isKa ? `რელიეფის ფერდობი #${count}` : `Terrain Slope #${count}`,
            centerLat: baseLat + (Math.random() - 0.5) * 0.002,
            centerLng: baseLng + (Math.random() - 0.5) * 0.002,
            peakHeightM: 14,
            radiusM: 55,
            slopeType: 'cosine',
            sourceType: 'custom_point',
            enabled: true
        };
        const next = [...slopes, newSlope];
        setSlopes(next);
        setActiveSlopeId(newSlope.id);
        safeStorage.setItem('agrimap_custom_terrain_slopes', JSON.stringify(next));
        setActiveSlopesCache(next);
        onSlopeUpdated?.(next);
        toast.success(isKa ? "ახალი 3D ფერდობი დაემატა" : "New 3D slope created");
    };

    // Duplicate slope
    const handleDuplicateSlope = () => {
        const copy: CustomTerrainSlope = {
            ...activeSlope,
            id: `slope-${Date.now()}-copy`,
            name: `${activeSlope.name} (Copy)`,
            centerLat: activeSlope.centerLat + 0.0004,
            centerLng: activeSlope.centerLng + 0.0004
        };
        const next = [...slopes, copy];
        setSlopes(next);
        setActiveSlopeId(copy.id);
        safeStorage.setItem('agrimap_custom_terrain_slopes', JSON.stringify(next));
        setActiveSlopesCache(next);
        onSlopeUpdated?.(next);
        toast.success(isKa ? "ფერდობის ასლი შეიქმნა" : "Slope duplicated");
    };

    // Delete slope
    const handleDeleteSlope = () => {
        if (slopes.length <= 1) {
            toast.warning(isKa ? "მინიმუმ ერთი ფერდობი უნდა დარჩეს" : "At least one slope should remain");
            return;
        }
        const next = slopes.filter(s => s.id !== activeSlope.id);
        setSlopes(next);
        setActiveSlopeId(next[0].id);
        safeStorage.setItem('agrimap_custom_terrain_slopes', JSON.stringify(next));
        setActiveSlopesCache(next);
        onSlopeUpdated?.(next);
        toast.info(isKa ? "ფერდობი წაიშალა" : "Slope deleted");
    };

    // Auto AGL Drone Flight Path Adjustment
    const handleAutoAdjustDroneAGL = () => {
        if (!activeDroneMission || activeDroneMission.waypoints.length === 0) {
            toast.warning(isKa ? "დრონის მისია არ მოიძებნა. ჯერ დახაზეთ ან აირჩიეთ ფრენის გეგმა." : "No active drone mission found. Plan flight path first.");
            return;
        }

        const res = adjustDroneFlightPathAGL(
            activeDroneMission.waypoints,
            baseLat,
            baseLng,
            20, // 20m minimum safe clearance AGL
            slopes
        );

        if (onUpdateDroneMission) {
            const updatedMission: DroneFlightMission = {
                ...activeDroneMission,
                waypoints: res.adjustedWaypoints as any
            };
            onUpdateDroneMission(updatedMission);
            toast.success(
                isKa 
                    ? `დრონის ${res.elevationsRaisedCount} წერტილის სიმაღლე გაიზარდა ფერდობის ასარიდებლად! (მაქს. სიმაღლე: ${res.maxGroundElevM}მ)` 
                    : `Drone path adjusted! ${res.elevationsRaisedCount} waypoints elevated safely above slope crest (Peak: ${res.maxGroundElevM}m)`
            );
        }
    };

    // Cross-Section Profile Curve calculation (r vs Z)
    const profileSvgPoints = useMemo(() => {
        const H = activeSlope.peakHeightM;
        const R = Math.max(10, activeSlope.radiusM);
        const steps = 40;
        const pts: string[] = [];

        for (let i = 0; i <= steps; i++) {
            // -R to +R
            const r = -R + (2 * R * i) / steps;
            const dist = Math.abs(r);
            const z = calculateSlopeFalloff(dist, R, H, activeSlope.slopeType);
            
            // Map to SVG coordinates: width 240, height 70 (center baseline y=50)
            const svgX = ((r + R) / (2 * R)) * 240;
            // Height scale: 1m = 1.2px
            const svgY = 48 - z * 1.3;
            pts.push(`${svgX.toFixed(1)},${svgY.toFixed(1)}`);
        }
        return pts.join(' ');
    }, [activeSlope.peakHeightM, activeSlope.radiusM, activeSlope.slopeType]);

    const isExcavation = activeSlope.peakHeightM < 0;
    const absHeight = Math.abs(activeSlope.peakHeightM);

    return (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600/20 border border-emerald-500/40 rounded-2xl text-emerald-400">
                            <Mountain size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                                    {isKa ? '3D რელიეფის & ფერდობის მოდელირება (Falloff Engine)' : '3D Terrain & Slope Sculptor (Falloff Engine)'}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                                    DEM v2.4
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                {isKa 
                                    ? 'ფერდობების შექმნა, სიმაღლის (H) და რადიუსის (R) მართვა, კამერის ხილვადობის და დრონის AGL ავტო-ადაპტაცია' 
                                    : 'Create custom slopes, adjust peak height (H) and radius (R), auto-occlude camera viewshed & elevate drone flight path'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 custom-scrollbar">
                    
                    {/* Left Column: Interactive Map & Profile Visualizer (7 cols) */}
                    <div className="lg:col-span-7 space-y-4 flex flex-col">
                        
                        {/* Map Viewport with Draggable Pin & Radius Circle */}
                        <div className="relative w-full h-[280px] sm:h-[340px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                            <MapContainer
                                center={[activeSlope.centerLat, activeSlope.centerLng]}
                                zoom={17}
                                className="w-full h-full z-10"
                                zoomControl={false}
                            >
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    maxZoom={20}
                                />
                                
                                <MapPeakSelector
                                    onSelectCoords={(lat, lng) => {
                                        updateActiveSlope({ centerLat: lat, centerLng: lng });
                                    }}
                                />

                                {/* Radius Ring of Influence (R) */}
                                <Circle
                                    center={[activeSlope.centerLat, activeSlope.centerLng]}
                                    radius={activeSlope.radiusM}
                                    pathOptions={{
                                        color: isExcavation ? '#ef4444' : '#10b981',
                                        weight: 2,
                                        dashArray: '5, 5',
                                        fillColor: isExcavation ? '#ef4444' : '#10b981',
                                        fillOpacity: 0.16
                                    }}
                                />

                                {/* Plateau Inner Flat Crown Circle (if plateau without custom polygon) */}
                                {activeSlope.slopeType === 'plateau' && !activeSlope.polygonCoords && (
                                    <Circle
                                        center={[activeSlope.centerLat, activeSlope.centerLng]}
                                        radius={activeSlope.radiusM * 0.4}
                                        pathOptions={{
                                            color: '#f59e0b',
                                            weight: 1.5,
                                            fillColor: '#f59e0b',
                                            fillOpacity: 0.25
                                        }}
                                    />
                                )}

                                {/* Sector Polygon Boundary if assigned */}
                                {activeSlope.polygonCoords && activeSlope.polygonCoords.length >= 3 && (
                                    <Polygon
                                        positions={activeSlope.polygonCoords}
                                        pathOptions={{
                                            color: '#38bdf8',
                                            weight: 2,
                                            fillColor: '#38bdf8',
                                            fillOpacity: 0.2
                                        }}
                                    />
                                )}

                                {/* Draggable Peak Marker */}
                                <Marker
                                    position={[activeSlope.centerLat, activeSlope.centerLng]}
                                    icon={createPeakPinIcon(isExcavation, activeSlope.peakHeightM)}
                                    draggable={true}
                                    eventHandlers={{
                                        dragend: (e) => {
                                            const marker = e.target;
                                            const pos = marker.getLatLng();
                                            updateActiveSlope({ centerLat: pos.lat, centerLng: pos.lng });
                                            toast.success(isKa ? "ფერდობის ცენტრი გადაადგილდა" : "Slope center moved");
                                        }
                                    }}
                                >
                                    <Tooltip direction="top" permanent className="bg-slate-900 text-white font-mono text-[10px] rounded px-1 border border-slate-700">
                                        {activeSlope.name} ({activeSlope.peakHeightM > 0 ? `+${activeSlope.peakHeightM}m` : `${activeSlope.peakHeightM}m`})
                                    </Tooltip>
                                </Marker>

                                {/* Cameras overlay for visual reference */}
                                {cameras.map(c => (
                                    <Circle
                                        key={c.id}
                                        center={[c.lat, c.lng]}
                                        radius={3}
                                        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.9 }}
                                    />
                                ))}
                            </MapContainer>

                            {/* Floating Map Help Overlay */}
                            <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-300 font-medium flex items-center gap-2">
                                <Crosshair size={13} className="text-emerald-400" />
                                <span>{isKa ? 'დააწკაპუნეთ რუკაზე ან გადაათრიეთ პინი მწვერვალის დასასმელად' : 'Click on map or drag pin to place peak marker'}</span>
                            </div>
                        </div>

                        {/* Real-Time Cross-Section Profile Curve (Z vs r) */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                    <Activity size={14} className="text-emerald-400" />
                                    <span>{isKa ? 'ფერდობის გეომეტრიული პროფილი (Z vs r)' : 'Slope Cross-Section Profile (Z vs r)'}</span>
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">
                                    H = {activeSlope.peakHeightM > 0 ? `+${activeSlope.peakHeightM}m` : `${activeSlope.peakHeightM}m`} &bull; R = {activeSlope.radiusM}m
                                </span>
                            </div>

                            {/* SVG Curve */}
                            <div className="relative w-full h-[76px] bg-slate-900/70 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center">
                                <svg viewBox="0 0 240 70" className="w-full h-full px-2" preserveAspectRatio="none">
                                    {/* Base plane Z=0 line */}
                                    <line x1="0" y1="48" x2="240" y2="48" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                                    {/* Central peak vertical axis */}
                                    <line x1="120" y1="8" x2="120" y2="62" stroke="#475569" strokeWidth="0.8" strokeDasharray="2,2" />
                                    
                                    {/* Gradient fill beneath curve */}
                                    <polygon
                                        points={`0,48 ${profileSvgPoints} 240,48`}
                                        fill={isExcavation ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.2)'}
                                    />
                                    {/* Curve line */}
                                    <polyline
                                        points={profileSvgPoints}
                                        fill="none"
                                        stroke={isExcavation ? '#ef4444' : '#10b981'}
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    {/* Center peak dot */}
                                    <circle
                                        cx="120"
                                        cy={48 - activeSlope.peakHeightM * 1.3}
                                        r="3.5"
                                        fill="#ffffff"
                                        stroke={isExcavation ? '#ef4444' : '#10b981'}
                                        strokeWidth="2"
                                    />
                                </svg>

                                <div className="absolute top-1 left-3 text-[9px] font-mono text-slate-500">r = -R</div>
                                <div className="absolute top-1 right-3 text-[9px] font-mono text-slate-500">r = +R</div>
                                <div className="absolute bottom-1 self-center text-[9px] font-mono text-emerald-400 font-bold">r = 0 (Apex)</div>
                            </div>
                        </div>

                        {/* Drone AGL and Viewshed Action Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <button
                                type="button"
                                onClick={handleAutoAdjustDroneAGL}
                                className="p-3 bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border border-cyan-700/50 hover:border-cyan-400 rounded-2xl flex items-center gap-3 transition-all cursor-pointer group text-left shadow-lg"
                            >
                                <div className="p-2 rounded-xl bg-cyan-600/20 text-cyan-400 group-hover:scale-110 transition-transform">
                                    <Plane size={18} />
                                </div>
                                <div className="min-w-0">
                                    <span className="block text-xs font-bold text-slate-100 leading-tight">
                                        {isKa ? 'დრონის ფრენის სიმაღლის (AGL) ადაპტაცია' : 'Auto AGL Drone Collision Protection'}
                                    </span>
                                    <span className="text-[10px] text-cyan-400">
                                        {isKa ? 'გეგმის აწევა ფერდობის თავზე' : 'Elevate path above slope crest'}
                                    </span>
                                </div>
                            </button>

                            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                                    <Camera size={18} />
                                </div>
                                <div className="min-w-0">
                                    <span className="block text-xs font-bold text-slate-100 leading-tight">
                                        {isKa ? 'კამერის Viewshed დაბრკოლება' : 'Camera Viewshed Occlusion'}
                                    </span>
                                    <span className="text-[10px] text-emerald-400">
                                        {isKa ? 'ფერდობის უკან ჩნდება ბრმა ზონა' : 'Hill rear slope generates blind spot'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Controls, Gizmos & Settings (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        
                        {/* 1. Target Selection (Where we are standing / Plantation / Drawn Sector) */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                            <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider text-[11px]">
                                {isKa ? '1. სამიზნე 3D არეალის არჩევა' : '1. Target 3D Area / Location'}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSelectSource('standing_location')}
                                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        activeSlope.sourceType === 'standing_location'
                                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                                    }`}
                                >
                                    <Crosshair size={16} />
                                    <span>{isKa ? 'ჩემი მდებარეობა' : 'Standing Location'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectSource('plantation_polygon')}
                                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        activeSlope.sourceType === 'plantation_polygon'
                                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                                    }`}
                                >
                                    <Layers size={16} />
                                    <span>{isKa ? 'პლანტაციის კონტური' : 'Plantation Polygon'}</span>
                                </button>
                            </div>

                            {/* Drawn sectors selector if available */}
                            {availablePolygons.length > 0 && (
                                <div className="pt-1">
                                    <label className="text-[10px] text-slate-400 block mb-1">
                                        {isKa ? 'ან აირჩიეთ დახაზული სექტორი:' : 'Or select drawn sector:'}
                                    </label>
                                    <select
                                        value={activeSlope.sourceName || ''}
                                        onChange={(e) => {
                                            const found = availablePolygons.find(p => p.name === e.target.value);
                                            if (found) handleSelectSource('drawn_sector', found);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">{isKa ? '-- აირჩიეთ სექტორი --' : '-- Select Drawn Sector --'}</option>
                                        {availablePolygons.map(p => (
                                            <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* 2. Convexity / Concavity Mode (Add / Remove Slope) */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                            <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider text-[11px]">
                                {isKa ? '2. ფერდობის მიმართულება' : '2. Convexity / Concavity'}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={handleSetConvex}
                                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                        !isExcavation 
                                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 border-emerald-500' 
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <ArrowUp size={15} />
                                    <span>{isKa ? 'ამაღლება / გორაკი' : 'Hill / Mound (+H)'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSetConcave}
                                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                        isExcavation 
                                            ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40 border-rose-500' 
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <ArrowDown size={15} />
                                    <span>{isKa ? 'თხრილი / ჩაღრმავება' : 'Ravine / Trench (-H)'}</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Height Slider & Vertical Gizmo */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                    <Sliders size={14} className="text-emerald-400" />
                                    <span>{isKa ? 'მწვერვალის სიმაღლე (H)' : 'Peak Height / Depth (H)'}</span>
                                </span>
                                <span className={`font-mono font-black text-sm ${isExcavation ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {activeSlope.peakHeightM > 0 ? `+${activeSlope.peakHeightM}m` : `${activeSlope.peakHeightM}m`}
                                </span>
                            </div>

                            <input
                                type="range"
                                min={-40}
                                max={60}
                                step={1}
                                value={activeSlope.peakHeightM}
                                onChange={(e) => updateActiveSlope({ peakHeightM: parseInt(e.target.value, 10) || 0 })}
                                className="w-full accent-emerald-500 cursor-pointer"
                            />

                            {/* Quick Step Buttons */}
                            <div className="flex items-center gap-1.5 pt-1">
                                {[-20, -10, -5, 5, 15, 30].map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => updateActiveSlope({ peakHeightM: h })}
                                        className={`flex-1 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                                            activeSlope.peakHeightM === h
                                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                        }`}
                                    >
                                        {h > 0 ? `+${h}` : h}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Radius Ring of Influence (R) */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                    <Compass size={14} className="text-emerald-400" />
                                    <span>{isKa ? 'გავლენის რადიუსი (R)' : 'Influence Radius (R)'}</span>
                                </span>
                                <span className="font-mono font-black text-sm text-emerald-400">
                                    {activeSlope.radiusM} meters
                                </span>
                            </div>

                            <input
                                type="range"
                                min={15}
                                max={250}
                                step={5}
                                value={activeSlope.radiusM}
                                onChange={(e) => updateActiveSlope({ radiusM: parseInt(e.target.value, 10) || 50 })}
                                className="w-full accent-emerald-500 cursor-pointer"
                            />
                            
                            <p className="text-[10px] text-slate-400">
                                {isKa 
                                    ? 'რადიუსის გაზრდა ფერდობს ხდის უფრო გრძელს და დამრეცს, შემცირება კი - ციცაბოს.' 
                                    : 'Increasing radius makes the slope shallower and longer; decreasing it makes it steeper.'}
                            </p>
                        </div>

                        {/* 5. Falloff Formula Selector */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                            <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider text-[11px]">
                                {isKa ? '5. ფერდობის ფორმულა (Slope Type)' : '5. Slope Falloff Function'}
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'linear', label: isKa ? 'წრფივი' : 'Linear', desc: 'Z = H(1 - r/R)' },
                                    { id: 'cosine', label: isKa ? 'ბუნებრივი' : 'Cosine', desc: 'Smoothstep' },
                                    { id: 'plateau', label: isKa ? 'პლატო' : 'Plateau', desc: 'Flat Crown' }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => updateActiveSlope({ slopeType: type.id as any })}
                                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                            activeSlope.slopeType === type.id
                                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold'
                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <div className="text-xs">{type.label}</div>
                                        <div className="text-[9px] font-mono opacity-60 truncate">{type.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Slope Library Actions: Add New, Duplicate, Delete */}
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleAddNewSlope}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30"
                            >
                                <Plus size={14} />
                                <span>{isKa ? 'ახალი ფერდობი' : 'Add Slope'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDuplicateSlope}
                                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors cursor-pointer"
                                title="Duplicate Slope"
                            >
                                <Copy size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSlope}
                                className="p-2.5 bg-slate-900 hover:bg-rose-950/40 text-rose-400 rounded-xl border border-slate-800 transition-colors cursor-pointer"
                                title="Delete Slope"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                            {slopes.length} {isKa ? 'აქტიური 3D ფერდობი ინტეგრირებულია რელიეფში' : 'active slopes rendered in 3D terrain'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-900/40"
                    >
                        {isKa ? 'შენახვა & დასრულება' : 'Apply & Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TerrainSlopeSculptorModal: React.FC<TerrainSlopeSculptorModalProps> = (props) => {
    if (!props.isOpen) return null;
    return <TerrainSlopeSculptorModalContent {...props} />;
};
