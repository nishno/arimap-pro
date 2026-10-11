import React, { useState, useRef } from 'react';
import { 
    Camera, Navigation, User, Droplets, Video, 
    X, Plus, Copy, Trash2, Eye, EyeOff, Move, 
    ShieldCheck, Sliders, Check, AlertTriangle, Activity,
    GripVertical, RotateCcw, ChevronUp, ChevronDown
} from 'lucide-react';
import type { PlantationCamera } from './CameraNvrLab';
import type { SandboxSoilSensor, SandboxWaterSensor, SandboxWorkerGps, SandboxDroneMission } from './HardwareTestingSandboxMap';
import type { PlantationFeature } from '../../../types';

interface SandboxFloatingLeftPanelProps {
    selectedObject: {
        type: 'camera' | 'drone' | 'soil' | 'water' | 'worker' | 'seedling' | 'trench' | 'weather';
        data: any;
    } | null;
    onClose: () => void;
    
    // Cameras
    testCameras: PlantationCamera[];
    activeCamera: PlantationCamera;
    onSelectCameraId: (id: string) => void;
    onUpdateActiveCamera: (patch: Partial<PlantationCamera>) => void;
    onAddCamera: () => void;
    onDuplicateCamera: () => void;
    onDeleteCamera: () => void;
    hiddenCameraIds: string[];
    onToggleHideCamera: (id: string) => void;
    onMoveCameraOnMap: () => void;
    isMovingCamera: boolean;
    onOpenLiveStream: (cam: PlantationCamera) => void;

    // Drone
    testDroneMission: SandboxDroneMission;
    onUpdateDroneMission: (patch: Partial<SandboxDroneMission>) => void;
    onToggleTrench: (trenchNum: number) => void;
    onFlySelectedTrenches: () => void;
    plantationFeatures?: PlantationFeature[];

    // Workers
    testWorkersGps: SandboxWorkerGps[];
    onUpdateWorker?: (patch: Partial<SandboxWorkerGps>) => void;

    // Soil & Water
    testSoilSensors: SandboxSoilSensor[];
    testWaterSensors: SandboxWaterSensor[];

    isKa?: boolean;
}

