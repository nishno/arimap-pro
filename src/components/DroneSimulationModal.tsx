import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, Play, Pause, RotateCcw, Download, Check, 
    Compass, Battery, Clock, Camera, Shield, Eye,
    Layers, Navigation, Settings2, Sliders, ChevronDown, ChevronUp,
    Share2, AlertCircle, FileText, ArrowRight, Sprout,
    Maximize2, Minimize2, Video, Square, Trash2, ArrowUpRight,
    MapPin, Crosshair, Satellite, Map as MapIcon
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon as LeafletPolygon, Polyline as LeafletPolyline, Marker as LeafletMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Sandbox3DTerrainCanvas } from './SystemManagement/HardwareLabs/Sandbox3DTerrainCanvas';
import { toast } from 'sonner';
import type { PlantationFeature } from '../types';
import { safeStorage } from '../services/storageService';
import { DroneCameraWindow, type SavedDroneRecording } from './DroneCameraWindow';
import { useLanguage } from '../contexts/LanguageContext';

export interface DroneWaypoint {
    lat: number;
    lng: number;
    altitude: number;
    speed: number;
    action?: 'takeoff' | 'photo' | 'turn' | 'land';
}

interface DroneSimulationModalProps {
    isOpen: boolean;
    onClose: () => void;
    plantationFeatures: PlantationFeature[];
    activeMapCenter?: [number, number];
    onSaveFlightPathToDraft?: (feature: PlantationFeature) => void;
    onSetActiveDrawingTool?: (tool: any) => void;
}

