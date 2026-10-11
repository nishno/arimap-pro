import React, { useState } from 'react';
import {
    Camera, Navigation, Sliders, Eye, EyeOff, Mountain,
    Video, Plus, Copy, Trash2, Move, Maximize2, Minimize2,
    X, AlertTriangle, Check, Layers, Film, Sparkles,
    Satellite, Compass, ShieldCheck, ChevronDown, Radio,
    RotateCcw, Activity, Droplets, User, ZoomIn
} from 'lucide-react';
import type { PlantationCamera } from './CameraNvrLab';
import type { SandboxDroneMission } from './HardwareTestingSandboxMap';
import type { HillSpineProfile, SpineControlPoint } from '../../../utils/demTerrainViewshed';
import { getElevationAtCoords, getSlopeAndAspect } from '../../../utils/demTerrainViewshed';
import { computeBlindZoneDistanceM } from '../../../utils/cameraGeospatial';
import { DeviceControlPanel } from './DeviceControlPanel';

export interface RegisteredPlantationArea {
    id: string;
    name: string;
    nameKa: string;
    sectorName: string;
    center: [number, number];
    elevationBaseM: number;
}

interface HardwareAndDroneControlPopUpProps {
    isOpen: boolean;
    onClose: () => void;
    isMinimized: boolean;
    onToggleMinimize: () => void;
    isMaximized: boolean;
    onToggleMaximize: () => void;
    activeMode: 'camera' | 'drone' | '3d' | 'windows';
    onChangeMode: (mode: 'camera' | 'drone' | '3d' | 'windows') => void;
    
    // Registered Plantation Areas
    registeredPlantations: RegisteredPlantationArea[];
    selectedPlantationId: string;
    onSelectPlantation: (id: string) => void;

    // Camera Management
    testCameras: PlantationCamera[];
    activeCamera: PlantationCamera;
    onSelectCamera: (camId: string) => void;
    onUpdateActiveCamera: (patch: Partial<PlantationCamera>) => void;
    onAddCamera: () => void;
    onDuplicateCamera: () => void;
    onDeleteActiveCamera: () => void;
    hiddenCameraIds: string[];
    onToggleHideCamera: (id: string) => void;
    onToggleHideAllCameras: () => void;
    onMoveActiveCameraOnMap: () => void;
    isMovingCamera: boolean;
    onOpenLiveCameraStream: (camera: PlantationCamera) => void;

    // Drone Management
    testDroneMission: SandboxDroneMission;
    onUpdateDroneMission: (patch: Partial<SandboxDroneMission>) => void;
    onFlySelectedTrenches: () => void;
    onToggleTrench: (trenchNum: number) => void;
    onDroneTakePhoto: (name?: string) => void;
    onDroneToggleRecordVideo: (name?: string) => void;
    isDroneLiveFeedOpen: boolean;
    onToggleDroneLiveFeed: (open: boolean) => void;

    // 3D Terrain & Satellite DEM
    is3dWindowOpen: boolean;
    onToggle3dWindow: (open: boolean) => void;
    hillSpineProfile: HillSpineProfile;
    activePointId: string;
    onSelectPointId: (ptId: string) => void;
    onUpdateActivePoint: (patch: Partial<SpineControlPoint>) => void;
    onAddSpinePoint: () => void;
    onDeleteSpinePoint: (ptId: string) => void;
    elevationExaggeration: number;
    onChangeExaggeration: (val: number) => void;
    isSatelliteDemLoaded: boolean;
    onLoadSatelliteDem: () => void;
    isAiSlopeScanning: boolean;
    onAiAutoDetectSlope: () => void;

    // Window & Tool Visibility Toggles
    visibility: {
        showCameras: boolean;
        showDronePath: boolean;
        showSoilSensors: boolean;
        showWaterSensors: boolean;
        showWorkersGps: boolean;
        showTrenches: boolean;
        showSeedlings: boolean;
        showBlindZones: boolean;
        showDirections: boolean;
        showTopToolbar?: boolean;
        showTrenchConfigBar?: boolean;
        showBottomHud?: boolean;
        showFleetTable?: boolean;
        show3dWindow?: boolean;
    };
    onToggleVisibility: (key: string) => void;

    isKa: boolean;
    baseLat: number;
    baseLng: number;
}