export const SandboxFloatingLeftPanel: React.FC<SandboxFloatingLeftPanelProps> = ({
    selectedObject,
    onClose,
    testCameras,
    activeCamera,
    onSelectCameraId,
    onUpdateActiveCamera,
    onAddCamera,
    onDuplicateCamera,
    onDeleteCamera,
    hiddenCameraIds,
    onToggleHideCamera,
    onMoveCameraOnMap,
    isMovingCamera,
    onOpenLiveStream,
    testDroneMission,
    onUpdateDroneMission,
    onToggleTrench,
    onFlySelectedTrenches,
    plantationFeatures = [],
    testWorkersGps,
    testSoilSensors,
    testWaterSensors,
    isKa = false
}) => {
    const [panelTab, setPanelTab] = useState<'device' | 'fleet'>('device');
    const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {}

        const rect = containerRef.current?.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect ? rect.left : 16,
            startTop: rect ? rect.top : 64
        };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        e.preventDefault();
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newX = Math.max(8, Math.min(window.innerWidth - 300, dragRef.current.startLeft + dx));
        const newY = Math.max(8, Math.min(window.innerHeight - 200, dragRef.current.startTop + dy));
        setPanelPos({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
        dragRef.current = null;
    };

    if (!selectedObject) return null;

    const { type, data } = selectedObject;

    return (
        <div 
            ref={containerRef}
            style={panelPos ? {
                position: 'absolute',
                left: `${panelPos.x}px`,
                top: `${panelPos.y}px`,
                bottom: 'auto',
                maxHeight: 'calc(100vh - 80px)'
            } : undefined}
            className={`z-[1200] w-84 sm:w-96 max-w-[calc(100vw-24px)] bg-slate-950/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-200 ${
                panelPos ? '' : 'absolute left-3 top-16 bottom-4'
            }`}
        >
            {/* Header with Movable Grip */}
            <div 
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 select-none"
            >
                <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing flex-1">
                    <GripVertical size={15} className="text-slate-500 hover:text-cyan-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                        <h4 className="font-black text-xs sm:text-sm text-white uppercase tracking-tight flex items-center gap-1.5">
                            {type === 'camera' && <><Camera size={14} className="text-blue-400" /> {isKa ? 'კამერის კონფიგურაცია' : 'Camera Configuration'}</>}
                            {type === 'drone' && <><Navigation size={14} className="text-cyan-400" /> {isKa ? 'დრონის ფრენის მისია' : 'Drone Flight Mission'}</>}
                            {type === 'worker' && <><User size={14} className="text-purple-400" /> {isKa ? 'მუშის GPS ტრეკერი' : 'Worker GPS Tracker'}</>}
                            {type === 'soil' && <><Droplets size={14} className="text-emerald-400" /> {isKa ? 'ნიადაგის NPK სენსორი' : 'Soil NPK Sensor'}</>}
                            {type === 'water' && <><Droplets size={14} className="text-sky-400" /> {isKa ? 'წყლის ხარჯის სადგური' : 'Water Flow Station'}</>}
                            {type === 'trench' && <><ShieldCheck size={14} className="text-amber-400" /> {isKa ? 'სექტორის თხრილი' : 'Plantation Trench'}</>}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                            {type === 'camera' && `[CH0${activeCamera.channel}] ${activeCamera.name}`}
                            {type === 'drone' && `${testDroneMission.sectorName}`}
                            {type === 'worker' && `${data?.workerName || 'Worker'}`}
                            {type === 'soil' && `${data?.name || 'Soil Sensor'}`}
                            {type === 'water' && `${data?.name || 'Water Sensor'}`}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {panelPos && (
                        <button
                            type="button"
                            onClick={() => setPanelPos(null)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            title="Reset position to left"
                        >
                            <RotateCcw size={12} />
                        </button>
                    )}
                    {type === 'camera' && (
                        <button
                            type="button"
                            onClick={() => onToggleHideCamera(activeCamera.id)}
                            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                                hiddenCameraIds.includes(activeCamera.id)
                                    ? 'bg-red-950 text-red-300 border-red-800'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                            }`}
                            title={hiddenCameraIds.includes(activeCamera.id) ? 'Unhide on map' : 'Hide from map'}
                        >
                            {hiddenCameraIds.includes(activeCamera.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                        title={isMinimized ? 'Expand panel' : 'Minimize panel'}
                    >
                        {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                        title={isKa ? 'დახურვა (გაცურება)' : 'Close (Float away)'}
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
            <>
            {/* Navigation Tabs (Active Config vs Fleet Overview) */}
            <div className="flex items-center border-b border-slate-800/80 bg-slate-950/60 p-1 gap-1 text-[11px] font-bold shrink-0">
                <button
                    type="button"
                    onClick={() => setPanelTab('device')}
                    className={`flex-1 py-1 text-center rounded-lg transition-all ${
                        panelTab === 'device' 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    {isKa ? 'კონფიგურაცია' : 'Active Settings'}
                </button>
                <button
                    type="button"
                    onClick={() => setPanelTab('fleet')}
                    className={`flex-1 py-1 text-center rounded-lg transition-all ${
                        panelTab === 'fleet' 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    {isKa ? 'მოწყობილობების სია' : 'All Devices Fleet'}
                </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs text-slate-200">
                {panelTab === 'fleet' ? (
                    /* Fleet Overview Tab */
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {isKa ? 'რუკაზე განთავსებული მოწყობილობები:' : 'Deployed Map Devices:'}
                        </span>

                        {/* Cameras list */}
                        <div className="space-y-1">
                            <span className="text-[9px] uppercase font-bold text-blue-400">Cameras ({testCameras.length})</span>
                            {testCameras.map(cam => {
                                const isHidden = hiddenCameraIds.includes(cam.id);
                                const isSelected = cam.id === activeCamera.id;
                                return (
                                    <div 
                                        key={cam.id} 
                                        className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                                            isSelected ? 'bg-blue-950/50 border-blue-500/60' : 'bg-slate-900/60 border-slate-800'
                                        }`}
                                    >
                                        <div 
                                            className="flex items-center gap-2 cursor-pointer flex-1"
                                            onClick={() => onSelectCameraId(cam.id)}
                                        >
                                            <Camera size={13} className={isSelected ? 'text-blue-400' : 'text-slate-400'} />
                                            <div>
                                                <span className="font-bold text-white block text-[11px]">{cam.name}</span>
                                                <span className="text-[9px] text-slate-400 font-mono">CH0{cam.channel} • Tilt {cam.tiltAngleDeg || 4}°</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onToggleHideCamera(cam.id)}
                                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                                        >
                                            {isHidden ? <EyeOff size={12} className="text-red-400" /> : <Eye size={12} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Workers list */}
                        {testWorkersGps.length > 0 && (
                            <div className="space-y-1 pt-2 border-t border-slate-800">
                                <span className="text-[9px] uppercase font-bold text-purple-400">Workers ({testWorkersGps.length})</span>
                                {testWorkersGps.map(w => (
                                    <div key={w.id} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <User size={13} className="text-purple-400" />
                                            <div>
                                                <span className="font-bold text-white block text-[11px]">{w.workerName}</span>
                                                <span className="text-[9px] text-slate-400 font-mono">{w.role} • Bat: {w.batteryPct}%</span>
                                            </div>
                                        </div>
                                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Sensors list */}
                        <div className="space-y-1 pt-2 border-t border-slate-800">
                            <span className="text-[9px] uppercase font-bold text-emerald-400">Soil & Water Sensors ({testSoilSensors.length + testWaterSensors.length})</span>
                            {testSoilSensors.map(s => (
                                <div key={s.id} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[11px]">
                                    <span className="flex items-center gap-1.5"><Droplets size={12} className="text-emerald-400" /> {s.name}</span>
                                    <span className="font-mono text-[9px] text-emerald-400">{s.moistureVwc}% VWC</span>
                                </div>
                            ))}
                            {testWaterSensors.map(w => (
                                <div key={w.id} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[11px]">
                                    <span className="flex items-center gap-1.5"><Droplets size={12} className="text-sky-400" /> {w.name}</span>
                                    <span className="font-mono text-[9px] text-sky-400">{w.flowRateLpm} L/min</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : type === 'camera' ? (
                    /* CAMERA CONFIGURATION */
                    <div className="space-y-3">
                        {/* Channel selector chips & + Add Camera */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {isKa ? 'არხები & კამერები:' : 'Channels & Active Camera:'}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={onAddCamera}
                                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={11} /> + Add
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onDuplicateCamera}
                                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        <Copy size={11} /> Dup
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {testCameras.map(cam => {
                                    const isSel = cam.id === activeCamera.id;
                                    return (
                                        <button
                                            key={cam.id}
                                            type="button"
                                            onClick={() => onSelectCameraId(cam.id)}
                                            className={`px-2.5 py-1 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                                                isSel 
                                                    ? 'bg-blue-600 text-white shadow ring-2 ring-blue-400' 
                                                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                                            }`}
                                        >
                                            CH0{cam.channel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Name & Preset */}
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase block">
                                {isKa ? 'კამერის დასახელება' : 'Camera Label'}
                            </label>
                            <input
                                type="text"
                                value={activeCamera.name}
                                onChange={(e) => onUpdateActiveCamera({ name: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* POLE HEIGHT SLIDER */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-slate-400 font-bold uppercase text-[10px]">
                                    {isKa ? 'ბოძის სიმაღლე (Pole Height AGL)' : 'Mount Pole Height (AGL)'}
                                </span>
                                <span className="text-cyan-400 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                                    {activeCamera.mountHeightM || 6} m
                                </span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="20"
                                step="0.5"
                                value={activeCamera.mountHeightM || 6}
                                onChange={(e) => onUpdateActiveCamera({ mountHeightM: Number(e.target.value) })}
                                className="w-full accent-cyan-400 cursor-pointer"
                            />
                        </div>

                        {/* VERTICAL TILT / PITCH (DEFAULT 4°) */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-slate-400 font-bold uppercase text-[10px]">
                                    {isKa ? 'დახრის კუთხე (Vertical Tilt 4°)' : 'Vertical Pitch Tilt'}
                                </span>
                                <span className="text-amber-400 font-mono font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/40">
                                    {activeCamera.tiltAngleDeg || 4}° Downward
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
                            <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                                <span>0° (Horizon)</span>
                                <span className="text-amber-400 font-bold">4° Default Orchard Pitch</span>
                                <span>45° (Steep Hillside)</span>
                            </div>
                        </div>

                        {/* HORIZONTAL AZIMUTH / YAW */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-slate-400 font-bold uppercase text-[10px]">
                                    {isKa ? 'აზიმუტი / მიმართულება' : 'Horizontal Heading (Azimuth)'}
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

                        {/* FOV Spread & Optical Range */}
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
                                    <span className="text-slate-400 text-[9px] uppercase font-bold">Range</span>
                                    <span className="text-slate-200 font-mono font-bold text-[9px]">{activeCamera.rangeM || 75}m</span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    step="5"
                                    value={activeCamera.rangeM || 75}
                                    onChange={(e) => onUpdateActiveCamera({ rangeM: Number(e.target.value) })}
                                    className="w-full accent-indigo-400 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Optic Preset Dropdown */}
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-bold uppercase">Optic Model Preset</label>
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
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 text-[10px] font-mono cursor-pointer"
                            >
                                <option value="Hikvision DS-2CD2087G2-LU (4K ColorVu)">ColorVu 2.8mm (115° Ultra-Wide, 45m)</option>
                                <option value="Hikvision DS-2CD2386G2-ISU (4mm AcuSense)">AcuSense 4mm (89° Standard Orchard, 75m)</option>
                                <option value="Hikvision DS-2CD2T86G2-4I (6mm Telephoto)">Telephoto 6mm (53° Trench Corridor, 110m)</option>
                                <option value="Hikvision DS-2DE4425IW-DE (25x PTZ)">25x Optical PTZ (60° Perimeter, 160m)</option>
                            </select>
                        </div>

                        {/* Quick Actions (Move & Live Stream) */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={onMoveCameraOnMap}
                                className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    isMovingCamera 
                                        ? 'bg-amber-600 text-white shadow ring-2 ring-amber-300' 
                                        : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-800/40'
                                }`}
                            >
                                <Move size={12} />
                                <span>{isKa ? 'გადატანა' : 'Move on Map'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenLiveStream(activeCamera)}
                                className="py-2 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow"
                            >
                                <Video size={12} />
                                <span>{isKa ? 'Live Stream' : 'Live Stream'}</span>
                            </button>
                        </div>

                        {testCameras.length > 1 && (
                            <button
                                type="button"
                                onClick={onDeleteCamera}
                                className="w-full py-1.5 bg-red-950/40 hover:bg-red-950/80 text-red-400 border border-red-900/50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                                <Trash2 size={12} />
                                <span>{isKa ? 'კამერის წაშლა' : 'Delete Camera'}</span>
                            </button>
                        )}
                    </div>
                ) : type === 'drone' ? (
                    /* DRONE & TRENCH MISSION */
                    <div className="space-y-3">
                        {/* Sector dropdown */}
                        <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                                {isKa ? 'სექტორი & პლანტაცია' : 'Target Sector & Plantation'}
                            </label>
                            <select
                                value={testDroneMission.sectorName}
                                onChange={(e) => onUpdateDroneMission({ sectorName: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-emerald-300 font-mono text-xs cursor-pointer"
                            >
                                <option value="პატარა სექტორი (Small Sector)">📍 პატარა სექტორი (აგრობარი)</option>
                                {(plantationFeatures || [])
                                    .filter(f => f.type === 'area' || f.type === 'sector' || f.type === 'boundary')
                                    .map((f, idx) => (
                                        <option key={`p-feat-${idx}`} value={`${f.name || 'Sector'} [Map Planner]`}>
                                            📍 {f.name || 'Sector'} (Map Planner)
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Trenches selector chips: #1, #2, #3, #4, #5 */}
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                                {isKa ? 'არჩეული თხრილები ფრენისთვის:' : 'Selected Flight Trenches:'}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {[1, 2, 3, 4, 5].map(tNum => {
                                    const isSel = (Array.isArray(testDroneMission?.selectedTrenches) ? testDroneMission.selectedTrenches : [3, 4, 5]).includes(tNum);
                                    return (
                                        <button
                                            key={`trench-btn-${tNum}`}
                                            type="button"
                                            onClick={() => onToggleTrench(tNum)}
                                            className={`px-3 py-1 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${
                                                isSel 
                                                    ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-1 ring-amber-300' 
                                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                            }`}
                                        >
                                            #{tNum}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Altitude & Speed */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase block mb-0.5">Altitude AGL</span>
                                <input
                                    type="range"
                                    min="10"
                                    max="80"
                                    step="5"
                                    value={testDroneMission.altitudeM || 35}
                                    onChange={(e) => onUpdateDroneMission({ altitudeM: Number(e.target.value) })}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                />
                                <span className="text-cyan-400 font-mono text-[10px]">{testDroneMission.altitudeM || 35} m AGL</span>
                            </div>
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase block mb-0.5">Speed</span>
                                <input
                                    type="range"
                                    min="2"
                                    max="15"
                                    step="1"
                                    value={testDroneMission.speedMs || 5}
                                    onChange={(e) => onUpdateDroneMission({ speedMs: Number(e.target.value) })}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                />
                                <span className="text-cyan-400 font-mono text-[10px]">{testDroneMission.speedMs || 5} m/s</span>
                            </div>
                        </div>

                        {/* Primary Action Button */}
                        <button
                            type="button"
                            onClick={onFlySelectedTrenches}
                            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 cursor-pointer active:scale-95 transition-all"
                        >
                            <Video size={14} className="stroke-[2.5]" />
                            <span>{isKa ? 'ფრენა & კამერის ხედი' : 'Fly & Display Live Camera View'}</span>
                        </button>
                    </div>
                ) : type === 'worker' ? (
                    /* WORKER GPS TRACKER */
                    <div className="space-y-3">
                        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Worker Name</span>
                                <span className="font-bold text-white font-mono text-xs">{data.workerName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Role</span>
                                <span className="text-purple-300 font-mono text-xs">{data.role}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Battery</span>
                                <span className="text-emerald-400 font-mono font-bold text-xs">{data.batteryPct}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Heart Rate</span>
                                <span className="text-red-400 font-mono font-bold text-xs">{data.heartRateBpm} BPM</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* SOIL / WATER SENSOR */
                    <div className="space-y-3">
                        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Sensor ID</span>
                                <span className="text-white font-bold">{data.id}</span>
                            </div>
                            {data.moistureVwc !== undefined && (
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Moisture VWC</span>
                                    <span className="text-emerald-400 font-bold">{data.moistureVwc}%</span>
                                </div>
                            )}
                            {data.flowRateLpm !== undefined && (
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Flow Rate</span>
                                    <span className="text-sky-400 font-bold">{data.flowRateLpm} L/min</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            </>
            )}
        </div>
    );
};