export const DroneSimulationModal: React.FC<DroneSimulationModalProps> = ({
    isOpen,
    onClose,
    plantationFeatures,
    activeMapCenter = [41.7151, 44.8271],
    onSaveFlightPathToDraft
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    // Window position & transparency
    const [transparency, setTransparency] = useState<number>(() => {
        const saved = safeStorage.getItem('agrimap_drone_modal_transparency');
        return saved ? Number(saved) : 95;
    });
    const [showTransparencyMenu, setShowTransparencyMenu] = useState<boolean>(false);
    const [customOpacityInput, setCustomOpacityInput] = useState<string>(String(transparency));
    const [isFolded, setIsFolded] = useState<boolean>(false);
    const [isCameraWindowOpen, setIsCameraWindowOpen] = useState<boolean>(false);

    // Active View Tab: 'plan' (Map & Parameters) vs 'camera' (Live FPV & Recording)
    const [activeTab, setActiveTab] = useState<'plan' | 'camera'>('plan');

    // Survey target selections: areas and trenches
    const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
    const [selectedTrenchIds, setSelectedTrenchIds] = useState<string[]>([]);
    const [flightMode, setFlightMode] = useState<'grid' | 'trenches' | 'corridor'>('grid');

    // Drawn Direction: Start Point -> End Point
    const [directionStart, setDirectionStart] = useState<[number, number] | null>(null);
    const [directionEnd, setDirectionEnd] = useState<[number, number] | null>(null);
    const [isDrawingDirection, setIsDrawingDirection] = useState<boolean>(false);
    const drawingSvgRef = useRef<SVGSVGElement | null>(null);

    // View mode for embedded farm map: Satellite vs 3D DEM vs Vector
    const [mapViewMode, setMapViewMode] = useState<'satellite' | '3d' | 'vector'>('satellite');
    const [customTrenchNumber, setCustomTrenchNumber] = useState<number>(12);

    // Flight configuration parameters
    const [altitude, setAltitude] = useState<number>(50); // meters AGL
    const [speed, setSpeed] = useState<number>(10); // m/s
    const [spacing, setSpacing] = useState<number>(20); // lane spacing in meters
    const [cameraMode, setCameraMode] = useState<'rgb' | 'ndvi' | 'thermal'>('ndvi');

    // Simulation playback
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentWaypointIdx, setCurrentWaypointIdx] = useState<number>(0);
    const [droneProgress, setDroneProgress] = useState<number>(0); // 0 to 100%
    const [photosCaptured, setPhotosCaptured] = useState<number>(0);
    const [batteryLevel, setBatteryLevel] = useState<number>(100);
    const playbackTimerRef = useRef<any>(null);

    // Saved Drone Recordings
    const [savedRecordings, setSavedRecordings] = useState<SavedDroneRecording[]>(() => {
        try {
            const raw = safeStorage.getItem('agrimap_drone_saved_recordings');
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    });

    const handleSaveRecording = (rec: SavedDroneRecording) => {
        setSavedRecordings(prev => {
            const next = [rec, ...prev];
            safeStorage.setItem('agrimap_drone_saved_recordings', JSON.stringify(next));
            return next;
        });
    };

    const handleDeleteRecording = (id: string) => {
        setSavedRecordings(prev => {
            const next = prev.filter(r => r.id !== id);
            safeStorage.setItem('agrimap_drone_saved_recordings', JSON.stringify(next));
            return next;
        });
        toast.success("Recording deleted");
    };

    // Filter available areas and trenches
    const availableAreas = useMemo(() => {
        return plantationFeatures.filter(f => f.type === 'area' || f.type === 'sector' || f.type === 'boundary');
    }, [plantationFeatures]);

    const availableTrenches = useMemo(() => {
        return plantationFeatures.filter(f => f.type === 'trench' || f.type === 'line' || (f as any).subType === 'trench');
    }, [plantationFeatures]);

    // Initialize selection if empty
    useEffect(() => {
        if (selectedAreaIds.length === 0 && availableAreas.length > 0) {
            setSelectedAreaIds([availableAreas[0].id]);
        }
    }, [availableAreas, selectedAreaIds.length]);

    // Handle Transparency Change
    const handleSetTransparency = (val: number) => {
        const clamped = Math.max(15, Math.min(100, val));
        setTransparency(clamped);
        setCustomOpacityInput(String(clamped));
        safeStorage.setItem('agrimap_drone_modal_transparency', String(clamped));
    };

    // Calculate Bearing Angle between Start and End Point
    const drawnBearing = useMemo(() => {
        if (!directionStart || !directionEnd) return 45; // default 45°
        const lat1 = (directionStart[0] * Math.PI) / 180;
        const lat2 = (directionEnd[0] * Math.PI) / 180;
        const dLng = ((directionEnd[1] - directionStart[1]) * Math.PI) / 180;
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        const brng = (Math.atan2(y, x) * 180) / Math.PI;
        return Math.round((brng + 360) % 360);
    }, [directionStart, directionEnd]);

    // Distance of drawn direction vector
    const drawnDistanceMeters = useMemo(() => {
        if (!directionStart || !directionEnd) return 0;
        const dLat = (directionEnd[0] - directionStart[0]) * 111111;
        const dLng = (directionEnd[1] - directionStart[1]) * 111111 * Math.cos((directionStart[0] * Math.PI) / 180);
        return Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
    }, [directionStart, directionEnd]);

    // Generate Waypoints based on flightMode, selected areas/trenches, and drawn direction
    const waypoints: DroneWaypoint[] = useMemo(() => {
        const pts: DroneWaypoint[] = [];

        // 1. TRENCH-FOLLOWING MODE
        if (flightMode === 'trenches' && selectedTrenchIds.length > 0) {
            const selectedTrenches = availableTrenches.filter(t => selectedTrenchIds.includes(t.id));
            if (selectedTrenches.length > 0) {
                // Initial takeoff
                const firstCoord = Array.isArray(selectedTrenches[0].geometry) ? selectedTrenches[0].geometry[0] : activeMapCenter;
                pts.push({
                    lat: (firstCoord as any)[0] || activeMapCenter[0],
                    lng: (firstCoord as any)[1] || activeMapCenter[1],
                    altitude: altitude,
                    speed: speed * 0.6,
                    action: 'takeoff'
                });

                // Follow each selected trench line
                selectedTrenches.forEach((trench) => {
                    const coords = (Array.isArray(trench.geometry) ? trench.geometry : []) as [number, number][];
                    coords.forEach((c) => {
                        if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
                            pts.push({
                                lat: c[0],
                                lng: c[1],
                                altitude: altitude,
                                speed: speed,
                                action: 'photo'
                            });
                        }
                    });
                });

                // Land at last point
                if (pts.length > 0) {
                    const last = pts[pts.length - 1];
                    pts.push({
                        lat: last.lat,
                        lng: last.lng,
                        altitude: 0,
                        speed: 2,
                        action: 'land'
                    });
                }
                return pts;
            }
        }

        // 2. DRAWN CORRIDOR MODE (Directional flight directly along drawn Start -> End)
        if (flightMode === 'corridor' && directionStart && directionEnd) {
            pts.push({
                lat: directionStart[0],
                lng: directionStart[1],
                altitude: altitude,
                speed: speed * 0.5,
                action: 'takeoff'
            });

            const steps = Math.max(4, Math.round(drawnDistanceMeters / 25));
            for (let i = 0; i <= steps; i++) {
                const ratio = i / steps;
                const lat = directionStart[0] + (directionEnd[0] - directionStart[0]) * ratio;
                const lng = directionStart[1] + (directionEnd[1] - directionStart[1]) * ratio;
                pts.push({
                    lat,
                    lng,
                    altitude: altitude,
                    speed: speed,
                    action: 'photo'
                });
            }

            pts.push({
                lat: directionEnd[0],
                lng: directionEnd[1],
                altitude: 0,
                speed: 2,
                action: 'land'
            });
            return pts;
        }

        // 3. GRID SURVEY MODE (Across selected areas, aligned with drawn direction vector or angle)
        let centerLat = activeMapCenter[0];
        let centerLng = activeMapCenter[1];

        // If areas selected, compute centroid
        const selectedAreas = availableAreas.filter(a => selectedAreaIds.includes(a.id));
        if (selectedAreas.length > 0 && Array.isArray(selectedAreas[0].geometry) && selectedAreas[0].geometry.length > 0) {
            const coords = selectedAreas[0].geometry as [number, number][];
            const sumLat = coords.reduce((acc, c) => acc + (c[0] || 0), 0);
            const sumLng = coords.reduce((acc, c) => acc + (c[1] || 0), 0);
            centerLat = sumLat / coords.length;
            centerLng = sumLng / coords.length;
        } else if (directionStart) {
            centerLat = directionStart[0];
            centerLng = directionStart[1];
        }

        const numLanes = 6;
        const laneLengthMeters = Math.max(160, drawnDistanceMeters > 0 ? drawnDistanceMeters : 220);
        const metersToLat = 1 / 111111;
        const metersToLng = 1 / (111111 * Math.cos((centerLat * Math.PI) / 180));

        // Use drawn bearing angle to rotate lanes
        const angleRad = ((drawnBearing - 90) * Math.PI) / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        // Takeoff
        pts.push({
            lat: centerLat - 0.0008,
            lng: centerLng - 0.0008,
            altitude: altitude,
            speed: speed * 0.6,
            action: 'takeoff'
        });

        for (let i = 0; i < numLanes; i++) {
            const laneOffset = (i - numLanes / 2) * spacing;
            const isEven = i % 2 === 0;
            const startDist = isEven ? -laneLengthMeters / 2 : laneLengthMeters / 2;
            const endDist = isEven ? laneLengthMeters / 2 : -laneLengthMeters / 2;

            // Rotate offsets
            const dx1 = startDist * cosA - laneOffset * sinA;
            const dy1 = startDist * sinA + laneOffset * cosA;

            const dx2 = endDist * cosA - laneOffset * sinA;
            const dy2 = endDist * sinA + laneOffset * cosA;

            pts.push({
                lat: centerLat + dy1 * metersToLat,
                lng: centerLng + dx1 * metersToLng,
                altitude: altitude,
                speed: speed,
                action: 'photo'
            });

            pts.push({
                lat: centerLat + dy2 * metersToLat,
                lng: centerLng + dx2 * metersToLng,
                altitude: altitude,
                speed: speed,
                action: 'photo'
            });
        }

        // Landing
        pts.push({
            lat: centerLat - 0.0008,
            lng: centerLng - 0.0008,
            altitude: 0,
            speed: 3,
            action: 'land'
        });

        return pts;
    }, [
        flightMode, selectedAreaIds, selectedTrenchIds, availableAreas, availableTrenches, 
        directionStart, directionEnd, drawnBearing, drawnDistanceMeters, activeMapCenter, spacing, altitude, speed
    ]);

    // Mission Stats
    const missionStats = useMemo(() => {
        let totalDistMeters = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i + 1];
            const dLat = (p2.lat - p1.lat) * 111111;
            const dLng = (p2.lng - p1.lng) * 111111 * Math.cos((p1.lat * Math.PI) / 180);
            totalDistMeters += Math.sqrt(dLat * dLat + dLng * dLng);
        }

        const totalFlightTimeSec = totalDistMeters / Math.max(1, speed);
        const minutes = Math.floor(totalFlightTimeSec / 60);
        const seconds = Math.floor(totalFlightTimeSec % 60);
        const gsd = (altitude * 0.035).toFixed(2);
        const totalPhotos = Math.max(8, Math.round(totalDistMeters / 15));
        const totalBatteryPercent = Math.min(100, Math.round((totalFlightTimeSec / 60) * 3.5));
        const batteriesRequired = Math.ceil(totalBatteryPercent / 85);

        return {
            totalDistMeters: Math.round(totalDistMeters),
            flightTimeString: `${minutes}m ${seconds}s`,
            totalFlightTimeSec,
            gsd,
            totalPhotos,
            totalBatteryPercent,
            batteriesRequired
        };
    }, [waypoints, speed, altitude]);

    // Simulation Timer Loop
    useEffect(() => {
        if (!isPlaying) {
            if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
            return;
        }

        playbackTimerRef.current = setInterval(() => {
            setCurrentWaypointIdx(prev => {
                const next = prev + 1;
                if (next >= waypoints.length) {
                    setIsPlaying(false);
                    toast.success("🚁 Autonomous drone mission completed!");
                    return waypoints.length - 1;
                }
                const progressPct = Math.round((next / (waypoints.length - 1)) * 100);
                setDroneProgress(progressPct);
                setPhotosCaptured(Math.round((progressPct / 100) * missionStats.totalPhotos));
                setBatteryLevel(Math.max(10, 100 - Math.round((progressPct / 100) * missionStats.totalBatteryPercent)));
                return next;
            });
        }, 1100);

        return () => {
            if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
        };
    }, [isPlaying, waypoints.length, missionStats]);

    const handleResetSimulation = () => {
        setIsPlaying(false);
        setCurrentWaypointIdx(0);
        setDroneProgress(0);
        setPhotosCaptured(0);
        setBatteryLevel(100);
    };

    // Save Path to Draft
    const handleSaveToDraft = () => {
        if (onSaveFlightPathToDraft) {
            const flightFeature: PlantationFeature = {
                id: `drone-plan-${Date.now()}`,
                name: `Drone Survey Plan (${missionStats.flightTimeString})`,
                type: 'line',
                layerId: 'root',
                geometry: waypoints.map(w => [w.lat, w.lng] as [number, number]),
                color: '#38bdf8',
                notes: `Altitude: ${altitude}m | Speed: ${speed}m/s | Spacing: ${spacing}m | Camera: ${cameraMode.toUpperCase()} | Direction: ${drawnBearing}°`,
                isDraft: true,
                isSimulated: true
            };
            onSaveFlightPathToDraft(flightFeature);
            toast.success("Flight path saved to draft features!");
        }
    };

    // Export Mission JSON
    const handleExportFlightPlan = () => {
        const payload = {
            missionName: `AgriMap_Drone_Mission_${Date.now()}`,
            timestamp: new Date().toISOString(),
            parameters: {
                altitudeMeters: altitude,
                speedMps: speed,
                laneSpacingMeters: spacing,
                sensor: cameraMode,
                flightBearingDeg: drawnBearing,
                flightMode: flightMode
            },
            directionVector: directionStart && directionEnd ? {
                start: directionStart,
                end: directionEnd,
                bearing: drawnBearing,
                distanceMeters: drawnDistanceMeters
            } : null,
            waypoints: waypoints
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Drone_Mission_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Drone Mission JSON exported!");
    };

    // Fold Configuration Window -> Automatically open separate Floating Camera Window
    const handleFoldWindow = () => {
        setIsFolded(true);
        setIsCameraWindowOpen(true);
        toast.info("Configuration folded. Separate Drone Camera FPV window opened on map!");
    };

    const handleUnfoldWindow = () => {
        setIsFolded(false);
    };

    if (!isOpen) return null;

    // Mini Map SVG Bounds Calculation
    const allPoints: [number, number][] = [];
    plantationFeatures.forEach(f => {
        if (Array.isArray(f.geometry)) {
            f.geometry.forEach((p: any) => {
                if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
                    allPoints.push([p[0], p[1]]);
                }
            });
        }
    });
    if (allPoints.length === 0) {
        allPoints.push(activeMapCenter);
        allPoints.push([activeMapCenter[0] + 0.002, activeMapCenter[1] + 0.002]);
        allPoints.push([activeMapCenter[0] - 0.002, activeMapCenter[1] - 0.002]);
    }

    const minLat = Math.min(...allPoints.map(p => p[0]));
    const maxLat = Math.max(...allPoints.map(p => p[0]));
    const minLng = Math.min(...allPoints.map(p => p[1]));
    const maxLng = Math.max(...allPoints.map(p => p[1]));
    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.001, maxLng - minLng);

    const projectToSvg = (lat: number, lng: number) => {
        const x = 30 + ((lng - minLng) / lngSpan) * 340;
        const y = 200 - ((lat - minLat) / latSpan) * 160;
        return [x, y];
    };

    // Handle Click / Drag on Mini Map to set Start and Finish direction
    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!isDrawingDirection) return;
        const rect = drawingSvgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Inverse project to lat/lng
        const normX = Math.max(0, Math.min(1, (clickX - 30) / 340));
        const normY = Math.max(0, Math.min(1, (200 - clickY) / 160));
        const targetLng = minLng + normX * lngSpan;
        const targetLat = minLat + normY * latSpan;

        if (!directionStart) {
            setDirectionStart([targetLat, targetLng]);
            toast.info("📍 Start Point (A) set! Click to set Finish Point (B).");
        } else {
            setDirectionEnd([targetLat, targetLng]);
            setIsDrawingDirection(false);
            setFlightMode('corridor');
            toast.success(`🏁 Flight direction set: ${drawnBearing}° heading, ${drawnDistanceMeters}m corridor!`);
        }
    };

    const currentDronePoint = waypoints[currentWaypointIdx] || waypoints[0];

    return (
        <>
            {/* Separate Floating Camera HUD Window (shown when open or when configuration is folded) */}
            <DroneCameraWindow
                isOpen={isCameraWindowOpen}
                onClose={() => setIsCameraWindowOpen(false)}
                onUnfoldConfig={handleUnfoldWindow}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onReset={handleResetSimulation}
                currentProgress={droneProgress}
                currentWaypointIdx={currentWaypointIdx}
                totalWaypoints={waypoints.length}
                altitude={altitude}
                speed={speed}
                activeCoords={currentDronePoint ? [currentDronePoint.lat, currentDronePoint.lng] : activeMapCenter}
                cameraMode={cameraMode}
                onSetCameraMode={setCameraMode}
                savedRecordings={savedRecordings}
                onSaveRecording={handleSaveRecording}
                onDeleteRecording={handleDeleteRecording}
            />

            {/* Folded Compact Pill Status Bar */}
            {isFolded ? (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] bg-slate-950/95 backdrop-blur-2xl border border-sky-500/50 text-white shadow-2xl rounded-2xl px-4 py-2 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 select-none pointer-events-auto">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
                        </span>
                        <span className="text-xs font-black uppercase tracking-wider text-sky-300">
                            {isKa ? "დრონის აეროგადაღება" : "Drone Survey Mission"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-sky-500/20 text-sky-200 border border-sky-500/30">
                            WP {currentWaypointIdx + 1}/{waypoints.length} ({droneProgress}%)
                        </span>
                    </div>

                    <div className="h-4 w-px bg-slate-800" />

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                                isPlaying ? 'bg-amber-600 text-white' : 'bg-sky-600 text-white'
                            }`}
                        >
                            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                            <span>{isPlaying ? (isKa ? 'პაუზა' : 'Pause') : (isKa ? 'გაგრძელება' : 'Resume')}</span>
                        </button>

                        <button
                            onClick={() => setIsCameraWindowOpen(true)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white rounded-xl text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title={isKa ? "დრონის კამერის ჩვენება" : "Show Drone Camera View"}
                        >
                            <Camera size={12} />
                            <span>{isKa ? "კამერა HUD" : "Camera HUD"}</span>
                        </button>

                        <button
                            onClick={handleUnfoldWindow}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                            title={isKa ? "სრული ფანჯრის გახსნა" : "Unfold full configuration window"}
                        >
                            <ArrowUpRight size={12} />
                            <span>{isKa ? "გაშლა" : "Unfold"}</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title={isKa ? "სიმულატორის დახურვა" : "Close Drone Simulator"}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ) : (
                /* Main Non-Blocking Floating Configuration Window */
                <div 
                    className="fixed inset-0 z-[9980] flex items-center justify-center p-3 sm:p-6 pointer-events-none"
                >
                    <div 
                        style={{ opacity: transparency / 100 }}
                        className="relative w-full max-w-3xl bg-slate-950/95 backdrop-blur-2xl border border-sky-500/40 rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col text-slate-100 max-h-[92vh] pointer-events-auto transition-opacity duration-150 animate-in fade-in zoom-in-95"
                    >
                        
                        {/* Header Row */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-inner">
                                    <span className="text-xl">🚁</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                            {isKa ? "ავტონომიური დრონის აეროგადაღების დამგეგმავი" : "Autonomous Drone Survey Planner"}
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                            {isKa ? "ცოცხალი სიმულატორი" : "Live Simulator"}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        {isKa 
                                            ? "აირჩიეთ ფართობები, თხრილები, მონიშნეთ მიმართულება და აკონტროლეთ კამერის ცოცხალი ნაკადი" 
                                            : "Select areas, trenches, draw flight direction (Start → Finish), and stream live camera feed"}
                                    </p>
                                </div>
                            </div>

                            {/* Header Window Actions: Transparency %, Camera View, Fold, Close */}
                            <div className="flex items-center gap-1.5">
                                {/* Transparency % Popover */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowTransparencyMenu(!showTransparencyMenu)}
                                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white rounded-xl text-xs font-mono font-black border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                                        title={isKa ? "გამჭვირვალობის რეგულირება" : "Adjust transparency by percent (write or click %)"}
                                    >
                                        <Eye size={13} />
                                        <span>{transparency}%</span>
                                    </button>

                                    {showTransparencyMenu && (
                                        <div className="absolute right-0 top-full mt-2 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl w-52 space-y-2.5 text-xs animate-in fade-in">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                                                <span>{isKa ? "ფანჯრის გამჭვირვალობა" : "Window Transparency"}</span>
                                                <span className="text-sky-400 font-mono font-black">{transparency}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={15}
                                                max={100}
                                                step={5}
                                                value={transparency}
                                                onChange={(e) => handleSetTransparency(Number(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min={10}
                                                    max={100}
                                                    value={customOpacityInput}
                                                    onChange={(e) => {
                                                        setCustomOpacityInput(e.target.value);
                                                        const val = Number(e.target.value);
                                                        if (Number.isFinite(val) && val >= 10 && val <= 100) {
                                                            handleSetTransparency(val);
                                                        }
                                                    }}
                                                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-mono"
                                                    placeholder="%"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    {[100, 80, 50, 25].map(p => (
                                                        <button
                                                            key={p}
                                                            onClick={() => handleSetTransparency(p)}
                                                            className="flex-1 py-1 bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white rounded-md text-[9px] font-bold transition-colors"
                                                        >
                                                            {p}%
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-slate-500">
                                                {isKa ? "გახადეთ ფანჯარა გამჭვირვალე რუკაზე ერთდროულად სამუშაოდ." : "Make window transparent to see and work on the map at the same time."}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Floating Camera HUD Pop-out */}
                                <button
                                    onClick={() => setIsCameraWindowOpen(true)}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                                    title={isKa ? "ცალკე მცურავი კამერის HUD-ის გახსნა" : "Open Separate Floating Camera View HUD"}
                                >
                                    <Video size={16} />
                                </button>

                                {/* Fold / Minimize Button */}
                                <button
                                    onClick={handleFoldWindow}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                                    title={isKa ? "ფანჯრის ჩაკეცვა მცურავ ზოლად" : "Fold configuration window into floating bar and show camera view"}
                                >
                                    <ChevronDown size={16} />
                                </button>

                                {/* Close Button */}
                                <button 
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-rose-900/50 rounded-xl transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Top View Tabs: Mission Map & Parameters vs Camera View & Recording */}
                        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 text-xs font-black uppercase tracking-wider">
                            <button
                                onClick={() => setActiveTab('plan')}
                                className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                                    activeTab === 'plan'
                                        ? 'border-sky-500 text-sky-300 bg-sky-500/10'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Compass size={14} />
                                <span>{isKa ? "ინტერაქტიული რუკა & მიმართულება" : "Interactive Map & Direction"}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('camera')}
                                className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                                    activeTab === 'camera'
                                        ? 'border-sky-500 text-sky-300 bg-sky-500/10'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Camera size={14} />
                                <span>{isKa ? "ცოცხალი კამერა FPV & ჩაწერა" : "Live Camera FPV & Recording"}</span>
                                {savedRecordings.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500 text-slate-950 font-bold font-mono">
                                        {savedRecordings.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            
                            {activeTab === 'plan' ? (
                                <>
                                    {/* Interactive Farm Vector Mini Map with Drawing Direction Support */}
                                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                                    <Compass size={14} className="text-sky-400" />
                                                    <span>{isKa ? "მეურნეობის რუკა & მარშრუტი" : "Farm Survey Map & Waypoint Corridor"}</span>
                                                </span>
                                                {directionStart && directionEnd && (
                                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold">
                                                        {isKa ? "აზიმუტი" : "Bearing"}: {drawnBearing}&deg; &bull; {drawnDistanceMeters}m
                                                    </span>
                                                )}
                                            </div>

                                            {/* Map Mode Switcher: SATELLITE | 3D DEM | VECTOR */}
                                            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setMapViewMode('satellite')}
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                                        mapViewMode === 'satellite' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    <Satellite size={11} />
                                                    <span>{isKa ? 'სატელიტი' : 'Satellite'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setMapViewMode('3d')}
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                                        mapViewMode === '3d' ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    <Layers size={11} />
                                                    <span>{isKa ? '3D რელიეფი' : '3D DEM'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setMapViewMode('vector')}
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                                        mapViewMode === 'vector' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    <Compass size={11} />
                                                    <span>{isKa ? 'ვექტორი' : 'Vector'}</span>
                                                </button>
                                            </div>

                                            {/* Draw Direction Button */}
                                            <button
                                                onClick={() => {
                                                    setIsDrawingDirection(true);
                                                    setDirectionStart(null);
                                                    setDirectionEnd(null);
                                                    toast.info(isKa ? "📍 დააწკაპუნეთ რუკაზე საწყისი წერტილისთვის (A), შემდეგ კი ბოლო წერტილისთვის (B)." : "📍 Click on map to set Start Point (A), then click for Finish Point (B).");
                                                }}
                                                className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                                    isDrawingDirection
                                                        ? 'bg-amber-500 text-slate-950 animate-pulse ring-2 ring-amber-400'
                                                        : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-900/30'
                                                }`}
                                            >
                                                <Crosshair size={12} />
                                                <span>
                                                    {isDrawingDirection 
                                                        ? (isKa ? "დააწკაპუნეთ: წერტილი (A)" : "Click: Start Point (A)") 
                                                        : (isKa ? "მიმართულება (A → B)" : "Draw (A → B)")}
                                                </span>
                                            </button>
                                        </div>

                                        {/* Multi-view Map Canvas Viewport (Satellite / 3D / Vector) */}
                                        <div className="relative w-full h-[230px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80">
                                            {mapViewMode === 'satellite' ? (
                                                /* 🛰️ REAL SATELLITE MAP */
                                                <MapContainer
                                                    center={activeMapCenter}
                                                    zoom={17}
                                                    className="w-full h-full z-10"
                                                    zoomControl={false}
                                                >
                                                    <TileLayer
                                                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                                        maxZoom={20}
                                                    />
                                                    {/* Sectors on Satellite */}
                                                    {availableAreas.map(area => {
                                                        const coords = (Array.isArray(area.geometry) ? area.geometry : []) as [number, number][];
                                                        if (coords.length < 3) return null;
                                                        const isSelected = selectedAreaIds.includes(area.id);
                                                        return (
                                                            <LeafletPolygon
                                                                key={area.id}
                                                                positions={coords}
                                                                pathOptions={{
                                                                    color: isSelected ? '#38bdf8' : '#22c55e',
                                                                    weight: isSelected ? 2.5 : 1.5,
                                                                    fillColor: isSelected ? '#38bdf8' : '#22c55e',
                                                                    fillOpacity: isSelected ? 0.3 : 0.12
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                    {/* Trenches on Satellite */}
                                                    {availableTrenches.map(trench => {
                                                        const coords = (Array.isArray(trench.geometry) ? trench.geometry : []) as [number, number][];
                                                        if (coords.length < 2) return null;
                                                        const isSelected = selectedTrenchIds.includes(trench.id);
                                                        return (
                                                            <LeafletPolyline
                                                                key={trench.id}
                                                                positions={coords}
                                                                pathOptions={{
                                                                    color: isSelected ? '#f59e0b' : '#94a3b8',
                                                                    weight: isSelected ? 3 : 1.5,
                                                                    dashArray: isSelected ? undefined : '4, 4'
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                    {/* Flight Route on Satellite */}
                                                    {waypoints.length > 1 && (
                                                        <LeafletPolyline
                                                            positions={waypoints.map(w => [w.lat, w.lng] as [number, number])}
                                                            pathOptions={{
                                                                color: '#38bdf8',
                                                                weight: 3,
                                                                dashArray: '5, 5'
                                                            }}
                                                        />
                                                    )}
                                                </MapContainer>
                                            ) : mapViewMode === '3d' ? (
                                                /* 🏔️ 3D DIGITAL ELEVATION MODEL (DEM) TERRAIN */
                                                <div className="w-full h-full">
                                                    <Sandbox3DTerrainCanvas
                                                        plantationFeatures={plantationFeatures}
                                                        cameras={[]}
                                                        droneMission={{
                                                            name: 'Autonomous Survey',
                                                            mode: 'waypoints',
                                                            waypoints: waypoints.map((w, idx) => ({
                                                                id: `wp-${idx}`,
                                                                lat: w.lat,
                                                                lng: w.lng,
                                                                altM: w.altitude || altitude,
                                                                leg: idx === waypoints.length - 1 ? 'return' : 'outbound'
                                                            })),
                                                            circleRadiusM: 60,
                                                            altitudeM: altitude,
                                                            speedMs: speed,
                                                            telemetryIntervalS: 2,
                                                            directionDeg: drawnBearing || 45,
                                                            isSimulating: isPlaying,
                                                            simulatedProgress: droneProgress / 100,
                                                            currentLat: currentDronePoint?.lat || activeMapCenter[0],
                                                            currentLng: currentDronePoint?.lng || activeMapCenter[1],
                                                            currentAlt: altitude,
                                                            batteryPct: batteryLevel,
                                                            plantationName: 'Main Farm Sector',
                                                            sectorName: selectedAreaIds.join(', ') || 'Active Sector',
                                                            selectedTrenches: [],
                                                            isRecordingVideo: false,
                                                            recordingSeconds: 0,
                                                            opticalZoom: 1,
                                                            gimbalPitchDeg: -45
                                                        }}
                                                        soilSensors={[]}
                                                        waterSensors={[]}
                                                        workersGps={[]}
                                                        mapCenter={activeMapCenter}
                                                        isKa={isKa}
                                                        onSwitchTo2D={() => setMapViewMode('satellite')}
                                                    />
                                                </div>
                                            ) : (
                                                /* 🗺️ VECTOR SVG MAP */
                                                <svg
                                                    ref={drawingSvgRef}
                                                    onClick={handleSvgClick}
                                                    className="w-full h-full cursor-crosshair select-none"
                                                >
                                                    {/* Grid lines */}
                                                    <defs>
                                                        <pattern id="drone-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                                                        </pattern>
                                                    </defs>
                                                    <rect width="100%" height="100%" fill="url(#drone-grid)" />

                                                    {/* Draw Area Boundaries */}
                                                    {availableAreas.map(area => {
                                                        const isSelected = selectedAreaIds.includes(area.id);
                                                        const coords = (Array.isArray(area.geometry) ? area.geometry : []) as [number, number][];
                                                        if (coords.length < 3) return null;
                                                        const ptsStr = coords.map(c => projectToSvg(c[0], c[1]).join(',')).join(' ');
                                                        return (
                                                            <polygon
                                                                key={area.id}
                                                                points={ptsStr}
                                                                fill={isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(74, 222, 128, 0.1)'}
                                                                stroke={isSelected ? '#38bdf8' : '#22c55e'}
                                                                strokeWidth={isSelected ? 2 : 1}
                                                                className="cursor-pointer transition-colors"
                                                                onClick={(e) => {
                                                                    if (!isDrawingDirection) {
                                                                        e.stopPropagation();
                                                                        setSelectedAreaIds(prev => 
                                                                            prev.includes(area.id) ? prev.filter(x => x !== area.id) : [...prev, area.id]
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                        );
                                                    })}

                                                    {/* Draw Trenches / Rows */}
                                                    {availableTrenches.map(trench => {
                                                        const isSelected = selectedTrenchIds.includes(trench.id);
                                                        const coords = (Array.isArray(trench.geometry) ? trench.geometry : []) as [number, number][];
                                                        if (coords.length < 2) return null;
                                                        const ptsStr = coords.map(c => projectToSvg(c[0], c[1]).join(',')).join(' ');
                                                        return (
                                                            <polyline
                                                                key={trench.id}
                                                                points={ptsStr}
                                                                fill="none"
                                                                stroke={isSelected ? '#f59e0b' : '#94a3b8'}
                                                                strokeWidth={isSelected ? 3 : 1.5}
                                                                strokeDasharray={isSelected ? 'none' : '3, 3'}
                                                                className="cursor-pointer"
                                                                onClick={(e) => {
                                                                    if (!isDrawingDirection) {
                                                                        e.stopPropagation();
                                                                        setSelectedTrenchIds(prev => 
                                                                            prev.includes(trench.id) ? prev.filter(x => x !== trench.id) : [...prev, trench.id]
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                        );
                                                    })}

                                                    {/* Drawn Direction Vector (Start -> Finish) */}
                                                    {directionStart && directionEnd && (
                                                        <g>
                                                            {(() => {
                                                                const p1 = projectToSvg(directionStart[0], directionStart[1]);
                                                                const p2 = projectToSvg(directionEnd[0], directionEnd[1]);
                                                                return (
                                                                    <>
                                                                        <line
                                                                            x1={p1[0]}
                                                                            y1={p1[1]}
                                                                            x2={p2[0]}
                                                                            y2={p2[1]}
                                                                            stroke="#f59e0b"
                                                                            strokeWidth="3"
                                                                            strokeDasharray="4, 4"
                                                                        />
                                                                        {/* Start Point (A) */}
                                                                        <circle cx={p1[0]} cy={p1[1]} r="6" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                                                                        <text x={p1[0]} y={p1[1] - 8} fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">
                                                                            {isKa ? "საწყისი (A)" : "START (A)"}
                                                                        </text>

                                                                        {/* Finish Point (B) */}
                                                                        <circle cx={p2[0]} cy={p2[1]} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                                                                        <text x={p2[0]} y={p2[1] - 8} fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">
                                                                            {isKa ? "დასასრული (B)" : "FINISH (B)"}
                                                                        </text>
                                                                    </>
                                                                );
                                                            })()}
                                                        </g>
                                                    )}

                                                    {/* Generated Flight Waypoints & Path */}
                                                    {waypoints.length > 1 && (
                                                        <g>
                                                            <polyline
                                                                points={waypoints.map(w => projectToSvg(w.lat, w.lng).join(',')).join(' ')}
                                                                fill="none"
                                                                stroke="#38bdf8"
                                                                strokeWidth="1.5"
                                                                strokeOpacity="0.8"
                                                            />
                                                            {waypoints.map((w, i) => {
                                                                const p = projectToSvg(w.lat, w.lng);
                                                                return (
                                                                    <circle
                                                                        key={i}
                                                                        cx={p[0]}
                                                                        cy={p[1]}
                                                                        r={i === currentWaypointIdx ? 5 : 2}
                                                                        fill={i === currentWaypointIdx ? '#f59e0b' : '#38bdf8'}
                                                                    />
                                                                );
                                                            })}
                                                        </g>
                                                    )}

                                                    {/* Moving Drone Marker */}
                                                    {currentDronePoint && (
                                                        <g>
                                                            {(() => {
                                                                const dp = projectToSvg(currentDronePoint.lat, currentDronePoint.lng);
                                                                return (
                                                                    <g transform={`translate(${dp[0]}, ${dp[1]})`}>
                                                                        <circle r="9" fill="#0284c7" fillOpacity="0.4" className="animate-ping" />
                                                                        <circle r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                                                                        <text x="0" y="14" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                                                                            {isKa ? "დრონი" : "DRONE"}
                                                                        </text>
                                                                    </g>
                                                                );
                                                            })()}
                                                        </g>
                                                    )}
                                                </svg>
                                            )}

                                            {/* Overlay Drawing Helper */}
                                            {isDrawingDirection && (
                                                <div className="absolute top-2 left-2 z-20 bg-amber-500/90 text-slate-950 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider animate-bounce shadow-md">
                                                    {!directionStart 
                                                        ? (isKa ? "დააწკაპუნეთ რუკაზე: საწყისი წერტილი" : "Click Map: Set Starting Point") 
                                                        : (isKa ? "დააწკაპუნეთ რუკაზე: ბოლო წერტილი" : "Click Map: Set Finish Point")}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selection of Areas and Trenches */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Survey Areas */}
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                                    <Layers size={13} className="text-sky-400" />
                                                    <span>{isKa ? "სამიზნე ფართობები / სექტორები" : "Target Areas / Sectors"}</span>
                                                </span>
                                                <span className="text-[10px] text-sky-400 font-mono font-bold">
                                                    {selectedAreaIds.length} {isKa ? "არჩეულია" : "selected"}
                                                </span>
                                            </div>

                                            <div className="max-h-28 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                                {availableAreas.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500 py-1">
                                                        {isKa ? "საზღვრის სექტორები ჯერ დახაზული არ არის." : "No boundary sectors drawn yet."}
                                                    </p>
                                                ) : (
                                                    availableAreas.map(area => {
                                                        const isChecked = selectedAreaIds.includes(area.id);
                                                        return (
                                                            <label
                                                                key={area.id}
                                                                className={`flex items-center justify-between p-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                                                                    isChecked
                                                                        ? 'bg-sky-500/15 border-sky-500/40 text-white'
                                                                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => {
                                                                            setSelectedAreaIds(prev => 
                                                                                prev.includes(area.id) ? prev.filter(x => x !== area.id) : [...prev, area.id]
                                                                            );
                                                                        }}
                                                                        className="w-3.5 h-3.5 rounded text-sky-500 accent-sky-500"
                                                                    />
                                                                    <span className="font-bold truncate">{area.name}</span>
                                                                </div>
                                                                <span className="text-[9px] font-mono text-slate-400 uppercase">
                                                                    {area.type}
                                                                </span>
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* Trenches to Fly */}
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                                    <Sprout size={13} className="text-amber-400" />
                                                    <span>{isKa ? "სამიზნე თხრილები / მწკრივები" : "Target Trenches / Tree Rows"}</span>
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-slate-400 font-bold">{isKa ? "რაოდენობა:" : "Count:"}</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={100}
                                                        value={customTrenchNumber}
                                                        onChange={(e) => {
                                                            const count = Math.max(1, Number(e.target.value));
                                                            setCustomTrenchNumber(count);
                                                            const ids = availableTrenches.slice(0, count).map(t => t.id);
                                                            setSelectedTrenchIds(ids);
                                                            setFlightMode('trenches');
                                                        }}
                                                        className="w-14 px-1.5 py-0.5 bg-slate-950 border border-amber-500/50 rounded-lg text-amber-400 font-mono text-xs font-black text-right outline-none focus:border-amber-400"
                                                        title={isKa ? "ჩაწერეთ თხრილების რაოდენობა" : "Write number of trenches"}
                                                    />
                                                    <span className="text-[10px] text-amber-400 font-mono font-bold">
                                                        ({selectedTrenchIds.length})
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="max-h-28 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                                {availableTrenches.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500 py-1">
                                                        {isKa ? "თხრილები ჯერ დახაზული არ არის." : "No trenches drawn yet."}
                                                    </p>
                                                ) : (
                                                    availableTrenches.map(trench => {
                                                        const isChecked = selectedTrenchIds.includes(trench.id);
                                                        return (
                                                            <label
                                                                key={trench.id}
                                                                className={`flex items-center justify-between p-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                                                                    isChecked
                                                                        ? 'bg-amber-500/15 border-amber-500/40 text-white'
                                                                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => {
                                                                            setSelectedTrenchIds(prev => 
                                                                                prev.includes(trench.id) ? prev.filter(x => x !== trench.id) : [...prev, trench.id]
                                                                            );
                                                                            setFlightMode('trenches');
                                                                        }}
                                                                        className="w-3.5 h-3.5 rounded text-amber-500 accent-amber-500"
                                                                    />
                                                                    <span className="font-bold truncate">{trench.name || (isKa ? 'თხრილის მწკრივი' : 'Trench Row')}</span>
                                                                </div>
                                                                <span className="text-[9px] font-mono text-amber-400">
                                                                    {isKa ? 'თხრილი' : 'TRENCH'}
                                                                </span>
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Parameters & Flight Modes - with both Sliders and Direct Number Inputs */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                                <span>{isKa ? "სიმაღლე" : "Altitude"}</span>
                                                <div className="flex items-center gap-0.5">
                                                    <input
                                                        type="number"
                                                        min={20}
                                                        max={150}
                                                        value={altitude}
                                                        onChange={(e) => setAltitude(Number(e.target.value))}
                                                        className="w-12 px-1 py-0 bg-slate-950 border border-slate-700 rounded text-sky-400 font-mono text-[10px] text-right font-black outline-none"
                                                    />
                                                    <span className="text-sky-400 font-mono font-bold text-[10px]">m</span>
                                                </div>
                                            </div>
                                            <input 
                                                type="range" 
                                                min={20} 
                                                max={100} 
                                                step={5} 
                                                value={altitude} 
                                                onChange={(e) => setAltitude(Number(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer"
                                            />
                                        </div>

                                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                                <span>{isKa ? "სიჩქარე" : "Speed"}</span>
                                                <div className="flex items-center gap-0.5">
                                                    <input
                                                        type="number"
                                                        min={2}
                                                        max={25}
                                                        value={speed}
                                                        onChange={(e) => setSpeed(Number(e.target.value))}
                                                        className="w-12 px-1 py-0 bg-slate-950 border border-slate-700 rounded text-sky-400 font-mono text-[10px] text-right font-black outline-none"
                                                    />
                                                    <span className="text-sky-400 font-mono font-bold text-[10px]">m/s</span>
                                                </div>
                                            </div>
                                            <input 
                                                type="range" 
                                                min={3} 
                                                max={20} 
                                                step={1}
                                                value={speed} 
                                                onChange={(e) => setSpeed(Number(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer"
                                            />
                                        </div>

                                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                                <span>{isKa ? "დაშორება" : "Lane Spacing"}</span>
                                                <div className="flex items-center gap-0.5">
                                                    <input
                                                        type="number"
                                                        min={5}
                                                        max={60}
                                                        value={spacing}
                                                        onChange={(e) => setSpacing(Number(e.target.value))}
                                                        className="w-12 px-1 py-0 bg-slate-950 border border-slate-700 rounded text-sky-400 font-mono text-[10px] text-right font-black outline-none"
                                                    />
                                                    <span className="text-sky-400 font-mono font-bold text-[10px]">m</span>
                                                </div>
                                            </div>
                                            <input 
                                                type="range" 
                                                min={10} 
                                                max={50} 
                                                step={5}
                                                value={spacing} 
                                                onChange={(e) => setSpacing(Number(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer"
                                            />
                                        </div>

                                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                                <span>{isKa ? "სენსორი" : "Camera Sensor"}</span>
                                                <span className="text-emerald-400 font-mono font-black uppercase">{cameraMode}</span>
                                            </div>
                                            <div className="flex gap-1 mt-1">
                                                {(['rgb', 'ndvi', 'thermal'] as const).map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setCameraMode(m)}
                                                        className={`flex-1 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                                                            cameraMode === m ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
                                                        }`}
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Live Camera FPV & Saved Recordings Gallery Tab */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                                            <Camera size={14} className="text-sky-400" />
                                            <span>{isKa ? "რეალური დროის საჰაერო ნაკადი" : "Real-time Aerial Sensor Stream"}</span>
                                        </h4>
                                        <button
                                            onClick={() => setIsCameraWindowOpen(true)}
                                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                                        >
                                            <ArrowUpRight size={13} />
                                            <span>{isKa ? "მცურავი კამერის HUD" : "Open Floating Camera HUD"}</span>
                                        </button>
                                    </div>

                                    {/* Embedded Camera Preview Info */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center py-8">
                                        <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                                            <Video size={24} />
                                        </div>
                                        <h5 className="text-sm font-bold text-white">
                                            {isKa ? "ინტეგრირებული FPV დრონის კამერა HUD" : "Integrated FPV Drone Camera HUD"}
                                        </h5>
                                        <p className="text-xs text-slate-400 max-w-md">
                                            {isKa 
                                                ? "მცურავი კამერის ფანჯარა აჩვენებს ცოცხალ 4K RGB, NDVI ქლოროფილის და თერმულ IR გამოსახულებას რეალურ დროში ჩაწერითა და ტელემეტრიით."
                                                : "The dedicated Floating Camera Window displays live 4K RGB, NDVI chlorophyll, and Thermal IR video feeds with real-time video recording and flight telemetry."}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={() => setIsCameraWindowOpen(true)}
                                                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                            >
                                                {isKa ? "კამერის HUD-ის გაშვება" : "Launch Live Camera HUD"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Saved Recordings Table */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-200">
                                                {isKa ? "შენახული ვიდეოჩანაწერები" : "Saved Video Recordings"} ({savedRecordings.length})
                                            </span>
                                        </div>
                                        {savedRecordings.length === 0 ? (
                                            <p className="text-xs text-slate-500 py-3 text-center">
                                                {isKa ? "ვიდეოჩანაწერები ჯერ არ არის შენახული." : "No drone video recordings saved yet."}
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {savedRecordings.map(rec => (
                                                    <div 
                                                        key={rec.id}
                                                        className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-10 h-7 bg-slate-800 rounded flex items-center justify-center text-slate-400 text-xs">
                                                                📹
                                                            </div>
                                                            <div>
                                                                <h6 className="text-xs font-bold text-slate-200">{rec.title}</h6>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {rec.durationSec}s &bull; {(rec.fileSizeBytes / (1024*1024)).toFixed(1)}MB &bull; {rec.cameraMode.toUpperCase()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleDeleteRecording(rec.id)}
                                                                className="p-1.5 hover:bg-rose-900 text-slate-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                                                                title={isKa ? "ჩანაწერის წაშლა" : "Delete recording"}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Live Flight Playback Bar */}
                            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                                        <span>
                                            {isPlaying 
                                                ? (isKa ? "სიმულაცია აქტიურია" : "Simulation Active") 
                                                : (isKa ? "სიმულატორი მზადაა" : "Simulator Ready")}
                                        </span>
                                    </span>
                                    <span className="font-mono text-sky-400 font-bold">
                                        WP {currentWaypointIdx + 1}/{waypoints.length} &bull; {droneProgress}%
                                    </span>
                                </div>

                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
                                        style={{ width: `${droneProgress}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                                    <span>{isKa ? "ფრენის დრო:" : "FLIGHT TIME:"} <strong className="text-white">{missionStats.flightTimeString}</strong></span>
                                    <span>{isKa ? "მანძილი:" : "DISTANCE:"} <strong className="text-white">{(missionStats.totalDistMeters / 1000).toFixed(2)} km</strong></span>
                                    <span>{isKa ? "ფოტოები:" : "PHOTOS:"} <strong className="text-emerald-400">{photosCaptured}/{missionStats.totalPhotos}</strong></span>
                                    <span>{isKa ? "ბატარეა:" : "BATTERY:"} <strong className="text-amber-400">{batteryLevel}%</strong></span>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className={`flex-1 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            isPlaying 
                                                ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                                                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/40'
                                        }`}
                                    >
                                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                        <span>
                                            {isPlaying 
                                                ? (isKa ? 'ფრენის პაუზა' : 'Pause Flight') 
                                                : currentWaypointIdx > 0 
                                                    ? (isKa ? 'ფრენის გაგრძელება' : 'Resume Flight') 
                                                    : (isKa ? 'სიმულაციის დაწყება' : 'Start Flight Simulation')}
                                        </span>
                                    </button>

                                    <button
                                        onClick={handleResetSimulation}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                                        title={isKa ? "ფრენის გადატვირთვა" : "Reset Flight"}
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                </div>
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-900/90">
                            <button
                                onClick={handleExportFlightPlan}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                <Download size={14} />
                                <span>{isKa ? "მისიის JSON ექსპორტი" : "Export Mission JSON"}</span>
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleFoldWindow}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                    title={isKa ? "ფანჯრის ჩაკეცვა" : "Fold window and keep camera view on map"}
                                >
                                    <ChevronDown size={14} />
                                    <span>{isKa ? "ჩაკეცვა" : "Fold Window"}</span>
                                </button>

                                <button
                                    onClick={handleSaveToDraft}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
                                >
                                    <Check size={14} />
                                    <span>{isKa ? "მარშრუტის შენახვა გეგმაში" : "Add Flight Path to Draft"}</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
};

export default DroneSimulationModal;