export const HardwareAndDroneControlPopUp: React.FC<HardwareAndDroneControlPopUpProps> = ({
    isOpen,
    onClose,
    isMinimized,
    onToggleMinimize,
    isMaximized,
    onToggleMaximize,
    activeMode,
    onChangeMode,
    registeredPlantations,
    selectedPlantationId,
    onSelectPlantation,
    testCameras,
    activeCamera,
    onSelectCamera,
    onUpdateActiveCamera,
    onAddCamera,
    onDuplicateCamera,
    onDeleteActiveCamera,
    hiddenCameraIds,
    onToggleHideCamera,
    onToggleHideAllCameras,
    onMoveActiveCameraOnMap,
    isMovingCamera,
    onOpenLiveCameraStream,
    testDroneMission,
    onUpdateDroneMission,
    onFlySelectedTrenches,
    onToggleTrench,
    onDroneTakePhoto,
    onDroneToggleRecordVideo,
    isDroneLiveFeedOpen,
    onToggleDroneLiveFeed,
    is3dWindowOpen,
    onToggle3dWindow,
    hillSpineProfile,
    activePointId,
    onSelectPointId,
    onUpdateActivePoint,
    onAddSpinePoint,
    onDeleteSpinePoint,
    elevationExaggeration,
    onChangeExaggeration,
    isSatelliteDemLoaded,
    onLoadSatelliteDem,
    isAiSlopeScanning,
    onAiAutoDetectSlope,
    visibility,
    onToggleVisibility,
    isKa,
    baseLat,
    baseLng
}) => {
    if (!isOpen) return null;

    const currentPlantation = registeredPlantations.find(p => p.id === selectedPlantationId) || registeredPlantations[0];
    const isCurrentCamHidden = hiddenCameraIds.includes(activeCamera?.id || '');
    const allCamsHidden = testCameras.length > 0 && testCameras.every(c => hiddenCameraIds.includes(c.id));
    const [showDeviceControl, setShowDeviceControl] = useState<boolean>(true);

    // Active hill spine point
    const activePoint = hillSpineProfile.points.find(p => p.id === activePointId) || hillSpineProfile.points[0] || {
        id: 'pt-A',
        name: 'Connection point A',
        lat: baseLat,
        lng: baseLng,
        widthM: 45,
        startOffsetM: 0,
        endDistanceM: 80,
        peakHeightM: 37,
        slopeFalloff: 'cosine' as const
    };

    // Minimized Compact Pill Mode
    if (isMinimized) {
        return (
            <div className="absolute top-3 left-3 z-[2500] px-3 py-2 bg-slate-950/95 border border-cyan-500/60 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 text-xs text-white">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-black text-cyan-300 uppercase tracking-wider text-[11px]">
                        🛠️ {isKa ? 'მართვის Pop-up' : 'Control Pop-up'}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-blue-300 font-mono text-[10px]">[CH0{activeCamera?.channel || 1}]</span>
                    <span className="text-emerald-400 font-mono text-[10px]">{currentPlantation?.nameKa || currentPlantation?.name || 'Agrobari'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onToggleMinimize}
                        className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                        title="Expand Control Pop-up"
                    >
                        {isKa ? 'გახსნა' : 'Expand'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Close Pop-up"
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`
            ${isMaximized 
                ? 'fixed inset-4 z-[2800] rounded-3xl' 
                : 'fixed inset-x-3 top-16 bottom-4 md:inset-auto md:top-20 md:left-6 md:w-[560px] md:max-h-[86vh] z-[2200] rounded-3xl'
            }
            bg-slate-950/95 border border-cyan-500/50 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-slate-200 transition-all select-none
        `}>
            {/* 1. MASTER HEADER */}
            <div className="p-3 sm:p-3.5 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-400 border border-cyan-500/40 shrink-0">
                        <Sliders size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-xs sm:text-sm text-white uppercase tracking-wider truncate">
                                {isKa ? 'მართვის Pop-up: კამერები, 3D & დრონი' : 'Mission Control Pop-up: Cam, 3D & Drone'}
                            </h3>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                            {isKa ? 'ორმხრივი სინქრონიზაცია რუკასთან' : 'Live Reciprocal Map & DEM Synchronization'}
                        </p>
                    </div>
                </div>

                {/* Pop-up Window Controls: Minimize, Maximize, Close */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={onToggleMinimize}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                        title={isKa ? 'ჩაკეცვა' : 'Minimize to badge'}
                    >
                        <Minimize2 size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={onToggleMaximize}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                        title={isMaximized ? (isKa ? 'შემცირება' : 'Restore size') : (isKa ? 'გადიდება' : 'Maximize Pop-up')}
                    >
                        <Maximize2 size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-950/40 cursor-pointer transition-colors"
                        title={isKa ? 'დახურვა' : 'Close Pop-up'}
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* 2. REGISTERED PLANTATION AREAS SELECTOR (TOP OF POP-UP) */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800/80 shrink-0 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-emerald-400 font-black">🌱</span>
                        <span>{isKa ? 'რეგისტრირებული პლანტაციის არეალი:' : 'Registered Plantation Area:'}</span>
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                        Elev Base: ~{currentPlantation?.elevationBaseM || 480}m ASL
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <select
                            value={selectedPlantationId}
                            onChange={(e) => onSelectPlantation(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/40 hover:border-emerald-400 rounded-xl text-emerald-200 text-xs font-bold font-mono cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/50 appearance-none transition-all shadow-inner"
                        >
                            {registeredPlantations.map((plant, pIdx) => (
                                <option key={`plant-${plant.id}-${pIdx}`} value={plant.id} className="bg-slate-950 text-slate-200">
                                    📍 {isKa ? plant.nameKa : plant.name} • [{plant.center[0].toFixed(4)}, {plant.center[1].toFixed(4)}]
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-3 text-emerald-400 pointer-events-none" />
                    </div>

                    <button
                        type="button"
                        onClick={() => onSelectPlantation(selectedPlantationId)}
                        className="px-3 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                        title={isKa ? 'პლანტაციაზე გადაფრენა' : 'Fly map to Plantation'}
                    >
                        <Navigation size={12} className="text-emerald-400" />
                        <span>{isKa ? 'გადაფრენა' : 'Fly'}</span>
                    </button>
                </div>
            </div>

            {/* 3. MODE NAVIGATION TABS */}
            <div className="grid grid-cols-4 gap-1 p-2 bg-slate-900/60 border-b border-slate-800 text-xs shrink-0">
                <button
                    type="button"
                    onClick={() => onChangeMode('camera')}
                    className={`py-2 px-1 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeMode === 'camera'
                            ? 'bg-blue-600 text-white shadow-lg ring-1 ring-blue-300 font-black'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Camera size={13} className="shrink-0" />
                    <span className="text-[10px] uppercase truncate">{isKa ? 'კამერა' : 'Cameras'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onChangeMode('drone')}
                    className={`py-2 px-1 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeMode === 'drone'
                            ? 'bg-cyan-600 text-white shadow-lg ring-1 ring-cyan-300 font-black'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Navigation size={13} className="shrink-0" />
                    <span className="text-[10px] uppercase truncate">{isKa ? 'დრონი' : 'Drone'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onChangeMode('3d')}
                    className={`py-2 px-1 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeMode === '3d'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg ring-1 ring-emerald-300 font-black'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Mountain size={13} className="shrink-0" />
                    <span className="text-[10px] uppercase truncate">{isKa ? '3D & AI' : '3D Terrain'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onChangeMode('windows')}
                    className={`py-2 px-1 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                        activeMode === 'windows'
                            ? 'bg-purple-600 text-white shadow-lg ring-1 ring-purple-300 font-black'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Layers size={13} className="shrink-0" />
                    <span className="text-[10px] uppercase truncate">{isKa ? 'ფანჯრები' : 'Windows'}</span>
                </button>
            </div>

            {/* 4. SCROLLABLE TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">

                {/* ========================================================= */}
                {/* TAB 1: CAMERAS HUB (CAMERA 01 TOOLS & FLEET CONTROLS) */}
                {/* ========================================================= */}
                {activeMode === 'camera' && (
                    <div className="space-y-3.5">
                        {/* Channel selector chips & Master actions */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {isKa ? 'არჩეული კამერის არხი:' : 'Select Camera Channel:'}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={onAddCamera}
                                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                        title="Add new camera"
                                    >
                                        <Plus size={11} className="stroke-[3]" />
                                        <span>+ Add Cam</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onDuplicateCamera}
                                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                        title="Duplicate camera"
                                    >
                                        <Copy size={11} />
                                        <span>Dup</span>
                                    </button>
                                </div>
                            </div>

                            {/* Camera Channel Chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {testCameras.map((cam, idx) => {
                                    const isSelected = cam.id === activeCamera.id;
                                    const isHidden = hiddenCameraIds.includes(cam.id);
                                    return (
                                        <button
                                            key={`popup-cam-${cam.id}-${idx}`}
                                            type="button"
                                            onClick={() => onSelectCamera(cam.id)}
                                            className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300 font-black'
                                                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${isHidden ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
                                            <span>[CH0{cam.channel}]</span>
                                            <span className="text-[10px] font-sans font-normal opacity-90 truncate max-w-[90px]">{cam.name}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* MASTER FLEET VISIBILITY CONTROLS (HIDE / UNHIDE ALL TOGETHER) */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-2xl border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-blue-400" />
                                    <span className="text-[11px] font-bold text-slate-200">
                                        {isKa ? 'ყველა კამერა ერთად:' : 'All Cameras Visibility:'}
                                    </span>
                                    <span className="text-[10px] font-mono text-cyan-300">
                                        ({testCameras.length - hiddenCameraIds.length} / {testCameras.length} Visible)
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={onToggleHideAllCameras}
                                    className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow ${
                                        allCamsHidden
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                    }`}
                                >
                                    {allCamsHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                    <span>{allCamsHidden ? (isKa ? 'ყველას გამოჩენა' : 'Unhide All') : (isKa ? 'ყველას დამალვა' : 'Hide All')}</span>
                                </button>
                            </div>
                        </div>

                        {/* ACTIVE CAMERA TOOLS CARD (WORKS DIRECTLY ON SELECTED CAMERA) */}
                        <div className="p-3.5 bg-slate-900 rounded-2xl border border-blue-500/40 space-y-3 shadow-lg">
                            {/* Card Header with Camera Name and Individual Hide/Unhide Toggle */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800 font-mono font-bold text-[10px]">
                                            CH0{activeCamera.channel}
                                        </span>
                                        <span className="font-bold text-white text-xs">
                                            {activeCamera.name}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                        {activeCamera.locationName} • {activeCamera.model}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    {/* Individual Hide/Unhide Toggle for this camera */}
                                    <button
                                        type="button"
                                        onClick={() => onToggleHideCamera(activeCamera.id)}
                                        className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                                            isCurrentCamHidden
                                                ? 'bg-red-950 text-red-300 border border-red-800'
                                                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                                        }`}
                                        title={isCurrentCamHidden ? (isKa ? 'გამოჩენა რუკაზე' : 'Unhide on map') : (isKa ? 'დამალვა რუკიდან' : 'Hide from map')}
                                    >
                                        {isCurrentCamHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>

                                    {testCameras.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={onDeleteActiveCamera}
                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/60 rounded-xl cursor-pointer"
                                            title="Delete camera"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Pole Height (AGL) Slider */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'ბოძის სიმაღლე (Pole AGL)' : 'Pole Height (AGL)'}
                                    </span>
                                    <span className="text-cyan-400 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                                        {activeCamera.mountHeightM || 6}m
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="2"
                                    max="25"
                                    step="0.5"
                                    value={activeCamera.mountHeightM || 6}
                                    onChange={(e) => onUpdateActiveCamera({ mountHeightM: Number(e.target.value) })}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
                                    <span>Ground: {getElevationAtCoords(activeCamera.lat, activeCamera.lng, baseLat, baseLng).toFixed(1)}m</span>
                                    <span className="text-emerald-400 font-bold">Total Z: {(getElevationAtCoords(activeCamera.lat, activeCamera.lng, baseLat, baseLng) + (activeCamera.mountHeightM || 6)).toFixed(1)}m ASL</span>
                                </div>
                            </div>

                            {/* Vertical Tilt (Pitch Angle, e.g. 4°) Slider */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'დახრის კუთხე (Vertical Tilt - 4°)' : 'Vertical Tilt / Pitch Angle'}
                                    </span>
                                    <span className="text-amber-400 font-mono font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/40">
                                        {activeCamera.tiltAngleDeg || 4}° Pitch
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="45"
                                    step="1"
                                    value={activeCamera.tiltAngleDeg || 4}
                                    onChange={(e) => onUpdateActiveCamera({ tiltAngleDeg: Number(e.target.value) })}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                                <span className="text-[9px] text-slate-500 block mt-0.5">
                                    Downward pitch to eliminate blind sides over orchard slope
                                </span>
                            </div>

                            {/* Horizontal Azimuth (Yaw Heading) */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'აზიმუტი / მიმართულება' : 'Horizontal Azimuth / Yaw'}
                                    </span>
                                    <span className="text-blue-400 font-mono font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/40">
                                        {activeCamera.azimuthDeg || 0}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    step="1"
                                    value={activeCamera.azimuthDeg || 0}
                                    onChange={(e) => onUpdateActiveCamera({ azimuthDeg: Number(e.target.value) })}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                            </div>

                            {/* FOV Angle & Range */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-slate-400 text-[9px] uppercase font-bold">FOV Spread</span>
                                        <span className="text-slate-200 font-mono font-bold text-[9px]">{activeCamera.fovAngleDeg || 85}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="35"
                                        max="125"
                                        step="1"
                                        value={activeCamera.fovAngleDeg || 85}
                                        onChange={(e) => onUpdateActiveCamera({ fovAngleDeg: Number(e.target.value) })}
                                        className="w-full accent-indigo-400 cursor-pointer"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-slate-400 text-[9px] uppercase font-bold">Range (R)</span>
                                        <span className="text-slate-200 font-mono font-bold text-[9px]">{activeCamera.rangeM || 75}m</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="20"
                                        max="220"
                                        step="5"
                                        value={activeCamera.rangeM || 75}
                                        onChange={(e) => onUpdateActiveCamera({ rangeM: Number(e.target.value) })}
                                        className="w-full accent-indigo-400 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Optic Model Preset Selector */}
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1 font-bold uppercase">
                                    Optic Model Preset
                                </label>
                                <select
                                    value={activeCamera.model || 'Hikvision DS-2CD2087G2-LU (4K ColorVu)'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        let fov = 85;
                                        let range = 75;
                                        if (val.includes('ColorVu') || val.includes('2.8mm')) { fov = 115; range = 45; }
                                        else if (val.includes('AcuSense') || val.includes('4mm')) { fov = 89; range = 75; }
                                        else if (val.includes('Telephoto') || val.includes('6mm')) { fov = 53; range = 110; }
                                        else if (val.includes('PTZ')) { fov = 60; range = 160; }
                                        onUpdateActiveCamera({ model: val, fovAngleDeg: fov, rangeM: range });
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 text-[10px] font-mono"
                                >
                                    <option value="Hikvision DS-2CD2087G2-LU (4K ColorVu)">ColorVu 2.8mm (115° Ultra-Wide, 45m)</option>
                                    <option value="Hikvision DS-2CD2386G2-ISU (4mm AcuSense)">AcuSense 4mm (89° Standard Orchard, 75m)</option>
                                    <option value="Hikvision DS-2CD2T86G2-4I (6mm Telephoto)">Telephoto 6mm (53° Trench Corridor, 110m)</option>
                                    <option value="Hikvision DS-2DE4425IW-DE (25x PTZ)">25x Optical PTZ (60° Perimeter, 160m)</option>
                                </select>
                            </div>

                            {/* Real-time Computed Slope & Blind Zone Stats */}
                            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-[9.5px] font-mono text-slate-400 space-y-1">
                                <div className="flex justify-between">
                                    <span>📐 Terrain Slope at Pole:</span>
                                    <span className="text-emerald-400 font-bold">
                                        {getSlopeAndAspect(activeCamera.lat, activeCamera.lng, baseLat, baseLng).slopeDeg.toFixed(1)}°
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>🚫 Nadir Blind Zone:</span>
                                    <span className="text-red-400 font-bold">
                                        &lt; {computeBlindZoneDistanceM(activeCamera.mountHeightM || 6, activeCamera.tiltAngleDeg || 4, activeCamera.fovAngleDeg || 85)}m
                                    </span>
                                </div>
                            </div>

                            {/* Actions for this Camera */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={onMoveActiveCameraOnMap}
                                    className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        isMovingCamera
                                            ? 'bg-amber-600 text-white shadow ring-2 ring-amber-300'
                                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                                    }`}
                                >
                                    <Move size={13} />
                                    <span>{isMovingCamera ? (isKa ? 'დააწკაპუნეთ რუკაზე' : 'Click Map to Place') : (isKa ? 'გადატანა რუკაზე' : 'Move on Map')}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onOpenLiveCameraStream(activeCamera)}
                                    className="py-2 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow"
                                >
                                    <Video size={13} />
                                    <span>{isKa ? 'Live ნაკადი' : 'Live Stream'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowDeviceControl(!showDeviceControl)}
                                    className={`col-span-2 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                                        showDeviceControl 
                                            ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-300/40' 
                                            : 'bg-blue-950/80 hover:bg-blue-900 text-blue-200 border-blue-500/50'
                                    }`}
                                >
                                    <Move size={13} className="text-cyan-300" />
                                    <span>{showDeviceControl ? (isKa ? 'მართვის პანელის ჩაკეცვა' : 'Hide Device Control & Moving') : (isKa ? 'მოწყობილობის მართვა & გადაადგილება' : 'Device Control Panel & Move')}</span>
                                </button>
                            </div>

                            {/* Integrated Device Control Panel with Full Ability of Moving */}
                            {showDeviceControl && (
                                <div className="pt-2 border-t border-slate-800">
                                    <DeviceControlPanel
                                        camera={{
                                            id: activeCamera.id,
                                            name: activeCamera.name,
                                            channel: activeCamera.channel,
                                            model: activeCamera.model,
                                            ipAddress: activeCamera.ipAddress,
                                            lat: activeCamera.lat,
                                            lng: activeCamera.lng,
                                            azimuthDeg: activeCamera.azimuthDeg,
                                            tiltAngleDeg: activeCamera.tiltAngleDeg,
                                            opticalZoomX: (activeCamera as any).opticalZoomX || 2,
                                            digitalZoomX: (activeCamera as any).digitalZoomX || 1,
                                            rangeM: activeCamera.rangeM,
                                            mountHeightM: activeCamera.mountHeightM,
                                            isPtz: activeCamera.isPtz,
                                            isNightVision: activeCamera.isNightVision
                                        }}
                                        onUpdateCamera={(updated) => onUpdateActiveCamera(updated)}
                                        mapCenterCoords={[activeCamera.lat, activeCamera.lng]}
                                        isKa={isKa}
                                    />
                                </div>
                            )}
                        </div>

                        {/* LIST OF ALL CAMERAS (WITH INDIVIDUAL HIDE/UNHIDE EYE BUTTONS) */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                {isKa ? 'კამერების სია (დამალვა სათითაოდ):' : 'All Cameras List (Hide/Unhide One-by-One):'}
                            </span>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                {testCameras.map((cam, idx) => {
                                    const isHidden = hiddenCameraIds.includes(cam.id);
                                    const isSelected = cam.id === activeCamera.id;
                                    return (
                                        <div
                                            key={`popup-fleet-${cam.id}-${idx}`}
                                            className={`p-2 rounded-xl border flex items-center justify-between transition-colors ${
                                                isSelected 
                                                    ? 'bg-blue-950/40 border-blue-500/60' 
                                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div 
                                                className="flex items-center gap-2 cursor-pointer min-w-0"
                                                onClick={() => onSelectCamera(cam.id)}
                                            >
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${isHidden ? 'bg-slate-600' : 'bg-emerald-400 animate-pulse'}`} />
                                                <span className="font-mono font-bold text-xs text-white shrink-0">[CH0{cam.channel}]</span>
                                                <span className="text-slate-300 text-xs truncate max-w-[140px]">{cam.name}</span>
                                                <span className="text-[9px] text-slate-500 font-mono shrink-0">{cam.mountHeightM}m | {cam.azimuthDeg}°</span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleHideCamera(cam.id)}
                                                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                                        isHidden 
                                                            ? 'bg-red-950 text-red-300 border border-red-800' 
                                                            : 'bg-slate-800 text-slate-300 hover:text-white'
                                                    }`}
                                                    title={isHidden ? 'Unhide on map' : 'Hide from map'}
                                                >
                                                    {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* TAB 2: DRONE TOOLS (TRENCH FLIGHT & GIMBAL LIVE CONTROLS) */}
                {/* ========================================================= */}
                {activeMode === 'drone' && (
                    <div className="space-y-3.5">
                        <div className="p-3 bg-slate-900 rounded-2xl border border-cyan-500/40 space-y-2.5 shadow-lg">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                                    <span className="font-black text-xs text-white uppercase tracking-wider">
                                        {isKa ? 'თხრილების გასწვრივ ფრენის მისია' : 'Drone Trench Inspection Mission'}
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-800">
                                    4K Aerial Gimbal
                                </span>
                            </div>

                            {/* Plantation & Sector details */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                                    <span className="text-slate-400 block uppercase text-[8px]">Plantation</span>
                                    <span className="text-white font-bold">{testDroneMission.plantationName}</span>
                                </div>
                                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                                    <span className="text-slate-400 block uppercase text-[8px]">Sector</span>
                                    <span className="text-emerald-400 font-bold">{testDroneMission.sectorName}</span>
                                </div>
                            </div>

                            {/* Trenches selector chips: #1, #2, #3, #4, #5 */}
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                                    {isKa ? 'სამიზნე თხრილები (დააწკაპუნეთ ასარჩევად):' : 'Target Trenches (Click to toggle):'}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map((tNum, tIdx) => {
                                         const isSelected = (Array.isArray(testDroneMission.selectedTrenches) ? testDroneMission.selectedTrenches : [3, 4, 5]).includes(tNum);
                                         return (
                                             <button
                                                 key={`popup-trench-${tNum}-${tIdx}`}
                                                 type="button"
                                                 onClick={() => onToggleTrench(tNum)}
                                                 className={`flex-1 py-1.5 rounded-xl font-mono font-black text-xs transition-all cursor-pointer ${
                                                     isSelected
                                                         ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-300'
                                                         : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                                                 }`}
                                             >
                                                 #{tNum}
                                             </button>
                                         );
                                     })}
                                 </div>
                            </div>

                            {/* Altitude Slider (AGL) */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'ფრენის სიმაღლე (Altitude AGL)' : 'Flight Altitude (AGL)'}
                                    </span>
                                    <span className="text-cyan-400 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                                        {testDroneMission.currentAlt || 35}m
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="120"
                                    step="1"
                                    value={testDroneMission.currentAlt || 35}
                                    onChange={(e) => onUpdateDroneMission({ currentAlt: Number(e.target.value) })}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                />
                            </div>

                            {/* Gimbal Pitch Angle */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'გიმბალის დახრა (Gimbal Pitch)' : 'Gimbal Pitch (-90° Nadir to 0°)'}
                                    </span>
                                    <span className="text-amber-400 font-mono font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/40">
                                        {testDroneMission.gimbalPitchDeg || -45}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-90"
                                    max="0"
                                    step="5"
                                    value={testDroneMission.gimbalPitchDeg || -45}
                                    onChange={(e) => onUpdateDroneMission({ gimbalPitchDeg: Number(e.target.value) })}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>

                            {/* Optical Zoom Level */}
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Optical Zoom:</span>
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 4, 8].map((z, zIdx) => (
                                        <button
                                            key={`popup-zoom-${z}-${zIdx}`}
                                            type="button"
                                            onClick={() => onUpdateDroneMission({ opticalZoom: z })}
                                            className={`flex-1 py-1 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer ${
                                                testDroneMission.opticalZoom === z
                                                    ? 'bg-cyan-600 text-white shadow'
                                                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                                            }`}
                                        >
                                            {z}x
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons: Fly & Display Live Feed, Photo, REC */}
                            <div className="pt-2 space-y-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={onFlySelectedTrenches}
                                    className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer active:scale-95 transition-all"
                                >
                                    <Navigation size={14} className="stroke-[2.5]" />
                                    <span>{isKa ? 'ფრენა & პირდაპირი კამერის ხედი' : 'Fly & Display Live Gimbal Feed'}</span>
                                </button>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onDroneTakePhoto('Active Aerial Photo')}
                                        className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Camera size={13} />
                                        <span>Photo Capture</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onDroneToggleRecordVideo('Active Aerial Video')}
                                        className={`py-1.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                                            testDroneMission.isRecordingVideo 
                                                ? 'bg-red-600 text-white animate-pulse' 
                                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                        }`}
                                    >
                                        <Film size={13} />
                                        <span>{testDroneMission.isRecordingVideo ? 'Stop REC' : 'Record Video'}</span>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                                    <span>Live Feed Window:</span>
                                    <button
                                        type="button"
                                        onClick={() => onToggleDroneLiveFeed(!isDroneLiveFeedOpen)}
                                        className="text-cyan-400 font-bold hover:underline cursor-pointer"
                                    >
                                        {isDroneLiveFeedOpen ? 'Close Feed Window' : 'Open Feed Window'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* TAB 3: 3D SATELLITE TERRAIN, MAPBOX DEM & AI SLOPE DETECT */}
                {/* ========================================================= */}
                {activeMode === '3d' && (
                    <div className="space-y-3.5">
                        {/* 1. Automated Initial Layer (Mapbox Terrain DEM API) */}
                        <div className="p-3 bg-slate-900 rounded-2xl border border-emerald-500/40 space-y-2 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Satellite size={16} className="text-emerald-400" />
                                    <span className="font-black text-xs text-white uppercase tracking-wider">
                                        {isKa ? 'თანამგზავრული DEM რელიეფი (Mapbox API)' : 'Satellite DEM (Mapbox Terrain DEM)'}
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[9px] font-bold border border-emerald-800">
                                    InSAR / Radar
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                                {isKa 
                                    ? 'InSAR რადარული & სტერეოფოტოგრამეტრიული მონაცემები Mapbox Terrain DEM-ის მეშვეობით პირდაპირ ედება 3D რუკას.' 
                                    : 'Retrieves global satellite elevation data (Mapbox Terrain DEM) and drapes it naturally across your plantation coordinates.'}
                            </p>

                            <button
                                type="button"
                                onClick={onLoadSatelliteDem}
                                className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
                            >
                                <Satellite size={13} />
                                <span>{isKa ? 'თანამგზავრული რელიეფის ჩატვირთვა' : 'Load Satellite Elevation (Mapbox DEM)'}</span>
                            </button>

                            {/* Exaggeration Factor Slider */}
                            <div className="pt-1">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'რელიეფის გაძლიერების კოეფიციენტი' : 'Terrain Exaggeration Factor'}
                                    </span>
                                    <span className="text-emerald-400 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                                        {elevationExaggeration.toFixed(1)}x
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1.0"
                                    max="2.5"
                                    step="0.1"
                                    value={elevationExaggeration}
                                    onChange={(e) => onChangeExaggeration(Number(e.target.value))}
                                    className="w-full accent-emerald-400 cursor-pointer"
                                />
                                <span className="text-[9px] text-slate-500 block mt-0.5">
                                    Mapbox GL standard: 1.0 realistic, 1.5 - 2.0 pronounced slopes
                                </span>
                            </div>
                        </div>

                        {/* 2. AI-Driven Slope Detection */}
                        <div className="p-3 bg-slate-900 rounded-2xl border border-cyan-500/40 space-y-2 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-cyan-400" />
                                    <span className="font-black text-xs text-white uppercase tracking-wider">
                                        {isKa ? 'ფერდობის AI დეტექცია (Auto-Detect Slope)' : 'AI Slope & Ridge Auto-Detection'}
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-800">
                                    DSM → DTM
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                                {isKa 
                                    ? 'ხელოვნური ინტელექტი ფილტრავს მცენარეულობას (DSM → DTM) და ავტომატურად ხაზავს ქედის კონტურს (A, B წერტილებს).' 
                                    : 'AI filters vegetation cover (DSM to DTM) and automatically outlines ridge crest lines and slope contours.'}
                            </p>

                            <button
                                type="button"
                                onClick={onAiAutoDetectSlope}
                                disabled={isAiSlopeScanning}
                                className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
                            >
                                <Sparkles size={13} className={isAiSlopeScanning ? 'animate-spin' : ''} />
                                <span>{isAiSlopeScanning ? (isKa ? 'AI ანალიზი მიმდინარეობს...' : 'Scanning Satellite Imagery...') : (isKa ? 'ფერდობის AI ავტო-დეტექცია' : 'Auto-Detect Slope & Ridgeline (AI)')}</span>
                            </button>
                        </div>

                        {/* 3. Fine-Tuning / Override (Spine & Slope Sculptor) */}
                        <div className="p-3.5 bg-slate-900 rounded-2xl border border-amber-500/40 space-y-3 shadow-lg">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="font-black text-xs text-white uppercase tracking-wider">
                                    {isKa ? 'ზუსტი კორექცია (Spine & Slope Sculptor)' : 'Fine-Tuning: Spine & Slope Sculptor'}
                                </span>
                                <button
                                    type="button"
                                    onClick={onAddSpinePoint}
                                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                                >
                                    <Plus size={11} className="stroke-[3]" />
                                    <span>+ Point</span>
                                </button>
                            </div>

                            {/* Point selector chips: Point A, Point B... */}
                            <div className="flex flex-wrap gap-1.5">
                                {hillSpineProfile.points.map((pt, idx) => {
                                    const isSelected = pt.id === activePointId;
                                    const letter = String.fromCharCode(65 + idx);
                                    return (
                                        <button
                                            key={`popup-pt-${pt.id}-${idx}`}
                                            type="button"
                                            onClick={() => onSelectPointId(pt.id)}
                                            className={`px-2.5 py-1 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-amber-500 text-slate-950 font-black shadow ring-2 ring-amber-300' 
                                                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                                            }`}
                                        >
                                            <span>Point {letter}</span>
                                            <span className="text-[10px] opacity-80">{pt.peakHeightM > 0 ? `+${pt.peakHeightM}` : pt.peakHeightM}m</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Peak Height (H) Slider */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'პიკის სიმაღლე / სიღრმე (Peak H)' : 'Peak Height / Depth (Peak H)'}
                                    </span>
                                    <span className="text-cyan-400 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                                        {activePoint.peakHeightM > 0 ? `+${activePoint.peakHeightM}` : activePoint.peakHeightM}m
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-25"
                                    max="60"
                                    step="1"
                                    value={activePoint.peakHeightM}
                                    onChange={(e) => onUpdateActivePoint({ peakHeightM: Number(e.target.value) })}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                />
                            </div>

                            {/* Start Offset (Start of Slope Descent) */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'დაღმართის დაწყება (Start Offset)' : 'Start Offset (Crown Plateau)'}
                                    </span>
                                    <span className="text-sky-400 font-mono font-bold bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/40">
                                        {activePoint.startOffsetM}m
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="40"
                                    step="1"
                                    value={activePoint.startOffsetM}
                                    onChange={(e) => onUpdateActivePoint({ startOffsetM: Number(e.target.value) })}
                                    className="w-full accent-sky-400 cursor-pointer"
                                />
                            </div>

                            {/* End Distance (Zero Base level) */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                                        {isKa ? 'ფერდობის დასასრული (End Distance)' : 'End Distance (Zero Base Level)'}
                                    </span>
                                    <span className="text-emerald-400 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                                        {activePoint.endDistanceM}m
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="160"
                                    step="1"
                                    value={activePoint.endDistanceM}
                                    onChange={(e) => onUpdateActivePoint({ endDistanceM: Number(e.target.value) })}
                                    className="w-full accent-emerald-400 cursor-pointer"
                                />
                            </div>

                            {/* Slope Falloff Curve Selector */}
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                                    Falloff Function:
                                </span>
                                <div className="grid grid-cols-3 gap-1">
                                    {(['linear', 'cosine', 'plateau'] as const).map(fType => (
                                        <button
                                            key={fType}
                                            type="button"
                                            onClick={() => onUpdateActivePoint({ slopeFalloff: fType })}
                                            className={`py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                                                activePoint.slopeFalloff === fType 
                                                    ? 'bg-amber-500 text-slate-950 font-black shadow' 
                                                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                                            }`}
                                        >
                                            {fType}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* TAB 4: WINDOWS & TOOLS VISIBILITY MANAGER */}
                {/* ========================================================= */}
                {activeMode === 'windows' && (
                    <div className="space-y-3.5">
                        <div className="p-3 bg-slate-900 rounded-2xl border border-purple-500/40 space-y-2 shadow-lg">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="font-black text-xs text-white uppercase tracking-wider">
                                    {isKa ? 'ფანჯრებისა და ხელსაწყოების გამორთვა/ჩართვა' : 'Windows & Tool Panes Visibility Controller'}
                                </span>
                                <span className="text-[10px] text-purple-300 font-mono font-bold">
                                    Toggle Any Pane
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                                {isKa 
                                    ? 'აქედან შეგიძლიათ ჩართოთ ან სრულად გათიშოთ ნებისმიერი ფანჯარა, ხელსაწყოების პანელი ან რუკის ფენა.' 
                                    : 'Enable or disable any individual tool palette, floating window, or map overlay anytime.'}
                            </p>

                            <div className="space-y-2 pt-1">
                                {[
                                    { key: 'show3dWindow', label: isKa ? '🌐 3D Sandbox (PiP) ფანჯარა' : '🌐 Floating 3D PiP Window', active: is3dWindowOpen, onToggle: () => onToggle3dWindow(!is3dWindowOpen) },
                                    { key: 'showDroneLive', label: isKa ? '🛸 დრონის პირდაპირი კამერის ფანჯარა' : '🛸 Drone Live Gimbal Feed Window', active: isDroneLiveFeedOpen, onToggle: () => onToggleDroneLiveFeed(!isDroneLiveFeedOpen) },
                                    { key: 'showTopToolbar', label: isKa ? '🛠️ ზედა ხელსაწყოების პალიტრა' : '🛠️ Master Hardware Tool Palette Bar', active: visibility.showTopToolbar !== false, onToggle: () => onToggleVisibility('showTopToolbar') },
                                    { key: 'showTrenchConfigBar', label: isKa ? '🚜 დრონის თხრილების კონფიგურაციის ბარი' : '🚜 Drone Trench Flight Config Bar', active: visibility.showTrenchConfigBar !== false, onToggle: () => onToggleVisibility('showTrenchConfigBar') },
                                    { key: 'showBottomHud', label: isKa ? '📏 ქვედა გაზომვების HUD ბარი' : '📏 Bottom Measurements HUD', active: visibility.showBottomHud !== false, onToggle: () => onToggleVisibility('showBottomHud') },
                                    { key: 'showFleetTable', label: isKa ? '📋 კამერების ფლოტის ცხრილი (ქვემოთ)' : '📋 All Cameras Fleet Manager (Below Map)', active: visibility.showFleetTable !== false, onToggle: () => onToggleVisibility('showFleetTable') },
                                    { key: 'showBlindZones', label: isKa ? '🚫 ნადირის ბრმა ზონების დაჩრდილვა' : '🚫 Nadir Blind Zones Shading', active: visibility.showBlindZones, onToggle: () => onToggleVisibility('showBlindZones') },
                                    { key: 'showTrenches', label: isKa ? '🌱 საცნობარო თხრილები (#1-#5)' : '🌱 Reference Trenches (#1-#5)', active: visibility.showTrenches, onToggle: () => onToggleVisibility('showTrenches') },
                                    { key: 'showSoilSensors', label: isKa ? '💧 ნიადაგის NPK სენსორები' : '💧 Soil Moisture Probes', active: visibility.showSoilSensors, onToggle: () => onToggleVisibility('showSoilSensors') }
                                ].map((item, itIdx) => (
                                    <div
                                        key={`popup-win-item-${item.key}-${itIdx}`}
                                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800"
                                    >
                                        <span className="text-xs font-bold text-slate-200">{item.label}</span>
                                        <button
                                            type="button"
                                            onClick={item.onToggle}
                                            className={`px-3 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                                                item.active 
                                                    ? 'bg-emerald-600 text-white shadow' 
                                                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                                            }`}
                                        >
                                            {item.active ? (isKa ? 'ჩართული' : 'ENABLED') : (isKa ? 'გამორთული' : 'DISABLED')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. FOOTER STATUS BAR */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono shrink-0">
                <div className="flex items-center gap-2 text-slate-400 truncate">
                    <span className="text-cyan-400 font-bold">[CH0{activeCamera?.channel || 1}]</span>
                    <span className="truncate">{activeCamera?.name || 'Surveillance Cam'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold cursor-pointer transition-colors"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};
